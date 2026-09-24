import { describe, it, expect } from 'vitest';
import { DOC_ITEMS } from '../lib/docsData';
import sitemap from '../../public/sitemap.xml?raw';
import robots from '../../public/robots.txt?raw';

describe('sitemap.xml', () => {
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  it('lists the landing pages and every doc page', () => {
    const expected = [
      'https://www.heeey.click/',
      'https://www.heeey.click/mcp',
      'https://www.heeey.click/termos',
      'https://www.heeey.click/privacidade',
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
