// The places where trials are held: a set for each world (forest clearing,
// riverbank, ruins, lake shore, mountain ledge, library hall…) and the
// creature you train against there. Used by js/stage.js.
export const THEMES = ['village', 'forest', 'meadow', 'river', 'ridge', 'ruins', 'lake', 'peak', 'library'];

export function makeSets(THREE, { LOW, golem, FX }) {
  const M = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, flatShading: true }, o));
  const sh = m => { m.castShadow = m.receiveShadow = !LOW; return m; };
  const mk = (geo, color, o) => sh(new THREE.Mesh(geo, color.isMaterial ? color : M(color, o)));
  const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
  const ad = (parent, m) => { parent.add(m); return m; };
  const box = (w, h, d, c, o) => mk(new THREE.BoxGeometry(w, h, d), c, o);
  const cyl = (rt, rb, h, c, seg = 8, o) => mk(new THREE.CylinderGeometry(rt, rb, h, seg), c, o);
  const ico = (r, c, d = 0, o) => mk(new THREE.IcosahedronGeometry(r, d), c, o);
  const cone = (r, h, c, seg = 7, o) => mk(new THREE.ConeGeometry(r, h, seg), c, o);

  // foliage shares the world's look: darker beneath, sunlit on top, swaying in the wind
  const leafMats = {};
  const leafMat = c => leafMats[c] || (leafMats[c] = FX ? FX.windify(M(c), { amp: 0.04, base: -1.4, shade: [-1.4, 1.4] }) : M(c));
  const lcone = (r, h, c) => mk(new THREE.ConeGeometry(r, h, 7), leafMat(c));
  const lico = (r, c) => mk(new THREE.IcosahedronGeometry(r, 0), leafMat(c));
  function tree(g, x, z, kind = 'round', s = 1, leaf = 0x4f8f3a) {
    const t = new THREE.Group();
    t.add(at(cyl(0.2 * s, 0.32 * s, 2 * s, 0x6a4a2a, 6), 0, s, 0));
    if (kind === 'pine') { t.add(at(lcone(1.4 * s, 3.6 * s, leaf), 0, 3.4 * s, 0)); }
    else if (kind === 'snowpine') { t.add(at(lcone(1.4 * s, 3.6 * s, 0x3a5a4a), 0, 3.4 * s, 0)); t.add(at(cone(0.75 * s, 1.3 * s, 0xf4f8fb), 0, 4.7 * s, 0)); }
    else if (kind === 'cypress') t.add(at(lcone(0.6 * s, 5 * s, 0x2f4a2a), 0, 3.6 * s, 0));
    else if (kind === 'willow') { const c = lico(1.8 * s, 0x7aa84a); c.scale.y = 0.8; t.add(at(c, 0, 3 * s, 0)); }
    else { t.add(at(lico(1.4 * s, leaf), 0, 2.9 * s, 0)); t.add(at(lico(1 * s, leaf), 0.6 * s, 3.7 * s, -0.3 * s)); }
    t.position.set(x, 0, z); g.add(t); return t;
  }
  // trees in an arc behind and beside the arena
  function grove(g, n, r0, r1, kinds, leaf, rand) {
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (1.05 + rand() * 0.9), r = r0 + rand() * (r1 - r0);
      tree(g, Math.cos(a) * r, Math.sin(a) * r - 4, kinds[Math.floor(rand() * kinds.length)], 0.8 + rand() * 0.8, leaf);
    }
  }
  function ground(g, color, r = 80) {
    const mt = M(color, { flatShading: false }); if (FX) FX.groundDetail(mt);
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 40), mt); m.rotation.x = -Math.PI / 2; m.position.y = -0.02; m.receiveShadow = !LOW; g.add(m);
    // a meadow of swaying blades around the arena, kept clear of the middle where the trial is held
    if (FX && !LOW) {
      const blade = new THREE.BufferGeometry();
      blade.setAttribute('position', new THREE.Float32BufferAttribute([-0.06, 0, 0, 0.06, 0, 0, 0, 0.55, 0], 3));
      blade.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
      blade.setAttribute('color', new THREE.Float32BufferAttribute([0.62, 0.62, 0.62, 0.62, 0.62, 0.62, 1.1, 1.1, 1.0], 3));
      const N = 2600, im = new THREE.InstancedMesh(blade, FX.windify(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, vertexColors: true }), { amp: 0.24, freq: 1.8 }), N);
      const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < N; i++) {
        const a = Math.random() * Math.PI * 2, d = 4.5 + Math.pow(Math.random(), 0.7) * 22, x = Math.cos(a) * d, z = Math.sin(a) * d - 2;
        if (z > 3 && Math.abs(x) < 7) { mx.makeScale(0, 0, 0); im.setMatrixAt(i, mx); im.setColorAt(i, c); continue; } // the hero's side stays clear
        const s0 = 0.7 + Math.random() * 0.9; q.setFromAxisAngle(up, Math.random() * 6.3);
        mx.compose(p.set(x, 0, z), q, sc.set(s0, s0 * (0.7 + Math.random() * 0.8), s0)); im.setMatrixAt(i, mx);
        im.setColorAt(i, c.setHex(color).offsetHSL(0, 0.05, (Math.random() - 0.3) * 0.14));
      }
      g.add(im);
    }
    return m;
  }
  function water(g, w, d, z, color = 0x3a9ad0, y = -0.15) {
    const c = new THREE.Color(color), mt = FX ? FX.water({ deep: c.clone().multiplyScalar(0.55).getHex(), shallow: color, sky: 0xcfe8ff }) : new THREE.MeshStandardMaterial({ color, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.88, flatShading: true });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 30, 6), mt);
    m.rotation.x = -Math.PI / 2; m.position.set(0, y, z); g.add(m); return m;
  }
  function motes(g, color, n, vy, size = 0.18, spread = [-20, 20, 0, 12, -26, 8]) {
    n = LOW ? Math.round(n * 0.4) : n;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) arr.set([spread[0] + Math.random() * (spread[1] - spread[0]), spread[2] + Math.random() * (spread[3] - spread[2]), spread[4] + Math.random() * (spread[5] - spread[4])], i * 3);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.85, depthWrite: false }));
    g.add(pts);
    return (dt, t) => {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { let y = p.getY(i) + vy * dt; if (y > spread[3]) y = spread[2]; if (y < spread[2]) y = spread[3]; p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(t + i) * 0.3 * dt); }
      p.needsUpdate = true;
    };
  }
  function brazier(g, x, z, flames) {
    g.add(at(cyl(0.5, 0.3, 1.2, 0x6a5a4a, 10, { metalness: 0.4 }), x, 0.6, z));
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 8), new THREE.MeshBasicMaterial({ color: 0xffb040 }));
    f.position.set(x, 1.7, z); g.add(f); flames.push(f);
    const l = new THREE.PointLight(0xffa040, 6, 14, 1.6); l.position.set(x, 2.4, z); g.add(l); f.userData.light = l;
  }
  function mountains(g, color, snow, n = 9, r = 70) {
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (1.1 + i / (n - 1) * 0.8), h = 26 + (i * 37 % 20), w = h * 0.8;
      g.add(at(new THREE.Mesh(new THREE.ConeGeometry(w, h, 6), M(color)), Math.cos(a) * r, h / 2 - 4, Math.sin(a) * r));
      if (snow) g.add(at(new THREE.Mesh(new THREE.ConeGeometry(w * 0.32, h * 0.32, 6), M(0xf4f8fb)), Math.cos(a) * r, h - 4 - h * 0.16, Math.sin(a) * r));
    }
  }
  // a first-century Galilean house: whitewashed stone, flat roof, outside stair
  function hillHouse(g, x, z, door) {
    const h = new THREE.Group(), wall = 0xe9e1cf, stone = 0xcfc4ac;
    h.add(at(box(6, 3.2, 5, wall), 0, 1.6, 0));
    h.add(at(box(6.3, 0.35, 5.3, stone), 0, 3.35, 0));
    h.add(at(box(1.05, 1.95, 0.14, door), -1.25, 0.98, 2.53));
    h.add(at(box(0.75, 0.6, 0.12, 0xffe2a0, { emissive: 0x5a4020 }), 1.45, 2.0, 2.53));
    for (let k = 0; k < 8; k++) { const hgt = 0.4 * (k + 1); h.add(at(box(1, hgt, 0.56, stone), 3.5, hgt / 2, 2.15 - k * 0.55)); }
    h.position.set(x, 0, z); h.rotation.y = Math.atan2(-x, 12 - z); g.add(h);
  }
  function dais(g, kind) {
    const d = new THREE.Group(); d.position.set(0, 0, -8); g.add(d);
    if (kind === 'stump') { d.add(at(cyl(2.4, 2.8, 1.1, 0x7a5a3a, 14), 0, 0.55, 0)); d.add(at(cyl(2.3, 2.3, 0.02, 0xc8a878, 14), 0, 1.11, 0)); }
    else if (kind === 'rock') { const r = mk(new THREE.CylinderGeometry(2.6, 3.2, 1.1, 9), 0x8a8378); r.position.y = 0.55; d.add(r); }
    else if (kind === 'ice') { const r = mk(new THREE.CylinderGeometry(2.6, 3.2, 1.1, 7), 0xcfe8f8, { roughness: 0.3 }); r.position.y = 0.55; d.add(r); }
    else if (kind === 'pier') { d.add(at(box(6, 0.3, 5, 0x8a6a3a), 0, 0.95, 0)); for (const x of [-2.6, 2.6]) for (const z of [-2, 2]) d.add(at(cyl(0.15, 0.15, 2.4, 0x5a3a20, 6), x, 0, z)); }
    else if (kind === 'podium') { d.add(at(box(5.4, 1.1, 4, 0x7a3a2a), 0, 0.55, 0)); d.add(at(box(5.8, 0.15, 4.4, 0xd8b060, { metalness: 0.5 }), 0, 1.12, 0)); }
    else d.add(at(cyl(2.6, 3, 1.1, 0xe0d6c0, 24), 0, 0.55, 0));
  }

  const SETS = {
    // the original floating island in the sky, kept for the arcade
    arena(g, F) {
      const top = cyl(15, 14, 1.2, 0xd9cdb0, 40); top.position.y = -0.6; g.add(top);
      const ring = mk(new THREE.TorusGeometry(9, 0.12, 6, 60), 0xe0a526, { metalness: 0.6, roughness: 0.4 }); ring.rotation.x = Math.PI / 2; ring.position.y = 0.02; g.add(ring);
      const inner = mk(new THREE.CircleGeometry(8.9, 48), 0xcbbd9c); inner.rotation.x = -Math.PI / 2; inner.position.y = 0.01; g.add(inner);
      const gr = new THREE.Mesh(new THREE.TorusGeometry(14.6, 0.7, 6, 48), M(0x6fae4f)); gr.rotation.x = Math.PI / 2; gr.position.y = -0.1; gr.scale.z = 0.4; g.add(gr);
      ad(g, at(new THREE.Mesh(new THREE.ConeGeometry(14.5, 16, 12), M(0x8a7a66)), 0, -9.2, 0)).rotation.x = Math.PI;
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (1.1 + i * 0.1) + Math.PI / 2, x = Math.cos(a) * 12.5, z = Math.sin(a) * 12.5, h = i % 3 === 1 ? 3.2 : 6;
        g.add(at(cyl(0.5, 0.6, h, 0xeee6d4, 12), x, h / 2, z)); g.add(at(box(1.4, 0.35, 1.4, 0xe0d6c0), x, h + 0.17, z));
      }
      for (const s of [-1, 1]) brazier(g, s * 7.5, -2, F.flames);
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * Math.PI * 2, r = 55 + (i % 3) * 18, isl = new THREE.Group();
        isl.add(new THREE.Mesh(new THREE.CylinderGeometry(5, 4, 1, 9), M(0x7fae5f)));
        ad(isl, at(new THREE.Mesh(new THREE.ConeGeometry(4.5, 8, 8), M(0x8a7a66)), 0, -4.5, 0)).rotation.x = Math.PI;
        isl.add(at(new THREE.Mesh(new THREE.IcosahedronGeometry(2, 0), M(0x4f8f3a)), 0, 2.4, 0));
        isl.position.set(Math.cos(a) * r, -6 + (i % 4) * 5, Math.sin(a) * r - 10); g.add(isl);
      }
      dais(g);
      F.sky = [0x1f3b6a, 0x7fb0e0, 0xe0d0b0]; F.fog = [40, 160];
    },
    village(g, F, rand) {
      ground(g, 0x6fae4f);
      hillHouse(g, -13, -17, 0x2f6a3a); hillHouse(g, 12, -20, 0xc9452b); hillHouse(g, -24, -4, 0x2f5f8f);
      grove(g, 26, 22, 45, ['round', 'round', 'pine'], 0x4f8f3a, rand);
      for (const x of [-8, 8]) { g.add(at(cyl(0.08, 0.1, 2.6, 0x3a3a3a, 6), x, 1.3, -1)); g.add(at(FX ? FX.lantern() : mk(new THREE.SphereGeometry(0.24, 8, 8), 0xffe9a8, { emissive: 0xffc04a, emissiveIntensity: 1.2 }), x, 2.7, -1)); if (FX) { const h = FX.glow(0xffc870, 1.8); h.position.set(x, 2.7, -1); g.add(h); const pl = FX.lightPool(0xffc870, 4.5); pl.position.set(x, 0.05, -1); g.add(pl); } }
      for (let i = 0; i < 6; i++) { const f = box(0.12, 1, 0.12, 0x7a5a3a); g.add(at(f, 10 + i * 1.3, 0.5, -6)); }
      g.add(at(box(7, 0.1, 0.1, 0x8a6a40), 13.2, 0.8, -6));
      dais(g, 'stump');
      F.tick.push(motes(g, 0xfff0a0, 120, 0.25, 0.12));
      F.sky = [0x4a88c8, 0xb8d8f0, 0xf0e4c8]; F.fog = [40, 150];
    },
    forest(g, F, rand) {
      ground(g, 0x3f6f35);
      grove(g, 60, 13, 50, ['pine', 'pine', 'round'], 0x2f6a2f, rand);
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) tree(g, s * (11 + k * 3), 2 - k * 5, k % 2 ? 'round' : 'pine', 1.3, 0x2f6a2f);
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; g.add(at(cyl(0.1, 0.13, 0.4, 0xf0e6d0, 6), -9 + Math.cos(a) * 1.5, 0.2, -4 + Math.sin(a) * 1.5)); g.add(at(mk(new THREE.SphereGeometry(0.28, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xc9352b), -9 + Math.cos(a) * 1.5, 0.38, -4 + Math.sin(a) * 1.5)); }
      const log = cyl(0.5, 0.55, 5, 0x6a4a2a, 8); log.rotation.set(0, 0.5, Math.PI / 2); g.add(at(log, 8, 0.45, -3));
      for (let i = 0; i < 4; i++) { const ray = new THREE.Mesh(new THREE.ConeGeometry(2.5, 26, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff8d0, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide })); ray.position.set(-12 + i * 8, 12, -14 + (i % 2) * 6); ray.rotation.z = 0.25; g.add(ray); }
      dais(g, 'stump');
      F.tick.push(motes(g, 0x8ac04a, 140, -0.6, 0.22));
      F.sky = [0x2f5a4a, 0x8fbfa4, 0xd8e8d0]; F.fog = [14, 70]; F.hemi = 1.0;
    },
    meadow(g, F, rand) {
      ground(g, 0xc8b050);
      for (let i = 0; i < (LOW ? 60 : 160); i++) { const a = Math.PI * (1 + rand()), r = 10 + rand() * 30; const c = cone(0.35, 1.4 + rand(), 0xe0c060, 5); g.add(at(c, Math.cos(a) * r, 0.6, Math.sin(a) * r - 4)); }
      const mill = new THREE.Group(); mill.position.set(-20, 0, -32); g.add(mill);
      mill.add(at(cyl(2, 3, 10, 0xe8dfcc, 10), 0, 5, 0)); mill.add(at(cone(2.6, 2.4, 0x8a4a2a, 10), 0, 11.2, 0));
      const hub = new THREE.Group(); hub.position.set(0, 9.4, 2.6); mill.add(hub);
      for (let i = 0; i < 4; i++) { const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2; arm.add(at(box(0.3, 7, 0.1, 0x6a4a2a), 0, 3.5, 0)); arm.add(at(box(1.4, 5.4, 0.05, 0xf5ecd0), 0.8, 4, 0.05)); hub.add(arm); }
      F.tick.push(dt => { hub.rotation.z += dt * 0.5; });
      for (const [x, z] of [[9, -6], [12, -10], [-10, -12], [16, -18]]) { const h = cyl(0.9, 0.9, 1.2, 0xe0c060, 12); h.rotation.z = Math.PI / 2; g.add(at(h, x, 0.9, z)); }
      grove(g, 10, 30, 50, ['round'], 0x8f8a3a, rand);
      dais(g, 'rock');
      F.tick.push(motes(g, 0xffe08a, 120, 0.15, 0.12));
      F.sky = [0x5a7ab8, 0xf0d8a0, 0xf8e8c0]; F.fog = [40, 160];
    },
    river(g, F, rand) {
      ground(g, 0x5fa060);
      const w = water(g, 160, 9, -17); F.water = w;
      const bank = new THREE.Mesh(new THREE.PlaneGeometry(160, 50), M(0x4f9050)); bank.rotation.x = -Math.PI / 2; bank.position.set(0, 0.05, -46); g.add(bank);
      ad(g, at(new THREE.Mesh(new THREE.PlaneGeometry(160, 2), M(0xd8c48a)), 0, 0.01, -12.2)).rotation.x = -Math.PI / 2;
      grove(g, 24, 26, 50, ['round', 'pine'], 0x3f8a5a, rand);
      for (let i = 0; i < 14; i++) { const x = -22 + i * 3.3 + rand(); for (let k = 0; k < 4; k++) g.add(at(cyl(0.03, 0.04, 1.4 + rand() * 0.6, 0x6a8a3a, 4), x + k * 0.2, 0.7, -12.6 + rand() * 0.6)); }
      const boat = new THREE.Group(); boat.position.set(9, -0.05, -16); g.add(boat);
      const hull = cyl(1, 0.6, 4, 0x8a4a2a, 6); hull.rotation.x = Math.PI / 2; hull.scale.set(1, 1, 0.5); boat.add(hull);
      F.tick.push((dt, t) => { boat.position.x = 9 + Math.sin(t * 0.3) * 3; boat.rotation.z = Math.sin(t * 1.3) * 0.05; });
      const wheel = new THREE.Group(); wheel.position.set(-15, 1.8, -13); g.add(wheel);
      wheel.add(mk(new THREE.TorusGeometry(2.4, 0.18, 6, 20), 0x6a4a2a)); for (let i = 0; i < 8; i++) { const sp = box(0.5, 4.8, 0.2, 0x7a5a3a); sp.rotation.z = i * Math.PI / 8; wheel.add(sp); }
      g.add(at(box(6, 4.4, 5, 0xd8c8a8), -18.5, 2.2, -10));
      F.tick.push(dt => { wheel.rotation.z -= dt * 0.8; });
      dais(g, 'rock');
      F.tick.push(motes(g, 0xd0f0ff, 80, 0.05, 0.1));
      F.sky = [0x2a78d8, 0x9ad0f8, 0xe0f0f8]; F.fog = [50, 170];
    },
    ridge(g, F, rand) {
      ground(g, 0x8a9a6a);
      mountains(g, 0x7a8a6a, false, 8, 60);
      for (const [x, z, c] of [[-13, -12, 0xc9452b], [-17, -4, 0xe0a526], [14, -14, 0x2f5f8f]]) { const t = cone(2.4, 2.8, c, 4); t.rotation.y = Math.PI / 4; g.add(at(t, x, 1.4, z)); }
      const sc = new THREE.Group(); sc.position.set(10, 0, -20); g.add(sc);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) sc.add(at(box(0.16, 8, 0.16, 0x8a6a3a), i * 2.2 - 2.2, 4, j * 2.2 - 1.1));
      for (let k = 1; k < 4; k++) sc.add(at(box(5, 0.15, 2.6, 0x9a7a4a), 0, k * 2.2, 0));
      sc.add(at(box(6, 5, 1.2, 0xc8b898), 0, 2.5, -2.2));
      const arm = new THREE.Group(); arm.position.set(-6, 11, -26); g.add(arm); g.add(at(box(0.4, 11, 0.4, 0x6a4a2a), -6, 5.5, -26));
      arm.add(at(box(9, 0.3, 0.3, 0x7a5a3a), 3, 0, 0)); arm.add(at(box(1, 0.8, 1, 0xb8b0a0), 6.5, -4, 0));
      F.tick.push((dt, t) => { arm.rotation.y = Math.sin(t * 0.3) * 0.8; });
      for (const [x, z] of [[7, -4], [-8, -6]]) for (let i = 0; i < 4; i++) g.add(at(box(1.4, 0.8, 0.9, i % 2 ? 0xc8b898 : 0xb8a888), x + (i % 2) * 1.45, 0.4 + Math.floor(i / 2) * 0.8, z));
      grove(g, 12, 28, 45, ['pine'], 0x5f7a3a, rand);
      dais(g, 'rock');
      F.tick.push(motes(g, 0xd8d0c0, 100, -0.05, 0.1));
      F.sky = [0x6a7888, 0xc0c8d0, 0xe0e0e0]; F.fog = [35, 130];
    },
    ruins(g, F, rand) {
      ground(g, 0xc8a878);
      for (let i = 0; i < 11; i++) {
        const a = Math.PI * (1.08 + i * 0.084), r = 15, x = Math.cos(a) * r, z = Math.sin(a) * r - 4, h = i % 3 === 1 ? 2 + rand() * 1.5 : 6;
        g.add(at(cyl(0.55, 0.65, h, 0xe0d6c0, 12), x, h / 2, z)); if (h > 5) g.add(at(box(1.5, 0.4, 1.5, 0xd8cfbc), x, h + 0.2, z));
      }
      const arch = new THREE.Group(); arch.position.set(0, 0, -30); g.add(arch);
      for (const s of [-1, 1]) arch.add(at(box(1.6, 9, 1.6, 0xd8cfbc), s * 5, 4.5, 0));
      arch.add(at(box(12, 1.4, 1.8, 0xd8cfbc), 0, 9.5, 0));
      for (let i = 0; i < 6; i++) { const c = cyl(0.5, 0.55, 2.5 + rand() * 2, 0xe0d6c0, 10); c.rotation.set(0, rand() * 6, Math.PI / 2); g.add(at(c, -14 + rand() * 28, 0.5, -6 - rand() * 14)); }
      const hg = new THREE.Group(); hg.position.set(-16, 0, -20); g.add(hg);
      const glass = new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.35 });
      ad(hg, at(new THREE.Mesh(new THREE.ConeGeometry(2, 3.4, 14, 1, true), glass), 0, 5.4, 0)).rotation.x = Math.PI; hg.add(at(new THREE.Mesh(new THREE.ConeGeometry(2, 3.4, 14, 1, true), glass), 0, 2.2, 0));
      hg.add(at(cone(1.7, 1.3, 0xe8c070, 10), 0, 1.2, 0)); hg.add(at(cyl(2.4, 2.6, 0.6, 0xb08a4a, 12), 0, 0.3, 0)); hg.add(at(cyl(2.4, 2.4, 0.4, 0xb08a4a, 12), 0, 7.3, 0));
      for (const s of [-1, 1]) brazier(g, s * 7.5, -2, F.flames);
      grove(g, 12, 25, 45, ['cypress'], 0x2f4a2a, rand);
      dais(g);
      F.tick.push(motes(g, 0xff9040, 140, 0.7, 0.14));
      F.sky = [0x3a2a6a, 0xf0a070, 0xf8d0a0]; F.fog = [35, 140]; F.hemi = 0.95;
    },
    lake(g, F, rand) {
      ground(g, 0x5f9f7f, 30);
      const w = water(g, 220, 140, -80, 0x4a6aa8, -0.1); w.material.metalness = 0.6; w.material.roughness = 0.05; F.water = w;
      g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 1.2, 14), M(0x5f9f7f)), 4, 0.1, -42));
      const shr = new THREE.Group(); shr.position.set(4, 0.7, -42); g.add(shr);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; shr.add(at(cyl(0.25, 0.3, 3.2, 0xf0ece0, 8), Math.cos(a) * 2.2, 1.6, Math.sin(a) * 2.2)); }
      shr.add(at(mk(new THREE.SphereGeometry(2.7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x4a9a9a, { metalness: 0.4, roughness: 0.4 }), 0, 3.2, 0));
      const orb = mk(new THREE.IcosahedronGeometry(0.6, 1), 0xcff8ff, { emissive: 0x6fe0ff, emissiveIntensity: 1.4 }); shr.add(at(orb, 0, 1.8, 0));
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) tree(g, s * (12 + k * 4), -2 - k * 4, k === 1 ? 'cypress' : 'willow', 1.1);
      const lan = [];
      for (let i = 0; i < 12; i++) { const l = mk(new THREE.OctahedronGeometry(0.25), 0xffe9a8, { emissive: 0xffc04a, emissiveIntensity: 1.5 }); l.position.set(-20 + rand() * 40, 0.3, -14 - rand() * 30); g.add(l); lan.push(l); }
      F.tick.push((dt, t) => { orb.rotation.y += dt; lan.forEach((l, i) => { l.position.y = 0.3 + Math.sin(t * 1.3 + i) * 0.12; }); });
      dais(g, 'pier');
      F.tick.push(motes(g, 0xd8ff70, 90, 0.05, 0.2));
      F.sky = [0x1a2a5a, 0x6a80b8, 0xb0c0e0]; F.fog = [40, 170]; F.hemi = 0.9;
    },
    peak(g, F, rand) {
      const top = cyl(17, 13, 3, 0xe8eef2, 16); top.position.y = -1.5; g.add(top);
      ad(g, at(new THREE.Mesh(new THREE.ConeGeometry(14, 22, 9), M(0x8a8a92)), 0, -14, 0)).rotation.x = Math.PI;
      mountains(g, 0x8a9aa8, true, 10, 75);
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) tree(g, s * (10 + k * 2.5), -3 - k * 3.5, 'snowpine', 1 + k * 0.15);
      for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.6 + rand() * 0.6), new THREE.MeshStandardMaterial({ color: 0xbfe8ff, emissive: 0x3a8ac0, emissiveIntensity: 0.5, transparent: true, opacity: 0.8, flatShading: true })); c.scale.y = 1.8; c.position.set(-12 + rand() * 24, 0.8, -10 - rand() * 4); g.add(c); }
      for (let i = 0; i < 12; i++) { const c = new THREE.Group(); for (let k = 0; k < 4; k++) c.add(at(new THREE.Mesh(new THREE.IcosahedronGeometry(2 + rand() * 2, 1), M(0xffffff)), k * 2.5 - 4, rand(), rand() * 2)); c.position.set((rand() - 0.5) * 140, -12 - rand() * 8, -70 + rand() * 80); g.add(c); }
      dais(g, 'ice');
      F.tick.push(motes(g, 0xffffff, 260, -1.2, 0.2));
      F.sky = [0x8aa0c0, 0xe0e8f0, 0xffffff]; F.fog = [40, 170]; F.hemi = 1.3;
    },
    library(g, F, rand) {
      // floor tiles
      const c = document.createElement('canvas'); c.width = c.height = 128; const k = c.getContext('2d');
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { k.fillStyle = (i + j) % 2 ? '#d8c8a0' : '#8a5a3a'; k.fillRect(i * 32, j * 32, 32, 32); }
      const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(14, 14); tex.colorSpace = THREE.SRGBColorSpace;
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = !LOW; g.add(floor);
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 16), M(0x9a2a2a)); rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.02, -1); g.add(rug);
      // book spines
      const bc = document.createElement('canvas'); bc.width = 256; bc.height = 128; const b = bc.getContext('2d');
      b.fillStyle = '#4a2a14'; b.fillRect(0, 0, 256, 128);
      for (const y of [0, 64]) for (let x = 2; x < 254;) { const w = 6 + Math.random() * 10; b.fillStyle = ['#7a2f3a', '#2f5f8f', '#3f7d5a', '#c9a43a', '#6a3a8a', '#a0522d'][Math.floor(Math.random() * 6)]; b.fillRect(x, y + 6 + Math.random() * 8, w - 1, 52); x += w; }
      const btex = new THREE.CanvasTexture(bc); btex.wrapS = THREE.RepeatWrapping; btex.repeat.set(6, 3); btex.colorSpace = THREE.SRGBColorSpace;
      const shelfM = new THREE.MeshStandardMaterial({ map: btex, roughness: 0.9 });
      const back = new THREE.Mesh(new THREE.BoxGeometry(60, 14, 1), [M(0x5a3a1a), M(0x5a3a1a), M(0x5a3a1a), M(0x5a3a1a), shelfM, M(0x5a3a1a)]); back.position.set(0, 7, -20); g.add(back);
      for (const s of [-1, 1]) {
        const side = new THREE.Mesh(new THREE.BoxGeometry(1, 14, 40), [shelfM, shelfM, M(0x5a3a1a), M(0x5a3a1a), M(0x5a3a1a), M(0x5a3a1a)]); side.position.set(s * 17, 7, 0); g.add(side);
        for (let z = 6; z > -20; z -= 7) { g.add(at(cyl(0.6, 0.7, 14, 0xe8dfcc, 12), s * 13.5, 7, z)); }
      }
      for (const x of [-9, 0, 9]) { const win = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 6), new THREE.MeshBasicMaterial({ color: 0xffd890 })); win.position.set(x, 9, -19.4); g.add(win); const arc = new THREE.Mesh(new THREE.CircleGeometry(1.7, 16, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0xffd890 })); arc.position.set(x, 12, -19.4); g.add(arc); }
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), M(0x3a2414)); ceil.rotation.x = Math.PI / 2; ceil.position.y = 14; g.add(ceil);
      for (const x of [-7, 7]) {
        const ch = new THREE.Group(); ch.position.set(x, 10, -5); g.add(ch);
        ad(ch, mk(new THREE.TorusGeometry(1.4, 0.08, 6, 20), 0xc9a43a, { metalness: 0.7 })).rotation.x = Math.PI / 2;
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ch.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 6), new THREE.MeshBasicMaterial({ color: 0xffd060 })), Math.cos(a) * 1.4, 0.25, Math.sin(a) * 1.4)); }
        const l = new THREE.PointLight(0xffc870, 10, 20, 1.5); l.position.y = -0.5; ch.add(l);
      }
      for (const x of [-9, 9]) { g.add(at(box(2.6, 1, 1.4, 0x6a3a1a), x, 0.5, 1)); g.add(at(box(1, 0.08, 0.7, 0xf5ecd0), x, 1.05, 1)); }
      dais(g, 'podium');
      F.tick.push(motes(g, 0xffd166, 110, 0.2, 0.12, [-15, 15, 0, 12, -18, 8]));
      F.sky = [0x2a1a0a, 0x3a2414, 0x2a1a0a]; F.fog = [30, 90]; F.hemi = 0.7; F.indoor = true;
    },
  };

  function build(theme, seed = 1) {
    let s = seed * 9301 + 49297; const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const g = new THREE.Group(), F = { group: g, flames: [], tick: [], hemi: 1.15 };
    SETS[theme](g, F, rand);
    return F;
  }

  // ── each world's training creature ─────────────────────────
  function beast(unit) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const u = g.userData;
    const eyes = (y, z, x = 0.25, c = 0xffd166, r = 0.12) => { for (const s of [-1, 1]) body.add(at(new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), new THREE.MeshBasicMaterial({ color: c })), s * x, y, z)); };
    u.body = body; u.hpY = 4.4;
    if (unit === 0) { // training dummy
      g.add(at(cyl(0.12, 0.15, 3, 0x6a4a2a), 0, 1.5, 0));
      body.add(at(cyl(0.55, 0.65, 1.4, 0xd8b878, 10), 0, 2.1, 0)); body.add(at(mk(new THREE.SphereGeometry(0.42, 12, 10), 0xc8a868), 0, 3.15, 0));
      const bar = cyl(0.08, 0.08, 2.4, 0x6a4a2a, 6); bar.rotation.z = Math.PI / 2; body.add(at(bar, 0, 2.5, 0));
      for (const [r, c] of [[0.42, 0xc9452b], [0.28, 0xffffff], [0.14, 0xc9452b]]) body.add(at(new THREE.Mesh(new THREE.CircleGeometry(r, 20), M(c)), 0, 2.15, 0.66 + (0.42 - r) * 0.02));
      u.tick = (dt, t) => { body.rotation.z = Math.sin(t * 2) * 0.03; };
    } else if (unit === 1) { // treant
      body.add(at(cyl(0.7, 1, 3.2, 0x6a4a2a, 8), 0, 1.6, 0));
      for (let i = 0; i < 6; i++) body.add(at(ico(1.1, 0x3d7d34), Math.cos(i) * 1.1, 3.6 + (i % 2) * 0.6, Math.sin(i) * 0.8));
      const arms = [];
      for (const s of [-1, 1]) { const a = new THREE.Group(); a.position.set(s * 0.7, 2.4, 0); const br = cyl(0.12, 0.2, 1.8, 0x6a4a2a, 6); br.position.y = 0.8; a.add(br); a.add(at(ico(0.5, 0x4a8a3a), 0, 1.8, 0)); a.rotation.z = s * -0.8; body.add(a); arms.push(a); }
      eyes(2.4, 0.78, 0.28, 0xffe066, 0.13);
      u.tick = (dt, t) => { arms.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * (-0.8 + Math.sin(t * 1.5 + i) * 0.2); }); body.rotation.z = Math.sin(t) * 0.04; };
      u.hpY = 5.4;
    } else if (unit === 2) { // scarecrow
      g.add(at(box(0.15, 3.4, 0.15, 0x6a4a2a), 0, 1.7, 0));
      body.add(at(box(2.8, 0.14, 0.14, 0x6a4a2a), 0, 2.6, 0)); body.add(at(box(1.2, 1.3, 0.6, 0x4a6aa0), 0, 2.3, 0));
      body.add(at(mk(new THREE.SphereGeometry(0.45, 10, 8), 0xe8d8a0), 0, 3.45, 0)); body.add(at(cyl(0.3, 0.75, 0.55, 0x8a6a30, 10), 0, 3.95, 0));
      eyes(3.5, 0.4, 0.15, 0x1a1208, 0.07);
      for (const s of [-1, 1]) ad(body, at(cone(0.15, 0.5, 0xe0c060, 5), s * 1.45, 2.45, 0)).rotation.z = s * Math.PI / 2;
      u.tick = (dt, t) => { body.rotation.z = Math.sin(t * 1.4) * 0.08; body.rotation.y = Math.sin(t * 0.7) * 0.2; };
      u.hpY = 5;
    } else if (unit === 3) { // riddle toad
      const b = mk(new THREE.SphereGeometry(1.5, 14, 10), 0x5a9a3a); b.scale.set(1.2, 0.8, 1); body.add(at(b, 0, 1.3, 0));
      for (const s of [-1, 1]) { body.add(at(mk(new THREE.SphereGeometry(0.42, 10, 8), 0x5a9a3a), s * 0.7, 2.3, 0.5)); body.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })), s * 0.7, 2.4, 0.78)); body.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), new THREE.MeshBasicMaterial({ color: 0x1a1208 })), s * 0.7, 2.42, 1)); ad(body, at(mk(new THREE.SphereGeometry(0.5, 8, 6), 0x4a8a2a), s * 1.4, 0.35, 0.6)).scale.y = 0.5; }
      ad(body, at(mk(new THREE.TorusGeometry(0.7, 0.06, 4, 16, Math.PI), 0x2a4a1a), 0, 1.35, 1.35)).rotation.z = Math.PI;
      u.tick = (dt, t) => { b.scale.y = 0.8 + Math.sin(t * 3) * 0.05; body.position.y = Math.max(0, Math.sin(t * 1.3)) * 0.3; };
      u.hpY = 3.8;
    } else if (unit === 4) { // clockwork builder
      const cop = { metalness: 0.7, roughness: 0.35 };
      body.add(at(box(1.6, 1.8, 1.1, 0xb87333, cop), 0, 2.1, 0)); body.add(at(box(0.9, 0.8, 0.8, 0xb87333, cop), 0, 3.45, 0));
      body.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshBasicMaterial({ color: 0x7fe0ff })), 0, 3.5, 0.42));
      const gear = new THREE.Group(); gear.position.set(0, 2.2, 0.6); body.add(gear);
      gear.add(mk(new THREE.TorusGeometry(0.45, 0.12, 6, 16), 0xe0b030, cop));
      for (let i = 0; i < 8; i++) { const t = box(0.16, 0.2, 0.12, 0xe0b030, cop); const a = i / 8 * Math.PI * 2; t.position.set(Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0); t.rotation.z = a; gear.add(t); }
      for (const s of [-1, 1]) { g.add(at(box(0.5, 1.2, 0.5, 0x8a5a2a, cop), s * 0.45, 0.6, 0)); body.add(at(box(0.4, 1.4, 0.4, 0x8a5a2a, cop), s * 1.05, 2, 0)); }
      u.tick = (dt, t) => { gear.rotation.z += dt * 2; body.position.y = Math.abs(Math.sin(t * 4)) * 0.05; };
    } else if (unit === 5) { // sand serpent
      const segs = [];
      for (let i = 0; i < 9; i++) { const s = mk(new THREE.SphereGeometry(0.55 - i * 0.03, 10, 8), i % 2 ? 0xc8a050 : 0xa88038); body.add(s); segs.push(s); }
      const head = new THREE.Group(); body.add(head);
      ad(head, mk(new THREE.SphereGeometry(0.6, 12, 10), 0xb89048)).scale.set(1, 0.8, 1.3);
      for (const s of [-1, 1]) { head.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff4020 })), s * 0.28, 0.2, 0.55)); ad(head, at(cone(0.05, 0.25, 0xffffff, 4), s * 0.15, -0.25, 0.7)).rotation.x = Math.PI; }
      u.tick = (dt, t) => { segs.forEach((s, i) => s.position.set(Math.sin(t * 2 + i * 0.7) * 0.5 * (1 - i / 12), 0.4 + (8 - i) * 0.0 + i * 0.38, Math.cos(t * 1.4 + i) * 0.2)); head.position.set(Math.sin(t * 2 + 6) * 0.3, 3.9 + Math.sin(t * 2) * 0.15, 0.3); };
      u.hpY = 5.4;
    } else if (unit === 6) { // mirror wraith
      const silver = new THREE.MeshStandardMaterial({ color: 0xc8d8f0, metalness: 0.9, roughness: 0.1, emissive: 0x3a5a9a, emissiveIntensity: 0.4, flatShading: true });
      const cloak = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3, 10, 1, true), silver); cloak.material.side = THREE.DoubleSide; body.add(at(cloak, 0, 2.2, 0));
      body.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), silver), 0, 3.9, 0));
      eyes(3.95, 0.48, 0.18, 0x9ad0ff, 0.09);
      const shards = new THREE.Group(); shards.position.y = 2.6; body.add(shards);
      for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), silver); const a = i / 6 * Math.PI * 2; s.position.set(Math.cos(a) * 1.8, Math.sin(i) * 0.4, Math.sin(a) * 1.8); s.scale.y = 1.8; shards.add(s); }
      u.tick = (dt, t) => { shards.rotation.y += dt * 1.2; body.position.y = 0.4 + Math.sin(t * 2) * 0.3; };
      u.hpY = 5.4;
    } else if (unit === 7) { // snow yeti
      const fur = 0xf0f4f8;
      const b = ico(1.2, fur, 1); b.scale.set(1, 1.15, 0.85); body.add(at(b, 0, 2, 0));
      body.add(at(ico(0.7, fur, 1), 0, 3.4, 0.1)); ad(body, at(mk(new THREE.SphereGeometry(0.42, 10, 8), 0x8a9ab0), 0, 3.3, 0.5)).scale.z = 0.5;
      eyes(3.45, 0.68, 0.16, 0x1a2a3a, 0.08);
      for (const s of [-1, 1]) { ad(body, at(cone(0.12, 0.5, 0xd8d0c0, 5), s * 0.45, 4, 0)).rotation.z = s * -0.5; g.add(at(cyl(0.3, 0.35, 1.2, fur, 7), s * 0.5, 0.6, 0)); }
      const arms = []; for (const s of [-1, 1]) { const a = new THREE.Group(); a.position.set(s * 1.1, 2.7, 0); const ar = cyl(0.28, 0.35, 1.8, fur, 7); ar.position.y = -0.9; a.add(ar); body.add(a); arms.push(a); }
      u.tick = (dt, t) => { body.position.y = Math.abs(Math.sin(t * 2.2)) * 0.15; arms.forEach((a, i) => { a.rotation.x = Math.sin(t * 2.2 + i * Math.PI) * 0.4; }); };
      u.hpY = 5;
    } else { // ink drake
      const ink = 0x1f2a5a;
      const b = mk(new THREE.SphereGeometry(1, 12, 10), ink); b.scale.set(0.9, 0.8, 1.4); body.add(at(b, 0, 2.6, 0));
      const neck = cyl(0.28, 0.4, 1.6, ink, 8); neck.rotation.x = 0.6; body.add(at(neck, 0, 3.4, 0.9));
      const head = new THREE.Group(); head.position.set(0, 4.1, 1.5); body.add(head);
      head.add(mk(new THREE.BoxGeometry(0.7, 0.55, 1), ink));
      for (const s of [-1, 1]) { head.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffd166 })), s * 0.22, 0.12, 0.45)); ad(head, at(cone(0.08, 0.4, 0xd8c8a0, 5), s * 0.2, 0.42, -0.2)).rotation.x = -0.6; }
      const wings = [];
      for (const s of [-1, 1]) { const w = new THREE.Group(); w.position.set(s * 0.6, 3, 0); const sh2 = new THREE.Shape(); sh2.moveTo(0, 0); sh2.lineTo(s * 2.4, 0.9); sh2.lineTo(s * 2, -0.5); sh2.lineTo(s * 1.1, -0.2); sh2.lineTo(0, -0.6); const wm = new THREE.Mesh(new THREE.ShapeGeometry(sh2), new THREE.MeshStandardMaterial({ color: 0x2f3f7a, side: THREE.DoubleSide, flatShading: true })); wm.rotation.x = -Math.PI / 2.4; w.add(wm); body.add(w); wings.push(w); }
      const tail = cone(0.3, 2, ink, 6); tail.rotation.x = -Math.PI / 2 - 0.4; body.add(at(tail, 0, 2.2, -1.8));
      u.tick = (dt, t) => { wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(t * 5) * 0.5; }); body.position.y = 0.5 + Math.sin(t * 2.5) * 0.3; };
      u.hpY = 5.6;
    }
    return g;
  }
  return { build, beast, golem };
}
