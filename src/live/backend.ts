import { allowed } from "./roles";
import { SupabaseBackend } from "./supabaseBackend";
import type { Actor, KitchenSpace, LiveAction, LiveEvent, LiveSession, Member, Role } from "./types";

export type Presence = Record<string, number>;

/**
 * Everything the app needs from a sync backend. `LocalBackend` keeps kitchens in this
 * browser (tabs act as devices); a hosted backend (e.g. Supabase) implements the same
 * interface with real accounts, a shared event table and realtime subscriptions.
 */
export interface LiveBackend {
  readonly kind: "local" | "hosted";
  resume(): LiveSession | null;
  createKitchen(kitchenName: string, managerName: string): Promise<LiveSession>;
  joinKitchen(joinCode: string, name: string, role: Role): Promise<LiveSession>;
  leave(session: LiveSession): Promise<void>;
  load(kitchenId: string): Promise<LiveEvent[]>;
  /** `as` lets a trusted device (manager/host) post on behalf of the DoorDash integration. */
  publish(session: LiveSession, action: LiveAction, as?: Actor): Promise<LiveEvent>;
  subscribe(session: LiveSession, onEvent: (e: LiveEvent) => void, onPresence: (p: Presence) => void): () => void;
}

export const DOORDASH_ACTOR: Actor = { memberId: "doordash", name: "DoorDash", role: "integration" };

export function actorFor(session: LiveSession, as?: Actor): Actor {
  const me: Actor = { memberId: session.me.id, name: session.me.name, role: session.me.role };
  if (as?.role === "integration" && (me.role === "manager" || me.role === "host")) return as;
  return me;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export const normalizeCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");

const KITCHENS = "ripple.live.kitchens";
const SESSION = "ripple.live.session";
const logKey = (id: string) => `ripple.live.log.${id}`;

type Wire = { kind: "event"; event: LiveEvent } | { kind: "presence"; memberId: string; ts: number };

export class LocalBackend implements LiveBackend {
  readonly kind = "local" as const;
  private seq = 0;
  private device = randomId("dev");

  private kitchens(): Record<string, KitchenSpace> {
    return JSON.parse(localStorage.getItem(KITCHENS) ?? "{}");
  }

  private saveSession(s: LiveSession | null) {
    if (s) sessionStorage.setItem(SESSION, JSON.stringify(s));
    else sessionStorage.removeItem(SESSION);
  }

  private readLog(id: string): LiveEvent[] {
    return JSON.parse(localStorage.getItem(logKey(id)) ?? "[]");
  }

  resume() {
    const raw = sessionStorage.getItem(SESSION);
    if (!raw) return null;
    const s = JSON.parse(raw) as LiveSession;
    return this.kitchens()[s.kitchen.joinCode] ? s : null;
  }

  async createKitchen(kitchenName: string, managerName: string) {
    const kitchens = this.kitchens();
    let joinCode = randomCode();
    while (kitchens[joinCode]) joinCode = randomCode();
    const me: Member = { id: randomId("mem"), name: managerName.trim(), role: "manager", joinedAt: Date.now() };
    const kitchen: KitchenSpace = { id: randomId("kit"), name: kitchenName.trim(), joinCode, ownerId: me.id, createdAt: Date.now() };
    kitchens[joinCode] = kitchen;
    localStorage.setItem(KITCHENS, JSON.stringify(kitchens));
    const session = { kitchen, me };
    this.saveSession(session);
    await this.publish(session, { type: "member_joined", member: me });
    return session;
  }

  async joinKitchen(joinCode: string, name: string, role: Role) {
    const kitchen = this.kitchens()[normalizeCode(joinCode)];
    if (!kitchen) throw new Error("No kitchen uses that code. Check it with your manager.");
    const me: Member = { id: randomId("mem"), name: name.trim(), role, joinedAt: Date.now() };
    const session = { kitchen, me };
    this.saveSession(session);
    await this.publish(session, { type: "member_joined", member: me });
    return session;
  }

  async leave(session: LiveSession) {
    await this.publish(session, { type: "member_left", memberId: session.me.id });
    this.saveSession(null);
  }

  async load(kitchenId: string) {
    return this.readLog(kitchenId);
  }

  async publish(session: LiveSession, action: LiveAction, as?: Actor) {
    const actor = actorFor(session, as);
    if (!allowed(actor.role, action)) throw new Error("Your role can't do that.");
    const event: LiveEvent = {
      id: `${this.device}:${++this.seq}`,
      kitchenId: session.kitchen.id,
      at: Math.max(0, Math.floor((Date.now() - session.kitchen.createdAt) / 1000)),
      ts: Date.now(),
      actor,
      action,
    };
    const log = this.readLog(session.kitchen.id);
    log.push(event);
    localStorage.setItem(logKey(session.kitchen.id), JSON.stringify(log));
    const ch = new BroadcastChannel(logKey(session.kitchen.id));
    ch.postMessage({ kind: "event", event } satisfies Wire);
    ch.close();
    return event;
  }

  subscribe(session: LiveSession, onEvent: (e: LiveEvent) => void, onPresence: (p: Presence) => void) {
    const ch = new BroadcastChannel(logKey(session.kitchen.id));
    const presence: Presence = { [session.me.id]: Date.now() };
    const beat = () => {
      presence[session.me.id] = Date.now();
      ch.postMessage({ kind: "presence", memberId: session.me.id, ts: Date.now() } satisfies Wire);
      onPresence({ ...presence });
    };
    ch.onmessage = (m: MessageEvent<Wire>) => {
      if (m.data.kind === "event") onEvent(m.data.event);
      else {
        presence[m.data.memberId] = m.data.ts;
        onPresence({ ...presence });
      }
    };
    beat();
    const id = window.setInterval(beat, 4000);
    return () => {
      window.clearInterval(id);
      ch.close();
    };
  }
}

const RAW_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_URL = RAW_URL?.startsWith("/") ? `${location.origin}${RAW_URL}` : RAW_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Hosted (Supabase) when configured, otherwise the in-browser preview. */
export const backend: LiveBackend = SUPABASE_URL && SUPABASE_KEY ? new SupabaseBackend(SUPABASE_URL, SUPABASE_KEY) : new LocalBackend();
