import clsx from "clsx";
import { Check, ShieldCheck } from "lucide-react";
import { pct, score } from "../lib/ui";
import { useCan, useTwin } from "../store";
import { Section, SimBadge, Stat, Wording } from "./kit";

export function PlanTab() {
  const state = useTwin((s) => s.state);
  const previewId = useTwin((s) => s.previewStrategyId);
  const explanation = useTwin((s) => s.explanation);
  const explaining = useTwin((s) => s.explaining);
  const { choose, approve, explainWithAI, setTab } = useTwin.getState();
  const canApprove = useCan("approve_plan");
  const live = useTwin((s) => s.mode === "live");

  if (state.phase !== "disrupted") {
    return (
      <div className="space-y-4">
        <div className="pt-8 text-center">
          <ShieldCheck className="mx-auto size-8 text-faint" />
          <p className="mt-2 text-[15px] font-bold">{state.phase === "approved" ? "Plan in effect" : "Nothing to decide"}</p>
          <p className="mx-auto mt-1 max-w-[250px] text-mute">
            {state.phase === "approved"
              ? `${state.strategies.find((s) => s.id === state.approvedStrategyId)?.label ?? "Your plan"} is running. New options appear here if another ripple hits.`
              : `When a ripple hits, the twin pauses and compares responses here.${state.nextRushInSeconds ? ` A large order arrives in ${state.nextRushInSeconds}s.` : ""}`}
          </p>
          <button className="btn mt-3" onClick={() => setTab("ask")}>
            Try a what-if
          </button>
        </div>
        <Wording e={explanation} loading={explaining} onRephrase={explainWithAI} />
      </div>
    );
  }

  const b = state.baseline;
  const bestId = [...state.strategies].sort((x, y) => score(x.metrics) - score(y.metrics))[0]?.id;
  const selected = state.strategies.find((s) => s.id === previewId);

  return (
    <div className="space-y-4">
      <Section title="If nothing changes" right={<SimBadge />}>
        <div className="grid grid-cols-3 gap-1.5">
          <Stat label="Late" value={b.projectedLateOrders} />
          <Stat label="At risk" value={b.ordersAtRisk} />
          <Stat label="Peak load" value={b.maxStationUtilization} format={pct} />
        </div>
      </Section>

      <Section title="Responses · select one to preview it in 3D">
        <div className="space-y-2">
          {state.strategies.map((s) => {
            const on = previewId === s.id;
            return (
              <div key={s.id} onClick={() => choose(on ? null : s.id)} className={clsx("card cursor-pointer p-3 transition-shadow", on ? "border-accent! ring-1 ring-accent" : "hover:border-black/15")}>
                <div className="flex items-start gap-2">
                  <span className={clsx("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border", on ? "border-accent bg-accent text-white" : "border-black/20")}>{on && <Check className="size-3" strokeWidth={3} />}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold">{s.label}</span>
                      {s.id === bestId && <span className="rounded-full bg-ok/15 px-1.5 text-[10.5px] font-extrabold text-[#248a3d]">Best</span>}
                    </div>
                    <p className="text-mute">{s.summary}</p>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  <Stat label="Late" value={s.metrics.projectedLateOrders} before={b.projectedLateOrders} />
                  <Stat label="At risk" value={s.metrics.ordersAtRisk} before={b.ordersAtRisk} />
                  <Stat label="Peak load" value={s.metrics.maxStationUtilization} before={b.maxStationUtilization} format={pct} />
                </div>
                {on && (
                  <div className="mt-2 space-y-1">
                    {s.actions.map((x) => (
                      <p key={x} className="flex gap-1.5">
                        <span className="text-accent">•</span>
                        {x}
                      </p>
                    ))}
                    <p className="text-mute">
                      <b className="text-ink">Trade-off:</b> {s.tradeoff}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {canApprove ? (
        <>
          <button onClick={approve} disabled={!selected} className="btn btn-navy h-9! w-full">
            <ShieldCheck className="size-4" />
            {selected ? `Approve ${selected.label}` : "Select a response to approve"}
          </button>
          <p className="-mt-2 text-center text-[11.5px] text-faint">{live ? "Approving updates every device in the kitchen." : "Nothing changes in the kitchen until you approve."}</p>
        </>
      ) : (
        <p className="rounded-[8px] bg-navy/[0.05] px-3 py-2 text-center text-[12px] font-semibold text-mute">Only the manager can approve a plan. You can still preview the options.</p>
      )}
      {selected && <Wording e={explanation} loading={explaining} onRephrase={explainWithAI} />}
    </div>
  );
}
