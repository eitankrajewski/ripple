import clsx from "clsx";
import { GripVertical, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import type { OrderView } from "../engine/types";
import { DROP_LABEL, stageOf, startOrderDrag, useDrag, type DropTarget } from "../lib/drag";
import { minutes, pct, SOURCE } from "../lib/ui";
import { useCan, useTwin } from "../store";
import { DasherChip, Dot, FireChip } from "./kit";

const COLUMNS: DropTarget[] = ["prep", "cook", "pack", "ready"];

function MoveMenu({ o, onMove }: { o: OrderView; onMove: (to: DropTarget) => void }) {
  const [open, setOpen] = useState(false);
  const here = stageOf(o);
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button className="tbtn h-7! min-w-7! p-0!" onClick={() => setOpen((v) => !v)} aria-label={`Move ${o.label}`}>
        <MoreHorizontal className="size-4 text-mute" />
      </button>
      {open && (
        <div className="absolute top-8 right-0 z-30 w-40 rounded-[10px] border border-navy/10 bg-white p-1 shadow-lg">
          <div className="px-2 py-1 text-[11px] font-bold text-faint">Move to</div>
          {COLUMNS.map((c) => (
            <button key={c} disabled={c === here} onClick={() => (onMove(c), setOpen(false))} className="block w-full rounded-[7px] px-2 py-1.5 text-left font-bold hover:bg-navy/[0.05] disabled:text-faint">
              {DROP_LABEL[c]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Card({ o, canMove }: { o: OrderView; canMove: boolean }) {
  const { act, trace } = useTwin.getState();
  const dragging = useDrag((s) => s.order?.id === o.id);
  const traced = useTwin((s) => s.tracedOrderId === o.id);
  const move = (to: DropTarget) => void act({ type: "move_order", orderId: o.id, to });
  return (
    <div
      onPointerDown={canMove ? (e) => startOrderDrag(e, o, move) : undefined}
      onClick={() => trace(traced ? null : o.id)}
      className={clsx(
        "card group relative cursor-pointer p-2.5 transition-all select-none",
        canMove && "cursor-grab active:cursor-grabbing",
        dragging && "opacity-40",
        traced && "ring-2 ring-accent",
        o.risk === "critical" && "border-crit/35!",
      )}
    >
      <div className="flex items-center gap-1.5">
        {canMove && (
          <span className="-ml-1 flex size-6 touch-none items-center justify-center rounded-[6px] text-faint group-hover:text-mute" aria-hidden>
            <GripVertical className="size-4" />
          </span>
        )}
        <Dot risk={o.risk} pulse />
        <span className="font-extrabold">{o.label}</span>
        <span className="min-w-0 flex-1 truncate text-mute">{o.customer}</span>
        {canMove && <MoveMenu o={o} onMove={move} />}
      </div>
      <div className="mt-1 truncate text-[12px] font-semibold">{o.itemsText}</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <FireChip o={o} />
        <DasherChip o={o} />
        {!o.dasher && <span className="rounded-full bg-navy/[0.05] px-2 py-0.5 text-[11px] font-bold text-mute">{SOURCE[o.source].label}</span>}
        <span className={clsx("ml-auto text-[11px] font-bold tabular-nums", o.pickupInMinutes < 0 ? "text-crit" : "text-faint")}>
          {o.pickupInMinutes < 0 ? `${minutes(-o.pickupInMinutes)} late` : `pickup ${minutes(o.pickupInMinutes)}`}
        </span>
      </div>
      {o.status === "blocked" && <p className="mt-1 text-[11.5px] font-semibold text-crit">{o.reason}</p>}
    </div>
  );
}

/** Kanban of the line. Managers drag tickets (or use the ··· menu on touch) to any station. */
export function BoardView({ insets }: { insets: { left: number; right: number } }) {
  const state = useTwin((s) => s.state);
  const canMove = useCan("move_orders");
  const over = useDrag((s) => s.over);
  const dragging = useDrag((s) => !!s.order);
  const held = state.orders.filter((o) => stageOf(o) === null);
  const stations = Object.fromEntries(state.stations.map((s) => [s.id, s]));
  return (
    <div
      className="scroll-thin flex h-full snap-x snap-mandatory gap-3 overflow-x-auto px-3 pt-3 pb-24 lg:pt-[64px] lg:pb-12"
      style={insets.left || insets.right ? { paddingLeft: insets.left + 12, paddingRight: insets.right + 12 } : undefined}
    >
      {held.length > 0 && (
        <section className="flex w-[78vw] max-w-[280px] shrink-0 snap-start flex-col sm:w-[260px]">
          <h2 className="mb-2 flex items-baseline gap-2 px-1 font-extrabold">
            On hold <span className="font-bold text-faint">{held.length}</span>
          </h2>
          <div className="space-y-2">
            {held.map((o) => (
              <Card key={o.id} o={o} canMove={canMove} />
            ))}
          </div>
        </section>
      )}
      {COLUMNS.map((c) => {
        const orders = state.orders.filter((o) => stageOf(o) === c);
        const st = c === "ready" ? null : stations[c];
        return (
          <section
            key={c}
            data-drop={c}
            className={clsx(
              "flex min-h-[200px] w-[78vw] max-w-[320px] min-w-0 shrink-0 snap-start flex-col rounded-[14px] p-2 transition-colors sm:w-auto sm:flex-1",
              dragging ? "border-2 border-dashed border-navy/15" : "border-2 border-transparent",
              over === c && "border-accent! bg-accent/[0.06]",
            )}
          >
            <h2 className="mb-2 flex items-baseline gap-2 px-1">
              <span className="text-[14px] font-extrabold">{DROP_LABEL[c]}</span>
              <span className="font-bold text-faint">{orders.length}</span>
              {st && <span className={clsx("ml-auto text-[11.5px] font-bold tabular-nums", st.utilization > 1 ? "text-crit" : "text-mute")}>{pct(st.utilization)} load</span>}
            </h2>
            <div className="scroll-thin min-h-0 flex-1 space-y-2 overflow-y-auto">
              {orders.length === 0 && <p className="rounded-[10px] border border-dashed border-navy/12 px-3 py-5 text-center text-[12px] text-faint">{canMove ? "Drop an order here" : "Empty"}</p>}
              {orders.map((o) => (
                <Card key={o.id} o={o} canMove={canMove} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
