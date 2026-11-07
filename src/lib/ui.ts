import type { Metrics, OrderSource, OrderView, RiskLevel } from "../engine/types";

export const RISK_HEX: Record<RiskLevel, string> = {
  normal: "#34c759",
  warning: "#ff9f0a",
  critical: "#ff3b30",
};

export const RISK_LABEL: Record<RiskLevel, string> = {
  normal: "On track",
  warning: "At risk",
  critical: "Critical",
};

export const SOURCE: Record<OrderSource, { label: string }> = {
  doordash: { label: "Delivery app" },
  walk_in: { label: "Walk-in" },
  phone: { label: "Phone" },
};

export const pct = (n: number) => `${Math.round(n * 100)}%`;

export const minutes = (n: number) => {
  const r = Math.round(n * 10) / 10;
  return `${Math.abs(r) >= 10 ? Math.round(r) : r}m`;
};

export const riskFromUtil = (u: number): RiskLevel => (u > 1 ? "critical" : u >= 0.85 ? "warning" : "normal");

export const score = (m: Metrics) => m.projectedLateOrders * 1000 + m.ordersAtRisk * 100 + m.maxStationUtilization * 10 + m.repeatedPrepActions / 100;

const STATUS: Record<OrderView["status"], string> = {
  queued: "Waiting",
  prepping: "In prep",
  cooking: "Cooking",
  packing: "Packing",
  ready: "Ready",
  held: "Held",
  deferred: "Deferred",
  blocked: "Blocked",
};
export const statusLabel = (o: OrderView) => STATUS[o.status];
