import clsx from "clsx";
import { ArrowRight, ChefHat, KeyRound, Store } from "lucide-react";
import { useState } from "react";
import { normalizeCode } from "../../live/backend";
import { JOINABLE_ROLES, ROLES } from "../../live/roles";
import type { Role } from "../../live/types";
import { useTwin } from "../../store";

/** Sign-in for live mode: a manager opens a kitchen, other devices join it with a code and a role. */
export function LiveGate() {
  const { liveCreate, liveJoin, setMode } = useTwin.getState();
  const [tab, setTab] = useState<"join" | "create">(() => (new URLSearchParams(location.search).get("join") ? "join" : "create"));
  const [kitchen, setKitchen] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState(() => normalizeCode(new URLSearchParams(location.search).get("join") ?? ""));
  const [role, setRole] = useState<Role>("prep");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const canCreate = kitchen.trim() && name.trim();
  const canJoin = normalizeCode(code).length === 6 && name.trim();

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-[#eef1f7]/70 p-4">
      <div className="sidebar w-full max-w-[440px] p-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="size-2 rounded-full bg-ok" />
          <span className="section-label uppercase">Live kitchen</span>
        </div>
        <h1 className="text-[22px] font-extrabold tracking-tight">Sign in to your kitchen</h1>
        <p className="mt-1 text-mute">The manager opens the kitchen and shares a join code. Every other device (prep tablet, line, expo, host stand) joins with that code and a role.</p>

        <div className="mt-5 flex rounded-[9px] bg-navy/[0.06] p-0.5">
          {(
            [
              ["create", "I'm the manager", Store],
              ["join", "Join a kitchen", KeyRound],
            ] as const
          ).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={clsx("flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[7px] font-bold", tab === id ? "bg-white shadow-sm" : "text-mute")}>
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>

        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (tab === "create" && canCreate) void run(() => liveCreate(kitchen, name));
            if (tab === "join" && canJoin) void run(() => liveJoin(code, name, role));
          }}
        >
          {tab === "create" ? (
            <label className="block">
              <span className="section-label">Kitchen name</span>
              <input className="field mt-1" placeholder="e.g. Ripple Burgers, Main St." value={kitchen} onChange={(e) => setKitchen(e.target.value)} autoFocus />
            </label>
          ) : (
            <label className="block">
              <span className="section-label">Join code</span>
              <input
                className="field mt-1 font-mono text-[16px] tracking-[0.3em] uppercase"
                placeholder="ABC123"
                maxLength={7}
                value={code}
                onChange={(e) => setCode(normalizeCode(e.target.value).slice(0, 6))}
                autoFocus
              />
            </label>
          )}
          <label className="block">
            <span className="section-label">Your name</span>
            <input className="field mt-1" placeholder="e.g. Maria" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          {tab === "join" && (
            <div>
              <span className="section-label">This device is for</span>
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                {JOINABLE_ROLES.map((r) => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setRole(r)}
                    className={clsx("rounded-[9px] border px-2.5 py-2 text-left transition-colors", role === r ? "border-navy bg-navy text-white" : "border-navy/12 bg-white hover:bg-navy/[0.03]")}
                  >
                    <div className="flex items-center gap-1.5 font-extrabold">
                      {ROLES[r].station && <ChefHat className="size-3.5" />}
                      {ROLES[r].label}
                    </div>
                    <div className={clsx("mt-0.5 text-[11px] leading-snug", role === r ? "text-white/75" : "text-mute")}>{ROLES[r].description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {error && <p className="rounded-[8px] bg-crit/10 px-3 py-2 font-semibold text-crit">{error}</p>}
          <button type="submit" disabled={busy || !(tab === "create" ? canCreate : canJoin)} className="btn btn-navy h-9! w-full">
            {tab === "create" ? "Open the kitchen" : "Join the kitchen"}
            <ArrowRight className="size-4" />
          </button>
        </form>

        <button className="mt-4 text-[12px] font-bold text-accent" onClick={() => setMode("sim")}>
          Back to the simulation
        </button>
      </div>
    </div>
  );
}
