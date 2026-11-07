import { cloneKitchen, evaluatePhase, ingestEvent, itemCount, project, type Kitchen } from "./engine";
import { buildGraph, computeStrategies } from "./twin";
import type { Metrics, OrderItem, OrderSource, StationId, StrategyId } from "./types";

export type ScenarioKind = "walk_in" | "delivery_surge" | "catering" | "staff_out" | "stockout" | "restock";

export interface ScenarioSpec {
  kind: ScenarioKind;
  count: number;
  station?: StationId;
  ingredientId?: string;
  menuItemId?: string;
}

export interface ScenarioOption {
  id: string;
  label: string;
  kind: "strategy" | "lever";
  strategyId?: StrategyId;
  description: string;
  actions: string[];
  tradeoff: string;
  metrics: Metrics;
}

export interface ScenarioResult {
  spec: ScenarioSpec;
  title: string;
  assumptions: string[];
  before: Metrics;
  after: Metrics;
  stations: { id: StationId; name: string; before: number; after: number }[];
  shortages: { id: string; name: string; onHand: number; need: number }[];
  addedTickets: number;
  addedItems: number;
  options: ScenarioOption[];
  bestId: string;
}

export const SCENARIO_KINDS: { kind: ScenarioKind; label: string; unit: string }[] = [
  { kind: "walk_in", label: "Walk-in customers", unit: "customers" },
  { kind: "delivery_surge", label: "Delivery app surge", unit: "orders" },
  { kind: "catering", label: "Catering order", unit: "items" },
  { kind: "staff_out", label: "Staff call-out", unit: "people" },
  { kind: "stockout", label: "Ingredient runs out", unit: "left" },
  { kind: "restock", label: "Supplier delivery", unit: "units" },
];

const WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, couple: 2, three: 3, few: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, dozen: 12, fifteen: 15, twenty: 20, "twenty-five": 25, thirty: 30, forty: 40, fifty: 50,
};

const STATION_WORDS: [RegExp, StationId][] = [
  [/\b(prep|prepper|cutting)\b/, "prep"],
  [/\b(pack|packer|packing|expo|bagging|bagger)\b/, "pack"],
  [/\b(cook|cooks|line|grill|fry|chef|chefs)\b/, "cook"],
];

const INGREDIENT_WORDS: [RegExp, string][] = [
  [/\bchicken\b/, "chicken"],
  [/\b(beef|patty|patties|burger meat)\b/, "beef"],
  [/\b(veggie|plant)\b/, "veggie"],
  [/\blettuce\b/, "lettuce"],
  [/\btomato(es)?\b/, "tomato"],
  [/\bonions?\b/, "onion"],
  [/\bcheese\b/, "cheese"],
  [/\bbuns?\b/, "bun"],
  [/\b(tortillas?|wraps? shells?)\b/, "tortilla"],
];

const MENU_WORDS: [RegExp, string][] = [
  [/chicken (wraps?)/, "chicken_wrap"],
  [/chicken sandwich/, "chicken_sandwich"],
  [/chicken burgers?/, "chicken_burger"],
  [/veggie burgers?/, "veggie_burger"],
  [/(beef )?burgers?/, "beef_burger"],
  [/wraps?/, "chicken_wrap"],
];

function findNumber(t: string): number | null {
  const d = t.match(/\b(\d{1,3})\b/);
  if (d) return Number(d[1]);
  for (const w of t.split(/[^a-z-]+/)) if (w in WORDS && w !== "a" && w !== "an") return WORDS[w];
  return null;
}

const match = <T>(t: string, table: [RegExp, T][]) => table.find(([re]) => re.test(t))?.[1];

/** Deterministic, keyword-based reading of a what-if question. No AI involved. */
export function parseScenario(text: string): ScenarioSpec | null {
  const t = text.toLowerCase();
  const n = findNumber(t);
  const ingredientId = match(t, INGREDIENT_WORDS);
  if (/(sick|call(s|ed)? out|no[- ]show|short[- ]?staff|quit|leaves|left early|missing|down a|down one|absent)/.test(t)) {
    return { kind: "staff_out", count: Math.max(1, Math.min(n ?? 1, 3)), station: match(t, STATION_WORDS) ?? "cook" };
  }
  if (ingredientId && /(out of|run(s)? out|ran out|no more|86|shortage|short on|only|spoil|drop(ped)?|burn(ed|t)?)/.test(t)) {
    const only = /\bonly\b|\bleft\b/.test(t) && n !== null;
    return { kind: "stockout", count: only ? n! : 0, ingredientId };
  }
  if (ingredientId && /(deliver(y|ed)? of|restock|supplier|arriv|extra|more|get|receive)/.test(t) && !/(app|doordash|uber|online)/.test(t)) {
    return { kind: "restock", count: n ?? 20, ingredientId };
  }
  if (/(cater|large order|big order|group order|office|party order|event)/.test(t)) {
    return { kind: "catering", count: Math.max(1, Math.min(n ?? 20, 60)), menuItemId: match(t, MENU_WORDS) };
  }
  if (/(doordash|uber|delivery|online|app|grubhub)/.test(t)) {
    return { kind: "delivery_surge", count: Math.max(1, Math.min(n ?? 10, 40)) };
  }
  if (/(customer|guest|people|walk|table|bus|team|crowd|party|diners|tourists|students)/.test(t) || n !== null) {
    return { kind: "walk_in", count: Math.max(1, Math.min(n ?? 10, 80)) };
  }
  return null;
}

const MIX = ["beef_burger", "chicken_burger", "veggie_burger", "chicken_wrap", "beef_burger", "chicken_sandwich"];

interface Ticket {
  source: OrderSource;
  items: OrderItem[];
  pickup: number;
  customer: string;
}

function ticketsFor(k: Kitchen, spec: ScenarioSpec): Ticket[] {
  const tickets: Ticket[] = [];
  const promise = (s: OrderSource) => k.config.promises.find((p) => p.source === s)!.pickupMinutes;
  if (spec.kind === "walk_in") {
    let left = spec.count;
    let i = 0;
    while (left > 0) {
      const size = Math.min(2, left);
      const items: OrderItem[] = [];
      for (let j = 0; j < size; j++) {
        const id = MIX[(i * 2 + j) % MIX.length];
        const ex = items.find((x) => x.menuItemId === id);
        if (ex) ex.qty++;
        else items.push({ menuItemId: id, qty: 1 });
      }
      tickets.push({ source: "walk_in", items, pickup: promise("walk_in"), customer: `Walk-in party ${i + 1}` });
      left -= size;
      i++;
    }
  } else if (spec.kind === "delivery_surge") {
    for (let i = 0; i < spec.count; i++)
      tickets.push({ source: "doordash", items: [{ menuItemId: MIX[(i + 1) % MIX.length], qty: 1 }], pickup: promise("doordash"), customer: `App order ${i + 1}` });
  } else if (spec.kind === "catering") {
    const items: OrderItem[] = spec.menuItemId
      ? [{ menuItemId: spec.menuItemId, qty: spec.count }]
      : MIX.slice(0, 4).map((id, i) => ({ menuItemId: id, qty: Math.floor(spec.count / 4) + (i < spec.count % 4 ? 1 : 0) })).filter((x) => x.qty > 0);
    tickets.push({ source: "phone", items, pickup: 20, customer: "Catering order" });
  }
  return tickets;
}

/** Applies a scenario to a kitchen in place. Used both on a sandbox copy and, when approved, on the live twin. */
export function applyScenario(k: Kitchen, spec: ScenarioSpec): Kitchen {
  if (spec.kind === "staff_out") {
    k.config = {
      ...k.config,
      stations: k.config.stations.map((s) => (s.id === spec.station ? { ...s, staff: Math.max(1, s.staff - spec.count) } : s)),
    };
    evaluatePhase(k);
    return k;
  }
  if (spec.kind === "stockout" || spec.kind === "restock") {
    const cur = k.inventory[spec.ingredientId!] ?? 0;
    ingestEvent(k, { type: "stock_correction", ingredientId: spec.ingredientId, newStock: spec.kind === "stockout" ? spec.count : cur + spec.count });
    return k;
  }
  for (const t of ticketsFor(k, spec)) {
    ingestEvent(k, { type: "order_received", source: t.source, items: t.items, pickupDeadlineMinutes: t.pickup, customer: t.customer });
  }
  return k;
}

const score = (m: Metrics) => m.projectedLateOrders * 1000 + m.ordersAtRisk * 100 + m.maxStationUtilization * 10 + m.repeatedPrepActions / 100;

export function scenarioTitle(spec: ScenarioSpec, k: Kitchen) {
  const ing = k.config.ingredients.find((i) => i.id === spec.ingredientId)?.name.toLowerCase();
  const st = k.config.stations.find((s) => s.id === spec.station)?.name;
  const item = k.config.menu.find((m) => m.id === spec.menuItemId)?.name.toLowerCase();
  switch (spec.kind) {
    case "walk_in": return `${spec.count} walk-in customer${spec.count === 1 ? "" : "s"} arrive at once`;
    case "delivery_surge": return `${spec.count} delivery app order${spec.count === 1 ? "" : "s"} land together`;
    case "catering": return `Catering order for ${spec.count} ${item ? `${item}${spec.count > 1 ? "s" : ""}` : "mixed items"}`;
    case "staff_out": return `${spec.count} ${st} staff call${spec.count === 1 ? "s" : ""} out`;
    case "stockout": return spec.count === 0 ? `We run out of ${ing}` : `Only ${spec.count} ${ing} left`;
    case "restock": return `Supplier drops off ${spec.count} ${ing}`;
  }
}

/** Runs a what-if on a copy of the live kitchen and ranks deterministic responses. */
export function runScenario(live: Kitchen, spec: ScenarioSpec): ScenarioResult {
  const cfg = live.config;
  const nowP = project(live, { mode: live.planMode });
  const sim = cloneKitchen(live);
  sim.feedPaused = true;
  sim.planMode = "default";
  const openBefore = sim.orders.length;
  applyScenario(sim, spec);
  sim.phase = "disrupted";
  const added = sim.orders.slice(openBefore);
  const p = project(sim, { mode: "default" });
  const graph = buildGraph(sim, p);
  const strategies = computeStrategies(sim, graph, p.metrics);

  const options: ScenarioOption[] = strategies.map((s) => ({
    id: s.id,
    label: s.label,
    kind: "strategy",
    strategyId: s.id,
    description: s.summary,
    actions: s.actions.slice(0, 2),
    tradeoff: s.tradeoff,
    metrics: s.metrics,
  }));

  const bottleneck = [...sim.config.stations].sort((a, b) => p.utilization[b.id] - p.utilization[a.id])[0];
  if (p.utilization[bottleneck.id] > cfg.warningUtilization) {
    const extra = cloneKitchen(sim);
    extra.config = { ...extra.config, stations: extra.config.stations.map((s) => (s.id === bottleneck.id ? { ...s, staff: s.staff + 1 } : s)) };
    options.push({
      id: "add_staff",
      label: `Add 1 person to ${bottleneck.name}`,
      kind: "lever",
      description: `Pull someone onto ${bottleneck.name} (${bottleneck.staff} → ${bottleneck.staff + 1} staff) and cook in pickup order.`,
      actions: [`${bottleneck.name}: ${bottleneck.staff} → ${bottleneck.staff + 1} staff`],
      tradeoff: "Someone has to leave another task, front of house or dish, for the next 10 minutes.",
      metrics: project(extra, { mode: "protect_pickups" }).metrics,
    });
  }
  if (p.short.length) {
    const fix = cloneKitchen(sim);
    for (const id of p.short) fix.inventory[id] = p.need[id];
    const names = p.short.map((id) => cfg.ingredients.find((i) => i.id === id)?.name.toLowerCase() ?? id);
    options.push({
      id: "emergency_restock",
      label: `Emergency restock`,
      kind: "lever",
      actions: [],
      tradeoff: "A runner is away for ~20 minutes and stock is bought at retail price.",
      description: `Get ${p.short.map((id, i) => `${p.need[id] - (sim.inventory[id] ?? 0)} ${names[i]}`).join(", ")} from a nearby store.`,
      metrics: project(fix, { mode: "protect_pickups" }).metrics,
    });
  }
  const bestId = [...options].sort((a, b) => score(a.metrics) - score(b.metrics))[0].id;

  const assumptions: string[] = [];
  if (spec.kind === "walk_in") assumptions.push(`Parties of 2, one entrée each → ${added.length} tickets`, "10-minute walk-in pickup promise");
  if (spec.kind === "delivery_surge") assumptions.push("One entrée per order", "14-minute delivery app promise");
  if (spec.kind === "catering") assumptions.push("One ticket, 20-minute pickup");
  if (spec.kind === "staff_out") assumptions.push("Absence lasts the next 10 minutes", "Remaining staff keep normal pace");
  if (spec.kind === "stockout" || spec.kind === "restock") assumptions.push("Stock count changes immediately");
  assumptions.push("Menu mix follows tonight's seeded orders");

  return {
    spec,
    title: scenarioTitle(spec, live),
    assumptions,
    before: nowP.metrics,
    after: p.metrics,
    stations: sim.config.stations.map((s) => ({ id: s.id, name: s.name, before: nowP.utilization[s.id], after: p.utilization[s.id] })),
    shortages: p.short.map((id) => ({ id, name: cfg.ingredients.find((i) => i.id === id)?.name ?? id, onHand: sim.inventory[id] ?? 0, need: p.need[id] })),
    addedTickets: added.length,
    addedItems: added.reduce((a, o) => a + itemCount(o.items), 0),
    options,
    bestId,
  };
}
