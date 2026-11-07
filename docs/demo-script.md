# RIPPLE: DoorDash x Nova hackathon pitch and demo

## The pain point we own

**Front House #01: order management and prep timing**, closed out by **#02: packing and pickup**.

> "Restaurants receive orders from different channels, each with its own timing… it can be difficult for staff to decide when to start preparing an order… This can result in longer wait times or food sitting too long before pickup."

During a rush, the line has to decide **when to start each ticket**, and today that happens in someone's head. If they start too early, food sits under a heat lamp and the Dasher picks up cold fries. If they start too late, the Dasher waits, the customer waits, and the merchant's ratings drop. Then the bag goes out missing an item or to the wrong courier.

**RIPPLE turns that decision into one number per ticket: the fire time.**

```
fire in = (when the Dasher arrives) − (projected ready time given everything ahead of it) − 2 min buffer
```

The number updates every time a new order lands, a station falls behind, or a Dasher's ETA changes.

## The streamlined flow (one order, start to finish)

| Step | Who | What they do | What RIPPLE does |
| --- | --- | --- | --- |
| 1. Order lands | Nobody | — | The DoorDash webhook adds the ticket with the Dasher's name and ETA. |
| 2. Fire | Prep tablet | Sees **Start now** / **Start in 6m**. Swipes right when prep is done. | Fire queue sorted by urgency, not by arrival. |
| 3. Cook | Line tablet | Swipes right. | Load % per station. Ripple alert if a station goes over 100%. |
| 4. Pack | Expo tablet | Ticks each item into the bag. **Packed** unlocks only when everything is ticked. | Item checklist, so no missing items. |
| 5. Handoff | Expo | Asks the Dasher for their name and 3-letter code, then taps **Matches**. | A wrong courier is stopped and logged. |
| Override | Manager | Drags any ticket to any station from the board or the 3D kitchen. | Every device updates instantly. |

## Demo: happy path (about 2 minutes)

1. Laptop: **Live → I'm the manager**, open "Ripple Burgers". Show the join code.
2. Phone or tablet: open the invite link and join as **Prep**. Second tablet: join as **Expo / Pack**.
3. Manager: **DoorDash → Send a test DoorDash order** three times. Tickets appear on the prep device instantly. One says **Start now**, the others **Start in 9m** under *Start later*.
4. Manager: **DoorDash → +5** on a Dasher ETA. That ticket moves back in the queue. *"The courier's running late, so the kitchen waits and the food doesn't sit."*
5. Prep: swipe right. The ticket moves to Cook. Manager: drag it on the **Board** from Cook to Pack, showing the override.
6. Expo: tick the two items. **Packed** unlocks, and the order goes to the ready shelf.
7. Expo: **Hand off → Matches**. The order is picked up on time, and the 3D kitchen and activity log show it.

## Demo: sad path (about 1.5 minutes)

1. Switch to **Simulation**, press **4×** (or **Rush order**). The scripted office-lunch rush lands: chicken runs short, Prep goes to 134%, and 3 orders will be late.
2. The **alert bar opens itself**: what changed, where the kitchen stands, and a *Do this now* list.
3. **Compare plans**: the three responses with late / at-risk / peak-load numbers. Preview one in 3D, then approve it.
4. **Ask AI**: "20 customers walk in at once". RIPPLE plays it out on a copy of the kitchen and recommends a response. AI only rewords the explanation and never calculates the numbers.
5. Back in Live, on Expo: **Hand off → Doesn't match**. A wrong handoff is stopped and logged for the manager.

## Why it stands out

- **Several pain points, one system** (the slides encourage this). It covers prep timing (#01), packing and handoff accuracy (#02), inventory shortages (#03 via the Pantry, recounts and shortage alerts) and staffing pressure (#05 via station load per staff member).
- **Deterministic first, AI second.** The numbers come from a model the merchant can trust and replay. Gemini only explains them.
- **Works on the devices kitchens already have.** Any phone or tablet browser works: big touch targets, swipe to complete, vibration on Android, no install.
- **DoorDash-native.** Orders arrive with Dasher ETAs, and ETA changes re-time the kitchen automatically.

## Trade-offs and what's next

- DoorDash partner API access is needed for production webhooks. The `/api/doordash` endpoint and mapping (`api/_doordash.ts`) are ready, and test orders stand in for the demo.
- Fire times are advisory. A kitchen can still start early, which RIPPLE shows as a higher load at Prep.
- Next steps:
  - **Back House:** pull supplier invoices and payouts into the same event log for #03 and #04.
  - **Staffing:** recommend staffing per station from the load history (#05).
