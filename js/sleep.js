/* ═══ MYO — SLEEP: 14-night sleep study, diary, and sleep data uploads ═══
   Protocol: 7 baseline nights, then 7 nights with chosen changes, compared on diary and wearable measures.
   Diary: time in bed, sleep latency, wake after sleep onset, total sleep, efficiency, quality.
   Uploads (read on this device, never sent anywhere; only summary numbers are kept):
     · sleep study / home sleep apnea test reports (PDF): AHI, RDI, ODI, SpO₂ nadir, T90, efficiency, stages
     · EDF / EDF+ recordings (polysomnography, home tests, Sleep-EDF hypnograms): SpO₂ trace and statistics,
       sleep-stage annotations → hypnogram, total sleep, efficiency, WASO, REM latency, stage percentages
     · CSV exports from sleep apps or diaries
   Plus wearable nights (Oura, WHOOP) and the signs that should send someone to a sleep clinician. */
(function () {
  'use strict';
  const { esc, icon, pill, dayKey, addDays } = OS;

  const IVS = [
    ['wake', 'Same wake time every day (within 30 min), weekends too'], ['light', '10 min of outdoor light within an hour of waking'],
    ['caffeine', 'No caffeine within 8 hours of bed'], ['alcohol', 'No alcohol within 3 hours of bed'],
    ['cool', 'Bedroom 18–19 °C, dark and quiet'], ['bath', 'Warm bath 1–2 hours before bed'],
    ['screens', 'Screens off 30 min before bed'], ['sono', 'Sonosphere Deep sleep program in bed'],
    ['stimulus', 'Bed only when sleepy; get up if awake more than 20 min']
  ];
  const SIGNS = [
    ['snore', 'Loud snoring most nights'], ['pauses', 'Someone has seen you stop breathing, choke or gasp in your sleep'],
    ['sleepy', 'Very sleepy in the day, or nodding off while reading, watching TV or driving'], ['bp', 'High blood pressure'],
    ['headache', 'Morning headaches or a dry mouth on waking'], ['size', 'BMI over 35, or a large neck (shirt collar over 43 cm / 17 in)']
  ];
  const OTHER = ['Trouble falling or staying asleep at least 3 nights a week for 3 months: CBT for insomnia is the first-line treatment.', 'An urge to move the legs in the evening that eases with movement (restless legs).', 'Acting out dreams, sudden sleep attacks, or going weak with laughter or surprise.'];

  function ensure(s) {
    if (!s.sleep) s.sleep = { study: null, diary: [], reports: [], recs: [], signs: {} };
    ['diary', 'reports', 'recs'].forEach((k) => { if (!s.sleep[k]) s.sleep[k] = []; });
    if (!s.sleep.signs) s.sleep.signs = {};
    return s.sleep;
  }

  /* ── diary maths: times are minutes after the previous noon so midnight never breaks them ── */
  const toMin = (hhmm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || ''); if (!m) return null; const t = +m[1] * 60 + +m[2]; return t < 720 ? t + 1440 : t; };
  function nightStats(n) {
    const bed = toMin(n.bed), wake = toMin(n.wake), out = toMin(n.out || n.wake);
    if (bed == null || wake == null || out == null || out <= bed) return n.tst != null ? { tib: n.tib, tst: n.tst, se: n.se, sol: n.sol, waso: n.waso } : null;
    const tib = out - bed, tst = Math.max(0, wake - bed - (+n.sol || 0) - (+n.waso || 0));
    return { tib, tst, se: Math.round((tst / tib) * 100), sol: +n.sol || 0, waso: +n.waso || 0 };
  }
  const hm = (min) => (min == null ? '—' : `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')}`);
  const avg = (xs) => { const v = xs.filter((x) => x != null && Number.isFinite(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  function wearNights(s) {
    const W = s.wear || {}, o = (W.oura && W.oura.days) || [], w = (W.whoop && W.whoop.days) || [];
    const by = new Map(); w.forEach((x) => by.set(x.d, { ...x, via: 'WHOOP' })); o.forEach((x) => by.set(x.d, { ...(by.get(x.d) || {}), ...x, via: 'Oura' }));
    return [...by.values()].filter((x) => x.sleepH != null).sort((a, b) => a.d.localeCompare(b.d));
  }

  /* ── PDF sleep study reports ── */
  const NUM = '(\\d{1,4}(?:[.,]\\d{1,2})?)';
  // the gap between a label and its number may hold a scoring rule in brackets, e.g. "AHI (3%): 17.4"
  const G = '(?:\\([^)\\n]{0,24}\\)|[^\\d\\n%(]){0,30}';
  // an index (events per hour) is never followed by %, which skips scoring rules such as "AHI, 4% rule"
  const GI = '(?:\\([^)\\n]{0,24}\\)|\\b[34]\\s*%(?:\\s*rule)?|[^\\d\\n%(]){0,30}';
  const IDX = NUM + '(?![\\d.,]*\\s*%)';
  const PDF_RULES = [
    ['ahi', 'AHI', [new RegExp('\\bAHI\\b' + GI + IDX, 'i'), new RegExp('apn(?:o)?ea[- ]hypopn(?:o)?ea index' + GI + IDX, 'i')], '/h'],
    ['rdi', 'RDI', [new RegExp('\\bRDI\\b' + GI + IDX, 'i'), new RegExp('respiratory disturbance index' + GI + IDX, 'i')], '/h'],
    ['odi', 'ODI', [new RegExp('\\bODI\\b' + GI + IDX, 'i'), new RegExp('(?:oxygen )?desaturation index' + GI + IDX, 'i')], '/h'],
    ['nadir', 'Lowest SpO₂', [new RegExp('(?:nadir|lowest|minimum|min\\.?)\\s*(?:SpO2|SaO2|O2 sat\\w*|saturation|oxygen)' + G + NUM, 'i'), new RegExp('(?:SpO2|SaO2|saturation)\\s*(?:nadir|lowest|minimum|min\\.?)' + G + NUM, 'i')], '%'],
    ['t90', 'Time below 90%', [new RegExp('(?:\\bT90\\b|time\\s*(?:spent\\s*)?(?:below|under|<)\\s*90\\s*%?)' + G + NUM, 'i')], '%'],
    ['se', 'Sleep efficiency', [new RegExp('sleep efficiency' + G + NUM, 'i')], '%'],
    ['tst', 'Total sleep time', [new RegExp('total sleep time' + G + NUM + '\\s*(min|minutes|h|hrs|hours)?', 'i')], 'min'],
    ['sol', 'Sleep latency', [new RegExp('sleep (?:onset )?latency' + G + NUM, 'i')], 'min'],
    ['rem', 'REM', [new RegExp('\\b(?:REM|stage R)\\b' + G + NUM + '\\s*%', 'i')], '% of sleep'],
    ['n3', 'Deep sleep (N3)', [new RegExp('(?:\\bN3\\b|stage 3|slow[- ]wave)' + G + NUM + '\\s*%', 'i')], '% of sleep'],
    ['arousal', 'Arousal index', [new RegExp('arousal index' + GI + IDX, 'i')], '/h'],
    ['plm', 'Leg movement index', [new RegExp('PLMS?\\s*index' + GI + IDX, 'i')], '/h']
  ];
  function parseReport(text) {
    const out = {};
    PDF_RULES.forEach(([k, , res]) => {
      for (const re of res) {
        const m = re.exec(text); if (!m) continue;
        let v = parseFloat(String(m[1]).replace(',', '.'));
        if (k === 'tst' && m[2] && /^h/i.test(m[2])) v = Math.round(v * 60);
        if (k === 'tst' && !m[2] && v < 24) v = Math.round(v * 60);
        if (Number.isFinite(v)) { out[k] = v; break; }
      }
    });
    return out;
  }
  // standard adult categories, as education; the sleep physician's report decides
  const band = (k, v) => {
    if (k === 'ahi' || k === 'rdi' || k === 'odi') return v < 5 ? ['good', 'Under 5: normal range'] : v < 15 ? ['warn', '5–15: mild'] : v < 30 ? ['bad', '15–30: moderate'] : ['bad', '30+: severe'];
    if (k === 'nadir') return v >= 90 ? ['good', '90% or above'] : v >= 85 ? ['warn', '85–89%'] : ['bad', 'Below 85%'];
    if (k === 't90') return v < 1 ? ['good', 'Under 1%'] : v < 10 ? ['warn', '1–10%'] : ['bad', 'Over 10%'];
    if (k === 'se') return v >= 85 ? ['good', '85% or above'] : ['warn', 'Below 85%'];
    return null;
  };

  /* ── EDF / EDF+ recordings ── */
  async function parseEdf(file) {
    const head = new Uint8Array(await file.slice(0, 256).arrayBuffer());
    const txt = (u, a, b) => { let s = ''; for (let i = a; i < b; i++) s += String.fromCharCode(u[i]); return s.trim(); };
    if (txt(head, 0, 8) !== '0') throw new Error(`${file.name} is not an EDF file.`);
    const hdrBytes = +txt(head, 184, 192), nRec = +txt(head, 236, 244), recDur = +txt(head, 244, 252), ns = +txt(head, 252, 256);
    if (!(ns > 0) || !(hdrBytes > 256) || !(recDur >= 0)) throw new Error(`${file.name}: unreadable EDF header.`);
    const dm = /^(\d{2})\.(\d{2})\.(\d{2})$/.exec(txt(head, 168, 176)), tm = /^(\d{2})\.(\d{2})\.(\d{2})$/.exec(txt(head, 176, 184));
    const start = dm && tm ? new Date(Date.UTC((+dm[3] >= 85 ? 1900 : 2000) + +dm[3], +dm[2] - 1, +dm[1], +tm[1], +tm[2], +tm[3])) : null;
    // the patient-identification field (bytes 8–88) is never read
    const h = new Uint8Array(await file.slice(256, hdrBytes).arrayBuffer());
    let o = 0;
    const field = (w) => { const out = []; for (let i = 0; i < ns; i++) out.push(txt(h, o + i * w, o + (i + 1) * w)); o += w * ns; return out; };
    const labels = field(16); field(80); const dims = field(8);
    const pmin = field(8).map(Number), pmax = field(8).map(Number), dmin = field(8).map(Number), dmax = field(8).map(Number);
    field(80); const spr = field(8).map(Number);
    const offs = []; let acc = 0; spr.forEach((n) => { offs.push(acc); acc += n * 2; });
    const recBytes = acc, total = nRec > 0 ? nRec : Math.floor((file.size - hdrBytes) / recBytes);
    const iSpo2 = labels.findIndex((l) => /spo2|sao2|oxygen sat|o2 ?sat|\bsat\b|saturation/i.test(l));
    const iAnn = labels.findIndex((l) => /^EDF Annotations$/i.test(l));
    const spo2 = [], ann = [];
    const CH = 256;
    for (let r0 = 0; r0 < total && (iSpo2 >= 0 || iAnn >= 0); r0 += CH) {
      const n = Math.min(CH, total - r0), buf = await file.slice(hdrBytes + r0 * recBytes, hdrBytes + (r0 + n) * recBytes).arrayBuffer(), dv = new DataView(buf);
      for (let r = 0; r < n; r++) {
        const base = r * recBytes;
        if (iSpo2 >= 0) { const g = (pmax[iSpo2] - pmin[iSpo2]) / ((dmax[iSpo2] - dmin[iSpo2]) || 1); for (let k = 0; k < spr[iSpo2]; k++) { const at = base + offs[iSpo2] + k * 2; if (at + 2 > buf.byteLength) break; spo2.push(pmin[iSpo2] + (dv.getInt16(at, true) - dmin[iSpo2]) * g); } }
        if (iAnn >= 0) { let s = ''; for (let k = 0; k < spr[iAnn] * 2; k++) { const at = base + offs[iAnn] + k; if (at >= buf.byteLength) break; s += String.fromCharCode(dv.getUint8(at)); } ann.push(s); }
      }
    }
    const res = { name: file.name, start: start ? start.toISOString() : null, hours: Math.round((total * recDur) / 360) / 10, signals: labels.map((l, i) => (i === iAnn ? null : `${l}${dims[i] ? ' (' + dims[i] + ')' : ''}`)).filter(Boolean).slice(0, 24) };
    if (iSpo2 >= 0 && spo2.length) {
      const hz = spr[iSpo2] / (recDur || 1), valid = spo2.filter((v) => v >= 50 && v <= 100);
      if (valid.length) {
        const below = valid.filter((v) => v < 90).length, step = Math.max(1, Math.floor(spo2.length / 600)), trace = [];
        for (let i = 0; i < spo2.length; i += step) { const seg = spo2.slice(i, i + step).filter((v) => v >= 50 && v <= 100); trace.push(seg.length ? Math.round(Math.min(...seg) * 10) / 10 : null); }
        res.spo2 = { mean: Math.round(avg(valid) * 10) / 10, nadir: Math.round(Math.min(...valid) * 10) / 10, t90: Math.round((below / valid.length) * 1000) / 10, hz, trace, minutes: Math.round(valid.length / hz / 60) };
      }
    }
    if (ann.length) {
      const ev = [], re = /([+-]\d+(?:\.\d+)?)(?:\x15(\d+(?:\.\d+)?))?\x14([^\x00]*)/g;
      ann.join('').split('\x00').forEach((tal) => { re.lastIndex = 0; const m = re.exec(tal); if (!m) return; m[3].split('\x14').filter(Boolean).forEach((a) => ev.push({ t: +m[1], dur: +(m[2] || 0), a })); });
      const stages = hypno(ev);
      if (stages) res.stages = stages;
    }
    return res;
  }
  // "Sleep stage W/1/2/3/4/R" or AASM "N1/N2/N3" annotations → 30-s epochs and the standard summary
  function hypno(ev) {
    const code = (a) => { const m = /sleep stage\s*(w|wake|r|rem|n?1|n?2|n?3|4|\?)/i.exec(a) || /^\s*(w|wake|r|rem|n1|n2|n3)\s*$/i.exec(a); if (!m) return null; const x = m[1].toLowerCase(); return x.startsWith('w') ? 'W' : x.startsWith('r') ? 'R' : x.includes('1') ? 'N1' : x.includes('2') ? 'N2' : x.includes('3') || x === '4' ? 'N3' : null; };
    const st = ev.map((e) => ({ ...e, s: code(e.a) })).filter((e) => e.s && e.dur > 0).sort((a, b) => a.t - b.t);
    if (!st.length) return null;
    const t0 = st[0].t, epochs = [];
    st.forEach((e) => { for (let k = 0; k < Math.round(e.dur / 30); k++) epochs[Math.round((e.t - t0) / 30) + k] = e.s; });
    const sleepIdx = epochs.map((s, i) => (s && s !== 'W' ? i : -1)).filter((i) => i >= 0);
    if (!sleepIdx.length) return null;
    const a = sleepIdx[0], b = sleepIdx[sleepIdx.length - 1], win = epochs.slice(a, b + 1);
    const cnt = { W: 0, N1: 0, N2: 0, N3: 0, R: 0 }; win.forEach((s) => { if (s) cnt[s]++; });
    const tst = (cnt.N1 + cnt.N2 + cnt.N3 + cnt.R) / 2, spt = win.length / 2, firstR = win.indexOf('R');
    const pad = Math.min(a, 60), plot = epochs.slice(a - pad, Math.min(epochs.length, b + 61));
    return { tst: Math.round(tst), spt: Math.round(spt), se: Math.round((tst / spt) * 100), waso: Math.round(cnt.W / 2), remLat: firstR >= 0 ? Math.round(firstR / 2) : null,
      pct: { N1: Math.round((cnt.N1 / 2 / tst) * 100), N2: Math.round((cnt.N2 / 2 / tst) * 100), N3: Math.round((cnt.N3 / 2 / tst) * 100), R: Math.round((cnt.R / 2 / tst) * 100) }, epochs: plot.map((s) => s || '') };
  }

  /* ── CSV from sleep apps or diaries ── */
  function parseCsv(text) {
    const rows = text.split(/\r?\n/).filter((l) => l.trim()), sep = rows[0] && rows[0].includes(';') ? ';' : ',';
    const head = (rows.shift() || '').split(sep).map((h) => h.trim().toLowerCase().replace(/["']/g, ''));
    const col = (re) => head.findIndex((h) => re.test(h));
    const cD = col(/^(date|night|day)$|date/), cBed = col(/bed ?time|start|went to bed|in bed/), cWake = col(/wake|end|got up|woke/), cTst = col(/total sleep|asleep|time asleep|sleep duration|duration/), cSe = col(/efficiency/), cSol = col(/latency|to fall asleep/), cQ = col(/quality/);
    const out = [];
    rows.forEach((r) => {
      const v = r.split(sep).map((x) => x.trim().replace(/^"|"$/g, ''));
      const date = cD >= 0 ? (v[cD].match(/\d{4}-\d{2}-\d{2}/) || [])[0] : null;
      const tm = (x) => { const m = /(\d{1,2}):(\d{2})/.exec(x || ''); return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null; };
      let tst = cTst >= 0 ? parseFloat(v[cTst]) : null;
      if (cTst >= 0 && /:/.test(v[cTst] || '')) { const m = /(\d+):(\d{2})/.exec(v[cTst]); tst = m ? +m[1] * 60 + +m[2] : null; }
      else if (tst != null && tst < 24) tst = Math.round(tst * 60);
      const n = { d: date, bed: cBed >= 0 ? tm(v[cBed]) : null, wake: cWake >= 0 ? tm(v[cWake]) : null, sol: cSol >= 0 ? parseFloat(v[cSol]) || 0 : 0, waso: 0, q: cQ >= 0 ? Math.max(1, Math.min(5, Math.round(parseFloat(v[cQ]) || 3))) : null, src: 'import' };
      if (!n.d) return;
      // with bed and wake times plus a stated sleep total, the gap becomes time awake so efficiency stays honest
      if (tst != null && n.bed && n.wake) { const t0 = nightStats(n); if (t0) n.waso = Math.max(0, t0.tib - n.sol - tst); }
      const st = nightStats(n);
      if (st) Object.assign(n, st); else if (tst != null) Object.assign(n, { tst, se: cSe >= 0 ? parseFloat(v[cSe]) || null : null });
      if (n.tst != null) out.push(n);
    });
    return out;
  }

  /* ── charts ── */
  function hypnoSvg(st) {
    const Y = { W: 0, R: 1, N1: 2, N2: 3, N3: 4 }, e = st.epochs, w = 640, h = 150, l = 36, r = 8, t = 10, b = 22, X = (i) => l + (i / Math.max(1, e.length)) * (w - l - r), Yv = (s) => t + (Y[s] / 4) * (h - t - b);
    let d = '', rem = '';
    e.forEach((s, i) => { if (!s) return; d += `${d ? 'L' : 'M'}${X(i).toFixed(1)},${Yv(s).toFixed(1)}L${X(i + 1).toFixed(1)},${Yv(s).toFixed(1)}`; if (s === 'R') rem += `<rect x="${X(i).toFixed(1)}" y="${(Yv('R') - 4).toFixed(1)}" width="${Math.max(1, X(i + 1) - X(i)).toFixed(1)}" height="8" class="sl-rem"/>`; });
    const hours = Math.floor(e.length / 120), ticks = Array.from({ length: hours + 1 }, (_, k) => `<text x="${X(k * 120).toFixed(1)}" y="${h - 6}" class="sl-ax" text-anchor="middle">${k} h</text>`).join('');
    return `<svg viewBox="0 0 ${w} ${h}" class="sl-chart" role="img" aria-label="Hypnogram: sleep stages across the night">${Object.entries(Y).map(([k, v]) => `<text x="4" y="${(t + (v / 4) * (h - t - b) + 4).toFixed(1)}" class="sl-ax">${k}</text><line x1="${l}" x2="${w - r}" y1="${(t + (v / 4) * (h - t - b)).toFixed(1)}" y2="${(t + (v / 4) * (h - t - b)).toFixed(1)}" class="sl-grid"/>`).join('')}${rem}<path d="${d}" class="sl-line"/>${ticks}</svg>`;
  }
  function spo2Svg(sp) {
    const v = sp.trace, w = 640, h = 140, l = 36, r = 8, t = 8, b = 20, lo = Math.min(84, Math.floor(sp.nadir) - 1), X = (i) => l + (i / Math.max(1, v.length - 1)) * (w - l - r), Y = (x) => t + ((100 - x) / (100 - lo)) * (h - t - b);
    let d = '', pen = false; v.forEach((x, i) => { if (x == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${X(i).toFixed(1)},${Y(x).toFixed(1)}`; pen = true; });
    return `<svg viewBox="0 0 ${w} ${h}" class="sl-chart" role="img" aria-label="Blood oxygen across the recording, mean ${sp.mean}%, lowest ${sp.nadir}%">${[100, 95, 90, lo].map((y) => `<text x="4" y="${(Y(y) + 4).toFixed(1)}" class="sl-ax">${y}%</text><line x1="${l}" x2="${w - r}" y1="${Y(y).toFixed(1)}" y2="${Y(y).toFixed(1)}" class="${y === 90 ? 'sl-ref' : 'sl-grid'}"/>`).join('')}<path d="${d}" class="sl-line sl-o2"/></svg>`;
  }

  /* ── view ── */
  let busy = '';
  OS.register('sleep', {
    title: 'Sleep', icon: 'sleep',
    render(s) {
      const S = ensure(s), wn = wearNights(s).slice(-14), diary = [...S.diary].sort((a, b) => a.d.localeCompare(b.d));
      const last7 = diary.slice(-7).map((n) => nightStats(n)).filter(Boolean);
      const avgTst = avg(last7.map((x) => x.tst)) ?? (wn.length ? avg(wn.slice(-7).map((x) => x.sleepH * 60)) : null), avgSe = avg(last7.map((x) => x.se));
      const st = S.study, night = st ? Math.floor((Date.parse(dayKey()) - Date.parse(st.start)) / 864e5) + 1 : 0;
      const studyNights = st ? diary.filter((n) => n.d >= st.start && n.d <= dayKey(addDays(new Date(st.start + 'T12:00:00'), 13))) : [];
      const phase = (n) => (Date.parse(n.d) - Date.parse(st.start)) / 864e5 < 7 ? 0 : 1;
      const wBy = new Map(wearNights(s).map((x) => [x.d, x]));
      const cmp = st ? [0, 1].map((p) => { const ns = studyNights.filter((n) => phase(n) === p), ss = ns.map(nightStats).filter(Boolean), ws = ns.map((n) => wBy.get(n.d)).filter(Boolean);
        return { n: ns.length, tst: avg(ss.map((x) => x.tst)), sol: avg(ss.map((x) => x.sol)), waso: avg(ss.map((x) => x.waso)), se: avg(ss.map((x) => x.se)), q: avg(ns.map((x) => +x.q || null)), hrv: avg(ws.map((x) => x.hrv)), score: avg(ws.map((x) => x.sleepScore)) }; }) : null;
      const signs = SIGNS.filter(([k]) => S.signs[k]).length;
      const row = (label, k, unit, better, fmt) => { const a = cmp[0][k], b = cmp[1][k]; if (a == null && b == null) return ''; const d = a != null && b != null ? b - a : null, good = d == null ? null : better === 'up' ? d > 0 : d < 0;
        return `<tr><td>${label}</td><td class="num">${fmt(a)}</td><td class="num">${fmt(b)}</td><td>${d == null || Math.abs(d) < 0.5 ? '<span class="muted small">—</span>' : pill(good ? 'good' : 'warn', `${d > 0 ? '+' : '−'}${fmt(Math.abs(d))}${unit}`)}</td></tr>`; };
      const f0 = (x) => (x == null ? '—' : String(Math.round(x))), fh = (x) => (x == null ? '—' : hm(x));
      return `${OS.ui.head('Body · sleep', 'Sleep', 'Run a 14-night sleep study, upload sleep reports and recordings, and find what actually changes your sleep.',
        `<div class="hstat"><span>Sleep, 7-night avg</span><b class="num">${avgTst != null ? hm(avgTst) : '—'}</b></div><div class="hstat"><span>Efficiency</span><b class="num">${avgSe != null ? Math.round(avgSe) + '%' : '—'}</b></div><div class="hstat"><span>Study</span><b class="num">${st ? (night > 14 ? 'Done' : `Night ${Math.max(1, night)}/14`) : 'Not started'}</b></div>`)}
      ${signs >= 3 ? `<div class="banner warn" role="note"><strong>Ask your doctor about a sleep study.</strong> You ticked ${signs} signs of sleep apnea. A home sleep test or an overnight study can check; apnea is common and treatable. Don't drive when you feel sleepy.</div>` : ''}
      <div class="grid g-2-1">
        <section class="card sl-study"><div class="card-h"><h2>14-night sleep study</h2>${st ? pill(night > 14 ? 'good' : 'warn', night > 14 ? 'Complete' : night <= 7 ? 'Phase 1 · baseline' : 'Phase 2 · changes') : pill('muted', 'Not started')}</div>
          ${!st ? `<p class="small">Seven baseline nights as you normally sleep, then seven nights with the changes you pick. Fill in the diary each morning; a ring or strap adds HRV and sleep scores. Myo then compares the two weeks.</p>
            <form data-submit="sl-start" class="stack-sm"><fieldset class="sl-ivs"><legend class="small muted">Changes for nights 8–14 (pick 2 or 3)</legend>${IVS.map(([k, l]) => `<label class="ped-use"><input type="checkbox" name="iv" value="${k}" ${['wake', 'light', 'caffeine'].includes(k) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</fieldset>
            <button class="btn">Start tonight</button></form>`
            : `<div class="sl-track">${Array.from({ length: 14 }, (_, i) => { const d = dayKey(addDays(new Date(st.start + 'T12:00:00'), i)), has = diary.some((n) => n.d === d); return `<span class="${i < 7 ? 'p1' : 'p2'} ${has ? 'has' : ''} ${i + 1 === night ? 'cur' : ''}" title="Night ${i + 1} · ${d}">${i + 1}</span>`; }).join('')}</div>
            ${night >= 8 && night <= 14 ? `<div class="sl-today"><b>Tonight's changes</b><ul>${st.ivs.map((k) => `<li>${esc((IVS.find((x) => x[0] === k) || [k, k])[1])}</li>`).join('')}</ul></div>` : night <= 7 ? '<p class="small">Baseline week: sleep as you normally do and fill in the diary each morning.</p>' : ''}
            ${cmp && (cmp[0].n || cmp[1].n) ? `<div class="tbl-wrap"><table class="tbl compact sl-cmp"><thead><tr><th></th><th>Baseline (${cmp[0].n})</th><th>Changes (${cmp[1].n})</th><th>Change</th></tr></thead><tbody>
              ${row('Total sleep', 'tst', '', 'up', fh)}${row('Time to fall asleep', 'sol', ' min', 'down', f0)}${row('Awake after falling asleep', 'waso', ' min', 'down', f0)}${row('Efficiency', 'se', '%', 'up', f0)}${row('Quality (1–5)', 'q', '', 'up', (x) => (x == null ? '—' : x.toFixed(1)))}${row('HRV', 'hrv', ' ms', 'up', f0)}${row('Sleep score', 'score', '', 'up', f0)}
            </tbody></table></div><p class="fine">Small studies on yourself are noisy: treat a change as real when it holds for both weeks' worth of nights.</p>` : ''}
            <div class="row"><button class="btn ghost sm" data-act="sl-end">${night > 14 ? 'Start a new study' : 'Stop the study'}</button></div>`}
        </section>
        <section class="card"><div class="card-h"><h2>Last night</h2><span class="muted small">Sleep diary</span></div>
          <form data-submit="sl-diary" class="form-grid sl-form">
            <label class="field" for="sl-d"><span>Morning of</span><input id="sl-d" name="d" type="date" value="${dayKey()}"></label>
            <label class="field" for="sl-q"><span>Quality (1–5)</span><input id="sl-q" name="q" type="number" min="1" max="5" value="3"></label>
            <label class="field" for="sl-bed"><span>Went to bed</span><input id="sl-bed" name="bed" type="time" value="23:00"></label>
            <label class="field" for="sl-sol"><span>Minutes to fall asleep</span><input id="sl-sol" name="sol" type="number" min="0" max="300" value="15"></label>
            <label class="field" for="sl-waso"><span>Minutes awake in the night</span><input id="sl-waso" name="waso" type="number" min="0" max="600" value="10"></label>
            <label class="field" for="sl-wake"><span>Woke up for the day</span><input id="sl-wake" name="wake" type="time" value="06:45"></label>
            <label class="field" for="sl-out"><span>Got out of bed</span><input id="sl-out" name="out" type="time" value="07:00"></label>
            <label class="field" for="sl-nap"><span>Naps yesterday (min)</span><input id="sl-nap" name="nap" type="number" min="0" max="300" value="0"></label>
            <label class="ped-use"><input type="checkbox" name="caf"> Caffeine after 2 pm</label><label class="ped-use"><input type="checkbox" name="alc"> Alcohol in the evening</label>
            <div class="form-end"><button class="btn sm">Save night</button></div></form></section>
      </div>

      <section class="card"><div class="card-h"><h2>Your nights</h2><span class="muted small">${diary.length} diary nights${wn.length ? ` · ${wn.length} wearable nights` : ''}</span></div>
        ${diary.length ? `<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Night</th><th>In bed</th><th>Asleep</th><th>Efficiency</th><th>To fall asleep</th><th>Awake</th><th>Quality</th><th>Wearable</th><th></th></tr></thead><tbody>
          ${diary.slice(-14).reverse().map((n) => { const x = nightStats(n) || {}, wv = wBy.get(n.d); return `<tr><td class="num">${esc(n.d)}${n.sample ? ' <span class="chip">Example</span>' : n.src === 'import' ? ' <span class="chip">Imported</span>' : ''}</td><td class="num">${n.bed ? esc(n.bed) + '–' + esc(n.out || n.wake || '') : '—'}</td><td class="num">${hm(x.tst)}</td><td class="num">${x.se != null ? x.se + '%' : '—'}</td><td class="num">${x.sol != null ? x.sol + ' min' : '—'}</td><td class="num">${x.waso != null ? x.waso + ' min' : '—'}</td><td class="num">${n.q || '—'}</td><td class="num">${wv ? `${wv.sleepH.toFixed(1)} h · ${esc(wv.via)}` : '—'}</td><td><button class="icon-btn" data-act="sl-del" data-d="${esc(n.d)}" aria-label="Delete ${esc(n.d)}">×</button></td></tr>`; }).join('')}
        </tbody></table></div>` : `<p class="muted small">No diary nights yet. Fill in last night above, import a CSV below${wn.length ? '' : ', or connect a ring or strap on the Wearables page'}.</p><button class="btn ghost sm" data-act="sl-sample">Load an example week</button>`}
        ${wn.length && !diary.length ? `<p class="small">Wearable: ${wn.length} nights, average ${hm(avg(wn.map((x) => x.sleepH * 60)))} asleep${avg(wn.map((x) => x.hrv)) ? `, HRV ${Math.round(avg(wn.map((x) => x.hrv)))} ms` : ''}.</p>` : ''}
      </section>

      <section class="card sl-up"><div class="card-h"><h2>Upload sleep data</h2><span class="muted small">Read on this device; only summary numbers are kept</span></div>
        <div class="sl-drop"><div><b>Sleep study report (PDF)</b><span class="small muted">Overnight polysomnography or a home sleep apnea test: AHI, oxygen, stages, efficiency.</span></div>
          <div><b>Recording (EDF or EDF+)</b><span class="small muted">Signals from a sleep lab or home device. Myo reads blood oxygen and sleep-stage annotations; add the hypnogram file too if it is separate.</span></div>
          <div><b>Sleep app or diary (CSV)</b><span class="small muted">Columns like date, bedtime, wake time, total sleep, efficiency.</span></div></div>
        <div class="row"><label class="btn file">${icon('upload', 16)} ${busy ? esc(busy) : 'Choose files'}<input type="file" multiple accept=".pdf,.edf,.bdf,.csv,.txt,application/pdf,text/csv" data-change="sl-files"></label><span class="fine">Patient names and IDs in files are never read or stored.</span></div>
        ${S.recs.length ? S.recs.slice().reverse().map((r, i) => recCard(r, S.recs.length - 1 - i)).join('') : ''}
        ${S.reports.length ? S.reports.slice().reverse().map((r, i) => reportCard(r, S.reports.length - 1 - i)).join('') : ''}
      </section>

      <div class="grid g-2">
        <section class="card"><div class="card-h"><h2>Signs of sleep apnea</h2><span class="muted small">Not a diagnosis</span></div>
          <ul class="rc-screen">${SIGNS.map(([k, l]) => `<li><label class="ped-use"><input type="checkbox" data-change="sl-sign" data-k="${k}" ${S.signs[k] ? 'checked' : ''}> ${esc(l)}</label></li>`).join('')}</ul>
          <p class="fine">Three or more signs: ask your doctor about a sleep study. Validated questionnaires (such as STOP-Bang or the Epworth scale) can be added under licence.</p></section>
        <section class="card"><div class="card-h"><h2>Also see a sleep clinician for</h2></div>
          <ul class="ath-list">${OTHER.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
          <p class="fine">Myo helps you run and read your own sleep experiments. It does not diagnose sleep disorders; a sleep physician interprets formal studies.</p></section>
      </div>`;
    }
  });
  function recCard(r, i) {
    const st = r.stages, sp = r.spo2;
    return `<article class="sl-rec"><div class="card-h"><div><b>${esc(r.name)}</b><span class="muted small block">${r.start ? esc(new Date(r.start).toISOString().slice(0, 16).replace('T', ' ')) + ' · ' : ''}${r.hours} h recorded · ${r.signals.length} signals</span></div><button class="icon-btn" data-act="sl-rm" data-t="recs" data-i="${i}" aria-label="Remove">×</button></div>
      ${st ? `<dl class="sl-kv"><div><dt>Asleep</dt><dd class="num">${hm(st.tst)}</dd></div><div><dt>Efficiency*</dt><dd class="num">${st.se}%</dd></div><div><dt>Awake after sleep onset</dt><dd class="num">${st.waso} min</dd></div><div><dt>REM latency</dt><dd class="num">${st.remLat != null ? st.remLat + ' min' : '—'}</dd></div><div><dt>N1 · N2 · N3 · REM</dt><dd class="num">${st.pct.N1} · ${st.pct.N2} · ${st.pct.N3} · ${st.pct.R}%</dd></div></dl>
        <div class="sl-plot">${hypnoSvg(st)}</div><p class="fine">*Measured across the sleep period (first to last sleep), because lights-off time isn't in the file.</p>` : ''}
      ${sp ? `<dl class="sl-kv"><div><dt>Average SpO₂</dt><dd class="num">${sp.mean}%</dd></div><div><dt>Lowest</dt><dd class="num">${sp.nadir}% ${pill(...band('nadir', sp.nadir))}</dd></div><div><dt>Time below 90%</dt><dd class="num">${sp.t90}% ${pill(...band('t90', sp.t90))}</dd></div></dl><div class="sl-plot">${spo2Svg(sp)}</div>` : ''}
      ${!st && !sp ? `<p class="small muted">No blood-oxygen channel or sleep-stage annotations found. Signals: ${esc(r.signals.slice(0, 10).join(', '))}${r.signals.length > 10 ? '…' : ''}</p>` : ''}</article>`;
  }
  function reportCard(r, i) {
    const keys = PDF_RULES.filter(([k]) => r.m[k] != null);
    return `<article class="sl-rec"><div class="card-h"><div><b>${esc(r.name)}</b><span class="muted small block">Sleep study report · added ${esc(r.at)}</span></div><button class="icon-btn" data-act="sl-rm" data-t="reports" data-i="${i}" aria-label="Remove">×</button></div>
      ${keys.length ? `<dl class="sl-kv">${keys.map(([k, n, , u]) => { const b = band(k, r.m[k]); return `<div><dt>${esc(n)}</dt><dd class="num">${k === 'tst' ? hm(r.m[k]) : r.m[k] + (u.startsWith('%') ? '%' : ' ' + u)}${b ? ' ' + pill(...b) : ''}</dd></div>`; }).join('')}</dl>
        <p class="fine">Bands are the standard adult categories, shown for context. Your sleep physician's interpretation is what counts, especially for treatment.</p>` : '<p class="small muted">No sleep study numbers were found in this PDF. Scanned (image) reports need typing in by hand.</p>'}</article>`;
  }

  /* ── actions ── */
  OS.act('sl-start', (f) => {
    const ivs = [...f.querySelectorAll('input[name=iv]:checked')].map((x) => x.value);
    if (!ivs.length) { OS.toast('Pick at least one change for the second week.'); return; }
    OS.update((s) => { ensure(s).study = { start: dayKey(), ivs }; }, { keepSample: true });
    OS.toast('Study started. Fill in the diary each morning.');
  });
  OS.act('sl-end', () => OS.update((s) => { ensure(s).study = null; }, { keepSample: true }));
  OS.act('sl-diary', (f) => {
    const e = f.elements, n = { d: e.d.value || dayKey(), bed: e.bed.value, sol: +e.sol.value || 0, waso: +e.waso.value || 0, wake: e.wake.value, out: e.out.value, q: Math.max(1, Math.min(5, +e.q.value || 3)), nap: +e.nap.value || 0, caf: e.caf.checked, alc: e.alc.checked, src: 'diary' };
    const st = nightStats(n);
    if (!st) { OS.toast('Check the times: getting up must come after going to bed.'); return; }
    OS.update((s) => { const S = ensure(s); S.diary = S.diary.filter((x) => x.d !== n.d); S.diary.push({ ...n, ...st }); }, { keepSample: true });
    OS.toast(`Saved: ${hm(st.tst)} asleep, ${st.se}% efficiency.`);
  });
  OS.act('sl-del', (el) => OS.update((s) => { const S = ensure(s); S.diary = S.diary.filter((x) => x.d !== el.dataset.d); }, { keepSample: true }));
  OS.act('sl-rm', (el) => OS.update((s) => { ensure(s)[el.dataset.t].splice(+el.dataset.i, 1); }, { keepSample: true }));
  OS.change('sl-sign', (el) => OS.update((s) => { ensure(s).signs[el.dataset.k] = el.checked; }, { keepSample: true }));
  OS.act('sl-sample', () => {
    const ex = [['23:10', 25, 20, '06:40', '06:55', 3], ['23:40', 35, 30, '06:45', '07:10', 2], ['22:55', 15, 10, '06:35', '06:50', 4], ['00:20', 40, 25, '07:30', '08:00', 2], ['23:05', 20, 15, '06:40', '06:50', 3], ['23:30', 15, 35, '06:45', '07:00', 3], ['22:50', 10, 10, '06:30', '06:40', 4]];
    OS.update((s) => { const S = ensure(s); ex.forEach(([bed, sol, waso, wake, out, q], i) => { const n = { d: dayKey(addDays(new Date(), -(7 - i))), bed, sol, waso, wake, out, q, src: 'diary', sample: true }; S.diary = S.diary.filter((x) => x.d !== n.d); S.diary.push({ ...n, ...nightStats(n) }); }); }, { keepSample: true });
    OS.toast('Loaded 7 example nights, marked as examples. Delete them when you add your own.');
  });
  OS.change('sl-files', async (el) => {
    const files = [...(el.files || [])]; if (!files.length) return;
    const recs = [], reports = [], nights = [], problems = [];
    for (const f of files) {
      busy = `Reading ${f.name}…`; if (OS.current === 'sleep') OS.render();
      try {
        if (/\.(edf|bdf)$/i.test(f.name)) recs.push(await parseEdf(f));
        else if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') { if (!OS.pdfToLines) throw new Error('The PDF reader is not available.'); reports.push({ name: f.name, at: dayKey(), m: parseReport((await OS.pdfToLines(f)).join('\n')) }); }
        else { const n = parseCsv(await f.text()); if (!n.length) throw new Error(`${f.name}: no nights found (need a date and sleep times or total sleep).`); nights.push(...n); }
      } catch (e) { problems.push(e.message || String(e)); }
    }
    busy = '';
    // a signals file and a separate hypnogram file from the same night become one recording
    const merged = [];
    recs.forEach((r) => { const mate = merged.find((m) => (m.stages && !m.spo2 && r.spo2 && !r.stages) || (m.spo2 && !m.stages && r.stages && !r.spo2)); if (mate) { Object.assign(mate, { stages: mate.stages || r.stages, spo2: mate.spo2 || r.spo2, name: mate.name + ' + ' + r.name, signals: [...mate.signals, ...r.signals] }); } else merged.push(r); });
    OS.update((s) => { const S = ensure(s); S.recs.push(...merged.map((r) => ({ ...r, at: dayKey() }))); S.reports.push(...reports); nights.forEach((n) => { S.diary = S.diary.filter((x) => x.d !== n.d); S.diary.push(n); }); }, { keepSample: true });
    OS.toast(problems.length ? problems[0] : `Added ${merged.length + reports.length} file${merged.length + reports.length === 1 ? '' : 's'}${nights.length ? ` and ${nights.length} nights` : ''}.`);
  });

  OS.sleep = { parseEdf, parseReport, parseCsv, hypno, nightStats };
})();
