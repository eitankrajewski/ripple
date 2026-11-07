import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Box, CheckCircle2, Columns3, Info, ListTree, PanelRight } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Inspector } from "./components/Inspector";
import { Navigator } from "./components/Navigator";
import { BoardView } from "./components/BoardView";
import { DragLayer } from "./components/DragLayer";
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

type MobilePane = "3d" | "board" | "nav" | "insp";

function MobileTabs({ pane, onPane, badge }: { pane: MobilePane; onPane: (p: MobilePane) => void; badge: number }) {
  const items: { id: MobilePane; label: string; icon: typeof Box }[] = [
    { id: "3d", label: "Kitchen", icon: Box },
    { id: "board", label: "Board", icon: Columns3 },
    { id: "nav", label: "Lists", icon: ListTree },
    { id: "insp", label: "Details", icon: PanelRight },
  ];
  return (
    <nav className="matte fixed inset-x-0 bottom-0 z-40 flex border-t border-line pb-[env(safe-area-inset-bottom)] lg:hidden">
      {items.map((it) => (
        <button key={it.id} onClick={() => onPane(it.id)} className={clsx("relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold", pane === it.id ? "text-navy" : "text-mute")}>
          <it.icon className="size-5" />
          {it.label}
          {it.id === "insp" && badge > 0 && <span className="absolute top-2 left-1/2 ml-2 size-2 rounded-full bg-crit" />}
        </button>
      ))}
    </nav>
  );
}

export default function App() {
  useTicker();
  useEffect(() => {
    if (new URLSearchParams(location.search).has("join")) useTwin.getState().setMode("live");
  }, []);
  const [navOpen, setNavOpen] = useState(true);
  const [inspOpen, setInspOpen] = useState(true);
  const [pane, setPane] = useState<MobilePane>("3d");
  const wide = useWide();
  const mode = useTwin((s) => s.mode);
  const mainView = useTwin((s) => s.mainView);
  const setMainView = useTwin((s) => s.setMainView);
  const session = useTwin((s) => s.live.session);
  const liveView = useTwin((s) => s.live.view);
  const area = useTwin((s) => s.area);
  const traced = useTwin((s) => s.tracedOrderId);
  const disrupted = useTwin((s) => s.state.phase === "disrupted");
  const gate = mode === "live" && !session;
  const stationScreen = mode === "live" && !!session && session.me.role !== "manager" && liveView === "station";
  const panels = !gate && !stationScreen;
  const nav = navOpen && panels;
  const insp = inspOpen && panels;
  const insets = useMemo(() => ({ left: wide && nav ? 284 : 0, right: wide && insp ? 352 : 0 }), [wide, nav, insp]);
  const board = wide ? mainView === "board" : pane === "board";
  const mobileMain = pane === "3d" || pane === "board";

  const choosePane = (p: MobilePane) => {
    setPane(p);
    if (p === "3d" || p === "board") setMainView(p);
  };
  const openInspector = () => {
    setInspOpen(true);
    if (!wide) setPane("insp");
  };

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden">
      <div className="relative z-40 shrink-0 lg:absolute lg:inset-x-0 lg:top-0">
        <Toolbar onToggleNav={() => setNavOpen((v) => !v)} onToggleInspector={() => setInspOpen((v) => !v)} onOpenInspector={openInspector} showPanels={panels} />
      </div>
      {stationScreen ? (
        <main className="relative min-h-0 flex-1 bg-[radial-gradient(120%_90%_at_50%_0%,#f9fbfe,#e3e8f1)] lg:pt-[52px]">
          <StationScreen />
        </main>
      ) : (
        <main className="relative min-h-0 flex-1">
          <div className={clsx("absolute inset-0", panels && "bottom-14 lg:bottom-0", panels && !wide && !mobileMain && "invisible")}>
            {board && panels ? (
              <div className="h-full bg-[radial-gradient(120%_90%_at_50%_0%,#f9fbfe,#e3e8f1)]">
                <BoardView insets={insets} />
              </div>
            ) : (
              <Suspense fallback={<div className="flex h-full items-center justify-center text-faint">Loading 3D kitchen…</div>}>
                <Kitchen3D insets={insets} />
              </Suspense>
            )}
            <PreviewBanner />
            {gate && <LiveGate />}
            {panels && !wide && mobileMain && (area || traced || disrupted) && (
              <button onClick={() => setPane("insp")} className="sidebar absolute top-3 right-3 z-20 rounded-full! px-3.5 py-1.5 font-bold text-navy">
                {disrupted && !area && !traced ? "Review plans" : "View details"} →
              </button>
            )}
          </div>
          {panels && (
            <>
              <Navigator className={clsx("absolute inset-2 bottom-16 z-30 rounded-[14px]! lg:inset-auto lg:top-[64px] lg:bottom-3 lg:left-3 lg:w-[272px]", wide ? !nav && "hidden" : pane !== "nav" && "hidden")} />
              <Inspector className={clsx("absolute inset-2 bottom-16 z-30 rounded-[14px]! lg:inset-auto lg:top-[64px] lg:right-3 lg:bottom-3 lg:w-[340px]", wide ? !insp && "hidden" : pane !== "insp" && "hidden")} />
            </>
          )}
          <p className="pointer-events-none absolute bottom-1.5 left-1/2 z-10 hidden -translate-x-1/2 text-center text-[11px] whitespace-nowrap text-faint lg:block">
            {mode === "live"
              ? "Live mode · updates come from devices signed in to this kitchen and DoorDash · projections are model estimates"
              : "Simulated projections from a seeded kitchen model · simulated order feed, no live POS or DoorDash connection"}
          </p>
        </main>
      )}
      {panels && <MobileTabs pane={pane} onPane={choosePane} badge={disrupted ? 1 : 0} />}
      <Toast />
      <HelpSheet />
      <DragLayer />
    </div>
  );
}
