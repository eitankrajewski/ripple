import clsx from "clsx";
import { AlertTriangle, BookOpen, ChevronRight, History, LayoutGrid, ListOrdered, Package, Search, Users } from "lucide-react";
import { useState } from "react";
import { useAreas } from "../lib/areas";
import { useStationNodes } from "../lib/stations";
import { pct } from "../lib/ui";
import { useCan, useTwin, type NavTab } from "../store";
import { Dot, IconTabs, OrderRow, PantryRow, type IconTab } from "./kit";
import { TeamPanel } from "./live/TeamPanel";
import { MenuPanel } from "./MenuPanel";
import { PantryAdd } from "./PantryAdd";

function KitchenTree({ filter }: { filter: string }) {
  const { areas } = useAreas();
  const areaSel = useTwin((s) => s.area);
  const placedSel = useTwin((s) => s.placed);
  const sel = placedSel ? null : areaSel;
  const selectArea = useTwin((s) => s.selectArea);
  const selectPlaced = useTwin((s) => s.selectPlaced);
  const extras = useStationNodes().filter((n) => n.placed);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const f = filter.toLowerCase();
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5 px-1 py-1 font-extrabold">
        <ChevronRight className="size-3.5 rotate-90 text-faint" />
        <LayoutGrid className="size-4 text-accent" />
        Kitchen
      </div>
      {areas.map((a) => {
        const orders = a.orders.filter((o) => !f || `${o.label} ${o.customer} ${o.itemsText}`.toLowerCase().includes(f));
        if (f && !orders.length && !a.name.toLowerCase().includes(f)) return null;
        const isOpen = open[a.id] ?? !!f;
        const mine = extras.filter((n) => n.kind === a.id);
        return (
          <div key={a.id} className="pl-4">
            <div
              onClick={() => selectArea(sel === a.id ? null : a.id)}
              className={clsx("flex cursor-pointer items-center gap-1.5 rounded-[7px] px-1 py-1", sel === a.id ? "bg-navy text-white" : "hover:bg-navy/[0.04]")}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen((o) => ({ ...o, [a.id]: !isOpen }));
                }}
                className={clsx("rounded p-0.5", !a.orders.length && "invisible")}
                aria-label="Expand"
              >
                <ChevronRight className={clsx("size-3.5 transition-transform", isOpen && "rotate-90", sel === a.id ? "text-white/80" : "text-faint")} />
              </button>
              <Dot risk={a.risk} pulse className={sel === a.id ? "ring-2 ring-white/80" : undefined} />
              <span className="flex-1 truncate font-bold">{a.name}</span>
              <span className={clsx("text-[11.5px] font-semibold tabular-nums", sel === a.id ? "text-white/80" : "text-faint")}>
                {a.load !== undefined ? pct(a.load) : a.orders.length || ""}
              </span>
            </div>
            {isOpen && (
              <div className="ml-5 border-l border-line pl-1">
                {orders.map((o) => (
                  <OrderRow key={o.id} o={o} compact />
                ))}
              </div>
            )}
            {mine.map((n) => {
              const on = placedSel === n.id;
              return (
                <div
                  key={n.id}
                  onClick={() => (on ? selectArea(null) : selectPlaced(n.id, n.kind))}
                  className={clsx("flex cursor-pointer items-center gap-1.5 rounded-[7px] py-1 pr-1 pl-6", on ? "bg-navy text-white" : "hover:bg-navy/[0.04]")}
                >
                  <span className={clsx("size-2 shrink-0 rounded-full bg-[#ff5f1f]", on && "ring-2 ring-white/80")} />
                  <span className="flex-1 truncate font-bold">{n.name}</span>
                  <span className={clsx("text-[11.5px] font-semibold", on ? "text-white/80" : "text-faint")}>added</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function OrdersList({ filter }: { filter: string }) {
  const orders = useTwin((s) => s.state.orders);
  const [scope, setScope] = useState<"all" | "risk" | "held">("all");
  const f = filter.toLowerCase();
  const list = orders
    .filter((o) => (scope === "risk" ? o.risk !== "normal" : scope === "held" ? o.status === "held" || o.status === "deferred" : true))
    .filter((o) => !f || `${o.label} ${o.customer} ${o.itemsText}`.toLowerCase().includes(f));
  return (
    <div className="space-y-2">
      <div className="flex rounded-[8px] bg-navy/[0.05] p-0.5">
        {(["all", "risk", "held"] as const).map((s) => (
          <button key={s} onClick={() => setScope(s)} className={clsx("h-6 flex-1 rounded-[6px] text-[12px] font-bold", scope === s ? "bg-white shadow-sm" : "text-mute")}>
            {s === "all" ? `All ${orders.length}` : s === "risk" ? "At risk" : "Held"}
          </button>
        ))}
      </div>
      {list.length ? list.map((o) => <OrderRow key={o.id} o={o} />) : <p className="py-6 text-center text-faint">No orders</p>}
    </div>
  );
}

function Issues() {
  const state = useTwin((s) => s.state);
  const orders = state.orders.filter((o) => o.risk !== "normal");
  const stations = state.stations.filter((x) => x.risk !== "normal");
  const short = state.inventory.filter((i) => i.short);
  const selectArea = useTwin((s) => s.selectArea);
  if (!orders.length && !stations.length && !short.length) return <p className="py-10 text-center text-faint">No issues</p>;
  return (
    <div className="space-y-3">
      {(stations.length > 0 || short.length > 0) && (
        <div className="space-y-0.5">
          <h4 className="section-label px-1">Kitchen</h4>
          {stations.map((s) => (
            <button key={s.id} onClick={() => selectArea(s.id)} className="flex w-full items-start gap-2 rounded-[7px] px-1.5 py-1 text-left hover:bg-navy/[0.04]">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" style={{ color: s.risk === "critical" ? "#ff3b30" : "#ff9f0a" }} />
              <span>
                <b>{s.name}</b> at {pct(s.utilization)} of capacity
              </span>
            </button>
          ))}
          {short.map((i) => (
            <button key={i.id} onClick={() => selectArea("pantry")} className="flex w-full items-start gap-2 rounded-[7px] px-1.5 py-1 text-left hover:bg-navy/[0.04]">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-crit" />
              <span>
                <b>{i.name}</b>: {i.onHand} on hand, {i.need} needed
              </span>
            </button>
          ))}
        </div>
      )}
      {orders.length > 0 && (
        <div className="space-y-0.5">
          <h4 className="section-label px-1">Orders</h4>
          {orders.map((o) => (
            <div key={o.id}>
              <OrderRow o={o} compact />
              <p className="pb-1 pl-6 text-[11.5px] text-faint">
                {o.reason}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Activity() {
  const feed = useTwin((s) => s.state.feed);
  return (
    <div className="space-y-0.5 font-mono text-[11.5px]">
      {[...feed].reverse().map((f) => (
        <div key={f.id} className="flex gap-2 rounded-[6px] px-1.5 py-1 hover:bg-navy/[0.03]">
          <span className="w-10 shrink-0 text-faint tabular-nums">+{f.atSeconds}s</span>
          <span className={clsx("font-sans text-[12px]", f.kind === "rush" && "font-bold text-crit", f.kind === "approve" && "font-bold")}>{f.text}</span>
        </div>
      ))}
    </div>
  );
}

function Pantry() {
  const inv = useTwin((s) => s.state.inventory);
  const sorted = [...inv].sort((a, b) => Number(b.short) - Number(a.short) || b.need / Math.max(1, b.onHand) - a.need / Math.max(1, a.onHand));
  return (
    <div>
      <PantryAdd />
      <p className="px-1 pb-2 text-[11.5px] text-faint">On hand / needed for open tickets. Click a number to recount.</p>
      {sorted.map((i) => (
        <PantryRow key={i.id} i={i} />
      ))}
    </div>
  );
}

const TITLES: Record<NavTab, string> = { kitchen: "Kitchen", orders: "Orders", pantry: "Pantry", menu: "Menu", issues: "Issues", activity: "Activity", team: "Team & devices" };

export function Navigator({ className }: { className?: string }) {
  const nav = useTwin((s) => s.nav);
  const setNav = useTwin((s) => s.setNav);
  const issues = useTwin((s) => s.state.orders.filter((o) => o.risk !== "normal").length + s.state.inventory.filter((i) => i.short).length);
  const short = useTwin((s) => s.state.inventory.filter((i) => i.short).length);
  const live = useTwin((s) => s.mode === "live");
  const [filter, setFilter] = useState("");
  const canMenu = useCan("manage_menu");
  const tabs: IconTab<NavTab>[] = [
    { id: "kitchen", icon: LayoutGrid, label: "Kitchen" },
    { id: "orders", icon: ListOrdered, label: "Orders" },
    { id: "pantry", icon: Package, label: "Pantry", badge: short },
    ...(canMenu ? [{ id: "menu" as const, icon: BookOpen, label: "Menu" }] : []),
    { id: "issues", icon: AlertTriangle, label: "Issues", badge: issues },
    { id: "activity", icon: History, label: "Activity" },
  ];
  if (live) tabs.push({ id: "team", icon: Users, label: "Team" });
  const filterable = nav === "kitchen" || nav === "orders";
  return (
    <aside className={clsx("sidebar flex min-h-0 flex-col", className)}>
      <div className="p-2.5">
        <IconTabs
          value={nav}
          onChange={setNav}
          tabs={tabs}
        />
      </div>
      <div className="px-3.5 pb-1 text-[11px] font-extrabold text-mute">{TITLES[nav]}</div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {nav === "kitchen" ? <KitchenTree filter={filter} /> : nav === "orders" ? <OrdersList filter={filter} /> : nav === "pantry" ? <Pantry /> : nav === "menu" && canMenu ? <MenuPanel /> : nav === "issues" ? <Issues /> : nav === "team" && live ? <TeamPanel /> : <Activity />}
      </div>
      {filterable && (
        <div className="border-t border-line p-2">
          <label className="flex h-7 items-center gap-1.5 rounded-[8px] bg-navy/[0.05] px-2">
            <Search className="size-3.5 text-faint" />
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter orders" className="min-w-0 flex-1 bg-transparent font-semibold outline-none placeholder:text-faint" />
          </label>
        </div>
      )}
    </aside>
  );
}
