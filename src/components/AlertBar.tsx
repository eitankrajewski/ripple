import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { RiskLevel, StationId } from "../engine/types";
import type { AreaId } from "../lib/areas";
import { pct, RISK_HEX } from "../lib/ui";
import { useCan, useTwin } from "../store";
import { StationFix } from "./StationFix";

interface Issue {
  id: string;
  risk: RiskLevel;
  title: string;
  detail?: string;
  cta: string;
  run: () => void;
  /** Over-capacity station: show the move / hold / cancel options inline. */
  station?: StationId;
}

const TONE: Record<RiskLevel, string> = {
  normal: "bg-white/80",
  warning: "bg-[#fff6e8]",
  critical: "bg-[#fff0ef]",
};

function useIssues(onOpenInspector: () => void): Issue[] {
  const state = useTwin((s) => s.state);
  const canPlan = useCan("approve_plan");
  const canStock = useCan("correct_stock");
  const canHold = useCan("hold_orders");
  const { setTab, selectArea, setNav, trace } = useTwin.getState();
  const go = (area: AreaId) => () => {
    selectArea(area);
    onOpenInspector();
  };
  const out: Issue[] = [];
  for (const s of state.stations.filter((x) => x.utilization > 1)) {
    out.push({
      id: `over-${s.id}`,
      risk: s.utilization > 1.3 ? "critical" : "warning",
      title: `${s.name} at ${pct(s.utilization)}`,
      detail: `${Math.round(s.queuedMinutes)} min of work for ${s.staff} ${s.staff === 1 ? "person" : "people"}`,
      cta: "Open",
      run: go(s.id as AreaId),
      station: s.id,
    });
  }
  for (const i of state.inventory.filter((x) => x.short)) {
    out.push({
      id: `short-${i.id}`,
      risk: "critical",
      title: `${i.name} short`,
      detail: `${i.onHand} on hand, ${i.need} needed`,
      cta: canStock ? "Recount" : "Pantry",
      run: () => {
        setNav("pantry");
        go("pantry")();
      },
    });
  }
  if (state.phase === "disrupted" && canPlan) {
    out.push({
      id: "plan",
      risk: "warning",
      title: `${state.baseline.projectedLateOrders} late, ${state.baseline.ordersAtRisk} at risk`,
      cta: "Compare plans",
      run: () => {
        setTab("plan");
        onOpenInspector();
      },
    });
  }
  if (canHold) {
    for (const o of state.orders.filter((x) => x.status === "held").slice(0, 2)) {
      out.push({ id: `held-${o.id}`, risk: "warning", title: `${o.label} held`, detail: o.customer, cta: "View", run: () => (trace(o.id), onOpenInspector()) });
    }
  }
  for (const o of state.orders.filter((x) => x.risk === "critical" && x.status !== "held").slice(0, 3)) {
    out.push({ id: `late-${o.id}`, risk: "critical", title: `${o.label} late`, detail: o.customer, cta: "Trace", run: () => (trace(o.id), onOpenInspector()) });
  }
  return out;
}

/** One-line kitchen status; click it for a short list of problems with plain actions. */
export function AlertBar({ onOpenInspector }: { onOpenInspector: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const glance = useTwin((s) => s.state.glance);
  const clock = useTwin((s) => s.state.serviceClock);
  const paused = useTwin((s) => s.state.feedPaused);
  const nextRush = useTwin((s) => s.state.nextRushInSeconds);
  const live = useTwin((s) => s.mode === "live");
  const issues = useIssues(onOpenInspector);
  const Icon = glance.level === "normal" ? CheckCircle2 : AlertTriangle;

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
        onClick={() => issues.length && setOpen((v) => !v)}
        aria-expanded={open}
        className={clsx("flex h-8 w-full items-center gap-2 rounded-[10px] px-3 text-left shadow-[var(--shadow-btn)] transition-colors", TONE[glance.level], !issues.length && "cursor-default")}
      >
        <Icon className="size-4 shrink-0" style={{ color: RISK_HEX[glance.level] }} />
        <span className="min-w-0 flex-1 truncate font-bold">{glance.sentence}</span>
        <span className="hidden shrink-0 font-semibold text-mute tabular-nums md:inline">
          {live ? `Live · ${clock}` : `${paused ? "Paused" : "Running"} · ${clock}${nextRush ? ` · rush in ${nextRush}s` : ""}`}
        </span>
        {issues.length > 0 && (
          <>
            <span className="flex h-5 shrink-0 items-center rounded-full px-1.5 text-[11px] font-extrabold text-white" style={{ background: RISK_HEX[issues.some((a) => a.risk === "critical") ? "critical" : "warning"] }}>
              {issues.length}
            </span>
            <ChevronDown className={clsx("size-4 shrink-0 text-mute transition-transform", open && "rotate-180")} />
          </>
        )}
      </button>

      <AnimatePresence>
        {open && issues.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="sidebar fixed inset-x-2 top-[56px] z-50 max-h-[70vh] space-y-1 overflow-y-auto rounded-[14px]! bg-[#f7f9fc]/97! p-2 scroll-thin sm:absolute sm:inset-x-auto sm:top-10 sm:left-1/2 sm:w-[min(520px,94vw)] sm:-translate-x-1/2"
          >
            {issues.map((a) => (
              <div key={a.id} className="rounded-[10px] px-2.5 py-2 hover:bg-white/70">
                <div className="flex items-center gap-2.5">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: RISK_HEX[a.risk] }} />
                  <div className="min-w-0 flex-1 truncate">
                    <span className="font-extrabold">{a.title}</span>
                    {a.detail && <span className="text-mute"> · {a.detail}</span>}
                  </div>
                  <button
                    className={clsx("btn h-7! shrink-0", a.id === "plan" && "btn-navy")}
                    onClick={() => {
                      a.run();
                      setOpen(false);
                    }}
                  >
                    {a.cta}
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
                {a.station && (
                  <div className="mt-2 pl-4.5">
                    <StationFix station={a.station} compact />
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
