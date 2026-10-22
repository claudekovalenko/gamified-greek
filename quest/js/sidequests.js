// Side quests out in the world, all built on spaced review: the words they ask
// for come from the host game's review queue (due words first, then weak ones),
// and every answer goes back into it.
//
//   🎣 Word Fishing   cast from a jetty; when a fish bites, name its word before it slips away
//   🔤 Rune Circle    walk (and hop) across lettered stones to spell the Greek word
//   📦 Courier        a villager needs a word; find the right glowing word nearby and carry it back
//
// Koine Quest and Going Deeper Quest share this file unchanged. The host passes
// in everything that touches its own content (see makeSideQuests' ctx).

const ALPHA = 'αβγδεζηθικλμνξοπρστυφχψω';
const bare = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ς/g, 'σ').toLowerCase().replace(/[^α-ω]/g, '');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ctx: {
//   THREE, add(obj), groundAt(x, z), mesh(geo, color, opts), textSprite(text, opts), GREEK (font),
//   person(look) → a character, animatePerson(obj, speed, dt), SPK, DUST (fx sparks), hud (element),
//   pool(n) → [{ g, en, key }] words to review, due first;  others(word, n) → wrong English glosses,
//   record(word, ok), reward(xp, coins, questId), sfx(kind), speak(greek), toast(html, cls),
//   dialog(name, html, buttons), colliders (array of {x, z, r}), free(x, z) → true if a spot is open ground
// }
export function makeSideQuests(ctx) {
  const { THREE } = ctx;
  const spots = [];     // everything this world has, rebuilt with the world
  let run = null;       // the side quest being played, if any
  const panel = document.createElement('div');
  panel.className = 'sq-panel';
  ctx.hud.appendChild(panel);
  const show = html => { panel.innerHTML = html; panel.classList.add('on'); };
  const hide = () => { panel.classList.remove('on'); panel.innerHTML = ''; };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const anims = [];
  const tween = (dur, fn, done) => { let t = 0; anims.push(dt => { t = Math.min(1, t + dt / dur); fn(t); if (t >= 1) { if (done) done(); return false; } return true; }); };

  function glowWord(text, color = '#fff2c0', bg = 'rgba(30,20,60,.55)') {
    return ctx.textSprite(text, { size: 64, bg, color, font: `700 64px ${ctx.GREEK}`, scale: 0.012 });
  }
  // the words to use: what the review queue wants, with enough letters / glosses to play
  const clean = en => String(en).replace(/\s*\([^)]*\)/g, '').trim();
  const words = (n, test = () => true) => ctx.pool(n * 4).filter(w => w && w.g && w.en && test(w)).slice(0, n).map(w => Object.assign({}, w, { en: clean(w.en) }));

  // ── 🎣 Word Fishing ─────────────────────────────────────────
  function fishing({ x, z, wx, wz, waterY }) {
    const T = THREE, g = new T.Group();
    const ang = Math.atan2(wx - x, wz - z), len = Math.min(7, Math.hypot(wx - x, wz - z) * 0.55);
    const deck = new T.Group(); deck.rotation.y = ang;
    for (let i = 0; i < 7; i++) { const p = ctx.mesh(new T.BoxGeometry(1.8, 0.12, len / 7 - 0.06), i % 2 ? 0x9a7048 : 0x8a6038); p.position.set(0, 0.55, (i + 0.5) * len / 7); deck.add(p); }
    for (const s of [-1, 1]) for (const k of [0.3, 1]) { const post = ctx.mesh(new T.CylinderGeometry(0.1, 0.1, 2.2, 6), 0x5a3a20); post.position.set(s * 0.85, -0.2, k * len); deck.add(post); }
    const bucket = ctx.mesh(new T.CylinderGeometry(0.28, 0.22, 0.45, 10), 0x6a8aa8); bucket.position.set(0.55, 0.85, 0.5); deck.add(bucket);
    g.add(deck);
    g.position.set(x, ctx.groundAt(x, z), z); ctx.add(g);
    // the bobber and the fish, hidden until needed
    const bob = new T.Group();
    const b1 = ctx.mesh(new T.SphereGeometry(0.16, 10, 8), 0xe0453a); bob.add(b1);
    const b2 = ctx.mesh(new T.SphereGeometry(0.16, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0xffffff); bob.add(b2);
    bob.visible = false; ctx.add(bob);
    const line = new T.Line(new T.BufferGeometry().setFromPoints([V(0, 0, 0), V(0, 0, 0)]), new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
    line.frustumCulled = false; line.visible = false; ctx.add(line);
    const e = { kind: 'side', sq: 'fish', obj: g, x, z, label: '🎣 Fishing jetty', tagY: 2.9, r: 0.6, water: V(wx, waterY, wz) };
    spots.push(e);
    e.bob = bob; e.line = line;
    return e;
  }
  function fishMesh(kind) {
    const T = THREE, g = new T.Group(), col = { gold: 0xffc83a, blue: 0x4a9ad8, silver: 0xc8d4e0 }[kind];
    const body = ctx.mesh(new T.SphereGeometry(0.4, 12, 8), col, { metalness: 0.4, roughness: 0.35, emissive: kind === 'gold' ? 0x6a4a00 : 0 }); body.scale.set(0.55, 0.8, 1.4); g.add(body);
    const tail = ctx.mesh(new T.ConeGeometry(0.3, 0.45, 4), col); tail.rotation.x = -Math.PI / 2; tail.position.z = -0.65; tail.scale.x = 0.3; g.add(tail);
    for (const s of [-1, 1]) { const eye = new T.Mesh(new T.SphereGeometry(0.05, 6, 6), new T.MeshBasicMaterial({ color: 0x111111 })); eye.position.set(s * 0.18, 0.08, 0.42); g.add(eye); }
    return g;
  }
  function startFishing(e) {
    const list = words(5);
    if (!list.length) return ctx.dialog('🎣 Word Fishing', '<p>The fish only bite for words you have met. Learn a few words from the teachers first!</p>', [{ label: 'OK' }]);
    run = { kind: 'fish', e, list, i: 0, caught: 0, phase: 'ready', t: 0, catches: [] };
    if (ctx.face) ctx.face(e.x, e.z, e.water.x, e.water.z);
    fishPanel();
  }
  function fishPanel(extra = '') {
    const r = run;
    show(`<div class="sq-h">🎣 Word Fishing <span class="sq-n">${r.i}/${r.list.length} · 🐟 ${r.caught}</span><button class="sq-x" data-sq="quit">✕</button></div>${extra}
      ${r.phase === 'ready' ? `<button class="btn primary wide sq-big" data-sq="cast">Cast your line</button><div class="sq-tip">When a fish bites, name its word before it slips away.</div>` : ''}
      ${r.phase === 'wait' ? '<div class="sq-wait">…waiting for a bite…</div>' : ''}`);
  }
  function cast() {
    const r = run, e = r.e, p = ctx.player.position;
    r.phase = 'wait'; r.t = 1.6 + Math.random() * 2.2; fishPanel();
    ctx.sfx('whoosh');
    const from = V(p.x, p.y + 1.8, p.z), to = e.water.clone().add(V((Math.random() - 0.5) * 2, 0.05, (Math.random() - 0.5) * 2));
    r.at = to;
    e.bob.visible = true; e.line.visible = true;
    tween(0.7, k => { e.bob.position.lerpVectors(from, to, k); e.bob.position.y += Math.sin(k * Math.PI) * 2.5; }, () => {
      ctx.sfx('splash'); ctx.SPK.emit(to, { color: 0xd8f0ff, n: 14, speed: 2.2, up: 1, gravity: -9, size: 0.25, life: 0.6 });
    });
  }
  function bite() {
    const r = run, w = r.list[r.i];
    r.phase = 'bite'; r.left = r.max = 7;
    ctx.sfx('splash'); ctx.SPK.emit(r.at, { color: 0xffffff, n: 20, speed: 2.5, up: 1.2, gravity: -9, size: 0.3, life: 0.7 });
    const opts = shuffle([w.en, ...ctx.others(w, 6).map(clean).filter((o, k, a) => o !== w.en && a.indexOf(o) === k).slice(0, 2)]);
    r.opts = opts; r.ans = opts.indexOf(w.en);
    ctx.speak(w.g);
    show(`<div class="sq-h">🎣 A bite! <span class="sq-n">${r.i + 1}/${r.list.length}</span></div>
      <div class="sq-word gk">${esc(w.g)}</div><div class="sq-timer"><i id="sqtime"></i></div>
      <div class="sq-opts">${opts.map((o, k) => `<button class="sq-opt" data-sq="fish" data-k="${k}"><span class="k">${k + 1}</span>${esc(o)}</button>`).join('')}</div>`);
  }
  function reel(k) {
    const r = run; if (!r || r.phase !== 'bite') return;
    const w = r.list[r.i], ok = k === r.ans, e = r.e;
    r.phase = 'done';
    panel.querySelectorAll('.sq-opt').forEach((b, j) => { b.disabled = true; if (j === r.ans) b.classList.add('right'); else if (j === k) b.classList.add('wrong'); });
    ctx.record(w, ok);
    if (ok) {
      r.caught++;
      const kind = w.box >= 4 ? 'gold' : Math.random() < 0.35 ? 'blue' : 'silver';
      r.catches.push(kind);
      const f = fishMesh(kind), tag = glowWord(w.g); tag.position.y = 1; f.add(tag);
      ctx.add(f); ctx.sfx('reel');
      const from = r.at.clone(), to = ctx.player.position.clone().add(V(0, 1.6, 0));
      tween(0.9, t => { f.position.lerpVectors(from, to, t); f.position.y += Math.sin(t * Math.PI) * 3.5; f.rotation.x = t * Math.PI * 2; f.rotation.y = t * 4; }, () => {
        ctx.SPK.emit(f.position, { color: kind === 'gold' ? 0xffd166 : 0x9ad0ff, n: 30, speed: 4, size: 0.4 }); f.parent.remove(f);
      });
      ctx.SPK.emit(from, { color: 0xffffff, n: 24, speed: 3, up: 1.4, gravity: -9, size: 0.3 });
      ctx.reward(kind === 'gold' ? 8 : 4, kind === 'gold' ? 3 : 1, 'fish');
    } else ctx.sfx('bad');
    e.bob.visible = false; e.line.visible = false;
    panel.insertAdjacentHTML('beforeend', `<div class="sq-fb ${ok ? 'ok' : 'no'}">${ok ? `🐟 Caught! <b class="gk">${esc(w.g)}</b> = ${esc(w.en)}` : `It slipped away… <b class="gk">${esc(w.g)}</b> = <b>${esc(w.en)}</b>`}</div>`);
    setTimeout(() => {
      if (!run || run !== r) return;
      r.i++;
      if (r.i >= r.list.length) return fishDone();
      r.phase = 'ready'; fishPanel();
    }, ok ? 1300 : 2600);
  }
  function fishDone() {
    const r = run, icons = { gold: '🐠', blue: '🐟', silver: '🐟' };
    show(`<div class="sq-h">🎣 Fishing done</div><div class="sq-sum">${r.catches.map(k => icons[k]).join(' ') || '…no fish this time'}</div>
      <div class="sq-tip">${r.caught}/${r.list.length} caught.${r.catches.includes('gold') ? ' A golden fish: a word you know by heart!' : ''} The ones that got away will swim back soon.</div>
      <div class="sq-row"><button class="btn ghost" data-sq="quit">Done</button><button class="btn primary" data-sq="again">Fish again</button></div>`);
    r.phase = 'over';
  }

  // ── 🔤 Rune Circle ──────────────────────────────────────────
  function runes({ x, z }) {
    const T = THREE, g = new T.Group(), y0 = ctx.groundAt(x, z);
    const ob = ctx.mesh(new T.CylinderGeometry(0.35, 0.6, 2.6, 6), 0x8a8a9a); ob.position.y = 1.3; g.add(ob);
    const cap = ctx.mesh(new T.OctahedronGeometry(0.4), 0x9ad0ff, { emissive: 0x3a7aff, emissiveIntensity: 0.9 }); cap.position.y = 2.95; g.add(cap);
    g.position.set(x, y0, z); ctx.add(g);
    const tiles = [];
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2, tx = x + Math.cos(a) * 4.4, tz = z + Math.sin(a) * 4.4, ty = ctx.groundAt(tx, tz);
      const m = new T.Mesh(new T.CylinderGeometry(0.85, 0.95, 0.22, 10), new T.MeshStandardMaterial({ color: 0x9a948a, roughness: 0.9, flatShading: true, emissive: 0x000000 }));
      m.position.set(tx, ty + 0.06, tz); m.receiveShadow = true; ctx.add(m);
      const L = glowWord(' '); L.position.set(tx, ty + 1, tz); ctx.add(L);
      const tl = { m, x: tx, z: tz, y: ty, L, ch: '' };
      setTileLetter(tl, ALPHA[((i * 5 + Math.round(x)) % 24 + 24) % 24]);
      tiles.push(tl);
    }
    const e = { kind: 'side', sq: 'runes', obj: g, x, z, label: '🔤 Rune Circle', tagY: 3.6, r: 0.7, tiles, cap };
    spots.push(e);
    return e;
  }
  function setTileLetter(tl, ch) {
    tl.ch = ch;
    const s = glowWord(ch, '#fff6d8', null); s.position.copy(tl.L.position); s.scale.multiplyScalar(1.4);
    tl.L.parent.remove(tl.L); tl.L.material.map.dispose(); tl.L = s; ctx.add(s);
  }
  function startRunes(e) {
    const list = words(3, w => { const b = bare(w.g); return b.length >= 2 && b.length <= 8; });
    if (!list.length) return ctx.dialog('🔤 Rune Circle', '<p>The runes stay dark until you know some words. Learn a few from the teachers first!</p>', [{ label: 'OK' }]);
    run = { kind: 'runes', e, list, i: 0, good: 0 };
    runeWord();
  }
  function runeWord() {
    const r = run, w = r.list[r.i], e = r.e, b = bare(w.g);
    r.b = b; r.at = 0; r.miss = 0; r.last = -1;
    const need = [...new Set(b)], decoys = shuffle(ALPHA.split('').filter(c => !need.includes(c))).slice(0, 12 - need.length);
    const letters = shuffle(need.concat(decoys));
    e.tiles.forEach((tl, i) => { setTileLetter(tl, letters[i]); tl.m.material.emissive.setHex(0); });
    runePanel();
  }
  function runePanel(msg = '') {
    const r = run, w = r.list[r.i];
    const slots = r.b.split('').map((c, i) => `<span class="${i < r.at ? 'on' : ''}">${i < r.at ? c : '_'}</span>`).join('');
    show(`<div class="sq-h">🔤 Rune Circle <span class="sq-n">${r.i + 1}/${r.list.length}</span><button class="sq-x" data-sq="quit">✕</button></div>
      <div class="sq-tip">Walk onto the stones to spell the Greek for <b>“${esc(w.en)}”</b></div><div class="sq-slots gk">${slots}</div>
      ${msg ? `<div class="sq-fb">${msg}</div>` : `<div class="sq-tip small">Same letter twice? Hop on the stone again. <button class="sq-link" data-sq="hint">💡 Show me the next one</button></div>`}`);
  }
  function stepTile(i) {
    const r = run, e = r.e, tl = e.tiles[i], want = r.b[r.at];
    if (tl.ch === want) {
      r.at++; ctx.sfx('good');
      tl.m.material.emissive.setHex(0xffb020); tl.m.material.emissiveIntensity = 0.8;
      tween(0.5, t => { tl.m.material.emissiveIntensity = 0.8 * (1 - t) + 0.1; });
      ctx.SPK.emit(V(tl.x, tl.y + 0.6, tl.z), { color: 0xffd166, n: 16, speed: 2.5, size: 0.32 });
      if (r.at >= r.b.length) return runeDone();
      runePanel();
    } else {
      r.miss++; ctx.sfx('bad');
      tl.m.material.emissive.setHex(0xc0201a); tl.m.material.emissiveIntensity = 0.7;
      tween(0.6, t => { tl.m.material.emissiveIntensity = 0.7 * (1 - t); });
      const bx = tl.m.position.x; tween(0.3, t => { tl.m.position.x = bx + Math.sin(t * 30) * 0.06 * (1 - t); });
    }
  }
  function runeDone() {
    const r = run, w = r.list[r.i], e = r.e, ok = r.miss <= 1;
    ctx.record(w, ok); if (ok) r.good++;
    ctx.speak(w.g); ctx.sfx('combo');
    const s = glowWord(w.g, '#ffffff'); s.scale.multiplyScalar(1.8); s.position.set(e.x, ctx.groundAt(e.x, e.z) + 3.4, e.z); ctx.add(s);
    tween(2.2, t => { s.position.y += 0.012; s.material.opacity = 1 - Math.max(0, t - 0.6) / 0.4; }, () => s.parent.remove(s));
    ctx.SPK.emit(s.position, { colors: [0xffd166, 0x9ad0ff, 0xffffff], n: 50, speed: 5, size: 0.4 });
    ctx.reward(ok ? 6 : 3, ok ? 1 : 0, 'runes');
    runePanel(`✨ <b class="gk">${esc(w.g)}</b> = ${esc(w.en)}${r.miss ? ` <span class="muted">(${r.miss} wrong step${r.miss > 1 ? 's' : ''})</span>` : ' · perfect!'}`);
    r.at = -1;
    setTimeout(() => {
      if (run !== r) return;
      r.i++;
      if (r.i < r.list.length) return runeWord();
      show(`<div class="sq-h">🔤 The runes glow!</div><div class="sq-tip">${r.good}/${r.list.length} words spelled cleanly.</div>
        <div class="sq-row"><button class="btn ghost" data-sq="quit">Done</button><button class="btn primary" data-sq="again">Three more</button></div>`);
      r.over = true;
    }, 1800);
  }
  function runeHint() {
    const r = run; if (!r || r.kind !== 'runes' || r.at < 0) return;
    const tl = r.e.tiles.find(t => t.ch === r.b[r.at]); if (!tl) return;
    r.miss++;
    ctx.SPK.emit(V(tl.x, tl.y + 0.4, tl.z), { color: 0x9ad0ff, n: 30, speed: 1.5, up: 2, gravity: 1, size: 0.35, life: 1.4 });
  }
  function runeUpdate(pos, onGround) {
    const r = run; if (r.at < 0 || r.over) return;
    let on = -1;
    r.e.tiles.forEach((tl, i) => { if (Math.hypot(pos.x - tl.x, pos.z - tl.z) < 0.95 && pos.y < tl.y + 0.6) on = i; });
    const landed = onGround && !r.wasGround;
    r.wasGround = onGround;
    if (on >= 0 && (on !== r.last || landed)) stepTile(on);
    r.last = on;
  }

  // ── 📦 Courier ──────────────────────────────────────────────
  function courier({ x, z, look, name }) {
    const p = ctx.person(look);
    p.position.set(x, ctx.groundAt(x, z), z); ctx.add(p);
    const crate = ctx.mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), 0xb08850); crate.position.set(0.9, 0.3, 0.3); p.add(crate);
    const e = { kind: 'side', sq: 'courier', obj: p, x, z, label: `📦 ${name}`, name, tagY: 2.7, r: 0.7, person: true };
    spots.push(e);
    return e;
  }
  function startCourier(e) {
    const list = words(3);
    if (list.length < 1) return ctx.dialog(`📦 ${esc(e.name)}`, '<p>I need help with some words… but you don\'t know any yet. Come back after a lesson!</p>', [{ label: 'OK' }]);
    run = { kind: 'courier', e, list, i: 0, good: 0, orbs: [] };
    courierAsk();
  }
  function courierAsk() {
    const r = run, w = r.list[r.i], e = r.e;
    for (const o of r.orbs) if (o.s.parent) o.s.parent.remove(o.s);
    const decoys = ctx.pool(12).filter(x => x.g !== w.g && clean(x.en) !== w.en).map(x => Object.assign({}, x, { en: clean(x.en) }));
    const pick = shuffle([w, ...shuffle(decoys).slice(0, 2)]);
    r.orbs = []; r.carry = null; r.miss = 0;
    pick.forEach((wd, k) => {
      let ox = e.x, oz = e.z;
      for (let tries = 0; tries < 40; tries++) {
        const a = Math.random() * Math.PI * 2, d = 8 + Math.random() * 9;
        ox = e.x + Math.cos(a) * d; oz = e.z + Math.sin(a) * d;
        if (ctx.free(ox, oz) && r.orbs.every(o => Math.hypot(o.x - ox, o.z - oz) > 5)) break;
      }
      const s = glowWord(wd.g); s.scale.multiplyScalar(1.3);
      s.position.set(ox, ctx.groundAt(ox, oz) + 1.4, oz); ctx.add(s);
      r.orbs.push({ s, w: wd, x: ox, z: oz, ok: wd.g === w.g, ph: k });
    });
    show(`<div class="sq-h">📦 ${esc(e.name)} <span class="sq-n">${r.i + 1}/${r.list.length}</span><button class="sq-x" data-sq="quit">✕</button></div>
      <div class="sq-tip">“Please bring me the word for <b>${esc(w.en)}</b>.”</div><div class="sq-tip small">Three glowing words lie nearby. Walk into the right one and carry it back.</div>`);
  }
  function courierUpdate(pos, dt, t) {
    const r = run, e = r.e, w = r.list[r.i];
    for (const o of r.orbs) {
      if (!o.s.parent) continue;
      if (o === r.carry) { o.s.position.set(pos.x, pos.y + 3, pos.z); continue; }
      o.s.position.y = ctx.groundAt(o.x, o.z) + 1.4 + Math.sin(t * 2 + o.ph) * 0.2;
      if ((o.tt = (o.tt || 0) - dt) <= 0) { o.tt = 0.15; ctx.SPK.emit(o.s.position, { color: 0xffe9a8, n: 1, speed: 0.4, up: 1, gravity: 0.5, size: 0.3, life: 0.8 }); }
      if (!r.carry && Math.hypot(pos.x - o.x, pos.z - o.z) < 1.3) {
        if (o.ok) { r.carry = o; ctx.sfx('combo'); show(panel.innerHTML.replace(/Three glowing words[^<]*/, `Got it! Take <b class="gk">${esc(o.w.g)}</b> back to ${esc(e.name)}.`)); }
        else {
          r.miss++; ctx.sfx('bad'); ctx.SPK.emit(o.s.position, { color: 0xb388ff, n: 24, speed: 3, size: 0.35 });
          o.s.parent.remove(o.s);
          ctx.toast(`<b class="gk">${esc(o.w.g)}</b> = ${esc(o.w.en)}, not “${esc(w.en)}”.`);
        }
      }
    }
    if (r.carry && Math.hypot(pos.x - e.x, pos.z - e.z) < 2.6) {
      const ok = r.miss === 0;
      ctx.record(w, ok); if (ok) r.good++;
      r.carry.s.parent.remove(r.carry.s); r.carry = null;
      ctx.speak(w.g); ctx.sfx('win');
      ctx.SPK.emit(V(e.x, ctx.groundAt(e.x, e.z) + 2, e.z), { colors: [0xffd166, 0xff8fab, 0x7ed58f], n: 40, speed: 4, size: 0.4 });
      ctx.reward(ok ? 7 : 4, ok ? 2 : 1, 'courier');
      r.i++;
      if (r.i < r.list.length) courierAsk();
      else {
        for (const o of r.orbs) if (o.s.parent) o.s.parent.remove(o.s);
        show(`<div class="sq-h">📦 ${esc(e.name)}: “Thank you!”</div><div class="sq-tip">${r.good}/${r.list.length} delivered without a wrong turn.</div>
          <div class="sq-row"><button class="btn ghost" data-sq="quit">Done</button><button class="btn primary" data-sq="again">More errands</button></div>`);
        r.over = true;
      }
    }
    if (Math.hypot(pos.x - e.x, pos.z - e.z) > 45) stop();
  }

  // ── running them ────────────────────────────────────────────
  function stop() {
    if (!run) return;
    const r = run; run = null;
    if (r.kind === 'fish') { r.e.bob.visible = false; r.e.line.visible = false; }
    if (r.kind === 'runes') r.e.tiles.forEach(tl => tl.m.material.emissive.setHex(0));
    if (r.kind === 'courier') for (const o of r.orbs) if (o.s.parent) o.s.parent.remove(o.s);
    hide();
  }
  function start(e) {
    stop();
    ({ fish: startFishing, runes: startRunes, courier: startCourier })[e.sq](e);
  }
  panel.addEventListener('click', ev => {
    const b = ev.target.closest('[data-sq]'); if (!b || b.disabled) return;
    ev.stopPropagation();
    const a = b.dataset.sq;
    if (a === 'quit') stop();
    else if (a === 'again' && run) { const e = run.e; stop(); start(e); }
    else if (a === 'cast' && run && run.phase === 'ready') cast();
    else if (a === 'fish') reel(+b.dataset.k);
    else if (a === 'hint') runeHint();
  });
  return {
    spots,
    fishing, runes, courier, start, stop,
    // fishing holds the hero still; the walking games don't
    busy: () => !!run && run.kind === 'fish',
    focus: () => (run && run.kind === 'fish' && run.e.bob.visible ? run.e.bob.position : run && run.kind === 'fish' ? run.e.water : null),
    active: () => !!run,
    key(ev) {
      if (!run) return false;
      if (run.kind === 'fish' && /^[1-3]$/.test(ev.key)) { reel(+ev.key - 1); return true; }
      if (run.kind === 'fish' && (ev.key === 'Enter' || ev.code === 'Space') && run.phase === 'ready') { cast(); return true; }
      if (ev.key === 'Escape') { stop(); return true; }
      return false;
    },
    clear() { stop(); spots.length = 0; anims.length = 0; },
    update(dt, t, pos, onGround) {
      for (let i = anims.length - 1; i >= 0; i--) if (anims[i](dt) === false) anims.splice(i, 1);
      for (const e of spots) if (e.cap) { e.cap.rotation.y += dt; e.cap.position.y = 2.95 + Math.sin(t * 2) * 0.12; }
      for (const e of spots) if (e.person && ctx.animatePerson) ctx.animatePerson(e.obj, 0, dt);
      if (!run) return;
      const r = run;
      if (r.kind === 'fish') {
        const e = r.e;
        if (e.bob.visible) {
          const hand = ctx.player.position.clone().add(V(0, 1.7, 0));
          const p = e.line.geometry.attributes.position; p.setXYZ(0, hand.x, hand.y, hand.z); p.setXYZ(1, e.bob.position.x, e.bob.position.y, e.bob.position.z); p.needsUpdate = true;
        }
        if (r.phase === 'wait') {
          e.bob.position.y = r.at.y + Math.sin(t * 3) * 0.04;
          if (Math.random() < dt * 0.8) { e.bob.position.y -= 0.08; ctx.SPK.emit(r.at, { color: 0xffffff, n: 3, speed: 0.8, up: 0.5, gravity: -3, size: 0.2, life: 0.4 }); }
          if ((r.t -= dt) <= 0) bite();
        } else if (r.phase === 'bite') {
          e.bob.position.y = r.at.y - 0.12 + Math.sin(t * 18) * 0.06;
          r.left -= dt;
          const bar = document.getElementById('sqtime'); if (bar) bar.style.width = Math.max(0, r.left / r.max * 100) + '%';
          if (r.left <= 0) reel(-1);
        }
      } else if (r.kind === 'runes') runeUpdate(pos, onGround);
      else if (r.kind === 'courier') courierUpdate(pos, dt, t);
    },
  };
}
