import { describe, it, expect } from 'vitest';
import { STATIC_PAGES, type Locale } from '../i18n';

// The static HTML pages (landing, MCP, terms, privacy), one file per language
const HTML = import.meta.glob(['/index.html', '/*/index.html', '/*/*/index.html', '!/app/**', '!/dist/**', '!/node_modules/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const fileFor = (path: string) => (path === '/' ? '/index.html' : `${path}/index.html`);
const HREFLANG: Record<Locale, string> = { 'pt-BR': 'pt-BR', 'en-US': 'en', 'es-ES': 'es' };

describe('static pages', () => {
  for (const [page, urls] of Object.entries(STATIC_PAGES)) {
    for (const [locale, path] of Object.entries(urls) as [Locale, string][]) {
      it(`${page} exists in ${locale} at ${path}, linked to its other languages`, () => {
        const html = HTML[fileFor(path)];
        expect(html, fileFor(path)).toBeTruthy();
        expect(html).toContain(`<html lang="${locale}">`);
        expect(html).toContain(`<link rel="canonical" href="https://www.heeey.click${path}" />`);
        for (const [other, otherPath] of Object.entries(urls) as [Locale, string][]) {
          expect(html).toContain(`<link rel="alternate" hreflang="${HREFLANG[other]}" href="https://www.heeey.click${otherPath}" />`);
          // Footer language switcher
          expect(html).toMatch(new RegExp(`<a href="${otherPath}" lang="${other}" hreflang="${HREFLANG[other]}" data-locale="${other}"`));
        }
        // The saved-language redirect knows where every version lives
        expect(html).toContain(
          `pages = { 'pt-BR': '${urls['pt-BR']}', 'en-US': '${urls['en-US']}', 'es-ES': '${urls['es-ES']}' }`
        );
        // Links into the app and docs keep the page's language
        for (const [, href] of html.matchAll(/href="(\/(?:app|docs)[^"]*)"/g)) {
          expect(href, href).toMatch(new RegExp(`[?&](?:amp;)?lang=${locale}$`));
        }
      });
    }
  }
});
