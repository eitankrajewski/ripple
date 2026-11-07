import type { Metrics, OrderSource, RiskLevel } from "../engine/types";

export const RISK_HEX: Record<RiskLevel, string> = {
  normal: "#58cc02",
  warning: "#ffab00",
  critical: "#ff4b4b",
};

export const RISK_SOFT: Record<RiskLevel, string> = {
  normal: "#eaf9dd",
  warning: "#fff3d6",
  critical: "#ffe3e3",
};

export const RISK_LABEL: Record<RiskLevel, string> = {
  normal: "On track",
  warning: "At risk",
  critical: "Critical",
};

export const SOURCE: Record<OrderSource, { label: string; color: string }> = {
  doordash: { label: "Delivery app", color: "#ff3008" },
  walk_in: { label: "Walk-in", color: "#1cb0f6" },
  phone: { label: "Phone", color: "#a970ff" },
};

export const pct = (n: number) => `${Math.round(n * 100)}%`;

export const minutes = (n: number) => {
  const r = Math.round(n * 10) / 10;
  return `${Math.abs(r) >= 10 ? Math.round(r) : r}m`;
};

export const riskFromUtil = (u: number): RiskLevel => (u > 1 ? "critical" : u >= 0.85 ? "warning" : "normal");

export const score = (m: Metrics) => m.projectedLateOrders * 1000 + m.ordersAtRisk * 100 + m.maxStationUtilization * 10 + m.repeatedPrepActions / 100;
