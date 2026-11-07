export type RiskLevel = "normal" | "warning" | "critical";
export type StrategyId = "protect_pickups" | "reduce_overload" | "minimize_waste";
export type StationId = "prep" | "cook" | "pack";
export type OrderSource = "doordash" | "walk_in" | "phone";
/** Kinds of station a manager can place in the 3D kitchen. */
export type StationKind = "orders" | "pantry" | "prep" | "cook" | "pack" | "pickup";

export interface PlacedStation {
  id: string;
  kind: StationKind;
  x: number;
  z: number;
}

export interface NewMenuItem {
  id: string;
  name: string;
  ingredients: Record<string, number>;
  minutes: Record<StationId, number>;
}
export interface NewIngredient {
  id: string;
  name: string;
  unit: string;
  stock: number;
  /** Menu items that use one of this ingredient each. */
  usedIn?: string[];
}
export type Phase = "initial" | "disrupted" | "approved";

export interface OrderItem {
  menuItemId: string;
  qty: number;
}

export interface OrderEvent {
  type:
    | "order_received" | "rush_order" | "stock_correction" | "task_done" | "picked_up" | "move_order" | "pack_item" | "dasher_update" | "handoff_mismatch"
    | "item_done" | "station_added" | "station_removed" | "menu_item_added" | "ingredient_added";
  /** Layout changes (station_added / station_removed). */
  placed?: PlacedStation;
  placedId?: string;
  /** For menu_item_added. */
  menuItem?: NewMenuItem;
  /** For ingredient_added. */
  ingredient?: NewIngredient;
  orderId?: string;
  source?: OrderSource;
  items?: OrderItem[];
  pickupDeadlineMinutes?: number;
  ingredientId?: string;
  newStock?: number;
  customer?: string;
  /** For task_done: only complete this station if it is the order's current one. */
  station?: StationId;
  /** Who reported the event (live mode). */
  by?: string;
  /** For move_order: where the order should go. */
  to?: StationId | "ready";
  /** For pack_item. */
  menuItemId?: string;
  checked?: boolean;
  /** Delivery details (DoorDash): courier name, arrival in minutes, and the external order id. */
  dasherName?: string;
  dasherEtaMinutes?: number;
  externalId?: string;
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
  /** Minutes until this ticket should be started so it's ready right as pickup arrives. 0 = start now, null = already started. */
  fireInMinutes: number | null;
  /** Short code the courier or customer reads out at handoff. */
  code: string;
  dasher?: { name: string; etaMinutes: number };
  /** Menu item ids already checked into the bag at Pack. */
  packed: string[];
  /** Where each component is; in live mode parts of an order can be at different stations. */
  itemStage: Record<string, StationId | "done">;
  externalId?: string;
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
  layout: PlacedStation[];
  menu: NewMenuItem[];
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
