import clsx from "clsx";
import { ChevronLeft, ChevronRight, GitCompareArrows, Info, Sparkles, X, Zap } from "lucide-react";
import type { OrderView } from "../engine/types";
import { AREA_ORDER, culpritArea, useAreas, type Area } from "../lib/areas";
import { minutes, pct, SOURCE, statusLabel } from "../lib/ui";
import { useTwin, type Tab } from "../store";
import { AskTab } from "./AskTab";
import { Dot, IconTabs, LoadBar, OrderRow, PantryRow, RiskChip, Section, SimBadge } from "./kit";
import { PlanTab } from "./PlanTab";

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-mute">{k}</span>
      <span className="text-right font-bold tabular-nums">{v}</span>
    </div>
  );
}

function AreaInspector({ a }: { a: Area }) {
  const selectArea = useTwin((s) => s.selectArea);
  const sendRush = useTwin((s) => s.sendRush);
  const inventory = useTwin((s) => s.state.inventory);
  const allOrders = useTwin((s) => s.state.orders);
  const nextRush = useTwin((s) => s.state.nextRushInSeconds);
  const i = AREA_ORDER.indexOf(a.id);
  const slowed = allOrders.filter((o) => culpritArea(o) === a.id);
  const late = allOrders.filter((o) => o.risk !== "normal");
  const go = (d: number) => selectArea(AREA_ORDER[(i + d + AREA_ORDER.length) % AREA_ORDER.length]);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-[17px] font-extrabold">{a.name}</h3>
          <div className="flex">
            <button className="tbtn h-6! min-w-6!" onClick={() => go(-1)} aria-label="Previous area">
              <ChevronLeft className="size-4" />
            </button>
            <button className="tbtn h-6! min-w-6!" onClick={() => go(1)} aria-label="Next area">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
        <p className="text-mute">{a.role}</p>
        <div className="mt-2 flex items-center gap-2">
          <RiskChip risk={a.risk} />
          {a.changed && <span className="rounded-full bg-ai/10 px-2 py-0.5 text-[11.5px] font-bold text-ai">Changed by preview</span>}
          <SimBadge />
        </div>
      </div>

      {a.load !== undefined && (
        <Section title="Capacity">
          <div className="card p-3">
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-[24px] leading-none font-extrabold tabular-nums">{pct(a.load)}</span>
              {a.loadBefore !== undefined && <span className="text-mute">was {pct(a.loadBefore)}</span>}
            </div>
            <LoadBar value={a.load} before={a.loadBefore} />
            <div className="mt-2 divide-y divide-line">
              <Row k="Staff on station" v={a.staff} />
              <Row k="Queued work" v={`${minutes(a.queuedMinutes ?? 0)} of ${minutes(a.capacityMinutes ?? 0)}`} />
              <Row k="Orders here now" v={a.orders.length} />
            </div>
          </div>
        </Section>
      )}

      {a.id === "pantry" && (
        <Section title="Stock">
          <div className="card p-1">
            {[...inventory]
              .sort((x, y) => Number(y.short) - Number(x.short))
              .map((it) => (
                <PantryRow key={it.id} i={it} />
              ))}
          </div>
        </Section>
      )}

      {a.id === "orders" && (
        <Section title="Feed">
          <div className="card divide-y divide-line px-3 py-1">
            <Row k="Waiting to start" v={a.orders.length} />
            <Row k="Held or deferred" v={a.orders.filter((o) => o.status === "held" || o.status === "deferred").length} />
            <Row k="Scripted rush" v={nextRush ? `in ${nextRush}s` : "arrived"} />
          </div>
          <button className="btn w-full" onClick={sendRush}>
            <Zap className="size-3.5" /> Send a rush order
          </button>
        </Section>
      )}

      {a.id === "pickup" && (
        <Section title="Promises">
          <div className="card divide-y divide-line px-3 py-1">
            <Row k="Ready for pickup" v={a.orders.length} />
            <Row k="Late or at risk" v={late.length} />
          </div>
          <p className="px-0.5 text-mute">{a.summary}</p>
        </Section>
      )}

      {slowed.length > 0 && (
        <Section title={`Slowed down here (${slowed.length})`}>
          <div className="card p-1">
            {slowed.map((o) => (
              <OrderRow key={o.id} o={o} compact />
            ))}
          </div>
        </Section>
      )}

      <Section title={`Orders at ${a.name} (${a.orders.length})`}>
        <div className="card p-1">{a.orders.length ? a.orders.map((o) => <OrderRow key={o.id} o={o} />) : <p className="p-3 text-center text-faint">None right now</p>}</div>
      </Section>
    </div>
  );
}

function OrderInspector({ o }: { o: OrderView }) {
  const trace = useTwin((s) => s.trace);
  const menu = useTwin((s) => s.kitchen.config.menu);
  const { release, cancel } = useTwin.getState();
  const culprit = culpritArea(o);
  const steps: { id: string; label: string; bad: boolean }[] = [
    { id: "orders", label: "Orders in", bad: false },
    { id: "pantry", label: o.blockedBy ? `Pantry: no ${o.blockedBy}` : "Pantry", bad: culprit === "pantry" },
    { id: "prep", label: "Prep", bad: culprit === "prep" },
    { id: "cook", label: "Cook", bad: culprit === "cook" },
    { id: "pack", label: "Pack", bad: culprit === "pack" },
    { id: "pickup", label: o.risk === "normal" ? "On time" : "Late", bad: o.risk !== "normal" },
  ];
  const held = o.status === "held" || o.status === "deferred";
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-[17px] font-extrabold">Order {o.label}</h3>
          <button className="tbtn h-6! min-w-6!" onClick={() => trace(null)} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <p className="text-mute">
          {o.customer} · {SOURCE[o.source].label}
          {o.isRush && " · rush"}
        </p>
        <div className="mt-2 flex gap-2">
          <RiskChip risk={o.risk} />
          <SimBadge />
        </div>
      </div>
      <Section title="Path through the kitchen">
        <div className="card space-y-0 p-3">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2.5">
              <div className="flex flex-col items-center">
                <span className={clsx("size-2.5 rounded-full border-2", s.bad ? "border-crit bg-crit" : "border-accent bg-white")} />
                {i < steps.length - 1 && <span className="h-4 w-px bg-line" />}
              </div>
              <span className={clsx("-mt-4 font-bold", s.bad ? "text-crit" : i === steps.length - 1 ? "" : "text-ink", i === steps.length - 1 && "mt-0")}>{s.label}</span>
            </div>
          ))}
          <p className="mt-2 text-mute">{o.reason}</p>
        </div>
      </Section>
      <Section title="Details">
        <div className="card divide-y divide-line px-3 py-1">
          <Row k="Status" v={statusLabel(o)} />
          <Row k="Pickup" v={o.pickupInMinutes > 0 ? `in ${minutes(o.pickupInMinutes)}` : "now"} />
          <Row k="Projected ready" v={o.projectedReadyInMinutes === null ? "can't start" : `in ${minutes(o.projectedReadyInMinutes)}`} />
          {o.items.map((it) => (
            <Row key={it.menuItemId} k={menu.find((m) => m.id === it.menuItemId)?.name ?? it.menuItemId} v={`× ${it.qty}`} />
          ))}
        </div>
      </Section>
      {held && (
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1" onClick={() => release(o.id)}>
            Release
          </button>
          <button className="btn flex-1 text-crit" onClick={() => cancel(o.id)}>
            Cancel & notify
          </button>
        </div>
      )}
    </div>
  );
}

function NoSelection() {
  const { areas } = useAreas();
  const selectArea = useTwin((s) => s.selectArea);
  return (
    <div className="flex flex-col items-center pt-16 text-center">
      <p className="text-[15px] font-bold text-faint">No Selection</p>
      <p className="mt-1 max-w-[230px] text-faint">Click a station in the 3D kitchen, or pick one below, to see what’s happening there.</p>
      <div className="mt-5 w-full space-y-0.5 text-left">
        {areas.map((a) => (
          <button key={a.id} onClick={() => selectArea(a.id)} className="flex w-full items-center gap-2 rounded-[7px] px-2 py-1.5 hover:bg-navy/[0.04]">
            <Dot risk={a.risk} />
            <span className="font-bold">{a.name}</span>
            <span className="ml-auto truncate text-faint">{a.summary}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const TITLES: Record<Tab, string> = { inspect: "Inspector", plan: "Plan a response", ask: "Ask AI" };

export function Inspector({ className }: { className?: string }) {
  const tab = useTwin((s) => s.tab);
  const setTab = useTwin((s) => s.setTab);
  const disrupted = useTwin((s) => s.state.phase === "disrupted");
  const { areas } = useAreas();
  const areaId = useTwin((s) => s.area);
  const traced = useTwin((s) => s.state.orders.find((o) => o.id === s.tracedOrderId));
  const a = areas.find((x) => x.id === areaId);
  return (
    <aside className={clsx("sidebar flex min-h-0 flex-col", className)}>
      <div className="p-2.5">
        <IconTabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "inspect", icon: Info, label: "Inspector" },
            { id: "plan", icon: GitCompareArrows, label: "Plan", badge: disrupted ? 1 : 0 },
            { id: "ask", icon: Sparkles, label: "Ask AI" },
          ]}
        />
      </div>
      <div className="px-3.5 pb-1 text-[11px] font-extrabold text-mute">{TITLES[tab]}</div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-3.5 pt-1 pb-4">
        {tab === "plan" ? <PlanTab /> : tab === "ask" ? <AskTab /> : traced ? <OrderInspector o={traced} /> : a ? <AreaInspector a={a} /> : <NoSelection />}
      </div>
    </aside>
  );
}
