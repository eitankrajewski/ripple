import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Box, CircleHelp, Columns3, LayoutGrid, LogOut, PanelLeft, PanelRight, Pause, Play, Plus, RotateCcw, Users, Waves, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ROLES } from "../live/roles";
import { useCan, useTwin, type Mode, type Speed } from "../store";
import { AlertBar } from "./AlertBar";
import { DoorDashPanel } from "./live/DoorDashPanel";
import { NewOrderForm } from "./live/NewOrderForm";

function ViewSwitch() {
  const view = useTwin((s) => s.mainView);
  const setView = useTwin((s) => s.setMainView);
  return (
    <div className="hidden items-center rounded-[9px] bg-navy/[0.07] p-0.5 lg:flex" role="tablist" aria-label="View">
      {(
        [
          ["3d", "3D kitchen", Box],
          ["board", "Board: drag orders between stations", Columns3],
        ] as const
      ).map(([id, label, Icon]) => (
        <button key={id} role="tab" aria-selected={view === id} title={label} onClick={() => setView(id)} className={clsx("flex h-6 w-8 items-center justify-center rounded-[7px]", view === id ? "bg-white text-ink shadow-sm" : "text-mute hover:text-ink")}>
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}

function ModeSwitch() {
  const mode = useTwin((s) => s.mode);
  const setMode = useTwin((s) => s.setMode);
  const opts: { id: Mode; label: string }[] = [
    { id: "live", label: "Live" },
    { id: "sim", label: "Simulation" },
  ];
  return (
    <div className="flex items-center rounded-[9px] bg-navy/[0.07] p-0.5" role="tablist" aria-label="Mode">
      {opts.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={mode === o.id}
          onClick={() => setMode(o.id)}
          className={clsx("flex h-6 items-center gap-1.5 rounded-[7px] px-2.5 text-[12px] font-bold", mode === o.id ? "bg-white text-ink shadow-sm" : "text-mute hover:text-ink")}
        >
          {o.id === "live" && <span className={clsx("size-1.5 rounded-full", mode === "live" ? "bg-ok" : "bg-faint")} />}
          {o.id === "sim" ? (
            <>
              <span className="sm:hidden">Sim</span>
              <span className="hidden sm:inline">Simulation</span>
            </>
          ) : (
            o.label
          )}
        </button>
      ))}
    </div>
  );
}

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);
  return { open, setOpen, ref };
}

function Popover({ open, children, className }: { open: boolean; children: React.ReactNode; className?: string }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.14 }} className={clsx("sidebar scroll-thin fixed inset-x-2 top-[56px] z-50 max-h-[80vh] overflow-y-auto rounded-[14px]! bg-[#f7f9fc]/97! sm:absolute sm:inset-x-auto sm:top-10 sm:right-0", className)}>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function NewOrderButton() {
  const { open, setOpen, ref } = usePopover();
  return (
    <div ref={ref} className="relative">
      <button className="tbtn" onClick={() => setOpen((v) => !v)} title="Enter a new order">
        <Plus className="size-[17px]" />
        <span className="hidden xl:inline">New order</span>
      </button>
      <Popover open={open} className="p-3 sm:w-[320px]">
        <NewOrderForm onDone={() => setOpen(false)} />
      </Popover>
    </div>
  );
}

function DoorDashButton() {
  const { open, setOpen, ref } = usePopover();
  return (
    <div ref={ref} className="relative">
      <button className="tbtn" onClick={() => setOpen((v) => !v)} title="DoorDash orders">
        <span className="flex size-[18px] items-center justify-center rounded-[5px] bg-[#ff3008] text-[10px] font-black text-white">D</span>
        <span className="hidden xl:inline">DoorDash</span>
      </button>
      <Popover open={open} className="p-3 sm:w-[320px]">
        <DoorDashPanel />
      </Popover>
    </div>
  );
}

function AccountMenu() {
  const session = useTwin((s) => s.live.session);
  const view = useTwin((s) => s.live.view);
  const { liveLeave, setLiveView, setNav } = useTwin.getState();
  const { open, setOpen, ref } = usePopover();
  if (!session) return null;
  const role = ROLES[session.me.role];
  const initials = session.me.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div ref={ref} className="relative">
      <button className="tbtn gap-2" onClick={() => setOpen((v) => !v)} title="Account">
        <span className="flex size-6 items-center justify-center rounded-full bg-navy text-[10.5px] font-extrabold text-white">{initials}</span>
        <span className="hidden text-left leading-tight xl:block">
          <span className="block max-w-[120px] truncate text-[12px]">{session.kitchen.name}</span>
          <span className="block text-[10.5px] font-semibold text-mute">{role.label}</span>
        </span>
      </button>
      <Popover open={open} className="p-1.5 sm:w-[260px]">
        <div className="px-2.5 py-2">
          <div className="font-extrabold">{session.me.name}</div>
          <div className="text-[12px] text-mute">
            {role.label} at {session.kitchen.name}
          </div>
          <div className="mt-2 flex items-center justify-between rounded-[8px] bg-navy/[0.05] px-2 py-1.5">
            <span className="text-[11px] font-bold text-mute">Join code</span>
            <span className="font-mono text-[13px] font-extrabold tracking-[0.15em]">{session.kitchen.joinCode}</span>
          </div>
        </div>
        {role.station || session.me.role === "host" ? (
          <button className="tbtn w-full justify-start!" onClick={() => (setLiveView(view === "station" ? "kitchen" : "station"), setOpen(false))}>
            <LayoutGrid className="size-4 text-mute" />
            {view === "station" ? "Open the full kitchen twin" : "Back to my station"}
          </button>
        ) : (
          <button className="tbtn w-full justify-start!" onClick={() => (setNav("team"), setOpen(false))}>
            <Users className="size-4 text-mute" />
            Team and devices
          </button>
        )}
        <button className="tbtn w-full justify-start! text-crit" onClick={() => void liveLeave()}>
          <LogOut className="size-4" />
          Sign out of this device
        </button>
      </Popover>
    </div>
  );
}

export function Toolbar({ onToggleNav, onToggleInspector, onOpenInspector, showPanels }: { onToggleNav: () => void; onToggleInspector: () => void; onOpenInspector: () => void; showPanels: boolean }) {
  const paused = useTwin((s) => s.state.feedPaused);
  const speed = useTwin((s) => s.speed);
  const mode = useTwin((s) => s.mode);
  const signedIn = useTwin((s) => !!s.live.session);
  const canAdd = useCan("add_order");
  const { togglePause, setSpeed, sendRush, reset, setHelp } = useTwin.getState();
  const sim = mode === "sim";

  return (
    <header className="matte relative z-40 flex h-[52px] shrink-0 items-center gap-1.5 px-2 sm:gap-2 sm:px-3">
      {showPanels && (
        <button className="tbtn hidden lg:inline-flex" onClick={onToggleNav} title="Show / hide navigator">
          <PanelLeft className="size-[18px] text-mute" />
        </button>
      )}
      <div className="flex items-center gap-2 pr-1">
        <span className="flex size-7 items-center justify-center rounded-[8px] bg-navy text-white shadow-[0_2px_6px_-2px_rgba(27,44,86,0.6)]">
          <Waves className="size-4" />
        </span>
        <div className="hidden text-[14px] font-extrabold sm:block">RIPPLE</div>
      </div>
      <ModeSwitch />
      {showPanels && <ViewSwitch />}
      {sim && (
        <>
          <span className="mx-0.5 hidden h-5 w-px bg-navy/12 sm:block" />
          <button className="tbtn hidden sm:inline-flex" onClick={reset} title="Reset to the start">
            <RotateCcw className="size-[17px]" />
          </button>
          <button className="tbtn" onClick={togglePause} title={paused ? "Run the simulation" : "Pause the simulation"}>
            {paused ? <Play className="size-[18px] fill-current" /> : <Pause className="size-[18px] fill-current" />}
          </button>
        </>
      )}

      {sim || signedIn ? <AlertBar onOpenInspector={onOpenInspector} /> : <div className="flex-1" />}

      {sim && (
        <>
          <div className="hidden items-center rounded-[8px] bg-navy/[0.07] p-0.5 sm:flex">
            {([1, 2, 4] as Speed[]).map((s) => (
              <button key={s} onClick={() => setSpeed(s)} className={clsx("h-6 rounded-[6px] px-2 text-[12px] font-bold tabular-nums", speed === s ? "bg-white shadow-sm" : "text-mute")}>
                {s}×
              </button>
            ))}
          </div>
          <button className="tbtn hidden sm:inline-flex" onClick={sendRush} title="Send a big rush order">
            <Zap className="size-[17px]" />
            <span className="hidden xl:inline">Rush order</span>
          </button>
        </>
      )}
      {!sim && signedIn && canAdd && <DoorDashButton />}
      {!sim && signedIn && canAdd && <NewOrderButton />}
      {!sim && <AccountMenu />}
      <button className="tbtn" onClick={() => setHelp(true)} title="Help: what the numbers mean and how to get around" aria-label="Help">
        <CircleHelp className="size-[18px]" />
      </button>
      {showPanels && (
        <button className="tbtn hidden lg:inline-flex" onClick={onToggleInspector} title="Show / hide inspector">
          <PanelRight className="size-[18px] text-mute" />
        </button>
      )}
    </header>
  );
}
