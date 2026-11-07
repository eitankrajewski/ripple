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

describe("manager moves, packing, couriers", () => {
  it("lets a manager move an order to any station, forward or back", () => {
    const log = [ev(1, manager, order)];
    let k = replay(START, log);
    const id = k.orders[0].id;
    log.push(ev(10, manager, { type: "move_order", orderId: id, to: "pack" }));
    k = replay(START, log);
    expect(deriveState(k).orders[0].status).toBe("packing");
    log.push(ev(20, manager, { type: "move_order", orderId: id, to: "cook" }));
    k = replay(START, log);
    expect(deriveState(k).orders[0].status).toBe("cooking");
    expect(allowed("cook", { type: "move_order", orderId: id, to: "pack" })).toBe(false);
  });

  it("tracks the pack checklist item by item", () => {
    const k = replay(START, [ev(1, manager, order)]);
    const id = k.orders[0].id;
    applyLiveEvent(k, ev(4, expo, { type: "pack_item", orderId: id, menuItemId: "beef_burger", checked: true }));
    expect(deriveState(k).orders[0].packed).toEqual([]);
    applyLiveEvent(k, ev(5, manager, { type: "move_order", orderId: id, to: "pack" }));
    applyLiveEvent(k, ev(5, expo, { type: "pack_item", orderId: id, menuItemId: "beef_burger", checked: true }));
    expect(deriveState(k).orders[0].packed).toEqual(["beef_burger"]);
    applyLiveEvent(k, ev(6, expo, { type: "pack_item", orderId: id, menuItemId: "beef_burger", checked: false }));
    expect(deriveState(k).orders[0].packed).toEqual([]);
  });

  it("times a DoorDash order to the Dasher and follows ETA changes", () => {
    const dd: LiveAction = { type: "order_received", source: "doordash", customer: "Sam", items: [{ menuItemId: "beef_burger", qty: 1 }], dasherName: "Alex R.", dasherEtaMinutes: 25, externalId: "dd-1" };
    const integration: Actor = { memberId: "doordash", name: "DoorDash", role: "integration" };
    const k = replay(START, [ev(1, integration, dd), ev(2, integration, dd)]);
    expect(k.orders).toHaveLength(1);
    const o = deriveState(k).orders[0];
    expect(o.dasher?.name).toBe("Alex R.");
    expect(o.fireInMinutes).toBeGreaterThan(10);
    applyLiveEvent(k, ev(3, integration, { type: "dasher_update", externalId: "dd-1", etaMinutes: 3 }));
    expect(deriveState(k).orders[0].fireInMinutes).toBe(0);
    expect(allowed("integration", { type: "approve_plan", plan: { id: "protect_pickups", label: "", heldOrderIds: [], deferredOrderIds: [], batch: false } })).toBe(false);
  });
});

describe("item-level routing, layout and menu", () => {
  const combo: LiveAction = {
    type: "order_received",
    source: "walk_in",
    customer: "Fay",
    items: [
      { menuItemId: "beef_burger", qty: 1 },
      { menuItemId: "veggie_burger", qty: 1 },
    ],
  };
  it("lets one component move ahead and makes Pack wait for all of them", () => {
    const k = replay(START, [ev(1, manager, combo)]);
    const id = k.orders[0].id;
    const steps = [
      ev(2, prep, { type: "item_done", orderId: id, menuItemId: "beef_burger", station: "prep" }),
      ev(3, cook, { type: "item_done", orderId: id, menuItemId: "beef_burger", station: "cook" }),
    ];
    const k2 = replay(START, [ev(1, manager, combo), ...steps]);
    const o = deriveState(k2).orders[0];
    expect(o.itemStage).toEqual({ beef_burger: "pack", veggie_burger: "prep" });
    const packEarly = replay(START, [ev(1, manager, combo), ...steps, ev(4, expo, { type: "task_done", orderId: id, station: "pack" })]);
    expect(deriveState(packEarly).orders[0].status).not.toBe("ready");
    const all = [
      ...steps,
      ev(5, prep, { type: "item_done", orderId: id, menuItemId: "veggie_burger", station: "prep" }),
      ev(6, cook, { type: "item_done", orderId: id, menuItemId: "veggie_burger", station: "cook" }),
      ev(7, expo, { type: "pack_item", orderId: id, menuItemId: "beef_burger", checked: true }),
      ev(8, expo, { type: "pack_item", orderId: id, menuItemId: "veggie_burger", checked: true }),
      ev(9, expo, { type: "task_done", orderId: id, station: "pack" }),
    ];
    expect(deriveState(replay(START, [ev(1, manager, combo), ...all])).orders[0].status).toBe("ready");
  });

  it("rejects another station's item check-off", () => {
    expect(allowed("cook", { type: "item_done", orderId: "x", menuItemId: "veggie_burger", station: "prep" })).toBe(false);
  });

  it("only managers change the layout and menu; placed stations add capacity", () => {
    const station = { id: "s1", kind: "prep" as const, x: 1, z: 2 };
    expect(allowed("prep", { type: "station_added", station })).toBe(false);
    expect(allowed("cook", { type: "menu_item_added", item: { id: "wings", name: "Wings", ingredients: {}, minutes: { prep: 1, cook: 2, pack: 0.3 } } })).toBe(false);
    const before = replay(START, []).config.stations.find((s) => s.id === "prep")!.staff;
    const k = replay(START, [
      ev(1, manager, { type: "station_added", station }),
      ev(2, manager, { type: "menu_item_added", item: { id: "wings", name: "Wings", ingredients: { chicken: 2 }, minutes: { prep: 1, cook: 2, pack: 0.3 } } }),
    ]);
    expect(k.layout).toHaveLength(1);
    expect(k.config.stations.find((s) => s.id === "prep")!.staff).toBe(before + 1);
    expect(k.config.menu.some((m) => m.id === "wings")).toBe(true);
    expect(replay(START, []).config.menu.some((m) => m.id === "wings")).toBe(false);
  });

  it("managers add pantry ingredients and link them to dishes that had none", () => {
    const ingredient = { id: "avocado", name: "Avocado", unit: "pcs", stock: 12, usedIn: ["wings"] };
    expect(allowed("prep", { type: "ingredient_added", ingredient })).toBe(false);
    expect(allowed("manager", { type: "ingredient_added", ingredient })).toBe(true);
    const k = replay(START, [
      ev(1, manager, { type: "menu_item_added", item: { id: "wings", name: "Wings", ingredients: {}, minutes: { prep: 1, cook: 2, pack: 0.3 } } }),
      ev(2, manager, { type: "ingredient_added", ingredient }),
    ]);
    expect(k.config.ingredients.find((i) => i.id === "avocado")).toMatchObject({ name: "Avocado", unit: "pcs", stock: 12 });
    expect(k.inventory.avocado).toBe(12);
    expect(k.config.menu.find((m) => m.id === "wings")!.ingredients).toEqual({ avocado: 1 });
  });

  it("managers move and rotate stations, shift staff and hold orders", () => {
    expect(allowed("prep", { type: "station_moved", id: "cook", x: 0, z: 0, rot: 0 })).toBe(false);
    expect(allowed("cook", { type: "staff_moved", from: "prep", to: "cook" })).toBe(false);
    const station = { id: "s1", kind: "cook" as const, x: 1, z: 2 };
    const base = replay(START, []).config.stations;
    const k = replay(START, [
      ev(1, manager, { type: "station_added", station }),
      ev(2, manager, { type: "station_moved", id: "s1", x: 4, z: -2, rot: Math.PI / 2 }),
      ev(3, manager, { type: "station_moved", id: "pack", x: 6, z: 3, rot: Math.PI }),
      ev(4, manager, { type: "staff_moved", from: "prep", to: "pack" }),
      ev(5, manager, order),
    ]);
    expect(k.layout[0]).toMatchObject({ x: 4, z: -2, rot: Math.PI / 2 });
    expect(k.basePoses.pack).toEqual({ x: 6, z: 3, rot: Math.PI });
    const staff = (id: string) => k.config.stations.find((s) => s.id === id)!.staff;
    expect(staff("prep")).toBe(base.find((s) => s.id === "prep")!.staff - 1);
    expect(staff("pack")).toBe(base.find((s) => s.id === "pack")!.staff + 1);
    const held = replay(START, [ev(1, manager, order), ev(2, manager, { type: "hold_order", orderId: k.orders[0].id })]);
    expect(deriveState(held).orders[0].status).toBe("held");
  });
});
