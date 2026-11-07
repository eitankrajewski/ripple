import { useMemo } from "react";
import type { StationKind } from "../engine/types";
import { haptic } from "./haptics";
import { useTwin } from "../store";
import { AREA_ORDER, type AreaId } from "./areas";

/** Default floor spots for the six built-in stations. */
export const POS: Record<AreaId, [number, number]> = {
  orders: [-7.4, 2.4],
  pantry: [-7.4, -3.6],
  prep: [-3, -0.8],
  cook: [1.4, -3.6],
  pack: [4.8, -0.6],
  pickup: [8, 2.8],
};

export const KIND_LABEL: Record<StationKind, string> = { orders: "Orders in", pantry: "Pantry", prep: "Prep", cook: "Cook", pack: "Pack", pickup: "Pickup" };

/** Every station in the room: the six built-in ones (possibly moved) plus extras a manager placed. */
export interface StationNode {
  id: string;
  kind: StationKind;
  x: number;
  z: number;
  rot: number;
  placed: boolean;
  /** 1 for the built-in station, 2+ for extras of the same kind. */
  n: number;
  name: string;
}

export function useStationNodes(): StationNode[] {
  const layout = useTwin((s) => s.state.layout);
  const poses = useTwin((s) => s.state.basePoses);
  return useMemo(
    () => [
      ...AREA_ORDER.map((id) => ({ id, kind: id, x: poses[id]?.x ?? POS[id][0], z: poses[id]?.z ?? POS[id][1], rot: poses[id]?.rot ?? 0, placed: false, n: 1, name: KIND_LABEL[id] })),
      ...layout.map((p) => {
        const n = layout.filter((x) => x.kind === p.kind).indexOf(p) + 2;
        return { id: p.id, kind: p.kind, x: p.x, z: p.z, rot: p.rot ?? 0, placed: true, n, name: `${KIND_LABEL[p.kind]} ${n}` };
      }),
    ],
    [layout, poses],
  );
}

const TURN = Math.PI * 2;
const STEP = Math.PI / 4;

export const degrees = (rot: number) => Math.round((((rot % TURN) + TURN) % TURN) * (180 / Math.PI));

export function useLayoutActions() {
  const act = useTwin((s) => s.act);
  const selectArea = useTwin((s) => s.selectArea);
  return {
    rotate: (n: StationNode, dir: 1 | -1 = 1) => {
      haptic("tick");
      const rot = (((n.rot + dir * STEP) % TURN) + TURN) % TURN;
      void act({ type: "station_moved", id: n.id, x: n.x, z: n.z, rot: Math.abs(rot - TURN) < 1e-6 ? 0 : rot });
    },
    remove: (n: StationNode) => {
      if (!n.placed) return;
      haptic("tick");
      selectArea(null);
      void act({ type: "station_removed", id: n.id });
    },
  };
}
