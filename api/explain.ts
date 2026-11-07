import type { VercelRequest, VercelResponse } from "@vercel/node";
import { explainWithGemini } from "./_gemini.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
  const out = await explainWithGemini(body);
  if (!out.ok) return res.status(503).json({ error: out.reason });
  return res.status(200).json(out.result);
}
