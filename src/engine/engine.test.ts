import { describe, expect, it } from "vitest";
import { approveStrategy, createKitchen, ingestEvent, tick } from "./engine";
import { deriveState, strategyPlanForApproval } from "./twin";

function runToDisruption() {
  const k = createKitchen();
  for (let i = 0; i < 120 && deriveState(k).phase !== "disrupted"; i++) tick(k);
  return k;
}

describe("RIPPLE engine", () => {
  it("starts healthy with five seeded orders", () => {
    const s = deriveState(createKitchen());
    expect(s.phase).toBe("initial");
    expect(s.orders).toHaveLength(5);
    expect(s.glance.level).toBe("normal");
  });

  it("scripted rush creates chicken shortage, Prep overload and 4+ at-risk orders", () => {
    const k = runToDisruption();
    const s = deriveState(k);
    expect(s.phase).toBe("disrupted");
    expect(k.clockSeconds).toBe(40);
    expect(s.inventory.find((i) => i.id === "chicken")!.short).toBe(true);
    expect(s.stations.find((x) => x.id === "prep")!.utilization).toBeGreaterThan(1);
    expect(s.baseline.ordersAtRisk).toBeGreaterThanOrEqual(4);
    expect(s.feedPaused).toBe(true);
  });

  it("produces distinct strategies that improve on no change", () => {
    const s = deriveState(runToDisruption());
    expect(s.strategies.map((x) => x.id)).toEqual(["protect_pickups", "reduce_overload", "minimize_waste"]);
    const protect = s.strategies[0];
    expect(protect.metrics.ordersAtRisk).toBeLessThan(s.baseline.ordersAtRisk);
    expect(protect.metrics.maxStationUtilization).toBeLessThanOrEqual(1);
    expect(new Set(s.strategies.map((x) => JSON.stringify(x.metrics))).size).toBeGreaterThan(1);
  });

  it("approval applies the plan and resumes the feed", () => {
    const k = runToDisruption();
    const s = deriveState(k);
    approveStrategy(k, strategyPlanForApproval(k, s.strategies[0]));
    const after = deriveState(k);
    expect(after.phase).toBe("approved");
    expect(after.feedPaused).toBe(false);
    expect(after.baseline.ordersAtRisk).toBeLessThan(s.baseline.ordersAtRisk);
  });

  it("is deterministic and reset restores the exact initial state", () => {
    const a = runToDisruption();
    const b = runToDisruption();
    expect(deriveState(a)).toEqual(deriveState(b));
    expect(createKitchen()).toEqual(createKitchen());
  });

  it("never pretends unavailable stock exists", () => {
    const k = createKitchen();
    ingestEvent(k, { type: "stock_correction", ingredientId: "chicken", newStock: 1 });
    ingestEvent(k, { type: "rush_order" });
    tick(k, 30);
    expect(k.inventory.chicken).toBeGreaterThanOrEqual(0);
    const s = deriveState(k);
    expect(s.orders.some((o) => o.status === "blocked" || o.status === "held")).toBe(true);
  });
});

describe("what-if scenarios", () => {
  it("parses common manager questions", async () => {
    const { parseScenario } = await import("./scenario");
    expect(parseScenario("What should we do if 20 customers suddenly walk through the door?")).toMatchObject({ kind: "walk_in", count: 20 });
    expect(parseScenario("A cook calls out sick")).toMatchObject({ kind: "staff_out", station: "cook", count: 1 });
    expect(parseScenario("We ran out of tomatoes")).toMatchObject({ kind: "stockout", ingredientId: "tomato", count: 0 });
    expect(parseScenario("catering order of 30 chicken wraps")).toMatchObject({ kind: "catering", count: 30, menuItemId: "chicken_wrap" });
    expect(parseScenario("10 DoorDash orders at once")).toMatchObject({ kind: "delivery_surge", count: 10 });
    expect(parseScenario("hello")).toBeNull();
  });

  it("runs on a copy and never touches the live twin", async () => {
    const { runScenario } = await import("./scenario");
    const k = createKitchen();
    const before = JSON.stringify(k);
    const r = runScenario(k, { kind: "walk_in", count: 20 });
    expect(JSON.stringify(k)).toBe(before);
    expect(r.addedTickets).toBe(10);
    expect(r.after.maxStationUtilization).toBeGreaterThan(r.before.maxStationUtilization);
    expect(r.options.length).toBeGreaterThanOrEqual(3);
    expect(r.options.some((o) => o.id === r.bestId)).toBe(true);
  });
});
