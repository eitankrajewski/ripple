import { Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { ROLES } from "../../live/roles";
import { useTwin } from "../../store";

/** Manager's view of who is signed in to this kitchen and how to add devices. */
export function TeamPanel() {
  const session = useTwin((s) => s.live.session);
  const members = useTwin((s) => s.live.members);
  const presence = useTwin((s) => s.live.presence);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 3000);
    return () => window.clearInterval(id);
  }, []);
  if (!session) return <p className="px-1 text-mute">Sign in to a live kitchen to see your team.</p>;
  const link = `${location.origin}${location.pathname}?join=${session.kitchen.joinCode}`;
  const online = (id: string) => now - (presence[id] ?? 0) < 12000;
  return (
    <div className="space-y-3 px-1">
      <div className="card p-3">
        <div className="section-label">Join code</div>
        <div className="mt-0.5 font-mono text-[22px] font-extrabold tracking-[0.25em]">{session.kitchen.joinCode}</div>
        <p className="mt-1 text-[11.5px] text-mute">On another device, choose Live → Join a kitchen and enter this code, or open the invite link.</p>
        <button
          className="btn mt-2 w-full"
          onClick={() => {
            void navigator.clipboard?.writeText(link);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
        >
          <Copy className="size-3.5" /> {copied ? "Copied" : "Copy invite link"}
        </button>
      </div>
      <div>
        <div className="section-label mb-1">Signed in · {members.length}</div>
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-2 rounded-[8px] px-1.5 py-1.5">
            <span className={`size-2 rounded-full ${online(m.id) ? "bg-ok" : "bg-faint/60"}`} />
            <span className="min-w-0 flex-1 truncate font-bold">
              {m.name}
              {m.id === session.me.id && <span className="font-semibold text-faint"> (you)</span>}
            </span>
            <span className="rounded-full bg-navy/[0.06] px-2 py-0.5 text-[11px] font-bold text-mute">{ROLES[m.role].label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
