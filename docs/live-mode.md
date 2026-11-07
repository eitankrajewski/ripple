# Live mode: users, devices and real-time updates

RIPPLE has two sides:

- **Simulation**: the seeded practice kitchen (speed up, rush, reset, what-ifs).
- **Live**: the real kitchen. A manager opens it, staff devices join it, and every check-off updates every screen.

This document describes the user scheme and how devices interact with a kitchen. There are two backends behind the same `LiveBackend` interface:

- **Supabase** (`src/live/supabaseBackend.ts`) is used when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set. Real phones, tablets and laptops can join from anywhere.
- **Local preview** (`LocalBackend`) is used otherwise. Kitchens live in the browser and tabs act as devices.

## Supabase setup

1. Create a project at supabase.com.
2. Turn on **Authentication → Sign In / Providers → Anonymous sign-ins**. Devices sign in anonymously, so staff don't need accounts.
3. Run `supabase/migrations/20261107000000_live_kitchen.sql`, either in the SQL editor or with `npx supabase link && npx supabase db push`. It creates the tables, the row-level security policies, the `create_kitchen` / `join_kitchen` functions and the Realtime publication.
4. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Project Settings → API). On Vercel, add the same variables plus `SUPABASE_SERVICE_ROLE_KEY` and `RIPPLE_WEBHOOK_SECRET` for the DoorDash endpoint.

To run Supabase locally instead, run `npx supabase start` (needs Docker). Then set `VITE_SUPABASE_URL=/supabase` and `SUPABASE_PROXY_TARGET=http://127.0.0.1:54321` so the dev server proxies it, which lets a phone on your Wi-Fi join through `http://<your-computer-ip>:5173`. Server-side routes also need `SUPABASE_URL=http://127.0.0.1:54321`.

## DoorDash orders

`POST /api/doordash` (`api/doordash.ts`, with the mapping in `api/_doordash.ts`) accepts signed DoorDash-style webhooks:

```json
{
  "event_type": "order.created",
  "store": { "merchant_supplied_id": "<kitchen join code>" },
  "order": {
    "id": "dd-9001",
    "customer": { "first_name": "Sam", "last_name": "Lee" },
    "dasher": { "first_name": "Alex", "last_name": "Rivera" },
    "estimated_pickup_time": "2026-11-07T19:30:00Z",
    "items": [{ "merchant_supplied_id": "beef_burger", "name": "Beef Burger", "quantity": 2 }]
  }
}
```

- **Signature:** the `x-ripple-signature` header carries the hex HMAC-SHA256 of the raw body, keyed with `RIPPLE_WEBHOOK_SECRET`.
- **Courier updates:** `order.dasher_eta_updated` moves the pickup time, and every device re-times that ticket.
- **Retries:** repeated deliveries of the same order are ignored.
- **Item matching:** items are matched by `merchant_supplied_id` or by name. Unknown items are reported back in the response.
- **Real DoorDash:** production use needs DoorDash partner API access, and only `mapDoorDash` should need to change to follow DoorDash's exact payload.
- **Testing without DoorDash:** managers and hosts can send test orders from the **DoorDash** button.

## Roles

| Role | Typical device | Sees | Can do |
| --- | --- | --- | --- |
| **Manager** | Laptop / office tablet | Full 3D twin, plans, Ask AI, team | Everything below, plus approve plans, release/cancel held orders, manage team |
| **Prep** | Prep-station tablet | Prep tickets (station screen) + read-only twin | Check off **prep**, recount pantry stock |
| **Line cook** | Line tablet | Cook tickets + read-only twin | Check off **cook** |
| **Expo / Pack** | Pass / expo tablet | Pack tickets, ready shelf | Check off **pack**, mark **picked up** |
| **Host** | Front counter | New-order form, order status, ready shelf | Enter orders, mark **picked up** |

Permissions live in `src/live/roles.ts` (`ROLES`, `can`, `allowed`). `allowed(role, action)` is the rule a server must enforce. For example, a station role can only check off its own station.

## Signing in

1. **Manager opens a kitchen**: they enter a kitchen name and their name. That creates a `kitchen` with a 6-character **join code** (no ambiguous characters) and makes them its owner.
2. **Devices join**: on a device, choose *Live → Join a kitchen*, enter the code (or open the invite link `?join=CODE`), type a name and pick a role.
3. Each device keeps its own session, so one browser can hold several devices in different tabs.
4. *Sign out of this device* ends the session and records `member_left`.

With a hosted backend, add real accounts (email magic link or Google) for managers. Join codes become short-lived device invites the manager can rotate or revoke. Staff devices can stay "kiosk" logins tied to a role.

## Data model

```
kitchens        id, name, join_code (unique), owner_id, created_at
members         id, kitchen_id, user_id?, name, role, joined_at, left_at?
events          id, kitchen_id, at (s since open), ts, actor_member_id, actor_role, action (jsonb)
```

TypeScript shapes live in `src/live/types.ts` (`KitchenSpace`, `Member`, `LiveEvent`, `LiveAction`).

### Events (append-only)

| Action | Who | Effect |
| --- | --- | --- |
| `member_joined` / `member_left` | anyone (self) | Team list |
| `order_received` | manager, host | New ticket at Orders in |
| `task_done {orderId, station}` | manager, that station | Clears the station's work. The first prep check-off draws ingredients from the pantry. After pack, the order is ready |
| `picked_up {orderId}` | manager, expo, host | Removes the order and counts on-time / late |
| `stock_correction` | manager, prep | Sets an ingredient's on-hand count |
| `approve_plan` | manager | Applies a strategy (holds, deferrals, batching) |
| `release_order` / `cancel_order` | manager | Resolves held or deferred orders |
| `move_order {orderId, to}` | manager | Puts an order at any station (forward or back) from the Board or by dragging onto the 3D labels |
| `pack_item {orderId, menuItemId, checked}` | manager, expo | Pack checklist; **Packed** unlocks when every item is in the bag |
| `dasher_update {orderId \| externalId, etaMinutes}` | manager, host, DoorDash | Moves the pickup time, which re-times the ticket's fire time |
| `handoff_mismatch` | manager, expo, host | Logs a stopped wrong handoff (the name or code didn't match) |

## How devices stay in sync

The kitchen state is **derived** from the event log, never stored:

```
state = replay(kitchen.created_at, events sorted by (at, ts, id))
```

- `replay` and `applyLiveEvent` (`src/live/apply.ts`) are pure and use the same deterministic engine as the simulation.
- The live clock runs in real time (1 s = 1 s). Risk is re-checked on fixed 30-second boundaries (`advanceTo`), so two devices that replay the same log always agree. The test in `src/live/live.test.ts` replays a log in a different order and checks that the state comes out the same.
- On a new event, a device applies it incrementally if it comes after everything it has seen. Otherwise it replays the whole log.
- Projections (late, at risk, load) are recomputed locally from the shared state, so every screen shows the same numbers.

## Backend interface

```ts
interface LiveBackend {
  resume(): LiveSession | null;
  createKitchen(kitchenName, managerName): Promise<LiveSession>;
  joinKitchen(joinCode, name, role): Promise<LiveSession>;
  leave(session): Promise<void>;
  load(kitchenId): Promise<LiveEvent[]>;
  publish(session, action): Promise<LiveEvent>;
  subscribe(session, onEvent, onPresence): () => void;
}
```

- **`LocalBackend`:** `localStorage` holds kitchens and logs, `BroadcastChannel` handles realtime, and `sessionStorage` keeps each tab's session.
- **`SupabaseBackend`:**
  - **Sign-in:** anonymous Auth per device.
  - **Opening and joining:** the `create_kitchen` and `join_kitchen` functions, so the join code is the only way into a kitchen.
  - **Row-level security:** members only read their own kitchen. Inserts into `events` must use your own member id and real role, and pass `ripple_allowed()`, which mirrors `allowed()`. Managers and hosts may relay DoorDash orders.
  - **Live updates:** Realtime `postgres_changes` delivers new events, and Realtime Presence shows who's online.

## Not yet covered

- POS / DoorDash ingestion. These would publish `order_received` from a server-side webhook.
- Offline queueing on station tablets. Events would be stored locally and published on reconnect; replay already handles late arrivals.
- Staff counts per station that change during service, and editing the menu or recipes in the app.
