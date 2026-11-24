/* ═══ MYO — WEARABLES: Oura Ring + WHOOP integration ═══
   Three ways in, all normalised to one daily record per source:
   1. File import (works everywhere, no keys): the member's own Oura or WHOOP export (CSV or JSON), or saved API JSON.
   2. API via the Merakinetics proxy (production): OAuth tokens live server-side; the page calls
      {proxy}/oura/v2/usercollection/* and {proxy}/whoop/v2/*. Oura's API refuses browser calls (no CORS),
      and WHOOP requires the client secret server-side, so production must use the proxy.
   3. WHOOP access token (developer testing): WHOOP's API accepts browser calls with a Bearer token.
   Verified against Oura API v2 (OpenAPI 1.43) and WHOOP API v2 docs, 2026-11.
   The chosen source drives vitals → readiness → MK Score, protocol gating, Coach, Longevity and Function. */
(function () {
  'use strict';
  const { esc, pill, icon, clamp, dayKey, addDays } = OS;
  const LS = 'myo-wear';
  const cfg = (() => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } })();
  // a hosted build can set the proxy once in js/config.js (MYO_CONFIG.wearablesProxy); a value saved on this device wins
  if (!cfg.proxy && window.MYO_CONFIG && window.MYO_CONFIG.wearablesProxy) cfg.proxy = window.MYO_CONFIG.wearablesProxy;
  const saveCfg = () => { try { localStorage.setItem(LS, JSON.stringify(cfg)); } catch {} };
  const SRC = {
    oura: { n: 'Oura Ring', score: 'Readiness', sleep: 'Sleep score', give: ['Readiness and sleep scores', 'Average nightly HRV', 'Lowest resting HR', 'Sleep stages and duration', 'Temperature deviation', 'SpO₂ and breathing rate', 'Steps and calories'] },
    whoop: { n: 'WHOOP', score: 'Recovery', sleep: 'Sleep performance', give: ['Recovery score', 'HRV (RMSSD) and resting HR', 'Day strain and energy', 'Sleep performance and stages', 'Skin temperature', 'SpO₂ and respiratory rate'] }
  };
  const KEEP_DAYS = 180;

  function ensure(s) {
    if (!s.wear) s.wear = { oura: { via: null, at: null, days: [] }, whoop: { via: null, at: null, days: [] }, primary: 'auto', insight: null };
    return s.wear;
  }

  /* ── parsing: CSV / JSON / API-shaped records → daily rows ───────── */
  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    const rows = []; let row = [], f = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; } else f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    const head = (rows.shift() || []).map((h) => h.trim());
    return rows.filter((r) => r.some((x) => x.trim())).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
  }
  const nk = (k) => String(k).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  function flat(o, pre = '', out = {}) {
    for (const [k, v] of Object.entries(o || {})) {
      const key = pre ? pre + '_' + nk(k) : nk(k);
      if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, key, out); else if (!Array.isArray(v)) out[key] = v;
    }
    return out;
  }
  // collect record-like objects from any JSON shape (API pages, export bundles, arrays)
  function records(json) {
    const out = [];
    const walk = (x, depth) => {
      if (depth > 4 || !x) return;
      if (Array.isArray(x)) { if (x.length && typeof x[0] === 'object' && !Array.isArray(x[0])) x.forEach((r) => out.push(r)); else x.forEach((y) => walk(y, depth + 1)); return; }
      if (typeof x === 'object') for (const v of Object.values(x)) walk(v, depth + 1);
    };
    walk(json, 0); return out;
  }
  const num = (v) => { if (v == null || v === '') return null; const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : null; };
  const hours = (v, key) => { const x = num(v); if (x == null) return null; if (/milli/.test(key)) return x / 3.6e6; if (/(^|_)min(utes)?(_|$)/.test(key)) return x / 60; if (/(^|_)sec(onds)?(_|$)/.test(key) || x > 1000) return x / 3600; if (x > 24) return x / 60; return x; };
  function dateOf(f) {
    const order = ['day', 'summary_date', 'date', 'calendar_date', 'wake_onset', 'cycle_start_time', 'sleep_onset', 'bedtime_end', 'end', 'created_at', 'start', 'timestamp'];
    for (const k of order) {
      const v = f[k]; if (!v) continue;
      const m = String(v).match(/(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}))?/); if (!m) continue;
      let d = `${m[1]}-${m[2]}-${m[3]}`;
      if (['cycle_start_time', 'sleep_onset', 'start'].includes(k) && m[4] != null && +m[4] >= 12) d = dayKey(addDays(new Date(d + 'T12:00:00'), 1));
      return d;
    }
    return null;
  }
  function mapRecord(raw) {
    const f = flat(raw), keys = Object.keys(f).filter((k) => !/contributors|delta|trend|balance|_items|target|goal/.test(k)), has = (k) => k in f;
    const d = dateOf(f); if (!d) return null;
    if (f.nap === true || f.nap === 'true' || f.type === 'deleted' || f.type === 'rest' || f.type === 'late_nap') return null;
    const r = { d };
    const isReady = has('temperature_deviation'), isDailySleep = has('score') && Object.keys(f).some((k) => /^contributors_(deep_sleep|rem_sleep|total_sleep)/.test(k));
    for (const k of keys) {
      const v = f[k];
      if (/(^|_)(recovery_score|readiness_score)$/.test(k) || (isReady && k === 'score') || k === 'readiness_score') r.score = num(v);
      else if ((/sleep_score$|sleep_performance/.test(k)) || (isDailySleep && k === 'score')) r.sleepScore = num(v);
      else if (/heart_rate_variability|average_hrv|hrv_rmssd|^hrv$|^rmssd$|^average_hrv_ms$/.test(k)) r.hrv = num(v);
      else if (/resting_heart_rate|lowest_heart_rate|hr_lowest|lowest_resting/.test(k)) r.rhr = num(v);
      else if (/asleep_duration|total_sleep_duration|^total_sleep$|^sleep_duration/.test(k)) r.sleepH = hours(v, k);
      else if (/(deep|slow_wave).*(duration|time)/.test(k)) r.deepH = hours(v, k);
      else if (/rem.*(duration|time)/.test(k) && !/remaining/.test(k)) r.remH = hours(v, k);
      else if (/day_strain|score_strain|^strain$/.test(k)) r.strain = num(v);
      else if (/total_calories|energy_burned/.test(k)) r.kcal = num(v);
      else if (/kilojoule/.test(k)) { const x = num(v); r.kcal = x != null ? x / 4.184 : null; }
      else if (/active_calories/.test(k) && r.kcal == null) r.kcal = num(v);
      else if (/(^|_)steps$|step_count/.test(k)) r.steps = num(v);
      else if (/^temperature_deviation$|temperature_deviation_c/.test(k)) r.tempDev = num(v);
      else if (/skin_temp/.test(k)) r.skinTemp = num(v);
      else if (/spo2_percentage(_average)?$|blood_oxygen|^spo2$/.test(k)) r.spo2 = num(v);
      else if (/respiratory_rate|average_breath|breath_average/.test(k)) r.resp = num(v);
    }
    // WHOOP API sleep: asleep = in bed − awake − no data
    if (r.sleepH == null && has('score_stage_summary_total_in_bed_time_milli')) r.sleepH = (num(f.score_stage_summary_total_in_bed_time_milli) - (num(f.score_stage_summary_total_awake_time_milli) || 0) - (num(f.score_stage_summary_total_no_data_time_milli) || 0)) / 3.6e6;
    return Object.keys(r).length > 1 ? r : null;
  }
  function mergeDays(existing, recs) {
    const by = new Map(existing.map((x) => [x.d, { ...x }]));
    let n = 0;
    for (const r of recs) {
      const cur = by.get(r.d) || { d: r.d };
      const sleepy = ['sleepH', 'hrv', 'rhr', 'deepH', 'remH', 'resp'];
      const longer = r.sleepH == null || cur.sleepH == null || r.sleepH >= cur.sleepH;   // keep the main sleep, not naps
      for (const [k, v] of Object.entries(r)) { if (k === 'd' || v == null || !isFinite(v)) continue; if (sleepy.includes(k) && !longer && cur[k] != null) continue; cur[k] = Math.round(v * 100) / 100; }
      by.set(r.d, cur); n++;
    }
    const days = [...by.values()].sort((a, b) => a.d.localeCompare(b.d)).slice(-KEEP_DAYS);
    return { days, n };
  }
  async function readFiles(files) {
    const recs = []; let skipped = 0, zip = false;
    for (const f of files) {
      if (/\.zip$/i.test(f.name)) { zip = true; continue; }
      const text = await f.text();
      try {
        const t = text.trim();
        const raw = t.startsWith('{') || t.startsWith('[') ? records(JSON.parse(t)) : parseCSV(text);
        raw.forEach((x) => { const r = mapRecord(x); if (r) recs.push(r); else skipped++; });
      } catch (e) { skipped++; }
    }
    return { recs, skipped, zip };
  }

  /* ── vitals: the chosen source drives readiness across the OS ────── */
  const mean = (xs) => { const v = xs.filter((x) => x != null && isFinite(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  function primaryOf(W) {
    if (W.primary === 'oura' && W.oura.days.length) return 'oura';
    if (W.primary === 'whoop' && W.whoop.days.length) return 'whoop';
    const lo = W.oura.days.slice(-1)[0], lw = W.whoop.days.slice(-1)[0];
    if (lo && lw) return lw.d > lo.d ? 'whoop' : 'oura';
    return lo ? 'oura' : lw ? 'whoop' : null;
  }
  function applyVitals(s) {
    const W = ensure(s), p = primaryOf(W); if (!p) return;
    if (!W.backup) W.backup = { v: JSON.parse(JSON.stringify(s.vitals)), w: { ...s.wearables } };   // restored if every source is removed
    const days = W[p].days, L = [...days].reverse().find((x) => x.hrv != null || x.sleepH != null); if (!L) return;
    const prior = days.filter((x) => x.d < L.d).slice(-30), v = s.vitals, r1 = (x) => Math.round(x * 10) / 10;
    if (L.hrv != null) { v.hrv = Math.round(L.hrv); v.hrvBase = Math.round(mean(prior.map((x) => x.hrv)) || L.hrv); v.hrvTrend = days.filter((x) => x.hrv != null).slice(-7).map((x) => Math.round(x.hrv)); }
    if (L.rhr != null) { v.rhr = Math.round(L.rhr); v.rhrBase = Math.round(mean(prior.map((x) => x.rhr)) || L.rhr); }
    if (L.sleepH != null) v.sleepH = r1(L.sleepH);
    if (L.sleepScore != null) v.sleepScore = Math.round(L.sleepScore);
    if (L.steps != null) v.steps = Math.round(L.steps);
    v.src = `${SRC[p].n} · ${W[p].via === 'sample' ? 'sample data' : W[p].via === 'file' ? 'imported file' : 'API'} · ${L.d}`;
    s.wearables[p] = true;
  }

  /* ── sample data (clearly labelled) ──────────────────────────────── */
  function sampleDays(src) {
    let seed = src === 'oura' ? 5 : 9; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
    return [...Array(45)].map((_, i) => {
      const d = dayKey(addDays(new Date(), i - 44)), wk = Math.sin(i / 3.2), hrv = 64 + wk * 6 + r() * 8 + i * 0.08;
      const base = { d, hrv: hrv * (src === 'whoop' ? 1.08 : 1), rhr: 55 - wk * 2 + r() * 2, sleepH: 7.3 + r() * 1.1 + wk * 0.2, deepH: 1.3 + r() * 0.3, remH: 1.7 + r() * 0.4, resp: 14.6 + r() * 0.6, spo2: 96.5 + r() };
      return src === 'oura' ? { ...base, score: clamp(78 + wk * 8 + r() * 10, 40, 99), sleepScore: clamp(80 + r() * 14, 50, 99), tempDev: r() * 0.4, steps: 8200 + r() * 4000, kcal: 2500 + r() * 400 }
        : { ...base, score: clamp(66 + wk * 18 + r() * 16, 15, 99), sleepScore: clamp(84 + r() * 18, 50, 100), strain: clamp(11 + r() * 8, 2, 20), kcal: 2600 + r() * 600, skinTemp: 33.6 + r() * 0.5 };
    }).map((x) => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * 100) / 100 : v])));
  }

  /* ── charts: one axis each, two series max, hover crosshair ──────── */
  const CH = {};
  function lineChart(id, title, unit, keyF, W, n = 30, cap = Infinity) {
    const end = dayKey(), dates = [...Array(n)].map((_, i) => dayKey(addDays(new Date(), i - n + 1)));
    const series = ['oura', 'whoop'].filter((k) => W[k].days.length).map((k) => { const by = new Map(W[k].days.map((x) => [x.d, x])); return { k, name: SRC[k].n, pts: dates.map((d) => { const x = by.get(d); const v = x ? keyF(x) : null; return v == null || !isFinite(v) ? null : v; }) }; }).filter((sr) => sr.pts.some((v) => v != null));
    if (!series.length) return `<figure class="wv-chart"><figcaption>${esc(title)}</figcaption><p class="muted small">No ${esc(title.toLowerCase())} data in the last ${n} days.</p></figure>`;
    const vals = series.flatMap((sr) => sr.pts.filter((v) => v != null)); let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * 0.15 || 2; lo = Math.max(0, lo - pad); hi = Math.min(cap, hi + pad);
    const w = 320, h = 150, l = 34, r = 12, t = 10, b = 22, X = (i) => l + (i / (n - 1)) * (w - l - r), Y = (v) => t + (1 - (v - lo) / (hi - lo)) * (h - t - b);
    const ticks = [lo, (lo + hi) / 2, hi].map((v) => `<line x1="${l}" x2="${w - r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="wv-grid"/><text x="${l - 6}" y="${(Y(v) + 3.5).toFixed(1)}" text-anchor="end" class="wv-ax">${Math.round(v)}</text>`).join('');
    const paths = series.map((sr) => { let dStr = '', pen = false; sr.pts.forEach((v, i) => { if (v == null) { pen = false; return; } dStr += `${pen ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`; pen = true; }); const li = sr.pts.map((v, i) => (v == null ? -1 : i)).filter((i) => i >= 0).pop(); return `<path d="${dStr}" class="wv-line wv-${sr.k}"/><circle cx="${X(li).toFixed(1)}" cy="${Y(sr.pts[li]).toFixed(1)}" r="3.5" class="wv-end wv-${sr.k}"/>`; }).join('');
    CH[id] = { dates, series, X, Y, w, h, t, b, l, r, unit, n };
    return `<figure class="wv-chart"><figcaption><span>${esc(title)}</span><span class="wv-legend">${series.map((sr) => `<i class="wv-key wv-${sr.k}"></i>${esc(sr.name)}`).join('')}</span></figcaption>
      <div class="wv-plot" data-chart="${id}"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}, last ${n} days, ${series.map((sr) => sr.name).join(' and ')}">${ticks}<text x="${l}" y="${h - 6}" class="wv-ax">${esc(dates[0].slice(5))}</text><text x="${w - r}" y="${h - 6}" text-anchor="end" class="wv-ax">${esc(end.slice(5))}</text>${paths}<line class="wv-cross" x1="0" x2="0" y1="${t}" y2="${h - b}" visibility="hidden"/></svg><div class="wv-tip" hidden></div></div></figure>`;
  }

  /* ── API sync ────────────────────────────────────────────────────── */
  async function apiGet(url, headers) {
    let r; try { r = await fetch(url, { headers }); } catch { throw new Error("Couldn't reach the API from this page. Oura needs the Merakinetics proxy, and the Claude viewer may block outside connections."); }
    if (r.status === 401 || r.status === 403) throw new Error(cfg.proxy ? 'Your Myo session has expired. Sign in again on the Profile page.' : 'The service rejected the token. It may have expired (WHOOP tokens last about an hour).');
    if (r.status === 409) { const j = await r.json().catch(() => ({})); throw new Error(j.error === 'reconnect_required' ? 'This wearable needs reconnecting. Use Reconnect below.' : 'Connect this wearable first with the Connect button.'); }
    if (r.status === 429) { const ra = r.headers.get('Retry-After'); throw new Error(`Rate limit reached. Try again in ${ra ? ra + ' seconds' : 'a minute'}.`); }
    if (!r.ok) throw new Error(`API error ${r.status}`);
    return r.json();
  }
  async function proxyHeaders() {
    const t = OS.auth && await OS.auth.token();
    if (!t) throw new Error('Sign in to your Myo account first (Profile page). The proxy uses your sign-in to find your connected wearables.');
    return { Authorization: 'Bearer ' + t };
  }
  async function syncOura() {
    if (!cfg.proxy) throw new Error('Oura connects through the Merakinetics proxy. Add the proxy URL first.');
    const ph = await proxyHeaders(), start = dayKey(addDays(new Date(), -30)), end = dayKey(addDays(new Date(), 1)), out = [];
    for (const type of ['daily_readiness', 'daily_sleep', 'sleep', 'daily_activity', 'daily_spo2']) {
      let next = null, guard = 0;
      do { const q = new URLSearchParams({ start_date: start, end_date: end }); if (next) q.set('next_token', next); const j = await apiGet(`${cfg.proxy.replace(/\/$/, '')}/oura/v2/usercollection/${type}?${q}`, ph); (j.data || []).forEach((x) => out.push(x)); next = j.next_token; } while (next && ++guard < 6);
    }
    return out;
  }
  async function syncWhoop() {
    const base = cfg.proxy ? cfg.proxy.replace(/\/$/, '') + '/whoop/v2' : 'https://api.prod.whoop.com/developer/v2';
    if (!cfg.proxy && !cfg.whoopToken) throw new Error('Add the Merakinetics proxy URL or a WHOOP access token.');
    const headers = cfg.proxy ? await proxyHeaders() : { Authorization: 'Bearer ' + cfg.whoopToken }, start = addDays(new Date(), -30).toISOString(), out = [];
    for (const path of ['recovery', 'activity/sleep', 'cycle']) {
      let next = null, guard = 0;
      do { const q = new URLSearchParams({ limit: 25, start }); if (next) q.set('nextToken', next); const j = await apiGet(`${base}/${path}?${q}`, headers); (j.records || []).forEach((x) => out.push(x)); next = j.next_token; } while (next && ++guard < 4);
    }
    return out;
  }

  /* ── view ────────────────────────────────────────────────────────── */
  let busy = '', msg = '', tab = 'trends';
  const fmt1 = (v, d = 0) => (v == null ? '—' : (+v).toFixed(d));
  /* ── live connections through the Merakinetics proxy (spec section 10) ── */
  const DEBUG = (() => { try { return localStorage.getItem('myo-debug') === '1'; } catch { return false; } })();
  const proxyBase = () => (cfg.proxy || '').replace(/\/$/, '');
  let conn = null, connAt = 0, connBusy = false, connLink = null;
  async function proxyJSON(method, path, body) {
    const h = await proxyHeaders();
    let r; try { r = await fetch(proxyBase() + path, { method, headers: { ...h, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); } catch { throw new Error("Couldn't reach the Merakinetics proxy. Check the proxy URL and your connection."); }
    if (r.status === 401) throw new Error('Your Myo session has expired. Sign in again on the Profile page.');
    if (r.status === 429) { const ra = r.headers.get('Retry-After'); throw new Error(`Too many requests. Try again in ${ra ? ra + ' seconds' : 'a minute'}.`); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.detail || (j.error === 'reconnect_required' ? 'This wearable needs reconnecting.' : j.error === 'not_connected' ? 'Connect this wearable first.' : `Proxy error ${r.status}.`));
    return r.status === 204 ? {} : j;
  }
  async function loadConn(force) {
    if (!cfg.proxy || !(OS.auth && OS.auth.user) || connBusy || (!force && Date.now() - connAt < 30000)) return;
    connBusy = true; connAt = Date.now();
    try { const j = await proxyJSON('GET', '/v1/connections'); conn = {}; (Array.isArray(j) ? j : j.connections || []).forEach((c) => { conn[c.provider] = c; }); }
    catch (e) { conn = null; msg = e.message; }
    connBusy = false; if (OS.current === 'wearables') OS.render();
    if (conn) quietRefresh();
  }
  // phase 2: the proxy's daily cache (filled by syncs and WHOOP webhooks), already in Myo's record shape
  const dailyRange = () => [dayKey(addDays(new Date(), -30)), dayKey(new Date())];
  async function cachedDays(k) {
    const [from, to] = dailyRange();
    const rows = await proxyJSON('GET', `/v1/daily?from=${from}&to=${to}&provider=${k}`);
    return (Array.isArray(rows) ? rows : []).map(({ provider, ...r }) => r).filter((r) => r.d && Object.keys(r).length > 1);
  }
  // once per visit: bring in days that webhooks delivered since the last sync, without spending vendor calls
  const quietDone = {};
  async function quietRefresh() {
    for (const k of ['oura', 'whoop']) {
      if (quietDone[k] || !(conn && conn[k] && conn[k].status === 'active')) continue;
      quietDone[k] = true;
      try { const recs = await cachedDays(k); if (recs.length) commit(k, 'api', recs, `Updated ${SRC[k].n} from Myo's cloud: ${recs.length} days.`); } catch { /* the Sync button still works */ }
    }
  }
  const liveRow = (k) => {
    if (!cfg.proxy) return '';
    if (!(OS.auth && OS.auth.user)) return `<p class="wv-live small"><span>Live sync</span> <a class="link small" href="#profile">Sign in to connect ${SRC[k].n}</a></p>`;
    const c = conn && conn[k], st = c ? c.status : 'none';
    const p = st === 'active' ? pill('good', 'Live sync on') : st === 'reconnect_required' ? pill('warn', 'Reconnect needed') : pill('muted', conn ? 'Not connected' : 'Checking…');
    const btn = st === 'active' ? `<button class="link small" data-act="wv-disconnect" data-src="${k}">Disconnect</button>` : `<button class="btn sm" data-act="wv-connect" data-src="${k}">${st === 'reconnect_required' ? 'Reconnect' : 'Connect'} ${SRC[k].n}</button>`;
    return `<div class="wv-live"><span class="small">Live sync</span>${p}${btn}${c && c.last_sync_at ? `<span class="fine">Last sync ${esc(new Date(c.last_sync_at).toLocaleString())}</span>` : ''}</div>`;
  };
  OS.act('wv-connect', async (el) => {
    const k = el.dataset.src; connLink = null;
    try {
      // the proxy sends the member back to oauth-done.html on this site, which tells this tab and closes
      const j = await proxyJSON('POST', '/v1/connect/' + k, { return_to: new URL('oauth-done.html', location.href).href });
      const w = j.authorize_url ? window.open(j.authorize_url, '_blank') : null;
      msg = w ? `Finish connecting ${SRC[k].n} in the new tab. This page updates when you are done.` : `Open the ${SRC[k].n} sign-in page to connect.`;
      if (!w && j.authorize_url) connLink = { k, url: j.authorize_url };
    } catch (e) { msg = e.message; }
    OS.render();
  });
  OS.act('wv-disconnect', async (el) => {
    const k = el.dataset.src;
    try { await proxyJSON('DELETE', '/v1/connections/' + k); msg = `${SRC[k].n} disconnected. Its tokens and cached data were deleted on the server.`; }
    catch (e) { msg = e.message; }
    loadConn(true); OS.render();
  });
  // the proxy's OAuth callback page posts this message back to Myo when a connection completes
  window.addEventListener('message', (e) => {
    if (!cfg.proxy || !e.data || !/^wearable-(connected|failed)$/.test(e.data.type)) return;
    let proxyOrigin = ''; try { proxyOrigin = new URL(cfg.proxy).origin; } catch { return; }
    if (e.origin !== location.origin && e.origin !== proxyOrigin) return;
    const name = (SRC[e.data.provider] || {}).n || 'Wearable';
    connLink = null;
    if (e.data.type === 'wearable-failed') { msg = `${name} was not connected. ${e.data.detail || ''}`.trim(); if (OS.current === 'wearables') OS.render(); return; }
    msg = `${name} connected. Syncing now…`; loadConn(true);
    if (SRC[e.data.provider] && OS.acts['wv-sync']) setTimeout(() => OS.acts['wv-sync']({ dataset: { src: e.data.provider } }), 400);
  });

  OS.register('wearables', {
    title: 'Wearables', icon: 'wearable',
    render(s, sc) {
      const W = ensure(s), p = primaryOf(W), total = W.oura.days.length + W.whoop.days.length;
      const latest = (k) => W[k].days.slice(-1)[0];
      const viaPill = (k) => W[k].via ? pill(W[k].via === 'sample' ? 'warn' : 'good', W[k].via === 'sample' ? 'Sample data' : W[k].via === 'file' ? `Imported · ${W[k].days.length} days` : `API · ${W[k].days.length} days`) : pill('muted', 'Not connected');
      const tiles = (k) => { const L = latest(k); if (!L) return ''; const items = [[SRC[k].score, L.score, '', 0], ['HRV', L.hrv, 'ms', 0], ['Resting HR', L.rhr, 'bpm', 0], ['Sleep', L.sleepH, 'h', 1], k === 'whoop' ? ['Strain', L.strain, '', 1] : ['Temp dev.', L.tempDev, '°C', 2], ['SpO₂', L.spo2, '%', 1]];
        return `<div class="wv-tiles">${items.map(([n, v, u, d]) => `<div><span>${n}</span><b class="num">${fmt1(v, d)}</b><em>${v == null ? '' : u}</em></div>`).join('')}</div><p class="fine">Latest: ${esc(L.d)}</p>`; };
      const srcCard = (k) => `<section class="card wv-src"><div class="card-h"><h2>${SRC[k].n}</h2>${viaPill(k)}</div>
          ${W[k].days.length ? tiles(k) : `<ul class="ath-list">${SRC[k].give.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`}
          <div class="row wv-btns"><label class="btn sm file">${icon('upload', 14)} Import ${k === 'oura' ? 'Oura' : 'WHOOP'} export<input type="file" multiple accept=".csv,.json,.txt,.zip,text/csv,application/json" data-change="wv-file" data-src="${k}"></label>
            <button class="btn ghost sm" data-act="wv-sync" data-src="${k}" ${busy ? 'disabled' : ''}>${icon('rotate', 14)} ${busy === k ? 'Syncing…' : 'Sync via API'}</button>
            ${W[k].via ? `<button class="link small" data-act="wv-clear" data-src="${k}">Remove data</button>` : `<button class="link small" data-act="wv-sample" data-src="${k}">Load sample data</button>`}</div>
          ${liveRow(k)}
          <details class="wv-how"><summary>How to get your ${k === 'oura' ? 'Oura' : 'WHOOP'} data in</summary>${k === 'oura'
            ? '<p class="small">Export your data from Oura on the Web (cloud.ouraring.com) or the Oura app, then choose the CSV or JSON files here. Saved Oura API v2 responses (daily_readiness, daily_sleep, sleep, daily_activity, daily_spo2) also work. Live sync runs through the Merakinetics proxy because Oura\'s API does not accept calls from a browser.</p>'
            : '<p class="small">Request a data export in the WHOOP app (Data Export in settings). WHOOP emails a ZIP of CSV files: unzip it and choose the CSVs here. Saved WHOOP API v2 responses (recovery, activity/sleep, cycle) also work. Live sync runs through the Merakinetics proxy, or a developer access token for testing.</p>'}</details></section>`;
      const rows = (() => { const k = p; if (!k) return ''; return [...W[k].days].slice(-14).reverse().map((x) => `<tr><td>${esc(x.d)}</td><td class="num">${fmt1(x.score)}</td><td class="num">${fmt1(x.hrv)}</td><td class="num">${fmt1(x.rhr)}</td><td class="num">${fmt1(x.sleepH, 1)}</td><td class="num">${fmt1(k === 'whoop' ? x.strain : x.steps, k === 'whoop' ? 1 : 0)}</td></tr>`).join(''); })();
      const both = W.oura.days.length && W.whoop.days.length, lo = latest('oura'), lw = latest('whoop');
      const agree = both && lo.hrv != null && lw.hrv != null ? Math.round(Math.abs(lo.hrv - lw.hrv) / ((lo.hrv + lw.hrv) / 2) * 100) : null;
      const plan = W.insight;
      return `${OS.ui.head('Oura · WHOOP · sleep, recovery, strain', 'Wearables', 'Connect your ring or strap. Sleep, HRV and recovery flow into readiness, your protocol, Myo and every score in the app.',
        `<div class="hstat"><span>Sources</span><b class="num">${['oura', 'whoop'].filter((k) => W[k].days.length).length}/2</b></div><div class="hstat"><span>Days of data</span><b class="num">${total}</b></div><div class="hstat"><span>Myo readiness</span><b class="num">${sc.readiness}</b></div>`)}
      ${msg ? `<div class="banner ${/n't|rejected|error|limit|needs|Add the|expired|Too many/i.test(msg) ? 'warn' : ''}" role="status">${esc(msg)}${connLink ? ` <a class="link small" href="${esc(connLink.url)}" target="_blank" rel="noopener">Open ${esc(SRC[connLink.k].n)} sign-in</a>` : ''}</div>` : ''}
      <div class="grid g-2">${srcCard('oura')}${srcCard('whoop')}</div>
      <section class="card"><div class="card-h"><h2>What drives readiness</h2><span class="muted small">${esc(s.vitals.src || 'Sample vitals (no wearable connected)')}</span></div>
        <div class="row wv-pri"><div class="seg">${[['auto', 'Most recent'], ['oura', 'Oura'], ['whoop', 'WHOOP']].map(([k, l]) => `<button class="${W.primary === k ? 'on' : ''}" data-act="wv-primary" data-v="${k}" aria-pressed="${W.primary === k}" ${k !== 'auto' && !W[k].days.length ? 'disabled' : ''}>${l}</button>`).join('')}</div>
          <p class="small">Feeds HRV, resting HR, sleep and steps into Myo readiness (${sc.readiness} today), which gates heavy training, the MK Score, the Coach, Longevity's sleep pillar and Function's behaviour score.</p></div>
        ${agree != null ? `<p class="small">Both devices last night: HRV ${Math.round(lo.hrv)} ms (Oura) vs ${Math.round(lw.hrv)} ms (WHOOP), ${agree}% apart. They measure differently (Oura averages the whole night; WHOOP weights deep sleep), so compare each device with its own baseline, not with the other.</p>` : ''}</section>
      ${total ? `<section class="card"><div class="card-h"><h2>Last 30 days</h2><div class="seg">${[['trends', 'Charts'], ['table', 'Table']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="wv-tab" data-v="${k}">${l}</button>`).join('')}</div></div>
        ${tab === 'trends' ? `<div class="wv-charts">${lineChart('score', 'Readiness / recovery', '', (x) => x.score, W, 30, 100)}${lineChart('hrv', 'HRV', 'ms', (x) => x.hrv, W)}${lineChart('rhr', 'Resting heart rate', 'bpm', (x) => x.rhr, W)}${lineChart('sleep', 'Sleep', 'h', (x) => x.sleepH, W)}</div>`
          : `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Day</th><th>${p === 'whoop' ? 'Recovery' : 'Readiness'}</th><th>HRV ms</th><th>RHR</th><th>Sleep h</th><th>${p === 'whoop' ? 'Strain' : 'Steps'}</th></tr></thead><tbody>${rows}</tbody></table></div><p class="fine">${esc(SRC[p].n)}, last 14 days.</p>`}</section>` : ''}
      <section class="card myo-plan"><div class="card-h"><h2>Myo's read on your wearables</h2><span class="chip chip-ai">AI coach</span></div>
        ${plan ? `<div class="md">${OS.athlete ? OS.athlete.mdl(plan.text) : esc(plan.text)}</div><p class="fine">Written ${esc(new Date(plan.at).toLocaleString())}.</p>` : '<p class="muted small">Myo reads 30 days of sleep, HRV, resting HR, recovery and strain against your baselines: what is trending, what caused your best and worst days, and how to set training this week.</p>'}
        <button class="btn" data-act="wv-myo" ${total ? '' : 'disabled'}>${icon('coach', 15)} ${busy === 'myo' ? 'Myo is reading…' : plan ? 'Re-read' : 'Analyse my wearables'}</button></section>
      <details class="card wv-dev"><summary><b>API connection</b> <span class="muted small">for the Merakinetics backend and developers</span></summary>
        <form class="bench" data-submit="wv-cfg">
          <label class="field" for="wv-proxy"><span>Merakinetics proxy URL <em>production: holds OAuth tokens server-side</em></span><input id="wv-proxy" name="proxy" type="url" value="${esc(cfg.proxy || '')}" placeholder="https://your-project.supabase.co/functions/v1/wearables"></label>
          ${DEBUG ? `<label class="field" for="wv-wt"><span>WHOOP access token <em>developer testing only, kept in this browser</em></span><input id="wv-wt" name="wt" type="password" autocomplete="off" value="${cfg.whoopToken ? '••••••••' : ''}" placeholder="Bearer token from your WHOOP developer app"></label>` : '<input type="hidden" name="wt" value="">'}
          <button class="btn sm">Save connection</button></form>
        <div class="grid g-2 wv-specs">
          <div><h3>Oura API v2</h3><ul class="ath-list"><li>OAuth2: cloud.ouraring.com/oauth/authorize → api.ouraring.com/oauth/token (server flow with PKCE)</li><li>Scopes: daily, heartrate, personal, spo2, workout, session</li><li>Reads: /v2/usercollection/daily_readiness, daily_sleep, sleep, daily_activity, daily_spo2 (start_date, end_date, next_token)</li><li>5,000 requests per 5 minutes; browser calls are refused, so proxy only; send a User-Agent</li></ul></div>
          <div><h3>WHOOP API v2</h3><ul class="ath-list"><li>OAuth2: api.prod.whoop.com/oauth/oauth2/auth → /oauth/oauth2/token; client secret stays server-side</li><li>Scopes: read:recovery, read:cycles, read:sleep, read:workout, read:profile, read:body_measurement, offline</li><li>Reads: /developer/v2/recovery, /activity/sleep, /cycle (limit ≤25, start, end, nextToken)</li><li>100/min, 10,000/day; webhooks for recovery, sleep, workout (HMAC-SHA256 signed)</li></ul></div>
        </div>
        <p class="fine">Proxy contract: GET {proxy}/oura/v2/usercollection/{type} and {proxy}/whoop/v2/{recovery|activity/sleep|cycle} pass through to each API with the member's stored token. Myo sends the member's Supabase session as a Bearer token so the proxy knows whose connections to use. Vendor tokens are never stored in Myo's synced data.</p></details>`;
    },
    mount(root) {
      loadConn(false);
      const plots = root.querySelectorAll('.wv-plot');
      const on = (e) => {
        const box = e.currentTarget, C = CH[box.dataset.chart]; if (!C) return;
        const svg = box.querySelector('svg'), rc = svg.getBoundingClientRect(), x = (e.clientX - rc.left) / rc.width * C.w;
        const i = clamp(Math.round((x - C.l) / (C.w - C.l - C.r) * (C.n - 1)), 0, C.n - 1), cx = C.X(i);
        const cross = svg.querySelector('.wv-cross'); cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
        const tip = box.querySelector('.wv-tip'), vals = C.series.map((sr) => `<span><i class="wv-key wv-${sr.k}"></i>${esc(sr.name)} <b class="num">${sr.pts[i] == null ? '—' : Math.round(sr.pts[i] * 10) / 10}</b>${sr.pts[i] == null ? '' : ' ' + esc(C.unit)}</span>`).join('');
        tip.innerHTML = `<b>${esc(C.dates[i])}</b>${vals}`; tip.hidden = false;
        const left = (cx / C.w) * rc.width; tip.style.left = Math.min(Math.max(0, left - tip.offsetWidth / 2), rc.width - tip.offsetWidth) + 'px';
      };
      const off = (e) => { const box = e.currentTarget; box.querySelector('.wv-tip').hidden = true; const c = box.querySelector('.wv-cross'); if (c) c.setAttribute('visibility', 'hidden'); };
      plots.forEach((pl) => { pl.addEventListener('pointermove', on); pl.addEventListener('pointerleave', off); });
      return () => plots.forEach((pl) => { pl.removeEventListener('pointermove', on); pl.removeEventListener('pointerleave', off); });
    }
  });

  /* ── actions ─────────────────────────────────────────────────────── */
  const commit = (src, via, recs, note) => {
    msg = note;
    OS.update((s) => { const W = ensure(s), m = mergeDays(via === W[src].via ? W[src].days : [], recs); W[src] = { via, at: new Date().toISOString(), days: m.days }; W.insight = null; applyVitals(s); });
  };
  OS.change('wv-file', async (el) => {
    const src = el.dataset.src, files = [...(el.files || [])]; el.value = ''; if (!files.length) return;
    const { recs, skipped, zip } = await readFiles(files);
    if (!recs.length) { msg = zip ? 'That is a ZIP file. Unzip it first, then choose the CSV files inside.' : `No ${SRC[src].n} daily data found in ${files.length > 1 ? 'those files' : 'that file'}. Choose the CSV or JSON export.`; OS.render(); return; }
    const days = new Set(recs.map((r) => r.d)).size;
    commit(src, 'file', recs, `Imported ${days} days of ${SRC[src].n} data from ${files.length} file${files.length > 1 ? 's' : ''}${skipped ? ` (${skipped} row${skipped > 1 ? 's' : ''} without daily data skipped)` : ''}. Readiness now runs on it.`);
  });
  OS.act('wv-sample', (el) => { const src = el.dataset.src; commit(src, 'sample', sampleDays(src), `Loaded 45 days of sample ${SRC[src].n} data. It is labelled as sample everywhere; import your own export to replace it.`); });
  OS.act('wv-clear', (el) => {
    const src = el.dataset.src; if (!confirm(`Remove all ${SRC[src].n} data from Myo? Your device and its app are not affected.`)) return;
    msg = `${SRC[src].n} data removed.`;
    OS.update((s) => { const W = ensure(s); W[src] = { via: null, at: null, days: [] }; W.insight = null; s.wearables[src] = false; if (primaryOf(W)) applyVitals(s); else { if (W.backup) { s.vitals = W.backup.v; s.wearables = W.backup.w; } delete W.backup; delete s.vitals.src; } });
  });
  OS.act('wv-primary', (el) => OS.update((s) => { ensure(s).primary = el.dataset.v; applyVitals(s); }));
  OS.act('wv-tab', (el) => { tab = el.dataset.v; OS.render(); });
  OS.act('wv-cfg', (f) => {
    const proxy = f.proxy.value.trim(), wt = f.wt.value.trim();
    if (proxy && !/^https:\/\//.test(proxy)) { OS.toast('The proxy URL must start with https://'); return; }
    cfg.proxy = proxy || ''; if (wt && !/^•+$/.test(wt)) cfg.whoopToken = wt; if (!wt) delete cfg.whoopToken; saveCfg();
    OS.toast('Connection saved in this browser');
  });
  OS.act('wv-sync', async (el) => {
    const src = el.dataset.src; if (busy) return; busy = src; msg = ''; OS.render();
    try {
      // through the proxy: a warm daily cache answers at once; otherwise read the vendor (which also warms the cache)
      let recs = [];
      if (cfg.proxy && OS.auth && OS.auth.user) { try { recs = await cachedDays(src); } catch { recs = []; } }
      if (recs.length < 7) { const raw = src === 'oura' ? await syncOura() : await syncWhoop(); recs = raw.map(mapRecord).filter(Boolean); }
      if (!recs.length) throw new Error(`${SRC[src].n} returned no daily data for the last 30 days.`);
      busy = ''; commit(src, 'api', recs, `Synced ${new Set(recs.map((r) => r.d)).size} days from ${SRC[src].n}.`);
    } catch (e) { busy = ''; msg = e.message; OS.render(); }
  });
  OS.act('wv-myo', async () => {
    if (busy) return;
    const s = OS.state, sc = OS.scores(s), W = ensure(s), p = primaryOf(W); if (!p) return;
    const sum = (k) => { const d = W[k].days.slice(-30); if (!d.length) return null; const last7 = d.slice(-7), prev = d.slice(0, -7); const avg = (arr, f) => { const m = mean(arr.map((x) => x[f])); return m == null ? null : Math.round(m * 10) / 10; };
      return { device: SRC[k].n, days: d.length, last7: { score: avg(last7, 'score'), hrv: avg(last7, 'hrv'), rhr: avg(last7, 'rhr'), sleepH: avg(last7, 'sleepH'), strain: avg(last7, 'strain') }, baseline: { score: avg(prev, 'score'), hrv: avg(prev, 'hrv'), rhr: avg(prev, 'rhr'), sleepH: avg(prev, 'sleepH'), strain: avg(prev, 'strain') }, best: [...d].sort((a, b) => (b.score || 0) - (a.score || 0))[0], worst: [...d].sort((a, b) => (a.score || 999) - (b.score || 999))[0], sample: W[k].via === 'sample' }; };
    const data = { oura: sum('oura'), whoop: sum('whoop'), primary: SRC[p].n, myoReadiness: sc.readiness, trainingThisWeek: s.training.log.slice(-7), program: s.training.program, redFlags: sc.redFlags };
    const S = data[p], d7 = S.last7, b = S.baseline;
    const fallback = () => [`## ${SRC[p].n}: last 7 days vs your baseline`, `- HRV **${d7.hrv ?? '—'} ms** vs ${b.hrv ?? '—'} ms baseline${d7.hrv != null && b.hrv != null ? (d7.hrv >= b.hrv ? ' (up: recovering well)' : ' (down: ease intensity)') : ''}`,
      `- Resting HR **${d7.rhr ?? '—'}** vs ${b.rhr ?? '—'} bpm${d7.rhr != null && b.rhr != null && d7.rhr > b.rhr + 2 ? ' (raised: check sleep, alcohol, illness)' : ''}`, `- Sleep **${d7.sleepH ?? '—'} h** a night${d7.sleepH != null && d7.sleepH < 7.5 ? `; about ${Math.round((8 - d7.sleepH) * 7 * 10) / 10} h short of 8 h this week` : ''}`,
      '### This week', `- Train heavy only on days ${p === 'whoop' ? 'recovery' : 'readiness'} is 67+ and HRV is within 7% of baseline`, '- Keep the sleep window fixed within 30 minutes, weekends too', d7.strain != null ? `- Keep day strain near ${Math.round(d7.strain)} until recovery trends up` : '- Add a Zone 2 day after any score under 60'].join('\n');
    const sample = OS.caps && OS.caps.sample;
    if (!sample) { OS.update((st) => { ensure(st).insight = { text: fallback(), at: new Date().toISOString() }; }); return; }
    busy = 'myo'; OS.render();
    const prompt = `You are Myo, the performance physiologist inside the Myo app (built on Myokinetics OS). Read this member's Oura and/or WHOOP data: the last 7 days against their own 30-day baseline, best and worst days, and how it fits their training. Say what is trending, the likely causes, and exactly how to set training intensity and sleep this week with measurable targets. If both devices are present, compare each to its own baseline and note they measure HRV differently. If data is flagged sample, say so in one line. Markdown, "##"/"###" headings, "-" bullets, under 300 words. No diagnosis; if redFlags is not empty, open with it.
Data (JSON): ${JSON.stringify(data)}`;
    let text;
    try { const r = await sample(prompt, { cache: false, modelTier: 'complex' }); text = (r.text || '').trim() || fallback(); }
    catch (e) { text = fallback() + (e && e.code === 'not_granted' ? '\n\nAI access was declined, so this is the offline read.' : ''); }
    busy = ''; OS.update((st) => { ensure(st).insight = { text, at: new Date().toISOString() }; });
  });

  OS.wear = { parseCSV, mapRecord, mergeDays, readFiles, applyVitals, primaryOf };
})();
