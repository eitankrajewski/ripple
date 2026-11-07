import {
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getBezierPath,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Beef, ChefHat, CircleAlert, Flame, Leaf, Package, Radio, ReceiptText, ScanSearch, Target, Timer, Utensils, X, Zap } from "lucide-react";
import { useEffect } from "react";
import type { RippleEdge, RippleNode, RiskLevel } from "../engine/types";
import { RISK_HEX } from "../lib/ui";
import { useTwin } from "../store";

const COL_W = 192;
const ROW_H = 70;
const NODE_W = 166;
const COLUMNS = ["Event", "Ingredients", "Prep tasks", "Stations", "Orders", "Pickup outcome"];

type RNodeData = { [K in keyof RippleNode]: RippleNode[K] } & { dim: boolean; traced: boolean; changed: boolean };
type HeaderData = { label: string; index: number };
type REdgeData = { relation: RippleEdge["relation"]; active: boolean; risk: RiskLevel; dim: boolean; traced: boolean; showLabel: boolean };

function iconFor(n: RippleNode) {
  const cls = "size-4";
  switch (n.type) {
    case "event":
      return n.label.toLowerCase().includes("rush") ? <Zap className={cls} /> : n.label.toLowerCase().includes("stock") ? <ScanSearch className={cls} /> : <Radio className={cls} />;
    case "ingredient":
      return n.id.includes("chicken") ? <Flame className={cls} /> : n.id.includes("beef") ? <Beef className={cls} /> : <Leaf className={cls} />;
    case "task":
      return <Utensils className={cls} />;
    case "station":
      return n.id === "st-pack" ? <Package className={cls} /> : n.id === "st-cook" ? <Flame className={cls} /> : <ChefHat className={cls} />;
    case "order":
      return <ReceiptText className={cls} />;
    case "outcome":
      return <Target className={cls} />;
  }
}

function RippleNodeView({ data }: NodeProps<Node<RNodeData>>) {
  const color = RISK_HEX[data.risk];
  const hot = data.risk !== "normal";
  const big = data.type === "event" || data.type === "outcome";
  const meter = data.type === "station" || data.type === "ingredient" ? Math.min(100, Number(data.meta ?? 0)) : null;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: data.dim ? 0.22 : 1, scale: 1 }}
      transition={{ duration: 0.35 }}
      className={clsx("relative rounded-xl border px-3 py-2 backdrop-blur-md", big ? "py-3" : "")}
      style={{
        width: NODE_W,
        borderColor: `${color}${hot ? "aa" : "33"}`,
        background: `linear-gradient(160deg, ${color}${hot ? "26" : "10"}, rgba(10,14,24,0.92) 65%)`,
        boxShadow: hot
          ? `0 0 0 1px ${color}22, 0 0 ${data.risk === "critical" ? 28 : 16}px -2px ${color}88, inset 0 1px 0 rgba(255,255,255,0.06)`
          : data.traced
            ? `0 0 0 1px #818cf8aa, 0 0 18px -4px #818cf8`
            : "inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      {data.risk === "critical" && !data.dim && (
        <span className="ripple-ring pointer-events-none absolute inset-0 rounded-xl border" style={{ borderColor: `${color}66` }} />
      )}
      {data.type === "event" && (
        <AnimatePresence>
          <motion.span
            key={data.label}
            className="pointer-events-none absolute inset-0 rounded-xl border-2"
            style={{ borderColor: color }}
            initial={{ opacity: 0.9, scale: 1 }}
            animate={{ opacity: 0, scale: 1.6 }}
            transition={{ duration: 1.4, ease: "easeOut" }}
          />
        </AnimatePresence>
      )}
      {data.changed && (
        <span className="absolute -top-2 -right-2 rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-ink-950 shadow-[0_0_12px_#818cf8]">
          CHANGED
        </span>
      )}
      <div className="flex items-start gap-2">
        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md" style={{ background: `${color}1f`, color }}>
          {iconFor(data)}
        </span>
        <div className="min-w-0 flex-1">
          <div className={clsx("truncate font-semibold text-slate-100", big ? "font-display text-[14px]" : "text-[12.5px]")}>{data.label}</div>
          <div className="truncate text-[11px] leading-tight text-slate-400">{data.detail}</div>
          {data.type === "order" && data.meta && <div className="mt-0.5 truncate text-[10px] text-slate-500">{data.meta}</div>}
        </div>
      </div>
      {meter !== null && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${color}88, ${color})`, boxShadow: `0 0 8px ${color}` }}
            initial={false}
            animate={{ width: `${meter}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
      )}
    </motion.div>
  );
}

function HeaderNode({ data }: NodeProps<Node<HeaderData>>) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-slate-500 uppercase" style={{ width: NODE_W }}>
      <span className="grid size-4 place-items-center rounded bg-white/5 font-mono text-[9px] text-slate-400">{data.index + 1}</span>
      {data.label}
    </div>
  );
}

function RippleEdgeView({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps<Edge<REdgeData>>) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.35 });
  const d = data!;
  const color = d.traced ? "#a5b4fc" : d.active ? RISK_HEX[d.risk] : "#94a3b8";
  const opacity = d.dim ? 0.06 : d.active || d.traced ? 0.95 : 0.16;
  const dur = d.risk === "critical" ? 1.3 : 2;
  return (
    <>
      {(d.active || d.traced) && !d.dim && <path d={path} fill="none" stroke={color} strokeWidth={7} strokeOpacity={0.12} style={{ filter: "blur(3px)" }} />}
      <BaseEdge
        id={id}
        path={path}
        className={d.active && !d.dim ? "edge-flow" : undefined}
        style={{ stroke: color, strokeOpacity: opacity, strokeWidth: d.active || d.traced ? 1.8 : 1.2, transition: "stroke 0.5s, stroke-opacity 0.5s" }}
      />
      {d.active && !d.dim && (
        <circle r={3.2} fill={color} style={{ filter: `drop-shadow(0 0 6px ${color})` }}>
          <animateMotion dur={`${dur}s`} repeatCount="indefinite" path={path} />
        </circle>
      )}
      {(d.showLabel || d.traced) && !d.dim && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute rounded-full border border-white/10 bg-ink-900/90 px-1.5 py-px font-mono text-[9px] tracking-wide text-slate-300"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, color }}
          >
            {d.relation}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const nodeTypes = { ripple: RippleNodeView, header: HeaderNode };
const edgeTypes = { ripple: RippleEdgeView };

/** Walks edges backwards from an order to the root event. */
function tracePath(nodes: RippleNode[], edges: RippleEdge[], startId: string) {
  const keepNodes = new Set<string>([startId]);
  const keepEdges = new Set<string>();
  const queue = [startId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const e of edges) {
      if (e.target !== id || keepNodes.has(e.source)) continue;
      const src = nodes.find((n) => n.id === e.source);
      const prefer = edges.filter((x) => x.target === id);
      const anyActive = prefer.some((x) => x.active);
      if (anyActive && !e.active) continue;
      keepEdges.add(e.id);
      if (src) {
        keepNodes.add(src.id);
        queue.push(src.id);
      }
    }
  }
  for (const e of edges) {
    if (e.source !== startId || e.target !== "outcome") continue;
    keepEdges.add(e.id);
    keepNodes.add("outcome");
  }
  return { keepNodes, keepEdges };
}

function MapInner() {
  const state = useTwin((s) => s.state);
  const previewId = useTwin((s) => s.previewStrategyId);
  const traced = useTwin((s) => s.tracedOrderId);
  const trace = useTwin((s) => s.trace);
  const { fitView } = useReactFlow();

  const strategy = state.strategies.find((s) => s.id === previewId);
  const graph = strategy ? strategy.preview : { nodes: state.nodes, edges: state.edges };
  const changed = new Set(strategy?.changedNodeIds ?? []);

  const { nodes, edges } = (() => {
    const tr = traced && graph.nodes.some((n) => n.id === traced) ? tracePath(graph.nodes, graph.edges, traced) : null;
    const riskOf = new Map(graph.nodes.map((n) => [n.id, n.risk]));
    const header: Node<HeaderData>[] = COLUMNS.map((label, index) => ({
      id: `h-${index}`,
      type: "header",
      position: { x: index * COL_W, y: -48 },
      data: { label, index },
      selectable: false,
      draggable: false,
    }));
    const rn: Node<RNodeData>[] = graph.nodes.map((n) => ({
      id: n.id,
      type: "ripple",
      position: { x: n.column * COL_W, y: n.row * ROW_H },
      data: { ...n, dim: !!tr && !tr.keepNodes.has(n.id), traced: !!tr && tr.keepNodes.has(n.id), changed: changed.has(n.id) },
      draggable: false,
    }));
    const re: Edge<REdgeData>[] = graph.edges.map((e) => {
      const risk = riskOf.get(e.target) === "normal" ? (riskOf.get(e.source) ?? "normal") : (riskOf.get(e.target) ?? "normal");
      const srcCol = graph.nodes.find((n) => n.id === e.source)?.column ?? 0;
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: "ripple",
        data: {
          relation: e.relation,
          active: e.active,
          risk: risk === "normal" ? "warning" : risk,
          dim: !!tr && !tr.keepEdges.has(e.id),
          traced: !!tr && tr.keepEdges.has(e.id),
          showLabel: e.active && srcCol <= 1,
        },
      };
    });
    return { nodes: [...header, ...rn], edges: re };
  })();

  useEffect(() => {
    const onResize = () => fitView({ padding: 0.06, duration: 300 });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fitView]);

  const tracedNode = traced ? graph.nodes.find((n) => n.id === traced) : null;

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.04 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        minZoom={0.3}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, n) => {
          if (n.type !== "ripple") return;
          const t = (n.data as unknown as RNodeData).type;
          if (t === "order") trace(traced === n.id ? null : n.id);
          else trace(null);
        }}
        onPaneClick={() => trace(null)}
      />
      <AnimatePresence>
        {strategy && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute right-3 bottom-3 flex items-center gap-2 rounded-full whitespace-nowrap border border-accent/40 bg-ink-900/90 px-3 py-1.5 text-xs text-indigo-100 shadow-[0_0_24px_-6px_#818cf8] backdrop-blur"
          >
            <Timer className="size-3.5 text-accent" />
            Previewing <b className="font-semibold">{strategy.label}</b>
            <span className="hidden text-slate-400 2xl:inline">· not applied until you approve</span>
          </motion.div>
        )}
        {tracedNode && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-3 left-3 flex max-w-md items-start gap-2 rounded-xl border border-accent/30 bg-ink-900/90 px-3 py-2 text-xs shadow-xl backdrop-blur"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" style={{ color: RISK_HEX[tracedNode.risk] }} />
            <div>
              <div className="font-semibold text-slate-100">Tracing {tracedNode.label.split(" ")[0]} back to the root cause</div>
              <div className="text-slate-400">{tracedNode.detail}</div>
            </div>
            <button onClick={() => trace(null)} className="ml-2 rounded p-0.5 text-slate-500 hover:bg-white/10 hover:text-slate-200" aria-label="Clear trace">
              <X className="size-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function RippleMap() {
  return (
    <ReactFlowProvider>
      <MapInner />
    </ReactFlowProvider>
  );
}
