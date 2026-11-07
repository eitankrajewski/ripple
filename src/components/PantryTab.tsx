import clsx from "clsx";
import { Check, Pencil } from "lucide-react";
import { useState } from "react";
import type { InventoryView } from "../engine/types";
import { RISK_HEX } from "../lib/ui";
import { useTwin } from "../store";

function Row({ i }: { i: InventoryView }) {
  const correct = useTwin((s) => s.correctStock);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(i.onHand));
  const ratio = i.need === 0 ? 0 : Math.min(1, i.need / Math.max(1, i.onHand));
  const save = () => {
    const n = Number(val);
    if (Number.isFinite(n) && n >= 0) correct(i.id, n);
    setEditing(false);
  };
  return (
    <div className={clsx("frost rounded-[18px] px-3.5 py-2.5", i.short && "ring-2 ring-crit/50")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-black text-ink">{i.name}</span>
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="flex items-center gap-1"
          >
            <input autoFocus type="number" min={0} value={val} onChange={(e) => setVal(e.target.value)} onBlur={save} className="w-16 rounded-full bg-white px-2 py-0.5 text-right text-[13px] font-black outline-none ring-2 ring-sky" />
            <button type="submit" className="rounded-full bg-sky p-1 text-white" aria-label="Save">
              <Check className="size-3.5" />
            </button>
          </form>
        ) : (
          <button
            onClick={() => {
              setVal(String(i.onHand));
              setEditing(true);
            }}
            className="group flex items-center gap-1.5 text-[13px] font-black tabular-nums"
            title="Recount stock"
          >
            <span style={{ color: RISK_HEX[i.risk] }}>{i.onHand}</span>
            <span className="text-mute">/ {i.need} needed</span>
            <Pencil className="size-3.5 text-mute group-hover:text-sky" />
          </button>
        )}
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/[0.06]">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(4, ratio * 100)}%`, background: RISK_HEX[i.risk] }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] font-bold text-mute">
        <span>{i.unit}</span>
        <span>{i.short ? `Short by ${i.need - i.onHand}` : i.freshnessMinutes <= 90 ? `Use within ${i.freshnessMinutes} min` : "Plenty"}</span>
      </div>
    </div>
  );
}

export function PantryTab() {
  const inv = useTwin((s) => s.state.inventory);
  const sorted = [...inv].sort((a, b) => Number(b.short) - Number(a.short) || b.need / Math.max(1, b.onHand) - a.need / Math.max(1, a.onHand));
  return (
    <div className="space-y-2">
      <p className="px-1 text-[13px] font-semibold text-mute">On hand vs. needed for open tickets. Tap a number to recount; the twin re-plans instantly.</p>
      {sorted.map((i) => (
        <Row key={i.id} i={i} />
      ))}
    </div>
  );
}
