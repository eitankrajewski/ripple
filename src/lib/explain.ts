import type { DigitalTwinState, Explanation, StrategyOption } from "../engine/types";

export interface ExplainPayload {
  glance: string;
  event: string;
  causeChain: string[];
  baseline: DigitalTwinState["baseline"];
  strategy: Pick<StrategyOption, "label" | "summary" | "tradeoff" | "metrics" | "actions"> | null;
  alternatives: { label: string; metrics: StrategyOption["metrics"] }[];
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Walks the critical edges of the deterministic graph from the event outwards. */
export function causeChain(state: DigitalTwinState): string[] {
  const byId = new Map(state.nodes.map((n) => [n.id, n]));
  const chain: string[] = [];
  let cur = byId.get("evt");
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.push(cur.type === "outcome" ? `${cur.label}: ${cur.detail}` : `${cur.label} (${cur.detail})`);
    const next = state.edges
      .filter((e) => e.source === cur!.id && e.active)
      .map((e) => byId.get(e.target)!)
      .filter(Boolean)
      .sort((a, b) => rank(b.risk) - rank(a.risk))[0];
    cur = next;
  }
  return chain;
}

const rank = (r: string) => (r === "critical" ? 2 : r === "warning" ? 1 : 0);

export function buildPayload(state: DigitalTwinState, strategyId?: string): ExplainPayload {
  const s = state.strategies.find((x) => x.id === strategyId) ?? null;
  const evt = state.nodes.find((n) => n.id === "evt");
  return {
    glance: state.glance.sentence,
    event: evt ? `${evt.label} · ${evt.detail}` : "",
    causeChain: causeChain(state),
    baseline: state.baseline,
    strategy: s && { label: s.label, summary: s.summary, tradeoff: s.tradeoff, metrics: s.metrics, actions: s.actions },
    alternatives: state.strategies.filter((x) => x.id !== strategyId).map((x) => ({ label: x.label, metrics: x.metrics })),
  };
}

export function fallbackExplanation(p: ExplainPayload): Explanation {
  const chain = p.causeChain.map((c) => c.replace(/ \(.*\)$/, "")).join(" → ");
  if (!p.strategy) {
    return {
      headline: p.glance,
      causeChain: chain || "No disruption is propagating right now.",
      recommendationReason: "Pick a strategy to compare its projected outcome against doing nothing.",
      tradeoff: "Every strategy trades pickup times, station load and waste differently.",
      source: "fallback",
    };
  }
  const m = p.strategy.metrics;
  const b = p.baseline;
  return {
    headline: `${p.strategy.label}: ${m.projectedLateOrders} projected late vs ${b.projectedLateOrders} with no change.`,
    causeChain: chain,
    recommendationReason: `${p.strategy.summary} Orders at risk go from ${b.ordersAtRisk} to ${m.ordersAtRisk}, and the busiest station moves from ${pct(b.maxStationUtilization)} to ${pct(m.maxStationUtilization)}.`,
    tradeoff: p.strategy.tradeoff,
    source: "fallback",
  };
}

export async function requestExplanation(p: ExplainPayload, signal?: AbortSignal): Promise<Explanation> {
  try {
    const res = await fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
      signal,
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as Partial<Explanation>;
    if (!data.headline || !data.causeChain || !data.recommendationReason || !data.tradeoff) throw new Error("bad shape");
    return { headline: data.headline, causeChain: data.causeChain, recommendationReason: data.recommendationReason, tradeoff: data.tradeoff, source: "gemini" };
  } catch {
    return fallbackExplanation(p);
  }
}
