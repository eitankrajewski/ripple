export interface ExplainResult {
  headline: string;
  causeChain: string;
  recommendationReason: string;
  tradeoff: string;
}

export type ExplainOutcome = { ok: true; result: ExplainResult } | { ok: false; reason: "not_configured" | "upstream" };

// gemini-2.0-flash has been retired; try the current flash models in order.
const MODELS = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"];

function pickText(data: unknown): string | undefined {
  const parts = (data as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] }).candidates?.[0]?.content?.parts ?? [];
  return parts.filter((p) => !p.thought && p.text).map((p) => p.text).join("") || undefined;
}

function parse(text: string): ExplainResult | null {
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try {
    const p = JSON.parse(json) as Partial<ExplainResult>;
    if (!p.headline || !p.causeChain || !p.recommendationReason || !p.tradeoff) return null;
    return { headline: p.headline, causeChain: p.causeChain, recommendationReason: p.recommendationReason, tradeoff: p.tradeoff };
  } catch {
    return null;
  }
}

/**
 * Gemini only rephrases numbers the deterministic engine already computed.
 * Never throws; the client falls back to the engine's own wording.
 */
export async function explainWithGemini(payload: unknown): Promise<ExplainOutcome> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, reason: "not_configured" };
  const prompt = [
    "You explain a restaurant kitchen simulation to a busy restaurant manager.",
    "Use ONLY the facts and numbers in the JSON below. Do not invent numbers, orders or ingredients.",
    "Write plainly, like a shift lead talking. No hype, no 'Do this now', no exclamation marks.",
    "If the JSON has a previousWording field, say the same facts in different words.",
    "Reply with JSON only: {\"headline\", \"causeChain\", \"recommendationReason\", \"tradeoff\"}. Each value is one short sentence.",
    JSON.stringify(payload),
  ].join("\n");
  for (const model of MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (res.status === 404 || res.status === 400) continue;
      if (!res.ok) return { ok: false, reason: "upstream" };
      const text = pickText(await res.json());
      const result = text && parse(text);
      if (result) return { ok: true, result };
    } catch {
      // try the next model
    }
  }
  return { ok: false, reason: "upstream" };
}
