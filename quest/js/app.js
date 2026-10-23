// UI: screens, lesson player, arcade and effects.
(function () {
  'use strict';
  const E = KG.engine, U = KG.util;
  const { esc, shuffle, sample } = U;
  const $ = (s, el = document) => el.querySelector(s);
  const S = () => E.state;
  const gk = s => `<span class="gk">${esc(s)}</span>`;
  const main = $('#main');

  // ── effects ─────────────────────────────────────────────────
  let actx;
  function tone(freq, start, dur, type = 'sine', vol = 0.12) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, actx.currentTime + start);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + start + dur);
    o.connect(g).connect(actx.destination);
    o.start(actx.currentTime + start); o.stop(actx.currentTime + start + dur + 0.05);
  }
  // a short burst of filtered noise: splashes and whooshes
  function noise(dur, vol, freq) {
    const n = actx.sampleRate * dur, buf = actx.createBuffer(1, n, actx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = vol;
    src.connect(f).connect(g).connect(actx.destination); src.start();
  }
  function sfx(kind) {
    if (!S().settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (kind === 'good') { tone(660, 0, 0.12); tone(990, 0.08, 0.18); }
      else if (kind === 'bad') { tone(180, 0, 0.25, 'sawtooth', 0.06); }
      else if (kind === 'combo') { tone(880, 0, 0.1); tone(1175, 0.07, 0.1); tone(1568, 0.14, 0.2); }
      else if (kind === 'win') [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.3, 'triangle'));
      else if (kind === 'tap') tone(440, 0, 0.05, 'triangle', 0.05);
      else if (kind === 'coin') { tone(1319, 0, 0.07, 'square', 0.035); tone(1760, 0.06, 0.16, 'square', 0.03); }
      else if (kind === 'hit') { tone(220, 0, 0.08, 'square', 0.06); tone(110, 0.02, 0.18, 'sawtooth', 0.05); }
      else if (kind === 'splash') { noise(0.35, 0.08, 1800); tone(520, 0, 0.12, 'sine', 0.05); }
      else if (kind === 'reel') [660, 740, 830, 990].forEach((f, i) => tone(f, i * 0.05, 0.08, 'triangle', 0.06));
      else if (kind === 'whoosh') noise(0.25, 0.06, 900);
      else if (kind === 'level') [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.09, 0.35, 'triangle'));
    } catch (e) { /* audio unavailable */ }
  }
  // Greek voices read modern monotonic Greek, so strip breathings/extra accents first.
  function monotonic(s) {
    return s.normalize('NFD').replace(/[̓̔̈ͅ]/g, '').replace(/[̀͂]/g, '́')
      .replace(/́(?=.*́)/g, '').normalize('NFC').replace(/[’᾽]/g, '');
  }
  function speak(text) {
    if (!S().settings.speech || !('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text.split(' ').map(monotonic).join(' '));
      u.lang = 'el-GR'; u.rate = 0.8;
      const v = speechSynthesis.getVoices().find(v => /^el/i.test(v.lang));
      if (v) u.voice = v;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }
  function toast(html, cls = '') {
    const t = document.createElement('div');
    t.className = 'toast ' + cls; t.innerHTML = html;
    $('#toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  }
  function confetti(n = 120) {
    const c = document.createElement('canvas'); c.className = 'confetti';
    document.body.appendChild(c);
    const ctx = c.getContext('2d'), W = c.width = innerWidth, H = c.height = innerHeight;
    const cols = ['#e0a526', '#2f5f8f', '#3f7d5a', '#c9452b', '#8f3f9f', '#ffd166'];
    const ps = Array.from({ length: n }, () => ({ x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35, vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 12 - 4, r: Math.random() * 6 + 3, c: U.pick(cols), a: Math.random() * 6 }));
    let f = 0;
    (function step() {
      ctx.clearRect(0, 0, W, H);
      for (const p of ps) { p.x += p.vx; p.y += p.vy; p.vy += 0.35; p.a += 0.2; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore(); }
      if (++f < 110) requestAnimationFrame(step); else c.remove();
    })();
  }
  function floatXP(text, el) {
    const r = (el || main).getBoundingClientRect(), d = document.createElement('div');
    d.className = 'floatxp'; d.textContent = text;
    d.style.left = (r.left + r.width / 2) + 'px'; d.style.top = (r.top + 10) + 'px';
    document.body.appendChild(d); setTimeout(() => d.remove(), 1000);
  }

  E.on((type, data) => {
    if (type === 'level') { sfx('level'); confetti(180); toast(`⬆ <b>Level ${data.level}!</b> You are now a <b>${data.title}</b> (+20 🪙)`, 'gold'); }
    if (type === 'goal') toast('🎯 <b>Daily goal reached!</b> +10 🪙', 'gold');
    if (type === 'achievement') { toast(`${data.icon} <b>Achievement:</b> ${esc(data.name)} (+15 🪙)`, 'gold'); }
    if (type === 'streak' && data > 1) toast(`🔥 <b>${data}-day streak!</b>`);
    if (type === 'quest') { sfx('win'); toast(`📋 <b>Daily quest complete:</b> ${esc(data.text)} (+15 🪙, +25 XP)`, 'gold'); }
    renderTop();
  });

  // ── top bar & nav ───────────────────────────────────────────
  function renderTop() {
    const s = S(), lv = E.levelInfo(), pct = Math.min(1, E.todayXP() / s.dailyGoal);
    $('#topbar').innerHTML = `
      <button class="chip" data-act="go" data-arg="profile" title="Daily streak">🔥 <b>${s.streak}</b></button>
      <button class="chip goal" data-act="go" data-arg="profile" title="Today's XP goal" style="--p:${pct * 360}deg"><span>${E.todayXP()}/${s.dailyGoal}</span></button>
      <button class="chip lvl" data-act="go" data-arg="profile" title="Level"><span class="lvnum">${lv.level}</span><span class="bar"><i style="width:${(lv.cur / lv.need) * 100}%"></i></span></button>
      <button class="chip" data-act="go" data-arg="profile" title="Drachmas (coins)">🪙 <b>${s.coins}</b></button>`;
  }
  let view = 'path';
  let home = 'path'; // where lessons return to: the 3D world or the path map
  const hasWorld = () => !!(KG.world && KG.world.ok);
  // Every learning game is played on the 3D stage when the device supports it.
  const use3D = () => hasWorld() && KG.world.stage && KG.world.stage.ok && S().settings.mode3d !== false;
  const ST = () => KG.world.stage;
  function stageKind(o) {
    if (o.mode === 'boss') return 'guardian';
    if (o.mode === 'villain') return 'creep';
    if (o.mode === 'review' || o.mode === 'mistakes') return 'shade';
    if (o.node && o.node.type === 'reading') return 'scroll';
    return 'mentor';
  }
  const stageUnit = o => (o.node ? o.node.unit : o.villain !== undefined ? o.villain : (E.nextNode() || { unit: 0 }).unit);
  const hearts = () => P.mode === 'boss' || P.mode === 'villain';
  function enterStage(kind, unit) {
    document.body.classList.remove('in-world');
    document.body.classList.add('playing', 'in-stage');
    ST().enter(kind, unit);
  }
  function go(v) {
    if (v === 'world' && !hasWorld()) v = 'path';
    view = v; location.hash = v;
    if (v === 'world' || v === 'path') home = v;
    document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.arg === v));
    document.body.classList.remove('playing', 'in-stage');
    document.body.classList.toggle('in-world', v === 'world');
    if (v === 'world') { closeSheet(); main.innerHTML = ''; KG.world.show(); renderTop(); return; }
    if (hasWorld()) KG.world.hide();
    ({ path: renderPath, review: renderReview, arcade: renderArcade, codex: renderCodex, profile: renderProfile }[v] || renderPath)();
    main.scrollTop = 0; window.scrollTo(0, 0);
    renderTop();
  }

  // ── path ────────────────────────────────────────────────────
  const typeLabel = { vocab: 'Words', grammar: 'Concept', reading: 'Sentence scroll', boss: 'Guardian battle' };
  function nodeIcon(n) {
    if (n.type === 'vocab') return E.vocabSet(n.set)[0].icon || '📜';
    if (n.type === 'grammar') return KG.grammar[n.lesson].icon;
    if (n.type === 'reading') return '📜';
    if (n.type === 'boss') return n.final ? '🏆' : '⚔';
    return '•';
  }
  const unitName = i => `${KG.units[i].icon} ${KG.units[i].place}`;
  const starStr = k => '★'.repeat(k) + '☆'.repeat(3 - k);
  function renderPath() {
    const next = E.nextNode();
    let html = '';
    if (next) {
      html += `<button class="hero" data-act="open" data-arg="${next.id}">
        <div class="hero-k">${E.stars(E.nodes[0].id) ? 'Continue your journey' : 'Begin your journey'}</div>
        <div class="hero-t">${esc(next.title)}</div><div class="hero-s">${typeLabel[next.type]} · ${esc(unitName(next.unit))}</div><span class="hero-go">▶</span></button>`;
    } else html += `<div class="hero done"><div class="hero-t">🏆 Path complete!</div><div class="hero-s">Chapter done. Keep it fresh in Review and the Arcade before the quiz.</div></div>`;
    KG.units.forEach((u, ui) => {
      const done = u.nodes.filter(n => E.stars(n.id) > 0).length;
      html += `<section class="unit" style="--uc:${u.color}">
        <header class="unit-h"><div><div class="unit-n">${esc(unitName(ui))} · Chapter ${u.chapter}</div><h2>${esc(u.title)}</h2><p>${esc(u.sub)}</p></div>
        <div class="unit-p">${done}/${u.nodes.length}</div></header><div class="trail">`;
      u.nodes.forEach((n, i) => {
        const lock = !E.unlocked(n), st = E.stars(n.id), cur = next && next.id === n.id;
        const off = Math.round(Math.sin(i * 0.9) * 70);
        html += `<div class="stop" style="--off:${off}px">
          <button class="node ${n.type} ${lock ? 'locked' : ''} ${st ? 'done' : ''} ${cur ? 'current' : ''}" data-act="open" data-arg="${n.id}" aria-label="${esc(n.title)}">
            <span class="ic">${lock ? '🔒' : nodeIcon(n)}</span></button>
          <div class="node-l">${esc(n.title)}</div>${st ? `<div class="stars">${starStr(st)}</div>` : ''}${cur ? '<div class="bubble">START</div>' : ''}</div>`;
      });
      html += '</div></section>';
    });
    main.innerHTML = html;
    const cur = $('.node.current');
    if (cur && E.stars(E.nodes[0].id)) setTimeout(() => cur.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
  }

  function describe(n) {
    if (n.type === 'vocab') { const w = E.vocabSet(n.set); return `${w.length} words from the vocab app, each with its hook: ${w.slice(0, 4).map(x => gk(x.g)).join(', ')}…`; }
    if (n.type === 'grammar') { const L = KG.grammar[n.lesson]; return L.duels ? `${L.duels.length} pairs that get mixed up, and the one test that splits each.` : `${L.cards.length} uses: ${L.cards.map(c => esc(c.pic + ' ' + c.short)).join(' · ')}. Learn them, then spot them in real Greek.`; }
    if (n.type === 'reading') return `A practice sentence built from this chapter's words. Read it, then translate it yourself.`;
    if (n.type === 'boss') return n.final ? `20 questions from all of Chapter ${KG.units[n.unit].chapter}: every word, every use, every mix-up. You have 3 hearts ❤❤❤.` : `15 mixed questions from this whole region. You have 3 hearts ❤❤❤. Lose them all and the guardian wins!`;
    return '';
  }
  function openNode(id) {
    const n = E.node(id); if (!n) return;
    const lock = !E.unlocked(n), rec = S().lessons[id];
    sheet(`<div class="sheet-ic ${n.type}">${lock ? '🔒' : nodeIcon(n)}</div>
      <div class="sheet-k">${typeLabel[n.type]} · ${esc(unitName(n.unit))}</div><h2>${esc(n.title)}</h2>
      <p>${describe(n)}</p>
      ${rec ? `<p class="muted">${starStr(rec.stars)} · best ${Math.round(rec.best * 100)}% · played ${rec.plays}×</p>` : ''}
      ${lock ? '<p class="lockmsg">Earn a star on the previous lesson to unlock this one.</p>' :
        `<div class="row">${n.type !== 'boss' ? `<button class="btn ghost" data-act="learn" data-arg="${id}">📖 Learn</button>` : ''}
        <button class="btn primary" data-act="start" data-arg="${id}">${rec && rec.stars ? 'Practice again' : 'Start'} ▶</button></div>`}`);
  }
  function sheet(html) {
    closeSheet();
    const d = document.createElement('div'); d.className = 'sheet-wrap';
    d.innerHTML = `<div class="sheet" role="dialog">${html}<button class="sheet-x" data-act="closeSheet" aria-label="Close">✕</button></div>`;
    d.addEventListener('click', e => { if (e.target === d) closeSheet(); });
    document.body.appendChild(d);
    requestAnimationFrame(() => d.classList.add('in'));
  }
  function closeSheet() { document.querySelectorAll('.sheet-wrap').forEach(s => s.remove()); }

  // ── learn screens ───────────────────────────────────────────
  function paradigmTable(p) {
    return `<table class="para"><caption>${esc(p.title)}</caption><tr><th></th>${p.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr>
      ${p.rows.map((r, i) => `<tr><th>${esc(r)}</th>${p.forms[i].map(f => `<td class="gk" data-act="say" data-arg="${esc(f)}">${esc(f)}</td>`).join('')}</tr>`).join('')}</table>`;
  }
  function verseHTML(R, cls = '') {
    return `<p class="verse ${cls}">${R.words.map((w, i) => `<span class="w" data-act="word" data-arg="${i}">${esc(w.w)}</span>${esc(w.p)}`).join(' ')}</p>`;
  }
  const vcardHTML = w => `<div class="vcard" data-act="say" data-arg="${esc(w.g)}"><div class="vc-ic">${esc(w.icon || '')}</div><div class="gk big">${esc(w.g)}</div><div class="gk muted">${esc(w.lex)}</div><div class="en">${esc(w.en)}</div>${w.mn ? `<div class="hook">🪝 ${esc(w.mn)}</div>` : ''}<div class="freq">≈${w.f}× in NT · 🔊</div></div>`;
  function learnHTML(n) {
    if (n.type === 'vocab') return `<p>Read each word aloud, picture its icon, and say the hook. The hook is the thing you will remember in the quiz.</p>
      <div class="cards">${E.vocabSet(n.set).map(vcardHTML).join('')}</div>`;
    if (n.type === 'grammar') return `<div class="notes">${KG.grammar[n.lesson].notes}</div>`;
    if (n.type === 'reading') {
      const R = KG.readings[n.reading];
      return `<p>Tap every word to see its meaning. Try to understand the sentence <i>before</i> you check the translation.</p>
        ${verseHTML(R, 'big')}<div id="wordinfo" class="wordinfo muted">Tap a word…</div>
        <details><summary>Show translation</summary><p>${esc(R.tr)}</p></details>
        <p class="tip">💡 ${esc(R.note)}</p>`;
    }
    if (n.type === 'boss') return `<p>${describe(n)}</p>`;
    return '';
  }
  let readerReading = null;
  function showLearn(id, thenStart) {
    const n = E.node(id); closeSheet();
    readerReading = n.type === 'reading' ? KG.readings[n.reading] : null;
    if (use3D()) enterStage(stageKind({ node: n }), n.unit);
    else {
      if (hasWorld()) KG.world.hide();
      document.body.classList.remove('in-world');
      document.body.classList.add('playing');
    }
    main.innerHTML = `<div class="learn ${use3D() ? 'parchment' : ''}"><div class="learn-h"><button class="x" data-act="go" data-arg="${home}" aria-label="Close">✕</button><h2>${esc(n.title)}</h2></div>
      ${learnHTML(n)}<div class="learn-f"><button class="btn primary wide" data-act="start" data-arg="${id}">${thenStart ? 'Start practice ▶' : 'Practice now ▶'}</button></div></div>`;
    window.scrollTo(0, 0);
  }
  function wordInfo(i, box) {
    if (!readerReading) return;
    const w = readerReading.words[i], el = box || $('#wordinfo');
    document.querySelectorAll('.verse .w').forEach((x, j) => x.classList.toggle('sel', j === +i));
    if (el) el.innerHTML = `<div class="wi-top"><span class="gk big">${esc(w.w)}</span><button class="say" data-act="say" data-arg="${esc(w.w)}">🔊</button></div>
      ${w.lemma ? `<div>from ${gk(w.lemma)}: <b>${esc(w.parse || w.gloss)}</b></div>` : '<div class="muted">Not one of this chapter\'s new words. Try the context!</div>'}`;
    speak(w.w);
  }

  // ── lesson player ───────────────────────────────────────────
  let P = null; // current session
  function startNode(id) {
    const n = E.node(id);
    if (!E.unlocked(n)) return openNode(id);
    closeSheet();
    begin({ node: n, qs: E.planFor(n), mode: n.type === 'boss' ? 'boss' : 'lesson' });
  }
  function begin(opts) {
    if (!opts.qs.length) { toast('Nothing to practice here yet!'); return go(view); }
    P = Object.assign({ i: 0, correct: 0, wrong: 0, combo: 0, maxCombo: 0, xp: 0, hearts: 3, answered: false }, opts);
    readerReading = null;
    P.is3D = use3D();
    if (P.is3D) enterStage(stageKind(P), stageUnit(P));
    else {
      if (hasWorld()) KG.world.hide();
      document.body.classList.remove('in-world');
      document.body.classList.add('playing');
    }
    renderQ();
  }
  function header() {
    const pct = (P.i / P.qs.length) * 100;
    return `<div class="ph"><button class="x" data-act="quit" aria-label="Quit">✕</button>
      <div class="prog"><i style="width:${pct}%"></i></div>
      ${hearts() ? `<div class="hearts">${'❤'.repeat(P.hearts)}<span class="lost">${'❤'.repeat(3 - P.hearts)}</span></div>` : ''}
      <div class="combo ${P.combo >= 3 ? 'hot' : ''}">${P.combo >= 2 ? `🔥${P.combo}` : ''}</div></div>`;
  }
  // [bracketed] parts of a demo glow
  const demoHTML = d => esc(d).replace(/\[(.+?)\]/g, '<b class="glow">$1</b>');
  function teachHTML(q) {
    let h = q.spell ? `<div class="spellnew"><span class="sp-ic">${q.spell.icon}</span><div><div class="sp-k">✨ New spell</div><b>${esc(q.spell.name)}</b><div class="small">${esc(q.spell.desc)}</div></div></div>` : '';
    if (q.say) h += `<div class="t-say">${q.say}</div>`;
    if (q.demo) h += `<div class="t-demo gk">${demoHTML(q.demo)}</div>`;
    if (q.words) h += `<div class="cards">${q.words.map(vcardHTML).join('')}</div>`;
    if (q.letters) h += `<div class="letters">${q.letters.map(L => `<div class="letter"><div class="gk big">${L.U} ${L.l}</div><b>${L.name}</b><div class="muted">${esc(L.say)}</div></div>`).join('')}</div>`;
    if (q.items) h += `<div class="letters">${q.items.map(L => `<div class="letter" data-act="say" data-arg="${esc(L.big)}"><div class="gk big">${esc(L.big)}</div><b>${esc(L.name)}</b><div class="muted">${esc(L.say)}</div></div>`).join('')}</div>`;
    if (q.reading) { const R = KG.readings[q.reading]; readerReading = R; h += `${verseHTML(R, 'big')}<div id="wordinfo" class="wordinfo muted">Tap a word…</div><p class="tip">💡 ${esc(R.note)}</p>`; }
    return h;
  }
  function renderTeach(q) {
    P.answered = true;
    const lead = q.words ? 'New words' : q.letters ? 'New letters' : q.reading ? 'Read it first' : 'Your master teaches';
    if (P.is3D) {
      main.innerHTML = `<div class="s3">${header()}<div class="s3teach"><div class="s3t-k">🧙 ${lead}</div>${teachHTML(q)}<button class="btn primary wide" data-act="next" id="nextbtn">Got it ▶</button></div></div>`;
      ST().teach(q);
    } else {
      main.innerHTML = `<div class="player">${header()}<div class="qbody"><div class="prompt">🧙 ${lead}</div>${teachHTML(q)}</div><div class="foot" id="foot"><button class="btn primary wide" data-act="next" id="nextbtn">Got it ▶</button></div></div>`;
    }
    if (q.words && q.words[0]) speak(q.words[0].g);
  }
  function renderTrial(q) {
    P.answered = true; P.trial = { start: P.i + 1, correct: 0 };
    const html = `<div class="trialcard"><div class="tr-k">⚔ Trial</div><h2>${esc(q.title)}</h2><p>${esc(q.say)}</p><button class="btn primary wide autonext counting" data-act="next" id="nextbtn" style="--auto:2200ms">Fight ▶</button></div>`;
    main.innerHTML = P.is3D ? `<div class="s3">${header()}<div class="s3center">${html}</div></div>` : `<div class="player">${header()}<div class="qbody">${html}</div></div>`;
    if (P.is3D) ST().trial(q.foe);
    sfx('combo');
    const at = P.i; clearTimeout(P.autoT);
    P.autoT = setTimeout(() => { if (P && P.i === at) next(); }, 2200);
  }
  const MINI_HELP = {
    rain: 'Tap the falling stone that matches the meaning before it hits the ground!',
    defense: 'Tap the use that matches each falling Greek line before it lands!',
    forge: 'Tap the tense, then the person and number.',
    race: 'Tap the next piece of the translation. Wrong picks cost time!',
  };
  function renderMini(q) {
    main.innerHTML = `<div class="s3">${header()}<div class="s3center"><div class="minititle">🎮 ${esc(q.title)}</div></div><div class="foot s3foot" id="foot"><div class="muted center s3help">${MINI_HELP[q.game]}</div></div></div>`;
    sfx('combo');
    q.onWord = (g, ok) => { if (S().vocab[g]) E.srsAnswer(g, ok); };
    ST().mini(q, res => {
      if (!P || P.q !== q) return;
      P.xp += res.hits * 3;
      answer(res.ok, Object.assign({}, q, { explain: res.text, retry: true }));
    });
  }
  function renderQ3D(q) {
    const R = q.reading ? KG.readings[q.reading] : null;
    readerReading = R;
    const tools = `${q.speak ? `<button class="s3tool" data-act="say" data-arg="${esc(q.speak)}" aria-label="Listen">🔊</button>` : ''}
      ${R ? `<button class="s3tool" data-act="hint" data-arg="${q.reading}" aria-label="Word help">💡</button><span class="s3ref">${esc(R.ref)}</span>` : ''}
      ${q.hint ? `<button class="s3tool" data-act="hook" aria-label="Show a hint">🪝</button>` : ''}<div id="hintbox" class="hintbox s3hint" hidden></div>`;
    let foot = '';
    if (q.type === 'order') foot = `<div class="muted center small s3help">${q.reading ? 'Tap the word-stones in order to build the bridge.' : 'Tap the stones in the order of the hook.'} Tap a placed stone to take it back.</div><button class="btn primary wide" data-act="checkOrder" id="checkbtn" disabled>Check</button>`;
    else if (q.type === 'free') foot = `<div class="s3free"><div class="s3q">${q.prompt}</div><textarea id="freetr" rows="3" placeholder="Type your translation…"></textarea><button class="btn primary wide" data-act="compare">Compare with a model translation</button></div>`;
    else if (q.type === 'match') foot = `<div class="muted center s3help">Tap a stone, then its partner</div>`;
    else foot = `<div class="muted center s3help">Tap a tablet${matchMedia('(pointer: fine)').matches ? ' or press 1–4' : ''}</div>`;
    main.innerHTML = `<div class="s3">${header()}<div class="s3tools">${tools}</div><div class="foot s3foot" id="foot">${foot}</div></div>`;
    ST().combo(P.combo);
    ST().ask(q, {
      pick: i => { if (P.answered) return; const ok = i === q.answer; ST().reveal(ok, i, q.answer); answer(ok, q); },
      matchDone: miss => answer(miss === 0, Object.assign({}, q, { explain: miss ? `${miss} mismatch${miss > 1 ? 'es' : ''}. Keep at it!` : 'All pairs matched perfectly!' })),
      orderChange: line => { const b = $('#checkbtn'); if (b) b.disabled = !line.length; },
    });
    if (q.type === 'mc' && q.speak && q.big && S().settings.speech) speak(q.speak);
  }
  function renderQ() {
    const q = P.qs[P.i]; P.answered = false; P.q = q;
    if (q.type === 'teach') return renderTeach(q);
    if (q.type === 'trial') return renderTrial(q);
    if (q.type === 'mini') {
      if (!P.is3D) { P.qs.splice(P.i, 1, ...q.fallback); return renderQ(); }
      return renderMini(q);
    }
    if (P.is3D) return renderQ3D(q);
    let body = '';
    if (q.type === 'mc') {
      body = `<div class="prompt">${q.prompt}</div>
        ${q.big ? `<div class="bigword ${q.small ? 'small' : ''}"><span class="gk">${esc(q.big)}</span>${q.speak ? `<button class="say" data-act="say" data-arg="${esc(q.speak)}" aria-label="Listen">🔊</button>` : ''}</div>` : ''}
        ${q.sub ? `<div class="subword ${q.greekOpts || !q.small ? 'gk' : ''}">${esc(q.sub)}</div>` : ''}
        ${q.hint ? `<div class="hintrow"><button class="hintbtn" data-act="hook">🪝 Hint</button><div id="hintbox" class="hintbox" hidden></div></div>` : ''}
        <div class="opts">${q.options.map((o, i) => `<button class="opt ${q.greekOpts ? 'gk' : ''}" data-act="pick" data-arg="${i}"><span class="k">${i + 1}</span>${q.greekOpts ? esc(o) : o}</button>`).join('')}</div>`;
    } else if (q.type === 'match') {
      const L = shuffle(q.pairs.map((p, i) => ({ t: p[0], i }))), R = shuffle(q.pairs.map((p, i) => ({ t: p[1], i })));
      P.match = { sel: null, done: 0, miss: 0 };
      body = `<div class="prompt">${q.prompt}</div><div class="match">
        <div class="col">${L.map(x => `<button class="mt ${q.greekLeft ? 'gk' : ''}" data-act="mt" data-arg="L${x.i}">${esc(x.t)}</button>`).join('')}</div>
        <div class="col">${R.map(x => `<button class="mt" data-act="mt" data-arg="R${x.i}">${esc(x.t)}</button>`).join('')}</div></div>`;
    } else if (q.type === 'order') {
      const R = q.reading ? KG.readings[q.reading] : null; readerReading = R;
      P.order = { bank: shuffle(q.chunks.concat(q.extras).map((t, i) => ({ t, i }))), line: [] };
      body = R ? `<div class="prompt">${q.prompt} <span class="muted">(${esc(R.ref)})</span></div>${verseHTML(R)}
        <div id="wordinfo" class="wordinfo small muted">Stuck? Tap a Greek word for help.</div>
        <div class="line" id="line"></div><div class="bank" id="bank"></div>` :
        `<div class="prompt">${q.prompt}</div><p class="verse">${esc(q.verse)}</p><div class="line" id="line"></div><div class="bank" id="bank"></div>`;
    } else if (q.type === 'free') {
      const R = KG.readings[q.reading]; readerReading = R;
      body = `<div class="prompt">${q.prompt} <span class="muted">(${esc(R.ref)})</span></div>${verseHTML(R, 'big')}
        <div id="wordinfo" class="wordinfo small muted">Tap a word if you need a hint.</div>
        <textarea id="freetr" rows="4" placeholder="Type your translation…"></textarea>`;
    }
    main.innerHTML = `<div class="player">${header()}<div class="qbody">${body}</div><div class="foot" id="foot">${footFor(q)}</div></div>`;
    if (q.type === 'order') renderOrder();
    if (q.type === 'mc' && q.speak && q.big && S().settings.speech) speak(q.speak);
  }
  function footFor(q) {
    if (q.type === 'order') return `<button class="btn primary wide" data-act="checkOrder" id="checkbtn" disabled>Check</button>`;
    if (q.type === 'free') return `<button class="btn primary wide" data-act="compare">Compare with a model translation</button>`;
    if (q.type === 'match') return `<div class="muted center">Tap a pair to match them</div>`;
    return `<div class="muted center">Choose an answer</div>`;
  }
  function renderOrder() {
    const o = P.order;
    $('#line').innerHTML = o.line.length ? o.line.map((c, k) => `<button class="tile" data-act="unplace" data-arg="${k}">${esc(c.t)}</button>`).join('') : '<span class="muted">Tap the pieces in order…</span>';
    $('#bank').innerHTML = o.bank.map((c, k) => `<button class="tile" data-act="place" data-arg="${k}">${esc(c.t)}</button>`).join('');
    const b = $('#checkbtn'); if (b) b.disabled = !o.line.length;
  }

  function answer(ok, q) {
    P.answered = true;
    const graded = !q.ungraded && !(q.guided && !ok);
    if (q.guided && !ok && (q.tries || 0) >= 2) { sfx('bad'); P.combo = 0; }
    if (q.guided && !ok && (q.tries || 0) < 2) {
      sfx('bad'); P.combo = 0;
      const again = Object.assign({}, P.qs[P.i], { tries: (q.tries || 0) + 1 });
      if (again.type === 'mc') { again.options = shuffle(again.options); again.answer = again.options.indexOf(q.options[q.answer]); }
      P.qs.splice(P.i + 1, 0, again);
    }
    if (graded) {
      E.recordAnswer(q, ok, P.mode === 'review' || P.mode === 'mistakes');
      if (ok) {
        P.correct++; P.combo++; P.maxCombo = Math.max(P.maxCombo, P.combo);
        if (P.trial && !q.guided) P.trial.correct++;
        const hinted = P.hinted === P.i;
        const base0 = (P.mode === 'review' || P.mode === 'mistakes' ? 5 : 10) / (hinted ? 2 : 1), base = Math.ceil(base0);
        const bonus = hinted ? 0 : P.combo >= 10 ? 10 : P.combo >= 5 ? 5 : 0;
        P.xp += base + bonus;
        floatXP(`+${base + bonus} XP${hinted ? ' 🪝' : ''}`, $('.prompt'));
        sfx(P.combo > 0 && P.combo % 5 === 0 ? 'combo' : 'good');
        if (P.combo > 0 && P.combo % 5 === 0) toast(`⚡ ${P.combo}× combo! Bonus XP`);
      } else {
        P.wrong++; P.combo = 0; sfx('bad');
        if (q.type === 'mc' && !q.guided) (P.missed || (P.missed = [])).push(q);
        if (hearts()) P.hearts--;
        // Spaced retries: a missed question comes back a few questions later, and if
        // it's missed again, once more at the end (retrieval after a growing gap).
        if (!hearts() && (q.retry || 0) < 2 && q.type !== 'mini') {
          const again = Object.assign({}, P.qs[P.i], { retry: (q.retry || 0) + 1 });
          if (again.type === 'mc') { again.options = shuffle(again.options); again.answer = again.options.indexOf(q.options[q.answer]); again.hinted = false; }
          if (again.retry === 1) P.qs.splice(Math.min(P.qs.length, P.i + 3 + Math.floor(Math.random() * 2)), 0, again);
          else P.qs.push(again);
        }
      }
    }
    if (P.is3D) {
      ST().combo(P.combo);
      if (hearts() || P.mode === 'review' || P.mode === 'mistakes') ST().hp(1 - P.correct / Math.max(1, P.qs.filter(x => !x.retry).length));
      else if (P.trial) ST().hp(1 - P.trial.correct / Math.max(1, P.qs.slice(P.trial.start).filter(x => !x.retry && x.type !== 'teach').length));
      if (q.type === 'match' || q.type === 'order') ST().result(ok);
    }
    const head = ok ? U.pick(['Excellent!', 'Correct!', 'Well done!', 'Καλῶς!', 'Nice!', 'Great!']) : q.guided ? 'Not yet. Read this, then try again' : (q.type === 'mc' ? 'Not quite' : 'Keep practicing');
    let detail = q.explain || '';
    if (!ok && q.type === 'mc') detail = `Answer: <b class="${q.greekOpts ? 'gk' : ''}">${q.greekOpts ? esc(q.options[q.answer]) : q.options[q.answer]}</b>${detail ? '<br>' + detail : ''}`;
    const foot = $('#foot');
    foot.className = 'foot ' + (ok ? 'ok' : 'no');
    foot.innerHTML = `<div class="fb"><div class="fb-h">${ok ? '✔' : '✘'} ${head}</div>${detail ? `<div class="fb-d">${detail}</div>` : ''}</div>
      <button class="btn ${ok ? 'good' : 'bad'} wide autonext" data-act="next" id="nextbtn">Continue</button>`;
    scheduleAuto(ok, (q.explain || '').length + (ok ? 0 : 60));
    if (P.is3D) foot.classList.add('s3foot');
    $('.prog i').style.width = ((P.i + 1) / P.qs.length) * 100 + '%';
    const c = $('.combo'); if (c) { c.textContent = P.combo >= 2 ? `🔥${P.combo}` : ''; c.classList.toggle('hot', P.combo >= 3); }
    const h = $('.hearts'); if (h) h.innerHTML = `${'❤'.repeat(Math.max(0, P.hearts))}<span class="lost">${'❤'.repeat(3 - Math.max(0, P.hearts))}</span>`;
    setTimeout(() => { const b = $('#nextbtn'); if (b) b.focus(); }, 30);
  }
  // Auto-advance: right answers move on quickly; wrong ones stay up long enough
  // to read the correction. Tapping anywhere skips the wait.
  const SPEEDS = { fast: [700, 2600], normal: [1100, 3800], relaxed: [1700, 5600] };
  function scheduleAuto(ok, textLen) {
    clearTimeout(P.autoT);
    const sp = SPEEDS[S().settings.autoAdvance || 'normal'];
    if (!sp) return;
    const ms = ok ? sp[0] : sp[1] + Math.min(3000, textLen * 18);
    const b = $('#nextbtn');
    if (b) { b.style.setProperty('--auto', ms + 'ms'); b.classList.add('counting'); }
    const at = P.i;
    P.autoT = setTimeout(() => { if (P && P.answered && P.i === at && !document.querySelector('.sheet-wrap')) next(); }, ms);
  }
  function next() {
    if (P) clearTimeout(P.autoT);
    if (hearts() && P.hearts <= 0) return finish();
    P.i++;
    if (P.i >= P.qs.length) return finish();
    renderQ();
  }
  function finish() {
    const res = { correct: P.correct, wrong: P.wrong, xp: P.xp, maxCombo: P.maxCombo, hearts: P.hearts };
    let r, title, extra = '';
    let villain = null;
    if (P.mode === 'villain') {
      const won = P.hearts > 0, graded = res.correct + res.wrong;
      if (won) E.defeatVillain(P.villain); else E.gainXP(res.xp, 0);
      r = { xp: won ? res.xp + 40 : res.xp, coins: won ? 15 : 0, acc: graded ? res.correct / graded : 1, passed: won, perfect: !res.wrong };
      title = won ? '😈 Skulch is beaten!' : '😈 Skulch got away…';
      extra = won ? '<p>“Nooo! Our lovely words!” He drops them all and scuttles off into the dark. <b>+40 XP, +15 🪙</b></p>'
        : `<p>“Sss, it fails again! Skulch keeps them!” He is still waiting in <b>${esc(KG.units[P.villain].place)}</b>. Learn the hooks in the Codex and try again.</p>`;
    } else if (P.node) {
      r = E.finishLesson(P.node, res);
      if (!r.passed) {
        villain = E.spawnVillain(P.node.unit, P.missed || []);
        extra += `<div class="villain-note">😈 <b>Skulch the Riddle-Creep</b> snatched the ${villain.qs.length || ''} question${villain.qs.length === 1 ? '' : 's'} you missed and scuttled off into <b>${esc(KG.units[P.node.unit].place)}</b>. Beat his riddles in a side quest to win them back!</div>`;
      }
      if (P.mode === 'boss') title = r.passed ? '⚔ Boss defeated!' : '💀 The boss won this time';
      else title = r.passed ? (r.perfect ? '💎 Flawless!' : 'Lesson complete!') : 'Almost there!';
      if (!r.passed) extra = extra + `<p>${P.mode === 'boss' ? 'Replay the region\'s lessons, drill your weakest concepts in Review, and try again.' : 'Score 70% or more to earn a star and unlock the next lesson.'}</p>`;
      if (r.passed && r.firstClear) { const nx = E.nodes[P.node.index + 1]; if (nx) extra = `<p>🔓 Unlocked: <b>${esc(nx.title)}</b></p>`; }
      if (!r.passed) extra += `<p class="small muted">${P.mode === 'boss' ? '' : 'Tip: open 📖 Learn on the stop to see every hook and example first.'}</p>`;
      if (r.chest && r.passed) {
        const pz = r.chest.prize;
        extra = `<div class="chest"><div class="chest-ic">🎁</div><div><div class="sp-k">Treasure chest!</div>${pz ? `<b>${esc(pz.it.name)}</b> ${pz.it.icon || ''} <span class="muted small">(${pz.slot})</span><div class="small">Wear it from your Profile → Wardrobe</div>` : ''}<div class="small">+${r.chest.coins} 🪙</div></div></div>` + extra;
      }
      if (r.spell) extra = `<div class="spellnew big"><span class="sp-ic">${r.spell.icon}</span><div><div class="sp-k">✨ Spell added to your spellbook</div><b>${esc(r.spell.name)}</b><div class="small">${esc(r.spell.desc)}</div></div></div>` + extra;
    } else {
      const xp = res.xp; E.state.stats.bestCombo = Math.max(E.state.stats.bestCombo, res.maxCombo);
      E.gainXP(xp, Math.floor(res.correct / 4));
      const graded = res.correct + res.wrong;
      r = { xp, coins: Math.floor(res.correct / 4), acc: graded ? res.correct / graded : 1, passed: true, perfect: !res.wrong };
      title = P.mode === 'mistakes' ? '📝 Mistakes reviewed' : '🔁 Review complete!';
    }
    if (r.passed) { sfx('win'); confetti(r.perfect ? 200 : 110); }
    const node = P.node, vMode = P.mode === 'villain' ? String(P.villain) : '';
    if (P.is3D) ST().celebrate(r.passed);
    main.innerHTML = `<div class="results ${P.is3D ? 's3card' : ''}">
      <h1>${title}</h1>
      ${node && r.passed ? `<div class="bigstars">${starStr(r.stars)}</div>` : ''}
      <div class="rstats">
        <div><b>+${r.xp}</b><span>XP${r.boosted ? ' (2× boost!)' : ''}</span></div>
        <div><b>${Math.round(r.acc * 100)}%</b><span>accuracy</span></div>
        <div><b>${P.maxCombo}</b><span>best combo</span></div>
        <div><b>+${r.coins}</b><span>🪙</span></div></div>
      ${extra}
      <div class="col-btns">
        ${home !== 'world' && node && r.passed && E.nodes[node.index + 1] ? `<button class="btn primary wide" data-act="start" data-arg="${E.nodes[node.index + 1].id}">Next: ${esc(E.nodes[node.index + 1].title)} ▶</button>` : ''}
 ${villain && home !== 'world' ? `<button class="btn primary wide" data-act="villain" data-arg="${node.unit}">😈 Chase Skulch now</button>` : ''}
        ${vMode && !r.passed ? `<button class="btn primary wide" data-act="villain" data-arg="${vMode}">😈 Riddle me again</button>` : ''}
        ${home === 'world' ? `<button class="btn primary wide" data-act="go" data-arg="world">🏞 ${node && r.passed && E.nodes[node.index + 1] ? 'Walk on to the next person' : 'Return to the adventure'}</button>` : ''}
        ${node ? `<button class="btn ghost wide" data-act="start" data-arg="${node.id}">${r.passed ? 'Practice again' : 'Try again'}</button>` : ''}
        ${home === 'world' ? '' : `<button class="btn ghost wide" data-act="go" data-arg="${node ? 'path' : 'review'}">Back</button>`}</div></div>`;
    if (node && KG.world && KG.world.ok) KG.world.onLessonDone(node, r);
    P = null;
    renderTop();
  }

  // ── review ──────────────────────────────────────────────────
  function renderReview() {
    const due = E.dueWords(), M = S().mistakes, studied = Object.keys(S().vocab).length, dueC = E.dueCards();
    const boxes = [1, 2, 3, 4, 5, 6, 7].map(b => Object.values(S().vocab).filter(r => r.box === b).length);
    const maxB = Math.max(1, ...boxes);
    main.innerHTML = `${questsCard()}<h1 class="vh">Review</h1>
      <p class="muted">Spaced repetition shows you each word just before you would forget it. A few minutes a day keeps every word alive.</p>
      <div class="card big-cta ${due.length ? 'hot' : ''}">
        <div><h3>🔁 Daily review</h3><p>${due.length ? `<b>${due.length}</b> word${due.length > 1 ? 's' : ''} ready for review` : studied ? 'All words caught up!' : 'Finish a vocabulary lesson to start your deck.'}${dueC.length ? `<br>🔍 <b>${dueC.length}</b> use${dueC.length > 1 ? 's' : ''} to spot again: ${dueC.slice(0, 3).map(c => esc(c.name)).join(', ')}${dueC.length > 3 ? '…' : ''}` : ''}</p></div>
        <button class="btn primary" data-act="review" ${due.length || dueC.length ? '' : 'disabled'}>Start</button></div>
      <div class="card big-cta"><div><h3>📝 Mistake notebook</h3><p>${M.length ? `<b>${M.length}</b> question${M.length > 1 ? 's' : ''} you missed recently` : 'No mistakes saved. Nice!'}</p></div>
        <button class="btn primary" data-act="mistakes" ${M.length ? '' : 'disabled'}>Fix</button></div>
      <div class="card big-cta"><div><h3>🎯 Weakest words</h3><p>Extra practice on the words you miss most.</p></div>
        <button class="btn primary" data-act="weak" ${studied >= 4 ? '' : 'disabled'}>Drill</button></div>
      <div class="card big-cta"><div><h3>🧩 Weakest concepts</h3><p>${E.weakCards(1).length ? 'The uses you miss most, spotted in real Greek again.' : 'Play a concept lesson to start tracking these.'}</p></div>
        <button class="btn primary" data-act="weakc" ${E.weakCards(1).length ? '' : 'disabled'}>Drill</button></div>
      <div class="card big-cta"><div><h3>⚔️ Cram for the quiz</h3><p>Fifteen questions from the whole chapter: words, uses and mix-ups.</p></div>
        <button class="btn primary" data-act="cram">Go</button></div>
      <div class="card"><h3>Your memory boxes</h3><p class="muted">Each correct review moves a word up a box and doubles the wait. Box 4+ = mastered.</p>
        <div class="boxes">${boxes.map((c, i) => `<div class="bx"><div class="bxbar"><i style="height:${(c / maxB) * 100}%"></i></div><b>${c}</b><span>Box ${i + 1}</span></div>`).join('')}</div></div>`;
  }
  function questsCard() {
    const d = E.daily();
    return `<div class="card quests"><h3>📋 Today's quests</h3>${d.quests.map(q => `<div class="quest ${q.done ? 'done' : ''}"><span>${q.done ? '✅' : '◻'} ${esc(q.text)}</span><span class="qbar"><i style="width:${q.prog / q.goal * 100}%"></i></span><b>${q.prog}/${q.goal}</b></div>`).join('')}
      <p class="muted small">Each quest: +15 🪙 and +25 XP. New quests every day.</p></div>`;
  }
  KG.app_questsCard = questsCard;
  function startVillain(unit) {
    closeSheet();
    const qs = E.villainQuestions(unit);
    if (!qs.length) return toast('Skulch is nowhere to be seen. 🕳');
    begin({ qs, mode: 'villain', villain: unit });
  }
  function startReview(kind) {
    let words, qs;
    if (kind === 'mistakes') {
      qs = S().mistakes.slice(0, 15).map(m => Object.assign({ type: 'mc' }, m, { options: m.options.slice() }));
      return begin({ qs: shuffle(qs), mode: 'mistakes' });
    }
    if (kind === 'weakc') return begin({ qs: E.weakCards(10).map(c => E.conceptQ(c)), mode: 'review' });
    if (kind === 'cram') {
      const nodes = E.nodes.filter(n => n.type !== 'boss');
      qs = shuffle(nodes.flatMap(n => sample(E.questionsFor(n).filter(q => q.type === 'mc'), 2))).slice(0, 15);
      return begin({ qs, mode: 'review' });
    }
    words = kind === 'review' ? E.reviewOrder(E.dueWords()).slice(0, 15) : E.weakWords(10);
    const studied = Object.keys(S().vocab).map(g => E.vocabByGreek[g]).filter(Boolean);
    qs = words.map(w => E.vocabQ(w, studied.length > 8 ? studied : KG.vocab, (S().vocab[w.g] || {}).box >= 3 ? 'e2g' : U.pick(['g2e', 'g2e', 'hook'])));
    // uses that have come due are woven in among the words
    if (kind === 'review') for (const c of E.dueCards().slice(0, 8)) qs.splice(Math.floor(Math.random() * (qs.length + 1)), 0, E.conceptQ(c));
    begin({ qs, mode: 'review' });
  }

  // ── arcade ──────────────────────────────────────────────────
  const GAMES = {
    rain: { name: 'Word Rain', icon: '🌧', desc: 'Catch each falling word that means the English target. Every fifth word is golden.', mini: true, medals: [10, 25, 45] },
    defense: { name: 'Sorting Spell', icon: '🔮', desc: 'Strike each falling Greek line with its use.', mini: true, medals: [8, 20, 35] },
    race: { name: 'Sentence Race', icon: '🏁', desc: 'Build sentence after sentence of the translation, piece by piece.', mini: true, medals: [12, 30, 50] },
    lightning: { name: 'Vocab Lightning', icon: '⚡', desc: 'Rapid-fire meanings, due words first.', medals: [12, 22, 35] },
    hooks: { name: 'Hook Hunt', icon: '🪝', desc: 'The hook is the clue. Whose is it?', medals: [10, 18, 30] },
    spot: { name: 'Spot Rush', icon: '🔍', desc: 'Real Greek, one use highlighted. Name it, fast.', medals: [8, 15, 24] },
  };
  // bronze, silver and gold for each game's score
  const MEDALS = ['🥉', '🥈', '🥇'];
  const medalOf = (k, score) => GAMES[k].medals.filter(m => score >= m).length;
  function renderArcade() {
    const card = ([k, g]) => { const best = S().arcade[k] || 0, m = medalOf(k, best), nx = g.medals[m];
      return `<div class="card game"><div class="gic">${g.icon}</div><div class="gtx"><h3>${g.name} ${m ? MEDALS[m - 1] : ''}</h3><p>${g.desc}</p>
      <p class="muted">Best: <b>${best}</b>${nx ? ` · ${MEDALS[m]} at ${nx}` : ' · all medals won!'}</p></div><button class="btn primary" data-act="arcade" data-arg="${k}" ${g.mini && !use3D() ? 'disabled title="Needs 3D (Profile → Settings)"' : ''}>Play</button></div>`;
    };
    main.innerHTML = `<h1 class="vh">Arcade</h1><p class="muted">60-second high-score rounds. Mistakes cost time; right answers in a row multiply your score.</p>
      <h2>⚔ 3D spell games</h2>${Object.entries(GAMES).filter(([, g]) => g.mini).map(card).join('')}
      <h2>⚡ Speed rounds</h2>${Object.entries(GAMES).filter(([, g]) => !g.mini).map(card).join('')}`;
  }
  function arcadeQ(kind) {
    let pool = Object.keys(S().vocab).map(g => E.vocabByGreek[g]).filter(Boolean);
    if (pool.length < 8) pool = KG.vocab;
    if (kind === 'lightning') {
      // due words come up first; every answer goes back into review
      const order = E.reviewOrder(pool), w = Math.random() < 0.7 ? order[Math.floor(Math.random() * Math.min(6, order.length))] : U.pick(pool);
      return E.mc('Meaning?', w.short, sample(pool.filter(x => x.short !== w.short), 3).map(x => x.short), { big: w.g, vkey: S().vocab[w.g] ? w.g : '' });
    }
    if (kind === 'hooks') { const w = U.pick(pool.filter(x => x.mn)); return E.mc(`🪝 “${esc(w.mn)}”`, w.g, sample(pool.filter(x => x !== w), 3).map(x => x.g), { greekOpts: true }); }
    const c = U.pick(E.unlockedCards());
    return E.spotQ(c, KG.cards);
  }
  const MINI_ARCADE_HELP = { rain: MINI_HELP.rain, defense: MINI_HELP.defense, race: MINI_HELP.race };
  let A = null;
  function startArcade(kind) {
    const mini = !!GAMES[kind].mini;
    if (mini && !use3D()) return toast('This game needs 3D. Turn on “Play lessons in 3D” in Profile → Settings.');
    A = { kind, mini, score: 0, combo: 0, best: S().arcade[kind] || 0, left: 60000, last: performance.now(), timer: null, is3D: use3D() };
    if (A.is3D) enterStage('arcade', 0); else document.body.classList.add('playing');
    main.innerHTML = `<div class="s3">${arcadeHead()}</div>`;
    // 3, 2, 1, go! The game and its clock start after the countdown.
    const cd = document.createElement('div'); cd.className = 'countdown'; document.body.appendChild(cd);
    const me = A;
    ['3', '2', '1', 'GO!'].forEach((n, k) => setTimeout(() => {
      if (A !== me) return cd.remove();
      cd.textContent = n; cd.classList.remove('pop'); void cd.offsetWidth; cd.classList.add('pop'); sfx(k < 3 ? 'tap' : 'combo');
      if (k === 3) { A.last = performance.now(); A.timer = setInterval(tickArcade, 100); if (mini) arcadeMini(); else arcadeNext(); setTimeout(() => cd.remove(), 600); }
    }, k * 650));
  }
  function arcadeHead() {
    return `<div class="ph"><button class="x" data-act="quitArcade" aria-label="Quit">✕</button>
      <div class="atimer"><span id="atime">60</span>s</div><div class="ascore">⭐ <span id="ascore">${A.score}</span></div></div>
      <div class="abar"><div class="abest"><i id="abest" style="width:${bestPct()}%"></i>${GAMES[A.kind].medals.map((m, k) => `<em style="left:${Math.min(100, m / barMax() * 100)}%">${MEDALS[k]}</em>`).join('')}</div><span class="acombo" id="acombo">${comboText()}</span></div>`;
  }
  // scoring: right answers in a row build a multiplier (×2 at 3, ×3 at 6, ×4 at 9); a miss resets it
  const mult = () => Math.min(4, 1 + Math.floor(A.combo / 3));
  const comboText = () => A.combo >= 3 ? `🔥 ${A.combo} in a row · ×${mult()}` : A.best ? `Best ${A.best}` : '';
  const barMax = () => Math.max(A.best, GAMES[A.kind].medals[2]) * 1.05;
  const bestPct = () => Math.min(100, A.score / barMax() * 100);
  function arcadeHit(times = 1) {
    const before = mult(); A.combo++;
    const pts = mult() * times; A.score += pts;
    if (mult() > before) { sfx('combo'); toast(`🔥 <b>×${mult()} multiplier!</b>`); }
    const before2 = medalOf(A.kind, A.score - pts), now = medalOf(A.kind, A.score);
    if (now > before2) { sfx('win'); toast(`${MEDALS[now - 1]} <b>${['Bronze', 'Silver', 'Gold'][now - 1]} medal score!</b>`, 'gold'); }
    if (A.best && A.score > A.best && A.score - pts <= A.best) toast('🏅 <b>New best!</b> Keep going!', 'gold');
    floatXP(`+${pts}`, $('.ascore'));
    arcadeScore();
  }
  function arcadeMiss(sec) {
    A.combo = 0; A.left -= sec * 1000; floatXP(`−${sec}s`, $('.atimer')); arcadeScore();
  }
  function tickArcade() {
    if (!A) return;
    const now = performance.now();
    A.left -= now - A.last; A.last = now;
    const left = Math.max(0, A.left);
    const t = $('#atime'); if (t) { t.textContent = Math.ceil(left / 1000); t.parentElement.style.setProperty('--t', left / 60000); }
    if (left <= 0) endArcade();
  }
  const arcadeScore = () => {
    const e = $('#ascore'); if (e) e.textContent = A.score;
    const b = $('#abest'); if (b) b.style.width = bestPct() + '%';
    const c = $('#acombo'); if (c) { c.textContent = comboText(); c.classList.toggle('hot', A.combo >= 3); }
  };
  function arcadeMini() {
    const q = E.arcadeMini(A.kind);
    Object.assign(q, { onHit: n => { if (A && A.q === q) arcadeHit(n); }, onMiss: () => { if (A && A.q === q) arcadeMiss(2); },
      onWord: (g, ok) => { if (S().vocab[g]) { E.srsAnswer(g, ok); S().stats.reviews++; E.questProgress('reviews'); } } });
    A.q = q;
    main.innerHTML = `<div class="s3">${arcadeHead()}<div class="s3center"><div class="minititle">🎮 ${esc(GAMES[A.kind].name)}</div></div><div class="foot s3foot"><div class="muted center s3help">${MINI_ARCADE_HELP[A.kind]}</div></div></div>`;
    ST().mini(q, () => { if (A && A.q === q) arcadeMini(); });
    tickArcade();
  }
  function arcadeNext() {
    A.q = arcadeQ(A.kind);
    const q = A.q;
    if (A.is3D) {
      main.innerHTML = `<div class="s3">${arcadeHead()}</div>`;
      A.lock = false;
      ST().ask(q, { pick: i => arcadePick(i) });
      return tickArcade();
    }
    main.innerHTML = `<div class="player arcade">${arcadeHead()}
      <div class="qbody"><div class="prompt">${q.prompt}</div>${q.big ? `<div class="bigword ${q.small ? 'small' : ''}"><span class="gk">${esc(q.big)}</span></div>` : ''}${q.sub && q.small ? `<div class="subword">${esc(q.sub)}</div>` : ''}
      <div class="opts">${q.options.map((o, i) => `<button class="opt ${q.greekOpts ? 'gk' : ''}" data-act="apick" data-arg="${i}"><span class="k">${i + 1}</span>${esc(o)}</button>`).join('')}</div></div></div>`;
    tickArcade();
  }
  function arcadePick(i, el) {
    if (!A || A.lock) return;
    const ok = +i === A.q.answer;
    A.lock = true;
    if (A.is3D) ST().reveal(ok, +i, A.q.answer);
    else {
      el.classList.add(ok ? 'right' : 'wrong');
      if (!ok) document.querySelectorAll('.opt')[A.q.answer].classList.add('right');
    }
    if (!ok) { arcadeMiss(3); sfx('bad'); } else { arcadeHit(); sfx('good'); }
    if (A.q.vkey) E.srsAnswer(A.q.vkey, ok);
    if (A.q.cid) E.cardAnswer(A.q.cid, ok);
    setTimeout(() => { if (A) { A.lock = false; arcadeNext(); } }, A.is3D ? (ok ? 700 : 1100) : (ok ? 250 : 700));
  }
  function endArcade() {
    if (!A) return;
    clearInterval(A.timer);
    const { kind, score, is3D, mini } = A; A = null;
    if (is3D) { if (mini) ST().stopMini(); ST().celebrate(score > 0); }
    const best = S().arcade[kind] || 0, record = score > best;
    if (record) S().arcade[kind] = score;
    const xp = score * 2, coins = Math.floor(score / 5), medal = medalOf(kind, score), oldMedal = medalOf(kind, best);
    if (xp) E.gainXP(xp, coins); else E.save();
    E.checkAchievements();
    if (record && score) { sfx('win'); confetti(); }
    const nx = GAMES[kind].medals[medal];
    main.innerHTML = `<div class="results ${is3D ? 's3card' : ''}"><h1>${record && score ? '🏅 New high score!' : '⏱ Time!'}</h1>
      <div class="amedal">${medal ? `<span class="big">${MEDALS[medal - 1]}</span> ${['Bronze', 'Silver', 'Gold'][medal - 1]}${medal > oldMedal ? ' · <b>new medal!</b>' : ''}` : 'No medal yet'}${nx ? `<div class="muted small">${MEDALS[medal]} at ${nx} points. ${nx - score} to go!</div>` : ''}</div>
      <div class="rstats"><div><b>${score}</b><span>score</span></div><div><b>${Math.max(best, score)}</b><span>best</span></div><div><b>+${xp}</b><span>XP</span></div><div><b>+${coins}</b><span>🪙</span></div></div>
      <div class="col-btns"><button class="btn primary wide" data-act="arcade" data-arg="${kind}">Play again</button><button class="btn ghost wide" data-act="go" data-arg="arcade">Back</button></div></div>`;
    renderTop();
  }

  // ── codex ───────────────────────────────────────────────────
  function readiness() {
    const words = KG.vocab.length, studied = KG.vocab.filter(w => S().vocab[w.g]).length, mastered = KG.vocab.filter(w => (S().vocab[w.g] || {}).box >= 3).length;
    const lessons = E.nodes.filter(n => n.type !== 'boss'), done = lessons.filter(n => E.stars(n.id)).length;
    const C = S().cards || {}, seen = KG.cards.filter(c => C[c.id]), solid = seen.filter(c => C[c.id].last && C[c.id].right > C[c.id].wrong).length;
    const score = 0.25 * studied / words + 0.25 * mastered / words + 0.2 * done / lessons.length + 0.3 * solid / KG.cards.length;
    const stages = [[0, 'Just arrived'], [0.15, 'Finding your feet'], [0.35, 'Getting there'], [0.6, 'Nearly ready'], [0.85, 'Quiz ready']];
    return { score: Math.min(1, score), stage: stages.filter(s => s[0] <= score).pop()[1], studied, mastered, words, done, lessons: lessons.length, solid };
  }
  let lexFilter = '';
  function renderCodex() {
    const r = readiness(), readings = E.nodes.filter(n => n.type === 'reading');
    main.innerHTML = `<h1 class="vh">Codex</h1>
      <div class="card prof"><div class="ring" style="--p:${r.score * 360}deg"><span>${Math.round(r.score * 100)}%</span></div>
        <div><div class="muted">Quiz readiness · Chapter ${KG.CHAPTERS.join(', ')}</div><h3>${r.stage}</h3>
        <p>📜 Words studied <b>${r.studied}/${r.words}</b> · solid in review <b>${r.mastered}</b></p>
        <p>🧩 Concepts you get right <b>${r.solid}/${KG.cards.length}</b> · 🗺 stops cleared <b>${r.done}/${r.lessons}</b></p></div></div>
      <h2>📕 Spellbook <span class="muted small">${Object.keys(S().spells || {}).length}/${Object.keys(KG.teach).length} spells learned</span></h2>
      <p class="muted small">Every concept lesson you finish adds a spell: its hooks, examples and warnings, ready to study any time.</p>
      <div class="spellbook">${E.nodes.filter(n => n.type === 'grammar').map(n => {
        const T = KG.teach[n.lesson], have = (S().spells || {})[n.lesson];
        return have ? `<button class="spellcard" data-act="learn" data-arg="${n.id}"><span class="sp-ic">${T.spell.icon}</span><b>${esc(T.spell.name)}</b><span>${esc(T.spell.desc)}</span></button>`
          : `<button class="spellcard locked" data-act="open" data-arg="${n.id}"><span class="sp-ic">🔒</span><b>Unknown spell</b><span>Learn it in “${esc(n.title)}”</span></button>`;
      }).join('')}</div>
      <h2>🪝 Hook book</h2>
      <p class="muted small">Every memory hook in the chapter, in one place. Read it top to bottom before the quiz.</p>
      ${KG.units.filter(u => u.set).map(u => {
        const set = KG.setById[u.set];
        return `<details class="hookbook"><summary>${esc(set.place)} <b>${esc(set.name)}</b> <span class="muted small">${esc(set.placeName)}</span><div class="hb-master">🪝 ${esc(set.masterMnemonic)}</div></summary>
          ${set.masterMnemonicWhy ? `<p class="small muted">${esc(set.masterMnemonicWhy)}</p>` : ''}
          ${set.groups.map(g => `<div class="hb-group"><div><b>${esc(g.spot)} ${esc(g.name)}</b></div><div class="hb-key">${esc(g.key)} — ${esc(g.mnemonic)}</div>${g.scene ? `<div class="small muted">${esc(g.scene)}</div>` : ''}
            <ul>${KG.cards.filter(c => c.group === g.id).map(c => `<li>${esc(c.pic)} <b>${esc(c.name)}</b>: ${esc(c.mnemonic)}</li>`).join('')}</ul></div>`).join('')}</details>`;
      }).join('')}
      ${KG.confusions.length ? `<details class="hookbook"><summary>⚔️ <b>The Mix-Ups</b> <span class="muted small">one test for each pair</span></summary><ul>${KG.confusions.map(cf => `<li><b>${esc(cf.question)}</b> 🔎 ${esc(cf.test)}</li>`).join('')}</ul></details>` : ''}
      <h2>Scroll collection</h2><div class="verses">${readings.map(n => {
        const R = KG.readings[n.reading], have = E.stars(n.id) > 0;
        return `<button class="vtile ${have ? '' : 'locked'}" data-act="${have ? 'readVerse' : 'open'}" data-arg="${have ? n.reading : n.id}">
          <b>${esc(R.ref)}</b><span class="gk">${have ? esc(E.sentence(R)) : '? ? ?'}</span></button>`;
      }).join('')}</div>
      <details class="lexbox" ${lexFilter ? 'open' : ''}><summary>Word list <span class="muted small">${r.studied}/${r.words} studied</span></summary>
      <input id="lexq" class="search" placeholder="Search Greek, English or a hook…" value="${esc(lexFilter)}">
      <div id="lex" class="lex"></div></details>
      <p class="muted small center">Words from <a href="https://github.com/${esc(KG.source.sources.vocab.repo)}">${esc(KG.source.sources.vocab.repo)}</a>, concepts from <a href="https://github.com/${esc(KG.source.sources.concepts.repo)}">${esc(KG.source.sources.concepts.repo)}</a>. Content ${esc(KG.source.hash)}.</p>`;
    renderLex();
    $('#lexq').addEventListener('input', e => { lexFilter = e.target.value; renderLex(); });
  }
  function renderLex() {
    const q = U.bare(lexFilter.trim());
    const rows = KG.vocab.filter(w => !q || U.bare(w.g).includes(q) || w.en.toLowerCase().includes(q) || w.mn.toLowerCase().includes(q));
    $('#lex').innerHTML = rows.map(w => {
      const r = S().vocab[w.g], box = r ? r.box : 0;
      return `<div class="lexrow ${r ? '' : 'unseen'}" data-act="say" data-arg="${esc(w.g)}" title="${esc(w.mn)}"><span class="gk">${esc(w.icon)} ${esc(w.lex)}</span><span>${esc(w.en)}</span>
        <span class="dots" title="${r ? 'Box ' + box : 'Not studied yet'}">${[1, 2, 3, 4, 5, 6, 7].map(b => `<i class="${b <= box ? 'on' : ''}"></i>`).join('')}</span><span class="muted small">${w.f}×</span>${w.mn ? `<span class="lexhook">🪝 ${esc(w.mn)}</span>` : ''}</div>`;
    }).join('') || '<p class="muted">No matches.</p>';
  }
  function readVerse(id) {
    const R = KG.readings[id]; readerReading = R;
    sheet(`<div class="sheet-k">Scroll collection</div><h2>${esc(R.ref)}</h2>${verseHTML(R, 'big')}
      <div id="wordinfo" class="wordinfo muted">Tap a word…</div><p><i>${esc(R.tr)}</i></p><p class="tip">💡 ${esc(R.note)}</p>`);
  }

  // ── profile ─────────────────────────────────────────────────
  function wardrobeCard() {
    const L = E.look(), slots = { robe: '👘 Robes', hat: '🎩 Hats', staff: '🪄 Staffs', pet: '🐾 Companions' };
    return `<div class="card"><h3>🧥 Wardrobe <span class="muted small">win items from guardians' chests or buy them</span></h3>
      ${Object.entries(slots).map(([slot, label]) => `<div class="wr-slot"><div class="wr-h">${label}</div><div class="wr-items">${KG.wardrobe[slot].map(it => {
        const own = E.ownItem(slot, it.id), on = L[slot] === it.id;
        const sw = slot === 'robe' ? `<span class="wr-sw" style="background:#${it.color.toString(16).padStart(6, '0')}"></span>` : `<span class="wr-ic">${it.icon}</span>`;
        return `<button class="wr ${on ? 'on' : ''} ${own ? '' : 'locked'}" data-act="${own ? 'equip' : 'buyItem'}" data-arg="${slot}:${it.id}">${sw}<b>${esc(it.name)}</b><span>${on ? 'Wearing' : own ? 'Wear' : it.price + ' 🪙'}</span></button>`;
      }).join('')}</div></div>`).join('')}</div>`;
  }
  function renderProfile() {
    const s = S(), lv = E.levelInfo(), st = s.stats;
    const days = Array.from({ length: 7 }, (_, i) => U.addDays(U.day(), i - 6));
    const maxD = Math.max(s.dailyGoal, ...days.map(d => s.history[d] || 0));
    main.innerHTML = `<h1 class="vh">Profile</h1>${questsCard()}
      <div class="card lvcard"><div class="lvbig">${lv.level}</div><div class="grow"><div class="muted">Level ${lv.level}</div><h3>${lv.title}</h3>
        <div class="xpbar"><i style="width:${(lv.cur / lv.need) * 100}%"></i></div><div class="muted small">${lv.cur} / ${lv.need} XP to level ${lv.level + 1} · ${s.xp} XP total</div></div></div>
      <div class="statgrid">
        <div><b>🔥 ${s.streak}</b><span>day streak</span></div><div><b>🏅 ${s.bestStreak}</b><span>best streak</span></div>
        <div><b>🧊 ${s.freezes}</b><span>streak freezes</span></div><div><b>✅ ${st.answered ? Math.round(st.correct / st.answered * 100) : 0}%</b><span>accuracy</span></div>
        <div><b>📚 ${st.lessons}</b><span>lessons</span></div><div><b>⚡ ${st.bestCombo}</b><span>best combo</span></div></div>
      <div class="card"><h3>This week</h3><div class="week">${days.map(d => {
        const v = s.history[d] || 0, dn = new Date(d + 'T12:00').toLocaleDateString(undefined, { weekday: 'narrow' });
        return `<div class="wd"><div class="wbar"><i class="${v >= s.dailyGoal ? 'hit' : ''}" style="height:${(v / maxD) * 100}%"></i><em style="bottom:${(s.dailyGoal / maxD) * 100}%"></em></div><b>${v}</b><span>${dn}</span></div>`;
      }).join('')}</div></div>
      <div class="card"><h3>Shop <span class="muted small">you have ${s.coins} 🪙</span></h3>
        <div class="shop"><div><b>🧊 Streak freeze</b><p class="muted small">Protects your streak for one missed day (max 2).</p><button class="btn primary" data-act="buy" data-arg="freeze">50 🪙</button></div>
        <div><b>🚀 XP boost</b><p class="muted small">Double XP on your next 3 lessons${s.boost ? ` (${s.boost} left)` : ''}.</p><button class="btn primary" data-act="buy" data-arg="boost">80 🪙</button></div></div></div>
      ${KG.cloud ? KG.cloud.card() : ''}
      ${wardrobeCard()}
      <div class="card"><h3>🏆 Trophy room <span class="muted small">${Object.keys(s.ach).length}/${KG.achievements.length}</span></h3>
        <div class="achs">${KG.achievements.map(a => `<div class="ach ${s.ach[a.id] ? 'got' : ''}" title="${esc(a.desc)}"><div class="ai">${a.icon}</div><b>${esc(a.name)}</b><span>${esc(a.desc)}</span></div>`).join('')}</div></div>
      <div class="card settings"><h3>Settings</h3>
        <label>Daily goal <select id="goalsel">${[20, 50, 100, 200].map(g => `<option value="${g}" ${g === s.dailyGoal ? 'selected' : ''}>${g} XP · ${{ 20: 'Casual', 50: 'Regular', 100: 'Serious', 200: 'Intense' }[g]}</option>`).join('')}</select></label>
        <label class="tg"><input type="checkbox" id="setsound" ${s.settings.sound ? 'checked' : ''}><span>Sound effects</span></label>
        <label class="tg"><input type="checkbox" id="setspeech" ${s.settings.speech ? 'checked' : ''}><span>Read Greek aloud <span class="muted small">(uses your device's Greek voice, modern pronunciation)</span></span></label>
        <label>After each answer <select id="autosel">${[['fast', 'Move on quickly'], ['normal', 'Move on automatically'], ['relaxed', 'Move on slowly (more time to read)'], ['off', 'Wait for me to tap Continue']].map(([k, t]) => `<option value="${k}" ${(s.settings.autoAdvance || 'normal') === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label>Graphics <select id="gfxsel"><option value="high" ${(s.settings.gfx || 'high') === 'high' ? 'selected' : ''}>High (grass, shadows, effects)</option><option value="low" ${s.settings.gfx === 'low' ? 'selected' : ''}>Low (smoother on older phones)</option></select></label>
        <label>If I miss a day <select id="raidsel">${[['off', 'Nothing happens'], ['some', 'A few raiders come'], ['many', 'A horde of raiders comes']].map(([k, t]) => `<option value="${k}" ${(s.settings.raiders || 'some') === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="tg"><input type="checkbox" id="set3d" ${s.settings.mode3d !== false ? 'checked' : ''}><span>Play lessons in 3D <span class="muted small">(turn off for simple 2D cards on older devices)</span></span></label>
        <label class="tg"><input type="checkbox" id="setunlock" ${s.settings.unlockAll ? 'checked' : ''}><span>Unlock all lessons <span class="muted small">(if you already know some Greek)</span></span></label>
        <div class="row"><button class="btn ghost" data-act="export">⬇ Export progress</button><button class="btn ghost" data-act="import">⬆ Import</button><button class="btn danger" data-act="reset">Reset</button></div>
        <input type="file" id="importfile" accept="application/json" hidden></div>
      <p class="muted small center">Built on Koine Quest. Content from your Going Deeper vocab and concepts apps. Progress is saved on this device only. Export it to move between devices.</p>`;
    $('#goalsel').onchange = e => { s.dailyGoal = +e.target.value; E.save(); renderTop(); };
    $('#setsound').onchange = e => { s.settings.sound = e.target.checked; E.save(); };
    $('#setspeech').onchange = e => { s.settings.speech = e.target.checked; E.save(); if (e.target.checked) speak('Ἐν ἀρχῇ ἦν ὁ λόγος'); };
    $('#gfxsel').onchange = e => { s.settings.gfx = e.target.value; E.save(); toast('Graphics setting saved. It applies the next time the app opens.'); };
    $('#autosel').onchange = e => { s.settings.autoAdvance = e.target.value; E.save(); };
    $('#raidsel').onchange = e => { s.settings.raiders = e.target.value; if (e.target.value === 'off' && s.raiders) s.raiders.count = 0; E.save(); };
    $('#set3d').onchange = e => { s.settings.mode3d = e.target.checked; E.save(); };
    $('#setunlock').onchange = e => { s.settings.unlockAll = e.target.checked; E.save(); };
    $('#importfile').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(t => { E.importState(t); toast('Progress imported ✔'); go('profile'); }).catch(err => toast('Import failed: ' + esc(err.message)));
    };
  }

  // ── actions (event delegation) ──────────────────────────────
  const ACT = {
    go, open: openNode, closeSheet, learn: id => showLearn(id, false), start: startNode,
    say: t => speak(t), word: i => wordInfo(i),
    quit: () => { if (P && P.i > 0 && !confirm('Quit this lesson? Your progress in it will be lost.')) return; P = null; go(view === 'review' ? 'review' : home); },
    pick(i, el) {
      if (!P || P.answered) return;
      const q = P.q, ok = +i === q.answer;
      document.querySelectorAll('.opt').forEach((b, k) => { b.disabled = true; if (k === q.answer) b.classList.add('right'); });
      if (!ok) el.classList.add('wrong');
      answer(ok, q);
    },
    mt(arg, el) {
      if (!P || P.answered || el.classList.contains('matched')) return;
      const m = P.match, side = arg[0], idx = arg.slice(1);
      sfx('tap');
      if (!m.sel || m.sel.side === side) {
        if (m.sel) m.sel.el.classList.remove('sel');
        m.sel = { side, idx, el }; el.classList.add('sel'); return;
      }
      if (m.sel.idx === idx) {
        el.classList.add('matched'); m.sel.el.classList.add('matched'); m.sel.el.classList.remove('sel');
        m.sel = null; m.done++;
        if (m.done === P.q.pairs.length) answer(m.miss === 0, Object.assign({}, P.q, { explain: m.miss ? `${m.miss} mismatch${m.miss > 1 ? 'es' : ''}. Keep at it!` : 'All pairs matched perfectly!' }));
      } else {
        m.miss++; sfx('bad');
        const a = m.sel.el; a.classList.add('shake'); el.classList.add('shake');
        setTimeout(() => { a.classList.remove('shake', 'sel'); el.classList.remove('shake'); }, 400);
        m.sel = null;
      }
    },
    place(k) { if (P.answered) return; const o = P.order; o.line.push(o.bank.splice(+k, 1)[0]); sfx('tap'); renderOrder(); },
    unplace(k) { if (P.answered) return; const o = P.order; o.bank.push(o.line.splice(+k, 1)[0]); renderOrder(); },
    checkOrder() {
      if (P.answered) return;
      const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
      const line = P.is3D ? ST().orderLine() : P.order.line.map(c => c.t);
      const got = norm(line.join(' ')), want = norm(P.q.chunks.join(' '));
      if (P.is3D) ST().lock();
      const tr = P.q.reading ? KG.readings[P.q.reading].tr : P.q.tr;
      answer(got === want, Object.assign({}, P.q, { explain: `${got === want ? '' : 'Correct order: '}<i>${esc(tr)}</i>` }));
      document.querySelectorAll('.tile').forEach(t => t.disabled = true);
    },
    compare() {
      const R = KG.readings[P.q.reading], mine = ($('#freetr').value || '').trim();
      $('#foot').innerHTML = `<div class="fb"><div class="fb-h">Model translation</div><div class="fb-d"><i>${esc(R.tr)}</i><br><span class="muted">💡 ${esc(R.note)}</span></div></div>
        <div class="muted small center">${mine ? 'How did yours compare? Be honest. Translations can differ in wording and still be right.' : 'Try writing your own next time: producing a translation builds real fluency.'}</div>
        <div class="row"><button class="btn bad" data-act="selfgrade" data-arg="0">Missed the meaning</button><button class="btn good" data-act="selfgrade" data-arg="1">Got the meaning ✔</button></div>`;
    },
    selfgrade(v) {
      if (v === '1') { P.xp += 15; floatXP('+15 XP', $('.prompt')); sfx('good'); }
      next();
    },
    next: () => next(),
    // a hook as a hint: half XP for that answer, no combo bonus
    hook() {
      if (!P || P.answered || !P.q.hint) return;
      const box = $('#hintbox'); if (!box) return;
      P.hinted = P.i; box.hidden = false; box.innerHTML = `🪝 ${esc(P.q.hint)}`; sfx('tap');
    },
    villain: u => startVillain(+u),
    review: () => startReview('review'), mistakes: () => startReview('mistakes'), weak: () => startReview('weak'), weakc: () => startReview('weakc'), cram: () => startReview('cram'),
    arcade: k => startArcade(k), apick: (i, el) => arcadePick(i, el),
    quitArcade: () => { if (A) { clearInterval(A.timer); if (A.mini && A.is3D) ST().stopMini(); } A = null; go('arcade'); },
    readVerse,
    equip: a => { const [sl, id] = a.split(':'); if (E.equip(sl, id)) { sfx('tap'); renderProfile(); } },
    buyItem: a => {
      const [sl, id] = a.split(':'), it = KG.wardrobe[sl].find(x => x.id === id);
      if (S().coins < it.price) return toast(`You need ${it.price} 🪙 for the ${esc(it.name)}. Keep learning!`);
      if (!confirm(`Buy the ${it.name} for ${it.price} coins?`)) return;
      if (E.buyItem(sl, id)) { sfx('win'); toast(`🧥 ${esc(it.name)} is yours!`, 'gold'); renderProfile(); renderTop(); }
    },
    hint: id => { const R = KG.readings[id]; readerReading = R; sheet(`<div class="sheet-k">Word help</div><h2>${esc(R.ref)}</h2>${verseHTML(R, 'big')}<div id="wordinfo" class="wordinfo muted">Tap any word for its meaning and parsing.</div>`); },
    buy(item) {
      if (E.buy(item)) { sfx('win'); toast(item === 'freeze' ? '🧊 Streak freeze equipped!' : '🚀 XP boost active for 3 lessons!'); renderProfile(); renderTop(); }
      else toast(item === 'freeze' && S().freezes >= 2 ? 'You can hold at most 2 freezes.' : 'Not enough 🪙 yet. Keep learning!');
    },
    export() {
      const blob = new Blob([JSON.stringify(S(), null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `going-deeper-quest-${U.day()}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    import: () => $('#importfile').click(),
    reset() { if (confirm('Erase ALL progress? This cannot be undone.')) { E.reset(); toast('Progress reset.'); go('path'); } },
  };
  document.addEventListener('click', e => {
    const fb = e.target.closest('.foot.ok, .foot.no');
    if (fb && !e.target.closest('button, textarea, a') && $('#nextbtn')) { $('#nextbtn').click(); return; }
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = ACT[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el.dataset.arg, el); }
  });
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (/^[1-4]$/.test(e.key)) {
      const opt = document.querySelectorAll(A ? '.opt' : '.opt:not(:disabled)')[+e.key - 1];
      if (opt) opt.click();
    } else if (e.key === 'h' && P && !A) ACT.hook();
    else if (e.key === 'Enter') { const b = $('#nextbtn') || $('#checkbtn:not(:disabled)'); if (b) { e.preventDefault(); b.click(); } }
    else if (e.key === 'Escape') closeSheet();
  });

  // ── boot ────────────────────────────────────────────────────
  const msg = E.checkStreak();
  renderTop();
  KG.app = { go, startNode, startVillain, openNode, sfx, speak, toast, confetti, floatXP, renderTop, showLearn, readVerse: id => readVerse(id),
    closeSheet };
  // The 3D world loads as a module after this script; open it once it reports ready,
  // and fall back to the path map if WebGL is unavailable.
  const worldIncluded = !!document.querySelector('script[data-world]');
  const first = location.hash.slice(1) || (worldIncluded ? 'world' : 'path');
  if (first === 'world' && KG.world && KG.world.ok) go('world');
  else if (first === 'world' && worldIncluded) {
    main.innerHTML = '<div class="loading">Loading the world…</div>';
    document.addEventListener('world-ready', () => { if (main.querySelector('.loading')) go('world'); });
    document.addEventListener('world-failed', () => go('path'));
    setTimeout(() => { if (main.querySelector('.loading')) go('path'); }, 15000);
  } else go(first);
  window.addEventListener('hashchange', () => {
    const h = location.hash.slice(1);
    if (A) { clearInterval(A.timer); A = null; }
    if (h && (h !== view || P || document.body.classList.contains('playing'))) { P = null; go(h); }
  });
  if (msg) setTimeout(() => toast(msg), 400);
  if ('speechSynthesis' in window) speechSynthesis.getVoices();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
