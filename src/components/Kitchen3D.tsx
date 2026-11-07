import { CameraControls, Grid, Line, RoundedBox } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Minus, Move, Plus, RotateCw, Scan, SquarePlus, X } from "lucide-react";
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { useDrag, type DropTarget } from "../lib/drag";
import type { RiskLevel, StationKind } from "../engine/types";
import { uid } from "../live/backend";
import { haptic } from "../lib/haptics";
import { useCan } from "../store";
import { AREA_ORDER, culpritArea, useAreas, type Area, type AreaId } from "../lib/areas";
import { pct, RISK_HEX } from "../lib/ui";
import { KIND_LABEL, POS, useLayoutActions, useStationNodes, type StationNode } from "../lib/stations";
import { useTwin } from "../store";

const C = {
  floor: "#e7ebf2",
  wall: "#ff5f1f",
  trim: "#f6f7fa",
  steel: "#d6dbe4",
  steelDark: "#a3a8b0",
  dark: "#50545c",
  white: "#fbfbfc",
  wood: "#dcc8a8",
  box: "#d8c3a0",
  bag: "#ece3d3",
  accent: "#2f6fed",
  muted: "#bfc7d4",
};

const MARKER_Y: Record<AreaId, number> = { orders: 2.1, pantry: 3.1, prep: 1.8, cook: 3.7, pack: 1.9, pickup: 2.3 };
const HOME = { pos: [3, 15, 17] as const, target: [0, 0, -0.4] as const };

function Box({ p, s, c, r = 0.04, rot }: { p: [number, number, number]; s: [number, number, number]; c: string; r?: number; rot?: [number, number, number] }) {
  return (
    <RoundedBox args={s} radius={Math.min(r, Math.min(...s) / 2.01)} smoothness={3} position={p} rotation={rot} castShadow receiveShadow>
      <meshStandardMaterial color={c} roughness={0.6} metalness={0.05} />
    </RoundedBox>
  );
}

function Cyl({ p, r, h, c }: { p: [number, number, number]; r: number; h: number; c: string }) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <cylinderGeometry args={[r, r, h, 28]} />
      <meshStandardMaterial color={c} roughness={0.5} metalness={0.1} />
    </mesh>
  );
}

function Table({ w = 2.4, d = 1.1 }: { w?: number; d?: number }) {
  const lx = w / 2 - 0.1;
  const lz = d / 2 - 0.1;
  return (
    <group>
      <Box p={[0, 0.92, 0]} s={[w, 0.07, d]} c={C.steel} />
      <Box p={[0, 0.28, 0]} s={[w - 0.1, 0.04, d - 0.1]} c={C.steel} />
      {[
        [-lx, -lz],
        [lx, -lz],
        [-lx, lz],
        [lx, lz],
      ].map(([x, z], i) => (
        <Box key={i} p={[x, 0.45, z]} s={[0.06, 0.9, 0.06]} c={C.steelDark} r={0.02} />
      ))}
    </group>
  );
}

function Pantry() {
  return (
    <group>
      <group position={[-0.5, 0, 0]}>
        {[
          [-1, -0.35],
          [1, -0.35],
          [-1, 0.35],
          [1, 0.35],
        ].map(([x, z], i) => (
          <Box key={i} p={[x, 1.1, z]} s={[0.06, 2.2, 0.06]} c={C.steelDark} r={0.02} />
        ))}
        {[0.25, 0.95, 1.65].map((y) => (
          <Box key={y} p={[0, y, 0]} s={[2.1, 0.05, 0.8]} c={C.steel} r={0.02} />
        ))}
        <Box p={[-0.55, 0.5, 0]} s={[0.6, 0.45, 0.55]} c={C.box} />
        <Box p={[0.2, 0.45, 0.05]} s={[0.55, 0.35, 0.5]} c={C.box} />
        <Box p={[-0.2, 1.17, 0]} s={[0.7, 0.4, 0.55]} c={C.box} />
        <Box p={[0.6, 1.12, 0]} s={[0.45, 0.3, 0.45]} c={C.white} />
        <Box p={[0.1, 1.85, 0]} s={[0.8, 0.35, 0.55]} c={C.box} />
      </group>
      <group position={[1.5, 0, -0.05]}>
        <Box p={[0, 1.25, 0]} s={[1.2, 2.5, 0.95]} c={C.white} r={0.06} />
        <Box p={[0, 1.25, 0.48]} s={[0.012, 2.4, 0.01]} c={C.muted} r={0.004} />
        <Box p={[-0.12, 1.4, 0.51]} s={[0.04, 0.6, 0.04]} c={C.steelDark} r={0.02} />
        <Box p={[0.12, 1.4, 0.51]} s={[0.04, 0.6, 0.04]} c={C.steelDark} r={0.02} />
      </group>
    </group>
  );
}

function Prep() {
  return (
    <group>
      <Table />
      <Box p={[-0.4, 0.98, 0.05]} s={[0.8, 0.04, 0.5]} c={C.wood} r={0.015} />
      <Cyl p={[0.55, 1.02, -0.15]} r={0.2} h={0.14} c={C.white} />
      <Cyl p={[0.85, 1.0, 0.2]} r={0.14} h={0.1} c={C.white} />
      <Box p={[-0.6, 1.04, 0.05]} s={[0.12, 0.08, 0.12]} c="#a9c79a" r={0.02} />
      <Box p={[-0.35, 1.04, 0.1]} s={[0.1, 0.08, 0.1]} c="#e3a59a" r={0.02} />
    </group>
  );
}

function Flame({ on }: { on: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.visible = on;
    ref.current.children.forEach((c, i) => c.scale.set(1, 0.8 + Math.abs(Math.sin(t * 7 + i * 1.7)) * 0.5, 1));
  });
  return (
    <group ref={ref}>
      {[
        [-0.6, -0.2],
        [0.6, 0.2],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 1.02, z]}>
          <coneGeometry args={[0.12, 0.22, 16]} />
          <meshStandardMaterial color="#ffb347" emissive="#ff8a00" emissiveIntensity={0.6} transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  );
}

function Cook({ busy }: { busy: boolean }) {
  return (
    <group>
      <Box p={[0, 0.45, 0]} s={[2.6, 0.9, 1.1]} c={C.steel} />
      <Box p={[0, 0.92, 0]} s={[2.6, 0.04, 1.1]} c={C.dark} r={0.015} />
      {[
        [-0.6, -0.2],
        [0.6, -0.2],
        [-0.6, 0.2],
        [0.6, 0.2],
      ].map(([x, z], i) => (
        <Cyl key={i} p={[x, 0.95, z]} r={0.16} h={0.02} c="#2f3237" />
      ))}
      <Flame on={busy} />
      <Cyl p={[-0.6, 1.08, -0.2]} r={0.24} h={0.14} c={C.steelDark} />
      <Cyl p={[0.6, 1.06, 0.2]} r={0.22} h={0.08} c={C.dark} />
      {[-0.9, -0.3, 0.3, 0.9].map((x) => (
        <Cyl key={x} p={[x, 0.7, 0.56]} r={0.05} h={0.05} c={C.dark} />
      ))}
      <Box p={[0, 2.65, -0.1]} s={[2.9, 0.45, 1.3]} c={C.steel} r={0.06} />
      <Box p={[0, 3.35, -0.35]} s={[0.7, 1.0, 0.6]} c={C.steel} />
    </group>
  );
}

function Pack() {
  return (
    <group>
      <Table w={2.6} />
      <Box p={[-0.6, 1.15, 0]} s={[0.5, 0.38, 0.5]} c={C.box} />
      <Box p={[0.0, 1.11, 0.1]} s={[0.45, 0.3, 0.4]} c={C.box} />
      <Box p={[0.65, 1.2, -0.1]} s={[0.36, 0.5, 0.26]} c={C.bag} r={0.02} />
      <Box p={[0.95, 1.16, 0.2]} s={[0.3, 0.42, 0.22]} c={C.bag} r={0.02} />
    </group>
  );
}

function Pickup() {
  return (
    <group>
      <Box p={[0, 0.52, 0]} s={[2.6, 1.04, 0.9]} c={C.white} r={0.05} />
      <Box p={[0, 1.07, 0]} s={[2.7, 0.05, 1.0]} c={C.steel} r={0.02} />
      {[-0.8, -0.35, 0.15].map((x, i) => (
        <Box key={x} p={[x, 1.32, 0]} s={[0.34, 0.46 - i * 0.04, 0.24]} c={C.bag} r={0.02} />
      ))}
      <Box p={[0.85, 1.2, 0]} s={[0.5, 0.22, 0.5]} c={C.box} />
      <Box p={[1.85, 1.25, 0.6]} s={[0.1, 2.5, 0.1]} c={C.steelDark} r={0.03} />
      <Box p={[1.85, 1.25, -0.9]} s={[0.1, 2.5, 0.1]} c={C.steelDark} r={0.03} />
      <Box p={[1.85, 2.5, -0.15]} s={[0.1, 0.1, 1.6]} c={C.steelDark} r={0.03} />
    </group>
  );
}

function Orders() {
  return (
    <group>
      <Box p={[0, 0.52, 0]} s={[2.4, 1.04, 0.9]} c={C.white} r={0.05} />
      <Box p={[0, 1.07, 0]} s={[2.5, 0.05, 1.0]} c={C.steel} r={0.02} />
      <Box p={[-0.4, 1.12, 0]} s={[0.12, 0.08, 0.12]} c={C.dark} r={0.02} />
      <Box p={[-0.4, 1.38, -0.02]} s={[0.7, 0.46, 0.04]} c={C.dark} r={0.03} rot={[-0.25, 0, 0]} />
      <Box p={[0.5, 1.18, 0]} s={[0.4, 0.18, 0.35]} c={C.steelDark} />
      <Box p={[0.5, 1.33, 0.08]} s={[0.22, 0.14, 0.01]} c="#ffffff" r={0.004} rot={[-0.4, 0, 0]} />
      <Box p={[0, 1.95, -0.3]} s={[2.2, 0.05, 0.05]} c={C.steelDark} r={0.02} />
      {[-0.7, -0.3, 0.1, 0.5].map((x) => (
        <Box key={x} p={[x, 1.8, -0.28]} s={[0.22, 0.28, 0.01]} c="#ffffff" r={0.004} />
      ))}
    </group>
  );
}

const MODEL: Record<AreaId, (p: { busy: boolean }) => ReactNode> = {
  orders: () => <Orders />,
  pantry: () => <Pantry />,
  prep: () => <Prep />,
  cook: ({ busy }) => <Cook busy={busy} />,
  pack: () => <Pack />,
  pickup: () => <Pickup />,
};

function AreaRing({ risk, selected, culprit }: { risk: RiskLevel; selected: boolean; culprit: boolean }) {
  const pulse = useRef<THREE.Mesh>(null);
  const color = selected ? C.accent : culprit ? RISK_HEX.critical : RISK_HEX[risk];
  const show = selected || culprit || risk !== "normal";
  useFrame(({ clock }) => {
    if (!pulse.current) return;
    const t = (clock.elapsedTime % 1.8) / 1.8;
    pulse.current.scale.setScalar(1 + t * 0.4);
    (pulse.current.material as THREE.MeshBasicMaterial).opacity = (risk === "critical" || culprit) && !selected ? 0.5 * (1 - t) : 0;
  });
  return (
    <group rotation-x={-Math.PI / 2} position-y={0.012}>
      <mesh visible={show}>
        <ringGeometry args={[1.85, 1.95, 72]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <mesh visible={show}>
        <circleGeometry args={[1.85, 72]} />
        <meshBasicMaterial color={color} transparent opacity={selected ? 0.08 : 0.06} depthWrite={false} />
      </mesh>
      <mesh ref={pulse}>
        <ringGeometry args={[1.85, 1.95, 72]} />
        <meshBasicMaterial color={RISK_HEX.critical} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function markerMetric(a: Area): string {
  if (a.load !== undefined) return a.loadBefore !== undefined && Math.round(a.loadBefore * 100) !== Math.round(a.load * 100) ? `${pct(a.loadBefore)} → ${pct(a.load)}` : pct(a.load);
  if (a.id === "pantry") return a.shortages.length ? `${a.shortages[0].name} short` : "Stocked";
  if (a.id === "orders") return `${a.orders.length} waiting`;
  return `${a.orders.length} ready`;
}

function AreaNode({ a, node, selected, culprit, onSelect }: { a: Area; node: Node3D; selected: boolean; culprit: boolean; onSelect: () => void }) {
  const Model = MODEL[a.id];
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect();
  };
  return (
    <group position={[node.x, 0, node.z]}>
      <group
        rotation-y={node.rot}
        onClick={click}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <Model busy={a.orders.length > 0} />
      </group>
      <AreaRing risk={a.risk} selected={selected} culprit={culprit} />
    </group>
  );
}

type XZ = [number, number];

type Node3D = StationNode;

function lane([ax, az]: XZ, [bx, bz]: XZ) {
  const a = new THREE.Vector3(ax, 0.03, az);
  const b = new THREE.Vector3(bx, 0.03, bz);
  const dir = b.clone().sub(a);
  const len = dir.length();
  dir.normalize();
  const start = a.clone().addScaledVector(dir, Math.min(1.9, len * 0.3));
  const end = b.clone().addScaledVector(dir, -Math.min(1.9, len * 0.3));
  const mid = start.clone().lerp(end, 0.5);
  mid.add(new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(Math.min(0.8, len * 0.1)));
  return new THREE.QuadraticBezierCurve3(start, mid, end);
}

function Lane({ from, to, color, width, flowing, speed, offset }: { offset: number; from: XZ; to: XZ; color: string; width: number; flowing: boolean; speed: number }) {
  const [fx, fz] = from;
  const [tx, tz] = to;
  const curve = useMemo(() => lane([fx, fz], [tx, tz]), [fx, fz, tx, tz]);
  const points = useMemo(() => curve.getPoints(40), [curve]);
  const pucks = useRef<THREE.Group>(null);
  const t = useRef(offset);
  useFrame((_, dt) => {
    if (flowing) t.current += dt * 0.12 * speed;
    pucks.current?.children.forEach((c, i) => {
      const p = curve.getPoint((t.current + i / 3) % 1);
      c.position.set(p.x, 0.1, p.z);
    });
  });
  return (
    <group>
      <Line points={points} color={color} lineWidth={width} transparent opacity={0.95} />
      <group ref={pucks}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} castShadow>
            <sphereGeometry args={[0.09, 16, 16]} />
            <meshStandardMaterial color="#ffffff" roughness={0.3} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Room() {
  return (
    <group>
      <Box p={[0, -0.06, -0.2]} s={[22, 0.12, 13]} c={C.floor} r={0.05} />
      <Grid position={[0, 0.002, -0.2]} args={[22, 13]} cellSize={1} cellThickness={0.6} cellColor="#d7dce6" sectionSize={4} sectionThickness={0.9} sectionColor="#c9d0dd" fadeDistance={60} infiniteGrid={false} />
      <Box p={[0, 1.2, -6.65]} s={[22, 2.4, 0.18]} c={C.wall} r={0.03} />
      <Box p={[-10.95, 1.2, -0.2]} s={[0.18, 2.4, 13]} c={C.wall} r={0.03} />
      <Box p={[0, 0.12, -6.53]} s={[22, 0.24, 0.08]} c={C.trim} r={0.02} />
      <Box p={[-10.83, 0.12, -0.2]} s={[0.08, 0.24, 13]} c={C.trim} r={0.02} />
      <Box p={[0.1, 0.004, 6.28]} s={[21.8, 0.02, 0.1]} c={C.wall} r={0.005} />
    </group>
  );
}

const FLOOR = { x: [-10.2, 10.2], z: [-5.6, 5.6] } as const;
const snap = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, Math.round(v * 2) / 2));

function PlacedNode({ node, selected, onSelect }: { node: Node3D; selected: boolean; onSelect: () => void }) {
  const Model = MODEL[node.kind];
  return (
    <group position={[node.x, 0, node.z]}>
      <group
        rotation-y={node.rot}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <Model busy={false} />
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={selected ? [1.7, 1.86, 64] : [1.75, 1.82, 64]} />
        <meshBasicMaterial color={selected ? C.accent : C.wall} transparent opacity={selected ? 0.95 : 0.7} depthWrite={false} />
      </mesh>
    </group>
  );
}

type GhostAt = { x: number; z: number; ok: boolean; kind: StationKind; rot: number };

function Ghost({ at }: { at: GhostAt | null }) {
  if (!at) return null;
  const c = at.ok ? C.wall : RISK_HEX.critical;
  const Model = MODEL[at.kind];
  return (
    <group position={[at.x, 0, at.z]}>
      <group rotation-y={at.rot} scale={0.98}>
        <Model busy={false} />
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <circleGeometry args={[1.8, 48]} />
        <meshBasicMaterial color={c} transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[1.72, 1.82, 64]} />
        <meshBasicMaterial color={c} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Keeps a handle on the camera so palette drops can be projected onto the floor. */
function CameraGrab({ onCamera }: { onCamera: (c: THREE.Camera) => void }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => onCamera(camera), [camera, onCamera]);
  return null;
}

const FLOW: [AreaId, AreaId][] = [
  ["orders", "pantry"],
  ["pantry", "prep"],
  ["prep", "cook"],
  ["cook", "pack"],
  ["pack", "pickup"],
];
const RANK: Record<RiskLevel, number> = { normal: 0, warning: 1, critical: 2 };

type Insets = { left: number; right: number };

function homeView(width: number, height: number, insets: Insets) {
  const visible = Math.max(0.35, (width - insets.left - insets.right) / width);
  const aspect = width / height;
  const need = 21 / (2 * Math.tan(THREE.MathUtils.degToRad(17)) * aspect * visible);
  const d = THREE.MathUtils.clamp(Math.max(need, 15 / (2 * Math.tan(THREE.MathUtils.degToRad(17)))), 18, 60);
  const dir = new THREE.Vector3(...HOME.pos).sub(new THREE.Vector3(...HOME.target)).normalize().multiplyScalar(d);
  const t = HOME.target;
  return [t[0] + dir.x, t[1] + dir.y, t[2] + dir.z, ...t] as const;
}

function Scene({ controls, insets, ghost, nodes, hidden }: { controls: React.RefObject<CameraControls | null>; insets: Insets; ghost: GhostAt | null; nodes: Node3D[]; hidden: string | null }) {
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const { areas } = useAreas();
  const area = useTwin((s) => s.area);
  const placedSel = useTwin((s) => s.placed);
  const selectArea = useTwin((s) => s.selectArea);
  const selectPlaced = useTwin((s) => s.selectPlaced);
  const paused = useTwin((s) => s.state.feedPaused);
  const speed = useTwin((s) => s.speed);
  const traced = useTwin((s) => s.state.orders.find((o) => o.id === s.tracedOrderId));
  const culprit = traced ? culpritArea(traced) : null;
  const byId = Object.fromEntries(areas.map((a) => [a.id, a])) as Record<AreaId, Area>;
  const traceEnd = traced ? AREA_ORDER.indexOf(culprit ?? "pickup") : -1;
  const at = (id: AreaId): XZ => {
    const n = nodes.find((x) => x.id === id)!;
    return [n.x, n.z];
  };

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    if (area) {
      const n = nodes.find((x) => x.id === (placedSel ?? area));
      const [x, z] = n ? [n.x, n.z] : POS[area];
      void c.setLookAt(x + 4.2, 8, z + 10, x, 0.8, z, true);
    } else {
      void c.setLookAt(...homeView(size.width, size.height, insets), true);
    }
    // Only fly when the selection or viewport changes, not when a station is nudged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area, placedSel, controls, size.width, size.height, insets]);

  useEffect(() => {
    const shift = (insets.right - insets.left) / 2;
    if (shift) camera.setViewOffset(size.width, size.height, shift, 0, size.width, size.height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, insets]);

  return (
    <>
      <ambientLight intensity={0.75} />
      <hemisphereLight args={["#ffffff", "#d5dceb", 0.6]} />
      <directionalLight position={[6, 14, 8]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={10} shadow-camera-bottom={-10} shadow-bias={-0.0004} />
      <Room />
      {FLOW.map(([a, b]) => {
        const i = AREA_ORDER.indexOf(b);
        const inTrace = traced && i <= traceEnd;
        const r = RANK[byId[a].risk] <= RANK[byId[b].risk] ? byId[a].risk : byId[b].risk;
        const color = inTrace ? C.accent : r === "normal" ? C.muted : RISK_HEX[r];
        return <Lane key={`${a}-${b}`} offset={i * 0.37} from={at(a)} to={at(b)} color={traced && !inTrace ? "#dce1ea" : color} width={inTrace || r !== "normal" ? 4 : 2.5} flowing={!paused} speed={speed} />;
      })}
      {nodes
        .filter((p) => p.placed)
        .flatMap((p) => {
          const i = AREA_ORDER.indexOf(p.kind);
          const r = byId[p.kind].risk;
          const color = r === "normal" ? "#ee8a5a" : RISK_HEX[r];
          const me: XZ = [p.x, p.z];
          return [
            i > 0 && <Lane key={`${p.id}-in`} offset={0.2} from={at(AREA_ORDER[i - 1])} to={me} color={color} width={2.5} flowing={!paused} speed={speed} />,
            i < AREA_ORDER.length - 1 && <Lane key={`${p.id}-out`} offset={0.6} from={me} to={at(AREA_ORDER[i + 1])} color={color} width={2.5} flowing={!paused} speed={speed} />,
          ];
        })}
      {areas.map((a) => {
        const node = nodes.find((n) => n.id === a.id)!;
        if (hidden === a.id) return null;
        return <AreaNode key={a.id} a={a} node={node} selected={area === a.id && !placedSel} culprit={culprit === a.id} onSelect={() => selectArea(area === a.id && !placedSel ? null : a.id)} />;
      })}
      {nodes
        .filter((p) => p.placed && p.id !== hidden)
        .map((p) => (
          <PlacedNode key={p.id} node={p} selected={placedSel === p.id} onSelect={() => (placedSel === p.id ? selectArea(null) : selectPlaced(p.id, p.kind))} />
        ))}
      <Ghost at={ghost} />
    </>
  );
}

class GLBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div className="flex h-full items-center justify-center p-8 text-center text-mute">
          The 3D kitchen needs WebGL, which this browser has turned off. Every station is still available in the navigator on the left.
        </div>
      );
    return this.props.children;
  }
}

type MarkerEls = Record<string, HTMLElement | null>;

const DROP_OF: Partial<Record<AreaId, DropTarget>> = { prep: "prep", cook: "cook", pack: "pack", pickup: "ready" };

function MarkerTracker({ nodes, place }: { nodes: React.RefObject<Node3D[]>; place: (id: string, x: number, y: number, visible: boolean) => void }) {
  const v = useRef(new THREE.Vector3());
  useFrame(({ camera, size }) => {
    for (const n of nodes.current) {
      v.current.set(n.x, MARKER_Y[n.kind], n.z).project(camera);
      place(n.id, ((v.current.x + 1) / 2) * size.width, ((1 - v.current.y) / 2) * size.height, v.current.z <= 1);
    }
  });
  return null;
}

interface EditTools {
  move: (n: Node3D) => (e: React.PointerEvent) => void;
  rotate: (n: Node3D) => void;
  remove: (n: Node3D) => void;
}

function Markers({ nodes, register, edit, editAll }: { nodes: Node3D[]; register: (id: string, el: HTMLElement | null) => void; edit: EditTools | null; editAll: boolean }) {
  const { areas } = useAreas();
  const area = useTwin((s) => s.area);
  const placedSel = useTwin((s) => s.placed);
  const selectArea = useTwin((s) => s.selectArea);
  const selectPlaced = useTwin((s) => s.selectPlaced);
  const traced = useTwin((s) => s.state.orders.find((o) => o.id === s.tracedOrderId));
  const traceEnd = traced ? AREA_ORDER.indexOf(culpritArea(traced) ?? "pickup") : -1;
  const dragOver = useDrag((s) => s.over);
  const dragging = useDrag((s) => !!s.order);
  const byId = Object.fromEntries(areas.map((a) => [a.id, a])) as Record<AreaId, Area>;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {nodes.map((n) => {
        const a = byId[n.kind];
        const selected = n.placed ? placedSel === n.id : area === a.id && !placedSel;
        const dim = !!traced && AREA_ORDER.indexOf(a.id) > traceEnd;
        const onSelect = () => (selected ? selectArea(null) : n.placed ? selectPlaced(n.id, n.kind) : selectArea(a.id));
        const drop = DROP_OF[a.id];
        return (
          <div key={n.id} ref={(el) => register(n.id, el)} className="pointer-events-auto absolute top-0 left-0 flex items-center gap-1 will-change-transform" style={{ visibility: "hidden" }}>
            <button
              onClick={onSelect}
              data-drop={drop}
              className={clsx(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold whitespace-nowrap shadow-[0_1px_2px_rgba(16,24,40,0.08),0_4px_14px_-6px_rgba(16,24,40,0.3)] backdrop-blur-md transition-all select-none",
                selected ? "bg-navy text-white" : "bg-white/95 text-ink hover:bg-white",
                dim && "opacity-40",
                dragging && drop && "scale-110 ring-2 ring-accent/50 ring-dashed",
                dragging && drop && dragOver === drop && "scale-125 bg-accent! text-white",
              )}
            >
              <span className={clsx("size-2 rounded-full", a.risk === "critical" && !selected && "pulse-dot")} style={{ background: selected ? "#fff" : n.placed ? C.wall : RISK_HEX[a.risk] }} />
              {n.placed ? n.name : a.name}
              <span className={clsx("font-semibold tabular-nums", selected ? "text-white/80" : "text-mute")}>{markerMetric(a)}</span>
              {a.changed && !selected && !n.placed && <span className="rounded-full bg-ai/12 px-1.5 text-[10px] font-extrabold text-ai">plan</span>}
            </button>
            {edit && (editAll || selected) && (
              <span className="flex items-center gap-0.5 rounded-full bg-white/95 p-0.5 shadow-[0_1px_2px_rgba(16,24,40,0.08),0_4px_14px_-6px_rgba(16,24,40,0.3)]">
                <button onPointerDown={edit.move(n)} className="flex size-6 touch-none items-center justify-center rounded-full text-mute hover:bg-navy/8 hover:text-ink" style={{ cursor: "grab" }} title="Drag to move" aria-label={`Move ${n.name}`}>
                  <Move className="size-3.5" />
                </button>
                <button onClick={() => edit.rotate(n)} className="flex size-6 items-center justify-center rounded-full text-mute hover:bg-navy/8 hover:text-ink" title="Rotate 45°" aria-label={`Rotate ${n.name}`}>
                  <RotateCw className="size-3.5" />
                </button>
                {n.placed && (
                  <button onClick={() => edit.remove(n)} className="flex size-6 items-center justify-center rounded-full text-mute hover:bg-crit/10 hover:text-crit" title="Remove station" aria-label="Remove station">
                    <X className="size-3.5" />
                  </button>
                )}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

const NO_INSETS: Insets = { left: 0, right: 0 };

export default function Kitchen3D({ insets = NO_INSETS }: { insets?: Insets }) {
  const controls = useRef<CameraControls | null>(null);
  const markers = useRef<MarkerEls>({});
  const register = useCallback((id: string, el: HTMLElement | null) => {
    markers.current[id] = el;
  }, []);
  const place = useCallback((id: string, x: number, y: number, visible: boolean) => {
    const el = markers.current[id];
    if (!el) return;
    el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
    el.style.visibility = visible ? "visible" : "hidden";
  }, []);
  const area = useTwin((s) => s.area);
  const selectArea = useTwin((s) => s.selectArea);
  const act = useTwin((s) => s.act);
  const canEdit = useCan("manage_layout");
  const palette = useTwin((s) => s.editLayout);
  const setPalette = useTwin((s) => s.setEditLayout);
  const placedSel = useTwin((s) => s.placed);
  const layoutActions = useLayoutActions();
  const [carry, setCarry] = useState<{ kind: StationKind; x: number; y: number; moving: boolean } | null>(null);
  const [ghost, setGhost] = useState<GhostAt | null>(null);
  const [hidden, setHidden] = useState<string | null>(null);
  const nodes = useStationNodes();
  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  const free = (x: number, z: number, except?: string) => nodes.every((n) => n.id === except || Math.hypot(n.x - x, n.z - z) > 2.9);
  const wrap = useRef<HTMLDivElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  const cam = useRef<THREE.Camera | null>(null);
  const grabCamera = useCallback((c: THREE.Camera) => {
    cam.current = c;
  }, []);
  const floorAt = (cx: number, cy: number) => {
    const el = wrap.current;
    if (!el || !cam.current) return null;
    const r = el.getBoundingClientRect();
    if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return null;
    const pr = paletteRef.current?.getBoundingClientRect();
    if (pr && cx >= pr.left && cx <= pr.right && cy >= pr.top && cy <= pr.bottom) return null;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), cam.current);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) return null;
    return { x: snap(hit.x, FLOOR.x), z: snap(hit.z, FLOOR.z) };
  };
  /** Shared drag loop for new stations from the palette and for moving existing ones. */
  const carryStation = (e: React.PointerEvent, kind: StationKind, rot: number, moving: Node3D | null, done: (x: number, z: number) => void) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    haptic("pick");
    if (controls.current) controls.current.enabled = false;
    setCarry({ kind, x: e.clientX, y: e.clientY, moving: !!moving });
    if (moving) setHidden(moving.id);
    let last: GhostAt | null = null;
    const move = (ev: PointerEvent) => {
      setCarry({ kind, x: ev.clientX, y: ev.clientY, moving: !!moving });
      const p = floorAt(ev.clientX, ev.clientY);
      const next = p && { ...p, ok: free(p.x, p.z, moving?.id), kind, rot };
      if (next && (next.x !== last?.x || next.z !== last?.z)) haptic("tick");
      last = next;
      setGhost(next);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (controls.current) controls.current.enabled = true;
      setCarry(null);
      setGhost(null);
      setHidden(null);
      if (last && !last.ok) haptic("error");
      if (last?.ok) {
        haptic("drop");
        done(last.x, last.z);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const pick = (kind: StationKind) => (e: React.PointerEvent) =>
    carryStation(e, kind, 0, null, (x, z) => void act({ type: "station_added", station: { id: uid(10), kind, x, z, rot: 0 } }));
  const edit: EditTools | null =
    canEdit
      ? {
          move: (n) => (e) => carryStation(e, n.kind, n.rot, n, (x, z) => void act({ type: "station_moved", id: n.id, x, z, rot: n.rot })),
          rotate: (n) => layoutActions.rotate(n),
          remove: (n) => layoutActions.remove(n),
        }
      : null;
  const { areas } = useAreas();
  const name = (placedSel && nodes.find((n) => n.id === placedSel)?.name) || (areas.find((a) => a.id === area)?.name ?? "Whole kitchen");
  const step = (d: number) => {
    const i = area ? AREA_ORDER.indexOf(area) : d > 0 ? -1 : AREA_ORDER.length;
    selectArea(AREA_ORDER[(i + d + AREA_ORDER.length) % AREA_ORDER.length]);
  };

  return (
    <div ref={wrap} className="relative h-full w-full bg-[radial-gradient(120%_90%_at_50%_0%,#f9fbfe,#dfe5f0)]">
      <GLBoundary>
        <Canvas shadows dpr={[1, 2]} camera={{ position: [...HOME.pos], fov: 34 }} gl={{ antialias: true, alpha: true }}>
          <fog attach="fog" args={["#e8ecf4", 60, 110]} />
          <CameraControls
            ref={controls}
            minDistance={4}
            maxDistance={64}
            maxPolarAngle={Math.PI / 2.25}
            smoothTime={0.25}
            draggingSmoothTime={0.06}
            azimuthRotateSpeed={1.7}
            polarRotateSpeed={1.5}
            dollySpeed={2.4}
            truckSpeed={2.6}
            dollyToCursor
          />
          <Scene controls={controls} insets={insets} ghost={ghost} nodes={nodes} hidden={hidden} />
          <CameraGrab onCamera={grabCamera} />
          <MarkerTracker nodes={nodesRef} place={place} />
        </Canvas>
        <Markers nodes={nodes} register={register} edit={edit} editAll={palette} />
      </GLBoundary>
      {canEdit && palette && (
        <div ref={paletteRef} data-palette className="sidebar absolute bottom-20 left-1/2 w-[min(92%,560px)] -translate-x-1/2 rounded-[14px]! p-3 lg:bottom-[74px]">
          <div className="mb-2 flex items-start gap-2 text-[12.5px] font-extrabold">
            <div className="min-w-0">
              Edit layout
              <div className="text-[11.5px] font-semibold text-mute">Drag a new station onto the floor. Use the handles on any station, new or original, to move or rotate it.</div>
            </div>
            <button className="tbtn ml-auto size-6!" onClick={() => setPalette(false)} aria-label="Close">
              <X className="size-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {(Object.keys(KIND_LABEL) as StationKind[]).map((k) => (
              <button key={k} onPointerDown={pick(k)} className="flex h-11 touch-none items-center justify-center gap-1.5 rounded-[10px] bg-white text-[12.5px] font-bold shadow-[var(--shadow-btn)] transition-shadow hover:shadow-[var(--shadow-btn-hover)] active:cursor-grabbing" style={{ cursor: "grab" }}>
                <span className="size-2 rounded-full" style={{ background: C.wall }} />
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
      )}
      {carry && (
        <div className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff5f1f] px-3 py-1.5 text-[12.5px] font-extrabold text-white shadow-lg" style={{ left: carry.x, top: carry.y - 28 }}>
          {KIND_LABEL[carry.kind]} {ghost ? (ghost.ok ? "· release to place" : "· too close to another station") : carry.moving ? "· drag onto the floor" : ""}
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4 lg:bottom-5">
        <div className="sidebar pointer-events-auto flex items-center gap-0.5 rounded-full! p-1">
          <button className="tbtn rounded-full!" onClick={() => selectArea(null)} title="Whole kitchen">
            <Scan className="size-4" />
          </button>
          <span className="mx-1 h-4 w-px bg-navy/10" />
          <button className="tbtn rounded-full!" onClick={() => step(-1)} aria-label="Previous area">
            <ChevronLeft className="size-4" />
          </button>
          <span className="w-28 text-center text-[13px] font-extrabold">{name}</span>
          <button className="tbtn rounded-full!" onClick={() => step(1)} aria-label="Next area">
            <ChevronRight className="size-4" />
          </button>
          <span className="mx-1 h-4 w-px bg-navy/10" />
          <button className="tbtn rounded-full!" onClick={() => void controls.current?.dolly(3, true)} aria-label="Zoom in">
            <Plus className="size-4" />
          </button>
          <button className="tbtn rounded-full!" onClick={() => void controls.current?.dolly(-3, true)} aria-label="Zoom out">
            <Minus className="size-4" />
          </button>
          {canEdit && (
            <>
              <span className="mx-1 h-4 w-px bg-navy/10" />
              <button className={clsx("tbtn rounded-full!", palette && "bg-navy! text-white!")} onClick={() => setPalette(!palette)} title="Edit layout (manager)">
                <SquarePlus className="size-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
