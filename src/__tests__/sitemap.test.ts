import { describe, it, expect } from 'vitest';
import { DOC_ITEMS } from '../lib/docsData';
import { STATIC_PAGES } from '../i18n';
import sitemap from '../../public/sitemap.xml?raw';
import robots from '../../public/robots.txt?raw';

describe('sitemap.xml', () => {
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  it('lists the landing pages in every language and every doc page', () => {
    const expected = [
      ...Object.values(STATIC_PAGES).flatMap((urls) => Object.values(urls).map((path) => `https://www.heeey.click${path}`)),
      ...DOC_ITEMS.map((d) => `https://www.heeey.click/docs/${d.slug}`),
    ];
    expect(locs.sort()).toEqual(expected.sort());
  });
});

describe('robots.txt', () => {
  it('points crawlers to the sitemap and keeps boards and the app out of the index', () => {
    expect(robots).toContain('Sitemap: https://www.heeey.click/sitemap.xml');
    expect(robots).toMatch(/^Disallow: \/b\/$/m);
    expect(robots).toMatch(/^Disallow: \/app$/m);
  });
});
