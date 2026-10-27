// Things to do on the road itself, between one teacher and the next, so the walk is
// never just a walk:
//
//   🌊 Ford       a stream runs across the road; jump from stone to stone to keep dry
//   🪨 Rockfall   boulders roll across the road in three lanes; time your dash (or jump)
//   🏛 Pillars    old columns stand in a stair beside the road; climb them for the coins on top
//
// Each pays a few coins the first time you clear it each day. Coins on the way come back daily too.
//
// ctx: {
//   THREE, add(obj), groundAt(x, z), mesh(geo, color, opts), plat(x, z, r, h), col(x, z, r), keep(x, z, r),
//   waterMat, player, P (vel, onGround), sfx(kind), toast(html, cls), gain(xp, coins), shake(s), SPK,
//   state() → this day's record { day, done: [], coins: [] } (saved by the host)
// }
export function makeRoadPlay(ctx) {
  const { THREE } = ctx;
  const list = [];
  const coinGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.07, 14);
  const coinMat = new THREE.MeshStandardMaterial({ color: 0xffd166, metalness: 0.35, roughness: 0.3, emissive: 0xc08a10, emissiveIntensity: 0.6 });

  // a frame along the road: u across it, v along it (v grows back towards where you came from)
  function frame(x, z, fx, fz) {
    const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
    const rx = -fz, rz = fx;
    return {
      x, z, yaw: Math.atan2(-rz, rx),
      w: (u, v) => ({ x: x + rx * u - fx * v, z: z + rz * u - fz * v }),
      l: (px, pz) => { const dx = px - x, dz = pz - z; return { u: dx * rx + dz * rz, v: -(dx * fx + dz * fz) }; },
    };
  }
  function coin(ch, k, x, y, z) {
    const id = `${ch.id}_${k}`, c = new THREE.Mesh(coinGeo, coinMat);
    c.rotation.x = Math.PI / 2; c.position.set(x, y, z); c.castShadow = true; ctx.add(c);
    c.visible = !ctx.state().coins.includes(id);
    ch.coins.push({ id, c });
  }
  function pickCoins(ch, pos) {
    for (const k of ch.coins) {
      if (!k.c.visible) continue;
      if (Math.hypot(pos.x - k.c.position.x, pos.z - k.c.position.z) < 1.1 && Math.abs(pos.y + 0.9 - k.c.position.y) < 1.4) {
        k.c.visible = false; ctx.state().coins.push(k.id); ctx.gain(1, 1); ctx.sfx('coin');
        ctx.SPK.emit(k.c.position, { color: 0xffd166, n: 14, speed: 2, up: 0.6, gravity: -3, size: 0.3, life: 0.6 });
      }
    }
  }
  function clear(ch, text, coins) {
    const S = ctx.state();
    if (S.done.includes(ch.id)) { ctx.toast(text); return; }
    S.done.push(ch.id); ctx.gain(10, coins); ctx.sfx('coin');
    ctx.toast(`${text} <b>+${coins} 🪙</b>`, 'gold');
  }
  // which end of a crossing you are at, and whether you got from one end to the other cleanly
  function crossing(ch, l, half, onWin) {
    const side = l.v > half ? 1 : l.v < -half ? -1 : 0, across = Math.abs(l.u) < ch.width;
    if (!across) { ch.from = 0; return side; }
    if (side && ch.from && side !== ch.from && ch.clean) onWin();
    if (side) { if (side !== ch.from) ch.clean = true; ch.from = side; }
    return side;
  }

  // ── 🌊 the ford ────────────────────────────────────────────
  function ford(o) {
    const F = frame(o.x, o.z, o.fx, o.fz), y0 = ctx.groundAt(o.x, o.z), wy = y0 + 0.2, half = 2.6, width = 7;
    const ch = { id: o.id, type: 'ford', F, x: o.x, z: o.z, coins: [], width, from: 0, clean: true, wy };
    const g = new THREE.Group(); g.position.set(o.x, 0, o.z); g.rotation.y = F.yaw; ctx.add(g);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(width * 2 + 2, half * 2), ctx.waterMat); water.rotation.x = -Math.PI / 2; water.position.y = wy; g.add(water);
    const bed = ctx.mesh(new THREE.PlaneGeometry(width * 2 + 2, half * 2), 0x5a6a5a); bed.rotation.x = -Math.PI / 2; bed.position.y = y0 + 0.02; bed.receiveShadow = true; g.add(bed);
    // muddy banks, reeds, and big rocks at the ends of the stream
    for (const s of [-1, 1]) { const bank = ctx.mesh(new THREE.BoxGeometry(width * 2 + 2, 0.12, 0.5), 0x8a6a4a); bank.position.set(0, y0 + 0.08, s * (half + 0.2)); g.add(bank); }
    for (let i = 0; i < 18; i++) { const r = ctx.mesh(new THREE.CylinderGeometry(0.04, 0.05, 1 + Math.random() * 0.8, 4), 0x7a8a3a); r.position.set((Math.random() - 0.5) * width * 2, wy + 0.4, (Math.random() < 0.5 ? -1 : 1) * (half - 0.2 + Math.random() * 0.4)); r.rotation.z = (Math.random() - 0.5) * 0.4; g.add(r); }
    for (const s of [-1, 1]) for (const k of [0, 1]) {
      const p = F.w(s * (width + 0.6 + k * 1.6), (k ? -1 : 1) * 0.8), rk = ctx.mesh(new THREE.DodecahedronGeometry(1.1 + k * 0.3, 0), 0x8a8378);
      rk.position.set(p.x, ctx.groundAt(p.x, p.z) + 0.5, p.z); rk.rotation.set(k, s, 0); ctx.add(rk); ctx.col(p.x, p.z, 1.1);
    }
    // the stepping stones, zig-zagging across
    const stones = [[0.5, 2.05], [-0.5, 0.7], [0.5, -0.7], [-0.4, -2.05]], top = wy + 0.28;
    stones.forEach(([u, v], k) => {
      const p = F.w(u, v), st = ctx.mesh(new THREE.CylinderGeometry(0.55, 0.65, top - y0 + 0.3, 9), 0x9a948a);
      st.position.set(p.x, (top + y0 - 0.3) / 2, p.z); ctx.add(st);
      ctx.plat(p.x, p.z, 0.6, (x, z) => Math.hypot(x - p.x, z - p.z) < 0.6 ? top : null);
      coin(ch, k, p.x, top + 0.9, p.z);
    });
    ch.splash = () => {
      const back = F.w(0, (ch.from || 1) * (half + 1.6)), P = ctx.P, pl = ctx.player;
      ctx.SPK.emit(pl.position.clone().setY(wy), { color: 0xcfeaff, n: 30, speed: 3, up: 0.9, gravity: -8, size: 0.35, life: 0.7 });
      ctx.sfx('splash');
      pl.position.set(back.x, ctx.groundAt(back.x, back.z), back.z); P.vel.set(0, 0, 0);
      ch.clean = false;
      if (!ch.tipT || performance.now() - ch.tipT > 15000) { ch.tipT = performance.now(); ctx.toast('💦 <b>Splash!</b> Jump from stone to stone to cross the ford dry (Space or ⤒).'); }
    };
    ch.update = (dt, t, pos) => {
      const l = F.l(pos.x, pos.z);
      crossing(ch, l, half + 0.3, () => clear(ch, '🌊 <b>Across the ford, dry-footed!</b>', 3));
      if (Math.abs(l.v) < half && Math.abs(l.u) < width && ctx.P.onGround && pos.y < wy + 0.05) ch.splash();
      pickCoins(ch, pos);
      water.position.y = wy + Math.sin(t * 1.3) * 0.015;
    };
    ctx.keep(o.x, o.z, width + 2);
    list.push(ch);
  }

  // ── 🪨 the rockfall ────────────────────────────────────────
  function rockfall(o) {
    const F = frame(o.x, o.z, o.fx, o.fz), width = 8, lanes = [3, 0, -3];
    const ch = { id: o.id, type: 'rock', F, x: o.x, z: o.z, coins: [], width, from: 0, clean: true, hitT: 0 };
    // a scree slope and a heap of rocks at each end, where the boulders come from and go
    for (const s of [-1, 1]) for (const v of lanes) {
      const p = F.w(s * (width + 1.4), v), rk = ctx.mesh(new THREE.DodecahedronGeometry(0.9, 0), 0x7a7268);
      rk.position.set(p.x, ctx.groundAt(p.x, p.z) + 0.4, p.z); rk.scale.y = 0.6; ctx.add(rk);
    }
    const sign = (() => { const p = F.w(-4.2, 5.2), g = new THREE.Group(); g.position.set(p.x, ctx.groundAt(p.x, p.z), p.z); ctx.add(g);
      const post = ctx.mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.8, 6), 0x6a4a2a); post.position.y = 0.9; g.add(post);
      const b = ctx.mesh(new THREE.BoxGeometry(1.1, 0.9, 0.08), 0xe0a526); b.position.y = 1.9; b.rotation.z = Math.PI / 4; g.add(b);
      const m = ctx.mesh(new THREE.BoxGeometry(0.12, 0.45, 0.1), 0x2a1a08); m.position.set(0, 1.95, 0.05); g.add(m); return g; })();
    ch.rocks = lanes.map((v, k) => {
      const r = ctx.mesh(new THREE.DodecahedronGeometry(0.75, 1), 0x8a8070, { flatShading: true }); ctx.add(r);
      // slow in the first regions, quicker further on
      const zone = parseInt(o.id) || 0;
      return { r, v, dir: k % 2 ? -1 : 1, u: -width - 2 + k * 5, speed: Math.min(5.5, 2.8 + zone * 0.5 + k * 0.4), wait: 0 };
    });
    lanes.concat([4.8, -4.8]).forEach((v, k) => { const p = F.w(0, v); coin(ch, k, p.x, ctx.groundAt(p.x, p.z) + 0.9, p.z); });
    ch.update = (dt, t, pos) => {
      const l = F.l(pos.x, pos.z);
      crossing(ch, l, 4.6, () => clear(ch, '🪨 <b>Through the rockfall without a scratch!</b>', 3));
      ch.hitT = Math.max(0, ch.hitT - dt);
      for (const b of ch.rocks) {
        if (b.wait > 0) { b.wait -= dt; b.r.visible = false; continue; }
        b.r.visible = true; b.u += b.dir * b.speed * dt;
        if (Math.abs(b.u) > width + 2) { b.u = -b.dir * (width + 2); b.wait = 0.6 + Math.random() * 1.2; }
        const p = F.w(b.u, b.v), gy = ctx.groundAt(p.x, p.z);
        b.r.position.set(p.x, gy + 0.75, p.z); b.r.rotation.z -= b.dir * b.speed * dt / 0.75;
        if (Math.random() < dt * 6) ctx.DUST && ctx.DUST.emit(new THREE.Vector3(p.x, gy + 0.1, p.z), { color: 0xcdbb98, n: 1, speed: 0.6, up: 0.3, gravity: 0.3, drag: 2, size: 0.4, size1: 1, life: 0.5 });
        if (!ch.hitT && Math.hypot(pos.x - p.x, pos.z - p.z) < 1.25 && pos.y < gy + 1.1) {
          // knocked back the way you came
          ch.hitT = 1; ch.clean = false; const away = F.w(0, Math.sign(l.v - b.v) || 1), P = ctx.P;
          const dx = away.x - F.x, dz = away.z - F.z, d = Math.hypot(dx, dz) || 1;
          P.vel.set(dx / d * 9, 6, dz / d * 9); P.onGround = false; ctx.sfx('bad'); ctx.shake(0.35);
          ctx.SPK.emit(pos.clone().setY(pos.y + 1), { color: 0xffffff, n: 20, speed: 4, up: 0.5, gravity: -6, size: 0.35, life: 0.5 });
          if (!ch.tipT || performance.now() - ch.tipT > 15000) { ch.tipT = performance.now(); ctx.toast('🪨 <b>Oof!</b> Wait for a gap, then dash, or jump the boulder.'); }
        }
      }
      pickCoins(ch, pos);
    };
    ctx.keep(o.x, o.z, width + 2);
    list.push(ch);
  }

  // ── 🏛 the pillar stair ─────────────────────────────────────
  function pillars(o) {
    const F = frame(o.x, o.z, o.fx, o.fz), s = o.side || 1;
    const ch = { id: o.id, type: 'pillars', F, x: o.x, z: o.z, coins: [] };
    const base = ctx.groundAt(o.x, o.z), n = 6, stone = 0xe8dfcc;
    let topY = 0, topP = null;
    for (let k = 0; k < n; k++) {
      const p = F.w(s * (3.6 + k * 1.45), 2.5 - k * 1.0), g0 = ctx.groundAt(p.x, p.z), top = Math.max(base, g0) + 0.62 * (k + 1), r = 0.62;
      const col = ctx.mesh(new THREE.CylinderGeometry(r, r + 0.08, top - g0 + 1, 10), stone); col.position.set(p.x, (top + g0 - 1) / 2, p.z); ctx.add(col);
      const cap = ctx.mesh(new THREE.BoxGeometry(r * 2.3, 0.18, r * 2.3), 0xd8cfbc); cap.position.set(p.x, top - 0.05, p.z); ctx.add(cap);
      ctx.plat(p.x, p.z, r * 1.15, (x, z) => Math.abs(x - p.x) < r * 1.15 && Math.abs(z - p.z) < r * 1.15 ? top + 0.04 : null);
      if (k < n - 1) coin(ch, k, p.x, top + 0.9, p.z);
      topY = top; topP = p;
    }
    // a little gold laurel on the highest pillar
    const prize = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.08, 6, 16), coinMat); prize.position.set(topP.x, topY + 1, topP.z); ctx.add(prize);
    ch.prize = prize; prize.visible = !ctx.state().done.includes(ch.id);
    ch.update = (dt, t, pos) => {
      pickCoins(ch, pos);
      prize.rotation.y += dt * 2; prize.position.y = topY + 1 + Math.sin(t * 2) * 0.1;
      if (prize.visible && Math.hypot(pos.x - topP.x, pos.z - topP.z) < 1 && pos.y > topY - 0.3) {
        prize.visible = false; clear(ch, '🏛 <b>Top of the pillars!</b>', 5);
        ctx.SPK.emit(prize.position, { colors: [0xffd166, 0xffffff], n: 40, speed: 3, up: 0.8, gravity: -3, size: 0.4, life: 0.9 });
      }
    };
    ctx.keep(F.w(s * 7, 0).x, F.w(s * 7, 0).z, 6);
    list.push(ch);
  }

  return {
    ford, rockfall, pillars, list,
    update(dt, t, pos) {
      for (const ch of list) {
        const near = Math.abs(pos.z - ch.z) < 40 && Math.abs(pos.x - ch.x) < 40;
        if (ch.rocks) for (const b of ch.rocks) if (!near) b.r.visible = false;
        if (near) ch.update(dt, t, pos);
        for (const k of ch.coins) if (k.c.visible && near) k.c.rotation.z += dt * 2.5;
      }
    },
  };
}
