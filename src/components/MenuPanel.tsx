import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Check, Loader2, Plus, ScanText, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { StationId } from "../engine/types";
import { haptic } from "../lib/haptics";
import { guessMinutes, parseMenuText, scanMenu, slug, suggestIngredients, type MenuDraft, type ScanResult } from "../lib/menuScan";
import { useTwin } from "../store";
import { RemoveButton } from "./kit";

const STATIONS: StationId[] = ["prep", "cook", "pack"];

function Chip({ on, fresh, children, onClick }: { on: boolean; fresh?: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-bold",
        on ? (fresh ? "border-accent bg-accent text-white" : "border-navy bg-navy text-white") : fresh ? "border-dashed border-accent/50 text-accent hover:bg-accent/[0.06]" : "border-navy/12 text-mute hover:bg-navy/[0.05]",
      )}
    >
      {children}
      {fresh && <span className={clsx("text-[10px] font-extrabold uppercase", on ? "text-white/80" : "text-accent/70")}>new</span>}
    </button>
  );
}

function DraftEditor({ d, onChange }: { d: MenuDraft; onChange: (d: MenuDraft) => void }) {
  const ingredients = useTwin((s) => s.kitchen.config.ingredients);
  const [custom, setCustom] = useState("");
  const toggle = (id: string) => {
    const next = { ...d.ingredients };
    if (next[id]) delete next[id];
    else next[id] = 1;
    onChange({ ...d, ingredients: next, touched: true });
  };
  const addCustom = () => {
    const name = custom.trim();
    if (name.length < 2) return;
    const have = ingredients.find((i) => i.name.toLowerCase() === name.toLowerCase());
    const prior = Object.entries(d.fresh ?? {}).find(([, n]) => n.toLowerCase() === name.toLowerCase());
    let id = have?.id ?? prior?.[0] ?? slug(name);
    if (!have && !prior) while (ingredients.some((i) => i.id === id)) id = `${id}_2`;
    onChange({ ...d, ingredients: { ...d.ingredients, [id]: 1 }, fresh: have ? d.fresh : { ...d.fresh, [id]: prior?.[1] ?? name[0].toUpperCase() + name.slice(1) }, touched: true });
    setCustom("");
  };
  const fresh = Object.entries(d.fresh ?? {}).filter(([id]) => !ingredients.some((i) => i.id === id));
  return (
    <div className={clsx("rounded-[10px] border bg-white p-3", d.keep ? "border-navy/15" : "border-dashed border-navy/12 opacity-60")}>
      <div className="flex items-center gap-2">
        <button onClick={() => onChange({ ...d, keep: !d.keep })} className={clsx("flex size-6 shrink-0 items-center justify-center rounded-[7px] border-2", d.keep ? "border-ok bg-ok text-white" : "border-navy/25")} aria-label="Include">
          {d.keep && <Check className="size-4" strokeWidth={3} />}
        </button>
        <input className="field min-w-0 flex-1 font-bold" value={d.name} placeholder="Dish name, e.g. Margherita Pizza" onChange={(e) => onChange({ ...d, name: e.target.value })} />
        {d.price !== undefined && <span className="shrink-0 font-bold text-mute tabular-nums">${d.price.toFixed(2)}</span>}
      </div>
      {d.description && <p className="mt-1 truncate pl-8 text-[11.5px] text-mute">{d.description}</p>}
      <div className="mt-2 flex flex-wrap gap-1">
        {fresh.map(([id, name]) => (
          <Chip key={id} fresh on={!!d.ingredients[id]} onClick={() => toggle(id)}>
            {name}
          </Chip>
        ))}
        {ingredients.map((i) => (
          <Chip key={i.id} on={!!d.ingredients[i.id]} onClick={() => toggle(i.id)}>
            {i.name}
          </Chip>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addCustom();
          }}
          className="flex items-center"
        >
          <input className="h-[22px] w-28 rounded-full border border-dashed border-navy/20 bg-transparent px-2 text-[11.5px] font-bold outline-none focus:border-accent" placeholder="+ ingredient" value={custom} onChange={(e) => setCustom(e.target.value)} onBlur={addCustom} aria-label="Add an ingredient" />
        </form>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[11.5px] font-bold text-mute">
        {STATIONS.map((st) => (
          <label key={st} className="flex items-center gap-1 capitalize">
            {st}
            <input type="number" min={0} step={0.1} className="field h-7! w-16 tabular-nums" value={d.minutes[st]} onChange={(e) => onChange({ ...d, minutes: { ...d.minutes, [st]: Math.max(0, Number(e.target.value) || 0) } })} />
            min
          </label>
        ))}
      </div>
    </div>
  );
}

/** Ticked "new" ingredients across the kept drafts, which saving adds to the pantry. */
function newIngredients(drafts: MenuDraft[], known: { id: string }[]) {
  const out = new Map<string, string>();
  for (const d of drafts)
    if (d.keep && d.name.trim())
      for (const [id, name] of Object.entries(d.fresh ?? {})) if (d.ingredients[id] && !known.some((i) => i.id === id)) out.set(id, name);
  return [...out];
}

function MenuSheet({ mode, onClose }: { mode: "add" | "scan"; onClose: () => void }) {
  const cfg = useTwin((s) => s.kitchen.config);
  const act = useTwin((s) => s.act);
  const blank = (): MenuDraft => ({ id: "", name: "", ingredients: {}, minutes: { prep: 1.2, cook: 2, pack: 0.4 }, keep: true });
  const [drafts, setDrafts] = useState<MenuDraft[]>(mode === "add" ? [blank()] : []);
  const [progress, setProgress] = useState<{ p: number; step: string } | null>(null);
  const [read, setRead] = useState<Omit<ScanResult, "drafts"> | null>(null);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const existing = cfg.menu.filter((m) => !m.retired).map((m) => m.id);

  const show = (found: MenuDraft[]) => {
    setDrafts(found);
    setError(found.length ? "" : "No menu items found. Try a straighter, closer photo, or paste the text below.");
  };
  const fromText = (t: string) => show(parseMenuText(t, cfg.ingredients, existing));
  const scan = async (file?: File) => {
    if (!file) return;
    setError("");
    setProgress({ p: 0, step: "Preparing photo" });
    try {
      const { drafts: found, ...info } = await scanMenu(file, cfg.ingredients, existing, (p, step) => setProgress({ p, step }));
      setRead(info);
      setText(info.text);
      show(found);
    } catch {
      setError("Couldn't read that image. Check your connection (the text reader downloads once) or paste the menu text instead.");
    } finally {
      setProgress(null);
    }
  };
  const [stock, setStock] = useState<Record<string, string>>({});
  const created = newIngredients(drafts, cfg.ingredients);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const keep = drafts.filter((d) => d.keep && d.name.trim());
    if (!keep.length) return haptic("error");
    setSaving(true);
    for (const [id, name] of created) {
      const n = Number(stock[id] ?? 20);
      await act({ type: "ingredient_added", ingredient: { id, name, unit: "portions", stock: Number.isFinite(n) && n >= 0 ? n : 20 } });
    }
    const taken = new Set(existing);
    for (const d of keep) {
      let id = d.id || slug(d.name);
      if (mode === "add") while (taken.has(id)) id = `${id}_2`;
      taken.add(id);
      await act({ type: "menu_item_added", item: { id, name: d.name.trim(), ingredients: d.ingredients, minutes: d.minutes } });
    }
    haptic("success");
    onClose();
  };
  const kept = drafts.filter((d) => d.keep && d.name.trim()).length;

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1b2c56]/25 p-3" onClick={onClose}>
      <motion.div initial={{ y: 12, scale: 0.98 }} animate={{ y: 0, scale: 1 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Menu" className="sidebar flex max-h-[90vh] w-full max-w-[620px] flex-col overflow-hidden bg-[#f7f9fc]/95!">
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-extrabold">{mode === "add" ? "Add a menu item" : "Scan a menu"}</div>
            <p className="mt-0.5 text-mute">
              {mode === "add"
                ? "Ingredients link the dish to the pantry; minutes set how long each station spends on it."
                : "Take or upload a photo. The text is read on this device, then you check every item before it's added."}
            </p>
          </div>
          <button className="tbtn" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="scroll-thin min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          {mode === "scan" && (
            <>
              <label className={clsx("flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-[12px] border-2 border-dashed border-navy/20 bg-white text-mute hover:border-navy/40", progress !== null && "pointer-events-none")}>
                {progress !== null ? (
                  <>
                    <Loader2 className="size-5 animate-spin text-navy" />
                    <span className="font-bold">
                      {progress.step}… {Math.round(progress.p * 100)}%
                    </span>
                  </>
                ) : (
                  <>
                    <Camera className="size-5 text-navy" />
                    <span className="font-bold text-ink">Take a photo or choose an image</span>
                    <span className="text-[11.5px]">Works best flat, well lit, one page at a time</span>
                  </>
                )}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void scan(e.target.files?.[0])} />
              </label>
              <details className="rounded-[10px] bg-white/70 px-3 py-2">
                <summary className="cursor-pointer font-bold text-mute">
                  {read ? `What the scanner read · ${read.confidence}% confidence · ${read.pass}` : "Or paste menu text"}
                </summary>
                {read && <p className="mt-1 text-[11.5px] text-mute">Fix any misread words here and press Find items again.</p>}
                <textarea className="field mt-2 h-28! w-full py-2" value={text} onChange={(e) => setText(e.target.value)} placeholder={"Chicken Caesar Wrap  $11.50\nDouble Cheeseburger  $13.00"} />
                <button className="btn mt-2" onClick={() => fromText(text)}>
                  Find items
                </button>
              </details>
              {error && <p className="font-semibold text-crit">{error}</p>}
              {drafts.length > 0 && <div className="pt-1 text-[12px] font-extrabold text-mute">{drafts.length} found · untick anything that isn't a dish</div>}
            </>
          )}
          {drafts.map((d, i) => (
            <DraftEditor key={i} d={d} onChange={(n) => setDrafts(drafts.map((x, j) => (j === i ? (mode === "add" && n.name !== x.name && !n.touched ? { ...n, ...suggestIngredients(n.name, cfg.ingredients), minutes: guessMinutes(n.name) } : n) : x)))} />
          ))}
          {mode === "add" && (
            <button className="btn w-full" onClick={() => setDrafts([...drafts, blank()])}>
              <Plus className="size-4" /> Another item
            </button>
          )}
          {created.length > 0 && (
            <div className="rounded-[10px] bg-accent/[0.06] p-3">
              <div className="text-[12px] font-extrabold text-ink">Also adds {created.length === 1 ? "1 ingredient" : `${created.length} ingredients`} to the Pantry</div>
              <p className="mt-0.5 text-[11.5px] text-mute">Set how many portions you have on hand now. You can recount any of them in the Pantry later.</p>
              <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {created.map(([id, name]) => (
                  <label key={id} className="flex items-center gap-2 rounded-[8px] bg-white px-2 py-1 font-bold shadow-[var(--shadow-card)]">
                    <span className="min-w-0 flex-1 truncate">{name}</span>
                    <input type="number" min={0} className="field h-7! w-16 tabular-nums" value={stock[id] ?? "20"} onChange={(e) => setStock({ ...stock, [id]: e.target.value })} aria-label={`${name} on hand`} />
                    <span className="text-[11px] font-semibold text-faint">portions</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-navy" disabled={!kept || saving} onClick={() => void save()}>
            <Check className="size-4" strokeWidth={3} /> Add {kept || ""} to menu
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

/** Manager-only menu: what the kitchen can make, plus adding or scanning new dishes. */
export function MenuPanel() {
  const cfg = useTwin((s) => s.kitchen.config);
  const act = useTwin((s) => s.act);
  const [sheet, setSheet] = useState<"add" | "scan" | null>(null);
  const name = (id: string) => cfg.ingredients.find((i) => i.id === id)?.name.toLowerCase() ?? id;
  return (
    <div className="space-y-2 px-1.5">
      <div className="grid grid-cols-2 gap-1.5 pt-1">
        <button className="btn h-9!" onClick={() => setSheet("add")}>
          <Plus className="size-4" /> Add item
        </button>
        <button className="btn btn-navy h-9!" onClick={() => setSheet("scan")}>
          <ScanText className="size-4" /> Scan menu
        </button>
      </div>
      <ul>
        {cfg.menu.filter((m) => !m.retired).map((m) => (
          <li key={m.id} className="rounded-[7px] px-1.5 py-1.5 hover:bg-navy/[0.04]">
            <div className="flex items-center gap-2 font-bold">
              <span className="min-w-0 flex-1 truncate">{m.name}</span>
              <span className="shrink-0 text-[11px] font-semibold text-faint tabular-nums">{Math.round((m.minutes.prep + m.minutes.cook + m.minutes.pack) * 10) / 10}m</span>
              <RemoveButton label={m.name} onRemove={() => void act({ type: "menu_item_removed", menuItemId: m.id })} />
            </div>
            <div className="truncate text-[11.5px] font-semibold text-mute">{Object.keys(m.ingredients).map(name).join(", ") || <span className="text-warn">no ingredients yet · add them in Pantry</span>}</div>
          </li>
        ))}
      </ul>
      <AnimatePresence>{sheet && <MenuSheet key={sheet} mode={sheet} onClose={() => setSheet(null)} />}</AnimatePresence>
    </div>
  );
}
