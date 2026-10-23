// Shared look and feel for the 3D worlds and the trial stage: a painted sky
// with sun, clouds and stars, moving water, wind in the trees and grass,
// pooled sparkles and dust, a swirling portal and the little touches that
// make the hero feel alive. Koine Quest and Going Deeper Quest use this same
// file; keep it free of game content so it can be copied between them as is.

export function makeFX(THREE, { LOW = false } = {}) {
  const time = { value: 0 };
  const NOISE = `
    float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float vn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
      return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
    float fbm(vec2 p) { float a = .5, s = 0.; for (int i = 0; i < OCT; i++) { s += a * vn(p); p = p * 2.03 + 17.1; a *= .5; } return s; }`;
  const defines = { OCT: LOW ? 3 : 5 };

  // ── sky: gradient, sun, drifting clouds and (at dusk) stars ──
  function sky(radius = 500) {
    const u = {
      uTop: { value: new THREE.Color(0x4a88c8) }, uMid: { value: new THREE.Color(0xa9d4f0) }, uBot: { value: new THREE.Color(0xe8e0c8) },
      uSun: { value: new THREE.Color(0xfff1d6) }, uSunDir: { value: new THREE.Vector3(0.35, 0.42, -0.84).normalize() },
      uCloud: { value: 0.5 }, uStars: { value: 0 }, uTime: time,
    };
    const m = new THREE.ShaderMaterial({
      uniforms: u, defines, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position.z = gl_Position.w * .9999; }`,
      fragmentShader: `uniform vec3 uTop, uMid, uBot, uSun, uSunDir; uniform float uCloud, uStars, uTime; varying vec3 vDir; ${NOISE}
        void main() {
          vec3 d = normalize(vDir); float y = d.y;
          vec3 col = y > 0. ? mix(uMid, uTop, smoothstep(0., .62, y)) : mix(uMid, uBot, smoothstep(0., .22, -y));
          float s = max(dot(d, uSunDir), 0.);
          col += uSun * (pow(s, 1400.) * 6. + pow(s, 60.) * .35 + pow(s, 6.) * .18);
          if (uStars > 0.) {
            vec3 q = floor(d * 260.); float st = fract(sin(dot(q, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
            float tw = .6 + .4 * sin(uTime * 3. + st * 40.);
            col += step(.9975, st) * uStars * tw * smoothstep(.02, .3, y) * vec3(1., .95, .85);
          }
          if (y > .0 && uCloud > 0.) {
            vec2 uv = d.xz / (y + .18) * .9 + uTime * vec2(.012, .005);
            float n = fbm(uv * 1.3), c = smoothstep(1.05 - uCloud * .7, 1.2 - uCloud * .6, n) * smoothstep(.04, .32, y);
            float lit = smoothstep(.3, 1., fbm(uv * 1.3 + uSunDir.xz * .2));
            vec3 cc = mix(vec3(1.02), mix(uMid, uTop, .35) * .9 + .12, lit * .55);
            cc += uSun * pow(s, 8.) * .5;
            col = mix(col, cc, c * .9);
          }
          gl_FragColor = vec4(col, 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), m);
    mesh.frustumCulled = false; mesh.renderOrder = -10;
    mesh.userData.set = A => {
      u.uTop.value.set(A.top); u.uMid.value.set(A.mid); u.uBot.value.set(A.bot); u.uSun.value.set(A.sun); // hex or THREE.Color
      u.uCloud.value = A.clouds ?? 0.5; u.uStars.value = A.stars || 0;
      if (A.sunDir) u.uSunDir.value.set(...A.sunDir).normalize();
    };
    return mesh;
  }

  // ── water: gentle waves, sky reflection, sun glints and sparkles ──
  function water(opts = {}) {
    const u = Object.assign({
      uTime: time, uDeep: { value: new THREE.Color(opts.deep || 0x1f6a9a) }, uShallow: { value: new THREE.Color(opts.shallow || 0x5ac0e0) },
      uSkyCol: { value: new THREE.Color(opts.sky || 0xbfe4ff) }, uSunDir: { value: new THREE.Vector3(0.35, 0.42, -0.84).normalize() },
      uOpacity: { value: opts.opacity ?? 0.86 },
    }, THREE.UniformsLib.fog);
    const m = new THREE.ShaderMaterial({
      uniforms: u, defines, transparent: true, fog: true, depthWrite: false,
      vertexShader: `uniform float uTime; varying vec3 vW; varying vec2 vUv;
        #include <fog_pars_vertex>
        void main() {
          vUv = uv;
          vec4 w = modelMatrix * vec4(position, 1.);
          w.y += sin(w.x * .5 + uTime * 1.6) * .05 + cos(w.z * .7 + uTime * 1.2) * .04;
          vW = w.xyz;
          vec4 mvPosition = viewMatrix * w;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uTime, uOpacity; uniform vec3 uDeep, uShallow, uSkyCol, uSunDir; varying vec3 vW; varying vec2 vUv; ${NOISE}
        #include <fog_pars_fragment>
        void main() {
          vec2 p = vW.xz;
          float e = .15;
          float h0 = fbm(p * .35 + uTime * vec2(.08, .05)) + .5 * vn(p * 1.3 - uTime * .4);
          float hx = fbm((p + vec2(e, 0.)) * .35 + uTime * vec2(.08, .05)) + .5 * vn((p + vec2(e, 0.)) * 1.3 - uTime * .4);
          float hz = fbm((p + vec2(0., e)) * .35 + uTime * vec2(.08, .05)) + .5 * vn((p + vec2(0., e)) * 1.3 - uTime * .4);
          vec3 n = normalize(vec3((h0 - hx) * 2.2, 1., (h0 - hz) * 2.2));
          vec3 v = normalize(cameraPosition - vW);
          float fr = pow(1. - max(dot(n, v), 0.), 3.);
          vec3 col = mix(uShallow, uDeep, smoothstep(.2, .9, h0));
          col = mix(col, uSkyCol, clamp(fr * .9 + .1, 0., 1.));
          float sp = pow(max(dot(reflect(-uSunDir, n), v), 0.), 90.);
          col += vec3(1., .96, .85) * sp * 1.6;
          float gl = step(.985, vn(p * 6. + uTime * 1.5)) * .9;
          col += gl * vec3(1.);
          gl_FragColor = vec4(col, uOpacity + fr * .1);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    m.userData.setColors = (deep, shallow, skyc) => { u.uDeep.value.set(deep); u.uShallow.value.set(shallow); if (skyc !== undefined) u.uSkyCol.value.set(skyc); };
    return m;
  }

  // ── wind: sways foliage and grass; taller parts move more ──
  function windify(material, { amp = 0.08, base = 0, freq = 1.3, gust = true } = {}) {
    material.onBeforeCompile = sh => {
      sh.uniforms.uTime = time;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec3 ip = instanceMatrix[3].xyz;
          #else
            vec3 ip = (modelMatrix * vec4(0., 0., 0., 1.)).xyz;
          #endif
          float hgt = max(position.y - (${base.toFixed(2)}), 0.);
          float g = ${gust ? '0.65 + 0.55 * sin(dot(ip.xz, vec2(.11, .07)) - uTime * 1.7)' : '1.0'};
          float sw = sin(uTime * ${freq.toFixed(2)} + ip.x * .35 + ip.z * .23) * ${amp.toFixed(3)} * hgt * g;
          transformed.x += sw; transformed.z += sw * .55;
        }`);
    };
    material.customProgramCacheKey = () => 'wind' + amp + base + freq + gust;
    return material;
  }

  // ── ground: painterly patches of light and shade, warmer and cooler, on any vertex-coloured ground ──
  function groundDetail(material, { amt = 1.25 } = {}) {
    material.onBeforeCompile = sh => {
      sh.vertexShader = 'varying vec3 vGW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vGW = (modelMatrix * vec4(transformed, 1.)).xyz;');
      sh.fragmentShader = 'varying vec3 vGW;\n' + NOISE.replace(/OCT/g, '3') + '\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        {
          float n1 = vn(vGW.xz * .07), n2 = vn(vGW.xz * .45 + 3.1), n3 = vn(vGW.xz * 2.3 + 7.7);
          float k = ${amt.toFixed(2)};
          diffuseColor.rgb *= 1. + k * (.2 * (n1 - .5) + .1 * (n2 - .5) + .06 * (n3 - .5));
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.1, 1.05, .82), k * smoothstep(.55, .85, n1) * .45);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(.9, 1., 1.08), k * smoothstep(.6, .9, 1. - n1) * .3);
        }`);
    };
    material.customProgramCacheKey = () => 'ground' + amt;
    return material;
  }

  // ── swirling portal disc ──
  function portalMaterial(c1 = 0x9ad0ff, c2 = 0x7a3aff) {
    return new THREE.ShaderMaterial({
      uniforms: { uTime: time, uA: { value: new THREE.Color(c1) }, uB: { value: new THREE.Color(c2) } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `uniform float uTime; uniform vec3 uA, uB; varying vec2 vUv;
        void main() {
          vec2 p = vUv * 2. - 1.; float r = length(p), a = atan(p.y, p.x);
          float sw = sin(a * 5. + r * 14. - uTime * 4.) * .5 + .5;
          float core = smoothstep(.55, 0., r);
          vec3 col = mix(uB, uA, sw) + vec3(1.) * core * .9;
          float alpha = smoothstep(1., .82, r) * (.55 + .45 * sw) + core;
          gl_FragColor = vec4(col * alpha, alpha);
          #include <colorspace_fragment>
        }`,
    });
  }

  // ── pooled sparkles: bursts, trails, dust and magic ──
  let starTex = null;
  function sparkTexture() {
    if (starTex) return starTex;
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    x.globalCompositeOperation = 'lighter'; x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(32, 2); x.lineTo(32, 62); x.moveTo(2, 32); x.lineTo(62, 32); x.stroke();
    return (starTex = new THREE.CanvasTexture(c));
  }
  function sparks(scene, max = LOW ? 300 : 700, { additive = true } = {}) {
    const pos = new Float32Array(max * 3), col = new Float32Array(max * 3), sz = new Float32Array(max), al = new Float32Array(max);
    const P = Array.from({ length: max }, () => ({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, g: 0, drag: 0, s0: 0, s1: 0, spin: 0 }));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sz, 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(al, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: additive ? sparkTexture() : dustTexture() }, uScale: { value: 300 } },
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, vertexColors: true,
      vertexShader: `attribute float size; attribute float alpha; varying vec3 vC; varying float vA; uniform float uScale;
        void main() { vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = size * uScale / max(.5, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D uMap; varying vec3 vC; varying float vA;
        void main() { vec4 t = texture2D(uMap, gl_PointCoord); if (t.a * vA < .01) discard; gl_FragColor = vec4(vC * t.rgb, t.a * vA);
          #include <colorspace_fragment>
        }`,
    });
    const pts = new THREE.Points(geo, m); pts.frustumCulled = false; pts.renderOrder = 5;
    scene.add(pts);
    let next = 0, alive = 0;
    const c = new THREE.Color();
    function emit(p, { color = 0xffd166, n = 24, speed = 4, up = 0.6, gravity = -6, drag = 1.2, size = 0.35, size1 = 0, life = 0.9, spread = 0.15, colors = null } = {}) {
      for (let i = 0; i < n; i++) {
        const k = next; next = (next + 1) % max;
        const q = P[k];
        const th = Math.random() * 6.283, ph = Math.acos(2 * Math.random() - 1), sp = speed * (0.4 + Math.random() * 0.6);
        q.vx = Math.sin(ph) * Math.cos(th) * sp; q.vz = Math.sin(ph) * Math.sin(th) * sp; q.vy = Math.abs(Math.cos(ph)) * sp * up + (up > 0 ? speed * up * 0.5 : 0);
        q.g = gravity; q.drag = drag; q.max = q.life = life * (0.6 + Math.random() * 0.6); q.s0 = size * (0.6 + Math.random() * 0.8); q.s1 = size1;
        pos[k * 3] = p.x + (Math.random() - 0.5) * spread; pos[k * 3 + 1] = p.y + (Math.random() - 0.5) * spread; pos[k * 3 + 2] = p.z + (Math.random() - 0.5) * spread;
        c.setHex(colors ? colors[i % colors.length] : color);
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
        sz[k] = q.s0; al[k] = 1;
      }
      alive = max;
    }
    function update(dt) {
      if (!alive) return;
      let any = 0;
      for (let k = 0; k < max; k++) {
        const q = P[k];
        if (q.life <= 0) { if (sz[k]) { sz[k] = 0; al[k] = 0; } continue; }
        any++;
        q.life -= dt; const f = Math.max(0, q.life / q.max), d = Math.max(0, 1 - q.drag * dt);
        q.vx *= d; q.vz *= d; q.vy = q.vy * d + q.g * dt;
        pos[k * 3] += q.vx * dt; pos[k * 3 + 1] += q.vy * dt; pos[k * 3 + 2] += q.vz * dt;
        sz[k] = q.s1 ? q.s1 + (q.s0 - q.s1) * f : q.s0 * (0.4 + 0.6 * f);
        al[k] = Math.min(1, f * 2.2);
      }
      alive = any;
      for (const a of ['position', 'size', 'alpha', 'color']) geo.attributes[a].needsUpdate = true;
    }
    return { emit, update, points: pts, setScale: s => { m.uniforms.uScale.value = s; } };
  }
  let dustTex = null;
  function dustTexture() {
    if (dustTex) return dustTex;
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return (dustTex = new THREE.CanvasTexture(c));
  }

  // ── a soft halo of light around lamps, crystals and lanterns ──
  let haloTex = null;
  function glow(color = 0xffd890, size = 1.6, opacity = 0.55) {
    if (!haloTex) {
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.3, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64); haloTex = new THREE.CanvasTexture(c);
    }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(size);
    return s;
  }

  // ── a soft round shadow under things that float or fly ──
  let blobTex = null;
  function blobShadow(r = 0.6) {
    if (!blobTex) {
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
      const g = x.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64); blobTex = new THREE.CanvasTexture(c);
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.renderOrder = 1;
    return m;
  }

  // ── the hero's body language: breathing, leaning into a run, squash on landing ──
  function heroPose(p, { speed = 0, onGround = true, vy = 0, landed = 0, t = 0, turn = 0 }) {
    const u = p.userData; if (!u || !u.body) return;
    const run = Math.min(1, speed / 9);
    u.body.rotation.x = onGround ? run * 0.22 : vy > 0 ? -0.12 : 0.18;
    u.body.rotation.z = onGround ? -turn * 0.25 * run : 0;
    const breathe = speed < 0.3 ? Math.sin(t * 2.2) * 0.012 : 0;
    const sq = landed > 0 ? Math.sin(landed / 0.18 * Math.PI) * 0.16 : 0;
    const air = onGround ? 0 : Math.min(0.12, Math.abs(vy) * 0.012);
    p.scale.set(1 + sq * 0.6 - air * 0.5, 1 - sq + breathe + air, 1 + sq * 0.6 - air * 0.5);
    if (u.arms && speed < 0.3 && onGround) { u.arms[0].rotation.z = 0.06 + Math.sin(t * 2.2) * 0.03; u.arms[1].rotation.z = -0.06 - Math.sin(t * 2.2) * 0.03; }
    else if (u.arms && !onGround) { u.arms[0].rotation.z = 0.6; u.arms[1].rotation.z = -0.6; }
    else if (u.arms) { u.arms[0].rotation.z = 0.05; u.arms[1].rotation.z = -0.05; }
  }

  // ── a pickup flies from the world to its counter in the HUD ──
  function flyToHUD(camera, renderer, worldPos, target, html, cls = '') {
    if (!target) return;
    const v = worldPos.clone().project(camera), r = renderer.domElement.getBoundingClientRect(), tr = target.getBoundingClientRect();
    if (v.z > 1) return;
    const d = document.createElement('div');
    d.className = 'flyhud ' + cls; d.innerHTML = html;
    const x0 = r.left + (v.x + 1) / 2 * r.width, y0 = r.top + (1 - v.y) / 2 * r.height;
    d.style.left = x0 + 'px'; d.style.top = y0 + 'px';
    document.body.appendChild(d);
    const x1 = tr.left + tr.width / 2, y1 = tr.top + tr.height / 2;
    d.animate([
      { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 },
      { transform: 'translate(-50%,-90%) scale(1.25)', opacity: 1, offset: 0.25 },
      { transform: `translate(calc(-50% + ${x1 - x0}px), calc(-50% + ${y1 - y0}px)) scale(.7)`, opacity: 1 },
    ], { duration: 750, easing: 'cubic-bezier(.5,0,.75,.4)' }).onfinish = () => { d.remove(); target.animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 250 }); };
  }

  // ── life in the air: a flock of birds wheeling overhead, butterflies near the path ──
  // update(dt, t, center, ground(x, z), day 0..1): birds and butterflies keep near the
  // player and fade away at night.
  function critters(scene, { birds = LOW ? 5 : 9, flies = LOW ? 4 : 8 } = {}) {
    const G = new THREE.Group(); scene.add(G);
    const dark = new THREE.MeshBasicMaterial({ color: 0x2a2630, side: THREE.DoubleSide, transparent: true });
    const wingGeo = new THREE.BufferGeometry();
    wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.18, 0, 0, 0.22, 0.9, 0, 0.05], 3));
    wingGeo.computeVertexNormals();
    const bodyGeo = new THREE.ConeGeometry(0.09, 0.6, 4); bodyGeo.rotateX(Math.PI / 2);
    const B = [];
    for (let i = 0; i < birds; i++) {
      const g = new THREE.Group(), body = new THREE.Mesh(bodyGeo, dark), wl = new THREE.Mesh(wingGeo, dark), wr = new THREE.Mesh(wingGeo, dark);
      wr.scale.x = -1; g.add(body, wl, wr); g.scale.setScalar(1.4); G.add(g);
      B.push({ g, wl, wr, ph: Math.random() * 6, r: 18 + (i % 3) * 5 + Math.random() * 3, h: 16 + (i % 4) * 2.5, a: i * 0.7, sp: 0.22 + Math.random() * 0.06, glide: 0 });
    }
    const flyCols = [0xffb84a, 0xf06a8a, 0x8ad0ff, 0xfff07a, 0xc89aff, 0xffffff];
    const flyGeo = new THREE.PlaneGeometry(0.22, 0.18); flyGeo.translate(0.11, 0, 0);
    const F = [];
    for (let i = 0; i < flies; i++) {
      const m = new THREE.MeshBasicMaterial({ color: flyCols[i % flyCols.length], side: THREE.DoubleSide, transparent: true });
      const g = new THREE.Group(), wl = new THREE.Mesh(flyGeo, m), wr = new THREE.Mesh(flyGeo, m);
      wl.rotation.x = wr.rotation.x = -Math.PI / 2; wr.scale.x = -1; g.add(wl, wr); G.add(g);
      F.push({ g, wl, wr, m, x: 0, z: 0, y: 0, tx: 0, tz: 0, ph: Math.random() * 6, set: false });
    }
    let fade = 1;
    function update(dt, t, c, ground, day = 1) {
      fade += ((day > 0.5 ? 1 : 0) - fade) * Math.min(1, dt * 0.8);
      G.visible = fade > 0.02; if (!G.visible) return;
      dark.opacity = fade;
      for (const b of B) {
        b.a += dt * b.sp;
        const x = c.x + Math.cos(b.a) * b.r, z = c.z + Math.sin(b.a) * b.r, y = c.y + b.h + Math.sin(b.a * 3) * 1.2;
        b.g.position.set(x, y, z); b.g.rotation.set(0, -b.a, Math.sin(t * 0.5 + b.r) * 0.15); // facing along the circle, banking
        b.glide = Math.sin(t * 0.4 + b.r) > 0.3 ? 1 : 0;
        const f = b.glide ? 0.15 : Math.sin(t * 9 + b.ph) * 0.7;
        b.wl.rotation.z = f; b.wr.rotation.z = -f;
      }
      for (const f of F) {
        f.m.opacity = fade;
        if (!f.set || Math.hypot(f.x - c.x, f.z - c.z) > 22) {
          const a = Math.random() * 6.28, r = 4 + Math.random() * 12;
          f.x = f.tx = c.x + Math.cos(a) * r; f.z = f.tz = c.z + Math.sin(a) * r; f.set = true;
        }
        if (Math.hypot(f.tx - f.x, f.tz - f.z) < 0.3) { const a = Math.random() * 6.28; f.tx = f.x + Math.cos(a) * 2.5; f.tz = f.z + Math.sin(a) * 2.5; }
        const dx = f.tx - f.x, dz = f.tz - f.z, d = Math.hypot(dx, dz) || 1;
        f.x += dx / d * dt * 1.1 + Math.sin(t * 3 + f.ph) * dt * 0.6; f.z += dz / d * dt * 1.1 + Math.cos(t * 2.6 + f.ph) * dt * 0.6;
        const gy = ground(f.x, f.z) + 0.8 + Math.sin(t * 2 + f.ph) * 0.35;
        f.y += (gy - f.y) * Math.min(1, dt * 3);
        f.g.position.set(f.x, f.y, f.z); f.g.rotation.y = Math.atan2(dx, dz);
        const w = Math.sin(t * 16 + f.ph) * 1.1; f.wl.rotation.y = w; f.wr.rotation.y = -w;
      }
    }
    return { update, group: G };
  }

  return { time, critters, groundDetail, sky, water, windify, portalMaterial, sparks, glow, blobShadow, heroPose, flyToHUD, tick: t => { time.value = t; } };
}
