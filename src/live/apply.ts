import { advanceTo, approveStrategy, cancelOrder, createLiveKitchen, ingestEvent, releaseOrder, type Kitchen } from "../engine/engine";
import { allowed } from "./roles";
import type { LiveAction, LiveEvent, Member } from "./types";

export const byOrder = (a: LiveEvent, b: LiveEvent) => a.at - b.at || a.ts - b.ts || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Applies one event to a live kitchen. Pure function of (kitchen, event): every device converges. */
export function applyLiveEvent(k: Kitchen, e: LiveEvent) {
  advanceTo(k, e.at);
  if (!allowed(e.actor.role, e.action)) return;
  applyAction(k, e.action, e.actor.role === "integration" ? e.actor.name : `${e.actor.name} (${e.actor.role})`);
}

/** Applies an action to any kitchen (live or simulated) without permission checks. */
export function applyAction(k: Kitchen, a: LiveAction, by?: string) {
  switch (a.type) {
    case "order_received":
      ingestEvent(k, { type: "order_received", source: a.source, customer: a.customer, items: a.items, dasherName: a.dasherName, dasherEtaMinutes: a.dasherEtaMinutes, externalId: a.externalId });
      break;
    case "move_order":
      ingestEvent(k, { type: "move_order", orderId: a.orderId, to: a.to, by });
      break;
    case "pack_item":
      ingestEvent(k, { type: "pack_item", orderId: a.orderId, menuItemId: a.menuItemId, checked: a.checked });
      break;
    case "dasher_update":
      ingestEvent(k, { type: "dasher_update", orderId: a.orderId, externalId: a.externalId, dasherEtaMinutes: a.etaMinutes });
      break;
    case "handoff_mismatch":
      ingestEvent(k, { type: "handoff_mismatch", orderId: a.orderId, by });
      break;
    case "item_done":
      ingestEvent(k, { type: "item_done", orderId: a.orderId, menuItemId: a.menuItemId, station: a.station, by });
      break;
    case "station_added":
      ingestEvent(k, { type: "station_added", placed: a.station, by });
      break;
    case "station_removed":
      ingestEvent(k, { type: "station_removed", placedId: a.id, by });
      break;
    case "menu_item_added":
      ingestEvent(k, { type: "menu_item_added", menuItem: a.item, by });
      break;
    case "task_done":
      ingestEvent(k, { type: "task_done", orderId: a.orderId, station: a.station, by });
      break;
    case "picked_up":
      ingestEvent(k, { type: "picked_up", orderId: a.orderId, by });
      break;
    case "stock_correction":
      ingestEvent(k, { type: "stock_correction", ingredientId: a.ingredientId, newStock: a.newStock });
      break;
    case "approve_plan":
      approveStrategy(k, a.plan);
      break;
    case "release_order":
      releaseOrder(k, a.orderId);
      break;
    case "cancel_order":
      cancelOrder(k, a.orderId);
      break;
  }
}

export function replay(startedAt: number, events: LiveEvent[]) {
  const k = createLiveKitchen(startedAt);
  for (const e of [...events].sort(byOrder)) applyLiveEvent(k, e);
  return k;
}

export function membersFrom(events: LiveEvent[]): Member[] {
  const m = new Map<string, Member>();
  for (const e of [...events].sort(byOrder)) {
    if (e.action.type === "member_joined") m.set(e.action.member.id, e.action.member);
    if (e.action.type === "member_left") m.delete(e.action.memberId);
  }
  return [...m.values()];
}
