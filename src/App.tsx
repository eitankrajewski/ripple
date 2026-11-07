import { AnimatePresence, motion } from "framer-motion";
import { Info, Network, ShieldCheck, Siren } from "lucide-react";
import { useEffect } from "react";
import { DecisionSandbox } from "./components/DecisionSandbox";
import { GlanceBar } from "./components/GlanceBar";
import { OrderFeed } from "./components/OrderFeed";
import { Panel } from "./components/Panel";
import { RippleMap } from "./components/RippleMap";
import { TopBar } from "./components/TopBar";
import { Inventory, Stations } from "./components/Vitals";
import { RISK_HEX } from "./lib/ui";
import { useTwin } from "./store";

function useTicker() {
  const paused = useTwin((s) => s.state.feedPaused);
  const speed = useTwin((s) => s.speed);
  const step = useTwin((s) => s.step);
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(step, 1000 / speed);
    return () => window.clearInterval(id);
  }, [paused, speed, step]);
}

function Legend() {
  return (
    <div className="hidden items-center gap-3 text-[10.5px] text-slate-500 lg:flex">
      {(["normal", "warning", "critical"] as const).map((r) => (
        <span key={r} className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: RISK_HEX[r], boxShadow: `0 0 8px ${RISK_HEX[r]}` }} />
          {r === "normal" ? "Healthy" : r === "warning" ? "At risk" : "Critical"}
        </span>
      ))}
      <span className="flex items-center gap-1 text-slate-600">
        <Info className="size-3" /> Click an order to trace its cause
      </span>
    </div>
  );
}

function Toast() {
  const toast = useTwin((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => useTwin.setState({ toast: null }), 4200);
    return () => window.clearTimeout(id);
  }, [toast]);
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24 }}
          className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-ink-900/95 px-4 py-2 text-sm text-slate-100 shadow-2xl backdrop-blur"
          style={{ borderColor: toast.tone === "crit" ? "#fb718566" : "#2dd4bf66" }}
        >
          {toast.tone === "crit" ? <Siren className="size-4 text-crit" /> : <ShieldCheck className="size-4 text-ok" />}
          {toast.text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function App() {
  useTicker();
  const level = useTwin((s) => s.state.glance.level);
  return (
    <>
      <div className="aurora" data-level={level} />
      <div className="grid-bg" />
      <main className="relative z-10 mx-auto flex min-h-full max-w-[1800px] flex-col gap-4 p-4 lg:p-5 xl:h-screen">
        <TopBar />
        <GlanceBar />
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[280px_1fr] xl:grid-cols-[260px_1fr_350px] 2xl:grid-cols-[290px_1fr_390px] xl:grid-rows-[minmax(0,1fr)]">
          <div className="h-[560px] lg:row-span-2 lg:h-auto xl:row-span-1">
            <OrderFeed />
          </div>
          <div className="flex min-h-0 flex-col gap-4">
            <Panel title="Ripple map" icon={<Network className="size-3.5" />} right={<Legend />} className="h-[520px] xl:h-auto xl:min-h-[420px] xl:flex-1">
              <div className="min-h-0 flex-1 px-1 pb-1">
                <RippleMap />
              </div>
            </Panel>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
              <Stations />
              <div className="h-[200px] xl:h-[150px] 2xl:h-[170px]">
                <Inventory />
              </div>
            </div>
          </div>
          <div className="flex min-h-[560px] flex-col lg:col-start-2 xl:col-start-auto xl:min-h-0">
            <DecisionSandbox />
          </div>
        </div>
        <footer className="pb-1 text-center text-[10.5px] text-slate-600">
          All numbers are simulated projections from a deterministic, seeded kitchen model. The order feed is simulated; no live DoorDash or POS connection.
        </footer>
      </main>
      <Toast />
    </>
  );
}
