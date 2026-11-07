import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Boxes, ChefHat, Flame, Gauge, Minus, Package, Pencil, Plus, Users } from "lucide-react";
import { useState } from "react";
import type { InventoryView, StationView } from "../engine/types";
import { RISK_HEX, minutes } from "../lib/ui";
import { useTwin } from "../store";
import { Panel } from "./Panel";

const STATION_ICON = { prep: ChefHat, cook: Flame, pack: Package };

function Ring({ value, color, size = 58 }: { value: number; color: string; size?: number }) {
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  const shown = Math.min(1, value);
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={c}
        initial={false}
        animate={{ strokeDashoffset: c * (1 - shown), stroke: color }}
        transition={{ type: "spring", stiffness: 80, damping: 18 }}
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />
      {value > 1 && (
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r - 9}
          fill="none"
          stroke={color}
          strokeOpacity={0.5}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={2 * Math.PI * (r - 9)}
          initial={false}
          animate={{ strokeDashoffset: 2 * Math.PI * (r - 9) * (1 - Math.min(1, value - 1)) }}
        />
      )}
    </svg>
  );
}

function StationCard({ s }: { s: StationView }) {
  const color = RISK_HEX[s.risk];
  const Icon = STATION_ICON[s.id];
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-2">
      <div className="relative grid place-items-center">
        <Ring value={s.utilization} color={color} />
        <div className="absolute text-center">
          <div className="font-display text-[13px] font-bold tabular-nums" style={{ color }}>
            {Math.round(s.utilization * 100)}
            <span className="text-[11px]">%</span>
          </div>
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-100">
          <Icon className="size-3.5" style={{ color }} />
          {s.name}
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-[11px] whitespace-nowrap text-slate-400">
          <Users className="size-3" /> {s.staff} staff
        </div>
        <div className="mt-0.5 font-mono text-[10px] whitespace-nowrap text-slate-500">
          {minutes(s.queuedMinutes)}/{minutes(s.capacityMinutes)}
        </div>
      </div>
    </div>
  );
}

function InventoryRow({ i }: { i: InventoryView }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(i.onHand);
  const correct = useTwin((s) => s.correctStock);
  const color = RISK_HEX[i.risk];
  const max = Math.max(i.onHand, i.need, 1);
  return (
    <div className={clsx("group rounded-lg px-2 py-1.5 transition", i.short ? "bg-crit/[0.07]" : "hover:bg-white/[0.03]")}>
      <div className="flex items-center justify-between gap-2 text-[12px]">
        <span className={clsx("min-w-0 truncate", i.short ? "font-semibold text-rose-100" : "text-slate-300")}>{i.name}</span>
        <span className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] whitespace-nowrap tabular-nums" style={{ color: i.risk === "normal" ? "#94a3b8" : color }}>
            {i.onHand}
            <span className="text-slate-600">/{i.need}</span>
          </span>
          <button
            onClick={() => (setDraft(i.onHand), setEditing((v) => !v))}
            className="rounded p-0.5 text-slate-600 opacity-60 transition group-hover:opacity-100 hover:bg-white/10 hover:text-slate-200"
            aria-label={`Correct ${i.name} stock`}
            title="Correct stock count"
          >
            <Pencil className="size-3" />
          </button>
        </span>
      </div>
      <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: color, boxShadow: i.risk !== "normal" ? `0 0 8px ${color}` : undefined, opacity: 0.85 }}
          initial={false}
          animate={{ width: `${(i.onHand / max) * 100}%` }}
        />
        <motion.div
          className="absolute inset-y-0 w-0.5 bg-white/70"
          initial={false}
          animate={{ left: `calc(${Math.min(100, (i.need / max) * 100)}% - 1px)` }}
          title="Needed by open orders"
        />
      </div>
      <AnimatePresence>
        {editing && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[10.5px] text-slate-500">Counted</span>
              <button onClick={() => setDraft((d) => Math.max(0, d - 1))} className="rounded-md bg-white/5 p-1 hover:bg-white/10" aria-label="Decrease">
                <Minus className="size-3" />
              </button>
              <input
                type="number"
                min={0}
                value={draft}
                onChange={(e) => setDraft(Math.max(0, Number(e.target.value)))}
                className="w-14 rounded-md border border-white/10 bg-ink-950 px-1.5 py-0.5 text-center font-mono text-xs text-slate-100 outline-none focus:border-accent"
              />
              <button onClick={() => setDraft((d) => d + 1)} className="rounded-md bg-white/5 p-1 hover:bg-white/10" aria-label="Increase">
                <Plus className="size-3" />
              </button>
              <span className="text-[10.5px] text-slate-500">{i.unit}</span>
              <button
                onClick={() => (correct(i.id, draft), setEditing(false))}
                className="ml-auto rounded-md bg-accent/20 px-2 py-1 text-[10.5px] font-semibold text-indigo-100 hover:bg-accent/30"
              >
                Apply recount
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Stations() {
  const stations = useTwin((s) => s.state.stations);
  return (
    <Panel title="Station load" icon={<Gauge className="size-3.5" />} right={<span className="text-[10px] text-slate-500">next 10 min</span>}>
      <div className="grid grid-cols-1 gap-2 px-3 pb-3 sm:grid-cols-3">
        {stations.map((s) => (
          <StationCard key={s.id} s={s} />
        ))}
      </div>
    </Panel>
  );
}

export function Inventory() {
  const inventory = useTwin((s) => s.state.inventory);
  const sorted = [...inventory].sort((a, b) => Number(b.short) - Number(a.short));
  return (
    <Panel title="Inventory" icon={<Boxes className="size-3.5" />} right={<span className="text-[10px] text-slate-500">on hand / needed</span>} className="h-full min-h-0">
      <div className="scroll-thin grid min-h-0 grid-cols-1 gap-x-3 overflow-y-auto px-2 pb-2 sm:grid-cols-2">
        {sorted.map((i) => (
          <InventoryRow key={i.id} i={i} />
        ))}
      </div>
    </Panel>
  );
}
