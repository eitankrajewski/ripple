import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * DoorDash-style order webhook → RIPPLE live event.
 *
 * DoorDash's merchant integrations deliver order and courier updates as signed JSON
 * webhooks. This module is the mapping layer: once RIPPLE has DoorDash partner
 * credentials, only `mapDoorDash` needs to follow their exact payload.
 */

export interface DoorDashItem {
  merchant_supplied_id?: string;
  name: string;
  quantity: number;
}

export interface DoorDashWebhook {
  event_type: "order.created" | "order.dasher_eta_updated";
  /** The merchant's store id: set it to the RIPPLE kitchen's join code. */
  store: { merchant_supplied_id: string };
  order: {
    id: string;
    customer?: { first_name?: string; last_name?: string };
    items?: DoorDashItem[];
    dasher?: { first_name?: string; last_name?: string };
    /** ISO time the Dasher is expected at the counter. */
    estimated_pickup_time?: string;
  };
}

/** Must match `DEFAULT_CONFIG.menu` in src/engine/seed.ts (checked by a test). */
export const RIPPLE_MENU = [
  { id: "chicken_burger", name: "Chicken Burger" },
  { id: "beef_burger", name: "Beef Burger" },
  { id: "chicken_wrap", name: "Chicken Wrap" },
  { id: "veggie_burger", name: "Veggie Burger" },
  { id: "chicken_sandwich", name: "Chicken Sandwich" },
];

export type DoorDashAction =
  | {
      type: "order_received";
      source: "doordash";
      customer: string;
      items: { menuItemId: string; qty: number }[];
      dasherName?: string;
      dasherEtaMinutes?: number;
      externalId: string;
    }
  | { type: "dasher_update"; externalId: string; etaMinutes: number };

export type Mapped = { ok: true; joinCode: string; action: DoorDashAction; unknownItems: string[] } | { ok: false; error: string };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function menuId(item: DoorDashItem) {
  const byId = RIPPLE_MENU.find((m) => m.id === item.merchant_supplied_id);
  if (byId) return byId.id;
  return RIPPLE_MENU.find((m) => norm(m.name) === norm(item.name))?.id;
}

function person(p?: { first_name?: string; last_name?: string }) {
  if (!p?.first_name) return undefined;
  return p.last_name ? `${p.first_name} ${p.last_name[0]}.` : p.first_name;
}

export function mapDoorDash(payload: DoorDashWebhook, nowMs: number): Mapped {
  const joinCode = payload?.store?.merchant_supplied_id?.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const order = payload?.order;
  if (!joinCode || !order?.id) return { ok: false, error: "store.merchant_supplied_id and order.id are required" };
  const eta = order.estimated_pickup_time ? Math.max(0, (Date.parse(order.estimated_pickup_time) - nowMs) / 60000) : undefined;
  if (eta !== undefined && Number.isNaN(eta)) return { ok: false, error: "estimated_pickup_time must be an ISO date" };

  if (payload.event_type === "order.dasher_eta_updated") {
    if (eta === undefined) return { ok: false, error: "estimated_pickup_time is required" };
    return { ok: true, joinCode, action: { type: "dasher_update", externalId: order.id, etaMinutes: Math.round(eta * 10) / 10 }, unknownItems: [] };
  }
  if (payload.event_type !== "order.created") return { ok: false, error: `unsupported event_type ${String(payload.event_type)}` };

  const items: { menuItemId: string; qty: number }[] = [];
  const unknownItems: string[] = [];
  for (const it of order.items ?? []) {
    const id = menuId(it);
    if (!id) {
      unknownItems.push(it.name);
      continue;
    }
    const qty = Math.max(1, Math.min(50, Math.round(it.quantity || 1)));
    const existing = items.find((x) => x.menuItemId === id);
    if (existing) existing.qty += qty;
    else items.push({ menuItemId: id, qty });
  }
  if (!items.length) return { ok: false, error: "no items match the RIPPLE menu" };
  return {
    ok: true,
    joinCode,
    unknownItems,
    action: {
      type: "order_received",
      source: "doordash",
      customer: person(order.customer) ?? "DoorDash customer",
      items,
      dasherName: person(order.dasher),
      dasherEtaMinutes: eta === undefined ? undefined : Math.round(eta * 10) / 10,
      externalId: order.id,
    },
  };
}

export function verifySignature(raw: string, signature: string | undefined, secret: string) {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.replace(/^sha256=/, ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

async function supabase(path: string, init: RequestInit = {}) {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("not_configured");
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init.headers },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`supabase ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

/** Full request handling shared by the Vercel function and the dev server. */
export async function handleDoorDashWebhook(raw: string, signature: string | undefined): Promise<{ status: number; body: unknown }> {
  const secret = process.env.RIPPLE_WEBHOOK_SECRET;
  if (!secret) return { status: 503, body: { error: "RIPPLE_WEBHOOK_SECRET is not set" } };
  if (!verifySignature(raw, signature, secret)) return { status: 401, body: { error: "bad signature" } };
  let payload: DoorDashWebhook;
  try {
    payload = JSON.parse(raw);
  } catch {
    return { status: 400, body: { error: "invalid JSON" } };
  }
  const mapped = mapDoorDash(payload, Date.now());
  if (!mapped.ok) return { status: 422, body: { error: mapped.error } };
  try {
    const rows = (await supabase(`kitchens?join_code=eq.${mapped.joinCode}&select=id,created_at`)) as { id: string; created_at: string }[];
    const kitchen = rows[0];
    if (!kitchen) return { status: 404, body: { error: "no kitchen with that store id" } };
    const now = Date.now();
    const event = {
      // Stable id per kitchen + order so DoorDash retries are ignored.
      id: `doordash:${kitchen.id}:${payload.order.id}:${payload.event_type === "order.created" ? "created" : now}`,
      kitchen_id: kitchen.id,
      at: Math.max(0, Math.floor((now - Date.parse(kitchen.created_at)) / 1000)),
      ts: now,
      actor: { memberId: "doordash", name: "DoorDash", role: "integration" },
      action: mapped.action,
    };
    await supabase("events?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(event) });
    return { status: 202, body: { accepted: true, eventId: event.id, unknownItems: mapped.unknownItems } };
  } catch (e) {
    if (e instanceof Error && e.message === "not_configured") return { status: 503, body: { error: "Supabase is not configured on the server" } };
    return { status: 502, body: { error: "could not store the order" } };
  }
}
