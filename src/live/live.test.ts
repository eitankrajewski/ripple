import { describe, expect, it } from "vitest";
import { deriveState } from "../engine/twin";
import { applyLiveEvent, membersFrom, replay } from "./apply";
import { allowed } from "./roles";
import type { Actor, LiveAction, LiveEvent } from "./types";

const START = Date.UTC(2026, 10, 7, 23, 0, 0);
const manager: Actor = { memberId: "m1", name: "Ana", role: "manager" };
const prep: Actor = { memberId: "m2", name: "Bo", role: "prep" };
const cook: Actor = { memberId: "m3", name: "Cy", role: "cook" };
const expo: Actor = { memberId: "m4", name: "Di", role: "expo" };

let n = 0;
const ev = (at: number, actor: Actor, action: LiveAction): LiveEvent => ({ id: `d:${++n}`, kitchenId: "k", at, ts: START + at * 1000, actor, action });

const order: LiveAction = { type: "order_received", source: "walk_in", customer: "Eve", items: [{ menuItemId: "beef_burger", qty: 1 }] };

describe("live kitchen", () => {
  it("starts empty and never generates orders on its own", () => {
    const k = replay(START, [ev(600, manager, { type: "member_joined", member: { id: "m1", name: "Ana", role: "manager", joinedAt: START } })]);
    expect(k.orders).toHaveLength(0);
    expect(deriveState(k).orders).toHaveLength(0);
  });

  it("moves an order through each station only when staff check it off", () => {
    const log = [ev(1, manager, order)];
    let k = replay(START, log);
    const id = k.orders[0].id;
    expect(deriveState(k).orders[0].status).toBe("queued");

    log.push(ev(120, prep, { type: "task_done", orderId: id, station: "prep" }));
    k = replay(START, log);
    expect(deriveState(k).orders[0].status).toBe("cooking");

    log.push(ev(300, cook, { type: "task_done", orderId: id, station: "cook" }));
    log.push(ev(360, expo, { type: "task_done", orderId: id, station: "pack" }));
    k = replay(START, log);
    expect(deriveState(k).orders[0].status).toBe("ready");

    log.push(ev(400, expo, { type: "picked_up", orderId: id }));
    k = replay(START, log);
    expect(k.orders).toHaveLength(0);
    expect(k.stats.pickedUp).toBe(1);
  });

  it("ignores check-offs from the wrong station or role", () => {
    const k = replay(START, [ev(1, manager, order)]);
    const id = k.orders[0].id;
    applyLiveEvent(k, ev(5, cook, { type: "task_done", orderId: id, station: "prep" }));
    applyLiveEvent(k, ev(6, cook, { type: "task_done", orderId: id, station: "cook" }));
    expect(deriveState(k).orders[0].status).toBe("queued");
    expect(allowed("cook", { type: "task_done", orderId: id, station: "prep" })).toBe(false);
    expect(allowed("host", { type: "approve_plan", plan: { id: "protect_pickups", label: "", heldOrderIds: [], deferredOrderIds: [], batch: false } })).toBe(false);
    expect(allowed("prep", { type: "stock_correction", ingredientId: "chicken", newStock: 3 })).toBe(true);
  });

  it("reaches the same state no matter when a device replays the log", () => {
    const log = [ev(1, manager, order), ev(2, manager, { ...order, customer: "Fay" }), ev(95, prep, { type: "task_done", orderId: "o11", station: "prep" })];
    const a = replay(START, log);
    const b = replay(START, [...log].reverse());
    expect(JSON.stringify(deriveState(a))).toBe(JSON.stringify(deriveState(b)));
  });

  it("tracks who is signed in", () => {
    const joined = (id: string, role: Actor["role"]) => ev(1, manager, { type: "member_joined", member: { id, name: id, role, joinedAt: START } });
    const members = membersFrom([joined("a", "manager"), joined("b", "prep"), ev(9, manager, { type: "member_left", memberId: "b" })]);
    expect(members.map((m) => m.id)).toEqual(["a"]);
  });
});
