import { AnimatePresence, motion } from "framer-motion";
import { useTwin, type Tab } from "../store";
import { AskTab } from "./AskTab";
import { PantryTab } from "./PantryTab";
import { PlanTab } from "./PlanTab";
import { Segmented } from "./Panel";

export function SidePanel() {
  const tab = useTwin((s) => s.tab);
  const setTab = useTwin((s) => s.setTab);
  const disrupted = useTwin((s) => s.state.phase === "disrupted");
  const short = useTwin((s) => s.state.inventory.filter((i) => i.short).length);
  return (
    <aside className="glass flex flex-col rounded-[32px] xl:sticky xl:top-4 xl:max-h-[calc(100vh-6.5rem)]">
      <div className="p-4 pb-2">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          className="flex w-full [&>button]:flex-1 [&>button]:justify-center"
          options={[
            { value: "plan", label: <>Plan{disrupted && <span className="size-2 animate-pulse rounded-full bg-crit" />}</> },
            { value: "ask", label: "Ask AI" },
            { value: "pantry", label: <>Pantry{short > 0 && <span className="rounded-full bg-crit px-1.5 text-[10px] text-white">{short}</span>}</> },
          ]}
        />
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="pt-2">
            {tab === "plan" ? <PlanTab /> : tab === "ask" ? <AskTab /> : <PantryTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </aside>
  );
}
