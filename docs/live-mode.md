# Live mode: users, devices and real-time updates

RIPPLE has two sides:

- **Simulation**: the seeded practice kitchen (speed up, rush, reset, what-ifs).
- **Live**: the real kitchen. A manager opens it, staff devices join it, and every check-off updates every screen.

This document describes the user scheme and how devices interact with a kitchen. The current build ships a **local preview backend** (kitchens live in the browser; tabs act as devices). Moving to real phones and tablets means implementing the same `LiveBackend` interface on a hosted service. The UI and engine don't change.

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

- **Now:** `LocalBackend` (`src/live/backend.ts`) uses `localStorage` for kitchens and logs, `BroadcastChannel` for realtime, and `sessionStorage` for each tab's session.
- **Next (suggested): Supabase.**
  - **Auth** for manager accounts.
  - **Postgres** tables above.
  - **Row Level Security:** members can only read their kitchen. Insert on `events` checks the same rule as `allowed()` in a Postgres function.
  - **Realtime** on `events` filtered by `kitchen_id` for `subscribe`, and **Presence** for who's online.
  - Firebase (Auth + Firestore + security rules) maps the same way.

## Not yet covered

- POS / DoorDash ingestion. These would publish `order_received` from a server-side webhook.
- Offline queueing on station tablets. Events would be stored locally and published on reconnect; replay already handles late arrivals.
- Staff counts per station that change during service, and editing the menu or recipes in the app.
