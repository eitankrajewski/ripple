import type { IngredientConfig } from "../engine/seed";
import type { NewMenuItem, StationId } from "../engine/types";

export interface MenuDraft extends NewMenuItem {
  price?: number;
  keep: boolean;
}

const ALIASES: Record<string, string[]> = {
  chicken: ["chicken", "chx", "tender", "wing", "nugget"],
  beef: ["beef", "burger", "cheeseburger", "patty", "steak"],
  veggie: ["veggie", "vegetarian", "vegan", "plant", "beyond", "impossible"],
  lettuce: ["lettuce", "salad", "greens", "caesar"],
  tomato: ["tomato"],
  onion: ["onion"],
  cheese: ["cheese", "cheddar", "swiss", "melt", "queso"],
  bun: ["burger", "sandwich", "bun", "slider", "sub"],
  tortilla: ["wrap", "burrito", "taco", "quesadilla", "tortilla"],
};

export const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32) || "item";

/** Guesses ingredients from the dish name; the manager reviews every guess before saving. */
export function guessIngredients(text: string, known: IngredientConfig[]): Record<string, number> {
  const t = text.toLowerCase();
  const out: Record<string, number> = {};
  for (const ing of known) {
    const words = ALIASES[ing.id] ?? [ing.id, ing.name.toLowerCase()];
    if (words.some((w) => t.includes(w))) out[ing.id] = 1;
  }
  if (out.veggie) delete out.beef;
  if (out.chicken && !/beef|cheeseburger|steak/.test(t)) delete out.beef;
  if (out.tortilla) delete out.bun;
  return out;
}

export function guessMinutes(text: string): Record<StationId, number> {
  const t = text.toLowerCase();
  if (/salad|bowl/.test(t)) return { prep: 1.6, cook: 0.4, pack: 0.4 };
  if (/wrap|burrito|taco/.test(t)) return { prep: 1.5, cook: 1.5, pack: 0.4 };
  if (/fries|side|drink|soda|shake/.test(t)) return { prep: 0.3, cook: 1, pack: 0.2 };
  return { prep: 1.2, cook: 2, pack: 0.4 };
}

const PRICE = /(?:\$\s*(\d{1,3}(?:[.,]\d{2})?)|(\d{1,3}[.,]\d{2}))\s*$/;
const SKIP = /^(menu|appetizers?|starters?|mains?|entrees?|sides?|drinks?|beverages?|desserts?|specials?|breakfast|lunch|dinner)$/i;

/** Turns OCR text from a photographed menu into reviewable menu items (one per priced or titled line). */
export function parseMenuText(text: string, known: IngredientConfig[], existing: string[] = []): MenuDraft[] {
  const seen = new Set(existing);
  const drafts: MenuDraft[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/[|_•·]+/g, " ").replace(/\s{2,}/g, " ").trim();
    if (line.length < 3) continue;
    const price = line.match(PRICE);
    const name = (price ? line.slice(0, price.index) : line).replace(/[.\-–—:]+$/, "").replace(/\.{2,}/g, " ").trim();
    if (!/[a-z]{3}/i.test(name) || name.length > 48 || SKIP.test(name)) continue;
    if (!price && (name.split(" ").length > 6 || /[,;]/.test(name) || name === name.toUpperCase())) continue;
    let id = slug(name);
    while (seen.has(id)) id = `${id}_2`;
    seen.add(id);
    drafts.push({
      id,
      name: name.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\B\w+/g, (w) => w.toLowerCase()),
      ingredients: guessIngredients(name, known),
      minutes: guessMinutes(name),
      price: price ? Number((price[1] ?? price[2]).replace(",", ".")) : undefined,
      keep: !!price,
    });
  }
  return drafts;
}

/** Reads text from a menu photo in the browser (Tesseract.js, loaded on demand). */
export async function ocrImage(file: Blob, onProgress?: (p: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (m: { status: string; progress: number }) => m.status === "recognizing text" && onProgress?.(m.progress),
  });
  try {
    const { data } = await worker.recognize(file);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
