import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DOC_ITEMS } from '../lib/docsData';

const read = (file: string) => readFileSync(resolve(__dirname, '../../public', file), 'utf8');

describe('sitemap.xml', () => {
  const locs = [...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  it('lists the home page and every doc page', () => {
    const expected = ['https://www.heeey.click/', ...DOC_ITEMS.map((d) => `https://www.heeey.click/docs/${d.slug}`)];
    expect(locs.sort()).toEqual(expected.sort());
  });
});

describe('robots.txt', () => {
  const robots = read('robots.txt');

  it('points crawlers to the sitemap and keeps boards out of the index', () => {
    expect(robots).toContain('Sitemap: https://www.heeey.click/sitemap.xml');
    expect(robots).toMatch(/^Disallow: \/b\/$/m);
  });
});
