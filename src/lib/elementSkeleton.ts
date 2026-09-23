/**
 * Turns short element descriptions (what an API client or AI agent writes) into
 * complete Excalidraw elements: defaults, shape labels as bound text, and arrows
 * bound to the shapes they connect. Full Excalidraw elements pass through with
 * any missing fields filled in.
 *
 * Runs without a DOM (API server, MCP server): text size is estimated.
 */

export type ShapeType = 'rectangle' | 'ellipse' | 'diamond';
export type ElementType = ShapeType | 'text' | 'arrow' | 'line' | 'frame';

export interface ElementSpec {
  id?: string;
  type: ElementType;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  /** Text content (type "text") */
  text?: string;
  /** Text shown inside a shape or on an arrow */
  label?: string | { text: string; fontSize?: number };
  fontSize?: number;
  strokeColor?: string;
  backgroundColor?: string;
  /** Relative points for lines and arrows, e.g. [[0, 0], [200, 0]] */
  points?: [number, number][];
  /** Arrow endpoints bound to elements of the same request or already on the board */
  start?: { id: string };
  end?: { id: string };
  [key: string]: unknown;
}

const FONT_FAMILY = 5; // Excalifont, the default hand-drawn font in Excalidraw 0.18
const LINE_HEIGHT = 1.25;
const CHAR_WIDTH_EM = 0.6;
const LABEL_PADDING = 20;
const ARROW_GAP = 8;

const DEFAULT_SIZE: Record<string, { width: number; height: number }> = {
  rectangle: { width: 180, height: 80 },
  ellipse: { width: 140, height: 100 },
  diamond: { width: 180, height: 110 },
  frame: { width: 600, height: 400 },
};

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function randomId(length = 20): string {
  let id = '';
  for (let i = 0; i < length; i++) id += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
  return id;
}

const randomInt = () => Math.floor(Math.random() * 2 ** 31);

export function measureText(text: string, fontSize: number): { width: number; height: number } {
  const lines = text.split('\n');
  const longest = Math.max(...lines.map((line) => Array.from(line).length), 1);
  return {
    width: Math.ceil(longest * fontSize * CHAR_WIDTH_EM),
    height: Math.ceil(lines.length * fontSize * LINE_HEIGHT),
  };
}

/** Greedy word wrap so labels fit the container width */
export function wrapText(text: string, maxWidth: number, fontSize: number): string {
  const maxChars = Math.max(Math.floor(maxWidth / (fontSize * CHAR_WIDTH_EM)), 4);
  return text
    .split('\n')
    .map((paragraph) => {
      const lines: string[] = [];
      let line = '';
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (Array.from(candidate).length <= maxChars || !line) line = candidate;
        else {
          lines.push(line);
          line = word;
        }
      }
      lines.push(line);
      return lines.join('\n');
    })
    .join('\n');
}

function baseElement(spec: ElementSpec, now: number) {
  return {
    angle: 0,
    strokeColor: '#1e1e1e',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: randomInt(),
    version: 1,
    versionNonce: randomInt(),
    isDeleted: false,
    boundElements: null as { id: string; type: string }[] | null,
    updated: now,
    link: null,
    locked: false,
    id: spec.id || randomId(),
    x: spec.x ?? 0,
    y: spec.y ?? 0,
  };
}

function textElement(id: string, text: string, fontSize: number, x: number, y: number, now: number, extra: Record<string, unknown> = {}) {
  const size = measureText(text, fontSize);
  return {
    ...baseElement({ type: 'text', id, x, y }, now),
    type: 'text',
    width: size.width,
    height: size.height,
    text,
    originalText: text,
    fontSize,
    fontFamily: FONT_FAMILY,
    textAlign: 'left',
    verticalAlign: 'top',
    containerId: null as string | null,
    lineHeight: LINE_HEIGHT,
    autoResize: true,
    ...extra,
  };
}

function labelOf(spec: ElementSpec): { text: string; fontSize: number } | null {
  if (!spec.label) return null;
  if (typeof spec.label === 'string') return spec.label.trim() ? { text: spec.label, fontSize: 20 } : null;
  return spec.label.text?.trim() ? { text: spec.label.text, fontSize: spec.label.fontSize ?? 20 } : null;
}

type Box = { x: number; y: number; width: number; height: number };

/** Point where the segment from the box center towards `toward` leaves the box, plus a gap */
function edgePoint(box: Box, toward: { x: number; y: number }, gap: number) {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const scale = Math.min(
    dx === 0 ? Infinity : box.width / 2 / Math.abs(dx),
    dy === 0 ? Infinity : box.height / 2 / Math.abs(dy)
  );
  const length = Math.hypot(dx, dy);
  return {
    x: cx + dx * scale + (dx / length) * gap,
    y: cy + dy * scale + (dy / length) * gap,
  };
}

/**
 * Converts specs to Excalidraw elements. Existing board elements are used to resolve
 * arrow endpoints; shapes (new or existing) that gain an arrow binding are returned
 * too, so the result can be upserted as-is.
 */
export function toExcalidrawElements(specs: readonly ElementSpec[], existing: readonly any[] = []): any[] {
  const now = Date.now();
  const output = new Map<string, any>();
  const existingById = new Map(existing.filter((e) => e && !e.isDeleted).map((e) => [e.id, e]));

  // 1. Shapes, text and frames first so arrows can bind to them
  for (const spec of specs) {
    if (spec.type === 'arrow' || spec.type === 'line') continue;
    const { label: _label, start: _start, end: _end, type: _type, ...props } = spec;
    const base = baseElement(spec, now);

    if (spec.type === 'text') {
      const fontSize = spec.fontSize ?? 20;
      const text = String(spec.text ?? '');
      const element = { ...textElement(base.id, text, fontSize, base.x, base.y, now), ...props, text, originalText: text };
      output.set(element.id, element);
      continue;
    }

    const size = DEFAULT_SIZE[spec.type] ?? DEFAULT_SIZE.rectangle;
    const label = labelOf(spec);
    let width = spec.width ?? size.width;
    let height = spec.height ?? size.height;

    const element: any = {
      ...base,
      type: spec.type,
      width,
      height,
      roundness: spec.type === 'rectangle' ? { type: 3 } : spec.type === 'diamond' ? { type: 2 } : null,
      ...(spec.type === 'frame' ? { name: label?.text ?? null } : {}),
      ...props,
    };

    if (label && spec.type !== 'frame') {
      // Grow the shape so the wrapped label fits
      const wrapped = wrapText(label.text, Math.max(width - LABEL_PADDING * 2, 60), label.fontSize);
      const textSize = measureText(wrapped, label.fontSize);
      const inset = spec.type === 'rectangle' ? 1 : 1.5; // ellipses and diamonds have less usable area
      width = Math.max(width, Math.ceil(textSize.width * inset + LABEL_PADDING * 2));
      height = Math.max(height, Math.ceil(textSize.height * inset + LABEL_PADDING * 2));
      element.width = width;
      element.height = height;

      const labelId = `${element.id}-label`;
      output.set(
        labelId,
        textElement(
          labelId,
          wrapped,
          label.fontSize,
          element.x + (width - textSize.width) / 2,
          element.y + (height - textSize.height) / 2,
          now,
          { containerId: element.id, textAlign: 'center', verticalAlign: 'middle', originalText: label.text }
        )
      );
      element.boundElements = [...(element.boundElements || []), { type: 'text', id: labelId }];
    }
    output.set(element.id, element);
  }

  const findBox = (id: string): any => output.get(id) ?? existingById.get(id);

  // 2. Lines and arrows, bound to their endpoints when given
  for (const spec of specs) {
    if (spec.type !== 'arrow' && spec.type !== 'line') continue;
    const { label: _label, start, end, points: givenPoints, type: _type, ...props } = spec;
    const base = baseElement(spec, now);
    const source = start ? findBox(start.id) : undefined;
    const target = end ? findBox(end.id) : undefined;

    let x = base.x;
    let y = base.y;
    let points: [number, number][] = givenPoints?.length ? givenPoints : [[0, 0], [spec.width ?? 200, spec.height ?? 0]];

    if (source && target && !givenPoints?.length) {
      const sourceCenter = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
      const targetCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
      const from = edgePoint(source, targetCenter, ARROW_GAP);
      const to = edgePoint(target, sourceCenter, ARROW_GAP);
      x = from.x;
      y = from.y;
      points = [[0, 0], [to.x - from.x, to.y - from.y]];
    }

    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const element: any = {
      ...base,
      x,
      y,
      type: spec.type,
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
      points,
      lastCommittedPoint: null,
      startBinding: null,
      endBinding: null,
      startArrowhead: null,
      endArrowhead: spec.type === 'arrow' ? 'arrow' : null,
      roundness: { type: 2 },
      elbowed: false,
      ...props,
    };

    const bind = (shape: any) => {
      if (!shape || spec.type !== 'arrow') return null;
      const updated = { ...shape, boundElements: [...(shape.boundElements || []), { type: 'arrow', id: element.id }] };
      if (existingById.has(shape.id) && !output.has(shape.id)) updated.version = (shape.version || 1) + 1;
      output.set(shape.id, updated);
      return { elementId: shape.id, focus: 0, gap: ARROW_GAP };
    };
    element.startBinding = bind(source);
    element.endBinding = bind(target);

    const label = labelOf(spec);
    if (label) {
      const labelId = `${element.id}-label`;
      const size = measureText(label.text, label.fontSize);
      const mid = points[Math.floor(points.length / 2)] ?? points[0];
      const midPoint = points.length === 2 ? [(points[0][0] + points[1][0]) / 2, (points[0][1] + points[1][1]) / 2] : mid;
      output.set(
        labelId,
        textElement(labelId, label.text, label.fontSize, x + midPoint[0] - size.width / 2, y + midPoint[1] - size.height / 2, now, {
          containerId: element.id,
          textAlign: 'center',
          verticalAlign: 'middle',
        })
      );
      element.boundElements = [...(element.boundElements || []), { type: 'text', id: labelId }];
    }
    output.set(element.id, element);
  }

  return Array.from(output.values());
}

/**
 * Compact, model-friendly view of a scene (the inverse of toExcalidrawElements):
 * shape labels are folded into their shape and arrows show what they connect.
 */
export function describeElements(elements: readonly any[]): Record<string, unknown>[] {
  const live = elements.filter((e) => e && !e.isDeleted);
  const labels = new Map<string, string>();
  for (const e of live) {
    if (e.type === 'text' && e.containerId) labels.set(e.containerId, e.originalText ?? e.text);
  }
  const round = (n: unknown) => (typeof n === 'number' ? Math.round(n) : n);

  return live
    .filter((e) => !(e.type === 'text' && e.containerId && live.some((c) => c.id === e.containerId)))
    .map((e) => {
      const item: Record<string, unknown> = {
        id: e.id,
        type: e.type,
        x: round(e.x),
        y: round(e.y),
        width: round(e.width),
        height: round(e.height),
      };
      if (e.type === 'text') item.text = e.originalText ?? e.text;
      if (labels.has(e.id)) item.label = labels.get(e.id);
      if (e.type === 'frame' && e.name) item.label = e.name;
      if (e.startBinding?.elementId) item.start = { id: e.startBinding.elementId };
      if (e.endBinding?.elementId) item.end = { id: e.endBinding.elementId };
      if (e.strokeColor && e.strokeColor !== '#1e1e1e') item.strokeColor = e.strokeColor;
      if (e.backgroundColor && e.backgroundColor !== 'transparent') item.backgroundColor = e.backgroundColor;
      if (e.link) item.link = e.link;
      return item;
    });
}
