import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Inspector } from "./components/Inspector";
import { Navigator } from "./components/Navigator";
import { Toolbar } from "./components/Toolbar";
import { useTwin } from "./store";

const Kitchen3D = lazy(() => import("./components/Kitchen3D"));

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
  const color = toast?.tone === "crit" ? "text-crit" : toast?.tone === "warn" ? "text-accent" : "text-ok";
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="sidebar fixed top-16 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-[12px]! px-4 py-2.5 font-bold"
        >
          <Icon className={clsx("size-4", color)} />
          {toast.text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PreviewBanner() {
  const label = useTwin((s) => s.state.strategies.find((x) => x.id === s.previewStrategyId)?.label);
  if (!label) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-4">
      <span className="sidebar rounded-full! px-3.5 py-1.5 font-bold">
        <span className="text-ai">Previewing</span> {label} · nothing changes until you approve
      </span>
    </div>
  );
}

function useWide() {
  const [wide, setWide] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return wide;
}

export default function App() {
  useTicker();
  const [nav, setNav] = useState(true);
  const [insp, setInsp] = useState(true);
  const wide = useWide();
  const insets = useMemo(() => ({ left: wide && nav ? 284 : 0, right: wide && insp ? 352 : 0 }), [wide, nav, insp]);
  return (
    <div className="flex min-h-full flex-col lg:h-full">
      <Toolbar onToggleNav={() => setNav((v) => !v)} onToggleInspector={() => setInsp((v) => !v)} />
      <main className="relative flex flex-1 flex-col gap-3 p-3 lg:block lg:min-h-0 lg:p-0">
        <div className="relative h-[62vh] overflow-hidden rounded-[16px] border border-line lg:absolute lg:inset-0 lg:h-auto lg:rounded-none lg:border-0">
          <Suspense fallback={<div className="flex h-full items-center justify-center text-faint">Loading 3D kitchen…</div>}>
            <Kitchen3D insets={insets} />
          </Suspense>
          <PreviewBanner />
        </div>
        <Navigator className={clsx("h-[460px] lg:absolute lg:top-3 lg:bottom-3 lg:left-3 lg:z-30 lg:h-auto lg:w-[272px]", !nav && "lg:hidden")} />
        <Inspector className={clsx("h-[640px] lg:absolute lg:top-3 lg:right-3 lg:bottom-3 lg:z-30 lg:h-auto lg:w-[340px]", !insp && "lg:hidden")} />
        <p className="pointer-events-none text-center text-[11px] text-faint lg:absolute lg:bottom-1.5 lg:left-1/2 lg:z-10 lg:-translate-x-1/2 lg:whitespace-nowrap">
          Simulated projections from a seeded kitchen model · simulated order feed, no live POS or DoorDash connection
        </p>
      </main>
      <Toast />
    </div>
  );
}
