import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Eye, PauseCircle, Route, Users, X } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import type { OrderView, RiskLevel, RippleNode } from "../engine/types";
import { pct, RISK_HEX, RISK_SOFT } from "../lib/ui";
import { useTwin } from "../store";
import { CookArt, OrdersArt, PackArt, PantryArt, PickupArt, PrepArt } from "./illustrations";

type StageId = "orders" | "pantry" | "prep" | "cook" | "pack" | "pickup";

interface Stage {
  id: StageId;
  name: string;
  art: ComponentType<{ active?: boolean; alert?: boolean; className?: string }>;
  risk: RiskLevel;
  sub: ReactNode;
  load?: number;
  loadBefore?: number;
  stat: ReactNode;
  orders: OrderView[];
  changed: boolean;
}

const RANK: Record<RiskLevel, number> = { normal: 0, warning: 1, critical: 2 };
const worst = (a: RiskLevel, b: RiskLevel) => (RANK[a] >= RANK[b] ? a : b);
const STAGE_OF: Record<string, StageId> = {
  queued: "orders",
  held: "orders",
  deferred: "orders",
  blocked: "pantry",
  prepping: "prep",
  cooking: "cook",
  packing: "pack",
  ready: "pickup",
};

function useStages(): { stages: Stage[]; previewing: boolean } {
  const state = useTwin((s) => s.state);
  const previewId = useTwin((s) => s.previewStrategyId);
  const preview = state.strategies.find((s) => s.id === previewId);
  const nodes: RippleNode[] = preview ? preview.preview.nodes : state.nodes;
  const node = (id: string) => nodes.find((n) => n.id === id);
  const changed = new Set(preview?.changedNodeIds ?? []);
  const byStage = (id: StageId) => state.orders.filter((o) => STAGE_OF[o.status] === id);
  const evt = state.nodes.find((n) => n.id === "evt");
  const short = state.inventory.filter((i) => i.short);
  const pantryRisk = preview
    ? nodes.filter((n) => n.type === "ingredient").reduce<RiskLevel>((a, n) => worst(a, n.risk), "normal")
    : state.inventory.reduce<RiskLevel>((a, i) => worst(a, i.risk), "normal");
  const queue = byStage("orders");
  const held = queue.filter((o) => o.status === "held" || o.status === "deferred").length;
  const topTask = state.nodes.filter((n) => n.type === "task").sort((a, b) => RANK[b.risk] - RANK[a.risk])[0];
  const outcome = node("outcome");

  const station = (id: "prep" | "cook" | "pack", art: Stage["art"], sub: ReactNode): Stage => {
    const sv = state.stations.find((s) => s.id === id)!;
    const n = node(`st-${id}`);
    const load = n?.meta ? Number(n.meta) / 100 : sv.utilization;
    return {
      id,
      name: sv.name,
      art,
      risk: n?.risk ?? sv.risk,
      sub,
      load,
      loadBefore: preview ? sv.utilization : undefined,
      stat: (
        <span className="flex items-center gap-1">
          <Users className="size-3.5" /> {sv.staff} staff
        </span>
      ),
      orders: byStage(id),
      changed: changed.has(`st-${id}`),
    };
  };

  const stages: Stage[] = [
    {
      id: "orders",
      name: "Orders in",
      art: OrdersArt,
      risk: evt?.risk ?? "normal",
      sub: evt?.label ?? "Simulated feed",
      stat: (
        <span>
          {queue.length} waiting{held ? ` · ${held} held` : ""}
        </span>
      ),
      orders: queue,
      changed: false,
    },
    {
      id: "pantry",
      name: "Pantry",
      art: PantryArt,
      risk: pantryRisk,
      sub: short.length ? `${short.map((s) => s.name).join(", ")} short` : "Stocked",
      stat: short.length ? (
        <span className="text-crit">
          {short[0].onHand} left · need {short[0].need}
        </span>
      ) : (
        <span>{state.inventory.length} ingredients</span>
      ),
      orders: byStage("pantry"),
      changed: [...changed].some((c) => c.startsWith("ing-")),
    },
    station("prep", PrepArt, topTask ? `${topTask.label}` : "Chop & bread"),
    station("cook", CookArt, "Grill & fry"),
    station("pack", PackArt, "Bag & check"),
    {
      id: "pickup",
      name: "Pickup",
      art: PickupArt,
      risk: outcome?.risk ?? "normal",
      sub: outcome?.detail ?? "Promises on track",
      stat: <span>{byStage("pickup").length} ready</span>,
      orders: byStage("pickup"),
      changed: changed.has("outcome"),
    },
  ];
  return { stages, previewing: !!preview };
}

function LoadBar({ value, before }: { value: number; before?: number }) {
  const risk: RiskLevel = value > 1 ? "critical" : value >= 0.85 ? "warning" : "normal";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[12px] font-bold text-mute">
        <span>Load</span>
        <span className="text-[15px] font-black tabular-nums" style={{ color: RISK_HEX[risk] }}>
          {before !== undefined && Math.round(before * 100) !== Math.round(value * 100) && <span className="mr-1 text-[11px] text-mute line-through">{pct(before)}</span>}
          {pct(value)}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-black/[0.06]">
        <motion.div className="h-full rounded-full" style={{ background: RISK_HEX[risk] }} animate={{ width: `${Math.min(100, value * 100)}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
      </div>
    </div>
  );
}

function Connector({ risk, paused }: { risk: RiskLevel; paused: boolean }) {
  return (
    <div className="hidden w-5 shrink-0 items-center xl:flex 2xl:w-8">
      <div
        className="flow-dots h-2 w-full"
        style={{
          ["--dot" as string]: risk === "normal" ? "#c7c9cf" : RISK_HEX[risk],
          ["--speed" as string]: risk === "critical" ? "0.7s" : "1.5s",
          animationPlayState: paused ? "paused" : "running",
        }}
      />
    </div>
  );
}

function StageCard({ s, index, dim, culprit, onTrace, tracedId }: { s: Stage; index: number; dim: boolean; culprit: boolean; onTrace: (id: string) => void; tracedId: string | null }) {
  const hot = s.risk !== "normal";
  const Art = s.art;
  return (
    <motion.div
      layout
      animate={{ opacity: dim ? 0.35 : 1, scale: dim ? 0.97 : 1 }}
      className={clsx("frost relative flex min-w-0 flex-1 flex-col rounded-[24px] p-3.5 transition-shadow", culprit && "ring-4 ring-sky/60")}
      style={hot ? { boxShadow: `0 0 0 2px ${RISK_HEX[s.risk]}55, 0 18px 40px -18px ${RISK_HEX[s.risk]}aa` } : undefined}
    >
      <div className="relative mx-auto h-[78px] w-full max-w-[120px]">
        {s.risk === "critical" && (
          <>
            <span className="ring-pulse absolute inset-0 m-auto size-20 rounded-full" style={{ background: `${RISK_HEX.critical}33` }} />
            <span className="ring-pulse absolute inset-0 m-auto size-20 rounded-full" style={{ background: `${RISK_HEX.critical}22`, animationDelay: "1.1s" }} />
          </>
        )}
        <Art active={s.orders.length > 0 || hot} alert={s.risk === "critical"} className="relative h-full w-full" />
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-[11px] font-black text-mute">{index + 1}</span>
        <h3 className="truncate text-[15px] font-black text-ink">{s.name}</h3>
      </div>
      <p className="mt-0.5 truncate text-[12px] font-semibold text-mute" title={typeof s.sub === "string" ? s.sub : undefined}>
        {s.sub}
      </p>
      <div className="mt-2.5">
        {s.load !== undefined ? (
          <LoadBar value={s.load} before={s.loadBefore} />
        ) : (
          <div className="flex h-[38px] items-end text-[13px] font-extrabold text-ink">{s.stat}</div>
        )}
      </div>
      {s.load !== undefined && <div className="mt-1.5 text-[12px] font-bold text-mute">{s.stat}</div>}
      <div className="mt-2.5 flex min-h-[26px] flex-wrap gap-1">
        {s.orders.slice(0, 3).map((o) => (
          <button
            key={o.id}
            onClick={() => onTrace(o.id)}
            className={clsx(
              "flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11.5px] font-extrabold shadow-sm transition hover:scale-105",
              tracedId === o.id && "ring-2 ring-sky",
            )}
            title={`${o.customer} · ${o.reason}`}
          >
            <span className="size-1.5 rounded-full" style={{ background: RISK_HEX[o.risk] }} />
            {o.label}
          </button>
        ))}
        {s.orders.length > 3 && <span className="rounded-full px-1.5 py-0.5 text-[11.5px] font-extrabold text-mute">+{s.orders.length - 3}</span>}
      </div>
      {s.changed && (
        <span className="absolute -top-2 right-3 rounded-full bg-grape px-2 py-0.5 text-[10px] font-black tracking-wide text-white uppercase shadow">Changes</span>
      )}
    </motion.div>
  );
}

function TraceBar({ order, onClose }: { order: OrderView; onClose: () => void }) {
  const steps = [
    "Orders in",
    order.blockedBy ? `Pantry: no ${order.blockedBy}` : "Pantry",
    order.lateBecause === "prep" ? "Prep (bottleneck)" : "Prep",
    order.lateBecause === "cook" ? "Cook (bottleneck)" : "Cook",
    order.lateBecause === "pack" ? "Pack (bottleneck)" : "Pack",
    order.risk === "normal" ? "On time" : order.status === "blocked" || order.status === "held" ? "Can't be made" : "Late",
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="frost mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[20px] px-4 py-3">
      <Route className="size-4 text-sky" />
      <span className="text-[14px] font-black">
        Tracing {order.label} · {order.customer}
      </span>
      <div className="flex flex-wrap items-center gap-1 text-[12px] font-bold">
        {steps.map((s, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className={clsx("rounded-full px-2 py-0.5", /bottleneck|no |Late|Can't/.test(s) ? "bg-crit/10 text-crit" : "bg-white/80 text-mute")}>{s}</span>
            {i < steps.length - 1 && <span className="text-mute">›</span>}
          </span>
        ))}
      </div>
      <span className="text-[12.5px] font-semibold text-mute">{order.reason}</span>
      <button onClick={onClose} className="ml-auto rounded-full p-1 text-mute hover:bg-white" aria-label="Stop tracing">
        <X className="size-4" />
      </button>
    </motion.div>
  );
}

export function KitchenFloor() {
  const { stages, previewing } = useStages();
  const glance = useTwin((s) => s.state.glance);
  const phase = useTwin((s) => s.state.phase);
  const frozen = useTwin((s) => s.state.autoFrozen && s.state.feedPaused);
  const paused = useTwin((s) => s.state.feedPaused);
  const nextRush = useTwin((s) => s.state.nextRushInSeconds);
  const tracedId = useTwin((s) => s.tracedOrderId);
  const order = useTwin((s) => s.state.orders.find((o) => o.id === s.tracedOrderId));
  const previewLabel = useTwin((s) => s.state.strategies.find((x) => x.id === s.previewStrategyId)?.label);
  const trace = useTwin((s) => s.trace);

  const culpritStage: StageId | null = order ? (order.blockedBy ? "pantry" : (order.lateBecause ?? null)) : null;
  const Icon = glance.level === "normal" ? CheckCircle2 : AlertTriangle;
  const tag = phase === "disrupted" ? "Ripple detected" : phase === "approved" ? "Plan running" : "Right now";

  return (
    <section className="glass relative overflow-hidden rounded-[32px]">
      <div className="floor absolute inset-0 opacity-70" />
      <div className="blob top-10 left-[8%] size-48" style={{ background: "#ffd9a8" }} />
      <div className="blob right-[12%] bottom-0 size-56" style={{ background: "#bfe8ff", animationDelay: "-6s" }} />
      <div className="blob bottom-6 left-[45%] size-40" style={{ background: glance.level === "critical" ? "#ffc2c2" : "#d7f5bf", animationDelay: "-11s" }} />

      <div className="relative p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <motion.div
              key={glance.level}
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              className="flex size-11 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: RISK_SOFT[glance.level], color: RISK_HEX[glance.level] }}
            >
              <Icon className="size-6" strokeWidth={2.5} />
            </motion.div>
            <div className="min-w-0">
              <div className="text-[12px] font-black tracking-[0.14em] uppercase" style={{ color: RISK_HEX[glance.level] }}>
                {tag}
              </div>
              <AnimatePresence mode="wait">
                <motion.p key={glance.sentence} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="text-[20px] leading-snug font-extrabold text-ink sm:text-[22px]">
                  {glance.sentence}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {nextRush !== null && nextRush > 0 && <span className="rounded-full bg-white/80 px-3 py-1.5 text-[12.5px] font-extrabold text-warn">Dinner rush in {nextRush}s</span>}
            {frozen && (
              <span className="flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[12.5px] font-extrabold text-sky">
                <PauseCircle className="size-4" /> Paused for planning
              </span>
            )}
          </div>
        </div>

        <AnimatePresence>
          {previewing && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-grape/10 px-3 py-1.5 text-[13px] font-extrabold text-grape">
                <Eye className="size-4" /> Previewing “{previewLabel}”. Nothing changes until you approve.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:flex xl:items-stretch xl:gap-0">
          {stages.map((s, i) => (
            <div key={s.id} className="contents">
              <StageCard
                s={s}
                index={i}
                dim={!!order && culpritStage !== null && culpritStage !== s.id && s.id !== "orders" && s.id !== "pickup"}
                culprit={culpritStage === s.id}
                onTrace={(id) => trace(tracedId === id ? null : id)}
                tracedId={tracedId}
              />
              {i < stages.length - 1 && <Connector risk={worst(s.risk, stages[i + 1].risk)} paused={paused} />}
            </div>
          ))}
        </div>

        <AnimatePresence>{order && <TraceBar order={order} onClose={() => trace(null)} />}</AnimatePresence>
        {!order && (
          <p className="mt-4 text-center text-[12.5px] font-semibold text-mute">
            Orders move left to right. Glowing stations are where the ripple is hitting. Tap any order to trace what’s slowing it down.
          </p>
        )}
      </div>
    </section>
  );
}
