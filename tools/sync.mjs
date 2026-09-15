// Pull the latest content from the two source apps and write data/content.json.
//
//   node tools/sync.mjs                 fetch from GitHub (the repos' default branches)
//   node tools/sync.mjs --local ../going-deeper-greek-concepts ../going-deeper-greek-vocab
//
// Exit code 0 either way; prints "changed" or "unchanged" on the last line so a
// workflow can decide whether there is anything to commit.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize } from '../js/normalize.js';
import { SOURCES as SRC } from '../js/sources.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'data/content.json');

const SOURCES = {
  concepts: { ...SRC.concepts, url: SRC.concepts.raw },
  vocab: { ...SRC.vocab, url: SRC.vocab.raw }
};

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

const args = process.argv.slice(2);
let conceptsText;
let vocabText;
const local = args.indexOf('--local');
if (local >= 0) {
  const [cDir, vDir] = args.slice(local + 1, local + 3);
  if (!cDir || !vDir) throw new Error('--local needs <concepts-dir> <vocab-dir>');
  conceptsText = readFileSync(resolve(cDir, SOURCES.concepts.path), 'utf8');
  vocabText = readFileSync(resolve(vDir, SOURCES.vocab.path), 'utf8');
} else {
  [conceptsText, vocabText] = await Promise.all([fetchText(SOURCES.concepts.url), fetchText(SOURCES.vocab.url)]);
}

const bundle = normalize({
  concepts: JSON.parse(conceptsText),
  vocabSrc: vocabText,
  sources: {
    concepts: { repo: SOURCES.concepts.repo, path: SOURCES.concepts.path, site: SOURCES.concepts.site },
    vocab: { repo: SOURCES.vocab.repo, path: SOURCES.vocab.path, site: SOURCES.vocab.site }
  }
});

let previous = null;
if (existsSync(OUT)) {
  try { previous = JSON.parse(readFileSync(OUT, 'utf8')); } catch { previous = null; }
}
const changed = !previous || previous.hash !== bundle.hash;
if (changed) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(bundle));
}

// The service worker's cache name carries the content hash, so a content
// change invalidates the offline copy on every installed phone.
const SW = resolve(ROOT, 'sw.js');
if (existsSync(SW)) {
  const sw = readFileSync(SW, 'utf8');
  const bumped = sw.replace(/^const CACHE = '([^']*?)-[0-9a-f]{8}';$/m, (m, prefix) => `const CACHE = '${prefix}-${bundle.hash}';`);
  if (bumped !== sw) writeFileSync(SW, bumped);
}

const c = bundle.chapters.map((ch) => `ch ${ch.n}: ${ch.words} words, ${ch.cards} cards`).join('; ');
console.log(`content ${bundle.hash} — ${bundle.words.length} words, ${bundle.sentences.length} sentences, ${bundle.cards.length} cards, ${bundle.confusions.length} confusions, ${bundle.extraQuiz.length} extra quiz items`);
console.log(`  ${c}`);
console.log(changed ? 'changed' : 'unchanged');
