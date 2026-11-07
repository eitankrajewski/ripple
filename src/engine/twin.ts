import {
  STATION_IDS,
  fmt,
  isOpen,
  itemsText,
  nowMinutes,
  orderNeeds,
  prepActions,
  project,
  sortForPlan,
  type Kitchen,
  type PlanOptions,
  type Projection,
  type SimOrder,
} from "./engine";
import type {
  DigitalTwinState,
  InventoryView,
  Metrics,
  OrderView,
  RippleEdge,
  RippleNode,
  RiskLevel,
  StationId,
  StationView,
  StrategyId,
  StrategyOption,
} from "./types";

const RANK: Record<RiskLevel, number> = { normal: 0, warning: 1, critical: 2 };
export const worst = (...r: RiskLevel[]): RiskLevel => r.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), "normal");

const GRAPH_INGREDIENTS = ["chicken", "beef", "lettuce"] as const;
const MAX_ORDER_NODES = 8;

function stationRisk(k: Kitchen, u: number): RiskLevel {
  if (u > k.config.criticalUtilization) return "critical";
  if (u >= k.config.warningUtilization) return "warning";
  return "normal";
}

function ingredientRisk(k: Kitchen, p: Projection, id: string): RiskLevel {
  const need = p.need[id] ?? 0;
  const onHand = k.inventory[id] ?? 0;
  if (need > onHand) return "critical";
  if (need > 0 && need >= onHand * 0.75) return "warning";
  return "normal";
}

const pct = (u: number) => `${Math.round(u * 100)}%`;
const num = (o: SimOrder) => `#${o.num}`;

export function buildGraph(k: Kitchen, p: Projection): { nodes: RippleNode[]; edges: RippleEdge[] } {
  const cfg = k.config;
  const nodes: RippleNode[] = [];
  const edges: RippleEdge[] = [];
  const ev = k.lastEvent;
  const stationRisks = Object.fromEntries(STATION_IDS.map((s) => [s, stationRisk(k, p.utilization[s])])) as Record<StationId, RiskLevel>;
  const ingRisks = Object.fromEntries(GRAPH_INGREDIENTS.map((id) => [id, ingredientRisk(k, p, id)])) as Record<string, RiskLevel>;

  const orderPool = k.orders.filter((o) => isOpen(o) && p.perOrder[o.id]);
  const ranked = sortForPlan(k, orderPool, k.planMode);
  let shown = ranked;
  if (ranked.length > MAX_ORDER_NODES) {
    const atRisk = ranked.filter((o) => p.perOrder[o.id].risk !== "normal" || o.id === ev.orderId);
    const rest = ranked.filter((o) => !atRisk.includes(o));
    const keep = new Set([...atRisk, ...rest].slice(0, MAX_ORDER_NODES).map((o) => o.id));
    shown = ranked.filter((o) => keep.has(o.id));
  }
  const orderRisk = (o: SimOrder) => p.perOrder[o.id].risk;
  const disruptive = ev.kind !== "feed" || k.phase === "disrupted";
  const eventRisk: RiskLevel =
    disruptive && (p.short.length || p.metrics.maxStationUtilization > cfg.criticalUtilization)
      ? "critical"
      : disruptive && p.metrics.ordersAtRisk > 0
        ? "warning"
        : "normal";

  const midRow = (count: number, i: number) => i + (MAX_ORDER_NODES - count) / 2;

  nodes.push({ id: "evt", type: "event", label: ev.label, detail: ev.detail, risk: eventRisk, column: 0, row: midRow(1, 0) - 0.5 });

  const ingNames: Record<string, string> = { chicken: "Chicken", beef: "Beef patties", lettuce: "Lettuce" };
  GRAPH_INGREDIENTS.forEach((id, i) => {
    const need = p.need[id] ?? 0;
    const onHand = k.inventory[id] ?? 0;
    nodes.push({
      id: `ing-${id}`,
      type: "ingredient",
      label: ingNames[id],
      detail: need > onHand ? `${onHand} left, need ${need}` : `${onHand} left · ${need} queued`,
      risk: ingRisks[id],
      column: 1,
      row: midRow(3, i) * 1 - 0.5 + (i - 1) * 0.35,
      meta: `${Math.min(100, Math.round((need / Math.max(1, onHand)) * 100))}`,
    });
  });

  const totalPrep = Math.max(0.01, p.prepByTask.chicken + p.prepByTask.patty + p.prepByTask.produce);
  const prepRisk = stationRisks.prep;
  const taskDefs = [
    { id: "task-chicken", label: "Bread & fry chicken", ing: "chicken", load: p.prepByTask.chicken },
    { id: "task-patty", label: "Form patties", ing: "beef", load: p.prepByTask.patty },
    { id: "task-produce", label: "Wash & slice produce", ing: "lettuce", load: p.prepByTask.produce },
  ];
  taskDefs.forEach((t, i) => {
    const share = t.load / totalPrep;
    const risk = worst(ingRisks[t.ing], share >= 0.3 ? prepRisk : "normal");
    nodes.push({
      id: t.id,
      type: "task",
      label: t.label,
      detail: `${fmt(t.load)} min of prep · ${Math.round(share * 100)}% of load`,
      risk,
      column: 2,
      row: midRow(3, i) - 0.5 + (i - 1) * 0.35,
    });
  });

  const stationRows: Record<StationId, number> = { prep: 1.2, cook: 3.5, pack: 5.8 };
  for (const s of cfg.stations) {
    nodes.push({
      id: `st-${s.id}`,
      type: "station",
      label: s.name,
      detail: `${pct(p.utilization[s.id])} of capacity · ${s.staff} staff`,
      risk: stationRisks[s.id],
      column: 3,
      row: stationRows[s.id],
      meta: `${Math.round(p.utilization[s.id] * 100)}`,
    });
  }

  shown.forEach((o, i) => {
    const op = p.perOrder[o.id];
    const detail =
      op.status === "held"
        ? `Held · needs review`
        : op.status === "blocked"
          ? `Blocked: no ${cfg.ingredients.find((x) => x.id === op.blockedBy)?.name.toLowerCase() ?? "stock"}`
          : `Ready ~${fmt(op.readyIn ?? 0)}m · pickup ${fmt(op.pickupIn)}m`;
    nodes.push({
      id: o.id,
      type: "order",
      label: `${num(o)} ${o.isRush ? "RUSH · " : ""}${o.customer}`,
      detail,
      risk: op.risk,
      column: 4,
      row: midRow(shown.length, i),
      meta: itemsText(cfg, o.items),
    });
  });

  const late = Object.values(p.perOrder).filter((x) => x.late).length;
  const total = Object.keys(p.perOrder).length;
  const outcomeRisk: RiskLevel = late > 0 ? "critical" : p.metrics.ordersAtRisk > 0 ? "warning" : "normal";
  nodes.push({
    id: "outcome",
    type: "outcome",
    label: "Pickup promise",
    detail: late > 0 ? `${late} of ${total} orders projected late` : p.metrics.ordersAtRisk ? `${p.metrics.ordersAtRisk} tight, none late` : total ? `All ${total} pickups on time` : "No pickups due",
    risk: outcomeRisk,
    column: 5,
    row: midRow(1, 0) - 0.5,
  });

  const add = (source: string, target: string, relation: RippleEdge["relation"], active: boolean) =>
    edges.push({ id: `${source}->${target}`, source, target, relation, active });

  const evIngs = ev.kind === "feed" && !ev.orderId ? [...GRAPH_INGREDIENTS] : GRAPH_INGREDIENTS.filter((id) => ev.ingredientIds.includes(id));
  const taskRisk = (ing: string) => nodes.find((n) => n.id === taskDefs.find((t) => t.ing === ing)!.id)!.risk;
  for (const id of evIngs) {
    add("evt", `ing-${id}`, ev.kind === "stock" ? "consumes" : "increases", disruptive && (ingRisks[id] !== "normal" || taskRisk(id) !== "normal"));
  }
  for (const t of taskDefs) {
    const tRisk = taskRisk(t.ing);
    add(`ing-${t.ing}`, t.id, "requires", ingRisks[t.ing] !== "normal" || tRisk === "critical");
    add(t.id, "st-prep", "loads", tRisk !== "normal" && prepRisk !== "normal");
  }
  add("st-prep", "st-cook", "requires", stationRisks.cook !== "normal");
  add("st-cook", "st-pack", "requires", stationRisks.pack !== "normal");

  for (const o of shown) {
    const op = p.perOrder[o.id];
    if (op.blockedBy && (op.status === "blocked" || op.status === "held")) {
      const src = GRAPH_INGREDIENTS.includes(op.blockedBy as (typeof GRAPH_INGREDIENTS)[number]) ? `ing-${op.blockedBy}` : "st-prep";
      add(src, o.id, "blocks", op.status === "blocked");
    } else {
      const st = op.lateBecause ?? (o.remaining.prep > 0 ? "prep" : o.remaining.cook > 0 ? "cook" : "pack");
      add(`st-${st}`, o.id, "delays", orderRisk(o) !== "normal");
    }
    add(o.id, "outcome", "delays", orderRisk(o) !== "normal" && op.status !== "held");
  }
  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Strategies
// ---------------------------------------------------------------------------

interface StrategyPlan {
  opts: PlanOptions;
  batch: boolean;
}

function openUnstarted(k: Kitchen) {
  return k.orders.filter((o) => isOpen(o) && !o.consumed && !o.held);
}

function planFor(k: Kitchen, id: StrategyId): StrategyPlan {
  const queuedIds = new Set(openUnstarted(k).map((o) => o.id));
  switch (id) {
    case "protect_pickups":
      return { opts: { mode: "protect_pickups", holdBlocked: true, batch: queuedIds }, batch: true };
    case "minimize_waste":
      return { opts: { mode: "minimize_waste" }, batch: false };
    case "reduce_overload": {
      const base: PlanOptions = { mode: "default", batch: queuedIds };
      const defer = new Set<string>();
      let p = project(k, base);
      const bottleneck = (pp: Projection) => STATION_IDS.reduce((a, b) => (pp.utilization[b] > pp.utilization[a] ? b : a), "prep" as StationId);
      const station = bottleneck(p);
      const candidates = openUnstarted(k).filter((o) => !o.deferred && p.perOrder[o.id] && p.perOrder[o.id].status !== "blocked");
      while (p.utilization[station] > k.config.criticalUtilization) {
        let best: { id: string; proj: Projection; score: [number, number] } | null = null;
        for (const c of candidates) {
          if (defer.has(c.id)) continue;
          const tp = project(k, { ...base, defer: new Set(defer).add(c.id) });
          const score: [number, number] = [tp.metrics.projectedLateOrders, tp.utilization[station]];
          if (!best || score[0] < best.score[0] || (score[0] === best.score[0] && score[1] < best.score[1])) best = { id: c.id, proj: tp, score };
        }
        if (!best) break;
        defer.add(best.id);
        p = best.proj;
      }
      return { opts: { ...base, defer }, batch: true };
    }
  }
}

const LABELS: Record<StrategyId, { label: string; summary: string; rules: string[] }> = {
  protect_pickups: {
    label: "Protect Pickup Times",
    summary: "Cook in pickup-deadline order and stop tickets the stock can't cover.",
    rules: ["Sort tickets by pickup deadline", "Protect the earliest feasible orders", "Batch shared prep for those orders", "Flag stock-blocked orders for review"],
  },
  reduce_overload: {
    label: "Reduce Kitchen Overload",
    summary: "Pull the bottleneck station back under capacity by deferring the least urgent tickets.",
    rules: ["Find the busiest station", "Defer non-urgent tickets feeding it", "Batch to cut repeated prep", "Keep every station at or below 100%"],
  },
  minimize_waste: {
    label: "Minimize Waste",
    summary: "Use up the most perishable prepared stock first and skip new prep batches.",
    rules: ["Prioritize near-expiry ingredients", "Prefer orders that use them", "Avoid creating new batches", "Report the pickup-time cost"],
  },
};

function names(k: Kitchen, ids: string[]) {
  return ids.map((id) => `#${k.orders.find((o) => o.id === id)?.num ?? "?"}`);
}

function joinList(xs: string[]) {
  if (xs.length <= 1) return xs.join("");
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

export function computeStrategies(k: Kitchen, baselineGraph: { nodes: RippleNode[] }, baseline: Metrics): StrategyOption[] {
  const ids: StrategyId[] = ["protect_pickups", "reduce_overload", "minimize_waste"];
  return ids.map((id) => {
    const plan = planFor(k, id);
    const p = project(k, plan.opts);
    const ghost = cloneForPreview(k, plan, p);
    const graph = buildGraph(ghost.k, ghost.p);
    const before = new Map(baselineGraph.nodes.map((n) => [n.id, n.risk]));
    const changedNodeIds = graph.nodes.filter((n) => before.get(n.id) !== n.risk).map((n) => n.id);
    const held = p.heldIds.filter((x) => !k.orders.find((o) => o.id === x)?.held);
    const deferred = [...(plan.opts.defer ?? [])];
    const actions: string[] = [];
    const cfg = k.config;
    if (id === "protect_pickups") actions.push(`Re-sequence ${p.sequence.length} tickets by pickup time`);
    if (id === "minimize_waste") actions.push(`Run tomato & lettuce tickets first (freshness ≤ 90 min)`);
    if (plan.batch) {
      const saved = baseline.repeatedPrepActions - p.metrics.repeatedPrepActions;
      const shared = new Set(openUnstarted(k).flatMap((o) => prepActions(cfg, o.items)));
      const nm = [...shared].map((s) => cfg.ingredients.find((i) => i.id === s)?.name.toLowerCase() ?? s);
      if (saved > 0) actions.push(`Batch ${joinList(nm)} prep (saves ${saved} repeat setups)`);
    }
    if (deferred.length) actions.push(`Defer ${joinList(names(k, deferred))} until Prep drops below ${Math.round(cfg.criticalUtilization * 100)}%`);
    if (held.length) {
      const ing = p.perOrder[held[0]]?.blockedBy ?? "chicken";
      const ingName = cfg.ingredients.find((i) => i.id === ing)?.name.toLowerCase() ?? ing;
      actions.push(`Hold ${joinList(names(k, held))} for review (${ingName}: ${k.inventory[ing] ?? 0} left)`);
    }
    if (!actions.length) actions.push("Keep the current sequence");

    let tradeoff = "";
    const lateList = Object.entries(p.perOrder).filter(([, v]) => v.late).map(([oid]) => oid);
    if (id === "protect_pickups")
      tradeoff = held.length
        ? `${joinList(names(k, held))} ${held.length > 1 ? "need" : "needs"} your call: offer a swap or a later pickup.`
        : "Later tickets slide back to protect the earliest pickups.";
    else if (id === "reduce_overload")
    {
      const waitsLate = deferred.filter((d) => p.perOrder[d]?.late);
      tradeoff = deferred.length
        ? `More capacity buffer, but ${joinList(names(k, deferred))} ${deferred.length > 1 ? "wait" : "waits"}${waitsLate.length ? ` and ${waitsLate.length > 1 ? "miss" : "misses"} pickup` : ""}${lateList.length > waitsLate.length ? `; ${lateList.length - waitsLate.length} other${lateList.length - waitsLate.length > 1 ? "s" : ""} still late` : ""}.`
        : "Little to defer: overload stays high.";
    }
    else
      tradeoff = `Uses perishable stock first, but pickup performance is weaker (${p.metrics.projectedLateOrders} late).`;

    const opt: StrategyOption = {
      id,
      ...LABELS[id],
      actions,
      tradeoff,
      metrics: p.metrics,
      changedNodeIds,
      valid: Object.keys(p.perOrder).length > 0,
      heldOrderIds: held,
      deferredOrderIds: deferred,
      preview: graph,
    };
    return opt;
  });
}

function cloneForPreview(k: Kitchen, plan: StrategyPlan, p: Projection) {
  const ck: Kitchen = structuredClone(k);
  ck.planMode = plan.opts.mode;
  ck.phase = "approved";
  for (const o of ck.orders) {
    if (p.heldIds.includes(o.id)) o.held = true;
    if (plan.opts.defer?.has(o.id)) o.deferred = true;
  }
  if (plan.batch) {
    const seen = new Set<string>();
    for (const o of sortForPlan(ck, ck.orders.filter(isOpen), ck.planMode)) {
      if (o.consumed || o.held || o.batched) continue;
      for (const ing of prepActions(ck.config, o.items)) {
        if (seen.has(ing)) o.remaining.prep = Math.max(0.2, o.remaining.prep - ck.config.setupMinutesPerPrepAction);
        seen.add(ing);
      }
      o.batched = true;
    }
  }
  ck.lastEvent = { ...k.lastEvent };
  const pp = project(ck, { mode: ck.planMode });
  return { k: ck, p: pp };
}

export function strategyPlanForApproval(k: Kitchen, s: StrategyOption) {
  const plan = planFor(k, s.id);
  return { id: s.id, label: s.label, heldOrderIds: s.heldOrderIds, deferredOrderIds: s.deferredOrderIds, batch: plan.batch };
}

// ---------------------------------------------------------------------------
// View derivation
// ---------------------------------------------------------------------------

export function deriveState(k: Kitchen): DigitalTwinState {
  const cfg = k.config;
  const p = project(k, { mode: k.planMode });
  const graph = buildGraph(k, p);
  const strategies = k.phase === "disrupted" ? computeStrategies(k, graph, p.metrics) : [];

  const now = nowMinutes(k);
  const orders: OrderView[] = sortForPlan(k, k.orders, k.planMode).map((o) => {
    const op = p.perOrder[o.id];
    return {
      id: o.id,
      label: `#${o.num}`,
      customer: o.customer,
      source: o.source,
      items: o.items,
      itemsText: itemsText(cfg, o.items),
      isRush: o.isRush,
      status: op ? op.status : "ready",
      risk: op ? op.risk : "normal",
      reason: op ? op.reason : "Ready for pickup",
      createdAtMinutes: o.createdAtMin,
      pickupInMinutes: o.deadlineMin - now,
      projectedReadyInMinutes: op ? op.readyIn : 0,
      blockedBy: op?.blockedBy,
      lateBecause: op?.lateBecause,
      fireInMinutes: op ? (op.fireIn ?? (o.consumed ? null : 0)) : null,
      code: o.code,
      dasher: o.dasher ? { name: o.dasher.name, etaMinutes: o.dasher.etaMin - now } : undefined,
      packed: o.packed,
      externalId: o.externalId,
      itemStage: k.live
        ? { ...o.itemStage }
        : Object.fromEntries(o.items.map((i) => [i.menuItemId, STATION_IDS.find((s) => o.remaining[s] > 0) ?? "done"])),
    };
  });

  const stations: StationView[] = cfg.stations.map((s) => ({
    id: s.id,
    name: s.name,
    staff: s.staff,
    capacityMinutes: s.staff * cfg.windowMinutes,
    queuedMinutes: p.queued[s.id],
    utilization: p.utilization[s.id],
    risk: stationRisk(k, p.utilization[s.id]),
  }));

  const inventory: InventoryView[] = cfg.ingredients.map((i) => ({
    id: i.id,
    name: i.name,
    unit: i.unit,
    onHand: k.inventory[i.id] ?? 0,
    need: p.need[i.id] ?? 0,
    short: (p.need[i.id] ?? 0) > (k.inventory[i.id] ?? 0),
    risk: ingredientRisk(k, p, i.id),
    freshnessMinutes: i.freshnessMinutes,
    allergens: i.allergens,
  }));

  const glance = buildGlance(k, p, inventory, stations);
  const secondsToRush = k.rushFired ? null : Math.max(0, cfg.rushAtSeconds - k.clockSeconds);
  const clockMin = 18 * 60 + 30 + Math.floor(now);
  const serviceClock =
    k.live && k.liveStartedAt !== undefined
      ? new Date(k.liveStartedAt + k.clockSeconds * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : `${((Math.floor(clockMin / 60) + 11) % 12) + 1}:${String(clockMin % 60).padStart(2, "0")} PM`;

  return {
    layout: k.layout,
    menu: cfg.menu.map((m) => ({ id: m.id, name: m.name, ingredients: m.ingredients, minutes: m.minutes })),
    scenarioId: cfg.scenarioId,
    phase: k.phase,
    clockSeconds: k.clockSeconds,
    feedPaused: k.feedPaused,
    autoFrozen: k.autoFrozen,
    nodes: graph.nodes,
    edges: graph.edges,
    orders,
    stations,
    inventory,
    strategies,
    baseline: p.metrics,
    selectedStrategyId: k.selectedStrategyId,
    approvedStrategyId: k.approvedStrategyId,
    glance,
    feed: k.feed,
    nextRushInSeconds: secondsToRush,
    serviceClock,
  };
}

function buildGlance(k: Kitchen, p: Projection, inventory: InventoryView[], stations: StationView[]) {
  const late = p.metrics.projectedLateOrders;
  const shortIng = inventory.filter((i) => i.short);
  const over = stations.filter((s) => s.utilization > k.config.criticalUtilization);
  const parts: string[] = [];
  if (late > 0) parts.push(`${late} order${late > 1 ? "s" : ""} will be late.`);
  for (const i of shortIng) parts.push(`${i.name} is short (${i.onHand} left, need ${i.need}).`);
  for (const s of over) parts.push(`${s.name} is at ${Math.round(s.utilization * 100)}%.`);
  const held = p.heldIds.length;
  if (k.phase === "disrupted") {
    return { level: (late > 0 || shortIng.length ? "critical" : "warning") as RiskLevel, sentence: parts.join(" ") || "Kitchen is under strain." };
  }
  if (parts.length) {
    return { level: "warning" as RiskLevel, sentence: `${parts.join(" ")}${held ? ` ${held} held for review.` : ""}` };
  }
  const open = Object.keys(p.perOrder).length;
  if (k.phase === "approved") {
    const tight = p.metrics.ordersAtRisk;
    return {
      level: (tight ? "warning" : "normal") as RiskLevel,
      sentence: `Plan running. ${tight ? `${tight} order${tight > 1 ? "s" : ""} tight` : "All pickups on track"}${held ? `, ${held} held for review` : ""}.`,
    };
  }
  return { level: "normal" as RiskLevel, sentence: `Kitchen is healthy. ${open ? `All ${open} open orders on track.` : "No open orders."}` };
}

export { orderNeeds };
