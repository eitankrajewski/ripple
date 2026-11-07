import clsx from "clsx";
import { motion } from "framer-motion";
import { ArrowUp, Minus, Plus, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";
import { SCENARIO_KINDS, type ScenarioSpec } from "../engine/scenario";
import { pct, RISK_HEX } from "../lib/ui";
import { useTwin } from "../store";
import { SimBadge } from "./Panel";
import { Stat, Wording } from "./PlanTab";

const EXAMPLES = ["20 customers walk in at once", "A cook calls out sick", "We run out of tomatoes", "Catering order: 30 chicken wraps", "15 DoorDash orders land together"];

function SpecEditor({ spec }: { spec: ScenarioSpec }) {
  const edit = useTwin((s) => s.editScenario);
  const unit = SCENARIO_KINDS.find((k) => k.kind === spec.kind)?.unit;
  const max = spec.kind === "staff_out" ? 3 : 80;
  const min = spec.kind === "stockout" ? 0 : 1;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[18px] bg-white/60 px-3 py-2 text-[12.5px] font-bold text-mute">
      Understood as
      <select value={spec.kind} onChange={(e) => edit({ ...spec, kind: e.target.value as ScenarioSpec["kind"], station: spec.station ?? "cook", ingredientId: spec.ingredientId ?? "chicken" })} className="rounded-full bg-white px-2 py-1 font-extrabold text-ink outline-none">
        {SCENARIO_KINDS.map((k) => (
          <option key={k.kind} value={k.kind}>
            {k.label}
          </option>
        ))}
      </select>
      <span className="flex items-center gap-1 rounded-full bg-white px-1 py-0.5">
        <button className="rounded-full p-1 hover:bg-black/5" onClick={() => edit({ ...spec, count: Math.max(min, spec.count - (spec.count > 10 ? 5 : 1)) })} aria-label="Less">
          <Minus className="size-3" />
        </button>
        <span className="min-w-6 text-center font-black text-ink tabular-nums">{spec.count}</span>
        <button className="rounded-full p-1 hover:bg-black/5" onClick={() => edit({ ...spec, count: Math.min(max, spec.count + (spec.count >= 10 ? 5 : 1)) })} aria-label="More">
          <Plus className="size-3" />
        </button>
      </span>
      {unit}
    </div>
  );
}

function Result() {
  const sc = useTwin((s) => s.scenario);
  const { rephraseScenario, applyWhatIf, clearScenario } = useTwin.getState();
  const r = sc.result!;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <SpecEditor spec={sc.spec!} />
      <div className="rounded-[22px] bg-white/60 p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[14px] font-black text-ink">{r.title}</span>
          <SimBadge />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Late" value={r.after.projectedLateOrders} before={r.before.projectedLateOrders} tone={r.after.projectedLateOrders ? RISK_HEX.critical : undefined} />
          <Stat label="At risk" value={r.after.ordersAtRisk} before={r.before.ordersAtRisk} />
          <Stat label="Peak load" value={r.after.maxStationUtilization} before={r.before.maxStationUtilization} format={pct} tone={r.after.maxStationUtilization > 1 ? RISK_HEX.critical : undefined} />
        </div>
        <div className="mt-3 space-y-1.5">
          {r.stations.map((s) => {
            const c = s.after > 1 ? RISK_HEX.critical : s.after >= 0.85 ? RISK_HEX.warning : RISK_HEX.normal;
            return (
              <div key={s.id} className="flex items-center gap-2 text-[12px] font-bold">
                <span className="w-10 text-mute">{s.name}</span>
                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-black/10" style={{ width: `${Math.min(100, s.before * 100)}%` }} />
                  <motion.div className="absolute inset-y-0 left-0 rounded-full" style={{ background: c }} initial={{ width: `${Math.min(100, s.before * 100)}%` }} animate={{ width: `${Math.min(100, s.after * 100)}%` }} transition={{ duration: 0.8 }} />
                </div>
                <span className="w-11 text-right font-black tabular-nums" style={{ color: c }}>
                  {pct(s.after)}
                </span>
              </div>
            );
          })}
          {r.shortages.map((s) => (
            <div key={s.id} className="text-[12px] font-extrabold text-crit">
              {s.name}: {s.onHand} on hand, {s.need} needed
            </div>
          ))}
        </div>
      </div>

      <p className="px-1 text-[13px] font-extrabold text-mute">Ways to respond</p>
      {r.options.map((o) => {
        const best = o.id === r.bestId;
        return (
          <div key={o.id} className={clsx("frost rounded-[20px] p-3", best && "ring-3 ring-ok/70")}>
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] font-black text-ink">{o.label}</span>
              {best && <span className="rounded-full bg-ok px-2 py-0.5 text-[10px] font-black text-white uppercase">Recommended</span>}
              {o.kind === "lever" && <span className="rounded-full bg-sky/10 px-2 py-0.5 text-[10px] font-black text-sky uppercase">Staffing / stock</span>}
            </div>
            <p className="mt-0.5 text-[12px] leading-snug font-semibold text-mute">{o.description}</p>
            <div className="mt-2 flex gap-3 text-[12px] font-extrabold">
              <span style={{ color: o.metrics.projectedLateOrders ? RISK_HEX.critical : RISK_HEX.normal }}>{o.metrics.projectedLateOrders} late</span>
              <span className="text-mute">{o.metrics.ordersAtRisk} at risk</span>
              <span className="text-mute">peak {pct(o.metrics.maxStationUtilization)}</span>
            </div>
            {best && <p className="mt-1.5 text-[12px] font-semibold text-ink/70">Trade-off: {o.tradeoff}</p>}
          </div>
        );
      })}

      {sc.wording && <Wording e={sc.wording} loading={sc.wordingLoading} onRephrase={rephraseScenario} />}

      <p className="px-1 text-[11.5px] font-semibold text-mute">Assumes: {r.assumptions.join(" · ")}.</p>
      <div className="flex gap-2">
        <button onClick={applyWhatIf} className="btn3d h-11 flex-1 text-[14px]">
          Play it on the live twin
        </button>
        <button onClick={clearScenario} className="flex h-11 items-center gap-1.5 rounded-[16px] bg-white px-4 text-[13px] font-extrabold text-mute" aria-label="New question">
          <RotateCcw className="size-4" />
        </button>
      </div>
    </motion.div>
  );
}

export function AskTab() {
  const sc = useTwin((s) => s.scenario);
  const ask = useTwin((s) => s.ask);
  const [q, setQ] = useState(sc.query);
  const submit = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setQ(t);
    ask(t);
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="flex items-center gap-2 text-[18px] font-black text-ink">
          <Sparkles className="size-5 text-grape" /> Ask the kitchen
        </h3>
        <p className="mt-0.5 text-[13px] font-semibold text-mute">Describe a what-if. The twin plays it out on a copy of tonight’s kitchen. Nothing changes for real.</p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(q);
        }}
        className="frost flex items-end gap-2 rounded-[22px] p-2 pl-4"
      >
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(q);
            }
          }}
          rows={2}
          placeholder="What should we do if 20 customers suddenly walk in?"
          className="min-h-[44px] flex-1 resize-none bg-transparent py-2 text-[14px] font-bold text-ink outline-none placeholder:text-mute/70"
        />
        <button type="submit" disabled={!q.trim()} className="btn3d size-10 shrink-0 rounded-full" style={{ ["--c" as string]: "#a970ff", ["--d" as string]: "#8a4fe0" }} aria-label="Ask">
          <ArrowUp className="size-5" strokeWidth={3} />
        </button>
      </form>
      {!sc.result && (
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((e) => (
            <button key={e} onClick={() => submit(e)} className="rounded-full bg-white/70 px-3 py-1.5 text-[12.5px] font-bold text-ink hover:bg-white">
              {e}
            </button>
          ))}
        </div>
      )}
      {sc.notUnderstood && (
        <p className="rounded-2xl bg-warn/10 px-3 py-2 text-[13px] font-semibold text-ink/80">
          I can model walk-ins, delivery surges, catering orders, staff call-outs, running out of an ingredient and supplier deliveries. Try one of the examples.
        </p>
      )}
      {sc.result && <Result />}
    </div>
  );
}
