import clsx from "clsx";
import { ArrowUp, Minus, Plus, RotateCcw } from "lucide-react";
import { useState } from "react";
import { SCENARIO_KINDS, type ScenarioSpec } from "../engine/scenario";
import { pct, RISK_HEX } from "../lib/ui";
import { useTwin } from "../store";
import { LoadBar, Section, SimBadge, Stat, Wording } from "./kit";

const EXAMPLES = ["20 customers walk in at once", "A cook calls out sick", "We run out of tomatoes", "Catering order: 30 chicken wraps", "15 DoorDash orders land together"];

function SpecEditor({ spec }: { spec: ScenarioSpec }) {
  const edit = useTwin((s) => s.editScenario);
  const unit = SCENARIO_KINDS.find((k) => k.kind === spec.kind)?.unit;
  const max = spec.kind === "staff_out" ? 3 : 80;
  const min = spec.kind === "stockout" ? 0 : 1;
  return (
    <div className="card flex flex-wrap items-center gap-1.5 px-2.5 py-2 text-mute">
      Read as
      <select
        value={spec.kind}
        onChange={(e) => edit({ ...spec, kind: e.target.value as ScenarioSpec["kind"], station: spec.station ?? "cook", ingredientId: spec.ingredientId ?? "chicken" })}
        className="h-6 rounded-[6px] border border-line bg-white px-1 font-bold text-ink outline-none"
      >
        {SCENARIO_KINDS.map((k) => (
          <option key={k.kind} value={k.kind}>
            {k.label}
          </option>
        ))}
      </select>
      <span className="flex h-6 items-center rounded-[6px] border border-line bg-white">
        <button className="px-1.5" onClick={() => edit({ ...spec, count: Math.max(min, spec.count - (spec.count > 10 ? 5 : 1)) })} aria-label="Less">
          <Minus className="size-3" />
        </button>
        <span className="min-w-6 text-center font-extrabold text-ink tabular-nums">{spec.count}</span>
        <button className="px-1.5" onClick={() => edit({ ...spec, count: Math.min(max, spec.count + (spec.count >= 10 ? 5 : 1)) })} aria-label="More">
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
  const live = useTwin((s) => s.mode === "live");
  const r = sc.result!;
  const best = r.options.find((o) => o.id === r.bestId);
  return (
    <div className="space-y-4">
      <SpecEditor spec={sc.spec!} />
      <Section title={r.title} right={<SimBadge />}>
        <div className="grid grid-cols-3 gap-1.5">
          <Stat label="Late" value={r.after.projectedLateOrders} before={r.before.projectedLateOrders} />
          <Stat label="At risk" value={r.after.ordersAtRisk} before={r.before.ordersAtRisk} />
          <Stat label="Peak load" value={r.after.maxStationUtilization} before={r.before.maxStationUtilization} format={pct} />
        </div>
        <div className="card space-y-2 p-3">
          {r.stations.map((s) => (
            <div key={s.id}>
              <div className="flex justify-between text-[12px]">
                <span className="font-bold">{s.name}</span>
                <span className="font-bold tabular-nums" style={{ color: s.after > 1 ? RISK_HEX.critical : undefined }}>
                  {pct(s.before)} → {pct(s.after)}
                </span>
              </div>
              <LoadBar value={s.after} before={s.before} />
            </div>
          ))}
          {r.shortages.map((s) => (
            <p key={s.id} className="font-bold text-crit">
              {s.name}: {s.onHand} on hand, {s.need} needed
            </p>
          ))}
        </div>
      </Section>

      {best && (
        <div className="rounded-[10px] border border-accent/30 bg-accent/[0.06] p-3">
          <div className="section-label text-accent!">Recommended</div>
          <p className="mt-0.5 text-[14px] font-extrabold">{best.label}</p>
          <p className="text-mute">{best.description}</p>
          <p className="mt-1">
            {best.metrics.projectedLateOrders} late · {best.metrics.ordersAtRisk} at risk · peak {pct(best.metrics.maxStationUtilization)}
          </p>
          <p className="mt-1 text-mute">
            <b className="text-ink">Trade-off:</b> {best.tradeoff}
          </p>
        </div>
      )}

      <Section title="Other options">
        <div className="card divide-y divide-line">
          {r.options
            .filter((o) => o.id !== r.bestId)
            .map((o) => (
              <div key={o.id} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">{o.label}</span>
                  <span className={clsx("shrink-0 text-[12px] font-bold tabular-nums", o.metrics.projectedLateOrders ? "text-crit" : "text-mute")}>{o.metrics.projectedLateOrders} late</span>
                </div>
                <p className="text-[12px] text-mute">
                  {o.metrics.ordersAtRisk} at risk · peak {pct(o.metrics.maxStationUtilization)}
                </p>
              </div>
            ))}
        </div>
      </Section>

      {sc.wording && <Wording e={sc.wording} loading={sc.wordingLoading} onRephrase={rephraseScenario} />}
      <p className="text-[11.5px] text-faint">Assumes: {r.assumptions.join(" · ")}.</p>
      <div className="flex gap-2">
        {live ? (
          <p className="flex-1 text-[11.5px] font-semibold text-mute">What-ifs never change the live kitchen.</p>
        ) : (
          <button onClick={applyWhatIf} className="btn btn-navy h-8! flex-1">
            Play it in the simulation
          </button>
        )}
        <button onClick={clearScenario} className="btn h-8!" aria-label="New question" title="New question">
          <RotateCcw className="size-3.5" />
        </button>
      </div>
    </div>
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
      <p className="text-mute">Ask a what-if. The twin plays it out on a copy of the kitchen right now; the real kitchen doesn’t change.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(q);
        }}
        className="flex items-end gap-1.5 rounded-[10px] border border-line bg-white p-1.5 pl-2.5 focus-within:border-accent"
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
          className="min-h-[40px] flex-1 resize-none bg-transparent py-1 font-semibold outline-none placeholder:text-faint"
        />
        <button type="submit" disabled={!q.trim()} className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:opacity-35" aria-label="Ask">
          <ArrowUp className="size-4" strokeWidth={2.75} />
        </button>
      </form>
      {!sc.result && (
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((e) => (
            <button key={e} onClick={() => submit(e)} className="rounded-full border border-line bg-white px-2.5 py-1 text-[12px] font-semibold hover:border-black/20">
              {e}
            </button>
          ))}
        </div>
      )}
      {sc.notUnderstood && <p className="card p-2.5 text-mute">I can model walk-ins, delivery surges, catering orders, staff call-outs, running out of an ingredient and supplier deliveries. Try one of the examples.</p>}
      {sc.result && <Result />}
    </div>
  );
}
