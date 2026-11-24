/* ═══ MYOKINETICS OS v4 — LOOK: colour schemes, light/dark mode, motion ═══
   Eight schemes (Clinical is the default), each with a light and a dark palette (tokens in index.html, contrast-checked by tools/schemes.js).
   The choice is a per-viewer convenience, so it lives in localStorage (myo-look). The inline snippet after
   the stylesheet applies it before first paint; this module owns the header picker.
   Mode "auto" follows the device, or the explicit theme Claude's viewer sets on <html>. */
(function () {
  'use strict';
  const KEY = 'myo-look', root = document.documentElement;
  const SW = [{"id":"clinical","name":"Clinical","note":"White, navy, blue","l":["#f4f7fd","#c9dbff","#cfeefa","#0a1c3d","#0a1c3d"],"d":["#0b1119","#1e3a8a","#0e4a5c","#f1f5fb","#f1f5fb"]},{"id":"electric","name":"Electric","note":"Blue lab, living figure","l":["#0a2391","#1d4ed8","#38bdf8","#0b1533","#1b2b66"],"d":["#020822","#1d4ed8","#0891b2","#f2f5ff","#d9e2ff"]},{"id":"cobalt","name":"Cobalt","note":"Myo blue + cyan","l":["#f2f5fb","#3b82f6","#06b6d4","#1d4ed8","#0e7490"],"d":["#050a1a","#2563eb","#0891b2","#6b97ff","#38bdf8"]},{"id":"aurora","name":"Aurora","note":"Violet into cyan","l":["#f6f4fd","#8b5cf6","#22d3ee","#6d28d9","#0f766e"],"d":["#07051a","#7c3aed","#0891b2","#a78bfa","#22d3ee"]},{"id":"synapse","name":"Synapse","note":"Magenta + indigo","l":["#fbf4fa","#ec4899","#6366f1","#be185d","#6d28d9"],"d":["#0f0410","#db2777","#4f46e5","#f472b6","#a78bfa"]},{"id":"biolume","name":"Biolume","note":"Deep-sea teal","l":["#f1f8f7","#14b8a6","#22d3ee","#0f766e","#0e7490"],"d":["#021211","#0d9488","#0891b2","#2dd4bf","#67e8f9"]},{"id":"solar","name":"Solar","note":"Ember + coral","l":["#fbf6f1","#f97316","#f43f5e","#c2410c","#be123c"],"d":["#110904","#ea580c","#be123c","#fb923c","#fb7185"]},{"id":"graphite","name":"Graphite","note":"Pure monochrome","l":["#f4f4f5","#a1a1aa","#d4d4d8","#18181b","#3f3f46"],"d":["#08080a","#3f3f46","#52525b","#fafafa","#d4d4d8"]}];
  const DEF = { scheme: 'clinical', mode: 'auto', fx: 'full' };
  const MODES = [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], FX = [['full', 'Full'], ['calm', 'Calm']];
  let look = read(), host = window.__myoHost || null, lastSet = root.getAttribute('data-theme');

  function read() {
    try { const v = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; return { scheme: SW.some((s) => s.id === v.scheme) ? v.scheme : DEF.scheme, mode: MODES.some((m) => m[0] === v.mode) ? v.mode : DEF.mode, fx: v.fx === 'calm' ? 'calm' : 'full' }; }
    catch { return { ...DEF }; }
  }
  function write() { try { localStorage.setItem(KEY, JSON.stringify(look)); } catch { /* per-viewer only */ } }
  const isDark = () => { const t = root.getAttribute('data-theme'); return t === 'dark' || (t !== 'light' && !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches)); };
  function apply() {
    root.setAttribute('data-scheme', look.scheme); root.setAttribute('data-fx', look.fx);
    if (look.mode === 'auto') { if (host) root.setAttribute('data-theme', host); else root.removeAttribute('data-theme'); }
    else root.setAttribute('data-theme', look.mode);
    lastSet = root.getAttribute('data-theme');
  }

  const btn = document.getElementById('look-btn'), box = document.getElementById('look-pop');
  if (!btn || !box) return;
  btn.innerHTML = OS.icon('palette', 18);
  const seg = (act, list, cur, label) => `<div class="seg" role="group" aria-label="${label}">${list.map(([v, l]) => `<button type="button" class="${cur === v ? 'on' : ''}" data-act="${act}" data-v="${v}" aria-pressed="${cur === v}">${l}</button>`).join('')}</div>`;
  function pop() {
    const dark = isDark();
    return `<div class="lk-h"><b>Appearance</b><span class="muted small">Saved on this device</span></div>
      <div class="lk-grid" role="group" aria-label="Colour scheme">${SW.map((s) => { const c = dark ? s.d : s.l; return `<button type="button" class="lk-sw" data-act="look-scheme" data-v="${s.id}" aria-pressed="${look.scheme === s.id}"><span class="lk-prev" style="--a:${c[0]};--b:${c[1]};--c:${c[2]};--d:${c[3]};--e:${c[4]}" aria-hidden="true"></span><span class="lk-t"><b>${s.name}</b><small>${s.note}</small></span></button>`; }).join('')}</div>
      <div class="lk-row"><span>Mode</span>${seg('look-mode', MODES, look.mode, 'Light or dark mode')}</div>
      <div class="lk-row"><span>Motion</span>${seg('look-fx', FX, look.fx, 'Background motion')}</div>
      <p class="fine">Auto follows your device, or the theme you picked in Claude. Calm stops the drifting background.</p>`;
  }
  function open(v) {
    box.hidden = !v; btn.setAttribute('aria-expanded', String(v));
    if (v) { box.innerHTML = pop(); const f = box.querySelector('.lk-sw[aria-pressed="true"]'); if (f) f.focus(); }
  }
  function set(patch, act, v) {
    Object.assign(look, patch); write(); apply();
    if (!box.hidden) { box.innerHTML = pop(); const f = box.querySelector(`[data-act="${act}"][data-v="${v}"]`); if (f) f.focus(); }
    OS.render(); // canvases read colours when they mount
  }
  OS.act('look-scheme', (el) => { set({ scheme: el.dataset.v }, 'look-scheme', el.dataset.v); const s = SW.find((x) => x.id === el.dataset.v); OS.toast(`${s.name} scheme on`); });
  OS.act('look-mode', (el) => set({ mode: el.dataset.v }, 'look-mode', el.dataset.v));
  OS.act('look-fx', (el) => set({ fx: el.dataset.v }, 'look-fx', el.dataset.v));

  btn.addEventListener('click', (e) => { e.stopPropagation(); open(box.hidden); });
  document.addEventListener('click', (e) => { if (box.hidden || !e.target.isConnected || box.contains(e.target) || btn.contains(e.target)) return; open(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !box.hidden) { open(false); btn.focus(); } });

  // the viewer's own theme choice wins: if Claude changes <html data-theme>, drop back to Auto
  new MutationObserver(() => {
    const t = root.getAttribute('data-theme');
    if (t === lastSet) return;
    host = t; lastSet = t;
    if (look.mode !== 'auto') { look.mode = 'auto'; write(); }
    if (!box.hidden) box.innerHTML = pop();
    if (OS.state) OS.render();
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  if (window.matchMedia) { const mq = matchMedia('(prefers-color-scheme: dark)'); const on = () => { if (look.mode !== 'auto') return; if (!box.hidden) box.innerHTML = pop(); if (OS.state) OS.render(); }; if (mq.addEventListener) mq.addEventListener('change', on); }

  apply();
  OS.look = { get: () => ({ ...look }), schemes: SW.map((s) => ({ id: s.id, name: s.name })) };
})();
