/**
 * Documentation data structures, manifest, search, and navigation helpers.
 */

import { normalizeForSearch, getSearchTerms } from './search';

export type DocCategory = 'overview' | 'features' | 'api' | 'mcp' | 'llms';

export interface DocItem {
  slug: string;
  category: DocCategory;
  title: string;
  description: string;
  order: number;
  filePath: string;
}

export interface DocCategoryMeta {
  id: DocCategory;
  labelKey: string;
  defaultLabel: string;
  order: number;
}

export const DOC_CATEGORIES: DocCategoryMeta[] = [
  { id: 'overview', labelKey: 'docs.categories.overview', defaultLabel: 'Começando', order: 1 },
  { id: 'features', labelKey: 'docs.categories.features', defaultLabel: 'Recursos da Lousa', order: 2 },
  { id: 'api', labelKey: 'docs.categories.api', defaultLabel: 'API REST v1', order: 3 },
  { id: 'mcp', labelKey: 'docs.categories.mcp', defaultLabel: 'Servidor MCP (IA)', order: 4 },
  { id: 'llms', labelKey: 'docs.categories.llms', defaultLabel: 'Descoberta para IA', order: 5 },
];

export const DOC_ITEMS: DocItem[] = [
  // Overview
  {
    slug: 'getting-started',
    category: 'overview',
    title: 'Começando com o Heeey (Quick Start)',
    description: 'Primeiros passos, criação de quadros, compartilhamento e colaboração em tempo real sem cadastro.',
    order: 1,
    filePath: '/docs/getting-started.md',
  },
  {
    slug: 'readme',
    category: 'overview',
    title: 'Visão Geral & Índice da Documentação',
    description: 'Visão geral do ecossistema, arquitetura, índice completo de tópicos e especificações técnicas.',
    order: 2,
    filePath: '/docs/README.md',
  },

  // Features
  {
    slug: 'features/whiteboard-editor',
    category: 'features',
    title: 'Canvas & Ferramentas de Desenho',
    description: 'Ferramentas de desenho, formas vetoriais, texto encadernado, setas magnéticas e atalhos de teclado.',
    order: 10,
    filePath: '/docs/features/whiteboard-editor.md',
  },
  {
    slug: 'features/collaboration-realtime',
    category: 'features',
    title: 'Colaboração & Tempo Real',
    description: 'Multiplayer com Supabase Realtime, broadcast de deltas, presença, cursores ao vivo e permissões.',
    order: 11,
    filePath: '/docs/features/collaboration-realtime.md',
  },
  {
    slug: 'features/folders-and-organization',
    category: 'features',
    title: 'Pastas, Organização & Lixeira',
    description: 'Estruturação hierárquica, navegação por breadcrumbs, modelos de quadros e proteção com lixeira.',
    order: 12,
    filePath: '/docs/features/folders-and-organization.md',
  },
  {
    slug: 'features/version-history',
    category: 'features',
    title: 'Histórico de Versões & Restauração',
    description: 'Snapshots automáticos a cada 10 min, retenção de 30 dias e restauração segura sem perda de dados.',
    order: 13,
    filePath: '/docs/features/version-history.md',
  },
  {
    slug: 'features/i18n',
    category: 'features',
    title: 'Internacionalização (i18n)',
    description: 'Suporte completo a Português e Inglês, detecção de idioma e sincronização com o Excalidraw.',
    order: 14,
    filePath: '/docs/features/i18n.md',
  },
  {
    slug: 'features/libraries',
    category: 'features',
    title: 'Bibliotecas de Componentes',
    description: 'Armazenamento em nuvem de bibliotecas reutilizáveis, cache local para convidados e migração.',
    order: 15,
    filePath: '/docs/features/libraries.md',
  },
  {
    slug: 'features/media-and-images',
    category: 'features',
    title: 'Imagens & Otimização de Mídia',
    description: 'Compressão WebP no cliente, upload assíncrono para o Supabase Storage e fallback offline.',
    order: 16,
    filePath: '/docs/features/media-and-images.md',
  },
  {
    slug: 'features/search',
    category: 'features',
    title: 'Busca Global no Canvas',
    description: 'Pesquisa full-text em títulos e textos de elementos desenhados com prévia contextual e destaque.',
    order: 17,
    filePath: '/docs/features/search.md',
  },

  // API
  {
    slug: 'api/overview',
    category: 'api',
    title: 'Visão Geral da API REST v1',
    description: 'Princípios da API, URL base, edge runtime, formato JSON e segurança com zero-secrets na edge.',
    order: 20,
    filePath: '/docs/api/overview.md',
  },
  {
    slug: 'api/getting-started',
    category: 'api',
    title: 'Primeiros Passos com a API (Quick Start)',
    description: 'Como gerar chaves, autenticar requisições curl/TypeScript e manipular quadros via API.',
    order: 21,
    filePath: '/docs/api/getting-started.md',
  },
  {
    slug: 'api/authentication',
    category: 'api',
    title: 'Autenticação & Escopos de Chaves',
    description: 'Estrutura do token hk_..., escopos read-only vs read-write, hashing SHA-256 e políticas RLS.',
    order: 22,
    filePath: '/docs/api/authentication.md',
  },
  {
    slug: 'api/endpoints',
    category: 'api',
    title: 'Referência Completa de Endpoints',
    description: 'Documentação detalhada de rotas /boards e /folders com parâmetros, respostas e exemplos.',
    order: 23,
    filePath: '/docs/api/endpoints.md',
  },
  {
    slug: 'api/scene-content-schema',
    category: 'api',
    title: 'Esquema de Conteúdo da Cena (Element Spec)',
    description: 'Especificação resumida de nós, formas, textos, setas conectadas e atributos de estilo.',
    order: 24,
    filePath: '/docs/api/scene-content-schema.md',
  },
  {
    slug: 'api/pagination',
    category: 'api',
    title: 'Paginação de Resultados',
    description: 'Padrão de paginação por cursor e offset, limites de página e navegação de listas volumosas.',
    order: 25,
    filePath: '/docs/api/pagination.md',
  },
  {
    slug: 'api/rate-limiting',
    category: 'api',
    title: 'Taxas & Limites Operacionais',
    description: 'Limites de requisições por minuto, tamanhos máximos de payload e boas práticas de integração.',
    order: 26,
    filePath: '/docs/api/rate-limiting.md',
  },
  {
    slug: 'api/error-handling',
    category: 'api',
    title: 'Tratamento de Erros na API',
    description: 'Códigos de status HTTP, formato de resposta de erro padronizado e mensagens explicativas.',
    order: 27,
    filePath: '/docs/api/error-handling.md',
  },

  // MCP Server
  {
    slug: 'mcp/overview',
    category: 'mcp',
    title: 'Visão Geral do Servidor MCP',
    description: 'Servidor Streamable HTTP para agentes de IA (Claude Code, Desktop, Cursor) manipularem lousas.',
    order: 30,
    filePath: '/docs/mcp/overview.md',
  },
  {
    slug: 'mcp/getting-started',
    category: 'mcp',
    title: 'Configurando Agentes MCP',
    description: 'Guia passo a passo de configuração no Claude Desktop, Claude Code e Cursor IDE.',
    order: 31,
    filePath: '/docs/mcp/getting-started.md',
  },
  {
    slug: 'mcp/tools',
    category: 'mcp',
    title: 'Catálogo de Ferramentas MCP',
    description: 'Referência completa das 13 ferramentas MCP para consulta, criação, layout e busca de quadros.',
    order: 32,
    filePath: '/docs/mcp/tools.md',
  },
  {
    slug: 'mcp/diagram-layout',
    category: 'mcp',
    title: 'Layout Automático de Diagramas',
    description: 'Algoritmo de Sugiyama/Dagre para arranjo automático de nós em camadas, setas inteligentes e fluxo.',
    order: 33,
    filePath: '/docs/mcp/diagram-layout.md',
  },
  {
    slug: 'mcp/auth-and-permissions',
    category: 'mcp',
    title: 'Autenticação & Permissões MCP',
    description: 'Segurança em chamadas MCP, propagação de contexto do usuário e restrições de permissão.',
    order: 34,
    filePath: '/docs/mcp/auth-and-permissions.md',
  },

  // LLMs
  {
    slug: 'llms',
    category: 'llms',
    title: 'Índice Resumido para LLMs (llms.txt)',
    description: 'Resumo estruturado em texto puro e links de referência para modelos de linguagem e agentes.',
    order: 40,
    filePath: '/docs/llms.txt',
  },
  {
    slug: 'llms-full',
    category: 'llms',
    title: 'Documentação Completa para LLMs (llms-full.txt)',
    description: 'Arquivo único concatenando toda a documentação do projeto para consumo por agentes e LLMs.',
    order: 41,
    filePath: '/docs/llms-full.txt',
  },
];

// Raw files loaded via Vite eager glob
const RAW_DOCS = import.meta.glob('/docs/**/*.{md,txt}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Get raw content of a document by file path */
export function getDocRawContent(filePath: string): string {
  if (RAW_DOCS[filePath]) {
    return RAW_DOCS[filePath];
  }
  // Try alternative prefix or normalization
  const normalized = filePath.startsWith('/') ? filePath : `/${filePath}`;
  if (RAW_DOCS[normalized]) {
    return RAW_DOCS[normalized];
  }
  return '';
}

/** Normalize and map slug to a canonical DocItem */
export function normalizeSlug(rawSlug?: string | null): string {
  if (!rawSlug) return 'getting-started';
  let slug = rawSlug.trim().toLowerCase();
  // Strip leading/trailing slashes
  slug = slug.replace(/^\/+|\/+$/g, '');
  // Strip .md or .txt
  slug = slug.replace(/\.(md|txt)$/i, '');
  // Strip docs/ prefix if present
  if (slug.startsWith('docs/')) {
    slug = slug.slice('docs/'.length);
  }

  if (slug === '' || slug === 'docs') return 'getting-started';
  if (slug === 'index' || slug === 'readme') return 'readme';
  if (slug === 'features') return 'features/whiteboard-editor';
  if (slug === 'api') return 'api/overview';
  if (slug === 'mcp') return 'mcp/overview';
  return slug;
}

/** Find DocItem by slug (with normalization and alias support) */
export function getDocBySlug(rawSlug?: string | null): (DocItem & { content: string }) | null {
  const slug = normalizeSlug(rawSlug);
  const item = DOC_ITEMS.find((d) => d.slug.toLowerCase() === slug.toLowerCase());
  if (!item) return null;
  const content = getDocRawContent(item.filePath);
  return { ...item, content };
}

/** Get adjacent (previous and next) docs in reading order */
export function getAdjacentDocs(currentSlug: string): {
  prev: DocItem | null;
  next: DocItem | null;
} {
  const normalized = normalizeSlug(currentSlug);
  const index = DOC_ITEMS.findIndex((d) => d.slug.toLowerCase() === normalized.toLowerCase());
  if (index === -1) {
    return { prev: null, next: null };
  }
  const prev = index > 0 ? DOC_ITEMS[index - 1] : null;
  const next = index < DOC_ITEMS.length - 1 ? DOC_ITEMS[index + 1] : null;
  return { prev, next };
}

/** Group doc items by category */
export function getDocsGroupedByCategory(): {
  category: DocCategoryMeta;
  docs: DocItem[];
}[] {
  return DOC_CATEGORIES.map((category) => {
    const docs = DOC_ITEMS.filter((d) => d.category === category.id).sort((a, b) => a.order - b.order);
    return { category, docs };
  });
}

/** Search docs by query string */
export interface DocSearchResult {
  doc: DocItem;
  matches: {
    inTitle: boolean;
    inDescription: boolean;
    snippet?: string;
  };
}

export function searchDocs(query: string): DocSearchResult[] {
  const terms = getSearchTerms(query);
  if (terms.length === 0) return [];

  const results: DocSearchResult[] = [];

  for (const item of DOC_ITEMS) {
    const normTitle = normalizeForSearch(item.title);
    const normDesc = normalizeForSearch(item.description);
    const content = getDocRawContent(item.filePath);
    const normContent = normalizeForSearch(content);

    const titleMatch = terms.every((t) => normTitle.includes(t));
    const descMatch = terms.every((t) => normDesc.includes(t));
    const contentMatch = terms.every((t) => normContent.includes(t));

    if (titleMatch || descMatch || contentMatch) {
      let snippet: string | undefined;
      let firstIndex = -1;
      let matchedTerm = '';
      for (const t of terms) {
        const idx = normContent.indexOf(t);
        if (idx !== -1 && (firstIndex === -1 || idx < firstIndex)) {
          firstIndex = idx;
          matchedTerm = t;
        }
      }

      if (firstIndex !== -1) {
        const start = Math.max(0, firstIndex - 40);
        const end = Math.min(content.length, firstIndex + matchedTerm.length + 60);
        snippet = (start > 0 ? '…' : '') + content.slice(start, end).replace(/\s+/g, ' ') + (end < content.length ? '…' : '');
      } else if (descMatch) {
        snippet = item.description;
      }

      results.push({
        doc: item,
        matches: {
          inTitle: titleMatch,
          inDescription: descMatch,
          snippet,
        },
      });
    }
  }

  return results;
}

/** Resolve relative markdown links inside documentation */
export interface ResolvedDocHref {
  type: 'internal' | 'external' | 'anchor' | 'board' | 'dashboard';
  targetSlug?: string;
  boardId?: string;
  href: string;
}

export function resolveDocHref(rawHref: string, currentSlug: string): ResolvedDocHref {
  if (!rawHref) return { type: 'anchor', href: '#' };

  let cleanHref = rawHref.trim();

  // Strip host if pointing to heeey.click domain
  const heeeyDomainMatch = cleanHref.match(/^https?:\/\/(?:www\.)?heeey\.click(\/.*)?$/i);
  if (heeeyDomainMatch) {
    cleanHref = heeeyDomainMatch[1] || '/';
  }

  // Anchor in current page
  if (cleanHref.startsWith('#')) {
    return { type: 'anchor', href: cleanHref };
  }

  // App home / dashboard
  if (cleanHref === '/' || cleanHref === '') {
    return { type: 'dashboard', href: '/' };
  }

  // Board navigation /b/:id
  const boardMatch = cleanHref.match(/^\/b\/([^/#?]+)/);
  if (boardMatch) {
    return { type: 'board', boardId: boardMatch[1], href: cleanHref };
  }

  // Standalone LLM text docs at root
  if (cleanHref === '/llms.txt' || cleanHref === 'llms.txt') {
    return { type: 'internal', targetSlug: 'llms', href: '/docs/llms' };
  }
  if (cleanHref === '/llms-full.txt' || cleanHref === 'llms-full.txt') {
    return { type: 'internal', targetSlug: 'llms-full', href: '/docs/llms-full' };
  }

  // Other external URLs
  if (/^(https?:|mailto:|tel:)/i.test(cleanHref)) {
    return { type: 'external', href: cleanHref };
  }

  // Direct REST API routes
  if (cleanHref.startsWith('/api/')) {
    return { type: 'external', href: cleanHref };
  }

  // Split path from hash
  const [pathPart, hashPart] = cleanHref.split('#');
  const hashSuffix = hashPart ? `#${hashPart}` : '';

  if (!pathPart) {
    return { type: 'anchor', href: `#${hashPart}` };
  }

  // Determine current directory
  const normalizedCurrent = normalizeSlug(currentSlug);
  const currentSegments = normalizedCurrent.split('/');
  const currentDir = currentSegments.length > 1 ? currentSegments.slice(0, -1).join('/') : '';

  // Clean pathPart
  let cleanPath = pathPart.replace(/^\.\//, '');

  let combinedPath = '';
  if (cleanPath.startsWith('/docs/')) {
    combinedPath = cleanPath.slice('/docs/'.length);
  } else if (cleanPath === '/docs' || cleanPath === 'docs') {
    combinedPath = 'getting-started';
  } else if (cleanPath.startsWith('../')) {
    // Relative to parent
    while (cleanPath.startsWith('../')) {
      cleanPath = cleanPath.slice(3);
    }
    combinedPath = cleanPath;
  } else if (currentDir) {
    combinedPath = `${currentDir}/${cleanPath}`;
  } else {
    combinedPath = cleanPath;
  }

  const targetSlug = normalizeSlug(combinedPath);
  return {
    type: 'internal',
    targetSlug,
    href: `/docs/${targetSlug}${hashSuffix}`,
  };
}

/** Slugify text for headings and table of contents */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s-]/g, '') // remove special chars, emojis
    .trim()
    .replace(/\s+/g, '-');
}

/** Clean markdown formatting from heading text to obtain plain title */
export function cleanMarkdownHeading(text: string): string {
  return text
    .replace(/<[^>]+>/g, '') // remove HTML tags if any
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // remove markdown links [Title](url) -> Title
    .replace(/`([^`]+)`/g, '$1') // remove inline code `code` -> code
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1') // remove bold/italic
    .trim();
}

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

/** Extract table of contents (headings) from markdown */
export function extractToc(content: string): TocItem[] {
  const headings: TocItem[] = [];
  const lines = content.split('\n');
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = cleanMarkdownHeading(match[2]);
      const id = slugify(text);
      if (id) {
        headings.push({ id, text, level });
      }
    }
  }

  return headings;
}

/** Calculate estimated reading time in minutes */
export function calculateReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}
