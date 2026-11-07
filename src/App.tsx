import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useEffect } from "react";
import { KitchenFloor } from "./components/KitchenFloor";
import { OrdersLane } from "./components/OrdersLane";
import { SidePanel } from "./components/SidePanel";
import { TopBar } from "./components/TopBar";
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

function Toast() {
  const toast = useTwin((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => useTwin.setState({ toast: null }), 4200);
    return () => window.clearTimeout(id);
  }, [toast]);
  const Icon = toast?.tone === "crit" ? AlertTriangle : toast?.tone === "warn" ? Info : CheckCircle2;
  const color = toast?.tone === "crit" ? "text-crit" : toast?.tone === "warn" ? "text-sky" : "text-ok";
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24 }}
          className="glass fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full px-5 py-3 text-[14px] font-extrabold text-ink"
        >
          <Icon className={`size-5 ${color}`} />
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
      <div className="backdrop" data-level={level} />
      <main className="relative z-10 mx-auto flex max-w-[1680px] flex-col gap-4 px-4 pt-3 pb-6 sm:px-6">
        <TopBar />
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="flex min-w-0 flex-col gap-5">
            <KitchenFloor />
            <OrdersLane />
          </div>
          <SidePanel />
        </div>
        <footer className="pt-2 text-center text-[12px] font-semibold text-mute">
          All numbers are simulated projections from a deterministic, seeded kitchen model. The order feed is simulated; there is no live DoorDash or POS connection.
        </footer>
      </main>
      <Toast />
    </>
  );
}
