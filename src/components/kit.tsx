import clsx from "clsx";
import { Check, Loader2, Pencil, Sparkles, Trash2 } from "lucide-react";
import { useState, type ComponentType, type ReactNode } from "react";
import type { Explanation, InventoryView, OrderView, RiskLevel } from "../engine/types";
import { minutes, RISK_HEX, RISK_LABEL, statusLabel } from "../lib/ui";
import { startOrderDrag, useDrag } from "../lib/drag";
import { useCan, useTwin } from "../store";

export function Dot({ risk, pulse, className }: { risk: RiskLevel; pulse?: boolean; className?: string }) {
  return <span className={clsx("inline-block size-2 shrink-0 rounded-full", pulse && risk === "critical" && "pulse-dot", className)} style={{ background: RISK_HEX[risk] }} />;
}

export function RiskChip({ risk, label }: { risk: RiskLevel; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-navy/[0.05] px-2 py-0.5 text-[11.5px] font-bold text-ink">
      <Dot risk={risk} />
      {label ?? RISK_LABEL[risk]}
    </span>
  );
}

export function SimBadge() {
  const live = useTwin((s) => s.mode === "live");
  if (live) return <span className="rounded-full bg-ok/12 px-2 py-0.5 text-[10.5px] font-bold text-[#1f8a3a]">Live</span>;
  return <span className="rounded-full bg-navy/[0.05] px-2 py-0.5 text-[10.5px] font-bold text-mute">Simulated</span>;
}

export interface IconTab<T extends string> {
  id: T;
  icon: ComponentType<{ className?: string }>;
  label: string;
  badge?: number;
}

/* Xcode-style navigator selector: icons in a capsule, the active one filled. */
export function IconTabs<T extends string>({ tabs, value, onChange }: { tabs: IconTab<T>[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="flex items-center justify-between rounded-full bg-navy/[0.05] p-1">
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            title={t.label}
            aria-label={t.label}
            className={clsx("relative flex h-8 flex-1 items-center justify-center rounded-full transition-colors", on ? "bg-navy text-white shadow-sm" : "text-mute hover:text-ink")}
          >
            <t.icon className="size-[17px]" />
            {!!t.badge && <span className="absolute top-0.5 right-[18%] min-w-3.5 rounded-full bg-crit px-1 text-[9.5px] leading-3.5 font-extrabold text-white">{t.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Section({ title, right, children, className }: { title: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("space-y-1.5", className)}>
      <div className="flex items-center justify-between px-0.5">
        <h4 className="section-label">{title}</h4>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, before, format = String, lowerBetter = true }: { label: string; value: number; before?: number; format?: (n: number) => string; lowerBetter?: boolean }) {
  const d = before === undefined ? 0 : value - before;
  const better = lowerBetter ? d < 0 : d > 0;
  return (
    <div className="card px-2 py-1.5 text-center">
      <div className="text-[16px] leading-tight font-extrabold tabular-nums">{format(value)}</div>
      <div className="text-[11px] font-semibold text-mute">{label}</div>
      {before !== undefined && Math.abs(d) > 0.004 && (
        <div className={clsx("text-[10.5px] font-bold", better ? "text-ok" : "text-crit")}>
          {better ? "↓" : "↑"} {format(Math.abs(d))}
        </div>
      )}
    </div>
  );
}

export function LoadBar({ value, before }: { value: number; before?: number }) {
  const c = value > 1 ? RISK_HEX.critical : value >= 0.85 ? RISK_HEX.warning : "#1d1d1f";
  return (
    <div className="relative h-1.5 overflow-hidden rounded-full bg-navy/[0.07]">
      {before !== undefined && <div className="absolute inset-y-0 left-0 rounded-full bg-navy/10" style={{ width: `${Math.min(100, before * 100)}%` }} />}
      <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, value * 100)}%`, background: c }} />
    </div>
  );
}

export function Wording({ e, loading, onRephrase }: { e: Explanation; loading: boolean; onRephrase: () => void }) {
  return (
    <div className="card space-y-1.5 p-3">
      <div className="flex items-center justify-between">
        <span className="section-label">Explanation</span>
        <span className="text-[10.5px] font-semibold text-faint">{e.source === "gemini" ? "Worded by Gemini" : "Deterministic"}</span>
      </div>
      <p className="font-extrabold">{e.headline}</p>
      <p className="text-mute">{e.causeChain}</p>
      <p>{e.recommendationReason}</p>
      <p>
        <span className="font-bold">Trade-off:</span> {e.tradeoff}
      </p>
      {e.aiNote && <p className="rounded-[8px] bg-warn/10 px-2 py-1.5 text-[12px] text-mute">{e.aiNote}</p>}
      <button onClick={onRephrase} disabled={loading} className="btn mt-1 text-ai">
        {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} {loading ? "Rewording…" : e.source === "gemini" ? "Reword again" : "Rephrase with AI"}
      </button>
    </div>
  );
}


export function OrderRow({ o, compact }: { o: OrderView; compact?: boolean }) {
  const traced = useTwin((s) => s.tracedOrderId === o.id);
  const { trace, release, cancel } = useTwin.getState();
  const canHold = useCan("hold_orders");
  const canMove = useCan("move_orders");
  const dragging = useDrag((s) => s.order?.id === o.id);
  const held = (o.status === "held" || o.status === "deferred") && canHold;
  return (
    <div
      onClick={() => trace(traced ? null : o.id)}
      onPointerDown={canMove && o.status !== "ready" ? (e) => startOrderDrag(e, o, (to) => void useTwin.getState().act({ type: "move_order", orderId: o.id, to })) : undefined}
      title={canMove ? "Click to trace · drag onto a station to move it" : undefined}
      className={clsx("cursor-pointer rounded-[8px] px-2 py-1.5 transition-colors select-none", traced ? "bg-navy text-white" : "hover:bg-navy/[0.04]", dragging && "opacity-40")}
    >
      <div className="flex items-center gap-2">
        <Dot risk={o.risk} className={traced ? "ring-2 ring-white" : undefined} />
        <span className="font-extrabold">{o.label}</span>
        <span className={clsx("min-w-0 flex-1 truncate", traced ? "text-white/80" : "text-mute")}>{compact ? o.customer : o.itemsText}</span>
        <span className={clsx("shrink-0 text-[11.5px] font-semibold tabular-nums", traced ? "text-white/80" : "text-mute")}>
          {o.risk === "normal" ? statusLabel(o) : RISK_LABEL[o.risk]}
        </span>
      </div>
      {!compact && (
        <div className={clsx("mt-0.5 flex justify-between pl-4 text-[11.5px]", traced ? "text-white/75" : "text-faint")}>
          <span>
            {o.customer} · pickup {o.pickupInMinutes > 0 ? `in ${minutes(o.pickupInMinutes)}` : "now"}
          </span>
          <span>{o.projectedReadyInMinutes === null ? "can't start" : o.status === "ready" ? "ready" : `ready ~${minutes(o.projectedReadyInMinutes)}`}</span>
        </div>
      )}
      {held && (
        <div className="mt-1.5 flex gap-1.5 pl-4" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => release(o.id)} className="btn h-6! text-[12px]">
            Release
          </button>
          <button onClick={() => cancel(o.id)} className="btn h-6! text-[12px] text-crit">
            Cancel & notify
          </button>
        </div>
      )}
    </div>
  );
}

/** Trash icon that asks once more before removing. */
export function RemoveButton({ label, onRemove }: { label: string; onRemove: () => void }) {
  const [ask, setAsk] = useState(false);
  if (ask)
    return (
      <span className="flex shrink-0 items-center gap-1" onMouseLeave={() => setAsk(false)}>
        <button className="rounded-[6px] bg-crit px-1.5 py-0.5 text-[11px] font-bold text-white" onClick={onRemove}>
          Remove
        </button>
        <button className="rounded-[6px] px-1 py-0.5 text-[11px] font-bold text-mute hover:bg-navy/[0.06]" onClick={() => setAsk(false)}>
          Keep
        </button>
      </span>
    );
  return (
    <button className="shrink-0 rounded-[6px] p-1 text-faint hover:bg-crit/10 hover:text-crit" onClick={() => setAsk(true)} title={`Remove ${label}`} aria-label={`Remove ${label}`}>
      <Trash2 className="size-3.5" />
    </button>
  );
}

export function PantryRow({ i }: { i: InventoryView }) {
  const correct = useTwin((s) => s.correctStock);
  const canEdit = useCan("correct_stock");
  const canRemove = useCan("manage_menu");
  const act = useTwin((s) => s.act);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(i.onHand));
  const ratio = i.need === 0 ? 0 : Math.min(1, i.need / Math.max(1, i.onHand));
  const save = () => {
    const n = Number(val);
    if (Number.isFinite(n) && n >= 0) correct(i.id, n);
    setEditing(false);
  };
  return (
    <div className="rounded-[8px] px-2 py-1.5 hover:bg-navy/[0.03]">
      <div className="flex items-center gap-2">
        <Dot risk={i.risk} />
        <span className="flex-1 truncate font-bold">{i.name}</span>
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="flex items-center gap-1"
          >
            <input autoFocus type="number" min={0} value={val} onChange={(e) => setVal(e.target.value)} onBlur={save} className="h-6 w-14 rounded-[6px] border border-accent bg-white px-1.5 text-right font-bold outline-none" />
            <button type="submit" className="rounded-[6px] bg-accent p-1 text-white" aria-label="Save">
              <Check className="size-3" />
            </button>
          </form>
        ) : (
          <button
            disabled={!canEdit}
            onClick={() => {
              setVal(String(i.onHand));
              setEditing(true);
            }}
            className="group flex items-center gap-1 font-bold tabular-nums disabled:cursor-default"
            title={canEdit ? "Recount stock" : "Only managers and prep can recount stock"}
          >
            {i.onHand}
            <span className="font-semibold text-faint">/ {i.need}</span>
            {canEdit && <Pencil className="size-3 text-faint group-hover:text-accent" />}
          </button>
        )}
        {canRemove && !editing && <RemoveButton label={i.name} onRemove={() => void act({ type: "ingredient_removed", ingredientId: i.id })} />}
      </div>
      <div className="mt-1 pl-4">
        <LoadBar value={ratio} />
        <div className="mt-0.5 flex justify-between text-[11px] text-faint">
          <span>{i.unit}</span>
          <span className={clsx(i.short && "font-bold text-crit")}>{i.short ? `short by ${i.need - i.onHand}` : i.freshnessMinutes <= 90 ? `use within ${i.freshnessMinutes} min` : "plenty"}</span>
        </div>
      </div>
    </div>
  );
}

/** When to start a ticket so it's ready as the courier or customer arrives. */
export function FireChip({ o }: { o: OrderView }) {
  if (o.fireInMinutes === null || o.status === "held" || o.status === "deferred" || o.status === "blocked") return null;
  const now = o.fireInMinutes < 0.5;
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold tabular-nums", now ? "bg-navy text-white" : "bg-navy/[0.07] text-navy")}>
      {now ? "Start now" : `Start in ${minutes(o.fireInMinutes)}`}
    </span>
  );
}

export function DasherChip({ o }: { o: OrderView }) {
  if (!o.dasher) return null;
  const eta = o.dasher.etaMinutes;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#ff3008]/10 px-2 py-0.5 text-[11px] font-bold text-[#c42400]">
      DoorDash · {o.dasher.name} {eta > 0.5 ? `in ${minutes(eta)}` : "here"}
    </span>
  );
}
