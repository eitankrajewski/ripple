import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Siren, Snowflake } from "lucide-react";
import { RISK_HEX } from "../lib/ui";
import { useTwin } from "../store";

export function GlanceBar() {
  const { glance, nextRushInSeconds, phase, autoFrozen, feedPaused } = useTwin((s) => s.state);
  const color = RISK_HEX[glance.level];
  const Icon = glance.level === "critical" ? Siren : glance.level === "warning" ? AlertTriangle : CheckCircle2;

  return (
    <motion.div
      className="glass relative flex items-center gap-4 overflow-hidden rounded-2xl px-5 py-3.5"
      animate={{ borderColor: `${color}55`, boxShadow: `0 0 40px -18px ${color}` }}
      transition={{ duration: 0.6 }}
    >
      <motion.div
        className="pointer-events-none absolute inset-y-0 left-0 w-1/2"
        animate={{ background: `linear-gradient(90deg, ${color}1f, transparent)` }}
        transition={{ duration: 0.6 }}
      />
      <div className="relative grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: `${color}1c`, color }}>
        {glance.level !== "normal" && <span className="ripple-ring absolute inset-0 rounded-xl border" style={{ borderColor: color }} />}
        <Icon className="size-5" />
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="text-[10px] font-semibold tracking-[0.2em] uppercase" style={{ color }}>
          {phase === "disrupted" ? "Ripple detected" : phase === "approved" ? "Plan in effect" : "At a glance"}
        </div>
        <AnimatePresence mode="wait">
          <motion.p
            key={glance.sentence}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="truncate font-display text-[17px] font-medium text-slate-50 md:text-lg"
          >
            {glance.sentence}
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="relative hidden items-center gap-2 sm:flex">
        {feedPaused && autoFrozen && (
          <span className="flex items-center gap-1.5 rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1 text-xs text-sky-200">
            <Snowflake className="size-3.5" /> Twin frozen for planning
          </span>
        )}
        {nextRushInSeconds !== null && (
          <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-xs text-slate-300">
            <span className="breathe size-1.5 rounded-full bg-warn" />
            Dinner rush in {nextRushInSeconds}s
          </span>
        )}
      </div>
    </motion.div>
  );
}
