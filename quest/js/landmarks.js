// Landmarks of the lesson: the path up to each teacher is lined with what they are about to teach.
// A word stands there as the thing it means (a river, a dove, a camel, a temple…) or, when it has
// no shape of its own, as a big medallion of its picture on a plinth; a use from the concepts
// stands as its picture with its name. Walk past one and it tells you its word.
//
// ctx: { THREE, add(obj), groundAt(x, z), mesh(geo, color, opts), textSprite(text, opts), GREEK,
//        waterMat, toast(html), speak(greek) }
export function makeLandmarks(ctx) {
  const { THREE } = ctx;
  const list = [];
  const M = (geo, color, opts) => ctx.mesh(geo, color, opts);
  const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

  // a coin-like medallion with the picture on both faces, on a little stone plinth
  function medallion(icon) {
    const g = new THREE.Group();
    const plinth = M(new THREE.CylinderGeometry(0.35, 0.45, 0.9, 8), 0xe8dfcc); plinth.position.y = 0.45; g.add(plinth);
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#f6ecd2'; x.beginPath(); x.arc(128, 128, 124, 0, 7); x.fill();
    x.lineWidth = 10; x.strokeStyle = '#c9a24a'; x.stroke();
    x.font = '150px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(icon, 128, 140);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }), rim = new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.5, roughness: 0.35 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.12, 28), [rim, face, face]);
    disc.rotation.x = Math.PI / 2; disc.position.y = 1.75; disc.castShadow = true; g.add(disc);
    g.userData.spin = disc;
    return g;
  }

  // things with a shape of their own, found by the meaning
  const SHAPES = [
    [/\briver\b|jordan|baptism|baptize|water/, () => { const g = new THREE.Group(); const pool = new THREE.Mesh(new THREE.CircleGeometry(1.1, 20), ctx.waterMat); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.06; g.add(pool); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.add(at(M(new THREE.DodecahedronGeometry(0.22, 0), 0x8a8378), Math.cos(a) * 1.2, 0.1, Math.sin(a) * 1.2)); } return g; }],
    [/\bsun\b/, () => { const g = new THREE.Group(); g.add(at(M(new THREE.CylinderGeometry(0.06, 0.06, 2, 5), 0x6a4a2a), 0, 1, 0)); const s = M(new THREE.SphereGeometry(0.5, 16, 12), 0xffc840, { emissive: 0xffa020, emissiveIntensity: 0.9 }); s.position.y = 2.3; g.add(s); for (let i = 0; i < 8; i++) { const r = M(new THREE.ConeGeometry(0.1, 0.4, 5), 0xffd060, { emissive: 0xffa020, emissiveIntensity: 0.7 }); const a = i / 8 * Math.PI * 2; r.position.set(Math.cos(a) * 0.75, 2.3 + Math.sin(a) * 0.75, 0); r.rotation.z = a - Math.PI / 2; g.add(r); } g.userData.spin = s; return g; }],
    [/\bstar\b/, () => { const g = new THREE.Group(); g.add(at(M(new THREE.CylinderGeometry(0.06, 0.06, 2, 5), 0x6a4a2a), 0, 1, 0)); const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.25 : 0.6; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); } const s = M(new THREE.ExtrudeGeometry(sh, { depth: 0.15, bevelEnabled: false }), 0xffe070, { emissive: 0xffc030, emissiveIntensity: 0.8 }); s.position.y = 2.3; g.add(s); g.userData.spin = s; return g; }],
    [/\bdove|pigeon|bird/, () => { const g = new THREE.Group(); g.add(at(M(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 5), 0x6a4a2a), 0, 0.7, 0)); const b = new THREE.Group(); b.position.y = 1.55; g.add(b); const body = M(new THREE.SphereGeometry(0.28, 10, 8), 0xf8f8f4); body.scale.set(1.5, 1, 1); b.add(body); b.add(at(M(new THREE.SphereGeometry(0.16, 8, 6), 0xf8f8f4), 0.38, 0.18, 0)); b.add(at(M(new THREE.ConeGeometry(0.05, 0.14, 5), 0xe0a040), 0.55, 0.16, 0)).rotation.z = -Math.PI / 2; for (const s of [-1, 1]) { const w = M(new THREE.BoxGeometry(0.4, 0.04, 0.5), 0xeeeeea); w.position.set(-0.05, 0.12, s * 0.35); w.rotation.x = s * 0.5; b.add(w); } b.add(at(M(new THREE.BoxGeometry(0.3, 0.04, 0.2), 0xeeeeea), -0.5, 0.05, 0)); g.userData.bob = b; return g; }],
    [/\bcamel/, () => { const g = new THREE.Group(), c = 0xc8a060; const body = M(new THREE.SphereGeometry(0.55, 10, 8), c); body.scale.set(1.5, 0.8, 0.8); body.position.y = 1.35; g.add(body); g.add(at(M(new THREE.SphereGeometry(0.35, 8, 6), c), 0, 1.75, 0)); const neck = M(new THREE.CylinderGeometry(0.13, 0.17, 0.9, 6), c); neck.position.set(0.85, 1.75, 0); neck.rotation.z = -0.5; g.add(neck); g.add(at(M(new THREE.BoxGeometry(0.4, 0.22, 0.24), c), 1.15, 2.2, 0)); for (const [x, z] of [[0.5, 0.25], [0.5, -0.25], [-0.5, 0.25], [-0.5, -0.25]]) g.add(at(M(new THREE.CylinderGeometry(0.07, 0.06, 1.1, 5), c), x, 0.55, z)); return g; }],
    [/\blion|beast|animal/, () => { const g = new THREE.Group(), c = 0xd8a050; const body = M(new THREE.SphereGeometry(0.5, 10, 8), c); body.scale.set(1.5, 0.8, 0.8); body.position.y = 0.85; g.add(body); g.add(at(M(new THREE.SphereGeometry(0.45, 10, 8), 0x8a5a2a), 0.7, 1.15, 0)); g.add(at(M(new THREE.SphereGeometry(0.28, 8, 6), c), 0.95, 1.15, 0)); for (const [x, z] of [[0.45, 0.22], [0.45, -0.22], [-0.45, 0.22], [-0.45, -0.22]]) g.add(at(M(new THREE.CylinderGeometry(0.08, 0.07, 0.6, 5), c), x, 0.3, z)); return g; }],
    [/temple|sanctuary/, () => { const g = new THREE.Group(), s = 0xf0e8d8; g.add(at(M(new THREE.BoxGeometry(2, 0.25, 1.4), s), 0, 0.12, 0)); for (const x of [-0.8, -0.27, 0.27, 0.8]) for (const z of [-0.5, 0.5]) g.add(at(M(new THREE.CylinderGeometry(0.08, 0.09, 1.2, 8), s), x, 0.85, z)); g.add(at(M(new THREE.BoxGeometry(2.1, 0.15, 1.5), s), 0, 1.5, 0)); const roof = M(new THREE.CylinderGeometry(0.75, 0.75, 2.1, 3), 0xc9452b); roof.rotation.z = Math.PI / 2; roof.scale.set(1, 1, 0.4); roof.position.y = 1.85; g.add(roof); return g; }],
    [/\bbook|scroll|\bread\b|isaiah|covenant/, () => { const g = new THREE.Group(); g.add(at(M(new THREE.CylinderGeometry(0.08, 0.12, 1.1, 6), 0x6a4a2a), 0, 0.55, 0)); const desk = M(new THREE.BoxGeometry(0.9, 0.06, 0.6), 0x8a5a2a); desk.position.y = 1.15; desk.rotation.x = -0.4; g.add(desk); for (const s of [-1, 1]) { const p = M(new THREE.BoxGeometry(0.38, 0.03, 0.5), 0xf5ecd0); p.position.set(s * 0.2, 1.2, 0); p.rotation.set(-0.4, 0, s * -0.12); g.add(p); } return g; }],
    [/\bdoor|go out|come out/, () => { const g = new THREE.Group(), s = 0xcfc4ac; for (const x of [-0.6, 0.6]) g.add(at(M(new THREE.BoxGeometry(0.25, 2, 0.3), s), x, 1, 0)); g.add(at(M(new THREE.BoxGeometry(1.5, 0.25, 0.35), s), 0, 2.1, 0)); const d = M(new THREE.BoxGeometry(0.5, 1.85, 0.06), 0x6a4a2a); d.position.set(-0.3, 0.93, 0.25); d.rotation.y = -1; g.add(d); return g; }],
    [/\bfield|country|wild\b|harvest|grain/, () => { const g = new THREE.Group(); for (let i = 0; i < 26; i++) { const h = 0.7 + Math.random() * 0.4, st = M(new THREE.CylinderGeometry(0.02, 0.025, h, 3), 0xd8b84a); st.position.set((Math.random() - 0.5) * 1.6, h / 2, (Math.random() - 0.5) * 1.2); g.add(st); g.add(at(M(new THREE.ConeGeometry(0.05, 0.2, 4), 0xe8c860), st.position.x, h + 0.05, st.position.z)); } return g; }],
    [/honey/, () => { const g = new THREE.Group(); g.add(at(M(new THREE.CylinderGeometry(0.4, 0.5, 0.8, 8), 0xe8dfcc), 0, 0.4, 0)); g.add(at(M(new THREE.CylinderGeometry(0.3, 0.25, 0.5, 12), 0xffb020, { emissive: 0x8a5000, emissiveIntensity: 0.3 }), 0, 1.05, 0)); g.add(at(M(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 12), 0x8a5a2a), 0, 1.34, 0)); return g; }],
    [/sandal/, () => { const g = new THREE.Group(); g.add(at(M(new THREE.CylinderGeometry(0.4, 0.5, 0.8, 8), 0xe8dfcc), 0, 0.4, 0)); for (const s of [-1, 1]) { const sole = M(new THREE.BoxGeometry(0.22, 0.05, 0.6), 0x8a5a2a); sole.position.set(s * 0.15, 0.83, 0); g.add(sole); const strap = M(new THREE.TorusGeometry(0.1, 0.02, 4, 10, Math.PI), 0x6a3a1a); strap.position.set(s * 0.15, 0.85, 0.05); g.add(strap); } return g; }],
    [/desert|wilderness/, () => { const g = new THREE.Group(); const dune = M(new THREE.SphereGeometry(1.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xe0c890); dune.scale.y = 0.45; g.add(dune); g.add(at(M(new THREE.DodecahedronGeometry(0.3, 0), 0x9a8a70), 0.6, 0.35, 0.3)); return g; }],
    [/\bpath\b|\bway\b|road|go through|cross over|straight/, () => { const g = new THREE.Group(); for (let i = 0; i < 6; i++) g.add(at(M(new THREE.CylinderGeometry(0.28, 0.3, 0.08, 7), 0xb8ad98), (i % 2 ? 0.12 : -0.12), 0.04, -1.2 + i * 0.48)); return g; }],
    [/\bwind\b|spirit|breath/, () => { const g = new THREE.Group(); g.add(at(M(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 5), 0x6a4a2a), 0, 1.1, 0)); const f = M(new THREE.BoxGeometry(0.9, 0.5, 0.03), 0x7fb0e0); f.position.set(0.47, 1.9, 0); g.add(f); g.userData.flag = f; return g; }],
    [/\bfire\b|burn/, () => { const g = new THREE.Group(); for (let i = 0; i < 5; i++) { const l = M(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 5), 0x6a4a2a); l.rotation.z = Math.PI / 2; l.rotation.y = i * 1.2; l.position.y = 0.1; g.add(l); } const fl = M(new THREE.ConeGeometry(0.35, 0.9, 7), 0xff8a2a, { emissive: 0xff5a10, emissiveIntensity: 1 }); fl.position.y = 0.55; g.add(fl); g.userData.flame = fl; return g; }],
    [/prison|guard|watch/, () => { const g = new THREE.Group(); g.add(at(M(new THREE.BoxGeometry(1.2, 0.1, 1.2), 0x5a5a5a), 0, 0.05, 0)); g.add(at(M(new THREE.BoxGeometry(1.2, 0.1, 1.2), 0x5a5a5a), 0, 1.6, 0)); for (let i = 0; i < 5; i++) for (const s of [-1, 1]) g.add(at(M(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 4), 0x3a3a3a), -0.5 + i * 0.25, 0.85, s * 0.55)); return g; }],
    [/locust/, () => { const g = new THREE.Group(); g.add(at(M(new THREE.CylinderGeometry(0.4, 0.5, 0.8, 8), 0xe8dfcc), 0, 0.4, 0)); const b = M(new THREE.CapsuleGeometry(0.1, 0.5, 4, 8), 0x7a9a3a); b.rotation.z = Math.PI / 2; b.position.y = 0.95; g.add(b); for (const s of [-1, 1]) { const lg = M(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 3), 0x5a7a2a); lg.position.set(-0.15, 0.95, s * 0.12); lg.rotation.x = s * 0.9; g.add(lg); } return g; }],
    [/clothe|wear|garment|cloak|belt|leather/, () => { const g = new THREE.Group(); g.add(at(M(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 5), 0x6a4a2a), 0, 0.9, 0)); g.add(at(M(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 5), 0x6a4a2a), 0, 1.7, 0)).rotation.z = Math.PI / 2; const robe = M(new THREE.CylinderGeometry(0.25, 0.45, 1, 8, 1, true), 0x8a5a3a, { side: THREE.DoubleSide }); robe.position.y = 1.2; g.add(robe); return g; }],
  ];
  function shapeFor(text) { const s = String(text).toLowerCase(); const hit = SHAPES.find(([re]) => re.test(s)); return hit ? hit[1]() : null; }

  function stand(x, z, obj, label, say) {
    obj.position.set(x, ctx.groundAt(x, z), z); ctx.add(obj);
    const tag = ctx.textSprite(label, { size: 44, color: '#fff6d8', bg: 'rgba(40,28,10,.72)', font: `700 44px ${ctx.GREEK}`, scale: 0.0095 });
    tag.position.y = 3.5; obj.add(tag);
    list.push({ x, z, obj, say, t: -1e9 });
  }
  return {
    // a word: the thing it means if it has a shape, else its picture on a medallion
    word(x, z, w) {
      const obj = shapeFor(w.short || w.en) || medallion(w.icon || '❔');
      if (w.icon && !obj.userData.spin) { const m = medallion(w.icon); m.scale.setScalar(0.55); m.position.set(0, 1.4, 0); m.children[0].visible = false; m.userData.spin.position.y = 2.25; obj.add(m); obj.userData.spin = m.userData.spin; }
      stand(x, z, obj, w.g, () => { ctx.toast(`${w.icon || ''} <b class="gk">${w.g}</b> = ${w.short}${w.mn ? `<br><span class="muted">${w.mn}</span>` : ''}`); ctx.speak(w.g); });
    },
    // a use from the concepts: its picture, with its name
    card(x, z, c) {
      const obj = medallion(c.pic || '❔');
      stand(x, z, obj, `${c.pic || ''} ${c.short || c.name}`, () => ctx.toast(`${c.pic || ''} <b>${c.name}</b>: ${c.oneLine || c.gist || ''}${c.mnemonic ? `<br><span class="muted">${c.mnemonic}</span>` : ''}`));
    },
    list,
    update(dt, t, pos) {
      for (const m of list) {
        const dx = pos.x - m.x, dz = pos.z - m.z;
        if (Math.abs(dx) > 40 || Math.abs(dz) > 40) continue;
        const u = m.obj.userData;
        if (u.spin) u.spin.rotation.y = t * 0.8;
        if (u.bob) u.bob.position.y = 1.55 + Math.sin(t * 2 + m.x) * 0.08;
        if (u.flag) u.flag.rotation.y = Math.sin(t * 3 + m.z) * 0.4;
        if (u.flame) u.flame.scale.set(1 + Math.sin(t * 13) * 0.1, 1 + Math.sin(t * 9) * 0.15, 1);
        // walk past and it says its word, once in a while
        if (dx * dx + dz * dz < 2.6 * 2.6 && t - m.t > 25) { m.t = t; m.say(); }
      }
    },
  };
}
