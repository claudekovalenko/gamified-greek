// The 3D adventure: a third-person journey, one region per concept set of the chapter.
// Mentors give lessons as quests, scroll pedestals hold practice sentences, guardians
// block each gate until the unit's boss is beaten, and wandering Shades of
// Forgetting are fought by answering vocabulary questions (spaced review).
import * as THREE from './vendor/three.module.min.js';
import { createStage } from './stage.js';

const KG = window.KG, E = KG.engine, U = KG.util;
const W = KG.world = { ok: false, show() {}, hide() {}, onLessonDone() {} };
const esc = U.esc;

// ── world layout ──────────────────────────────────────────────
const L = 90;                         // length of one region
const NZ = KG.units.length;           // one region per concept set, then the quiz hall
const END_Z = -NZ * L - 34;
const pathX = z => Math.sin(z * 0.021) * 16 + Math.sin(z * 0.047 + 1) * 7;
const zoneOf = z => Math.max(0, Math.min(NZ - 1, Math.floor(-z / L)));
const gateZ = i => -(i + 1) * L + 4;

const LOOKS = [
  { name: 'Alphabet Hollow', grass: 0x6fae4f, leaf: [0x4f8f3a, 0x6aa84a], mentor: ['Ἀλφαῖος', 'Alphaeus', 'the village elder'], robe: 0x7a5230, guard: 'Stone Warden of the Hollow', greet: ['Χαῖρε, μαθητά!', 'Greetings, student!'] },
  { name: 'The Wordwood', grass: 0x3f7f3a, leaf: [0x2f6a2f, 0x3d7d34], mentor: ['Σοφία', 'Sophia', 'keeper of the Wordwood'], robe: 0x2f6a5a, guard: 'The Bramble Troll', greet: ['Εἰρήνη σοι.', 'Peace to you.'] },
  { name: 'Fields of the Article', grass: 0xb4a24a, leaf: [0x8f8a3a, 0xa89a40], mentor: ['Βαρναβᾶς', 'Barnabas', 'the field-steward'], robe: 0x8a6a2a, guard: 'The Golden Sentinel', greet: ['Χαῖρε!', 'Hello!'] },
  { name: 'Verb River', grass: 0x5fa060, leaf: [0x3f8a5a, 0x5a9a4a], mentor: ['Λυδία', 'Lydia', 'the river merchant'], robe: 0x7a2f6a, guard: 'The River Colossus', greet: ['Καλῶς ἦλθες.', 'Welcome.'] },
  { name: "Builders' Ridge", grass: 0x889a58, leaf: [0x5f7a3a, 0x7a8a4a], mentor: ['Ἀκύλας', 'Aquila', 'the tent-maker'], robe: 0x5a4a8a, guard: 'The Iron Gatekeeper', greet: ['Χαῖρε, φίλε.', 'Hello, friend.'] },
  { name: 'Ruins of Time', grass: 0xa08a5a, leaf: [0x7a6a3a, 0x8a7a4a], mentor: ['Τιμόθεος', 'Timothy', 'the young chronicler'], robe: 0xa0522d, guard: 'The Hourglass Titan', greet: ['Ἡ χάρις μετὰ σοῦ.', 'Grace be with you.'] },
  { name: 'Mirror Lake', grass: 0x5f9f7f, leaf: [0x2f7a6a, 0x4a8a6a], mentor: ['Πρίσκιλλα', 'Priscilla', 'the lake-dweller'], robe: 0x2e7d7d, guard: 'The Mirror Knight', greet: ['Εἰρήνη ὑμῖν.', 'Peace to you all.'] },
  { name: 'Declension Peaks', grass: 0x93a39b, leaf: [0x4a6a5a, 0x5a7a6a], mentor: ['Σίλας', 'Silas', 'the mountain guide'], robe: 0x6a5a2e, guard: 'The Frost Giant', greet: ['Χαίρετε!', 'Rejoice!'] },
  { name: 'The Great Library', grass: 0x7fae5f, leaf: [0x5a8a3a, 0x7a9a4a], mentor: ['Λουκᾶς', 'Luke', 'the librarian'], robe: 0x9a3f3f, guard: 'The Guardian of the Library', greet: ['Κράτιστε Θεόφιλε!', 'Most excellent Theophilus!'] },
];

// each region takes its look from the original nine worlds, and its name from the content
const LOOK = i => (KG.units[i].final ? 8 : i % 8);
const ZONES = KG.units.map((u, i) => Object.assign({}, LOOKS[LOOK(i)], { name: u.place, guard: u.guard }));

// ── deterministic noise & terrain height ─────────────────────
function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, z) => vnoise(x * 0.05, z * 0.05) + vnoise(x * 0.13, z * 0.13) * 0.4 + vnoise(x * 0.31, z * 0.31) * 0.15;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const RIVER_Z = -3 * L - 45;                   // Verb River crosses region 4
const LAKE = { x: 0, z: -6 * L - 45, r: 16 };  // Mirror Lake beside region 7's road
LAKE.x = pathX(LAKE.z) + 27;
function height(x, z) {
  const d = Math.abs(x - pathX(z));
  let h = (fbm(x, z) - 0.75) * 2;
  const wall = smooth(11, 44, d);
  h += wall * wall * 30 + wall * fbm(x * 2, z * 2) * 7;
  if (zoneOf(z) === 7) h += wall * 10;                 // taller peaks
  if (z > 6) h += (z - 6) * (z - 6) * 0.3;
  if (z < END_Z) h += (END_Z - z) * (END_Z - z) * 0.3;
  h -= 2.2 * Math.max(0, 1 - Math.abs(z - RIVER_Z) / 6);
  const lr = Math.hypot(x - LAKE.x, z - LAKE.z);
  h -= 4 * smooth(LAKE.r, LAKE.r * 0.4, lr);
  return h;
}
const BRIDGE = { z: RIVER_Z, half: 7, w: 2.6 };
function groundAt(x, z) {
  const h = height(x, z);
  if (Math.abs(z - BRIDGE.z) < BRIDGE.half && Math.abs(x - pathX(z)) < BRIDGE.w) return Math.max(h, bridgeTop);
  return h;
}
let bridgeTop = 0;

// ── state ─────────────────────────────────────────────────────
function ws() {
  const S = E.state;
  if (!S.world) S.world = { x: pathX(-6), z: -6, letters: [], coins: { day: '', got: [] }, intro: false, wisps: 0 };
  const w = S.world;
  if (w.coins.day !== U.day()) w.coins = { day: U.day(), got: [] };
  return w;
}
const gateOpen = i => E.state.settings.unlockAll || E.stars(KG.units[i].nodes[KG.units[i].nodes.length - 1].id) > 0;

// ── renderer, scene, camera ──────────────────────────────────
let renderer, scene, camera, sun, clock;
const root = document.getElementById('world');
root.insertAdjacentHTML('beforeend', '<div class="wvig"></div>');
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  document.dispatchEvent(new Event('world-failed'));
  throw e;
}
const mobile = matchMedia('(pointer: coarse)').matches;
// "Low" graphics (Profile → Settings) trades grass, shadows and effects for smoothness on older phones
const LOW = (E.state.settings || {}).gfx === 'low';
renderer.setPixelRatio(Math.min(devicePixelRatio, LOW ? 1 : mobile ? 1.5 : 2));
renderer.shadowMap.enabled = !LOW;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
root.prepend(renderer.domElement);
renderer.domElement.className = 'world-canvas';

scene = new THREE.Scene();
const SKY = 0xa9d4f0;
scene.fog = new THREE.Fog(SKY, 60, 230);
camera = new THREE.PerspectiveCamera(60, 1, 0.1, 600);
clock = new THREE.Clock();

// sky dome with a vertical gradient
{
  const g = new THREE.SphereGeometry(500, 24, 12);
  const top = new THREE.Color(0x4a88c8), mid = new THREE.Color(SKY), bot = new THREE.Color(0xe8e0c8);
  const cols = [];
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 500;
    const c = y > 0 ? mid.clone().lerp(top, Math.min(1, y * 1.6)) : mid.clone().lerp(bot, Math.min(1, -y * 4));
    cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.name = 'sky';
  scene.add(sky);
}
const hemi = new THREE.HemisphereLight(0xdff0ff, 0x5a6a3a, 1.1);
scene.add(hemi);
// Each world has its own sky, fog and light; they blend as you travel.
const ATMOS = [
  { top: 0x4a88c8, mid: 0xa9d4f0, bot: 0xe8e0c8, sun: 0xfff1d6, sunI: 2.2, hemi: 1.1, fog: [60, 230] },   // Alphabet Hollow: bright morning
  { top: 0x3a6a5a, mid: 0x9cc8b0, bot: 0xd8e8d0, sun: 0xe8ffd8, sunI: 1.6, hemi: 1.0, fog: [30, 150] },   // Wordwood: green mist
  { top: 0x5a7ab8, mid: 0xf0d8a0, bot: 0xf8e8c0, sun: 0xffd890, sunI: 2.4, hemi: 1.1, fog: [60, 230] },   // Fields: golden hour
  { top: 0x2a78d8, mid: 0x9ad0f8, bot: 0xe0f0f8, sun: 0xffffff, sunI: 2.4, hemi: 1.2, fog: [70, 250] },   // Verb River: clear blue
  { top: 0x6a7888, mid: 0xc0c8d0, bot: 0xe0e0e0, sun: 0xf0f0f0, sunI: 1.5, hemi: 1.2, fog: [40, 180] },   // Builders' Ridge: overcast
  { top: 0x3a2a6a, mid: 0xf0a070, bot: 0xf8d0a0, sun: 0xffa060, sunI: 2.0, hemi: 0.9, fog: [50, 200] },   // Ruins of Time: dusk
  { top: 0x1a2a5a, mid: 0x6a80b8, bot: 0xb0c0e0, sun: 0xc0d0ff, sunI: 1.3, hemi: 0.85, fog: [40, 190] },  // Mirror Lake: twilight
  { top: 0x8aa0c0, mid: 0xe0e8f0, bot: 0xffffff, sun: 0xffffff, sunI: 2.0, hemi: 1.3, fog: [30, 160] },   // Peaks: cold white
  { top: 0x4a3a8a, mid: 0xf8c070, bot: 0xfff0c8, sun: 0xffc860, sunI: 2.3, hemi: 1.1, fog: [60, 230] },   // Great Library: golden sunset
];
const atm = { top: new THREE.Color(ATMOS[0].top), mid: new THREE.Color(ATMOS[0].mid), bot: new THREE.Color(ATMOS[0].bot), sun: new THREE.Color(ATMOS[0].sun), sunI: 2.2, hemi: 1.1, near: 60, far: 230 };
function paintSky() {
  const sk = scene.getObjectByName('sky'), g = sk.geometry, p = g.attributes.position, col = g.attributes.color, c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 500;
    if (y > 0) c.copy(atm.mid).lerp(atm.top, Math.min(1, y * 1.6)); else c.copy(atm.mid).lerp(atm.bot, Math.min(1, -y * 4));
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
  scene.fog.color.copy(atm.mid); scene.fog.near = atm.near; scene.fog.far = atm.far;
  sun.color.copy(atm.sun); sun.intensity = atm.sunI; hemi.intensity = atm.hemi;
}
function blendAtmosphere(zi, k) {
  const A = ATMOS[LOOK(zi)], T = new THREE.Color();
  atm.top.lerp(T.setHex(A.top), k); atm.mid.lerp(T.setHex(A.mid), k); atm.bot.lerp(T.setHex(A.bot), k); atm.sun.lerp(T.setHex(A.sun), k);
  atm.sunI += (A.sunI - atm.sunI) * k; atm.hemi += (A.hemi - atm.hemi) * k; atm.near += (A.fog[0] - atm.near) * k; atm.far += (A.fog[1] - atm.far) * k;
  paintSky();
}
sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 160 });
sun.shadow.bias = -0.0008;
scene.add(sun, sun.target);

// ── materials & helpers ──────────────────────────────────────
const mats = {};
const mat = (color, opts = {}) => {
  const k = color + JSON.stringify(opts);
  return mats[k] || (mats[k] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, flatShading: true }, opts)));
};
function mesh(geo, color, opts) { const m = new THREE.Mesh(geo, color instanceof THREE.Material ? color : mat(color, opts)); m.castShadow = true; m.receiveShadow = true; return m; }
function put(obj, x, z, yOff = 0) { obj.position.set(x, groundAt(x, z) + yOff, z); scene.add(obj); return obj; }

const GREEK_FONT = '"Gentium Plus", "Noto Serif", Georgia, serif';
function textSprite(text, { size = 40, color = '#fff', bg = 'rgba(24,32,48,.78)', font = '800 ' + size + 'px Nunito, sans-serif', scale = 0.011 } = {}) {
  const c = document.createElement('canvas'), x = c.getContext('2d');
  x.font = font;
  const w = Math.ceil(x.measureText(text).width) + size, h = Math.ceil(size * 1.6);
  c.width = w; c.height = h;
  x.font = font;
  if (bg) { x.fillStyle = bg; x.beginPath(); x.roundRect(0, 0, w, h, h / 2.4); x.fill(); }
  x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, fog: false }));
  s.scale.set(w * scale, h * scale, 1);
  s.renderOrder = 10;
  return s;
}
// a glowing word to pick up: the font shrinks until the word fits
function wordSprite(word) {
  const c = document.createElement('canvas'); c.width = 320; c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(160, 64, 6, 160, 64, 150);
  g.addColorStop(0, 'rgba(255,230,150,.85)'); g.addColorStop(0.5, 'rgba(255,200,80,.3)'); g.addColorStop(1, 'rgba(255,200,80,0)');
  x.fillStyle = g; x.fillRect(0, 0, 320, 128);
  let size = 64;
  do { x.font = `700 ${size}px ${GREEK_FONT}`; size -= 4; } while (x.measureText(word).width > 290 && size > 22);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 6; x.strokeStyle = '#6a4a10'; x.strokeText(word, 160, 68);
  x.fillStyle = '#ffd166'; x.fillText(word, 160, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false }));
  sp.scale.set(2.8, 1.12, 1);
  return sp;
}
function glyphSprite(ch, color = '#ffd166') {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,230,150,.9)'); g.addColorStop(0.45, 'rgba(255,200,80,.35)'); g.addColorStop(1, 'rgba(255,200,80,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  x.font = `700 76px ${GREEK_FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 6; x.strokeStyle = '#6a4a10'; x.strokeText(ch, 64, 70);
  x.fillStyle = color; x.fillText(ch, 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false }));
  s.scale.set(1.6, 1.6, 1);
  return s;
}

// ── terrain ───────────────────────────────────────────────────
function buildTerrain() {
  const WID = 170, LEN = -END_Z + 60, SX = mobile ? 90 : 130, SZ = mobile ? 300 : 460;
  const g = new THREE.PlaneGeometry(WID, LEN, SX, SZ);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, cols = [];
  const dirt = new THREE.Color(0xb8925a), rock = new THREE.Color(0x8a8378), snow = new THREE.Color(0xf2f4f6), sand = new THREE.Color(0xd8c48a);
  const zc = ZONES.map(z => new THREE.Color(z.grass));
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i) + (END_Z + 30) / 2 + 10;
    const h = height(x, z);
    p.setX(i, x); p.setZ(i, z); p.setY(i, h);
    const zf = Math.min(NZ - 1, Math.max(0, -z / L - 0.5));
    const zi = Math.floor(zf);
    c.copy(zc[zi]).lerp(zc[Math.min(NZ - 1, zi + 1)], smooth(0.75, 1, zf - zi));
    c.offsetHSL(0, 0, (fbm(x * 3, z * 3) - 0.8) * 0.08);
    const d = Math.abs(x - pathX(z));
    const pathAmt = 1 - smooth(1.6, 3.2 + vnoise(x, z) * 0.8, d);
    c.lerp(dirt, pathAmt * 0.85);
    const wall = smooth(18, 40, d);
    c.lerp(rock, wall * 0.75);
    if (h > 18) c.lerp(snow, smooth(18, 28, h) * (zoneOf(z) === 7 ? 1 : 0.6));
    if (h < -1.2) c.lerp(sand, 0.6);
    cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  const t = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: false }));
  t.receiveShadow = true;
  scene.add(t);

  // water: river and lake
  const water = new THREE.MeshStandardMaterial({ color: 0x3f8fc0, transparent: true, opacity: 0.82, roughness: 0.2, metalness: 0.1 });
  water.roughness = 0.12; water.metalness = 0.25; water.color.setHex(0x3a9ad0);
  const river = new THREE.Mesh(new THREE.PlaneGeometry(120, 9, 60, 6), water);
  river.rotation.x = -Math.PI / 2; river.position.set(pathX(RIVER_Z), height(pathX(RIVER_Z), RIVER_Z) + 0.9, RIVER_Z);
  scene.add(river);
  W.water = [river];
  const lake = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r * 1.05, 48, 0, Math.PI * 2), water);
  lake.rotation.x = -Math.PI / 2; lake.position.set(LAKE.x, height(LAKE.x, LAKE.z) + 2.6, LAKE.z);
  scene.add(lake); W.water.push(lake);

  // bridge over the river
  const bx = pathX(RIVER_Z);
  bridgeTop = height(bx, RIVER_Z - BRIDGE.half) + 0.35;
  const deck = mesh(new THREE.BoxGeometry(BRIDGE.w * 2, 0.4, BRIDGE.half * 2 + 1), 0x8a5a2a);
  deck.position.set(bx, bridgeTop - 0.2, RIVER_Z); scene.add(deck);
  for (const s of [-1, 1]) for (let k = -3; k <= 3; k++) {
    const post = mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 6), 0x6a4020);
    post.position.set(bx + s * BRIDGE.w, bridgeTop + 0.5, RIVER_Z + k * 2.2); scene.add(post);
  }
  for (const s of [-1, 1]) {
    const rail = mesh(new THREE.BoxGeometry(0.15, 0.15, BRIDGE.half * 2), 0x6a4020);
    rail.position.set(bx + s * BRIDGE.w, bridgeTop + 1.05, RIVER_Z); scene.add(rail);
  }
}

// ── scenery ───────────────────────────────────────────────────
const colliders = []; // {x, z, r}
function scatterTrees() {
  const trunkG = new THREE.CylinderGeometry(0.18, 0.28, 1.6, 6);
  const leafG = new THREE.IcosahedronGeometry(1.3, 0);
  const pineG = new THREE.ConeGeometry(1.2, 3.2, 7);
  const N = LOW ? 400 : mobile ? 650 : 1100;
  const trunks = new THREE.InstancedMesh(trunkG, mat(0x6a4a2a), N);
  // two clumps of leaves per broadleaf tree
  const leaves = new THREE.InstancedMesh(leafG, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), N * 2);
  const pines = new THREE.InstancedMesh(pineG, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), col = new THREE.Color();
  let nl = 0, np = 0, nt = 0;
  for (let i = 0; i < N * 3 && nt < N; i++) {
    const z = 4 - Math.random() * (-END_Z + 4), zi = zoneOf(z);
    const side = Math.random() < 0.5 ? -1 : 1;
    const density = zi === 1 ? 0.9 : zi === 2 ? 0.25 : 0.6;
    const d = 6.5 + Math.pow(Math.random(), 1.3) * 34;
    if (Math.random() > density && d < 18) continue;
    const x = pathX(z) + side * d, y = height(x, z);
    if (y < -0.8) continue;
    if (Math.abs(z - RIVER_Z) < 6) continue;
    const s = 0.7 + Math.random() * 0.9;
    const pine = zi >= 6 || (zi === 1 && Math.random() < 0.4) || y > 10;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28);
    m.compose(pos.set(x, y + 0.8 * s, z), q, sc.set(s, s, s)); trunks.setMatrixAt(nt++, m);
    const leafCol = col.setHex(U.pick(ZONES[zi].leaf)).offsetHSL(0, 0, (Math.random() - 0.5) * 0.08);
    if (pine) { m.compose(pos.set(x, y + 2.6 * s, z), q, sc.set(s, s * 1.1, s)); pines.setMatrixAt(np, m); pines.setColorAt(np++, leafCol); }
    else {
      m.compose(pos.set(x, y + 2.3 * s, z), q, sc.set(s * 1.1, s, s * 1.1)); leaves.setMatrixAt(nl, m); leaves.setColorAt(nl++, leafCol);
      if (nl < N * 2) { m.compose(pos.set(x + 0.5 * s, y + 3.1 * s, z - 0.3 * s), q, sc.set(s * 0.75, s * 0.7, s * 0.75)); leaves.setMatrixAt(nl, m); leaves.setColorAt(nl++, leafCol.clone().offsetHSL(0, 0, 0.05)); }
    }
  }
  trunks.count = nt; leaves.count = nl; pines.count = np;
  for (const im of [trunks, leaves, pines]) { im.castShadow = true; im.receiveShadow = true; scene.add(im); }

  // rocks & flowers
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.7, 0), mat(0x8f8a80), 260);
  for (let i = 0; i < 260; i++) {
    const z = -Math.random() * -END_Z, side = Math.random() < 0.5 ? -1 : 1, x = pathX(z) + side * (4 + Math.random() * 30);
    const s = 0.4 + Math.random() * 1.4;
    q.setFromEuler(new THREE.Euler(Math.random(), Math.random(), Math.random()));
    m.compose(pos.set(x, height(x, z) + 0.2 * s, z), q, sc.set(s, s * 0.7, s)); rocks.setMatrixAt(i, m);
  }
  rocks.castShadow = rocks.receiveShadow = true; scene.add(rocks);
  const fl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.12, 0), new THREE.MeshStandardMaterial({ roughness: 1 }), 700);
  const fcols = [0xffe066, 0xff8fab, 0xffffff, 0xb197fc, 0xff6b6b];
  for (let i = 0; i < 700; i++) {
    const z = -Math.random() * (L * 3), x = pathX(z) + (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 14);
    m.compose(pos.set(x, height(x, z) + 0.18, z), q.identity(), sc.set(1, 1, 1)); fl.setMatrixAt(i, m); fl.setColorAt(i, col.setHex(U.pick(fcols)));
  }
  scene.add(fl);
}

// a round-doored hill house, Hobbit style
function hillHouse(x, z, door = 0x2f6a3a, face = 0) {
  const g = new THREE.Group();
  const hill = mesh(new THREE.SphereGeometry(4.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0x5f9a45);
  hill.scale.set(1, 0.7, 1); g.add(hill);
  const frame = mesh(new THREE.TorusGeometry(1.15, 0.18, 6, 20), 0x7a5a3a);
  frame.position.set(0, 1.1, 3.75); g.add(frame);
  const d = mesh(new THREE.CircleGeometry(1.05, 20), door); d.position.set(0, 1.1, 3.8); g.add(d);
  const knob = mesh(new THREE.SphereGeometry(0.1, 6, 6), 0xffd166, { metalness: 0.8, roughness: 0.3 }); knob.position.set(0, 1.1, 3.88); g.add(knob);
  for (const s of [-1, 1]) {
    const w = mesh(new THREE.CircleGeometry(0.5, 14), 0xffe9a8, { emissive: 0x6a5020 }); w.position.set(s * 2.2, 1.3, 3.25); w.rotation.y = s * 0.45; g.add(w);
  }
  const chim = mesh(new THREE.CylinderGeometry(0.3, 0.35, 1.4, 6), 0x8a7a6a); chim.position.set(1.4, 3, -0.8); g.add(chim);
  g.rotation.y = face;
  put(g, x, z, -0.3);
  colliders.push({ x, z, r: 4.2 });
  return g;
}
function temple(x, z, s = 1, face = 0, ruined = false) {
  const g = new THREE.Group(), stone = 0xe8dfcc;
  const base = mesh(new THREE.BoxGeometry(9, 0.8, 6.5), stone); base.position.y = 0.4; g.add(base);
  const step = mesh(new THREE.BoxGeometry(10, 0.4, 7.5), 0xd8cfbc); step.position.y = 0.2; g.add(step);
  let k = 0;
  for (let i = 0; i < 4; i++) for (const zz of [-2.6, 2.6]) {
    if (ruined && (k++ % 3 === 1)) continue;
    const h = ruined && Math.random() < 0.4 ? 2 + Math.random() * 2 : 4.4;
    const col = mesh(new THREE.CylinderGeometry(0.38, 0.45, h, 10), stone); col.position.set(-3.6 + i * 2.4, 0.8 + h / 2, zz); g.add(col);
  }
  if (!ruined) {
    const roof = mesh(new THREE.BoxGeometry(9.6, 0.6, 7), stone); roof.position.y = 5.5; g.add(roof);
    const ped = mesh(new THREE.CylinderGeometry(4.2, 4.2, 9.6, 3, 1), 0xc9452b); ped.rotation.z = Math.PI / 2; ped.scale.set(1, 1, 0.26); ped.position.y = 6.4; g.add(ped);
  } else {
    for (let i = 0; i < 4; i++) { const b = mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.4, 8), stone); b.rotation.z = Math.PI / 2; b.position.set(-4 + Math.random() * 8, 1.1, -4 + Math.random() * 8); g.add(b); }
  }
  g.scale.setScalar(s); g.rotation.y = face;
  put(g, x, z, -0.2);
  colliders.push({ x, z, r: 4.8 * s });
  return g;
}
function lampPost(x, z) {
  const g = new THREE.Group();
  const p = mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.4, 6), 0x3a3a3a); p.position.y = 1.2; g.add(p);
  const l = mesh(new THREE.SphereGeometry(0.22, 8, 8), 0xffe9a8, { emissive: 0xffc04a, emissiveIntensity: 1.2 }); l.position.y = 2.5; g.add(l);
  put(g, x, z);
}
function signPost(x, z, text) {
  const g = new THREE.Group();
  const p = mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.2, 6), 0x6a4a2a); p.position.y = 1.1; g.add(p);
  const b = mesh(new THREE.BoxGeometry(2.2, 0.6, 0.12), 0x8a6a3a); b.position.y = 2; g.add(b);
  const t = textSprite(text, { size: 30, bg: null, color: '#ffe9a8', scale: 0.008 }); t.position.y = 2.75; g.add(t);
  put(g, x, z);
}
// wind-blown grass along the road, drawn in one call with a swaying shader
const windUniform = { value: 0 };
function grass() {
  if (LOW) return;
  const N = mobile ? 9000 : 18000;
  const blade = new THREE.BufferGeometry();
  blade.setAttribute('position', new THREE.Float32BufferAttribute([-0.05, 0, 0, 0.05, 0, 0, 0, 0.42, 0], 3));
  blade.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  blade.setAttribute('color', new THREE.Float32BufferAttribute([0.62, 0.62, 0.62, 0.62, 0.62, 0.62, 1.1, 1.1, 1.0], 3));
  const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, vertexColors: true });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = windUniform;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float sway = sin(uTime * 1.8 + instanceMatrix[3].x * 0.35 + instanceMatrix[3].z * 0.25) * 0.18 * position.y;
      transformed.x += sway; transformed.z += sway * 0.6;`);
  };
  const im = new THREE.InstancedMesh(blade, mat, N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  let n = 0;
  for (let i = 0; i < N * 2 && n < N; i++) {
    const z = 2 - Math.random() * (-END_Z), side = Math.random() < 0.5 ? -1 : 1, d = 2.4 + Math.pow(Math.random(), 1.8) * 14;
    const x = pathX(z) + side * d, y = height(x, z);
    if (y < -0.9 || Math.abs(z - RIVER_Z) < 5) continue;
    const s = 0.6 + Math.random() * 0.9;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28);
    m.compose(p.set(x, y - 0.02, z), q, sc.set(s, s * (0.7 + Math.random() * 0.8), s));
    im.setMatrixAt(n, m);
    im.setColorAt(n++, c.setHex(ZONES[zoneOf(z)].grass).offsetHSL(0, 0.05, (Math.random() - 0.3) * 0.12));
  }
  im.count = n;
  im.receiveShadow = true;
  scene.add(im);
}
// clouds and a glowing sun
const clouds = [];
function skyDecor() {
  const cm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, transparent: true, opacity: 0.92 });
  for (let i = 0; i < 26; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(3 + Math.random() * 3, 1), cm); b.position.set(k * 4 - 8, Math.random() * 2, Math.random() * 3); b.scale.y = 0.6; c.add(b); }
    c.position.set((Math.random() - 0.5) * 160, 48 + Math.random() * 18, 20 - Math.random() * (-END_Z + 60));
    scene.add(c); clouds.push(c);
  }
  const sc = document.createElement('canvas'); sc.width = sc.height = 128; const x = sc.getContext('2d');
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(255,250,230,1)'); g.addColorStop(0.25, 'rgba(255,230,160,.8)'); g.addColorStop(1, 'rgba(255,200,120,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  W.sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(sc), fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  W.sunSprite.scale.set(70, 70, 1); scene.add(W.sunSprite);
}
// per-world ambience: pollen, leaves, embers, fireflies, snow…
const AMB = [
  { color: 0xfff0a0, size: 0.12, vy: 0.15, drift: 0.4, n: 160 },   // Hollow: pollen
  { color: 0x8ac04a, size: 0.22, vy: -0.6, drift: 1.0, n: 220 },   // Wordwood: falling leaves
  { color: 0xffe08a, size: 0.12, vy: 0.1, drift: 0.6, n: 180 },    // Fields: pollen
  { color: 0xd0f0ff, size: 0.1, vy: 0.05, drift: 0.3, n: 120 },    // River: mist sparkles
  { color: 0xd8d0c0, size: 0.1, vy: -0.05, drift: 0.8, n: 160 },   // Ridge: dust
  { color: 0xff9040, size: 0.14, vy: 0.7, drift: 0.4, n: 200 },    // Ruins: embers
  { color: 0xd8ff70, size: 0.16, vy: 0.05, drift: 0.5, n: 160, blink: true }, // Lake: fireflies
  { color: 0xffffff, size: 0.18, vy: -1.2, drift: 0.5, n: 420 },   // Peaks: snow
  { color: 0xffd166, size: 0.13, vy: 0.25, drift: 0.3, n: 200 },   // Library: golden motes
];
let amb = null, dotTex = null;
function dotTexture() {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d');
  const g = x.createRadialGradient(16, 16, 1, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  return (dotTex = new THREE.CanvasTexture(c));
}
function setAmbience(zi) {
  if (amb) scene.remove(amb.pts);
  const A = AMB[LOOK(zi)], n = LOW ? Math.round(A.n * 0.3) : mobile ? Math.round(A.n * 0.6) : A.n, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([(Math.random() - 0.5) * 50, Math.random() * 16, (Math.random() - 0.5) * 50], i * 3);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: A.color, size: A.size * 2.2, map: dotTexture(), alphaTest: 0.05, transparent: true, opacity: 0.85, depthWrite: false, blending: A.blink ? THREE.AdditiveBlending : THREE.NormalBlending }));
  pts.frustumCulled = false;
  scene.add(pts); amb = { pts, A, zi, base: new THREE.Vector3() };
}
function updateAmbience(dt, t, pos) {
  windUniform.value = t;
  for (const c of clouds) { c.position.x += dt * 1.5; if (c.position.x > 90) c.position.x = -90; }
  if (W.sunSprite) W.sunSprite.position.set(camera.position.x + 120, camera.position.y + 140, camera.position.z - 220);
  const zi = zoneOf(pos.z);
  if (!amb || amb.zi !== zi) setAmbience(zi);
  const A = amb.A, p = amb.pts.geometry.attributes.position;
  amb.pts.position.set(pos.x, groundAt(pos.x, pos.z), pos.z);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) + Math.sin(t * 0.7 + i) * A.drift * dt, y = p.getY(i) + A.vy * dt, z = p.getZ(i) + Math.cos(t * 0.6 + i * 1.3) * A.drift * dt;
    if (y > 16) y = 0; if (y < 0) y = 16;
    p.setXYZ(i, x, y, z);
  }
  p.needsUpdate = true;
  if (A.blink) amb.pts.material.opacity = 0.55 + Math.sin(t * 3) * 0.35;
}
function scenery() {
  // Region 1: the village of round doors
  const homes = [[-14, 12, 0x2f6a3a], [16, 20, 0xc9452b], [-17, 34, 0x2f5f8f], [15, 46, 0xe0a526], [-15, 58, 0x8f3f5f]];
  for (const [dx, dz, col] of homes) { const z = -dz, x = pathX(z) + dx; hillHouse(x, z, col, Math.atan2(pathX(z) - x, 0) > 0 ? Math.PI / 2 : -Math.PI / 2); }
  for (let z = -6; z > -L + 10; z -= 16) lampPost(pathX(z) + 3, z);
  // temples and ruins along the road
  const T = [[2, 30, 14, false], [4, 20, -15, true], [4, 60, 15, false], [5, 18, 14, true], [5, 40, -15, true], [5, 64, 14, true], [7, 30, -15, false], [8, 26, 15, false], [8, 52, -15, false]];
  for (const [zi, off, dx, ruined] of T.filter(t => t[0] < NZ)) { const z = -zi * L - off; const x = pathX(z) + dx; temple(x, z, 0.9, dx > 0 ? -Math.PI / 2 : Math.PI / 2, ruined); }
  // the Great Library at the end of the road
  const lz = -NZ * L - 14, lx = pathX(lz);
  const lib = temple(lx, lz, 2.1, 0, false);
  const dome = mesh(new THREE.SphereGeometry(3.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0xe0a526, { metalness: 0.6, roughness: 0.35 });
  dome.position.y = 7.4; lib.add(dome);
  W.libraryPos = new THREE.Vector3(lx, groundAt(lx, lz), lz + 9);
  // region signposts
  for (let i = 0; i < NZ; i++) { const z = -i * L - 6, x = pathX(z) - 3.2; signPost(x, z, ZONES[i].name); }
}

// ── characters ────────────────────────────────────────────────
// Storybook characters: soft cel shading, ink outlines and simple faces.
const toonRamp = (() => { const t = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]), 3, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toonCache = {};
function tmat(color, opts = {}) {
  const k = color + JSON.stringify(opts);
  return toonCache[k] || (toonCache[k] = new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: toonRamp }, opts)));
}
const inkMat = new THREE.MeshBasicMaterial({ color: 0x2a1a0e, side: THREE.BackSide });
function tmesh(geo, color, opts, ink = 1.06) {
  const m = new THREE.Mesh(geo, tmat(color, opts)); m.castShadow = true; m.receiveShadow = true;
  if (ink && !LOW) { const o = new THREE.Mesh(geo, inkMat); o.scale.setScalar(ink); m.add(o); }
  return m;
}
function person({ skin = 0xf0c8a0, robe = 0x3f7d3a, hair = 0x6a3e1e, hood = false, beard = false, staff = false, scale = 1 } = {}) {
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  const robeDark = new THREE.Color(robe).multiplyScalar(0.7).getHex();
  const torso = tmesh(new THREE.CylinderGeometry(0.32, 0.56, 1.05, 18), robe); torso.position.y = 1.05; body.add(torso);
  const hem = tmesh(new THREE.TorusGeometry(0.54, 0.05, 6, 20), robeDark, {}, 0); hem.rotation.x = Math.PI / 2; hem.position.y = 0.54; body.add(hem);
  const collar = tmesh(new THREE.TorusGeometry(0.27, 0.07, 6, 18), robeDark, {}, 0); collar.rotation.x = Math.PI / 2; collar.position.y = 1.56; body.add(collar);
  const belt = tmesh(new THREE.CylinderGeometry(0.42, 0.44, 0.1, 16), 0x5a3a1a, {}, 0); belt.position.y = 0.98; body.add(belt);
  const buckle = tmesh(new THREE.BoxGeometry(0.14, 0.12, 0.04), 0xe0b030, {}, 0); buckle.position.set(0, 0.98, 0.43); body.add(buckle);
  // head and face
  const head = tmesh(new THREE.SphereGeometry(0.32, 20, 16), skin); head.position.y = 1.86; body.add(head);
  const hairM = tmesh(new THREE.SphereGeometry(0.345, 18, 10, 0, Math.PI * 2, 0, Math.PI / 1.9), hair); hairM.position.y = 1.9; hairM.rotation.x = -0.28; body.add(hairM);
  for (const sd of [-1, 1]) {
    const tuft = tmesh(new THREE.SphereGeometry(0.11, 8, 6), hair, {}, 0); tuft.position.set(sd * 0.29, 1.82, -0.04); body.add(tuft);
    const eye = tmesh(new THREE.SphereGeometry(0.062, 10, 8), 0xffffff, {}, 0); eye.position.set(sd * 0.115, 1.89, 0.27); body.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 6), new THREE.MeshBasicMaterial({ color: 0x1a1208 })); pupil.position.set(sd * 0.115, 1.89, 0.322); body.add(pupil);
    const brow = tmesh(new THREE.BoxGeometry(0.11, 0.025, 0.03), hair === 0xdddddd ? 0xbbbbbb : hair, {}, 0); brow.position.set(sd * 0.115, 1.98, 0.29); brow.rotation.z = sd * -0.12; body.add(brow);
    const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.045, 10), new THREE.MeshBasicMaterial({ color: 0xff9a8a, transparent: true, opacity: 0.45 })); cheek.position.set(sd * 0.19, 1.8, 0.285); cheek.rotation.y = sd * 0.5; body.add(cheek);
  }
  const nose = tmesh(new THREE.SphereGeometry(0.05, 8, 6), skin, {}, 0); nose.position.set(0, 1.83, 0.32); body.add(nose);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.013, 4, 10, Math.PI), new THREE.MeshBasicMaterial({ color: 0x5a2a1a })); mouth.position.set(0, 1.74, 0.3); mouth.rotation.z = Math.PI; body.add(mouth);
  if (hood) {
    const h = tmesh(new THREE.ConeGeometry(0.44, 0.66, 14), robe); h.position.set(0, 2.18, -0.1); h.rotation.x = -0.4; body.add(h);
  }
  if (beard) { const b = tmesh(new THREE.ConeGeometry(0.24, 0.66, 10), 0xeeeeee); b.position.set(0, 1.55, 0.2); b.rotation.x = Math.PI + 0.25; body.add(b); }
  const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.35, 16, 1, true), tmat(robeDark, { side: THREE.DoubleSide })); cloak.castShadow = true; cloak.position.set(0, 1.0, -0.13); body.add(cloak);
  const legs = [], arms = [];
  for (const sd of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(sd * 0.17, 0.6, 0);
    const leg = tmesh(new THREE.CylinderGeometry(0.11, 0.1, 0.55, 8), 0x5a4030, {}, 0); leg.position.y = -0.27; hip.add(leg);
    const foot = tmesh(new THREE.SphereGeometry(0.17, 10, 8), skin); foot.scale.set(1, 0.55, 1.5); foot.position.set(0, -0.56, 0.08); hip.add(foot);
    g.add(hip); legs.push(hip);
    const sh = new THREE.Group(); sh.position.set(sd * 0.45, 1.45, 0);
    const arm = tmesh(new THREE.CylinderGeometry(0.09, 0.15, 0.66, 10), robe); arm.position.y = -0.31; sh.add(arm);
    const hand = tmesh(new THREE.SphereGeometry(0.095, 10, 8), skin); hand.position.y = -0.7; sh.add(hand);
    body.add(sh); arms.push(sh);
  }
  if (staff) { const st = tmesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 8), 0x6a4a2a, {}, 0); st.position.set(0.55, 1.2, 0.15); body.add(st); const gem = mesh(new THREE.OctahedronGeometry(0.15), 0x7fd0ff, { emissive: 0x3fa0ff }); gem.position.set(0.55, 2.45, 0.15); body.add(gem); }
  g.scale.setScalar(scale);
  g.userData = { body, legs, arms, phase: 0 };
  return g;
}
function animatePerson(p, speed, dt) {
  const u = p.userData, amt = Math.min(1, speed / 6);
  u.phase += dt * (4 + speed * 1.6);
  const sw = Math.sin(u.phase) * 0.8 * amt;
  u.legs[0].rotation.x = sw; u.legs[1].rotation.x = -sw;
  u.arms[0].rotation.x = -sw * 0.8; u.arms[1].rotation.x = sw * 0.8;
  u.body.position.y = Math.abs(Math.cos(u.phase)) * 0.08 * amt + Math.sin(u.phase * 0.35) * 0.015;
}
// Skulch the Riddle-Creep: pale, crouched, all eyes. He steals the questions you miss.
function creep() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const skin = 0xc9c7a8, dark = 0x8a8670;
  const torso = tmesh(new THREE.SphereGeometry(0.42, 14, 12), skin); torso.scale.set(0.9, 1.15, 0.75); torso.position.set(0, 0.95, -0.05); torso.rotation.x = 0.5; body.add(torso);
  for (let k = 0; k < 4; k++) { const rib = tmesh(new THREE.TorusGeometry(0.3 - k * 0.02, 0.012, 4, 14, Math.PI), dark, {}, 0); rib.position.set(0, 1.05 - k * 0.1, 0.2); rib.rotation.set(0.4, 0, Math.PI); body.add(rib); }
  const cloth = tmesh(new THREE.CylinderGeometry(0.34, 0.3, 0.2, 12), 0x5a4a3a, {}, 0); cloth.position.y = 0.6; body.add(cloth);
  const head = tmesh(new THREE.SphereGeometry(0.42, 18, 14), skin); head.scale.set(1.05, 0.95, 0.95); head.position.set(0, 1.62, 0.2); body.add(head);
  for (const sd of [-1, 1]) {
    const eye = tmesh(new THREE.SphereGeometry(0.15, 14, 12), 0xf2f6ff, {}, 0); eye.position.set(sd * 0.16, 1.68, 0.52); body.add(eye);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), new THREE.MeshBasicMaterial({ color: 0x4a8acf })); iris.position.set(sd * 0.16, 1.68, 0.64); body.add(iris);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: 0x050505 })); pupil.position.set(sd * 0.16, 1.68, 0.71); body.add(pupil);
    const ear = tmesh(new THREE.ConeGeometry(0.1, 0.32, 6), skin, {}, 0); ear.position.set(sd * 0.44, 1.66, 0.15); ear.rotation.z = sd * -1.2; body.add(ear);
  }
  for (const hx of [-0.08, 0.02, 0.1]) { const hair = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.35, 3), new THREE.MeshBasicMaterial({ color: 0x3a3a2a })); hair.position.set(hx, 2.08, 0.16); hair.rotation.z = hx * 3; body.add(hair); }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 4, 10, Math.PI), new THREE.MeshBasicMaterial({ color: 0x2a1a1a })); mouth.position.set(0, 1.46, 0.55); body.add(mouth);
  const tooth = tmesh(new THREE.BoxGeometry(0.04, 0.05, 0.02), 0xf0e8c0, {}, 0); tooth.position.set(0.03, 1.44, 0.57); body.add(tooth);
  const legs = [], arms = [];
  for (const sd of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(sd * 0.2, 0.62, 0);
    const thigh = tmesh(new THREE.CylinderGeometry(0.06, 0.08, 0.45, 6), skin, {}, 0); thigh.position.set(0, -0.12, 0.18); thigh.rotation.x = -1.1; hip.add(thigh);
    const shin = tmesh(new THREE.CylinderGeometry(0.05, 0.06, 0.45, 6), skin, {}, 0); shin.position.set(0, -0.36, 0.3); shin.rotation.x = 0.5; hip.add(shin);
    const foot = tmesh(new THREE.BoxGeometry(0.14, 0.05, 0.34), skin, {}, 0); foot.position.set(0, -0.58, 0.36); hip.add(foot);
    g.add(hip); legs.push(hip);
    const sh = new THREE.Group(); sh.position.set(sd * 0.36, 1.18, 0.12);
    const arm = tmesh(new THREE.CylinderGeometry(0.045, 0.055, 0.8, 6), skin, {}, 0); arm.position.y = -0.38; arm.rotation.x = -0.5; sh.add(arm);
    for (let f = 0; f < 3; f++) { const fin = tmesh(new THREE.CylinderGeometry(0.012, 0.016, 0.16, 4), skin, {}, 0); fin.position.set((f - 1) * 0.04, -0.8, 0.26); fin.rotation.x = -0.9; sh.add(fin); }
    body.add(sh); arms.push(sh);
  }
  g.userData = { body, legs, arms, phase: 0, creep: true };
  return g;
}
function golem(color = 0x8a8a8a) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const torso = mesh(new THREE.BoxGeometry(1.8, 1.8, 1.1), color); torso.position.y = 2.2; body.add(torso);
  const head = mesh(new THREE.BoxGeometry(0.9, 0.8, 0.8), color); head.position.y = 3.5; body.add(head);
  for (const s of [-1, 1]) { const e = mesh(new THREE.BoxGeometry(0.18, 0.1, 0.05), 0xffd166, { emissive: 0xffb000, emissiveIntensity: 2 }); e.position.set(s * 0.2, 3.55, 0.41); body.add(e); }
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.5, 1.3, 0);
    const l = mesh(new THREE.BoxGeometry(0.6, 1.3, 0.6), color); l.position.y = -0.65; hip.add(l); g.add(hip); legs.push(hip);
    const sh = new THREE.Group(); sh.position.set(s * 1.2, 2.9, 0);
    const a = mesh(new THREE.BoxGeometry(0.5, 1.6, 0.5), color); a.position.y = -0.8; sh.add(a); body.add(sh); arms.push(sh);
  }
  const rune = textSprite('Ω', { size: 60, bg: null, color: '#ffd166', font: `700 60px ${GREEK_FONT}`, scale: 0.012 });
  rune.position.set(0, 2.3, 0.6); body.add(rune);
  g.userData = { body, legs, arms, phase: 0 };
  return g;
}

// ── entities: mentors, pedestals, guardians, gates ───────────
const ents = []; // {kind, zone, obj, x, z, r, node?, label}
const portals = [];
function marker(text, color) { const m = textSprite(text, { size: 64, bg: null, color, font: `900 64px Nunito, sans-serif`, scale: 0.016 }); return m; }
function addEnt(e) {
  const nameTag = textSprite(e.label, { size: 30 });
  nameTag.position.y = e.tagY || 2.7; e.obj.add(nameTag);
  e.mark = marker('!', '#ffd166'); e.mark.position.y = (e.tagY || 2.7) + 0.9; e.mark.visible = false; e.obj.add(e.mark);
  ents.push(e); colliders.push({ x: e.x, z: e.z, r: e.r || 0.8 });
  return e;
}
function buildEntities() {
  KG.units.forEach((u, i) => {
    const Z = ZONES[i], side = i % 2 ? -1 : 1;
    // mentor
    let z = -i * L - 24, x = pathX(z) + side * 4.5;
    const m = person({ robe: Z.robe, hair: 0xdddddd, beard: i % 3 === 0, staff: true, hood: i % 2 === 1, skin: [0xf0c8a0, 0xd8a878, 0xb07850][i % 3] });
    m.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    put(m, x, z);
    addEnt({ kind: 'mentor', zone: i, obj: m, x, z, label: `${Z.mentor[0]} · ${Z.mentor[1]}` });
    // reading pedestals
    const reads = u.nodes.filter(n => n.type === 'reading');
    reads.forEach((n, k) => {
      const zz = -i * L - 38 - k * (36 / Math.max(1, reads.length)), s2 = k % 2 ? -1 : 1, xx = pathX(zz) + s2 * 6.5;
      const g = new THREE.Group();
      const col = mesh(new THREE.CylinderGeometry(0.4, 0.55, 1.1, 8), 0xe8dfcc); col.position.y = 0.55; g.add(col);
      const top = mesh(new THREE.BoxGeometry(1.1, 0.15, 0.8), 0xd8cfbc); top.position.y = 1.15; g.add(top);
      const scroll = new THREE.Group();
      const roll = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.9, 10), 0xf5e6c0, { emissive: 0x8a6a20, emissiveIntensity: 0.4 }); roll.rotation.z = Math.PI / 2; scroll.add(roll);
      for (const s of [-1, 1]) { const knob = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 6), 0x6a4a2a); knob.rotation.z = Math.PI / 2; knob.position.x = s * 0.55; scroll.add(knob); }
      scroll.position.y = 1.7; g.add(scroll);
      const glow = glyphSprite('📜'); glow.position.y = 1.7; glow.scale.set(2.2, 2.2, 1); g.add(glow);
      put(g, xx, zz);
      addEnt({ kind: 'pedestal', zone: i, obj: g, x: xx, z: zz, node: n, label: KG.readings[n.reading].ref, tagY: 2.6, spin: scroll, glow });
    });
    // gate + guardian
    const gz = gateZ(i), gx = pathX(gz);
    const gate = new THREE.Group();
    for (const s of [-1, 1]) {
      const p = mesh(new THREE.BoxGeometry(1.4, 7, 1.4), 0xcfc6b0); p.position.set(s * 4, 3.5, 0); gate.add(p);
      const cap = mesh(new THREE.BoxGeometry(1.8, 0.5, 1.8), 0xbfb6a0); cap.position.set(s * 4, 7.2, 0); gate.add(cap);
    }
    const lintel = mesh(new THREE.BoxGeometry(10, 1, 1.4), 0xcfc6b0); lintel.position.y = 7.6; gate.add(lintel);
    const title = textSprite(`${'ΑΒΓΔΕΖΗΘΙ'[i]}′ · ${KG.units[i].title}`, { size: 34, bg: null, color: '#3a2a10', scale: 0.012 });
    title.position.set(0, 7.6, 0.75); gate.add(title);
    const barrier = new THREE.Mesh(new THREE.PlaneGeometry(140, 12), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    barrier.position.y = 4; gate.add(barrier);
    // the portal that appears once the guardian is beaten
    const portal = new THREE.Group(); portal.position.y = 3.6;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.25, 10, 48), new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffb020, emissiveIntensity: 1.2, metalness: 0.6, roughness: 0.3 }));
    portal.add(ring);
    const pc = document.createElement('canvas'); pc.width = pc.height = 256; const px = pc.getContext('2d');
    const grd = px.createRadialGradient(128, 128, 10, 128, 128, 128); grd.addColorStop(0, 'rgba(255,255,255,.95)'); grd.addColorStop(0.4, 'rgba(160,200,255,.7)'); grd.addColorStop(1, 'rgba(120,80,255,.15)');
    px.fillStyle = grd; px.fillRect(0, 0, 256, 256);
    px.strokeStyle = 'rgba(255,255,255,.6)'; px.lineWidth = 6;
    for (let k = 0; k < 6; k++) { px.beginPath(); for (let a = 0; a < 9; a += 0.1) { const r = 6 + a * 13; px.lineTo(128 + Math.cos(a + k * 1.05) * r, 128 + Math.sin(a + k * 1.05) * r); } px.stroke(); }
    const disc = new THREE.Mesh(new THREE.CircleGeometry(2.8, 40), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(pc), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    portal.add(disc); portal.userData.disc = disc;
    gate.add(portal);
    portals[i] = portal;
    put(gate, gx, gz);
    const gzz = gz + 6, gxx = gx + 3.5;
    const gol = golem([0x8a8a8a, 0x6a7a4a, 0xc9a43a, 0x4a6a8a, 0x6a6a7a, 0xa08060, 0xa0b0c0, 0xcfe0ff, 0xe0c060][i]);
    gol.rotation.y = 0;
    put(gol, gxx, gzz);
    addEnt({ kind: 'guardian', zone: i, obj: gol, x: gxx, z: gzz, node: u.nodes[u.nodes.length - 1], label: Z.guard, tagY: 4.6, r: 1.4, gate: barrier });
  });
}

// ── collectibles ──────────────────────────────────────────────
const letters = [], coins = [], scrolls = [];
function buildCollectibles() {
  const w = ws();
  const span = NZ * L - 30, n = KG.sparks.length;
  KG.sparks.forEach((Lt, i) => {
    const z = -8 - i * span / n, side = i % 2 ? 1 : -1, x = pathX(z) + side * (5 + (i * 7 % 6));
    const s = wordSprite(Lt.l);
    s.position.set(x, groundAt(x, z) + 1.3, z); scene.add(s);
    s.visible = !w.letters.includes(i);
    letters.push({ i, s, x, z });
  });
  // lost scrolls: NT passages to collect for the Reading Room
  const found = (E.state.scrolls || {});
  const byUnit = {};
  KG.passages.forEach(p => {
    const k = (byUnit[p.unit] = (byUnit[p.unit] || 0) + 1);
    const z = -p.unit * L - 30 - k * 11, side = k % 2 ? 1 : -1, x = pathX(z) + side * (9 + (k * 3) % 5);
    const g = new THREE.Group();
    const roll = mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.1, 12), 0xf5e6c0, { emissive: 0xa07a20, emissiveIntensity: 0.6 }); roll.rotation.z = Math.PI / 2; g.add(roll);
    for (const sd of [-1, 1]) { const kn = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.25, 8), 0x8a5a2a); kn.rotation.z = Math.PI / 2; kn.position.x = sd * 0.65; g.add(kn); }
    const seal = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 10), 0xc9452b); seal.rotation.x = Math.PI / 2; seal.position.z = 0.22; g.add(seal);
    const halo = glyphSprite('📜'); halo.scale.set(2.4, 2.4, 1); g.add(halo);
    g.position.set(x, groundAt(x, z) + 1.2, z); scene.add(g);
    g.visible = !found[p.id];
    scrolls.push({ p, g, x, z });
  });
  const coinG = new THREE.CylinderGeometry(0.32, 0.32, 0.08, 16);
  const coinM = new THREE.MeshStandardMaterial({ color: 0xffd166, metalness: 0.9, roughness: 0.25, emissive: 0x6a4a00 });
  for (let i = 0; i < NZ * 14; i++) {
    const zi = Math.floor(i / 14), z = -zi * L - 8 - (i % 14) * 5.6 - hash(i, 3) * 3, x = pathX(z) + (hash(i, 7) - 0.5) * 18;
    const c = new THREE.Mesh(coinG, coinM); c.rotation.x = Math.PI / 2; c.castShadow = true;
    c.position.set(x, groundAt(x, z) + 0.8, z); scene.add(c);
    c.visible = !w.coins.got.includes(i);
    coins.push({ i, c, x, z });
  }
}

// ── wisps: Shades of Forgetting ──────────────────────────────
const wisps = [];
function wispMesh(elite = false) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), new THREE.MeshStandardMaterial({ color: elite ? 0x8a1a2a : 0x5a2a8a, emissive: elite ? 0xff3a3a : 0x7a3aff, emissiveIntensity: 1.2, flatShading: true }));
  g.add(core);
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, elite ? 'rgba(255,120,120,.9)' : 'rgba(180,120,255,.9)'); gr.addColorStop(1, elite ? 'rgba(255,60,60,0)' : 'rgba(120,60,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(2.4, 2.4, 1); g.add(halo);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); e.position.set(s * 0.15, 0.08, 0.4); g.add(e); }
  return g;
}
function spawnWisp(w) {
  const z = -w.zone * L - 12 - Math.random() * (L - 30), x = pathX(z) + (Math.random() - 0.5) * 24;
  w.obj.position.set(x, groundAt(x, z) + 1.4, z);
  w.home = new THREE.Vector3(x, 0, z); w.target = null; w.obj.visible = true; w.dead = false;
}
function buildWisps() {
  for (let zi = 1; zi < NZ; zi++) for (let k = 0; k < 3; k++) {
    // one elite shade per world hunts your weakest words
    const elite = k === 2;
    const w = { zone: zi, obj: wispMesh(elite), t: Math.random() * 10, elite };
    if (elite) w.obj.scale.setScalar(1.45);
    scene.add(w.obj); spawnWisp(w); wisps.push(w);
  }
}

// ── player ────────────────────────────────────────────────────
// ── the hero's look: robe, hat, staff and companion from the wardrobe ──
function addHat(body, hat) {
  if (hat === 'wizard') {
    const c = mesh(new THREE.ConeGeometry(0.36, 1.0, 12), 0x3a2a7a); c.position.y = 2.55; c.rotation.z = 0.12; body.add(c);
    const b = mesh(new THREE.TorusGeometry(0.4, 0.07, 6, 20), 0x2a1a5a); b.rotation.x = Math.PI / 2; b.position.y = 2.08; body.add(b);
    const st = mesh(new THREE.OctahedronGeometry(0.08), 0xffd166, { emissive: 0xffb000, emissiveIntensity: 1 }); st.position.set(0.12, 2.6, 0.22); body.add(st);
  } else if (hat === 'laurel') {
    const t = mesh(new THREE.TorusGeometry(0.31, 0.06, 6, 18), 0x4f8f3a); t.rotation.x = Math.PI / 2; t.position.y = 2.02; body.add(t);
  } else if (hat === 'crown') {
    const c = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 12, 1, true), 0xe0b030, { metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide }); c.position.y = 2.12; body.add(c);
    for (let k = 0; k < 6; k++) { const sp = mesh(new THREE.ConeGeometry(0.06, 0.18, 5), 0xe0b030, { metalness: 0.8, roughness: 0.3 }); const a = k / 6 * Math.PI * 2; sp.position.set(Math.cos(a) * 0.28, 2.3, Math.sin(a) * 0.28); body.add(sp); }
  }
}
function addStaff(body, staff) {
  if (staff === 'none') return;
  const col = { oak: 0x6a4a2a, crystal: 0x8a8aa0, lightning: 0xd0a030 }[staff], gem = { oak: [0x5ab04a, 0x2a8020], crystal: [0x7fd0ff, 0x3fa0ff], lightning: [0xffee66, 0xffcc00] }[staff];
  const st = mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), col); st.position.set(0.55, 1.15, 0.15); body.add(st);
  const g = mesh(new THREE.OctahedronGeometry(0.16), gem[0], { emissive: gem[1], emissiveIntensity: 1.2 }); g.position.set(0.55, 2.35, 0.15); body.add(g);
}
function applyLook(g) {
  const L = E.look();
  while (g.children.length) g.remove(g.children[0]);
  const robe = (KG.wardrobe.robe.find(r => r.id === L.robe) || KG.wardrobe.robe[0]).color;
  const m = person({ robe, hair: 0x7a4a1e, hood: L.hat === 'hood' });
  for (const c of [...m.children]) g.add(c);
  g.userData = m.userData;
  addHat(g.userData.body, L.hat); addStaff(g.userData.body, L.staff);
  return g;
}
function buildPet(type) {
  if (!type || type === 'none') return null;
  const p = new THREE.Group();
  if (type === 'owl') {
    const b = mesh(new THREE.SphereGeometry(0.28, 12, 10), 0x8a6a4a); b.scale.y = 1.2; p.add(b);
    for (const sd of [-1, 1]) {
      const e = mesh(new THREE.SphereGeometry(0.09, 8, 8), 0xffffff); e.position.set(sd * 0.11, 0.1, 0.22); p.add(e);
      const pu = mesh(new THREE.SphereGeometry(0.045, 6, 6), 0x111111); pu.position.set(sd * 0.11, 0.1, 0.3); p.add(pu);
      const ear = mesh(new THREE.ConeGeometry(0.06, 0.16, 5), 0x6a4a2a); ear.position.set(sd * 0.15, 0.36, 0); p.add(ear);
      const w = mesh(new THREE.SphereGeometry(0.2, 8, 6), 0x6a4a2a); w.scale.set(0.3, 0.8, 0.9); w.position.set(sd * 0.28, 0, 0); p.add(w); w.userData.wing = sd;
    }
    p.userData.fly = 2.4;
  } else if (type === 'dove') {
    const b = mesh(new THREE.SphereGeometry(0.22, 12, 10), 0xffffff); b.scale.z = 1.4; p.add(b);
    const h = mesh(new THREE.SphereGeometry(0.13, 10, 8), 0xffffff); h.position.set(0, 0.12, 0.26); p.add(h);
    const bk = mesh(new THREE.ConeGeometry(0.04, 0.1, 5), 0xffb040); bk.rotation.x = Math.PI / 2; bk.position.set(0, 0.1, 0.4); p.add(bk);
    for (const sd of [-1, 1]) { const w = mesh(new THREE.BoxGeometry(0.4, 0.04, 0.22), 0xf0f0f8); w.position.set(sd * 0.3, 0.05, 0); p.add(w); w.userData.wing = sd; }
    p.userData.fly = 2.6;
  } else if (type === 'lamb') {
    for (let k = 0; k < 7; k++) { const f = mesh(new THREE.SphereGeometry(0.2, 8, 6), 0xf4f0e8); f.position.set((k % 3 - 1) * 0.16, 0.42 + (k > 3 ? 0.1 : 0), (Math.floor(k / 3) - 1) * 0.16); p.add(f); }
    const h = mesh(new THREE.SphereGeometry(0.16, 10, 8), 0x2a2a2a); h.position.set(0, 0.52, 0.34); p.add(h);
    for (const [x, z] of [[-0.14, -0.15], [0.14, -0.15], [-0.14, 0.15], [0.14, 0.15]]) { const l = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 5), 0x2a2a2a); l.position.set(x, 0.15, z); p.add(l); }
    p.userData.hop = true;
  }
  return p;
}
function animatePet(p, t, dt) {
  if (!p) return;
  for (const c of p.children) if (c.userData.wing) c.rotation.z = c.userData.wing * Math.sin(t * 14) * 0.6;
}
const player = new THREE.Group();
applyLook(player);
scene.add(player);
let pet = null;
function setPet() {
  if (pet) scene.remove(pet);
  pet = buildPet(E.look().pet);
  if (pet) { pet.position.copy(player.position).add(new THREE.Vector3(1, 1, 1)); scene.add(pet); }
}
E.on(t => { if (t === 'look') { applyLook(player); setPet(); } });
const P = { vel: new THREE.Vector3(), onGround: true, hearts: 5, maxHearts: 5, hurtT: 0, regen: 0, zone: -1 };
const cam = { yaw: Math.PI, pitch: 0.42, dist: 8.5, auto: 0 };
const input = { f: 0, r: 0, run: false, jump: false, keys: {}, joy: null, drag: null };

// ── HUD & overlays ────────────────────────────────────────────
const hud = document.getElementById('whud');
hud.innerHTML = `
  <div class="wtop">
    <div class="wstat"><div class="whearts" id="whearts"></div><div class="wlv"><b id="wlv">1</b><span class="wxp"><i id="wxp"></i></span></div><div class="wcoins">🪙 <b id="wcoins">0</b></div></div>
    <div class="wbtns"><button class="wb" id="wmapbtn" title="World map">🗺</button><button class="wb" data-act="go" data-arg="codex" title="Library">📖</button><button class="wb" data-act="go" data-arg="review" title="Review">🔁<span id="wdue" class="wbadge"></span></button><button class="wb" data-act="go" data-arg="path" title="Journal">📜</button><button class="wb" data-act="go" data-arg="profile" title="Profile">👤</button></div>
  </div>
  <div class="wquest" id="wquest"><div class="wq-arrow" id="wqarrow">▲</div><div><div class="wq-k">Quest</div><div id="wqtext"></div></div></div>
  <div class="wbanner" id="wbanner"></div>
  <div class="wprompt" id="wprompt"></div>
  <div class="wjoy" id="wjoy"><div class="wjoy-knob" id="wknob"></div></div>
  <div class="wact"><button class="wbig" id="wtalk">💬</button><button class="wbig wjump" id="wjump">⤒</button></div>
  <div class="whelp" id="whelp">WASD / arrows to move · Shift to run · Space to jump · E to talk · drag to look</div>
  <div class="wdlg" id="wdlg"></div>
  <div class="wbattle" id="wbattle"></div>`;
const $ = id => document.getElementById(id);

function updateHUD() {
  const s = E.state, lv = E.levelInfo();
  $('whearts').innerHTML = '❤'.repeat(P.hearts) + `<span class="lost">${'❤'.repeat(P.maxHearts - P.hearts)}</span>`;
  $('wlv').textContent = lv.level; $('wxp').style.width = (lv.cur / lv.need) * 100 + '%';
  $('wcoins').textContent = s.coins;
  const due = E.dueWords().length; $('wdue').textContent = due || ''; $('wdue').style.display = due ? '' : 'none';
}

// quest target: whoever offers the next lesson on the path
function questTarget() {
  const n = E.nextNode();
  if (!n) return { done: true };
  let e;
  if (n.type === 'boss') e = ents.find(x => x.kind === 'guardian' && x.zone === n.unit);
  else if (n.type === 'reading') e = ents.find(x => x.kind === 'pedestal' && x.node.id === n.id);
  else e = ents.find(x => x.kind === 'mentor' && x.zone === n.unit);
  return { node: n, ent: e };
}
let beacon;
function refreshMarkers() {
  const t = questTarget();
  for (const e of ents) {
    e.mark.visible = e.kind === 'villain' || t.ent === e;
    if (e.kind === 'guardian') { e.gate.visible = !gateOpen(e.zone); portals[e.zone].visible = gateOpen(e.zone); }
    if (e.kind === 'pedestal') {
      const done = E.stars(e.node.id) > 0;
      e.glow.material.opacity = done ? 1 : E.unlocked(e.node) ? 0.8 : 0.25;
    }
  }
  if (!beacon) {
    beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 60, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    scene.add(beacon);
  }
  beacon.visible = !!t.ent;
  if (t.ent) beacon.position.set(t.ent.x, groundAt(t.ent.x, t.ent.z) + 30, t.ent.z);
  const who = t.ent ? (t.ent.kind === 'mentor' ? `Visit ${ZONES[t.ent.zone].mentor[1]}` : t.ent.kind === 'pedestal' ? 'Restore the lost scroll' : `Challenge ${t.ent.label}`) : '';
  syncVillains();
  const vs = Object.keys(E.state.villains || {}).map(Number);
  $('wqtext').innerHTML = (t.done ? 'All quests complete! Step into the Hall of Victory.' : `${who}: <b>${esc(t.node.title)}</b> <span class="wq-go">▶ tap to start</span>`)
    + (vs.length ? `<div class="wq-side">😈 Side quest: beat Skulch in ${vs.map(z => esc(ZONES[z].name)).join(', ')}</div>` : '');
  W.target = t.ent;
  updateHUD();
}

let bannerT = 0;
function storyBeat(zi) {
  const Z = ZONES[zi];
  // only tell a world's story while you are still in it; otherwise save it for your next visit
  if (zoneOf(player.position.z) !== zi || dlgOpen || battle || !active) { const w = ws(); w.seen = (w.seen || []).filter(x => x !== zi); E.save(); return; }
  dialog(`📖 ${esc(Z.name)}`, `<p>${esc(KG.story.arrive[zi])}</p><p class="muted small">Find <b>${esc(Z.mentor[1])}</b>, ${esc(Z.mentor[2])}. Follow the golden light.</p>`, [{ label: 'Onward', cls: 'primary' }]);
}
// travel to any world you have reached
function worldMap() {
  const reach = i => i === 0 || gateOpen(i - 1);
  dialog('🗺 World Map', `<div class="wmap">${ZONES.map((Z, i) => `<button class="wm ${reach(i) ? '' : 'locked'} ${i === P.zone ? 'here' : ''}" data-wm="${i}" ${reach(i) ? '' : 'disabled'}>
      <b>${i + 1}. ${esc(Z.name)}</b><span>${reach(i) ? esc(KG.units[i].title) + (i === P.zone ? ' · you are here' : '') : '🔒 Beat the guardian before it'}</span></button>`).join('')}</div>`, [{ label: 'Close' }]);
  document.querySelectorAll('[data-wm]').forEach(b => b.onclick = () => {
    const i = +b.dataset.wm, m = ents.find(e => e.kind === 'mentor' && e.zone === i);
    closeDialog();
    root.classList.add('portalfx'); KG.app.sfx('level');
    setTimeout(() => { player.position.set(m.x - 2, groundAt(m.x - 2, m.z + 3), m.z + 3); snapCamera(); }, 250);
    setTimeout(() => root.classList.remove('portalfx'), 900);
  });
}
function showBanner(i) {
  const u = KG.units[i];
  $('wbanner').innerHTML = `<div class="wb-k">Region ${i + 1} · ${esc(u.title)}</div><div class="wb-t">${esc(ZONES[i].name)}</div><div class="wb-s">${esc(u.sub)}</div>${u.hook ? `<div class="wb-s">🪝 ${esc(u.hook)}</div>` : ''}`;
  $('wbanner').classList.add('on'); bannerT = 3;
}

// dialogue
let dlgOpen = false;
function dialog(name, html, buttons) {
  dlgOpen = true;
  const d = $('wdlg');
  d.innerHTML = `<div class="wd-box"><div class="wd-name">${name}</div><div class="wd-text">${html}</div><div class="wd-btns">${buttons.map((b, i) => `<button class="btn ${b.cls || 'ghost'}" data-wb="${i}">${b.label}</button>`).join('')}</div></div>`;
  d.classList.add('on');
  d.querySelectorAll('[data-wb]').forEach(el => el.onclick = () => { const b = buttons[+el.dataset.wb]; if (b.keep !== true) closeDialog(); if (b.fn) b.fn(); });
}
function closeDialog() { dlgOpen = false; $('wdlg').classList.remove('on'); $('wdlg').innerHTML = ''; }
function launch(id) { savePos(); closeDialog(); KG.app.startNode(id); }

// Skulch hides in a region after you fail a lesson there; one creature per region
const villains = [];
function buildVillains() {
  KG.units.forEach((u, i) => {
    const z = -i * L - 14, x = pathX(z) + (i % 2 ? 4.5 : -4.5);
    const o = creep(); o.scale.setScalar(1.25); put(o, x, z);
    const e = addEnt({ kind: 'villain', zone: i, obj: o, x, z, label: 'Skulch the Riddle-Creep', tagY: 2.9 });
    e.col = colliders[colliders.length - 1];
    e.mark.visible = true; e.mark.material = marker('!', '#ff5a4a').material;
    villains.push(e);
  });
}
function syncVillains() {
  const V = E.state.villains || {};
  for (const e of villains) { const on = !!V[e.zone]; e.obj.visible = on; e.col.r = on ? 0.8 : 0; }
}
function talk(e) {
  const Z = ZONES[e.zone], app = KG.app;
  app.sfx('tap');
  if (e.kind === 'mentor') {
    const t = questTarget(), mine = KG.units[e.zone].nodes.filter(n => n.type !== 'reading' && n.type !== 'boss');
    const U0 = KG.units[e.zone];
    const greet = `<p><span class="gk">${esc(Z.greet[0])}</span> <i>(${esc(Z.greet[1])})</i></p>${U0.hook ? `<p class="wd-hook">🪝 Say it with me: <b>${esc(U0.hook)}</b></p>` : ''}`;
    let html = greet, btns = [];
    if (t.done) html += '<p>You have learned all I can teach. You are ready for the quiz, scribe!</p>';
    else if (t.ent === e) {
      html += `<p>I am ${esc(Z.mentor[1])}, ${esc(Z.mentor[2])}. Your next lesson with me is <b>${esc(t.node.title)}</b>.</p>`;
      btns.push({ label: `Begin: ${esc(t.node.title)} ▶`, cls: 'primary', fn: () => launch(t.node.id) });
    } else if (t.node.unit === e.zone) html += `<p>${t.ent.kind === 'pedestal' ? `A lost scroll lies nearby: <b>${esc(t.ent.label)}</b>. Restore it at its pedestal (follow the golden light).` : `You are ready! Face <b>${esc(t.ent.label)}</b> at the gate to prove what you've learned.`}</p>`;
    else if (t.node.unit > e.zone) html += `<p>You have finished my lessons. Your path lies onward through the gate: seek ${esc(ZONES[t.node.unit].mentor[1])} in ${esc(ZONES[t.node.unit].name)}.</p>`;
    else html += `<p>You are not ready for my lessons yet. Return to ${esc(ZONES[t.node.unit].name)} first.</p>`;
    const done = mine.filter(n => E.stars(n.id) > 0);
    if (done.length) {
      html += `<p class="muted small">Practice a lesson again:</p>`;
      done.slice(-4).forEach(n => btns.push({ label: `↺ ${esc(n.title)}`, fn: () => launch(n.id) }));
    }
    btns.push({ label: 'Farewell' });
    dialog(`${esc(Z.mentor[0])} <span class="muted">· ${esc(Z.mentor[1])}, ${esc(Z.mentor[2])}</span>`, html, btns);
  } else if (e.kind === 'pedestal') {
    const n = e.node, R = KG.readings[n.reading], done = E.stars(n.id) > 0;
    if (!E.unlocked(n)) return dialog(`📜 ${esc(R.ref)}`, '<p>The scroll is sealed with a strange light. Learn more from the mentor first.</p>', [{ label: 'Leave' }]);
    dialog(`📜 ${esc(R.ref)}`, done ? `<p>You restored this scroll. Its words shine again:</p><p class="gk wd-verse">${esc(R.words.map(w => w.w + w.p).join(' '))}</p>` :
      `<p>A lost scroll! Its sentence is fading. It is built from words you have just learned: read it and translate it to restore it.</p>`,
      [{ label: done ? 'Read & translate again' : 'Restore the scroll ▶', cls: 'primary', fn: () => launch(n.id) }, { label: 'Leave' }]);
  } else if (e.kind === 'villain') {
    const v = (E.state.villains || {})[e.zone];
    if (!v) return;
    dialog('😈 Skulch the Riddle-Creep', `<p><b>“Sss! It wants its words back, does it? Skulch took them, yesss, ${v.qs.length} lovely little words and uses it got wrong. Answer Skulch's riddles, then, and maybe it gets them. Miss three and Skulch keeps them, yesss, forever.”</b></p><p class="muted small">Side quest: ${Math.max(6, Math.min(10, v.qs.length + 3))} riddles from the questions you missed, 3 hearts. Win for +40 XP and 15 🪙.</p>`,
      [{ label: 'Riddle me ⚔', cls: 'primary', fn: () => { savePos(); closeDialog(); KG.app.startVillain(e.zone); } }, { label: 'Not now' }]);
  } else if (e.kind === 'guardian') {
    const n = e.node;
    if (gateOpen(e.zone)) return dialog(esc(e.label), '<p><span class="gk">Πάρελθε.</span> <i>(Pass by.)</i> You have proven yourself, scribe. The way is open.</p>', [{ label: 'Rematch ⚔', fn: () => launch(n.id) }, { label: 'Onward' }]);
    if (!E.unlocked(n)) return dialog(esc(e.label), '<p><b>NONE SHALL PASS</b> who have not mastered the lessons of this land! Return when your mentor has taught you all.</p>', [{ label: 'Leave' }]);
    dialog(esc(e.label), `<p><b>So, little scribe, you would pass my gate?</b> Answer my riddles. Fail three times and you are cast back!</p>${KG.units[e.zone].hook ? `<p class="wd-hook">🪝 Remember: <b>${esc(KG.units[e.zone].hook)}</b></p>` : ''}<p class="muted small">Boss battle: ${n.final ? `20 questions from the whole of Chapter ${KG.units[e.zone].chapter}` : `15 questions from all of ${esc(KG.units[e.zone].title)}`}, 3 hearts.</p>`,
      [{ label: 'Fight ⚔', cls: 'primary', fn: () => launch(n.id) }, { label: 'Not yet' }]);
  }
}

// battles against the Shades of Forgetting
let battle = null;
function startBattle(w) {
  const studied = Object.keys(E.state.vocab).map(g => E.vocabByGreek[g]).filter(Boolean);
  const due = E.dueWords();
  const pool = studied.length >= 4 ? studied : E.vocabSet(0).concat(E.vocabSet(1));
  const weak = E.weakWords(6);
  const word = w.elite && weak.length ? U.pick(weak) : due.length ? U.pick(due) : U.pick(pool);
  // well-known words come back the harder way round: English → Greek
  const rec = E.state.vocab[word.g], hard = w.elite || (rec && rec.box >= 3);
  // once concept lessons are done, some shades ask about a use instead of a word
  const learned = E.nodes.some(n => n.type === 'grammar' && E.stars(n.id) > 0);
  const q = learned && Math.random() < 0.35 ? E.spotQ(U.pick(E.unlockedCards()), KG.cards)
    : E.vocabQ(word, pool.length > 8 ? pool : KG.vocab, hard ? 'e2g' : w.elite ? 'hook' : 'g2e');
  battle = { w, q, done: false };
  KG.app.sfx('bad');
  const b = $('wbattle');
  b.innerHTML = `<div class="wbt-box ${w.elite ? 'elite' : ''}"><div class="wbt-h">${w.elite ? '🔥 An ELITE Shade attacks! It knows your weakest words…' : '👻 A Shade of Forgetting attacks!'}</div><div class="muted small">Banish it by remembering.</div>
    <div class="wbt-q">${q.prompt}</div><div class="wbt-big gk ${q.small ? 'small' : ''}">${esc(q.big || '')}</div>${q.sub && q.small ? `<div class="muted small">${esc(q.sub)}</div>` : ''}
    <div class="wbt-opts">${q.options.map((o, i) => `<button class="wbt-opt ${q.greekOpts ? 'gk' : ''}" data-bo="${i}"><span class="k">${i + 1}</span>${q.greekOpts ? esc(o) : o}</button>`).join('')}</div><div id="wbtfb"></div></div>`;
  b.classList.add('on');
  b.querySelectorAll('[data-bo]').forEach(el => el.onclick = () => answerBattle(+el.dataset.bo, el));
  if (q.speak) KG.app.speak(q.speak);
}
function answerBattle(i, el) {
  if (!battle || battle.done) return;
  const { q, w } = battle, ok = i === q.answer;
  battle.done = true;
  E.recordAnswer(q, ok, true);
  $('wbattle').querySelectorAll('.wbt-opt').forEach((b, k) => { b.disabled = true; if (k === q.answer) b.classList.add('right'); });
  if (!ok) el.classList.add('wrong');
  $('wbtfb').innerHTML = `<div class="wbt-fb ${ok ? 'ok' : 'no'}">${ok ? `✨ The shade dissolves into light! +${w.elite ? 16 : 8} XP` : `💔 It strikes you! ${q.explain || ''}`}</div><button class="btn ${ok ? 'good' : 'bad'} wide" id="wbtgo">Continue</button>`;
  if (ok) { KG.app.sfx('good'); E.gainXP(w.elite ? 16 : 8, w.elite ? 3 : 1); ws().wisps++; E.checkAchievements(); w.dead = true; w.obj.visible = false; w.respawn = 40; E.questProgress('shades'); burst(w.obj.position, 0xb388ff); }
  else { KG.app.sfx('bad'); P.hearts = Math.max(0, P.hearts - 1); P.hurtT = 1; const away = player.position.clone().sub(w.obj.position).setY(0).normalize(); P.vel.addScaledVector(away, 9); w.cool = 4; }
  updateHUD();
  $('wbtgo').onclick = endBattle; $('wbtgo').focus();
}
function endBattle() {
  $('wbattle').classList.remove('on'); $('wbattle').innerHTML = '';
  battle = null;
  if (P.hearts <= 0) {
    const m = ents.find(e => e.kind === 'mentor' && e.zone === zoneOf(player.position.z));
    dialog('😵 You fainted…', `<p>The shades overwhelmed you. You wake beside ${esc(ZONES[m.zone].mentor[1])}, who gives you some bread and water.</p><p class="muted small">Tip: review your words in 🔁 Review to make the shades easier.</p>`, [{ label: 'Get up', cls: 'primary' }]);
    P.hearts = P.maxHearts;
    player.position.set(m.x - 2, groundAt(m.x - 2, m.z + 2), m.z + 2);
    updateHUD();
  }
}

// particle burst
const bursts = [];
function burst(pos, color) {
  const n = 30, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), v = [];
  for (let i = 0; i < n; i++) { p.set([pos.x, pos.y, pos.z], i * 3); v.push(new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6)); }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 0.25, transparent: true }));
  scene.add(pts); bursts.push({ pts, v, t: 1 });
}

// ── input ─────────────────────────────────────────────────────
const KEYMAP = { KeyW: 'f+', ArrowUp: 'f+', KeyS: 'f-', ArrowDown: 'f-', KeyA: 'r-', ArrowLeft: 'r-', KeyD: 'r+', ArrowRight: 'r+' };
addEventListener('keydown', e => {
  if (!active) return;
  if (mode === 'stage') { if (stage.key(e)) e.preventDefault(); return; }
  if (battle) { if (/^[1-4]$/.test(e.key)) { const b = document.querySelector(`[data-bo="${+e.key - 1}"]`); if (b) b.click(); } else if (e.key === 'Enter') { const g = $('wbtgo'); if (g) g.click(); } return; }
  if (dlgOpen) { if (e.key === 'Escape') closeDialog(); return; }
  input.keys[e.code] = true;
  if (e.code === 'Space') { input.jump = true; e.preventDefault(); }
  if (e.code === 'KeyE' || e.code === 'Enter') tryTalk();
  $('whelp').classList.add('gone');
});
addEventListener('keyup', e => { input.keys[e.code] = false; });
const canvas = renderer.domElement;
canvas.addEventListener('pointerdown', e => {
  if (mode === 'stage') { stage.pointer(e); return; }
  canvas.setPointerCapture(e.pointerId);
  // walk with the right thumb, look around with the left
  if (e.pointerType === 'touch' && e.clientX > innerWidth * 0.55 && !input.joy) {
    input.joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 };
    const j = $('wjoy'); j.style.left = (e.clientX - 60) + 'px'; j.style.top = (e.clientY - 60) + 'px'; j.classList.add('on');
  } else input.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointermove', e => {
  if (input.joy && e.pointerId === input.joy.id) {
    let dx = e.clientX - input.joy.x0, dy = e.clientY - input.joy.y0; const m = Math.hypot(dx, dy), max = 50;
    if (m > max) { dx *= max / m; dy *= max / m; }
    input.joy.dx = dx / max; input.joy.dy = dy / max;
    $('wknob').style.transform = `translate(${dx}px, ${dy}px)`;
  } else if (input.drag && e.pointerId === input.drag.id) {
    cam.yaw -= (e.clientX - input.drag.x) * 0.006; cam.pitch = Math.min(1.25, Math.max(0.08, cam.pitch + (e.clientY - input.drag.y) * 0.004));
    input.drag.x = e.clientX; input.drag.y = e.clientY; cam.auto = 1.5;
  }
});
const endPtr = e => {
  if (input.joy && e.pointerId === input.joy.id) { input.joy = null; $('wjoy').classList.remove('on'); $('wknob').style.transform = ''; }
  if (input.drag && e.pointerId === input.drag.id) input.drag = null;
};
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', e => { cam.dist = Math.min(16, Math.max(4, cam.dist + e.deltaY * 0.01)); e.preventDefault(); }, { passive: false });
$('wjump').addEventListener('pointerdown', e => { input.jump = true; e.preventDefault(); });
$('wtalk').addEventListener('click', () => tryTalk());
// tap the quest box to start the next lesson from anywhere, no walking back
$('wquest').addEventListener('click', () => { if (dlgOpen || battle) return; const t = questTarget(); if (t.node && E.unlocked(t.node)) launch(t.node.id); });
$('wmapbtn').addEventListener('click', () => { if (!battle) worldMap(); });

let nearEnt = null;
function tryTalk() { if (nearEnt && !dlgOpen && !battle) talk(nearEnt); }

// ── update loop ───────────────────────────────────────────────
let active = false, raf = 0, saveT = 0;
const tmp = new THREE.Vector3();
function step(dt) {
  const t = clock.elapsedTime, pos = player.position;
  const busy = dlgOpen || battle;
  // input → movement
  let f = 0, r = 0;
  if (!busy) {
    const k = input.keys;
    if (KEYMAP && (k.KeyW || k.ArrowUp)) f += 1; if (k.KeyS || k.ArrowDown) f -= 1;
    if (k.KeyA || k.ArrowLeft) r -= 1; if (k.KeyD || k.ArrowRight) r += 1;
    if (input.joy) { f -= input.joy.dy; r += input.joy.dx; }
  }
  const mag = Math.min(1, Math.hypot(f, r));
  const run = input.keys.ShiftLeft || input.keys.ShiftRight || (input.joy && mag > 0.92);
  const speed = mag * (run ? 9.5 : 5.5);
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
  let mx = fx * f + rx * r, mz = fz * f + rz * r; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
  if (mag > 0.05) {
    const want = Math.atan2(mx, mz);
    let dr = want - player.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
    player.rotation.y += dr * Math.min(1, dt * 12);
  }
  P.vel.x += (mx * speed - P.vel.x) * Math.min(1, dt * 10);
  P.vel.z += (mz * speed - P.vel.z) * Math.min(1, dt * 10);
  if (mag <= 0.05) { P.vel.x *= Math.max(0, 1 - dt * 10); P.vel.z *= Math.max(0, 1 - dt * 10); }
  if (input.jump && P.onGround && !busy) { P.vel.y = 7.5; P.onGround = false; }
  input.jump = false;
  P.vel.y -= 22 * dt;
  pos.x += P.vel.x * dt; pos.z += P.vel.z * dt; pos.y += P.vel.y * dt;
  // world bounds: stay in the valley, behind closed gates
  const px = pathX(pos.z), lim = 30;
  if (pos.x - px > lim) pos.x = px + lim; if (px - pos.x > lim) pos.x = px - lim;
  if (pos.z > 3) pos.z = 3;
  if (pos.z < END_Z + 8) pos.z = END_Z + 8;
  for (let i = 0; i < NZ; i++) if (!gateOpen(i) && pos.z < gateZ(i) + 0.8 && pos.z > gateZ(i) - 6) { pos.z = gateZ(i) + 0.8; P.vel.z = Math.max(0, P.vel.z); }
  for (const c of colliders) {
    const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), r2 = c.r + 0.45;
    if (d < r2 && d > 0.001) { pos.x = c.x + dx / d * r2; pos.z = c.z + dz / d * r2; }
  }
  const gy = groundAt(pos.x, pos.z);
  if (pos.y <= gy) { pos.y = gy; P.vel.y = 0; P.onGround = true; }
  animatePerson(player, P.onGround ? Math.hypot(P.vel.x, P.vel.z) : 0, dt);
  if (pet) {
    const back = player.rotation.y + Math.PI * 0.75, tx = pos.x + Math.sin(back) * 1.4, tz = pos.z + Math.cos(back) * 1.4;
    pet.position.x += (tx - pet.position.x) * Math.min(1, dt * 3); pet.position.z += (tz - pet.position.z) * Math.min(1, dt * 3);
    const gy = groundAt(pet.position.x, pet.position.z);
    pet.position.y = gy + (pet.userData.fly ? pet.userData.fly + Math.sin(t * 2.5) * 0.25 : Math.abs(Math.sin(t * 6)) * (Math.hypot(P.vel.x, P.vel.z) > 0.5 ? 0.25 : 0.03));
    pet.rotation.y = Math.atan2(pos.x - pet.position.x, pos.z - pet.position.z);
    animatePet(pet, t, dt);
  }
  player.userData.body.rotation.x = P.onGround ? 0 : -0.15;

  // camera: follow and gently swing behind the player while walking
  cam.auto = Math.max(0, cam.auto - dt);
  if (mag > 0.3 && cam.auto <= 0 && f > 0.2) {
    let d = (player.rotation.y + Math.PI) - cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    cam.yaw += d * dt * 1.2;
  }
  const cd = cam.dist, cy = Math.sin(cam.pitch) * cd, ch = Math.cos(cam.pitch) * cd;
  tmp.set(pos.x + Math.sin(cam.yaw) * ch, pos.y + 1.4 + cy, pos.z + Math.cos(cam.yaw) * ch);
  tmp.y = Math.max(tmp.y, groundAt(tmp.x, tmp.z) + 0.8);
  camera.position.lerp(tmp, Math.min(1, dt * 8));
  camera.lookAt(pos.x, pos.y + 1.4, pos.z);
  sun.position.set(pos.x + 30, pos.y + 60, pos.z + 20); sun.target.position.set(pos.x, pos.y, pos.z);
  scene.getObjectByName('sky').position.copy(camera.position);

  // regions
  const zi = zoneOf(pos.z);
  if (zi !== P.zone) {
    const first = P.zone < 0;
    P.zone = zi; showBanner(zi);
    if (!first) { root.classList.add('portalfx'); setTimeout(() => root.classList.remove('portalfx'), 900); KG.app.sfx('level'); }
    const w = ws(); w.seen = w.seen || [];
    if (!w.seen.includes(zi)) { w.seen.push(zi); E.save(); if (KG.story.arrive[zi] && !dlgOpen) setTimeout(() => storyBeat(zi), first ? 300 : 900); }
  }
  blendAtmosphere(zi, Math.min(1, dt * 1.2));
  for (const pt of portals) if (pt && pt.visible) { pt.userData.disc.rotation.z -= dt * 1.5; pt.children[0].rotation.z += dt * 0.4; }
  if (bannerT > 0 && (bannerT -= dt) <= 0) $('wbanner').classList.remove('on');

  // NPCs idle & interaction
  nearEnt = null; let best = 3.6;
  for (const e of ents) {
    if (!e.obj.visible) continue;
    const d = Math.hypot(pos.x - e.x, pos.z - e.z);
    if (e.kind === 'villain') { e.obj.userData.body.position.y = Math.abs(Math.sin(t * 5)) * 0.08; e.obj.userData.body.rotation.z = Math.sin(t * 2.3) * 0.12; }
    e.mark.position.y = (e.tagY || 2.7) + 0.9 + Math.sin(t * 3) * 0.12;
    if (e.kind === 'pedestal') { e.spin.rotation.y += dt; e.spin.position.y = 1.7 + Math.sin(t * 2) * 0.1; }
    else if (d < 12) { const want = Math.atan2(pos.x - e.x, pos.z - e.z); let dr = want - e.obj.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); e.obj.rotation.y += dr * Math.min(1, dt * 3); }
    if (e.kind !== 'pedestal' && e.kind !== 'villain') animatePerson(e.obj, 0, dt);
    if (d < best) { best = d; nearEnt = e; }
  }
  const pr = $('wprompt');
  if (nearEnt && !busy) { pr.innerHTML = `<b>E</b> / 💬 ${nearEnt.kind === 'pedestal' ? 'Examine' : nearEnt.kind === 'guardian' || nearEnt.kind === 'villain' ? 'Confront' : 'Talk to'} ${esc(nearEnt.label)}`; pr.classList.add('on'); $('wtalk').classList.add('on'); }
  else { pr.classList.remove('on'); $('wtalk').classList.remove('on'); }

  // quest arrow
  if (W.target) {
    const a = Math.atan2(W.target.x - pos.x, W.target.z - pos.z) - (cam.yaw + Math.PI);
    $('wqarrow').style.transform = `rotate(${-a}rad)`;
    $('wqarrow').dataset.d = Math.round(Math.hypot(W.target.x - pos.x, W.target.z - pos.z)) + 'm';
  }
  if (beacon) beacon.material.opacity = 0.14 + Math.sin(t * 2) * 0.06;

  // collectibles
  const w = ws();
  for (const l of letters) {
    if (!l.s.visible) continue;
    l.s.position.y = groundAt(l.x, l.z) + 1.3 + Math.sin(t * 2 + l.i) * 0.2;
    if (Math.hypot(pos.x - l.x, pos.z - l.z) < 1.3 && Math.abs(pos.y + 1 - l.s.position.y) < 2) {
      l.s.visible = false; w.letters.push(l.i);
      const A = KG.sparks[l.i];
      KG.app.sfx('combo'); burst(l.s.position, 0xffd166);
      E.gainXP(5); KG.app.speak(A.l);
      KG.app.toast(`${esc(A.icon)} <span class="gk big">${esc(A.l)}</span> <b>${esc(A.name)}</b>${A.say ? `<br><span class="small">🪝 ${esc(A.say)}</span>` : ''} <span class="muted">(${w.letters.length}/${KG.sparks.length} words)</span>`, 'gold');
      if (w.letters.length === KG.sparks.length) { KG.app.confetti(); E.checkAchievements(); }
    }
  }
  for (const sc of scrolls) {
    if (!sc.g.visible) continue;
    sc.g.rotation.y += dt * 1.5; sc.g.position.y = groundAt(sc.x, sc.z) + 1.2 + Math.sin(t * 2 + sc.x) * 0.15;
    if (Math.hypot(pos.x - sc.x, pos.z - sc.z) < 1.4) {
      sc.g.visible = false; burst(sc.g.position, 0xffe9a8);
      if (KG.reader) KG.reader.unlockScroll(sc.p.id); E.gainXP(10, 2);
    }
  }
  for (const c of coins) {
    if (!c.c.visible) continue;
    c.c.rotation.z += dt * 3;
    if (Math.hypot(pos.x - c.x, pos.z - c.z) < 1.1 && Math.abs(pos.y + 0.8 - c.c.position.y) < 1.6) {
      c.c.visible = false; w.coins.got.push(c.i); E.state.coins++; KG.app.sfx('tap'); E.questProgress('coins'); updateHUD();
    }
  }

  // wisps
  for (const wi of wisps) {
    if (wi.dead) { if ((wi.respawn -= dt) <= 0) spawnWisp(wi); continue; }
    wi.t += dt; wi.cool = Math.max(0, (wi.cool || 0) - dt);
    const o = wi.obj.position, d = Math.hypot(pos.x - o.x, pos.z - o.z);
    const safe = ents.some(e => e.kind === 'mentor' && Math.hypot(pos.x - e.x, pos.z - e.z) < 9);
    let tx, tz, sp;
    if (d < 10 && !safe && !busy && wi.cool <= 0) { tx = pos.x; tz = pos.z; sp = 3.6; }
    else { if (!wi.target || Math.hypot(wi.target.x - o.x, wi.target.z - o.z) < 1) wi.target = { x: wi.home.x + (Math.random() - 0.5) * 16, z: wi.home.z + (Math.random() - 0.5) * 16 }; tx = wi.target.x; tz = wi.target.z; sp = 1.4; }
    const dx = tx - o.x, dz = tz - o.z, dl = Math.hypot(dx, dz) || 1;
    o.x += dx / dl * sp * dt; o.z += dz / dl * sp * dt;
    o.y = groundAt(o.x, o.z) + 1.3 + Math.sin(wi.t * 3) * 0.25;
    wi.obj.rotation.y = Math.atan2(pos.x - o.x, pos.z - o.z);
    wi.obj.children[0].rotation.x += dt;
    if (d < 1.3 && !busy && wi.cool <= 0 && P.hearts > 0) startBattle(wi);
  }

  // hearts regenerate slowly
  if (P.hearts < P.maxHearts && (P.regen += dt) > 25) { P.regen = 0; P.hearts++; updateHUD(); }
  P.hurtT = Math.max(0, P.hurtT - dt);
  root.classList.toggle('hurt', P.hurtT > 0);

  // reaching the library
  if (W.libraryPos && !w.finale && Math.hypot(pos.x - W.libraryPos.x, pos.z - W.libraryPos.z) < 6 && gateOpen(NZ - 1)) {
    w.finale = true; E.save(); KG.app.confetti(250); KG.app.sfx('level');
    dialog('🏛 The Hall of Victory', `<p>The doors swing open. Every word and every use of Chapter ${KG.CHAPTERS.join(', ')} glows on the walls. <b>You are ready for the quiz.</b></p><p><span class="gk">Τετέλεσται.</span> <i>It is finished</i>, for now. Keep it fresh in Review and the Arcade, and new worlds will open as new chapters arrive.</p>`, [{ label: 'Ἀμήν', cls: 'primary' }]);
  }

  for (const b of bursts) {
    b.t -= dt; const p = b.pts.geometry.attributes.position;
    for (let i = 0; i < b.v.length; i++) { b.v[i].y -= 9 * dt; p.setXYZ(i, p.getX(i) + b.v[i].x * dt, p.getY(i) + b.v[i].y * dt, p.getZ(i) + b.v[i].z * dt); }
    p.needsUpdate = true; b.pts.material.opacity = Math.max(0, b.t);
    if (b.t <= 0) { scene.remove(b.pts); b.dead = true; }
  }
  for (let i = bursts.length - 1; i >= 0; i--) if (bursts[i].dead) bursts.splice(i, 1);
  for (const wa of W.water) {
    const g = wa.geometry.attributes.position;
    for (let i = 0; i < g.count; i++) { const x = g.getX(i), y = g.getY(i); g.setZ(i, Math.sin(x * 0.5 + t * 1.6) * 0.08 + Math.cos(y * 0.7 + t * 1.2) * 0.06); }
    g.needsUpdate = true; wa.geometry.computeVertexNormals();
  }
  updateAmbience(dt, t, pos);

  if ((saveT += dt) > 5) { saveT = 0; savePos(); }
}
function snapCamera() {
  const pos = player.position, cd = cam.dist, ch = Math.cos(cam.pitch) * cd;
  camera.position.set(pos.x + Math.sin(cam.yaw) * ch, pos.y + 1.4 + Math.sin(cam.pitch) * cd, pos.z + Math.cos(cam.yaw) * ch);
  camera.lookAt(pos.x, pos.y + 1.4, pos.z);
}
function savePos() { const w = ws(); w.x = +player.position.x.toFixed(2); w.z = +player.position.z.toFixed(2); w.yaw = +cam.yaw.toFixed(3); E.save(); }
let mode = 'world', worldShown = false, stage;
function loop() {
  if (!active) return;
  raf = requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  if (mode === 'stage') { stage.update(dt, clock.elapsedTime); stage.render(renderer); }
  else { step(dt); renderer.render(scene, camera); }
}
function startLoop() { if (!active) { active = true; clock.getDelta(); loop(); } }
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h); camera.aspect = w / h;
  // portrait phones get a wider view so the hero doesn't fill the screen
  camera.fov = w / h < 0.8 ? 74 : 60; cam.dist = Math.max(cam.dist, w / h < 0.8 ? 10 : 8.5);
  camera.updateProjectionMatrix();
  if (stage) { stage.camera.aspect = w / h; stage.resize(); }
}
addEventListener('resize', resize);

// ── public API ────────────────────────────────────────────────
let pending = [];
W.show = () => {
  if (stage) stage.exit();
  mode = 'world'; worldShown = true;
  root.classList.remove('staging');
  root.classList.add('on');
  resize();
  refreshMarkers();
  for (const sc of scrolls) sc.g.visible = !(E.state.scrolls || {})[sc.p.id];
  snapCamera();
  for (const p of pending) p(); pending = [];
  startLoop();
  const w = ws();
  if (!w.intro) {
    w.intro = true; E.save();
    dialog(`📜 Chapter ${KG.CHAPTERS.join(', ')}: The Scribe\'s Journey`, `<p>You are <b>Θεόφιλος</b> (Theophilus), an apprentice scribe with a quiz coming.</p>
      <p>The road runs through ${KG.units.length} places: ${KG.units.map(u => `${esc(u.icon)} <b>${esc(u.place)}</b>`).join(', ')}. Each mentor teaches the words and the uses from your own study apps, hooks and all.</p>
      <p>Pick up the glowing words, restore the lost sentence scrolls, banish the Shades of Forgetting, and beat each guardian. At the end of the road the Examiner waits with the whole chapter.</p>
      <p class="muted small">Start by speaking to <b>${esc(ZONES[0].mentor[1])}</b>. Follow the golden light!</p>`, [{ label: 'Begin the journey', cls: 'primary' }]);
  }
};
W.hide = () => {
  if (mode === 'world' && worldShown) savePos();
  worldShown = false; mode = 'world'; if (stage) stage.exit();
  active = false; cancelAnimationFrame(raf); root.classList.remove('on', 'staging'); closeDialog();
};
// The 3D trial stage used by every lesson, boss, review and arcade game.
W.stage = {
  get ok() { return !!stage; },
  enter(kind, unit) { if (mode === 'world' && worldShown) savePos(); closeDialog(); mode = 'stage'; root.classList.add('on', 'staging'); resize(); stage.enter(kind, unit); startLoop(); },
  ask: (q, h) => stage.ask(q, h), reveal: (ok, c, r) => stage.reveal(ok, c, r), result: ok => stage.result(ok),
  teach: item => stage.teach(item), trial: foe => stage.trial(foe), mini: (q, done) => stage.mini(q, done),
  hp: f => stage.hp(f), combo: n => stage.combo(n), celebrate: w => stage.celebrate(w), orderLine: () => stage.orderLine(), lock: () => stage.lock(),
  get active() { return mode === 'stage'; },
};
W.onLessonDone = (node, r) => {
  if (node.type === 'boss' && r.passed) pending.push(() => {
    const e = ents.find(x => x.kind === 'guardian' && x.zone === node.unit);
    KG.app.toast(`⚔ ${esc(e.label)} bows. <b>The gate opens!</b>`, 'gold');
    setTimeout(() => dialog(esc(e.label), `<p>“${esc(KG.story.guardian[node.unit])}”</p><p class="muted small">${node.unit < NZ - 1 ? `A portal now glows in the gate. Step through it to reach <b>${esc(ZONES[node.unit + 1].name)}</b>.` : 'The Hall of Victory is open. Walk on to the end of the road!'}</p>`, [{ label: 'Onward', cls: 'primary' }]), 600);
    burst(new THREE.Vector3(pathX(gateZ(node.unit)), groundAt(pathX(gateZ(node.unit)), gateZ(node.unit)) + 3, gateZ(node.unit)), 0xffd166);
  });
  if (node.type === 'reading' && r.passed && r.firstClear) pending.push(() => {
    const e = ents.find(x => x.kind === 'pedestal' && x.node.id === node.id);
    if (e) burst(new THREE.Vector3(e.x, groundAt(e.x, e.z) + 2, e.z), 0xffffff);
  });
};
W.debug = { player, camera, cam, P, ents, wisps, questTarget, teleport: (x, z) => { player.position.set(x, groundAt(x, z), z); snapCamera(); } };

// ── build ─────────────────────────────────────────────────────
(async () => {
  try { await Promise.race([document.fonts.load(`700 40px "Gentium Plus"`), new Promise(r => setTimeout(r, 2500))]); } catch (e) { /* fall back to serif */ }
  buildTerrain();
  scatterTrees();
  grass();
  skyDecor();
  scenery();
  buildEntities();
  buildVillains();
  buildCollectibles();
  buildWisps();
  const w = ws();
  player.position.set(w.x, groundAt(w.x, w.z), w.z);
  if (typeof w.yaw === 'number') cam.yaw = w.yaw;
  camera.position.set(w.x, groundAt(w.x, w.z) + 5, w.z + 8);
  setPet();
  stage = createStage({ renderer, person, golem, creep, wispMesh, ZONES, KG, animatePerson, applyLook, buildPet, animatePet });
  W.debug.stage = stage;
  W.ok = true;
  document.dispatchEvent(new Event('world-ready'));
})().catch(err => { console.error(err); document.dispatchEvent(new Event('world-failed')); });
