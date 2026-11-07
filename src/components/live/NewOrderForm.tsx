import clsx from "clsx";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import type { OrderItem, OrderSource } from "../../engine/types";
import { SOURCE } from "../../lib/ui";
import { useTwin } from "../../store";

/** Front-of-house order entry. Publishes an order_received event to every device. */
export function NewOrderForm({ onDone }: { onDone?: () => void }) {
  const menu = useTwin((s) => s.kitchen.config.menu);
  const liveDo = useTwin((s) => s.liveDo);
  const [source, setSource] = useState<OrderSource>("walk_in");
  const [customer, setCustomer] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const items: OrderItem[] = Object.entries(qty)
    .filter(([, q]) => q > 0)
    .map(([menuItemId, q]) => ({ menuItemId, qty: q }));
  const bump = (id: string, d: number) => setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(20, (q[id] ?? 0) + d)) }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!items.length) return;
    const ok = await liveDo({ type: "order_received", source, customer: customer.trim() || "Guest", items });
    if (ok) {
      setQty({});
      setCustomer("");
      onDone?.();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="font-extrabold">New order</div>
      <div className="flex rounded-[8px] bg-navy/[0.06] p-0.5">
        {(Object.keys(SOURCE) as OrderSource[]).map((s) => (
          <button type="button" key={s} onClick={() => setSource(s)} className={clsx("h-7 flex-1 rounded-[6px] text-[12px] font-bold", source === s ? "bg-white shadow-sm" : "text-mute")}>
            {SOURCE[s].label}
          </button>
        ))}
      </div>
      <input className="field" placeholder="Customer name (optional)" value={customer} onChange={(e) => setCustomer(e.target.value)} />
      <div className="space-y-1">
        {menu.map((m) => (
          <div key={m.id} className="flex items-center gap-2 rounded-[8px] px-1 py-1">
            <span className="flex-1 font-semibold">{m.name}</span>
            <button type="button" className="tbtn h-6! min-w-6! p-0!" onClick={() => bump(m.id, -1)} aria-label={`Fewer ${m.name}`}>
              <Minus className="size-3.5" />
            </button>
            <span className="w-5 text-center font-extrabold tabular-nums">{qty[m.id] ?? 0}</span>
            <button type="button" className="tbtn h-6! min-w-6! p-0!" onClick={() => bump(m.id, 1)} aria-label={`More ${m.name}`}>
              <Plus className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button type="submit" disabled={!items.length} className="btn btn-navy h-8! w-full">
        Send to kitchen
      </button>
    </form>
  );
}
