import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, Compass, Radio, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { useTwin } from "../store";

type Entry = [term: string, meaning: string];
interface Topic {
  id: string;
  label: string;
  icon: typeof Compass;
  intro: string;
  groups: { title: string; entries: Entry[] }[];
}

const TOPICS: Topic[] = [
  {
    id: "nav",
    label: "Getting around",
    icon: Compass,
    intro: "The 3D kitchen in the middle is the whole restaurant. Orders flow left to right: Orders in → Pantry → Prep → Cook → Pack → Pickup.",
    groups: [
      {
        title: "3D kitchen",
        entries: [
          ["Orbit", "Drag with the mouse or one finger to look around."],
          ["Zoom", "Scroll, pinch, or use + / − in the bottom bar. Zoom heads toward your pointer."],
          ["Pan", "Right-drag or drag with two fingers to slide the view."],
          ["Open a station", "Click a station or its label. The camera flies there and its status opens in the inspector."],
          ["Step through", "The arrows in the bottom bar move to the previous / next station. The frame button returns to the whole kitchen."],
          ["Colors", "Gray means fine. Amber rings mean at risk, red means over capacity or late. A blue path traces the order you selected."],
        ],
      },
      {
        title: "Toolbar",
        entries: [
          ["Live / Simulation", "Live is your real kitchen, updated by your team's devices. Simulation is a seeded practice kitchen you can speed up, rush and reset."],
          ["Alert bar", "Shows how the kitchen is doing. Click it for what just changed and the actions that need doing now."],
          ["Reset, play, 1× 2× 4×, Rush order", "Simulation only: restart, pause, change speed, or drop a large rush order in."],
          ["Panel buttons", "Hide or show the navigator (left) and inspector (right)."],
        ],
      },
      {
        title: "Side panels",
        entries: [
          ["Navigator (left)", "Kitchen tree, Orders, Pantry (stock recount), Issues, Activity, and in live mode Team."],
          ["Inspector (right)", "Status of the selected station or order. The Plan tab compares response strategies, and Ask AI runs what-ifs."],
          ["Tracing an order", "Click any order to see its path and which station is slowing it down."],
        ],
      },
    ],
  },
  {
    id: "stats",
    label: "What the numbers mean",
    icon: BarChart3,
    intro: "Every number comes from the same deterministic model of the kitchen. AI never calculates them.",
    groups: [
      {
        title: "Stations",
        entries: [
          ["Load %", "Queued work divided by what the station's staff can finish in the planning window (the next 10 minutes). Over 100% means more work than people."],
          ["Queued work", "Minutes of work waiting at that station for all open orders."],
          ["Staff", "People assigned to the station. Capacity scales with staff."],
          ["Peak load", "The highest load of any station. It is the first number to watch during a rush."],
        ],
      },
      {
        title: "Orders",
        entries: [
          ["Pickup in", "Minutes until the time promised to the customer or driver."],
          ["Ready in", "Projected minutes until the order is packed, given everything ahead of it."],
          ["On track", "Ready before the pickup time with room to spare."],
          ["At risk", "Ready, but with less than a few minutes of slack. One delay makes it late."],
          ["Late", "Projected to be ready after the promised pickup time."],
          ["Held", "Paused on purpose, usually because an ingredient is short. A manager releases or cancels it."],
          ["Deferred", "Will start once the overloaded station frees up, to protect other orders."],
          ["Blocked", "Can't start because an ingredient has run out."],
        ],
      },
      {
        title: "Pantry and plans",
        entries: [
          ["On hand / need", "Stock counted in the pantry vs. what open orders still need. Need above on hand means short."],
          ["Projected late / at risk", "How many open orders will end up late or at risk if the kitchen keeps going as it is (or under the plan you're previewing)."],
          ["Repeated prep", "Prep steps done more than once that batching could combine."],
          ["Best option", "The plan with the fewest late orders, then fewest at risk, then lowest peak load."],
        ],
      },
    ],
  },
  {
    id: "plans",
    label: "Plans & Ask AI",
    icon: Sparkles,
    intro: "When a ripple hits (a shortage, overload or late orders), the twin compares three responses. Nothing changes until a manager approves one.",
    groups: [
      {
        title: "Plans",
        entries: [
          ["Protect Pickup Times", "Orders run by pickup deadline, and orders that can't be made are held for review."],
          ["Reduce Kitchen Overload", "Defers some new orders until the busiest station frees up."],
          ["Minimize Waste", "Uses the most perishable ingredients first and batches repeated prep."],
          ["Preview", "Selecting a plan shows its effect in 3D (purple 'plan' tags) without changing anything."],
        ],
      },
      {
        title: "Ask AI",
        entries: [
          ["What-ifs", "Type something like \u201c20 customers walk in\u201d or \u201ca cook calls out sick\u201d. The twin plays it out on a copy of the kitchen."],
          ["Results", "Before/after numbers, station loads, shortages and ranked responses. AI only rewords the explanation."],
        ],
      },
    ],
  },
  {
    id: "live",
    label: "Live kitchen & roles",
    icon: Radio,
    intro: "In live mode each device signs in with a role. Updates from any device appear on every other device right away.",
    groups: [
      {
        title: "Signing in",
        entries: [
          ["Manager", "Opens the kitchen and gets a 6-character join code. Sees the full twin, approves plans, releases or cancels held orders, and manages the team."],
          ["Joining", "Other devices choose Live → Join a kitchen, enter the code and pick a role."],
        ],
      },
      {
        title: "Roles",
        entries: [
          ["Prep", "Sees tickets waiting for prep and taps Prep done to send each one to Cook. Can recount pantry stock."],
          ["Line cook", "Taps Cooked to send an order to Pack."],
          ["Expo / Pack", "Taps Packed to put an order on the ready shelf, then Handed off when it's picked up."],
          ["Host", "Enters walk-in and phone orders and hands off pickups."],
          ["Whole kitchen", "Any role can open the read-only 3D twin from the account menu."],
        ],
      },
    ],
  },
];

export function HelpSheet() {
  const open = useTwin((s) => s.helpOpen);
  const setHelp = useTwin((s) => s.setHelp);
  const [topic, setTopic] = useState(TOPICS[0].id);
  const t = TOPICS.find((x) => x.id === topic) ?? TOPICS[0];
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1b2c56]/25 p-4" onClick={() => setHelp(false)}>
          <motion.div
            initial={{ y: 12, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 12, scale: 0.98 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Help"
            className="sidebar flex h-[min(680px,90vh)] w-full max-w-[860px] overflow-hidden bg-[#f7f9fc]/95!"
          >
            <nav className="hidden w-[210px] shrink-0 border-r border-line p-2.5 sm:block">
              <div className="px-2 pt-1 pb-3 text-[15px] font-extrabold">Help</div>
              {TOPICS.map((x) => (
                <button key={x.id} onClick={() => setTopic(x.id)} className={clsx("flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left font-bold", x.id === topic ? "bg-navy text-white" : "hover:bg-navy/[0.05]")}>
                  <x.icon className="size-4" />
                  {x.label}
                </button>
              ))}
            </nav>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start gap-3 border-b border-line px-5 py-4">
                <div className="min-w-0 flex-1">
                  <select className="field mb-2 sm:hidden" value={topic} onChange={(e) => setTopic(e.target.value)}>
                    {TOPICS.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                  <h2 className="text-[18px] font-extrabold">{t.label}</h2>
                  <p className="mt-0.5 text-mute">{t.intro}</p>
                </div>
                <button className="tbtn" onClick={() => setHelp(false)} aria-label="Close help">
                  <X className="size-4" />
                </button>
              </div>
              <div className="scroll-thin flex-1 space-y-5 overflow-y-auto px-5 py-4">
                {t.groups.map((g) => (
                  <section key={g.title}>
                    <div className="section-label mb-1.5 uppercase">{g.title}</div>
                    <dl className="card divide-y divide-line">
                      {g.entries.map(([term, meaning]) => (
                        <div key={term} className="grid gap-1 px-3 py-2 sm:grid-cols-[170px_1fr] sm:gap-4">
                          <dt className="font-extrabold">{term}</dt>
                          <dd className="text-mute">{meaning}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
