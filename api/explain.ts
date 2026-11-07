import type { VercelRequest, VercelResponse } from "@vercel/node";
import { explainWithGemini } from "./_gemini.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const result = await explainWithGemini(req.body);
    if (!result) return res.status(503).json({ error: "explanation unavailable" });
    return res.status(200).json(result);
  } catch {
    return res.status(503).json({ error: "explanation unavailable" });
  }
}
