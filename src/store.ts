import { create } from "zustand";
import {
  approveStrategy,
  cancelOrder,
  createKitchen,
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
import { buildPayload, fallbackExplanation, requestExplanation, requestWording, scenarioExplanation, scenarioPayload } from "./lib/explain";

export type Speed = 1 | 2 | 4;
export type Tab = "plan" | "ask" | "pantry";

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
  scenario: ScenarioState;

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
  ask: (query: string) => void;
  editScenario: (spec: ScenarioSpec) => void;
  rephraseScenario: () => Promise<void>;
  applyWhatIf: () => void;
  clearScenario: () => void;
}

let toastSeq = 0;

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
      toast = { id: ++toastSeq, text: "Ripple detected. Feed paused so you can compare options.", tone: "crit" };
      tab = "plan";
    }
    const explanation = prev.phase !== state.phase || extra.previewStrategyId !== undefined ? fallbackExplanation(buildPayload(state, preview ?? undefined)) : get().explanation;
    set({ state, previewStrategyId: preview, toast, tab, explanation, ...extra });
  };

  return {
    ...initial(),
    speed: 1,
    tracedOrderId: null,
    focusedNodeId: null,
    previewStrategyId: null,
    explaining: false,
    toast: null,
    tab: "plan",
    scenario: EMPTY_SCENARIO,

    step: () => {
      tick(get().kitchen);
      commit();
    },
    togglePause: () => {
      const k = get().kitchen;
      setPaused(k, !k.feedPaused);
      commit();
    },
    setSpeed: (speed) => set({ speed }),
    sendRush: () => {
      ingestEvent(get().kitchen, { type: "rush_order" });
      commit({ tracedOrderId: null });
    },
    correctStock: (ingredientId, newStock) => {
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
      approveStrategy(kitchen, strategyPlanForApproval(kitchen, s));
      commit({
        previewStrategyId: null,
        tracedOrderId: null,
        toast: { id: ++toastSeq, text: `${s.label} approved. Feed resumed.`, tone: "ok" },
      });
    },
    release: (orderId) => {
      releaseOrder(get().kitchen, orderId);
      commit();
    },
    cancel: (orderId) => {
      cancelOrder(get().kitchen, orderId);
      commit({ tracedOrderId: null });
    },
    trace: (orderId) => set({ tracedOrderId: orderId, focusedNodeId: null }),
    focus: (nodeId) => set({ focusedNodeId: nodeId }),
    explainWithAI: async () => {
      const { state, previewStrategyId } = get();
      set({ explaining: true });
      const explanation = await requestExplanation(buildPayload(state, previewStrategyId ?? undefined));
      set({ explanation, explaining: false });
    },
    reset: () => {
      set({ ...initial(), speed: 1, tracedOrderId: null, focusedNodeId: null, previewStrategyId: null, toast: null, tab: "plan", scenario: EMPTY_SCENARIO });
    },
    setTab: (tab) => set({ tab }),
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
      const wording = await requestWording(scenarioPayload(sc.query, sc.result), scenarioExplanation(sc.result));
      set({ scenario: { ...get().scenario, wording, wordingLoading: false } });
    },
    applyWhatIf: () => {
      const sc = get().scenario;
      if (!sc.spec || !sc.result) return;
      applyScenario(get().kitchen, sc.spec);
      commit({ tracedOrderId: null, tab: "plan", scenario: EMPTY_SCENARIO, toast: { id: ++toastSeq, text: `Added to the twin: ${sc.result.title}`, tone: "warn" } });
    },
    clearScenario: () => set({ scenario: EMPTY_SCENARIO }),
  };
});
