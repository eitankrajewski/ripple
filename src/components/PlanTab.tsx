import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Clock3, Coffee, Leaf, Loader2, ShieldCheck, Sparkles, Waves } from "lucide-react";
import type { Explanation, StrategyId } from "../engine/types";
import { pct, RISK_HEX, score } from "../lib/ui";
import { useTwin } from "../store";
import { SimBadge } from "./Panel";

const ICON: Record<StrategyId, typeof Clock3> = { protect_pickups: Clock3, reduce_overload: Waves, minimize_waste: Leaf };
const TINT: Record<StrategyId, string> = { protect_pickups: "#1cb0f6", reduce_overload: "#a970ff", minimize_waste: "#58cc02" };

export function Stat({ label, value, before, lowerBetter = true, format = String, tone }: { label: string; value: number; before?: number; lowerBetter?: boolean; format?: (n: number) => string; tone?: string }) {
  const d = before === undefined ? 0 : value - before;
  const better = lowerBetter ? d < 0 : d > 0;
  return (
    <div className="rounded-2xl bg-white/70 px-2 py-2 text-center">
      <div className="text-[18px] leading-none font-black tabular-nums" style={{ color: tone }}>
        {format(value)}
      </div>
      <div className="mt-1 text-[11px] font-bold text-mute">{label}</div>
      {before !== undefined && d !== 0 && Math.abs(d) > 0.004 && <div className={clsx("text-[10.5px] font-black", better ? "text-ok-dark" : "text-crit")}>{better ? "▼" : "▲"} {format(Math.abs(d))}</div>}
    </div>
  );
}

export function Wording({ e, loading, onRephrase }: { e: Explanation; loading: boolean; onRephrase: () => void }) {
  return (
    <div className="rounded-[22px] bg-white/60 p-4">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[12px] font-black tracking-[0.12em] text-mute uppercase">Why</span>
        <span className="text-[11px] font-bold text-mute">{e.source === "gemini" ? "Worded by Gemini" : "Deterministic"}</span>
      </div>
      <p className="text-[15px] leading-snug font-extrabold text-ink">{e.headline}</p>
      <p className="mt-1.5 text-[13px] leading-snug font-semibold text-mute">{e.causeChain}</p>
      <p className="mt-1.5 text-[13px] leading-snug font-semibold text-ink/80">{e.recommendationReason}</p>
      <p className="mt-1.5 text-[13px] leading-snug font-semibold text-ink/80">
        <span className="font-extrabold text-warn">Trade-off:</span> {e.tradeoff}
      </p>
      <button onClick={onRephrase} disabled={loading} className="mt-3 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12.5px] font-extrabold text-grape shadow-sm hover:shadow disabled:opacity-60">
        {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Rephrase with AI
      </button>
    </div>
  );
}

function Calm() {
  const nextRush = useTwin((s) => s.state.nextRushInSeconds);
  const phase = useTwin((s) => s.state.phase);
  const approved = useTwin((s) => s.state.approvedStrategyId);
  const setTab = useTwin((s) => s.setTab);
  return (
    <div className="flex flex-col items-center px-4 py-6 text-center">
      <div className="relative flex size-20 items-center justify-center rounded-full bg-ok/10">
        <span className="ring-pulse absolute inset-0 rounded-full bg-ok/15" />
        {phase === "approved" ? <ShieldCheck className="size-9 text-ok" /> : <Coffee className="size-9 text-ok" />}
      </div>
      <h3 className="mt-4 text-[19px] font-black text-ink">{phase === "approved" ? "Plan is running" : "All calm"}</h3>
      <p className="mt-1 max-w-[290px] text-[13.5px] font-semibold text-mute">
        {phase === "approved"
          ? `${approved?.replace(/_/g, " ")} is in effect. If another ripple hits, new options will appear here.`
          : `When a ripple hits, the twin pauses and lays out your options side by side.${nextRush ? ` A big order is due in ${nextRush}s.` : ""}`}
      </p>
      <button onClick={() => setTab("ask")} className="mt-4 rounded-full bg-white px-4 py-2 text-[13px] font-extrabold text-sky shadow-sm">
        Try a what-if instead →
      </button>
    </div>
  );
}

export function PlanTab() {
  const state = useTwin((s) => s.state);
  const previewId = useTwin((s) => s.previewStrategyId);
  const explanation = useTwin((s) => s.explanation);
  const explaining = useTwin((s) => s.explaining);
  const { choose, approve, explainWithAI } = useTwin.getState();

  if (state.phase !== "disrupted") {
    return (
      <div className="space-y-4">
        <Calm />
        <Wording e={explanation} loading={explaining} onRephrase={explainWithAI} />
      </div>
    );
  }
  const b = state.baseline;
  const bestId = [...state.strategies].sort((x, y) => score(x.metrics) - score(y.metrics))[0]?.id;
  const selected = state.strategies.find((s) => s.id === previewId);

  return (
    <div className="space-y-3">
      <div className="rounded-[22px] bg-crit/[0.07] p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-black text-crit">If nothing changes</span>
          <SimBadge />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Late" value={b.projectedLateOrders} tone={RISK_HEX.critical} />
          <Stat label="At risk" value={b.ordersAtRisk} tone={RISK_HEX.warning} />
          <Stat label="Peak load" value={b.maxStationUtilization} format={pct} tone={b.maxStationUtilization > 1 ? RISK_HEX.critical : undefined} />
        </div>
      </div>

      <p className="px-1 pt-1 text-[13px] font-extrabold text-mute">Pick a response to preview it on the kitchen floor</p>
      {state.strategies.map((s) => {
        const Icon = ICON[s.id];
        const on = previewId === s.id;
        return (
          <motion.button
            layout
            key={s.id}
            onClick={() => choose(on ? null : s.id)}
            className={clsx("frost block w-full rounded-[22px] p-3.5 text-left transition", on ? "ring-3" : "hover:-translate-y-0.5")}
            style={on ? { ["--tw-ring-color" as string]: TINT[s.id] } : undefined}
          >
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: TINT[s.id], boxShadow: `0 3px 0 ${TINT[s.id]}aa` }}>
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[15px] font-black text-ink">{s.label}</span>
                  {s.id === bestId && <span className="rounded-full bg-ok px-2 py-0.5 text-[10px] font-black text-white uppercase">Best</span>}
                </div>
                <p className="mt-0.5 text-[12.5px] leading-snug font-semibold text-mute">{s.summary}</p>
              </div>
              <span className={clsx("flex size-6 shrink-0 items-center justify-center rounded-full border-2", on ? "border-transparent text-white" : "border-black/10")} style={on ? { background: TINT[s.id] } : undefined}>
                {on && <Check className="size-3.5" strokeWidth={3.5} />}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Stat label="Late" value={s.metrics.projectedLateOrders} before={b.projectedLateOrders} />
              <Stat label="At risk" value={s.metrics.ordersAtRisk} before={b.ordersAtRisk} />
              <Stat label="Peak load" value={s.metrics.maxStationUtilization} before={b.maxStationUtilization} format={pct} />
            </div>
            <AnimatePresence>
              {on && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <ul className="mt-3 space-y-1">
                    {s.actions.map((a) => (
                      <li key={a} className="flex gap-2 text-[12.5px] font-bold text-ink">
                        <span style={{ color: TINT[s.id] }}>●</span>
                        {a}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 rounded-2xl bg-warn/10 px-3 py-2 text-[12.5px] font-semibold text-ink/80">
                    <span className="font-extrabold text-warn">Trade-off:</span> {s.tradeoff}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        );
      })}

      <div className="sticky bottom-0 -mx-1 bg-gradient-to-t from-white/80 to-transparent px-1 pt-3 pb-1">
        <button onClick={approve} disabled={!selected} className="btn3d h-12 w-full text-[15px]" style={{ ["--c" as string]: "#58cc02", ["--d" as string]: "#46a302" }}>
          <ShieldCheck className="size-5" />
          {selected ? `Approve ${selected.label}` : "Select a response"}
        </button>
      </div>
      {selected && <Wording e={explanation} loading={explaining} onRephrase={explainWithAI} />}
    </div>
  );
}
