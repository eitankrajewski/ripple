import { useState } from "react";
import type { StationId } from "../engine/types";
import { haptic } from "../lib/haptics";
import { pct } from "../lib/ui";
import { useCan, useTwin } from "../store";

/** What a manager can do when a station is over 100%: move a person, hold an order, or cancel one. */
export function StationFix({ station, compact }: { station: StationId; compact?: boolean }) {
  const stations = useTwin((s) => s.state.stations);
  const orders = useTwin((s) => s.state.orders);
  const act = useTwin((s) => s.act);
  const canStaff = useCan("manage_team");
  const canHold = useCan("hold_orders");
  const [confirm, setConfirm] = useState(false);
  const s = stations.find((x) => x.id === station);
  if (!s || s.utilization <= 1) return null;
  const donor = stations.filter((x) => x.id !== station && x.staff > 1 && x.utilization < 0.8).sort((a, b) => a.utilization - b.utilization)[0];
  const order = orders.filter((o) => o.status === "queued" && !o.isRush).sort((a, b) => b.pickupInMinutes - a.pickupInMinutes)[0];
  const message = order ? `Hi ${order.customer}, sorry, our kitchen is backed up and we can't make order ${order.label} on time, so we've cancelled it.` : "";
  return (
    <div className={compact ? "space-y-1.5" : "card space-y-2 p-3"}>
      {!compact && (
        <div className="text-[12.5px] font-bold">
          {s.name} is at {pct(s.utilization)}. Options:
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {canStaff &&
          (donor ? (
            <button
              className="btn btn-navy"
              onClick={() => {
                haptic("drop");
                void act({ type: "staff_moved", from: donor.id, to: s.id });
              }}
            >
              Move 1 person from {donor.name}
            </button>
          ) : (
            <span className="self-center text-[12px] text-mute">No spare staff on other stations; call someone in.</span>
          ))}
        {canHold && order && !confirm && (
          <>
            <button
              className="btn"
              onClick={() => {
                haptic("tick");
                void act({ type: "hold_order", orderId: order.id });
              }}
            >
              Hold {order.label}
            </button>
            <button className="btn" onClick={() => setConfirm(true)}>
              Cancel {order.label}…
            </button>
          </>
        )}
      </div>
      {confirm && order && (
        <div className="space-y-1.5 rounded-[10px] bg-crit/6 p-2.5">
          <div className="text-[12px] font-bold">Cancel {order.label} for {order.customer}? Send them this:</div>
          <p className="rounded-[8px] bg-white p-2 text-[12px] text-mute shadow-[0_1px_2px_rgba(16,24,40,0.06)]">{message}</p>
          {order.source === "doordash" && <p className="text-[11.5px] text-mute">Also cancel it on the DoorDash tablet so the Dasher isn't sent.</p>}
          <div className="flex flex-wrap gap-1.5">
            <button className="btn" onClick={() => void navigator.clipboard?.writeText(message)}>
              Copy message
            </button>
            <button
              className="btn btn-crit"
              onClick={() => {
                haptic("drop");
                void act({ type: "cancel_order", orderId: order.id });
                setConfirm(false);
              }}
            >
              Cancel order
            </button>
            <button className="btn" onClick={() => setConfirm(false)}>
              Keep it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
