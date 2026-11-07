import clsx from "clsx";
import { Plus } from "lucide-react";
import { useState } from "react";
import { haptic } from "../lib/haptics";
import { slug } from "../lib/menuScan";
import { useCan, useTwin } from "../store";

function AddIngredient({ onDone }: { onDone: () => void }) {
  const cfg = useTwin((s) => s.kitchen.config);
  const act = useTwin((s) => s.act);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("portions");
  const [stock, setStock] = useState("20");
  const bare = cfg.menu.filter((m) => !Object.keys(m.ingredients).length).map((m) => m.id);
  const [used, setUsed] = useState<string[]>(bare);
  const menu = [...cfg.menu].sort((a, b) => Number(bare.includes(b.id)) - Number(bare.includes(a.id)));
  let id = slug(name);
  const taken = cfg.ingredients.find((i) => i.id === id);
  if (taken && taken.name.toLowerCase() !== name.trim().toLowerCase()) id = `${id}_2`;
  const exists = cfg.ingredients.some((i) => i.name.toLowerCase() === name.trim().toLowerCase());
  const n = Number(stock);
  const ok = name.trim().length >= 2 && !exists && Number.isFinite(n) && n >= 0;
  const save = () => {
    if (!ok) return haptic("error");
    void act({ type: "ingredient_added", ingredient: { id, name: name.trim(), unit: unit.trim() || "portions", stock: n, usedIn: used } });
    haptic("success");
    onDone();
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="mb-2 space-y-2 rounded-[12px] bg-white p-3 shadow-[var(--shadow-card)]"
    >
      <div className="text-[12px] font-extrabold text-mute">New ingredient</div>
      <input autoFocus className="field w-full font-bold" placeholder="e.g. Avocado" value={name} onChange={(e) => setName(e.target.value)} aria-label="Ingredient name" />
      {exists && <p className="text-[11.5px] font-semibold text-crit">Already in the pantry. Click its number below to recount it.</p>}
      <div className="flex gap-1.5">
        <label className="flex-1 text-[11px] font-bold text-faint">
          On hand
          <input type="number" min={0} className="field mt-0.5 w-full font-bold text-ink tabular-nums" value={stock} onChange={(e) => setStock(e.target.value)} />
        </label>
        <label className="flex-1 text-[11px] font-bold text-faint">
          Unit
          <input className="field mt-0.5 w-full font-bold text-ink" list="ripple-units" value={unit} onChange={(e) => setUnit(e.target.value)} />
          <datalist id="ripple-units">
            {["portions", "pcs", "oz", "lb", "slices", "cups", "bags"].map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </label>
      </div>
      <div>
        <div className="text-[11px] font-bold text-faint">Used in (1 per dish)</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {menu.map((m) => {
            const on = used.includes(m.id);
            return (
              <button
                type="button"
                key={m.id}
                onClick={() => setUsed(on ? used.filter((x) => x !== m.id) : [...used, m.id])}
                className={clsx("rounded-full border px-2 py-0.5 text-[11.5px] font-bold", on ? "border-navy bg-navy text-white" : "border-navy/12 text-mute hover:bg-navy/[0.05]")}
                title={bare.includes(m.id) ? "No ingredients yet" : undefined}
              >
                {m.name}
                {bare.includes(m.id) && <span className={clsx("ml-1", on ? "text-white/70" : "text-warn")}>•</span>}
              </button>
            );
          })}
        </div>
        {bare.length > 0 && <p className="mt-1 text-[11px] text-faint">• dishes with no ingredients yet (selected by default)</p>}
      </div>
      <div className="flex justify-end gap-1.5">
        <button type="button" className="btn h-8!" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn btn-navy h-8!" disabled={!ok}>
          <Plus className="size-4" /> Add to pantry
        </button>
      </div>
    </form>
  );
}

/** Manager-only "Add ingredient" entry point, plus a nudge when dishes have nothing tracked. */
export function PantryAdd() {
  const menu = useTwin((s) => s.kitchen.config.menu);
  const canAdd = useCan("manage_menu");
  const [adding, setAdding] = useState(false);
  if (!canAdd) return null;
  if (adding) return <AddIngredient onDone={() => setAdding(false)} />;
  const bare = menu.filter((m) => !Object.keys(m.ingredients).length);
  return (
    <div className="mb-2 space-y-2">
      <button className="btn h-9! w-full" onClick={() => setAdding(true)}>
        <Plus className="size-4" /> Add ingredient
      </button>
      {bare.length > 0 && (
        <p className="rounded-[8px] bg-warn/10 px-2 py-1.5 text-[11.5px] font-semibold text-ink">
          {bare.length === 1 ? `${bare[0].name} has` : `${bare.length} dishes have`} no ingredients yet, so stock isn't tracked for {bare.length === 1 ? "it" : "them"}.
        </p>
      )}
    </div>
  );
}
