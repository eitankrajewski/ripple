import clsx from "clsx";
import { FastForward, Pause, Play, RotateCcw, Zap } from "lucide-react";
import { useTwin, type Speed } from "../store";

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid size-10 place-items-center">
        <span className="ripple-ring absolute inset-0 rounded-full border border-ok/50" />
        <span className="ripple-ring absolute inset-0 rounded-full border border-accent/50" style={{ animationDelay: "1.2s" }} />
        <span className="size-3 rounded-full bg-gradient-to-br from-ok to-accent shadow-[0_0_16px_#5eead4]" />
      </div>
      <div className="leading-none">
        <div className="font-display text-xl font-bold tracking-[0.22em] text-gradient">RIPPLE</div>
        <div className="mt-1 text-[10.5px] tracking-wide text-slate-500">Kitchen digital twin</div>
      </div>
    </div>
  );
}

export function TopBar() {
  const state = useTwin((s) => s.state);
  const speed = useTwin((s) => s.speed);
  const { togglePause, setSpeed, sendRush, reset } = useTwin.getState();
  const paused = state.feedPaused;

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-6">
        <Logo />
        <div className="hidden h-8 w-px bg-white/10 md:block" />
        <div className="hidden md:block">
          <div className="text-[13px] font-medium text-slate-200">Friday dinner rush</div>
          <div className="text-[11px] text-slate-500">Seeded scenario · simulated DoorDash feed</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="glass flex items-center gap-3 rounded-xl px-3 py-1.5">
          <div className="text-right">
            <div className="font-mono text-[15px] font-semibold text-slate-100 tabular-nums">{state.serviceClock}</div>
            <div className="text-[10px] tracking-wide text-slate-500 uppercase">Service clock</div>
          </div>
          <div className="h-7 w-px bg-white/10" />
          <div className="text-right">
            <div className="font-mono text-[15px] font-semibold text-slate-300 tabular-nums">T+{state.clockSeconds}s</div>
            <div className="text-[10px] tracking-wide text-slate-500 uppercase">Sim time</div>
          </div>
        </div>

        <div className="glass flex items-center gap-1 rounded-xl p-1">
          <button
            onClick={togglePause}
            className={clsx(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
              paused ? "bg-ok/15 text-ok hover:bg-ok/25" : "text-slate-300 hover:bg-white/10",
            )}
          >
            {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
            {paused ? (state.autoFrozen ? "Resume feed" : "Play") : "Pause"}
          </button>
          {([1, 2, 4] as Speed[]).map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={clsx(
                "flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-mono text-xs transition",
                speed === s ? "bg-white/10 text-slate-100" : "text-slate-500 hover:text-slate-200",
              )}
              aria-label={`Speed ${s}x`}
            >
              {s === 4 && <FastForward className="size-3" />}
              {s}×
            </button>
          ))}
        </div>

        <button
          onClick={sendRush}
          className="group relative flex items-center gap-2 overflow-hidden rounded-xl border border-crit/40 bg-gradient-to-r from-rose-500/25 to-orange-500/20 px-4 py-2 text-xs font-semibold text-rose-100 shadow-[0_0_24px_-8px_#fb7185] transition hover:shadow-[0_0_32px_-6px_#fb7185]"
        >
          <Zap className="size-4 text-rose-300 transition group-hover:scale-110" />
          Send rush order
        </button>
        <button
          onClick={reset}
          className="glass flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs text-slate-300 transition hover:text-white"
          title="Reset to the exact initial state and seed"
        >
          <RotateCcw className="size-3.5" />
          Reset
        </button>
      </div>
    </header>
  );
}
