import type { IngredientConfig } from "../engine/seed";
import type { NewMenuItem, StationId } from "../engine/types";

export interface MenuDraft extends NewMenuItem {
  price?: number;
  description?: string;
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

export interface MenuLine {
  text: string;
  /** Text height in pixels, when the line came from a photo. */
  h?: number;
}

const GAP = "\u2003";
const SECTION = "menu|appetizers?|starters?|mains?|entrees?|entr[ée]es|sides?|drinks?|beverages?|desserts?|specials?|breakfast|brunch|lunch|dinner|kids|combos?|extras|add[- ]ons?|burgers|sandwiches|salads|bowls|wraps|soups|pastas|pizzas|tacos|sweets|shakes";
const SKIP = new RegExp(`^(the\\s+)?(${SECTION})(\\s*(&|and|\\+)\\s*(${SECTION}))?(\\s+menu)?$`, "i");
const NUM = /^[$S]?[\dOolI]*\d[\dOolI]*(?:[.,][\dOolI]{1,2})?$/;

/** Reads a price token, fixing common OCR slips ("S12" for "$12", "O" for "0", a "$" read as a leading 5). */
function readPrice(tok: string, strong: boolean): number | undefined {
  if (!NUM.test(tok)) return undefined;
  const dollar = /^[$S]/.test(tok);
  let t = tok.replace(/^[$S]/, "").replace(/[Oo]/g, "0").replace(/[lI]/g, "1").replace(",", ".");
  if (!dollar && /^[58]\d{1,2}\.\d{2}$/.test(t) && Number(t) >= 100) t = t.slice(1);
  const v = Number(t);
  if (!Number.isFinite(v) || v <= 0 || v >= 200) return undefined;
  const decimal = t.includes(".");
  if (decimal && !/\.\d{2}$/.test(t) && !/\.\d$/.test(t)) return undefined;
  if (dollar || decimal || strong) return v;
  return v < 100 && Number.isInteger(v) ? v : undefined;
}

/** Splits a line into its name part and a trailing price, if any. */
function splitPrice(line: string): { name: string; price?: number; priceOnly: boolean } {
  const toks = line.split(/\s+/).filter(Boolean);
  if (!toks.length) return { name: "", priceOnly: false };
  const last = toks[toks.length - 1].replace(/[^\w$.,]+$/, "");
  const gapBefore = line.lastIndexOf(GAP) >= 0 && line.slice(line.lastIndexOf(GAP)).trim().split(/\s+/).length === 1;
  const priceOnly = toks.length === 1 || (toks.length === 2 && /^[$S]$/.test(toks[0]));
  const price = readPrice(priceOnly && toks.length === 2 ? `$${last}` : last, gapBefore || priceOnly);
  if (price === undefined) return { name: line, priceOnly: false };
  return { name: toks.slice(0, priceOnly ? 0 : -1).join(" "), price, priceOnly };
}

const clean = (raw: string) =>
  raw
    .replace(/[|~_•·*]+/g, " ")
    .replace(/\.{2,}|…+|(?:\s\.){2,}/g, GAP)
    .replace(/ {3,}/g, GAP)
    .replace(/\s*\u2003[\s\u2003]*/g, GAP)
    .replace(/^[\s\u2003\-–—]+|[\s\u2003\-–—:]+$/g, "")
    .replace(/ {2,}/g, " ");

function tidyName(n: string) {
  const t = n
    .replace(/\u2003/g, " ")
    .replace(/^(?:\d{1,2}[.)]\s+|[^A-Za-z0-9]+)/, "")
    .replace(/[^A-Za-z0-9)'!]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return t === t.toUpperCase() ? t.toLowerCase().replace(/(^|[\s(&/-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase()) : t;
}

function looksLikeName(n: string) {
  const words = n.split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 8 || n.length > 48) return false;
  const letters = n.replace(/[^A-Za-z]/g, "").length;
  if (letters < 3 || letters / n.replace(/\s/g, "").length < 0.7) return false;
  if (!words.some((w) => /^[A-Za-z]{3,}/.test(w))) return false;
  return words.filter((w) => w.replace(/[^A-Za-z]/g, "").length <= 2 && !/^(&|and|of|la|el|de|al|or|on|in|n|bbq|blt)$/i.test(w)).length <= Math.floor(words.length / 3);
}

const isCaps = (n: string) => /[A-Z]/.test(n) && n === n.toUpperCase();

/** Turns menu lines (from OCR or pasted text) into reviewable dishes: names, prices, descriptions. */
export function parseMenuLines(lines: MenuLine[], known: IngredientConfig[], existing: string[] = []): MenuDraft[] {
  interface Draft { name: string; price?: number; desc: string[]; h?: number; caps: boolean; section: string; descLines: number }
  const out: Draft[] = [];
  let section = "";
  let pending = null as Draft | null;
  let last = null as Draft | null;
  const rows: MenuLine[] = [];
  for (const l of lines) {
    if (/^\W*[-–—=*~]+\s*\d{1,3}\s*[-–—=*~]+\W*$/.test(l.text.trim())) continue;
    let cur = "";
    for (const seg of clean(l.text).split(GAP)) {
      if (cur && /[A-Za-z]{2}/.test(seg) && splitPrice(cur).price !== undefined) {
        rows.push({ text: cur, h: l.h });
        cur = seg;
      } else cur = cur ? cur + GAP + seg : seg;
    }
    if (cur) rows.push({ text: cur, h: l.h });
  }
  const flush = () => {
    if (pending && !pending.caps) out.push(pending);
    pending = null;
  };
  for (const row of rows) {
    const { name: rawName, price, priceOnly } = splitPrice(row.text);
    if (priceOnly) {
      const target = pending ?? (last && last.price === undefined ? last : null);
      if (target) {
        target.price = price;
        if (!out.includes(target)) out.push(target);
        last = target;
        pending = null;
      }
      continue;
    }
    const name = tidyName(rawName);
    const ref = pending ?? last;
    const descLike = !!ref && !isCaps(rawName) && (ref.caps || /^[a-z]/.test(rawName.trim()) || /,/.test(rawName) || rawName.split(/\s+/).length > 7 || (!!row.h && !!ref.h && row.h < ref.h * 0.8));
    if (price !== undefined && looksLikeName(name) && !SKIP.test(name)) {
      flush();
      last = { name, price, desc: [], h: row.h, caps: isCaps(rawName), section, descLines: 0 };
      out.push(last);
      continue;
    }
    if (price !== undefined) continue;
    if (descLike && ref && ref.descLines < 3) {
      ref.desc.push(rawName.replace(/\u2003/g, " "));
      ref.descLines++;
      continue;
    }
    if (SKIP.test(name) || /\bmenu\b/i.test(name)) {
      flush();
      section = name;
      continue;
    }
    if (looksLikeName(name)) {
      if (pending?.caps) section = pending.name;
      flush();
      pending = { name, desc: [], h: row.h, caps: isCaps(rawName), section, descLines: 0 };
    }
  }
  flush();
  const priced = out.some((d) => d.price !== undefined);
  const seen = new Set(existing);
  const drafts: MenuDraft[] = [];
  for (const d of new Set(out)) {
    let id = slug(d.name);
    while (seen.has(id)) id = `${id}_2`;
    seen.add(id);
    const about = `${d.name} ${d.desc.join(" ")} ${d.section}`;
    drafts.push({
      id,
      name: d.name,
      ingredients: guessIngredients(about, known),
      minutes: guessMinutes(`${d.name} ${d.section}`),
      price: d.price,
      description: d.desc.join(" ").replace(/\s{2,}/g, " ").trim() || undefined,
      keep: d.price !== undefined || !priced,
    });
  }
  return drafts;
}

/** Same as parseMenuLines, for pasted text (two or more spaces count as a column gap). */
export function parseMenuText(text: string, known: IngredientConfig[], existing: string[] = []): MenuDraft[] {
  return parseMenuLines(text.split(/\r?\n/).map((t) => ({ text: t.replace(/\t/g, "   ") })), known, existing);
}

interface Word { text: string; x0: number; x1: number; y0: number; y1: number; conf: number }

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
const isLeader = (t: string) => /^[.·•…_\-–—:,'`"~*]+$/.test(t) || (t.length >= 5 && new Set(t.toLowerCase()).size <= 2);
const isPriceWord = (t: string) => readPrice(t.replace(/[^\w$.,]/g, ""), true) !== undefined;

/** Rebuilds reading-order lines from word boxes: finds column gutters, keeps price columns with their names. */
export function wordsToLines(all: Word[]): MenuLine[] {
  const words = all.filter((w) => w.conf > 20 && w.text.trim() && !isLeader(w.text.trim()));
  if (!words.length) return [];
  const H = median(words.map((w) => w.y1 - w.y0)) || 10;
  const left = Math.min(...words.map((w) => w.x0));
  const right = Math.max(...words.map((w) => w.x1));
  const bin = Math.max(2, H / 4);
  const n = Math.ceil((right - left) / bin) + 1;
  const cover = new Array<number>(n).fill(0);
  for (const w of words) for (let i = Math.floor((w.x0 - left) / bin); i <= Math.floor((w.x1 - left) / bin); i++) cover[i]++;
  const rowsSeen = new Set(words.map((w) => Math.round((w.y0 + w.y1) / 2 / H))).size;
  const open = Math.max(1, Math.floor(rowsSeen * 0.08));
  const cut: number[] = [];
  for (let i = 0; i < n; ) {
    if (cover[i] > open) { i++; continue; }
    let j = i;
    while (j < n && cover[j] <= open) j++;
    if ((j - i) * bin >= H * 1.2 && i > 0 && j < n) cut.push(left + ((i + j) / 2) * bin);
    i = j;
  }
  const yc = (w: Word) => (w.y0 + w.y1) / 2;
  const straddle = words.filter((w) => cut.some((c) => w.x0 < c && w.x1 > c));
  const wide = new Set(words.filter((w) => straddle.some((s) => Math.abs(yc(s) - yc(w)) < H * 0.6) && !isPriceWord(w.text)));
  const rest = words.filter((w) => !wide.has(w));
  const edges = [-Infinity, ...cut, Infinity];
  let cols = edges.slice(1).map((hi, i) => rest.filter((w) => (w.x0 + w.x1) / 2 >= edges[i] && (w.x0 + w.x1) / 2 < hi)).filter((c) => c.length);
  for (let i = cols.length - 1; i > 0; i--) {
    if (cols[i].filter((w) => isPriceWord(w.text)).length / cols[i].length >= 0.6) {
      cols[i - 1] = [...cols[i - 1], ...cols[i]];
      cols.splice(i, 1);
    }
  }
  if (cols.length > 4) cols = [rest];
  const lines: MenuLine[] = [];
  for (const col of [[...wide], ...cols]) {
    const rows: { yc: number; ws: Word[] }[] = [];
    for (const w of [...col].sort((a, b) => (a.y0 + a.y1) - (b.y0 + b.y1))) {
      const yc = (w.y0 + w.y1) / 2;
      const r = rows.find((r) => Math.abs(r.yc - yc) < H * 0.6);
      if (r) { r.ws.push(w); r.yc = r.ws.reduce((s, x) => s + (x.y0 + x.y1) / 2, 0) / r.ws.length; }
      else rows.push({ yc, ws: [w] });
    }
    rows.sort((a, b) => a.yc - b.yc);
    for (const r of rows) {
      const ws = r.ws.sort((a, b) => a.x0 - b.x0);
      let text = ws[0].text;
      for (let i = 1; i < ws.length; i++) text += (ws[i].x0 - ws[i - 1].x1 > H * 1.2 ? GAP : " ") + ws[i].text;
      lines.push({ text, h: median(ws.map((w) => w.y1 - w.y0)) });
    }
  }
  return lines;
}

/** Flattens lighting and boosts contrast so shadows and colored paper don't confuse the text reader. */
async function prepare(file: Blob): Promise<{ clean: HTMLCanvasElement; plain: HTMLCanvasElement }> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    bmp = await createImageBitmap(file);
  }
  const long = Math.max(bmp.width, bmp.height);
  const scale = Math.min(2.5, 2200 / long);
  const W = Math.round(bmp.width * scale);
  const Ht = Math.round(bmp.height * scale);
  const plain = document.createElement("canvas");
  plain.width = W;
  plain.height = Ht;
  const pctx = plain.getContext("2d", { willReadFrequently: true })!;
  pctx.imageSmoothingQuality = "high";
  pctx.drawImage(bmp, 0, 0, W, Ht);
  bmp.close?.();
  const img = pctx.getImageData(0, 0, W, Ht);
  const px = img.data;
  const gray = new Uint8ClampedArray(W * Ht);
  for (let i = 0, j = 0; j < gray.length; i += 4, j++) gray[j] = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
  let sum = 0;
  for (let j = 0; j < gray.length; j += 7) sum += gray[j];
  if (sum / Math.ceil(gray.length / 7) < 100) for (let j = 0; j < gray.length; j++) gray[j] = 255 - gray[j];
  const B = Math.max(16, Math.round(Math.max(W, Ht) / 48));
  const bw = Math.ceil(W / B);
  const bh = Math.ceil(Ht / B);
  const bg = new Float32Array(bw * bh);
  const hist = new Uint32Array(256);
  for (let by = 0; by < bh; by++)
    for (let bx = 0; bx < bw; bx++) {
      hist.fill(0);
      let cnt = 0;
      for (let y = by * B; y < Math.min(Ht, (by + 1) * B); y++)
        for (let x = bx * B; x < Math.min(W, (bx + 1) * B); x++) {
          hist[gray[y * W + x]]++;
          cnt++;
        }
      let acc = 0;
      let v = 255;
      for (; v > 0; v--) if ((acc += hist[v]) >= cnt * 0.1) break;
      bg[by * bw + bx] = Math.max(v, 24);
    }
  const smooth = new Float32Array(bg.length);
  for (let by = 0; by < bh; by++)
    for (let bx = 0; bx < bw; bx++) {
      let s = 0;
      let c = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const yy = by + dy;
          const xx = bx + dx;
          if (yy >= 0 && yy < bh && xx >= 0 && xx < bw) {
            s += Math.max(bg[yy * bw + xx], bg[by * bw + bx] * 0.85);
            c++;
          }
        }
      smooth[by * bw + bx] = s / c;
    }
  const sample = (x: number, y: number) => {
    const fx = Math.min(bw - 1, Math.max(0, x / B - 0.5));
    const fy = Math.min(bh - 1, Math.max(0, y / B - 0.5));
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(bw - 1, x0 + 1);
    const y1 = Math.min(bh - 1, y0 + 1);
    const ax = fx - x0;
    const ay = fy - y0;
    const top = smooth[y0 * bw + x0] * (1 - ax) + smooth[y0 * bw + x1] * ax;
    const bot = smooth[y1 * bw + x0] * (1 - ax) + smooth[y1 * bw + x1] * ax;
    return top * (1 - ay) + bot * ay;
  };
  const norm = new Uint8ClampedArray(gray.length);
  const h2 = new Uint32Array(256);
  for (let y = 0; y < Ht; y++)
    for (let x = 0; x < W; x++) {
      const j = y * W + x;
      norm[j] = (gray[j] / sample(x, y)) * 255;
      h2[norm[j]]++;
    }
  let lo = 0;
  for (let acc = 0; lo < 255; lo++) if ((acc += h2[lo]) >= norm.length * 0.01) break;
  const span = Math.max(40, 235 - lo);
  for (let i = 0, j = 0; j < norm.length; i += 4, j++) {
    const v = Math.min(255, Math.max(0, ((norm[j] - lo) / span) * 255));
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  const out = document.createElement("canvas");
  out.width = W;
  out.height = Ht;
  out.getContext("2d")!.putImageData(img, 0, 0);
  return { clean: out, plain };
}

export interface ScanResult {
  drafts: MenuDraft[];
  text: string;
  confidence: number;
  pass: string;
}

/**
 * Reads a menu photo in the browser. Tesseract.js (an LSTM text-recognition model compiled to
 * WebAssembly) does the reading; we clean the image first, try a few page layouts, rebuild rows and
 * columns from word positions, and keep the reading that yields the most priced dishes.
 */
export async function scanMenu(file: Blob, known: IngredientConfig[], existing: string[], onProgress?: (p: number, step: string) => void): Promise<ScanResult> {
  onProgress?.(0, "Preparing photo");
  const img = await prepare(file);
  const { createWorker, PSM } = await import("tesseract.js");
  const passes = [
    { name: "cleaned · auto layout", src: img.clean, psm: PSM.AUTO },
    { name: "cleaned · sparse text", src: img.clean, psm: PSM.SPARSE_TEXT },
    { name: "original · auto layout", src: img.plain, psm: PSM.AUTO },
  ];
  let step = 0;
  const worker = await createWorker("eng", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.((step + m.progress) / passes.length, `Reading text (pass ${step + 1} of ${passes.length})`);
      else if (step === 0 && m.status.startsWith("loading")) onProgress?.(0, "Loading text reader");
    },
  });
  let best: ScanResult | null = null;
  let bestScore = -1;
  try {
    for (; step < passes.length; step++) {
      const p = passes[step];
      await worker.setParameters({ tessedit_pageseg_mode: p.psm, user_defined_dpi: "300", preserve_interword_spaces: "1" });
      const { data } = await worker.recognize(p.src, { rotateAuto: true }, { blocks: true, text: true });
      const words: Word[] = [];
      for (const b of data.blocks ?? []) for (const para of b.paragraphs) for (const line of para.lines) for (const w of line.words) words.push({ text: w.text, conf: w.confidence, ...w.bbox });
      const lines = wordsToLines(words);
      const drafts = parseMenuLines(lines, known, existing);
      const priced = drafts.filter((d) => d.price !== undefined).length;
      const score = priced * 3 + drafts.length * 0.3 + data.confidence / 50;
      if (score > bestScore) {
        bestScore = score;
        best = { drafts, text: lines.map((l) => l.text.replace(/\u2003/g, "   ")).join("\n"), confidence: Math.round(data.confidence), pass: p.name };
      }
      if (priced >= 3 && data.confidence >= 80) break;
    }
  } finally {
    await worker.terminate();
  }
  onProgress?.(1, "Done");
  return best ?? { drafts: [], text: "", confidence: 0, pass: "" };
}

/** Plain text reading of a photo (kept for comparisons). */
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
