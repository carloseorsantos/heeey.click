// Writes llms-full.txt for each language (all of that language's docs in one file) and copies
// llms.txt / llms-full.txt to public/ so they're served as plain text:
//   English    /llms.txt        /llms-full.txt        (the standard location)
//   Portuguese /pt-br/llms.txt  /pt-br/llms-full.txt
//   Spanish    /es/llms.txt     /es/llms-full.txt
// Run with `npm run docs:llms` after editing anything in docs/ (a test fails if you forget).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LLMS_LOCALES, buildLlmsFull } from '../src/lib/llmsFull.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');

for (const locale of LLMS_LOCALES) {
  const full = buildLlmsFull(locale, read);
  writeFileSync(join(ROOT, locale.docsDir, 'llms-full.txt'), full);
  mkdirSync(join(ROOT, locale.publicDir), { recursive: true });
  writeFileSync(join(ROOT, locale.publicDir, 'llms-full.txt'), full);
  writeFileSync(join(ROOT, locale.publicDir, 'llms.txt'), read(`${locale.docsDir}/llms.txt`));
  console.log(`${locale.docsDir}: llms-full.txt (${full.length} chars) → ${locale.publicDir}/`);
}
