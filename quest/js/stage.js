// The 3D trial stage: every lesson, boss fight, review and arcade round is
// played here. The hero faces an opponent in a place with the look of the region (js/stagesets.js); questions
// float overhead and answers are stone tablets you strike with light.
import * as THREE from './vendor/three.module.min.js';
import { makeSets, THEMES } from './stagesets.js';

export function createStage(ctx) {
  const { renderer, person, golem, creep, wispMesh, ZONES, KG } = ctx;
  const U = KG.util;
  const E_look = () => KG.engine.look();
  const GK = '"Gentium Plus", "Noto Serif", Georgia, serif';
  const UI = 'Nunito, system-ui, sans-serif';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
  scene.add(camera);
  const S = { active: false, scene, camera, kind: 'mentor', unit: 0, picks: [], anims: [], q: null, h: null, shake: 0 };

  // ── environment ────────────────────────────────────────────
  const FX = ctx.FX, LOW = (KG.engine.state.settings || {}).gfx === 'low';
  const sky = FX.sky(300);
  scene.add(sky);
  const paintSky = (top, mid, bot, stars = 0) => sky.userData.set({ top, mid, bot, sun: 0xfff1d6, clouds: 0.4, stars, sunDir: [0.3, 0.35, -0.9] });
  // sparkles for every hit, cast and win
  const SPK = FX.sparks(scene, LOW ? 300 : 800);
  scene.fog = new THREE.Fog(0xb8d8f0, 40, 160);
  const hemi = new THREE.HemisphereLight(0xe8f4ff, 0x6a5a40, 1.15);
  const sun = new THREE.DirectionalLight(0xffe2b0, 2.4);
  sun.position.set(12, 22, 10); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 70 });
  scene.add(hemi, sun);
  const rim = new THREE.DirectionalLight(0x9fc4ff, 0.8); rim.position.set(-10, 8, -14); scene.add(rim);

  const M = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, flatShading: true }, o));
  const shadowed = m => { m.castShadow = m.receiveShadow = true; return m; };

  // the place where the trial is held: a set in the look of the region (js/stagesets.js), the sky island for the arcade
  const sets = makeSets(THREE, { LOW, golem, FX: ctx.FX });
  let SET = null, setKey = '';
  S.flames = [];
  S.useSet = useSet; // for tests
  function useSet(theme, tint) {
    if (setKey !== theme) {
      if (SET) {
        scene.remove(SET.group);
        SET.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) for (const m of [].concat(o.material)) { if (m.map) m.map.dispose(); m.dispose(); } });
      }
      SET = sets.build(theme, THEMES.indexOf(theme) + 2); scene.add(SET.group); setKey = theme;
      S.flames = SET.flames;
    }
    let [top, mid, bot] = SET.sky;
    if (tint === 'shade' && !SET.indoor) { const c = (a, b) => new THREE.Color(a).lerp(new THREE.Color(b), 0.45).getHex(); top = c(top, 0x2a1a4a); mid = c(mid, 0x7a6aa8); bot = c(bot, 0x3a2a4a); }
    // outdoors the trial keeps the hour of the world you came from (sunset, night, dawn, storm)
    const M = !SET.indoor && ctx.mood && ctx.mood();
    let stars = tint === 'shade' ? 0.6 : 0;
    if (M) { const c = (a, b) => new THREE.Color(a).lerp(new THREE.Color(b), 0.7).getHex(); top = c(top, M.top); mid = c(mid, M.mid); bot = c(bot, M.bot); stars = Math.max(stars, M.stars || 0); }
    if (ctx.FX && ctx.FX.setNight) ctx.FX.setNight(SET.indoor ? 0.4 : stars > 0.5 ? 1 : stars > 0.15 ? 0.4 : 0); // lamps burn brighter after dark
    paintSky(top, mid, bot, stars); scene.fog.color.setHex(mid); scene.fog.near = SET.fog[0]; scene.fog.far = SET.fog[1];
    sky.visible = !SET.indoor;
    hemi.intensity = (SET.hemi || 1.15) * (tint === 'shade' ? 0.7 : 1) * (M ? Math.max(0.65, M.hemi) : 1);
    sun.intensity = SET.indoor ? 0.8 : M ? Math.max(1, M.sunI * 1.2) : 2.4;
  }

  // hero
  const hero = ctx.applyLook(new THREE.Group());
  // the hero stands to one side, so the challenger and the word stay in full view
  const HERO_X = -2.6, HERO_R = Math.PI - 0.36;
  hero.position.set(HERO_X, 0, 5.2); hero.rotation.y = HERO_R;
  scene.add(hero);
  let pet = null;
  const aura = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0 }));
  aura.rotation.x = Math.PI / 2; aura.position.set(HERO_X, 0.05, 5.2); scene.add(aura);

  // opponent slot
  const FOES = ['guardian', 'shade', 'dummy', 'imp', 'rival', 'creep', 'beast'];
  let opp = null, hpBar = null;
  const oppPos = new THREE.Vector3(0, 1.1, -8);
  // one bar: a gold frame, the empty part a dim red track, the health a bright fill with a shine and a heart at the start
  function hpSprite(frac) {
    const c = document.createElement('canvas'); c.width = 320; c.height = 48; const x = c.getContext('2d');
    x.fillStyle = '#e0b040'; x.beginPath(); x.roundRect(0, 4, 320, 40, 20); x.fill();
    x.fillStyle = '#2a0e10'; x.beginPath(); x.roundRect(4, 8, 312, 32, 16); x.fill();
    x.fillStyle = 'rgba(224,69,58,.22)'; x.beginPath(); x.roundRect(40, 12, 272, 24, 12); x.fill();
    if (frac > 0) {
      const w = Math.max(24, 272 * frac), col = frac > 0.5 ? ['#ff6a5a', '#c9302b'] : frac > 0.25 ? ['#ffa040', '#d8701a'] : ['#ffd166', '#d8a020'];
      const g = x.createLinearGradient(0, 12, 0, 36); g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
      x.fillStyle = g; x.beginPath(); x.roundRect(40, 12, w, 24, 12); x.fill();
      x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.roundRect(44, 14, w - 8, 7, 4); x.fill();
    }
    x.font = '26px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('❤️', 22, 25);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function setOpponent(kind, unit) {
    if (opp) scene.remove(opp);
    const Z = ZONES[unit];
    if (kind === 'creep') { opp = creep(); opp.scale.setScalar(1.7); } else
    if (kind === 'beast') { opp = sets.beast(ctx.look(unit)); } else
    if (kind === 'guardian') { opp = golem([0x8a8a8a, 0x6a7a4a, 0xc9a43a, 0x4a6a8a, 0x6a6a7a, 0xa08060, 0xa0b0c0, 0xcfe0ff, 0xe0c060][unit]); opp.scale.setScalar(1.25); if (opp.userData.rune) opp.userData.rune.visible = false; }
    else if (kind === 'shade') { opp = wispMesh(); opp.scale.setScalar(2.6); opp.userData.float = 2.6; }
    else if (kind === 'arcade') {
      opp = new THREE.Group();
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.4, 0), new THREE.MeshStandardMaterial({ color: 0x7fd0ff, emissive: 0x2f80ff, emissiveIntensity: 0.8, metalness: 0.3, roughness: 0.2, flatShading: true }));
      crystal.position.y = 3; opp.add(crystal); opp.userData.spin = crystal;
      const base = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(1, 1.3, 1, 8), M(0xe0d6c0))); base.position.y = 0.5; opp.add(base);
    } else if (kind === 'scroll') {
      opp = new THREE.Group();
      const col = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 1.6, 10), M(0xe8dfcc))); col.position.y = 0.8; opp.add(col);
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2, 14), new THREE.MeshStandardMaterial({ color: 0xf5e6c0, emissive: 0x8a6a20, emissiveIntensity: 0.5 }));
      roll.rotation.z = Math.PI / 2; roll.position.y = 2.6; opp.add(roll); opp.userData.spin = roll;
    } else if (kind === 'dummy') {
      opp = new THREE.Group();
      const body = new THREE.Group(); opp.add(body);
      const post = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 3, 8), M(0x6a4a2a))); post.position.y = 1.5; opp.add(post);
      const torso = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 1.4, 10), M(0xd8b878))); torso.position.y = 2.1; body.add(torso);
      const head = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), M(0xc8a868))); head.position.y = 3.15; body.add(head);
      const bar = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6), M(0x6a4a2a))); bar.rotation.z = Math.PI / 2; bar.position.y = 2.5; body.add(bar);
      for (const [r, c] of [[0.42, 0xc9452b], [0.28, 0xffffff], [0.14, 0xc9452b]]) { const t = new THREE.Mesh(new THREE.CircleGeometry(r, 20), M(c)); t.position.set(0, 2.15, 0.66 + (0.42 - r) * 0.02); body.add(t); }
      opp.userData.body = body; opp.userData.wobble = true;
    } else if (kind === 'imp') {
      opp = new THREE.Group();
      const book = new THREE.Group(); book.position.y = 2.6; opp.add(book);
      const pages = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 1.2), M(0xf5ecd0))); book.add(pages);
      const covers = [];
      for (const sd of [-1, 1]) {
        const hinge = new THREE.Group(); hinge.position.x = 0; book.add(hinge);
        const cv = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 1.3), M(0x7a2f3a))); cv.position.x = sd * 0.85; hinge.add(cv);
        hinge.userData.sd = sd; covers.push(hinge);
      }
      for (const sd of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffd166 })); e.position.set(sd * 0.3, 0.2, 0.62); book.add(e); }
      const rune = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), new THREE.MeshBasicMaterial({ color: 0xffd166 })); rune.rotation.x = -Math.PI / 2; rune.position.y = 0.14; book.add(rune);
      opp.userData.flap = covers; opp.userData.book = book;
    } else if (kind === 'rival') {
      opp = person({ robe: 0x5a2a7a, hair: 0x1a1a1a, staff: true, skin: 0xe8c098, scale: 1.05 });
    } else {
      opp = person({ robe: Z.robe, hair: 0xdddddd, beard: unit % 3 === 0, staff: true, hood: unit % 2 === 1, skin: [0xf0c8a0, 0xd8a878, 0xb07850][unit % 3], scale: 1.15 });
    }
    S.oppKind = kind;
    opp.position.copy(oppPos); opp.rotation.y = 0;
    scene.add(opp);
    hpBar = null;
    if (FOES.includes(kind)) {
      hpBar = new THREE.Sprite(new THREE.SpriteMaterial({ map: hpSprite(1), depthWrite: false, depthTest: false })); hpBar.renderOrder = 15; // drawn over everything, so no part of the foe cuts through it
      hpBar.scale.set(4, 0.6, 1); hpBar.position.set(0, kind === 'guardian' ? 6.9 : kind === 'shade' ? 5.8 : opp.userData.hpY || 4.4, 0); hpBar.position.add(oppPos);
      scene.add(hpBar); S.hpObj = hpBar;
    } else if (S.hpObj) { scene.remove(S.hpObj); S.hpObj = null; }
  }

  // ── text on tablets ────────────────────────────────────────
  const strip = html => String(html).replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
  function wrap(x, text, maxW) {
    const words = text.split(' '), lines = []; let line = '';
    for (const w of words) { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
    if (line) lines.push(line);
    return lines;
  }
  // draws text centered and shrinks the font until it fits the box
  function textCanvas(text, { W = 512, H = 256, greek = false, maxSize = 70, minSize = 18, color = '#2a1d0c', bg = null, weight = 800, pad = 26, border = null, glass = false }) {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    if (glass) {
      // a soft rounded plaque of smoked glass with a thin gold rim, so the word reads against any sky
      const r = Math.min(W, H) * 0.22, i = 6;
      const g = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.1, W / 2, H / 2, Math.max(W, H) * 0.6);
      g.addColorStop(0, 'rgba(24,16,6,.5)'); g.addColorStop(1, 'rgba(24,16,6,.2)');
      x.fillStyle = g; x.beginPath(); x.roundRect(i, i, W - 2 * i, H - 2 * i, r); x.fill();
      x.strokeStyle = 'rgba(232,190,110,.55)'; x.lineWidth = 4; x.stroke();
      x.strokeStyle = 'rgba(255,240,200,.15)'; x.lineWidth = 2; x.beginPath(); x.roundRect(i + 9, i + 9, W - 2 * i - 18, H - 2 * i - 18, r * 0.8); x.stroke();
    }
    if (bg) {
      // aged parchment: a warm centre, darker edges and a faint grain
      x.fillStyle = bg; x.fillRect(0, 0, W, H);
      const g = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, 'rgba(255,250,235,.35)'); g.addColorStop(1, 'rgba(120,80,30,.22)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
      for (let i = 0; i < W * H / 900; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '90,60,20' : '255,255,240'},${Math.random() * 0.07})`; x.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 3, 1 + Math.random() * 2); }
    }
    if (border) {
      // a double gold rule with a stud in each corner
      const b = Math.max(6, Math.round(Math.min(W, H) * 0.035));
      x.strokeStyle = border; x.lineWidth = b; x.strokeRect(b, b, W - 2 * b, H - 2 * b);
      x.globalAlpha = 0.55; x.lineWidth = Math.max(2, b / 3); x.strokeRect(b * 2.6, b * 2.6, W - 5.2 * b, H - 5.2 * b); x.globalAlpha = 1;
      x.fillStyle = border; for (const [cx, cy] of [[b * 2.6, b * 2.6], [W - b * 2.6, b * 2.6], [b * 2.6, H - b * 2.6], [W - b * 2.6, H - b * 2.6]]) { x.beginPath(); x.arc(cx, cy, b * 0.9, 0, 7); x.fill(); }
    }
    let size = maxSize, lines;
    for (; size >= minSize; size -= 2) {
      x.font = `${greek ? 400 : weight} ${size}px ${greek ? GK : UI}`;
      lines = wrap(x, text, W - pad * 2);
      if (lines.length * size * 1.18 <= H - pad * 2 && lines.every(l => x.measureText(l).width <= W - pad * 2)) break;
    }
    x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle';
    if (glass) { x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = size * 0.12; x.shadowOffsetY = size * 0.04; }
    const lh = size * 1.18, y0 = H / 2 - (lines.length - 1) * lh / 2;
    lines.forEach((l, i) => x.fillText(l, W / 2, y0 + i * lh + 2));
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }
  // a parchment-faced stone slab
  const stoneMat = M(0xd8ccb0, { flatShading: false, roughness: 0.9 });
  function slab(text, w, h, { greek = false, num = null, face = '#f3e7c8', color = '#2a1d0c' } = {}) {
    const g = new THREE.Group();
    // the canvas keeps the slab's shape, so wide slabs don't stretch their text
    const ratio = w / h, H = Math.max(96, Math.round(512 / ratio)), W = Math.min(2048, Math.max(512, Math.round(H * ratio)));
    const tex = textCanvas(text, { W, H, greek, color, bg: face, maxSize: Math.round(H * (greek ? 0.62 : 0.42)), minSize: 16, border: '#b8935a', pad: Math.min(26, Math.round(H * 0.13)) });
    const front = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, emissive: 0x000000 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.28), [stoneMat, stoneMat, stoneMat, stoneMat, front, stoneMat]);
    box.castShadow = true;
    g.add(box);
    if (num !== null) {
      const nc = document.createElement('canvas'); nc.width = nc.height = 64; const x = nc.getContext('2d');
      x.fillStyle = '#1f3b5c'; x.beginPath(); x.arc(32, 32, 30, 0, 7); x.fill(); x.fillStyle = '#fff'; x.font = `900 36px ${UI}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(num, 32, 34);
      const ns = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(nc), depthTest: false }));
      ns.scale.setScalar(Math.min(w, h) * 0.32); ns.position.set(-w / 2 + 0.05, h / 2 - 0.05, 0.2); ns.renderOrder = 5; g.add(ns);
    }
    g.userData = { box, front, w, h, base: new THREE.Vector3() };
    return g;
  }
  function banner(text, w, h, greek = false) {
    const tex = textCanvas(text, { W: 1024, H: Math.round(1024 * h / w), greek, maxSize: greek ? 84 : 64, minSize: 20, color: '#3a2610', bg: '#f5e9c8', border: '#a07a40', weight: 800 });
    const g = new THREE.Group();
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), [stoneMat, stoneMat, stoneMat, stoneMat, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), stoneMat]);
    g.add(p);
    for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, h + 0.3, 12), M(0x8a5a2a)); r.position.x = s * (w / 2 + 0.1); g.add(r); }
    return g;
  }

  // ── layout in camera space (always framed, any screen shape) ──
  // Questions live in their own scene, drawn after the island so tablets are
  // never hidden behind the hero; it follows the camera every frame.
  const uiScene = new THREE.Scene(), uiRoot = new THREE.Group(), ui = new THREE.Group();
  uiScene.add(uiRoot); uiRoot.add(ui);
  uiScene.add(new THREE.HemisphereLight(0xfff4e0, 0x8a7a60, 1.4));
  { const d = new THREE.DirectionalLight(0xffffff, 1.6); d.position.set(4, 8, 10); uiScene.add(d); }
  const D = 10; // distance of the UI plane from the camera
  function frame() {
    const hh = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * D;
    // upright screens keep a margin at the sides so tablets and banner rods aren't clipped
    return { hh, hw: hh * camera.aspect * (camera.aspect < 0.9 ? 0.93 : 1), portrait: camera.aspect < 0.9 };
  }
  // Every question makes fresh canvas textures; free the old ones so a long
  // lesson doesn't fill the phone's GPU memory and slow down.
  function dispose(o) {
    o.traverse(x => {
      if (x.geometry) x.geometry.dispose();
      for (const m of x.material ? [].concat(x.material) : []) { if (m === stoneMat) continue; if (m.map) m.map.dispose(); m.dispose(); }
    });
  }
  const drop = o => { if (o) { ui.remove(o); dispose(o); } };
  function clearUI() { for (const c of [...ui.children]) drop(c); S.picks = []; S.sel = null; }

  // ── animation helpers ──────────────────────────────────────
  const anim = fn => S.anims.push(fn);
  function tween(dur, step, done) { let t = 0; anim(dt => { t = Math.min(1, t + dt / dur); step(t); if (t >= 1) { done && done(); return false; } return true; }); }
  const ease = t => 1 - Math.pow(1 - t, 3);
  const worldPos = o => o.getWorldPosition(new THREE.Vector3());
  function particles(pos, color, n = 40, spread = 5) {
    SPK.emit(pos, { color, n, speed: spread, up: 0.7, gravity: -5, size: 0.4, life: 1 });
    SPK.emit(pos, { color: 0xffffff, n: Math.ceil(n / 4), speed: spread * 0.4, up: 0.4, gravity: 0, size: 0.7, life: 0.45 });
  }

  // Two lights made once and lent to orbs: adding or removing a light makes three.js
  // recompile every shader, which freezes a phone for a moment on each answer.
  const orbLights = [0, 1].map(() => { const l = new THREE.PointLight(0xffffff, 0, 6); scene.add(l); return l; });
  const orbGeo = new THREE.SphereGeometry(1, 12, 10);
  function orb(from, to, color, onHit, size = 0.32) {
    const o = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color }));
    o.scale.setScalar(size); o.userData.fx = true;
    const light = orbLights.find(l => !l.userData.busy);
    if (light) { light.userData.busy = true; light.color.setHex(color); light.intensity = 8; }
    scene.add(o);
    const mid = from.clone().lerp(to, 0.5); mid.y += 2;
    tween(0.38, t => {
      const a = from.clone().lerp(mid, t), b = mid.clone().lerp(to, t); o.position.copy(a.lerp(b, t));
      o.scale.setScalar(size * (1 + Math.sin(t * Math.PI) * 0.6));
      if (light) light.position.copy(o.position);
    }, () => { scene.remove(o); o.material.dispose(); if (light) { light.intensity = 0; light.userData.busy = false; } particles(to, color, 30, 4); onHit && onHit(); });
  }
  const heroHand = () => worldPos(hero).add(new THREE.Vector3(0.4, 1.4, -0.3));
  function heroCast() {
    const arm = hero.userData.arms[1];
    tween(0.35, t => { arm.rotation.x = -Math.sin(t * Math.PI) * 2.2; });
  }
  // a tablet breaks where it stands: parchment-faced shards tumble down in front of the camera and fade away
  const shardGeo = new THREE.BoxGeometry(1, 1, 0.12);
  function shatter(g) {
    const w = g.userData.w, h = g.userData.h, at = g.position.clone();
    g.visible = false;
    for (let i = 0; i < 10; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: i % 3 ? 0xf3e7c8 : 0xd8ccb0, roughness: 0.9, transparent: true });
      const f = new THREE.Mesh(shardGeo, mat); f.scale.set(w / 4 * (0.6 + Math.random() * 0.5), h / 3 * (0.6 + Math.random() * 0.5), 1);
      f.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * w, (Math.random() - 0.5) * h, 0.2));
      ui.add(f);
      const v = new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random() * 2, Math.random() * 1.5), r = new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 3);
      let life = 0.9;
      anim(dt => { life -= dt; v.y -= 14 * dt; f.position.addScaledVector(v, dt); f.rotation.x += r.x * dt; f.rotation.y += r.y * dt; f.rotation.z += r.z * dt; mat.opacity = Math.min(1, life / 0.4); if (life <= 0) { ui.remove(f); mat.dispose(); return false; } return true; });
    }
  }
  function glow(g, color = 0x3fdc7a) {
    const fm = g.userData.front;
    fm.emissive.setHex(color);
    tween(0.6, t => { fm.emissiveIntensity = 0.9 * (1 - t) + 0.25; g.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.12); });
    particles(worldPos(g), 0xffd166, 36, 5);
  }
  // floating numbers and words over the action
  function popText(pos, text, color = '#ffd166', size = 1) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
    x.font = `900 84px ${UI}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 14; x.strokeStyle = 'rgba(40,20,0,.85)'; x.strokeText(text, 256, 66);
    x.fillStyle = color; x.fillText(text, 256, 66);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    sp.renderOrder = 20; sp.position.copy(pos); sp.userData.fx = true; scene.add(sp);
    const vx = (Math.random() - 0.5) * 1.2;
    tween(1.1, k => {
      const s0 = (k < 0.15 ? k / 0.15 * 1.3 : 1.3 - Math.min(0.3, (k - 0.15) * 1.5)) * size;
      sp.scale.set(3.6 * s0, 0.9 * s0, 1); sp.position.y = pos.y + k * 1.2; sp.position.x = pos.x + vx * k;
      sp.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    }, () => { scene.remove(sp); t.dispose(); sp.material.dispose(); });
  }
  // an expanding ring where a spell lands
  const ringGeo = new THREE.RingGeometry(0.8, 1, 40);
  function shock(pos, color = 0xffd166, size = 3) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.copy(pos); m.lookAt(camera.position); m.userData.fx = true; scene.add(m);
    tween(0.45, k => { m.scale.setScalar(0.2 + ease(k) * size); m.material.opacity = 1 - k; }, () => { scene.remove(m); m.material.dispose(); });
  }
  function oppHit() {
    if (!opp) return;
    const p = worldPos(opp).add(new THREE.Vector3(0, S.oppKind === 'guardian' ? 3.4 : 2.4, 0)), n = S.comboN || 0;
    shock(p, n >= 5 ? 0xff9a3a : 0xffd166, n >= 5 ? 4.5 : 3);
    if (!FOES.includes(S.oppKind)) { popText(p.clone().add(new THREE.Vector3(0, 0.6, 0)), U.pick(['Καλῶς!', 'Εὖγε!', 'Well done!', 'Yes!']), '#fff2c0'); KG.app.sfx('hit'); return; }
    const dmg = 10 + n * 2;
    popText(p.clone().add(new THREE.Vector3(0, -0.9, 1.2)), n >= 5 ? `CRIT −${dmg * 2}` : `−${dmg}`, n >= 5 ? '#ff9a3a' : '#ffe9a8', n >= 5 ? 1.5 : 1.15); // over the foe's chest, clear of its health bar
    if (n >= 3 && n % 5 === 0) popText(p.clone().add(new THREE.Vector3(0, 2.1, 0)), `${n}× COMBO!`, '#7fd0ff', 1.35);
    KG.app.sfx('hit'); S.shake = Math.max(S.shake, n >= 5 ? 0.3 : 0.15);
  }
  function oppReact(hit) {
    if (!opp) return;
    if (hit) {
      oppHit();
      tween(0.4, t => { opp.position.z = oppPos.z - Math.sin(t * Math.PI) * 0.8; opp.rotation.x = -Math.sin(t * Math.PI) * 0.15; });
    } else {
      // opponent strikes back
      tween(0.25, t => { opp.position.z = oppPos.z + Math.sin(t * Math.PI) * 1.2; }, () => {
        orb(worldPos(opp).add(new THREE.Vector3(0, 2.5, 0)), worldPos(hero).add(new THREE.Vector3(0, 1.2, 0)), S.oppKind === 'mentor' || S.oppKind === 'scroll' ? 0xff9f6a : 0x8a3aff, () => {
          S.shake = 0.35; heroFlinch();
        }, 0.4);
      });
    }
  }
  function heroFlinch() { tween(0.4, t => { hero.rotation.x = Math.sin(t * Math.PI) * 0.3; hero.position.z = 5.2 + Math.sin(t * Math.PI) * 0.5; }); }
  function nod() { if (!opp || !opp.userData.body) return; tween(0.5, t => { opp.userData.body.rotation.x = Math.sin(t * Math.PI * 2) * 0.12; }); }

  // ── questions ──────────────────────────────────────────────
  function place(g, x, y, z = 0) { g.position.set(x, y, -D + z); (g.userData.base || (g.userData.base = new THREE.Vector3())).set(x, y, -D + z); ui.add(g); }
  function introAnim(g, delay) {
    const b = g.userData.base ? g.userData.base.clone() : g.position.clone();
    g.position.y = b.y - 3; g.scale.setScalar(0.01);
    let t = -delay; anim(dt => { t += dt / 0.4; if (t < 0) return true; const e = ease(Math.min(1, t)); g.position.y = b.y - 3 * (1 - e); g.scale.setScalar(Math.max(0.01, e)); return t < 1; });
  }
  function askMC(q) {
    const { hh, hw, portrait } = frame();
    const prompt = strip(q.prompt);
    const bw = Math.min(hw * 1.9, 13), bh = portrait ? hh * 0.26 : hh * 0.24;
    const b = banner(prompt, bw, bh); place(b, 0, hh - bh / 2 - hh * (portrait ? 0.2 : 0.12)); introAnim(b, 0); // upright: clear of the round buttons
    if (q.big && q.small) {
      // a whole sentence or verse: on parchment so it reads against any sky
      const bigW = Math.min(hw * 1.9, 13), bigH = (portrait ? hh * 0.3 : hh * 0.32) * (q.sub ? 0.8 : 1);
      const bigY = (portrait ? hh * 0.2 : hh * 0.18) + (q.sub ? hh * 0.04 : 0);
      const bg = banner(strip(q.big), bigW, bigH, true); place(bg, 0, bigY); introAnim(bg, 0.05);
      S.big = bg;
      if (q.sub) {
        const sw = bigW, sh = hh * 0.11;
        const sub = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: textCanvas(strip(q.sub), { W: 1024, H: Math.round(1024 * sh / sw), maxSize: 84, minSize: 28, color: '#fff2c8', weight: 800, bg: 'rgba(40,28,12,.75)' }), transparent: true, depthWrite: false }));
        const sg = new THREE.Group(); sg.add(sub); sg.userData = { base: new THREE.Vector3() };
        place(sg, 0, bigY - bigH / 2 - sh * 0.55); introAnim(sg, 0.1);
      }
    } else if (q.big) {
      const bigH = (portrait ? hh * 0.3 : hh * 0.32) * (q.sub ? 0.8 : 1), txt = strip(q.big);
      // short words get a snug plane so they can be drawn big
      const bigW = Math.min(hw * 1.5, 9, bigH * (1.2 + txt.length * 0.42)), BH = Math.round(1024 * bigH / bigW);
      const bigY = (portrait ? hh * 0.2 : hh * 0.18) + (q.sub ? hh * 0.04 : 0);
      const big = new THREE.Mesh(new THREE.PlaneGeometry(bigW, bigH), new THREE.MeshBasicMaterial({ map: textCanvas(txt, { W: 1024, H: BH, greek: true, maxSize: Math.round(BH * (txt.length <= 2 ? 1 : 0.78)), minSize: 40, color: '#fff7e0', glass: true, pad: Math.round(BH * (txt.length <= 2 ? 0.03 : 0.1)) }), transparent: true, depthWrite: false }));
      const bg = new THREE.Group(); bg.add(big); bg.userData = { base: new THREE.Vector3() };
      place(bg, 0, bigY); introAnim(bg, 0.05);
      S.big = bg;
      // a translation or headword under the Greek
      if (q.sub) {
        const sw = Math.min(hw * 1.9, 13), sh = hh * 0.12;
        const sub = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: textCanvas(strip(q.sub), { W: 1024, H: Math.round(1024 * sh / sw), greek: !q.small, maxSize: 96, minSize: 30, color: '#fff2c8', weight: 800, bg: 'rgba(40,28,12,.55)' }), transparent: true, depthWrite: false }));
        const sg = new THREE.Group(); sg.add(sub); sg.userData = { base: new THREE.Vector3() };
        place(sg, 0, bigY - bigH / 2 - sh * 0.45); introAnim(sg, 0.1);
      }
    }
    const n = q.options.length;
    const cols = portrait ? 2 : Math.min(4, n), rows = Math.ceil(n / cols);
    const gap = hw * 0.04, tw = (hw * 1.92 - gap * (cols - 1)) / cols, th = portrait ? hh * 0.22 : hh * 0.3;
    const top = portrait ? -hh * 0.12 : -hh * 0.3;
    q.options.forEach((o, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const s = slab(q.greekOpts ? o : strip(o), tw, th, { greek: !!q.greekOpts, num: i + 1 });
      const x = -hw * 0.96 + tw / 2 + c * (tw + gap), y = top - r * (th + gap);
      place(s, x, y); introAnim(s, 0.08 + i * 0.06);
      s.userData.pick = { type: 'opt', i };
      S.picks.push(s);
    });
    S.rowsBottom = top - (rows - 1) * (th + gap) - th / 2;
  }
  function askMatch(q) {
    const { hh, hw, portrait } = frame();
    const b = banner(strip(q.prompt), Math.min(hw * 1.9, 13), hh * 0.18); place(b, 0, hh * 0.78); introAnim(b, 0);
    // rows fit between the banner and the help line at the bottom
    const n = q.pairs.length, gap = hh * 0.035, th = Math.min(hh * 0.27, (hh * 1.32 - gap * (n - 1)) / n), tw = hw * 0.92;
    const L = U.shuffle(q.pairs.map((p, i) => ({ t: p[0], i }))), R = U.shuffle(q.pairs.map((p, i) => ({ t: p[1], i })));
    S.match = { sel: null, done: 0, miss: 0, n };
    [L, R].forEach((col, side) => col.forEach((it, k) => {
      const s = slab(it.t, tw, th, { greek: side === 0 && q.greekLeft, face: side ? '#f3e7c8' : '#e9f0f8' });
      place(s, side ? hw * 0.5 : -hw * 0.5, hh * 0.58 - th / 2 - k * (th + gap));
      introAnim(s, k * 0.05 + side * 0.1);
      s.userData.pick = { type: 'mt', side, i: it.i };
      S.picks.push(s);
    }));
    void portrait;
  }
  function askOrder(q, R) {
    const { hh, hw, portrait } = frame();
    const verse = R ? R.words.map(w => w.w + w.p).join(' ') : q.verse;
    const b = banner(verse, Math.min(hw * 1.94, 14), portrait ? hh * 0.42 : hh * 0.36, !!R); place(b, 0, hh * (portrait ? 0.74 : 0.76)); introAnim(b, 0);
    S.order = { bank: U.shuffle(q.chunks.concat(q.extras).map((t, i) => ({ t, i }))), line: [] };
    S.orderTop = portrait ? hh * 0.42 : hh * 0.28;
    layoutOrder(true);
  }
  // word-stones flow left to right; placed stones form the "bridge" above the bank
  function stoneFor(c) {
    if (c.g) return c.g;
    const { hh } = frame();
    const th = hh * 0.13, tw = Math.max(th * 1.4, c.t.length * th * 0.3 + th * 0.6);
    c.g = slab(c.t, tw, th, { face: '#f3e7c8' }); c.g.userData.tw = tw; c.g.userData.th = th;
    c.g.userData.pick = { type: 'stone', c };
    ui.add(c.g); S.picks.push(c.g);
    return c.g;
  }
  function flow(items, y0, hw) {
    let x = -hw * 0.96, y = y0;
    const gap = 0.18;
    for (const c of items) {
      const g = stoneFor(c), tw = g.userData.tw, th = g.userData.th;
      if (x + tw > hw * 0.96) { x = -hw * 0.96; y -= th + gap; }
      const tx = x + tw / 2, ty = y - th / 2;
      x += tw + gap;
      const from = g.position.clone(), to = new THREE.Vector3(tx, ty, -D);
      g.userData.base.copy(to);
      if (from.lengthSq() === 0) { g.position.copy(to); introAnim(g, Math.random() * 0.2); }
      else tween(0.25, t => g.position.lerpVectors(from, to, ease(t)));
    }
    return y;
  }
  function layoutOrder() {
    const { hh, hw } = frame(), o = S.order;
    const lineBottom = flow(o.line, S.orderTop, hw);
    // the bridge plank under the placed stones
    if (!S.plank) { S.plank = new THREE.Mesh(new THREE.BoxGeometry(hw * 1.96, 0.12, 0.6), M(0x8a5a2a)); ui.add(S.plank); }
    S.plank.position.set(0, Math.min(lineBottom, S.orderTop - hh * 0.13) - hh * 0.16, -D);
    flow(o.bank, S.plank.position.y - hh * 0.06, hw);
    if (S.h && S.h.orderChange) S.h.orderChange(o.line.map(c => c.t));
  }
  function askFree(R) {
    const { hh, hw, portrait } = frame();
    const verse = R.words.map(w => w.w + w.p).join(' ');
    const b = banner(verse, Math.min(hw * 1.94, 14), portrait ? hh * 0.5 : hh * 0.42, true); place(b, 0, hh * 0.62); introAnim(b, 0);
  }

  // ── picking ────────────────────────────────────────────────
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pointer(e) {
    if (!S.active || !S.q || S.locked) return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(S.picks.filter(p => p.visible), true);
    if (!hits.length) return;
    let o = hits[0].object; while (o && !o.userData.pick) o = o.parent;
    if (o) choose(o);
  }
  function choose(g) {
    const p = g.userData.pick;
    if (p.type === 'opt') { if (S.answered) return; S.answered = true; S.h.pick(p.i); }
    else if (p.type === 'mini' && MG) {
      if (MG.q.game === 'rain') rainTap(g);
      else if (MG.q.game === 'defense') { if (p.gate) defenseTap(g); }
      else if (MG.q.game === 'forge') forgeTap(g);
      else if (MG.q.game === 'race') raceTap(g);
    }
    else if (p.type === 'mt') pickMatch(g);
    else if (p.type === 'stone') {
      if (S.answered) return;
      const o = S.order, c = p.c, inLine = o.line.indexOf(c);
      if (inLine >= 0) { o.line.splice(inLine, 1); o.bank.push(c); } else { o.bank.splice(o.bank.indexOf(c), 1); o.line.push(c); }
      KG.app.sfx('tap'); layoutOrder();
    }
  }
  function select(g, on) { g.userData.front.emissive.setHex(on ? 0x3f7fd0 : 0x000000); g.userData.front.emissiveIntensity = on ? 0.45 : 0; g.position.z = g.userData.base.z + (on ? 0.4 : 0); }
  function pickMatch(g) {
    const m = S.match, p = g.userData.pick;
    if (g.userData.matched || S.answered) return;
    KG.app.sfx('tap');
    if (!m.sel || m.sel.userData.pick.side === p.side) { if (m.sel) select(m.sel, false); m.sel = g; select(g, true); return; }
    const a = m.sel; m.sel = null; select(a, false);
    if (a.userData.pick.i === p.i) {
      a.userData.matched = g.userData.matched = true;
      // a beam of light joins the pair, then both dissolve
      const pa = worldPos(a), pb = worldPos(g), len = pa.distanceTo(pb);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, len, 6), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
      beam.position.copy(pa).lerp(pb, 0.5); beam.lookAt(pb); beam.rotateX(Math.PI / 2); scene.add(beam);
      glow(a); glow(g); KG.app.sfx('good');
      tween(0.5, t => { beam.scale.x = beam.scale.z = 1 - t; a.scale.setScalar(1 - t * 0.9); g.scale.setScalar(1 - t * 0.9); }, () => { scene.remove(beam); beam.geometry.dispose(); beam.material.dispose(); a.visible = g.visible = false; });
      if (++m.done === m.n) { S.answered = true; setTimeout(() => S.h.matchDone(m.miss), 550); }
    } else {
      m.miss++; KG.app.sfx('bad');
      for (const s of [a, g]) { const bx = s.userData.base.x; tween(0.35, t => { s.position.x = bx + Math.sin(t * Math.PI * 6) * 0.15; }); }
    }
  }

  // ── public API ─────────────────────────────────────────────
  S.ok = true;
  S.enter = (kind, unit = 0) => {
    S.kind = kind; S.unit = unit; S.anims = []; sweepFx();
    useSet(kind === 'arcade' ? 'arena' : THEMES[ctx.look(unit)] || 'arena', kind === 'shade' || kind === 'creep' ? 'shade' : '');
    setOpponent(kind, unit);
    clearUI(); S.q = null;
    S.active = true; S.comboN = 0; aura.material.opacity = 0;
    ctx.applyLook(hero);
    hero.position.set(HERO_X, 0, 5.2); hero.rotation.set(0, HERO_R, 0);
    if (pet) scene.remove(pet);
    pet = ctx.buildPet(E_look().pet);
    if (pet) { pet.position.set(1.5, pet.userData.fly ? 2.6 : 0, 5.6); pet.rotation.y = Math.PI; scene.add(pet); }
  };
  // passing effects (hit numbers, K.O.!, shock rings, spell orbs) are swept away whenever the stage is left or entered,
  // so none is left hanging frozen in the air when its animation is cut short
  function sweepFx() { for (const o of scene.children.filter(o => o.userData.fx)) scene.remove(o); for (const l of orbLights) { l.userData.busy = false; l.intensity = 0; } }
  S.exit = () => { S.active = false; clearUI(); S.q = null; S.anims = []; MG = null; sweepFx(); };
  S.ask = (q, handlers) => {
    MG = null;
    clearUI(); S.plank = null; S.q = q; S.h = handlers; S.answered = false; S.locked = false; S.big = null;
    if (q.type === 'mc') askMC(q);
    else if (q.type === 'match') askMatch(q);
    else if (q.type === 'order') askOrder(q, q.reading ? KG.readings[q.reading] : null);
    else if (q.type === 'free') askFree(KG.readings[q.reading]);
  };
  // glowing demonstration text: [bracketed] parts shine gold
  function demoTexture(demo, W, H) {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const parts = []; demo.replace(/\[(.+?)\]|([^\[]+)/g, (m, hi, lo) => { parts.push([hi || lo, !!hi]); return m; });
    let size = Math.round(H * 0.42), lines;
    const layout = () => {
      x.font = `400 ${size}px ${GK}`;
      lines = [[]]; let w = 0;
      for (const [t, hi] of parts) for (const tok of t.split(/(\s+)/)) {
        if (!tok) continue;
        const tw = x.measureText(tok).width;
        if (w + tw > W - 40 && w > 0 && tok.trim()) { lines.push([]); w = 0; }
        if (!tok.trim() && w === 0) continue;
        lines[lines.length - 1].push([tok, hi, tw]); w += tw;
      }
    };
    for (; size > 18; size -= 3) { layout(); if (lines.length * size * 1.25 <= H - 20) break; }
    x.textBaseline = 'middle';
    const lh = size * 1.25, y0 = H / 2 - (lines.length - 1) * lh / 2;
    lines.forEach((ln, i) => {
      const total = ln.reduce((n, t) => n + t[2], 0); let cx = (W - total) / 2;
      for (const [tok, hi, tw] of ln) {
        x.shadowColor = hi ? 'rgba(255,200,60,.95)' : 'rgba(0,0,0,.55)'; x.shadowBlur = hi ? 24 : 8;
        x.fillStyle = hi ? '#ffd166' : '#fff8e8'; x.fillText(tok, cx, y0 + i * lh); cx += tw;
      }
    });
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  S.teach = item => {
    clearUI(); S.q = null; S.answered = true;
    const want = item.reading ? 'scroll' : 'mentor';
    if (S.oppKind !== want) { setOpponent(want, S.unit); poof(); }
    // the master raises a staff and the lesson glows in the air
    if (opp && opp.userData.arms) { const arm = opp.userData.arms[1]; tween(0.6, t => { arm.rotation.x = -Math.sin(t * Math.PI / 2) * 2.4; }); }
    const text = item.demo || (item.words ? item.words.map(w => w.g).join('   ') : item.letters ? item.letters.map(L => L.U + L.l).join('   ') : item.items ? item.items.slice(0, 6).map(i => i.big).join('  ') : item.reading ? KG.readings[item.reading].words.map(w => w.w + w.p).join(' ') : '');
    if (!text) return;
    const { hh, hw, portrait } = frame();
    const w = Math.min(hw * 1.95, 14), h = portrait ? hh * 0.42 : hh * 0.5;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: demoTexture(item.demo ? text : `[${text}]`, 1024, Math.round(1024 * h / w)), transparent: true, depthWrite: false }));
    const g = new THREE.Group(); g.add(plane); g.userData = { base: new THREE.Vector3() };
    place(g, 0, hh - h / 2 - hh * 0.1); introAnim(g, 0.1);
    S.big = g;
    particles(worldPos(opp || hero).add(new THREE.Vector3(0, 3.5, 0)), 0xffd166, 50, 6);
  };
  function poof() { particles(oppPos.clone().add(new THREE.Vector3(0, 1.5, 0)), 0xffffff, 60, 7); }
  S.trial = foe => {
    clearUI(); S.q = null;
    setOpponent(foe, S.unit); poof();
    if (opp) { const y0 = opp.position.y; tween(0.6, t => { opp.position.y = y0 + (1 - ease(t)) * 8; }); }
    S.shake = 0.25;
  };
  // ── mini-games ─────────────────────────────────────────────
  // Each runs in the update loop and calls done({ ok, hits, total, text }) once.
  let MG = null;
  function miniBanner(text) {
    const { hh, hw } = frame();
    if (MG && MG.banner) drop(MG.banner);
    // a little nearer the camera than the game pieces, so falling stones pass behind it
    const b = banner(text, Math.min(hw * 1.75, 12), hh * 0.16); place(b, 0, hh * 0.7, 0.8); introAnim(b, 0);
    if (MG) MG.banner = b;
  }
  function miniEnd(ok, text) {
    if (!MG || MG.over) return;
    MG.over = true; const cb = MG.done, hits = MG.hits, total = MG.total;
    setTimeout(() => { MG = null; cb({ ok, hits, total, text }); }, 500);
  }
  function removePick(g) { drop(g); S.picks = S.picks.filter(x => x !== g); }
  // the arcade counts every hit and miss as it happens
  const hit = (n = 1) => { if (MG && MG.q.onHit) MG.q.onHit(n); };
  const miss = () => { if (MG && MG.q.onMiss) MG.q.onMiss(); };
  S.stopMini = () => { MG = null; clearUI(); };
  S.mini = (q, done) => {
    clearUI(); S.q = q; S.answered = false; S.locked = false;
    MG = { q, done, hits: 0, total: 0, t: 0, over: false, items: [] };
    ({ rain: rainStart, defense: defenseStart, forge: forgeStart, race: raceStart })[q.game]();
  };

  // Word Rain: catch the Greek word that means the English target
  function rainStart() { MG.round = 0; MG.total = MG.q.targets.length; rainRound(); }
  // each word caught (or missed) goes back into spaced review
  const word = (tgt, ok) => { if (MG && MG.q.onWord && tgt) MG.q.onWord(tgt.g, ok); };
  function rainRound() {
    for (const g of MG.items) removePick(g);
    MG.items = [];
    if (MG.round >= MG.q.targets.length) return miniEnd(MG.hits >= MG.total - 1, `You caught ${MG.hits} of ${MG.total} words.`);
    const tgt = MG.tgt = MG.q.targets[MG.round++], { hh, hw } = frame();
    MG.slip = false;
    miniBanner(`Catch the word for: "${tgt.en}"`);
    const words = U.shuffle([tgt.g, ...U.sample(MG.q.pool.filter(g => g !== tgt.g), 3)]);
    const tw = hw * 0.44, th = hh * 0.13;
    // every fifth word in the arcade falls golden and scores triple
    const gold = MG.q.arcade && MG.round % 5 === 0;
    MG.gold = gold;
    words.forEach((g, i) => {
      const st = slab(g, tw, th, { greek: true, face: gold && g === tgt.g ? '#ffe08a' : '#f3e7c8' });
      const col = i % 2, x = (col ? 1 : -1) * hw * 0.48 + (Math.random() - 0.5) * hw * 0.1;
      place(st, x, hh * 0.62 + i * hh * 0.16);
      st.userData.pick = { type: 'mini', ok: g === tgt.g };
      st.userData.vy = hh * (0.22 + MG.round * 0.025 + Math.random() * 0.05);
      S.picks.push(st); MG.items.push(st);
    });
    MG.wait = false;
  }
  function rainUpdate(dt) {
    if (MG.wait) return;
    const { hh } = frame();
    for (const g of MG.items) {
      if (!g.visible) continue;
      g.position.y -= g.userData.vy * dt; g.userData.base.y = g.position.y; g.rotation.z = Math.sin(MG.t * 3 + g.position.x) * 0.06;
      if (g.position.y < -hh * 0.95) {
        g.visible = false;
        if (g.userData.pick.ok) { MG.wait = true; KG.app.sfx('bad'); oppReact(false); miss(); word(MG.tgt, false); setTimeout(rainRound, 700); }
      }
    }
  }
  function rainTap(g) {
    if (MG.wait || !g.visible) return;
    if (g.userData.pick.ok) {
      MG.hits++; hit(MG.gold ? 3 : 1); MG.wait = true; KG.app.sfx('good'); heroCast(); word(MG.tgt, !MG.slip);
      if (MG.gold) popText(worldPos(g).add(new THREE.Vector3(0, 0.5, 0)), '★ ×3', '#ffd166', 1.2);
      orb(heroHand(), worldPos(g), 0xffd166, () => { glow(g); oppReact(true); });
      setTimeout(rainRound, 800);
    } else { KG.app.sfx('bad'); shatter(g); MG.slip = true; miss(); }
  }

  // Sorting Spell: strike each falling Greek line with its use (up to six gates, in two rows)
  function defenseStart() {
    const { hh, hw } = frame();
    miniBanner(MG.q.banner || 'Strike each line with its use');
    MG.total = MG.q.stones.length; MG.idx = 0;
    const gates = MG.q.gates, perRow = gates.length > 4 ? Math.ceil(gates.length / 2) : gates.length;
    const gap = hw * 0.05, tw = (hw * 1.92 - gap * (perRow - 1)) / perRow, th = hh * 0.13;
    MG.gates = gates.map((c, i) => {
      const r = Math.floor(i / perRow), k = i % perRow, inRow = Math.min(perRow, gates.length - r * perRow);
      const x0 = -(inRow * tw + (inRow - 1) * gap) / 2 + tw / 2;
      const g = slab(c, tw, th, { face: '#e9f0f8' });
      place(g, x0 + k * (tw + gap), -hh * (gates.length > 4 ? 0.56 : 0.66) - r * (th + gap));
      g.userData.pick = { type: 'mini', gate: c }; S.picks.push(g); return g;
    });
    defenseNext();
  }
  function defenseNext() {
    if (MG.cur) { removePick(MG.cur); MG.cur = null; }
    if (MG.idx >= MG.q.stones.length) return miniEnd(MG.hits >= MG.total - 2, `You defended against ${MG.hits} of ${MG.total} forms.`);
    const st = MG.q.stones[MG.idx++], { hh, hw } = frame();
    const g = slab(st.form, hw * 0.9, hh * 0.16, { greek: true, face: '#f3e7c8' });
    place(g, 0, hh * 0.55); introAnim(g, 0);
    g.userData.stone = st; g.userData.vy = hh * (0.13 + MG.idx * 0.012);
    MG.cur = g; MG.lock = false;
  }
  function defenseUpdate(dt) {
    const g = MG.cur, { hh } = frame();
    if (!g || MG.lock) return;
    g.position.y -= g.userData.vy * dt; g.userData.base.y = g.position.y;
    if (g.position.y < -hh * (MG.q.gates.length > 4 ? 0.32 : 0.42)) { MG.lock = true; KG.app.sfx('bad'); oppReact(false); shatter(g); miss(); setTimeout(defenseNext, 700); }
  }
  function defenseTap(gate) {
    const g = MG.cur; if (!g || MG.lock) return;
    MG.lock = true;
    const st = g.userData.stone, ok = st.cases.includes(gate.userData.pick.gate);
    heroCast();
    if (ok) { MG.hits++; hit(); KG.app.sfx('good'); glow(gate); orb(heroHand(), worldPos(g), 0xffd166, () => { glow(g); setTimeout(defenseNext, 350); }); }
    else {
      KG.app.sfx('bad'); shatter(gate); miss(); setTimeout(() => { gate.visible = true; gate.scale.setScalar(1); }, 900);
      const right = MG.gates.find(x => st.cases.includes(x.userData.pick.gate)); if (right) glow(right, 0xffb040);
      setTimeout(defenseNext, 1100);
    }
  }

  // Parsing Forge: name the tense, then the person and number
  const PNS = ['1st Sg', '2nd Sg', '3rd Sg', '1st Pl', '2nd Pl', '3rd Pl'];
  function forgeStart() { MG.total = MG.q.items.length; MG.idx = 0; forgeNext(); }
  function forgeNext() {
    clearUI(); MG.banner = null;
    if (MG.idx >= MG.q.items.length) return miniEnd(MG.hits >= MG.total - 1, `You forged ${MG.hits} of ${MG.total} verbs.`);
    MG.item = MG.q.items[MG.idx++]; MG.step = 0; MG.lock = false;
    forgeStep();
  }
  function forgeStep() {
    for (const g of [...S.picks]) removePick(g);
    const { hh, hw, portrait } = frame(), it = MG.item;
    miniBanner(MG.step === 0 ? `Parsing Forge: which TENSE is ${it.form}?` : `Now the PERSON and NUMBER of ${it.form}`);
    if (!MG.big) {
      const big = slab(it.form, hw * 1.2, hh * 0.2, { greek: true, face: '#3a3a44', color: '#ffd166' });
      place(big, 0, hh * 0.42); introAnim(big, 0); MG.big = big;
    }
    const opts = MG.step === 0 ? MG.q.tenses : PNS;
    const cols = portrait ? 2 : 3, gap = hw * 0.04, tw = (hw * 1.92 - gap * (cols - 1)) / cols, th = hh * 0.13;
    opts.forEach((o, i) => {
      const g = slab(o, tw, th, { face: '#f3e7c8' });
      place(g, -hw * 0.96 + tw / 2 + (i % cols) * (tw + gap), hh * 0.12 - Math.floor(i / cols) * (th + gap));
      introAnim(g, i * 0.04);
      g.userData.pick = { type: 'mini', val: o }; S.picks.push(g);
    });
  }
  function forgeTap(g) {
    if (MG.lock) return;
    const it = MG.item, v = g.userData.pick.val;
    const fits = MG.step === 0 ? it.reads.some(r => r.tense === v) : it.reads.some(r => r.tense === MG.tense && r.pn === v) || it.reads.some(r => r.pn === v && !it.reads.some(x => x.tense === MG.tense));
    heroCast();
    if (fits) {
      KG.app.sfx('good'); glow(g);
      if (MG.step === 0) { MG.tense = v; MG.step = 1; MG.lock = true; setTimeout(() => { MG.lock = false; forgeStep(); }, 500); }
      else { MG.hits++; MG.lock = true; S.shake = 0.15; orb(heroHand(), worldPos(MG.big), 0xff9f40, () => { glow(MG.big, 0xff9f40); particles(worldPos(MG.big), 0xff9f40, 60, 6); }); setTimeout(() => { MG.big = null; forgeNext(); }, 1000); }
    } else {
      KG.app.sfx('bad'); shatter(g); oppReact(false); MG.lock = true;
      const r = it.reads[0];
      miniBanner(`${it.form} = ${r.tense} ${r.pn}${it.reads.length > 1 ? ' (or ' + it.reads.slice(1).map(x => x.tense + ' ' + x.pn).join(', ') + ')' : ''}`);
      setTimeout(() => { MG.big = null; forgeNext(); }, 2200);
    }
  }

  // Verse Race: pick the next piece of the translation before time runs out
  function raceStart() {
    const R = KG.readings[MG.q.reading];
    MG.total = MG.q.chunks.length; MG.idx = 0; MG.time = 5 + MG.q.chunks.length * 3.5; MG.left = MG.time; MG.built = [];
    const { hh, hw, portrait } = frame();
    // the verse on a scroll below the clock, your translation growing on a strip beneath it, the choices as tablets below
    const b = banner(R.words.map(w => w.w + w.p).join(' '), Math.min(hw * 1.7, 11), portrait ? hh * 0.3 : hh * 0.26, true);
    place(b, 0, hh * (portrait ? 0.5 : 0.52)); introAnim(b, 0);
    if (!MG.q.arcade) { // the arcade has its own clock
      const bw = Math.min(hw * 1.1, 7), bar = new THREE.Mesh(new THREE.BoxGeometry(bw, hh * 0.03, 0.1), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
      place(bar, 0, hh * (portrait ? 0.33 : 0.36)); MG.bar = bar; MG.barW = bw;
    }
    raceChoices();
  }
  function raceChoices() {
    for (const g of MG.items) removePick(g);
    MG.items = [];
    if (MG.idx >= MG.q.chunks.length) return miniEnd(true, `You finished the race with ${Math.ceil(MG.left)} seconds to spare!`);
    const { hh, hw, portrait } = frame(), right = MG.q.chunks[MG.idx];
    const pool = MG.q.chunks.slice(MG.idx + 1).concat(MG.q.extras).filter(c => c !== right);
    const opts = U.shuffle([right, ...U.sample(U.uniq(pool), 2)]);
    if (MG.line) drop(MG.line);
    MG.line = banner(MG.built.length ? MG.built.join(' ') + ' …' : 'Your translation: …', Math.min(hw * 1.5, 10), hh * 0.13); place(MG.line, 0, hh * (portrait ? 0.18 : 0.2));
    // landscape: three tablets side by side; upright: stacked, but not edge to edge
    const gap = hw * 0.05, tw = portrait ? hw * 1.5 : Math.min((hw * 1.8 - gap * 2) / 3, 5), th = portrait ? hh * 0.12 : hh * 0.22;
    opts.forEach((o, i) => {
      const g = slab(o, tw, th, { face: '#f3e7c8', num: i + 1 });
      if (portrait) place(g, 0, -hh * 0.06 - i * (th + hh * 0.04)); else place(g, (i - 1) * (tw + gap), -hh * 0.36);
      introAnim(g, i * 0.05);
      g.userData.pick = { type: 'mini', ok: o === right, val: o }; S.picks.push(g); MG.items.push(g);
    });
    MG.lock = false;
  }
  function raceUpdate(dt) {
    MG.left -= dt;
    if (MG.bar) { const f = Math.max(0, MG.left / MG.time); MG.bar.scale.x = Math.max(0.001, f); MG.bar.position.x = -MG.barW / 2 * (1 - f); MG.bar.material.color.setHex(f > 0.35 ? 0xffd166 : 0xe0453a); }
    hero.position.z = 5.2 - (MG.idx / MG.total) * 6;
    if (MG.left <= 0 && !MG.q.arcade) miniEnd(false, `Time ran out after ${MG.idx} of ${MG.total} pieces. Read the verse again, then race once more!`);
  }
  function raceTap(g) {
    if (MG.lock) return;
    if (g.userData.pick.ok) { MG.hits++; hit(); MG.idx++; MG.built.push(g.userData.pick.val); KG.app.sfx('good'); glow(g); MG.lock = true; setTimeout(raceChoices, 350); }
    else { KG.app.sfx('bad'); shatter(g); MG.left -= 2.5; S.shake = 0.2; miss(); }
  }

  S.debugMini = () => MG; // used by the browser tests
  S.debugScene = () => scene;
  S.orderLine = () => (S.order ? S.order.line.map(c => c.t) : []);
  S.lock = () => { S.locked = true; };
  // outcome animation for a multiple-choice answer (chosen may be -1 for timeouts)
  S.reveal = (ok, chosen, correct) => {
    const right = S.picks.find(p => p.userData.pick && p.userData.pick.i === correct && p.userData.pick.type === 'opt');
    const pick = S.picks.find(p => p.userData.pick && p.userData.pick.i === chosen && p.userData.pick.type === 'opt');
    heroCast();
    if (pick) orb(heroHand(), worldPos(pick), ok ? 0xffd166 : 0xc0c0ff, () => {
      if (ok) { glow(pick); if (opp) orb(worldPos(pick), worldPos(opp).add(new THREE.Vector3(0, 2.4, 0)), 0xffd166, () => { oppReact(true); if (S.oppKind === 'mentor') nod(); }); }
      else { shatter(pick); if (right) setTimeout(() => glow(right), 250); oppReact(false); }
    });
    for (const p of S.picks) if (p !== pick && p !== right && p.visible) tween(0.4, t => p.children[0].material.forEach && p.children[0].material.forEach(m => { m.transparent = true; m.opacity = 1 - t * 0.65; }));
  };
  S.result = ok => { heroCast(); if (ok) { orb(heroHand(), worldPos(opp || hero).add(new THREE.Vector3(0, 2.4, 0)), 0xffd166, () => oppReact(true)); } else oppReact(false); };
  S.hp = frac => { if (hpBar) { const old = hpBar.material.map; hpBar.material.map = hpSprite(Math.max(0, frac)); hpBar.material.needsUpdate = true; if (old) old.dispose(); } };
  S.combo = n => {
    S.comboN = n;
    aura.material.opacity = n >= 3 ? Math.min(0.9, 0.3 + n * 0.05) : 0;
    aura.material.color.setHex(n >= 10 ? 0xff6a2a : n >= 5 ? 0xffb040 : 0xffd166);
  };
  S.celebrate = win => {
    clearUI();
    if (win) {
      for (let i = 0; i < 4; i++) setTimeout(() => particles(new THREE.Vector3((Math.random() - 0.5) * 10, 4 + Math.random() * 3, -2 + Math.random() * 4), U.pick([0xffd166, 0x7fd0ff, 0xff8fab, 0x7ed58f]), 60, 8), i * 220);
      if (opp && FOES.includes(S.oppKind)) { const p = worldPos(opp).add(new THREE.Vector3(0, 2, 0)); shock(p, 0xffffff, 7); setTimeout(() => { if (!S.active) return; particles(p, 0xffd166, 80, 9); shock(p, 0xffd166, 10); popText(p.clone().add(new THREE.Vector3(0, 2, 0)), 'K.O.!', '#ffd166', 1.5); }, 500); }
      if (opp && FOES.includes(S.oppKind)) tween(1.2, t => { opp.rotation.x = -t * 0.5; opp.position.y = oppPos.y - t * 2; opp.scale.setScalar((S.oppKind === 'shade' ? 2.6 : S.oppKind === 'guardian' ? 1.25 : S.oppKind === 'creep' ? 1.7 : 1) * (1 - t * 0.5)); });
      else if (opp && opp.userData.body) nod();
      tween(0.8, t => { hero.position.y = Math.sin(t * Math.PI) * 1.2; hero.rotation.y = HERO_R + t * Math.PI * 2; });
      // fireworks: rockets climb from behind the island and burst into rings of sparks
      for (let i = 0; i < 5; i++) setTimeout(() => {
        const x = (Math.random() - 0.5) * 16, z = -8 - Math.random() * 6, c = U.pick([0xffd166, 0x7fd0ff, 0xff8fab, 0xb388ff, 0x7ed58f]);
        const top = new THREE.Vector3(x, 9 + Math.random() * 4, z), from = new THREE.Vector3(x, 0, z);
        tween(0.6, t => SPK.emit(from.clone().lerp(top, t), { color: 0xfff0c0, n: 1, speed: 0.2, up: 0, gravity: -2, size: 0.3, life: 0.4 }), () => {
          SPK.emit(top, { color: c, n: 70, speed: 7, up: 0.3, gravity: -3, drag: 1.4, size: 0.42, life: 1.4 });
          SPK.emit(top, { color: 0xffffff, n: 20, speed: 2.5, up: 0.2, gravity: -1, size: 0.6, life: 0.5 });
          KG.app.sfx && KG.app.sfx('coin');
        });
      }, 300 + i * 380);
    } else {
      tween(0.8, t => { hero.rotation.x = t * 0.25; });
    }
  };
  S.pointer = pointer;
  S.key = e => {
    // the verse race's numbered tablets answer to 1–3 as well
    if (MG && !MG.over && MG.q.game === 'race' && /^[1-9]$/.test(e.key)) { const g = MG.items[+e.key - 1]; if (g && g.visible) { choose(g); return true; } }
    if (!S.q || S.locked) return false;
    if (/^[1-9]$/.test(e.key) && S.q.type === 'mc') { const g = S.picks.find(p => p.userData.pick.type === 'opt' && p.userData.pick.i === +e.key - 1); if (g) { choose(g); return true; } }
    return false;
  };
  S.resize = () => {
    camera.fov = camera.aspect < 0.9 ? 70 : 55;
    camera.updateProjectionMatrix();
    if (S.q && !S.answered && !MG && S.q.type !== 'mini') S.ask(S.q, S.h); // re-layout to the new screen shape
  };

  S.update = (dt, t) => {
    // framed so the challenger stands above the answer tablets
    camera.position.set(0, 3.4, 12.5);
    camera.lookAt(0, 1.2, -2);
    if (S.shake > 0) { S.shake -= dt; camera.position.x += (Math.random() - 0.5) * S.shake; camera.position.y += (Math.random() - 0.5) * S.shake; }
    sky.position.copy(camera.position);
    camera.updateMatrixWorld();
    uiRoot.position.copy(camera.position); uiRoot.quaternion.copy(camera.quaternion);
    for (const f of S.flames) { const s = 1 + Math.sin(t * 13 + f.position.x) * 0.12; f.scale.set(s, 1 + Math.sin(t * 9) * 0.18, s); f.userData.light.intensity = 5 + Math.sin(t * 17) * 1.2; }
    if (SET) for (const fn of SET.tick) fn(dt, t);
    if (opp) {
      if (opp.userData.float) opp.position.y = oppPos.y + 1.2 + Math.sin(t * 2) * 0.3;
      if (opp.userData.spin) opp.userData.spin.rotation.y += dt * 1.2;
      if (opp.userData.legs) ctx.animatePerson(opp, 0, dt);
      if (opp.userData.flap) { opp.userData.book.position.y = 2.6 + Math.sin(t * 3) * 0.35; opp.userData.flap.forEach(h => { h.rotation.z = h.userData.sd * (0.35 + Math.sin(t * 9) * 0.45); }); }
      if (opp.userData.wobble && opp.userData.body) opp.userData.body.rotation.z = Math.sin(t * 2) * 0.03;
      if (opp.userData.tick) opp.userData.tick(dt, t);
    }
    ctx.animatePerson(hero, 0, dt);
    if (pet) { if (pet.userData.fly) pet.position.y = 2.6 + Math.sin(t * 2.5) * 0.25; else pet.position.y = Math.abs(Math.sin(t * 3)) * 0.05; ctx.animatePet(pet, t, dt); }
    // a hot streak sets the hero's aura burning: gold, then orange, then blue
    if ((S.comboN || 0) >= 3 && (S.flameT = (S.flameT || 0) - dt) <= 0) {
      S.flameT = LOW ? 0.12 : 0.05; const n = S.comboN, a = Math.random() * Math.PI * 2;
      SPK.emit(new THREE.Vector3(hero.position.x + Math.cos(a) * 0.9, 0.2, hero.position.z + Math.sin(a) * 0.9), { color: n >= 10 ? 0x7fd0ff : n >= 5 ? 0xff8a3a : 0xffd166, n: 2, speed: 0.4, up: 1, gravity: 2.5 + n * 0.1, drag: 0.5, size: 0.38, life: 0.7 });
    }
    aura.scale.setScalar(1 + Math.sin(t * 4) * 0.08 + (S.comboN || 0) * 0.02); aura.rotation.z += dt;
    if (S.big) S.big.position.y = S.big.userData.base.y + Math.sin(t * 2) * 0.06;
    for (const p of S.picks) if (p.visible && p.userData.base && !(S.sel === p)) p.rotation.y = Math.sin(t * 1.3 + p.userData.base.x) * 0.04;
    if (MG && !MG.over) { MG.t += dt; ({ rain: rainUpdate, defense: defenseUpdate, race: raceUpdate }[MG.q.game] || (() => {}))(dt); }
    else if (!MG) hero.position.z += (5.2 - hero.position.z) * Math.min(1, dt * 4);
    // run this frame's animations; any started by one of them (a hit's damage number, shock ring, knockback) join the list instead of being lost
    const run = S.anims; S.anims = []; S.anims = run.filter(fn => fn(dt) !== false).concat(S.anims);
    SPK.update(dt);
  };
  S.render = r => {
    // the island glows softly (spells, flames, lamps) when the host lends a bloom pass; the tablets are drawn on top
    if (ctx.bloom && ctx.bloom.enabled) { ctx.bloom.render(scene, camera); r.autoClear = false; r.clearDepth(); r.render(uiScene, camera); r.autoClear = true; return; }
    r.autoClear = false; r.clear();
    r.render(scene, camera);
    r.clearDepth();
    r.render(uiScene, camera);
    r.autoClear = true;
  };
  return S;
}
