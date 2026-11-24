/* ═══ MYO — EXERCISE VIDEOS via the YMove Exercise API (https://ymove.app/exercise-api) ═══
   Training page: a "Video" button on every exercise and a searchable video library.
   Connection: the member's (or Merakinetics') own YMove key, kept in this browser only, or a proxy URL.
   YMove asks that production apps proxy the key server-side, so the proxy route is the one to ship.
   Video URLs are signed and expire after 48 h: they are fetched fresh on every open and never stored.
   Only exercise IDs (name → YMove id) and static thumbnails are cached. */
(function () {
  'use strict';
  const { esc, icon } = OS;
  const BASE = 'https://exercise-api.ymove.app/api/v2';
  const LS = 'myo-ymove';
  const load = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } };
  const save = (o) => { try { localStorage.setItem(LS, JSON.stringify(o)); } catch {} };
  const V = { cfg: load(), results: null, q: '', muscle: '', groups: null, busy: false, err: '', idMap: load().ids || {} };
  const connected = () => !!(V.cfg.key || V.cfg.proxy);

  async function api(path, params = {}) {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString();
    const root = V.cfg.proxy ? V.cfg.proxy.replace(/\/$/, '') : BASE;
    let r;
    try { r = await fetch(`${root}${path}${qs ? '?' + qs : ''}`, { headers: V.cfg.proxy ? {} : { 'X-API-Key': V.cfg.key } }); }
    catch (e) { throw new Error('Could not reach YMove from this viewer. If you are inside Claude, the page may block outside connections; the deployed app can reach it.'); }
    let body = null; try { body = await r.json(); } catch {}
    if (r.status === 401) throw new Error('YMove rejected the key. Check it in the connection settings.');
    if (r.status === 429) throw new Error(`YMove rate limit reached. Try again in ${Math.ceil(((body && body.retryAfterMs) || 30000) / 1000)} s.`);
    if (!r.ok) throw new Error((body && (body.error || body.message)) || `YMove error ${r.status}`);
    return body;
  }
  const list = (b) => (Array.isArray(b) ? b : (b && (b.data || b.exercises || b.items || b.results)) || []);
  // Strip Merakinetics machine names so "APS Shoulder Press" finds "Shoulder Press"
  const term = (name) => name.replace(/\b(APS|ISO Flow|MK-Pro|Merakinetics|Machine 2\.0)\b/gi, '').replace(/\s+/g, ' ').trim();

  /* ── player modal ─────────────────────────────────────────────────── */
  let modal = null;
  function close() { if (!modal) return; const v = modal.querySelector('video'); if (v) v.pause(); modal.remove(); modal = null; document.removeEventListener('keydown', onKey); }
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function shell(inner) {
    close();
    modal = document.createElement('div'); modal.className = 'yv-modal'; modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-label', 'Exercise video');
    modal.innerHTML = `<div class="yv-box"><button class="icon-btn yv-x" aria-label="Close video">${icon('x', 18)}</button><div class="yv-in">${inner}</div></div>`;
    modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('.yv-x')) close(); });
    document.body.appendChild(modal); document.addEventListener('keydown', onKey); modal.querySelector('.yv-x').focus();
  }
  function play(ex, label) {
    const vids = (ex.videos || []).filter((v) => v.videoUrl);
    const primary = vids.find((v) => v.isPrimary) || vids[0] || (ex.videoUrl ? { videoUrl: ex.videoUrl, thumbnailUrl: ex.thumbnailUrl } : null);
    const th = ex.thumbnails || {};
    shell(`<div class="yv-media">${primary ? `<video controls playsinline autoplay muted loop preload="metadata" poster="${esc(primary.thumbnailUrl || th.landscape || ex.thumbnailUrl || '')}" src="${esc(primary.videoUrl)}"></video>`
        : `<div class="yv-nov">${th.landscape || ex.thumbnailUrl ? `<img src="${esc(th.landscape || ex.thumbnailUrl)}" alt="">` : ''}<p>No video on your YMove plan for this exercise.</p></div>`}</div>
      ${vids.length > 1 ? `<div class="seg yv-angles">${vids.map((v, i) => `<button class="${v === primary ? 'on' : ''}" data-yv-src="${esc(v.videoUrl)}">${esc(v.tag || v.orientation || 'Angle ' + (i + 1))}</button>`).join('')}</div>` : ''}
      <div class="yv-meta"><div><p class="eyebrow">${esc(label ? `For: ${label}` : 'YMove exercise')}</p><h2>${esc(ex.title || 'Exercise')}</h2>
        <p class="muted small">${esc([ex.muscleGroup, ...(ex.secondaryMuscles || [])].filter(Boolean).join(' · '))}${ex.equipment ? ` · ${esc(ex.equipment)}` : ''}${ex.difficulty ? ` · ${esc(ex.difficulty)}` : ''}</p></div>
        ${(ex.instructions || []).length ? `<ol class="yv-steps">${ex.instructions.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>` : ex.description ? `<p>${esc(ex.description)}</p>` : ''}
        ${(ex.importantPoints || []).length ? `<ul class="ath-list">${ex.importantPoints.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        <p class="fine">Video and instructions by YMove.</p></div>`);
    const vid = modal.querySelector('video');
    if (vid) vid.addEventListener('error', () => { const m = vid.closest('.yv-media'); m.innerHTML = `<div class="yv-nov"><p>The video could not play here. The link may have expired or this viewer blocks the stream.</p><a class="btn sm" href="${esc(primary.videoUrl)}" target="_blank" rel="noopener">Open video in a new tab</a></div>`; }, { once: true });
    modal.querySelectorAll('[data-yv-src]').forEach((b) => b.addEventListener('click', () => { const v = modal.querySelector('video'); if (v) { v.src = b.dataset.yvSrc; v.play().catch(() => {}); } modal.querySelectorAll('[data-yv-src]').forEach((x) => x.classList.toggle('on', x === b)); }));
  }
  function loading(label) { shell(`<div class="yv-media"><div class="yv-nov"><p>Finding a video for ${esc(label)}…</p></div></div>`); }
  function fail(msg) { shell(`<div class="yv-media"><div class="yv-nov"><p>${esc(msg)}</p></div></div>`); }

  async function openByName(name) {
    if (!connected()) { V.err = ''; OS.go('training'); setTimeout(() => { const k = document.getElementById('yv-key'); if (k) { k.scrollIntoView({ block: 'center' }); k.focus(); } }, 60); OS.toast('Connect YMove first to stream exercise videos.'); return; }
    loading(name);
    try {
      let id = V.idMap[name];
      if (!id) {
        const res = list(await api('/exercises', { search: term(name), hasVideo: true, pageSize: 5 }));
        if (!res.length) { fail(`YMove has no video match for "${term(name)}". Try the library search.`); return; }
        id = res[0].id; V.idMap[name] = id; V.cfg.ids = V.idMap; save(V.cfg);
      }
      const ex = await api(`/exercises/${encodeURIComponent(id)}`);
      play(ex && (ex.data || ex), name);
    } catch (e) { fail(e.message); }
  }

  /* ── Training page card ───────────────────────────────────────────── */
  function card() {
    if (!connected()) return `<section class="card yv-card"><div class="card-h"><h2>Exercise video library</h2><span class="chip">YMove</span></div>
      <p class="small">Stream a coaching video for every exercise: 2,000+ demos with steps, muscles and equipment from the YMove Exercise API.</p>
      <form class="bench yv-conn" data-submit="yv-connect">
        <label class="field" for="yv-key"><span>YMove API key <em>starts with ym_</em></span><input id="yv-key" name="key" type="password" autocomplete="off" spellcheck="false" placeholder="ym_…"></label>
        <label class="field" for="yv-proxy"><span>or proxy URL <em>Merakinetics backend</em></span><input id="yv-proxy" name="proxy" type="url" placeholder="https://api.merakinetics…/ymove"></label>
        <button class="btn sm">Connect</button></form>
      <p class="fine">Get a key (7-day trial) at <a href="https://ymove.app/exercise-api" target="_blank" rel="noopener">ymove.app/exercise-api</a>. A key stays in this browser only and is never synced. For the app you ship, put the key behind a proxy, as YMove requires; then only the proxy URL goes here.</p></section>`;
    const g = V.groups || [];
    const rows = (V.results || []).map((x) => { const t = (x.thumbnails && (x.thumbnails.square || x.thumbnails.default)) || x.thumbnailUrl; return `<button class="yv-item" data-act="yv-open" data-id="${esc(x.id)}" data-title="${esc(x.title || '')}">${t ? `<img src="${esc(t)}" alt="" loading="lazy">` : '<span class="yv-ph"></span>'}<span><b>${esc(x.title || '')}</b><em>${esc([x.muscleGroup, x.equipment].filter(Boolean).join(' · '))}</em></span>${x.hasVideo === false ? '' : `<i>${icon('play', 12)}</i>`}</button>`; }).join('');
    return `<section class="card yv-card"><div class="card-h"><h2>Exercise video library</h2><span class="chip">YMove · ${V.cfg.proxy ? 'proxy' : 'key on this device'}</span></div>
      <form class="yv-search" data-submit="yv-search"><input name="q" value="${esc(V.q)}" placeholder="Search exercises, e.g. Romanian deadlift" aria-label="Search exercise videos">
        <select name="muscle" aria-label="Muscle group"><option value="">All muscles</option>${g.map((m) => { const n = m.name || m.value || m.muscleGroup || m; return `<option ${n === V.muscle ? 'selected' : ''}>${esc(n)}</option>`; }).join('')}</select>
        <button class="btn sm" ${V.busy ? 'disabled' : ''}>${V.busy ? 'Searching…' : 'Search'}</button></form>
      ${V.err ? `<p class="small" style="color:var(--bad)">${esc(V.err)}</p>` : ''}
      ${V.results ? (rows ? `<div class="yv-list">${rows}</div>` : '<p class="muted small">No matches.</p>') : '<p class="muted small">Tap <b>Video</b> on any exercise in today\'s session, or search the library.</p>'}
      <div class="row yv-foot"><span class="fine">Videos stream fresh from YMove each time; links are never stored.</span><button class="link small" data-act="yv-disconnect">Disconnect</button></div></section>`;
  }
  const videoBtn = (name) => `<button class="btn ghost sm" data-act="yv-ex" data-name="${esc(name)}">${icon('play', 14)} Video</button>`;

  /* ── actions ─────────────────────────────────────────────────────── */
  async function groups() { try { const b = await api('/exercises/muscle-groups'); V.groups = list(b).length ? list(b) : Array.isArray(b && b.muscleGroups) ? b.muscleGroups : []; } catch { V.groups = []; } if (OS.current === 'training') OS.render(); }
  OS.act('yv-connect', async (f) => {
    const key = (f.key.value || '').trim(), proxy = (f.proxy.value || '').trim();
    if (!key && !proxy) { OS.toast('Paste a YMove key or a proxy URL.'); return; }
    if (proxy && !/^https:\/\//.test(proxy)) { OS.toast('The proxy URL must start with https://'); return; }
    V.cfg = { key: proxy ? '' : key, proxy, ids: {} }; V.idMap = {};
    try { await api('/exercises', { pageSize: 1 }); save(V.cfg); V.err = ''; OS.toast('YMove connected'); groups(); }
    catch (e) { V.cfg = {}; OS.toast(e.message); }
    OS.render();
  });
  OS.act('yv-disconnect', () => { V.cfg = {}; V.idMap = {}; V.results = null; V.groups = null; try { localStorage.removeItem(LS); } catch {} OS.render(); OS.toast('YMove disconnected; the key was removed from this browser.'); });
  OS.act('yv-search', async (f) => {
    V.q = f.q.value.trim().slice(0, 80); V.muscle = f.muscle.value; V.busy = true; V.err = ''; OS.render();
    try { V.results = list(await api('/exercises', { search: V.q, muscleGroup: V.muscle, pageSize: 24 })); }
    catch (e) { V.err = e.message; }
    V.busy = false; OS.render();
  });
  OS.act('yv-open', async (el) => { loading(el.dataset.title || 'this exercise'); try { const ex = await api(`/exercises/${encodeURIComponent(el.dataset.id)}`); play(ex && (ex.data || ex)); } catch (e) { fail(e.message); } });
  OS.act('yv-ex', (el) => openByName(el.dataset.name));
  if (connected()) groups();

  OS.Videos = { card, videoBtn, openByName, connected, term };
})();
