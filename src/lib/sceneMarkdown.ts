import { describeElements } from './elementSkeleton';

/**
 * Turns a board scene into Markdown that people and AI models can read ("Export for AI").
 * Built on describeElements (the MCP's get_board view): labels folded into their shapes and
 * arrows resolved to what they connect. No coordinates, colors, IDs or image data; links are
 * kept as the user wrote them (a link to an element carries the board URL).
 *
 * Scene elements come from other users, the API and MCP: every field is checked before use.
 */

/** Fixed texts of the generated file, in the current language */
export interface SceneMarkdownStrings {
  intro: string;
  untitled: string;
  /** Section with the elements when the board has no frames */
  content: string;
  /** Section with the elements outside frames */
  outsideFrames: string;
  connections: string;
  untitledFrame: string;
  emptyFrame: string;
  image: string;
  unlabeled: string;
  link: string;
  ellipse: string;
  diamond: string;
}

const MAX_TEXT = 5000;
const FRAME_TYPES = new Set(['frame', 'magicframe']);
const CONNECTOR_TYPES = new Set(['arrow', 'line']);
const SHAPE_TYPES = new Set(['rectangle', 'ellipse', 'diamond']);
/** How far a loose arrow end may be from a shape and still count as touching it */
const SNAP_DISTANCE = 24;

type Item = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  link: string | null;
  frameId: string | null;
};

function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n?/g, '\n').trim().slice(0, MAX_TEXT);
}

/** One line of text (headings, link texts and connection ends) */
function inline(text: string): string {
  return text.replace(/\s*\n\s*/g, ' / ');
}

function safeLink(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2000) return null;
  const url = value.trim();
  if (!/^(https?:\/\/|mailto:)/i.test(url)) return null;
  try {
    // Encodes only what is missing, so existing escapes (%2F, %26…) stay as they are.
    // Parentheses would close the Markdown link; a lone surrogate throws and drops the link
    return url.replace(/%(?![0-9A-Fa-f]{2})|[^\w\-.~:/?#@!$&'*+,;=%]|[()]/gu, (c) =>
      c === '%' ? '%25' : c === '(' ? '%28' : c === ')' ? '%29' : encodeURIComponent(c)
    );
  } catch {
    return null;
  }
}

/** Board text is plain text: it must not turn into links, HTML, code or headings in the generated Markdown */
const escapeMarkdown = (text: string) =>
  text
    // A backslash only escapes ASCII punctuation (keeps paths like C:\Users readable)
    .replace(/\\(?=[!-/:-@[-`{-~])/g, '\\\\')
    .replace(/[[\]<>`]/g, '\\$&')
    .replace(/^(\s*)#/gm, '$1\\#')
    .replace(/#(\s*)$/gm, '\\#$1');

const byReadingOrder = (a: { x: number; y: number }, b: { x: number; y: number }) => a.y - b.y || a.x - b.x;

const toNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/** Returns null when the board has nothing to export */
export function sceneToMarkdown(title: unknown, elements: unknown, strings: SceneMarkdownStrings): string | null {
  const valid = (Array.isArray(elements) ? elements : []).filter(
    (e): e is Record<string, any> => !!e && typeof e === 'object' && typeof e.id === 'string' && typeof e.type === 'string'
  );
  const originals = new Map(valid.map((e) => [e.id as string, e]));

  const items: Item[] = describeElements(valid).map((d) => {
    const original = originals.get(d.id as string)!;
    return {
      id: d.id as string,
      type: d.type as string,
      x: toNumber(original.x),
      y: toNumber(original.y),
      width: Math.abs(toNumber(original.width)),
      height: Math.abs(toNumber(original.height)),
      // Frame names: describeElements only reads them for "frame", not "magicframe"
      label: escapeMarkdown(cleanText(FRAME_TYPES.has(original.type) ? original.name : (d.label ?? d.text))),
      link: safeLink(original.link),
      frameId: typeof original.frameId === 'string' ? original.frameId : null,
    };
  });
  const itemsById = new Map(items.map((item) => [item.id, item]));

  // Smallest shape (or text) whose box, grown by `margin`, contains the point
  const inside = (item: Item, px: number, py: number, margin = 0) =>
    px >= item.x - margin && px <= item.x + item.width + margin && py >= item.y - margin && py <= item.y + item.height + margin;
  const smallestAt = (candidates: Item[], px: number, py: number, margin = 0) => {
    let best: Item | undefined;
    for (const c of candidates) {
      if (inside(c, px, py, margin) && (!best || c.width * c.height < best.width * best.height)) best = c;
    }
    return best;
  };

  // Text drawn over a shape without being bound to it (e.g. the templates) reads as its label
  const absorbed = new Set<string>();
  const shapes = items.filter((item) => SHAPE_TYPES.has(item.type));
  const textsByShape = new Map<Item, Item[]>();
  for (const text of items) {
    if (text.type !== 'text' || !text.label) continue;
    const shape = smallestAt(shapes, text.x + text.width / 2, text.y + text.height / 2);
    if (shape && !shape.label) textsByShape.set(shape, [...(textsByShape.get(shape) ?? []), text]);
  }
  for (const [shape, texts] of textsByShape) {
    // Only when it is clearly a label: several texts in one shape are a panel with content
    if (texts.length !== 1) continue;
    shape.label = texts[0].label;
    shape.link ??= texts[0].link;
    absorbed.add(texts[0].id);
  }
  const targets = items.filter(
    (item) => !absorbed.has(item.id) && !FRAME_TYPES.has(item.type) && !CONNECTOR_TYPES.has(item.type)
  );

  // Near the outline of the box: a line drawn inside a panel (a table, a divider) does not touch it
  const nearEdge = (item: Item, px: number, py: number) =>
    inside(item, px, py, SNAP_DISTANCE) && !inside(item, px, py, -SNAP_DISTANCE);

  /** Absolute position of the first or last point of a line or arrow */
  const endPoint = (original: Record<string, any>, which: 'start' | 'end'): { x: number; y: number } | undefined => {
    const points = Array.isArray(original.points) ? original.points : [];
    const point = which === 'start' ? points[0] : points[points.length - 1];
    if (points.length < 2 || !Array.isArray(point)) return undefined;
    return { x: toNumber(original.x) + toNumber(point[0]), y: toNumber(original.y) + toNumber(point[1]) };
  };

  /** Bound end, or the shape a loose end touches */
  const endOf = (original: Record<string, any>, which: 'start' | 'end'): string | undefined => {
    const bound = original[`${which}Binding`]?.elementId;
    if (typeof bound === 'string' && itemsById.has(bound)) return bound;
    const point = endPoint(original, which);
    if (!point) return undefined;
    return smallestAt(
      targets.filter((target) => nearEdge(target, point.x, point.y)),
      point.x,
      point.y,
      SNAP_DISTANCE
    )?.id;
  };

  /**
   * A line with no bound end that stays inside one shape is a mark on it (a table row, a divider,
   * a tick in a card), not a connection: both ends on the same shape, one end loose inside the
   * other end's shape, or one end on a text that sits inside the other end's shape.
   */
  const isMarkInside = (original: Record<string, any>, start?: string, end?: string) => {
    if (start === end) return true;
    const [a, b] = [start, end].map((id) => (id ? itemsById.get(id) : undefined));
    const holds = (outer: Item | undefined, inner: Item | undefined, which: 'start' | 'end') => {
      if (!outer) return false;
      if (inner) return inner.type === 'text' && inside(outer, inner.x + inner.width / 2, inner.y + inner.height / 2);
      const point = endPoint(original, which);
      return !!point && inside(outer, point.x, point.y);
    };
    return holds(a, b, 'end') || holds(b, a, 'start');
  };

  const frames = items.filter((item) => FRAME_TYPES.has(item.type)).sort(byReadingOrder);
  const frameIds = new Set(frames.map((frame) => frame.id));

  const describe = (item: Item): string | null => {
    const shape = item.type === 'ellipse' ? strings.ellipse : item.type === 'diamond' ? strings.diamond : '';
    let text = item.label;
    if (item.type === 'image') {
      // Inside a link the marker's brackets must be escaped; the label already is
      const marker = item.link ? escapeMarkdown(strings.image) : strings.image;
      text = text ? `${marker} ${text}` : marker;
    }
    if (!text && !item.link) return null;
    if (item.link) text = `[${inline(text || strings.link)}](${item.link})`;
    // Multi-line text stays in the list item
    return `- ${text.replace(/\n/g, '\n  ')}${shape ? ` (${shape})` : ''}`;
  };

  // Arrows and lines bound to something become connections; the rest are listed like any element
  const endName = (id: string | undefined) => {
    const end = id ? itemsById.get(id) : undefined;
    return end ? inline(end.label) || strings.unlabeled : '…';
  };
  const connections: { x: number; y: number; line: string }[] = [];
  const listed: Item[] = [];
  for (const item of items) {
    if (FRAME_TYPES.has(item.type) || absorbed.has(item.id)) continue;
    const original = originals.get(item.id)!;
    const start = CONNECTOR_TYPES.has(item.type) ? endOf(original, 'start') : undefined;
    const end = CONNECTOR_TYPES.has(item.type) ? endOf(original, 'end') : undefined;
    const bound = !!(original.startBinding?.elementId || original.endBinding?.elementId);
    if ((start || end) && (bound || !isMarkInside(original, start, end))) {
      let from = endName(start);
      let to = endName(end);
      const head = !!original.endArrowhead;
      const tail = !!original.startArrowhead;
      if (tail && !head) [from, to] = [to, from];
      const symbol = head && tail ? '↔' : head || tail ? '→' : '—';
      const label = inline(item.label);
      const link = item.link ? ` ([${strings.link}](${item.link}))` : '';
      connections.push({ x: item.x, y: item.y, line: `- ${from} ${symbol} ${to}${label ? ` — ${label}` : ''}${link}` });
      continue;
    }
    listed.push(item);
  }

  const sections: string[] = [];
  const list = (entries: Item[]) =>
    entries
      .sort(byReadingOrder)
      .map(describe)
      .filter((line): line is string => line !== null);

  for (const frame of frames) {
    const lines = list(listed.filter((item) => item.frameId === frame.id));
    const name = inline(frame.label) || strings.untitledFrame;
    sections.push(`## ${name}\n\n${lines.length ? lines.join('\n') : `_${strings.emptyFrame}_`}`);
  }
  const loose = list(listed.filter((item) => !item.frameId || !frameIds.has(item.frameId)));
  if (loose.length) sections.push(`## ${frames.length ? strings.outsideFrames : strings.content}\n\n${loose.join('\n')}`);
  if (connections.length) {
    sections.push(`## ${strings.connections}\n\n${connections.sort(byReadingOrder).map((c) => c.line).join('\n')}`);
  }

  if (!sections.length) return null;
  const heading = inline(escapeMarkdown(cleanText(title))) || strings.untitled;
  return `# ${heading}\n\n> ${strings.intro}\n\n${sections.join('\n\n')}\n`;
}
