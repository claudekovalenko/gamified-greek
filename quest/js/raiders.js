// Raiders of Forgetting: if you stay away from the game, raiders creep into the
// valley while you're gone: squat, tusked, club-swinging brutes, one or more
// for each missed day (Profile → Settings: none, a few, or a horde). Each one
// carries off words you haven't reviewed; beat it by answering three in a row.
// Koine Quest and Going Deeper Quest share this file unchanged.

const PER_DAY = { off: 0, some: 2, many: 4 };
export const RAIDER_CAP = 12;

// Called once the world has loaded: adds raiders for the days you missed. Returns how many arrived.
export function tallyRaiders(E, U) {
  const S = E.state, today = U.day(), R = S.raiders || (S.raiders = { count: 0, beaten: 0, checked: '' });
  if (R.checked === today) return 0;
  R.checked = today;
  const mode = (S.settings || {}).raiders || 'some';
  let n = 0;
  if (S.lastDay && PER_DAY[mode]) {
    const missed = U.diffDays(S.lastDay, today) - 1;
    if (missed > 0) n = Math.min(RAIDER_CAP - R.count, missed * PER_DAY[mode] + Math.floor(E.dueWords().length / 20));
  }
  if (mode === 'off') R.count = 0;
  if (n > 0) R.count += n;
  E.save();
  return Math.max(0, n);
}

// a raider: a squat brute with tusks, a horned helmet, a club, a torch and glowing eyes
export function raiderMesh(THREE, mesh, seed = 0) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const skin = [0x6a8a4a, 0x5a7a5a, 0x7a8a50, 0x6a7a62][seed % 4], hide = [0x5a3a24, 0x4a3a30, 0x6a4a2a][seed % 3];
  const add = (geo, c, x, y, z, o, p = body) => { const m = mesh(geo, c, o); m.position.set(x, y, z); p.add(m); return m; };
  const torso = add(new THREE.SphereGeometry(0.75, 10, 8), skin, 0, 1.45, 0); torso.scale.set(1.15, 1, 0.9);
  add(new THREE.CylinderGeometry(0.78, 0.7, 0.55, 10), hide, 0, 1.0, 0);
  add(new THREE.BoxGeometry(1.2, 0.12, 0.14), 0x3a2a1a, 0, 1.55, 0.62).rotation.z = 0.6;
  const head = new THREE.Group(); head.position.set(0, 2.25, 0.15); body.add(head);
  add(new THREE.SphereGeometry(0.42, 10, 8), skin, 0, 0, 0, undefined, head).scale.set(1.1, 0.95, 1);
  add(new THREE.BoxGeometry(0.5, 0.18, 0.3), skin, 0, -0.2, 0.25, undefined, head);
  for (const s of [-1, 1]) {
    add(new THREE.ConeGeometry(0.06, 0.24, 5), 0xf0e8d0, s * 0.17, -0.08, 0.38, undefined, head);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff5a2a })); eye.position.set(s * 0.16, 0.08, 0.36); head.add(eye);
    const ear = add(new THREE.ConeGeometry(0.1, 0.35, 4), skin, s * 0.44, 0.08, 0, undefined, head); ear.rotation.z = -s * 1.2;
  }
  // a dented iron helmet with horns
  add(new THREE.SphereGeometry(0.46, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0x6a6a72, 0, 0.08, -0.02, { metalness: 0.6, roughness: 0.5 }, head);
  for (const s of [-1, 1]) { const h = add(new THREE.ConeGeometry(0.08, 0.5, 6), 0xe8dcc0, s * 0.38, 0.35, 0, undefined, head); h.rotation.z = -s * 0.7; }
  // a tattered red war banner on its back, so you see them coming
  add(new THREE.CylinderGeometry(0.035, 0.035, 2.2, 5), 0x4a3020, 0.25, 2.2, -0.55);
  const flag = add(new THREE.BoxGeometry(0.6, 0.75, 0.03), 0xb02a20, 0.56, 2.85, -0.55);
  g.userData.flag = flag;
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.35, 0.85, 0); g.add(hip);
    add(new THREE.CylinderGeometry(0.17, 0.14, 0.75, 7), skin, 0, -0.38, 0, undefined, hip);
    add(new THREE.BoxGeometry(0.3, 0.16, 0.42), hide, 0, -0.78, 0.07, undefined, hip);
    legs.push(hip);
    const sh = new THREE.Group(); sh.position.set(s * 0.85, 1.8, 0); body.add(sh);
    add(new THREE.CylinderGeometry(0.15, 0.19, 0.9, 7), skin, 0, -0.42, 0, undefined, sh);
    add(new THREE.SphereGeometry(0.17, 7, 6), skin, 0, -0.9, 0, undefined, sh);
    arms.push(sh);
  }
  // the club, in the right hand
  const club = new THREE.Group(); club.position.set(0, -0.9, 0.1); arms[1].add(club);
  add(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 6), 0x5a3a20, 0, 0, 0.35, undefined, club).rotation.x = 1.3;
  add(new THREE.DodecahedronGeometry(0.22, 0), 0x6a4a2a, 0, 0.1, 0.8, undefined, club);
  // a burning torch in the left hand, so you see them coming at dusk
  const torch = new THREE.Group(); torch.position.set(0, -0.95, 0.15); arms[0].add(torch);
  add(new THREE.CylinderGeometry(0.05, 0.06, 0.9, 5), 0x4a3020, 0, 0.25, 0.1, undefined, torch).rotation.x = -0.5;
  const fl = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.5, 6), new THREE.MeshBasicMaterial({ color: 0xff8a2a }));
  const fl2 = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.32, 6), new THREE.MeshBasicMaterial({ color: 0xffe07a }));
  fl.position.set(0, 0.85, 0.37); fl2.position.set(0, 0.8, 0.37); torch.add(fl, fl2);
  // muddy war paint and a few iron studs on the belt
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.06, 0.2, 0.02), 0x8a2a1a, s * 0.2, 0.05, 0.4, undefined, head);
  for (let i = 0; i < 6; i++) { const a = -1.2 + i * 0.48; add(new THREE.SphereGeometry(0.05, 5, 4), 0x9a9aa2, Math.sin(a) * 0.79, 1.0, Math.cos(a) * 0.72, { metalness: 0.7, roughness: 0.4 }); }
  Object.assign(g.userData, { body, legs, arms, head, flame: [fl, fl2], phase: Math.random() * 6 });
  return g;
}

// stomping walk; a raised club when it charges
export function animateRaider(r, speed, dt, charging) {
  const u = r.userData, k = Math.min(1, speed / 3);
  u.phase += dt * (3 + speed * 2);
  const sw = Math.sin(u.phase) * 0.7 * k;
  u.legs[0].rotation.x = sw; u.legs[1].rotation.x = -sw;
  u.arms[0].rotation.x = -sw * 0.6;
  u.arms[1].rotation.x = charging ? -2.2 + Math.sin(u.phase * 2) * 0.3 : sw * 0.6;
  u.body.position.y = Math.abs(Math.sin(u.phase)) * 0.12 * k;
  u.body.rotation.z = Math.sin(u.phase) * 0.08 * k;
  u.head.rotation.y = Math.sin(u.phase * 0.3) * 0.3;
  u.flag.rotation.y = Math.sin(u.phase * 0.7) * 0.4;
  if (u.flame) for (const [i, f] of u.flame.entries()) { const k = 1 + Math.sin(u.phase * 7 + i * 2) * 0.15 + Math.sin(u.phase * 13) * 0.08; f.scale.set(k, 1 + Math.sin(u.phase * 9 + i) * 0.25, k); }
}
