import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Bike, Check, CheckCircle2, CircleDot, Footprints, Phone, ScanSearch, ShieldCheck, Undo2, X, Zap } from "lucide-react";
import { useState } from "react";
import type { FeedEntry, OrderView } from "../engine/types";
import { RISK_HEX, minutes } from "../lib/ui";
import { useTwin } from "../store";

const KIND_STYLE: Record<FeedEntry["kind"], { icon: typeof Zap; color: string }> = {
  order: { icon: Bike, color: "#f87171" },
  rush: { icon: Zap, color: "#fb7185" },
  stock: { icon: ScanSearch, color: "#fbbf24" },
  ready: { icon: CheckCircle2, color: "#2dd4bf" },
  system: { icon: CircleDot, color: "#818cf8" },
  approve: { icon: ShieldCheck, color: "#a78bfa" },
};

const SOURCE_ICON = { doordash: Bike, walk_in: Footprints, phone: Phone };

const STATUS_LABEL: Record<OrderView["status"], string> = {
  queued: "Queued",
  prepping: "Prep",
  cooking: "Cooking",
  packing: "Packing",
  ready: "Ready",
  held: "Held",
  deferred: "Deferred",
  blocked: "Blocked",
};

function FeedList() {
  const feed = useTwin((s) => s.state.feed);
  const traced = useTwin((s) => s.tracedOrderId);
  const trace = useTwin((s) => s.trace);
  const items = [...feed].reverse().slice(0, 40);
  return (
    <ul className="flex flex-col gap-1.5 p-3">
      <AnimatePresence initial={false}>
        {items.map((f) => {
          const st = KIND_STYLE[f.kind];
          const Icon = st.icon;
          return (
            <motion.li
              key={f.id}
              layout
              initial={{ opacity: 0, x: -24, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
            >
              <button
                disabled={!f.orderId}
                onClick={() => f.orderId && trace(traced === f.orderId ? null : f.orderId)}
                className={clsx(
                  "flex w-full items-start gap-2.5 rounded-xl border px-2.5 py-2 text-left transition",
                  f.kind === "rush" ? "border-crit/40 bg-crit/10" : "border-white/5 bg-white/[0.025]",
                  f.orderId && "hover:border-white/15 hover:bg-white/[0.05]",
                  traced && traced === f.orderId && "ring-1 ring-accent",
                )}
              >
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg" style={{ background: `${st.color}22`, color: st.color }}>
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={clsx("block text-[12px] leading-snug", f.kind === "rush" ? "font-semibold text-rose-100" : "text-slate-200")}>{f.text}</span>
                  <span className="font-mono text-[10px] text-slate-500">T+{f.atSeconds}s</span>
                </span>
              </button>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

function Tickets() {
  const orders = useTwin((s) => s.state.orders);
  const traced = useTwin((s) => s.tracedOrderId);
  const { trace, release, cancel } = useTwin.getState();
  return (
    <ul className="flex flex-col gap-2 p-3">
      <AnimatePresence initial={false}>
        {orders.map((o) => {
          const color = RISK_HEX[o.risk];
          const SrcIcon = SOURCE_ICON[o.source];
          const late = o.projectedReadyInMinutes !== null && o.projectedReadyInMinutes > o.pickupInMinutes;
          return (
            <motion.li key={o.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => trace(traced === o.id ? null : o.id)}
                onKeyDown={(e) => e.key === "Enter" && trace(traced === o.id ? null : o.id)}
                className={clsx(
                  "relative cursor-pointer overflow-hidden rounded-xl border bg-white/[0.025] p-2.5 transition hover:bg-white/[0.05]",
                  traced === o.id ? "border-accent/60" : "border-white/5",
                )}
              >
                <span className="absolute inset-y-0 left-0 w-0.5" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <SrcIcon className="size-3.5 shrink-0 text-slate-500" />
                    <span className="font-mono text-[12px] font-semibold text-slate-100">{o.label}</span>
                    {o.isRush && <span className="rounded bg-crit/20 px-1 text-[9px] font-bold tracking-wider text-rose-200">RUSH</span>}
                    <span className="truncate text-[12px] text-slate-400">{o.customer}</span>
                  </div>
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: `${color}1f`, color }}>
                    {STATUS_LABEL[o.status]}
                  </span>
                </div>
                <div className="mt-1 truncate text-[11px] text-slate-500">{o.itemsText}</div>
                <div className="mt-1.5 flex items-center justify-between font-mono text-[10.5px]">
                  <span className="text-slate-400">
                    pickup <b className="text-slate-200">{o.pickupInMinutes > 0 ? `in ${minutes(o.pickupInMinutes)}` : "now"}</b>
                  </span>
                  {o.status !== "ready" && o.projectedReadyInMinutes !== null && (
                    <span className={late ? "text-crit" : "text-slate-400"}>ready ~{minutes(o.projectedReadyInMinutes)}</span>
                  )}
                  {o.status === "ready" && (
                    <span className="flex items-center gap-1 text-ok">
                      <Check className="size-3" /> bagged
                    </span>
                  )}
                </div>
                {o.risk !== "normal" && <div className="mt-1 text-[10.5px] leading-snug" style={{ color }}>{o.reason}</div>}
                {o.status === "held" && (
                  <div className="mt-2 flex gap-1.5">
                    <button
                      onClick={(e) => (e.stopPropagation(), release(o.id))}
                      className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10.5px] text-slate-200 hover:bg-white/10"
                    >
                      <Undo2 className="size-3" /> Release
                    </button>
                    <button
                      onClick={(e) => (e.stopPropagation(), cancel(o.id))}
                      className="flex items-center gap-1 rounded-md border border-crit/30 bg-crit/10 px-2 py-1 text-[10.5px] text-rose-200 hover:bg-crit/20"
                    >
                      <X className="size-3" /> Cancel with customer
                    </button>
                  </div>
                )}
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
      {!orders.length && <li className="py-10 text-center text-xs text-slate-500">No open orders</li>}
    </ul>
  );
}

export function OrderFeed() {
  const [tab, setTab] = useState<"feed" | "tickets">("feed");
  const orders = useTwin((s) => s.state.orders);
  const paused = useTwin((s) => s.state.feedPaused);
  const atRisk = orders.filter((o) => o.risk !== "normal").length;
  return (
    <div className="relative flex h-full min-h-0 flex-col rounded-[28px] border border-white/10 bg-gradient-to-b from-ink-800 to-ink-900 p-2 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-white/5 bg-ink-950/80">
        <div className="flex items-center justify-between px-4 pt-3">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-md bg-[#ff3008] text-white">
              <Bike className="size-3.5" />
            </span>
            <div className="leading-tight">
              <div className="text-[12px] font-semibold text-slate-100">Order tablet</div>
              <div className="text-[10px] text-slate-500">Simulated DoorDash feed</div>
            </div>
          </div>
          <span className={clsx("flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide", paused ? "bg-sky-400/10 text-sky-300" : "bg-ok/10 text-ok")}>
            <span className={clsx("size-1.5 rounded-full", paused ? "bg-sky-300" : "breathe bg-ok")} />
            {paused ? "PAUSED" : "LIVE"}
          </span>
        </div>
        <div className="mx-3 mt-3 grid grid-cols-2 rounded-xl bg-white/5 p-1 text-[11.5px]">
          {(["feed", "tickets"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={clsx("relative rounded-lg py-1.5 font-medium transition", tab === t ? "text-white" : "text-slate-500 hover:text-slate-300")}>
              {tab === t && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-lg bg-white/10" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
              <span className="relative">
                {t === "feed" ? "Live feed" : `Tickets · ${orders.length}`}
                {t === "tickets" && atRisk > 0 && <span className="ml-1.5 rounded-full bg-crit/20 px-1.5 text-[10px] text-rose-200">{atRisk}</span>}
              </span>
            </button>
          ))}
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">{tab === "feed" ? <FeedList /> : <Tickets />}</div>
      </div>
      <div className="mx-auto mt-1.5 h-1 w-16 rounded-full bg-white/10" />
    </div>
  );
}
