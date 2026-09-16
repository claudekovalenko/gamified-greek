/**
 * Greek Quest — Going Deeper with New Testament Greek, as a game.
 *
 * Every word comes from going-deeper-greek-vocab and every concept from
 * going-deeper-greek-concepts. Nothing here is chapter-specific: the content
 * bundle (data/content.json, refreshed straight from the source repos when
 * online) decides what there is to learn; this file decides how it is played.
 */

import { normalize } from './normalize.js';
import { SOURCES } from './sources.js';
import { Dash } from './dash.js';

const BUILD = 'v2 · 2026-09-16';
const CONTENT_URL = './data/content.json';
const PEOPLE_KEY = 'gq.people';
const CONTENT_KEY = 'gq.content';
const stateKey = (id) => `gq.v1:${id}`;

const MASTERY_MAX = 5;
const MASTERED_AT = 5;
const LEARNED_AT = 3;
// After a right answer at mastery m, the item is not due again for this long.
const DUE_AFTER = [0, 10 * 60e3, 60 * 60e3, 24 * 3600e3, 3 * 86400e3, 7 * 86400e3];

const GREEK_LETTERS = 'Α Β Γ Δ Ε Ζ Η Θ Ι Κ Λ Μ Ν Ξ Ο Π Ρ Σ Τ Υ Φ Χ Ψ Ω'.split(' ');
const GREEK_NAMES = 'Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa Lambda Mu Nu Xi Omicron Pi Rho Sigma Tau Upsilon Phi Chi Psi Omega'.split(' ');
const RANKS = [
  [1, 'Novice'], [4, 'Apprentice'], [8, 'Reader'], [12, 'Scribe'], [16, 'Exegete'], [20, 'Scholar'], [24, 'Sage']
];
const xpForLevel = (L) => 60 * L * (L - 1); // L=2 at 120, L=5 at 1200, L=24 at 33 120

/* ---------------- small helpers ---------------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** Escape, then turn the source data's *asterisk markers* into highlights. */
const mk = (s) => esc(s).replace(/\*([^*]+)\*/g, '<mark>$1</mark>');
const plain = (s) => String(s ?? '').replace(/\*/g, '');
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const uniqBy = (arr, fn) => {
  const seen = new Set();
  return arr.filter((x) => {
    const k = fn(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};
const today = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const dayOffset = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const lemma = (g) => String(g || '').split(',')[0].trim();
const glossShort = (gloss) => String(gloss || '').split(/[;(]/)[0].trim();

function loadJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function saveJSON(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* private mode / quota: the game still runs, it just will not remember */
  }
}

/* ---------------- people ---------------- */

let people = loadPeople();
function loadPeople() {
  const raw = loadJSON(PEOPLE_KEY, null);
  if (raw && Array.isArray(raw.list) && raw.list.length) return raw;
  const first = { id: 'p1', name: 'Me' };
  const seeded = { list: [first], active: first.id };
  saveJSON(PEOPLE_KEY, seeded);
  return seeded;
}
const savePeople = () => saveJSON(PEOPLE_KEY, people);
const activePerson = () => people.list.find((p) => p.id === people.active) || people.list[0];

/* ---------------- per-person state ---------------- */

const freshState = () => ({
  v: 1,
  xp: 0,
  items: {},
  nodes: {},
  crowns: {},
  days: {},
  streak: { count: 0, last: null, best: 0 },
  daily: null,
  badges: {},
  stats: { right: 0, wrong: 0, lessons: 0, bosses: 0, bestCombo: 0, bestQuick: 0, bestRush: 0, bestDash: 0, perfects: 0, matchBest: null },
  settings: { sound: true, chapter: null, stops: 'run' }
});
let S = loadState();
function loadState() {
  const raw = loadJSON(stateKey(people.active), null);
  const base = freshState();
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    streak: { ...base.streak, ...(raw.streak || {}) },
    stats: { ...base.stats, ...(raw.stats || {}) },
    settings: { ...base.settings, ...(raw.settings || {}) }
  };
}
const save = () => saveJSON(stateKey(people.active), S);

/* ---------------- content ---------------- */

let C = null; // the bundle
let IX = null; // indexes over it

function buildIndexes(bundle) {
  const byId = new Map();
  for (const w of bundle.words) byId.set(w.id, w);
  for (const c of bundle.cards) byId.set(c.id, c);
  const setById = new Map(bundle.sets.map((s) => [s.id, s]));
  const wordsByChapter = new Map();
  for (const w of bundle.words) {
    if (!wordsByChapter.has(w.chapter)) wordsByChapter.set(w.chapter, []);
    wordsByChapter.get(w.chapter).push(w);
  }
  const cardsBySet = new Map();
  for (const c of bundle.cards) {
    if (!cardsBySet.has(c.set)) cardsBySet.set(c.set, []);
    cardsBySet.get(c.set).push(c);
  }
  const sentencesByWord = new Map();
  for (const s of bundle.sentences) for (const u of s.uses) {
    if (!sentencesByWord.has(u)) sentencesByWord.set(u, []);
    sentencesByWord.get(u).push(s);
  }
  const partners = new Map();
  for (const cf of bundle.confusions) {
    const [a, b] = cf.pair;
    if (!partners.has(a)) partners.set(a, []);
    if (!partners.has(b)) partners.set(b, []);
    partners.get(a).push(b);
    partners.get(b).push(a);
  }
  // Acrostic ladders: a group whose key, letters only, is exactly its cards'
  // tiles in order. "SWAMP RD" over S,W,A,M,P,R,D qualifies; "Say the name" over
  // one card does not.
  const ladders = [];
  for (const set of bundle.sets) for (const g of set.groups) {
    const cards = bundle.cards.filter((c) => c.group === g.id);
    const letters = g.key.replace(/[^A-Za-z]/g, '');
    const tiles = cards.map((c) => c.tile).join('');
    if (cards.length >= 3 && letters && letters === tiles) {
      ladders.push({ id: `l:${g.id}`, set: set.id, chapter: set.chapter, group: g, cards });
    }
  }
  const extraByCard = new Map();
  for (const q of bundle.extraQuiz) {
    if (!extraByCard.has(q.answer)) extraByCard.set(q.answer, []);
    extraByCard.get(q.answer).push(q);
  }
  return { byId, setById, wordsByChapter, cardsBySet, sentencesByWord, partners, ladders, extraByCard };
}

function useContent(bundle) {
  C = bundle;
  IX = buildIndexes(bundle);
  $('#brand-sub').textContent = `${bundle.words.length} words · ${bundle.cards.length} concepts`;
}

async function loadContent() {
  const stored = loadJSON(CONTENT_KEY, null);
  let bundled = null;
  try {
    const res = await fetch(CONTENT_URL, { cache: 'no-cache' });
    if (res.ok) bundled = await res.json();
  } catch {
    /* offline with no service worker yet: fall back to whatever is stored */
  }
  const newest = [stored, bundled].filter((b) => b && b.schema === 1).sort((a, b) => (b.fetchedAt || '').localeCompare(a.fetchedAt || ''))[0];
  if (!newest) throw new Error('No content available. Open the app once while online.');
  useContent(newest);
}

/**
 * Pull the two source files straight from their repos and rebuild the bundle.
 * Returns 'updated', 'same' or 'offline'. The app keeps playing from whatever
 * it has while this runs.
 */
let refreshing = false;
async function refreshFromSources({ quiet = true } = {}) {
  if (refreshing) return 'busy';
  if (!navigator.onLine) return 'offline';
  refreshing = true;
  try {
    const get = async (url) => {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`${url} → ${res.status}`);
      return res.text();
    };
    const [conceptsText, vocabText] = await Promise.all([get(SOURCES.concepts.raw), get(SOURCES.vocab.raw)]);
    const bundle = normalize({
      concepts: JSON.parse(conceptsText),
      vocabSrc: vocabText,
      sources: {
        concepts: { repo: SOURCES.concepts.repo, path: SOURCES.concepts.path, site: SOURCES.concepts.site },
        vocab: { repo: SOURCES.vocab.repo, path: SOURCES.vocab.path, site: SOURCES.vocab.site }
      }
    });
    if (bundle.hash === C.hash) {
      C.fetchedAt = bundle.fetchedAt;
      saveJSON(CONTENT_KEY, C);
      if (!quiet) toast('Already up to date with both apps', 'ok');
      return 'same';
    }
    saveJSON(CONTENT_KEY, bundle);
    const before = { w: C.words.length, c: C.cards.length };
    useContent(bundle);
    const dw = bundle.words.length - before.w;
    const dc = bundle.cards.length - before.c;
    const delta = [dw ? `${dw > 0 ? '+' : ''}${dw} words` : '', dc ? `${dc > 0 ? '+' : ''}${dc} concepts` : ''].filter(Boolean).join(', ');
    toast(`Fresh content from the source apps${delta ? ` · ${delta}` : ''}`, 'ok');
    if (!run) render();
    return 'updated';
  } catch (e) {
    if (!quiet) toast('Could not reach the source apps right now');
    return 'offline';
  } finally {
    refreshing = false;
  }
}

/* ---------------- mastery ---------------- */

const itemState = (id) => S.items[id] || { m: 0, seen: 0, right: 0, wrong: 0, last: 0, due: 0 };
const isDue = (id, now = Date.now()) => itemState(id).due <= now;

/** Record an answer on an item and return the change in mastery. */
function recordAnswer(id, right) {
  const st = { ...itemState(id) };
  const now = Date.now();
  const wasNew = st.seen === 0;
  st.seen += 1;
  st.last = now;
  if (right) {
    st.right += 1;
    st.m = Math.min(MASTERY_MAX, st.m + 1);
    st.due = now + DUE_AFTER[st.m];
  } else {
    st.wrong += 1;
    st.m = Math.max(0, st.m - 1);
    st.due = now;
  }
  S.items[id] = st;
  if (wasNew) S.stats.newToday = (S.stats.newToday || 0) + 1;
  return st;
}

/**
 * Choose n items to ask, preferring the ones that are due, then the ones that
 * are weakest, with enough randomness that two lessons are never the same.
 */
function pickItems(pool, n) {
  const now = Date.now();
  const scored = pool.map((it) => {
    const st = itemState(it.id);
    const due = st.due <= now ? 0 : 6;
    return { it, p: st.m * 10 + due + Math.random() * 9 - (st.seen === 0 ? 4 : 0) };
  });
  scored.sort((a, b) => a.p - b.p);
  return scored.slice(0, n).map((x) => x.it);
}

/* ---------------- xp, levels, streaks, quests, badges ---------------- */

function levelInfo(xp = S.xp) {
  let L = 1;
  while (L < 24 && xp >= xpForLevel(L + 1)) L++;
  const from = xpForLevel(L);
  const to = L < 24 ? xpForLevel(L + 1) : from;
  const pct = L < 24 ? Math.round(((xp - from) / (to - from)) * 100) : 100;
  const rank = RANKS.filter(([at]) => L >= at).pop()[1];
  return { L, letter: GREEK_LETTERS[L - 1], name: GREEK_NAMES[L - 1], rank, from, to, pct };
}

let pendingLevelUp = null;
function addXP(n, why) {
  if (!n) return;
  const before = levelInfo().L;
  S.xp += n;
  const d = today();
  S.days[d] = S.days[d] || { xp: 0, right: 0 };
  S.days[d].xp += n;
  bumpQuest('xp', n);
  const after = levelInfo().L;
  if (after > before) pendingLevelUp = after;
}

function touchStreak() {
  const d = today();
  const st = S.streak;
  if (st.last === d) return;
  if (st.last === dayOffset(d, -1)) st.count += 1;
  else st.count = 1;
  st.last = d;
  st.best = Math.max(st.best, st.count);
}
function streakNow() {
  const d = today();
  if (S.streak.last === d || S.streak.last === dayOffset(d, -1)) return S.streak.count;
  return 0;
}

const QUEST_POOL = [
  { id: 'xp', ic: '✨', goal: 150, text: 'Earn 150 XP' },
  { id: 'right', ic: '✅', goal: 40, text: 'Get 40 answers right' },
  { id: 'lesson', ic: '🗺️', goal: 2, text: 'Finish 2 journey lessons' },
  { id: 'combo', ic: '🔥', goal: 8, text: 'Hit an 8-answer combo' },
  { id: 'match', ic: '🧩', goal: 1, text: 'Play a Match-Up' },
  { id: 'spot', ic: '🔍', goal: 10, text: 'Spot 10 uses in real Greek' },
  { id: 'new', ic: '🆕', goal: 8, text: 'Meet 8 new words or concepts' },
  { id: 'perfect', ic: '⭐', goal: 1, text: 'Get 3 stars on a lesson' },
  { id: 'boss', ic: '👑', goal: 1, text: 'Challenge a boss' },
  { id: 'ladder', ic: '🪜', goal: 3, text: 'Climb 3 acrostic ladders' },
  { id: 'words', ic: '📚', goal: 25, text: 'Answer 25 vocabulary questions' },
  { id: 'concepts', ic: '🧠', goal: 15, text: 'Answer 15 concept questions' }
];
const QUEST_XP = 40;

function seededPick(seed, arr, n) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0;
    const j = h % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}
function dailyQuests() {
  const d = today();
  if (!S.daily || S.daily.date !== d) {
    S.daily = { date: d, quests: seededPick(`${d}:${people.active}`, QUEST_POOL, 3).map((q) => ({ id: q.id, n: 0, done: false })) };
    S.stats.newToday = 0;
  }
  return S.daily.quests.map((q) => ({ ...QUEST_POOL.find((p) => p.id === q.id), ...q }));
}
function bumpQuest(id, n = 1, { max = false } = {}) {
  if (!S.daily || S.daily.date !== today()) dailyQuests();
  const q = S.daily.quests.find((x) => x.id === id);
  if (!q || q.done) return;
  const def = QUEST_POOL.find((p) => p.id === id);
  q.n = max ? Math.max(q.n, n) : q.n + n;
  if (q.n >= def.goal) {
    q.done = true;
    S.xp += QUEST_XP;
    S.days[today()].xp += QUEST_XP;
    queueToast(`${def.ic} Quest done: ${def.text} · +${QUEST_XP} XP`, 'gold');
    sfx('quest');
  }
}

const BADGES = [
  { id: 'first', ic: '🚶', name: 'First steps', how: 'Finish a lesson', test: () => S.stats.lessons >= 1 },
  { id: 'streak3', ic: '🔥', name: 'On a roll', how: '3-day streak', test: () => S.streak.best >= 3 },
  { id: 'streak7', ic: '🌋', name: 'Week of fire', how: '7-day streak', test: () => S.streak.best >= 7 },
  { id: 'streak30', ic: '☄️', name: 'Unstoppable', how: '30-day streak', test: () => S.streak.best >= 30 },
  { id: 'met50', ic: '👋', name: 'Hello, Greek', how: 'Meet 50 words', test: () => countMet('w') >= 50 },
  { id: 'metall', ic: '🌍', name: 'Seen it all', how: 'Meet every word', test: () => C && countMet('w') >= C.words.length },
  { id: 'gold25', ic: '🥇', name: 'Gold digger', how: 'Master 25 items', test: () => countMastered() >= 25 },
  { id: 'gold100', ic: '🏆', name: 'Treasury', how: 'Master 100 items', test: () => countMastered() >= 100 },
  { id: 'concept20', ic: '🧠', name: 'Grammarian', how: 'Master 20 concepts', test: () => countMastered('c') >= 20 },
  { id: 'boss1', ic: '⚔️', name: 'Boss slayer', how: 'Beat a chapter boss', test: () => S.stats.bosses >= 1 },
  { id: 'crowns', ic: '👑', name: 'Crowned', how: 'Crown every chapter', test: () => C && C.chapters.every((ch) => S.crowns[ch.n]) },
  { id: 'combo10', ic: '⚡', name: 'Lightning', how: '10-answer combo', test: () => S.stats.bestCombo >= 10 },
  { id: 'combo25', ic: '🌩️', name: 'Thunderstorm', how: '25-answer combo', test: () => S.stats.bestCombo >= 25 },
  { id: 'perfect5', ic: '💎', name: 'Flawless', how: '5 three-star lessons', test: () => S.stats.perfects >= 5 },
  { id: 'quick30', ic: '⏱️', name: 'Quick draw', how: '30 right in one Quick Fire', test: () => S.stats.bestQuick >= 30 },
  { id: 'rush25', ic: '🛡️', name: 'Survivor', how: 'Survive 25 in Boss Rush', test: () => S.stats.bestRush >= 25 },
  { id: 'dash20', ic: '🏃', name: 'Marathon', how: '20 gates in one Temple Dash', test: () => S.stats.bestDash >= 20 },
  { id: 'lvl5', ic: 'Ε', name: 'Epsilon', how: 'Reach level 5', test: () => levelInfo().L >= 5 },
  { id: 'lvl12', ic: 'Μ', name: 'Mu', how: 'Reach level 12', test: () => levelInfo().L >= 12 },
  { id: 'lvl24', ic: 'Ω', name: 'Omega', how: 'Reach level 24', test: () => levelInfo().L >= 24 }
];
function countMet(prefix) {
  return Object.entries(S.items).filter(([id, st]) => (!prefix || id.startsWith(prefix)) && st.seen > 0 && IX.byId.has(id)).length;
}
function countMastered(prefix) {
  return Object.entries(S.items).filter(([id, st]) => (!prefix || id.startsWith(prefix)) && st.m >= MASTERED_AT && IX.byId.has(id)).length;
}
function checkBadges() {
  for (const b of BADGES) {
    if (S.badges[b.id]) continue;
    let ok = false;
    try { ok = b.test(); } catch { ok = false; }
    if (ok) {
      S.badges[b.id] = Date.now();
      queueToast(`${b.ic} Badge: ${b.name}`, 'gold');
      sfx('badge');
    }
  }
}

/* ---------------- toasts, sound, confetti ---------------- */

const toastQueue = [];
function queueToast(msg, kind) { toastQueue.push([msg, kind]); }
function flushToasts() {
  while (toastQueue.length) toast(...toastQueue.shift());
}
function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 3400);
}

let audio = null;
function sfx(kind) {
  if (!S.settings.sound) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const t = audio.currentTime;
    const tone = (f, at, dur, type = 'sine', vol = 0.12) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t + at);
      g.gain.setValueAtTime(0.0001, t + at);
      g.gain.exponentialRampToValueAtTime(vol, t + at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
      o.connect(g).connect(audio.destination);
      o.start(t + at);
      o.stop(t + at + dur + 0.02);
    };
    if (kind === 'right') { tone(660, 0, 0.12); tone(880, 0.09, 0.16); }
    else if (kind === 'wrong') { tone(180, 0, 0.25, 'square', 0.06); }
    else if (kind === 'tap') { tone(520, 0, 0.06, 'triangle', 0.05); }
    else if (kind === 'match') { tone(740, 0, 0.08, 'triangle'); tone(990, 0.06, 0.1, 'triangle'); }
    else if (kind === 'quest' || kind === 'badge') { tone(523, 0, 0.12); tone(659, 0.1, 0.12); tone(784, 0.2, 0.2); }
    else if (kind === 'levelup' || kind === 'win') { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.25)); }
    else if (kind === 'lose') { tone(300, 0, 0.3, 'sawtooth', 0.05); tone(220, 0.25, 0.4, 'sawtooth', 0.05); }
    else if (kind === 'crash') { tone(120, 0, 0.35, 'sawtooth', 0.08); tone(90, 0.05, 0.4, 'square', 0.05); }
    else if (kind === 'gate') { tone(660, 0, 0.1); tone(880, 0.08, 0.12); tone(1320, 0.16, 0.18); }
  } catch {
    /* no audio: fine */
  }
}

function confetti(ms = 1600) {
  const cv = $('#confetti');
  const ctx = cv.getContext('2d');
  cv.width = innerWidth;
  cv.height = innerHeight;
  cv.classList.add('on');
  const colors = ['#ffc53d', '#7c8cff', '#3fd18f', '#ff6b6b', '#c56bff', '#4cc9f0'];
  const ps = Array.from({ length: 120 }, () => ({
    x: Math.random() * cv.width, y: -20 - Math.random() * cv.height * 0.5,
    vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4, r: 4 + Math.random() * 5,
    c: pick(colors), a: Math.random() * Math.PI, va: (Math.random() - 0.5) * 0.3
  }));
  const t0 = performance.now();
  const frame = (t) => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (const p of ps) {
      p.x += p.vx; p.y += p.vy; p.a += p.va;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6); ctx.restore();
    }
    if (t - t0 < ms) requestAnimationFrame(frame);
    else { ctx.clearRect(0, 0, cv.width, cv.height); cv.classList.remove('on'); }
  };
  requestAnimationFrame(frame);
}

/* ================================================================
 *  QUESTIONS
 *  A step is one screen of play. Three kinds:
 *    mc     tap the right one of 2–4 options
 *    match  pair up five Greek/English (or concept/gist) tiles
 *    order  tap the cards of an acrostic in the order its letters go
 * ================================================================ */

const isWord = (it) => it.id.startsWith('w:');
const quizzable = (c) => c.type !== 'rule';

function wordPool(chapters) {
  return C.words.filter((w) => !chapters || chapters.includes(w.chapter));
}
function cardPool(chapters) {
  return C.cards.filter((c) => quizzable(c) && (!chapters || chapters.includes(c.chapter)));
}

/** n distractors from pool, distinct by key, preferring `prefer` first. */
function distractors(pool, answer, n, key, prefer = () => false) {
  const others = pool.filter((x) => x.id !== answer.id && key(x) !== key(answer));
  const a = shuffle(others.filter(prefer));
  const b = shuffle(others.filter((x) => !prefer(x)));
  return uniqBy(a.concat(b), key).slice(0, n);
}

// `text` is the short form a Temple Dash gate sign carries.
const wordOpt = (w) => ({ id: w.id, html: `<span class="gk">${esc(w.g)}</span>`, cls: 'gk', text: lemma(w.g) });
const glossOpt = (w) => ({ id: w.id, html: esc(w.gloss), text: glossShort(w.gloss) });
const cardOpt = (c) => ({ id: c.id, html: `<span>${esc(c.pic)}</span> ${esc(c.name)}`, text: `${c.pic} ${c.short}` });
const wordExplain = (w) =>
  `<span>${esc(w.icon)}</span> <b class="gk">${esc(w.g)}</b> — ${esc(w.gloss)}${w.mn ? `<br><span class="muted">${esc(w.mn)}</span>` : ''}`;
const cardExplain = (c, note) =>
  `<span>${esc(c.pic)}</span> <b>${esc(c.name)}</b> — ${esc(c.oneLine)}${note ? `<br>${mk(note)}` : ''}${c.mnemonic ? `<br><span class="muted">Hook: ${esc(c.mnemonic)}</span>` : ''}`;

const sameChapter = (w) => (x) => x.chapter === w.chapter;
function cardPrefer(c) {
  const partners = new Set(IX.partners.get(c.id) || []);
  return (x) => partners.has(x.id) || x.set === c.set;
}

/* ---- words ---- */

function qWordG2E(w, pool) {
  const opts = shuffle([glossOpt(w), ...distractors(pool, w, 3, (x) => x.gloss, sameChapter(w)).map(glossOpt)]);
  return { kind: 'mc', label: 'Greek → English', prompt: esc(w.g), promptClass: 'gk', ask: 'What does it mean?', options: opts, answer: w.id, items: [w.id], explain: wordExplain(w), tag: 'word' };
}
function qWordE2G(w, pool) {
  const opts = shuffle([wordOpt(w), ...distractors(pool, w, 3, (x) => x.g, sameChapter(w)).map(wordOpt)]);
  return { kind: 'mc', label: 'English → Greek', prompt: esc(w.gloss), ask: 'Which word is it?', options: opts, answer: w.id, items: [w.id], explain: wordExplain(w), tag: 'word' };
}
function qWordHook(w, pool) {
  if (!w.mn) return qWordG2E(w, pool);
  const opts = shuffle([wordOpt(w), ...distractors(pool, w, 3, (x) => x.g, sameChapter(w)).map(wordOpt)]);
  return { kind: 'mc', label: 'Hook hunt', prompt: esc(w.mn), promptClass: 'hook', ask: 'Whose hook is this?', options: opts, answer: w.id, items: [w.id], explain: wordExplain(w), tag: 'word', game: 'hook' };
}
function qSleuth(w, pool) {
  const ss = IX.sentencesByWord.get(w.id);
  if (!ss || !ss.length) return qWordG2E(w, pool);
  const s = pick(ss);
  const used = new Set(s.uses);
  const opts = shuffle([wordOpt(w), ...distractors(pool.filter((x) => !used.has(x.id)), w, 3, (x) => x.g, sameChapter(w)).map(wordOpt)]);
  return {
    kind: 'mc', label: 'Sentence sleuth', prompt: esc(s.g), promptClass: 'gk sent', sub: esc(s.e),
    ask: 'Which word is in this sentence?', options: opts, answer: w.id, items: [w.id], explain: wordExplain(w), tag: 'word', game: 'sleuth'
  };
}
function qSentenceMeaning(s) {
  const others = C.sentences.filter((x) => x.id !== s.id && x.e !== s.e);
  const near = shuffle(others.filter((x) => x.chapter === s.chapter)).concat(shuffle(others.filter((x) => x.chapter !== s.chapter)));
  const opts = shuffle([{ id: s.id, html: esc(s.e) }, ...uniqBy(near, (x) => x.e).slice(0, 3).map((x) => ({ id: x.id, html: esc(x.e) }))]);
  const words = s.uses.map((id) => IX.byId.get(id)).filter(Boolean);
  const explain = words.map((w) => `<b class="gk">${esc(lemma(w.g))}</b> ${esc(glossShort(w.gloss))}`).join(' · ');
  return {
    kind: 'mc', label: 'Sentence sleuth', prompt: esc(s.g), promptClass: 'gk sent', ask: 'What does it say?', options: opts, answer: s.id,
    items: s.uses, creditOnlyRight: true, explain, tag: 'word', game: 'sleuth'
  };
}
function stepForWord(w, pool, kinds = ['g2e', 'g2e', 'g2e', 'e2g', 'e2g', 'hook', 'sleuth']) {
  const k = pick(kinds);
  if (k === 'e2g') return qWordE2G(w, pool);
  if (k === 'hook') return qWordHook(w, pool);
  if (k === 'sleuth') return qSleuth(w, pool);
  return qWordG2E(w, pool);
}
function matchWords(words) {
  const ws = uniqBy(uniqBy(words, (w) => w.g), (w) => glossShort(w.gloss)).slice(0, 5);
  if (ws.length < 3) return null;
  return {
    kind: 'match', label: 'Match-up', tag: 'word', game: 'match', items: ws.map((w) => w.id),
    pairs: ws.map((w) => ({ id: w.id, l: { html: esc(w.g), cls: 'gk' }, r: { html: esc(glossShort(w.gloss)) } }))
  };
}

/* ---- concepts ---- */

function cardOptions(c, pool) {
  return shuffle([cardOpt(c), ...distractors(pool, c, 3, (x) => x.name, cardPrefer(c)).map(cardOpt)]);
}
function qSpot(c, pool) {
  const exs = c.examples.filter((e) => e.note);
  const extras = IX.extraByCard.get(c.id) || [];
  const all = exs.map((e) => ({ e })).concat(extras.map((x) => ({ x })));
  if (!all.length) return qHookC(c, pool);
  const chosen = pick(all);
  const base = { kind: 'mc', label: 'Spot it', ask: 'Which use is this?', options: cardOptions(c, pool), answer: c.id, items: [c.id], tag: 'concept', game: 'spot' };
  if (chosen.e) {
    const e = chosen.e;
    return { ...base, prompt: e.greek ? mk(e.greek) : mk(e.english), promptClass: e.greek ? 'gk sent' : '', sub: e.greek ? mk(e.english) : '', ref: e.ref, explain: cardExplain(c, e.note) };
  }
  const x = chosen.x;
  const caveat = x.unofficial ? '<br><span class="muted">A reasoned answer, not the book’s — worth checking in class.</span>' : '';
  return { ...base, prompt: x.greek ? mk(x.greek) : esc(x.prompt), promptClass: x.greek ? 'gk sent' : '', sub: x.greek ? mk(x.english || x.prompt) : '', ref: x.ref, explain: cardExplain(c, x.why) + caveat };
}
function qHookC(c, pool) {
  if (!c.mnemonic) return qPlain(c, pool);
  const opts = shuffle([cardOpt(c), ...distractors(pool, c, 3, (x) => x.mnemonic || x.name, cardPrefer(c)).map(cardOpt)]);
  return { kind: 'mc', label: 'Hook hunt', prompt: esc(c.mnemonic), promptClass: 'hook', ask: 'Which concept has this hook?', options: opts, answer: c.id, items: [c.id], explain: cardExplain(c, c.mnemonicWhy), tag: 'concept', game: 'hook' };
}
function qPlain(c, pool) {
  const text = c.eli5 || c.oneLine || c.bookDef;
  return { kind: 'mc', label: 'Plain words', prompt: esc(text), ask: 'Which concept is this?', options: cardOptions(c, pool), answer: c.id, items: [c.id], explain: cardExplain(c, c.eli5 && c.oneLine !== text ? c.bookDef : ''), tag: 'concept', game: 'plain' };
}
function qDuel(cf) {
  const cards = cf.pair.map((id) => IX.byId.get(id)).filter(Boolean);
  if (cards.length !== 2) return null;
  const withEx = cards.filter((c) => c.examples.some((e) => e.note));
  if (!withEx.length) return null;
  const c = pick(withEx);
  const e = pick(c.examples.filter((x) => x.note && x.greek).concat(c.examples.filter((x) => x.note && !x.greek)).slice(0, 3));
  return {
    kind: 'mc', label: 'Confusion duel', prompt: e.greek ? mk(e.greek) : mk(e.english), promptClass: e.greek ? 'gk sent' : '', sub: e.greek ? mk(e.english) : '', ref: e.ref,
    ask: cf.question || 'Which is it?', options: shuffle(cards.map(cardOpt)), answer: c.id, items: [c.id],
    explain: `${cardExplain(c, e.note)}<br><span class="muted">Test: ${esc(cf.test)}</span>`, tag: 'concept', game: 'duel'
  };
}
function qLadder(l) {
  return {
    kind: 'order', label: 'Acrostic ladder', ladder: l, key: l.group.key, title: l.group.name,
    // A one-letter acrostic keeps its hint; a word-tile key ("Sharp · Colwell ·
    // Apollonius") already says the order, so the hint would give it all away.
    hint: l.cards.every((c) => c.tile.length === 1) ? l.group.mnemonic : '',
    cards: l.cards.map((c) => ({ id: c.id, tile: c.tile, html: `${esc(c.pic)} ${esc(c.short)}`, gist: c.gist })),
    items: l.cards.map((c) => c.id), tag: 'concept', game: 'ladder'
  };
}
function stepForCard(c, pool, kinds = ['spot', 'spot', 'hook', 'plain']) {
  const k = pick(kinds);
  if (k === 'hook') return qHookC(c, pool);
  if (k === 'plain') return qPlain(c, pool);
  return qSpot(c, pool);
}
function matchConcepts(cards) {
  const cs = uniqBy(cards.filter((c) => c.gist), (c) => c.gist).slice(0, 5);
  if (cs.length < 3) return null;
  return {
    kind: 'match', label: 'Match-up', tag: 'concept', game: 'match', items: cs.map((c) => c.id),
    pairs: cs.map((c) => ({ id: c.id, l: { html: `${esc(c.pic)} ${esc(c.short)}` }, r: { html: esc(c.gist) } }))
  };
}

/* ---- any item ---- */

function stepForItem(it, scope) {
  return isWord(it) ? stepForWord(it, scope.words) : stepForCard(it, scope.cards);
}

/** Everything in a scope, as pools, for the arcade and the bosses. */
function makeScope(chapters, { words = true, concepts = true } = {}) {
  return {
    chapters,
    words: words ? wordPool(chapters) : [],
    cards: concepts ? cardPool(chapters) : [],
    sentences: words ? C.sentences.filter((s) => (!chapters || chapters.includes(s.chapter)) && s.uses.length) : [],
    ladders: concepts ? IX.ladders.filter((l) => !chapters || chapters.includes(l.chapter)) : [],
    confusions: concepts ? C.confusions.filter((cf) => cf.pair.every((id) => { const c = IX.byId.get(id); return c && (!chapters || chapters.includes(c.chapter)); })) : []
  };
}

/* ================================================================
 *  THE JOURNEY: chapters → nodes → lesson plans
 * ================================================================ */

const PACK_ICONS = ['📜', '🏺', '🕯️', '📯', '🏛️', '⚱️', '🪔', '🗿'];

function chunkWords(words, size = 10) {
  const out = [];
  for (let i = 0; i < words.length; i += size) out.push(words.slice(i, i + size));
  if (out.length > 1 && out[out.length - 1].length < 5) out[out.length - 2].push(...out.pop());
  return out;
}

function nodesForChapter(ch) {
  const nodes = [];
  const words = IX.wordsByChapter.get(ch.n) || [];
  chunkWords(words).forEach((ws, i) => {
    const mem = ws.filter((w) => w.tier === 'memorize').length;
    const rec = ws.length - mem;
    nodes.push({
      id: `v:${ch.n}:${i}`, kind: 'pack', chapter: ch.n, icon: PACK_ICONS[i % PACK_ICONS.length],
      title: `Words ${i * 10 + 1}–${i * 10 + ws.length}`,
      sub: [mem ? `${mem} to memorize` : '', rec ? `${rec} to recognize` : ''].filter(Boolean).join(' · '),
      words: ws, cards: [], color: '#7c8cff'
    });
  });
  // Concept sets, with the tiny ones (the vocative's single card) folded into
  // their neighbour so no node is a two-question lesson.
  const groups = [];
  for (const sid of ch.conceptSets) {
    const set = IX.setById.get(sid);
    const cards = (IX.cardsBySet.get(sid) || []).filter(quizzable);
    if (!cards.length) continue;
    if (cards.length < 4 && groups.length) groups[groups.length - 1].sets.push(set);
    else groups.push({ sets: [set] });
  }
  for (const g of groups) {
    const cards = g.sets.flatMap((s) => (IX.cardsBySet.get(s.id) || []).filter(quizzable));
    const first = g.sets[0];
    nodes.push({
      id: `c:${ch.n}:${g.sets.map((s) => s.id).join('+')}`, kind: 'concept', chapter: ch.n, icon: first.place,
      title: g.sets.map((s) => s.name).join(' & '), sub: `${first.placeName} · ${cards.length} concepts`,
      sets: g.sets, words: [], cards, color: first.color
    });
  }
  nodes.push({
    id: `boss:${ch.n}`, kind: 'boss', chapter: ch.n, icon: '👑', title: `Chapter ${ch.n} boss`,
    sub: '3 hearts · everything in the chapter', words, cards: cardPool([ch.n]), color: '#ffc53d'
  });
  return nodes;
}

function nodeStatus(nodes, i) {
  const n = nodes[i];
  const rec = S.nodes[n.id] || { stars: 0 };
  if (n.kind === 'boss') {
    const ready = nodes.filter((x) => x.kind !== 'boss').every((x) => (S.nodes[x.id] || {}).stars >= 1);
    return { stars: rec.stars, state: S.crowns[n.chapter] ? 'done' : ready ? 'avail' : 'locked' };
  }
  const unlocked = i === 0 || (S.nodes[nodes[i - 1].id] || {}).stars >= 1;
  return { stars: rec.stars, state: rec.stars >= 1 ? 'done' : unlocked ? 'avail' : 'locked' };
}

/** A lesson: a fixed list of steps for one node. */
function planForNode(node) {
  const steps = [];
  if (node.kind === 'pack') {
    const pool = wordPool([node.chapter]);
    const asked = pickItems(node.words, 8);
    const halves = (() => { const s = shuffle(node.words); return [s.slice(0, 5), s.slice(5, 10)]; })();
    const filler = (ws) => (ws.length >= 3 ? ws : ws.concat(shuffle(pool.filter((w) => !ws.includes(w))).slice(0, 5 - ws.length)));
    asked.slice(0, 4).forEach((w) => steps.push(stepForWord(w, pool)));
    const m1 = matchWords(filler(halves[0]));
    if (m1) steps.push(m1);
    asked.slice(4).forEach((w) => steps.push(stepForWord(w, pool)));
    const m2 = matchWords(filler(halves[1]));
    if (m2) steps.push(m2);
    return steps;
  }
  if (node.kind === 'concept') {
    const pool = cardPool([node.chapter]).length >= 4 ? cardPool([node.chapter]) : cardPool();
    const setIds = new Set(node.sets.map((s) => s.id));
    const ladders = IX.ladders.filter((l) => setIds.has(l.set));
    const duels = C.confusions.filter((cf) => cf.pair.every((id) => node.cards.some((c) => c.id === id)));
    const nLadders = Math.min(2, ladders.length);
    const nDuels = Math.min(1, duels.length);
    const asked = pickItems(node.cards, 10 - nLadders - nDuels);
    asked.forEach((c) => steps.push(stepForCard(c, pool)));
    shuffle(ladders).slice(0, nLadders).forEach((l) => steps.splice(Math.floor(Math.random() * (steps.length + 1)), 0, qLadder(l)));
    shuffle(duels).slice(0, nDuels).forEach((cf) => { const q = qDuel(cf); if (q) steps.splice(Math.floor(Math.random() * (steps.length + 1)), 0, q); });
    return steps;
  }
  // boss: fifteen mixed steps over the whole chapter
  const scope = makeScope([node.chapter]);
  const words = pickItems(scope.words, 8);
  const cards = pickItems(scope.cards, 5);
  words.slice(0, 6).forEach((w) => steps.push(stepForWord(w, scope.words)));
  cards.forEach((c) => steps.push(stepForCard(c, scope.cards)));
  const mixed = shuffle(steps);
  const m = matchWords(shuffle(scope.words).slice(0, 5));
  if (m) mixed.splice(3, 0, m);
  if (scope.ladders.length) mixed.splice(7, 0, qLadder(pick(scope.ladders)));
  if (scope.confusions.length) { const q = qDuel(pick(scope.confusions)); if (q) mixed.splice(10, 0, q); }
  const m2 = matchWords(shuffle(scope.words).slice(0, 5));
  if (m2) mixed.push(m2);
  return mixed.slice(0, 15);
}

/* ================================================================
 *  TEMPLE DASH: the corridor where every gate is a question
 * ================================================================ */

/**
 * Turn a multiple-choice step into a gate: three lanes, the answer in one of
 * them, distractors in the others. A two-option question (a confusion duel)
 * bricks the middle lane up, so the runner has to move.
 */
function dashify(step) {
  if (!step || step.kind !== 'mc') return null;
  const answer = step.options.find((o) => o.id === step.answer);
  if (!answer || !answer.text) return null;
  const others = step.options.filter((o) => o.id !== step.answer && o.text);
  let lanes;
  if (others.length >= 2) lanes = shuffle([answer, ...others.slice(0, 2)]);
  else if (others.length === 1) lanes = Math.random() < 0.5 ? [answer, null, others[0]] : [others[0], null, answer];
  else return null;
  return { ...step, lanes, answerLane: lanes.findIndex((o) => o && o.id === answer.id), retry: false };
}

/** The gates for one Journey stop: questions only, no boards or ladders in a corridor. */
function dashPlan(node) {
  const steps = [];
  if (node.kind === 'pack') {
    const pool = wordPool([node.chapter]);
    pickItems(node.words, 10).forEach((w) => steps.push(stepForWord(w, pool)));
  } else if (node.kind === 'concept') {
    const pool = cardPool([node.chapter]).length >= 4 ? cardPool([node.chapter]) : cardPool();
    const duels = C.confusions.filter((cf) => cf.pair.every((id) => node.cards.some((c) => c.id === id)));
    const nDuels = Math.min(2, duels.length);
    pickItems(node.cards, 10 - nDuels).forEach((c) => steps.push(stepForCard(c, pool)));
    shuffle(duels).slice(0, nDuels).forEach((cf) => { const q = qDuel(cf); if (q) steps.splice(Math.floor(Math.random() * (steps.length + 1)), 0, q); });
  } else {
    const scope = makeScope([node.chapter]);
    pickItems(scope.words, 9).forEach((w) => steps.push(stepForWord(w, scope.words)));
    pickItems(scope.cards, 5).forEach((c) => steps.push(stepForCard(c, scope.cards)));
    if (scope.confusions.length) { const q = qDuel(pick(scope.confusions)); if (q) steps.push(q); }
    return shuffle(steps.map(dashify).filter(Boolean)).slice(0, 15);
  }
  return steps.map(dashify).filter(Boolean);
}

const DASH_PACE = {
  lesson: { speed0: 8, speed1: 13, time0: 7, time1: 4, ramp: 10 },
  boss: { speed0: 10, speed1: 16, time0: 5.5, time1: 3.2, ramp: 12 },
  endless: { speed0: 8, speed1: 17, time0: 6.5, time1: 2.8, ramp: 30 }
};

/* ================================================================
 *  THE ARCADE: free play over any scope
 * ================================================================ */

const GAMES = [
  { id: 'dash', ic: '🏃', name: 'Temple Dash', desc: 'Run the corridor. Every gate is a question — be in the right lane. Three hearts.', needs: 'any', best: () => S.stats.bestDash, bestLabel: 'gates' },
  { id: 'quick', ic: '⚡', name: 'Quick Fire', desc: '60 seconds, as many as you can. Combos multiply XP.', needs: 'any', best: () => S.stats.bestQuick, bestLabel: 'right' },
  { id: 'match', ic: '🧩', name: 'Match-Up', desc: 'Four boards of five pairs. Beat your time.', needs: 'any', best: () => S.stats.matchBest, bestLabel: 's', fmt: (v) => `${(v / 1000).toFixed(1)}` },
  { id: 'spot', ic: '🔍', name: 'Spot It', desc: 'Real Greek. Which use is it?', needs: 'concepts' },
  { id: 'hook', ic: '🪝', name: 'Hook Hunt', desc: 'The mnemonic is the clue. Whose is it?', needs: 'any' },
  { id: 'sleuth', ic: '🕵️', name: 'Sentence Sleuth', desc: 'Find the word hiding in a sentence, or say what it means.', needs: 'words' },
  { id: 'duel', ic: '⚔️', name: 'Confusion Duel', desc: 'Two uses that get mixed up. Pick the right one.', needs: 'concepts' },
  { id: 'ladder', ic: '🪜', name: 'Acrostic Ladder', desc: 'SWAMP RD, PACTS, MAMA… tap the cards in order.', needs: 'concepts' },
  { id: 'rush', ic: '🛡️', name: 'Boss Rush', desc: 'Everything, endless, three hearts. How far can you get?', needs: 'any', best: () => S.stats.bestRush, bestLabel: 'survived' }
];

/** Build the run config for an arcade game over a scope. */
function arcadeRun(gameId, scope) {
  const pool = scope.words.concat(scope.cards);
  const weighted = () => pickItems(shuffle(pool).slice(0, 12), 1)[0];
  const stream = (fn) => ({ next: fn, total: null });
  switch (gameId) {
    case 'dash':
      return { title: 'Temple Dash', game: 'dash', hearts: 3, dash: true, pace: DASH_PACE.endless, steps: stream(() => {
        if (Math.random() < 0.12 && scope.confusions.length) return dashify(qDuel(pick(scope.confusions)));
        return dashify(stepForItem(weighted(), scope));
      }) };
    case 'quick':
      return { title: 'Quick Fire', game: 'quick', timer: 60, autoNext: true, steps: stream(() => stepForItem(weighted(), scope)) };
    case 'rush':
      return { title: 'Boss Rush', game: 'rush', hearts: 3, steps: stream(() => {
        const r = Math.random();
        if (r < 0.1 && scope.words.length >= 5) return matchWords(shuffle(scope.words).slice(0, 5));
        if (r < 0.18 && scope.ladders.length) return qLadder(pick(scope.ladders));
        if (r < 0.26 && scope.confusions.length) return qDuel(pick(scope.confusions)) || stepForItem(weighted(), scope);
        return stepForItem(weighted(), scope);
      }) };
    case 'match': {
      const boards = [];
      const ws = shuffle(scope.words);
      const cs = shuffle(scope.cards);
      for (let i = 0; boards.length < 4 && i < 8; i++) {
        const useWords = scope.words.length >= 5 && (!scope.cards.length || Math.random() < 0.7);
        const b = useWords ? matchWords(ws.splice(0, 5).concat(ws.length < 5 ? shuffle(scope.words).slice(0, 5) : []).slice(0, 5)) : matchConcepts(cs.splice(0, 8));
        if (b) boards.push(b);
      }
      return { title: 'Match-Up', game: 'match', stopwatch: true, steps: { list: boards } };
    }
    case 'spot': return { title: 'Spot It', game: 'spot', steps: { list: pickItems(scope.cards.filter((c) => c.examples.some((e) => e.note) || IX.extraByCard.has(c.id)), 10).map((c) => qSpot(c, scope.cards)) } };
    case 'hook': return { title: 'Hook Hunt', game: 'hook', steps: { list: pickItems(pool.filter((it) => (isWord(it) ? it.mn : it.mnemonic)), 10).map((it) => (isWord(it) ? qWordHook(it, scope.words) : qHookC(it, scope.cards))) } };
    case 'sleuth': {
      const list = shuffle(scope.sentences).slice(0, 10).map((s) => (Math.random() < 0.5 ? qSentenceMeaning(s) : qSleuth(IX.byId.get(pick(s.uses)), scope.words)));
      return { title: 'Sentence Sleuth', game: 'sleuth', steps: { list } };
    }
    case 'duel': return { title: 'Confusion Duel', game: 'duel', steps: { list: shuffle(scope.confusions).slice(0, 10).map(qDuel).filter(Boolean) } };
    case 'ladder': return { title: 'Acrostic Ladder', game: 'ladder', steps: { list: shuffle(scope.ladders).map(qLadder) } };
    default: return null;
  }
}

/* ================================================================
 *  THE RUN ENGINE: plays any list or stream of steps
 * ================================================================ */

let run = null;
let view = 'journey';
let lastView = 'journey';

const multiplier = (combo) => (combo >= 10 ? 2 : combo >= 6 ? 1.5 : combo >= 3 ? 1.25 : 1);

function startRun(cfg, node = null) {
  const list = cfg.steps.list ? cfg.steps.list.filter(Boolean) : null;
  if (list && !list.length) { toast('Nothing to play here yet'); return; }
  run = {
    cfg, node, list, next: cfg.steps.next || null, total: list ? list.length : null,
    i: 0, step: null, answered: false, over: false,
    hearts: cfg.hearts ?? null, timeLeft: cfg.timer ?? null, tick: null, t0: Date.now(),
    combo: 0, bestCombo: 0, xp: 0, right: 0, wrong: 0, points: 0, missed: new Set(), ms: null,
    dash: null, queue: list ? list.slice() : []
  };
  if (node && node.kind === 'boss') bumpQuest('boss');
  $('#tabbar').classList.add('hidden');
  if (cfg.dash) return renderDash();
  if (cfg.timer || cfg.stopwatch) {
    run.tick = setInterval(() => {
      if (!run || run.over) return;
      if (cfg.timer) {
        run.timeLeft = Math.max(0, cfg.timer - (Date.now() - run.t0) / 1000);
        const el = $('#run-timer');
        if (el) { el.textContent = Math.ceil(run.timeLeft); el.classList.toggle('low', run.timeLeft <= 10); }
        if (run.timeLeft <= 0) endRun('time');
      } else {
        const el = $('#run-timer');
        if (el) el.textContent = ((Date.now() - run.t0) / 1000).toFixed(1);
      }
    }, 200);
  }
  nextStep();
}

function nextStep() {
  if (!run || run.over) return;
  let step = null;
  if (run.list) {
    if (run.i >= run.total) return endRun('done');
    step = run.list[run.i];
  } else {
    for (let tries = 0; !step && tries < 5; tries++) step = run.next();
    if (!step) return endRun('done');
  }
  run.step = step;
  run.answered = false;
  run.ms = { sel: null, done: new Set(), miss: {}, pos: 0, wrongTaps: 0, wrongIds: new Set() };
  renderRun();
}

function stepDone(right, { points = right ? 1 : 0, perPair = null, retry = false } = {}) {
  if (!run || run.answered) return;
  run.answered = true;
  const step = run.step;
  // A gate asked again after a crash still teaches and still pays XP, but it
  // does not move the progress bar or count towards stars.
  if (!retry) {
    run.i += 1;
    run.points += points;
  }
  // mastery
  if (perPair) {
    for (const [id, ok] of Object.entries(perPair)) { recordAnswer(id, ok); if (!ok) run.missed.add(id); }
  } else {
    for (const id of step.items || []) {
      if (step.creditOnlyRight && !right) continue;
      recordAnswer(id, right);
      if (!right) run.missed.add(id);
    }
  }
  // combo, xp, hearts
  let gained = 0;
  if (right) {
    run.combo += 1;
    run.bestCombo = Math.max(run.bestCombo, run.combo);
    S.stats.bestCombo = Math.max(S.stats.bestCombo, run.combo);
    bumpQuest('combo', run.combo, { max: true });
    run.right += 1;
    S.stats.right += 1;
    const d = today();
    S.days[d] = S.days[d] || { xp: 0, right: 0 };
    S.days[d].right += 1;
    bumpQuest('right');
    const base = step.kind === 'mc' ? 10 : step.kind === 'match' ? 8 + 2 * Object.values(perPair || {}).filter(Boolean).length : 15;
    gained = Math.round(base * multiplier(run.combo));
    addXP(gained);
    run.xp += gained;
    sfx(step.kind === 'match' ? 'match' : 'right');
  } else {
    run.combo = 0;
    run.wrong += 1;
    S.stats.wrong += 1;
    if (run.hearts !== null) run.hearts -= 1;
    sfx('wrong');
  }
  if (S.stats.newToday) { bumpQuest('new', S.stats.newToday); S.stats.newToday = 0; }
  bumpQuest(step.tag === 'word' ? 'words' : 'concepts');
  if (step.game === 'spot') bumpQuest('spot');
  if (step.kind === 'match') bumpQuest('match');
  if (step.kind === 'order') bumpQuest('ladder');
  touchStreak();
  save();
  return gained;
}

function answerMC(optId) {
  if (!run || run.answered) return;
  const step = run.step;
  const right = optId === step.answer;
  const gained = stepDone(right);
  const opts = $$('.opt[data-act="opt"]');
  for (const el of opts) {
    el.disabled = true;
    if (el.dataset.id === step.answer) el.classList.add('right');
    else if (el.dataset.id === optId) el.classList.add('wrong');
    else el.classList.add('dim');
  }
  showFeedback(right, gained, step.explain);
  afterStep(right);
}

function afterStep(right) {
  if (run.hearts !== null && run.hearts <= 0) { setTimeout(() => endRun('dead'), 900); return; }
  if (run.cfg.autoNext) setTimeout(nextStep, right ? 650 : 1600);
}

function tapTile(side, id) {
  if (!run || run.answered) return;
  const ms = run.ms;
  const step = run.step;
  if (ms.done.has(id) && side) return;
  sfx('tap');
  if (!ms.sel) { ms.sel = { side, id }; paintMatch(); return; }
  if (ms.sel.side === side) { ms.sel = { side, id }; paintMatch(); return; }
  const a = ms.sel.id;
  ms.sel = null;
  if (a === id) {
    ms.done.add(id);
    paintMatch();
    if (ms.done.size === step.pairs.length) {
      const perPair = {};
      for (const p of step.pairs) perPair[p.id] = !(ms.miss[p.id] > 0);
      const misses = Object.values(ms.miss).reduce((x, y) => x + y, 0);
      const right = misses <= 1;
      const gained = stepDone(right, { points: misses === 0 ? 1 : misses <= 2 ? 0.5 : 0, perPair });
      if (run.cfg.stopwatch) { setTimeout(nextStep, 400); return; }
      showFeedback(right, gained, misses === 0 ? 'Board clear — not a single miss.' : `Board clear with ${misses} miss${misses === 1 ? '' : 'es'}.`);
      afterStep(right);
    } else sfx('match');
  } else {
    ms.miss[a] = (ms.miss[a] || 0) + 1;
    ms.miss[id] = (ms.miss[id] || 0) + 1;
    paintMatch([a, id]);
    sfx('wrong');
  }
}
function paintMatch(shake = []) {
  const ms = run.ms;
  for (const el of $$('.tile')) {
    const id = el.dataset.id;
    el.classList.toggle('sel', !!ms.sel && ms.sel.id === id && ms.sel.side === el.dataset.side);
    el.classList.toggle('ok', ms.done.has(id));
    el.classList.remove('no');
    if (shake.includes(id)) { void el.offsetWidth; el.classList.add('no'); }
  }
}

function tapOrder(id) {
  if (!run || run.answered) return;
  const ms = run.ms;
  const step = run.step;
  const expected = step.cards[ms.pos];
  if (expected.id === id) {
    ms.pos += 1;
    sfx('tap');
    paintOrder();
    if (ms.pos === step.cards.length) {
      const perPair = {};
      for (const c of step.cards) perPair[c.id] = !ms.wrongIds.has(c.id);
      const right = ms.wrongTaps <= 1;
      const gained = stepDone(right, { points: ms.wrongTaps === 0 ? 1 : ms.wrongTaps <= 1 ? 0.5 : 0, perPair });
      const l = step.ladder;
      showFeedback(right, gained, `<b>${esc(step.key)}</b> — ${esc(l.group.expand)}${ms.wrongTaps ? `<br><span class="muted">${ms.wrongTaps} wrong tap${ms.wrongTaps === 1 ? '' : 's'}.</span>` : ''}`);
      afterStep(right);
    }
  } else {
    ms.wrongTaps += 1;
    ms.wrongIds.add(expected.id);
    sfx('wrong');
    const el = $(`.opt[data-id="${CSS.escape(id)}"]`);
    if (el) { el.classList.remove('wrong'); void el.offsetWidth; el.classList.add('wrong'); setTimeout(() => el.classList.remove('wrong'), 400); }
  }
}
function paintOrder() {
  const ms = run.ms;
  const step = run.step;
  $$('.ladder-key .l').forEach((el, i) => {
    el.classList.toggle('got', i < ms.pos);
    el.classList.toggle('next', i === ms.pos);
    if (i < ms.pos) el.innerHTML = `${esc(step.cards[i].html.split(' ').slice(1).join(' '))}<small>${esc(step.cards[i].tile)}</small>`;
  });
  $$('.ladder-opts .opt').forEach((el) => {
    const done = step.cards.slice(0, ms.pos).some((c) => c.id === el.dataset.id);
    el.classList.toggle('right', done);
    el.disabled = done;
  });
}

function showFeedback(right, gained, explain) {
  const host = $('#feedback');
  if (!host) return;
  const mult = multiplier(run.combo);
  const comboTxt = right && mult > 1 ? ` 🔥×${mult}` : '';
  host.innerHTML = `
    <div class="feedback ${right ? 'ok' : 'bad'}">
      <div class="h"><span>${right ? pick(['✅ Correct!', '✅ Yes!', '✅ Nice!', '✅ Got it!']) : '❌ Not quite'}</span>${right ? `<span class="xp">+${gained} XP${comboTxt}</span>` : ''}</div>
      <div class="b">${explain || ''}</div>
    </div>
    ${run.cfg.autoNext || (run.hearts !== null && run.hearts <= 0) ? '' : '<button class="btn primary wide" data-act="next" style="margin-top:10px">Continue</button>'}`;
  const hb = $('#run-hud');
  if (hb) hb.innerHTML = runHud();
  const nb = $('[data-act="next"]');
  if (nb) nb.focus();
}

function runHud() {
  if (run.hearts !== null) return `<span class="hearts">${'❤️'.repeat(Math.max(0, run.hearts))}<span class="lost">${'❤️'.repeat(Math.max(0, (run.cfg.hearts || 0) - Math.max(0, run.hearts)))}</span></span>`;
  if (run.cfg.timer) return `<span class="timer ${run.timeLeft <= 10 ? 'low' : ''}" id="run-timer">${Math.ceil(run.timeLeft)}</span>`;
  if (run.cfg.stopwatch) return `<span class="timer" id="run-timer">${((Date.now() - run.t0) / 1000).toFixed(1)}</span>`;
  return run.combo >= 3 ? `<span class="combo big">🔥 ×${multiplier(run.combo)}</span>` : `<span class="combo">${run.combo ? `🔥 ${run.combo}` : ''}</span>`;
}

/* ---- Temple Dash: the run screen around the canvas ---- */

function renderDash() {
  const pct = run.total ? Math.round((run.i / run.total) * 100) : Math.min(100, run.right * 4);
  $('#app').innerHTML = `
    <div class="run-top">
      <button class="x" data-act="quit" aria-label="Quit">✕</button>
      <div class="prog" id="run-prog"><i style="--p:${pct}%"></i></div>
      <div id="run-hud">${runHud()}</div>
    </div>
    <section class="card dash">
      <div class="dash-q" id="dash-q"><div class="kind">${esc(run.cfg.title)}</div><div class="ask">Get ready…</div></div>
      <div class="dash-stage">
        <canvas id="dash-cv" aria-label="The corridor"></canvas>
        <div class="dash-combo" id="dash-combo"></div>
        <div class="dash-overlay" id="dash-overlay"></div>
      </div>
      <div class="dash-opts" id="dash-opts"></div>
      <div class="dash-hint">Swipe, tap a lane or a sign, or press 1 · 2 · 3. Be in the right lane when the gate arrives.</div>
    </section>`;
  window.scrollTo(0, 0);
  run.dash = new Dash($('#dash-cv'), {
    nextGate: dashNextGate,
    onPass: dashPass,
    onFinish: () => endRun('done'),
    onLane: paintLanes,
    sfx
  }, run.cfg.pace || (run.node && run.node.kind === 'boss' ? DASH_PACE.boss : DASH_PACE.lesson));
}

function dashNextGate() {
  let step = run.queue.shift() || null;
  for (let tries = 0; !step && run.next && tries < 6; tries++) step = run.next();
  if (!step) return null;
  run.step = step;
  run.answered = false;
  const q = $('#dash-q');
  if (q) {
    q.innerHTML = `
      <div class="kind">${esc(step.label)}${step.retry ? ' · again' : ''}</div>
      <div class="prompt ${step.promptClass || ''}">${step.prompt}</div>
      ${step.sub ? `<div class="sub">${step.sub}</div>` : ''}
      ${step.ref ? `<div class="ref">${esc(step.ref)}</div>` : ''}
      <div class="ask">${esc(step.ask || '')}</div>`;
  }
  const o = $('#dash-opts');
  if (o) {
    o.innerHTML = step.lanes.map((opt, i) => (opt
      ? `<button class="opt ${opt.cls || ''}" data-act="lane" data-lane="${i}"><span class="k">${i + 1}</span><span>${opt.html}</span></button>`
      : `<button class="opt wall" data-act="lane" data-lane="${i}" disabled><span class="k">${i + 1}</span><span>🧱 wall</span></button>`)).join('');
  }
  paintLanes(run.dash ? run.dash.lane : 1);
  return step;
}

function paintLanes(lane) {
  $$('#dash-opts .opt').forEach((el, i) => el.classList.toggle('on', i === lane));
}

function dashHud() {
  const hb = $('#run-hud');
  if (hb) hb.innerHTML = runHud();
  const pr = $('#run-prog i');
  if (pr) pr.style.setProperty('--p', `${run.total ? Math.round((run.i / run.total) * 100) : Math.min(100, run.right * 4)}%`);
  const cb = $('#dash-combo');
  if (cb) cb.innerHTML = run.combo >= 3 ? `🔥 ×${multiplier(run.combo)}` : run.combo ? `🔥 ${run.combo}` : '';
}

function dashPass(step, lane, right) {
  if (!run || run.dash === null) return;
  const gained = stepDone(right, { retry: step.retry, points: right ? 1 : 0 });
  $$('#dash-opts .opt').forEach((el, i) => {
    el.classList.toggle('right', i === step.answerLane);
    el.classList.toggle('wrong', !right && i === lane);
  });
  if (right) {
    sfx('gate');
    const mult = multiplier(run.combo);
    run.dash.floater(`+${gained} XP${mult > 1 ? ` 🔥×${mult}` : ''}`);
  } else {
    sfx('crash');
    // Answer to proceed: the gate comes back later in the run.
    step.retry = true;
    run.queue.push(step);
    const dead = run.hearts !== null && run.hearts <= 0;
    const ov = $('#dash-overlay');
    if (ov) {
      ov.innerHTML = `
        <div class="feedback bad">
          <div class="h"><span>💥 Crash!</span>${run.hearts !== null ? `<span class="hearts small">${'❤️'.repeat(Math.max(0, run.hearts))}</span>` : ''}</div>
          <div class="b">${step.explain || ''}</div>
          ${dead ? '' : '<button class="btn primary wide" data-act="dash-resume" style="margin-top:10px">Run on ▶</button>'}
        </div>`;
      ov.classList.add('show');
      const nb = $('[data-act="dash-resume"]');
      if (nb) nb.focus();
    }
    if (dead) setTimeout(() => endRun('dead'), 1100);
  }
  dashHud();
}

function dashResume() {
  if (!run || !run.dash || run.dash.over) return;
  if (run.hearts !== null && run.hearts <= 0) return;
  const ov = $('#dash-overlay');
  if (ov) { ov.classList.remove('show'); ov.innerHTML = ''; }
  run.dash.resume();
}

function dashPause() {
  if (!run || !run.dash || run.dash.over || run.dash.paused) return;
  run.dash.pause();
  const ov = $('#dash-overlay');
  if (ov) {
    ov.innerHTML = '<div class="feedback"><div class="h"><span>⏸ Paused</span></div><button class="btn primary wide" data-act="dash-resume" style="margin-top:10px">Run on ▶</button></div>';
    ov.classList.add('show');
  }
}

function renderRun() {
  if (run.cfg.dash) return; // the corridor draws itself
  const step = run.step;
  const pct = run.total ? Math.round((run.i / run.total) * 100) : run.cfg.timer ? Math.round((run.timeLeft / run.cfg.timer) * 100) : Math.min(100, run.right * 4);
  const comboLine = run.hearts !== null || run.cfg.timer ? (run.combo >= 3 ? `<div class="combo big" style="margin-bottom:6px">🔥 combo ×${multiplier(run.combo)}</div>` : '') : '';
  let body = '';
  if (step.kind === 'mc') {
    body = `
      <div class="kind">${esc(step.label)}</div>
      <div class="prompt ${step.promptClass || ''}">${step.prompt}</div>
      ${step.sub ? `<div class="sub">${step.sub}</div>` : ''}
      ${step.ref ? `<div class="ref">${esc(step.ref)}</div>` : ''}
      <div class="ask">${esc(step.ask || '')}</div>
      <div class="opts">${step.options.map((o, i) => `<button class="opt ${o.cls || ''}" data-act="opt" data-id="${esc(o.id)}"><span class="k">${i + 1}</span><span>${o.html}</span></button>`).join('')}</div>
      <div id="feedback"></div>`;
  } else if (step.kind === 'match') {
    const left = shuffle(step.pairs);
    const right = shuffle(step.pairs);
    body = `
      <div class="kind">${esc(step.label)}</div>
      <div class="ask">Tap a pair — match all ${step.pairs.length}</div>
      <div class="match">
        <div class="col">${left.map((p) => `<button class="tile ${p.l.cls || ''}" data-act="tile" data-side="l" data-id="${esc(p.id)}">${p.l.html}</button>`).join('')}</div>
        <div class="col">${right.map((p) => `<button class="tile ${p.r.cls || ''}" data-act="tile" data-side="r" data-id="${esc(p.id)}">${p.r.html}</button>`).join('')}</div>
      </div>
      <div id="feedback"></div>`;
  } else if (step.kind === 'order') {
    const letters = step.cards.map((c) => c.tile);
    body = `
      <div class="kind">${esc(step.label)}</div>
      <div class="prompt">${esc(step.title)}</div>
      ${step.hint ? `<div class="sub">${esc(step.hint)}</div>` : ''}
      <div class="ladder-key">${letters.map((l, i) => `<span class="l ${i === 0 ? 'next' : ''}">${esc(l)}</span>`).join('')}</div>
      <div class="ask">Tap the cards in the order the letters go</div>
      <div class="ladder-opts">${shuffle(step.cards).map((c) => `<button class="opt" data-act="ord" data-id="${esc(c.id)}"><span>${c.html}</span></button>`).join('')}</div>
      <div id="feedback"></div>`;
  }
  $('#app').innerHTML = `
    <div class="run-top">
      <button class="x" data-act="quit" aria-label="Quit">✕</button>
      <div class="prog" title="${run.total ? `${run.i} of ${run.total}` : ''}"><i style="--p:${pct}%"></i></div>
      <div id="run-hud">${runHud()}</div>
    </div>
    ${comboLine}
    <section class="card q">${body}</section>`;
  window.scrollTo(0, 0);
}

function endRun(reason) {
  if (!run || run.over) return;
  run.over = true;
  clearInterval(run.tick);
  if (run.dash) run.dash.destroy();
  const r = run;
  const node = r.node;
  const elapsed = Date.now() - r.t0;
  let stars = 0;
  let bonus = 0;
  let title = 'Done!';
  let big = '🎉';
  let crowned = false;
  if (node) {
    const finished = reason === 'done';
    const pctPts = r.total ? r.points / r.total : 0;
    if (node.kind === 'boss') {
      if (finished && r.hearts > 0) {
        stars = r.hearts;
        crowned = !S.crowns[node.chapter];
        S.crowns[node.chapter] = true;
        S.stats.bosses += 1;
        bonus = 100 + 20 * r.hearts;
        title = crowned ? 'Chapter crowned!' : 'Boss defeated again!';
        big = '👑';
      } else {
        title = reason === 'dead' ? 'The boss wins this time' : 'Retreat';
        big = reason === 'dead' ? '💔' : '🏳️';
      }
    } else if (finished) {
      stars = pctPts >= 0.999 ? 3 : pctPts >= 0.8 ? 2 : pctPts >= 0.6 ? 1 : 0;
      bonus = stars ? 20 + 10 * stars : 0;
      S.stats.lessons += 1;
      bumpQuest('lesson');
      if (stars === 3) { S.stats.perfects += 1; bumpQuest('perfect'); }
      title = stars === 3 ? 'Perfect lesson!' : stars ? 'Lesson complete!' : 'Almost — try it again';
      big = stars === 3 ? '🌟' : stars ? '⭐' : '💪';
    } else if (reason === 'dead') { title = 'Out of hearts — run it again'; big = '💔'; }
    else { title = 'Left early'; big = '🚪'; }
    const rec = S.nodes[node.id] || { stars: 0, best: 0, plays: 0 };
    rec.stars = Math.max(rec.stars, stars);
    rec.best = Math.max(rec.best || 0, Math.round(pctPts * 100));
    rec.plays = (rec.plays || 0) + 1;
    S.nodes[node.id] = rec;
  } else {
    const g = r.cfg.game;
    if (g === 'quick') { S.stats.bestQuick = Math.max(S.stats.bestQuick, r.right); title = 'Time’s up!'; big = '⏱️'; bonus = r.right >= 20 ? 30 : 0; }
    else if (g === 'rush') { S.stats.bestRush = Math.max(S.stats.bestRush, r.right); title = reason === 'dead' ? 'Out of hearts' : 'Rush over'; big = reason === 'dead' ? '💔' : '🛡️'; }
    else if (g === 'dash') {
      const best = r.right > (S.stats.bestDash || 0);
      S.stats.bestDash = Math.max(S.stats.bestDash || 0, r.right);
      title = reason === 'dead' ? (best ? 'New best run!' : 'The temple keeps the gold') : 'Run over';
      big = reason === 'dead' ? (best ? '🏆' : '💔') : '🏃';
      bonus = r.right >= 10 ? 10 + 2 * r.right : 0;
    }
    else if (g === 'match') {
      if (reason === 'done') { S.stats.matchBest = S.stats.matchBest ? Math.min(S.stats.matchBest, elapsed) : elapsed; title = 'All boards clear!'; big = '🧩'; bonus = 20; }
      else { title = 'Left early'; big = '🚪'; }
    } else if (reason === 'done') { title = 'Round complete!'; big = r.wrong === 0 ? '🌟' : '✅'; bonus = r.wrong === 0 && r.right >= 5 ? 25 : 10; }
    else { title = 'Left early'; big = '🚪'; }
    if (reason === 'quit') { title = 'Left early'; big = '🚪'; bonus = 0; }
  }
  if (bonus) { addXP(bonus); r.xp += bonus; }
  touchStreak();
  checkBadges();
  save();
  run = null;
  $('#tabbar').classList.remove('hidden');
  renderEnd({ r, node, stars, bonus, title, big, crowned, elapsed, reason });
  if (big === '👑' || stars === 3) { confetti(); sfx('win'); }
  else if (big === '💔') sfx('lose');
  setTimeout(() => { flushToasts(); maybeLevelUp(); }, 300);
}

function renderEnd({ r, node, stars, bonus, title, big, elapsed, reason }) {
  const acc = r.right + r.wrong ? Math.round((r.right / (r.right + r.wrong)) * 100) : 0;
  const missed = [...r.missed].map((id) => IX.byId.get(id)).filter(Boolean);
  const again = node ? `<button class="btn primary" data-act="node" data-id="${esc(node.id)}">${stars === 3 || big === '👑' ? 'Play again' : 'Try again'}</button>` : `<button class="btn primary" data-act="again">Play again</button>`;
  const backTo = node ? 'journey' : 'play';
  $('#app').innerHTML = `
    <section class="card end">
      <div class="big">${big}</div>
      <h2>${esc(title)}</h2>
      ${node && node.kind !== 'boss' ? `<div class="stars">${'★'.repeat(stars)}<span class="off">${'★'.repeat(3 - stars)}</span></div>` : ''}
      ${node && node.kind === 'boss' && big === '👑' ? `<p class="note">Chapter ${node.chapter} is yours. ${r.hearts === 3 ? 'Not a scratch.' : ''}</p>` : ''}
      <div class="grid">
        <div><b>+${r.xp}</b><small>XP${bonus ? ` (incl. ${bonus} bonus)` : ''}</small></div>
        <div><b>${r.right}</b><small>right</small></div>
        <div><b>${r.cfg.stopwatch && reason === 'done' ? `${(elapsed / 1000).toFixed(1)}s` : `${acc}%`}</b><small>${r.cfg.stopwatch && reason === 'done' ? 'time' : 'accuracy'}</small></div>
      </div>
      ${r.cfg.dash ? `<p class="note">${r.right} gate${r.right === 1 ? '' : 's'} passed · ${r.wrong} crash${r.wrong === 1 ? '' : 'es'}</p>` : ''}
      ${r.bestCombo >= 3 ? `<p class="note">Best combo: 🔥 ${r.bestCombo}</p>` : ''}
      ${missed.length ? `<h3>Worth another look</h3><div class="missed">${missed.map((it) => `<button class="chip ${isWord(it) ? 'gk' : ''}" data-act="item" data-id="${esc(it.id)}">${esc(isWord(it) ? it.icon : it.pic)} ${esc(isWord(it) ? lemma(it.g) : it.short)}</button>`).join('')}</div>` : ''}
      <div class="btn-row">
        <button class="btn" data-act="go" data-view="${backTo}">Back</button>
        ${again}
      </div>
    </section>`;
  window.scrollTo(0, 0);
}

function maybeLevelUp() {
  if (!pendingLevelUp) return;
  const L = pendingLevelUp;
  pendingLevelUp = null;
  const info = levelInfo(xpForLevel(L));
  const el = document.createElement('div');
  el.className = 'levelup';
  el.innerHTML = `<div class="box"><div class="big">${info.letter}</div><h2>Level ${L} · ${esc(info.name)}</h2><p class="note">${esc(info.rank)}</p><button class="btn gold wide" data-act="close-levelup">Onward</button></div>`;
  el.addEventListener('click', (e) => { if (e.target === el || e.target.dataset.act === 'close-levelup') { el.remove(); checkBadges(); flushToasts(); save(); if (!run) renderHudBits(); } });
  document.body.appendChild(el);
  confetti(2000);
  sfx('levelup');
}

function quitRun() {
  if (!run) return;
  endRun('quit');
}

/* ================================================================
 *  VIEWS
 * ================================================================ */

function starsHtml(n) {
  return `<span class="stars">${'★'.repeat(n)}<span class="off">${'★'.repeat(Math.max(0, 3 - n))}</span></span>`;
}

function defaultChapter() {
  if (S.settings.chapter && C.chapters.some((c) => c.n === S.settings.chapter)) return S.settings.chapter;
  const d = today();
  const upcoming = C.chapters.filter((c) => c.classDate && c.classDate >= d).sort((a, b) => a.classDate.localeCompare(b.classDate))[0];
  return (upcoming || C.chapters[C.chapters.length - 1]).n;
}

function hudCard() {
  const lv = levelInfo();
  const met = countMet();
  const gold = countMastered();
  return `
    <section class="card">
      <div class="hud">
        <div class="lvl" style="--p:${lv.pct}%"><span>${lv.letter}</span></div>
        <div class="grow">
          <div class="lvl-title">Level ${lv.L} · ${esc(lv.name)} <span class="muted small">${esc(lv.rank)}</span></div>
          <div class="xpbar"><i style="--p:${lv.pct}%"></i></div>
          <div class="small muted">${S.xp} XP${lv.L < 24 ? ` · ${lv.to - S.xp} to level ${lv.L + 1}` : ' · max level'}</div>
        </div>
        <div class="stats"><b>${met}/${C.words.length + C.cards.length}</b>met<b>${gold}</b>gold</div>
      </div>
    </section>`;
}

function questsCard() {
  const qs = dailyQuests();
  return `
    <section class="card">
      <div class="row between"><h2 style="margin:0">Today’s quests</h2><span class="chip gold">+${QUEST_XP} XP each</span></div>
      <div class="quests" style="margin-top:10px">
        ${qs.map((q) => `
          <div class="quest ${q.done ? 'done' : ''}">
            <div class="ic">${q.ic}</div>
            <div><div>${esc(q.text)}</div><div class="bar"><i style="--p:${Math.min(100, Math.round((q.n / q.goal) * 100))}%"></i></div></div>
            <div class="rw">${q.done ? '✓ done' : `${Math.min(q.n, q.goal)}/${q.goal}`}</div>
          </div>`).join('')}
      </div>
    </section>`;
}

function renderJourney() {
  const chN = defaultChapter();
  const ch = C.chapters.find((c) => c.n === chN);
  const nodes = nodesForChapter(ch);
  const d = today();
  const week = C.chapters.filter((c) => c.classDate && c.classDate >= d).sort((a, b) => a.classDate.localeCompare(b.classDate))[0];
  const sets = ch.conceptSets.map((id) => IX.setById.get(id)).filter(Boolean);
  const stops = S.settings.stops === 'quiz' ? 'quiz' : 'run';
  $('#app').innerHTML = `
    ${hudCard()}
    ${questsCard()}
    <section class="card">
      <div class="chap-tabs">
        ${C.chapters.map((c) => `<button class="chip ${c.n === chN ? 'on' : ''}" data-act="chapter" data-n="${c.n}">${S.crowns[c.n] ? '👑 ' : ''}Ch. ${c.n}${week && week.n === c.n ? ' · this week' : ''}</button>`).join('')}
      </div>
      <div class="chap-head" style="margin-top:12px">
        <div class="pl">${sets.map((s) => esc(s.place)).join('') || '📚'}</div>
        <div><strong>${esc(ch.vocabTitle || ch.title)}</strong><div class="s">${sets.map((s) => `${esc(s.placeName)}`).join(' · ')}${ch.classDate ? ` · class ${esc(ch.classDate)}` : ''}</div></div>
        ${S.crowns[ch.n] ? '<div class="crown" title="Boss beaten">👑</div>' : ''}
      </div>
      <div class="street">
        ${nodes.map((n, i) => {
          const st = nodeStatus(nodes, i);
          return `<button class="node ${n.kind} ${st.state}" style="--c:${esc(n.color)}" data-act="node" data-id="${esc(n.id)}" ${st.state === 'locked' ? 'disabled' : ''}>
            <div class="orb">${st.state === 'locked' ? '🔒' : esc(n.icon)}</div>
            <div><div class="t">${esc(n.title)}</div><div class="s">${esc(n.sub)}</div></div>
            <div>${n.kind === 'boss' ? (S.crowns[n.chapter] ? '<span class="crown">👑</span>' : '') : starsHtml(st.stars)}</div>
          </button>`;
        }).join('')}
      </div>
      <div class="row between wrap" style="margin-top:8px">
        <span class="small muted">Stops play as</span>
        <span class="chips">
          <button class="chip ${stops === 'run' ? 'on' : ''}" data-act="stops" data-v="run">🏃 Run</button>
          <button class="chip ${stops === 'quiz' ? 'on' : ''}" data-act="stops" data-v="quiz">📝 Quiz</button>
        </span>
      </div>
      <p class="note">${stops === 'run'
        ? 'Every gate in the corridor is a question — be in the right lane to run on, or crash and lose a heart. A crashed gate comes back until you pass it.'
        : 'Ten questions a stop, with match-up boards and ladders.'} Earn a star on a stop to open the next one. Beat the boss to crown the chapter. Everything else is free to play under <b>Play</b>.</p>
    </section>`;
}

function scopeFromSettings() {
  const chs = S.settings.scopeCh && S.settings.scopeCh.length ? S.settings.scopeCh : null;
  const kind = S.settings.scopeKind || 'both';
  return makeScope(chs, { words: kind !== 'concepts', concepts: kind !== 'words' });
}

function renderPlay() {
  const chs = S.settings.scopeCh || [];
  const kind = S.settings.scopeKind || 'both';
  const scope = scopeFromSettings();
  const can = (g) => (g.needs === 'words' ? scope.words.length >= 4 : g.needs === 'concepts' ? scope.cards.length >= 4 : scope.words.length + scope.cards.length >= 4)
    && !(g.id === 'ladder' && !scope.ladders.length) && !(g.id === 'duel' && !scope.confusions.length) && !(g.id === 'sleuth' && !scope.sentences.length);
  $('#app').innerHTML = `
    ${hudCard()}
    <section class="card">
      <h2>What to play with</h2>
      <div class="chips" style="margin-bottom:8px">
        <button class="chip ${!chs.length ? 'on' : ''}" data-act="scope-ch" data-n="all">All chapters</button>
        ${C.chapters.map((c) => `<button class="chip ${chs.includes(c.n) ? 'on' : ''}" data-act="scope-ch" data-n="${c.n}">Ch. ${c.n}</button>`).join('')}
      </div>
      <div class="chips">
        ${[['both', 'Words & concepts'], ['words', 'Words only'], ['concepts', 'Concepts only']].map(([id, label]) => `<button class="chip ${kind === id ? 'on' : ''}" data-act="scope-kind" data-kind="${id}">${label}</button>`).join('')}
      </div>
      <p class="note">${scope.words.length} words · ${scope.cards.length} concepts · ${scope.sentences.length} sentences · ${scope.ladders.length} ladders · ${scope.confusions.length} duels</p>
    </section>
    <section class="card">
      <h2>Games</h2>
      <div class="games">
        ${GAMES.map((g) => `
          <button class="game" data-act="game" data-id="${g.id}" ${can(g) ? '' : 'disabled'}>
            <div class="ic">${g.ic}</div>
            <b>${esc(g.name)}</b>
            <small>${esc(g.desc)}</small>
            ${g.best && g.best() ? `<div class="best">Best: ${g.fmt ? g.fmt(g.best()) : g.best()} ${g.bestLabel}</div>` : ''}
          </button>`).join('')}
      </div>
    </section>`;
}

function masteryClass(id) {
  return `m${Math.min(5, itemState(id).m)}`;
}

function renderCollection() {
  const f = S.settings.dex || { q: '', ch: null, kind: 'all', only: 'all' };
  const q = (f.q || '').trim().toLowerCase();
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ̓̔͂ͅ]/g, '').toLowerCase();
  const match = (it) => {
    if (f.ch && it.chapter !== f.ch) return false;
    const st = itemState(it.id);
    if (f.only === 'gold' && st.m < MASTERED_AT) return false;
    if (f.only === 'shaky' && !(st.seen > 0 && st.m < LEARNED_AT)) return false;
    if (f.only === 'unseen' && st.seen > 0) return false;
    if (!q) return true;
    const hay = isWord(it) ? `${it.g} ${it.gloss} ${it.mn}` : `${it.name} ${it.short} ${it.mnemonic} ${it.oneLine} ${it.set}`;
    return norm(hay).includes(norm(q));
  };
  const words = f.kind === 'concepts' ? [] : C.words.filter(match);
  const cards = f.kind === 'words' ? [] : C.cards.filter(match);
  const tile = (it) => `<button class="it ${isWord(it) ? 'gk' : ''} ${masteryClass(it.id)}" data-act="item" data-id="${esc(it.id)}">
      <div class="ic">${esc(isWord(it) ? it.icon : it.pic)}</div>
      <div class="n">${esc(isWord(it) ? lemma(it.g) : it.short)}</div>
      <div class="pip">${itemState(it.id).m >= MASTERED_AT ? '🥇' : itemState(it.id).seen ? `lv ${itemState(it.id).m}` : 'new'}</div>
    </button>`;
  const byChapter = (list) => C.chapters.map((ch) => ({ ch, items: list.filter((x) => x.chapter === ch.n) })).filter((g) => g.items.length);
  const groupHtml = (title, list) => (list.length ? `<h3>${esc(title)} · ${list.length}</h3><div class="dex">${list.map(tile).join('')}</div>` : '');
  $('#app').innerHTML = `
    <section class="card">
      <div class="row between"><h2 style="margin:0">Collection</h2><span class="chip gold">🥇 ${countMastered()} gold</span></div>
      <p class="note">${countMet('w')}/${C.words.length} words and ${countMet('c')}/${C.cards.length} concepts met. Tap anything to see its card.</p>
      <input class="dex-search" type="search" placeholder="Search Greek, English or a hook…" value="${esc(f.q || '')}" data-act="dex-q" />
      <div class="chips" style="margin-top:8px">
        <button class="chip ${!f.ch ? 'on' : ''}" data-act="dex-ch" data-n="all">All</button>
        ${C.chapters.map((c) => `<button class="chip ${f.ch === c.n ? 'on' : ''}" data-act="dex-ch" data-n="${c.n}">Ch. ${c.n}</button>`).join('')}
      </div>
      <div class="chips" style="margin-top:6px">
        ${[['all', 'Everything'], ['words', 'Words'], ['concepts', 'Concepts']].map(([id, l]) => `<button class="chip ${f.kind === id ? 'on' : ''}" data-act="dex-kind" data-kind="${id}">${l}</button>`).join('')}
        ${[['unseen', 'Not met'], ['shaky', 'Shaky'], ['gold', 'Gold']].map(([id, l]) => `<button class="chip ${f.only === id ? 'on' : ''}" data-act="dex-only" data-only="${id}">${l}</button>`).join('')}
      </div>
      <div class="legend"><span><i></i> not met</span><span><i style="border-color:#b87333"></i> bronze</span><span><i style="border-color:#b8c0d0"></i> silver</span><span><i style="border-color:var(--gold)"></i> gold</span></div>
    </section>
    <section class="card">
      ${byChapter(words).map((g) => groupHtml(`Chapter ${g.ch.n} words`, g.items)).join('')}
      ${byChapter(cards).map((g) => groupHtml(`Chapter ${g.ch.n} concepts`, g.items)).join('')}
      ${!words.length && !cards.length ? '<p class="note">Nothing matches.</p>' : ''}
    </section>`;
}

function renderMe() {
  const lv = levelInfo();
  const d = today();
  const days = Array.from({ length: 28 }, (_, i) => dayOffset(d, i - 27));
  const acc = S.stats.right + S.stats.wrong ? Math.round((S.stats.right / (S.stats.right + S.stats.wrong)) * 100) : 0;
  const src = C.sources || {};
  const when = C.fetchedAt ? new Date(C.fetchedAt).toLocaleString() : 'unknown';
  $('#app').innerHTML = `
    ${hudCard()}
    <section class="card">
      <h2>🔥 ${streakNow()}-day streak</h2>
      <p class="note">Best: ${S.streak.best} days. Play any round to keep it alive.</p>
      <div class="cal">${days.map((x) => `<div class="${S.days[x] ? 'on' : ''} ${x === d ? 'today' : ''}" title="${x}${S.days[x] ? ` · ${S.days[x].xp} XP` : ''}">${Number(x.slice(8))}</div>`).join('')}</div>
    </section>
    <section class="card">
      <h2>Badges · ${Object.keys(S.badges).length}/${BADGES.length}</h2>
      <div class="badges">${BADGES.map((b) => `<div class="badge ${S.badges[b.id] ? '' : 'locked'}"><div class="ic">${b.ic}</div><b>${esc(b.name)}</b><small>${esc(b.how)}</small></div>`).join('')}</div>
    </section>
    <section class="card">
      <h2>Numbers</h2>
      <div class="kv">
        <span>Level</span><b>${lv.L} · ${esc(lv.name)} (${esc(lv.rank)})</b>
        <span>XP</span><b>${S.xp}</b>
        <span>Answers</span><b>${S.stats.right} right · ${S.stats.wrong} wrong · ${acc}%</b>
        <span>Lessons finished</span><b>${S.stats.lessons}</b>
        <span>Bosses beaten</span><b>${S.stats.bosses}</b>
        <span>Chapters crowned</span><b>${Object.keys(S.crowns).length}/${C.chapters.length}</b>
        <span>Best combo</span><b>🔥 ${S.stats.bestCombo}</b>
        <span>Best Quick Fire</span><b>${S.stats.bestQuick} right</b>
        <span>Best Boss Rush</span><b>${S.stats.bestRush} survived</b>
        <span>Best Temple Dash</span><b>${S.stats.bestDash || 0} gates</b>
        <span>Words met / gold</span><b>${countMet('w')} / ${countMastered('w')}</b>
        <span>Concepts met / gold</span><b>${countMet('c')} / ${countMastered('c')}</b>
      </div>
    </section>
    <section class="card">
      <h2>Who is playing</h2>
      <div class="people-list">
        ${people.list.map((p) => `<div class="row between"><span>${p.id === people.active ? '▶ ' : ''}${esc(p.name)}</span><span class="row"><button class="btn sm" data-act="rename-person" data-id="${p.id}">Rename</button>${people.list.length > 1 ? `<button class="btn sm danger" data-act="remove-person" data-id="${p.id}">Remove</button>` : ''}</span></div>`).join('')}
      </div>
      <div class="row" style="margin-top:8px"><input class="txt" id="new-person" placeholder="Add someone" /><button class="btn sm" data-act="add-person">Add</button></div>
      <p class="note">Each person has their own XP, streak, stars and collection, on this device only.</p>
    </section>
    <section class="card">
      <h2>Settings</h2>
      <div class="toggle"><span>Sound effects</span><button class="btn sm" data-act="toggle-sound">${S.settings.sound ? 'On' : 'Off'}</button></div>
      <div class="toggle"><span>Start over (this person)</span><button class="btn sm danger" data-act="reset">Reset progress</button></div>
    </section>
    <section class="card">
      <h2>Content</h2>
      <p class="note">Everything here is pulled from the two source apps. Adding a chapter there adds it here.</p>
      <div class="kv">
        <span>📖 <a href="${esc(SOURCES.vocab.site)}" target="_blank" rel="noopener">Greek Vocab</a></span><b>${src.vocab ? `${src.vocab.words} words · ${src.vocab.sentences} sentences` : '—'}</b>
        <span>🧠 <a href="${esc(SOURCES.concepts.site)}" target="_blank" rel="noopener">Greek Cases</a></span><b>${src.concepts ? `${src.concepts.cards} concepts · ${src.concepts.sets} sets` : '—'}</b>
        <span>Last checked</span><b>${esc(when)}</b>
        <span>Content hash</span><b>${esc(C.hash || '')}</b>
      </div>
      <div class="btn-row"><button class="btn" data-act="refresh">Check the source apps now</button></div>
      <p class="note" style="margin-top:12px">Running <b>${esc(BUILD)}</b>. <button class="btn sm ghost" data-act="reload">Reload the app</button></p>
    </section>`;
}

/* ---- the item sheet ---- */

function formulaHtml(f) {
  if (!f) return '';
  if (f.ladder) return `<div class="formula"><ol>${f.ladder.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>${f.note ? `<p class="note">${esc(f.note)}</p>` : ''}</div>`;
  if (f.pattern) return `<div class="formula">${f.pattern.map((p, i) => `<div class="r"><span>${esc(p)}</span><span>${esc((f.filled || [])[i] || '')}</span></div>`).join('')}${f.note ? `<p class="note">${esc(f.note)}</p>` : ''}</div>`;
  return '';
}

function openItem(id) {
  const it = IX.byId.get(id);
  if (!it) return;
  const st = itemState(id);
  const mastery = `<div class="mastery">${Array.from({ length: MASTERY_MAX }, (_, i) => `<i class="${i < st.m ? 'on' : ''}"></i>`).join('')}</div>`;
  let body = '';
  if (isWord(it)) {
    const ss = IX.sentencesByWord.get(it.id) || [];
    body = `
      <div class="hd"><div class="ic">${esc(it.icon)}</div><div><h2 class="gk">${esc(it.g)}</h2><div class="s">${esc(it.gloss)}</div><div class="s">Chapter ${it.chapter} · ${esc(it.tier)}${it.freq ? ` · ${it.freq}× in the NT` : ''}</div></div></div>
      <h3>Mastery</h3>${mastery}<p class="note">${st.seen ? `Seen ${st.seen}× · ${st.right} right · ${st.wrong} wrong` : 'Not met yet'}</p>
      ${it.mn ? `<h3>Hook</h3><p>${esc(it.mn)}</p>` : ''}
      ${ss.length ? `<h3>In a sentence</h3>${ss.map((s) => `<div class="ex"><div class="gk">${esc(s.g)}</div><div class="n">${esc(s.e)}</div></div>`).join('')}` : ''}`;
  } else {
    const set = IX.setById.get(it.set);
    const partners = (IX.partners.get(it.id) || []).map((pid) => IX.byId.get(pid)).filter(Boolean);
    body = `
      <div class="hd"><div class="ic">${esc(it.pic)}</div><div><h2>${esc(it.name)}</h2><div class="s">${set ? `${esc(set.place)} ${esc(set.name)} · ${esc(set.placeName)}` : ''} · Chapter ${it.chapter}</div></div></div>
      <h3>Mastery</h3>${mastery}<p class="note">${st.seen ? `Seen ${st.seen}× · ${st.right} right · ${st.wrong} wrong` : 'Not met yet'}</p>
      ${it.eli5 ? `<h3>Like I’m five</h3><p>${esc(it.eli5)}</p>` : ''}
      ${it.formula ? `<h3>The pattern</h3>${formulaHtml(it.formula)}` : ''}
      ${it.oneLine ? `<p><b>${esc(it.oneLine)}</b></p>` : ''}
      ${it.mnemonic ? `<h3>Hook</h3><p><b>${esc(it.mnemonic)}</b></p>${it.mnemonicWhy ? `<p class="note">${esc(it.mnemonicWhy)}</p>` : ''}` : ''}
      ${it.spotIt ? `<h3>Spot it</h3><p>${esc(it.spotIt)}</p>` : ''}
      ${it.bookDef ? `<h3>What the book says</h3><p>${esc(it.bookDef)}</p>` : ''}
      ${it.watchOut ? `<h3>Watch out</h3><p>${esc(it.watchOut)}</p>` : ''}
      ${it.examples.length ? `<h3>Examples</h3>${it.examples.map((e) => `<div class="ex">${e.greek ? `<div class="gk">${mk(e.greek)}</div>` : ''}<div>${mk(e.english)}</div>${e.ref ? `<div class="n">${esc(e.ref)}${e.note ? ` — ${mk(e.note)}` : ''}</div>` : ''}</div>`).join('')}` : ''}
      ${partners.length ? `<h3>Easily confused with</h3><div class="chips">${partners.map((p) => `<button class="chip" data-act="item" data-id="${esc(p.id)}">${esc(p.pic)} ${esc(p.short)}</button>`).join('')}</div>` : ''}`;
  }
  closeSheet();
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.id = 'sheet';
  wrap.innerHTML = `<div class="sheet">${body}<div class="btn-row"><button class="btn wide" data-act="close-sheet">Close</button></div></div>`;
  wrap.addEventListener('click', (e) => { if (e.target === wrap) closeSheet(); });
  document.body.appendChild(wrap);
}
function closeSheet() {
  const el = $('#sheet');
  if (el) el.remove();
}

/* ---- routing & chrome ---- */

function renderHudBits() {
  $('#hud-streak').textContent = `🔥 ${streakNow()}`;
  const sel = $('#whoami');
  sel.innerHTML = people.list.map((p) => `<option value="${p.id}" ${p.id === people.active ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
}

function render() {
  if (run) return renderRun();
  dailyQuests();
  renderHudBits();
  $$('.tab').forEach((t) => t.classList.toggle('on', t.dataset.view === view));
  if (view === 'journey') renderJourney();
  else if (view === 'play') renderPlay();
  else if (view === 'collection') renderCollection();
  else renderMe();
  if (location.hash !== `#/${view}`) history.replaceState(null, '', `#/${view}`);
}

function go(v) {
  if (run) return;
  lastView = view;
  view = v;
  render();
  window.scrollTo(0, 0);
}

function startNode(id) {
  const ch = C.chapters.find((c) => nodesForChapter(c).some((n) => n.id === id));
  if (!ch) return;
  const nodes = nodesForChapter(ch);
  const i = nodes.findIndex((n) => n.id === id);
  const node = nodes[i];
  if (nodeStatus(nodes, i).state === 'locked') { toast('Earn a star on the stop before this one first'); return; }
  if (S.settings.stops !== 'quiz') {
    // The corridor: answer every gate to get through. Bosses on three hearts, stops on five.
    const steps = dashPlan(node);
    const cfg = node.kind === 'boss'
      ? { title: node.title, game: 'boss', hearts: 3, dash: true, steps: { list: steps } }
      : { title: node.title, game: 'lesson', hearts: 5, dash: true, steps: { list: steps } };
    return startRun(cfg, node);
  }
  const steps = planForNode(node);
  const cfg = node.kind === 'boss'
    ? { title: node.title, game: 'boss', hearts: 3, steps: { list: steps } }
    : { title: node.title, game: 'lesson', steps: { list: steps } };
  startRun(cfg, node);
}

let lastArcade = null;
function startGame(id) {
  const scope = scopeFromSettings();
  const cfg = arcadeRun(id, scope);
  if (!cfg) return;
  lastArcade = id;
  startRun(cfg);
}

function switchPerson(id) {
  if (!people.list.some((p) => p.id === id)) return;
  save();
  people.active = id;
  savePeople();
  S = loadState();
  render();
}

function onAction(el) {
  const a = el.dataset.act;
  const id = el.dataset.id;
  switch (a) {
    case 'go': return go(el.dataset.view);
    case 'chapter': S.settings.chapter = Number(el.dataset.n); save(); return render();
    case 'node': return startNode(id);
    case 'game': return startGame(id);
    case 'again': return lastArcade ? startGame(lastArcade) : go('play');
    case 'scope-ch': {
      const n = el.dataset.n;
      if (n === 'all') S.settings.scopeCh = [];
      else {
        const cur = new Set(S.settings.scopeCh || []);
        if (cur.has(Number(n))) cur.delete(Number(n)); else cur.add(Number(n));
        S.settings.scopeCh = [...cur].sort((x, y) => x - y);
      }
      save(); return render();
    }
    case 'scope-kind': S.settings.scopeKind = el.dataset.kind; save(); return render();
    case 'stops': S.settings.stops = el.dataset.v; save(); return render();
    case 'lane': return run && run.dash && run.dash.setLane(Number(el.dataset.lane));
    case 'dash-resume': return dashResume();
    case 'opt': return answerMC(id);
    case 'tile': return tapTile(el.dataset.side, id);
    case 'ord': return tapOrder(id);
    case 'next': return nextStep();
    case 'quit': return quitRun();
    case 'item': return openItem(id);
    case 'close-sheet': return closeSheet();
    case 'dex-ch': S.settings.dex = { ...(S.settings.dex || {}), ch: el.dataset.n === 'all' ? null : Number(el.dataset.n) }; save(); return render();
    case 'dex-kind': S.settings.dex = { ...(S.settings.dex || {}), kind: el.dataset.kind }; save(); return render();
    case 'dex-only': { const cur = (S.settings.dex || {}).only; S.settings.dex = { ...(S.settings.dex || {}), only: cur === el.dataset.only ? 'all' : el.dataset.only }; save(); return render(); }
    case 'toggle-sound': S.settings.sound = !S.settings.sound; save(); if (S.settings.sound) sfx('right'); return render();
    case 'reset':
      if (confirm(`Wipe all of ${activePerson().name}’s progress? XP, stars, streak and the collection go back to zero.`)) {
        const keep = S.settings;
        S = freshState();
        S.settings = keep;
        save();
        render();
      }
      return;
    case 'refresh': el.disabled = true; el.textContent = 'Checking…'; return refreshFromSources({ quiet: false }).then(() => render());
    case 'reload':
      return (async () => {
        try {
          const regs = await navigator.serviceWorker?.getRegistrations?.();
          for (const r of regs || []) await r.unregister();
          for (const k of await caches.keys()) await caches.delete(k);
        } catch { /* nothing to clear */ }
        location.reload();
      })();
    case 'add-person': {
      const input = $('#new-person');
      const name = (input.value || '').trim();
      if (!name) return input.focus();
      const pid = `p${Date.now().toString(36)}`;
      people.list.push({ id: pid, name });
      savePeople();
      switchPerson(pid);
      return;
    }
    case 'rename-person': {
      const p = people.list.find((x) => x.id === id);
      const name = prompt('Name', p.name);
      if (name && name.trim()) { p.name = name.trim(); savePeople(); render(); }
      return;
    }
    case 'remove-person': {
      const p = people.list.find((x) => x.id === id);
      if (!p || people.list.length < 2) return;
      if (!confirm(`Remove ${p.name} and all their progress?`)) return;
      people.list = people.list.filter((x) => x.id !== id);
      try { localStorage.removeItem(stateKey(id)); } catch { /* fine */ }
      if (people.active === id) people.active = people.list[0].id;
      savePeople();
      S = loadState();
      render();
      return;
    }
    default: return undefined;
  }
}

function wire() {
  $('#app').addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (el && !el.disabled) onAction(el);
  });
  document.body.addEventListener('click', (e) => {
    const el = e.target.closest('#sheet [data-act]');
    if (el) onAction(el);
  });
  $('#app').addEventListener('input', (e) => {
    if (e.target.dataset.act === 'dex-q') {
      S.settings.dex = { ...(S.settings.dex || {}), q: e.target.value };
      clearTimeout(wire.t);
      wire.t = setTimeout(() => { save(); const pos = e.target.selectionStart; render(); const inp = $('.dex-search'); if (inp) { inp.focus(); inp.setSelectionRange(pos, pos); } }, 250);
    }
  });
  $('#tabbar').addEventListener('click', (e) => {
    const t = e.target.closest('.tab');
    if (t) go(t.dataset.view);
  });
  $('#whoami').addEventListener('change', (e) => switchPerson(e.target.value));
  document.addEventListener('keydown', (e) => {
    if (run && run.dash) {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { e.preventDefault(); run.dash.move(-1); }
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { e.preventDefault(); run.dash.move(1); }
      else if (e.key >= '1' && e.key <= '3') run.dash.setLane(Number(e.key) - 1);
      else if ((e.key === 'Enter' || e.key === ' ') && $('[data-act="dash-resume"]')) { e.preventDefault(); dashResume(); }
      else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { if (run.dash.paused) dashResume(); else dashPause(); }
      return;
    }
    if (!run || run.answered) {
      if (run && run.answered && (e.key === 'Enter' || e.key === ' ') && $('[data-act="next"]')) { e.preventDefault(); nextStep(); }
      return;
    }
    const n = Number(e.key);
    if (n >= 1 && n <= 4 && run.step.kind === 'mc') {
      const opt = $$('.opt[data-act="opt"]')[n - 1];
      if (opt) answerMC(opt.dataset.id);
    }
  });
  window.addEventListener('hashchange', () => {
    const v = (location.hash.match(/^#\/(journey|play|collection|me)/) || [])[1];
    if (v && v !== view && !run) go(v);
  });
  window.addEventListener('online', () => refreshFromSources());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshFromSources();
    else dashPause();
  });
}

async function boot() {
  try {
    await loadContent();
  } catch (e) {
    $('#app').innerHTML = `<section class="card"><h2>Nothing to play yet</h2><p class="note">${esc(e.message)}</p></section>`;
    return;
  }
  const v = (location.hash.match(/^#\/(journey|play|collection|me)/) || [])[1];
  if (v) view = v;
  wire();
  render();
  refreshFromSources();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* not installable here; the game still runs */ });
  }
}

globalThis.__GQ = { get run() { return run; }, get S() { return S; }, get C() { return C; }, get IX() { return IX; } };
boot();
