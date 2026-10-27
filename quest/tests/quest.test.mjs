// Run: node --test quest/tests/
// Builds the game from data/content.json in a sandbox (no browser) and plays
// every lesson's plan many times, looking for broken questions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const quest = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const store = {};
const ctx = { console, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } } };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync(path.join(quest, 'js/content.js'), 'utf8'), ctx, { filename: 'content.js' });
ctx.KG.build(JSON.parse(readFileSync(path.join(quest, '../data/content.json'), 'utf8')));
vm.runInContext(readFileSync(path.join(quest, 'js/engine.js'), 'utf8'), ctx, { filename: 'engine.js' });
const { KG } = ctx, E = KG.engine;

function checkQuestion(q, where) {
  assert.ok(q && q.type, `${where}: question has a type`);
  if (q.type === 'mc') {
    assert.ok(q.options.length >= 2, `${where}: at least 2 options (${q.prompt})`);
    assert.equal(new Set(q.options).size, q.options.length, `${where}: duplicate options in "${q.prompt}" ${q.big || ''}: ${q.options}`);
    assert.ok(q.answer >= 0 && q.answer < q.options.length, `${where}: answer index valid (${q.prompt})`);
    for (const o of q.options) assert.ok(String(o).trim(), `${where}: empty option in ${q.prompt}`);
  } else if (q.type === 'match') {
    assert.ok(q.pairs.length >= 3, `${where}: match has pairs`);
    assert.equal(new Set(q.pairs.map(p => p[0])).size, q.pairs.length, `${where}: unique left side`);
    assert.equal(new Set(q.pairs.map(p => p[1])).size, q.pairs.length, `${where}: unique right side`);
  } else if (q.type === 'order') {
    assert.ok(q.chunks.length >= 2, `${where}: order has pieces`);
    assert.ok(q.reading ? KG.readings[q.reading] : q.verse, `${where}: order has something to show`);
  } else if (q.type === 'free') {
    assert.ok(KG.readings[q.reading], `${where}: reading exists`);
  } else if (q.type === 'mini') {
    assert.ok(q.fallback && q.fallback.length, `${where}: mini has a 2D fallback`);
    q.fallback.forEach(f => checkQuestion(f, where + ' fallback'));
    if (q.game === 'defense') for (const s of q.stones) assert.ok(s.cases.every(c => q.gates.includes(c)), `${where}: stone ${s.form} has a gate`);
    if (q.game === 'rain') assert.ok(q.targets.every(t => q.pool.includes(t.g)), `${where}: rain targets in pool`);
    if (q.game === 'flip') { assert.ok(q.pairs.length >= 3, `${where}: flip has pairs`); assert.equal(new Set(q.pairs.map(p => p.a)).size, q.pairs.length, `${where}: flip unique`); assert.equal(new Set(q.pairs.map(p => p.b)).size, q.pairs.length, `${where}: flip unique meanings`); }
    if (['run', 'toss', 'hop', 'herd'].includes(q.game)) { assert.ok(q.rounds.length >= 3, `${where}: ${q.game} has rounds`); for (const r of q.rounds) { assert.ok(r.options.length >= 2 && r.options.length === q.rounds[0].options.length, `${where}: ${q.game} options`); assert.equal(new Set(r.options).size, r.options.length, `${where}: unique options ${r.options}`); assert.ok(r.answer >= 0 && r.prompt, `${where}: round has its answer`); } }
    if (q.game === 'judge') { assert.ok(q.items.length >= 4, `${where}: judge has items`); assert.ok(q.items.every(i => typeof i.ok === 'boolean' && i.big && i.claim), `${where}: judge items well formed`); assert.ok(q.items.some(i => i.ok) && q.items.some(i => !i.ok), `${where}: judge has true and false`); }
  } else if (q.type === 'type') {
    assert.ok(q.answers.length && q.answers.every(a => a.trim()), `${where}: typed question has answers (${q.big})`);
    assert.ok(KG.engine.checkMeaning(q.display.replace(/\([^)]*\)/g, '').split(/[,;]/)[0], q), `${where}: its own first meaning is accepted (${q.display})`);
  } else if (q.type === 'spell') {
    const bank = [...q.tiles];
    for (const ch of q.target) { const i = bank.indexOf(ch); assert.ok(i >= 0, `${where}: tiles can spell ${q.target}`); bank.splice(i, 1); }
  } else if (q.type === 'teach') {
    assert.ok(q.say || q.words || q.reading, `${where}: teach has content`);
  }
}

test('chapter 6 is built from the shared content', () => {
  assert.ok(KG.vocab.length >= 50, 'words');
  assert.ok(KG.cards.length >= 40, 'cards');
  assert.ok(KG.units.length >= 2, 'regions');
  assert.ok(KG.units.every(u => u.nodes[u.nodes.length - 1].type === 'boss'), 'every region ends with a guardian');
  const ids = E.nodes.map(n => n.id);
  assert.equal(new Set(ids).size, ids.length, 'node ids unique');
  assert.equal(new Set(KG.vocab.map(w => w.g)).size, KG.vocab.length, 'headwords unique');
  for (const c of KG.cards) assert.ok(Object.values(KG.grammar).some(L => L.cards.includes(c)), `card ${c.id} is taught`);
  for (const k of Object.keys(KG.readings)) assert.ok(E.nodes.some(n => n.reading === k), `scroll ${k} is on the path`);
  console.log(KG.units.map(u => `${u.place}: ${u.nodes.map(n => n.title).join(' → ')}`).join('\n'));
});

test('every lesson plan generates sound questions (100 runs each)', () => {
  for (const n of E.nodes) for (let i = 0; i < 100; i++) {
    const plan = E.planFor(n);
    assert.ok(plan.length >= 5, `${n.id}: plan has questions`);
    plan.forEach((q, k) => checkQuestion(q, `${n.id}#${k}`));
  }
});

test('replays and arcade pools work', () => {
  for (const n of E.nodes) E.state.lessons[n.id] = { stars: 1, best: 1, plays: 1 };
  for (const n of E.nodes) for (let i = 0; i < 30; i++) E.planFor(n).forEach((q, k) => checkQuestion(q, `replay ${n.id}#${k}`));
  for (let i = 0; i < 200; i++) {
    const c = KG.util.pick(E.unlockedCards());
    checkQuestion(E.spotQ(c, KG.cards), 'spot rush');
    checkQuestion(E.hookQ(c, KG.cards), 'hook');
  }
});

test('spacing: a missed word is due again today, then relearned; uses get their own schedule', () => {
  E.reset();
  const g = KG.vocab[0].g, today = KG.util.day();
  E.srsAnswer(g, true);
  E.srsAnswer(g, false);
  assert.equal(E.state.vocab[g].due, today, 'missed: due again today');
  E.srsAnswer(g, true);
  assert.equal(E.state.vocab[g].box, 1, 'relearning does not promote');
  assert.equal(E.state.vocab[g].due, KG.util.addDays(today, 1));
  const c = KG.cards[0];
  E.cardAnswer(c.id, true);
  assert.equal(E.state.cards[c.id].due, KG.util.addDays(today, 1), 'a new use comes back tomorrow');
  E.state.cards[c.id].due = today;
  assert.ok(E.dueCards().some(x => x.id === c.id));
  E.cardAnswer(c.id, true);
  assert.equal(E.state.cards[c.id].box, 2);
  assert.ok(!E.dueCards().some(x => x.id === c.id));
  for (const card of KG.cards) checkQuestion(E.conceptQ(card), `review ${card.id}`);
});

test('typed meanings: right ones pass, other words fail', () => {
  let wrongPass = 0;
  for (const w of KG.vocab) {
    const q = E.typeQ(w);
    for (const sense of w.en.replace(/\([^)]*\)/g, '').split(/[,;]/)) if (sense.trim()) assert.ok(E.checkMeaning(sense, q), `"${sense}" for ${w.g} (${w.en})`);
    assert.ok(!E.checkMeaning('', q) && !E.checkMeaning('xyz', q));
    const other = KG.vocab.find(x => x !== w && x.short.toLowerCase() !== w.short.toLowerCase());
    if (E.checkMeaning(other.short, q)) wrongPass++;
  }
  assert.ok(wrongPass <= 2, `${wrongPass} words accept another word's meaning`);
});
