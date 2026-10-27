// The land itself teaches the grammar of its region. Each region of the road is built around
// the picture its concept set uses, so walking through it is walking through the idea:
//
//   🙋 Person & Number  a roll call of statues: singular on one side of the road, plural on the other;
//                       "I" stands at your elbow, "you" turns to face you, "he / they" stand over there
//   💧 Voice            water that points out (a fountain), bends back (a stream that loops home),
//                       comes in (a waterfall poured onto someone)
//   🌦 Mood             the weather is the mood: clear sky (it is so), mist and forking paths (it might be),
//                       thunder (do it!), a rainbow over a wishing well (may it be)
//   ⏳ Tense            a walk through time: a house still to be built, one going up, a wheel that kept turning,
//                       a moment frozen, a finished house, an old ruin; each with its form of λύω carved
//                       with the pieces in colour (augment, reduplication, tense sign, ending)
//
// Each place has a carved tablet; come close and it explains itself once.
//
// ctx: { THREE, add(obj), groundAt(x, z), pathX(z), mesh(geo, color, opts), person(look), textSprite(text, opts),
//        GREEK, waterMat, free(x, z, r) → open ground?, keep(x, z, r), col(x, z, r), SPK, toast(html), speak(g) }
export function makeStructures(ctx) {
  const { THREE } = ctx;
  const sites = [], ticks = [], bands = [];
  const M = (geo, color, opts) => ctx.mesh(geo, color, opts);
  const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
  const STONE = { skin: 0xe6dfd2, robe: 0xd8d0c0, hair: 0xc8c0b0 };
  const BIG = 1.5; // everything a size bigger than life, so you see it from the road
  const COL = { aug: '#d0452b', red: '#2f6fb0', sign: '#c98a10', end: '#2f8a3a', stem: '#2a1d0c' };

  // a carved tablet: a line of Greek in coloured pieces, and a line of English under it
  function tablet(pieces, sub, w = 4.2, h = 2.2) {
    const c = document.createElement('canvas'); c.width = 768; c.height = Math.round(768 * h / w); const x = c.getContext('2d');
    x.fillStyle = '#efe6d2'; x.fillRect(0, 0, c.width, c.height);
    const gr = x.createRadialGradient(c.width / 2, c.height / 2, 40, c.width / 2, c.height / 2, c.width * 0.7); gr.addColorStop(0, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(110,90,60,.3)'); x.fillStyle = gr; x.fillRect(0, 0, c.width, c.height);
    x.strokeStyle = '#9a8460'; x.lineWidth = 10; x.strokeRect(10, 10, c.width - 20, c.height - 20);
    let size = 120; const font = s => `700 ${s}px ${ctx.GREEK}`;
    const width = () => pieces.reduce((a, [t]) => (x.font = font(size), a + x.measureText(t).width), 0);
    while (width() > c.width - 80 && size > 40) size -= 6;
    let px = (c.width - width()) / 2; const py = c.height * (sub ? 0.4 : 0.52);
    x.textBaseline = 'middle';
    for (const [t, color] of pieces) { x.font = font(size); x.fillStyle = color || COL.stem; x.fillText(t, px, py); px += x.measureText(t).width; }
    if (sub) {
      let s2 = 54; x.font = `800 ${s2}px Nunito, sans-serif`;
      while (x.measureText(sub).width > c.width - 70 && s2 > 22) { s2 -= 3; x.font = `800 ${s2}px Nunito, sans-serif`; }
      x.fillStyle = '#4a3a22'; x.textAlign = 'center'; x.fillText(sub, c.width / 2, c.height * 0.76); x.textAlign = 'left';
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }), stone = new THREE.MeshStandardMaterial({ color: 0xcfc4ac, roughness: 0.9 });
    const g = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.3), [stone, stone, stone, stone, face, stone]); slab.position.y = 0.6 + h / 2; slab.castShadow = true; g.add(slab);
    g.add(at(M(new THREE.BoxGeometry(w + 0.3, 0.6, 0.6), 0xbfb49c), 0, 0.3, 0));
    return g;
  }
  // a place by the road: something built at (x, z) facing the road, a tablet in front of it, and words for when you come close
  function site(x, z, build, tab, say, r = 4) {
    const g = new THREE.Group(); g.position.set(x, ctx.groundAt(x, z), z);
    const rx = ctx.pathX(z) - x; g.rotation.y = Math.atan2(rx, 0) || 0; // face the road
    build(g); g.scale.setScalar(BIG); ctx.add(g); r *= BIG;
    if (tab) { const tb = tablet(...tab); const tx = x + Math.sign(rx) * Math.min(Math.abs(rx) - 3.2, r * 0.9), tz = z + 2.2; tb.position.set(tx, ctx.groundAt(tx, tz), tz); tb.rotation.y = Math.atan2(rx, 3); ctx.add(tb); ctx.col(tx, tz, 1.2); }
    ctx.keep(x, z, r + 1); ctx.col(x, z, Math.max(0.8, r * 0.45));
    sites.push({ x, z, say, said: false, g });
    return g;
  }
  // somewhere open beside the road near z: tries both sides and a few distances
  function spot(z, side, offs = [9, 11, 13, 7.5, 15], r = 3.5) {
    for (const dz of [0, -4, 4, -8, 8]) for (const off of offs) for (const sd of [side, -side]) {
      const zz = z + dz, x = ctx.pathX(zz) + sd * off * 1.25;
      if (ctx.free(x, zz, r * BIG * 0.9)) return { x, z: zz, side: sd };
    }
    return null;
  }
  const statue = (pose, scale = 1.3) => {
    const p = ctx.person(STONE); p.scale.setScalar(scale);
    const [L, R] = p.userData.arms; pose(L, R, p); p.userData.statue = true;
    p.position.y = 0.5; return p;
  };
  const POSE = {
    self: (L, R) => { R.rotation.x = -1.0; R.rotation.z = 0.9; L.rotation.x = -1.0; L.rotation.z = -0.9; }, // hands on the chest: me
    point: (L, R) => { R.rotation.x = -1.55; }, // pointing straight ahead: you
    aside: (L, R) => { R.rotation.x = -1.3; R.rotation.z = -0.6; }, // pointing away: him over there
    throw: (L, R) => { R.rotation.x = -2.6; L.rotation.x = -0.6; },
    wash: (L, R) => { R.rotation.x = -2.8; R.rotation.z = 0.4; L.rotation.x = -2.8; L.rotation.z = -0.4; },
    receive: (L, R) => { R.rotation.x = -0.5; R.rotation.z = -0.5; L.rotation.x = -0.5; L.rotation.z = 0.5; },
    work: (L, R) => { R.rotation.x = -2.2; },
  };
  const plinth = (g, x, z, w = 1.5) => g.add(at(M(new THREE.BoxGeometry(w, 0.5, w), 0xcfc4ac), x, 0.25, z));

  // ── 🙋 person & number: the roll call ───────────────────────
  function person(z0, z1) {
    const len = z0 - z1, rows = [
      ['1', 'ἐγώ', 'ω', 'I loose', 'ἡμεῖς', 'ομεν', 'we loose', 'self'],
      ['2', 'σύ', 'εις', 'you loose', 'ὑμεῖς', 'ετε', 'you all loose', 'point'],
      ['3', 'αὐτός', 'ει', 'he / she / it looses', 'αὐτοί', 'ουσι(ν)', 'they loose', 'aside'],
    ];
    rows.forEach(([n, sg, esg, tsg, pl, epl, tpl, pose], k) => {
      const z = z0 - len * (0.18 + k * 0.3);
      // singular on the left of the road as you walk, plural on the right; the further the person, the further from the road
      for (const [side, pron, end, tr, many] of [[-1, sg, esg, tsg, 1], [1, pl, epl, tpl, 3]]) {
        const off = pose === 'self' ? 5.5 : pose === 'point' ? 8 : 14, sp = spot(z, side, [off, off + 2, off - 1.5, off + 4], 3.2);
        if (!sp) continue;
        site(sp.x, sp.z, g => {
          for (let i = 0; i < many; i++) {
            const s = statue(POSE[pose]); const dx = many > 1 ? (i - 1) * 1.6 : 0;
            plinth(g, dx, 0, 1.4); s.position.set(dx, 0.5, i === 1 ? -0.5 : 0); g.add(s);
            if (pose === 'point') g.userData.trackers = (g.userData.trackers || []).concat(s);
            if (pose === 'aside') s.rotation.y = side * 1.1;
          }
        }, [[[pron + ' · ', COL.stem], ['λύ', COL.stem], [end, COL.end]], `${n}${n === '1' ? 'st' : n === '2' ? 'nd' : 'rd'} person ${many > 1 ? 'plural' : 'singular'}: ${tr}`],
        `${many > 1 ? '👥' : '🙋'} <b>${n}${n === '1' ? 'st' : n === '2' ? 'nd' : 'rd'} person ${many > 1 ? 'plural' : 'singular'}</b>: <span class="gk">${pron}</span>, λύ<b>${end}</b>, ${tr}. ${pose === 'self' ? 'Right beside you: the one speaking.' : pose === 'point' ? 'Facing you: the one spoken to. It follows you with its eyes!' : 'Over there: the one spoken about.'} ${many > 1 ? 'Plurals stand on the right of the road, in a crowd.' : 'Singulars stand on the left, alone.'}`, 3);
      }
    });
    // the statues of "you" turn to face you
    ticks.push((dt, t, pos) => { for (const s of sites) for (const st of s.g.userData.trackers || []) { if (Math.abs(s.z - pos.z) > 40) continue; const wp = st.getWorldPosition(new THREE.Vector3()); const want = Math.atan2(pos.x - wp.x, pos.z - wp.z) - s.g.rotation.y; st.rotation.y += Math.atan2(Math.sin(want - st.rotation.y), Math.cos(want - st.rotation.y)) * Math.min(1, dt * 3); } });
  }

  // ── 💧 voice: water that points out, bends back, comes in ───
  function voice(z0, z1) {
    const len = z0 - z1, water = ctx.waterMat, spray = [];
    const jet = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.7, emissive: 0x3a7ab0, emissiveIntensity: 0.4, roughness: 0.2 });
    const builds = {
      active: g => {
        // a spring on a rock throws its water outward in every direction
        g.add(at(M(new THREE.DodecahedronGeometry(1.2, 0), 0x8a8378), 0, 0.6, 0));
        const pool = new THREE.Mesh(new THREE.CircleGeometry(3.6, 28), water); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.05; g.add(pool);
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * Math.PI * 2, end = new THREE.Vector3(Math.cos(a) * 3.2, 0.1, Math.sin(a) * 3.2);
          const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 1.4, 0), new THREE.Vector3(Math.cos(a) * 1.7, 3.2, Math.sin(a) * 1.7), end);
          g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.07, 5), jet)); spray.push({ g, p: end });
        }
        const s = statue(POSE.throw, 1.1); s.position.set(0, 1.1, 0); g.add(s);
      },
      middle: g => {
        // a stream leaves its spring, runs round in a ring and comes home to it
        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.45, 6, 40), water); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.scale.z = 0.25; g.add(ring);
        const bank = M(new THREE.TorusGeometry(2.6, 0.62, 6, 40), 0x8a6a4a); bank.rotation.x = -Math.PI / 2; bank.position.y = -0.02; bank.scale.z = 0.12; g.add(bank);
        g.add(at(M(new THREE.CylinderGeometry(0.5, 0.7, 0.8, 8), 0x8a8378), 2.6, 0.4, 0));
        // little leaves float round and round the ring
        const leaves = []; for (let i = 0; i < 6; i++) { const l = M(new THREE.CircleGeometry(0.16, 5), 0x4f9a45); l.rotation.x = -Math.PI / 2; g.add(l); leaves.push(l); }
        g.userData.leaves = leaves;
        const s = statue(POSE.wash, 1.1); plinth(g, 0, 0, 1.2); s.position.set(0, 0.5, 0); g.add(s);
      },
      passive: g => {
        // a cliff pours its water down onto someone standing in the pool below
        g.add(at(M(new THREE.BoxGeometry(4, 5.5, 2), 0x7a7268), 0, 2.75, -2.2));
        const fall = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 5.3), jet); fall.position.set(0, 2.65, -1.15); g.add(fall); g.userData.fall = fall;
        const pool = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), water); pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.05, 0); g.add(pool);
        const s = statue(POSE.receive, 1.1); s.position.set(0, 0.1, -0.6); g.add(s);
        spray.push({ g, p: new THREE.Vector3(0, 0.3, -0.9), down: true });
      },
    };
    const kinds = [
      ['active', [['λύ', COL.stem], ['ω', COL.end]], 'Active: it points out. I loose (something).', '💪 <b>Active: it points out.</b> The spring throws its water away from itself: the subject does the action to something else. λύ<b>ω</b>, I loose.'],
      ['middle', [['λύ', COL.stem], ['ομαι', COL.end]], 'Middle: it bends back. I loose (for myself).', '🪃 <b>Middle: it bends back.</b> The stream leaves its spring and comes home to it: the action comes back to the subject. λύ<b>ομαι</b>, I loose for myself.'],
      ['passive', [['λύ', COL.stem], ['ομαι', COL.end], ['  ἐ', COL.aug], ['λύ', COL.stem], ['θη', COL.sign], ['ν', COL.end]], 'Passive: it comes in. I am loosed.', '📥 <b>Passive: it comes in.</b> The water pours down on the one standing in the pool: the subject receives the action. λύ<b>ομαι</b>, I am loosed (aorist ἐλύ<b>θη</b>ν).'],
    ];
    kinds.concat(kinds).forEach(([k, pieces, sub, say], i) => {
      const sp = spot(z0 - len * (0.1 + i * 0.15), i % 2 ? 1 : -1, [11, 13, 15, 9.5], 4.2);
      if (sp) site(sp.x, sp.z, builds[k], i < 3 ? [pieces, sub] : null, say, 4.2);
    });
    ticks.push((dt, t, pos) => {
      for (const s of sites) {
        if (Math.abs(s.z - pos.z) > 50) continue;
        const u = s.g.userData;
        if (u.leaves) u.leaves.forEach((l, i) => { const a = t * 0.6 + i * Math.PI / 3; l.position.set(Math.cos(a) * 2.6, 0.09, Math.sin(a) * 2.6); });
        if (u.fall) u.fall.material.opacity = 0.6 + Math.sin(t * 9) * 0.08;
      }
      if (Math.random() < dt * 8) for (const sp of spray) { const wp = sp.g.localToWorld(sp.p.clone()); if (Math.abs(wp.z - pos.z) < 40) ctx.SPK.emit(wp, { color: 0xcfeaff, n: 2, speed: sp.down ? 1.5 : 0.8, up: 0.6, gravity: -6, size: 0.25, life: 0.5 }); }
    });
  }

  // ── 🌦 mood: the weather is the mood ────────────────────────
  // world moods (js/venues.js MOODS): 0 clear day, 3 misty dawn, 4 storm
  function mood(z0, z1) {
    const len = z0 - z1, B = [
      ['indicative', 0, '☀️', [['ἐ', COL.aug], ['λυ', COL.stem], ['σε', COL.end], ['ν', COL.end]], 'Indicative: clear sky. It is so.', '☀️ <b>Indicative: clear sky.</b> The road is straight and you can see far: this is how things are. ἔλυσεν, he loosed.'],
      ['subjunctive', 3, '🌫️', [['ἐὰν ', COL.sign], ['λύ', COL.stem], ['ῃ', COL.end]], 'Subjunctive: mist. It might be.', '🌫️ <b>Subjunctive: mist.</b> The paths fork into the fog: it might be, if… (ἐάν, ἵνα). The long vowel of the ending is the sign: λύ<b>ῃ</b>, he might loose.'],
      ['imperative', 4, '⛈️', [['λῦ', COL.stem], ['ε', COL.end], ['!', COL.aug]], 'Imperative: thunder. Do it!', '⛈️ <b>Imperative: thunder.</b> A command cracks across the sky: λῦ<b>ε</b>! Loose it!'],
      ['optative', 0, '🌈', [['λύ', COL.stem], ['οι', COL.sign], ['', COL.end], ['  εἴη', COL.end]], 'Optative: a rainbow. May it be!', '🌈 <b>Optative: a rainbow.</b> A wish over the well: may it be (εἴη). Its sign is οι: λύ<b>οι</b>μι, may I loose.'],
    ];
    B.forEach(([k, m, icon, pieces, sub, say], i) => {
      const za = z0 - len * i / 4, zb = z0 - len * (i + 1) / 4;
      bands.push({ za, zb, mood: m, k });
      // a gateway across the road where each weather begins
      const gz = za - 4, gx = ctx.pathX(gz), g = new THREE.Group(); g.position.set(gx, ctx.groundAt(gx, gz), gz);
      g.rotation.y = Math.atan2(ctx.pathX(gz - 1) - gx, -1) + Math.PI;
      for (const s of [-1, 1]) { g.add(at(M(new THREE.BoxGeometry(0.7, 5, 0.7), 0xd8cfbc), s * 4.2, 2.5, 0)); ctx.col(gx + s * 4.2 * Math.cos(g.rotation.y), gz - s * 4.2 * Math.sin(g.rotation.y), 0.5); }
      g.add(at(M(new THREE.BoxGeometry(9.4, 0.6, 0.8), 0xd8cfbc), 0, 5.2, 0));
      const tag = ctx.textSprite(`${icon} ${k[0].toUpperCase() + k.slice(1)}`, { size: 56, color: '#fff6d8', bg: 'rgba(40,28,10,.75)', scale: 0.016 }); tag.position.y = 6.4; g.add(tag);
      ctx.add(g); ctx.keep(gx, gz, 4.5);
      const sp = spot(za - len / 8, i % 2 ? 1 : -1, [8, 10, 12], 3.5);
      if (!sp) return;
      site(sp.x, sp.z, g2 => {
        if (k === 'indicative') { // a sundial: plain fact, the hour as it is
          g2.add(at(M(new THREE.CylinderGeometry(1.2, 1.4, 0.8, 16), 0xd8cfbc), 0, 0.4, 0));
          const gn = M(new THREE.BoxGeometry(0.08, 1, 1), 0x6a5a4a); gn.position.set(0, 1.1, 0); gn.rotation.x = 0.6; g2.add(gn);
        } else if (k === 'subjunctive') { // forking paths into the mist, each with a signpost: maybe this way, maybe that
          for (const a of [-0.5, 0.5]) for (let j = 1; j < 6; j++) g2.add(at(M(new THREE.CylinderGeometry(0.3, 0.32, 0.08, 7), 0xb8ad98), Math.sin(a) * j * 1.3, 0.04, -Math.cos(a) * j * 1.3));
          const post = M(new THREE.CylinderGeometry(0.08, 0.1, 2, 6), 0x6a4a2a); post.position.y = 1; g2.add(post);
          for (const [a, t] of [[-0.6, 'ἐάν…'], [0.6, 'ἵνα…']]) { const s = ctx.textSprite(t, { size: 40, color: '#2a1a08', bg: 'rgba(240,225,190,.95)', font: `700 40px ${ctx.GREEK}`, scale: 0.012 }); s.position.set(Math.sin(a) * 0.9, 1.8, -0.2); g2.add(s); }
        } else if (k === 'imperative') { // banners of command whipping in the wind
          for (const x of [-1.6, 1.6]) { g2.add(at(M(new THREE.CylinderGeometry(0.07, 0.07, 4, 6), 0x5a4a3a), x, 2, 0)); const f = M(new THREE.BoxGeometry(1.4, 0.9, 0.03), 0xc9452b); f.position.set(x + 0.72, 3.4, 0); g2.add(f); (g2.userData.flags = g2.userData.flags || []).push(f); }
          const s = statue(POSE.point, 1.2); plinth(g2, 0, 0); s.position.y = 0.5; g2.add(s);
        } else { // a wishing well
          g2.add(at(M(new THREE.CylinderGeometry(1.1, 1.1, 1, 16, 1, true), 0xb8ad98, { side: THREE.DoubleSide }), 0, 0.5, 0));
          const w = new THREE.Mesh(new THREE.CircleGeometry(1.05, 16), ctx.waterMat); w.rotation.x = -Math.PI / 2; w.position.y = 0.3; g2.add(w);
          for (const x of [-1, 1]) g2.add(at(M(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6), 0x6a4a2a), x, 1.6, 0));
          const roof = M(new THREE.CylinderGeometry(0.01, 1.5, 0.8, 4), 0x8a3a2a); roof.position.y = 2.7; roof.rotation.y = Math.PI / 4; g2.add(roof);
          g2.userData.bow = true;
        }
      }, [pieces, sub], say, 3.2);
    });
    ticks.push((dt, t) => { for (const s of sites) for (const f of s.g.userData.flags || []) f.rotation.y = Math.sin(t * 6 + f.position.x) * 0.35; });
  }

  // ── ⏳ tense: a walk through time ────────────────────────────
  function tense(z0, z1) {
    const len = z0 - z1, ghost = new THREE.MeshStandardMaterial({ color: 0xbfd8ff, transparent: true, opacity: 0.28, emissive: 0x6a8ac0, emissiveIntensity: 0.4, depthWrite: false });
    const house = (g, o = {}) => {
      const wall = o.mat || M(new THREE.BoxGeometry(1, 1, 1), 0xe9e1cf).material;
      const body = new THREE.Mesh(new THREE.BoxGeometry(4, o.h ?? 2.6, 3.4), wall); body.position.y = (o.h ?? 2.6) / 2; body.castShadow = !o.mat; g.add(body);
      if (o.roof !== false) { const r = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.3, 3.7), o.mat || M(new THREE.BoxGeometry(1, 1, 1), 0xcfc4ac).material); r.position.y = (o.h ?? 2.6) + 0.15; g.add(r); }
      if (!o.mat) g.add(at(M(new THREE.BoxGeometry(0.9, 1.6, 0.1), 0x6a4a2a), -0.8, 0.8, 1.72));
      return body;
    };
    const T = [
      ['present', '🎬', [['λύ', COL.stem], ['ω', COL.end]], 'Present: I am loosing.', '🎬 <b>Present: happening now.</b> The house is going up as you watch. λύ<b>ω</b>, I am loosing.', g => {
        house(g, { h: 1.4, roof: false });
        for (const x of [-2.2, 2.2]) g.add(at(M(new THREE.CylinderGeometry(0.06, 0.06, 4, 5), 0x8a6a4a), x, 2, 1.9));
        g.add(at(M(new THREE.BoxGeometry(4.6, 0.08, 0.08), 0x8a6a4a), 0, 3.9, 1.9));
        const block = M(new THREE.BoxGeometry(0.7, 0.4, 0.5), 0xe9e1cf); g.add(block); g.userData.lift = block;
        const s = statue(POSE.work, 1); s.position.set(2.6, 0, 1.4); s.rotation.y = -0.8; g.add(s); g.userData.worker = s;
      }],
      ['future', '🔮', [['λύ', COL.stem], ['σ', COL.sign], ['ω', COL.end]], 'Future: I will loose. Its sign is σ.', '🔮 <b>Future: not yet.</b> Only the ghost of a house, waiting to be built. The σ is the sign of what is to come: λύ<b>σ</b>ω, I will loose.', g => {
        house(g, { mat: ghost }); g.add(at(M(new THREE.BoxGeometry(4.2, 0.12, 3.6), 0xb8ad98), 0, 0.06, 0));
      }],
      ['imperfect', '🎞️', [['ἔ', COL.aug], ['λυ', COL.stem], ['ον', COL.end]], 'Imperfect: I was loosing. ἐ- points to the past.', '🎞️ <b>Imperfect: was going on, back then.</b> The old mill wheel kept turning and turning. The ἐ in front (the augment) means the past: <b>ἔ</b>λυον, I was loosing.', g => {
        house(g, { h: 2.4 });
        const wheel = new THREE.Group(); wheel.position.set(2.3, 1.6, 0); g.add(wheel);
        const rim = M(new THREE.TorusGeometry(1.4, 0.1, 6, 20), 0x6a4a2a); rim.rotation.y = Math.PI / 2; wheel.add(rim);
        for (let i = 0; i < 8; i++) { const sp = M(new THREE.BoxGeometry(0.08, 2.8, 0.3), 0x7a5a3a); sp.rotation.x = i * Math.PI / 8; wheel.add(sp); }
        g.userData.wheel = wheel;
      }],
      ['aorist', '📸', [['ἔ', COL.aug], ['λυ', COL.stem], ['σ', COL.sign], ['α', COL.end]], 'Aorist: I loosed. One snapshot, done.', '📸 <b>Aorist: one snapshot.</b> A splash caught in the air, frozen, the whole event at a glance. Past (ἐ) and σα: <b>ἔ</b>λυ<b>σ</b>α, I loosed.', g => {
        const s = statue(POSE.throw, 1.2); plinth(g, 0, 0); s.position.y = 0.5; g.add(s);
        for (let i = 0; i < 9; i++) { const d = M(new THREE.SphereGeometry(0.12 + (i % 3) * 0.05, 6, 5), 0x9fd8ff, { transparent: true, opacity: 0.8 }); d.position.set(0.8 + i * 0.25, 3.2 + Math.sin(i) * 0.4 - i * 0.12, 0.6 + (i % 2) * 0.3); g.add(d); }
      }],
      ['perfect', '🧱', [['λέ', COL.red], ['λυ', COL.stem], ['κ', COL.sign], ['α', COL.end]], 'Perfect: I have loosed. Done, and it still stands.', '🧱 <b>Perfect: done, and it still stands.</b> The finished house is lived in now: smoke from the chimney. The doubled λε (reduplication) and the κ: <b>λέ</b>λυ<b>κ</b>α, I have loosed.', g => {
        house(g); g.add(at(M(new THREE.BoxGeometry(0.5, 1.2, 0.5), 0xcfc4ac), 1.3, 3.2, -0.8)); g.userData.smoke = new THREE.Vector3(1.3, 4, -0.8);
      }],
      ['pluperfect', '🕰️', [['ἐ', COL.aug], ['λε', COL.red], ['λύ', COL.stem], ['κ', COL.sign], ['ειν', COL.end]], 'Pluperfect: I had loosed. Done long ago.', '🕰️ <b>Pluperfect: done before then.</b> A house finished long ago, now an old ruin. Augment and reduplication together: <b>ἐλε</b>λύ<b>κ</b>ειν, I had loosed.', g => {
        for (const [x, z, h] of [[-1.8, -1.5, 2], [1.8, -1.5, 1.2], [-1.8, 1.5, 0.8]]) g.add(at(M(new THREE.BoxGeometry(0.5, h, 0.5), 0xcfc4ac), x, h / 2, z));
        g.add(at(M(new THREE.BoxGeometry(4, 0.6, 0.4), 0xd8cfbc), 0, 0.3, -1.6));
        for (let i = 0; i < 4; i++) { const r = M(new THREE.DodecahedronGeometry(0.3, 0), 0xcfc4ac); r.position.set(-1 + i * 0.7, 0.2, 0.5 + (i % 2) * 0.6); g.add(r); }
        for (let i = 0; i < 6; i++) g.add(at(M(new THREE.ConeGeometry(0.2, 0.7, 5), 0x4f8a3a), -1.5 + i * 0.6, 0.35, -1.1));
      }],
    ];
    T.forEach(([k, icon, pieces, sub, say, build], i) => {
      const sp = spot(z0 - len * (0.08 + i * 0.15), i % 2 ? 1 : -1, [10, 12, 14, 8.5], 3.8);
      if (sp) site(sp.x, sp.z, build, [pieces, sub], say, 3.8);
    });
    ticks.push((dt, t, pos) => {
      for (const s of sites) {
        if (Math.abs(s.z - pos.z) > 50) continue;
        const u = s.g.userData;
        if (u.wheel) u.wheel.rotation.x += dt * 0.8;
        if (u.lift) { const k = (t * 0.25) % 1; u.lift.position.set(0, 1.5 + Math.sin(k * Math.PI) * 2, 1.9); }
        if (u.worker) u.worker.userData.arms[1].rotation.x = -2.2 + Math.sin(t * 6) * 0.6;
        if (u.smoke && Math.random() < dt * 3) ctx.SPK.emit(s.g.localToWorld(u.smoke.clone()), { color: 0xd8d4d0, n: 1, speed: 0.2, up: 1, gravity: 0.5, drag: 0.6, size: 0.5, size1: 1.6, life: 2.5 });
      }
    });
  }

  return {
    person, voice, mood, tense,
    // the weather of the mood region, where you stand: a world mood index, or null outside it
    moodAt: pos => { const b = bands.find(b => pos.z <= b.za && pos.z > b.zb); return b ? b : null; },
    update(dt, t, pos) {
      for (const s of sites) if (!s.said && s.say && Math.hypot(pos.x - s.x, pos.z - s.z) < 7) { s.said = true; ctx.toast(s.say); }
      for (const f of ticks) f(dt, t, pos);
    },
    sites,
  };
}
