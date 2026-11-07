import { CameraControls, Grid, Line, RoundedBox } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Minus, Plus, Scan } from "lucide-react";
import { Component, useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { useDrag, type DropTarget } from "../lib/drag";
import type { RiskLevel } from "../engine/types";
import { AREA_ORDER, culpritArea, useAreas, type Area, type AreaId } from "../lib/areas";
import { pct, RISK_HEX } from "../lib/ui";
import { useTwin } from "../store";

const C = {
  floor: "#e7ebf2",
  wall: "#f3f5f9",
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

const POS: Record<AreaId, [number, number]> = {
  orders: [-7.4, 2.4],
  pantry: [-7.4, -3.6],
  prep: [-3, -0.8],
  cook: [1.4, -3.6],
  pack: [4.8, -0.6],
  pickup: [8, 2.8],
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

function AreaNode({ a, selected, culprit, onSelect }: { a: Area; selected: boolean; culprit: boolean; onSelect: () => void }) {
  const [x, z] = POS[a.id];
  const Model = MODEL[a.id];
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect();
  };
  return (
    <group position={[x, 0, z]}>
      <group
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

function lane(a: AreaId, b: AreaId) {
  const [ax, az] = POS[a];
  const [bx, bz] = POS[b];
  const start = new THREE.Vector3(ax + (bx > ax ? 1.4 : bx < ax ? -1.4 : 0), 0.03, az + (bz > az ? 1.2 : bz < az ? -1.2 : 0));
  const end = new THREE.Vector3(bx - (bx > ax ? 1.4 : bx < ax ? -1.4 : 0), 0.03, bz - (bz > az ? 1.2 : bz < az ? -1.2 : 0));
  const mid = start.clone().lerp(end, 0.5);
  mid.z += 0.8;
  return new THREE.QuadraticBezierCurve3(start, mid, end);
}

function Lane({ from, to, color, width, flowing, speed, offset }: { offset: number; from: AreaId; to: AreaId; color: string; width: number; flowing: boolean; speed: number }) {
  const curve = useMemo(() => lane(from, to), [from, to]);
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
    </group>
  );
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

function Scene({ controls, insets }: { controls: React.RefObject<CameraControls | null>; insets: Insets }) {
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const { areas } = useAreas();
  const area = useTwin((s) => s.area);
  const selectArea = useTwin((s) => s.selectArea);
  const paused = useTwin((s) => s.state.feedPaused);
  const speed = useTwin((s) => s.speed);
  const traced = useTwin((s) => s.state.orders.find((o) => o.id === s.tracedOrderId));
  const culprit = traced ? culpritArea(traced) : null;
  const byId = Object.fromEntries(areas.map((a) => [a.id, a])) as Record<AreaId, Area>;
  const traceEnd = traced ? AREA_ORDER.indexOf(culprit ?? "pickup") : -1;

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    if (area) {
      const [x, z] = POS[area];
      void c.setLookAt(x + 4.2, 8, z + 10, x, 0.8, z, true);
    } else {
      void c.setLookAt(...homeView(size.width, size.height, insets), true);
    }
  }, [area, controls, size.width, size.height, insets]);

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
        return <Lane key={`${a}-${b}`} offset={i * 0.37} from={a} to={b} color={traced && !inTrace ? "#dce1ea" : color} width={inTrace || r !== "normal" ? 4 : 2.5} flowing={!paused} speed={speed} />;
      })}
      {areas.map((a) => (
        <AreaNode
          key={a.id}
          a={a}
          selected={area === a.id}
          culprit={culprit === a.id}
          onSelect={() => selectArea(area === a.id ? null : a.id)}
        />
      ))}
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

type MarkerEls = Partial<Record<AreaId, HTMLElement | null>>;

const DROP_OF: Partial<Record<AreaId, DropTarget>> = { prep: "prep", cook: "cook", pack: "pack", pickup: "ready" };

function MarkerTracker({ place }: { place: (id: AreaId, x: number, y: number, visible: boolean) => void }) {
  const v = useRef(new THREE.Vector3());
  useFrame(({ camera, size }) => {
    for (const id of AREA_ORDER) {
      const [x, z] = POS[id];
      v.current.set(x, MARKER_Y[id], z).project(camera);
      place(id, ((v.current.x + 1) / 2) * size.width, ((1 - v.current.y) / 2) * size.height, v.current.z <= 1);
    }
  });
  return null;
}

function Markers({ register }: { register: (id: AreaId, el: HTMLElement | null) => void }) {
  const { areas } = useAreas();
  const area = useTwin((s) => s.area);
  const selectArea = useTwin((s) => s.selectArea);
  const traced = useTwin((s) => s.state.orders.find((o) => o.id === s.tracedOrderId));
  const traceEnd = traced ? AREA_ORDER.indexOf(culpritArea(traced) ?? "pickup") : -1;
  const dragOver = useDrag((s) => s.over);
  const dragging = useDrag((s) => !!s.order);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {areas.map((a) => {
        const selected = area === a.id;
        const dim = !!traced && AREA_ORDER.indexOf(a.id) > traceEnd;
        const onSelect = () => selectArea(selected ? null : a.id);
        return (
          <div key={a.id} ref={(el) => register(a.id, el)} className="pointer-events-auto absolute top-0 left-0 will-change-transform" style={{ visibility: "hidden" }}>
        <button
          onClick={onSelect}
          data-drop={DROP_OF[a.id]}
          className={clsx(
            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-bold whitespace-nowrap shadow-[0_4px_14px_-6px_rgba(0,0,0,0.25)] backdrop-blur-md transition-all select-none",
            selected ? "border-transparent bg-navy text-white" : "border-navy/10 bg-white/90 text-ink hover:bg-white",
            dim && "opacity-40",
            dragging && DROP_OF[a.id] && "scale-110 border-dashed border-accent/60",
            dragging && DROP_OF[a.id] && dragOver === DROP_OF[a.id] && "scale-125 border-solid border-accent bg-accent! text-white",
          )}
        >
          <span className={clsx("size-2 rounded-full", a.risk === "critical" && !selected && "pulse-dot")} style={{ background: selected ? "#fff" : RISK_HEX[a.risk] }} />
          {a.name}
          <span className={clsx("font-semibold tabular-nums", selected ? "text-white/80" : "text-mute")}>{markerMetric(a)}</span>
          {a.changed && !selected && <span className="rounded-full bg-ai/12 px-1.5 text-[10px] font-extrabold text-ai">plan</span>}
        </button>
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
  const register = useCallback((id: AreaId, el: HTMLElement | null) => {
    markers.current[id] = el;
  }, []);
  const place = useCallback((id: AreaId, x: number, y: number, visible: boolean) => {
    const el = markers.current[id];
    if (!el) return;
    el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
    el.style.visibility = visible ? "visible" : "hidden";
  }, []);
  const area = useTwin((s) => s.area);
  const selectArea = useTwin((s) => s.selectArea);
  const name = useAreas().areas.find((a) => a.id === area)?.name ?? "Whole kitchen";
  const step = (d: number) => {
    const i = area ? AREA_ORDER.indexOf(area) : d > 0 ? -1 : AREA_ORDER.length;
    selectArea(AREA_ORDER[(i + d + AREA_ORDER.length) % AREA_ORDER.length]);
  };

  return (
    <div className="relative h-full w-full bg-[radial-gradient(120%_90%_at_50%_0%,#f9fbfe,#dfe5f0)]">
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
          <Scene controls={controls} insets={insets} />
          <MarkerTracker place={place} />
        </Canvas>
        <Markers register={register} />
      </GLBoundary>
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
        </div>
      </div>
    </div>
  );
}
