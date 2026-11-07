import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleDoorDashWebhook } from "./_doordash.js";

export const config = { api: { bodyParser: false } };

/** POST /api/doordash: signed DoorDash-style order webhooks into the live kitchen. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
  const header = req.headers["x-ripple-signature"];
  const { status, body } = await handleDoorDashWebhook(Buffer.concat(chunks).toString("utf8"), Array.isArray(header) ? header[0] : header);
  return res.status(status).json(body);
}
