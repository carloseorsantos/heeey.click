import { describe, it, expect } from 'vitest';
import { sceneToMarkdown, type SceneMarkdownStrings } from '../lib/sceneMarkdown';
import { toExcalidrawElements } from '../lib/elementSkeleton';
import { ptBR } from '../i18n/locales/pt-BR';

const strings: SceneMarkdownStrings = { ...ptBR.exportAI.md, untitled: ptBR.board.untitled };

const md = (elements: unknown, title: unknown = 'Minha lousa') => sceneToMarkdown(title, elements, strings);

describe('sceneToMarkdown', () => {
  it('returns null for an empty board', () => {
    expect(md([])).toBeNull();
    expect(md(undefined)).toBeNull();
    // Shapes without text carry nothing to read
    expect(md(toExcalidrawElements([{ type: 'rectangle' }]))).toBeNull();
  });

  it('starts with the board title and an explanation', () => {
    const out = md(toExcalidrawElements([{ type: 'text', text: 'Olá' }]), 'Plano\nde ação')!;
    expect(out.startsWith('# Plano / de ação\n\n> Este arquivo descreve o conteúdo de uma lousa do Heeey')).toBe(true);
    expect(md(toExcalidrawElements([{ type: 'text', text: 'Olá' }]), '   ')).toContain('# Quadro sem título');
  });

  it('lists loose text with multi-line text kept in the item', () => {
    const out = md(toExcalidrawElements([{ type: 'text', text: 'Primeira linha\nSegunda linha' }]))!;
    expect(out).toContain('## Conteúdo\n\n- Primeira linha\n  Segunda linha');
  });

  it('lists labeled shapes, naming ellipses and diamonds', () => {
    const out = md(
      toExcalidrawElements([
        { type: 'rectangle', label: 'Início', x: 0, y: 0 },
        { type: 'diamond', label: 'Aprovado?', x: 0, y: 200 },
        { type: 'ellipse', label: 'Fim', x: 0, y: 400 },
      ])
    )!;
    expect(out).toContain('- Início\n- Aprovado? (losango)\n- Fim (elipse)');
  });

  it('turns arrows between shapes into connections, with and without a label', () => {
    const out = md(
      toExcalidrawElements([
        { id: 'a', type: 'rectangle', label: 'Pedido', x: 0, y: 0 },
        { id: 'b', type: 'diamond', label: 'Pago?', x: 300, y: 0 },
        { id: 'c', type: 'rectangle', label: 'Enviar', x: 600, y: 0 },
        { type: 'arrow', start: { id: 'a' }, end: { id: 'b' } },
        { type: 'arrow', start: { id: 'b' }, end: { id: 'c' }, label: 'sim' },
      ])
    )!;
    expect(out).toContain('## Conexões\n\n- Pedido → Pago?\n- Pago? → Enviar — sim');
    // The arrow label is not listed again as loose text
    expect(out.match(/sim/g)).toHaveLength(1);
  });

  it('follows the arrowheads and names unlabeled or missing ends', () => {
    const elements = toExcalidrawElements([
      { id: 'a', type: 'rectangle', label: 'A', x: 0, y: 0 },
      { id: 'b', type: 'rectangle', x: 300, y: 0 },
      { id: 'back', type: 'arrow', start: { id: 'a' }, end: { id: 'b' }, startArrowhead: 'arrow', endArrowhead: null },
      { id: 'both', type: 'arrow', start: { id: 'a' }, end: { id: 'b' }, startArrowhead: 'arrow', y: 10 },
      { id: 'loose', type: 'arrow', start: { id: 'a' }, x: 90, y: 40, points: [[0, 0], [0, 500]] },
    ]);
    const out = md(elements)!;
    expect(out).toContain('- (sem rótulo) → A');
    expect(out).toContain('- A ↔ (sem rótulo)');
    expect(out).toContain('- A → …');
  });

  it('reads text drawn over a shape as its label and loose arrow ends touching shapes as connections', () => {
    // Like the flowchart template: plain texts over the cards and arrows not bound to them
    const card = (id: string, x: number) => ({ id, type: 'rectangle' as const, x, y: 140, width: 160, height: 70 });
    const text = (text: string, x: number) => ({ type: 'text' as const, text, x: x + 10, y: 164, width: 140, height: 23 });
    const out = md(
      toExcalidrawElements([
        card('s1', 80),
        text('Início', 80),
        card('s2', 330),
        text('Execução', 330),
        { type: 'arrow', x: 245, y: 175, points: [[0, 0], [80, 0]] },
        // A panel with several texts keeps them as separate items
        { type: 'rectangle', x: 0, y: 400, width: 600, height: 300 },
        { type: 'text', text: 'Nota 1', x: 20, y: 420 },
        { type: 'text', text: 'Nota 2', x: 20, y: 500 },
        // An arrow far from everything is not a connection
        { type: 'arrow', x: 2000, y: 2000, label: 'solta' },
      ])
    )!;
    expect(out).toContain('## Conteúdo\n\n- Início\n- Execução\n- Nota 1\n- Nota 2\n- solta\n');
    expect(out).toContain('## Conexões\n\n- Início → Execução');
    expect(out.match(/Início/g)).toHaveLength(2);
  });

  it('does not read lines drawn inside a shape as connections', () => {
    const out = md(
      toExcalidrawElements([
        { type: 'rectangle', x: 0, y: 0, width: 1000, height: 1000 },
        { type: 'text', text: 'Tabela', x: 400, y: 20 },
        // Grid line from edge to edge and a divider in the middle
        { type: 'line', x: 0, y: 300, points: [[0, 0], [1000, 0]] },
        { type: 'line', x: 200, y: 500, points: [[0, 0], [600, 0]] },
      ])
    )!;
    expect(out).not.toContain('## Conexões');
  });

  it('keeps board text from becoming links, HTML or code', () => {
    const out = md(
      toExcalidrawElements([
        { type: 'text', text: '[clique](javascript:alert(1)) <img src=x onerror=alert(1)> `code`', y: 0 },
        { type: 'text', text: 'Barra', link: 'https://a.com/\\ <x>', y: 100 },
      ]),
      '[Título](javascript:x)'
    )!;
    expect(out).toContain('# \\[Título\\](javascript:x)');
    expect(out).toContain('- \\[clique\\](javascript:alert(1)) \\<img src=x onerror=alert(1)\\> \\`code\\`');
    expect(out).toContain('- [Barra](https://a.com/%5C%20%3Cx%3E)');
  });

  it('keeps existing escapes in links and drops links that cannot be encoded', () => {
    const out = md(
      toExcalidrawElements([
        { type: 'text', text: 'Redirect', link: 'https://a.com/?r=https%3A%2F%2Fb.com%2Fx&q=a%26b&p=100%', y: 0 },
        { type: 'text', text: 'Emoji', link: 'https://a.com/😀', y: 100 },
        { type: 'text', text: 'Quebrado', link: 'https://a.com/\uD800', y: 200 },
      ])
    )!;
    expect(out).toContain('- [Redirect](https://a.com/?r=https%3A%2F%2Fb.com%2Fx&q=a%26b&p=100%25)');
    expect(out).toContain('- [Emoji](https://a.com/%F0%9F%98%80)');
    expect(out).toContain('- Quebrado\n');
  });

  it('does not read marks inside a card or a table row as connections', () => {
    const out = md(
      toExcalidrawElements([
        // Table: grid line from the left edge, next to a row text
        { type: 'rectangle', x: 0, y: 0, width: 1000, height: 600 },
        { type: 'text', text: 'Linha 1', x: 10, y: 10 },
        { type: 'text', text: 'Linha 2', x: 10, y: 310 },
        { type: 'line', x: 0, y: 300, points: [[0, 0], [1000, 0]] },
        // A tick that starts at the edge of a card and ends inside it
        { id: 'card', type: 'rectangle', label: 'A', x: 2000, y: 0, width: 52, height: 65 },
        { type: 'arrow', x: 2005, y: 5, points: [[0, 0], [20, 20]] },
      ])
    )!;
    expect(out).not.toContain('## Conexões');
  });

  it('escapes the image marker once inside a link and keeps headings out of text', () => {
    const out = md(
      [
        { id: 'img', type: 'image', x: 0, y: 0, width: 100, height: 100, link: 'https://a.com' },
        { id: 'cap', type: 'text', text: 'foto [1]', containerId: 'img', x: 0, y: 0 },
        { id: 't', type: 'text', text: 'Nota\n# Falso título\nC:\\Users\\ana', x: 0, y: 200 },
      ],
      'Plano #'
    )!;
    expect(out).toContain('- [\\[imagem\\] foto \\[1\\]](https://a.com)');
    expect(out).toContain('- Nota\n  \\# Falso título\n  C:\\Users\\ana');
    expect(out).toContain('# Plano \\#\n');
  });

  it('reads the name of magic frames', () => {
    const out = md([
      { id: 'mf', type: 'magicframe', name: 'Mágico', x: 0, y: 0, width: 400, height: 300 },
      { id: 't', type: 'text', text: 'Dentro', frameId: 'mf', x: 10, y: 10 },
    ])!;
    expect(out).toContain('## Mágico\n\n- Dentro');
  });

  it('turns frames into sections and keeps loose elements apart', () => {
    const elements = toExcalidrawElements([
      { id: 'f2', type: 'frame', label: 'Depois', x: 0, y: 1000 },
      { id: 'f1', type: 'frame', label: 'Antes', x: 0, y: 0 },
      { id: 'f3', type: 'frame', x: 0, y: 2000 },
      { type: 'text', text: 'Dentro de antes', frameId: 'f1', x: 10, y: 10 },
      { type: 'rectangle', label: 'Dentro de depois', frameId: 'f2', x: 10, y: 1010 },
      { type: 'text', text: 'Solto', x: 900, y: 0 },
    ]);
    const out = md(elements)!;
    expect(out).toContain('## Antes\n\n- Dentro de antes\n\n## Depois\n\n- Dentro de depois\n\n## Frame sem nome\n\n_Frame vazio_');
    expect(out).toContain('## Fora dos frames\n\n- Solto');
    expect(out.indexOf('## Antes')).toBeLessThan(out.indexOf('## Depois'));
  });

  it('skips deleted elements and the labels of deleted shapes', () => {
    const elements = toExcalidrawElements([
      { id: 'gone', type: 'rectangle', label: 'Apagada' },
      { type: 'text', text: 'Viva', y: 100 },
    ]).map((e) => (e.id === 'gone' || e.id === 'gone-label' ? { ...e, isDeleted: true } : e));
    const out = md(elements)!;
    expect(out).toContain('- Viva');
    expect(out).not.toContain('Apagada');
  });

  it('shows images as a marker without their data', () => {
    const out = md([
      { id: 'img', type: 'image', x: 0, y: 0, width: 100, height: 100, fileId: 'file-1', status: 'saved', dataURL: 'data:image/png;base64,AAAA' },
    ])!;
    expect(out).toContain('- [imagem]');
    expect(out).not.toMatch(/file-1|base64|data:/);
  });

  it('renders safe links as Markdown links and drops other schemes', () => {
    const out = md(
      toExcalidrawElements([
        { type: 'text', text: 'Site [oficial]', link: 'https://heeey.click/docs (x)', y: 0 },
        { type: 'text', text: 'Perigoso', link: 'javascript:alert(1)', y: 100 },
        { type: 'rectangle', link: 'https://example.com', y: 200 },
      ])
    )!;
    expect(out).toContain('- [Site \\[oficial\\]](https://heeey.click/docs%20%28x%29)');
    expect(out).toContain('- Perigoso\n');
    expect(out).not.toContain('javascript:');
    expect(out).toContain('- [link](https://example.com)');
  });

  it('orders items top to bottom, then left to right', () => {
    const out = md(
      toExcalidrawElements([
        { type: 'text', text: 'C', x: 0, y: 200 },
        { type: 'text', text: 'B', x: 300, y: 0 },
        { type: 'text', text: 'A', x: 0, y: 0 },
      ])
    )!;
    expect(out).toContain('- A\n- B\n- C');
  });

  it('never outputs coordinates, ids or colors', () => {
    const out = md(
      toExcalidrawElements([
        { id: 'shape-id-123', type: 'rectangle', label: 'Caixa', x: 4321, y: 8765, strokeColor: '#e03131', backgroundColor: '#ffc9c9' },
        { id: 'other-id-456', type: 'rectangle', label: 'Outra', x: 4321, y: 9999 },
        { id: 'arrow-id-789', type: 'arrow', start: { id: 'shape-id-123' }, end: { id: 'other-id-456' } },
      ])
    )!;
    expect(out).not.toMatch(/shape-id|other-id|arrow-id|4321|8765|#e03131|#ffc9c9/);
  });

  it('tolerates malformed elements', () => {
    const out = md([
      null,
      42,
      'text',
      {},
      { id: 1, type: 'text', text: 'id numérico' },
      { id: 'no-type', text: 'sem tipo' },
      { id: 't1', type: 'text', text: { evil: true }, x: 'a', y: null },
      { id: 't2', type: 'text', text: 'Ok', x: NaN, y: Infinity, frameId: 42, link: 123 },
      { id: 'a1', type: 'arrow', startBinding: 'bad', endBinding: { elementId: 7 } },
      { id: 'a2', type: 'arrow', startBinding: { elementId: 'missing' }, label: 5 },
    ]);
    expect(out).toContain('- Ok');
    expect(out).not.toMatch(/id numérico|sem tipo|evil|object Object/);
    expect(md('not an array')).toBeNull();
  });
});
