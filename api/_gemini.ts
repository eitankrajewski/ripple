export interface ExplainResult {
  headline: string;
  causeChain: string;
  recommendationReason: string;
  tradeoff: string;
}

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

/**
 * Gemini only rephrases numbers the deterministic engine already computed.
 * Returns null when no key is configured so the client uses its fallback.
 */
export async function explainWithGemini(payload: unknown): Promise<ExplainResult | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const prompt = [
    "You explain a restaurant kitchen simulation to a busy manager.",
    "Use ONLY the facts and numbers in the JSON below. Do not invent numbers, orders or ingredients.",
    "Reply with JSON: {headline, causeChain, recommendationReason, tradeoff}. Each value is one short sentence.",
    JSON.stringify(payload),
  ].join("\n");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  const parsed = JSON.parse(text) as Partial<ExplainResult>;
  if (!parsed.headline || !parsed.causeChain || !parsed.recommendationReason || !parsed.tradeoff) return null;
  return parsed as ExplainResult;
}
