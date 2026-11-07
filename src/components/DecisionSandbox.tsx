import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, Clock, FlaskConical, Hourglass, Leaf, ShieldCheck, Sparkles, Waves } from "lucide-react";
import type { Metrics, StrategyId, StrategyOption } from "../engine/types";
import { RISK_HEX, pct, riskFromUtil } from "../lib/ui";
import { useTwin } from "../store";
import { ExplanationBody } from "./ExplanationCard";
import { Panel, SimBadge } from "./Panel";

const STRATEGY_STYLE: Record<StrategyId, { icon: typeof Clock; color: string; tag: string }> = {
  protect_pickups: { icon: Clock, color: "#38bdf8", tag: "Customer first" },
  reduce_overload: { icon: Waves, color: "#a78bfa", tag: "Staff first" },
  minimize_waste: { icon: Leaf, color: "#4ade80", tag: "Stock first" },
};

const METRICS: { key: keyof Metrics; label: string; fmt: (n: number) => string }[] = [
  { key: "projectedLateOrders", label: "Late", fmt: String },
  { key: "ordersAtRisk", label: "At risk", fmt: String },
  { key: "maxStationUtilization", label: "Peak load", fmt: pct },
  { key: "repeatedPrepActions", label: "Re-preps", fmt: String },
];

function Delta({ base, value, fmt }: { base: number; value: number; fmt: (n: number) => string }) {
  const diff = value - base;
  if (Math.abs(diff) < 0.005) return <span className="text-slate-500">±0</span>;
  const better = diff < 0;
  const Icon = better ? ArrowDownRight : ArrowUpRight;
  return (
    <span className={clsx("inline-flex items-center gap-0.5", better ? "text-ok" : "text-crit")}>
      <Icon className="size-3" />
      {fmt(Math.abs(diff))}
    </span>
  );
}

function StrategyCard({ s, base, selected, best, onSelect }: { s: StrategyOption; base: Metrics; selected: boolean; best: boolean; onSelect: () => void }) {
  const st = STRATEGY_STYLE[s.id];
  const Icon = st.icon;
  return (
    <motion.div
      layout
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={clsx("relative shrink-0 cursor-pointer overflow-hidden rounded-xl border p-3 transition", selected ? "bg-white/[0.06]" : "border-white/7 bg-white/[0.02] hover:bg-white/[0.04]")}
      style={{ borderColor: selected ? `${st.color}99` : undefined, boxShadow: selected ? `0 0 30px -12px ${st.color}` : undefined }}
    >
      {selected && <motion.span layoutId="sel-glow" className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(120% 80% at 0% 0%, ${st.color}1e, transparent 60%)` }} />}
      <div className="relative flex items-start gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ background: `${st.color}1f`, color: st.color }}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold text-slate-100">{s.label}</div>
          <div className="flex items-center gap-1.5 text-[10px] tracking-wide text-slate-500 uppercase">
            {st.tag}
            {best && <span className="rounded-full bg-ok/15 px-1.5 py-px text-[9px] font-semibold tracking-wide text-ok">Best projection</span>}
          </div>
        </div>
        <span className={clsx("grid size-5 place-items-center rounded-full border transition", selected ? "border-transparent" : "border-white/20")} style={{ background: selected ? st.color : undefined }}>
          {selected && <Check className="size-3 text-ink-950" strokeWidth={3} />}
        </span>
      </div>
      <p className="relative mt-2 text-[11.5px] leading-snug text-slate-400">{s.summary}</p>
      <div className="relative mt-2.5 grid grid-cols-4 gap-1.5">
        {METRICS.map((m) => {
          const v = s.metrics[m.key];
          const warn = m.key === "maxStationUtilization" ? riskFromUtil(v) : m.key === "repeatedPrepActions" ? "normal" : v > 0 ? (m.key === "projectedLateOrders" ? "critical" : "warning") : "normal";
          return (
            <div key={m.key} className="rounded-lg bg-ink-950/60 px-1.5 py-1.5 text-center">
              <div className="font-display text-[15px] font-bold tabular-nums" style={{ color: RISK_HEX[warn] }}>
                {m.fmt(v)}
              </div>
              <div className="text-[9.5px] text-slate-500">{m.label}</div>
              <div className="font-mono text-[9.5px]">
                <Delta base={base[m.key]} value={v} fmt={m.fmt} />
              </div>
            </div>
          );
        })}
      </div>
      <AnimatePresence initial={false}>
        {selected && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="relative overflow-hidden">
            <div className="mt-3 space-y-1">
              {s.actions.map((a) => (
                <div key={a} className="flex items-start gap-1.5 text-[11.5px] text-slate-300">
                  <ArrowRight className="mt-0.5 size-3 shrink-0" style={{ color: st.color }} />
                  {a}
                </div>
              ))}
            </div>
            <div className="mt-2 rounded-lg border border-warn/20 bg-warn/[0.06] px-2.5 py-1.5 text-[11px] text-amber-100/90">
              <span className="font-semibold text-warn">Trade-off · </span>
              {s.tradeoff}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CompareBars({ strategies, base }: { strategies: StrategyOption[]; base: Metrics }) {
  const rows = [{ label: "No change", color: "#64748b", m: base }, ...strategies.map((s) => ({ label: s.label, color: STRATEGY_STYLE[s.id].color, m: s.metrics }))];
  const maxLate = Math.max(1, ...rows.map((r) => r.m.projectedLateOrders));
  const maxUtil = Math.max(1.2, ...rows.map((r) => r.m.maxStationUtilization));
  return (
    <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-x-3 gap-y-1.5 text-[10.5px]">
      <span />
      <span className="text-slate-500">Projected late</span>
      <span className="text-slate-500">Peak station load</span>
      {rows.map((r) => (
        <div key={r.label} className="contents">
          <span className="truncate text-slate-400">{r.label}</span>
          <div className="flex items-center gap-1.5">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
              <motion.div className="h-full rounded-full" style={{ background: r.color }} initial={{ width: 0 }} animate={{ width: `${(r.m.projectedLateOrders / maxLate) * 100}%` }} />
            </div>
            <span className="w-4 text-right font-mono text-slate-300">{r.m.projectedLateOrders}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/5">
              <motion.div className="h-full rounded-full" style={{ background: r.color }} initial={{ width: 0 }} animate={{ width: `${(r.m.maxStationUtilization / maxUtil) * 100}%` }} />
              <span className="absolute inset-y-0 w-px bg-crit" style={{ left: `${(1 / maxUtil) * 100}%` }} />
            </div>
            <span className="w-8 text-right font-mono text-slate-300">{pct(r.m.maxStationUtilization)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Idle() {
  const { phase, nextRushInSeconds, approvedStrategyId, glance } = useTwin((s) => s.state);
  const approved = approvedStrategyId ? STRATEGY_STYLE[approvedStrategyId] : null;
  const ApprovedIcon = approved?.icon ?? ShieldCheck;
  return (
    <div className="flex flex-col items-center px-6 pt-4 pb-5 text-center">
      <div className="relative grid size-24 place-items-center">
        <span className="ripple-ring absolute inset-0 rounded-full border border-accent/40" />
        <span className="ripple-ring absolute inset-0 rounded-full border border-ok/30" style={{ animationDelay: "0.8s" }} />
        <span className="ripple-ring absolute inset-0 rounded-full border border-accent/20" style={{ animationDelay: "1.6s" }} />
        <span className="grid size-14 place-items-center rounded-full border border-white/10 bg-ink-800" style={{ color: approved?.color ?? "#818cf8" }}>
          {phase === "approved" ? <ApprovedIcon className="size-6" /> : <Hourglass className="size-6" />}
        </span>
      </div>
      {phase === "approved" && approvedStrategyId ? (
        <>
          <div className="mt-4 font-display text-base font-semibold text-slate-100">Plan running</div>
          <p className="mt-1 max-w-xs text-xs text-slate-400">{glance.sentence} The twin keeps watching and will freeze again if the picture gets meaningfully worse.</p>
        </>
      ) : (
        <>
          <div className="mt-4 font-display text-base font-semibold text-slate-100">Calm before the rush</div>
          <p className="mt-1 max-w-xs text-xs text-slate-400">
            When the twin detects a ripple it freezes the feed and lays out response strategies here, side by side.
            {nextRushInSeconds !== null && <> A large order is scripted to land in <b className="text-slate-200">{nextRushInSeconds}s</b>.</>}
          </p>
        </>
      )}
    </div>
  );
}

export function DecisionSandbox() {
  const state = useTwin((s) => s.state);
  const previewId = useTwin((s) => s.previewStrategyId);
  const { choose, approve } = useTwin.getState();
  const disrupted = state.phase === "disrupted" && state.strategies.length > 0;
  const score = (m: Metrics) => m.projectedLateOrders * 1000 + m.ordersAtRisk * 100 + m.maxStationUtilization * 10 + m.repeatedPrepActions / 100;
  const bestId = [...state.strategies].sort((a, b) => score(a.metrics) - score(b.metrics))[0]?.id;
  const selected = state.strategies.find((s) => s.id === previewId);

  return (
    <Panel title="Decision sandbox" icon={<FlaskConical className="size-3.5" />} right={<SimBadge />} className="min-h-0 flex-1">
      {disrupted ? (
        <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 pb-3">
          <div className="shrink-0 rounded-xl border border-crit/25 bg-crit/[0.06] px-3 py-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold tracking-wide text-rose-200 uppercase">If nothing changes</span>
              <span className="text-slate-500">baseline</span>
            </div>
            <div className="mt-1 flex gap-4 font-mono text-[12px] text-slate-300">
              <span>
                <b className="text-crit">{state.baseline.projectedLateOrders}</b> late
              </span>
              <span>
                <b className="text-warn">{state.baseline.ordersAtRisk}</b> at risk
              </span>
              <span>
                peak <b style={{ color: RISK_HEX[riskFromUtil(state.baseline.maxStationUtilization)] }}>{pct(state.baseline.maxStationUtilization)}</b>
              </span>
            </div>
          </div>
          {state.strategies.map((s) => (
            <StrategyCard key={s.id} s={s} base={state.baseline} selected={previewId === s.id} best={s.id === bestId} onSelect={() => choose(previewId === s.id ? null : s.id)} />
          ))}
          <div className="shrink-0 rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <CompareBars strategies={state.strategies} base={state.baseline} />
          </div>
          <div className="shrink-0 rounded-xl border border-white/5 bg-white/[0.02]">
            <ExplanationBody />
          </div>
        </div>
      ) : (
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
          <Idle />
          <div className="mx-3 mb-3 rounded-xl border border-white/5 bg-white/[0.02]">
            <ExplanationBody />
          </div>
        </div>
      )}
      {disrupted && (
        <div className="border-t border-white/5 p-3">
          <motion.button
            whileTap={{ scale: 0.98 }}
            disabled={!selected}
            onClick={approve}
            className={clsx(
              "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition",
              selected ? "bg-gradient-to-r from-ok to-accent text-ink-950 shadow-[0_10px_40px_-10px_#5eead4] hover:brightness-110" : "cursor-not-allowed bg-white/5 text-slate-500",
            )}
          >
            {selected ? <Sparkles className="size-4" /> : <ShieldCheck className="size-4" />}
            {selected ? `Approve “${selected.label}”` : "Select a strategy to preview it"}
          </motion.button>
        </div>
      )}
    </Panel>
  );
}
