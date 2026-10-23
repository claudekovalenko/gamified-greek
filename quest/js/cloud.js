// Cloud save: keeps your progress the same on every device. Turn it on in
// Profile and you get a private sync code; type that code on your other device
// and both stay in step (the newest save wins). The code is shared by the games
// on this site, so one code syncs them all.
// Koine Quest and Going Deeper Quest share this file unchanged; each sets
// KG.cloudGame to its own name before loading it.
(function () {
  'use strict';
  const API = 'https://qtqkxblqlrwgpulnktbs.supabase.co/rest/v1/rpc/', KEY = 'sb_publishable_ISkptLoaTW9NuWYt-33bfQ_r8ENJAR4';
  const CODE_KEY = 'greek-games-sync-code', E = KG.engine, GAME = KG.cloudGame;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const get = () => { try { return localStorage.getItem(CODE_KEY) || ''; } catch (e) { return ''; } };
  const set = c => { try { if (c) localStorage.setItem(CODE_KEY, c); else localStorage.removeItem(CODE_KEY); } catch (e) { /* storage off */ } };
  const st = { busy: false, last: 0, err: '' };
  const rpc = (fn, body, keepalive) => fetch(API + fn, { method: 'POST', keepalive, headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then(r => (r.ok ? r.json() : r.text().then(t => { throw new Error(t || r.status); })));
  // a code that's easy to read out and type: xxxx-xxxx-xxxx-xxxx
  function newCode() {
    const A = 'abcdefghjkmnpqrstuvwxyz23456789', b = new Uint8Array(16);
    crypto.getRandomValues(b);
    return [...b].map(x => A[x % A.length]).join('').replace(/(.{4})(?=.)/g, '$1-');
  }
  const clean = c => String(c || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/(.{4})(?=.)/g, '$1-');

  // every save is stamped, and sent a few seconds later
  const save0 = E.save;
  let pushT = 0;
  E.save = () => { E.state.savedAt = Date.now(); save0(); if (get()) { clearTimeout(pushT); pushT = setTimeout(push, 4000); } };
  function push(keepalive) {
    const code = get(); if (!code) return Promise.resolve();
    clearTimeout(pushT);
    return rpc('game_save', { p_code: code, p_game: GAME, p_data: E.state, p_saved_at: E.state.savedAt || Date.now() }, keepalive)
      .then(() => { st.last = Date.now(); st.err = ''; })
      .catch(e => { st.err = 'offline'; void e; });
  }
  // newer progress from another device replaces this one (after any lesson in progress)
  function pull() {
    const code = get(); if (!code) return Promise.resolve(null);
    return rpc('game_load', { p_code: code, p_game: GAME }).then(rows => {
      st.last = Date.now(); st.err = '';
      const r = rows && rows[0];
      if (!r) { if (E.state.savedAt) push(); return null; }
      if (r.saved_at > (E.state.savedAt || 0) + 1000) apply(r.data);
      else if ((E.state.savedAt || 0) > r.saved_at + 1000) push();
      return r;
    }).catch(() => { st.err = 'offline'; return null; });
  }
  function apply(data) {
    const go = () => {
      if (document.body.classList.contains('playing')) return setTimeout(go, 3000);
      save0.call(null); // keep nothing pending from this device
      E.importState(JSON.stringify(data));
      if (KG.app && KG.app.toast) KG.app.toast('☁️ <b>Progress brought over from your other device.</b>', 'gold');
      setTimeout(() => location.reload(), 900);
    };
    go();
  }
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') push(true); else pull(); });
  addEventListener('online', () => pull());
  setInterval(() => { if (document.visibilityState === 'visible') pull(); }, 120000);
  pull();

  // ── the Profile card ──
  function card() {
    const code = get(), ago = st.last ? Math.max(0, Math.round((Date.now() - st.last) / 60000)) : -1;
    return `<div class="card cloud"><h3>☁️ Save across devices</h3>${code ? `
      <p>Your sync code: <b class="cloud-code">${esc(code)}</b> <button class="btn ghost small" data-cloud="copy">Copy</button></p>
      <p class="muted small">On your other device open Profile → Save across devices → <b>I have a code</b> and type it in. Keep it private: it is the key to your progress.
      ${st.err ? '⚠️ Offline: your progress will sync when you are back online.' : ago >= 0 ? `Synced ${ago ? ago + ' min ago' : 'just now'}.` : ''}</p>
      <div class="row"><button class="btn primary" data-cloud="sync">Sync now</button><button class="btn ghost" data-cloud="off">Stop syncing this device</button></div>` : `
      <p>Keep your progress on your phone, tablet and computer. Turn it on here, then type the code on your other device.</p>
      <div class="row"><button class="btn primary" data-cloud="on">Turn on cloud save</button><button class="btn ghost" data-cloud="enter">I have a code</button></div>`}</div>`;
  }
  const refresh = () => { if (KG.app && location.hash.slice(1) === 'profile') KG.app.go('profile'); };
  const toast = (h, c) => KG.app && KG.app.toast(h, c);
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-cloud]'); if (!b) return;
    ev.preventDefault();
    const a = b.dataset.cloud;
    if (a === 'on') { set(newCode()); E.save(); push().then(() => { toast('☁️ <b>Cloud save is on.</b> Type your code on your other device.', 'gold'); refresh(); }); }
    else if (a === 'enter') {
      const c = clean(prompt('Type the sync code from your other device:') || '');
      if (c.length < 15) { if (c) toast('That code looks too short. It is 16 letters and numbers.'); return; }
      rpc('game_load', { p_code: c, p_game: GAME }).then(rows => {
        const r = rows && rows[0];
        if (r && !confirm(`Bring over your progress from the other device (level ${E.levelInfo(r.data.xp || 0).level}, ${r.data.xp || 0} XP)? It replaces the progress on this device.`)) return;
        set(c);
        if (r) apply(r.data); else { E.save(); push(); toast('☁️ <b>Linked.</b> This device\'s progress is now saved to the cloud.', 'gold'); refresh(); }
      }).catch(() => toast('Could not reach the cloud. Check your connection and try again.'));
    }
    else if (a === 'sync') pull().then(() => push()).then(() => { toast('☁️ Synced.'); refresh(); });
    else if (a === 'copy') { (navigator.clipboard ? navigator.clipboard.writeText(get()) : Promise.reject()).then(() => toast('Code copied.'), () => toast(get())); }
    else if (a === 'off') { if (confirm('Stop syncing on this device? Your progress stays here and in the cloud.')) { set(''); refresh(); } }
  });
  KG.cloud = { card, push, pull, get code() { return get(); } };
})();
