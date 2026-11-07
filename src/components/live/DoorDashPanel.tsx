import { Copy, Minus, Plus, Send } from "lucide-react";
import { useState } from "react";
import { haptic } from "../../lib/haptics";
import { minutes } from "../../lib/ui";
import { backend, DOORDASH_ACTOR } from "../../live/backend";
import { useTwin } from "../../store";

const CUSTOMERS = ["Sam L.", "Riley P.", "Jordan K.", "Taylor B.", "Casey M.", "Morgan D.", "Avery S.", "Quinn H."];
const DASHERS = ["Alex R.", "Priya S.", "Marcus T.", "Jin W.", "Sofia M.", "Omar K.", "Hana L.", "Diego P."];
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/** DoorDash intake: a test-order sender for demos plus the webhook details for the real integration. */
export function DoorDashPanel() {
  const menu = useTwin((s) => s.kitchen.config.menu);
  const orders = useTwin((s) => s.state.orders);
  const session = useTwin((s) => s.live.session);
  const liveDo = useTwin((s) => s.liveDo);
  const [copied, setCopied] = useState(false);
  const delivery = orders.filter((o) => o.dasher && o.status !== "ready").slice(0, 4);

  const sendTest = async () => {
    const n = Math.random() < 0.6 ? 1 : 2;
    const items = Array.from({ length: n }, () => ({ menuItemId: pick(menu).id, qty: Math.random() < 0.7 ? 1 : 2 }));
    const merged = items.reduce<{ menuItemId: string; qty: number }[]>((acc, it) => {
      const e = acc.find((x) => x.menuItemId === it.menuItemId);
      if (e) e.qty += it.qty;
      else acc.push({ ...it });
      return acc;
    }, []);
    const ok = await liveDo(
      {
        type: "order_received",
        source: "doordash",
        customer: pick(CUSTOMERS),
        items: merged,
        dasherName: pick(DASHERS),
        dasherEtaMinutes: 10 + Math.round(Math.random() * 16),
        externalId: `dd-test-${crypto.randomUUID().slice(0, 8)}`,
      },
      DOORDASH_ACTOR,
    );
    if (ok) haptic("success");
  };

  const shift = (orderId: string, current: number, d: number) =>
    void liveDo({ type: "dasher_update", orderId, etaMinutes: Math.max(0, Math.round(current + d)) }, DOORDASH_ACTOR);

  const url = `${location.origin}/api/doordash`;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-[7px] bg-[#ff3008] text-[11px] font-black text-white">D</span>
        <div className="font-extrabold">DoorDash orders</div>
      </div>
      <button className="btn h-9! w-full" onClick={() => void sendTest()}>
        <Send className="size-4" /> Send a test DoorDash order
      </button>
      {delivery.length > 0 && (
        <div>
          <div className="section-label mb-1">Dasher ETA (simulate a late or early courier)</div>
          {delivery.map((o) => (
            <div key={o.id} className="flex items-center gap-2 py-1">
              <span className="font-extrabold">{o.label}</span>
              <span className="min-w-0 flex-1 truncate text-mute">{o.dasher!.name}</span>
              <button className="tbtn h-7! min-w-7! p-0!" onClick={() => shift(o.id, o.dasher!.etaMinutes, -5)} aria-label="Dasher 5 minutes earlier">
                <Minus className="size-3.5" />
              </button>
              <span className="w-11 text-center font-bold tabular-nums">{minutes(o.dasher!.etaMinutes)}</span>
              <button className="tbtn h-7! min-w-7! p-0!" onClick={() => shift(o.id, o.dasher!.etaMinutes, 5)} aria-label="Dasher 5 minutes later">
                <Plus className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="rounded-[10px] bg-navy/[0.05] p-2.5 text-[11.5px] text-mute">
        <div className="font-bold text-ink">Real orders</div>
        {backend.kind === "hosted" ? (
          <>
            DoorDash (or any integration) can POST signed order webhooks to <span className="font-mono text-ink">{url}</span> with store id{" "}
            <span className="font-mono font-bold text-ink">{session?.kitchen.joinCode}</span>.
            <button
              className="mt-1.5 flex items-center gap-1 font-bold text-accent"
              onClick={() => {
                void navigator.clipboard?.writeText(url);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }}
            >
              <Copy className="size-3" /> {copied ? "Copied" : "Copy webhook URL"}
            </button>
          </>
        ) : (
          <>Connect Supabase to receive real DoorDash webhooks. In this local preview, use test orders.</>
        )}
      </div>
    </div>
  );
}
