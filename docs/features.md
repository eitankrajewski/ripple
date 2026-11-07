# RIPPLE features and the DoorDash x Nova problems they address

The slides list five pain points: **#01** order management and prep timing, **#02** order packing and pickup, **#03** inventory management and forecasting, **#04** bookkeeping and financial health, and **#05** staffing and skill optimization. Each feature below says which of these it addresses and exactly how.

## Front of house

| Feature | Problem | How it addresses it |
| --- | --- | --- |
| **Fire-time queue** (prep screen: *Start now* / *Start later*, "Start in 12m" chips) | #01 | Each ticket's start time = pickup or Dasher arrival − projected ready time (given everything queued ahead of it) − a 2-minute buffer. Staff no longer guess when to start: early tickets wait, so food doesn't sit, and urgent tickets rise to the top, so pickups aren't late. |
| **DoorDash intake** (`/api/doordash` signed webhook + test-order button) | #01 | Delivery orders land in the live kitchen automatically, with the Dasher's name and ETA, and nobody re-keys them. Repeated webhook deliveries are ignored, so no duplicate tickets. |
| **Dasher ETA re-timing** (`order.dasher_eta_updated`, ±5 min test buttons) | #01 | When a courier runs late or early, that ticket's pickup time and fire time update on every device at once. That handles the slide's "pickup times change" problem without anyone calling across the kitchen. |
| **Multi-channel orders** (DoorDash, walk-in, phone; *New order* form for hosts) | #01 | Every channel goes into one queue, but each keeps its own pickup promise, so one projection covers them all. |
| **Pack checklist** (expo ticks each item; *Packed* unlocks only when all are ticked) | #02 | Turns "make sure everything is packed correctly" into a required step, so a bag can't be marked packed with an item missing. |
| **Handoff check** (ask for the name + 3-letter code; *Matches* / *Doesn't match*) | #02 | Confirms the bag goes "to the right person". A mismatch blocks the handoff and is logged for the manager. |
| **Ready shelf** | #02 | Shows exactly which orders are waiting and for whom, so expo doesn't have to search. |
| **Station screens for phones and tablets** (big buttons, swipe right to complete) | #01, #02 | Each station sees only its own tickets. One tap or swipe moves an order to the next stage on every screen, which replaces the "constant communication" the slides describe. |
| **Component check-offs** (tick finished items on a ticket, *Send 1 to Cook*) | #01, #02 | A finished part of an order moves ahead on its own instead of waiting for the slowest item. Pack shows which parts are still upstream and can't finish the order until every part has arrived and been bagged. |
| **Do together batches** (same component across orders, *All 3 done → Cook*) | #01, #03 | When several tickets at a station share a component (for example chicken), they're grouped into one batch you finish with one tap, so the line preps it once instead of order by order. |
| **Manager Board** (drag any ticket to any station; drag from the list onto a 3D station; ··· "Move to" on touch) | #01, #02 | Managers fix problems directly, for example sending an order back to Cook for a re-make or skipping a step. Android phones vibrate on pick-up and drop. |
| **Status bar** (one line, click for a short issue list) | #01 | Each problem is one row with a plain button: compare plans, recount stock, open a station, or trace a late order. |
| **Over-capacity options** (station above 100%) | #01, #05 | Shown in the status list and the station inspector: move one person from the least busy station, hold the queued order with the latest pickup, or cancel it with a ready-to-send customer message (and a reminder to cancel on the DoorDash tablet). Each is a `staff_moved`, `hold_order` or `cancel_order` event. |

## Back of house

| Feature | Problem | How it addresses it |
| --- | --- | --- |
| **Pantry with live need vs. on hand** | #03 | Shows, for every ingredient, how much open orders still need against what's on the shelf. A shortage is flagged before the line runs out, not after. |
| **Stock recount** (manager or prep) | #03 | Fixes "inaccurate physical counts" in one tap. Held orders are released automatically when stock covers them again. |
| **Add ingredient** (manager) | #03 | Pantry tab or Pantry inspector: name, on-hand count and unit, plus which dishes use it (dishes with no ingredients, e.g. fresh from a menu scan, are pre-selected). Syncs to every device as an `ingredient_added` event, so new dishes get stock tracking and shortage warnings. |
| **Shortage-aware planning** (*Protect Pickup Times* holds orders the stock can't cover; *Minimize Waste* uses perishables first and batches prep) | #03 | Turns a shortage into a decision, with the trade-offs shown, instead of finding out when an order is blocked. It also reduces spoilage by using perishables first. |
| **Menu tab with menu scanning** (manager: add items, or photograph a menu) | #01, #03 | A photo is read on the device with Tesseract.js OCR and turned into draft dishes with guessed ingredients and station times. The manager checks every draft before it's saved, and the dishes then appear on every device's order forms and in the pantry math. |
| **Station load % and queued minutes** | #05 | Shows when a station has more work than its staff can handle (over 100% load), which is the signal to move someone. |
| **Ask AI what-ifs** ("20 customers walk in", "a cook calls out sick", "we run out of tomatoes") | #01, #03, #05 | Plays the scenario out on a copy of the kitchen and ranks responses (strategies, adding staff, emergency restock). This helps owners "plan ahead", and AI only rewords the explanation. |
| **Ripple detection + 3 response plans with explicit approval** | #01, #03, #05 | Compares late, at-risk and peak-load numbers for each plan. Nothing changes until the manager approves, and the approval then reaches every device. |

## Platform

| Feature | Problem | How it addresses it |
| --- | --- | --- |
| **3D kitchen digital twin** (click a station to see its status) | #01, #03, #05 | One visual of where every order is and which station or ingredient is the bottleneck. |
| **Station layout editor** (manager drags preset stations onto the 3D floor, then moves or rotates any station) | #05 | Bigger or differently shaped kitchens can be modeled: every extra Prep, Cook or Pack station adds one to that station's capacity and is drawn into the workflow (lanes from the station before it and to the station after it). Move and rotate are `station_moved` events, so the layout syncs to every device. |
| **Live vs. Simulation modes** | All | Live runs the real kitchen. Simulation is a seeded practice kitchen for training and demos, and it reproduces the same way every time. |
| **Roles and join codes** (Manager, Prep, Line cook, Expo, Host; Supabase with row-level security) | #02, #05 | Every device does only its own job, so mistakes like a cook checking off prep are rejected by the server. Staff join with a code and need no account. |
| **Event log + activity feed** | #02, #04 | Every check-off, move, handoff and plan approval is recorded with who did it and when. This is the base for performance tracking and for finding where mistakes happen. |
| **Help sheet (?)** | All | Explains every number and how to use the app, so new staff can get going without training. |

## Not covered yet

- **#04 Bookkeeping and financial health.** RIPPLE doesn't yet import sales reports, supplier invoices or payouts. The event log is the foundation: those records would be added as new event types and joined with order outcomes.
- **#05 skill mix and morale.** Load per station is shown, but staffing recommendations by skill and shift are future work.
