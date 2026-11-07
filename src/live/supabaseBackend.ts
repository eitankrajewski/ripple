import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { actorFor, normalizeCode, uid, type LiveBackend, type Presence } from "./backend";
import { allowed } from "./roles";
import type { Actor, KitchenSpace, LiveAction, LiveEvent, LiveSession, Member, Role } from "./types";

const SESSION = "ripple.live.session";

interface KitchenRow {
  id: string;
  name: string;
  join_code: string;
  owner_id: string;
  created_at: string;
}
interface MemberRow {
  id: string;
  name: string;
  role: Role;
  joined_at: string;
}
interface EventRow {
  id: string;
  kitchen_id: string;
  at: number;
  ts: number | string;
  actor: Actor;
  action: LiveAction;
}

const toKitchen = (k: KitchenRow): KitchenSpace => ({ id: k.id, name: k.name, joinCode: k.join_code, ownerId: k.owner_id, createdAt: Date.parse(k.created_at) });
const toMember = (m: MemberRow): Member => ({ id: m.id, name: m.name, role: m.role, joinedAt: Date.parse(m.joined_at) });
const toEvent = (r: EventRow): LiveEvent => ({ id: r.id, kitchenId: r.kitchen_id, at: r.at, ts: Number(r.ts), actor: r.actor, action: r.action });

function friendly(e: { message?: string } | null) {
  const msg = e?.message ?? "Something went wrong.";
  if (/anonymous/i.test(msg)) return "Anonymous sign-ins are turned off for this Supabase project.";
  return msg;
}

/**
 * Hosted backend: Supabase Auth (anonymous device sign-in), Postgres tables guarded by
 * row-level security, and Realtime for events + presence. See supabase/migrations.
 */
export class SupabaseBackend implements LiveBackend {
  readonly kind = "hosted" as const;
  private seq = 0;
  private device = uid(8);
  private clientPromise: Promise<SupabaseClient> | null = null;
  private url: string;
  private key: string;

  constructor(url: string, key: string) {
    this.url = url;
    this.key = key;
  }

  private client() {
    this.clientPromise ??= import("@supabase/supabase-js").then(({ createClient }) => createClient(this.url, this.key, { auth: { persistSession: true, autoRefreshToken: true } }));
    return this.clientPromise;
  }

  private async authed() {
    const sb = await this.client();
    const { data } = await sb.auth.getSession();
    if (!data.session) {
      const { error } = await sb.auth.signInAnonymously();
      if (error) throw new Error(friendly(error));
    }
    return sb;
  }

  private save(s: LiveSession | null) {
    if (s) sessionStorage.setItem(SESSION, JSON.stringify(s));
    else sessionStorage.removeItem(SESSION);
  }

  resume() {
    const raw = sessionStorage.getItem(SESSION);
    return raw ? (JSON.parse(raw) as LiveSession) : null;
  }

  private async enter(fn: "create_kitchen" | "join_kitchen", args: Record<string, string>) {
    const sb = await this.authed();
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw new Error(friendly(error));
    const { kitchen, member } = data as { kitchen: KitchenRow; member: MemberRow };
    const session: LiveSession = { kitchen: toKitchen(kitchen), me: toMember(member) };
    this.save(session);
    await this.publish(session, { type: "member_joined", member: session.me });
    return session;
  }

  createKitchen(kitchenName: string, managerName: string) {
    return this.enter("create_kitchen", { p_name: kitchenName, p_manager_name: managerName });
  }

  joinKitchen(joinCode: string, name: string, role: Role) {
    return this.enter("join_kitchen", { p_code: normalizeCode(joinCode), p_name: name, p_role: role });
  }

  async leave(session: LiveSession) {
    try {
      await this.publish(session, { type: "member_left", memberId: session.me.id });
      const sb = await this.authed();
      await sb.rpc("leave_kitchen", { p_member: session.me.id });
    } finally {
      this.save(null);
    }
  }

  async load(kitchenId: string) {
    const sb = await this.authed();
    const { data, error } = await sb.from("events").select("*").eq("kitchen_id", kitchenId).order("at").order("ts").limit(10000);
    if (error) {
      this.save(null);
      throw new Error(friendly(error));
    }
    return (data as EventRow[]).map(toEvent);
  }

  async publish(session: LiveSession, action: LiveAction, as?: Actor) {
    const actor = actorFor(session, as);
    if (!allowed(actor.role, action)) throw new Error("Your role can't do that.");
    const event: LiveEvent = {
      id: `${this.device}:${Date.now().toString(36)}:${++this.seq}`,
      kitchenId: session.kitchen.id,
      at: Math.max(0, Math.floor((Date.now() - session.kitchen.createdAt) / 1000)),
      ts: Date.now(),
      actor,
      action,
    };
    const sb = await this.authed();
    const { error } = await sb.from("events").insert({ id: event.id, kitchen_id: event.kitchenId, at: event.at, ts: event.ts, actor: event.actor, action: event.action });
    if (error) throw new Error(friendly(error));
    return event;
  }

  subscribe(session: LiveSession, onEvent: (e: LiveEvent) => void, onPresence: (p: Presence) => void) {
    let channel: RealtimeChannel | null = null;
    let closed = false;
    void this.authed().then((sb) => {
      if (closed) return;
      channel = sb
        .channel(`kitchen:${session.kitchen.id}`, { config: { presence: { key: session.me.id } } })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "events", filter: `kitchen_id=eq.${session.kitchen.id}` }, (payload) => onEvent(toEvent(payload.new as EventRow)))
        .on("presence", { event: "sync" }, () => {
          const state = channel?.presenceState() ?? {};
          const now = Date.now();
          onPresence(Object.fromEntries(Object.keys(state).map((id) => [id, now])));
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") void channel?.track({ at: Date.now() });
        });
    });
    // Presence "sync" only fires on changes; refresh timestamps so the team list stays green.
    const id = window.setInterval(() => {
      const state = channel?.presenceState() ?? {};
      const now = Date.now();
      onPresence(Object.fromEntries(Object.keys(state).map((k) => [k, now])));
    }, 5000);
    return () => {
      closed = true;
      window.clearInterval(id);
      if (channel) void channel.unsubscribe();
    };
  }
}
