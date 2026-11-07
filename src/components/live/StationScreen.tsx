import clsx from "clsx";
import { ArrowRight, Check, HandPlatter, LayoutGrid } from "lucide-react";
import type { OrderView, StationId } from "../../engine/types";
import { ROLES } from "../../live/roles";
import { minutes, pct, SOURCE, statusLabel } from "../../lib/ui";
import { useCan, useTwin } from "../../store";
import { Dot } from "../kit";
import { NewOrderForm } from "./NewOrderForm";

const AT: Record<StationId, OrderView["status"][]> = {
  prep: ["queued", "prepping", "blocked"],
  cook: ["cooking"],
  pack: ["packing"],
};
const UPSTREAM: Record<StationId, OrderView["status"][]> = {
  prep: ["held", "deferred"],
  cook: ["queued", "prepping", "blocked"],
  pack: ["queued", "prepping", "cooking", "blocked"],
};
const DONE_LABEL: Record<StationId, string> = { prep: "Prep done", cook: "Cooked", pack: "Packed" };
const NEXT: Record<StationId, string> = { prep: "Cook", cook: "Pack", pack: "Ready shelf" };

function Items({ o }: { o: OrderView }) {
  const menu = useTwin((s) => s.kitchen.config.menu);
  return (
    <ul className="mt-2 space-y-0.5">
      {o.items.map((i) => {
        const m = menu.find((x) => x.id === i.menuItemId);
        return (
          <li key={i.menuItemId} className="flex items-center gap-2 text-[14px] font-semibold">
            <span className="w-6 text-right font-extrabold tabular-nums">{i.qty}×</span>
            {m?.name ?? i.menuItemId}
          </li>
        );
      })}
    </ul>
  );
}

function Ticket({ o, children }: { o: OrderView; children?: React.ReactNode }) {
  return (
    <div className={clsx("card p-3.5", o.risk === "critical" && "border-crit/40!", o.risk === "warning" && "border-warn/50!")}>
      <div className="flex items-center gap-2">
        <Dot risk={o.risk} pulse />
        <span className="text-[16px] font-extrabold">{o.label}</span>
        <span className="truncate font-semibold text-mute">
          {o.customer} · {SOURCE[o.source].label}
        </span>
        <span className={clsx("ml-auto shrink-0 font-extrabold tabular-nums", o.pickupInMinutes < 0 ? "text-crit" : "text-mute")}>
          {o.pickupInMinutes < 0 ? `${minutes(-o.pickupInMinutes)} late` : `pickup in ${minutes(o.pickupInMinutes)}`}
        </span>
      </div>
      <Items o={o} />
      {o.risk !== "normal" && <p className="mt-2 text-[12px] font-semibold text-mute">{o.reason}</p>}
      {children}
    </div>
  );
}

function Column({ title, count, children, className }: { title: string; count: number; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx("flex min-h-0 flex-col", className)}>
      <div className="mb-2 flex items-baseline gap-2 px-1">
        <h2 className="text-[15px] font-extrabold">{title}</h2>
        <span className="font-bold text-faint tabular-nums">{count}</span>
      </div>
      <div className="scroll-thin min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 pb-4">{children}</div>
    </section>
  );
}

const Empty = ({ text }: { text: string }) => <p className="rounded-[10px] border border-dashed border-navy/15 px-3 py-6 text-center text-mute">{text}</p>;

function ReadyShelf({ orders }: { orders: OrderView[] }) {
  const liveDo = useTwin((s) => s.liveDo);
  const canPickUp = useCan("pick_up");
  return (
    <Column title="Ready shelf" count={orders.length}>
      {orders.length === 0 && <Empty text="Nothing waiting for pickup." />}
      {orders.map((o) => (
        <Ticket key={o.id} o={o}>
          {canPickUp && (
            <button className="btn mt-3 h-9! w-full" onClick={() => void liveDo({ type: "picked_up", orderId: o.id })}>
              <HandPlatter className="size-4" /> Handed to {o.customer}
            </button>
          )}
        </Ticket>
      ))}
    </Column>
  );
}

/** Focused, tablet-sized screen for a station device: today's tickets and one big check-off button each. */
export function StationScreen() {
  const session = useTwin((s) => s.live.session);
  const state = useTwin((s) => s.state);
  const { liveDo, setLiveView } = useTwin.getState();
  if (!session) return null;
  const role = ROLES[session.me.role];
  const station = role.station;
  const ready = state.orders.filter((o) => o.status === "ready");

  if (!station) {
    return (
      <div className="grid h-full gap-4 overflow-hidden p-4 lg:grid-cols-[340px_1fr_1fr]">
        <section className="card h-fit p-4">
          <NewOrderForm />
        </section>
        <Column title="In the kitchen" count={state.orders.filter((o) => o.status !== "ready").length}>
          {state.orders
            .filter((o) => o.status !== "ready")
            .map((o) => (
              <div key={o.id} className="card flex items-center gap-2 px-3 py-2">
                <Dot risk={o.risk} />
                <span className="font-extrabold">{o.label}</span>
                <span className="truncate text-mute">{o.customer}</span>
                <span className="ml-auto shrink-0 rounded-full bg-navy/[0.06] px-2 py-0.5 text-[11.5px] font-bold">{statusLabel(o)}</span>
              </div>
            ))}
        </Column>
        <ReadyShelf orders={ready} />
      </div>
    );
  }

  const s = state.stations.find((x) => x.id === station);
  const now = state.orders.filter((o) => AT[station].includes(o.status));
  const next = state.orders.filter((o) => UPSTREAM[station].includes(o.status));

  return (
    <div className="flex h-full flex-col overflow-hidden p-4">
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div>
          <div className="section-label uppercase">My station</div>
          <div className="text-[24px] font-extrabold tracking-tight">{s?.name ?? station}</div>
        </div>
        {s && (
          <div className="flex gap-5 text-[12px] font-semibold text-mute">
            <span>
              <b className="block text-[18px] text-ink tabular-nums">{pct(s.utilization)}</b>load
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
      <div className={clsx("grid min-h-0 flex-1 gap-4", station === "pack" ? "lg:grid-cols-[1.3fr_1fr_1fr]" : "lg:grid-cols-[1.6fr_1fr]")}>
        <Column title={`Now at ${s?.name ?? station}`} count={now.length}>
          {now.length === 0 && <Empty text="All caught up. New tickets appear here as soon as they reach you." />}
          {now.map((o, i) => (
            <Ticket key={o.id} o={o}>
              <button
                disabled={o.status === "blocked"}
                onClick={() => void liveDo({ type: "task_done", orderId: o.id, station })}
                className={clsx("btn mt-3 h-10! w-full text-[14px]", i === 0 && o.status !== "blocked" && "btn-navy")}
              >
                {o.status === "blocked" ? (
                  `Waiting on ${o.blockedBy ?? "stock"}`
                ) : (
                  <>
                    <Check className="size-4" strokeWidth={3} /> {DONE_LABEL[station]} <ArrowRight className="size-4 opacity-60" /> {NEXT[station]}
                  </>
                )}
              </button>
            </Ticket>
          ))}
        </Column>
        <Column title="Coming up" count={next.length}>
          {next.length === 0 && <Empty text="Nothing upstream." />}
          {next.map((o) => (
            <div key={o.id} className="card flex items-center gap-2 px-3 py-2">
              <Dot risk={o.risk} />
              <span className="font-extrabold">{o.label}</span>
              <span className="truncate text-mute">{o.itemsText}</span>
              <span className="ml-auto shrink-0 text-[11.5px] font-bold text-mute">{statusLabel(o)}</span>
            </div>
          ))}
        </Column>
        {station === "pack" && <ReadyShelf orders={ready} />}
      </div>
    </div>
  );
}
