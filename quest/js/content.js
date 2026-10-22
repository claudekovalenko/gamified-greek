// Turns the shared content bundle (data/content.json, built by tools/sync.mjs from
// the vocab and concepts apps) into the game's data: regions, lessons, spells,
// sentence scrolls. Nothing is written by hand here — a chapter added to either
// source app becomes playable by adding its number to KG.CHAPTERS.
window.KG = window.KG || {};

// The chapters that are worlds in the game, in order.
KG.CHAPTERS = [6];

(function () {
  'use strict';
  const lemma = g => String(g || '').split(',')[0].trim();
  const glossShort = s => String(s || '').split(/[;(]/)[0].trim();
  const bare = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ς/g, 'σ').toLowerCase();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mark = s => esc(s).replace(/\*([^*]+)\*/g, '<mark>$1</mark>');
  // *target* words in a Greek example become «target» on canvases and in 2D
  KG.guillemet = s => String(s || '').replace(/\*([^*]+)\*/g, '«$1»').replace(/«\s*»/g, '');
  KG.plain = s => String(s || '').replace(/\*/g, '');
  KG.mark = mark;

  function chunk(a, size = 5) {
    const out = [];
    for (let i = 0; i < a.length; i += size) out.push(a.slice(i, i + size));
    if (out.length > 1 && out[out.length - 1].length < 3) out[out.length - 2].push(...out.pop());
    return out;
  }
  // n items into pieces of at most `max`, as even as possible: 6 → 3+3, 5 → 3+2, 4 → 2+2
  function even(a, max = 3) {
    const k = Math.ceil(a.length / max), out = [];
    for (let i = 0, at = 0; i < k; i++) { const n = Math.ceil((a.length - at) / (k - i)); out.push(a.slice(at, at + n)); at += n; }
    return out;
  }
  // two lists woven together evenly, keeping each list's order
  const weave = (a, b) => a.map((x, i) => [x, (i + 0.5) / a.length]).concat(b.map((x, i) => [x, (i + 0.5) / b.length + 1e-6])).sort((p, q) => p[1] - q[1]).map(p => p[0]);
  // English → 3–5 pieces for the "build the translation" games
  function chunksOf(en) {
    const words = en.split(/\s+/).filter(Boolean);
    const size = Math.max(2, Math.ceil(words.length / 4));
    const out = [];
    for (let i = 0; i < words.length; i += size) out.push(words.slice(i, i + size).join(' '));
    if (out.length > 1 && out[out.length - 1].split(' ').length < 2) out[out.length - 2] += ' ' + out.pop();
    return out;
  }

  KG.build = (C, chapters = KG.CHAPTERS) => {
    const byId = new Map();
    for (const w of C.words) byId.set(w.id, w);
    for (const c of C.cards) byId.set(c.id, c);
    const setById = new Map(C.sets.map(s => [s.id, s]));
    const quizzable = c => c.type !== 'rule';

    KG.source = C;
    KG.vocab = []; KG.units = []; KG.grammar = {}; KG.teach = {}; KG.readings = {};
    KG.story = { arrive: [], guardian: [] };
    KG.cards = C.cards.filter(c => chapters.includes(c.chapter) && quizzable(c));
    KG.cardById = Object.fromEntries(KG.cards.map(c => [c.id, c]));
    KG.confusions = C.confusions.filter(cf => cf.pair.every(id => KG.cardById[id]));
    KG.extraByCard = {};
    for (const x of C.extraQuiz) if (KG.cardById[x.answer]) (KG.extraByCard[x.answer] = KG.extraByCard[x.answer] || []).push(x);
    KG.partners = {};
    for (const cf of KG.confusions) { const [a, b] = cf.pair; (KG.partners[a] = KG.partners[a] || []).push(b); (KG.partners[b] = KG.partners[b] || []).push(a); }
    // Ladders: any group of three or more, in its hook's order
    KG.groupById = {};
    KG.setById = {};
    for (const set of C.sets) if (chapters.includes(set.chapter)) { KG.setById[set.id] = set; for (const g of set.groups) KG.groupById[g.id] = g; }
    KG.ladders = [];
    for (const set of C.sets) if (chapters.includes(set.chapter)) for (const g of set.groups) {
      const cards = KG.cards.filter(c => c.group === g.id);
      if (cards.length < 3) continue;
      const letters = g.key.replace(/[^A-Za-z]/g, ''), acrostic = letters === cards.map(c => c.tile).join('') && cards.every(c => c.tile.length === 1);
      KG.ladders.push({ id: `l:${g.id}`, set: set.id, chapter: set.chapter, group: g, cards, acrostic });
    }

    const seenG = new Set();
    let setNo = 0;
    for (const n of chapters) {
      const ch = C.chapters.find(x => x.n === n);
      if (!ch) continue;
      // ── words, in short packs of five ──
      const words = C.words.filter(w => w.chapter === n).map(w => {
        let g = lemma(w.g);
        if (seenG.has(g)) g = w.g; // two words, one headword: keep them apart
        seenG.add(g);
        return { id: w.id, g, lex: w.g, en: w.gloss, short: glossShort(w.gloss), f: w.freq, icon: w.icon || '📜', mn: w.mn || '', tier: w.tier, chapter: n, set: -1 };
      });
      const packs = chunk(words).map(ws => { const s = setNo++; ws.forEach(w => { w.set = s; }); return { set: s, words: ws }; });
      KG.vocab.push(...words);
      const packOf = Object.fromEntries(words.map(w => [w.id, w.set]));

      // ── sentence scrolls ──
      const sentences = C.sentences.filter(s => s.chapter === n && s.uses.length);
      sentences.forEach((s, k) => {
        const used = s.uses.map(id => KG.vocab.find(w => w.id === id)).filter(Boolean);
        const toks = s.g.split(/\s+/).filter(Boolean).map(t => {
          const m = t.match(/^(.*?)([,.;·:!?’]*)$/), w = m[1], b = bare(w);
          const hit = used.find(u => {
            const L = bare(u.g), need = Math.min(4, L.length - 2);
            let i = 0; while (i < L.length && L[i] === b[i]) i++;
            return i >= Math.max(3, need);
          });
          return { w, p: m[2], lemma: hit ? hit.g : '', gloss: hit ? hit.short : '', parse: hit ? hit.en : '' };
        });
        const others = sentences.filter(x => x !== s);
        const extras = others.length ? chunksOf(others[(k + 1) % others.length].e).slice(0, 2) : [];
        const id = `s${n}_${k}`;
        KG.readings[id] = {
          id, ref: `Scroll ${k + 1}`, words: toks, tr: s.e, chunks: chunksOf(s.e), extras,
          note: used.map(u => `${u.g} = ${u.short}`).join(' · '), uses: used.map(u => u.g),
          pack: Math.max(...s.uses.map(id => packOf[id] ?? 0)),
        };
      });

      // ── concept lessons: short ones, at most three uses each ──
      const sets = ch.conceptSets.map(id => setById.get(id)).filter(Boolean);
      const lessonsBySet = sets.map(set => {
        const buckets = [];
        for (const g of set.groups) {
          const cards = KG.cards.filter(c => c.group === g.id);
          const parts = even(cards);
          parts.forEach((cs, i) => {
            // a lone use joins the lesson before it rather than make a one-question lesson
            if (cs.length === 1 && buckets.length) { const b = buckets[buckets.length - 1]; b.cards.push(...cs); if (!b.groups.includes(g)) b.groups.push(g); b.done.push(g); return; }
            buckets.push({ groups: [g], cards: cs, part: i + 1, parts: parts.length, intro: i === 0 ? [g] : [], done: i === parts.length - 1 ? [g] : [] });
          });
        }
        const head = g => g.name.split(/\s+[—–-]\s+/)[0];
        return buckets.map((b, i) => {
          const key = `${set.id}_${i}`;
          const name = set.groups.length === 1 ? set.name : b.groups.map(head).join(' & ');
          const title = b.parts > 1 ? `${name} ${b.part}/${b.parts}` : name;
          const icon = b.groups[0].spot || set.place;
          KG.grammar[key] = { key, title, icon, set: set.id, chapter: n, cards: b.cards, groups: b.groups, ladderGroups: b.done, first: i === 0, notes: notesHTML(set, b, i === 0) };
          KG.teach[key] = {
            spell: { icon, name: title, desc: b.groups.map(g => g.mnemonic).join(' ') },
            beats: beatsFor(set, b, i === 0),
          };
          return key;
        });
      });

      // ── regions: one per concept set, then the quiz hall ──
      const R = sets.length;
      sets.forEach((set, r) => {
        const myPacks = packs.slice(Math.floor(r * packs.length / R), Math.floor((r + 1) * packs.length / R));
        const lessons = lessonsBySet[r], nodes = [];
        const P = myPacks.map(p => ({ id: `v${p.set}`, type: 'vocab', set: p.set }));
        const G = lessons.map(k => ({ id: `g_${k}`, type: 'grammar', lesson: k }));
        nodes.push(...weave(P, G));
        nodes.push({ id: `boss_${n}_${set.id}`, type: 'boss' });
        KG.units.push({
          id: `u${n}_${set.id}`, chapter: n, title: set.name, sub: set.subtitle || set.does, color: set.color,
          place: set.placeName, icon: set.place, hook: set.masterMnemonic, set: set.id, guard: `Keeper of ${set.placeName.replace(/^The /, 'the ')}`, nodes,
        });
        KG.story.arrive.push(`${set.scene} ${set.eli5}`);
        KG.story.guardian.push(`${set.masterMnemonic} ${set.masterMnemonicWhy || ''}`.trim());
      });
      // Scrolls: each goes in the first free spot after the pack that teaches its
      // last word, one per spot, so they spread out along the road.
      const regions = KG.units.filter(u => u.chapter === n), spots = [];
      regions.forEach(u => u.nodes.forEach(x => { if (x.type !== 'boss') spots.push({ u, after: x, taken: null }); }));
      const scrolls = Object.values(KG.readings).filter(rd => rd.id.startsWith(`s${n}_`)).sort((a, b) => a.pack - b.pack);
      for (const rd of scrolls) {
        const from = spots.findIndex(s => s.after.type === 'vocab' && s.after.set === rd.pack);
        const spot = spots.slice(Math.max(0, from)).find(s => !s.taken) || spots[spots.length - 1];
        spot.taken = rd;
        spot.u.nodes.splice(spot.u.nodes.indexOf(spot.after) + 1, 0, { id: `r_${rd.id}`, type: 'reading', reading: rd.id });
        spot.after = spot.u.nodes[spot.u.nodes.indexOf(spot.after) + 1];
      }
      let k = 0;
      for (const u of regions) for (const x of u.nodes) if (x.type === 'reading') KG.readings[x.reading].ref = `Scroll ${++k}`;
      // the quiz hall: the mix-ups, then the chapter exam
      const allDuels = KG.confusions.filter(cf => KG.cardById[cf.pair[0]].chapter === n);
      const hall = [];
      even(allDuels).forEach((duels, i, parts) => {
        const key = `mixups_${n}_${i}`, title = parts.length > 1 ? `The Mix-Ups ${i + 1}/${parts.length}` : 'The Mix-Ups';
        KG.grammar[key] = { key, title, icon: '⚔️', chapter: n, duels, cards: [...new Set(duels.flatMap(cf => cf.pair))].map(id => KG.cardById[id]), notes: duelNotes(duels) };
        KG.teach[key] = {
          spell: { icon: '⚔️', name: title, desc: duels.map(cf => cf.test).join(' · ') },
          beats: duels.map(cf => ({ say: `<b>${esc(cf.question)}</b><br>🔎 ${esc(cf.test)}<br><span class="muted">${esc(cf.answer)}</span>`, demo: cf.example.replace(/“([^”]+)”/g, '[$1]'), duel: cf })),
        };
        hall.push({ id: `g_${key}`, type: 'grammar', lesson: key });
      });
      hall.push({ id: `boss_${n}_final`, type: 'boss', final: true, title: `Chapter ${n} exam` });
      KG.units.push({ id: `u${n}_quiz`, chapter: n, title: `Chapter ${n} Quiz`, sub: 'The mix-ups, then everything in the chapter', color: '#c9a43a', place: 'The Quiz Hall', icon: '🏛️', guard: `The Examiner of Chapter ${n}`, nodes: hall, final: true });
      KG.story.arrive.push(`The Quiz Hall. Every word and every use from Chapter ${n} is on the walls. Learn to split the pairs that get mixed up, then face the Examiner: twenty questions from the whole chapter, three hearts.`);
      KG.story.guardian.push(`Chapter ${n} is yours. Walk into the quiz like you own it.`);
    }

    function notesHTML(set, b, first) {
      let h = first ? `<p class="tip">${esc(set.place)} <b>${esc(set.placeName)}</b> — ${esc(set.bigIdea)}</p>` : '';
      for (const g of b.groups) {
        h += `<h3>${esc(g.spot)} ${esc(g.name)}</h3><p><b>${esc(g.key)}</b> — ${esc(g.mnemonic)}</p>${g.expand ? `<p class="gk">${esc(g.expand)}</p>` : ''}<p class="muted">${esc(g.scene)}</p>`;
        for (const c of b.cards.filter(x => x.group === g.id)) {
          const e = c.examples[0];
          h += `<div class="ccard"><div class="cc-h"><span class="cc-pic">${esc(c.pic)}</span><b>${esc(c.name)}</b> <span class="muted">${esc(c.gist)}</span></div>
            <p>${esc(c.oneLine)}</p>${c.mnemonic ? `<p>🪝 <b>${esc(c.mnemonic)}</b>${c.mnemonicWhy ? ` <span class="muted">${esc(c.mnemonicWhy)}</span>` : ''}</p>` : ''}
            ${e ? `<p class="gk cc-ex">${mark(e.greek)}</p><p class="small"><i>${mark(e.english)}</i> <span class="muted">${esc(e.ref)}</span></p>` : ''}
            ${c.spotIt ? `<p class="small">🔍 ${esc(c.spotIt)}</p>` : ''}${c.watchOut ? `<p class="small">⚠️ ${esc(c.watchOut)}</p>` : ''}</div>`;
        }
      }
      return h;
    }
    function beatsFor(set, b, first) {
      const beats = [];
      for (const g of b.groups) {
        if (b.intro && !b.intro.includes(g)) {
          beats.push({ say: `${esc(g.spot)} <b>${esc(g.name)}</b>, continued — ${esc(g.mnemonic)}`, demo: g.expand || g.key });
        } else beats.push({ say: `${first && g === b.groups[0] ? `${esc(set.place)} <b>${esc(set.placeName)}</b>: ${esc(set.bigIdea)}<br>🪝 <b>${esc(set.masterMnemonic)}</b>${set.masterMnemonicWhy ? ` <span class="muted">${esc(set.masterMnemonicWhy)}</span>` : ''}<br>` : ''}${esc(g.spot)} <b>${esc(g.name)}</b> — ${esc(g.mnemonic)}`, demo: g.expand || g.key });
        for (const c of b.cards.filter(x => x.group === g.id)) {
          const e = c.examples.find(x => x.greek) || c.examples[0];
          beats.push({
            say: `${esc(c.pic)} <b>${esc(c.name)}</b> — ${esc(c.oneLine)}${c.mnemonic ? `<br>🪝 ${esc(c.mnemonic)}` : ''}${e && e.english ? `<br><span class="muted"><i>${mark(e.english)}</i> ${esc(e.ref)}</span>` : ''}`,
            demo: e ? String(e.greek || e.english).replace(/\*([^*]+)\*/g, '[$1]').replace(/\[\s*\]/g, '') : c.name,
            card: c.id,
          });
        }
      }
      return beats;
    }
    function duelNotes(duels) {
      return duels.map(cf => {
        const [a, b] = cf.pair.map(id => KG.cardById[id]);
        return `<div class="ccard"><div class="cc-h"><b>${esc(cf.question)}</b></div><p>${esc(a.pic)} ${esc(a.name)} ⚔️ ${esc(b.pic)} ${esc(b.name)}</p>
          <p>🔎 <b>${esc(cf.test)}</b></p><p>${esc(cf.answer)}</p><p class="small muted">${esc(cf.example)}</p></div>`;
      }).join('');
    }
    // word sparks: glowing words to pick up along the road
    KG.sparks = KG.vocab.map(w => ({ l: w.g, name: w.short, say: w.mn, icon: w.icon }));
    return KG;
  };

  KG.levelTitles = [
    [1, 'Newcomer'], [3, 'Listener'], [5, 'Reader'], [8, 'Parser'], [11, 'Spotter'],
    [15, 'Scholar'], [20, 'Exegete'], [25, 'Translator'], [30, 'Master of the Chapter'],
  ];
  KG.passages = [];
  KG.wardrobe = {
    robe: [
      { id: 'forest', name: 'Forest Robe', color: 0x2f6a3a, price: 0 },
      { id: 'royal', name: 'Royal Blue Robe', color: 0x2f4f9f, price: 60 },
      { id: 'crimson', name: 'Crimson Robe', color: 0x9f2f3a, price: 60 },
      { id: 'violet', name: 'Violet Robe', color: 0x5a2a8a, price: 80 },
      { id: 'night', name: 'Midnight Robe', color: 0x22263a, price: 100 },
      { id: 'snow', name: 'White Robe', color: 0xe8e8f0, price: 120 },
      { id: 'gold', name: 'Golden Robe', color: 0xc9a43a, price: 200 },
    ],
    hat: [
      { id: 'hood', name: 'Scribe\'s Hood', icon: '🧥', price: 0 },
      { id: 'none', name: 'Bare Head', icon: '🙂', price: 0 },
      { id: 'wizard', name: 'Wizard Hat', icon: '🧙', price: 120 },
      { id: 'laurel', name: 'Laurel Wreath', icon: '🌿', price: 90 },
      { id: 'crown', name: 'Scholar\'s Crown', icon: '👑', price: 250 },
    ],
    staff: [
      { id: 'none', name: 'No Staff', icon: '✋', price: 0 },
      { id: 'oak', name: 'Oak Staff', icon: '🪵', price: 60 },
      { id: 'crystal', name: 'Crystal Staff', icon: '🔷', price: 120 },
      { id: 'lightning', name: 'Lightning Staff', icon: '⚡', price: 200 },
    ],
    pet: [
      { id: 'none', name: 'No Companion', icon: '·', price: 0 },
      { id: 'owl', name: 'Owl of Wisdom', icon: '🦉', price: 150 },
      { id: 'dove', name: 'Dove', icon: '🕊', price: 150 },
      { id: 'lamb', name: 'Little Lamb', icon: '🐑', price: 180 },
    ],
  };

  // Achievement checks receive (state, helpers) and return true when earned.
  KG.achievements = [
    { id: 'first', icon: '🌱', name: 'First Steps', desc: 'Finish your first lesson', test: s => s.stats.lessons >= 1 },
    { id: 'spell1', icon: '✨', name: 'First Spell', desc: 'Learn your first concept spell', test: s => Object.keys(s.spells || {}).length >= 1 },
    { id: 'spells', icon: '📕', name: 'Full Spellbook', desc: 'Learn every spell in the chapter', test: s => Object.keys(KG.teach).every(k => (s.spells || {})[k]) },
    { id: 'perfect', icon: '💎', name: 'Flawless', desc: 'Finish a lesson with no mistakes', test: s => s.stats.perfect >= 1 },
    { id: 'perfect10', icon: '👑', name: 'Perfectionist', desc: '10 flawless lessons', test: s => s.stats.perfect >= 10 },
    { id: 'combo10', icon: '⚡', name: 'On Fire', desc: 'Reach a 10× combo', test: s => s.stats.bestCombo >= 10 },
    { id: 'combo25', icon: '🌋', name: 'Unstoppable', desc: 'Reach a 25× combo', test: s => s.stats.bestCombo >= 25 },
    { id: 'streak3', icon: '🔥', name: 'Kindled', desc: '3-day streak', test: s => s.bestStreak >= 3 },
    { id: 'streak7', icon: '🕯', name: 'Faithful Week', desc: '7-day streak', test: s => s.bestStreak >= 7 },
    { id: 'words', icon: '📜', name: 'Word Gatherer', desc: 'Study every word in the chapter', test: (s, h) => h.wordsStudied() >= KG.vocab.length },
    { id: 'master', icon: '🧠', name: 'Deep Roots', desc: 'Master half the chapter\'s words in review', test: (s, h) => h.wordsMastered() >= Math.ceil(KG.vocab.length / 2) },
    { id: 'spotter', icon: '🔍', name: 'Spotter', desc: 'Answer 50 concept questions right', test: s => (s.stats.concepts || 0) >= 50 },
    { id: 'scroll1', icon: '📜', name: 'First Scroll', desc: 'Restore a sentence scroll', test: s => s.stats.verses >= 1 },
    { id: 'scrolls', icon: '🏺', name: 'Keeper of Scrolls', desc: 'Restore every sentence scroll', test: s => s.stats.verses >= Object.keys(KG.readings).length },
    { id: 'boss1', icon: '⚔', name: 'Gate Breaker', desc: 'Defeat a guardian', test: s => s.stats.bosses >= 1 },
    { id: 'exam', icon: '🏆', name: 'Quiz Ready', desc: 'Pass the chapter exam', test: s => Object.keys(s.lessons).some(id => /_final$/.test(id) && s.lessons[id].stars >= 1) },
    { id: 'arcade', icon: '🎮', name: 'Arcade Ace', desc: 'Score 20+ in an arcade game', test: s => Object.values(s.arcade).some(v => v >= 20) },
    { id: 'review50', icon: '🔁', name: 'Spaced Out', desc: 'Answer 50 review cards', test: s => s.stats.reviews >= 50 },
    { id: 'level5', icon: '⭐', name: 'Reader', desc: 'Reach level 5', test: (s, h) => h.level() >= 5 },
    { id: 'level10', icon: '🌟', name: 'Rising Scholar', desc: 'Reach level 10', test: (s, h) => h.level() >= 10 },
    { id: 'sparks', icon: '✨', name: 'Spark Collector', desc: 'Pick up every glowing word in the world', test: s => ((s.world || {}).letters || []).length >= KG.sparks.length },
    { id: 'riddles', icon: '😈', name: 'Riddles in the Road', desc: 'Beat Skulch the Riddle-Creep and win your words back', test: s => (s.stats.villains || 0) >= 1 },
    { id: 'shades', icon: '👻', name: 'Shade Banisher', desc: 'Banish 25 Shades of Forgetting', test: s => ((s.world || {}).wisps || 0) >= 25 },
    { id: 'goal', icon: '🎯', name: 'Goal Getter', desc: 'Hit your daily goal', test: s => s.stats.goals >= 1 },
    { id: 'angler', icon: '🎣', name: 'Fisher of Words', desc: 'Catch 20 word-fish', test: s => (s.stats.fish || 0) >= 20 },
    { id: 'runereader', icon: '🪨', name: 'Rune Reader', desc: 'Spell 15 words in a Rune Circle', test: s => (s.stats.runes || 0) >= 15 },
    { id: 'courier', icon: '📦', name: 'Swift Courier', desc: 'Run 10 word errands', test: s => (s.stats.courier || 0) >= 10 },
  ];
})();
