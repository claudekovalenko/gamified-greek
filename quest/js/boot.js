// Loads the shared content bundle (the same data/content.json Greek Quest uses,
// kept fresh by tools/sync.mjs), builds the game data from it, then starts the
// engine, the UI and the 3D world in that order.
(async () => {
  'use strict';
  const main = document.getElementById('main');
  try {
    const res = await fetch('../data/content.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const C = await res.json();
    KG.pickChapter(C);
    KG.build(C);
  } catch (e) {
    main.innerHTML = `<div class="loading">Could not load the words and concepts (${String(e.message || e)}). Check your connection and reload.</div>`;
    return;
  }
  const load = (src, module) => new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = src;
    if (module) { s.type = 'module'; s.dataset.world = ''; }
    s.onload = ok; s.onerror = fail;
    document.body.appendChild(s);
  });
  await load('js/engine.js');
  KG.cloudGame = 'going-deeper-quest';
  await load('js/cloud.js');
  // The world module is added first so the UI knows to wait for it; the UI also
  // opens it straight away if it happens to finish loading first.
  load('js/world.js', true).catch(() => document.dispatchEvent(new Event('world-failed')));
  await load('js/app.js');
})();
