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
