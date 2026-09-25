/**
 * llms-full.txt: every doc of one language concatenated into a single file for LLMs.
 * Shared by the docs page (which builds it on the fly) and scripts/build-llms.mjs
 * (which writes the served copies), so the two always match.
 */

export const LLMS_FILES = [
  'README.md',
  'getting-started.md',
  'features/whiteboard-editor.md',
  'features/collaboration-realtime.md',
  'features/teams-and-sharing.md',
  'features/folders-and-organization.md',
  'features/version-history.md',
  'features/i18n.md',
  'features/libraries.md',
  'features/media-and-images.md',
  'features/search.md',
  'api/overview.md',
  'api/getting-started.md',
  'api/authentication.md',
  'api/pagination.md',
  'api/rate-limiting.md',
  'api/error-handling.md',
  'api/scene-content-schema.md',
  'api/endpoints.md',
  'mcp/overview.md',
  'mcp/getting-started.md',
  'mcp/auth-and-permissions.md',
  'mcp/tools.md',
  'mcp/diagram-layout.md',
];

export interface LlmsLocale {
  /** Where the language's Markdown lives, and where its llms-full.txt is written */
  docsDir: string;
  /** Where the served copies of llms.txt and llms-full.txt go */
  publicDir: string;
  title: string;
  intro: string;
}

export const LLMS_LOCALES: LlmsLocale[] = [
  {
    docsDir: 'docs',
    publicDir: 'public/pt-br',
    title: '# Heeey (heeey.click) — Documentação completa para LLMs',
    intro: '> Exportação de toda a documentação técnica da lousa colaborativa Heeey, em português.',
  },
  {
    docsDir: 'docs/en',
    publicDir: 'public',
    title: '# Heeey (heeey.click) — Full Documentation Dump for LLMs',
    intro: '> Export of the complete technical documentation corpus for the Heeey whiteboard platform, in English.',
  },
  {
    docsDir: 'docs/es',
    publicDir: 'public/es',
    title: '# Heeey (heeey.click) — Documentación completa para LLMs',
    intro: '> Exportación de toda la documentación técnica de la pizarra colaborativa Heeey, en español.',
  },
];

const RULE = '='.repeat(80);

/** The llms-full.txt contents for one language, reading its Markdown files with `read(path)` */
export function buildLlmsFull(locale: LlmsLocale, read: (path: string) => string): string {
  const sections = LLMS_FILES.map((file) => {
    const path = `${locale.docsDir}/${file}`;
    return `${RULE}\nFILE: ${path}\n${RULE}\n\n${read(path).trim()}\n`;
  });
  return `${locale.title}\n\n${locale.intro}\n\n\n\n${sections.join('\n\n')}`;
}
