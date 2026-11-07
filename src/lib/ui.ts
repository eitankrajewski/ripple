import type { RiskLevel } from "../engine/types";

export const RISK_HEX: Record<RiskLevel, string> = {
  normal: "#2dd4bf",
  warning: "#fbbf24",
  critical: "#fb7185",
};

export const RISK_TEXT: Record<RiskLevel, string> = {
  normal: "text-ok",
  warning: "text-warn",
  critical: "text-crit",
};

export const RISK_LABEL: Record<RiskLevel, string> = {
  normal: "On track",
  warning: "At risk",
  critical: "Critical",
};

export const pct = (n: number) => `${Math.round(n * 100)}%`;

export const minutes = (n: number) => {
  const r = Math.round(n * 10) / 10;
  return `${Math.abs(r) >= 10 ? Math.round(r) : r}m`;
};

export const riskFromUtil = (u: number): RiskLevel => (u > 1 ? "critical" : u >= 0.85 ? "warning" : "normal");
