import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Inspector } from "./components/Inspector";
import { Navigator } from "./components/Navigator";
import { HelpSheet } from "./components/HelpSheet";
import { LiveGate } from "./components/live/LiveGate";
import { StationScreen } from "./components/live/StationScreen";
import { Toolbar } from "./components/Toolbar";
import { useTwin } from "./store";

const Kitchen3D = lazy(() => import("./components/Kitchen3D"));

function useTicker() {
  const live = useTwin((s) => s.mode === "live");
  const paused = useTwin((s) => s.state.feedPaused) && !live;
  const speed = useTwin((s) => (live ? 1 : s.speed));
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
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="sidebar fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-[12px]! px-4 py-2.5 font-bold"
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
    <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-4 lg:top-[66px]">
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
  useEffect(() => {
    if (new URLSearchParams(location.search).has("join")) useTwin.getState().setMode("live");
  }, []);
  const [navOpen, setNavOpen] = useState(true);
  const [inspOpen, setInspOpen] = useState(true);
  const wide = useWide();
  const mode = useTwin((s) => s.mode);
  const session = useTwin((s) => s.live.session);
  const liveView = useTwin((s) => s.live.view);
  const gate = mode === "live" && !session;
  const stationScreen = mode === "live" && !!session && session.me.role !== "manager" && liveView === "station";
  const panels = !gate && !stationScreen;
  const nav = navOpen && panels;
  const insp = inspOpen && panels;
  const insets = useMemo(() => ({ left: wide && nav ? 284 : 0, right: wide && insp ? 352 : 0 }), [wide, nav, insp]);
  return (
    <div className="relative flex min-h-full flex-col lg:h-full">
      <div className="sticky top-0 z-40 lg:absolute lg:inset-x-0">
        <Toolbar onToggleNav={() => setNavOpen((v) => !v)} onToggleInspector={() => setInspOpen((v) => !v)} onOpenInspector={() => setInspOpen(true)} showPanels={panels} />
      </div>
      {stationScreen ? (
        <main className="relative flex-1 bg-[radial-gradient(120%_90%_at_50%_0%,#f9fbfe,#e3e8f1)] lg:min-h-0 lg:pt-[52px]">
          <StationScreen />
        </main>
      ) : (
      <main className="relative flex flex-1 flex-col gap-3 p-3 lg:block lg:min-h-0 lg:p-0">
        <div className="relative h-[62vh] overflow-hidden rounded-[16px] border border-line lg:absolute lg:inset-0 lg:h-auto lg:rounded-none lg:border-0">
          <Suspense fallback={<div className="flex h-full items-center justify-center text-faint">Loading 3D kitchen…</div>}>
            <Kitchen3D insets={insets} />
          </Suspense>
          <PreviewBanner />
          {gate && <LiveGate />}
        </div>
        {panels && (
          <>
            <Navigator className={clsx("h-[460px] lg:absolute lg:top-[64px] lg:bottom-3 lg:left-3 lg:z-30 lg:h-auto lg:w-[272px]", !nav && "lg:hidden")} />
            <Inspector className={clsx("h-[640px] lg:absolute lg:top-[64px] lg:right-3 lg:bottom-3 lg:z-30 lg:h-auto lg:w-[340px]", !insp && "lg:hidden")} />
          </>
        )}
        <p className="pointer-events-none text-center text-[11px] text-faint lg:absolute lg:bottom-1.5 lg:left-1/2 lg:z-10 lg:-translate-x-1/2 lg:whitespace-nowrap">
          {mode === "live"
            ? "Live mode preview · updates come from devices signed in to this kitchen · projections are model estimates"
            : "Simulated projections from a seeded kitchen model · simulated order feed, no live POS or DoorDash connection"}
        </p>
      </main>
      )}
      <Toast />
      <HelpSheet />
    </div>
  );
}
