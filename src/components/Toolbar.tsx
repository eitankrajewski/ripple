import clsx from "clsx";
import { AlertTriangle, CheckCircle2, PanelLeft, PanelRight, Pause, Play, RotateCcw, Waves, Zap } from "lucide-react";
import { RISK_HEX } from "../lib/ui";
import { useTwin, type Speed } from "../store";

export function Toolbar({ onToggleNav, onToggleInspector }: { onToggleNav: () => void; onToggleInspector: () => void }) {
  const paused = useTwin((s) => s.state.feedPaused);
  const clock = useTwin((s) => s.state.serviceClock);
  const secs = useTwin((s) => s.state.clockSeconds);
  const glance = useTwin((s) => s.state.glance);
  const nextRush = useTwin((s) => s.state.nextRushInSeconds);
  const issues = useTwin((s) => s.state.orders.filter((o) => o.risk !== "normal").length);
  const speed = useTwin((s) => s.speed);
  const { togglePause, setSpeed, sendRush, reset } = useTwin.getState();
  const StatusIcon = glance.level === "normal" ? CheckCircle2 : AlertTriangle;

  return (
    <header className="relative z-40 flex h-[52px] shrink-0 items-center gap-2 border-b border-line bg-[#f5f5f7]/90 px-3 backdrop-blur-xl">
      <button className="tbtn hidden lg:inline-flex" onClick={onToggleNav} title="Show / hide navigator">
        <PanelLeft className="size-[18px] text-mute" />
      </button>
      <div className="flex items-center gap-2 pr-1">
        <span className="flex size-7 items-center justify-center rounded-[8px] bg-accent text-white">
          <Waves className="size-4" />
        </span>
        <div className="leading-tight">
          <div className="text-[14px] font-extrabold">RIPPLE</div>
          <div className="hidden text-[11px] font-semibold text-mute sm:block">Dinner service</div>
        </div>
      </div>
      <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
      <button className="tbtn" onClick={reset} title="Reset to the start">
        <RotateCcw className="size-[17px]" />
      </button>
      <button className="tbtn" onClick={togglePause} title={paused ? "Run the simulation" : "Pause the simulation"}>
        {paused ? <Play className="size-[18px] fill-current" /> : <Pause className="size-[18px] fill-current" />}
      </button>

      <div className="mx-auto flex h-8 min-w-0 max-w-[620px] flex-1 items-center gap-2 rounded-[9px] bg-black/[0.05] px-3">
        <StatusIcon className="size-4 shrink-0" style={{ color: RISK_HEX[glance.level] }} />
        <span className="min-w-0 flex-1 truncate font-bold">{glance.sentence}</span>
        <span className="hidden shrink-0 font-semibold text-mute tabular-nums md:inline">
          {paused ? "Paused" : "Running"} · {clock} · T+{secs}s{nextRush ? ` · rush in ${nextRush}s` : ""}
        </span>
        {issues > 0 && (
          <span className="flex shrink-0 items-center gap-1 font-extrabold text-warn">
            <AlertTriangle className="size-3.5" />
            {issues}
          </span>
        )}
      </div>

      <div className="hidden items-center rounded-[8px] bg-black/[0.05] p-0.5 sm:flex">
        {([1, 2, 4] as Speed[]).map((s) => (
          <button key={s} onClick={() => setSpeed(s)} className={clsx("h-6 rounded-[6px] px-2 text-[12px] font-bold tabular-nums", speed === s ? "bg-white shadow-sm" : "text-mute")}>
            {s}×
          </button>
        ))}
      </div>
      <button className="tbtn" onClick={sendRush} title="Send a big rush order">
        <Zap className="size-[17px]" />
        <span className="hidden xl:inline">Rush order</span>
      </button>
      <button className="tbtn hidden lg:inline-flex" onClick={onToggleInspector} title="Show / hide inspector">
        <PanelRight className="size-[18px] text-mute" />
      </button>
    </header>
  );
}
