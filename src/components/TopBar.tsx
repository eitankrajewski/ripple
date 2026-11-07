import { Pause, Play, RotateCcw, Zap } from "lucide-react";
import { useTwin, type Speed } from "../store";

const NEXT: Record<Speed, Speed> = { 1: 2, 2: 4, 4: 1 };

export function TopBar() {
  const paused = useTwin((s) => s.state.feedPaused);
  const clock = useTwin((s) => s.state.serviceClock);
  const secs = useTwin((s) => s.state.clockSeconds);
  const speed = useTwin((s) => s.speed);
  const { togglePause, setSpeed, sendRush, reset } = useTwin.getState();

  return (
    <header className="relative z-20 flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-2">
        <button onClick={togglePause} className="pill w-[7.4rem] justify-center" aria-label={paused ? "Play" : "Pause"}>
          {paused ? <Play className="size-4 fill-current" /> : <Pause className="size-4 fill-current" />}
          {paused ? "Play" : "Pause"}
        </button>
        <button onClick={() => setSpeed(NEXT[speed])} className="pill w-14 justify-center tabular-nums" title="Simulation speed">
          {speed}×
        </button>
      </div>

      <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center leading-none">
        <span className="text-[26px] font-black tracking-[0.18em] text-ink">RIPPLE</span>
        <span className="mt-1 hidden text-[12px] font-bold text-mute sm:block">Kitchen digital twin</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="pill hidden cursor-default tabular-nums md:inline-flex">
          {clock}
          <span className="text-mute">· T+{secs}s</span>
        </span>
        <button onClick={sendRush} className="pill text-crit">
          <Zap className="size-4 fill-current" />
          <span className="hidden sm:inline">Rush order</span>
        </button>
        <button onClick={reset} className="pill w-[2.6rem] justify-center px-0" aria-label="Reset" title="Reset to the start">
          <RotateCcw className="size-4" />
        </button>
      </div>
    </header>
  );
}
