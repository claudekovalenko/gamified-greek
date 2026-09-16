/**
 * Temple Dash — the corridor you run down, where every gate is a question.
 *
 * Three lanes. Each gate hangs a sign over each lane (or bricks a lane up).
 * Be in the lane with the right answer when the gate arrives and you run on;
 * be anywhere else and you crash. The corridor speeds up as you go.
 *
 * This file only moves and draws. What a gate asks, and what a right or wrong
 * answer means for hearts, XP and mastery, is app.js's business: it hands the
 * engine `hooks` and gets called back.
 *
 *   hooks.nextGate()                  → a step { lanes: [opt|null ×3], answerLane, … } or null when the run is done
 *   hooks.onPass(step, lane, right)   → called as the player crosses a gate
 *   hooks.onFinish()                  → the finish line was crossed
 *   hooks.onLane(lane)                → the player changed lane
 *   hooks.sfx(kind)                   → a sound, if the app wants one
 *
 * An option's `text` is what the sign says; `cls` 'gk' means set it in Greek.
 */

const LANES = [-1, 0, 1];
const LANE_W = 2.3; // lane centre to lane centre
const HALF_W = 3.7; // wall to centre
const WALL_H = 4.8;
const VIEW = 78; // how far ahead is drawn
const SLICE = 3; // floor slab length
const CAM_BACK = 7.5;
const CAM_H = 3.1;
const HORIZON = 0.4; // of the canvas height
const SIGN = [1.05, 2.6]; // sign bottom and top, in world units
const LANE_T = 0.15; // seconds to slide between lanes

const GREEK = "'Palatino Linotype', Palatino, 'Gentium Plus', 'Noto Serif', Georgia, serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans', Helvetica, Arial, sans-serif";

const FOG = [15, 18, 34];
const C = {
  sky0: [10, 8, 30],
  sky1: [58, 32, 78],
  glow: [120, 70, 60],
  floor: [86, 84, 104],
  floorAlt: [76, 74, 94],
  laneLine: [140, 150, 200],
  wall: [96, 88, 110],
  wallAlt: [86, 78, 100],
  trim: [196, 160, 88],
  pillar: [150, 142, 158],
  pillarDark: [110, 102, 120],
  sign: [244, 232, 200],
  signInk: [40, 30, 16],
  signOk: [140, 224, 176],
  signBad: [255, 150, 150],
  brick: [70, 40, 44],
  brickLine: [40, 22, 26],
  torch: [255, 170, 70],
  gold: [255, 197, 61]
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

export class Dash {
  constructor(canvas, hooks, pace = {}) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks;
    // speed0→speed1 (units/s) and time0→time1 (seconds of warning before a
    // gate) ramp over the first `ramp` gates passed.
    this.pace = { speed0: 8, speed1: 15, time0: 6.5, time1: 3.4, ramp: 16, ...pace };
    this.z = 0;
    this.speed = this.pace.speed0;
    this.lane = 1;
    this.laneX = 0;
    this.t = 0;
    this.gate = null;
    this.old = [];
    this.finish = null;
    this.passed = 0;
    this.gapT = 0.6;
    this.paused = false;
    this.over = false;
    this.dead = false;
    this.shake = 0;
    this.flash = 0;
    this.hitT = 0;
    this.glowT = 0;
    this.floaters = [];
    this.heroPos = [0, 0];
    this.W = 0;
    this.H = 0;
    this._fit = new Map();
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this._bindPointer();
    this.resize();
    this._last = performance.now();
    this._loop = (now) => {
      if (this.dead) return;
      const dt = Math.min(0.05, (now - this._last) / 1000);
      this._last = now;
      this.update(dt);
      this.draw();
      this._raf = requestAnimationFrame(this._loop);
    };
    this._raf = requestAnimationFrame(this._loop);
  }

  destroy() {
    this.dead = true;
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
  }

  resize() {
    const r = this.cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = r.width;
    this.H = r.height;
    this.cv.width = Math.max(1, Math.round(r.width * dpr));
    this.cv.height = Math.max(1, Math.round(r.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._fit.clear();
  }

  /* ---------------- input ---------------- */

  _bindPointer() {
    let x0 = 0, y0 = 0, active = false;
    this.cv.addEventListener('pointerdown', (e) => {
      active = true;
      x0 = e.clientX;
      y0 = e.clientY;
      e.preventDefault();
    });
    this.cv.addEventListener('pointerup', (e) => {
      if (!active) return;
      active = false;
      const dx = e.clientX - x0;
      const dy = e.clientY - y0;
      if (Math.abs(dx) > 24 && Math.abs(dx) > Math.abs(dy)) this.move(dx < 0 ? -1 : 1);
      else if (Math.hypot(dx, dy) < 14) {
        const r = this.cv.getBoundingClientRect();
        const fx = (e.clientX - r.left) / r.width;
        this.setLane(fx < 1 / 3 ? 0 : fx < 2 / 3 ? 1 : 2);
      }
    });
    this.cv.addEventListener('pointercancel', () => { active = false; });
  }

  move(d) {
    this.setLane(this.lane + d);
  }

  setLane(i) {
    if (this.over) return;
    i = clamp(i | 0, 0, 2);
    if (i === this.lane) return;
    this.lane = i;
    this.hooks.onLane?.(i);
    this.hooks.sfx?.('tap');
  }

  pause() { this.paused = true; }
  resume() { this.paused = false; }

  /** A bit of text that floats up from the runner. */
  floater(text, color = rgb(C.gold)) {
    this.floaters.push({ text, color, t: 0, x: this.heroPos[0], y: this.heroPos[1] - this.H * 0.28 });
  }

  /* ---------------- simulation ---------------- */

  update(dt) {
    this.shake = Math.max(0, this.shake - dt * 2.2);
    this.flash = Math.max(0, this.flash - dt * 1.8);
    this.hitT = Math.max(0, this.hitT - dt);
    this.glowT = Math.max(0, this.glowT - dt);
    for (const f of this.floaters) f.t += dt;
    this.floaters = this.floaters.filter((f) => f.t < 1);
    if (this.paused || this.over) return;

    this.t += dt;
    const k = clamp(this.passed / this.pace.ramp, 0, 1);
    const target = this.pace.speed0 + (this.pace.speed1 - this.pace.speed0) * k;
    this.speed += (target - this.speed) * Math.min(1, dt * 1.2);
    this.z += this.speed * dt;
    const tx = LANES[this.lane] * LANE_W;
    this.laneX += (tx - this.laneX) * Math.min(1, dt / LANE_T);

    if (!this.gate && this.finish === null) {
      this.gapT -= dt;
      if (this.gapT <= 0) {
        const step = this.hooks.nextGate();
        if (step) {
          const T = this.pace.time0 + (this.pace.time1 - this.pace.time0) * k;
          this.gate = { z: this.z + this.speed * T + 4, step, lanes: step.lanes, answer: step.answerLane, state: 'open', pick: -1 };
        } else {
          this.finish = this.z + 36;
        }
      }
    }
    if (this.gate && this.z >= this.gate.z) this._resolve();
    if (this.finish !== null && this.z >= this.finish + 1.5) {
      this.over = true;
      this.hooks.onFinish?.();
    }
    this.old = this.old.filter((g) => g.z > this.z - CAM_BACK - 2);
  }

  _resolve() {
    const g = this.gate;
    g.pick = this.lane;
    const right = g.pick === g.answer;
    g.state = right ? 'passed' : 'crashed';
    this.gate = null;
    this.old.push(g);
    if (right) {
      this.passed += 1;
      this.gapT = 0.7;
      this.glowT = 0.5;
    } else {
      this.shake = 1;
      this.flash = 1;
      this.hitT = 0.7;
      this.gapT = 0.9;
      this.speed *= 0.6;
      this.paused = true; // the app shows what went wrong, then calls resume()
    }
    this.hooks.onPass?.(g.step, g.pick, right);
  }

  /* ---------------- drawing ---------------- */

  draw() {
    const { ctx, W, H } = this;
    if (!W || !H) return;
    const f = W * 0.92;
    const hx = W / 2;
    const hy = H * HORIZON;
    const camZ = this.z - CAM_BACK;
    const camX = this.laneX * 0.45;
    const camY = CAM_H;
    const P = (x, y, z) => {
      const dz = z - camZ;
      if (dz < 0.5) return null;
      const s = f / dz;
      return [hx + (x - camX) * s, hy + (camY - y) * s, s, dz];
    };
    const fog = (dz) => Math.pow(clamp((dz - 8) / (VIEW - 8), 0, 1), 1.3);
    const quad = (a, b, c, d, color) => {
      if (!a || !b || !c || !d) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(c[0], c[1]);
      ctx.lineTo(d[0], d[1]);
      ctx.closePath();
      ctx.fill();
    };

    ctx.save();
    if (this.shake > 0) {
      const s = this.shake * this.shake * 9;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, hy);
    sky.addColorStop(0, rgb(C.sky0));
    sky.addColorStop(1, rgb(C.sky1));
    ctx.fillStyle = sky;
    ctx.fillRect(-20, -20, W + 40, hy + 20);
    ctx.fillStyle = rgb(FOG);
    ctx.fillRect(-20, hy - 1, W + 40, H - hy + 40);
    // stars, fixed to the sky
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 26; i++) {
      const sx = ((i * 137.5) % 100) / 100 * W;
      const sy = ((i * 71.3) % 100) / 100 * hy * 0.8;
      const tw = 0.5 + 0.5 * Math.sin(this.t * 2 + i);
      ctx.globalAlpha = 0.3 + 0.5 * tw;
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
    // a glow at the vanishing point
    const g = ctx.createRadialGradient(hx - camX * 3, hy, 0, hx - camX * 3, hy, W * 0.35);
    g.addColorStop(0, rgb(C.glow, 0.55));
    g.addColorStop(1, rgb(C.glow, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // floor and walls, far to near
    const zFar = Math.floor((camZ + VIEW) / SLICE) * SLICE;
    const zNear = Math.floor(camZ / SLICE) * SLICE;
    for (let z = zFar; z >= zNear; z -= SLICE) {
      const zn = Math.max(z, camZ + 0.6);
      const zf = z + SLICE;
      if (zf <= zn) continue;
      const fg = fog(zf - camZ);
      const alt = Math.round(z / SLICE) % 2 === 0;
      quad(P(-HALF_W, 0, zn), P(HALF_W, 0, zn), P(HALF_W, 0, zf), P(-HALF_W, 0, zf), rgb(mix(alt ? C.floor : C.floorAlt, FOG, fg)));
      for (const lx of [-LANE_W / 2, LANE_W / 2]) {
        quad(P(lx - 0.05, 0.005, zn), P(lx + 0.05, 0.005, zn), P(lx + 0.05, 0.005, zf), P(lx - 0.05, 0.005, zf), rgb(mix(C.laneLine, FOG, fg), 0.55));
      }
      for (const side of [-1, 1]) {
        const wx = side * HALF_W;
        const wc = mix(alt ? C.wall : C.wallAlt, FOG, fg);
        quad(P(wx, 0, zn), P(wx, WALL_H, zn), P(wx, WALL_H, zf), P(wx, 0, zf), rgb(wc));
        quad(P(wx, WALL_H - 0.45, zn), P(wx, WALL_H, zn), P(wx, WALL_H, zf), P(wx, WALL_H - 0.45, zf), rgb(mix(C.trim, FOG, fg)));
        quad(P(wx, 0, zn), P(wx, 0.35, zn), P(wx, 0.35, zf), P(wx, 0, zf), rgb(mix(C.trim, FOG, fg), 0.6));
        if (Math.round(z / SLICE) % 4 === 1 && z + SLICE / 2 > camZ + 1) {
          const p = P(wx - side * 0.12, 2.7, z + SLICE / 2);
          if (p) {
            const r = p[2] * 0.55;
            const glow = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
            glow.addColorStop(0, rgb(C.torch, 0.7 * (1 - fg)));
            glow.addColorStop(1, rgb(C.torch, 0));
            ctx.fillStyle = glow;
            ctx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2);
            const fl = 0.16 * p[2] * (0.9 + 0.2 * Math.sin(this.t * 14 + z));
            ctx.fillStyle = rgb(C.torch, 1 - fg);
            ctx.beginPath();
            ctx.ellipse(p[0], p[1] - fl * 0.2, fl * 0.5, fl, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // finish line
    if (this.finish !== null) {
      const z0 = this.finish;
      const fg = fog(z0 - camZ);
      quad(P(-HALF_W, 0.01, z0), P(HALF_W, 0.01, z0), P(HALF_W, 0.01, z0 + 1.6), P(-HALF_W, 0.01, z0 + 1.6), rgb(mix(C.gold, FOG, fg)));
      const a = P(-HALF_W, 3.2, z0), b = P(HALF_W, 3.2, z0), c = P(HALF_W, 4.4, z0), d = P(-HALF_W, 4.4, z0);
      if (a && b && c && d) {
        quad(a, b, c, d, rgb(mix(C.gold, FOG, fg)));
        ctx.fillStyle = rgb(mix(C.signInk, FOG, fg));
        ctx.font = `800 ${Math.max(8, (c[1] - b[1]) * -0.55)}px ${GREEK}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('ΤΕΛΟΣ', (a[0] + b[0]) / 2, (a[1] + d[1]) / 2);
      }
    }

    // gates, far to near
    const gates = this.old.concat(this.gate ? [this.gate] : []).sort((x, y) => y.z - x.z);
    for (const gt of gates) this._drawGate(gt, P, fog, quad);

    // the runner
    const hp = P(this.laneX, 0, this.z);
    if (hp) {
      this.heroPos = [hp[0], hp[1]];
      this._drawHero(hp[0], hp[1], 1.8 * hp[2]);
    }

    // hit flash and vignette
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,60,60,${0.35 * this.flash})`;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
    if (this.glowT > 0) {
      ctx.fillStyle = `rgba(120,255,180,${0.18 * this.glowT})`;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
    const vg = ctx.createRadialGradient(hx, H * 0.5, H * 0.35, hx, H * 0.5, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vg;
    ctx.fillRect(-20, -20, W + 40, H + 40);

    // floaters
    for (const fl of this.floaters) {
      ctx.globalAlpha = 1 - fl.t;
      ctx.fillStyle = fl.color;
      ctx.font = `800 ${Math.round(Math.min(26, W * 0.06))}px ${SANS}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 6;
      ctx.fillText(fl.text, fl.x, fl.y - fl.t * H * 0.18);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _drawGate(gt, P, fog, quad) {
    const { ctx } = this;
    const z = gt.z;
    const dz = z - (this.z - CAM_BACK);
    if (dz < 0.6) return;
    const fg = fog(dz);
    // pillars and lintel
    for (const side of [-1, 1]) {
      const x0 = side * HALF_W;
      const x1 = side * (HALF_W - 0.55);
      quad(P(x0, 0, z), P(x1, 0, z), P(x1, WALL_H + 0.3, z), P(x0, WALL_H + 0.3, z), rgb(mix(C.pillar, FOG, fg)));
      quad(P(x1 - side * 0.12, 0, z), P(x1, 0, z), P(x1, WALL_H + 0.3, z), P(x1 - side * 0.12, WALL_H + 0.3, z), rgb(mix(C.pillarDark, FOG, fg)));
    }
    quad(P(-HALF_W, WALL_H + 0.3, z), P(HALF_W, WALL_H + 0.3, z), P(HALF_W, WALL_H + 1.1, z), P(-HALF_W, WALL_H + 1.1, z), rgb(mix(C.pillar, FOG, fg)));
    quad(P(-HALF_W, WALL_H + 0.3, z), P(HALF_W, WALL_H + 0.3, z), P(HALF_W, WALL_H + 0.5, z), P(-HALF_W, WALL_H + 0.5, z), rgb(mix(C.trim, FOG, fg)));
    // lanes
    for (let i = 0; i < 3; i++) {
      const opt = gt.lanes[i];
      const cx = LANES[i] * LANE_W;
      const x0 = cx - LANE_W * 0.47;
      const x1 = cx + LANE_W * 0.47;
      if (!opt) {
        // bricked up
        const a = P(x0, 0, z), b = P(x1, 0, z), c = P(x1, 2.9, z), d = P(x0, 2.9, z);
        if (!a) continue;
        quad(a, b, c, d, rgb(mix(C.brick, FOG, fg)));
        ctx.strokeStyle = rgb(mix(C.brickLine, FOG, fg));
        ctx.lineWidth = Math.max(1, a[2] * 0.04);
        const rows = 5;
        for (let r = 1; r < rows; r++) {
          const y = a[1] + (c[1] - a[1]) * (r / rows);
          ctx.beginPath();
          ctx.moveTo(a[0], y);
          ctx.lineTo(b[0], y);
          ctx.stroke();
        }
        ctx.strokeStyle = rgb(mix([230, 90, 90], FOG, fg));
        ctx.lineWidth = Math.max(1.5, a[2] * 0.09);
        const mx = (a[0] + b[0]) / 2, my = (a[1] + c[1]) / 2, r = (b[0] - a[0]) * 0.18;
        ctx.beginPath();
        ctx.moveTo(mx - r, my - r); ctx.lineTo(mx + r, my + r);
        ctx.moveTo(mx + r, my - r); ctx.lineTo(mx - r, my + r);
        ctx.stroke();
        continue;
      }
      const a = P(x0, SIGN[0], z), b = P(x1, SIGN[0], z), c = P(x1, SIGN[1], z), d = P(x0, SIGN[1], z);
      if (!a) continue;
      // post
      const p0 = P(cx - 0.06, 0, z), p1 = P(cx + 0.06, 0, z);
      quad(p0, p1, P(cx + 0.06, SIGN[0], z), P(cx - 0.06, SIGN[0], z), rgb(mix(C.pillarDark, FOG, fg)));
      let face = C.sign;
      if (gt.state !== 'open') {
        if (i === gt.answer) face = C.signOk;
        else if (i === gt.pick) face = C.signBad;
      } else if (i === this.lane && dz < 30) face = mix(C.sign, [255, 255, 255], 0.5);
      const w = b[0] - a[0];
      const h = a[1] - d[1];
      ctx.fillStyle = rgb(mix(face, FOG, fg));
      ctx.fillRect(a[0], d[1], w, h);
      ctx.strokeStyle = rgb(mix(C.signInk, FOG, fg), 0.7);
      ctx.lineWidth = Math.max(1, w * 0.02);
      ctx.strokeRect(a[0], d[1], w, h);
      if (w < 18) continue;
      // the lane number, top-left
      const nr = clamp(w * 0.09, 4, 11);
      ctx.fillStyle = rgb(mix(C.signInk, FOG, fg), 0.75);
      ctx.beginPath();
      ctx.arc(a[0] + nr * 1.4, d[1] + nr * 1.4, nr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgb(mix(C.sign, FOG, fg));
      ctx.font = `800 ${Math.round(nr * 1.3)}px ${SANS}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), a[0] + nr * 1.4, d[1] + nr * 1.45);
      // the text
      const greek = opt.cls === 'gk';
      const fit = this._fitText(opt.text || '', w * 0.88, h * 0.8, greek);
      ctx.fillStyle = rgb(mix(C.signInk, FOG, fg));
      ctx.font = `${greek ? 500 : 700} ${fit.px}px ${greek ? GREEK : SANS}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lh = fit.px * 1.12;
      const y0 = d[1] + h / 2 - ((fit.lines.length - 1) * lh) / 2 + (fit.lines.length > 1 ? 0 : nr * 0.2);
      fit.lines.forEach((ln, k) => ctx.fillText(ln, a[0] + w / 2, y0 + k * lh));
    }
  }

  /** Wrap `text` into at most three lines that fit a w×h box; shrink until it does. */
  _fitText(text, w, h, greek) {
    const key = `${greek ? 'g' : 's'}|${Math.round(w / 3)}|${Math.round(h / 3)}|${text}`;
    const hit = this._fit.get(key);
    if (hit) return hit;
    const { ctx } = this;
    const words = text.split(/\s+/).filter(Boolean);
    let px = Math.min(30, Math.max(6, h * 0.45));
    let lines = [text];
    for (; px >= 6; px -= 1) {
      ctx.font = `${greek ? 500 : 700} ${px}px ${greek ? GREEK : SANS}`;
      lines = [];
      let cur = '';
      for (const wd of words) {
        const trial = cur ? `${cur} ${wd}` : wd;
        if (ctx.measureText(trial).width <= w || !cur) cur = trial;
        else { lines.push(cur); cur = wd; }
      }
      if (cur) lines.push(cur);
      const maxLines = px * 1.12 * 3 <= h ? 3 : px * 1.12 * 2 <= h ? 2 : 1;
      if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= w)) break;
    }
    const res = { px, lines };
    if (this._fit.size > 400) this._fit.clear();
    this._fit.set(key, res);
    return res;
  }

  _drawHero(x, y, h) {
    const { ctx } = this;
    const u = h / 10;
    const phase = this.t * this.speed * 1.15;
    const hit = this.hitT;
    ctx.save();
    ctx.translate(x, y);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 0, u * 2.2, u * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    if (hit > 0) ctx.rotate(Math.sin(hit * 24) * 0.22 * hit);
    const bob = this.paused ? 0 : Math.abs(Math.sin(phase)) * u * 0.45;
    ctx.translate(0, -bob);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // legs
    const legs = [[phase, -0.55], [phase + Math.PI, 0.55]];
    for (const [ph, hx] of legs) {
      const hipX = hx * u, hipY = -u * 3.6;
      const sw = this.paused ? 0 : Math.sin(ph);
      const lift = this.paused ? 0 : Math.max(0, Math.cos(ph));
      const footX = hipX + sw * u * 1.5;
      const footY = -u * 0.15 - lift * u * 1.1;
      const kneeX = (hipX + footX) / 2 + Math.max(0, sw) * u * 0.6;
      const kneeY = (hipY + footY) / 2 + u * 0.2;
      ctx.strokeStyle = '#2b2d48';
      ctx.lineWidth = u * 1.05;
      ctx.beginPath();
      ctx.moveTo(hipX, hipY);
      ctx.lineTo(kneeX, kneeY);
      ctx.lineTo(footX, footY);
      ctx.stroke();
      ctx.strokeStyle = '#8b5a3c';
      ctx.lineWidth = u * 0.9;
      ctx.beginPath();
      ctx.moveTo(footX - u * 0.35, footY);
      ctx.lineTo(footX + u * 0.45, footY);
      ctx.stroke();
    }
    // arms
    const arms = [[phase + Math.PI, -1.35], [phase, 1.35]];
    for (const [ph, ax] of arms) {
      const sw = this.paused ? 0 : Math.sin(ph);
      ctx.strokeStyle = '#e4b79a';
      ctx.lineWidth = u * 0.75;
      ctx.beginPath();
      ctx.moveTo(ax * u, -u * 6.6);
      ctx.lineTo(ax * u + sw * u * 0.9, -u * 4.6 + Math.abs(sw) * u * 0.4);
      ctx.lineTo(ax * u * 0.75 + sw * u * 1.6, -u * 4.9 - Math.max(0, sw) * u * 1.2);
      ctx.stroke();
    }
    // tunic
    ctx.fillStyle = hit > 0 && Math.floor(hit * 16) % 2 === 0 ? '#ff9d9d' : '#ece2d2';
    this._rrect(-u * 1.35, -u * 7.3, u * 2.7, u * 4, u * 0.7);
    ctx.fill();
    ctx.fillStyle = '#c79a3c';
    ctx.fillRect(-u * 1.35, -u * 5.1, u * 2.7, u * 0.45);
    // scarf
    ctx.fillStyle = '#d64234';
    this._rrect(-u * 1.1, -u * 7.4, u * 2.2, u * 0.8, u * 0.3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-u * 0.6, -u * 7.1);
    ctx.lineTo(-u * 2.2 - (this.paused ? 0 : Math.sin(phase * 2) * u * 0.5), -u * 6.0);
    ctx.lineTo(-u * 0.5, -u * 6.4);
    ctx.closePath();
    ctx.fill();
    // head
    ctx.fillStyle = '#e4b79a';
    ctx.beginPath();
    ctx.arc(0, -u * 8.55, u * 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3b2a1e';
    ctx.beginPath();
    ctx.arc(0, -u * 8.75, u * 1.12, Math.PI * 1.05, Math.PI * 1.95);
    ctx.lineTo(u * 1.1, -u * 8.6);
    ctx.lineTo(u * 0.4, -u * 9.05);
    ctx.closePath();
    ctx.fill();
    // laurel
    ctx.strokeStyle = '#4fbf6a';
    ctx.lineWidth = u * 0.28;
    ctx.beginPath();
    ctx.arc(0, -u * 8.6, u * 1.15, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.restore();
  }

  _rrect(x, y, w, h, r) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
