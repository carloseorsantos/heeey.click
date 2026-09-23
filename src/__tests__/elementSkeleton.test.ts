import { describe, it, expect } from 'vitest';
import { toExcalidrawElements, wrapText, measureText } from '../lib/elementSkeleton';

const byId = (elements: any[]) => Object.fromEntries(elements.map((e) => [e.id, e]));

describe('toExcalidrawElements', () => {
  it('fills Excalidraw defaults for a bare shape', () => {
    const [rect] = toExcalidrawElements([{ id: 'r', type: 'rectangle', x: 10, y: 20 }]);
    expect(rect).toMatchObject({
      id: 'r',
      type: 'rectangle',
      x: 10,
      y: 20,
      width: 180,
      height: 80,
      version: 1,
      isDeleted: false,
      strokeColor: '#1e1e1e',
      roundness: { type: 3 },
    });
    expect(typeof rect.seed).toBe('number');
    expect(typeof rect.versionNonce).toBe('number');
  });

  it('adds a centered bound text for labels and grows the shape to fit', () => {
    const elements = byId(
      toExcalidrawElements([{ id: 'r', type: 'rectangle', width: 100, height: 40, label: 'Um rótulo bem comprido para caber' }])
    );
    const label = elements['r-label'];
    expect(label).toMatchObject({ type: 'text', containerId: 'r', textAlign: 'center', verticalAlign: 'middle' });
    expect(label.originalText).toBe('Um rótulo bem comprido para caber');
    expect(elements.r.boundElements).toEqual([{ type: 'text', id: 'r-label' }]);
    expect(elements.r.width).toBeGreaterThanOrEqual(label.width);
    expect(elements.r.height).toBeGreaterThanOrEqual(label.height);
    expect(label.x).toBeGreaterThanOrEqual(elements.r.x);
  });

  it('binds arrows to shapes and starts/ends them at the shape edges', () => {
    const elements = byId(
      toExcalidrawElements([
        { id: 'a', type: 'rectangle', x: 0, y: 0, width: 100, height: 100 },
        { id: 'b', type: 'rectangle', x: 300, y: 0, width: 100, height: 100 },
        { id: 'link', type: 'arrow', start: { id: 'a' }, end: { id: 'b' }, label: 'chama' },
      ])
    );
    const arrow = elements.link;
    expect(arrow.startBinding).toMatchObject({ elementId: 'a' });
    expect(arrow.endBinding).toMatchObject({ elementId: 'b' });
    expect(arrow.x).toBeCloseTo(108);
    expect(arrow.points[1][0]).toBeCloseTo(300 - 8 - 108);
    expect(elements.a.boundElements).toContainEqual({ type: 'arrow', id: 'link' });
    expect(elements.b.boundElements).toContainEqual({ type: 'arrow', id: 'link' });
    expect(elements['link-label']).toMatchObject({ containerId: 'link', text: 'chama' });
  });

  it('binds to shapes already on the board and returns them with a new version', () => {
    const existing = toExcalidrawElements([{ id: 'old', type: 'ellipse', x: 0, y: 300 }]);
    const result = byId(toExcalidrawElements([{ id: 'new', type: 'diamond' }, { id: 'e', type: 'arrow', start: { id: 'new' }, end: { id: 'old' } }], existing));
    expect(result.old.version).toBe(2);
    expect(result.old.boundElements).toContainEqual({ type: 'arrow', id: 'e' });
    expect(result.e.endBinding.elementId).toBe('old');
  });

  it('keeps explicit Excalidraw properties and generates ids when missing', () => {
    const [text] = toExcalidrawElements([{ type: 'text', text: 'Olá\nmundo', fontSize: 28, strokeColor: '#e03131' }]);
    expect(text.id).toMatch(/^[A-Za-z0-9]{20}$/);
    expect(text).toMatchObject({ text: 'Olá\nmundo', fontSize: 28, strokeColor: '#e03131', height: measureText('Olá\nmundo', 28).height });
  });
});

describe('wrapText', () => {
  it('wraps on word boundaries and keeps explicit line breaks', () => {
    expect(wrapText('um dois tres quatro', 60, 10)).toBe('um dois\ntres\nquatro');
    expect(wrapText('a\nb', 100, 10)).toBe('a\nb');
  });
});

describe('describeElements', () => {
  it('folds labels into shapes, shows arrow endpoints and hides deleted elements', async () => {
    const { describeElements } = await import('../lib/elementSkeleton');
    const elements = toExcalidrawElements([
      { id: 'a', type: 'rectangle', x: 0, y: 0, label: 'Início', backgroundColor: '#a5d8ff' },
      { id: 'b', type: 'ellipse', x: 300, y: 0 },
      { id: 'e', type: 'arrow', start: { id: 'a' }, end: { id: 'b' } },
      { id: 't', type: 'text', text: 'nota' },
    ]);
    elements.push({ id: 'gone', type: 'rectangle', isDeleted: true });

    const described = describeElements(elements);
    expect(described.map((e) => e.id)).toEqual(['a', 'b', 't', 'e']);
    expect(described[0]).toMatchObject({ type: 'rectangle', label: 'Início', backgroundColor: '#a5d8ff' });
    expect(described[2]).toMatchObject({ type: 'text', text: 'nota' });
    expect(described[3]).toMatchObject({ type: 'arrow', start: { id: 'a' }, end: { id: 'b' } });
  });
});
