import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Bike, ChevronDown, Clock, Phone, Store, Zap } from "lucide-react";
import { useState } from "react";
import type { OrderView } from "../engine/types";
import { minutes, RISK_HEX, RISK_LABEL, SOURCE } from "../lib/ui";
import { useTwin } from "../store";
import { Panel, Segmented } from "./Panel";

type Filter = "all" | "risk" | "held";
const SOURCE_ICON = { doordash: Bike, walk_in: Store, phone: Phone };
const STATUS: Record<OrderView["status"], string> = {
  queued: "Waiting",
  prepping: "Prep",
  cooking: "Cooking",
  packing: "Packing",
  ready: "Ready",
  held: "Held",
  deferred: "Deferred",
  blocked: "Blocked",
};

function Ticket({ o }: { o: OrderView }) {
  const traced = useTwin((s) => s.tracedOrderId === o.id);
  const { trace, release, cancel } = useTwin.getState();
  const Icon = SOURCE_ICON[o.source];
  const menu = useTwin((s) => s.kitchen.config.menu);
  const held = o.status === "held" || o.status === "deferred";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={() => trace(traced ? null : o.id)}
      className={clsx("frost relative cursor-pointer overflow-hidden rounded-[20px] p-3.5 transition hover:-translate-y-0.5", traced && "ring-3 ring-sky")}
    >
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: RISK_HEX[o.risk] }} />
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full text-white" style={{ background: SOURCE[o.source].color }}>
            <Icon className="size-3.5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-[14px] font-black text-ink">
              {o.label}
              {o.isRush && <Zap className="size-3.5 fill-crit text-crit" />}
            </div>
            <div className="truncate text-[11.5px] font-bold text-mute">{o.customer}</div>
          </div>
        </div>
        <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black" style={{ background: `${RISK_HEX[o.risk]}1f`, color: RISK_HEX[o.risk] }}>
          {o.risk === "normal" ? STATUS[o.status] : RISK_LABEL[o.risk]}
        </span>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1">
        {o.items.map((it) => {
          const m = menu.find((x) => x.id === it.menuItemId);
          return (
            <span key={it.menuItemId} className="rounded-full bg-white/80 px-2 py-0.5 text-[11.5px] font-bold text-ink">
              {it.qty > 1 && `${it.qty}× `}
              {m?.short}
            </span>
          );
        })}
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[11.5px] font-bold text-mute">
        <span className="flex items-center gap-1">
          <Clock className="size-3.5" /> Pickup {o.pickupInMinutes > 0 ? `in ${minutes(o.pickupInMinutes)}` : "now"}
        </span>
        <span>{o.projectedReadyInMinutes === null ? "Can't start" : o.status === "ready" ? "Ready" : `Ready ~${minutes(o.projectedReadyInMinutes)}`}</span>
      </div>
      {held && (
        <div className="mt-2.5 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => release(o.id)} className="btn3d h-8 flex-1 text-[12px]" style={{ ["--c" as string]: "#58cc02", ["--d" as string]: "#46a302" }}>
            Release
          </button>
          <button onClick={() => cancel(o.id)} className="h-8 flex-1 rounded-[14px] bg-white text-[12px] font-extrabold text-crit">
            Cancel & notify
          </button>
        </div>
      )}
    </motion.div>
  );
}

function Activity() {
  const feed = useTwin((s) => s.state.feed);
  return (
    <div className="scroll-thin max-h-[260px] space-y-1.5 overflow-y-auto px-6 pb-5">
      <AnimatePresence initial={false}>
        {[...feed].reverse().map((f) => (
          <motion.div key={f.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-baseline gap-3 rounded-2xl bg-white/50 px-3 py-2 text-[13px] font-semibold">
            <span className="w-11 shrink-0 text-[11px] font-black text-mute tabular-nums">T+{f.atSeconds}s</span>
            <span className={clsx(f.kind === "rush" && "font-extrabold text-crit", f.kind === "system" && "text-sky", f.kind === "approve" && "text-ok-dark")}>{f.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function OrdersLane() {
  const orders = useTwin((s) => s.state.orders);
  const paused = useTwin((s) => s.state.feedPaused);
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<"tickets" | "activity">("tickets");
  const [expanded, setExpanded] = useState(false);
  const atRisk = orders.filter((o) => o.risk !== "normal");
  const held = orders.filter((o) => o.status === "held" || o.status === "deferred");
  const list = filter === "risk" ? atRisk : filter === "held" ? held : orders;
  const shown = expanded ? list : list.slice(0, 8);

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          Incoming orders
          <span className={clsx("flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-black", paused ? "bg-black/5 text-mute" : "bg-ok/15 text-ok-dark")}>
            <span className={clsx("size-1.5 rounded-full", paused ? "bg-mute" : "animate-pulse bg-ok")} />
            {paused ? "Paused" : "Live"}
          </span>
        </span>
      }
      right={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {view === "tickets" && (
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: `All ${orders.length}` },
                { value: "risk", label: `At risk ${atRisk.length}` },
                { value: "held", label: `Held ${held.length}` },
              ]}
            />
          )}
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "tickets", label: "Tickets" },
              { value: "activity", label: "Activity" },
            ]}
          />
        </div>
      }
    >
      {view === "activity" ? (
        <Activity />
      ) : (
        <div className="px-6 pb-5">
          {list.length === 0 ? (
            <p className="py-6 text-center text-[13px] font-bold text-mute">Nothing here right now.</p>
          ) : (
            <motion.div layout className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3">
              <AnimatePresence initial={false}>
                {shown.map((o) => (
                  <Ticket key={o.id} o={o} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
          {list.length > 8 && (
            <button onClick={() => setExpanded((e) => !e)} className="mx-auto mt-3 flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-extrabold text-sky hover:bg-white/60">
              {expanded ? "Show fewer" : `Show all ${list.length}`}
              <ChevronDown className={clsx("size-4 transition", expanded && "rotate-180")} />
            </button>
          )}
        </div>
      )}
    </Panel>
  );
}
