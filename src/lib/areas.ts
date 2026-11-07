import type { InventoryView, OrderView, RiskLevel, RippleNode, StationId } from "../engine/types";
import { useTwin, type AreaId } from "../store";

export type { AreaId };

export interface Area {
  id: AreaId;
  name: string;
  role: string;
  risk: RiskLevel;
  summary: string;
  load?: number;
  loadBefore?: number;
  staff?: number;
  queuedMinutes?: number;
  capacityMinutes?: number;
  orders: OrderView[];
  changed: boolean;
  shortages: InventoryView[];
}

export const AREA_ORDER: AreaId[] = ["orders", "pantry", "prep", "cook", "pack", "pickup"];

const RANK: Record<RiskLevel, number> = { normal: 0, warning: 1, critical: 2 };
const worst = (a: RiskLevel, b: RiskLevel) => (RANK[a] >= RANK[b] ? a : b);

export const AREA_OF: Record<OrderView["status"], AreaId> = {
  queued: "orders",
  held: "orders",
  deferred: "orders",
  blocked: "pantry",
  prepping: "prep",
  cooking: "cook",
  packing: "pack",
  ready: "pickup",
};

export function culpritArea(o: OrderView): AreaId | null {
  return o.blockedBy ? "pantry" : (o.lateBecause ?? null);
}

export function useAreas(): { areas: Area[]; previewing: boolean } {
  const state = useTwin((s) => s.state);
  const previewId = useTwin((s) => s.previewStrategyId);
  const preview = state.strategies.find((s) => s.id === previewId);
  const nodes: RippleNode[] = preview ? preview.preview.nodes : state.nodes;
  const node = (id: string) => nodes.find((n) => n.id === id);
  const changed = new Set(preview?.changedNodeIds ?? []);
  const byArea = (id: AreaId) => state.orders.filter((o) => AREA_OF[o.status] === id);
  const evt = state.nodes.find((n) => n.id === "evt");
  const short = state.inventory.filter((i) => i.short);
  const pantryRisk = preview
    ? nodes.filter((n) => n.type === "ingredient").reduce<RiskLevel>((a, n) => worst(a, n.risk), "normal")
    : state.inventory.reduce<RiskLevel>((a, i) => worst(a, i.risk), "normal");
  const queue = byArea("orders");
  const held = queue.filter((o) => o.status === "held" || o.status === "deferred").length;
  const outcome = node("outcome");

  const station = (id: StationId, role: string): Area => {
    const sv = state.stations.find((s) => s.id === id)!;
    const n = node(`st-${id}`);
    const load = n?.meta ? Number(n.meta) / 100 : sv.utilization;
    return {
      id,
      name: sv.name,
      role,
      risk: n?.risk ?? sv.risk,
      summary: `${Math.round(load * 100)}% load · ${sv.staff} staff`,
      load,
      loadBefore: preview ? sv.utilization : undefined,
      staff: sv.staff,
      queuedMinutes: sv.queuedMinutes,
      capacityMinutes: sv.capacityMinutes,
      orders: byArea(id),
      changed: changed.has(`st-${id}`),
      shortages: [],
    };
  };

  const areas: Area[] = [
    {
      id: "orders",
      name: "Orders in",
      role: "Simulated order feed",
      risk: evt?.risk ?? "normal",
      summary: `${queue.length} waiting${held ? ` · ${held} held` : ""}`,
      orders: queue,
      changed: false,
      shortages: [],
    },
    {
      id: "pantry",
      name: "Pantry",
      role: "Ingredients & walk-in fridge",
      risk: pantryRisk,
      summary: short.length ? `${short.map((s) => s.name).join(", ")} short` : `${state.inventory.length} ingredients stocked`,
      orders: byArea("pantry"),
      changed: [...changed].some((c) => c.startsWith("ing-")),
      shortages: short,
    },
    station("prep", "Chop, bread & assemble"),
    station("cook", "Grill & fry"),
    station("pack", "Bag & check"),
    {
      id: "pickup",
      name: "Pickup",
      role: "Hand-off to guests & drivers",
      risk: outcome?.risk ?? "normal",
      summary: outcome?.detail ?? "Promises on track",
      orders: byArea("pickup"),
      changed: changed.has("outcome"),
      shortages: [],
    },
  ];
  return { areas, previewing: !!preview };
}
