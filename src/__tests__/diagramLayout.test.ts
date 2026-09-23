import { describe, it, expect } from 'vitest';
import { layoutDiagram, relayoutElements, DiagramError } from '../lib/diagramLayout';
import { toExcalidrawElements } from '../lib/elementSkeleton';

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const shapesOf = (elements: any[]) => elements.filter((e) => ['rectangle', 'ellipse', 'diamond'].includes(e.type));

const flow = {
  nodes: [
    { id: 'start', label: 'Início', shape: 'ellipse' as const, color: 'green' as const },
    { id: 'form', label: 'Preencher formulário de cadastro' },
    { id: 'valid', label: 'Dados válidos?', shape: 'diamond' as const, color: 'yellow' as const },
    { id: 'save', label: 'Salvar' },
    { id: 'error', label: 'Mostrar erro', color: 'red' as const },
  ],
  edges: [
    { from: 'start', to: 'form' },
    { from: 'form', to: 'valid' },
    { from: 'valid', to: 'save', label: 'sim' },
    { from: 'valid', to: 'error', label: 'não' },
    { from: 'error', to: 'form' },
  ],
};

describe('layoutDiagram', () => {
  it('stacks ranks top to bottom without overlapping shapes', () => {
    const elements = toExcalidrawElements(layoutDiagram(flow));
    const byId = Object.fromEntries(elements.map((e) => [e.id, e]));
    expect(byId.start.y).toBeLessThan(byId.form.y);
    expect(byId.form.y).toBeLessThan(byId.valid.y);
    expect(byId.valid.y).toBeLessThan(byId.save.y);

    const shapes = shapesOf(elements);
    for (let i = 0; i < shapes.length; i++) {
      for (let j = i + 1; j < shapes.length; j++) expect(overlaps(shapes[i], shapes[j])).toBe(false);
    }
    expect(byId.valid).toMatchObject({ type: 'diamond', backgroundColor: '#ffec99' });
  });

  it('routes bound arrows between shapes, with labels', () => {
    const elements = toExcalidrawElements(layoutDiagram(flow));
    const arrows = elements.filter((e) => e.type === 'arrow');
    expect(arrows).toHaveLength(5);
    for (const arrow of arrows) {
      expect(arrow.startBinding?.elementId).toBeDefined();
      expect(arrow.endBinding?.elementId).toBeDefined();
      expect(arrow.points.length).toBeGreaterThanOrEqual(2);
    }
    const yes = arrows.find((a) => a.startBinding.elementId === 'valid' && a.endBinding.elementId === 'save');
    expect(elements.find((e) => e.containerId === yes.id)?.text).toBe('sim');
  });

  it('flows left to right and honors the origin', () => {
    const specs = layoutDiagram({ ...flow, direction: 'LR', origin: { x: 1000, y: 500 } });
    const byId = Object.fromEntries(specs.map((s) => [s.id, s]));
    expect(byId.start.x!).toBeLessThan(byId.form.x!);
    expect(Math.min(...specs.filter((s) => s.type !== 'arrow').map((s) => s.x!))).toBe(1000);
  });

  it('rejects invalid graphs', () => {
    expect(() => layoutDiagram({ nodes: [] })).toThrow(DiagramError);
    expect(() => layoutDiagram({ nodes: [{ id: 'a', label: 'A' }, { id: 'a', label: 'B' }] })).toThrow(/repetido/);
    expect(() => layoutDiagram({ nodes: [{ id: 'a', label: 'A' }], edges: [{ from: 'a', to: 'x' }] })).toThrow(/inexistente/);
  });
});

describe('relayoutElements', () => {
  it('untangles overlapping shapes, moves labels with them and re-routes arrows', () => {
    const messy = toExcalidrawElements([
      { id: 'a', type: 'rectangle', x: 0, y: 0, label: 'A' },
      { id: 'b', type: 'rectangle', x: 20, y: 10, label: 'B' },
      { id: 'c', type: 'rectangle', x: 40, y: 20, label: 'C' },
      { id: 'ab', type: 'arrow', start: { id: 'a' }, end: { id: 'b' } },
      { id: 'bc', type: 'arrow', start: { id: 'b' }, end: { id: 'c' } },
      { id: 'note', type: 'text', x: 900, y: 900, text: 'fica onde está' },
    ]);
    const changed = relayoutElements(messy);
    const scene = messy.map((e) => changed.find((c) => c.id === e.id) ?? e);
    const byId = Object.fromEntries(scene.map((e) => [e.id, e]));

    const shapes = shapesOf(scene);
    for (let i = 0; i < shapes.length; i++) {
      for (let j = i + 1; j < shapes.length; j++) expect(overlaps(shapes[i], shapes[j])).toBe(false);
    }
    expect(byId.a.y).toBeLessThan(byId.b.y);
    expect(byId['b-label'].x).toBeGreaterThanOrEqual(byId.b.x);
    expect(byId['b-label'].y).toBeGreaterThanOrEqual(byId.b.y);
    expect(changed.find((c) => c.id === 'note')).toBeUndefined();
    expect(byId.ab.version).toBe(messy.find((e) => e.id === 'ab').version + 1);
    // Diagram keeps its top-left corner
    expect(Math.min(...shapes.map((s) => s.x))).toBe(0);
  });

  it('does nothing on boards without shapes', () => {
    expect(relayoutElements(toExcalidrawElements([{ type: 'text', text: 'oi' }]))).toEqual([]);
  });
});
