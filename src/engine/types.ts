export type RiskLevel = "normal" | "warning" | "critical";
export type StrategyId = "protect_pickups" | "reduce_overload" | "minimize_waste";
export type StationId = "prep" | "cook" | "pack";
export type OrderSource = "doordash" | "walk_in" | "phone";
export type Phase = "initial" | "disrupted" | "approved";

export interface OrderItem {
  menuItemId: string;
  qty: number;
}

export interface OrderEvent {
  type: "order_received" | "rush_order" | "stock_correction" | "task_done";
  orderId?: string;
  source?: OrderSource;
  items?: OrderItem[];
  pickupDeadlineMinutes?: number;
  ingredientId?: string;
  newStock?: number;
  customer?: string;
}

export interface RippleNode {
  id: string;
  type: "event" | "ingredient" | "task" | "station" | "order" | "outcome";
  label: string;
  risk: RiskLevel;
  detail: string;
  column: number;
  row: number;
  meta?: string;
}

export interface RippleEdge {
  id: string;
  source: string;
  target: string;
  relation: "increases" | "consumes" | "requires" | "loads" | "delays" | "blocks";
  active: boolean;
}

export interface Metrics {
  ordersAtRisk: number;
  repeatedPrepActions: number;
  maxStationUtilization: number;
  projectedLateOrders: number;
}

export interface StrategyOption {
  id: StrategyId;
  label: string;
  summary: string;
  rules: string[];
  actions: string[];
  tradeoff: string;
  metrics: Metrics;
  changedNodeIds: string[];
  valid: boolean;
  heldOrderIds: string[];
  deferredOrderIds: string[];
  preview: { nodes: RippleNode[]; edges: RippleEdge[] };
}

export interface Explanation {
  headline: string;
  causeChain: string;
  recommendationReason: string;
  tradeoff: string;
  source: "gemini" | "fallback";
}

export type OrderStatus = "queued" | "prepping" | "cooking" | "packing" | "ready" | "held" | "deferred" | "blocked";

export interface OrderView {
  id: string;
  label: string;
  customer: string;
  source: OrderSource;
  items: OrderItem[];
  itemsText: string;
  isRush: boolean;
  status: OrderStatus;
  risk: RiskLevel;
  reason: string;
  createdAtMinutes: number;
  pickupInMinutes: number;
  projectedReadyInMinutes: number | null;
  blockedBy?: string;
  lateBecause?: StationId;
}

export interface StationView {
  id: StationId;
  name: string;
  staff: number;
  capacityMinutes: number;
  queuedMinutes: number;
  utilization: number;
  risk: RiskLevel;
}

export interface InventoryView {
  id: string;
  name: string;
  unit: string;
  onHand: number;
  need: number;
  short: boolean;
  risk: RiskLevel;
  freshnessMinutes: number;
  allergens: string[];
}

export interface FeedEntry {
  id: string;
  atSeconds: number;
  kind: "order" | "rush" | "stock" | "ready" | "system" | "approve";
  text: string;
  orderId?: string;
}

export interface DigitalTwinState {
  scenarioId: string;
  phase: Phase;
  clockSeconds: number;
  feedPaused: boolean;
  autoFrozen: boolean;
  nodes: RippleNode[];
  edges: RippleEdge[];
  orders: OrderView[];
  stations: StationView[];
  inventory: InventoryView[];
  strategies: StrategyOption[];
  baseline: Metrics;
  selectedStrategyId?: StrategyId;
  approvedStrategyId?: StrategyId;
  explanation?: Explanation;
  glance: { level: RiskLevel; sentence: string };
  feed: FeedEntry[];
  nextRushInSeconds: number | null;
  serviceClock: string;
}
