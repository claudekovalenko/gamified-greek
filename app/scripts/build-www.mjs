// Builds app/www, the files the phone app ships with, from the game in ../quest
// and the shared words and concepts in ../data. The game itself is never edited
// here: the few things that must differ inside an app are patched into the copy.
//
//   node scripts/build-www.mjs            (npm run build)
//
// Layout mirrors the website, so the game's relative paths work unchanged:
//   www/index.html  → opens play/
//   www/play/       ← ../quest
//   www/data/       ← ../data/content.json
//   www/icons/      ← ../icons
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = resolve(APP, '..');
const WWW = join(APP, 'www');
// where the game lives on the web: sync links point here, and fresh content comes from here
const SITE = process.env.QUEST_SITE || 'https://claudekovalenko.github.io/gamified-greek/';

rmSync(WWW, { recursive: true, force: true });
mkdirSync(WWW, { recursive: true });
cpSync(join(ROOT, 'quest'), join(WWW, 'play'), { recursive: true, filter: src => !/[\\/](tests|UPSTREAM\.md)$/.test(src) });
mkdirSync(join(WWW, 'data'));
cpSync(join(ROOT, 'data/content.json'), join(WWW, 'data/content.json'));
cpSync(join(ROOT, 'icons'), join(WWW, 'icons'), { recursive: true });
writeFileSync(join(WWW, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Going Deeper Quest</title><style>html,body{margin:0;height:100%;background:#1f3b5c}</style>
<script>location.replace('play/index.html')</script></head><body></body></html>\n`);

// a patch must find exactly what it expects, so a change upstream fails the build loudly instead of shipping a broken app
function patch(file, find, replace) {
  const p = join(WWW, file), s = readFileSync(p, 'utf8');
  if (!s.includes(find)) throw new Error(`build-www: ${file} no longer contains:\n  ${find}\nUpdate app/scripts/build-www.mjs to match the game.`);
  writeFileSync(p, s.replace(find, replace));
}

// 1. tell the game it is running inside the app
patch('play/index.html', '<script src="js/content.js"></script>',
  `<script>window.QUEST_NATIVE = true; window.QUEST_SITE = ${JSON.stringify(SITE)};</script>\n  <script src="js/content.js"></script>`);
// 2. words and concepts: the newest from the website when online, the copy built in when not
patch('play/js/boot.js', `const res = await fetch('../data/content.json', { cache: 'no-cache' });`,
  `const res = await fetch(window.QUEST_SITE + 'data/content.json', { cache: 'no-cache' }).then(r => (r.ok ? r : Promise.reject())).catch(() => fetch('../data/content.json'));`);
// 3. "send the link" must point at the website, not at the app's private address
patch('play/js/cloud.js', 'const linkURL = () => { const u = new URL(location.href);',
  `const linkURL = () => { const u = new URL(window.QUEST_SITE ? window.QUEST_SITE + 'quest/' : location.href);`);

// 4. fonts: bundled, so Greek looks right with no signal
const FONTS = 'https://fonts.googleapis.com/css2?family=Gentium+Plus:ital,wght@0,400;0,700;1,400&family=Nunito:wght@400;700;800;900&display=swap';
try {
  const UA = { 'user-agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36' };
  let css = await (await fetch(FONTS, { headers: UA })).text();
  const urls = [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)]+/g) || [])];
  if (!urls.length) throw new Error('no font files listed');
  mkdirSync(join(WWW, 'play/fonts'));
  for (const [i, u] of urls.entries()) {
    const name = `f${i}.woff2`;
    writeFileSync(join(WWW, 'play/fonts', name), Buffer.from(await (await fetch(u)).arrayBuffer()));
    css = css.split(u).join(`fonts/${name}`);
  }
  writeFileSync(join(WWW, 'play/fonts.css'), css);
  patch('play/index.html', `<link href="${FONTS}" rel="stylesheet">`, '<link href="fonts.css" rel="stylesheet">');
  console.log(`fonts: ${urls.length} files bundled`);
} catch (e) {
  console.warn(`fonts: kept online (${e.message})`);
}

const n = JSON.parse(readFileSync(join(WWW, 'data/content.json'), 'utf8'));
console.log(`www built: game + content ${n.hash} (${n.words.length} words, ${n.cards.length} concepts)`);
if (!existsSync(join(WWW, 'play/js/vendor/three.module.min.js'))) throw new Error('three.js missing');
