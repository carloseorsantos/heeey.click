/**
 * Automatic diagram layout for agents: nodes and edges in, well-spaced Excalidraw
 * shapes and routed, bound arrows out. Uses a layered (Sugiyama) layout from dagre,
 * so arrows flow in one direction and bend around shapes instead of crossing them.
 */
import { Graph, layout } from '@dagrejs/dagre';
import { ElementSpec, toExcalidrawElements, measureText } from './elementSkeleton';

export type Direction = 'TB' | 'BT' | 'LR' | 'RL';
export type NodeShape = 'rectangle' | 'ellipse' | 'diamond';
export type NodeColor = 'blue' | 'green' | 'yellow' | 'red' | 'violet' | 'gray';

export interface DiagramNode {
  id: string;
  label: string;
  shape?: NodeShape;
  color?: NodeColor;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
}

export interface DiagramInput {
  nodes: DiagramNode[];
  edges?: DiagramEdge[];
  direction?: Direction;
  /** Top-left corner of the diagram on the board */
  origin?: { x: number; y: number };
  nodeSpacing?: number;
  rankSpacing?: number;
}

/** Excalidraw's own palette (stroke, background) */
export const NODE_COLORS: Record<NodeColor, { strokeColor: string; backgroundColor: string }> = {
  blue: { strokeColor: '#1971c2', backgroundColor: '#a5d8ff' },
  green: { strokeColor: '#2f9e44', backgroundColor: '#b2f2bb' },
  yellow: { strokeColor: '#f08c00', backgroundColor: '#ffec99' },
  red: { strokeColor: '#e03131', backgroundColor: '#ffc9c9' },
  violet: { strokeColor: '#6741d9', backgroundColor: '#d0bfff' },
  gray: { strokeColor: '#495057', backgroundColor: '#e9ecef' },
};

export const MAX_DIAGRAM_NODES = 300;
const ARROW_GAP = 8;

export class DiagramError extends Error {}

type Point = { x: number; y: number };

/** Pull the ends of a polyline back so arrowheads do not touch the shapes */
function trimEnds(points: Point[], gap: number): Point[] {
  if (points.length < 2) return points;
  const moveTowards = (from: Point, to: Point) => {
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (length <= gap * 2) return from;
    return { x: from.x + ((to.x - from.x) / length) * gap, y: from.y + ((to.y - from.y) / length) * gap };
  };
  const result = [...points];
  result[0] = moveTowards(points[0], points[1]);
  result[result.length - 1] = moveTowards(points[points.length - 1], points[points.length - 2]);
  return result;
}

interface LayoutNode {
  id: string;
  width: number;
  height: number;
}

interface LayoutEdge {
  from: string;
  to: string;
  label?: string;
}

/** Runs dagre and returns top-left positions for nodes and absolute polylines for edges */
function runLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  options: { direction: Direction; nodeSpacing: number; rankSpacing: number }
) {
  const g = new Graph({ multigraph: true });
  g.setGraph({
    rankdir: options.direction,
    nodesep: options.nodeSpacing,
    ranksep: options.rankSpacing,
    edgesep: 30,
    marginx: 0,
    marginy: 0,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) g.setNode(node.id, { width: node.width, height: node.height });
  edges.forEach((edge, i) => {
    const labelSize = edge.label ? measureText(edge.label, 16) : { width: 0, height: 0 };
    g.setEdge(edge.from, edge.to, { width: labelSize.width, height: labelSize.height, labelpos: 'c' }, `e${i}`);
  });

  layout(g);

  const positions = new Map<string, Point>();
  for (const node of nodes) {
    const laid = g.node(node.id);
    positions.set(node.id, { x: laid.x - node.width / 2, y: laid.y - node.height / 2 });
  }
  const routes = edges.map((edge, i) => (g.edge({ v: edge.from, w: edge.to, name: `e${i}` })?.points ?? []) as Point[]);
  return { positions, routes };
}

function arrowSpec(id: string, from: string, to: string, route: Point[], origin: Point, label?: string): ElementSpec {
  const points = trimEnds(route.map((p) => ({ x: p.x + origin.x, y: p.y + origin.y })), ARROW_GAP);
  const start = points[0];
  return {
    id,
    type: 'arrow',
    x: start.x,
    y: start.y,
    points: points.map((p) => [p.x - start.x, p.y - start.y] as [number, number]),
    start: { id: from },
    end: { id: to },
    ...(label ? { label: { text: label, fontSize: 16 } } : {}),
  };
}

/** Builds a laid-out diagram as element specs (shapes with labels and bound arrows) */
export function layoutDiagram(input: DiagramInput): ElementSpec[] {
  const { nodes, edges = [], direction = 'TB', origin = { x: 0, y: 0 }, nodeSpacing = 60, rankSpacing = 90 } = input;

  if (!Array.isArray(nodes) || nodes.length === 0) throw new DiagramError('Informe ao menos um nó em nodes.');
  if (nodes.length > MAX_DIAGRAM_NODES) throw new DiagramError(`No máximo ${MAX_DIAGRAM_NODES} nós por diagrama.`);
  const ids = new Set<string>();
  for (const node of nodes) {
    if (!node?.id || typeof node.id !== 'string') throw new DiagramError('Cada nó precisa de um id.');
    if (ids.has(node.id)) throw new DiagramError(`Id de nó repetido: ${node.id}`);
    ids.add(node.id);
  }
  for (const edge of edges) {
    if (!ids.has(edge?.from) || !ids.has(edge?.to)) {
      throw new DiagramError(`Aresta aponta para um nó inexistente: ${edge?.from} → ${edge?.to}`);
    }
  }

  // Size each shape the way it will be drawn (labels wrap and grow the shape)
  const shapeSpecs: ElementSpec[] = nodes.map((node) => ({
    id: node.id,
    type: node.shape ?? 'rectangle',
    label: String(node.label ?? node.id),
    ...(node.color && NODE_COLORS[node.color] ? NODE_COLORS[node.color] : {}),
  }));
  const sized = new Map(
    toExcalidrawElements(shapeSpecs)
      .filter((e) => ids.has(e.id))
      .map((e) => [e.id, { id: e.id, width: e.width as number, height: e.height as number }])
  );

  const { positions, routes } = runLayout(Array.from(sized.values()), edges, { direction, nodeSpacing, rankSpacing });

  const specs: ElementSpec[] = shapeSpecs.map((spec) => {
    const position = positions.get(spec.id!)!;
    const size = sized.get(spec.id!)!;
    return { ...spec, x: Math.round(position.x + origin.x), y: Math.round(position.y + origin.y), width: size.width, height: size.height };
  });
  edges.forEach((edge, i) => {
    specs.push(arrowSpec(`${edge.from}-${edge.to}-${i}`, edge.from, edge.to, routes[i], origin, edge.label));
  });
  return specs;
}

const SHAPE_TYPES = new Set(['rectangle', 'ellipse', 'diamond']);

/**
 * Re-lays out an existing scene: shapes and the arrows connecting them are
 * rearranged; labels move with their shapes; everything else stays put.
 * Returns only the elements that changed, as full Excalidraw elements.
 */
export function relayoutElements(
  elements: readonly any[],
  options: { direction?: Direction; nodeSpacing?: number; rankSpacing?: number } = {}
): any[] {
  const live = elements.filter((e) => e && !e.isDeleted);
  const shapes = live.filter((e) => SHAPE_TYPES.has(e.type));
  if (shapes.length === 0) return [];
  const shapeIds = new Set(shapes.map((s) => s.id));
  const arrows = live.filter(
    (e) => e.type === 'arrow' && shapeIds.has(e.startBinding?.elementId) && shapeIds.has(e.endBinding?.elementId)
  );

  // Keep the diagram where it was: same top-left corner as before
  const origin = {
    x: Math.min(...shapes.map((s) => s.x)),
    y: Math.min(...shapes.map((s) => s.y)),
  };
  const { positions, routes } = runLayout(
    shapes.map((s) => ({ id: s.id, width: s.width, height: s.height })),
    arrows.map((a) => ({ from: a.startBinding.elementId, to: a.endBinding.elementId })),
    { direction: options.direction ?? 'TB', nodeSpacing: options.nodeSpacing ?? 60, rankSpacing: options.rankSpacing ?? 90 }
  );

  const now = Date.now();
  const bump = (el: any, changes: Record<string, unknown>) => ({
    ...el,
    ...changes,
    version: (el.version || 1) + 1,
    versionNonce: Math.floor(Math.random() * 2 ** 31),
    updated: now,
  });

  const changed: any[] = [];
  const delta = new Map<string, Point>();
  for (const shape of shapes) {
    const p = positions.get(shape.id)!;
    const x = Math.round(p.x + origin.x);
    const y = Math.round(p.y + origin.y);
    delta.set(shape.id, { x: x - shape.x, y: y - shape.y });
    changed.push(bump(shape, { x, y }));
  }
  // Labels (bound text) follow their shape
  for (const text of live) {
    if (text.type !== 'text' || !text.containerId || !delta.has(text.containerId)) continue;
    const d = delta.get(text.containerId)!;
    changed.push(bump(text, { x: text.x + d.x, y: text.y + d.y }));
  }
  arrows.forEach((arrow, i) => {
    const points = trimEnds(routes[i].map((p) => ({ x: p.x + origin.x, y: p.y + origin.y })), ARROW_GAP);
    if (points.length < 2) return;
    const start = points[0];
    const relative = points.map((p) => [p.x - start.x, p.y - start.y]);
    const xs = relative.map((p) => p[0]);
    const ys = relative.map((p) => p[1]);
    changed.push(
      bump(arrow, {
        x: start.x,
        y: start.y,
        points: relative,
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      })
    );
    // Arrow labels sit at the middle of the new route
    for (const text of live) {
      if (text.type !== 'text' || text.containerId !== arrow.id) continue;
      const mid = points[Math.floor(points.length / 2)];
      changed.push(bump(text, { x: mid.x - text.width / 2, y: mid.y - text.height / 2 }));
    }
  });
  return changed;
}
