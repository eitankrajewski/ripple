import { nextRandom } from "./rng";
import { DEFAULT_CONFIG, type KitchenConfig, type SeedOrder } from "./seed";
import type {
  FeedEntry,
  Metrics,
  OrderEvent,
  OrderItem,
  OrderSource,
  OrderStatus,
  Phase,
  RiskLevel,
  StationId,
  StrategyId,
} from "./types";

export const STATION_IDS: StationId[] = ["prep", "cook", "pack"];

export interface SimOrder {
  id: string;
  num: number;
  customer: string;
  source: OrderSource;
  items: OrderItem[];
  isRush: boolean;
  createdAtMin: number;
  deadlineMin: number;
  remaining: Record<StationId, number>;
  consumed: boolean;
  blocked: boolean;
  held: boolean;
  deferred: boolean;
  batched: boolean;
  readyAtMin?: number;
}

export type PlanMode = "default" | StrategyId;

export interface EventInfo {
  kind: "feed" | "rush" | "stock";
  label: string;
  detail: string;
  orderId?: string;
  ingredientIds: string[];
}

export interface Ack {
  late: number;
  short: string[];
  maxUtil: number;
}

export interface Kitchen {
  config: KitchenConfig;
  rng: number;
  clockSeconds: number;
  nextOrderAtSeconds: number;
  nextNum: number;
  orders: SimOrder[];
  inventory: Record<string, number>;
  phase: Phase;
  feedPaused: boolean;
  autoFrozen: boolean;
  planMode: PlanMode;
  rushFired: boolean;
  lastEvent: EventInfo;
  feed: FeedEntry[];
  feedSeq: number;
  ack: Ack | null;
  selectedStrategyId?: StrategyId;
  approvedStrategyId?: StrategyId;
  stats: { pickedUp: number; onTime: number };
}

export const nowMinutes = (k: Kitchen) => k.clockSeconds * k.config.simMinutesPerSecond;

export function menuItem(k: Kitchen | KitchenConfig, id: string) {
  const cfg = "config" in k ? k.config : k;
  const item = cfg.menu.find((m) => m.id === id);
  if (!item) throw new Error(`Unknown menu item ${id}`);
  return item;
}

export function orderNeeds(cfg: KitchenConfig, items: OrderItem[]): Record<string, number> {
  const need: Record<string, number> = {};
  for (const it of items) {
    const m = menuItem(cfg, it.menuItemId);
    for (const [ing, q] of Object.entries(m.ingredients)) need[ing] = (need[ing] ?? 0) + q * it.qty;
  }
  return need;
}

export function prepActions(cfg: KitchenConfig, items: OrderItem[]): string[] {
  const need = orderNeeds(cfg, items);
  return cfg.ingredients.filter((i) => i.preppable && need[i.id]).map((i) => i.id);
}

function workFor(cfg: KitchenConfig, items: OrderItem[]): Record<StationId, number> {
  const w: Record<StationId, number> = { prep: 0, cook: 0, pack: 0 };
  for (const it of items) {
    const m = menuItem(cfg, it.menuItemId);
    for (const s of STATION_IDS) w[s] += m.minutes[s] * it.qty;
  }
  w.prep += prepActions(cfg, items).length * cfg.setupMinutesPerPrepAction;
  return roundWork(w);
}

function roundWork(w: Record<StationId, number>) {
  for (const s of STATION_IDS) w[s] = Math.round(w[s] * 100) / 100;
  return w;
}

export function itemsText(cfg: KitchenConfig, items: OrderItem[]) {
  return items.map((i) => `${i.qty}× ${menuItem(cfg, i.menuItemId).name}`).join(", ");
}

export function itemCount(items: OrderItem[]) {
  return items.reduce((a, i) => a + i.qty, 0);
}

export function isOpen(o: SimOrder) {
  return o.readyAtMin === undefined;
}

export function isStarted(o: SimOrder) {
  return o.consumed;
}

function rand(k: Kitchen) {
  const [s, v] = nextRandom(k.rng);
  k.rng = s;
  return v;
}

function pushFeed(k: Kitchen, kind: FeedEntry["kind"], text: string, orderId?: string) {
  k.feedSeq += 1;
  k.feed.unshift({ id: `f${k.feedSeq}`, atSeconds: k.clockSeconds, kind, text, orderId });
  if (k.feed.length > 40) k.feed.length = 40;
}

export function createKitchen(config: KitchenConfig = DEFAULT_CONFIG): Kitchen {
  const k: Kitchen = {
    config,
    rng: config.seed,
    clockSeconds: 0,
    nextOrderAtSeconds: 0,
    nextNum: 11,
    orders: [],
    inventory: Object.fromEntries(config.ingredients.map((i) => [i.id, i.stock])),
    phase: "initial",
    feedPaused: false,
    autoFrozen: false,
    planMode: "default",
    rushFired: false,
    lastEvent: { kind: "feed", label: "Simulated order feed", detail: "Waiting for orders", ingredientIds: [] },
    feed: [],
    feedSeq: 0,
    ack: null,
    stats: { pickedUp: 0, onTime: 0 },
  };
  for (const o of config.initialOrders) addOrder(k, o, false);
  k.lastEvent = { kind: "feed", label: "Simulated order feed", detail: `${config.initialOrders.length} tickets on the board`, ingredientIds: [] };
  pushFeed(k, "system", `Service started with ${config.initialOrders.length} open tickets`);
  scheduleNextOrder(k);
  evaluatePhase(k);
  return k;
}

function scheduleNextOrder(k: Kitchen) {
  const [lo, hi] = k.config.feedIntervalSeconds;
  k.nextOrderAtSeconds = k.clockSeconds + lo + Math.round(rand(k) * (hi - lo));
}

function addOrder(k: Kitchen, seed: SeedOrder, isRush: boolean): SimOrder {
  const now = nowMinutes(k);
  const o: SimOrder = {
    id: `o${k.nextNum}`,
    num: k.nextNum,
    customer: seed.customer,
    source: seed.source,
    items: seed.items.map((i) => ({ ...i })),
    isRush,
    createdAtMin: now,
    deadlineMin: now + seed.pickupDeadlineMinutes,
    remaining: workFor(k.config, seed.items),
    consumed: false,
    blocked: false,
    held: false,
    deferred: false,
    batched: false,
  };
  k.nextNum += 1;
  k.orders.push(o);
  return o;
}

function generateBackgroundOrder(k: Kitchen): SeedOrder {
  const r1 = rand(k);
  const source: OrderSource = r1 < 0.6 ? "doordash" : r1 < 0.85 ? "walk_in" : "phone";
  const count = rand(k) < 0.55 ? 1 : 2;
  const weights: [string, number][] = [
    ["beef_burger", 0.34],
    ["veggie_burger", 0.2],
    ["chicken_burger", 0.18],
    ["chicken_sandwich", 0.14],
    ["chicken_wrap", 0.14],
  ];
  const items: OrderItem[] = [];
  for (let i = 0; i < count; i++) {
    let r = rand(k);
    let id = weights[0][0];
    for (const [mid, w] of weights) {
      if (r < w) {
        id = mid;
        break;
      }
      r -= w;
    }
    if (!menuAvailable(k, id, items)) id = weights.map((w) => w[0]).find((m) => menuAvailable(k, m, items)) ?? id;
    const existing = items.find((x) => x.menuItemId === id);
    if (existing) existing.qty += 1;
    else items.push({ menuItemId: id, qty: 1 });
  }
  const customer = k.config.customers[Math.floor(rand(k) * k.config.customers.length)];
  const promise = k.config.promises.find((p) => p.source === source)!;
  return { customer, source, items, pickupDeadlineMinutes: promise.pickupMinutes };
}

function reservedNeeds(k: Kitchen) {
  const need: Record<string, number> = {};
  for (const o of k.orders) {
    if (!isOpen(o) || o.consumed || o.held) continue;
    for (const [ing, q] of Object.entries(orderNeeds(k.config, o.items))) need[ing] = (need[ing] ?? 0) + q;
  }
  return need;
}

/** Items whose stock is already spoken for are 86'd from the simulated menu. */
function menuAvailable(k: Kitchen, menuItemId: string, pending: OrderItem[]) {
  const reserved = reservedNeeds(k);
  const pend = orderNeeds(k.config, pending);
  const m = menuItem(k, menuItemId);
  return Object.entries(m.ingredients).every(([ing, q]) => (k.inventory[ing] ?? 0) - (reserved[ing] ?? 0) - (pend[ing] ?? 0) >= q);
}

/** Single entry point for every change to the kitchen. */
export function ingestEvent(k: Kitchen, event: OrderEvent): Kitchen {
  const cfg = k.config;
  switch (event.type) {
    case "order_received":
    case "rush_order": {
      const isRush = event.type === "rush_order";
      const source = event.source ?? "doordash";
      const promise = cfg.promises.find((p) => p.source === source)!;
      const seed: SeedOrder = {
        customer: event.customer ?? (isRush ? cfg.rush.customer : "Guest"),
        source,
        items: event.items ?? (isRush ? cfg.rush.items : [{ menuItemId: "beef_burger", qty: 1 }]),
        pickupDeadlineMinutes: event.pickupDeadlineMinutes ?? (isRush ? cfg.rush.pickupDeadlineMinutes : promise.pickupMinutes),
      };
      const o = addOrder(k, seed, isRush);
      const need = orderNeeds(cfg, o.items);
      const count = itemCount(o.items);
      if (isRush) {
        const chicken = need.chicken ?? 0;
        k.lastEvent = {
          kind: "rush",
          label: `Rush order #${o.num}`,
          detail: `${count} items${chicken ? ` · ${chicken} chicken` : ""} · pickup ${seed.pickupDeadlineMinutes}m`,
          orderId: o.id,
          ingredientIds: Object.keys(need),
        };
        pushFeed(k, "rush", `RUSH #${o.num} · ${o.customer} · ${itemsText(cfg, o.items)}`, o.id);
      } else {
        k.lastEvent = {
          kind: "feed",
          label: `New order #${o.num}`,
          detail: `${count} item${count > 1 ? "s" : ""} · ${o.customer}`,
          orderId: o.id,
          ingredientIds: Object.keys(need),
        };
        pushFeed(k, "order", `#${o.num} · ${o.customer} · ${itemsText(cfg, o.items)}`, o.id);
      }
      break;
    }
    case "stock_correction": {
      const id = event.ingredientId ?? cfg.stockCorrection.ingredientId;
      const ing = cfg.ingredients.find((i) => i.id === id);
      if (!ing) break;
      const before = k.inventory[id] ?? 0;
      const after = Math.max(0, Math.round(event.newStock ?? before + cfg.stockCorrection.delta));
      k.inventory[id] = after;
      k.lastEvent = {
        kind: "stock",
        label: `Stock count: ${ing.name}`,
        detail: `${before} → ${after} ${ing.unit}`,
        ingredientIds: [id],
      };
      pushFeed(k, "stock", `Recount ${ing.name}: ${before} → ${after} ${ing.unit}`);
      for (const o of k.orders) if (o.held && canAllocate(k, o)) o.held = false;
      break;
    }
    case "task_done": {
      const o = k.orders.find((x) => x.id === event.orderId);
      if (!o || !isOpen(o)) break;
      if (!o.consumed) {
        if (!canAllocate(k, o)) break;
        consume(k, o);
      }
      const station = STATION_IDS.find((s) => o.remaining[s] > 0);
      if (station) o.remaining[station] = 0;
      if (STATION_IDS.every((s) => o.remaining[s] <= 0)) markReady(k, o);
      break;
    }
  }
  evaluatePhase(k);
  return k;
}

function canAllocate(k: Kitchen, o: SimOrder) {
  const need = orderNeeds(k.config, o.items);
  return Object.entries(need).every(([ing, q]) => (k.inventory[ing] ?? 0) >= q);
}

function consume(k: Kitchen, o: SimOrder) {
  const need = orderNeeds(k.config, o.items);
  for (const [ing, q] of Object.entries(need)) k.inventory[ing] = Math.max(0, (k.inventory[ing] ?? 0) - q);
  o.consumed = true;
  o.blocked = false;
}

function markReady(k: Kitchen, o: SimOrder) {
  o.readyAtMin = nowMinutes(k);
  o.held = false;
  o.deferred = false;
  const late = o.readyAtMin > o.deadlineMin + k.config.lateGraceMinutes;
  pushFeed(k, "ready", `#${o.num} ready for pickup${late ? " (late)" : ""}`, o.id);
}

export function sortForPlan(k: Kitchen, orders: SimOrder[], mode: PlanMode): SimOrder[] {
  const cfg = k.config;
  const freshness = (o: SimOrder) =>
    Math.min(...Object.keys(orderNeeds(cfg, o.items)).map((id) => cfg.ingredients.find((i) => i.id === id)?.freshnessMinutes ?? 9999));
  const key = (o: SimOrder): number[] => {
    const started = isStarted(o) ? 0 : 1;
    switch (mode) {
      case "protect_pickups":
        return [started, o.deadlineMin, o.createdAtMin];
      case "minimize_waste":
        return [started, freshness(o), o.createdAtMin];
      default:
        return [started, o.isRush ? 0 : 1, o.createdAtMin];
    }
  };
  const sorted = [...orders].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
    return a.num - b.num;
  });
  return [...sorted.filter((o) => !o.deferred), ...sorted.filter((o) => o.deferred)];
}

export function tick(k: Kitchen, steps = 1): Kitchen {
  for (let i = 0; i < steps; i++) {
    if (k.feedPaused) break;
    stepOnce(k);
  }
  return k;
}

function stepOnce(k: Kitchen) {
  const cfg = k.config;
  k.clockSeconds += 1;
  const dt = cfg.simMinutesPerSecond;

  if (!k.rushFired && k.clockSeconds >= cfg.rushAtSeconds) {
    k.rushFired = true;
    ingestEvent(k, { type: "rush_order", source: cfg.rush.source, items: cfg.rush.items, customer: cfg.rush.customer });
    if (k.feedPaused) return;
  }
  if (k.clockSeconds >= k.nextOrderAtSeconds) {
    const seed = generateBackgroundOrder(k);
    scheduleNextOrder(k);
    ingestEvent(k, { type: "order_received", source: seed.source, items: seed.items, customer: seed.customer, pickupDeadlineMinutes: seed.pickupDeadlineMinutes });
    if (k.feedPaused) return;
  }

  const open = sortForPlan(k, k.orders.filter((o) => isOpen(o) && !o.held), k.planMode);
  for (const s of STATION_IDS) {
    let cap = (cfg.stations.find((x) => x.id === s)?.staff ?? 1) * dt;
    for (const o of open) {
      if (cap <= 1e-9) break;
      if (o.remaining[s] <= 0) continue;
      if (s === "prep") {
        if (!o.consumed) {
          if (!canAllocate(k, o)) {
            o.blocked = true;
            continue;
          }
          consume(k, o);
        }
      } else if (s === "cook" && o.remaining.prep > 0) continue;
      else if (s === "pack" && (o.remaining.prep > 0 || o.remaining.cook > 0)) continue;
      const w = Math.min(cap, o.remaining[s]);
      o.remaining[s] = Math.max(0, Math.round((o.remaining[s] - w) * 1000) / 1000);
      cap -= w;
    }
  }
  for (const o of open) if (isOpen(o) && STATION_IDS.every((s) => o.remaining[s] <= 0)) markReady(k, o);

  const now = nowMinutes(k);
  const keep: SimOrder[] = [];
  for (const o of k.orders) {
    if (o.readyAtMin !== undefined && now - o.readyAtMin >= cfg.readyLingerMinutes) {
      k.stats.pickedUp += 1;
      if (o.readyAtMin <= o.deadlineMin + cfg.lateGraceMinutes) k.stats.onTime += 1;
    } else keep.push(o);
  }
  k.orders = keep;

  for (const o of sortForPlan(k, k.orders.filter((x) => x.deferred && isOpen(x)), k.planMode)) {
    o.deferred = false;
    const trial = project(k, { mode: k.planMode });
    if (trial.metrics.maxStationUtilization > cfg.warningUtilization) {
      o.deferred = true;
      break;
    }
    pushFeed(k, "system", `#${o.num} released from deferral`, o.id);
  }
  evaluatePhase(k);
}

// ---------------------------------------------------------------------------
// Projection: deterministic "what happens next" for a given plan.
// ---------------------------------------------------------------------------

export interface OrderProjection {
  status: OrderStatus;
  risk: RiskLevel;
  reason: string;
  readyIn: number | null;
  pickupIn: number;
  blockedBy?: string;
  lateBecause?: StationId;
  late: boolean;
}

export interface Projection {
  sequence: SimOrder[];
  perOrder: Record<string, OrderProjection>;
  utilization: Record<StationId, number>;
  queued: Record<StationId, number>;
  need: Record<string, number>;
  short: string[];
  metrics: Metrics;
  prepByTask: { chicken: number; patty: number; produce: number };
  heldIds: string[];
  deferredIds: string[];
}

export interface PlanOptions {
  mode: PlanMode;
  hold?: Set<string>;
  defer?: Set<string>;
  batch?: Set<string>;
  holdBlocked?: boolean;
}

export function project(k: Kitchen, opts: PlanOptions): Projection {
  const cfg = k.config;
  const now = nowMinutes(k);
  const open = k.orders.filter(isOpen);
  const held = (o: SimOrder) => o.held || !!opts.hold?.has(o.id);
  const deferred = (o: SimOrder) => o.deferred || !!opts.defer?.has(o.id);

  const ordered = sortForPlan(
    k,
    open.map((o) => ({ ...o, deferred: deferred(o) })),
    opts.mode,
  );

  const avail = { ...k.inventory };
  const blocked: Record<string, string> = {};
  const holdNow = new Set<string>();
  for (const o of ordered) {
    if (o.consumed || held(o)) continue;
    const need = orderNeeds(cfg, o.items);
    const missing = Object.keys(need).find((ing) => (avail[ing] ?? 0) < need[ing]);
    if (missing) {
      if (opts.holdBlocked) holdNow.add(o.id);
      else blocked[o.id] = missing;
      continue;
    }
    for (const [ing, q] of Object.entries(need)) avail[ing] = (avail[ing] ?? 0) - q;
  }
  const isHeld = (o: SimOrder) => held(o) || holdNow.has(o.id);

  const need: Record<string, number> = {};
  for (const o of ordered) {
    if (o.consumed || isHeld(o)) continue;
    for (const [ing, q] of Object.entries(orderNeeds(cfg, o.items))) need[ing] = (need[ing] ?? 0) + q;
  }
  const short = cfg.ingredients.filter((i) => (need[i.id] ?? 0) > (k.inventory[i.id] ?? 0)).map((i) => i.id);

  // Batching: shared prep actions across batched, not-yet-started orders.
  const savings: Record<string, number> = {};
  const actionCounts: Record<string, { batched: number; solo: number }> = {};
  for (const o of ordered) {
    if (o.consumed || isHeld(o) || blocked[o.id]) continue;
    const inBatch = !!opts.batch?.has(o.id);
    for (const ing of prepActions(cfg, o.items)) {
      const c = (actionCounts[ing] ??= { batched: 0, solo: 0 });
      if (o.batched) c.batched += 1;
      else if (inBatch) {
        if (c.batched > 0) savings[o.id] = (savings[o.id] ?? 0) + cfg.setupMinutesPerPrepAction;
        c.batched += 1;
      } else c.solo += 1;
    }
  }
  let repeated = 0;
  for (const c of Object.values(actionCounts)) repeated += Math.max(0, c.solo + (c.batched > 0 ? 1 : 0) - 1);

  const rate = Object.fromEntries(cfg.stations.map((s) => [s.id, Math.max(0.1, s.staff)])) as Record<StationId, number>;
  const queued: Record<StationId, number> = { prep: 0, cook: 0, pack: 0 };
  const cum: Record<StationId, number> = { prep: 0, cook: 0, pack: 0 };
  const perOrder: Record<string, OrderProjection> = {};
  const prepByTask = { chicken: 0, patty: 0, produce: 0 };
  const sequence: SimOrder[] = [];

  for (const o of ordered) {
    const pickupIn = o.deadlineMin - now;
    if (isHeld(o)) {
      const n = orderNeeds(cfg, o.items);
      const missing = Object.keys(n).find((ing) => (k.inventory[ing] ?? 0) < n[ing]) ?? "chicken";
      const ingName = cfg.ingredients.find((i) => i.id === missing)?.name ?? missing;
      perOrder[o.id] = {
        status: "held",
        risk: "warning",
        reason: `Held for manager review: needs ${n[missing] ?? 0} ${ingName.toLowerCase()}`,
        readyIn: null,
        pickupIn,
        blockedBy: missing,
        late: false,
      };
      continue;
    }
    sequence.push(o);
    const own = { ...o.remaining };
    own.prep = Math.max(own.prep > 0 ? 0.2 : 0, own.prep - (savings[o.id] ?? 0));
    if (!o.consumed) {
      const items = o.items;
      for (const it of items) {
        const m = menuItem(cfg, it.menuItemId);
        const share = m.minutes.prep * it.qty;
        if (m.ingredients.chicken) prepByTask.chicken += share;
        else prepByTask.patty += share;
      }
      prepByTask.produce += Math.max(0, own.prep - items.reduce((a, it) => a + menuItem(cfg, it.menuItemId).minutes.prep * it.qty, 0));
    }
    const countsInWindow = !o.deferred;
    for (const s of STATION_IDS) {
      cum[s] += own[s];
      if (countsInWindow) queued[s] += own[s];
    }
    const prepDone = cum.prep / rate.prep;
    const cookByQueue = cum.cook / rate.cook;
    const cookByFlow = prepDone + own.cook / rate.cook;
    const cookDone = Math.max(cookByQueue, cookByFlow);
    const packByQueue = cum.pack / rate.pack;
    const ready = Math.max(packByQueue, cookDone + own.pack / rate.pack);
    const lateBecause: StationId = packByQueue >= cookDone + own.pack / rate.pack && packByQueue > prepDone + 1 ? "pack" : cookByQueue > cookByFlow + 0.5 ? "cook" : "prep";

    if (blocked[o.id]) {
      const ingName = cfg.ingredients.find((i) => i.id === blocked[o.id])?.name ?? blocked[o.id];
      const n = orderNeeds(cfg, o.items)[blocked[o.id]];
      perOrder[o.id] = {
        status: "blocked",
        risk: "critical",
        reason: `Blocked: needs ${n} ${ingName.toLowerCase()}, earlier tickets take the rest`,
        readyIn: null,
        pickupIn,
        blockedBy: blocked[o.id],
        late: true,
      };
      continue;
    }
    const late = ready > pickupIn + cfg.lateGraceMinutes;
    const tight = !late && ready > pickupIn - 1.5;
    const stationName = cfg.stations.find((s) => s.id === lateBecause)?.name ?? lateBecause;
    let status: OrderStatus = o.deferred ? "deferred" : !o.consumed ? "queued" : o.remaining.prep > 0 ? "prepping" : o.remaining.cook > 0 ? "cooking" : "packing";
    if (o.blocked && !o.consumed) status = "blocked";
    perOrder[o.id] = {
      status,
      risk: late ? "critical" : tight ? "warning" : "normal",
      reason: late
        ? `${stationName} backlog: ready in ${fmt(ready)}m, pickup in ${fmt(pickupIn)}m`
        : tight
          ? `Tight: ready in ${fmt(ready)}m, pickup in ${fmt(pickupIn)}m`
          : o.deferred
            ? `Deferred until ${stationName} frees up · ready in ${fmt(ready)}m`
            : `On track: ready in ${fmt(ready)}m, pickup in ${fmt(pickupIn)}m`,
      readyIn: ready,
      pickupIn,
      lateBecause: late || tight ? lateBecause : undefined,
      late,
    };
  }

  const utilization = Object.fromEntries(
    STATION_IDS.map((s) => [s, queued[s] / (rate[s] * cfg.windowMinutes)]),
  ) as Record<StationId, number>;

  const vals = Object.values(perOrder);
  const projectedLateOrders = vals.filter((p) => p.late).length;
  const ordersAtRisk = projectedLateOrders + vals.filter((p) => !p.late && p.risk === "warning" && p.status !== "held").length;
  return {
    sequence,
    perOrder,
    utilization,
    queued,
    need,
    short,
    metrics: {
      ordersAtRisk,
      projectedLateOrders,
      repeatedPrepActions: repeated,
      maxStationUtilization: Math.max(...Object.values(utilization)),
    },
    prepByTask,
    heldIds: ordered.filter(isHeld).map((o) => o.id),
    deferredIds: ordered.filter((o) => o.deferred).map((o) => o.id),
  };
}

export const fmt = (n: number) => (Math.abs(n) >= 10 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString());

// ---------------------------------------------------------------------------
// Phase & approval
// ---------------------------------------------------------------------------

function evaluatePhase(k: Kitchen) {
  if (k.planMode === "protect_pickups") {
    const pre = project(k, { mode: k.planMode, holdBlocked: true });
    for (const id of pre.heldIds) {
      const o = k.orders.find((x) => x.id === id);
      if (o && !o.held && !o.isRush) {
        o.held = true;
        pushFeed(k, "system", `#${o.num} auto-held for review: not enough stock`, o.id);
      }
    }
  }
  const p = project(k, { mode: k.planMode });
  const overloaded = p.metrics.maxStationUtilization > k.config.criticalUtilization;
  const condition = p.short.length > 0 || overloaded || p.metrics.projectedLateOrders >= 2;
  if (!condition) {
    if (k.phase === "disrupted") {
      k.phase = k.approvedStrategyId ? "approved" : "initial";
      k.selectedStrategyId = undefined;
      if (k.autoFrozen) {
        k.feedPaused = false;
        k.autoFrozen = false;
      }
      pushFeed(k, "system", "Disruption cleared");
    }
    return;
  }
  if (k.phase === "disrupted") return;
  const a = k.ack;
  const worse =
    (!a && (p.short.length > 0 || p.metrics.projectedLateOrders >= 2 || p.metrics.maxStationUtilization > k.config.criticalUtilization + 0.1)) ||
    (a &&
      (p.metrics.projectedLateOrders >= a.late + 2 ||
        p.short.some((s) => !a.short.includes(s)) ||
        (overloaded && p.metrics.maxStationUtilization > Math.max(k.config.criticalUtilization, a.maxUtil) + 0.3)));
  if (!worse) return;
  k.phase = "disrupted";
  k.selectedStrategyId = undefined;
  if (!k.feedPaused) {
    k.feedPaused = true;
    k.autoFrozen = true;
  }
  const names = p.short.map((s) => k.config.ingredients.find((i) => i.id === s)?.name ?? s);
  pushFeed(
    k,
    "system",
    `Ripple detected${names.length ? `: ${names.join(", ")} short` : ""}${overloaded ? `${names.length ? "," : ":"} station over capacity` : ""}. Twin frozen for planning.`,
  );
}

export function setPaused(k: Kitchen, paused: boolean): Kitchen {
  k.feedPaused = paused;
  k.autoFrozen = false;
  return k;
}

export function selectStrategy(k: Kitchen, id: StrategyId | undefined): Kitchen {
  k.selectedStrategyId = id;
  return k;
}

export function approveStrategy(k: Kitchen, plan: { id: StrategyId; label: string; heldOrderIds: string[]; deferredOrderIds: string[]; batch: boolean }): Kitchen {
  const cfg = k.config;
  k.planMode = plan.id;
  const open = k.orders.filter(isOpen);
  for (const o of open) {
    if (plan.heldOrderIds.includes(o.id)) o.held = true;
    if (plan.deferredOrderIds.includes(o.id)) o.deferred = true;
  }
  if (plan.batch) {
    const seen = new Set<string>();
    for (const o of sortForPlan(k, open, plan.id)) {
      if (o.consumed || o.held || o.batched) continue;
      for (const ing of prepActions(cfg, o.items)) {
        if (seen.has(ing)) o.remaining.prep = Math.max(0.2, o.remaining.prep - cfg.setupMinutesPerPrepAction);
        seen.add(ing);
      }
      o.batched = true;
    }
  }
  const p = project(k, { mode: k.planMode });
  k.ack = {
    late: p.metrics.projectedLateOrders,
    short: p.short,
    maxUtil: p.metrics.maxStationUtilization,
  };
  k.phase = "approved";
  k.approvedStrategyId = plan.id;
  k.selectedStrategyId = undefined;
  k.feedPaused = false;
  k.autoFrozen = false;
  pushFeed(k, "approve", `Manager approved: ${plan.label}`);
  return k;
}

export function releaseOrder(k: Kitchen, orderId: string): Kitchen {
  const o = k.orders.find((x) => x.id === orderId);
  if (o) {
    o.held = false;
    pushFeed(k, "system", `#${o.num} released back to the line`, o.id);
  }
  evaluatePhase(k);
  return k;
}

export function cancelOrder(k: Kitchen, orderId: string): Kitchen {
  const o = k.orders.find((x) => x.id === orderId);
  if (o) {
    k.orders = k.orders.filter((x) => x.id !== orderId);
    pushFeed(k, "system", `#${o.num} cancelled with customer`, o.id);
  }
  evaluatePhase(k);
  return k;
}

export function cloneKitchen(k: Kitchen): Kitchen {
  return structuredClone(k);
}

export type { KitchenConfig };
export const DEFAULT_METRICS: Metrics = { ordersAtRisk: 0, projectedLateOrders: 0, repeatedPrepActions: 0, maxStationUtilization: 0 };
