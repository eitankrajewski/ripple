import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mapDoorDash, RIPPLE_MENU, verifySignature, type DoorDashWebhook } from "../../api/_doordash";
import { DEFAULT_CONFIG } from "../engine/seed";

const NOW = Date.UTC(2026, 10, 7, 23, 0, 0);
const payload: DoorDashWebhook = {
  event_type: "order.created",
  store: { merchant_supplied_id: "ab-c12z" },
  order: {
    id: "dd-9001",
    customer: { first_name: "Sam", last_name: "Lee" },
    dasher: { first_name: "Alex", last_name: "Rivera" },
    estimated_pickup_time: new Date(NOW + 18 * 60000).toISOString(),
    items: [
      { merchant_supplied_id: "beef_burger", name: "Beef Burger", quantity: 2 },
      { name: "chicken wrap", quantity: 1 },
      { name: "Milkshake", quantity: 1 },
    ],
  },
};

describe("DoorDash webhook mapping", () => {
  it("keeps the webhook menu in sync with the kitchen menu", () => {
    expect(RIPPLE_MENU).toEqual(DEFAULT_CONFIG.menu.map((m) => ({ id: m.id, name: m.name })));
  });

  it("maps an order to a live order_received with the Dasher's ETA", () => {
    const r = mapDoorDash(payload, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.joinCode).toBe("ABC12Z");
    expect(r.unknownItems).toEqual(["Milkshake"]);
    expect(r.action).toEqual({
      type: "order_received",
      source: "doordash",
      customer: "Sam L.",
      items: [
        { menuItemId: "beef_burger", qty: 2 },
        { menuItemId: "chicken_wrap", qty: 1 },
      ],
      dasherName: "Alex R.",
      dasherEtaMinutes: 18,
      externalId: "dd-9001",
    });
  });

  it("maps courier ETA updates and rejects bad payloads", () => {
    const r = mapDoorDash({ ...payload, event_type: "order.dasher_eta_updated" }, NOW);
    expect(r.ok && r.action).toEqual({ type: "dasher_update", externalId: "dd-9001", etaMinutes: 18 });
    expect(mapDoorDash({ ...payload, order: { ...payload.order, items: [{ name: "Soup", quantity: 1 }] } }, NOW).ok).toBe(false);
  });

  it("checks the HMAC signature", () => {
    const raw = JSON.stringify(payload);
    const sig = createHmac("sha256", "s3cret").update(raw).digest("hex");
    expect(verifySignature(raw, sig, "s3cret")).toBe(true);
    expect(verifySignature(raw, `sha256=${sig}`, "s3cret")).toBe(true);
    expect(verifySignature(raw + " ", sig, "s3cret")).toBe(false);
    expect(verifySignature(raw, undefined, "s3cret")).toBe(false);
  });
});
