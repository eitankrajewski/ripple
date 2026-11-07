import clsx from "clsx";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { ArrowRight, Check, ChevronsRight, HandPlatter, LayoutGrid, ShieldAlert } from "lucide-react";
import { useState } from "react";
import type { OrderView, StationId } from "../../engine/types";
import { haptic } from "../../lib/haptics";
import { ROLES } from "../../live/roles";
import { minutes, pct, SOURCE, statusLabel } from "../../lib/ui";
import { useCan, useTwin } from "../../store";
import { DasherChip, Dot, FireChip } from "../kit";
import { NewOrderForm } from "./NewOrderForm";

const DONE_LABEL: Record<StationId, string> = { prep: "Prep done", cook: "Cooked", pack: "Packed" };
const NEXT: Record<StationId, string> = { prep: "Cook", cook: "Pack", pack: "Ready shelf" };

const startsLater = (o: OrderView) => o.status === "queued" && (o.fireInMinutes ?? 0) >= 0.5;

function Items({ o, checklist }: { o: OrderView; checklist?: boolean }) {
  const menu = useTwin((s) => s.kitchen.config.menu);
  const act = useTwin((s) => s.act);
  return (
    <ul className="mt-2 space-y-1">
      {o.items.map((i) => {
        const m = menu.find((x) => x.id === i.menuItemId);
        const packed = o.packed.includes(i.menuItemId);
        if (!checklist)
          return (
            <li key={i.menuItemId} className="flex items-center gap-2 text-[15px] font-semibold">
              <span className="w-7 text-right font-extrabold tabular-nums">{i.qty}×</span>
              {m?.name ?? i.menuItemId}
            </li>
          );
        return (
          <li key={i.menuItemId}>
            <button
              onClick={() => {
                haptic("tick");
                void act({ type: "pack_item", orderId: o.id, menuItemId: i.menuItemId, checked: !packed });
              }}
              className={clsx("flex min-h-11 w-full items-center gap-3 rounded-[10px] border px-3 text-left text-[15px] font-semibold transition-colors", packed ? "border-ok/40 bg-ok/10" : "border-navy/12 bg-white")}
            >
              <span className={clsx("flex size-6 shrink-0 items-center justify-center rounded-[7px] border-2", packed ? "border-ok bg-ok text-white" : "border-navy/25")}>{packed && <Check className="size-4" strokeWidth={3} />}</span>
              <span className="font-extrabold tabular-nums">{i.qty}×</span>
              {m?.name ?? i.menuItemId}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function TicketHead({ o }: { o: OrderView }) {
  return (
    <>
      <div className="flex items-center gap-2">
        <Dot risk={o.risk} pulse />
        <span className="text-[17px] font-extrabold">{o.label}</span>
        <span className="min-w-0 flex-1 truncate font-semibold text-mute">{o.customer}</span>
        <span className={clsx("shrink-0 font-extrabold tabular-nums", o.pickupInMinutes < 0 ? "text-crit" : "text-mute")}>
          {o.pickupInMinutes < 0 ? `${minutes(-o.pickupInMinutes)} late` : `pickup ${minutes(o.pickupInMinutes)}`}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <FireChip o={o} />
        <DasherChip o={o} />
        {!o.dasher && <span className="rounded-full bg-navy/[0.05] px-2 py-0.5 text-[11px] font-bold text-mute">{SOURCE[o.source].label}</span>}
      </div>
    </>
  );
}

/** Ticket you can swipe right (or tap the button) to send to the next station. */
function SwipeTicket({ o, station, primary }: { o: OrderView; station: StationId; primary: boolean }) {
  const act = useTwin((s) => s.act);
  const x = useMotionValue(0);
  const reveal = useTransform(x, [0, 120], [0, 1]);
  const needsPacking = station === "pack" && o.items.some((i) => !o.packed.includes(i.menuItemId));
  const blocked = o.status === "blocked";
  const disabled = blocked || needsPacking;
  const done = () => {
    if (disabled) return haptic("error");
    haptic("success");
    void act({ type: "task_done", orderId: o.id, station });
  };
  return (
    <div className="relative">
      <motion.div style={{ opacity: reveal }} className="absolute inset-0 flex items-center rounded-[12px] bg-ok px-5 font-extrabold text-white">
        <ChevronsRight className="mr-2 size-5" /> {DONE_LABEL[station]}
      </motion.div>
      <motion.div
        drag={disabled ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.6 }}
        style={{ x }}
        onDragEnd={(_, info) => info.offset.x > 110 && done()}
        className={clsx("card relative touch-pan-y bg-white! p-3.5", o.risk === "critical" && "border-crit/40!", o.risk === "warning" && "border-warn/50!")}
      >
        <TicketHead o={o} />
        <Items o={o} checklist={station === "pack"} />
        {o.risk !== "normal" && <p className="mt-2 text-[12px] font-semibold text-mute">{o.reason}</p>}
        <button disabled={disabled} onClick={done} className={clsx("btn mt-3 h-11! w-full text-[15px]", primary && !disabled && "btn-navy")}>
          {blocked ? (
            `Waiting on ${o.blockedBy ?? "stock"}`
          ) : needsPacking ? (
            "Check every item into the bag"
          ) : (
            <>
              <Check className="size-4" strokeWidth={3} /> {DONE_LABEL[station]} <ArrowRight className="size-4 opacity-60" /> {NEXT[station]}
            </>
          )}
        </button>
        {!disabled && <p className="mt-1.5 hidden text-center text-[11px] font-semibold text-faint [@media(pointer:coarse)]:block">or swipe right</p>}
      </motion.div>
    </div>
  );
}

function Column({ title, hint, count, children }: { title: string; hint?: string; count: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col lg:min-h-0">
      <div className="mb-2 flex items-baseline gap-2 px-1">
        <h2 className="text-[15px] font-extrabold">{title}</h2>
        <span className="font-bold text-faint tabular-nums">{count}</span>
        {hint && <span className="ml-auto text-[11.5px] font-semibold text-faint">{hint}</span>}
      </div>
      <div className="scroll-thin space-y-2 pb-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">{children}</div>
    </section>
  );
}

const Empty = ({ text }: { text: string }) => <p className="rounded-[10px] border border-dashed border-navy/15 px-3 py-6 text-center text-mute">{text}</p>;

function Handoff({ o }: { o: OrderView }) {
  const act = useTwin((s) => s.act);
  const canPickUp = useCan("pick_up");
  const [checking, setChecking] = useState(false);
  const who = o.dasher?.name ?? o.customer;
  return (
    <div className="card bg-white! p-3.5">
      <TicketHead o={o} />
      <Items o={o} />
      {canPickUp &&
        (checking ? (
          <div className="mt-3 rounded-[10px] bg-navy/[0.05] p-3">
            <div className="text-[12px] font-bold text-mute">Ask for the name and code</div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="text-[16px] font-extrabold">{who}</span>
              <span className="font-mono text-[22px] font-extrabold tracking-[0.2em]">{o.code}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                className="btn h-11! border-crit/30! text-crit"
                onClick={() => {
                  haptic("error");
                  setChecking(false);
                  void act({ type: "handoff_mismatch", orderId: o.id });
                }}
              >
                <ShieldAlert className="size-4" /> Doesn't match
              </button>
              <button
                className="btn btn-navy h-11!"
                onClick={() => {
                  haptic("success");
                  void act({ type: "picked_up", orderId: o.id });
                }}
              >
                <Check className="size-4" strokeWidth={3} /> Matches, hand off
              </button>
            </div>
          </div>
        ) : (
          <button className="btn mt-3 h-11! w-full" onClick={() => setChecking(true)}>
            <HandPlatter className="size-4" /> Hand off to {who}
          </button>
        ))}
    </div>
  );
}

function ReadyShelf({ orders }: { orders: OrderView[] }) {
  return (
    <Column title="Ready shelf" hint="check name + code" count={orders.length}>
      {orders.length === 0 && <Empty text="Nothing waiting for pickup." />}
      {orders.map((o) => (
        <Handoff key={o.id} o={o} />
      ))}
    </Column>
  );
}

const byFire = (a: OrderView, b: OrderView) => Number(a.status === "queued") - Number(b.status === "queued") || (a.fireInMinutes ?? 0) - (b.fireInMinutes ?? 0) || a.pickupInMinutes - b.pickupInMinutes;

/** Focused, phone- and tablet-friendly screen for a station device. */
export function StationScreen() {
  const session = useTwin((s) => s.live.session);
  const state = useTwin((s) => s.state);
  const setLiveView = useTwin((s) => s.setLiveView);
  const act = useTwin((s) => s.act);
  if (!session) return null;
  const role = ROLES[session.me.role];
  const station = role.station;
  const ready = state.orders.filter((o) => o.status === "ready");

  if (!station) {
    const inKitchen = state.orders.filter((o) => o.status !== "ready");
    return (
      <div className="h-full overflow-y-auto p-3 sm:p-4 lg:overflow-hidden">
        <div className="grid gap-4 lg:h-full lg:grid-cols-[340px_1fr_1fr]">
          <section className="card h-fit p-4">
            <NewOrderForm />
          </section>
          <Column title="In the kitchen" count={inKitchen.length}>
            {inKitchen.map((o) => (
              <div key={o.id} className="card flex items-center gap-2 px-3 py-2.5">
                <Dot risk={o.risk} />
                <span className="font-extrabold">{o.label}</span>
                <span className="truncate text-mute">{o.customer}</span>
                <span className="ml-auto shrink-0 rounded-full bg-navy/[0.06] px-2 py-0.5 text-[11.5px] font-bold">{statusLabel(o)}</span>
              </div>
            ))}
          </Column>
          <ReadyShelf orders={ready} />
        </div>
      </div>
    );
  }

  const s = state.stations.find((x) => x.id === station);
  let now: OrderView[];
  let later: OrderView[];
  let laterTitle: string;
  if (station === "prep") {
    const atPrep = state.orders.filter((o) => ["queued", "prepping", "blocked"].includes(o.status));
    now = atPrep.filter((o) => !startsLater(o)).sort(byFire);
    later = [...atPrep.filter(startsLater), ...state.orders.filter((o) => o.status === "held" || o.status === "deferred")].sort(byFire);
    laterTitle = "Start later";
  } else {
    now = state.orders.filter((o) => o.status === (station === "cook" ? "cooking" : "packing")).sort(byFire);
    const upstream = station === "cook" ? ["queued", "prepping", "blocked"] : ["queued", "prepping", "cooking", "blocked"];
    later = state.orders.filter((o) => upstream.includes(o.status)).sort(byFire);
    laterTitle = "Coming up";
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-3 sm:p-4 lg:overflow-hidden">
      <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div>
          <div className="section-label uppercase">My station</div>
          <div className="text-[24px] leading-tight font-extrabold tracking-tight">{s?.name ?? station}</div>
        </div>
        {s && (
          <div className="flex gap-5 text-[12px] font-semibold text-mute">
            <span>
              <b className={clsx("block text-[18px] tabular-nums", s.utilization > 1 ? "text-crit" : "text-ink")}>{pct(s.utilization)}</b>load
            </span>
            <span>
              <b className="block text-[18px] text-ink tabular-nums">{Math.round(s.queuedMinutes)}m</b>queued
            </span>
            <span>
              <b className="block text-[18px] text-ink tabular-nums">{s.staff}</b>staff
            </span>
          </div>
        )}
        <button className="btn ml-auto" onClick={() => setLiveView("kitchen")}>
          <LayoutGrid className="size-4" /> Whole kitchen
        </button>
      </div>
      <div className={clsx("grid gap-4 lg:min-h-0 lg:flex-1", station === "pack" ? "lg:grid-cols-[1.3fr_1fr_1fr]" : "lg:grid-cols-[1.6fr_1fr]")}>
        <Column title={station === "prep" ? "Start now" : `Now at ${s?.name ?? station}`} hint={station === "prep" ? "timed to each pickup" : undefined} count={now.length}>
          {now.length === 0 && <Empty text={station === "prep" && later.length ? "Nothing to start yet. Tickets move here when it's time to fire them." : "All caught up. New tickets appear here as soon as they reach you."} />}
          {now.map((o, i) => (
            <SwipeTicket key={o.id} o={o} station={station} primary={i === 0} />
          ))}
        </Column>
        <Column title={laterTitle} count={later.length}>
          {later.length === 0 && <Empty text="Nothing waiting." />}
          {later.map((o) => (
            <div key={o.id} className="card px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Dot risk={o.risk} />
                <span className="font-extrabold">{o.label}</span>
                <span className="min-w-0 flex-1 truncate text-mute">{o.itemsText}</span>
                {station === "prep" && startsLater(o) ? <FireChip o={o} /> : <span className="shrink-0 text-[11.5px] font-bold text-mute">{statusLabel(o)}</span>}
              </div>
              {(o.dasher || (station === "prep" && startsLater(o))) && (
                <div className="mt-1.5 flex items-center gap-2">
                  <DasherChip o={o} />
                  {station === "prep" && startsLater(o) && (
                    <button className="btn ml-auto h-8!" onClick={() => void act({ type: "task_done", orderId: o.id, station: "prep" })}>
                      Prep done early
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </Column>
        {station === "pack" && <ReadyShelf orders={ready} />}
      </div>
    </div>
  );
}
