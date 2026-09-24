/**
 * Documentation data structures, manifest, search, and navigation helpers.
 */

import { normalizeForSearch, getSearchTerms } from './search';
import { getLocale, type Locale } from '../i18n';
import { buildLlmsFull, LLMS_LOCALES } from './llmsFull';

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
    description: 'Português, inglês e espanhol, detecção de idioma e sincronização com o Excalidraw.',
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

type DocText = { title: string; description: string };

/**
 * Titles and descriptions of each doc in the other locales (DOC_ITEMS holds pt-BR).
 * The Markdown itself lives in docs/en/ and docs/es/, mirroring docs/.
 */
export const DOC_TRANSLATIONS: Record<Exclude<Locale, 'pt-BR'>, Record<string, DocText>> = {
  'en-US': {
    'getting-started': {
      title: 'Getting Started with Heeey (Quick Start)',
      description: 'First steps: creating boards, sharing them and collaborating in real time without signing up.',
    },
    readme: {
      title: 'Overview & Documentation Index',
      description: 'Overview of the ecosystem, architecture, full topic index and technical specifications.',
    },
    'features/whiteboard-editor': {
      title: 'Canvas & Drawing Tools',
      description: 'Drawing tools, vector shapes, bound text, magnetic arrows and keyboard shortcuts.',
    },
    'features/collaboration-realtime': {
      title: 'Collaboration & Real Time',
      description: 'Multiplayer with Supabase Realtime, delta broadcast, presence, live cursors and permissions.',
    },
    'features/folders-and-organization': {
      title: 'Folders, Organization & Trash',
      description: 'Nested folders, breadcrumb navigation, board templates and a safety net with the trash.',
    },
    'features/version-history': {
      title: 'Version History & Restore',
      description: 'Automatic snapshots every 10 min, 30-day retention and safe restores with no data loss.',
    },
    'features/i18n': {
      title: 'Internationalization (i18n)',
      description: 'Portuguese, English and Spanish, language detection and Excalidraw locale sync.',
    },
    'features/libraries': {
      title: 'Component Libraries',
      description: 'Cloud storage for reusable libraries, local cache for guests and migration.',
    },
    'features/media-and-images': {
      title: 'Images & Media Optimization',
      description: 'Client-side WebP compression, async upload to Supabase Storage and offline fallback.',
    },
    'features/search': {
      title: 'Global Canvas Search',
      description: 'Full-text search across titles and drawn text, with contextual preview and highlighting.',
    },
    'api/overview': {
      title: 'REST API v1 Overview',
      description: 'API principles, base URL, edge runtime, JSON format and zero-secrets security at the edge.',
    },
    'api/getting-started': {
      title: 'API Quick Start',
      description: 'How to create keys, authenticate curl/TypeScript requests and work with boards via the API.',
    },
    'api/authentication': {
      title: 'Authentication & Key Scopes',
      description: 'The hk_... token format, read-only vs read-write scopes, SHA-256 hashing and RLS policies.',
    },
    'api/endpoints': {
      title: 'Full Endpoint Reference',
      description: 'Detailed docs for the /boards and /folders routes with parameters, responses and examples.',
    },
    'api/scene-content-schema': {
      title: 'Scene Content Schema (Element Spec)',
      description: 'Short-form spec for nodes, shapes, text, bound arrows and style attributes.',
    },
    'api/pagination': {
      title: 'Paginating Results',
      description: 'Cursor and offset pagination, page limits and walking through large lists.',
    },
    'api/rate-limiting': {
      title: 'Rate & Operational Limits',
      description: 'Requests per minute, maximum payload sizes and integration best practices.',
    },
    'api/error-handling': {
      title: 'API Error Handling',
      description: 'HTTP status codes, the standard error response format and explanatory messages.',
    },
    'mcp/overview': {
      title: 'MCP Server Overview',
      description: 'Streamable HTTP server for AI agents (Claude Code, Desktop, Cursor) to work on whiteboards.',
    },
    'mcp/getting-started': {
      title: 'Setting Up MCP Agents',
      description: 'Step-by-step setup in Claude Desktop, Claude Code and the Cursor IDE.',
    },
    'mcp/tools': {
      title: 'MCP Tool Catalog',
      description: 'Full reference for the 13 MCP tools to read, create, lay out and search boards.',
    },
    'mcp/diagram-layout': {
      title: 'Automatic Diagram Layout',
      description: 'Sugiyama/Dagre algorithm for layered node placement, smart arrows and flow direction.',
    },
    'mcp/auth-and-permissions': {
      title: 'MCP Authentication & Permissions',
      description: 'Security of MCP calls, user context propagation and permission restrictions.',
    },
    llms: {
      title: 'Short Index for LLMs (llms.txt)',
      description: 'Structured plain-text summary and reference links for language models and agents.',
    },
    'llms-full': {
      title: 'Full Documentation for LLMs (llms-full.txt)',
      description: 'A single file with all of the project documentation for agents and LLMs.',
    },
  },
  'es-ES': {
    'getting-started': {
      title: 'Primeros pasos con Heeey (Inicio rápido)',
      description: 'Primeros pasos: crear pizarras, compartirlas y colaborar en tiempo real sin registrarte.',
    },
    readme: {
      title: 'Visión general e índice de la documentación',
      description: 'Visión general del ecosistema, arquitectura, índice completo de temas y especificaciones técnicas.',
    },
    'features/whiteboard-editor': {
      title: 'Lienzo y herramientas de dibujo',
      description: 'Herramientas de dibujo, formas vectoriales, texto vinculado, flechas magnéticas y atajos de teclado.',
    },
    'features/collaboration-realtime': {
      title: 'Colaboración y tiempo real',
      description: 'Multijugador con Supabase Realtime, difusión de deltas, presencia, cursores en directo y permisos.',
    },
    'features/folders-and-organization': {
      title: 'Carpetas, organización y papelera',
      description: 'Carpetas anidadas, navegación con migas de pan, plantillas de pizarras y protección con la papelera.',
    },
    'features/version-history': {
      title: 'Historial de versiones y restauración',
      description: 'Instantáneas automáticas cada 10 min, retención de 30 días y restauración segura sin pérdida de datos.',
    },
    'features/i18n': {
      title: 'Internacionalización (i18n)',
      description: 'Portugués, inglés y español, detección de idioma y sincronización con Excalidraw.',
    },
    'features/libraries': {
      title: 'Bibliotecas de componentes',
      description: 'Almacenamiento en la nube de bibliotecas reutilizables, caché local para invitados y migración.',
    },
    'features/media-and-images': {
      title: 'Imágenes y optimización de medios',
      description: 'Compresión WebP en el cliente, subida asíncrona a Supabase Storage y alternativa sin conexión.',
    },
    'features/search': {
      title: 'Búsqueda global en el lienzo',
      description: 'Búsqueda de texto completo en títulos y textos dibujados, con vista previa contextual y resaltado.',
    },
    'api/overview': {
      title: 'Visión general de la API REST v1',
      description: 'Principios de la API, URL base, edge runtime, formato JSON y seguridad sin secretos en el edge.',
    },
    'api/getting-started': {
      title: 'Primeros pasos con la API (Inicio rápido)',
      description: 'Cómo crear claves, autenticar peticiones con curl/TypeScript y manejar pizarras mediante la API.',
    },
    'api/authentication': {
      title: 'Autenticación y alcances de las claves',
      description: 'Formato del token hk_..., alcances de solo lectura y de lectura y escritura, hash SHA-256 y políticas RLS.',
    },
    'api/endpoints': {
      title: 'Referencia completa de endpoints',
      description: 'Documentación detallada de las rutas /boards y /folders con parámetros, respuestas y ejemplos.',
    },
    'api/scene-content-schema': {
      title: 'Esquema del contenido de la escena (Element Spec)',
      description: 'Especificación abreviada de nodos, formas, textos, flechas conectadas y atributos de estilo.',
    },
    'api/pagination': {
      title: 'Paginación de resultados',
      description: 'Paginación por cursor y por desplazamiento, límites de página y navegación por listas grandes.',
    },
    'api/rate-limiting': {
      title: 'Tasas y límites operativos',
      description: 'Límites de peticiones por minuto, tamaños máximos de payload y buenas prácticas de integración.',
    },
    'api/error-handling': {
      title: 'Gestión de errores en la API',
      description: 'Códigos de estado HTTP, formato estándar de las respuestas de error y mensajes explicativos.',
    },
    'mcp/overview': {
      title: 'Visión general del servidor MCP',
      description: 'Servidor Streamable HTTP para que agentes de IA (Claude Code, Desktop, Cursor) trabajen en pizarras.',
    },
    'mcp/getting-started': {
      title: 'Configurar agentes MCP',
      description: 'Guía paso a paso de configuración en Claude Desktop, Claude Code y Cursor.',
    },
    'mcp/tools': {
      title: 'Catálogo de herramientas MCP',
      description: 'Referencia completa de las 13 herramientas MCP para consultar, crear, organizar y buscar pizarras.',
    },
    'mcp/diagram-layout': {
      title: 'Disposición automática de diagramas',
      description: 'Algoritmo Sugiyama/Dagre para colocar nodos por capas, flechas inteligentes y dirección del flujo.',
    },
    'mcp/auth-and-permissions': {
      title: 'Autenticación y permisos MCP',
      description: 'Seguridad en las llamadas MCP, propagación del contexto del usuario y restricciones de permisos.',
    },
    llms: {
      title: 'Índice resumido para LLMs (llms.txt)',
      description: 'Resumen estructurado en texto plano y enlaces de referencia para modelos de lenguaje y agentes.',
    },
    'llms-full': {
      title: 'Documentación completa para LLMs (llms-full.txt)',
      description: 'Un único archivo con toda la documentación del proyecto para agentes y LLMs.',
    },
  },
};

const DOC_DIRS: Record<Locale, string> = { 'pt-BR': '/docs/', 'en-US': '/docs/en/', 'es-ES': '/docs/es/' };

/** Where each language's plain-text llms-full.txt is served (built by scripts/build-llms.mjs) */
export const LLMS_FULL_URLS: Record<Locale, string> = {
  'pt-BR': '/pt-br/llms-full.txt',
  'en-US': '/llms-full.txt',
  'es-ES': '/es/llms-full.txt',
};

/** The doc in the given locale: translated title and description, and that locale's Markdown file */
export function localizeDoc(item: DocItem, locale: Locale = getLocale()): DocItem {
  if (locale === 'pt-BR') return item;
  const text = DOC_TRANSLATIONS[locale][item.slug];
  return {
    ...item,
    title: text?.title ?? item.title,
    description: text?.description ?? item.description,
    filePath: item.filePath.replace(/^\/docs\//, DOC_DIRS[locale]),
  };
}

/** All docs in reading order, in the given locale */
export function getDocItems(locale: Locale = getLocale()): DocItem[] {
  return DOC_ITEMS.map((item) => localizeDoc(item, locale));
}

// Raw files loaded via Vite eager glob. llms-full.txt is left out: it repeats every doc, so it's
// rebuilt from them on demand instead of shipping the same text twice.
const RAW_DOCS = import.meta.glob(['/docs/**/*.{md,txt}', '!/docs/**/llms-full.txt'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Get raw content of a document by file path */
export function getDocRawContent(filePath: string): string {
  if (filePath.endsWith('/llms-full.txt')) {
    const locale = LLMS_LOCALES.find((l) => `/${l.docsDir}/llms-full.txt` === filePath);
    return locale ? buildLlmsFull(locale, (path) => RAW_DOCS[`/${path}`] ?? '') : '';
  }
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
export function getDocBySlug(
  rawSlug?: string | null,
  locale: Locale = getLocale()
): (DocItem & { content: string }) | null {
  const slug = normalizeSlug(rawSlug);
  const base = DOC_ITEMS.find((d) => d.slug.toLowerCase() === slug.toLowerCase());
  if (!base) return null;
  const item = localizeDoc(base, locale);
  // A missing translation falls back to the Portuguese original rather than an empty page
  const content = getDocRawContent(item.filePath) || getDocRawContent(base.filePath);
  return { ...item, content };
}

/** Get adjacent (previous and next) docs in reading order */
export function getAdjacentDocs(
  currentSlug: string,
  locale: Locale = getLocale()
): {
  prev: DocItem | null;
  next: DocItem | null;
} {
  const normalized = normalizeSlug(currentSlug);
  const items = getDocItems(locale);
  const index = items.findIndex((d) => d.slug.toLowerCase() === normalized.toLowerCase());
  if (index === -1) {
    return { prev: null, next: null };
  }
  const prev = index > 0 ? items[index - 1] : null;
  const next = index < items.length - 1 ? items[index + 1] : null;
  return { prev, next };
}

/** Group doc items by category */
export function getDocsGroupedByCategory(locale: Locale = getLocale()): {
  category: DocCategoryMeta;
  docs: DocItem[];
}[] {
  const items = getDocItems(locale);
  return DOC_CATEGORIES.map((category) => {
    const docs = items.filter((d) => d.category === category.id).sort((a, b) => a.order - b.order);
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

export function searchDocs(query: string, locale: Locale = getLocale()): DocSearchResult[] {
  const terms = getSearchTerms(query);
  if (terms.length === 0) return [];

  const results: DocSearchResult[] = [];

  for (const item of getDocItems(locale)) {
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

  // App home / dashboard (heeey.click itself is the landing page, which sends users on to /app)
  if (cleanHref === '/' || cleanHref === '' || /^\/app\/?$/.test(cleanHref)) {
    return { type: 'dashboard', href: '/app' };
  }

  // Board navigation /b/:id
  const boardMatch = cleanHref.match(/^\/b\/([^/#?]+)/);
  if (boardMatch) {
    return { type: 'board', boardId: boardMatch[1], href: cleanHref };
  }

  // Standalone LLM text docs at root
  // (also the per-language copies at /pt-br/ and /es/)
  if (/^(?:\/(?:pt-br|es)\/|\/)?llms\.txt$/.test(cleanHref)) {
    return { type: 'internal', targetSlug: 'llms', href: '/docs/llms' };
  }
  if (/^(?:\/(?:pt-br|es)\/|\/)?llms-full\.txt$/.test(cleanHref)) {
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

  let targetSlug = normalizeSlug(combinedPath);

  // If targetSlug does not match any existing doc, check for basename or partial matches in DOC_ITEMS
  const exactDoc = DOC_ITEMS.find((d) => d.slug.toLowerCase() === targetSlug.toLowerCase());
  if (!exactDoc) {
    const matchedDoc = DOC_ITEMS.find(
      (d) =>
        d.slug.toLowerCase().endsWith(`/${targetSlug.toLowerCase()}`) ||
        d.filePath.toLowerCase().endsWith(`/${targetSlug.toLowerCase()}.md`) ||
        d.filePath.toLowerCase().endsWith(`/${cleanPath.toLowerCase()}`)
    );
    if (matchedDoc) {
      targetSlug = matchedDoc.slug;
    }
  }

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
    .replace(/[^a-z0-9\s_-]/g, '') // remove special chars, emojis, preserve hyphens and underscores
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

export interface DocFileSection {
  filePath: string;
  docSlug: string;
  title: string;
  category: DocCategory;
  id: string;
}

/** Extract individual file sections from concatenated documentation dumps (e.g. llms-full.txt) */
export function extractDocFiles(content: string, locale: Locale = getLocale()): DocFileSection[] {
  const items = getDocItems(locale);
  const fileRegex = /(?:^|\n)={10,}\s*\n\s*FILE:\s*([^\n]+)\s*\n\s*={10,}/gi;
  const sections: DocFileSection[] = [];
  let match;
  while ((match = fileRegex.exec(content)) !== null) {
    const rawPath = match[1].trim();
    const cleanSlug = normalizeSlug(rawPath.replace(/^docs\/(?:(?:en|es)\/)?/, ''));
    const docItem = items.find((d) => d.slug.toLowerCase() === cleanSlug.toLowerCase());
    sections.push({
      filePath: rawPath,
      docSlug: cleanSlug,
      title: docItem ? docItem.title : rawPath,
      category: docItem ? docItem.category : 'overview',
      id: `file-${slugify(rawPath)}`,
    });
  }
  return sections;
}

