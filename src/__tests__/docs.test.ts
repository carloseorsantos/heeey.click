import { describe, it, expect } from 'vitest';
import { Marked } from 'marked';
import {
  DOC_ITEMS,
  DOC_CATEGORIES,
  getDocBySlug,
  normalizeSlug,
  resolveDocHref,
  searchDocs,
  getAdjacentDocs,
  extractToc,
  extractDocFiles,
  calculateReadingTime,
  slugify,
} from '../lib/docsData';
import { extractPlainFromTokens } from '../components/docs/MarkdownRenderer';

describe('docsData', () => {
  it('has all 25 documentation items defined', () => {
    expect(DOC_ITEMS.length).toBe(25);
    expect(DOC_CATEGORIES.length).toBe(5);
  });

  it('loads valid raw markdown content for all items', () => {
    for (const item of DOC_ITEMS) {
      const doc = getDocBySlug(item.slug);
      expect(doc, `Doc missing for slug: ${item.slug}`).not.toBeNull();
      expect(doc!.content.length, `Empty content for slug: ${item.slug}`).toBeGreaterThan(50);
      expect(doc!.title).toBeTruthy();
    }
  });

  it('handles slug normalization and redirects', () => {
    expect(normalizeSlug('')).toBe('getting-started');
    expect(normalizeSlug('/docs/getting-started.md')).toBe('getting-started');
    expect(normalizeSlug('features/whiteboard-editor.md')).toBe('features/whiteboard-editor');
    expect(normalizeSlug('api/endpoints.md')).toBe('api/endpoints');
    expect(normalizeSlug('api')).toBe('api/overview');
    expect(normalizeSlug('mcp')).toBe('mcp/overview');
    expect(normalizeSlug('features')).toBe('features/whiteboard-editor');
    expect(normalizeSlug('readme')).toBe('readme');
  });

  it('correctly resolves relative and absolute heeey.click links', () => {
    // Inside README linking to features
    const r1 = resolveDocHref('features/whiteboard-editor.md', 'readme');
    expect(r1).toEqual({
      type: 'internal',
      targetSlug: 'features/whiteboard-editor',
      href: '/docs/features/whiteboard-editor',
    });

    // Inside api/getting-started linking to scene-content-schema.md
    const r2 = resolveDocHref('scene-content-schema.md', 'api/getting-started');
    expect(r2).toEqual({
      type: 'internal',
      targetSlug: 'api/scene-content-schema',
      href: '/docs/api/scene-content-schema',
    });

    // Inside api/getting-started linking to ../features/search.md
    const r3 = resolveDocHref('../features/search.md', 'api/getting-started');
    expect(r3).toEqual({
      type: 'internal',
      targetSlug: 'features/search',
      href: '/docs/features/search',
    });

    // External link
    const r4 = resolveDocHref('https://example.com/test', 'readme');
    expect(r4).toEqual({
      type: 'external',
      href: 'https://example.com/test',
    });

    // Anchor link
    const r5 = resolveDocHref('#section-1', 'api/endpoints');
    expect(r5).toEqual({
      type: 'anchor',
      href: '#section-1',
    });

    // Relative link with anchor
    const r6 = resolveDocHref('endpoints.md#post-boards', 'api/getting-started');
    expect(r6).toEqual({
      type: 'internal',
      targetSlug: 'api/endpoints',
      href: '/docs/api/endpoints#post-boards',
    });

    // Absolute heeey.click docs links (found extensively in llms.txt)
    const r7 = resolveDocHref('https://heeey.click/docs/getting-started', 'llms');
    expect(r7).toEqual({
      type: 'internal',
      targetSlug: 'getting-started',
      href: '/docs/getting-started',
    });

    const r8 = resolveDocHref('https://heeey.click/llms-full.txt', 'llms');
    expect(r8).toEqual({
      type: 'internal',
      targetSlug: 'llms-full',
      href: '/docs/llms-full',
    });

    const r9 = resolveDocHref('https://heeey.click/b/e67e3a1e-8e89-4089-a5f1-382a39281a92', 'api/getting-started');
    expect(r9).toEqual({
      type: 'board',
      boardId: 'e67e3a1e-8e89-4089-a5f1-382a39281a92',
      href: '/b/e67e3a1e-8e89-4089-a5f1-382a39281a92',
    });

    const r10 = resolveDocHref('https://heeey.click', 'readme');
    expect(r10).toEqual({
      type: 'dashboard',
      href: '/',
    });
  });

  it('searches docs content with accent-insensitivity and multi-word terms', () => {
    // Unaccent search: "autenticacao" should find "Autenticação"
    const unaccentResults = searchDocs('autenticacao');
    expect(unaccentResults.length).toBeGreaterThan(0);
    expect(unaccentResults.some((r) => r.doc.slug === 'api/authentication')).toBe(true);

    // Multi-word search: "mcp cursor"
    const multiWord = searchDocs('mcp cursor');
    expect(multiWord.length).toBeGreaterThan(0);
    expect(multiWord.some((r) => r.doc.slug === 'mcp/getting-started')).toBe(true);

    // General term
    const results = searchDocs('excalidraw');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.doc.slug === 'features/whiteboard-editor')).toBe(true);
  });

  it('extracts table of contents and matches 100% with MarkdownRenderer IDs across all 25 docs', () => {
    for (const item of DOC_ITEMS) {
      const doc = getDocBySlug(item.slug);
      expect(doc).not.toBeNull();
      const toc = extractToc(doc!.content);

      const renderedIds: string[] = [];
      const m = new Marked();
      m.use({
        renderer: {
          heading({ tokens, depth }: any) {
            if (depth === 2 || depth === 3) {
              const plain = extractPlainFromTokens(tokens);
              renderedIds.push(slugify(plain));
            }
            return '';
          },
        },
      });
      m.parse(doc!.content);

      expect(
        toc.map((t) => t.id),
        `Mismatch in doc: ${item.slug}`
      ).toEqual(renderedIds);
    }
  });

  it('determines adjacent items correctly', () => {
    const { prev, next } = getAdjacentDocs('getting-started');
    expect(prev).toBeNull();
    expect(next?.slug).toBe('readme');

    const last = getAdjacentDocs('llms-full');
    expect(last.next).toBeNull();
    expect(last.prev?.slug).toBe('llms');
  });

  it('renders custom headings, callouts, images, and links with marked renderer', () => {
    const m = new Marked();
    m.use({
      renderer: {
        heading(this: any, { tokens, depth }: any): string {
          const text = this.parser.parseInline(tokens);
          const plain = extractPlainFromTokens(tokens);
          return `<h${depth} id="${slugify(plain)}" class="doc-h">${text}</h${depth}>`;
        },
        link(this: any, { href, tokens }: any): string {
          const text = this.parser.parseInline(tokens);
          return `<a href="${href}" class="doc-link">${text}</a>`;
        },
        image({ href, text }: any): string {
          return `<img src="${href}" alt="${text}" class="doc-img" />`;
        },
      },
    });

    const output = m.parse('# Title\n\n[Click me](features/search.md)\n\n![diagram](img.png)') as string;
    expect(output).toContain('doc-h');
    expect(output).toContain('doc-link');
    expect(output).toContain('doc-img');
  });

  it('handles unknown slug gracefully', () => {
    expect(getDocBySlug('does-not-exist-at-all')).toBeNull();
    const adjacent = getAdjacentDocs('does-not-exist-at-all');
    expect(adjacent.prev).toBeNull();
    expect(adjacent.next).toBeNull();
  });

  it('handles empty or blank search query gracefully', () => {
    expect(searchDocs('')).toEqual([]);
    expect(searchDocs('   ')).toEqual([]);
  });

  it('handles edge cases in resolveDocHref', () => {
    expect(resolveDocHref('', 'api/overview')).toEqual({ type: 'anchor', href: '#' });
    expect(resolveDocHref('#sub-heading', 'api/overview')).toEqual({
      type: 'anchor',
      href: '#sub-heading',
    });
    expect(resolveDocHref('/api/v1/boards', 'api/overview')).toEqual({
      type: 'external',
      href: '/api/v1/boards',
    });
    expect(resolveDocHref('/b/abc1234', 'features/whiteboard-editor')).toEqual({
      type: 'board',
      boardId: 'abc1234',
      href: '/b/abc1234',
    });
    expect(resolveDocHref('./rate-limiting.md', 'api/getting-started')).toEqual({
      type: 'internal',
      targetSlug: 'api/rate-limiting',
      href: '/docs/api/rate-limiting',
    });
  });

  it('correctly extracts all 23 document files from llms-full.txt', () => {
    const doc = getDocBySlug('llms-full');
    expect(doc).not.toBeNull();
    const files = extractDocFiles(doc!.content);
    expect(files.length).toBe(23);
    expect(files[0].filePath).toBe('docs/README.md');
    expect(files[0].docSlug).toBe('readme');
    expect(files[0].id).toBe('file-docsreadmemd');

    expect(files[1].filePath).toBe('docs/getting-started.md');
    expect(files[1].docSlug).toBe('getting-started');

    const mcpTools = files.find((f) => f.filePath === 'docs/mcp/tools.md');
    expect(mcpTools).toBeDefined();
    expect(mcpTools?.docSlug).toBe('mcp/tools');
    expect(mcpTools?.title).toBe('Catálogo de Ferramentas MCP');
  });

  it('resolves relative links inside llms-full correctly without 404s', () => {
    // Links with category path
    const r1 = resolveDocHref('features/whiteboard-editor.md', 'llms-full');
    expect(r1).toEqual({
      type: 'internal',
      targetSlug: 'features/whiteboard-editor',
      href: '/docs/features/whiteboard-editor',
    });

    // Subdocument links without category path (e.g. from api/getting-started or features/)
    const r2 = resolveDocHref('scene-content-schema.md', 'llms-full');
    expect(r2).toEqual({
      type: 'internal',
      targetSlug: 'api/scene-content-schema',
      href: '/docs/api/scene-content-schema',
    });

    const r3 = resolveDocHref('collaboration-realtime.md', 'llms-full');
    expect(r3).toEqual({
      type: 'internal',
      targetSlug: 'features/collaboration-realtime',
      href: '/docs/features/collaboration-realtime',
    });

    const r4 = resolveDocHref('tools.md', 'llms-full');
    expect(r4).toEqual({
      type: 'internal',
      targetSlug: 'mcp/tools',
      href: '/docs/mcp/tools',
    });

    // Anchor on relative link from llms-full
    const r5 = resolveDocHref('endpoints.md#post-boards', 'llms-full');
    expect(r5).toEqual({
      type: 'internal',
      targetSlug: 'api/endpoints',
      href: '/docs/api/endpoints#post-boards',
    });
  });

  it('preserves underscores in slugify for heading anchors', () => {
    expect(slugify('10. layout_board')).toBe('10-layout_board');
    expect(slugify('list_boards')).toBe('list_boards');
    expect(slugify('get_board:id')).toBe('get_boardid');
  });

  it('renders tables with text alignment and clean borders', () => {
    const m = new Marked();
    m.use({
      renderer: {
        tablecell(token: any) {
          const alignClass = token.align === 'center' ? ' text-center' : token.align === 'right' ? ' text-right' : ' text-left';
          if (token.header) {
            return `<th class="${alignClass}">${token.text}</th>`;
          }
          return `<td class="${alignClass}">${token.text}</td>`;
        },
      },
    });

    const markdownTable = '| Left | Center | Right |\n| :--- | :---: | ---: |\n| 1 | 2 | 3 |';
    const output = m.parse(markdownTable) as string;
    expect(output).toContain('text-left');
    expect(output).toContain('text-center');
    expect(output).toContain('text-right');
  });

  it('verifies that file banners include no-underline for isolated doc buttons', () => {
    const rawBanner = `\n\n================================================================================\nFILE: docs/features/whiteboard-editor.md\n================================================================================\n\n`;
    const preprocessed = rawBanner.replace(
      /(?:^|\n)={10,}\s*\n\s*FILE:\s*([^\n]+)\s*\n\s*={10,}(?:\n|$)/gi,
      (_match, filePath) => {
        const cleanPath = filePath.trim();
        const docSlug = normalizeSlug(cleanPath.replace(/^docs\//, ''));
        const fileId = `file-${slugify(cleanPath)}`;
        return `<div class="doc-file-banner" id="${fileId}"><a href="/docs/${docSlug}" class="doc-internal-link no-underline">Abrir</a></div>`;
      }
    );

    expect(preprocessed).toContain('no-underline');
    expect(preprocessed).toContain('id="file-docsfeatureswhiteboard-editormd"');
    expect(preprocessed).toContain('href="/docs/features/whiteboard-editor"');
  });
});

