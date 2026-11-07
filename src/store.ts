import { create } from "zustand";
import {
  advanceTo,
  approveStrategy,
  cancelOrder,
  createKitchen,
  createLiveKitchen,
  ingestEvent,
  releaseOrder,
  selectStrategy,
  setPaused,
  tick,
  type Kitchen,
} from "./engine/engine";
import { applyScenario, parseScenario, runScenario, type ScenarioResult, type ScenarioSpec } from "./engine/scenario";
import { deriveState, strategyPlanForApproval } from "./engine/twin";
import type { DigitalTwinState, Explanation, StrategyId } from "./engine/types";
import { applyAction, applyLiveEvent, byOrder, membersFrom, replay } from "./live/apply";
import { backend, type Presence } from "./live/backend";
import { can } from "./live/roles";
import type { Actor, LiveAction, LiveEvent, LiveSession, Member, Permission, Role } from "./live/types";
import { buildPayload, fallbackExplanation, requestExplanation, requestWording, scenarioExplanation, scenarioPayload } from "./lib/explain";

export type Speed = 1 | 2 | 4;
export type Tab = "inspect" | "plan" | "ask";
export type NavTab = "kitchen" | "orders" | "pantry" | "menu" | "issues" | "activity" | "team";
export type AreaId = "orders" | "pantry" | "prep" | "cook" | "pack" | "pickup";
export type Mode = "sim" | "live";

export interface LiveState {
  session: LiveSession | null;
  members: Member[];
  presence: Presence;
  /** Station roles can switch between their station screen and the full twin. */
  view: "station" | "kitchen";
}

const EMPTY_LIVE: LiveState = { session: null, members: [], presence: {}, view: "station" };

export interface ScenarioState {
  query: string;
  spec: ScenarioSpec | null;
  result: ScenarioResult | null;
  wording: Explanation | null;
  wordingLoading: boolean;
  notUnderstood: boolean;
}

const EMPTY_SCENARIO: ScenarioState = { query: "", spec: null, result: null, wording: null, wordingLoading: false, notUnderstood: false };

interface Store {
  kitchen: Kitchen;
  state: DigitalTwinState;
  speed: Speed;
  tracedOrderId: string | null;
  focusedNodeId: string | null;
  previewStrategyId: StrategyId | null;
  explanation: Explanation;
  explaining: boolean;
  toast: { id: number; text: string; tone: "ok" | "warn" | "crit" } | null;
  tab: Tab;
  nav: NavTab;
  area: AreaId | null;
  scenario: ScenarioState;
  mode: Mode;
  live: LiveState;
  helpOpen: boolean;
  mainView: "3d" | "board";

  step: () => void;
  togglePause: () => void;
  setSpeed: (s: Speed) => void;
  sendRush: () => void;
  correctStock: (ingredientId: string, newStock: number) => void;
  choose: (id: StrategyId | null) => void;
  approve: () => void;
  release: (orderId: string) => void;
  cancel: (orderId: string) => void;
  trace: (orderId: string | null) => void;
  focus: (nodeId: string | null) => void;
  explainWithAI: () => Promise<void>;
  reset: () => void;
  setTab: (t: Tab) => void;
  setNav: (t: NavTab) => void;
  selectArea: (a: AreaId | null) => void;
  ask: (query: string) => void;
  editScenario: (spec: ScenarioSpec) => void;
  rephraseScenario: () => Promise<void>;
  applyWhatIf: () => void;
  clearScenario: () => void;
  setMode: (m: Mode) => void;
  setHelp: (open: boolean) => void;
  setMainView: (v: "3d" | "board") => void;
  liveCreate: (kitchenName: string, managerName: string) => Promise<void>;
  liveJoin: (code: string, name: string, role: Role) => Promise<void>;
  liveLeave: () => Promise<void>;
  liveDo: (action: LiveAction, as?: Actor) => Promise<boolean>;
  setLiveView: (v: LiveState["view"]) => void;
  /** Order-level actions (move, pack, handoff, check-off) that work in both modes. */
  act: (action: LiveAction) => Promise<boolean>;
}

let toastSeq = 0;

// Live-mode bookkeeping kept outside React state.
let simKitchen: Kitchen | null = null;
let unsubscribe: (() => void) | null = null;
let liveLog: LiveEvent[] = [];
const seen = new Set<string>();

const liveSeconds = (session: LiveSession) => Math.max(0, Math.floor((Date.now() - session.kitchen.createdAt) / 1000));

function initial() {
  const kitchen = createKitchen();
  const state = deriveState(kitchen);
  return { kitchen, state, explanation: fallbackExplanation(buildPayload(state)) };
}

export const useTwin = create<Store>((set, get) => {
  const commit = (extra: Partial<Store> = {}) => {
    const { kitchen, previewStrategyId } = get();
    const state = deriveState(kitchen);
    const prev = get().state;
    const preview = state.phase === "disrupted" ? previewStrategyId : null;
    let toast = get().toast;
    let tab = get().tab;
    if (prev.phase !== "disrupted" && state.phase === "disrupted") {
      const live = get().mode === "live";
      toast = { id: ++toastSeq, text: live ? "Ripple detected. Review the plans." : "Ripple detected. Feed paused so you can compare options.", tone: "crit" };
      tab = "plan";
    }
    const explanation = prev.phase !== state.phase || extra.previewStrategyId !== undefined ? fallbackExplanation(buildPayload(state, preview ?? undefined)) : get().explanation;
    set({ state, previewStrategyId: preview, toast, tab, explanation, ...extra });
  };

  const toastMsg = (text: string, tone: "ok" | "warn" | "crit" = "warn") => ({ toast: { id: ++toastSeq, text, tone } });

  const receive = (e: LiveEvent) => {
    const session = get().live.session;
    if (!session || e.kitchenId !== session.kitchen.id || seen.has(e.id)) return;
    seen.add(e.id);
    const last = liveLog[liveLog.length - 1];
    liveLog.push(e);
    let kitchen = get().kitchen;
    if ((!last || byOrder(last, e) <= 0) && kitchen.clockSeconds <= e.at) applyLiveEvent(kitchen, e);
    else {
      liveLog.sort(byOrder);
      kitchen = replay(session.kitchen.createdAt, liveLog);
    }
    advanceTo(kitchen, liveSeconds(session));
    const members = e.action.type === "member_joined" || e.action.type === "member_left" ? membersFrom(liveLog) : get().live.members;
    set({ kitchen });
    commit({ live: { ...get().live, members } });
  };

  const connect = async (session: LiveSession) => {
    unsubscribe?.();
    liveLog = (await backend.load(session.kitchen.id)).sort(byOrder);
    seen.clear();
    for (const e of liveLog) seen.add(e.id);
    const kitchen = replay(session.kitchen.createdAt, liveLog);
    advanceTo(kitchen, liveSeconds(session));
    set({ kitchen, live: { ...EMPTY_LIVE, session, members: membersFrom(liveLog), view: session.me.role === "manager" ? "kitchen" : "station" } });
    commit({ tracedOrderId: null, previewStrategyId: null, area: null, tab: "inspect", scenario: EMPTY_SCENARIO });
    unsubscribe = backend.subscribe(session, receive, (presence) => set({ live: { ...get().live, presence } }));
  };

  const disconnect = () => {
    unsubscribe?.();
    unsubscribe = null;
    liveLog = [];
    seen.clear();
  };

  const isLive = () => get().mode === "live";

  return {
    ...initial(),
    speed: 1,
    tracedOrderId: null,
    focusedNodeId: null,
    previewStrategyId: null,
    explaining: false,
    toast: null,
    tab: "inspect",
    nav: "kitchen",
    area: null,
    scenario: EMPTY_SCENARIO,
    mode: "sim",
    live: EMPTY_LIVE,
    helpOpen: false,
    mainView: "3d",

    step: () => {
      const session = get().live.session;
      if (isLive()) {
        if (!session) return;
        advanceTo(get().kitchen, liveSeconds(session));
      } else tick(get().kitchen);
      commit();
    },
    togglePause: () => {
      if (isLive()) return;
      const k = get().kitchen;
      setPaused(k, !k.feedPaused);
      commit();
    },
    setSpeed: (speed) => set({ speed }),
    sendRush: () => {
      if (isLive()) return;
      ingestEvent(get().kitchen, { type: "rush_order" });
      commit({ tracedOrderId: null });
    },
    correctStock: (ingredientId, newStock) => {
      if (isLive()) return void get().liveDo({ type: "stock_correction", ingredientId, newStock });
      ingestEvent(get().kitchen, { type: "stock_correction", ingredientId, newStock });
      commit();
    },
    choose: (id) => {
      selectStrategy(get().kitchen, id ?? undefined);
      commit({ previewStrategyId: id });
    },
    approve: () => {
      const { kitchen, state, previewStrategyId } = get();
      const s = state.strategies.find((x) => x.id === previewStrategyId);
      if (!s) return;
      if (isLive()) {
        void get()
          .liveDo({ type: "approve_plan", plan: strategyPlanForApproval(kitchen, s) })
          .then((ok) => ok && set({ previewStrategyId: null, tracedOrderId: null, ...toastMsg(`${s.label} approved for the whole team.`, "ok") }));
        return;
      }
      approveStrategy(kitchen, strategyPlanForApproval(kitchen, s));
      commit({
        previewStrategyId: null,
        tracedOrderId: null,
        toast: { id: ++toastSeq, text: `${s.label} approved. Feed resumed.`, tone: "ok" },
      });
    },
    release: (orderId) => {
      if (isLive()) return void get().liveDo({ type: "release_order", orderId });
      releaseOrder(get().kitchen, orderId);
      commit();
    },
    cancel: (orderId) => {
      if (isLive()) return void get().liveDo({ type: "cancel_order", orderId });
      cancelOrder(get().kitchen, orderId);
      commit({ tracedOrderId: null });
    },
    trace: (orderId) => set(orderId ? { tracedOrderId: orderId, focusedNodeId: null, tab: "inspect" } : { tracedOrderId: null }),
    focus: (nodeId) => set({ focusedNodeId: nodeId }),
    explainWithAI: async () => {
      const { state, previewStrategyId } = get();
      set({ explaining: true });
      const explanation = await requestExplanation(buildPayload(state, previewStrategyId ?? undefined), undefined, get().explanation);
      set({ explanation, explaining: false });
    },
    reset: () => {
      if (isLive()) return;
      set({ ...initial(), speed: 1, tracedOrderId: null, focusedNodeId: null, previewStrategyId: null, toast: null, tab: "inspect", area: null, scenario: EMPTY_SCENARIO });
    },
    setTab: (tab) => set({ tab }),
    setNav: (nav) => set({ nav }),
    selectArea: (area) => set(area ? { area, tab: "inspect", tracedOrderId: null } : { area }),
    ask: (query) => {
      const spec = parseScenario(query);
      if (!spec) return set({ scenario: { ...EMPTY_SCENARIO, query, notUnderstood: true } });
      const result = runScenario(get().kitchen, spec);
      set({ scenario: { ...EMPTY_SCENARIO, query, spec, result, wording: scenarioExplanation(result) } });
    },
    editScenario: (spec) => {
      const result = runScenario(get().kitchen, spec);
      set({ scenario: { ...get().scenario, spec, result, wording: scenarioExplanation(result), notUnderstood: false } });
    },
    rephraseScenario: async () => {
      const sc = get().scenario;
      if (!sc.result || !sc.wording) return;
      set({ scenario: { ...sc, wordingLoading: true } });
      const wording = await requestWording(scenarioPayload(sc.query, sc.result), scenarioExplanation(sc.result), undefined, sc.wording);
      set({ scenario: { ...get().scenario, wording, wordingLoading: false } });
    },
    applyWhatIf: () => {
      const sc = get().scenario;
      if (!sc.spec || !sc.result || isLive()) return;
      applyScenario(get().kitchen, sc.spec);
      commit({ tracedOrderId: null, tab: "plan", scenario: EMPTY_SCENARIO, toast: { id: ++toastSeq, text: `Added to the twin: ${sc.result.title}`, tone: "warn" } });
    },
    clearScenario: () => set({ scenario: EMPTY_SCENARIO }),

    setHelp: (helpOpen) => set({ helpOpen }),
    setMainView: (mainView) => set({ mainView }),
    setMode: (mode) => {
      if (mode === get().mode) return;
      const reset = { tracedOrderId: null, previewStrategyId: null, area: null, tab: "inspect" as Tab, scenario: EMPTY_SCENARIO, toast: null };
      if (mode === "live") {
        simKitchen = get().kitchen;
        set({ mode, kitchen: createLiveKitchen(Date.now()), live: EMPTY_LIVE, ...reset });
        commit();
        const session = backend.resume();
        if (session)
          connect(session).catch(() => {
            sessionStorage.removeItem("ripple.live.session");
            set({ live: EMPTY_LIVE, ...toastMsg("Your last kitchen session expired. Sign in again.", "warn") });
          });
      } else {
        disconnect();
        set({ mode, kitchen: simKitchen ?? createKitchen(), live: EMPTY_LIVE, ...reset });
        commit();
      }
    },
    liveCreate: async (kitchenName, managerName) => {
      await connect(await backend.createKitchen(kitchenName, managerName));
    },
    liveJoin: async (code, name, role) => {
      await connect(await backend.joinKitchen(code, name, role));
    },
    liveLeave: async () => {
      const session = get().live.session;
      if (session) await backend.leave(session);
      disconnect();
      set({ kitchen: createLiveKitchen(Date.now()), live: EMPTY_LIVE, tracedOrderId: null, area: null });
      commit();
    },
    liveDo: async (action, as) => {
      const session = get().live.session;
      if (!session) return false;
      try {
        receive(await backend.publish(session, action, as));
        return true;
      } catch (err) {
        set(toastMsg(err instanceof Error ? err.message : "Couldn't send that update.", "crit"));
        return false;
      }
    },
    setLiveView: (view) => set({ live: { ...get().live, view } }),
    act: async (action) => {
      if (isLive()) return get().liveDo(action);
      applyAction(get().kitchen, action, "Manager");
      commit();
      return true;
    },
  };
});

/** In simulation everything is allowed; in live mode it depends on the signed-in role. */
export function useCan(permission: Permission) {
  return useTwin((s) => s.mode === "sim" || (!!s.live.session && can(s.live.session.me.role, permission)));
}
