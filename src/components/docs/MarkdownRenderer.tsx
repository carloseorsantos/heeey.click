import React, { useMemo } from 'react';
import { Marked } from 'marked';
import { resolveDocHref, slugify, cleanMarkdownHeading, normalizeSlug } from '../../lib/docsData';
import { useI18n } from '../../i18n';

interface MarkdownRendererProps {
  content: string;
  currentSlug: string;
  onNavigate: (slug: string) => void;
  onNavigateToBoard?: (boardId: string) => void;
  onBackToDashboard?: () => void;
  className?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function extractPlainFromTokens(tokens: any[]): string {
  if (!tokens) return '';
  let out = '';
  for (const tk of tokens) {
    if (tk.tokens && tk.tokens.length) {
      out += extractPlainFromTokens(tk.tokens);
    } else {
      out += tk.text || tk.raw || '';
    }
  }
  return cleanMarkdownHeading(out);
}

function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => fallbackCopy(text));
  }
  return Promise.resolve(fallbackCopy(text));
}

function fallbackCopy(text: string): boolean {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

export function MarkdownRenderer({
  content,
  currentSlug,
  onNavigate,
  onNavigateToBoard,
  onBackToDashboard,
  className = '',
}: MarkdownRendererProps) {
  const { t } = useI18n();

  const html = useMemo(() => {
    // Preprocess file separators (commonly found in llms-full dumps)
    // Turns:
    // ================================================================================
    // FILE: docs/foo.md
    // ================================================================================
    // into a clean, modern, well-styled file section banner
    const preprocessed = content.replace(
      /(?:^|\n)={10,}\s*\n\s*FILE:\s*([^\n]+)\s*\n\s*={10,}(?:\n|$)/gi,
      (_match, filePath) => {
        const cleanPath = filePath.trim();
        const docSlug = normalizeSlug(cleanPath.replace(/^docs\//, ''));
        const fileId = `file-${slugify(cleanPath)}`;
        return `\n\n<div class="doc-file-banner my-12 pt-8 border-t-2 border-slate-200 dark:border-slate-800" id="${fileId}">
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm">
    <div class="flex items-center gap-3 min-w-0">
      <div class="w-9 h-9 rounded-xl bg-brand-100 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 flex items-center justify-center flex-shrink-0">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <div class="min-w-0 truncate">
        <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block leading-none mb-1">Arquivo Fonte</span>
        <span class="font-mono text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 truncate block">${escapeHtml(cleanPath)}</span>
      </div>
    </div>
    <a href="/docs/${docSlug}" data-doc-slug="${docSlug}" class="doc-internal-link no-underline inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 bg-white dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-950 border border-slate-200 dark:border-slate-700 transition flex-shrink-0 shadow-2xs">
      <span>Abrir documento isolado</span>
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  </div>
</div>\n\n`;
      }
    );

    const marked = new Marked({
      gfm: true,
      breaks: false,
    });

    const copyLabel = t('docs.copyCode');
    const codeBadge = t('docs.code');
    const tipLabel = t('docs.tip');
    const warningLabel = t('docs.warning');
    const noteLabel = t('docs.note');

    marked.use({
      renderer: {
        heading({ tokens, depth }: any) {
          const text = this.parser.parseInline(tokens);
          const plain = extractPlainFromTokens(tokens);

          // Defense-in-depth: if heading contains equal signs banner or starts with FILE:
          if (/={10,}/.test(plain) || /^FILE:\s+/i.test(plain)) {
            const cleanPath = plain.replace(/={5,}/g, '').replace(/^FILE:\s*/i, '').trim();
            const docSlug = normalizeSlug(cleanPath.replace(/^docs\//, ''));
            const fileId = `file-${slugify(cleanPath)}`;
            return `
              <div class="doc-file-banner my-12 pt-8 border-t-2 border-slate-200 dark:border-slate-800" id="${fileId}">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="w-9 h-9 rounded-xl bg-brand-100 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 flex items-center justify-center flex-shrink-0">
                      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div class="min-w-0 truncate">
                      <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block leading-none mb-1">Arquivo Fonte</span>
                      <span class="font-mono text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 truncate block">${escapeHtml(cleanPath)}</span>
                    </div>
                  </div>
                  <a href="/docs/${docSlug}" data-doc-slug="${docSlug}" class="doc-internal-link no-underline inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 bg-white dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-950 border border-slate-200 dark:border-slate-700 transition flex-shrink-0 shadow-2xs">
                    <span>Abrir documento isolado</span>
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            `;
          }

          const id = slugify(plain);

          if (depth === 1) {
            return `<h1 id="${id}" class="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-900 dark:text-white pt-2 pb-3 mb-6 border-b border-slate-200 dark:border-slate-800">${text}</h1>`;
          }
          if (depth === 2) {
            return `
              <h2 id="${id}" class="group text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-10 mb-4 pb-2 border-b border-slate-200/70 dark:border-slate-800/60 flex items-center gap-2">
                <span>${text}</span>
                <a href="#${id}" class="doc-heading-anchor text-slate-400 hover:text-brand-600 dark:text-slate-500 dark:hover:text-brand-400 opacity-0 group-hover:opacity-100 transition" aria-label="Permalink: ${escapeHtml(plain)}">#</a>
              </h2>
            `;
          }
          if (depth === 3) {
            return `
              <h3 id="${id}" class="group text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mt-7 mb-3 flex items-center gap-2">
                <span>${text}</span>
                <a href="#${id}" class="doc-heading-anchor text-slate-400 hover:text-brand-600 dark:text-slate-500 dark:hover:text-brand-400 opacity-0 group-hover:opacity-100 transition" aria-label="Permalink: ${escapeHtml(plain)}">#</a>
              </h3>
            `;
          }
          if (depth === 4) {
            return `<h4 id="${id}" class="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-200 mt-5 mb-2">${text}</h4>`;
          }
          return `<h${depth} id="${id}" class="font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2">${text}</h${depth}>`;
        },

        code({ text, lang }: any) {
          const cleanLang = (lang || '').trim().toLowerCase();
          const encoded = encodeURIComponent(text);
          return `
            <div class="doc-code-block relative group rounded-2xl bg-slate-900 dark:bg-slate-950 border border-slate-800 my-5 overflow-hidden shadow-md">
              <div class="flex items-center justify-between px-4 py-2 bg-slate-800/80 border-b border-slate-800 text-xs font-mono text-slate-400">
                <span class="font-semibold uppercase tracking-wider text-slate-300">${cleanLang || codeBadge}</span>
                <button
                  type="button"
                  data-copy-code="${encoded}"
                  class="doc-copy-btn flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white transition font-sans text-xs cursor-pointer"
                  title="${copyLabel}"
                  aria-label="${copyLabel}"
                >
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  <span>${copyLabel}</span>
                </button>
              </div>
              <pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed text-slate-200 selection:bg-brand-900"><code>${escapeHtml(text)}</code></pre>
            </div>
          `;
        },

        codespan({ text }: any) {
          return `<code class="px-1.5 py-0.5 rounded font-mono text-xs sm:text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-brand-700 dark:text-brand-300 border border-slate-200/80 dark:border-slate-700/80 break-words">${escapeHtml(text)}</code>`;
        },

        paragraph({ tokens }: any) {
          const text = this.parser.parseInline(tokens);
          return `<p class="leading-relaxed text-slate-700 dark:text-slate-300 my-4 text-base">${text}</p>`;
        },

        strong({ tokens }: any) {
          const text = this.parser.parseInline(tokens);
          return `<strong class="font-bold text-slate-900 dark:text-white">${text}</strong>`;
        },

        list({ items, ordered }: any) {
          const body = items.map((item: any) => this.listitem(item)).join('');
          if (ordered) {
            return `<ol class="list-decimal pl-6 my-4 space-y-2 text-slate-700 dark:text-slate-300">${body}</ol>`;
          }
          return `<ul class="list-disc pl-6 my-4 space-y-2 text-slate-700 dark:text-slate-300">${body}</ul>`;
        },

        listitem(item: any) {
          const text = this.parser.parse(item.tokens, false);
          return `<li class="leading-relaxed">${text}</li>`;
        },

        blockquote({ tokens }: any) {
          const text = this.parser.parse(tokens, false);
          const raw = tokens.map((t: any) => t.raw || t.text || '').join('');

          // Tip Callout
          if (raw.includes('[!TIP]') || /\*\*Dica\*\*:|\*\*Tip\*\*/i.test(raw)) {
            const cleanText = text.replace(/\[!TIP\]/g, '').replace(/<strong>(?:Dica|Tip)<\/strong>:?/i, '').trim();
            return `
              <div class="my-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 p-4 text-emerald-900 dark:text-emerald-200 text-sm">
                <div class="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
                  <span>💡 ${tipLabel}</span>
                </div>
                <div>${cleanText}</div>
              </div>
            `;
          }

          // Warning Callout
          if (raw.includes('[!WARNING]') || /\*\*Atenção\*\*:|\*\*Warning\*\*:|\*\*Nota de Segurança\*\*/i.test(raw)) {
            const cleanText = text.replace(/\[!WARNING\]/g, '').replace(/<strong>(?:Atenção|Warning|Nota de Segurança)<\/strong>:?/i, '').trim();
            return `
              <div class="my-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 p-4 text-amber-900 dark:text-amber-200 text-sm">
                <div class="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300 mb-1">
                  <span>⚠️ ${warningLabel}</span>
                </div>
                <div>${cleanText}</div>
              </div>
            `;
          }

          // Note Callout
          if (raw.includes('[!NOTE]') || /\*\*Nota\*\*:|\*\*Note\*\*:|\*\*Importante\*\*/i.test(raw)) {
            const cleanText = text.replace(/\[!NOTE\]/g, '').replace(/<strong>(?:Nota|Note|Importante)<\/strong>:?/i, '').trim();
            return `
              <div class="my-5 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 p-4 text-sky-900 dark:text-sky-200 text-sm">
                <div class="flex items-center gap-2 font-semibold text-sky-800 dark:text-sky-300 mb-1">
                  <span>ℹ️ ${noteLabel}</span>
                </div>
                <div>${cleanText}</div>
              </div>
            `;
          }

          return `
            <blockquote class="border-l-4 border-brand-500 bg-brand-50/50 dark:bg-brand-950/20 px-4 py-3 my-5 rounded-r-2xl text-slate-700 dark:text-slate-300 italic">
              ${text}
            </blockquote>
          `;
        },

        image({ href, title, text }: any) {
          return `
            <figure class="my-6">
              <img
                src="${escapeHtml(href)}"
                alt="${escapeHtml(text || '')}"
                ${title ? `title="${escapeHtml(title)}"` : ''}
                loading="lazy"
                class="max-w-full h-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mx-auto"
              />
              ${text ? `<figcaption class="text-xs text-center text-slate-500 dark:text-slate-400 mt-2">${escapeHtml(text)}</figcaption>` : ''}
            </figure>
          `;
        },

        table({ header, rows }: any) {
          const headerHtml = `<thead>${this.tablerow({ text: header.map((cell: any) => this.tablecell(cell)).join('') })}</thead>`;
          const rowsHtml = `<tbody>${rows.map((row: any) => this.tablerow({ text: row.map((cell: any) => this.tablecell(cell)).join('') })).join('')}</tbody>`;
          return `
            <div class="overflow-x-auto my-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <table class="w-full text-left text-sm border-collapse">${headerHtml}${rowsHtml}</table>
            </div>
          `;
        },

        tablerow({ text }: any) {
          return `<tr class="border-b border-slate-200/80 dark:border-slate-800/80 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">${text}</tr>`;
        },

        tablecell(token: any) {
          const content = this.parser.parseInline(token.tokens);
          const alignClass = token.align === 'center' ? ' text-center' : token.align === 'right' ? ' text-right' : ' text-left';
          if (token.header) {
            return `<th class="px-4 py-3 font-semibold text-slate-900 dark:text-white bg-slate-100/90 dark:bg-slate-800/90${alignClass}">${content}</th>`;
          }
          return `<td class="px-4 py-3 text-slate-700 dark:text-slate-300 align-top${alignClass}">${content}</td>`;
        },

        hr() {
          return `<hr class="my-8 border-slate-200 dark:border-slate-800" />`;
        },

        link({ href, title, tokens }: any) {
          const text = this.parser.parseInline(tokens);
          const resolved = resolveDocHref(href, currentSlug);

          if (resolved.type === 'external') {
            return `
              <a href="${href}" ${title ? `title="${escapeHtml(title)}"` : ''} target="_blank" rel="noopener noreferrer" class="text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium underline underline-offset-2 inline-flex items-center gap-0.5">
                <span>${text}</span>
                <svg class="w-3.5 h-3.5 opacity-60 inline ml-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            `;
          }

          if (resolved.type === 'anchor') {
            return `<a href="${href}" class="doc-anchor-link text-brand-600 dark:text-brand-400 hover:underline font-medium">${text}</a>`;
          }

          if (resolved.type === 'board' && resolved.boardId) {
            return `<a href="${resolved.href}" data-board-id="${resolved.boardId}" class="doc-board-link text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium underline underline-offset-2">${text}</a>`;
          }

          if (resolved.type === 'dashboard') {
            return `<a href="${resolved.href}" data-is-dashboard="true" class="doc-dashboard-link text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium underline underline-offset-2">${text}</a>`;
          }

          return `<a href="${resolved.href}" data-doc-slug="${resolved.targetSlug}" class="doc-internal-link text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium underline underline-offset-2">${text}</a>`;
        },
      },
    });

    return marked.parse(preprocessed) as string;
  }, [content, currentSlug, t]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // 1. Handle Copy Code
    const copyBtn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-copy-code]');
    if (copyBtn) {
      e.preventDefault();
      const encoded = copyBtn.getAttribute('data-copy-code');
      if (encoded) {
        const decoded = decodeURIComponent(encoded);
        copyToClipboard(decoded).then((success) => {
          if (!success) return;
          const original = copyBtn.innerHTML;
          copyBtn.innerHTML = `
            <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span class="text-emerald-400 font-medium">${t('docs.copied')}</span>
          `;
          setTimeout(() => {
            copyBtn.innerHTML = original;
          }, 2000);
        });
      }
      return;
    }

    // 2. Handle Heading Anchors & In-Page Anchors
    const anchorLink = (e.target as HTMLElement).closest<HTMLAnchorElement>(
      '.doc-heading-anchor, .doc-anchor-link, a[href^="#"]'
    );
    if (anchorLink) {
      const href = anchorLink.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        const rawTarget = href.slice(1);
        if (!rawTarget) {
          const mainScroll = anchorLink.closest('main') || document.querySelector('main');
          if (mainScroll) mainScroll.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }

        let targetEl: HTMLElement | null =
          document.getElementById(rawTarget) ||
          document.getElementById(slugify(rawTarget)) ||
          document.getElementById(`file-${slugify(rawTarget)}`) ||
          document.getElementById(`file-${normalizeSlug(rawTarget).replace(/\//g, '-')}`) ||
          document.getElementById(rawTarget.replace(/_/g, ''));

        if (!targetEl) {
          try {
            targetEl = document.querySelector(`[id^="${CSS.escape(rawTarget)}"]`);
          } catch {
            // Ignore CSS selector errors
          }
        }

        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth' });
          window.history.pushState(null, '', href);
        }
        return;
      }
    }

    // 3. Handle Board Link
    const boardLink = (e.target as HTMLElement).closest<HTMLAnchorElement>('.doc-board-link');
    if (boardLink) {
      const boardId = boardLink.getAttribute('data-board-id');
      if (boardId && onNavigateToBoard) {
        e.preventDefault();
        onNavigateToBoard(boardId);
        return;
      }
    }

    // 4. Handle Dashboard Link
    const dashboardLink = (e.target as HTMLElement).closest<HTMLAnchorElement>('.doc-dashboard-link');
    if (dashboardLink) {
      if (onBackToDashboard) {
        e.preventDefault();
        onBackToDashboard();
        return;
      }
    }

    // 5. Handle Internal Doc Links
    const internalLink = (e.target as HTMLElement).closest<HTMLAnchorElement>('.doc-internal-link');
    if (internalLink) {
      e.preventDefault();
      const slug = internalLink.getAttribute('data-doc-slug');
      const href = internalLink.getAttribute('href');
      if (slug) {
        onNavigate(slug);
        if (href && href.includes('#')) {
          const hash = href.split('#')[1];
          setTimeout(() => {
            const el = document.getElementById(hash);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }, 120);
        }
      }
    }
  };

  return (
    <div
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
      className={`prose dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 ${className}`}
    />
  );
}
