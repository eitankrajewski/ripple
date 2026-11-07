import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Info } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { RiskLevel } from "../engine/types";
import type { AreaId } from "../lib/areas";
import { pct, RISK_HEX } from "../lib/ui";
import { useCan, useTwin } from "../store";

interface UrgentAction {
  id: string;
  risk: RiskLevel;
  title: string;
  detail: string;
  cta: string;
  run: () => void;
}

const TONE: Record<RiskLevel, string> = {
  normal: "bg-white/70 border-navy/10",
  warning: "bg-[#fff6e8] border-[#f5c77a]/70",
  critical: "bg-[#fff0ef] border-[#f3a29b]/70",
};

function ago(now: number, at: number) {
  const d = Math.max(0, now - at);
  if (d < 5) return "now";
  if (d < 60) return `${d}s ago`;
  return `${Math.floor(d / 60)}m ago`;
}

function useUrgentActions(onOpenInspector: () => void): UrgentAction[] {
  const state = useTwin((s) => s.state);
  const canPlan = useCan("approve_plan");
  const canStock = useCan("correct_stock");
  const canHold = useCan("hold_orders");
  const { setTab, selectArea, setNav, trace } = useTwin.getState();
  const go = (area: AreaId) => () => {
    selectArea(area);
    onOpenInspector();
  };
  const out: UrgentAction[] = [];
  if (state.phase === "disrupted" && canPlan) {
    out.push({
      id: "plan",
      risk: "critical",
      title: "Choose a response plan",
      detail: `${state.baseline.projectedLateOrders} late and ${state.baseline.ordersAtRisk} at risk if nothing changes. Compare the options and approve one.`,
      cta: "Compare plans",
      run: () => {
        setTab("plan");
        onOpenInspector();
      },
    });
  }
  for (const i of state.inventory.filter((x) => x.short)) {
    out.push({
      id: `short-${i.id}`,
      risk: "critical",
      title: `${i.name} is short`,
      detail: `${i.onHand} ${i.unit} on hand, open orders need ${i.need}. ${canStock ? "Recount it or hold the orders that need it." : "Tell the manager or prep."}`,
      cta: canStock ? "Recount" : "View pantry",
      run: () => {
        setNav("pantry");
        go("pantry")();
      },
    });
  }
  for (const s of state.stations.filter((x) => x.utilization > 1)) {
    out.push({
      id: `over-${s.id}`,
      risk: s.utilization > 1.3 ? "critical" : "warning",
      title: `${s.name} is over capacity (${pct(s.utilization)})`,
      detail: `${Math.round(s.queuedMinutes)} min of work queued for ${s.staff} staff. Move someone over or approve a plan that spreads the load.`,
      cta: `Open ${s.name}`,
      run: go(s.id as AreaId),
    });
  }
  if (canHold) {
    for (const o of state.orders.filter((x) => x.status === "held").slice(0, 2)) {
      out.push({ id: `held-${o.id}`, risk: "warning", title: `${o.label} is held`, detail: o.reason, cta: "Decide", run: () => (trace(o.id), onOpenInspector()) });
    }
  }
  for (const o of state.orders.filter((x) => x.risk === "critical" && x.status !== "held").slice(0, 3)) {
    out.push({ id: `late-${o.id}`, risk: "critical", title: `${o.label} · ${o.customer} will be late`, detail: o.reason, cta: "Trace", run: () => (trace(o.id), onOpenInspector()) });
  }
  return out;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="px-4 py-3">
      <div className="section-label mb-2 uppercase">{title}</div>
      {children}
    </div>
  );
}

/** Toolbar status that expands into what changed, why it matters and what to do now. */
export function AlertBar({ onOpenInspector }: { onOpenInspector: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const glance = useTwin((s) => s.state.glance);
  const phase = useTwin((s) => s.state.phase);
  const feed = useTwin((s) => s.state.feed);
  const now = useTwin((s) => s.state.clockSeconds);
  const clock = useTwin((s) => s.state.serviceClock);
  const paused = useTwin((s) => s.state.feedPaused);
  const nextRush = useTwin((s) => s.state.nextRushInSeconds);
  const live = useTwin((s) => s.mode === "live");
  const actions = useUrgentActions(onOpenInspector);
  const latest = feed[0];
  const Icon = glance.level === "normal" ? CheckCircle2 : AlertTriangle;

  const [wasDisrupted, setWasDisrupted] = useState(false);
  if ((phase === "disrupted") !== wasDisrupted) {
    setWasDisrupted(phase === "disrupted");
    if (phase === "disrupted") setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative mx-auto min-w-0 max-w-[640px] flex-1">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={clsx("flex h-8 w-full items-center gap-2 rounded-[10px] border px-3 text-left transition-colors", TONE[glance.level])}
      >
        <Icon className="size-4 shrink-0" style={{ color: RISK_HEX[glance.level] }} />
        <span className="min-w-0 flex-1 truncate font-bold">{glance.sentence}</span>
        <span className="hidden shrink-0 font-semibold text-mute tabular-nums md:inline">
          {live ? `Live · ${clock}` : `${paused ? "Paused" : "Running"} · ${clock}${nextRush ? ` · rush in ${nextRush}s` : ""}`}
        </span>
        {actions.length > 0 && (
          <span className="flex h-5 shrink-0 items-center rounded-full px-1.5 text-[11px] font-extrabold text-white" style={{ background: RISK_HEX[actions.some((a) => a.risk === "critical") ? "critical" : "warning"] }}>
            {actions.length} to do
          </span>
        )}
        <ChevronDown className={clsx("size-4 shrink-0 text-mute transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="sidebar absolute top-10 left-1/2 z-50 max-h-[70vh] bg-[#f7f9fc]/97! w-[min(560px,94vw)] -translate-x-1/2 divide-y divide-navy/8 overflow-y-auto rounded-[14px]! scroll-thin"
          >
            <Section title="What changed">
              {latest ? (
                <div className="space-y-1.5">
                  {feed.slice(0, 4).map((f, i) => (
                    <div key={f.id} className={clsx("flex items-start gap-2", i > 0 && "text-mute")}>
                      <Info className={clsx("mt-0.5 size-3.5 shrink-0", i === 0 ? "text-accent" : "text-faint")} />
                      <span className={clsx("flex-1", i === 0 && "font-bold")}>{f.text}</span>
                      <span className="shrink-0 text-[11px] font-semibold text-faint tabular-nums">{ago(now, f.atSeconds)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-mute">No updates yet.</p>
              )}
            </Section>
            <Section title="Where the kitchen stands">
              <p className="font-semibold">{glance.sentence}</p>
            </Section>
            <Section title={actions.length ? "Do this now" : "Actions"}>
              {actions.length === 0 ? (
                <p className="flex items-center gap-2 text-mute">
                  <CheckCircle2 className="size-4 text-ok" /> Nothing urgent. Every pickup is on track.
                </p>
              ) : (
                <div className="space-y-2">
                  {actions.map((a) => (
                    <div key={a.id} className="card flex items-start gap-3 p-2.5">
                      <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: RISK_HEX[a.risk] }} />
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold">{a.title}</div>
                        <div className="text-[12px] text-mute">{a.detail}</div>
                      </div>
                      <button
                        className={clsx("btn shrink-0", a.id === "plan" && "btn-navy")}
                        onClick={() => {
                          a.run();
                          setOpen(false);
                        }}
                      >
                        {a.cta}
                        <ChevronRight className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
