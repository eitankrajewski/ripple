# RIPPLE · Kitchen Digital Twin

> See the ripple effect. Compare your options. Then act.

**Live app:** <https://ripple-inky-tau.vercel.app>

RIPPLE is a real-time digital twin of a restaurant kitchen. Every order, check-off and stock count goes into a shared event log, and a deterministic engine on each device replays that log into a 3D model of the kitchen:

```
order → ingredients → Prep / Cook / Pack → order ready → pickup on time (or late)
```

When something goes wrong, such as a rush, a shortage or a station above 100%, RIPPLE shows how it spreads through the kitchen, compares responses side by side, and lets the manager approve one. Staff on phones and tablets work the same live kitchen from their own stations.

![RIPPLE screenshot](docs/screenshot.png)

## Features

### 3D kitchen
- **Interactive 3D model** of the kitchen (Orders in → Pantry → Prep → Cook → Pack → Pickup), built with Three.js and React Three Fiber. Orbit, zoom, and tap a station to fly to it and open its status.
- **Status at a glance:** rings appear only where something is wrong, and tracing an order lights up its path through the stations.
- **Custom layouts (manager only):** drag extra stations from a palette onto the floor, then move and rotate any station, original or new. New stations join the workflow, add capacity to their station type, and appear in the Kitchen tab as items you can select on their own (e.g. *Prep 2*).

### Live kitchen
- **Join with a code:** the manager opens a kitchen and gets a 6-character code. Staff join from any phone, tablet or laptop with a role (Prep, Line cook, Expo / Pack, Host). No accounts needed.
- **Station screens:** each role sees only its tickets, with large touch targets and swipe right to send a ticket on.
- **Item-level check-offs:** finished parts of an order move ahead on their own. Pack waits until every part has arrived.
- **Do together:** tickets at a station that share a component (e.g. chicken) are grouped so the line makes it once.
- **Manager Board:** drag any order to any station, forward or back, or drop it onto a 3D station. Android phones vibrate on pick-up and drop.
- **Roles enforced twice:** in the app and by row-level security in the database.

### DoorDash orders
- **Order intake:** a signed webhook (`POST /api/doordash`) drops orders into the live kitchen with the Dasher's name and ETA. Repeated deliveries are ignored.
- **Fire times:** every ticket gets a start time so it's ready as the Dasher arrives. Prep sees *Start now* / *Start in 12m*, and a late or early Dasher re-times the queue on every device.
- **Pack checklist and handoff check:** *Packed* unlocks only when every item is ticked, and Expo confirms the Dasher's name and code before handing the bag over.
- **Test orders:** a DoorDash button sends realistic orders for demos.

### Planning and what-ifs
- **Status bar:** one line for kitchen health. Click it for a short list of issues, each with a plain action.
- **Over capacity:** when a station goes above 100%, RIPPLE suggests moving a person from the least busy station, holding the order with the latest pickup, or cancelling an order with a ready-to-send customer message.
- **Plans:** *Protect Pickup Times*, *Reduce Kitchen Overload* and *Minimize Waste* are each simulated on a copy of the kitchen and compared against "no change". Nothing changes until the manager approves.
- **Ask:** type a what-if such as "20 customers just walked in" or "a cook called out sick". The engine plays it out on a copy of the kitchen and ranks the responses.

### Menu and pantry
- **Menu scanning:** photograph a menu and RIPPLE reads it on the device (Tesseract.js OCR with image cleanup and layout reconstruction), then turns each line into a draft dish with its price and station times.
- **Suggested ingredients:** each dish gets likely ingredients, including ones not in the pantry yet. Saving creates the dish and any new pantry ingredients together. The manager reviews everything before it's saved.
- **Pantry:** stock on hand against what open orders need, one-tap recounts, and shortage warnings before the line runs out.
- **Add and remove:** managers add or remove dishes and ingredients; changes sync to every device.

### Simulation mode
- A seeded scenario with a guaranteed rush and chicken shortage, for demos and training. Play, pause, 1×/2×/4× speed, *Rush order*, and *Reset* back to the exact same starting point.

Press **?** in the app for an explanation of every number and how to get around.

## How it works

![How RIPPLE works](docs/diagrams/flow.png)

1. **Orders in:** DoorDash webhooks, the in-app *New order* form, or the simulated feed.
2. **Shared event log:** every action is an append-only event in Supabase Postgres, protected by row-level security and pushed to every device with Supabase Realtime.
3. **Deterministic engine:** each device replays the events to rebuild the kitchen, traces each order to its ingredients and stations, and projects ready times, fire times and risk. The same events always give the same results.
4. **Detect and decide:** overloads, shortages and late pickups trigger ranked plans that the manager can approve.
5. **Screens:** the 3D twin and station screens update, and staff actions become new events.

More detail: [`docs/presentation.md`](docs/presentation.md) (technical features and diagrams), [`docs/features.md`](docs/features.md) (features mapped to merchant pain points), [`docs/live-mode.md`](docs/live-mode.md) (roles, data model, webhook format) and [`docs/demo-script.md`](docs/demo-script.md) (demo walkthrough).

## Tech stack

- **Languages:** TypeScript / TSX, SQL (PostgreSQL), CSS
- **Frontend:** React 19, Vite 8, Tailwind CSS 4, Framer Motion, Zustand, Lucide icons
- **3D:** Three.js, React Three Fiber, Drei
- **OCR:** Tesseract.js (WebAssembly, runs in the browser)
- **Backend:** Supabase (PostgreSQL, row-level security, Realtime, anonymous auth)
- **Hosting:** Vercel (static site and serverless functions on Node.js 22)
- **Tooling:** Vitest, oxlint, TypeScript, GitHub

## Run locally

Requires Node.js 22.12+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine and live-mode tests
npm run build      # type-check + production build into dist/
```

The local app connects to the same Supabase project as the live site, so live kitchens work across devices out of the box. To try it from a phone, open the address Vite prints under "Network" on the same Wi-Fi.

## Project layout

```
src/engine/           seed data, simulation (ingestEvent, tick, project), strategies, what-if scenarios
src/components/       Kitchen3D (Three.js scene), Toolbar, Navigator, Inspector, Plan / Ask tabs, Menu and Pantry panels
src/components/live/  sign-in, station screens, Board, New order form, DoorDash panel, team panel
src/live/             roles and permissions, live event types, event replay, Supabase backend
src/lib/              station layout, 3D area status, menu scanning (OCR + parsing), haptics
src/store.ts          Zustand store wiring the engine to the UI
supabase/migrations/  tables, row-level security, join functions, realtime
api/                  Vercel functions: DoorDash webhook and explanation wording
```

`ingestEvent()` in `src/engine/engine.ts` is the single entry point every event goes through, whether it comes from a device, a webhook or the simulation.

## Deployment

The `main` branch deploys to Vercel automatically on every push, and pull requests get preview URLs. Database changes live in `supabase/migrations/`.
