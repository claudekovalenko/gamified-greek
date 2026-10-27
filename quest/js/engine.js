// Core engine: saved state, XP/levels, streaks, spaced repetition and the
// question generators for every kind of lesson. No DOM code lives here.
window.KG = window.KG || {};

(function () {
  'use strict';

  // ── utilities ───────────────────────────────────────────────
  const U = KG.util = {
    shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    sample(a, n) { return U.shuffle(a).slice(0, n); },
    pick(a) { return a[Math.floor(Math.random() * a.length)]; },
    uniq(a) { return [...new Set(a)]; },
    esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
    day(d = new Date()) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
    addDays(s, n) { const [y, m, d] = s.split('-').map(Number); return U.day(new Date(y, m - 1, d + n)); },
    diffDays(a, b) {
      const p = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
      return Math.round((p(b) - p(a)) / 86400000);
    },
    // strip accents/breathings for lenient matching and for speech
    bare(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ς/g, 'σ').toLowerCase(); },
  };
  const { shuffle, sample, uniq } = U;
  const gk = s => `<span class="gk">${U.esc(s)}</span>`;

  // ── state ───────────────────────────────────────────────────
  const STORE = 'going-deeper-quest-v1';
  function defaults() {
    return {
      v: 1, xp: 0, coins: 25, streak: 0, bestStreak: 0, lastDay: null, freezes: 0, boost: 0, dailyGoal: 50,
      history: {}, lessons: {}, vocab: {}, ach: {}, arcade: {}, mistakes: [],
      stats: { answered: 0, correct: 0, perfect: 0, bosses: 0, verses: 0, bestCombo: 0, lessons: 0, reviews: 0, goals: 0, concepts: 0 },
      cards: {},
      settings: { sound: true, speech: true, unlockAll: false },
    };
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const d = defaults(), s = JSON.parse(raw);
        return Object.assign(d, s, { stats: Object.assign(d.stats, s.stats), settings: Object.assign(d.settings, s.settings) });
      }
    } catch (e) { /* storage unavailable: start fresh */ }
    return defaults();
  }
  const E = KG.engine = { state: load(), listeners: [] };
  // XP, coins, streak and words are yours across chapters; each chapter keeps its own world (where you stand, what you found, who lurks there)
  {
    const S = E.state, ch = KG.CHAPTERS[0], was = S.ch ?? 6;
    if (was !== ch) {
      S.byCh = S.byCh || {};
      S.byCh[was] = { world: S.world, villains: S.villains };
      const d = S.byCh[ch] || {};
      S.world = d.world; S.villains = d.villains;
      if (!S.world) delete S.world; if (!S.villains) delete S.villains;
      S.ch = ch;
    }
  }
  E.save = () => { try { localStorage.setItem(STORE, JSON.stringify(E.state)); } catch (e) { /* ignore */ } };
  E.reset = () => { E.state = defaults(); E.save(); };
  E.importState = json => { const d = defaults(), s = JSON.parse(json); if (typeof s.xp !== 'number') throw new Error('Not a Going Deeper Quest backup'); E.state = Object.assign(d, s); E.save(); };
  E.on = fn => E.listeners.push(fn);
  const emit = (type, data) => E.listeners.forEach(fn => fn(type, data));

  // ── curriculum index ────────────────────────────────────────
  E.nodes = [];
  KG.units.forEach((u, ui) => u.nodes.forEach(n => {
    n.unit = ui;
    if (!n.title) {
      if (n.type === 'vocab') { const ws = KG.vocab.filter(w => w.set === n.set), first = KG.vocab.findIndex(w => w.set === n.set) - KG.vocab.findIndex(w => w.chapter === ws[0].chapter); n.title = `Words ${first + 1}–${first + ws.length}`; }
      else if (n.type === 'grammar') n.title = KG.grammar[n.lesson].title;
      else if (n.type === 'reading') n.title = KG.readings[n.reading].ref;
      else if (n.type === 'boss') n.title = `Boss: ${u.title}`;
    }
    n.index = E.nodes.length;
    E.nodes.push(n);
  }));
  E.node = id => E.nodes.find(n => n.id === id);
  E.stars = id => (E.state.lessons[id] || {}).stars || 0;
  E.unlocked = n => E.state.settings.unlockAll || n.index === 0 || E.stars(E.nodes[n.index - 1].id) > 0;
  E.unitDone = uid => KG.units.find(u => u.id === uid).nodes.every(n => E.stars(n.id) > 0);
  E.nextNode = () => E.nodes.find(n => E.unlocked(n) && !E.stars(n.id)) || null;

  // ── levels ──────────────────────────────────────────────────
  E.xpFor = L => 40 * (L - 1) * L;
  E.levelInfo = (xp = E.state.xp) => {
    let L = 1; while (xp >= E.xpFor(L + 1)) L++;
    const title = KG.levelTitles.filter(t => t[0] <= L).pop()[1];
    return { level: L, title, cur: xp - E.xpFor(L), need: E.xpFor(L + 1) - E.xpFor(L) };
  };

  // ── streaks & XP ────────────────────────────────────────────
  E.checkStreak = () => {
    const S = E.state, t = U.day();
    if (!S.lastDay) return null;
    const gap = U.diffDays(S.lastDay, t);
    if (gap <= 1) return null;
    const missed = gap - 1;
    let msg;
    if (S.streak > 0 && S.freezes >= missed) {
      S.freezes -= missed; S.lastDay = U.addDays(t, -1);
      msg = `🧊 Streak freeze used. Your ${S.streak}-day streak is safe!`;
    } else if (S.streak > 0) {
      msg = `Your ${S.streak}-day streak ended. Start a new one today!`;
      S.streak = 0;
    }
    E.save();
    return msg;
  };
  E.todayXP = () => E.state.history[U.day()] || 0;

  E.gainXP = (n, coins = 0) => {
    const S = E.state, t = U.day();
    if (S.lastDay !== t) {
      S.streak = S.lastDay && U.diffDays(S.lastDay, t) === 1 ? S.streak + 1 : 1;
      S.lastDay = t;
      S.bestStreak = Math.max(S.bestStreak, S.streak);
      emit('streak', S.streak);
    }
    const lvBefore = E.levelInfo().level, goalBefore = E.todayXP() >= S.dailyGoal;
    S.xp += n; S.coins += coins;
    S.history[t] = (S.history[t] || 0) + n;
    if (!goalBefore && E.todayXP() >= S.dailyGoal) { S.coins += 10; S.stats.goals++; emit('goal'); }
    const lv = E.levelInfo();
    if (lv.level > lvBefore) { S.coins += 20; emit('level', lv); }
    E.save();
    E.checkAchievements();
  };

  // ── achievements ────────────────────────────────────────────
  const helpers = {
    unitDone: E.unitDone, level: () => E.levelInfo().level,
    wordsStudied: () => Object.keys(E.state.vocab).length,
    wordsMastered: () => Object.values(E.state.vocab).filter(v => v.box >= 4).length,
  };
  E.helpers = helpers;
  E.checkAchievements = () => {
    for (const a of KG.achievements) {
      if (!E.state.ach[a.id] && a.test(E.state, helpers)) {
        E.state.ach[a.id] = U.day(); E.state.coins += 15; E.save();
        emit('achievement', a);
      }
    }
  };

  // ── spaced repetition (Leitner boxes) ───────────────────────
  // Box 1 → review tomorrow; each correct review moves the card up one box and
  // roughly doubles the gap. A miss sends it back to box 1 and makes it due again
  // today (the shades and side quests bring it back while it's fresh); getting it
  // right after that only counts as relearned, so it returns tomorrow.
  const INTERVALS = [0, 1, 2, 4, 8, 16, 35, 75];
  E.vocabByGreek = Object.fromEntries(KG.vocab.map(w => [w.g, w]));
  // Words added from the Reading Room live in state.custom and join the same deck.
  E.word = g => E.vocabByGreek[g] || ((E.state.custom || {})[g] && Object.assign({ g, lex: g }, E.state.custom[g]));
  E.addWord = (g, en, f) => {
    if (E.vocabByGreek[g]) { if (!E.state.vocab[g]) E.srsAnswer(g, true); E.save(); return; }
    (E.state.custom || (E.state.custom = {}))[g] = { en, f, set: -1 };
    if (!E.state.vocab[g]) E.srsAnswer(g, true);
    E.save();
  };
  E.srsAnswer = (g, correct) => {
    const V = E.state.vocab, t = U.day();
    let r = V[g];
    if (!r) { V[g] = { box: 1, due: U.addDays(t, 1), seen: 1, miss: correct ? 0 : 1 }; return; }
    r.seen++;
    if (!correct) { r.box = 1; r.due = t; r.lapse = 1; r.miss++; return; }
    if (r.lapse) { r.lapse = 0; r.due = U.addDays(t, 1); return; }
    if (r.due <= t) { r.box = Math.min(INTERVALS.length - 1, r.box + 1); r.due = U.addDays(t, INTERVALS[r.box]); }
  };
  // review order: due words first (lowest box, most missed), then the rest by how soon they fall due
  E.reviewOrder = words => {
    const t = U.day(), V = E.state.vocab;
    const key = w => { const r = V[w.g]; if (!r) return 50; return (r.due <= t ? 0 : 20 + U.diffDays(t, r.due)) + r.box - Math.min(3, r.miss) * 0.5 + Math.random() * 2; };
    return words.slice().sort((a, b) => key(a) - key(b));
  };
  E.dueWords = () => {
    const t = U.day();
    return Object.entries(E.state.vocab).filter(([, r]) => r.due <= t).map(([g]) => E.word(g)).filter(Boolean);
  };
  E.weakWords = (n = 12) => Object.entries(E.state.vocab)
    .sort((a, b) => (a[1].box - b[1].box) || (b[1].miss - a[1].miss))
    .slice(0, n).map(([g]) => E.word(g)).filter(Boolean);
  E.masteredWords = () => Object.values(E.state.vocab).filter(r => r.box >= 4).length;
  // concept tracking: right/wrong per card, for the weakest-concepts drill, and the same
  // Leitner schedule as the words, so a use you've met comes back just before you'd forget it
  E.cardAnswer = (cid, correct) => {
    const C = E.state.cards || (E.state.cards = {}), t = U.day(), r = C[cid] || (C[cid] = { right: 0, wrong: 0, last: 0 });
    if (correct) r.right++; else r.wrong++;
    r.last = correct ? 1 : 0;
    if (!r.box) { r.box = 1; r.due = U.addDays(t, 1); return; }
    if (!correct) { r.box = 1; r.due = U.addDays(t, 1); return; }
    if (r.due <= t) { r.box = Math.min(INTERVALS.length - 1, r.box + 1); r.due = U.addDays(t, INTERVALS[r.box]); }
  };
  E.dueCards = () => { const t = U.day(), C = E.state.cards || {}; return KG.cards.filter(c => C[c.id] && C[c.id].box && C[c.id].due <= t).sort((a, b) => C[a.id].box - C[b.id].box); };
  E.weakCards = (n = 10) => KG.cards.filter(c => (E.state.cards || {})[c.id])
    .map(c => ({ c, r: E.state.cards[c.id] }))
    .sort((a, b) => (a.r.last - b.r.last) || ((b.r.wrong - b.r.right) - (a.r.wrong - a.r.right)))
    .slice(0, n).map(x => x.c);

  // ── daily quests: three fresh goals each day ────────────────
  const QUESTS = [
    { id: 'correct', text: 'Answer {n} questions correctly', n: [20, 30, 40] },
    { id: 'lessons', text: 'Finish {n} lessons', n: [1, 2, 3] },
    { id: 'reviews', text: 'Review {n} words', n: [10, 15, 20] },
    { id: 'shades', text: 'Banish {n} Shades of Forgetting', n: [2, 3, 5] },
    { id: 'concepts', text: 'Spot {n} concepts correctly', n: [8, 12, 16] },
    { id: 'combo', text: 'Reach a {n}× combo', n: [5, 8, 10] },
    { id: 'coins', text: 'Collect {n} coins in the world', n: [5, 8, 12] },
    { id: 'perfect', text: 'Finish a lesson without a mistake', n: [1, 1, 1] },
    { id: 'runes', text: 'Spell {n} words in a Rune Circle', n: [2, 3, 5] },
    { id: 'courier', text: 'Run {n} word errands for the villagers', n: [2, 3, 5] },
  ];
  E.daily = () => {
    const S = E.state, t = U.day();
    if (!S.daily || S.daily.day !== t) {
      const lv = Math.min(2, Math.floor(E.levelInfo().level / 5));
      S.daily = { day: t, quests: sample(QUESTS, 3).map(q => ({ id: q.id, goal: q.n[lv], prog: 0, text: q.text.replace('{n}', q.n[lv]), done: false })) };
      E.save();
    }
    return S.daily;
  };
  E.questProgress = (id, amount = 1, absolute = false) => {
    const d = E.daily();
    for (const q of d.quests) {
      if (q.id !== id || q.done) continue;
      q.prog = absolute ? Math.max(q.prog, amount) : q.prog + amount;
      if (q.prog >= q.goal) {
        q.done = true; q.prog = q.goal;
        E.state.coins += 15; E.state.stats.quests = (E.state.stats.quests || 0) + 1;
        emit('quest', q);
        E.gainXP(25);
      }
    }
    E.save();
  };

  // ── mistakes notebook ───────────────────────────────────────
  E.logMistake = q => {
    if (q.type !== 'mc' || q.noLog) return;
    const M = E.state.mistakes, key = q.prompt + '|' + (q.big || '');
    if (M.some(m => m.key === key)) return;
    M.unshift({ key, prompt: q.prompt, big: q.big || '', options: q.options, answer: q.answer, greekOpts: !!q.greekOpts, explain: q.explain || '', speak: q.speak || '', vkey: q.vkey || '' });
    if (M.length > 40) M.pop();
  };
  E.clearMistake = q => { E.state.mistakes = E.state.mistakes.filter(m => m.key !== q.prompt + '|' + (q.big || '')); };

  // ── question builders ───────────────────────────────────────
  // mc(prompt, correct, wrongs, extra) → shuffled multiple choice with exactly one right answer
  function mc(prompt, correct, wrongs, extra = {}) {
    const options = shuffle(uniq([correct, ...wrongs.filter(w => w !== correct)]).slice(0, extra.n || 4));
    if (!options.includes(correct)) options[0] = correct;
    const opts = shuffle(options);
    // nor may the 🔊 button: when you're asked to pick the Greek, or to read a word aloud, the voice waits until you've answered
    if (extra.speak && (extra.greekOpts || /How do you read/.test(prompt))) extra = Object.assign({}, extra, { speakAfter: extra.speak, speak: '' });
    // a hint must not simply say the answer: any option spelled out in it is blanked
    if (extra.hint) { const plain = t => String(t).replace(/<[^>]+>/g, '').replace(/[«»“”"]/g, '').trim(); let h = String(extra.hint); for (const o of opts) { const t = plain(o); if (t.length > 1 && h.includes(t)) h = h.split(t).join('…'); } extra = Object.assign({}, extra, { hint: h }); }
    // and a question that asks for a Greek word must not quote that word in its own wording (some hooks do)
    if (extra.greekOpts) for (const o of opts) { const t = String(o).replace(/<[^>]+>/g, '').replace(/[«»]/g, '').trim(); if (t.length > 1 && prompt.includes(t)) prompt = prompt.split(t).join('…'); }
    return Object.assign({ type: 'mc', prompt, options: opts, answer: opts.indexOf(correct) }, extra);
  }
  const others = (correct, pool, n = 3) => sample(uniq(pool).filter(x => x !== correct), n);
  E.mc = mc;
  const esc = U.esc;

  // Words
  E.vocabSet = i => KG.vocab.filter(w => w.set === i);
  const chapterWords = w => KG.vocab.filter(x => x.chapter === w.chapter);
  const sentence = R => R.words.map(w => w.w + w.p).join(' ');
  E.sentence = sentence;
  // a hint that doesn't give the meaning away: just the sound-alike, e.g. ≈ "a-LEAF-o."
  const soundOf = mn => { const m = String(mn || '').match(/^.*?≈\s*"[^"]*"(\s*\([^)]*\))?/); return m ? m[0] : ''; };
  E.soundOf = soundOf;
  const wordExplain = w => `${esc(w.icon)} ${gk(w.lex)}: <b>${esc(w.en)}</b>${w.mn ? `<br><span class="muted">🪝 ${esc(w.mn)}</span>` : ''}`;
  E.vocabQ = (w, pool, dir) => vocabQ(w, pool, dir);
  // wrong options of the same kind (verbs against verbs, the rest against the rest) are harder to rule out
  const kindOf = w => (/^(I|it) /.test(w.en) ? 'v' : 'n');
  const sameKind = (w, pool) => { const k = pool.filter(x => kindOf(x) === kindOf(w)); return k.length >= 6 ? k : pool; };
  function vocabQ(w, pool, dir) {
    if (dir === 'type') return typeQ(w);
    if (dir === 'spell') return spellQ(w);
    pool = sameKind(w, pool);
    const explain = wordExplain(w), base = { vkey: w.g, speak: w.g, explain, hint: dir === 'hook' ? '' : soundOf(w.mn) };
    if (dir === 'e2g') return mc(`Which word means "<b>${esc(w.en)}</b>"?`, w.g, others(w.g, pool.map(x => x.g)), Object.assign({ greekOpts: true }, base));
    if (dir === 'hook' && w.mn) return mc(`🪝 Whose hook is this? “${esc(w.mn)}”`, w.g, others(w.g, pool.map(x => x.g)), Object.assign({ greekOpts: true }, base));
    if (dir === 'sleuth') {
      const rs = Object.values(KG.readings).filter(r => r.uses.includes(w.g));
      if (rs.length) {
        const R = U.pick(rs);
        // the choices are all words from the sentence itself, so you have to know which one means it (not just spot which is there)
        const near = pool.map(x => x.g).filter(g => g !== w.g && R.uses.includes(g));
        if (near.length >= 2) return mc(`🕵️ Which word in this sentence means “<b>${esc(w.en)}</b>”?`, w.g, others(w.g, near),
          Object.assign({ greekOpts: true, big: sentence(R), small: true }, base, { explain: `${explain}<br><i>${esc(R.tr)}</i>` }));
      }
    }
    return mc('What does this word mean?', w.en, others(w.en, pool.map(x => x.en)), Object.assign({ big: w.g, sub: w.lex !== w.g ? w.lex : '' }, base));
  }
  // ── recall: the answer is not on the screen ──────────────────
  // Recognising the right one of four is the easy half of knowing a word; producing it is what
  // makes it stick. Typed meanings forgive spelling slips; Greek is built from letter tiles.
  const normEn = s => String(s).toLowerCase().replace(/[^a-z' ]/g, ' ').replace(/\b(i|it|to|a|an|the|am|is|are|be|one's|oneself|myself)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const senses = en => uniq(String(en).replace(/\([^)]*\)/g, ' ').split(/[,;/]|\bor\b/).map(normEn).filter(Boolean));
  function lev(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  // right if it is one of the senses, give or take a slip (one letter in a short word, two in a long one)
  E.checkMeaning = (typed, q) => {
    const t = normEn(typed); if (!t) return false;
    return q.answers.some(a => a === t || lev(a, t) <= (a.length >= 9 ? 2 : a.length >= 4 ? 1 : 0) || (a.split(' ').length > 1 && a.split(' ').some(w => w.length >= 5 && w === t)));
  };
  const greekLetters = s => U.bare(s).replace(/[^α-ω]/g, '');
  E.greekLetters = greekLetters;
  function typeQ(w) {
    return { type: 'type', prompt: '✍️ Type what it means', big: w.g, sub: w.lex !== w.g ? w.lex : '', answers: senses(w.en), display: w.en,
      vkey: w.g, speak: w.g, explain: wordExplain(w), hint: soundOf(w.mn) };
  }
  function spellQ(w, extra = {}) {
    const target = greekLetters(w.g);
    if (target.length < 2 || target.length > 12) return typeQ(w);
    const decoys = sample([...'αβγδεζηθικλμνξοπρστυφχψω'].filter(c => !target.includes(c)), Math.min(4, Math.max(2, Math.round(target.length / 3))));
    return Object.assign({ type: 'spell', prompt: `🔤 Spell the Greek for “<b>${esc(w.en)}</b>”`, target, tiles: shuffle([...target, ...decoys]), display: w.g,
      vkey: w.g, speakAfter: w.g, explain: wordExplain(w), hint: soundOf(w.mn) }, extra);
  }
  // a practice sentence with one of its words taken out: spell the missing word's dictionary form
  function clozeQ(R, w) {
    const i = R.words.findIndex(t => t.lemma === w.g);
    if (i < 0) return spellQ(w);
    const gap = R.words.map((t, k) => (k === i ? '＿＿＿' : t.w) + t.p).join(' ');
    return spellQ(w, { prompt: `🧩 Fill the gap: spell the missing word (dictionary form)`, big: gap, small: true, sub: R.tr, explain: `${wordExplain(w)}<br><i>${esc(R.tr)}</i>` });
  }
  // the learning engine decides: new words are recognised first; once the review boxes say you know
  // a word, it has to be recalled (typed), and once it's solid, produced (spelled)
  E.recallQ = (w, pool = chapterWords(w)) => {
    const box = (E.state.vocab[w.g] || {}).box || 0;
    if (box >= 4) return U.pick([spellQ, typeQ, spellQ])(w);
    if (box >= 2) return U.pick([typeQ, typeQ, spellQ, w2 => vocabQ(w2, pool, 'e2g')])(w);
    return U.pick([typeQ, w2 => vocabQ(w2, pool, 'g2e'), w2 => vocabQ(w2, pool, 'hook')])(w);
  };
  E.spellQ = spellQ; E.typeQ = typeQ;
  const WORD_MIX = ['g2e', 'type', 'e2g', 'hook', 'sleuth', 'spell'];
  E.vocabQuestions = (words, pool = KG.vocab, n = 12) => {
    const near = pool.length >= 8 ? pool : KG.vocab;
    let qs = [];
    for (const w of shuffle(words)) qs.push(vocabQ(w, near, 'g2e'));
    for (const w of sample(words, Math.max(0, n - words.length - 1))) qs.push(vocabQ(w, near, U.pick(WORD_MIX.slice(1))));
    const hasMatch = words.length >= 4;
    qs = shuffle(qs).slice(0, hasMatch ? n - 1 : n);
    if (hasMatch) qs.splice(Math.floor(qs.length / 2), 0, matchWords(words));
    return qs;
  };
  function matchWords(words) {
    const ws = [];
    for (const w of shuffle(words)) if (!ws.some(x => x.g === w.g || x.short === w.short)) ws.push(w);
    return { type: 'match', prompt: 'Match the pairs', pairs: ws.slice(0, 5).map(w => [w.g, w.short]), greekLeft: true };
  }
  function vocabLessonQuestions(set) {
    const words = E.vocabSet(set), pool = chapterWords(words[0]);
    const qs = E.vocabQuestions(words, pool, 8);
    // interleave an earlier word for spaced retrieval
    const earlier = pool.filter(w => w.set < set);
    for (const w of sample(earlier, 1)) qs.push(E.recallQ(w, pool));
    return qs;
  }

  // Concepts
  const cardName = c => `${c.pic} ${c.name}`;
  E.cardName = cardName;
  const chapterCards = ch => KG.cards.filter(c => c.chapter === ch);
  function cardOthers(c, pool, n = 3) {
    const partners = KG.partners[c.id] || [];
    const near = shuffle(pool.filter(x => x !== c && (partners.includes(x.id) || x.group === c.group)));
    const mid = shuffle(pool.filter(x => x !== c && !near.includes(x) && x.set === c.set));
    const far = shuffle(pool.filter(x => x !== c && x.set !== c.set));
    // keep one partner first when there is one, so the classic mix-up is always on the table
    return uniq(near.concat(mid, far).map(cardName)).filter(x => x !== cardName(c)).slice(0, n);
  }
  const cardExplain = (c, note) => `${esc(c.pic)} <b>${esc(c.name)}</b> — ${esc(c.oneLine)}${note ? `<br>${KG.mark(note)}` : ''}${c.mnemonic ? `<br><span class="muted">🪝 ${esc(c.mnemonic)}</span>` : ''}`;
  E.cardExplain = cardExplain;
  // a hint for a use: its group's hook, which names every use in the group, not just this one
  const groupHint = c => { const g = KG.groupById[c.group]; return g ? `${g.spot} ${g.name}: ${g.mnemonic}` : ''; };
  // the book's examples, then the practice items written for this card
  function examplesOf(c) {
    return c.examples.filter(e => e.greek || e.english).map(e => ({ greek: e.greek, english: e.english, ref: e.ref, note: e.note }))
      .concat((KG.extraByCard[c.id] || []).map(x => ({ greek: x.greek, english: x.english || x.prompt, ref: x.ref, note: x.why + (x.unofficial ? ' (A reasoned answer, not the book’s — worth checking in class.)' : '') })));
  }
  function spotQ(c, pool) {
    const ex = examplesOf(c);
    if (!ex.length) return plainQ(c, pool);
    const e = U.pick(ex);
    // an English line that just is the answer ("they" for αὐτοί) is left off
    const en = KG.plain(e.english || ''), low = s => String(s || '').toLowerCase().replace(/[^a-z ]/g, '').trim();
    const gives = [c.name, c.short, c.gist, c.tile].some(x => low(x) && (low(x) === low(en) || low(x).includes(low(en)) && low(en).length > 1));
    const ref = e.ref && !/^the /i.test(e.ref) ? e.ref : '';
    // once you've got a use right, it comes back among six choices, not four
    const known = ((E.state.cards || {})[c.id] || {}).right > 0, n = known ? 6 : 4;
    return mc(`🔍 Which use is this?${ref ? ` <span class="muted">(${esc(ref)})</span>` : ''}`, cardName(c), cardOthers(c, pool, n - 1),
      { n, big: e.greek ? KG.guillemet(e.greek) : en, sub: e.greek && !gives ? en : '', explain: cardExplain(c, e.note), cid: c.id, small: true, hint: groupHint(c) });
  }
  function hookQ(c, pool) {
    if (!c.mnemonic) return plainQ(c, pool);
    return mc(`🪝 Which concept has this hook? “${esc(c.mnemonic)}”`, cardName(c), cardOthers(c, pool), { explain: cardExplain(c, c.mnemonicWhy), cid: c.id });
  }
  function plainQ(c, pool) {
    const text = c.eli5 || c.oneLine || c.bookDef;
    return mc(`Which concept is this? “${esc(text)}”`, cardName(c), cardOthers(c, pool), { explain: cardExplain(c, c.eli5 && c.oneLine !== text ? c.bookDef : ''), cid: c.id, hint: groupHint(c) });
  }
  // the other way round: name → its example
  function exampleQ(c, pool) {
    const mine = examplesOf(c).filter(e => e.greek);
    const rivals = pool.filter(x => x !== c && x.set === c.set).flatMap(x => examplesOf(x).filter(e => e.greek).slice(0, 1));
    if (!mine.length || rivals.length < 2) return spotQ(c, pool);
    const e = U.pick(mine);
    return mc(`Which line shows <b>${esc(c.pic)} ${esc(c.name)}</b>?`, KG.guillemet(e.greek), others(KG.guillemet(e.greek), rivals.map(x => KG.guillemet(x.greek))),
      { greekOpts: true, explain: cardExplain(c, `${e.english ? `“${e.english}” ` : ''}${e.note || ''}`), cid: c.id, hint: c.mnemonic });
  }
  function duelQ(cf) {
    const cards = cf.pair.map(id => KG.cardById[id]);
    const c = U.pick(cards.filter(x => examplesOf(x).length)) || cards[0], rival = cards.find(x => x !== c);
    const ex = examplesOf(c), e = ex.length ? U.pick(ex) : { greek: '', english: c.eli5 };
    return mc(`⚔️ ${esc(cf.question)}`, cardName(c), [cardName(rival)],
      { big: e.greek ? KG.guillemet(e.greek) : KG.plain(e.english), sub: e.greek ? KG.plain(e.english) : '', small: true, cid: c.id, hint: `🔎 ${cf.test}`,
        explain: `${cardExplain(c, e.note)}<br><span class="muted">🔎 ${esc(cf.test)} ${esc(cf.answer)}</span>` });
  }
  function matchCards(cards) {
    const cs = [];
    for (const c of shuffle(cards)) if (c.gist && !cs.some(x => x.gist === c.gist || x.short === c.short)) cs.push(c);
    if (cs.length < 3) return null;
    return { type: 'match', prompt: 'Match each use to what it says', pairs: cs.slice(0, 5).map(c => [`${c.pic} ${c.short}`, c.gist]) };
  }
  // an acrostic ladder: tap the uses in the order of their hook
  function ladderQ(l) {
    const g = l.group;
    return {
      // the hook's own steps are shown ("To me → For me → Let me"), so you know which order is meant
      type: 'order', prompt: `🪜 Tap the uses in this order: <b>${l.cards.map(c => esc(c.tile)).join(' → ')}</b>`,
      verse: `${l.acrostic ? `${g.spot} ${g.key} — ${g.mnemonic}` : `${g.spot} ${g.name}`}: ${l.cards.map(c => c.tile).join(' → ')}`,
      chunks: l.cards.map(c => c.short), extras: [], tr: l.cards.map(c => `${c.tile} — ${c.short}`).join(' · '),
    };
  }
  // Odd one out: three lines from one group of uses, one from another; which doesn't belong?
  function oddQ(c, pool) {
    const g = KG.groupById[c.group];
    const mine = shuffle(pool.filter(x => x.group === c.group).flatMap(x => examplesOf(x).filter(e => e.greek).slice(0, 1)));
    const odd = U.pick(pool.filter(x => x.set === c.set && x.group !== c.group && examplesOf(x).some(e => e.greek)));
    if (!g || mine.length < 3 || !odd) return spotQ(c, pool);
    const oe = examplesOf(odd).find(e => e.greek), line = e => KG.guillemet(e.greek);
    const og = KG.groupById[odd.group];
    return mc(`🧐 Odd one out: three of these are <b>${esc(g.name.split(/\s+[—–-]\s+/)[0])}</b>. Which isn't?`, line(oe), mine.slice(0, 3).map(line),
      { greekOpts: true, cid: odd.id, explain: `${cardExplain(odd, oe.note)}<br><span class="muted">That one is ${esc(og ? og.name : odd.name)}; the rest are ${esc(g.name)}.</span>`, hint: groupHint(c) });
  }
  const CONCEPT_MIX = [spotQ, spotQ, spotQ, hookQ, plainQ, exampleQ, oddQ];
  E.spotQ = spotQ; E.hookQ = hookQ; E.duelQ = duelQ; E.examplesOf = examplesOf;
  E.conceptQ = (c, pool = chapterCards(c.chapter)) => U.pick(CONCEPT_MIX)(c, pool);
  function conceptQuestions(key, n = 8) {
    const L = KG.grammar[key], pool = chapterCards(L.chapter), qs = [];
    if (L.duels) {
      for (const cf of shuffle(L.duels)) qs.push(duelQ(cf));
      for (const c of sample(L.cards, Math.max(0, n - qs.length))) qs.push(spotQ(c, pool));
      return shuffle(qs).slice(0, n);
    }
    for (const c of shuffle(L.cards)) qs.push(E.conceptQ(c, pool));
    while (qs.length < n - 2) qs.push(U.pick([spotQ, spotQ, exampleQ])(U.pick(L.cards), pool));
    const ids = L.cards.map(c => c.id), duels = KG.confusions.filter(cf => cf.pair.some(id => ids.includes(id)));
    if (duels.length) qs.push(duelQ(U.pick(duels)));
    const lad = KG.ladders.find(l => (L.ladderGroups || []).some(g => g.id === l.group.id));
    const out = shuffle(qs).slice(0, n - 1 - (lad ? 1 : 0));
    const m = matchCards(L.cards);
    if (m) out.splice(Math.floor(out.length / 2), 0, m);
    if (lad) out.push(ladderQ(lad));
    return out;
  }

  // Sentence scrolls
  function readingQuestions(id) {
    const R = KG.readings[id], qs = [], S = sentence(R);
    const words = R.uses.map(g => E.vocabByGreek[g]).filter(Boolean);
    for (const w of sample(words, Math.min(3, words.length))) {
      qs.push(mc(`In this sentence, what does <b>${esc(w.g)}</b> mean?`, w.en, others(w.en, chapterWords(w).map(x => x.en)), { big: S, small: true, vkey: w.g, explain: wordExplain(w) }));
    }
    const rivals = Object.values(KG.readings).filter(x => x !== R).map(x => x.tr);
    qs.push(mc('What does it say?', R.tr, others(R.tr, rivals), { big: S, small: true, speak: S, explain: esc(R.note) }));
    // and one word taken out of the sentence: put it back from memory
    const gapWord = U.pick(words.filter(w => R.words.some(t => t.lemma === w.g)));
    if (gapWord) qs.push(clozeQ(R, gapWord));
    const out = shuffle(qs);
    const order = { type: 'order', prompt: 'Build the translation', reading: id, chunks: R.chunks, extras: R.extras };
    out.push(R.chunks.length >= 3 ? { type: 'mini', game: 'race', title: 'Sentence Race', reading: id, chunks: R.chunks, extras: R.extras, fallback: [order] } : order);
    out.push({ type: 'free', prompt: 'Now translate it in your own words', reading: id });
    return out;
  }

  // Boss: an interleaved mix of everything in the region (the exam: the whole chapter), with 3 hearts
  function bossQuestions(node) {
    const ch = KG.units[node.unit].chapter;
    const units = node.final ? KG.units.filter(u => u.chapter === ch) : [KG.units[node.unit]];
    const nodes = units.flatMap(u => u.nodes).filter(n => n.type !== 'boss');
    let qs = [];
    // guardians ask for recall too, not only recognition
    const graded = q => q.type === 'mc' || q.type === 'type' || q.type === 'spell';
    for (const n of nodes) qs = qs.concat(sample(E.questionsFor(n).filter(graded), node.final ? 2 : 3));
    for (const w of sample(nodes.filter(n => n.type === 'vocab').flatMap(n => E.vocabSet(n.set)), node.final ? 5 : 3)) qs.push(E.recallQ(w));
    return sample(qs, node.final ? 20 : 15);
  }

  E.questionsFor = node => {
    switch (node.type) {
      case 'vocab': return vocabLessonQuestions(node.set);
      case 'grammar': return conceptQuestions(node.lesson);
      case 'reading': return readingQuestions(node.reading);
      case 'boss': return bossQuestions(node);
    }
    return [];
  };

  // ── lesson plans: teach → guided try → trial ────────────────
  // First play of a lesson interleaves short teaching beats with a guided
  // question each (a miss just retries, no penalty), then a short trial
  // against a challenger. Replays go straight to a slightly longer trial.
  const FOES = [
    ['dummy', 'The Training Dummy', 'Knock the stuffing out of it with right answers!'],
    ['imp', 'A Living Book', 'A spellbook has come alive and flaps at you!'],
    ['rival', 'Kleon, the Rival Student', '"You call that Greek?" Prove him wrong!'],
    ['shade', 'A Shade of Forgetting', 'It feeds on forgotten words. Remember them!'],
  ];
  const teach = o => Object.assign({ type: 'teach' }, o);
  const guided = q => Object.assign(q, { guided: true, noLog: true });
  // each region has its own creature, in the look of the place (the same looks as js/world.js);
  // it takes every other trial and the rest rotate
  const BEASTS = [
    ['The Training Dummy', 'Knock the stuffing out of it with right answers!'],
    ['A Grumpy Treant', 'An old tree-spirit creaks to life. Answer well and it will settle back to sleep.'],
    ['The Scarecrow of Lost Endings', 'It has stolen the endings from the words in the field. Win them back!'],
    ['The Riddle Toad', 'A toad as big as a boat croaks a riddle at you. Answer, or get splashed!'],
    ['A Clockwork Builder', 'A practice automaton whirs and clanks. Every right answer slows its gears.'],
    ['The Sand Serpent', 'It rises from the dust of the ruins, hissing forgotten forms.'],
    ['The Mirror Wraith', 'It copies every move you make. Only the right answer will break its reflection.'],
    ['The Snow Yeti', 'A shaggy giant blocks the ledge. Answer quickly before your fingers freeze!'],
    ['The Ink Drake', 'A dragon of spilled ink uncoils from an old manuscript!'],
  ];
  const ROTA = ['beast', 'rival', 'beast', 'imp', 'beast', 'shade', 'beast', 'dummy'];
  function trial(node, kindHint) {
    const k = kindHint || ROTA[node.index % ROTA.length];
    if (k === 'beast') { const u = KG.units[node.unit], b = BEASTS[u.final ? 8 : node.unit % 8]; return { type: 'trial', foe: 'beast', title: b[0], say: b[1] }; }
    const f = FOES.find(x => x[0] === k);
    return { type: 'trial', foe: f[0], title: f[1], say: f[2] };
  }
  const chunks = (a, sizes) => { const out = []; let i = 0; for (const n of sizes) { if (i < a.length) out.push(a.slice(i, i + n)); i += n; } if (i < a.length) out.push(a.slice(i)); return out; };
  // ── mini-games (3D); each carries a plain-question fallback for 2D ──
  // Quick Judge for words: half the pairings are right, half borrow a near word's meaning
  function judgeWords(words, pool) {
    return shuffle(words.concat(sample(words, Math.max(0, 8 - words.length))).slice(0, 8).map((w, k) => {
      const truth = k % 2 === 0, near = sameKind(w, pool).filter(x => x !== w && x.short !== w.short);
      const claim = truth || !near.length ? w.short : U.pick(near).short;
      return { big: w.g, claim: `means “${claim}”`, ok: claim === w.short, why: `${w.g} = ${w.short}`, vkey: w.g };
    }));
  }
  // …and for uses: a real line, and a use that is or isn't the one it shows
  function judgeCards(cards, pool) {
    const lines = shuffle(cards.flatMap(c => examplesOf(c).filter(e => e.greek).slice(0, 2).map(e => ({ c, e })))).slice(0, 7);
    return lines.map(({ c, e }, k) => {
      const rivals = pool.filter(x => x !== c && x.set === c.set && x.short !== c.short), other = (KG.partners[c.id] || []).map(id => KG.cardById[id]).filter(Boolean)[0] || U.pick(rivals);
      const said = k % 2 === 0 || !other ? c : other;
      return { big: KG.guillemet(e.greek), claim: `is ${said.pic} ${said.short}`, ok: said === c, why: `It's ${c.pic} ${c.name}` };
    });
  }
  function miniFor(node) {
    if (node.type === 'vocab') {
      const words = E.vocabSet(node.set), pool = chapterWords(words[0]);
      // a different game for each pack, in turn: Word Rain, Memory Flip, Quick Judge
      const turn = node.set % 3;
      if (turn === 1 && words.length >= 4) return { type: 'mini', game: 'flip', title: 'Memory Flip', pairs: sample(words, Math.min(6, words.length)).map(w => ({ a: w.g, b: w.short })),
        fallback: [matchWords(words)] };
      if (turn === 2) return { type: 'mini', game: 'judge', title: 'Quick Judge', items: judgeWords(words, pool), seconds: 6,
        fallback: sample(words, 3).map(w => vocabQ(w, pool, 'e2g')) };
      return { type: 'mini', game: 'rain', title: 'Word Rain', targets: sample(words, 5).map(w => ({ g: w.g, en: w.short })), pool: pool.map(w => w.g),
        fallback: sample(words, 3).map(w => vocabQ(w, pool, 'g2e')) };
    }
    if (node.type === 'grammar') {
      const L = KG.grammar[node.lesson];
      if (L.duels) return null;
      const pool = chapterCards(L.chapter);
      // one gate per use when they fit, else one per group
      const byCard = L.cards.length <= 6;
      const gateOf = c => byCard ? c.short : L.groups.find(g => g.id === c.group).name.split(/\s+[—–-]\s+/)[0];
      const stones = shuffle(L.cards.flatMap(c => examplesOf(c).filter(e => e.greek).map(e => ({ form: KG.guillemet(e.greek), cases: [gateOf(c)] })))).slice(0, 8);
      // every other concept lesson plays Quick Judge instead of the Sorting Spell
      const k = Object.keys(KG.grammar).indexOf(node.lesson);
      if ((k % 2 === 1 || stones.length < 4) && judgeCards(L.cards, pool).length >= 4)
        return { type: 'mini', game: 'judge', title: 'Quick Judge', items: judgeCards(L.cards, pool), seconds: 8, fallback: sample(L.cards, 3).map(c => spotQ(c, pool)) };
      if (stones.length < 4) return null;
      return { type: 'mini', game: 'defense', title: 'Sorting Spell', banner: 'Sorting Spell! Strike each line with its use', gates: uniq(L.cards.map(gateOf)), stones,
        fallback: sample(L.cards, 3).map(c => spotQ(c, pool)) };
    }
    return null;
  }
  E.miniFor = miniFor;

  // Endless versions of the mini-games for the Arcade, from what the learner has met
  E.arcadeMini = game => {
    if (game === 'rain') {
      let pool = Object.keys(E.state.vocab).map(g => E.vocabByGreek[g]).filter(Boolean);
      if (pool.length < 12) pool = KG.vocab.slice(0, Math.max(20, pool.length));
      // due words fall first, so a round of Word Rain is a round of review
      const order = E.reviewOrder(pool);
      return { type: 'mini', game, title: 'Word Rain', targets: shuffle(order.slice(0, 8)).concat(sample(order.slice(8), 4)).map(w => ({ g: w.g, en: w.short })), pool: pool.map(w => w.g), arcade: true };
    }
    if (game === 'defense') {
      const sets = uniq(E.nodes.filter(n => n.type === 'grammar' && !KG.grammar[n.lesson].duels && (E.stars(n.id) > 0 || E.state.settings.unlockAll)).map(n => KG.grammar[n.lesson].set));
      const set = U.pick(sets.length ? sets : [KG.grammar[E.nodes.find(n => n.type === 'grammar').lesson].set]);
      const cards = KG.cards.filter(c => KG.setById[set] && KG.setById[set].groups.some(g => g.id === c.group));
      const byCard = cards.length <= 6, gateOf = c => byCard ? c.short : KG.groupById[c.group].name.split(/\s+[—–-]\s+/)[0];
      const stones = shuffle(cards.flatMap(c => examplesOf(c).filter(e => e.greek).map(e => ({ form: KG.guillemet(e.greek), cases: [gateOf(c)] })))).slice(0, 16);
      return { type: 'mini', game, title: 'Sorting Spell', banner: `Sorting Spell: ${KG.setById[set].name}`, gates: uniq(cards.map(gateOf)), stones, arcade: true };
    }
    const reads = E.nodes.filter(n => n.type === 'reading' && KG.readings[n.reading].chunks.length >= 3);
    const mine = reads.filter(n => E.stars(n.id) > 0), n = U.pick(mine.length ? mine : reads.slice(0, 2)), R = KG.readings[n.reading];
    return { type: 'mini', game: 'race', title: 'Sentence Race', reading: n.reading, chunks: R.chunks, extras: R.extras || [], arcade: true };
  };

  E.planFor = node => {
    const first = !E.stars(node.id);
    const plan = [];
    if (node.type === 'grammar') {
      const T = KG.teach[node.lesson], L = KG.grammar[node.lesson], pool = chapterCards(L.chapter);
      if (first && T) T.beats.forEach((b, i) => {
        plan.push(teach({ say: b.say, demo: b.demo, spell: i === 0 ? T.spell : null }));
        if (b.card) plan.push(guided(U.pick([plainQ, hookQ])(KG.cardById[b.card], pool)));
        if (b.duel) plan.push(guided(duelQ(b.duel)));
      });
      plan.push(trial(node));
      const mg = miniFor(node);
      return plan.concat(mg ? [mg] : [], conceptQuestions(node.lesson, first ? 5 : 8));
    }
    if (node.type === 'vocab') {
      const words = E.vocabSet(node.set), pool = chapterWords(words[0]);
      if (!first) return [trial(node), miniFor(node)].concat(vocabLessonQuestions(node.set));
      for (const c of chunks(U.shuffle(words), [3, 3])) {
        plan.push(teach({ words: c.map(w => ({ g: w.g, lex: w.lex, en: w.en, f: w.f, icon: w.icon, mn: w.mn })) }));
        for (const w of c) plan.push(guided(vocabQ(w, pool, 'g2e')));
      }
      plan.push(trial(node));
      plan.push(miniFor(node));
      if (words.length >= 3) plan.push(matchWords(sample(words, 5)));
      // straight after the games: recall them, not just recognise them
      const [t1, t2, t3] = sample(words, 3);
      plan.push(typeQ(t1), spellQ(t2 || t1), vocabQ(t3 || t1, pool, U.pick(['e2g', 'hook', 'sleuth'])));
      const earlier = pool.filter(w => w.set < node.set);
      for (const w of sample(earlier, 1)) plan.push(E.recallQ(w, pool));
      return plan;
    }
    if (node.type === 'reading') {
      if (first) plan.push(teach({ reading: node.reading, say: 'Read the sentence aloud first. Tap any word you don\'t know.' }));
      plan.push(trial(node, 'imp'));
      return plan.concat(readingQuestions(node.reading));
    }
    return E.questionsFor(node);
  };

  // Concepts from everything the learner has unlocked (arcade "Spot Rush")
  E.unlockedCards = () => {
    const keys = E.nodes.filter(n => n.type === 'grammar' && E.stars(n.id) > 0).map(n => n.lesson);
    const cs = uniq(keys.flatMap(k => KG.grammar[k].cards));
    return cs.length >= 4 ? cs : KG.cards;
  };

  // ── finishing a lesson ──────────────────────────────────────
  // Returns a summary used by the results screen.
  E.finishLesson = (node, res) => {
    const S = E.state, rec = S.lessons[node.id] || (S.lessons[node.id] = { stars: 0, best: 0, plays: 0 });
    const graded = res.correct + res.wrong, acc = graded ? res.correct / graded : 1;
    const perfect = res.wrong === 0;
    const passed = node.type === 'boss' ? res.hearts > 0 : acc >= 0.7;
    const firstClear = passed && rec.stars === 0;
    rec.plays++; rec.best = Math.max(rec.best, acc);
    if (passed) rec.stars = Math.min(3, rec.stars + (perfect && rec.stars === 0 ? 2 : 1));
    let bonus = passed ? 20 : 5;
    if (perfect && passed) { bonus += 20; S.stats.perfect++; }
    let chest = null;
    if (node.type === 'boss' && passed) { bonus += 50; if (firstClear) { S.stats.bosses++; chest = E.openChest(); } }
    if (node.type === 'reading' && firstClear) S.stats.verses++;
    if (node.type === 'vocab') for (const w of E.vocabSet(node.set)) if (!S.vocab[w.g]) E.srsAnswer(w.g, true);
    let spell = null;
    if (node.type === 'grammar' && passed && KG.teach && KG.teach[node.lesson]) {
      S.spells = S.spells || {};
      if (!S.spells[node.lesson]) { S.spells[node.lesson] = U.day(); spell = KG.teach[node.lesson].spell; }
    }
    let xp = res.xp + bonus;
    const boosted = S.boost > 0;
    if (boosted) { xp *= 2; S.boost--; }
    const coins = (passed ? 5 : 1) + (perfect && passed ? 5 : 0) + (node.type === 'boss' && passed ? 20 : 0);
    S.stats.lessons++;
    S.stats.bestCombo = Math.max(S.stats.bestCombo, res.maxCombo);
    E.questProgress('lessons'); E.questProgress('combo', res.maxCombo, true);
    if (perfect && passed) E.questProgress('perfect');
    E.gainXP(xp, coins);
    return { xp, coins, acc, perfect, passed, stars: rec.stars, firstClear, boosted, spell, chest };
  };

  // ── Pica the Magpie Thief: fail a lesson and the questions you missed get stolen ──
  const KEEP = ['prompt', 'big', 'sub', 'small', 'options', 'answer', 'explain', 'greekOpts', 'vkey', 'cid', 'hint', 'speak'];
  E.spawnVillain = (unit, missed = []) => {
    const V = E.state.villains || (E.state.villains = {});
    const v = V[unit] || (V[unit] = { since: U.day(), qs: [] });
    for (const q of missed) {
      if (q.type !== 'mc' || v.qs.some(x => x.prompt === q.prompt && x.big === q.big)) continue;
      v.qs.push(Object.fromEntries(KEEP.filter(k => q[k] !== undefined).map(k => [k, q[k]])));
    }
    v.qs = v.qs.slice(-12);
    E.save();
    return v;
  };
  // his riddles: what you missed, topped up from the region's words and uses
  E.villainQuestions = unit => {
    const v = (E.state.villains || {})[unit]; if (!v) return [];
    const qs = v.qs.map(q => { const opts = shuffle(q.options); return Object.assign({ type: 'mc' }, q, { options: opts, answer: opts.indexOf(q.options[q.answer]) }); });
    const nodes = KG.units[unit].nodes.filter(n => n.type === 'vocab' || n.type === 'grammar');
    const extra = shuffle(nodes.flatMap(n => E.questionsFor(n).filter(q => q.type === 'mc')));
    const want = Math.max(6, Math.min(10, qs.length + 3));
    return shuffle(qs).slice(0, want - 2).concat(extra).slice(0, want);
  };
  E.defeatVillain = unit => {
    const S = E.state;
    if (S.villains) delete S.villains[unit];
    S.stats.villains = (S.stats.villains || 0) + 1;
    E.gainXP(40, 15);
  };

  E.recordAnswer = (q, correct, isReview) => {
    const S = E.state;
    S.stats.answered++; if (correct) { S.stats.correct++; E.questProgress('correct'); }
    if (isReview) { S.stats.reviews++; E.questProgress('reviews'); }
    if (q.vkey) E.srsAnswer(q.vkey, correct);
    if (q.cid) { E.cardAnswer(q.cid, correct); if (correct) { S.stats.concepts = (S.stats.concepts || 0) + 1; E.questProgress('concepts'); } }
    if (!correct) E.logMistake(q); else if (isReview) E.clearMistake(q);
    E.save();
  };

  // ── wardrobe & loot ────────────────────────────────────────
  E.look = () => {
    const S = E.state;
    if (!S.look) S.look = { owned: ['robe:forest', 'hat:hood', 'hat:none', 'staff:none', 'pet:none'], robe: 'forest', hat: 'hood', staff: 'none', pet: 'none' };
    return S.look;
  };
  E.ownItem = (slot, id) => E.look().owned.includes(slot + ':' + id);
  E.equip = (slot, id) => { if (!E.ownItem(slot, id)) return false; E.look()[slot] = id; E.save(); emit('look'); return true; };
  E.buyItem = (slot, id) => {
    const it = KG.wardrobe[slot].find(x => x.id === id);
    if (!it || E.ownItem(slot, id) || E.state.coins < it.price) return false;
    E.state.coins -= it.price; E.look().owned.push(slot + ':' + id); E.equip(slot, id); return true;
  };
  // a guardian's treasure chest: something new to wear, plus coins
  E.openChest = () => {
    const L = E.look(), pool = [];
    for (const slot of Object.keys(KG.wardrobe)) for (const it of KG.wardrobe[slot]) if (it.price > 0 && !L.owned.includes(slot + ':' + it.id)) pool.push({ slot, it });
    const coins = pool.length ? 30 : 80;
    E.state.coins += coins;
    let prize = null;
    if (pool.length) { pool.sort((a, b) => a.it.price - b.it.price); prize = pool[Math.floor(Math.random() * Math.min(pool.length, 5))]; L.owned.push(prize.slot + ':' + prize.it.id); }
    E.save();
    return { coins, prize };
  };

  E.buy = item => {
    const S = E.state, price = { freeze: 50, boost: 80 }[item];
    if (S.coins < price) return false;
    if (item === 'freeze' && S.freezes >= 2) return false;
    S.coins -= price;
    if (item === 'freeze') S.freezes++;
    if (item === 'boost') S.boost += 3;
    E.save();
    return true;
  };
})();
