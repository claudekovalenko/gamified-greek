// The places where the people of the road teach, so that going from one lesson
// to the next is a little trip rather than a queue: a cottage you walk into, an
// island you reach by hopping across stepping stones, a garden behind a word
// gate, a lookout up a stair, a campfire and a market stall. Each gets a trail
// of stones from the road and a signpost with the teacher's name.
//
// Koine Quest and Going Deeper Quest share this file unchanged. The host passes:
// ctx = { THREE, add(obj), mesh(geo, color, opts), rawGround(x, z) (ground without
//   the venues), col(x, z, r) → collider object, keep(x, z, r) (keep trees and
//   side quests away), free(x, z, r) → open ground?, textSprite, glow(color, size),
//   SPK (fx sparks), water() → water material, splash(x, z, face), smoke(pos) (optional) }
// and asks ground(x, z, base) for the height of floors, decks and stones.

export const WHERE = { campfire: 'by the campfire', house: 'in the cottage', stones: 'on the island in the pond', stall: 'at the market stall', garden: 'behind the word gate', lookout: 'up on the lookout' };
export const HELLO = {
  campfire: 'Come, warm your hands by the fire.',
  house: 'Come in, come in! Mind the step.',
  stones: 'You made it across without a splash? Well done!',
  stall: 'Fresh words, fresh words! Step up to my stall.',
  garden: 'You opened the gate! Welcome to my garden.',
  lookout: 'Up here you can see the whole road. Catch your breath.',
};
const SHORT = { campfire: 'campfire', house: 'cottage', stones: 'island', stall: 'stall', garden: 'garden', lookout: 'lookout' };
const RADIUS = { campfire: 3.8, house: 5.8, stones: 6.4, stall: 2.8, garden: 5.4, lookout: 4.8 };
// how uneven the ground may be under each (the cottage and lookout stand on foundations and posts)
const SLOPE = { campfire: 1.4, house: 3, stones: 9, stall: 1.6, garden: 1.4, lookout: 3 };
const OFF = { campfire: 8.5, house: 12.5, stones: 12.5, stall: 5.8, garden: 11, lookout: 10.5 };
// Stepping out of a cottage, the world outside has changed: each visit moves the
// day on to the next of these. moodAtmos(A, m) returns world look A in mood m
// (0 = the world as it is), with the same keys (top, mid, bot, sun, sunI, hemi, fog, clouds, stars),
// plus hemiSky, hemiGround, exposure and grade ([tint, saturation]) for the host to apply.
export const MOODS = [
  null,
  { name: 'sunset', say: '🌇 The sun is setting outside.', top: 0x3a2a78, mid: 0xf4a868, bot: 0xffe0b0, sun: 0xffa050, sunI: 1.9, hemi: 0.95, fog: [50, 200], clouds: 0.5, stars: 0.2, sunDir: [-0.4, 0.1, -0.9], water: [0x3a3a6a, 0xe0a070], hemiSky: 0xffc890, hemiGround: 0x5a3a2a, exposure: 0.9, grade: [0xfff0e0, 1.08] },
  { name: 'night', say: '🌙 Night has fallen while you were inside. Look at the stars!', top: 0x070c26, mid: 0x26346a, bot: 0x5a6898, sun: 0xa8b8ff, sunI: 0.5, hemi: 0.55, fog: [35, 170], clouds: 0.2, stars: 1, sunDir: [0.2, 0.35, -0.9], water: [0x0c1838, 0x3a5a98], hemiSky: 0x6a84d0, hemiGround: 0x141a30, exposure: 0.62, grade: [0xe8eeff, 0.85] },
  { name: 'dawn', say: '🌄 Morning mist. A new day!', top: 0x7a86c0, mid: 0xf2c8c4, bot: 0xfff2e4, sun: 0xffd2b8, sunI: 1.6, hemi: 1.1, fog: [14, 95], clouds: 0.6, stars: 0, sunDir: [0.6, 0.12, -0.8], water: [0x5a7aa8, 0xf0c8c8], hemiSky: 0xffe0e8, hemiGround: 0x6a6a5a, exposure: 1.05, grade: [0xfff4f4, 0.95] },
  { name: 'storm', say: '⛈️ Storm clouds rolled in!', top: 0x2e3440, mid: 0x7e8894, bot: 0xaab2bc, sun: 0xd8e0ff, sunI: 0.7, hemi: 0.9, fog: [22, 130], clouds: 1, stars: 0, water: [0x1e2a36, 0x6a7a88], hemiSky: 0xa8b4c8, hemiGround: 0x2a3430, exposure: 0.78, grade: [0xf0f4f8, 0.75] },
];
// what drifts in the air in each mood: fireflies at night, rain in the storm, petals at dawn
const MOTES = {
  night: { every: 0.12, o: { colors: [0xd8ff70, 0xfff090], n: 1, speed: 0.4, up: 0.15, gravity: 0.15, drag: 0.3, size: 0.28, size1: 0.1, life: 3.2, spread: 6 } },
  storm: { every: 0.012, o: { color: 0xc8d8f0, n: 2, speed: 0.2, up: -14, gravity: -12, drag: 0, size: 0.2, size1: 0.16, life: 0.9, spread: 9 }, high: 9 },
  dawn: { every: 0.15, o: { colors: [0xffc8d8, 0xfff0f4], n: 1, speed: 0.6, up: -0.4, gravity: -0.5, drag: 0.6, size: 0.22, size1: 0.18, life: 4, spread: 8 }, high: 5 },
};
let moteT = 0;
export function moodMotes(m, sparks, pos, dt) {
  const M = MOODS[m % MOODS.length], k = M && MOTES[M.name];
  if (!k) return;
  for (moteT += dt; moteT > k.every; moteT -= k.every) {
    const a = Math.random() * 6.283, r = 2 + Math.random() * k.o.spread;
    sparks.emit({ x: pos.x + Math.cos(a) * r, y: pos.y + (k.high || 1) + Math.random() * 1.5, z: pos.z + Math.sin(a) * r }, k.o);
  }
}
export const moodAtmos = (A, m) => (m % MOODS.length ? Object.assign({}, A, MOODS[m % MOODS.length]) : A);
export const VENUE_TYPES = ['campfire', 'house', 'stones', 'stall', 'garden', 'lookout'];
// the wanted type first, then the rest in a rotating order so the fallbacks vary too
export const venueOrder = n => VENUE_TYPES.map((_, k) => VENUE_TYPES[(n + k) % VENUE_TYPES.length]);

export function makeVenues(ctx) {
  const { THREE } = ctx;
  const C = 16, cells = new Map(), list = [], anims = [];
  const raw = (x, z) => ctx.rawGround(x, z);
  const key = (i, j) => i * 100003 + j;
  // a raised surface: h(x, z) gives its height there, or null
  function plat(x, z, r, h) {
    const p = { x, z, r, h };
    for (let i = Math.floor((x - r) / C); i <= Math.floor((x + r) / C); i++) for (let j = Math.floor((z - r) / C); j <= Math.floor((z + r) / C); j++) {
      const k = key(i, j); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(p);
    }
  }
  function ground(x, z, base) {
    const L = cells.get(key(Math.floor(x / C), Math.floor(z / C)));
    if (!L) return base;
    let h = base;
    for (const p of L) {
      if (Math.abs(x - p.x) > p.r || Math.abs(z - p.z) > p.r) continue;
      const v = p.h(x, z); if (v !== null && v > h) h = v;
    }
    return h;
  }
  // local frame: +z points from the venue towards the road
  function frame(cx, cz, face) {
    const c = Math.cos(face), s = Math.sin(face);
    return {
      w: (lx, lz) => ({ x: cx + lx * c + lz * s, z: cz - lx * s + lz * c }),
      l: (x, z) => { const dx = x - cx, dz = z - cz; return { x: dx * c - dz * s, z: dx * s + dz * c }; },
    };
  }
  // window light; the host dims it at night with setDaylight
  const windowMats = new Set(); // cottage windows glow brighter after dark
  const beamMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const tween = (dur, fn) => { let t = 0; anims.push(dt => { t = Math.min(1, t + dt / dur); fn(t); return t < 1; }); };
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  function start(cx, cz, face) {
    const F = frame(cx, cz, face), G = new THREE.Group();
    G.position.set(cx, 0, cz); G.rotation.y = face; ctx.add(G);
    const add = (geo, color, x, y, z, opts, parent = G) => { const m = ctx.mesh(geo, color, opts); m.position.set(x, y, z); parent.add(m); return m; };
    const basic = (geo, color, x, y, z, parent = G) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color })); m.position.set(x, y, z); parent.add(m); return m; };
    const col = (lx, lz, r) => { const p = F.w(lx, lz); return ctx.col(p.x, p.z, r); };
    const rawL = (lx, lz) => { const p = F.w(lx, lz); return raw(p.x, p.z); };
    // samples the ground over a local box
    const range = (x0, x1, z0, z1, step = 1) => { let lo = 1e9, hi = -1e9; for (let x = x0; x <= x1 + 1e-6; x += step) for (let z = z0; z <= z1 + 1e-6; z += step) { const g = rawL(x, z); lo = Math.min(lo, g); hi = Math.max(hi, g); } return { lo, hi }; };
    const glowAt = (color, size, x, y, z, parent = G) => { const g = ctx.glow(color, size); g.position.set(x, y, z); parent.add(g); return g; };
    return { F, G, add, basic, col, rawL, range, glowAt, groups: [G] };
  }
  // flames that flicker, with embers rising
  function fire(B, x, y, z, s = 1) {
    const outer = B.basic(new THREE.ConeGeometry(0.45 * s, 1.2 * s, 7), 0xff7a20, x, y + 0.55 * s, z);
    const inner = B.basic(new THREE.ConeGeometry(0.25 * s, 0.8 * s, 7), 0xffd040, x, y + 0.42 * s, z);
    B.glowAt(0xff9a40, 4.2 * s, x, y + 0.8 * s, z);
    let et = 0;
    return (dt, t, F) => {
      outer.scale.set(1 + Math.sin(t * 13) * 0.1, 1 + Math.sin(t * 9) * 0.16, 1 + Math.cos(t * 11) * 0.1);
      inner.scale.set(1, 1 + Math.sin(t * 15 + 1) * 0.2, 1);
      if ((et -= dt) <= 0) { et = 0.14; const p = F.w(x, z); ctx.SPK.emit(V3(p.x, y + 1.1 * s, p.z), { color: 0xffa040, n: 1, speed: 0.5, up: 1, gravity: 1.2, size: 0.25, life: 1.4 }); }
    };
  }

  // ── 🔥 campfire ────────────────────────────────────────────
  function campfire(cx, cz, face) {
    const B = start(cx, cz, face), y0 = raw(cx, cz);
    B.G.position.y = y0;
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; B.add(new THREE.DodecahedronGeometry(0.28, 0), 0x8a8378, Math.cos(a), 0.12, Math.sin(a)); }
    for (const a of [-0.45, 0.45]) { const l = B.add(new THREE.CylinderGeometry(0.1, 0.1, 1, 6), 0x5a3a20, 0, 0.15, 0); l.rotation.set(0, a, Math.PI / 2); }
    const flame = fire(B, 0, 0, 0);
    for (const a of [0.25, 2.9, 3.9, 5.5]) {
      const x = Math.cos(a) * 2.4, z = Math.sin(a) * 2.4;
      const log = B.add(new THREE.CylinderGeometry(0.24, 0.24, 1.9, 8), 0x7a5230, x, 0.24, z); log.rotation.set(0, -a, Math.PI / 2);
      B.col(x, z, 0.55);
    }
    // a pot on a tripod over the flames, steaming gently, and a kettle and bedroll nearby
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + 0.3, l = B.add(new THREE.CylinderGeometry(0.04, 0.05, 2.1, 5), 0x4a3020, Math.cos(a) * 0.55, 0.95, Math.sin(a) * 0.55); l.rotation.set(-Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5); }
    B.add(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 3), 0x2a2a2a, 0, 1.65, 0);
    const pot = B.add(new THREE.SphereGeometry(0.3, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), 0x3a3a40, 0, 1.38, 0, { metalness: 0.5, roughness: 0.5 }); pot.rotation.x = Math.PI;
    B.add(new THREE.CylinderGeometry(0.035, 0.05, 0.03, 10), 0x2a2a30, 0, 1.38, 0);
    const roll = B.add(new THREE.CylinderGeometry(0.22, 0.22, 1.2, 10), 0x5a7a9a, 1.8, 0.22, -1.6); roll.rotation.set(0, 0.6, Math.PI / 2);
    let steamT = 0;
    B.col(0, 0, 0.9);
    return { B, teacher: [0, -2.0], entry: [0, 3.5], update: (dt, t) => { // close enough to talk to across the fire
      flame(dt, t, B.F);
      if (ctx.smoke && (steamT -= dt) <= 0) { steamT = 0.5; const p = B.F.w(0, 0); ctx.smoke(V3(p.x, B.G.position.y + 1.6, p.z)); }
    } };
  }

  // ── 🛒 market stall ────────────────────────────────────────
  function stall(cx, cz, face) {
    const B = start(cx, cz, face), y0 = raw(cx, cz);
    B.G.position.y = y0;
    B.add(new THREE.BoxGeometry(2.8, 1, 0.9), 0x9a6a3a, 0, 0.5, 0.25);
    B.add(new THREE.BoxGeometry(3, 0.08, 1.1), 0xc8a070, 0, 1.04, 0.25);
    for (const x of [-1.45, 1.45]) for (const z of [0.8, -0.9]) B.add(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), 0x6a4a2a, x, 1.3, z);
    for (let i = 0; i < 6; i++) { const s = B.add(new THREE.BoxGeometry(0.5, 0.06, 2.2), i % 2 ? 0xf5ecd0 : 0xc9452b, -1.25 + i * 0.5, 2.6, -0.05); s.rotation.x = -0.2; }
    const wares = [0xc9452b, 0xe0a526, 0x7aa84a, 0x8a5aa8];
    for (let i = 0; i < 3; i++) {
      const x = -0.9 + i * 0.9;
      B.add(new THREE.CylinderGeometry(0.28, 0.22, 0.22, 10), 0xb08850, x, 1.19, 0.3);
      for (let k = 0; k < 4; k++) B.add(new THREE.SphereGeometry(0.1, 6, 5), wares[(i + k) % 4], x + (k % 2 - 0.5) * 0.18, 1.33, 0.3 + (k < 2 ? -0.08 : 0.08));
    }
    B.add(new THREE.BoxGeometry(0.6, 0.6, 0.6), 0xb08850, 1.95, 0.3, -0.4); B.add(new THREE.BoxGeometry(0.5, 0.5, 0.5), 0xa07840, 1.95, 0.85, -0.4);
    B.add(new THREE.SphereGeometry(0.12, 8, 6), 0xffe9a8, 1.3, 2.15, 0.85, { emissive: 0xffc04a, emissiveIntensity: 1.3 });
    B.glowAt(0xffc870, 1.6, 1.3, 2.15, 0.85);
    // a scalloped fringe on the awning, bunting overhead, hanging pots and a rug of baskets out front
    const fringe = [];
    for (let i = 0; i < 12; i++) { const f = B.add(new THREE.ConeGeometry(0.13, 0.22, 3), i % 2 ? 0xc9452b : 0xf5ecd0, -1.375 + i * 0.25, 2.33, 1.02); f.rotation.x = Math.PI; fringe.push(f); }
    const flags = [], fc = [0xe0a526, 0x2f5f8f, 0xc9452b, 0x7aa84a, 0x8a5aa8];
    for (let i = 0; i < 9; i++) { const x = -1.45 + i * 0.36, y = 2.5 - Math.sin(i / 8 * Math.PI) * 0.35; const f = B.add(new THREE.ConeGeometry(0.1, 0.24, 3), fc[i % 5], x, y, 0.82); f.rotation.x = Math.PI; flags.push(f); }
    for (const x of [-0.7, 0.4]) { B.add(new THREE.CylinderGeometry(0.01, 0.01, 0.4, 3), 0x3a2a1a, x, 2.15, 0.6); B.add(new THREE.SphereGeometry(0.17, 8, 6), x < 0 ? 0xb5523a : 0x8a7a6a, x, 1.85, 0.6).scale.y = 1.2; }
    const rug = B.add(new THREE.PlaneGeometry(1.8, 1.1), 0x8a2a3a, -0.2, 0.03, 1.55); rug.rotation.x = -Math.PI / 2;
    for (const [x, c] of [[-0.75, 0xe0a526], [-0.2, 0x7aa84a], [0.35, 0xc9452b]]) { B.add(new THREE.CylinderGeometry(0.22, 0.17, 0.25, 9), 0xb08850, x, 0.15, 1.55); B.add(new THREE.SphereGeometry(0.18, 7, 5), c, x, 0.27, 1.55).scale.y = 0.5; }
    for (const x of [-0.95, 0, 0.95]) B.col(x, 0.25, 0.55);
    B.col(1.95, -0.4, 0.45);
    return { B, teacher: [0, -0.6], entry: [0, 2.6], update: (dt, t) => {
      fringe.forEach((f, i) => { f.rotation.z = Math.sin(t * 2.4 + i * 0.6) * 0.18; });
      flags.forEach((f, i) => { f.rotation.x = Math.PI + Math.sin(t * 3 + i) * 0.25; });
    } };
  }

  // ── 🏠 cottage: walk in through the door into a room of its own ──
  function house(cx, cz, face, o) {
    const B = start(cx, cz, face), W = 8.4, D = 7, H = 3.4;
    const { lo, hi } = B.range(-W / 2, W / 2, -D / 2, D / 2, W / 4);
    const fy = hi + 0.25;
    B.add(new THREE.BoxGeometry(W + 0.4, fy - lo + 0.6, D + 0.4), 0x9a8f80, 0, (fy + lo - 0.6) / 2 - 0.06, 0);
    B.add(new THREE.BoxGeometry(W, 0.12, D), 0xa07850, 0, fy - 0.06, 0);
    const walls = new THREE.Group(); walls.position.y = fy; B.G.add(walls);
    // every cottage is its own: walls, roof, rug and timbers vary with the teacher
    const V = (o.id || 0) * 7 + 3, pick = L => L[V % L.length];
    const plaster = pick([0xeadfc8, 0xf2e6c8, 0xe8d8c0, 0xdfe6e0, 0xf0dcc8]), timber = pick([0x5a3a20, 0x4a2e1a, 0x6a4a2a]), roofC = pick([0xb5523a, 0x5a6a8a, 0x8a5a3a, 0x6a8a4a, 0x9a3a3a, 0x4a5a6a]);
    const rugC = pick([0x8a2a3a, 0x2f5f8f, 0x3f7d5a, 0x7a4a9a]), w = (x, z, len, alongX) => B.add(new THREE.BoxGeometry(alongX ? len : 0.3, H, alongX ? 0.3 : len), plaster, x, H / 2, z, undefined, walls);
    w(0, -D / 2, W, true); w(-W / 2, 0, D, false); w(W / 2, 0, D, false);
    const seg = (W - 1.8) / 2; w(-(0.9 + seg / 2), D / 2, seg, true); w(0.9 + seg / 2, D / 2, seg, true);
    B.add(new THREE.BoxGeometry(1.8, H - 2.35, 0.3), plaster, 0, (H + 2.35) / 2, D / 2, undefined, walls);
    for (const x of [-W / 2, W / 2]) for (const z of [-D / 2, D / 2]) B.add(new THREE.BoxGeometry(0.38, H + 0.05, 0.38), timber, x, H / 2, z, undefined, walls);
    for (const x of [-1, 1]) B.add(new THREE.BoxGeometry(0.2, 2.35, 0.36), timber, x * 0.95, 1.17, D / 2, undefined, walls);
    B.add(new THREE.BoxGeometry(W, 0.16, 0.34), timber, 0, 2.1, -D / 2, undefined, walls);
    for (const s of [-1, 1]) {
      windowMats.add(B.add(new THREE.BoxGeometry(0.36, 0.9, 1.2), 0xffe08a, s * W / 2, 1.7, 0, { emissive: 0xffb84a, emissiveIntensity: 0.7 }, walls).material);
      B.add(new THREE.BoxGeometry(0.42, 0.1, 1.4), timber, s * W / 2, 1.2, 0, undefined, walls);
    }
    // flower boxes under the windows
    for (const sd of [-1, 1]) {
      B.add(new THREE.BoxGeometry(0.3, 0.22, 1.3), timber, sd * (W / 2 + 0.2), 1.12, 0, undefined, walls);
      for (let k = 0; k < 4; k++) B.add(new THREE.SphereGeometry(0.11, 6, 5), pick([[0xe05a6a, 0xffd166], [0xc84aa8, 0xffffff], [0xffa040, 0xe0e050]])[k % 2], sd * (W / 2 + 0.24), 1.3, -0.45 + k * 0.3, undefined, walls);
    }
    // the door stands open
    const hinge = new THREE.Group(); hinge.position.set(0.9, fy, D / 2 + 0.15); hinge.rotation.y = 1.9; B.G.add(hinge);
    B.add(new THREE.BoxGeometry(1.0, 2.2, 0.1), 0x6a3a1a, -0.5, 1.1, 0, undefined, hinge);
    const roof = new THREE.Group(); roof.position.y = fy + H; B.G.add(roof);
    const cone = B.add(new THREE.ConeGeometry((W + 1.4) / Math.SQRT2, 2.6, 4, 1), roofC, 0, 1.3, 0, undefined, roof);
    cone.rotation.y = Math.PI / 4; cone.scale.z = (D + 1.4) / (W + 1.4);
    B.add(new THREE.BoxGeometry(0.7, 2, 0.7), 0x8a7a6a, W / 2 - 1.4, 1.5, -D / 2 + 1.3, undefined, roof);
    let smokeT = 0; const chim = B.F.w(W / 2 - 1.4, -D / 2 + 1.3);
    // inside: a rug, a table, books, a fire and a board with the lesson
    const inn = new THREE.Group(); inn.position.y = fy; B.G.add(inn);
    const rug = B.add(new THREE.CircleGeometry(1.7, 24), rugC, 0, 0.02, 0.6, undefined, inn); rug.rotation.x = -Math.PI / 2;
    const trim = B.add(new THREE.RingGeometry(1.45, 1.6, 24), 0xe0b040, 0, 0.03, 0.6, undefined, inn); trim.rotation.x = -Math.PI / 2;
    B.add(new THREE.BoxGeometry(1.6, 0.08, 0.9), 0x8a5a2a, -2.4, 0.8, -1.5, undefined, inn);
    for (const x of [-0.7, 0.7]) for (const z of [-0.35, 0.35]) B.add(new THREE.BoxGeometry(0.08, 0.8, 0.08), 0x5a3a20, -2.4 + x, 0.4, -1.5 + z, undefined, inn);
    B.add(new THREE.BoxGeometry(1.4, 0.1, 0.4), 0x8a5a2a, -2.4, 0.45, -0.7, undefined, inn);
    B.add(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 6), 0xf5ecd0, -2.0, 0.97, -1.6, undefined, inn);
    B.glowAt(0xffd890, 1.2, -2.0, 1.15, -1.6, inn);
    B.add(new THREE.BoxGeometry(2.2, 2.3, 0.5), 0x6a4a2a, -2.3, 1.15, -D / 2 + 0.45, undefined, inn);
    const bk = [0xc9452b, 0x2f5f8f, 0xe0a526, 0x3f7d5a, 0x8f3f9f, 0xf5ecd0];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 7; i++) B.add(new THREE.BoxGeometry(0.2, 0.42 + (i * 7 + r) % 3 * 0.06, 0.36), bk[(i + r * 2) % 6], -3.2 + i * 0.27, 0.5 + r * 0.65, -D / 2 + 0.55, undefined, inn);
    B.add(new THREE.BoxGeometry(1.8, 1.7, 0.7), 0x8a8378, 2.4, 0.85, -D / 2 + 0.5, undefined, inn);
    B.add(new THREE.BoxGeometry(1.1, 0.9, 0.12), 0x1a1208, 2.4, 0.55, -D / 2 + 0.86, undefined, inn);
    B.add(new THREE.BoxGeometry(2.1, 0.12, 0.85), 0x6a4a2a, 2.4, 1.76, -D / 2 + 0.55, undefined, inn);
    const flame = fire({ basic: (g, c, x, y, z) => B.basic(g, c, x, y, z, inn), glowAt: (c, s, x, y, z) => B.glowAt(c, s, x, y, z, inn) }, 2.4, 0.05, -D / 2 + 0.75, 0.85);
    B.add(new THREE.BoxGeometry(0.8, 0.12, 0.12), 0x4a2a14, 2.25, 0.08, -D / 2 + 0.8, undefined, inn).rotation.y = 0.4; // logs in the grate
    B.add(new THREE.BoxGeometry(0.8, 0.12, 0.12), 0x4a2a14, 2.55, 0.12, -D / 2 + 0.75, undefined, inn).rotation.y = -0.5;
    B.add(new THREE.BoxGeometry(2.3, 1.2, 0.08), 0x2a3a2a, 0, 1.9, -D / 2 + 0.2, undefined, inn);
    if (o.title) { const t = ctx.textSprite(o.title, { size: 34, bg: null, color: '#f5f0dc', scale: 0.0068 }); t.position.set(0, 1.9, -D / 2 + 0.35); inn.add(t); }
    B.add(new THREE.CylinderGeometry(0.3, 0.22, 0.45, 8), 0xb5523a, W / 2 - 0.7, 0.22, D / 2 - 0.8, undefined, inn);
    // a ceiling with beams and a hanging lantern: once you're in, you're in a room of your own
    const ceil = B.add(new THREE.PlaneGeometry(W, D), 0xc8b090, 0, H - 0.02, 0, undefined, inn); ceil.rotation.x = Math.PI / 2;
    for (let x = -W / 2 + 1; x < W / 2; x += 1.6) B.add(new THREE.BoxGeometry(0.22, 0.26, D), timber, x, H - 0.15, 0, undefined, inn);
    const lx = -1.9, lz = 0.6;
    B.add(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 4), 0x2a2a2a, lx, H - 0.4, lz, undefined, inn);
    B.add(new THREE.BoxGeometry(0.3, 0.38, 0.3), 0xffe09a, lx, H - 0.9, lz, { emissive: 0xffb84a, emissiveIntensity: 1.3 }, inn);
    B.add(new THREE.ConeGeometry(0.26, 0.2, 4), 0x3a2a1a, lx, H - 0.62, lz, undefined, inn).rotation.y = Math.PI / 4;
    B.glowAt(0xffc870, 2.6, lx, H - 0.9, lz, inn);
    // sunbeams slant in through the windows onto the floor
    for (const sd of [-1, 1]) {
      const wx = sd * (W / 2 - 0.2), fx = sd * (W / 2 - 2.3), V = [
        [wx, 2.15, -0.6], [wx, 2.15, 0.6], [wx, 1.25, 0.6], [wx, 1.25, -0.6],
        [fx, 0.03, -0.1], [fx, 0.03, 1.3], [fx + sd * 0.9, 0.03, 1.3], [fx + sd * 0.9, 0.03, -0.1]];
      const pos = [], col = [];
      const quad = (a, b, c, d) => { for (const i of [a, b, c, a, c, d]) { pos.push(...V[i]); col.push(1, 0.9, 0.7, i < 4 ? 0.22 : 0.0); } };
      quad(0, 1, 5, 4); quad(1, 2, 6, 5); quad(2, 3, 7, 6); quad(3, 0, 4, 7);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
      const beam = new THREE.Mesh(g, beamMat); beam.renderOrder = 4; inn.add(beam);
    }
    // each cottage keeps its own things: herbs drying from a beam, a cat asleep by the fire, a tapestry, a loom or a chest of scrolls
    const has = k => ((V >> k) & 1) === 1;
    if (has(0)) for (let k = 0; k < 5; k++) { B.add(new THREE.CylinderGeometry(0.01, 0.01, 0.35, 3), 0x3a2a1a, -2.6 + k * 0.35, H - 0.45, -1.6, undefined, inn); B.add(new THREE.ConeGeometry(0.1, 0.35, 5), [0x6a8a3a, 0x8a9a4a, 0x7a5a8a][k % 3], -2.6 + k * 0.35, H - 0.75, -1.6, undefined, inn).rotation.x = Math.PI; }
    if (has(1)) { const cat = B.add(new THREE.SphereGeometry(0.22, 8, 6), pick([0x2a2a2a, 0xd8803a, 0x8a8a8a]), 1.6, 0.14, -D / 2 + 1.45, undefined, inn); cat.scale.set(1.3, 0.6, 1); B.add(new THREE.SphereGeometry(0.12, 8, 6), cat.material.color.getHex(), 1.92, 0.2, -D / 2 + 1.5, undefined, inn); for (const s2 of [-1, 1]) B.add(new THREE.ConeGeometry(0.04, 0.09, 4), cat.material.color.getHex(), 1.95, 0.32, -D / 2 + 1.5 + s2 * 0.06, undefined, inn); }
    if (has(2)) { const tp = B.add(new THREE.PlaneGeometry(1.4, 1.8), pick([0x8a2a3a, 0x2f5f8f, 0x3f7d5a, 0x7a4a9a]), -W / 2 + 0.17, 1.9, 1.9, undefined, inn); tp.rotation.y = Math.PI / 2; B.add(new THREE.PlaneGeometry(1.1, 1.4), 0xe0b040, -W / 2 + 0.18, 1.9, 1.9, undefined, inn).rotation.y = Math.PI / 2; B.add(new THREE.PlaneGeometry(0.9, 1.2), pick([0x8a2a3a, 0x2f5f8f, 0x3f7d5a]), -W / 2 + 0.19, 1.9, 1.9, undefined, inn).rotation.y = Math.PI / 2; }
    if (has(3)) { B.add(new THREE.BoxGeometry(1.1, 0.6, 0.6), 0x6a4a2a, W / 2 - 0.8, 0.3, 0.5, undefined, inn); for (let k = 0; k < 5; k++) { const sc = B.add(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8), 0xf5e6c0, W / 2 - 1.15 + k * 0.17, 0.66, 0.5, undefined, inn); sc.rotation.z = Math.PI / 2; } }
    else { B.add(new THREE.BoxGeometry(0.1, 1.4, 1.2), 0x6a4a2a, W / 2 - 0.5, 0.7, 0.6, undefined, inn); for (let k = 0; k < 8; k++) B.add(new THREE.BoxGeometry(0.02, 1.2, 0.02), 0xe8d8a8, W / 2 - 0.5, 0.75, 0.1 + k * 0.14, undefined, inn); }
    B.col(W / 2 - 0.8, 0.5, 0.55); // the chest or loom
    // a window seat and a map on the wall
    B.add(new THREE.BoxGeometry(0.6, 0.45, 1.6), 0x8a5a2a, -W / 2 + 0.5, 0.22, 0, undefined, inn);
    B.add(new THREE.BoxGeometry(0.5, 0.14, 1.5), 0x3f6d8a, -W / 2 + 0.5, 0.5, 0, undefined, inn);
    B.add(new THREE.BoxGeometry(0.05, 0.9, 1.3), 0xe8d8a8, W / 2 - 0.18, 1.6, D / 2 - 2.2, undefined, inn);
    B.add(new THREE.IcosahedronGeometry(0.45, 0), 0x4f8f3a, W / 2 - 0.7, 0.75, D / 2 - 0.8, undefined, inn);
    // walls block, except at the door
    for (let x = -W / 2; x <= W / 2 + 1e-6; x += 0.6) { B.col(x, -D / 2, 0.35); if (Math.abs(x) > 1.1) B.col(x, D / 2, 0.35); }
    for (let z = -D / 2 + 0.6; z < D / 2; z += 0.6) { B.col(-W / 2, z, 0.35); B.col(W / 2, z, 0.35); }
    B.col(-2.4, -1.4, 0.75); B.col(2.4, -D / 2 + 0.7, 0.8); B.col(-W / 2 + 0.6, -0.45, 0.45); B.col(-W / 2 + 0.6, 0.45, 0.45);
    // the floor, and a step up to the door
    // the steps up to the door are a gentle ramp underfoot, as long as the plinth is high
    const F = B.F, SL = Math.max(1.2, (fy - B.rawL(0, D / 2 + 2)) / 0.7), gd = B.rawL(0, D / 2 + 0.2 + SL);
    plat(cx, cz, Math.hypot(W, D) / 2 + 1, (x, z) => { const l = F.l(x, z); return Math.abs(l.x) < W / 2 + 0.2 && l.z > -D / 2 - 0.2 && l.z < D / 2 + 0.2 ? fy : null; });
    if (fy - gd > 0.08) {
      const n = Math.max(2, Math.round(SL / 0.45));
      for (let j = 0; j < n; j++) { const top = fy - (j + 1) * (fy - gd) / (n + 0.3); B.add(new THREE.BoxGeometry(2.2, top - gd + 0.3, SL / n), 0x9a8f80, 0, (top + gd - 0.3) / 2, D / 2 + 0.2 + (j + 0.5) * SL / n); }
      plat(cx, cz, Math.hypot(W, D) / 2 + SL + 1, (x, z) => { const l = F.l(x, z); return Math.abs(l.x) < 1.1 && l.z >= D / 2 + 0.2 && l.z <= D / 2 + 0.2 + SL ? fy - (l.z - D / 2 - 0.2) / SL * (fy - gd) : null; });
    }
    return {
      B, teacher: [0.5, -1.3], entry: [0, D / 2 + SL + 1], y: fy, room: true,
      inside: p => { const l = F.l(p.x, p.z); return Math.abs(l.x) < W / 2 - 0.25 && Math.abs(l.z) < D / 2 - 0.15; },
      // the camera's spot in the room: high up by the door, looking in, drifting across as you walk
      roomCam(pos, c) {
        const l = F.l(pos.x, pos.z), p = F.w(Math.max(-1.6, Math.min(1.6, l.x * 0.5)), D / 2 - 0.5);
        c.set(p.x, fy + H - 0.45, p.z);
      },
      // keeps the camera inside the room, under the ceiling
      clampCam(c) {
        const l = F.l(c.x, c.z), m = 0.45, p = F.w(Math.max(-W / 2 + m, Math.min(W / 2 - m, l.x)), Math.max(-D / 2 + m, Math.min(D / 2 - m, l.z)));
        c.x = p.x; c.z = p.z; c.y = Math.max(fy + 0.9, Math.min(fy + H - 0.4, c.y));
      },
      update(dt, t) {
        flame(dt, t, F);
        // smoke curls from the chimney
        if (ctx.smoke && (smokeT -= dt) <= 0) { smokeT = 0.35; ctx.smoke(V3(chim.x, fy + H + 2.7, chim.z)); }
      },
    };
  }

  // ── 🪨 an island in a pond, reached by hopping across stepping stones ──
  function stones(cx, cz, face, o) {
    const F = frame(cx, cz, face);
    let lo = 1e9, hi = -1e9;
    for (let x = -5.4; x <= 5.4; x += 1.35) for (let z = -5.4; z <= 6.6; z += 1.35) { if (Math.hypot(x, z) > 6.6) continue; const p = F.w(x, z), g = raw(p.x, p.z); lo = Math.min(lo, g); hi = Math.max(hi, g); }
    if (hi - lo > 1.5) return null; // fairly flat ground
    const B = start(cx, cz, face), wy = hi + 0.12, mir = o.id % 2 ? -1 : 1;
    const water = new THREE.Mesh(new THREE.CircleGeometry(5.5, 40), ctx.water()); water.rotation.x = -Math.PI / 2; water.position.set(0, wy, 0); B.G.add(water);
    const P = (r, a) => [mir * r * Math.sin(a), r * Math.cos(a)];
    // a stone rim holds the pond; you can stand on it
    const rimH = wy + 0.2 - lo + 0.4;
    const rim = B.add(new THREE.CylinderGeometry(5.75, 5.85, rimH, 40, 1, true), 0x9a948a, 0, (wy + 0.2 + lo - 0.4) / 2, 0, { side: THREE.DoubleSide });
    B.add(new THREE.TorusGeometry(5.68, 0.2, 5, 40), 0xb0a898, 0, wy + 0.2, 0).rotation.x = Math.PI / 2;
    void rim;
    plat(cx, cz, 6.2, (x, z) => { const d = Math.hypot(x - cx, z - cz); return d > 5.45 && d < 6 ? wy + 0.3 : null; });
    // steps up to the rim where the trail arrives: a gentle ramp underfoot, as long as the pond is high
    const top = wy + 0.3, z0 = 5.85, SL = Math.max(0.9, (top - B.rawL(0, z0 + 2)) / 0.6), ge = B.rawL(0, z0 + SL);
    if (top - ge > 0.12) {
      const n = Math.max(2, Math.round(SL / 0.45));
      for (let j = 0; j < n; j++) { const h = top - (j + 0.5) * (top - ge) / n; B.add(new THREE.BoxGeometry(1.5, h - ge + 0.3, SL / n), 0x9a948a, 0, (h + ge - 0.3) / 2, z0 + (j + 0.5) * SL / n); }
      plat(cx, cz, z0 + SL + 1, (x, z) => { const l = F.l(x, z); return Math.abs(l.x) < 0.75 && l.z >= z0 - 0.2 && l.z <= z0 + SL ? top - Math.max(0, l.z - z0) / SL * (top - ge) : null; });
    }
    const out = z0 + (top - ge > 0.12 ? SL : 0.6);
    for (let z = z0; z < out; z += 1.2) { const p = F.w(0, z); ctx.keep(p.x, p.z, 1.2); }
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + 0.2; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.4) continue; const [x, z] = P(6.3, a); const s = 0.3 + (i * 7 % 5) * 0.08; B.add(new THREE.DodecahedronGeometry(s, 0), 0x8a8a80, x, B.rawL(x, z) + s * 0.4, z); }
    for (let i = 0; i < 9; i++) { const a = 0.6 + i * 0.6, [x, z] = P(5.1, a); for (let k = 0; k < 3; k++) B.add(new THREE.ConeGeometry(0.05, 1.1, 4), 0x6a8a3a, x + k * 0.12, wy + 0.4, z + (k - 1) * 0.1); }
    for (const [r, a] of [[3, 3.6], [4.2, 2.6], [2.8, 4.6], [4.4, 5.3], [2.6, 2.4]]) { const [x, z] = P(r, a); const pad = B.add(new THREE.CircleGeometry(0.38, 10), 0x4a8a3a, x, wy + 0.02, z); pad.rotation.x = -Math.PI / 2; }
    // the island and the stones
    B.add(new THREE.CylinderGeometry(2.05, 2.2, wy + 0.3 - lo + 0.3, 16), 0xd8c48a, 0, (wy + 0.3 + lo - 0.3) / 2, 0);
    B.add(new THREE.CylinderGeometry(1.85, 1.95, 0.2, 16), 0x7aa850, 0, wy + 0.37, 0);
    B.add(new THREE.CylinderGeometry(0.12, 0.16, 1.3, 6), 0x6a4a2a, -0.9 * mir, wy + 1.1, -0.8);
    B.add(new THREE.IcosahedronGeometry(0.75, 0), 0x5a9a45, -0.9 * mir, wy + 2.0, -0.8);
    B.add(new THREE.SphereGeometry(0.13, 8, 6), 0xffe9a8, 1.1 * mir, wy + 1.1, -0.6, { emissive: 0xffc04a, emissiveIntensity: 1.3 });
    B.add(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 5), 0x3a3a3a, 1.1 * mir, wy + 0.6, -0.6);
    B.glowAt(0xffc870, 1.5, 1.1 * mir, wy + 1.1, -0.6);
    const path = [[4.5, 0.25], [4.1, 0.85], [3.5, 1.5]], tops = [];
    for (const [r, a] of path) {
      const [x, z] = P(r, a), m = B.add(new THREE.CylinderGeometry(0.62, 0.72, wy + 0.42 - lo + 0.3, 8), 0x9a948a, x, (wy + 0.42 + lo - 0.3) / 2, z);
      B.add(new THREE.CylinderGeometry(0.5, 0.58, 0.05, 8), 0x6a9a4a, x, wy + 0.44, z); // a mossy cap
      for (let k = 0; k < 2; k++) B.add(new THREE.SphereGeometry(0.1, 5, 3), 0x5a8a3a, x + (k - 0.5) * 0.5, wy + 0.44, z + 0.35);
      tops.push(m); const p = F.w(x, z);
      plat(p.x, p.z, 0.75, (px, pz) => (Math.hypot(px - p.x, pz - p.z) < 0.7 ? wy + 0.42 : null));
    }
    plat(cx, cz, 2, (x, z) => (Math.hypot(x - cx, z - cz) < 1.95 ? wy + 0.45 : null));
    const sg = new THREE.Group(); sg.position.set(1.6, B.rawL(1.6, out + 0.4), out + 0.4); B.G.add(sg);
    B.add(new THREE.CylinderGeometry(0.07, 0.07, 1.3, 6), 0x6a4a2a, 0, 0.65, 0, undefined, sg);
    const lbl = ctx.textSprite('Hop across! ⤒', { size: 26, scale: 0.009 }); lbl.position.y = 1.55; sg.add(lbl);
    let cool = 0;
    return {
      B, teacher: [0.3 * mir, -0.1], entry: [0, out + 0.9], y: wy, hops: [F.w(0, out - 0.3), F.w(0, 5.7)].concat(path.map(([r, a]) => F.w(...P(r, a))), [F.w(0, 0)]),
      update(dt, t, pos, onGround) {
        cool = Math.max(0, cool - dt);
        tops.forEach((m, i) => { m.position.y = (wy + 0.42 + lo - 0.3) / 2 + Math.sin(t * 1.3 + i) * 0.015; });
        const l = F.l(pos.x, pos.z);
        if (!cool && onGround && Math.hypot(l.x, l.z) < 5.3 && pos.y < wy - 0.02) {
          cool = 1;
          ctx.SPK.emit(V3(pos.x, wy + 0.1, pos.z), { color: 0xd8f0ff, n: 30, speed: 3, up: 1.4, gravity: -9, size: 0.3, life: 0.7 });
          const e = F.w(0, 5.75); ctx.splash(e.x, e.z, Math.atan2(cx - e.x, cz - e.z)); // back up on the rim, to try again
        }
      },
    };
  }

  // ── 🌷 a garden behind a word gate ─────────────────────────
  function garden(cx, cz, face, o) {
    const B = start(cx, cz, face), R = 4.6, N = 20, step = Math.PI * 2 / N, gapA = step;
    const P = (r, a) => [r * Math.sin(a), r * Math.cos(a)];
    for (let i = 0; i < N; i++) {
      const a = (i + 0.5) * step;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < gapA) continue;
      const [x, z] = P(R, a), y = B.rawL(x, z);
      const h = B.add(new THREE.BoxGeometry(2 * R * Math.sin(step / 2) + 0.15, 1.5, 0.9), 0x3f7a35, x, y + 0.65, z); h.rotation.y = a;
      if (i % 2) B.add(new THREE.SphereGeometry(0.12, 6, 5), [0xff8fab, 0xffe066, 0xffffff][i % 3], x, y + 1.45, z);
    }
    for (let a = gapA; a < Math.PI * 2 - gapA + 1e-6; a += 0.6 / R) { const [x, z] = P(R, a); B.col(x, z, 0.5); }
    const [px, pz] = P(R, gapA), gz = pz, gy = B.rawL(0, gz);
    const runes = [];
    for (const s of [-1, 1]) {
      B.add(new THREE.BoxGeometry(0.5, 1.9, 0.5), 0xb8b0a0, s * px, gy + 0.95, gz);
      const r = ctx.glow(0x9ad0ff, 1.1); r.position.set(s * px, gy + 2.15, gz); B.G.add(r); runes.push(r);
    }
    const leaves = [-1, 1].map(s => {
      const hg = new THREE.Group(); hg.position.set(s * px, gy, gz); B.G.add(hg);
      const len = px - 0.05;
      B.add(new THREE.BoxGeometry(len, 1.3, 0.12), 0x8a5a2a, -s * len / 2, 0.7, 0, undefined, hg);
      const bar = B.add(new THREE.BoxGeometry(len * 1.05, 0.12, 0.16), 0x5a3a20, -s * len / 2, 0.7, 0, undefined, hg); bar.rotation.z = s * 0.5;
      return { hg, s };
    });
    const gateCols = [-0.9, 0, 0.9].map(x => B.col(x, gz, 0.55));
    // inside: a tree with apples, flowers, a bench and a bird bath
    const ty = B.rawL(-2.2, -1.4);
    B.add(new THREE.CylinderGeometry(0.2, 0.28, 1.8, 6), 0x6a4a2a, -2.2, ty + 0.9, -1.4);
    B.add(new THREE.IcosahedronGeometry(1.2, 0), 0x4f8f3a, -2.2, ty + 2.4, -1.4);
    for (let i = 0; i < 6; i++) B.add(new THREE.SphereGeometry(0.12, 6, 5), 0xd0302a, -2.2 + Math.cos(i) * 0.95, ty + 2.2 + Math.sin(i * 2) * 0.4, -1.4 + Math.sin(i) * 0.95);
    B.col(-2.2, -1.4, 0.5);
    const by = B.rawL(2, -1.6);
    B.add(new THREE.BoxGeometry(1.5, 0.1, 0.45), 0x8a5a2a, 2, by + 0.45, -1.6); for (const x of [-0.6, 0.6]) B.add(new THREE.BoxGeometry(0.1, 0.45, 0.4), 0x5a3a20, 2 + x, by + 0.22, -1.6);
    const bb = B.rawL(1.6, 1.2);
    B.add(new THREE.CylinderGeometry(0.15, 0.25, 0.8, 8), 0xb8b0a0, 1.6, bb + 0.4, 1.2); B.add(new THREE.CylinderGeometry(0.55, 0.4, 0.15, 12), 0xb8b0a0, 1.6, bb + 0.85, 1.2);
    B.col(1.6, 1.2, 0.5);
    const fc = [0xff8fab, 0xffe066, 0xb197fc, 0xff6b6b, 0xffffff];
    for (let i = 0; i < 26; i++) { const a = i * 2.4, r = 2.6 + (i % 3) * 0.5, [x, z] = P(r, a); if (z > 2.5 && Math.abs(x) < 1.2) continue; B.add(new THREE.SphereGeometry(0.11, 6, 5), fc[i % 5], x, B.rawL(x, z) + 0.15, z); }
    const ent = new THREE.Group(), ep = B.F.w(0, gz + 0.9); ent.position.set(ep.x, gy, ep.z); ctx.add(ent);
    let open = false;
    const gate = {
      id: o.id, x: ep.x, z: ep.z, obj: ent,
      get open() { return open; },
      unlock(now) {
        if (open) return; open = true;
        for (const c of gateCols) c.r = 0;
        runes.forEach(r => { r.material.color.setHex(0xffd166); });
        const go = t => leaves.forEach(L => { L.hg.rotation.y = L.s * t * 1.7; }); // they swing out towards the road
        if (now) go(1); else { tween(0.8, k => go(1 - Math.pow(1 - k, 3))); const p = B.F.w(0, gz); ctx.SPK.emit(V3(p.x, gy + 1.2, p.z), { colors: [0xffd166, 0x9ad0ff, 0xffffff], n: 50, speed: 4, size: 0.4 }); }
      },
    };
    let petalT = 0;
    return { B, teacher: [0.4, -1.4], entry: [0, gz + 1.6], gate, update: (dt, t, pos) => {
      runes.forEach((r, i) => { r.scale.setScalar(1.1 + Math.sin(t * 3 + i) * 0.15); });
      // inside the hedge: blossom drifts down from the apple tree and fireflies of pollen hang in the air
      if (open && (petalT -= dt) <= 0 && Math.hypot(pos.x - cx, pos.z - cz) < R + 3) {
        petalT = 0.12; const a = Math.random() * 6.283, r = Math.random() * R * 0.9, p = B.F.w(Math.cos(a) * r, Math.sin(a) * r);
        ctx.SPK.emit(V3(p.x, gy + 2.5 + Math.random() * 1.5, p.z), Math.random() < 0.7 ? { colors: [0xffc8d8, 0xfff0f4], n: 1, speed: 0.3, up: -0.3, gravity: -0.4, drag: 0.8, size: 0.2, life: 4 } : { color: 0xfff0a0, n: 1, speed: 0.2, up: 0.1, gravity: 0, drag: 0.5, size: 0.16, life: 2.5 });
      }
    } };
  }

  // ── 🔭 a lookout up a stair ────────────────────────────────
  function lookout(cx, cz, face) {
    const B = start(cx, cz, face), z0 = -2.4, z1 = 1.4;
    const { lo, hi } = B.range(-1.9, 1.9, z0, z1, 0.95);
    const yP = hi + 2.6;
    let L = 4.8, gEnd = B.rawL(0, z1 + L);
    for (let k = 0; k < 2; k++) { L = Math.max(2.5, (yP - gEnd) / 0.55); gEnd = B.rawL(0, z1 + L); }
    for (const x of [-1.75, 1.75]) for (const z of [z0 + 0.15, z1 - 0.15]) B.add(new THREE.CylinderGeometry(0.15, 0.17, yP - lo + 0.3, 6), 0x6a4a2a, x, (yP + lo - 0.3) / 2, z);
    B.add(new THREE.BoxGeometry(3.8, 0.2, 3.8), 0x9a7048, 0, yP - 0.1, (z0 + z1) / 2);
    const rail = (x, z, len, alongX) => B.add(new THREE.BoxGeometry(alongX ? len : 0.1, 0.1, alongX ? 0.1 : len), 0x6a4a2a, x, yP + 0.9, z);
    rail(0, z0, 3.8, true); rail(-1.9, (z0 + z1) / 2, 3.8, false); rail(1.9, (z0 + z1) / 2, 3.8, false); rail(-1.3, z1, 1.2, true); rail(1.3, z1, 1.2, true);
    for (const [x, z] of [[-1.9, z0], [1.9, z0], [-1.9, z1], [1.9, z1], [-0.7, z1], [0.7, z1], [0, z0], [-1.9, -0.5], [1.9, -0.5]]) B.add(new THREE.BoxGeometry(0.1, 0.9, 0.1), 0x6a4a2a, x, yP + 0.45, z);
    const n = Math.ceil(L / 0.45);
    for (let j = 0; j < n; j++) { const top = yP - (j + 1) * (yP - gEnd) / (n + 0.4); B.add(new THREE.BoxGeometry(1.4, top - lo + 0.3, L / n), 0x8a6038, 0, (top + lo - 0.3) / 2, z1 + (j + 0.5) * L / n); }
    for (const x of [-1.9, -1.3, -0.7, 0.7, 1.3, 1.9]) B.col(x, z0, 0.25);
    for (let z = z0 + 0.6; z <= z1; z += 0.6) { B.col(-1.9, z, 0.25); B.col(1.9, z, 0.25); }
    for (const x of [-1.6, -1.0, 1.0, 1.6]) B.col(x, z1, 0.25);
    const F = B.F;
    plat(cx, cz, 3.2, (x, z) => { const l = F.l(x, z); return Math.abs(l.x) < 1.9 && l.z > z0 && l.z < z1 ? yP : null; });
    const mid = F.w(0, z1 + L / 2);
    plat(mid.x, mid.z, L / 2 + 1, (x, z) => { const l = F.l(x, z); return Math.abs(l.x) < 0.75 && l.z >= z1 && l.z <= z1 + L ? yP - (l.z - z1) / L * (yP - gEnd) : null; });
    ctx.keep(mid.x, mid.z, 1.6);
    // a telescope and a flag
    const tel = new THREE.Group(); tel.position.set(-1.1, yP, -1.7); B.G.add(tel);
    for (let i = 0; i < 3; i++) { const lg = B.add(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 4), 0x3a3a3a, Math.cos(i * 2.1) * 0.2, 0.5, Math.sin(i * 2.1) * 0.2, undefined, tel); lg.rotation.set(Math.sin(i * 2.1) * 0.35, 0, -Math.cos(i * 2.1) * 0.35); }
    const tube = B.add(new THREE.CylinderGeometry(0.08, 0.12, 1, 8), 0xc9a43a, 0, 1.1, 0, { metalness: 0.7, roughness: 0.3 }, tel); tube.rotation.x = 1.2;
    B.add(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 5), 0x6a4a2a, 1.6, yP + 1.2, -2.2);
    const flag = B.add(new THREE.BoxGeometry(0.9, 0.5, 0.03), 0xc9452b, 2.05, yP + 2.15, -2.2);
    return { B, teacher: [0.5, -0.9], entry: [0, z1 + L + 0.9], y: yP,
      // standing up on the deck: the host can pull the camera back for the view
      onDeck: p => { const l = B.F.l(p.x, p.z); return Math.abs(l.x) < 1.9 && l.z > z0 - 0.1 && l.z < z1 + 0.1 && p.y > yP - 0.5; },
      update: (dt, t) => { flag.rotation.y = Math.sin(t * 3) * 0.3; flag.scale.x = 1 + Math.sin(t * 5) * 0.05; } };
  }

  const BUILD = { campfire, stall, house, stones, garden, lookout };
  // a trail of flat stones from the road to the entrance, two lanterns and a signpost
  function trail(from, to, sign) {
    const g = new THREE.Group(); ctx.add(g);
    const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz), n = Math.max(1, Math.floor(d / 1.6));
    for (let i = 0; i <= n; i++) {
      const x = from.x + dx * i / n + Math.sin(i * 1.7) * 0.25, z = from.z + dz * i / n + Math.cos(i * 2.3) * 0.25;
      const m = ctx.mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.12, 7), 0xb8ad98); m.position.set(x, raw(x, z) + 0.03, z); m.rotation.y = i; g.add(m);
      ctx.keep(x, z, 1.3); // no trees on the trail
    }
    const px = -dz / d, pz = dx / d;
    for (const s of [-1, 1]) {
      const x = to.x + px * s * 1.2, z = to.z + pz * s * 1.2, y = raw(x, z);
      const p = ctx.mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.5, 6), 0x3a3a3a); p.position.set(x, y + 0.75, z); g.add(p);
      const l = ctx.mesh(new THREE.SphereGeometry(0.16, 8, 6), 0xffe9a8, { emissive: 0xffc04a, emissiveIntensity: 1.2 }); l.position.set(x, y + 1.6, z); g.add(l);
      const h = ctx.glow(0xffc870, 1.4); h.position.copy(l.position); g.add(h);
    }
    const sx = from.x - px * 1.3, sz = from.z - pz * 1.3, sy = raw(sx, sz);
    const post = ctx.mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.9, 6), 0x6a4a2a); post.position.set(sx, sy + 0.95, sz); g.add(post);
    const t = ctx.textSprite(sign, { size: 28, bg: 'rgba(120,80,40,.92)', color: '#fff2c8', scale: 0.009 }); t.position.set(sx, sy + 2.05, sz); g.add(t);
    return g;
  }

  // Tries each type in turn (and a few distances from the road); returns the venue or null.
  // o = { rx, rz (the road), nx, nz (unit vector away from the road), title, name, id }
  // The first type is wanted; the others are tried in turn if it doesn't fit, then the other side of the road.
  function place(types, o) {
    for (const sd of [1, -1]) for (const type of types) for (const k of [1, 1.2, 0.85]) {
      const nx = o.nx * sd, nz = o.nz * sd, off = OFF[type] * k, cx = o.rx + nx * off, cz = o.rz + nz * off, r = RADIUS[type];
      if (!ctx.free(cx, cz, r, SLOPE[type])) continue;
      const face = Math.atan2(-nx, -nz), v = BUILD[type](cx, cz, face, o);
      if (!v) continue;
      ctx.keep(cx, cz, r + 0.5);
      const F = v.B.F, tp = F.w(...v.teacher), en = F.w(...v.entry);
      const from = { x: o.rx + nx * 2.6, z: o.rz + nz * 2.6 };
      const tr = Math.hypot(en.x - from.x, en.z - from.z) > 1.5 ? trail(from, en, `${o.name}'s ${SHORT[type]}`) : null;
      const out = Object.assign(v, { type, x: cx, z: cz, face, tx: tp.x, tz: tp.z, tFace: face, entryX: en.x, entryZ: en.z, where: WHERE[type], hello: HELLO[type], groups: [v.B.G].concat(tr ? [tr] : []) });
      list.push(out);
      return out;
    }
    return null;
  }

  return {
    place, ground, list,
    inside: pos => list.some(v => v.inside && Math.abs(pos.x - v.x) < 6 && Math.abs(pos.z - v.z) < 6 && v.inside(pos)),
    // 1 by day, less at dusk and night: how bright the light through the windows is
    setDaylight: (k, color = 0xffffff) => { beamMat.opacity = k; beamMat.color.set(color); for (const m of windowMats) m.emissiveIntensity = k < 0.5 ? 2.2 : 0.7; },
    // true while you stand on top of a lookout
    view: pos => list.some(v => v.onDeck && Math.abs(pos.x - v.x) < 5 && Math.abs(pos.z - v.z) < 5 && v.onDeck(pos)),
    // the room you're standing in (a cottage), or null
    room: pos => list.find(v => v.room && Math.abs(pos.x - v.x) < 6 && Math.abs(pos.z - v.z) < 6 && v.inside(pos)) || null,
    update(dt, t, pos, onGround) {
      for (let i = anims.length - 1; i >= 0; i--) if (anims[i](dt) === false) anims.splice(i, 1);
      for (const v of list) {
        const d = Math.hypot(pos.x - v.x, pos.z - v.z), show = d < 130;
        if (v.groups[0].visible !== show) for (const g of v.groups) g.visible = show;
        if (d < 45 && v.update) v.update(dt, t, pos, onGround);
      }
    },
    clear() { list.length = 0; anims.length = 0; cells.clear(); },
  };
}
