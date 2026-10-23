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
          // at night the sun is the moon: a pale disc with soft grey seas and a halo
          if (uStars > .5) {
            float md = smoothstep(.99955, .99972, s), sea = smoothstep(.45, .75, vn(d.xz * 2600. + d.y * 900.));
            col = mix(col, vec3(.93, .95, 1.) * (1. - sea * .22), md * (uStars - .5) * 2.);
            col += vec3(.55, .65, 1.) * pow(s, 220.) * .22 * uStars;
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
          col = mix(col, uSkyCol, clamp(fr * .7 + .05, 0., .85));
          // soft caustic light dancing in the shallows
          float ca = smoothstep(.55, .8, vn(p * 2.2 + vec2(uTime * .3, -uTime * .2)) * vn(p * 1.7 - vec2(uTime * .25, uTime * .15)) * 2.);
          col += uShallow * ca * .18;
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
  // push: (instanced grass) blades bend away from the hero's feet (the host keeps FX.hero up to date)
  const hero = { value: new THREE.Vector3(0, -999, 0) };
  // unlit grass takes the light of the hour from here (the host sets it with setLight)
  const grassTint = { value: new THREE.Color(1, 1, 1) };
  function setLight({ sun = 0xffffff, sunI = 2, hemi = 1, stars = 0 }) {
    const b = Math.max(0.3, Math.min(1, 0.25 + sunI * 0.33 + hemi * 0.1));
    grassTint.value.set(1, 1, 1).lerp(new THREE.Color(sun), 0.35).multiplyScalar(b).lerp(new THREE.Color(0.55, 0.66, 1).multiplyScalar(b), stars > 0.5 ? 0.5 : 0);
    // the rim light takes the colour of the sky's light: warm by day, moonlit blue at night
    rimCol.value.set(sun).lerp(new THREE.Color(1, 0.95, 0.85), 0.5); if (stars > 0.5) rimCol.value.set(0.55, 0.68, 1);
    rimAmt.value = LOW ? 0 : stars > 0.5 ? 0.5 : 0.35;
  }
  // shade: [lo, hi] model heights; foliage is darker underneath and sunlit on top
  function windify(material, { amp = 0.08, base = 0, freq = 1.3, gust = true, push = false, shade = null } = {}) {
    material.onBeforeCompile = sh => {
      sh.uniforms.uTime = time; sh.uniforms.uHero = hero;
      if (push) {
        sh.uniforms.uTint = grassTint;
        sh.fragmentShader = 'uniform vec3 uTint;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= uTint;');
      }
      if (shade) {
        sh.vertexShader = 'varying float vShadeH;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          vShadeH = clamp((position.y - (${shade[0].toFixed(2)})) / ${(shade[1] - shade[0]).toFixed(2)}, 0., 1.);`);
        sh.fragmentShader = 'varying float vShadeH;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          diffuseColor.rgb *= mix(.62, 1.14, vShadeH * vShadeH * (3. - 2. * vShadeH));
          diffuseColor.rgb += vec3(.05, .06, .0) * smoothstep(.75, 1., vShadeH);`);
      }
      sh.vertexShader = 'uniform float uTime; uniform vec3 uHero;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
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
          ${push ? `#ifdef USE_INSTANCING
          {
            vec2 d = ip.xz - uHero.xz; float dd = length(d);
            float k = smoothstep(1.5, .25, dd) * step(abs(ip.y - uHero.y), 2.) * hgt;
            if (k > 0.) {
              mat3 im = mat3(instanceMatrix); float sc = length(im[0]);
              vec3 lp = transpose(im) * vec3(d / max(dd, .001), 0.).xzy / (sc * sc);
              transformed.xz += lp.xz * k * .7; transformed.y -= k * .35;
            }
          }
          #endif` : ''}
        }`);
    };
    material.customProgramCacheKey = () => 'wind' + amp + base + freq + gust + push + shade;
    return material;
  }

  const cloudShade = { value: 1 }; // how strongly cloud shadows show (the host sets it from the sky)
  // ── bloom: bright lights (lamps, magic, the sun on water) bleed a soft glow ──
  // render(scene, camera) draws the frame with the glow; the renderer's tone mapping
  // and exposure are applied in the final pass. Falls back to a plain render if unsupported.
  function bloom(renderer, { strength = 0.55, threshold = 0.82 } = {}) {
    const caps = renderer.capabilities;
    // needs half-float render targets (some older phones can't draw into them): otherwise a plain render
    const ext = renderer.extensions;
    if (!caps.isWebGL2 || !(ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float'))) return { render: (s, c) => renderer.render(s, c), enabled: false, strength: { value: 0 } };
    const mk = (w, h, o = {}) => new THREE.WebGLRenderTarget(w, h, Object.assign({ type: THREE.HalfFloatType, depthBuffer: false }, o));
    let W = 0, H = 0, main, a, b;
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), qs = new THREE.Scene(), qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    quad.frustumCulled = false; qs.add(quad);
    const vs = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
    const bright = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null }, uTh: { value: threshold } }, vertexShader: vs, toneMapped: false, depthTest: false,
      fragmentShader: 'uniform sampler2D tSrc; uniform float uTh; varying vec2 vUv; void main() { vec3 c = texture2D(tSrc, vUv).rgb; float l = dot(c, vec3(.2126, .7152, .0722)); gl_FragColor = vec4(c * smoothstep(uTh, uTh + .5, l), 1.); }' });
    const blur = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } }, vertexShader: vs, toneMapped: false, depthTest: false,
      fragmentShader: `uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
        void main() { vec3 c = texture2D(tSrc, vUv).rgb * .227;
          c += (texture2D(tSrc, vUv + uDir * 1.385).rgb + texture2D(tSrc, vUv - uDir * 1.385).rgb) * .316;
          c += (texture2D(tSrc, vUv + uDir * 3.231).rgb + texture2D(tSrc, vUv - uDir * 3.231).rgb) * .07;
          gl_FragColor = vec4(c, 1.); }` });
    const comp = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null }, tBloom: { value: null }, uStr: { value: strength } }, vertexShader: vs, depthTest: false,
      fragmentShader: `uniform sampler2D tSrc, tBloom; uniform float uStr; varying vec2 vUv;
        void main() { gl_FragColor = vec4(texture2D(tSrc, vUv).rgb + texture2D(tBloom, vUv).rgb * uStr, 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }` });
    const size = new THREE.Vector2();
    function fit() {
      renderer.getDrawingBufferSize(size);
      if (size.x === W && size.y === H) return;
      W = size.x; H = size.y;
      [main, a, b].forEach(t => t && t.dispose());
      main = mk(W, H, { depthBuffer: true, samples: Math.min(4, caps.maxSamples || 0) });
      const w4 = Math.max(1, W >> 2), h4 = Math.max(1, H >> 2);
      a = mk(w4, h4); b = mk(w4, h4);
    }
    const pass = (m, target) => { quad.material = m; renderer.setRenderTarget(target); renderer.render(qs, qc); };
    const api = {
      enabled: true, strength: comp.uniforms.uStr,
      render(scene, camera) {
        if (!api.enabled) { renderer.setRenderTarget(null); return renderer.render(scene, camera); }
        fit();
        if (!api.checked) { api.checked = true; renderer.setRenderTarget(main); const gl = renderer.getContext(); if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { api.enabled = false; renderer.setRenderTarget(null); return renderer.render(scene, camera); } }
        renderer.setRenderTarget(main); renderer.render(scene, camera);
        bright.uniforms.tSrc.value = main.texture; pass(bright, a);
        for (let i = 0; i < 2; i++) {
          blur.uniforms.tSrc.value = a.texture; blur.uniforms.uDir.value.set(1 / a.width, 0); pass(blur, b);
          blur.uniforms.tSrc.value = b.texture; blur.uniforms.uDir.value.set(0, 1 / a.height); pass(blur, a);
        }
        comp.uniforms.tSrc.value = main.texture; comp.uniforms.tBloom.value = a.texture; pass(comp, null);
      },
    };
    return api;
  }

  // ── environment: a soft sky-and-ground reflection so metals and gems shine instead of looking dull ──
  // set(top, mid, bot) rebuilds it for the current sky (cheap: a tiny scene, done once per change)
  function skyEnv(renderer, scene, intensity = 0.35) {
    const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
    const u = { uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uBot: { value: new THREE.Color() } };
    es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 24, 12), new THREE.ShaderMaterial({
      uniforms: u, side: THREE.BackSide,
      vertexShader: 'varying vec3 vD; void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: 'uniform vec3 uTop, uMid, uBot; varying vec3 vD; void main() { float y = vD.y; gl_FragColor = vec4(y > 0. ? mix(uMid, uTop, smoothstep(0., .6, y)) : mix(uMid, uBot, smoothstep(0., .3, -y)), 1.); }',
    })));
    let rt = null, key = '';
    if ('environmentIntensity' in scene) scene.environmentIntensity = LOW ? 0 : intensity;
    return {
      set(top, mid, bot) {
        if (LOW) return;
        u.uTop.value.set(top); u.uMid.value.set(mid); u.uBot.value.set(bot);
        const k = u.uTop.value.getHexString() + u.uMid.value.getHexString() + u.uBot.value.getHexString();
        if (k === key) return; key = k;
        const old = rt; rt = pm.fromScene(es, 0.04); scene.environment = rt.texture; if (old) old.dispose();
      },
    };
  }

  // ── rim light: a soft glow along a character's edges so they stand out from the scenery ──
  const rimCol = { value: new THREE.Color(0xfff2d8) }, rimAmt = { value: LOW ? 0 : 0.35 };
  function rim(material) {
    const prev = material.onBeforeCompile;
    material.onBeforeCompile = (sh, r) => {
      if (prev) prev(sh, r);
      sh.uniforms.uRimCol = rimCol; sh.uniforms.uRimAmt = rimAmt;
      sh.fragmentShader = 'uniform vec3 uRimCol; uniform float uRimAmt;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float fr = 1. - max(dot(normalize(vNormal), normalize(vViewPosition)), 0.); totalEmissiveRadiance += uRimCol * pow(fr, 3.) * uRimAmt; }`);
    };
    material.customProgramCacheKey = () => 'rim';
    return material;
  }

  // ── ground: painterly patches of light and shade, warmer and cooler, on any vertex-coloured ground ──
  // the geometry may carry a 'shore' attribute: 1000 + the water level near that point (0, the default, means no water), for wet sand and foam
  function groundDetail(material, { amt = 1.25 } = {}) {
    material.onBeforeCompile = sh => {
      sh.uniforms.uTime = time; sh.uniforms.uCloudShade = cloudShade;
      sh.vertexShader = 'attribute float shore; varying float vShoreY; varying vec3 vGW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vGW = (modelMatrix * vec4(transformed, 1.)).xyz; vShoreY = shore - 1000.;');
      sh.fragmentShader = 'uniform float uTime, uCloudShade;\nvarying vec3 vGW; varying float vShoreY;\n' + NOISE.replace(/OCT/g, '3') + '\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        {
          float n1 = vn(vGW.xz * .07), n2 = vn(vGW.xz * .45 + 3.1), n3 = vn(vGW.xz * 2.3 + 7.7);
          float k = ${amt.toFixed(2)};
          diffuseColor.rgb *= 1. + k * (.2 * (n1 - .5) + .1 * (n2 - .5) + .06 * (n3 - .5));
          // close up: fine grain (grass tufts, pebbles, soil) so the ground reads as a surface, fading out with distance
          float near = smoothstep(45., 6., distance(vGW, cameraPosition));
          if (near > 0.) {
            float f1 = vn(vGW.xz * 7.3), f2 = vn(vGW.xz * 17. + 5.), sp = step(.86, vn(vGW.xz * 11. - 9.));
            diffuseColor.rgb *= 1. + near * k * (.16 * (f1 - .5) + .12 * (f2 - .5) - .1 * sp);
          }
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.1, 1.05, .82), k * smoothstep(.55, .85, n1) * .45);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(.9, 1., 1.08), k * smoothstep(.6, .9, 1. - n1) * .3);
          // the shadows of clouds drifting over the land
          float cs = smoothstep(.5, .72, vn(vGW.xz * .018 + uTime * vec2(.018, .011)) * .7 + vn(vGW.xz * .05 + uTime * vec2(.03, .02)) * .3);
          diffuseColor.rgb *= 1. - cs * .26 * uCloudShade;
          // the shore: wet, darker sand just above the water, and a line of foam lapping at the edge
          {
            float h = vGW.y - vShoreY;
            if (vShoreY > -500. && h > -.4 && h < .9) {
              diffuseColor.rgb *= 1. - .22 * smoothstep(.9, .05, h) * step(0., h);
              float lap = .12 + .1 * sin(uTime * 1.3 + vGW.x * .4 + vGW.z * .3);
              float foam = smoothstep(.1, 0., abs(h - lap)) * (.55 + .45 * vn(vGW.xz * 3. + uTime * .4));
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.95, .97, 1.), foam * .7);
            }
          }
        }`);
    };
    material.customProgramCacheKey = () => 'ground' + amt;
    return material;
  }

  // ── a glowing rune circle on the ground while you face a foe ──
  // show(pos, radius, color) / hide(); update(dt) fades it and turns the runes.
  function arena(scene) {
    const u = { uTime: time, uCol: { value: new THREE.Color(0x9a6aff) }, uFade: { value: 0 } };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv * 2. - 1.; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `uniform float uTime, uFade; uniform vec3 uCol; varying vec2 vUv;
        float h(float n) { return fract(sin(n * 91.7) * 43758.5); }
        void main() {
          float r = length(vUv), a = atan(vUv.y, vUv.x) / 6.2832 + .5;
          if (r > 1.) discard;
          float line = smoothstep(.025, 0., abs(r - .96)) + smoothstep(.015, 0., abs(r - .84)) * .8 + smoothstep(.012, 0., abs(r - .5)) * .6;
          float a1 = fract(a + uTime * .03), tick = step(.82, fract(a1 * 36.)) * step(.86, r) * step(r, .94);
          float a2 = fract(a - uTime * .05), seg = floor(a2 * 18.), cell = fract(a2 * 18.);
          float rune = step(.25, h(seg)) * step(.15, cell) * step(cell, .85) * step(.58, r) * step(r, .76) * step(.4, fract((r - .58) * 11. + h(seg + 3.) * .5));
          float star = smoothstep(.02, 0., abs(sin(a * 6.2832 * 2.5 + uTime * .2) * r - 0.)) * step(r, .5) * .5;
          float glow = exp(-abs(r - .9) * 9.) * .25 + (1. - r) * .06;
          float k = (line + tick + rune * .9 + star + glow) * uFade * (.85 + .15 * sin(uTime * 4.));
          gl_FragColor = vec4(uCol * k, 1.);
        }`,
    }));
    m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 2; scene.add(m);
    let want = 0;
    return {
      show(p, r = 3.5, color = 0x9a6aff) { m.position.set(p.x, p.y + 0.08, p.z); m.scale.setScalar(r); u.uCol.value.set(color); want = 1; m.visible = true; },
      hide() { want = 0; },
      update(dt) { u.uFade.value += (want - u.uFade.value) * Math.min(1, dt * 4); if (!want && u.uFade.value < 0.01) m.visible = false; },
    };
  }

  // ── a pillar of light and a ring of shockwave when a foe is banished ──
  function bursts(scene, max = 4) {
    const cyl = new THREE.CylinderGeometry(0.6, 0.9, 14, 20, 1, true); cyl.translate(0, 7, 0);
    const ring = new THREE.RingGeometry(0.85, 1, 48); ring.rotateX(-Math.PI / 2);
    const pool = [];
    for (let i = 0; i < max; i++) {
      const mk = geo => new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
      const b = { beam: mk(cyl), wave: mk(ring), t: 1 };
      b.beam.visible = b.wave.visible = false; scene.add(b.beam, b.wave); pool.push(b);
    }
    let k = 0;
    return {
      fire(p, color = 0xd8c8ff) {
        const b = pool[k = (k + 1) % max]; b.t = 0;
        for (const m of [b.beam, b.wave]) { m.position.set(p.x, p.y + 0.05, p.z); m.material.color.set(color); m.visible = true; }
      },
      update(dt) {
        for (const b of pool) {
          if (b.t >= 1) continue;
          b.t = Math.min(1, b.t + dt / 1.3); const t = b.t, e = 1 - Math.pow(1 - t, 3);
          b.beam.scale.set(1 - t * 0.8, 0.3 + e * 0.9, 1 - t * 0.8); b.beam.material.opacity = (1 - t) * 0.55;
          b.wave.scale.setScalar(0.5 + e * 7); b.wave.material.opacity = (1 - t) * 0.7;
          if (b.t >= 1) b.beam.visible = b.wave.visible = false;
        }
      },
    };
  }

  // ── life on the water: rings where drops and insects touch it, and the odd fish leaping ──
  // waters() returns the water meshes to look for near the hero; ripple() can also be called directly.
  function pondLife(scene, waters) {
    const ringGeo = new THREE.RingGeometry(0.82, 1, 36); ringGeo.rotateX(-Math.PI / 2);
    const R = [];
    for (let i = 0; i < (LOW ? 8 : 16); i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, opacity: 0 }));
      m.visible = false; m.renderOrder = 3; scene.add(m); R.push({ m, t: 1, s: 1, d: 1.6 });
    }
    let ri = 0;
    function ripple(x, y, z, size = 1, dur = 1.6) {
      const r = R[ri = (ri + 1) % R.length]; r.t = 0; r.s = size; r.d = dur;
      r.m.position.set(x, y + 0.03, z); r.m.visible = true;
    }
    const fish = new THREE.Group(), fm = new THREE.MeshStandardMaterial({ color: 0xe8a040, metalness: 0.3, roughness: 0.4, flatShading: true });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 7, 5), fm); body.scale.set(0.7, 0.9, 2); fish.add(body);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.25, 4), fm); tail.rotation.x = -Math.PI / 2; tail.position.z = -0.38; fish.add(tail);
    fish.visible = false; scene.add(fish);
    const jump = { t: 1, p: new THREE.Vector3(), dx: 0, dz: 0, y: 0 };
    const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), o = new THREE.Vector3();
    let probe = 0, nextFish = 3 + Math.random() * 4, list = [], listT = 0;
    function waterAt(x, z, y0) {
      o.set(x, y0 + 40, z); ray.set(o, down); ray.far = 90;
      const h = ray.intersectObjects(list, false)[0];
      return h ? h.point.y : null;
    }
    function update(dt, c) {
      if ((listT -= dt) <= 0) { listT = 2; list = waters().filter(m => m.visible !== false); }
      for (const r of R) {
        if (r.t >= 1) continue;
        r.t = Math.min(1, r.t + dt / r.d);
        const e = 1 - Math.pow(1 - r.t, 2);
        r.m.scale.setScalar(0.1 + e * r.s); r.m.material.opacity = (1 - r.t) * 0.5;
        if (r.t >= 1) r.m.visible = false;
      }
      if (jump.t < 1) {
        jump.t = Math.min(1, jump.t + dt / 0.9);
        const t = jump.t, x = jump.p.x + jump.dx * t, z = jump.p.z + jump.dz * t, y = jump.y + Math.sin(t * Math.PI) * 1.1 - 0.15;
        fish.position.set(x, y, z); fish.rotation.set(-Math.cos(t * Math.PI) * 1.1, Math.atan2(jump.dx, jump.dz), 0);
        if (t >= 1) { fish.visible = false; ripple(x, jump.y, z, 1.4); }
      }
      if (!list.length || (probe -= dt) > 0) return;
      probe = 0.22;
      // pick a spot on a water surface near the hero
      const near = list.filter(m => { if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere(); m.updateWorldMatrix(true, false); m.userData.ws = m.userData.ws || new THREE.Sphere(); m.userData.ws.copy(m.geometry.boundingSphere).applyMatrix4(m.matrixWorld); return m.userData.ws.distanceToPoint(c) < 25; });
      if (!near.length) return;
      const S = near[Math.floor(Math.random() * near.length)].userData.ws, a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * Math.min(S.radius, 22);
      const x = S.center.x + Math.cos(a) * d, z = S.center.z + Math.sin(a) * d;
      if (Math.hypot(x - c.x, z - c.z) > 26) return;
      const wy = waterAt(x, z, c.y);
      if (wy === null) return;
      ripple(x, wy, z, 0.5 + Math.random() * 0.6, 1.3);
      if ((nextFish -= 0.22) <= 0 && jump.t >= 1) {
        nextFish = 4 + Math.random() * 6;
        const b = Math.random() * 6.283, ex = x + Math.sin(b) * 1.6, ez = z + Math.cos(b) * 1.6;
        if (waterAt(ex, ez, c.y) === null) return;
        Object.assign(jump, { t: 0, dx: ex - x, dz: ez - z, y: wy }); jump.p.set(x, wy, z);
        fm.color.setHex([0xe8a040, 0xc8d0d8, 0xd86a3a][Math.floor(Math.random() * 3)]);
        fish.visible = true; ripple(x, wy, z, 1.2);
      }
    }
    return { ripple, update };
  }

  // ── far mountains: two hazy ranges on the horizon that travel with the camera ──
  function farHills(scene) {
    const G = new THREE.Group(); scene.add(G);
    const layers = [];
    for (const [R, n, hMin, hMax, k] of [[420, 26, 60, 150, 0], [330, 22, 35, 90, 1]]) {
      const pos = [], col = [];
      for (let i = 0; i < n; i++) {
        const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, am = (a0 + a1) / 2 + (Math.sin(i * 7.3 + k) * 0.08);
        const h = hMin + (hMax - hMin) * (0.5 + 0.5 * Math.sin(i * 2.7 + k * 3.1) * Math.cos(i * 1.3));
        const P = a => [Math.cos(a) * R, 0, Math.sin(a) * R];
        const top = [Math.cos(am) * R * 0.97, h, Math.sin(am) * R * 0.97];
        // a peak: one triangle out to each neighbour, with a snowy tip on the tall ones
        for (const tri of [[P(a0), top, P(a1)]]) for (const v of tri) { pos.push(v[0], v[1] - 25, v[2]); col.push(v[1] > 0 ? (h > hMin + (hMax - hMin) * 0.7 ? 1 : 0.5) : 0); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('snow', new THREE.Float32BufferAttribute(col, 1));
      const u = { uCol: { value: new THREE.Color() }, uSky: { value: new THREE.Color() }, uSnow: { value: new THREE.Color(1, 1, 1) } };
      const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
        uniforms: u, side: THREE.DoubleSide, fog: false, depthWrite: false,
        vertexShader: 'attribute float snow; varying float vS; varying float vY; void main() { vS = snow; vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position.z = gl_Position.w * .9998; }',
        fragmentShader: `uniform vec3 uCol, uSky, uSnow; varying float vS; varying float vY;
          void main() { vec3 c = mix(uSky, uCol, smoothstep(-25., 40., vY)); c = mix(c, uSnow, smoothstep(.55, .95, vS) * .55); gl_FragColor = vec4(c, 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          }`,
      }));
      m.frustumCulled = false; m.renderOrder = -9 + k; G.add(m); layers.push(u);
    }
    return {
      group: G,
      // mid: the horizon colour; top: the sky overhead
      setColors(mid, top, stars = 0) {
        const M = new THREE.Color(mid), T = new THREE.Color(top);
        layers.forEach((u, k) => {
          u.uSky.value.copy(M);
          u.uCol.value.copy(M).lerp(T, 0.35 + k * 0.15).multiplyScalar(k ? 0.78 : 0.88);
          u.uSnow.value.copy(M).lerp(new THREE.Color(1, 1, 1), stars > 0.5 ? 0.3 : 0.85);
        });
      },
      update(cam) { G.position.set(cam.x, 0, cam.z); },
    };
  }

  // ── sunbeams: soft shafts of light slanting down among the trees near the hero ──
  // update(dt, center, camera position, ground(x, z), strength 0..1, sunDir)
  function sunShafts(scene, n = LOW ? 0 : 7) {
    const c = document.createElement('canvas'); c.width = 32; c.height = 128; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,240,200,0)'); g.addColorStop(0.25, 'rgba(255,240,200,.9)'); g.addColorStop(1, 'rgba(255,240,200,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 128);
    const h = x.createLinearGradient(0, 0, 32, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
    x.globalCompositeOperation = 'destination-out'; x.fillStyle = h; x.fillRect(0, 0, 32, 128);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, -0.5, 0);
    const S = [];
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(geo, mat); m.visible = false; scene.add(m); S.push({ m, x: 0, z: 0, t: Math.random(), w: 2.5 + Math.random() * 3, set: false }); }
    let fade = 0;
    const dir = new THREE.Vector3(), xA = new THREE.Vector3(), zA = new THREE.Vector3(), basis = new THREE.Matrix4();
    return {
      update(dt, cen, cam, ground, k, sunDir) {
        fade += (k - fade) * Math.min(1, dt * 0.7);
        mat.opacity = fade * 0.26;
        for (const s of S) {
          s.m.visible = fade > 0.02; if (!s.m.visible) continue;
          s.t += dt * 0.05;
          if (!s.set || s.t > 1 || Math.hypot(s.x - cen.x, s.z - cen.z) > 30) {
            const a = Math.random() * 6.283, r = 6 + Math.random() * 18; s.x = cen.x + Math.cos(a) * r; s.z = cen.z + Math.sin(a) * r; s.t = 0; s.set = true;
          }
          const life = Math.sin(s.t * Math.PI);
          dir.set(...(sunDir || [0.35, 0.42, -0.84])).normalize();
          const L = 16;
          s.m.position.set(s.x + dir.x * L, ground(s.x, s.z) + dir.y * L + 1, s.z + dir.z * L);
          s.m.scale.set(s.w * life, L * 1.3, 1);
          // stand the quad along the sun direction, turned to face the camera as far as it can
          zA.copy(cam).sub(s.m.position); zA.addScaledVector(dir, -zA.dot(dir)).normalize();
          xA.crossVectors(dir, zA); basis.makeBasis(xA, dir, zA); s.m.quaternion.setFromRotationMatrix(basis);
        }
      },
    };
  }

  // ── shooting stars streak across the night sky now and then ──
  function shootingStars(scene) {
    const pos = new Float32Array(6), geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array([1, 0.97, 0.88, 0.2, 0.25, 0.4]), 3));
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const line = new THREE.Line(geo, mat); line.frustumCulled = false; line.visible = false; scene.add(line);
    const s = { t: 1, wait: 4, p: new THREE.Vector3(), v: new THREE.Vector3() }, h = new THREE.Vector3();
    return {
      update(dt, cam, night) {
        if (s.t < 1) {
          s.t = Math.min(1, s.t + dt / 0.8);
          h.copy(s.p).addScaledVector(s.v, s.t);
          const len = 6 + Math.sin(s.t * Math.PI) * 22, n = s.v.length();
          pos[0] = h.x; pos[1] = h.y; pos[2] = h.z;
          pos[3] = h.x - s.v.x / n * len; pos[4] = h.y - s.v.y / n * len; pos[5] = h.z - s.v.z / n * len;
          geo.attributes.position.needsUpdate = true;
          mat.opacity = Math.sin(s.t * Math.PI);
          if (s.t >= 1) line.visible = false;
          return;
        }
        if (night < 0.5 || (s.wait -= dt) > 0) return;
        s.wait = 3 + Math.random() * 8;
        const a = Math.random() * 6.283, el = 0.3 + Math.random() * 0.45, R = 170;
        s.p.set(cam.x + Math.cos(a) * Math.cos(el) * R, cam.y + Math.sin(el) * R, cam.z + Math.sin(a) * Math.cos(el) * R);
        const b = a + (Math.random() < 0.5 ? 1.5 : -1.5);
        s.v.set(Math.cos(b) * 70, -20 - Math.random() * 20, Math.sin(b) * 70);
        s.t = 0; line.visible = true;
      },
    };
  }

  // ── footprints that fade behind you on soft ground: step(pos, heading, y) every stride ──
  function footprints(scene, max = LOW ? 0 : 40) {
    const geo = new THREE.CircleGeometry(0.11, 10); geo.rotateX(-Math.PI / 2); geo.scale(1, 1, 1.7);
    const P = [];
    for (let i = 0; i < max; i++) { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x3a2a18, transparent: true, opacity: 0, depthWrite: false })); m.visible = false; m.renderOrder = 1; scene.add(m); P.push({ m, t: 0 }); }
    let k = 0, side = 1;
    return {
      step(p, heading, y, tint = 0x3a2a18) {
        if (!max) return;
        const f = P[k = (k + 1) % max]; side = -side;
        f.m.position.set(p.x + Math.cos(heading) * 0.17 * side, y + 0.03, p.z - Math.sin(heading) * 0.17 * side);
        f.m.rotation.y = heading; f.m.material.color.setHex(tint); f.m.visible = true; f.t = 6;
      },
      update(dt) { for (const f of P) if (f.t > 0) { f.t -= dt; f.m.material.opacity = Math.min(0.28, f.t * 0.08); if (f.t <= 0) f.m.visible = false; } },
    };
  }

  // ── motes of light spiralling into a portal: add vortex() to the portal group, call update(dt) ──
  function vortex(R = 3, n = LOW ? 40 : 90, color = 0xfff0c0) {
    const pos = new Float32Array(n * 3), S = [];
    for (let i = 0; i < n; i++) S.push({ a: Math.random() * 6.283, f: Math.random(), sp: 0.25 + Math.random() * 0.35 });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.34, map: sparkTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.frustumCulled = false;
    pts.userData.update = dt => {
      if (!pts.parent || !pts.parent.visible) return;
      S.forEach((s, i) => {
        s.f += dt * s.sp; if (s.f >= 1) { s.f = 0; s.a = Math.random() * 6.283; }
        s.a += dt * (1 + s.f * 4);
        const r = R * 1.25 * (1 - s.f);
        pos[i * 3] = Math.cos(s.a) * r; pos[i * 3 + 1] = Math.sin(s.a) * r; pos[i * 3 + 2] = 0.15 + (1 - s.f) * 0.6;
      });
      geo.attributes.position.needsUpdate = true;
    };
    return pts;
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
    s.scale.setScalar(size * (1 + nightK * 0.6)); s.material.opacity = Math.min(1, opacity * (1 + nightK * 0.7));
    s.userData.glow = { size, opacity }; glows.push(s);
    return s;
  }
  // lamps and lanterns burn bigger and brighter after dark: k = 0 by day, 1 at night
  const glows = []; let nightK = 0;
  function setNight(k) {
    if (Math.abs(k - nightK) < 0.01) return;
    nightK = k;
    for (let i = glows.length - 1; i >= 0; i--) {
      const s = glows[i];
      if (!s.parent) { glows.splice(i, 1); continue; }
      const g = s.userData.glow; s.scale.setScalar(g.size * (1 + k * 0.6)); s.material.opacity = Math.min(1, g.opacity * (1 + k * 0.7));
    }
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

  // ── the world map: a parchment with a winding road through every region ──
  // items: [{ name, sub, icon, state: 'here' | 'open' | 'done' | 'locked' }]; buttons carry data-wm="i"
  function mapHTML(items) {
    const step = 78, W = 300, H = items.length * step + 40;
    const pts = items.map((_, i) => [W / 2 + Math.sin(i * 1.25 + 0.4) * 82, H - 40 - i * step]);
    let d = `M ${pts[0][0]} ${pts[0][1] + 40}`;
    pts.forEach(([x, y], i) => { const [px, py] = i ? pts[i - 1] : [x, y + 40]; d += ` C ${px} ${py - step * 0.5}, ${x} ${y + step * 0.5}, ${x} ${y}`; });
    const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const reached = items.reduce((n, it, i) => (it.state !== 'locked' ? i : n), 0);
    const trees = Array.from({ length: Math.round(items.length * 2.2) }, (_, k) => { const y = 20 + (k * 53) % (H - 40), x = (k % 2 ? 18 : W - 30) + Math.sin(k * 3.1) * 10; return `<text x="${x}" y="${y}" class="wmap-deco">${['🌲', '🌳', '⛰️', '🌿'][k % 4]}</text>`; }).join('');
    return `<div class="wmap2"><div class="wmap2-in"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="aspect-ratio:${W}/${H}">
      ${trees}
      <path d="${d}" class="wmap-road"/><path d="${d}" class="wmap-dash" style="--len:${H * 2}"/>
      <path d="${d}" class="wmap-walked" pathLength="${items.length}" stroke-dasharray="${reached + 0.02} ${items.length}"/>
      </svg>${items.map((it, i) => `<button class="wm2 ${it.state}" data-wm="${i}" ${it.state === 'locked' ? 'disabled' : ''} style="left:${(pts[i][0] / W * 100).toFixed(1)}%;top:${(pts[i][1] / H * 100).toFixed(1)}%">
        <span class="wm2-dot">${it.state === 'locked' ? '🔒' : it.icon || '•'}</span><span class="wm2-label ${pts[i][0] > W / 2 ? 'left' : ''}"><b>${i + 1}. ${esc(it.name)}</b><small>${esc(it.sub)}</small></span>${it.state === 'here' ? '<span class="wm2-you">🧙</span>' : ''}</button>`).join('')}</div></div>`;
  }

  return { time, hero, footprints, mapHTML, vortex, setNight, skyEnv, bloom, sunShafts, rim, rimCol, rimAmt, setLight, cloudShade, farHills, shootingStars, critters, arena, bursts, pondLife, groundDetail, sky, water, windify, portalMaterial, sparks, glow, blobShadow, heroPose, flyToHUD, tick: t => { time.value = t; } };
}
