/* ═══ MYO — BODY COMPOSITION: smart-scale scans and DEXA reports on one timeline ═══
   Smart scales  · Bluetooth scales that use the standard Weight Scale (0x181D) or Body Composition (0x181B) service are
                   read directly; scales that pair only with their maker's app (the Hume Pod pairs with the Hume app) come
                   in through that app's Apple Health sync (export.zip, read on this device), a CSV export, or quick entry
   DEXA          · PDF reports are read on this device (objects, object streams, Flate, ToUnicode maps, form XObjects),
                   or pasted, or typed in; every value read from a report is shown for review before it is saved
   Overview      · latest composition, a regional map with left/right symmetry, change since the first scan,
                   ALMI / FFMI / FMI with published reference points
   Scale vs DEXA · pairs a scale reading with each DEXA scan (within 3 days) to find your personal offset, then anchors
                   the day-to-day scale trend to the DEXA level
   Wellness tracking, not diagnosis: bone density and body composition are interpreted by your clinician. */
(function () {
  'use strict';
  const { esc, icon, pill, clamp, dayKey, addDays, fmtDate, uid } = OS;
  const LB = 0.45359237;
  const BC = { tab: 'overview', view: 'apple', src: null, draft: null, du: 'kg', su: 'kg', note: '', snote: '', pending: null, busy: '', ble: null, lastBatch: null, paste: false, charts: {} };
  const TABS = [['overview', 'Overview'], ['scale', 'Smart scale'], ['dexa', 'DEXA'], ['compare', 'Scale vs DEXA']];
  const REG = [['ra', 'Right arm'], ['la', 'Left arm'], ['tr', 'Trunk'], ['rl', 'Right leg'], ['ll', 'Left leg']];
  const LIMBS = ['la', 'ra', 'll', 'rl'];
  const ok = (v) => v != null && v !== '' && Number.isFinite(+v);
  const num = (v) => { if (v == null || v === '') return null; const n = +String(v).replace(/,/g, '').trim(); return Number.isFinite(n) ? n : null; };
  const rd = (x, d = 1) => (ok(x) ? Math.round(x * 10 ** d) / 10 ** d : null);
  const f = (x, d = 1, u = '') => (ok(x) ? `${OS.fmt(x, d)}${u}` : '—');
  const sgn = (x, d = 1, u = '') => (ok(x) ? `${x > 0.0001 ? '+' : x < -0.0001 ? '−' : '±'}${OS.fmt(Math.abs(x), d)}${u}` : '—');
  const SRCN = { ble: 'Bluetooth scale', apple: 'Apple Health', csv: 'CSV file', manual: 'Entered by hand', file: 'Report' };
  const day = (d) => Date.parse(d + 'T12:00:00');

  function ensure(s) {
    if (!s.bodycomp || !Array.isArray(s.bodycomp.scans)) s.bodycomp = { scans: s.sample ? sampleScans() : [] };
    return s.bodycomp;
  }
  const scans = (s, kind) => ensure(s).scans.filter((x) => !kind || x.kind === kind).sort((a, b) => a.d.localeCompare(b.d) || String(a.at || '').localeCompare(String(b.at || '')));
  const hOf = (s) => +(s.profile && s.profile.heightCm) || 175;
  const sexOf = (s) => (s.profile && s.profile.sex === 'F' ? 'F' : 'M');

  // a sample member: 4 months of scale readings (fat falling, fat-free mass rising, water noise) and two DEXA scans
  function sampleScans() {
    const T = new Date(), out = []; let sd = 11;
    const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647 - 0.5; };
    for (let k = 120; k >= 1; k -= 3) {
      const p = 1 - k / 120, ffm = 66.3 + 1.2 * p + rnd() * 0.9, fat = 17.4 - 3.4 * p + rnd() * 0.5, w = ffm + fat;
      out.push({ id: uid(), d: dayKey(addDays(T, -k)), src: 'apple', kind: 'bia', dev: 'Hume Pod (sample)', sample: true,
        w: rd(w), bf: rd((fat / w) * 100), smm: rd(ffm * 0.555), water: rd(((ffm * 0.732) / w) * 100), bmc: 3.3, vatR: Math.round(9 - 2.2 * p), bmr: Math.round(370 + 21.6 * ffm), mage: Math.round(33 - 3 * p) });
    }
    const dx = (k, o) => ({ id: uid(), d: dayKey(addDays(T, -k)), src: 'file', kind: 'dexa', dev: 'Hospital DXA (sample)', sample: true, ...o });
    out.push(dx(118, { w: 84.6, bf: 23.5, fat: 19.9, lean: 61.38, bmc: 3.32, vat: 0.62, vatv: 657, ag: 1.06, bmd: 1.3, t: 1.2, z: 1.0,
      seg: { la: { lean: 3.3, fat: 1.05 }, ra: { lean: 3.45, fat: 1.0 }, tr: { lean: 30.4, fat: 10.9 }, ll: { lean: 10.25, fat: 3.05 }, rl: { lean: 10.45, fat: 3.0 } } }));
    out.push(dx(5, { w: 82.4, bf: 20.0, fat: 16.5, lean: 62.57, bmc: 3.33, vat: 0.47, vatv: 498, ag: 0.95, bmd: 1.31, t: 1.3, z: 1.1,
      seg: { la: { lean: 3.42, fat: 0.9 }, ra: { lean: 3.55, fat: 0.86 }, tr: { lean: 30.9, fat: 8.9 }, ll: { lean: 10.5, fat: 2.62 }, rl: { lean: 10.66, fat: 2.58 } } }));
    return out;
  }

  /* ── body maths ── */
  function derive(x, hCm) {
    const h = (hCm || 175) / 100, w = num(x.w);
    let fat = num(x.fat), bf = num(x.bf);
    if (fat == null && bf != null && w) fat = (w * bf) / 100;
    if (bf == null && fat != null && w) bf = (fat / w) * 100;
    const bmc = num(x.bmc), lean = num(x.lean);
    const ffm = w != null && fat != null ? w - fat : lean != null ? lean + (bmc || 0) : null;
    const lst = lean != null ? lean : ffm != null && bmc != null ? ffm - bmc : null;
    const sg = x.seg || null; let alm = null, sym = null;
    if (sg && LIMBS.every((k) => sg[k] && ok(sg[k].lean))) {
      alm = LIMBS.reduce((a, k) => a + +sg[k].lean, 0);
      const gap = (a, b) => (Math.abs(a - b) / ((a + b) / 2)) * 100;
      sym = { arm: gap(+sg.la.lean, +sg.ra.lean), leg: gap(+sg.ll.lean, +sg.rl.lean) };
    }
    return { w, fat, bf, ffm, lst, bmc, alm, almi: alm != null ? alm / (h * h) : null, ffmi: ffm != null ? ffm / (h * h) : null, fmi: fat != null ? fat / (h * h) : null, sym };
  }
  function syncProfile(st) { const last = scans(st).filter((x) => ok(x.w) && !x.sample).pop(); if (last && st.profile) st.profile.weightKg = rd(+last.w, 1); }

  /* ── charts: one time axis, hover crosshair and tooltip ── */
  function ticks(lo, hi, n = 4) {
    const span = hi - lo || 1, mag = 10 ** Math.floor(Math.log10(span / n)), st = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => span / k <= n + 0.5) || 10 * mag;
    const a = Math.floor(lo / st) * st, b = Math.ceil(hi / st) * st, out = [];
    for (let v = a; v <= b + st / 2; v += st) out.push(+v.toFixed(6));
    return out;
  }
  // series: [{ cls, name, line, pts: [{ t, v, mark }] }]; rows: [{ t, html }] for the tooltip
  function lineChart(id, series, rows, opt = {}) {
    if (series.flatMap((s) => s.pts).length < 2) return '';
    return `<div class="bc-chart" data-chart="${id}">${svgChart({ id, series, rows, opt }, 640)}</div>`;
  }
  function svgChart(spec, W) {
    const { id, series, rows, opt } = spec, all = series.flatMap((s) => s.pts);
    const H = opt.h || 230, L = 46, R = Math.min(opt.r || 16, Math.round(W * 0.32)), T = 12, B = 28;
    const t0 = Math.min(...all.map((p) => p.t)), t1 = Math.max(...all.map((p) => p.t));
    let lo = Math.min(...all.map((p) => p.v)), hi = Math.max(...all.map((p) => p.v));
    if (opt.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    const pad = (hi - lo) * 0.08 || 1, tk = ticks(lo - pad, hi + pad); lo = tk[0]; hi = tk[tk.length - 1];
    const X = (t) => L + ((t - t0) / (t1 - t0 || 1)) * (W - L - R), Y = (v) => T + ((hi - v) / (hi - lo || 1)) * (H - T - B);
    const grid = tk.map((v) => `<line class="bc-grid${opt.zero && v === 0 ? ' zero' : ''}" x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="bc-ax" x="${L - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${OS.fmt(v, Math.abs(tk[1] - tk[0]) < 1 ? 1 : 0)}${opt.unit || ''}</text>`).join('');
    const nx = W < 420 ? 2 : 3;
    const xt = Array.from({ length: nx + 1 }, (_, i) => i).map((i) => { const t = t0 + ((t1 - t0) * i) / nx; return `<text class="bc-ax" x="${X(t).toFixed(1)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : i === nx ? 'end' : 'middle'}">${fmtDate(dayKey(new Date(t)))}</text>`; }).join('');
    const lines = series.filter((s) => s.line !== false && s.pts.length > 1).map((s) => `<path class="bc-ln bc-${s.cls}" d="${s.pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(' ')}"/>`).join('');
    const marks = series.flatMap((s) => s.pts.filter((p) => p.mark).map((p) => { const x = X(p.t), y = Y(p.v); return p.mark === 'dia' ? `<path class="bc-mk bc-${s.cls}" d="M${x.toFixed(1)} ${(y - 6).toFixed(1)} l6 6 l-6 6 l-6 -6 Z"/>` : `<circle class="bc-mk bc-${s.cls}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4"/>`; })).join('');
    const ends = (opt.ends || []).map((e) => `<text class="bc-end" x="${W - R + 8}" y="${(Y(e.v) + 4).toFixed(1)}">${esc(e.text)}</text>`).join('');
    BC.charts[id] = { X, W, spec, rows: rows.slice().sort((a, b) => a.t - b.t) };
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.label || '')}">${grid}${xt}${lines}${marks}${ends}
      <line class="bc-cross" x1="0" x2="0" y1="${T}" y2="${H - B}" style="display:none"/><rect class="bc-hit" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}"/></svg><div class="bc-tip" hidden></div>`;
  }
  function bindCharts(root) {
    root.querySelectorAll('.bc-chart').forEach((el) => {
      let C = BC.charts[el.dataset.chart]; if (!C) return;
      const w = Math.round(el.clientWidth); if (w && Math.abs(w - C.W) > 8) { el.innerHTML = svgChart(C.spec, clamp(w, 280, 1100)); C = BC.charts[el.dataset.chart]; }
      if (!C.rows.length) return;
      const svg = el.querySelector('svg'), tip = el.querySelector('.bc-tip'), cross = el.querySelector('.bc-cross');
      const move = (e) => {
        const r = svg.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * C.W;
        let best = C.rows[0], bd = Infinity; C.rows.forEach((row) => { const d = Math.abs(C.X(row.t) - x); if (d < bd) { bd = d; best = row; } });
        const px = C.X(best.t); cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.style.display = '';
        tip.innerHTML = best.html; tip.hidden = false; tip.style.left = `${clamp((px / C.W) * r.width, 80, Math.max(80, r.width - 80))}px`;
      };
      svg.addEventListener('pointermove', move); svg.addEventListener('pointerdown', move);
      svg.addEventListener('pointerleave', () => { tip.hidden = true; cross.style.display = 'none'; });
    });
  }
  const tipHtml = (x, D) => `<b>${esc(fmtDate(x.d))}</b> · ${esc(x.kind === 'dexa' ? 'DEXA' : 'Scale')}${x.dev ? ` · ${esc(x.dev)}` : ''}<br>Weight ${f(D.w, 1, ' kg')} · body fat ${f(D.bf, 1, '%')}<br>Fat ${f(D.fat, 1, ' kg')} · fat-free ${f(D.ffm, 1, ' kg')}`;

  /* ── pictures: composition bar, regional map, bone scale ── */
  function compBar(D) {
    const parts = D.bmc != null && D.lst != null ? [['fat', 'Fat', D.fat], ['lean', 'Lean tissue', D.lst], ['bone', 'Bone mineral', D.bmc]] : [['fat', 'Fat', D.fat], ['lean', 'Fat-free mass', D.ffm]];
    if (parts.some((p) => !ok(p[2]) || p[2] < 0)) return '';
    const tot = parts.reduce((a, p) => a + p[2], 0), W = 600, gap = 2; let x = 0;
    const segs = parts.map(([k, , v]) => { const w = Math.max(2, (v / tot) * (W - gap * (parts.length - 1))); const r = `<rect class="bc-seg bc-${k}" x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="24" rx="4"/>`; x += w + gap; return r; }).join('');
    return `<svg class="bc-bar" viewBox="0 0 ${W} 24" preserveAspectRatio="none" role="img" aria-label="${esc(parts.map(([, n, v]) => `${n} ${f(v)} kg`).join(', '))}">${segs}</svg>
      <ul class="bc-leg">${parts.map(([k, n, v]) => `<li><i class="bc-sw bc-${k}"></i>${n} <b>${f(v, 1, ' kg')}</b> <span>${Math.round((v / tot) * 100)}%</span></li>`).join('')}</ul>`;
  }
  function bodyMap(x) {
    const sg = x.seg || {}, pct = (k) => (sg[k] && ok(sg[k].fat) && ok(sg[k].lean) ? (+sg[k].fat / (+sg[k].fat + +sg[k].lean + 0.0001)) * 100 : null);
    const fill = (k) => { const p = pct(k); return p == null ? 'var(--card-2)' : `color-mix(in srgb, var(--bc-c2) ${Math.round(clamp((p - 5) / 40, 0.08, 0.92) * 100)}%, var(--card))`; };
    const shape = { ra: 'M96 64 q-4 0 -6 6 l-10 98 q0 8 8 8 h6 q6 0 7 -6 l8 -96 q0 -10 -7 -10 Z', la: 'M204 64 q4 0 6 6 l10 98 q0 8 -8 8 h-6 q-6 0 -7 -6 l-8 -96 q0 -10 7 -10 Z', tr: 'M118 56 h64 q10 0 10 12 v94 q0 12 -12 12 h-60 q-12 0 -12 -12 v-94 q0 -12 10 -12 Z', rl: 'M120 178 h28 l-2 112 q0 6 -7 6 h-12 q-7 0 -7 -7 Z', ll: 'M152 178 h28 l0 111 q0 7 -7 7 h-12 q-7 0 -7 -6 Z' };
    const lab = { ra: [76, 104, 'end'], la: [224, 104, 'start'], tr: [150, 108, 'middle'], rl: [112, 236, 'end'], ll: [188, 236, 'start'] };
    const txt = (k) => { const [lx, ly, a] = lab[k], v = sg[k]; if (!v || !ok(v.lean)) return ''; return `<text class="bc-mtx" x="${lx}" y="${ly}" text-anchor="${a}"><tspan x="${lx}">${f(+v.lean, 1)} kg lean</tspan><tspan x="${lx}" dy="15">${pct(k) == null ? '' : `${f(pct(k), 0)}% fat`}</tspan></text>`; };
    return `<svg class="bc-map" viewBox="0 0 300 304" role="img" aria-label="Regional lean mass and fat percentage">
      <text class="bc-ax" x="96" y="20" text-anchor="middle">R</text><text class="bc-ax" x="204" y="20" text-anchor="middle">L</text>
      <circle class="bc-head" cx="150" cy="30" r="19"/>${Object.keys(shape).map((k) => `<path class="bc-reg" d="${shape[k]}" style="fill:${fill(k)}"><title>${REG.find((r) => r[0] === k)[1]}</title></path>`).join('')}
      ${Object.keys(lab).map(txt).join('')}</svg>`;
  }
  function boneScale(t, z) {
    if (!ok(t) && !ok(z)) return '';
    const W = 560, X = (v) => 20 + ((clamp(v, -4, 3) + 4) / 7) * (W - 40);
    const band = (a, b, cls, label) => `<rect class="bc-bb ${cls}" x="${X(a).toFixed(1)}" y="18" width="${(X(b) - X(a)).toFixed(1)}" height="16"/><text class="bc-ax" x="${((X(a) + X(b)) / 2).toFixed(1)}" y="50" text-anchor="middle">${label}</text>`;
    const mk = (v, label, hollow) => (ok(v) ? `<path class="bc-bm${hollow ? ' hollow' : ''}" d="M${X(v).toFixed(1)} 34 l-7 -12 h14 Z"/><text class="bc-mtx" x="${X(v).toFixed(1)}" y="12" text-anchor="middle">${label} ${OS.fmt(v, 1)}</text>` : '');
    return `<svg class="bc-bonesc" viewBox="0 0 ${W} 60" role="img" aria-label="T-score ${ok(t) ? t : 'not given'}, Z-score ${ok(z) ? z : 'not given'}">${band(-4, -2.5, 'b1', '−2.5 or lower')}${band(-2.5, -1, 'b2', '−2.5 to −1')}${band(-1, 3, 'b3', '−1 or higher')}${mk(t, 'T', false)}${mk(z, 'Z', true)}</svg>`;
  }

  /* ── pages ── */
  const tile = (label, value, unit, sub) => `<div><span>${label}</span><b>${value}</b><em>${unit}</em>${sub ? `<i>${sub}</i>` : ''}</div>`;
  function empty() {
    const ways = [['scale', 'Smart scale', 'Bluetooth scales connect directly. The Hume Pod and other app-based scales come in through their Apple Health sync, a CSV file or quick entry.'], ['dexa', 'DEXA report', 'Read the PDF from your scan provider, paste its text, or type the numbers in.'], ['example', 'See an example', 'Load sample scans to explore the page. Remove them with one tap.']];
    return `<section class="card"><div class="card-h"><h2>Add your first scan</h2><span class="muted small">Read on this device</span></div>
      <div class="bc-ways">${ways.map(([k, t, d]) => `<button class="st-src" data-act="${k === 'example' ? 'bc-example' : 'bc-tab'}" data-t="${k}"><b>${t}</b><span>${d}</span></button>`).join('')}</div></section>`;
  }
  function overview(s) {
    const all = scans(s), h = hOf(s), sex = sexOf(s);
    if (!all.length) return empty();
    const dexa = scans(s, 'dexa'), bia = scans(s, 'bia'), last = all[all.length - 1], Lx = derive(last, h);
    const lastD = dexa[dexa.length - 1], D = lastD ? derive(lastD, h) : null;
    const segScan = [...dexa].reverse().find((x) => x.seg) || [...bia].reverse().find((x) => x.seg);
    const prev = (x) => { const same = scans(s, x.kind), i = same.indexOf(x); return i > 0 ? same[i - 1] : null; };
    const pv = prev(last), P = pv ? derive(pv, h) : null, src = (x) => `${x.kind === 'dexa' ? 'DEXA' : 'Scale'} · ${fmtDate(x.d)}`;
    const dl = (a, b, u, d = 1) => (P && ok(a) && ok(b) ? `${sgn(a - b, d, u)} since ${fmtDate(pv.d)}` : src(last));
    const tiles = [tile('Weight', f(Lx.w), 'kg', dl(Lx.w, P && P.w, ' kg')), tile('Body fat', f(Lx.bf), '%', dl(Lx.bf, P && P.bf, ' pts')), tile('Fat mass', f(Lx.fat), 'kg', dl(Lx.fat, P && P.fat, ' kg')), tile('Fat-free mass', f(Lx.ffm), 'kg', dl(Lx.ffm, P && P.ffm, ' kg'))];
    if (lastD && ok(lastD.vat)) tiles.push(tile('Visceral fat', f(+lastD.vat * 1000, 0), 'g (DEXA)', `DEXA · ${fmtDate(lastD.d)}`));
    else if (ok(last.vatR)) tiles.push(tile('Visceral fat', f(last.vatR, 0), 'scale rating', src(last)));
    const AL = segScan ? derive(segScan, h) : null;
    if (AL && ok(AL.almi)) tiles.push(tile('ALMI', f(AL.almi, 2), 'kg/m²', `${segScan.kind === 'dexa' ? 'DEXA' : 'Scale estimate'} · ${fmtDate(segScan.d)}`));
    if (lastD && ok(lastD.t)) tiles.push(tile('Bone (T-score)', f(+lastD.t, 1), lastD.bmd ? `${f(+lastD.bmd, 3)} g/cm²` : '', `DEXA · ${fmtDate(lastD.d)}`));
    else if (ok(last.bmc)) tiles.push(tile('Bone mass', f(+last.bmc), 'kg', src(last)));
    // trend
    if (!BC.src || !scans(s, BC.src).length) BC.src = bia.length >= 2 ? 'bia' : 'dexa';
    const rows = scans(s, BC.src).map((x) => ({ x, D: derive(x, h) })).filter((r) => ok(r.D.fat) && ok(r.D.ffm));
    let trend = '<p class="small muted">Two or more scans from one source draw a trend.</p>', said = '';
    if (rows.length >= 2) {
      const a = rows[0].D, b = rows[rows.length - 1].D, dF = b.fat - a.fat, dL = b.ffm - a.ffm, mk = rows.length <= 30 ? (BC.src === 'dexa' ? 'dia' : 'dot') : null;
      const ser = [{ cls: 'fat', name: 'Fat mass', pts: rows.map((r) => ({ t: day(r.x.d), v: r.D.fat - a.fat, mark: mk })) }, { cls: 'lean', name: 'Fat-free mass', pts: rows.map((r) => ({ t: day(r.x.d), v: r.D.ffm - a.ffm, mark: mk })) }];
      trend = `<ul class="bc-key"><li><i class="bc-sw bc-fat"></i>Fat mass</li><li><i class="bc-sw bc-lean"></i>Fat-free mass</li></ul>
        ${lineChart('ov', ser, rows.map((r) => ({ t: day(r.x.d), html: tipHtml(r.x, r.D) })), { zero: true, unit: '', r: 118, label: `Change in fat mass and fat-free mass since ${fmtDate(rows[0].x.d)}`, ends: [{ v: dF, text: `Fat ${sgn(dF, 1, ' kg')}` }, { v: dL + (Math.abs(dL - dF) < 0.6 ? (dL >= dF ? 0.5 : -0.5) : 0), text: `Fat-free ${sgn(dL, 1, ' kg')}` }] })}
        <p class="fine">Change in kilograms since ${fmtDate(rows[0].x.d)}. Hover or tap for each scan.</p>`;
      said = dF < -0.5 && dL > -0.5 ? `You lost ${f(-dF)} kg of fat and ${dL > 0.5 ? `gained ${f(dL)} kg of` : 'kept your'} fat-free mass. That is the recomposition pattern.` : dF > 0.5 && dL > 0.5 ? `You gained ${f(dF)} kg of fat and ${f(dL)} kg of fat-free mass.` : dF < -0.5 && dL < -0.5 ? `You lost ${f(-dF)} kg of fat and ${f(-dL)} kg of fat-free mass. Strength training and enough protein help keep muscle while losing weight.` : dF > 0.5 ? `Fat mass is up ${f(dF)} kg while fat-free mass held within half a kilogram.` : 'Fat and fat-free mass are within about half a kilogram of where they started.';
    }
    const ref = [];
    if (AL && ok(AL.almi)) ref.push(`<li><b>ALMI ${f(AL.almi, 2)} kg/m².</b> Lean mass in your arms and legs for your height. The European sarcopenia group (EWGSOP2) uses below ${sex === 'F' ? '5.5' : '7.0'} as one sign of low muscle mass${AL.almi < (sex === 'F' ? 5.5 : 7.0) ? '. Yours is below it: worth raising with your clinician, and strength training with enough protein is the main lever.' : '.'}</li>`);
    const FF = D || Lx;
    if (ok(FF.ffmi)) ref.push(`<li><b>FFMI ${f(FF.ffmi, 1)} kg/m².</b> Fat-free mass for your height. ${sex === 'F' ? 'Typical for women is about 14 to 17; trained women often reach 18 to 20.' : 'Typical for men is about 18 to 20; trained men often reach 21 to 23, and about 25 is the upper end reported without drugs.'}</li>`);
    if (ok(FF.fmi)) ref.push(`<li><b>FMI ${f(FF.fmi, 1)} kg/m².</b> Fat mass for your height. A large DEXA reference study (Kelly 2009) put the usual range at ${sex === 'F' ? '5 to 9 for women' : '3 to 6 for men'}.</li>`);
    const sym = segScan && AL && AL.sym ? `<p class="small">Left and right: arms ${f(AL.sym.arm, 0)}% apart, legs ${f(AL.sym.leg, 0)}% apart in lean mass. A gap over about 10% is worth a look with your coach or physio.</p>` : '';
    return `<section class="card"><div class="card-h"><h2>Latest</h2><span class="muted small">${esc(last.kind === 'dexa' ? 'DEXA' : 'Smart scale')} · ${esc(fmtDate(last.d))}${last.sample ? ' · sample' : ''}</span></div>
        <div class="lb-tiles bc-tiles">${tiles.join('')}</div>
        ${compBar(D || Lx)}<p class="fine">${D ? `Composition from your DEXA scan on ${fmtDate(lastD.d)}.` : 'Composition from your latest scale reading.'}</p></section>
      <div class="grid g-2">
        <section class="card"><div class="card-h"><h2>Change over time</h2><div class="seg" role="group" aria-label="Source">${[['bia', 'Scale'], ['dexa', 'DEXA']].map(([k, l]) => `<button class="${BC.src === k ? 'on' : ''}" data-act="bc-src" data-k="${k}" ${scans(s, k).length ? '' : 'disabled'}>${l}</button>`).join('')}</div></div>
          ${trend}${said ? `<p class="small">${esc(said)}</p>` : ''}${BC.src === 'bia' ? '<p class="fine">Scale readings move with hydration. Compare readings taken the same way, and see Scale vs DEXA for your offset.</p>' : '<p class="fine">Changes under about 0.5 to 1 kg between DEXA scans can be measurement noise.</p>'}</section>
        <section class="card"><div class="card-h"><h2>Regions</h2><span class="muted small">${segScan ? `${segScan.kind === 'dexa' ? 'DEXA' : 'Scale'} · ${fmtDate(segScan.d)}` : 'Needs a segmental scan'}</span></div>
          ${segScan ? `${bodyMap(segScan)}<p class="fine">Stronger orange means a higher fat share in that region. R and L are your right and left, as if you face the screen.</p>${sym}` : '<p class="small">DEXA reports and 8-sensor scales (with hand grips, like the Hume Pod) measure arms, legs and trunk separately. Add one to see your regions and left/right balance.</p>'}</section></div>
      ${ref.length ? `<section class="card"><div class="card-h"><h2>For your height</h2></div><ul class="bc-ref small">${ref.join('')}</ul><p class="fine">Reference points, not a diagnosis. Your clinician interprets body composition alongside strength, labs and history.</p></section>` : ''}
      ${all.some((x) => x.sample) ? `<p class="small muted">Sample scans are shown. <button class="btn ghost sm" data-act="bc-unsample">Remove sample scans</button></p>` : ''}`;
  }

  /* ── smart scale ── */
  function scaleTab(s) {
    const rows = scans(s, 'bia').slice().reverse(), V = BC.view;
    const ways = [['ble', 'Bluetooth scale', 'Standard Weight Scale and Body Composition services', 'Bluetooth'], ['apple', 'Hume Pod and app-based scales', "Through the scale app's Apple Health sync", 'export.zip'], ['csv', 'CSV export', 'Any scale app or spreadsheet', 'CSV'], ['manual', 'Quick entry', "Type in today's reading", 'By hand']];
    return `<section class="card"><div class="card-h"><h2>Connect a scale</h2><span class="muted small">Everything is read on this device</span></div>
        <div class="st-srcs">${ways.map(([k, t, d, i]) => `<button class="st-src ${V === k ? 'on' : ''}" data-act="bc-view" data-k="${k}" aria-pressed="${V === k}"><b>${t}</b><span>${d}</span><em>${i}</em></button>`).join('')}</div>
        <div class="bc-panel">${V === 'ble' ? blePanel() : V === 'csv' ? csvPanel() : V === 'manual' ? manualPanel() : applePanel()}</div></section>
      <section class="card"><div class="card-h"><h2>Scale readings</h2><span class="muted small">${rows.length} saved</span></div>
        ${rows.length ? `<div class="tbl-wrap"><table class="tbl compact"><caption class="sr">Smart scale readings</caption><thead><tr><th scope="col">Date</th><th scope="col">Device</th><th scope="col">Weight</th><th scope="col">Body fat</th><th scope="col">Muscle</th><th scope="col">Water</th><th scope="col">Visceral</th><th scope="col"><span class="sr">Delete</span></th></tr></thead>
          <tbody>${rows.slice(0, 40).map((x) => `<tr><th scope="row" class="small">${esc(fmtDate(x.d))}</th><td class="small">${esc(x.dev || SRCN[x.src] || '')}</td><td class="num">${f(x.w, 1, ' kg')}</td><td class="num">${f(x.bf, 1, '%')}</td><td class="num">${f(x.smm, 1, ' kg')}</td><td class="num">${f(x.water, 1, '%')}</td><td class="num">${f(x.vatR, 0)}</td><td><button class="lb-del" data-act="bc-del" data-id="${x.id}" aria-label="Delete reading from ${esc(fmtDate(x.d))}">${icon('x', 14)}</button></td></tr>`).join('')}</tbody></table></div>
          ${rows.length > 40 ? `<p class="fine">Showing the latest 40 of ${rows.length}.</p>` : ''}` : '<p class="small muted">No scale readings yet.</p>'}
        <div class="bc-row">${BC.lastBatch ? `<button class="btn ghost sm" data-act="bc-undo">Undo last import (${BC.lastBatch.n})</button>` : ''}${rows.some((x) => x.sample) ? '<button class="btn ghost sm" data-act="bc-unsample">Remove sample scans</button>' : ''}</div></section>
      <div class="grid g-2">
        <section class="card"><div class="card-h"><h2>Consistent readings</h2></div><ul class="small bc-ref">
          <li>Weigh at the same time, ideally after waking and using the bathroom, before eating, drinking or training.</li>
          <li>Bare, dry feet on the sensors; hold the hand grips if your scale has them, arms away from your sides.</li>
          <li>Hydration moves body-fat readings by a few points from day to day. Watch the weekly trend, not one reading.</li>
          <li>Use one scale and one user profile, with your height, age and sex set correctly in its app.</li></ul></section>
        <section class="card"><div class="card-h"><h2>Safety</h2></div>
          <p class="small">Body-composition scales pass a tiny electrical current through you. Scale makers advise against using that mode if you have a pacemaker, defibrillator or other implanted electronic device, or if you are pregnant, unless your clinician says it is fine. Most scales have a weight-only mode for this.</p>
          <p class="fine">Scale estimates are wellness readings, not medical measurements.</p></section></div>`;
  }
  function blePanel() {
    const B = BC.ble, r = B ? B.r : {}, can = typeof navigator !== 'undefined' && !!navigator.bluetooth;
    return `${can ? '' : '<p class="banner">Web Bluetooth is not available in this browser. Use Chrome or Edge on Android, Windows, macOS or ChromeOS, or import through Apple Health.</p>'}
      <ol class="small st-how"><li>Wake the scale by tapping it or stepping on briefly.</li><li>Press Connect and choose the scale in the list.</li><li>Step on barefoot and hold still until the reading arrives here.</li></ol>
      ${B ? `<p class="small"><b>${esc(B.name)}</b> · ${esc(B.status)}</p>
        <div class="st-read">${[['Weight', r.w, 'kg', 2], ['Body fat', r.bf, '%', 1], ['Muscle', r.smm, 'kg', 1], ['Water', r.waterKg, 'kg', 1], ['Fat-free', r.ffm, 'kg', 1], ['BMR', r.bmr, 'kcal', 0]].map(([l, v, u, d]) => `<div><span>${l}</span><b class="num">${f(v, d)}</b><em>${u}</em></div>`).join('')}</div>
        <div class="st-go">${ok(r.w) ? '<button class="btn" data-act="bc-ble-save">Save reading</button>' : ''}${B.off ? '<button class="btn ghost" data-act="bc-ble">Reconnect</button>' : '<button class="btn ghost" data-act="bc-ble-off">Disconnect</button>'}</div>`
        : `<div class="st-go"><button class="btn" data-act="bc-ble" ${can ? '' : 'disabled'}>${icon('link', 16)} Connect a Bluetooth scale</button></div>`}
      <p class="fine">Works with scales that use the standard Bluetooth Weight Scale or Body Composition service. Many scales pair only with their maker's app (the Hume Pod pairs with the Hume app); if yours doesn't appear in the list, use its Apple Health sync instead.</p>`;
  }
  function applePanel() {
    const P = BC.pending;
    const list = P ? Object.entries(P.by).sort((a, b) => b[1].length - a[1].length) : [];
    return `<ol class="small st-how"><li>In your scale's app (the Hume app for a Hume Pod), connect Apple Health and allow weight, body fat and lean body mass.</li>
        <li>On your iPhone, open Health, tap your picture, then <b>Export All Health Data</b>. Save export.zip to Files.</li>
        <li>Choose export.zip here. Myo reads only weight, body fat and lean body mass, on this device. Nothing is uploaded.</li></ol>
      <label class="btn bc-file">${icon('upload', 16)} Choose export.zip<input class="sr" type="file" accept=".zip,.xml,application/zip,text/xml" data-change="bc-apple"></label>
      ${BC.busy ? `<p class="small" id="bc-busy" role="status">${esc(BC.busy)}</p>` : ''}${BC.snote ? `<p class="small" role="status">${esc(BC.snote)}</p>` : ''}
      ${P ? `<div class="bc-pend"><h3>Found in your export</h3><ul>${list.map(([name, rows]) => { const ds = rows.map((r) => r.d).sort(); const fl = ['w', 'bf', 'lean'].filter((k) => rows.some((r) => ok(r[k]))).map((k) => ({ w: 'weight', bf: 'body fat', lean: 'lean mass' })[k]).join(', '); return `<li><label class="ped-use tested"><input type="checkbox" data-change="bc-pick" data-k="${esc(name)}" ${P.pick[name] ? 'checked' : ''}> <b>${esc(name)}</b> <span class="small muted">${rows.length} day${rows.length > 1 ? 's' : ''} ·${esc(fmtDate(ds[0]))} to ${esc(fmtDate(ds[ds.length - 1]))} · ${fl}</span></label></li>`; }).join('')}</ul>
        <div class="st-go"><button class="btn" data-act="bc-apple-go">Import</button><button class="btn ghost" data-act="bc-pend-x">Cancel</button></div>
        <p class="fine">Sources that recorded body fat are ticked: those are body-composition scales. One reading per day per source is kept (the last of the day).</p></div>` : ''}
      <p class="fine">Android: Health Connect keeps data on the phone and has no file export yet. Use your scale app's CSV export if it has one, or quick entry.</p>`;
  }
  function csvPanel() {
    return `<p class="small">Export a CSV from your scale's app or a spreadsheet. Myo recognises columns named like <i>Date, Weight, Body fat %, Muscle mass, Body water, Bone mass, Visceral fat, BMR, Metabolic age</i>. Pounds are converted when the header says lb.</p>
      <label class="btn bc-file">${icon('upload', 16)} Choose a CSV file<input class="sr" type="file" accept=".csv,text/csv,.txt" data-change="bc-csv"></label>
      ${BC.snote ? `<p class="small" role="status">${esc(BC.snote)}</p>` : ''}`;
  }
  function manualPanel() {
    const u = BC.su, inp = (n, l, unit, step = '0.1', mn = 0, mx = 999) => `<label>${l} <span class="muted">(${unit})</span><input name="${n}" type="number" inputmode="decimal" step="${step}" min="${mn}" max="${mx}"></label>`;
    return `<form class="lb-grid bc-form" data-submit="bc-man">
        <label>Date<input name="d" type="date" value="${dayKey()}" max="${dayKey()}" required></label>
        <label>Device<input name="dev" list="bc-devs" maxlength="40" placeholder="e.g. Hume Pod 2.0"><datalist id="bc-devs"><option>Hume Pod 2.0</option><option>Hume Pod</option><option>Clinic bioimpedance</option><option>Other smart scale</option></datalist></label>
        <label>Units<select name="u" data-change="bc-su"><option value="kg" ${u === 'kg' ? 'selected' : ''}>kg</option><option value="lb" ${u === 'lb' ? 'selected' : ''}>lb</option></select></label>
        ${inp('w', 'Weight', u, '0.1', 20, 700)}${inp('bf', 'Body fat', '%', '0.1', 2, 75)}${inp('smm', 'Muscle mass', u)}${inp('water', 'Body water', '%', '0.1', 20, 80)}${inp('bmc', 'Bone mass', u)}${inp('vatR', 'Visceral fat', 'rating', '1', 1, 60)}${inp('bmr', 'BMR', 'kcal', '1', 500, 5000)}${inp('mage', 'Metabolic age', 'years', '1', 10, 110)}
        <details class="lb-wide"><summary class="small">Segmental results (arms, legs, trunk)</summary><div class="lb-grid">${REG.map(([k, n]) => `${inp(`${k}_lean`, `${n} lean`, u)}${inp(`${k}_fat`, `${n} fat`, u)}`).join('')}</div></details>
        <div class="lb-wide"><button class="btn sm">${icon('plus', 14)} Save reading</button></div></form>`;
  }

  /* ── DEXA ── */
  const blankDraft = () => ({ d: dayKey(), dev: '', w: null, bf: null, fat: null, lean: null, bmc: null, vat: null, vatv: null, ag: null, bmd: null, t: null, z: null, seg: Object.fromEntries(REG.map(([k]) => [k, { lean: null, fat: null }])), found: [], from: 'hand' });
  const getPath = (o, k) => k.split('.').reduce((a, p) => (a == null ? a : a[p]), o);
  function review() {
    const D = BC.draft, u = BC.du, cv = (v) => (ok(v) ? rd(u === 'lb' ? v / LB : v, 2) : '');
    const inp = (k, label, unit, mass, bare, step = 'any') => { const v = getPath(D, k); return `<label class="${D.found.includes(k) ? 'found' : ''}"><span>${label}${!bare && (unit || mass) ? ` <span class="muted">(${mass ? u : unit})</span>` : ''}</span><input type="number" inputmode="decimal" step="${step}" value="${mass ? cv(v) : ok(v) ? v : ''}" data-change="bc-df" data-k="${k}" data-mass="${mass ? 1 : ''}"></label>`; };
    return `<section class="card bc-review"><div class="card-h"><h2>Check the numbers</h2><div class="seg" role="group" aria-label="Mass units">${['kg', 'lb'].map((k) => `<button class="${u === k ? 'on' : ''}" data-act="bc-du" data-k="${k}">${k}</button>`).join('')}</div></div>
      <p class="small">${D.from === 'hand' ? 'Type the values from your report. Leave blanks for anything it does not show.' : 'Highlighted fields were read from your report. Check each one against the report before saving.'}</p>
      <div class="lb-grid"><label class="${D.found.includes('d') ? 'found' : ''}">Scan date<input type="date" value="${esc(D.d)}" max="${dayKey()}" data-change="bc-df" data-k="d"></label>
        <label class="${D.found.includes('dev') ? 'found' : ''}">Provider or machine<input type="text" maxlength="60" value="${esc(D.dev)}" data-change="bc-df" data-k="dev"></label></div>
      <h3 class="bc-h3">Whole body</h3><div class="lb-grid">${inp('w', 'Total mass', '', true)}${inp('bf', 'Body fat', '%')}${inp('fat', 'Fat mass', '', true)}${inp('lean', 'Lean tissue', '', true)}${inp('bmc', 'Bone mineral content', '', true)}</div>
      <h3 class="bc-h3">Visceral fat and distribution</h3><div class="lb-grid">${inp('vat', 'Visceral fat mass', '', true)}${inp('vatv', 'Visceral fat volume', 'cm³')}${inp('ag', 'Android/gynoid ratio', '')}</div>
      <h3 class="bc-h3">Regions</h3><div class="tbl-wrap"><table class="tbl compact bc-rt"><thead><tr><th scope="col">Region</th><th scope="col">Lean (${u})</th><th scope="col">Fat (${u})</th></tr></thead><tbody>
        ${REG.map(([k, n]) => `<tr><th scope="row">${n}</th><td>${inp(`seg.${k}.lean`, `<span class="sr">${n} lean</span>`, '', true, true)}</td><td>${inp(`seg.${k}.fat`, `<span class="sr">${n} fat</span>`, '', true, true)}</td></tr>`).join('')}</tbody></table></div>
      <h3 class="bc-h3">Bone density</h3><div class="lb-grid">${inp('bmd', 'Total BMD', 'g/cm²')}${inp('t', 'T-score', '')}${inp('z', 'Z-score', '')}</div>
      <div class="st-go"><button class="btn" data-act="bc-dsave">${icon('check', 16)} Save DEXA scan</button><button class="btn ghost" data-act="bc-dx">Cancel</button></div></section>`;
  }
  function addCard() {
    return `<section class="card"><div class="card-h"><h2>Add a DEXA report</h2><span class="muted small">Read on this device</span></div>
      <div class="bc-ways">
        <label class="st-src bc-file"><b>Read a PDF report</b><span>Text-based PDF reports from body-composition and hospital DXA scanners</span><input class="sr" type="file" accept=".pdf,application/pdf" data-change="bc-pdf"></label>
        <button class="st-src" data-act="bc-paste"><b>Paste report text</b><span>Open the report, select all, copy, then paste here</span></button>
        <button class="st-src" data-act="bc-hand"><b>Enter by hand</b><span>Type the numbers from a paper or image report</span></button></div>
      ${BC.paste ? `<form data-submit="bc-text" class="bc-paste"><label for="bc-text" class="sr">Report text</label><textarea id="bc-text" name="t" rows="7" placeholder="Paste the whole report here"></textarea><button class="btn sm">Read the text</button></form>` : ''}
      ${BC.busy ? `<p class="small" id="bc-busy" role="status">${esc(BC.busy)}</p>` : ''}${BC.note ? `<p class="small" role="status">${esc(BC.note)}</p>` : ''}
      <p class="fine">DEXA images (DICOM) open in <a href="#imaging">Imaging</a>. Scanned or locked PDFs have no readable text: paste or type the values instead.</p></section>`;
  }
  function dexaResult(x, rows, s) {
    const h = hOf(s), D = derive(x, h), i = rows.indexOf(x), pv = i > 0 ? rows[i - 1] : null, P = pv ? derive(pv, h) : null;
    const tl = [tile('Body fat', f(D.bf), '%', P ? `${sgn(D.bf - P.bf, 1, ' pts')} since ${fmtDate(pv.d)}` : ''), tile('Fat mass', f(D.fat), 'kg', P ? sgn(D.fat - P.fat, 1, ' kg') : ''), tile('Lean tissue', f(D.lst), 'kg', P && ok(P.lst) ? sgn(D.lst - P.lst, 1, ' kg') : ''), tile('Bone mineral', f(D.bmc, 2), 'kg', '')];
    if (ok(x.vat)) tl.push(tile('Visceral fat', f(+x.vat * 1000, 0), 'g', P && pv && ok(pv.vat) ? sgn((+x.vat - +pv.vat) * 1000, 0, ' g') : ok(x.vatv) ? `${f(+x.vatv, 0)} cm³` : ''));
    if (ok(x.ag)) tl.push(tile('Android/gynoid', f(+x.ag, 2), 'ratio', ''));
    if (ok(D.almi)) tl.push(tile('ALMI', f(D.almi, 2), 'kg/m²', ''));
    if (ok(D.ffmi)) tl.push(tile('FFMI', f(D.ffmi, 1), 'kg/m²', ''));
    const sg = x.seg || {}, hasSeg = REG.some(([k]) => sg[k] && ok(sg[k].lean));
    const age = +(s.profile && s.profile.age) || 35, useZ = age < 50;
    return `<section class="card"><div class="card-h"><h2>DEXA · ${esc(fmtDate(x.d))}</h2><span class="muted small">${esc(x.dev || '')}${x.sample ? ' · sample' : ''}</span></div>
        <div class="lb-tiles bc-tiles">${tl.join('')}</div>${compBar(D)}</section>
      <div class="grid g-2">
        ${hasSeg ? `<section class="card"><div class="card-h"><h2>Regions</h2></div>${bodyMap(x)}
          <div class="tbl-wrap"><table class="tbl compact"><caption class="sr">Regional results</caption><thead><tr><th scope="col">Region</th><th scope="col">Lean</th><th scope="col">Fat</th><th scope="col">Fat %</th></tr></thead><tbody>
          ${REG.map(([k, n]) => { const v = sg[k] || {}; return `<tr><th scope="row">${n}</th><td class="num">${f(v.lean, 2, ' kg')}</td><td class="num">${f(v.fat, 2, ' kg')}</td><td class="num">${ok(v.lean) && ok(v.fat) ? f((+v.fat / (+v.fat + +v.lean)) * 100, 1, '%') : '—'}</td></tr>`; }).join('')}</tbody></table></div></section>` : ''}
        ${ok(x.t) || ok(x.z) || ok(x.bmd) ? `<section class="card"><div class="card-h"><h2>Bone density</h2>${ok(x.bmd) ? `<span class="muted small">${f(+x.bmd, 3)} g/cm²</span>` : ''}</div>${boneScale(x.t, x.z)}
          <p class="small">The T-score compares your bone density with a healthy young adult; the Z-score compares it with people your age. The World Health Organization's bands (shown) use the T-score and apply to women after menopause and men over 50.${useZ ? ' Under 50, clinicians look at the Z-score instead.' : ''}</p>
          <p class="fine">Bone density is interpreted by your clinician, who also weighs fracture history, medicines and other risks.</p></section>` : ''}</div>`;
  }
  function dexaTab(s) {
    const rows = scans(s, 'dexa'), last = rows[rows.length - 1];
    return `${BC.draft ? review() : addCard()}${last ? dexaResult(last, rows, s) : ''}
      ${rows.length ? `<section class="card"><div class="card-h"><h2>DEXA history</h2><span class="muted small">${rows.length} scan${rows.length > 1 ? 's' : ''}</span></div><div class="tbl-wrap"><table class="tbl compact"><caption class="sr">DEXA scans</caption><thead><tr><th scope="col">Date</th><th scope="col">Provider</th><th scope="col">Weight</th><th scope="col">Body fat</th><th scope="col">Fat</th><th scope="col">Lean</th><th scope="col">Visceral</th><th scope="col">T-score</th><th scope="col"><span class="sr">Delete</span></th></tr></thead>
        <tbody>${rows.slice().reverse().map((x) => { const D = derive(x, hOf(s)); return `<tr><th scope="row" class="small">${esc(fmtDate(x.d))}</th><td class="small">${esc(x.dev || '')}</td><td class="num">${f(D.w, 1, ' kg')}</td><td class="num">${f(D.bf, 1, '%')}</td><td class="num">${f(D.fat, 1, ' kg')}</td><td class="num">${f(D.lst, 1, ' kg')}</td><td class="num">${ok(x.vat) ? f(+x.vat * 1000, 0, ' g') : '—'}</td><td class="num">${f(x.t, 1)}</td><td><button class="lb-del" data-act="bc-del" data-id="${x.id}" aria-label="Delete DEXA scan from ${esc(fmtDate(x.d))}">${icon('x', 14)}</button></td></tr>`; }).join('')}</tbody></table></div></section>` : ''}
      <div class="grid g-2">
        <section class="card"><div class="card-h"><h2>Before a DEXA scan</h2></div><ul class="small bc-ref">
          <li>Use the same provider and machine each time. Different makers' scanners read differently.</li>
          <li>Book the same time of day, a few hours after eating, normally hydrated, and before training.</li>
          <li>Skip calcium supplements for 24 hours, and wear clothes with no metal.</li>
          <li>Tell the technician if you might be pregnant, or had a barium or contrast scan in the last two weeks.</li>
          <li>Step on your smart scale the same morning, so Myo can pair the two (see Scale vs DEXA).</li></ul></section>
        <section class="card"><div class="card-h"><h2>About DEXA</h2></div>
          <p class="small">DEXA (dual-energy X-ray absorptiometry) passes two low X-ray energies through you and separates fat, lean tissue and bone in each region. A whole-body scan gives a few microsieverts of radiation, less than a day of natural background.</p>
          <p class="small">For body composition, many people rescan every 3 to 6 months. Changes smaller than about 0.5 to 1 kg of fat or lean mass can be measurement noise.</p></section></div>`;
  }

  /* ── scale vs DEXA ── */
  function pairs(s) {
    const B = scans(s, 'bia').filter((x) => ok(x.bf)), out = [];
    scans(s, 'dexa').filter((x) => ok(derive(x, hOf(s)).bf)).forEach((d) => {
      const t = day(d.d); let best = null, bd = Infinity;
      B.forEach((b) => { const dt = Math.abs(day(b.d) - t); if (dt < bd) { bd = dt; best = b; } });
      if (best && bd <= 3 * 864e5) out.push({ d, b: best, diff: derive(d, hOf(s)).bf - +best.bf, days: Math.round(bd / 864e5) });
    });
    return out;
  }
  function compareTab(s) {
    const P = pairs(s), bia = scans(s, 'bia').filter((x) => ok(x.bf)), dexa = scans(s, 'dexa').filter((x) => ok(derive(x, hOf(s)).bf));
    if (!P.length) return `<section class="card"><div class="card-h"><h2>Scale vs DEXA</h2></div>
      <p class="small">Myo pairs each DEXA scan with a scale reading taken within 3 days of it. ${dexa.length ? `You have ${dexa.length} DEXA scan${dexa.length > 1 ? 's' : ''} and ${bia.length} scale reading${bia.length === 1 ? '' : 's'}, but none fall within 3 days of each other.` : 'Add a DEXA scan and step on your scale the same morning.'}</p>
      <p class="small">Why it helps: a home scale estimates body fat from electrical resistance, which shifts with hydration and the maker's formula. DEXA measures tissue directly. Your own pairs show how far your scale sits from DEXA, so the daily scale trend can be read at DEXA's level.</p></section>`;
    const mean = P.reduce((a, p) => a + p.diff, 0) / P.length;
    const sd = P.length > 2 ? Math.sqrt(P.reduce((a, p) => a + (p.diff - mean) ** 2, 0) / (P.length - 1)) : null;
    const ser = [{ cls: 'lean', name: 'Scale', pts: bia.map((x) => ({ t: day(x.d), v: +x.bf })) }, { cls: 'fat', name: 'Scale, anchored to DEXA', pts: bia.map((x) => ({ t: day(x.d), v: +x.bf + mean })) }, { cls: 'fat', name: 'DEXA', line: false, pts: dexa.map((x) => ({ t: day(x.d), v: derive(x, hOf(s)).bf, mark: 'dia' })) }];
    const rowsT = [...bia.map((x) => ({ t: day(x.d), html: `<b>${esc(fmtDate(x.d))}</b> · scale<br>Body fat ${f(x.bf, 1, '%')} · anchored ${f(+x.bf + mean, 1, '%')}` })), ...dexa.map((x) => ({ t: day(x.d), html: `<b>${esc(fmtDate(x.d))}</b> · DEXA<br>Body fat ${f(derive(x, hOf(s)).bf, 1, '%')}` }))];
    return `<section class="card"><div class="card-h"><h2>Your scale against DEXA</h2><span class="muted small">${P.length} pair${P.length > 1 ? 's' : ''}</span></div>
        <div class="lb-tiles bc-tiles">${tile('Average offset', sgn(mean, 1), 'body-fat points', mean > 0 ? 'DEXA reads higher than your scale' : 'DEXA reads lower than your scale')}${sd != null ? tile('Spread', `±${f(1.96 * sd, 1)}`, 'points (95% of pairs)', 'How much the offset varies') : tile('Spread', '—', '', 'Needs 3 or more pairs')}</div>
        <ul class="bc-key"><li><i class="bc-sw bc-lean"></i>Scale</li><li><i class="bc-sw bc-fat"></i>Scale, anchored to DEXA</li><li><i class="bc-dia"></i>DEXA scan</li></ul>
        ${lineChart('cmp', ser, rowsT, { unit: '%', label: 'Body fat percentage: scale readings, the same readings shifted by your DEXA offset, and DEXA scans' })}
        <p class="fine">The anchored line adds your average offset to every scale reading. The shape of the trend stays your scale's; the level comes from DEXA.</p></section>
      <section class="card"><div class="card-h"><h2>Pairs</h2></div><div class="tbl-wrap"><table class="tbl compact"><caption class="sr">DEXA and scale pairs</caption><thead><tr><th scope="col">DEXA date</th><th scope="col">DEXA body fat</th><th scope="col">Scale body fat</th><th scope="col">Days apart</th><th scope="col">Difference</th></tr></thead>
        <tbody>${P.map((p) => `<tr><th scope="row" class="small">${esc(fmtDate(p.d.d))}</th><td class="num">${f(derive(p.d, hOf(s)).bf, 1, '%')}</td><td class="num">${f(p.b.bf, 1, '%')}</td><td class="num">${p.days}</td><td class="num">${sgn(p.diff, 1)}</td></tr>`).join('')}</tbody></table></div>
        <p class="fine">Offsets of a few points are common between bioimpedance scales and DEXA. Makers' accuracy claims vary; your own pairs are the best guide for your scale.</p></section>`;
  }

  /* ── Bluetooth: Weight Measurement 0x2A9D and Body Composition Measurement 0x2A9C ── */
  const tsAt = (dv, o) => { const y = dv.getUint16(o, true); return y ? `${y}-${String(dv.getUint8(o + 2)).padStart(2, '0')}-${String(dv.getUint8(o + 3)).padStart(2, '0')}` : null; };
  function parseWM(dv) {
    const fl = dv.getUint8(0), imp = fl & 1, raw = dv.getUint16(1, true), out = {}; let o = 3;
    if (raw !== 0xffff) out.w = rd(imp ? raw * 0.01 * LB : raw * 0.005, 2);
    if (fl & 2) { out.ts = tsAt(dv, o); o += 7; }
    if (fl & 4) { out.user = dv.getUint8(o); o += 1; }
    if (fl & 8 && o + 4 <= dv.byteLength) { out.bmi = rd(dv.getUint16(o, true) * 0.1); const hh = dv.getUint16(o + 2, true); out.hCm = rd(imp ? hh * 0.1 * 2.54 : hh * 0.1); }
    return out;
  }
  function parseBCM(dv) {
    const fl = dv.getUint16(0, true), imp = fl & 1, out = {}; let o = 2;
    const u16 = () => { const v = o + 2 <= dv.byteLength ? dv.getUint16(o, true) : 0xffff; o += 2; return v; };
    const mass = (v) => (v === 0xffff ? null : rd(imp ? v * 0.01 * LB : v * 0.005, 2));
    const bf = u16(); if (bf !== 0xffff) out.bf = rd(bf * 0.1);
    if (fl & 2) { out.ts = tsAt(dv, o); o += 7; }
    if (fl & 4) { out.user = dv.getUint8(o); o += 1; }
    if (fl & 8) out.bmr = Math.round(u16() / 4.184);
    if (fl & 16) out.musclePct = rd(u16() * 0.1);
    if (fl & 32) out.smm = mass(u16());
    if (fl & 64) out.ffm = mass(u16());
    if (fl & 128) out.slm = mass(u16());
    if (fl & 256) out.waterKg = mass(u16());
    if (fl & 512) out.imp = rd(u16() * 0.1);
    if (fl & 1024) out.w = mass(u16());
    if (fl & 2048) { const v = u16(); out.hCm = rd(imp ? v * 0.1 * 2.54 : v * 0.1); }
    if (fl & 4096) out.more = true;
    return out;
  }
  async function bleConnect() {
    if (!navigator.bluetooth) { OS.toast('Bluetooth needs Chrome or Edge on Android, Windows, macOS or ChromeOS'); return; }
    let dev;
    try { dev = await navigator.bluetooth.requestDevice({ filters: [{ services: [0x181d] }, { services: [0x181b] }], optionalServices: [0x181d, 0x181b] }); }
    catch (e) { if (e && e.name !== 'NotFoundError') OS.toast(`Bluetooth: ${e.message || e}`); return; }
    BC.ble = { name: dev.name || 'Bluetooth scale', dev, status: 'Connecting…', r: {} }; OS.render();
    try {
      const g = await dev.gatt.connect(); let n = 0;
      for (const [svc, ch, parse] of [[0x181d, 0x2a9d, parseWM], [0x181b, 0x2a9c, parseBCM]]) {
        let c; try { c = await (await g.getPrimaryService(svc)).getCharacteristic(ch); } catch { continue; }
        c.addEventListener('characteristicvaluechanged', (e) => { if (!BC.ble || BC.ble.dev !== dev) return; Object.entries(parse(e.target.value)).forEach(([k, v]) => { if (v != null) BC.ble.r[k] = v; }); BC.ble.status = 'Reading received'; if (OS.current === 'bodycomp') OS.render(); });
        await c.startNotifications(); n++;
      }
      if (!n) throw new Error('this scale does not offer the standard weight or body composition service');
      BC.ble.status = 'Connected. Step on the scale barefoot.';
      dev.addEventListener('gattserverdisconnected', () => { if (BC.ble && BC.ble.dev === dev) { BC.ble.status = 'Disconnected'; BC.ble.off = true; if (OS.current === 'bodycomp') OS.render(); } });
    } catch (e) { BC.ble.status = `Couldn't connect: ${e.message || e}`; BC.ble.off = true; }
    OS.render();
  }

  /* ── Apple Health export: export.zip (or export.xml), streamed and filtered on this device ── */
  async function zipEntry(file, re) {
    const tailLen = Math.min(file.size, 65557 + 20), tail = new Uint8Array(await file.slice(file.size - tailLen).arrayBuffer()), dv = new DataView(tail.buffer);
    let e = -1; for (let i = tail.length - 22; i >= 0; i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('This is not a zip file.');
    let cnt = dv.getUint16(e + 10, true), cdSize = dv.getUint32(e + 12, true), cdOff = dv.getUint32(e + 16, true);
    if (cdOff === 0xffffffff || cnt === 0xffff || cdSize === 0xffffffff) {
      const l = e - 20;
      if (l >= 0 && dv.getUint32(l, true) === 0x07064b50) {
        const zo = Number(dv.getBigUint64(l + 8, true)), z = new DataView(await file.slice(zo, zo + 56).arrayBuffer());
        if (z.getUint32(0, true) === 0x06064b50) { cnt = Number(z.getBigUint64(32, true)); cdSize = Number(z.getBigUint64(40, true)); cdOff = Number(z.getBigUint64(48, true)); }
      }
    }
    const cd = new DataView(await file.slice(cdOff, cdOff + cdSize).arrayBuffer()); let p = 0;
    for (let k = 0; k < cnt && p + 46 <= cd.byteLength; k++) {
      if (cd.getUint32(p, true) !== 0x02014b50) break;
      const method = cd.getUint16(p + 10, true), nl = cd.getUint16(p + 28, true), xl = cd.getUint16(p + 30, true), cl = cd.getUint16(p + 32, true);
      let csize = cd.getUint32(p + 20, true), usize = cd.getUint32(p + 24, true), lho = cd.getUint32(p + 42, true);
      const name = new TextDecoder().decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nl));
      let q = p + 46 + nl; const qe = q + xl;
      while (q + 4 <= qe) { const id = cd.getUint16(q, true), sz = cd.getUint16(q + 2, true); if (id === 1) { let r = q + 4; if (usize === 0xffffffff) { usize = Number(cd.getBigUint64(r, true)); r += 8; } if (csize === 0xffffffff) { csize = Number(cd.getBigUint64(r, true)); r += 8; } if (lho === 0xffffffff) lho = Number(cd.getBigUint64(r, true)); } q += 4 + sz; }
      if (re.test(name)) {
        const lh = new DataView(await file.slice(lho, lho + 30).arrayBuffer());
        if (lh.getUint32(0, true) !== 0x04034b50) throw new Error('The zip file looks damaged.');
        const start = lho + 30 + lh.getUint16(26, true) + lh.getUint16(28, true), raw = file.slice(start, start + csize).stream();
        if (method === 0) return { stream: raw, size: usize };
        if (method === 8) return { stream: raw.pipeThrough(new DecompressionStream('deflate-raw')), size: usize };
        throw new Error('This zip uses a compression Myo cannot read.');
      }
      p = qe + cl;
    }
    return null;
  }
  const HK = { BodyMass: 'w', BodyFatPercentage: 'bf', LeanBodyMass: 'lean' };
  const unXml = (v) => v.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'");
  async function scanHealthXml(stream, total, prog) {
    const rdr = stream.pipeThrough(new TextDecoderStream()).getReader(), out = [];
    const re = /<Record\b[^>]*?type="HKQuantityTypeIdentifier(BodyMass|BodyFatPercentage|LeanBodyMass)"[^>]*>/g;
    let buf = '', seen = 0, tick = 0;
    for (;;) {
      const { done, value } = await rdr.read(); if (done) break;
      seen += value.length; buf += value;
      const cut = buf.lastIndexOf('>') + 1, part = buf.slice(0, cut); buf = buf.slice(cut);
      re.lastIndex = 0; let m;
      while ((m = re.exec(part))) { const tag = m[0], at = (k) => { const x = new RegExp(`\\s${k}="([^"]*)"`).exec(tag); return x ? unXml(x[1]) : ''; }; out.push({ k: HK[m[1]], src: at('sourceName') || 'Unknown source', unit: at('unit'), v: +at('value'), when: at('startDate') }); }
      if (prog && ++tick % 40 === 0) prog(Math.min(0.99, seen / (total || 1)));
    }
    return out;
  }
  function groupHealth(recs) {
    const by = {}, cell = {};
    recs.forEach((r) => {
      if (!Number.isFinite(r.v) || !r.when) return;
      const d = r.when.slice(0, 10), key = `${r.src}|${d}`;
      let v = r.v;
      if (r.k === 'bf') v = v <= 1 ? v * 100 : v; else v = /lb/i.test(r.unit) ? v * LB : /^g$/i.test(r.unit) ? v / 1000 : v;
      const c = cell[key] || (cell[key] = { d, src: r.src, t: {} });
      if (!c.t[r.k] || r.when >= c.t[r.k]) { c[r.k] = rd(v, 2); c.t[r.k] = r.when; }
    });
    Object.values(cell).forEach((c) => { if (!ok(c.w) && !ok(c.bf)) return; (by[c.src] = by[c.src] || []).push({ d: c.d, w: c.w, bf: c.bf, lean: c.lean }); });
    return by;
  }
  async function appleFile(file) {
    BC.busy = 'Opening the export…'; BC.snote = ''; BC.pending = null; OS.render();
    const setBusy = (p) => { BC.busy = `Reading on this device… ${Math.round(p * 100)}%`; const el = document.getElementById('bc-busy'); if (el) el.textContent = BC.busy; };
    try {
      let stream = file.stream(), total = file.size;
      const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      if (head[0] === 0x50 && head[1] === 0x4b) { const e = await zipEntry(file, /(^|\/)export\.xml$/); if (!e) throw new Error('No export.xml inside this zip. Choose the export.zip from the Health app.'); stream = e.stream; total = e.size; }
      const by = groupHealth(await scanHealthXml(stream, total, setBusy));
      if (!Object.keys(by).length) throw new Error('No weight or body-fat records in this export. Check that your scale app writes to Apple Health.');
      BC.pending = { by, pick: Object.fromEntries(Object.entries(by).map(([k, rows]) => [k, rows.some((r) => ok(r.bf))])) };
    } catch (e) { BC.snote = e.message || String(e); }
    BC.busy = ''; OS.render();
  }

  /* ── CSV ── */
  function parseCSV(text) {
    const first = text.split(/\r?\n/, 1)[0] || '', dl = [',', ';', '\t'].map((c) => [c, first.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = []; let row = [], fld = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { fld += '"'; i++; } else q = false; } else fld += c; }
      else if (c === '"') q = true; else if (c === dl) { row.push(fld); fld = ''; }
      else if (c === '\n') { row.push(fld); rows.push(row); row = []; fld = ''; } else if (c !== '\r') fld += c;
    }
    if (fld || row.length) { row.push(fld); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim()));
  }
  const COLS = [['d', /^(date|datum|fecha|data|day|time|timestamp|measured|measurement ?date|date ?time)/i], ['fat', /fat ?mass|body ?fat ?\((kg|lbs?)\)/i], ['bf', /body ?fat|^fat ?%|^bf|fat ?(rate|percent)/i], ['smm', /skeletal ?muscle|muscle ?mass|^muscle|^smm|muskel/i], ['lean', /lean|fat[- ]?free/i], ['water', /water|hydration|tbw/i], ['bmc', /bone/i], ['vatR', /visceral/i], ['mage', /metabolic ?age|body ?age/i], ['bmr', /bmr|basal|metabolic ?rate|rmr/i], ['bmi', /^bmi/i], ['w', /weight|gewicht|poids|peso|^mass$|body ?mass(?! ?index)/i]];
  function parseDay(v, dmy) {
    v = String(v || '').trim(); let m;
    const pad = (x) => String(x).padStart(2, '0'), okd = (y, mo, d) => (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y > 1990 && y < 2100 ? `${y}-${pad(mo)}-${pad(d)}` : null);
    if ((m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return okd(+m[1], +m[2], +m[3]);
    if ((m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/))) { let y = +m[3]; if (y < 100) y += 2000; return dmy ? okd(y, +m[2], +m[1]) : okd(y, +m[1], +m[2]); }
    const t = Date.parse(v); return Number.isNaN(t) ? null : dayKey(new Date(t));
  }
  function csvRows(text) {
    const R = parseCSV(text); if (R.length < 2) throw new Error('This CSV has no rows.');
    const H = R[0].map((h) => h.trim()), map = {}, unit = {};
    H.forEach((h, i) => { const hit = COLS.find(([k, rx]) => !(k in map) && rx.test(h)); if (hit) { map[hit[0]] = i; unit[hit[0]] = /\blbs?\b|pounds|\(lb/i.test(h) ? 'lb' : /\bkg\b/i.test(h) ? 'kg' : /%/.test(h) ? '%' : null; } });
    if (!('d' in map) || !('w' in map || 'bf' in map)) throw new Error('Myo needs a date column and a weight or body-fat column.');
    const body = R.slice(1), dmy = body.some((r) => /^(\d{1,2})[/.-]/.test(r[map.d] || '') && +(r[map.d].match(/^(\d{1,2})/) || [0, 0])[1] > 12);
    const ws = body.map((r) => num(String(r[map.w] || '').replace(/^(-?\d+),(\d{1,2})$/, '$1.$2'))).filter(ok), med = ws.length ? ws.slice().sort((a, b) => a - b)[ws.length >> 1] : 0;
    const lbs = unit.w === 'lb' || (unit.w == null && med > 160);
    const mass = (v, k) => (v == null ? null : (unit[k] === 'lb' || (unit[k] == null && lbs) ? v * LB : v));
    const out = [];
    body.forEach((r) => {
      const d = parseDay(r[map.d], dmy); if (!d) return;
      const g = (k) => { if (!(k in map)) return null; const v = String(r[map[k]] == null ? '' : r[map[k]]).trim(); return /^-?\d+,\d+$/.test(v) && !/^-?\d{1,3},\d{3}$/.test(v) ? +v.replace(',', '.') : num(v); };
      const w = mass(g('w'), 'w'); let bf = g('bf'); const fat = mass(g('fat'), 'fat');
      if (bf == null && fat != null && w) bf = (fat / w) * 100;
      let water = g('water'); if (water != null && w && (unit.water === 'kg' || unit.water === 'lb' || (unit.water !== '%' && water > 75))) water = (mass(water, 'water') / w) * 100;
      if (!ok(w) && !ok(bf)) return;
      out.push({ d, w: rd(w, 2), bf: rd(bf, 1), smm: rd(mass(g('smm'), 'smm'), 2), water: rd(water, 1), bmc: rd(mass(g('bmc'), 'bmc'), 2), vatR: rd(g('vatR'), 0), bmr: rd(g('bmr'), 0), mage: rd(g('mage'), 0) });
    });
    return { rows: out, lbs, dmy, cols: Object.keys(map) };
  }
  function addBatch(rows, base) {
    const batch = uid(); let n = 0;
    OS.update((st) => {
      const S = ensure(st), have = new Set(S.scans.map((x) => `${x.kind}|${x.d}|${x.dev || ''}`));
      rows.forEach((r) => { const x = { id: uid(), at: new Date().toISOString(), batch, ...base, ...r }; if (r.dev) x.dev = r.dev; const key = `${x.kind}|${x.d}|${x.dev || ''}`; if (have.has(key)) return; have.add(key); Object.keys(x).forEach((k) => x[k] == null && delete x[k]); S.scans.push(x); n++; });
      syncProfile(st);
    });
    BC.lastBatch = n ? { id: batch, n } : null;
    return n;
  }

  /* ── PDF text, on this device ── */
  const WIN = { 0x80: '€', 0x82: '‚', 0x84: '„', 0x85: '…', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x99: '™', 0xb2: '²', 0xb3: '³' };
  const bin = (u8, a = 0, b = u8.length) => { let s = ''; for (let i = a; i < b; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, Math.min(b, i + 32768))); return s; };
  async function inflate(u8) {
    for (const [fmt, data] of [['deflate', u8], ['deflate-raw', u8.subarray(2)]]) {
      const parts = []; let n = 0;
      try { const r = new Blob([data]).stream().pipeThrough(new DecompressionStream(fmt)).getReader(); for (;;) { const { done, value } = await r.read(); if (done) break; parts.push(value); n += value.length; } }
      catch { /* keep what decoded before a damaged tail */ }
      if (n) { const o = new Uint8Array(n); let p = 0; parts.forEach((c) => { o.set(c, p); p += c.length; }); return o; }
    }
    return null;
  }
  function pval(dict, key) {
    const re = new RegExp(`/${key}(?![A-Za-z0-9])\\s*`, 'g'), m = re.exec(dict || ''); if (!m) return null;
    const i = re.lastIndex, c = dict[i];
    const span = (open, close) => { let d = 0, j = i; for (; j < dict.length; j++) { if (dict.startsWith(open, j)) { d++; j += open.length - 1; } else if (dict.startsWith(close, j)) { d--; j += close.length - 1; if (!d) break; } } return dict.slice(i, j + 1); };
    if (c === '<' && dict[i + 1] === '<') return span('<<', '>>');
    if (c === '[') return span('[', ']');
    const r = /^(\d+)\s+(\d+)\s+R/.exec(dict.slice(i, i + 24)); if (r) return `${r[1]} ${r[2]} R`;
    const t = /^\/[^\s/<>[\]()]*|^[^\s/<>[\]()]+/.exec(dict.slice(i)); return t ? t[0] : null;
  }
  function lit(src, i) {
    let d = 1, j = i + 1, s = '';
    const E = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' };
    while (j < src.length) {
      const c = src[j];
      if (c === '\\') {
        const e = src[j + 1];
        if (/[0-7]/.test(e)) { let k = j + 1, o = ''; while (k < j + 4 && /[0-7]/.test(src[k])) o += src[k++]; s += String.fromCharCode(parseInt(o, 8) & 255); j = k; continue; }
        if (e === '\r') { j += src[j + 2] === '\n' ? 3 : 2; continue; } if (e === '\n') { j += 2; continue; }
        s += E[e] != null ? E[e] : e; j += 2; continue;
      }
      if (c === '(') d++; else if (c === ')' && !--d) { j++; break; }
      s += c; j++;
    }
    return [s, j];
  }
  function cmap(txt) {
    const map = new Map(); let bytes = 1;
    const cs = /begincodespacerange\s*<([0-9a-fA-F]+)>/.exec(txt); if (cs) bytes = Math.max(1, cs[1].length / 2);
    const u = (h) => { if (!h) return ''; if (h.length < 4) return String.fromCharCode(parseInt(h, 16)); let s = ''; for (let i = 0; i + 4 <= h.length; i += 4) s += String.fromCharCode(parseInt(h.slice(i, i + 4), 16)); return s; };
    for (const b of txt.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) for (const m of b[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) map.set(parseInt(m[1], 16), u(m[2]));
    for (const b of txt.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) for (const m of b[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(?:<([0-9a-fA-F]+)>|\[([^\]]*)\])/g)) {
      const a = parseInt(m[1], 16), z = parseInt(m[2], 16);
      if (m[3] != null) { const pre = m[3].length >= 4 ? m[3].slice(0, -4) : '', last = parseInt(m[3].length >= 4 ? m[3].slice(-4) : m[3], 16); for (let c = a; c <= z && c - a < 65536; c++) map.set(c, u(pre) + String.fromCharCode(last + c - a)); }
      else { const arr = [...m[4].matchAll(/<([0-9a-fA-F]*)>/g)].map((x) => u(x[1])); for (let c = a; c <= z; c++) map.set(c, arr[c - a] || ''); }
    }
    return { map, bytes };
  }
  async function pdfText(buf) {
    const u8 = new Uint8Array(buf), S = bin(u8), p0 = S.indexOf('%PDF');
    if (p0 < 0 || p0 > 1024) throw new Error('This file is not a PDF.');
    if (/\/Encrypt\s*(\d+\s+\d+\s+R|<<)/.test(S)) throw new Error('This PDF is locked. Open it, copy the text and paste it here, or enter the numbers by hand.');
    const O = new Map(), re = /(\d+)\s+(\d+)\s+obj\b/g; let m;
    while ((m = re.exec(S))) {
      const no = +m[1], a = re.lastIndex, ePos = S.indexOf('endobj', a); if (ePos < 0) break;
      const sPos = S.indexOf('stream', a);
      if (sPos >= 0 && sPos < ePos) {
        const dict = S.slice(a, sPos); let ds = sPos + 6; if (S[ds] === '\r') ds++; if (S[ds] === '\n') ds++;
        const L = /\/Length\s+(\d+)(\s+\d+\s+R)?/.exec(dict); let de = L && !L[2] ? ds + +L[1] : -1;
        if (de < 0 || de > S.length || S.slice(de, de + 32).indexOf('endstream') < 0) de = S.indexOf('endstream', ds);
        if (de < 0) break;
        O.set(no, { dict, data: u8.subarray(ds, de) }); const eo = S.indexOf('endobj', de); re.lastIndex = eo < 0 ? de : eo + 6;
      } else { O.set(no, { dict: S.slice(a, ePos) }); re.lastIndex = ePos + 6; }
    }
    const cache = new Map();
    const data = async (no) => {
      if (cache.has(no)) return cache.get(no);
      const o = O.get(no); let out = null;
      if (o && o.data) { const fl = (pval(o.dict, 'Filter') || '').replace(/[[\]\s]/g, ''); out = !fl ? o.data : fl === '/FlateDecode' ? await inflate(o.data) : null; }
      cache.set(no, out); return out;
    };
    for (const [no, o] of [...O]) {
      if (!o.data || !/\/Type\s*\/ObjStm/.test(o.dict)) continue;
      const d = await data(no); if (!d) continue;
      const txt = bin(d), n = +pval(o.dict, 'N'), first = +pval(o.dict, 'First'), hd = txt.slice(0, first).trim().split(/\s+/).map(Number);
      for (let k = 0; k < n; k++) { const on = hd[2 * k], off = hd[2 * k + 1], nx = k + 1 < n ? hd[2 * k + 3] : txt.length - first; if (!O.has(on)) O.set(on, { dict: txt.slice(first + off, first + nx) }); }
    }
    const refNo = (v) => { const r = /^(\d+)\s+\d+\s+R$/.exec(String(v || '').trim()); return r ? +r[1] : null; };
    const deref = (v) => { const n = refNo(v); return n != null ? (O.get(n) ? O.get(n).dict : '') : v || ''; };
    const refs = (v) => [...String(v || '').matchAll(/(\d+)\s+\d+\s+R/g)].map((x) => +x[1]);
    const pages = [], walk = (no, inh, depth) => {
      const o = O.get(no); if (!o || depth > 40) return;
      const res = pval(o.dict, 'Resources') || inh;
      if (/\/Type\s*\/Pages\b/.test(o.dict)) refs(deref(pval(o.dict, 'Kids'))).forEach((k) => walk(k, res, depth + 1));
      else if (/\/Type\s*\/Page\b/.test(o.dict)) pages.push({ dict: o.dict, res });
    };
    let rootNo = null; const rm = [...S.matchAll(/\/Root\s+(\d+)\s+\d+\s+R/g)].pop();
    if (rm) rootNo = +rm[1]; else { const c = [...O].find(([, o]) => /\/Type\s*\/Catalog/.test(o.dict)); if (c) rootNo = c[0]; }
    if (rootNo != null && O.get(rootNo)) walk(refNo(pval(O.get(rootNo).dict, 'Pages')), null, 0);
    if (!pages.length) [...O.keys()].sort((a, b) => a - b).forEach((no) => { const o = O.get(no); if (/\/Type\s*\/Page\b/.test(o.dict)) pages.push({ dict: o.dict, res: pval(o.dict, 'Resources') }); });
    const fonts = new Map();
    const font = async (no) => {
      if (fonts.has(no)) return fonts.get(no);
      const fd = O.get(no) ? O.get(no).dict : '', F = { two: /\/Subtype\s*\/Type0/.test(fd), map: null }, tu = refNo(pval(fd, 'ToUnicode'));
      if (tu != null) { const d = await data(tu); if (d) { const c = cmap(bin(d)); F.map = c.map; F.two = c.bytes === 2 ? true : c.bytes === 1 ? false : F.two; } }
      fonts.set(no, F); return F;
    };
    const named = (res, key) => [...deref(pval(deref(res), key)).matchAll(/\/([^\s/<>[\]()]+)\s+(\d+)\s+\d+\s+R/g)].map((x) => [x[1], +x[2]]);
    const decode = (s, F) => {
      let o = '';
      if (F && F.map) { const st = F.two ? 2 : 1; for (let k = 0; k + st <= s.length; k += st) { const code = st === 2 ? (s.charCodeAt(k) << 8) | s.charCodeAt(k + 1) : s.charCodeAt(k), ch = F.map.get(code); o += ch != null ? ch : st === 1 ? String.fromCharCode(code) : ''; } return o; }
      if (F && F.two) return '';
      for (let k = 0; k < s.length; k++) { const c = s.charCodeAt(k); o += WIN[c] || (c >= 32 ? String.fromCharCode(c) : ''); }
      return o;
    };
    const out = [];
    const run = async (src, res, depth) => {
      const FT = {}; for (const [nm, no] of named(res, 'Font')) FT[nm] = await font(no);
      const XO = Object.fromEntries(named(res, 'XObject'));
      let fnt = null, fs = 10, st = [], i = 0, ly = null, lx = null, lastLen = 2, sc = 1;
      const n = src.length, DEL = /[\s/<>[\]()%{}]/;
      const nl = () => { if (out.length && out[out.length - 1] !== '\n') out.push('\n'); };
      const sp = () => { if (out.length && !/\s$/.test(out[out.length - 1])) out.push(' '); };
      const show = (s) => { const t = decode(s, fnt); if (t) { out.push(t); lastLen = t.length; } };
      while (i < n) {
        const c = src[i];
        if (c <= ' ') { i++; continue; }
        if (c === '%') { while (i < n && src[i] !== '\n' && src[i] !== '\r') i++; continue; }
        if (c === '(') { const [s, j] = lit(src, i); st.push({ s }); i = j; continue; }
        if (c === '<') {
          if (src[i + 1] === '<') { let d = 0, j = i; for (; j < n - 1; j++) { if (src[j] === '<' && src[j + 1] === '<') { d++; j++; } else if (src[j] === '>' && src[j + 1] === '>') { d--; j++; if (!d) break; } } st.push({ d: 1 }); i = j + 1; continue; }
          const j = src.indexOf('>', i), h = src.slice(i + 1, j < 0 ? n : j).replace(/[^0-9a-fA-F]/g, ''); let s = '';
          for (let k = 0; k < h.length; k += 2) s += String.fromCharCode(parseInt((h.slice(k, k + 2) + '0').slice(0, 2), 16));
          st.push({ s }); i = j < 0 ? n : j + 1; continue;
        }
        if (c === '[') { st.push('['); i++; continue; }
        if (c === ']') { const k = st.lastIndexOf('['), arr = k >= 0 ? st.splice(k).slice(1) : []; st.push({ a: arr }); i++; continue; }
        if (c === '/') { let j = i + 1; while (j < n && !DEL.test(src[j])) j++; st.push({ nm: src.slice(i + 1, j) }); i = j; continue; }
        if (/[0-9.+-]/.test(c)) { let j = i + 1; while (j < n && /[0-9.]/.test(src[j])) j++; st.push(+src.slice(i, j) || 0); i = j; continue; }
        let j = i; while (j < n && !DEL.test(src[j])) j++;
        const op = j > i ? src.slice(i, j) : src[i]; i = j > i ? j : i + 1;
        const a = st; st = [];
        switch (op) {
          case 'Tf': fnt = FT[(a[0] || {}).nm] || null; fs = Math.abs(a[1]) || fs; break;
          case 'Tm': { const x = a[4] || 0, y = a[5] || 0; sc = Math.abs(a[3]) || Math.abs(a[0]) || 1; if (ly != null && Math.abs(y - ly) > fs * sc * 0.35) nl(); else if (lx != null && !(lastLen <= 1 && x - lx > 0 && x - lx < fs * sc * 1.1)) sp(); ly = y; lx = x; break; }
          case 'Td': case 'TD': { const dx = a[0] || 0, dy = a[1] || 0; if (Math.abs(dy) > 0.01) nl(); else if (!(lastLen <= 1 && dx > 0 && dx < fs * 1.1)) sp(); if (ly != null) ly += dy * sc; if (lx != null) lx += dx * sc; break; }
          case 'T*': nl(); break;
          case 'Tj': if (a.length) show((a[a.length - 1] || {}).s || ''); break;
          case "'": case '"': nl(); if (a.length) show((a[a.length - 1] || {}).s || ''); break;
          case 'TJ': for (const e of ((a[a.length - 1] || {}).a || [])) { if (typeof e === 'number') { if (e < -180) sp(); } else if (e && e.s != null) show(e.s); } break;
          case 'ET': sp(); break;
          case 'Do': { const xn = XO[(a[0] || {}).nm], xd = xn != null && O.get(xn) ? O.get(xn).dict : ''; if (depth < 4 && /\/Subtype\s*\/Form/.test(xd)) { const d = await data(xn); if (d) { nl(); await run(bin(d), pval(xd, 'Resources') || res, depth + 1); nl(); } } break; }
          case 'BI': { const e = src.indexOf('EI', i); i = e < 0 ? n : e + 2; break; }
          default: break;
        }
      }
    };
    for (const P of pages) {
      let cs = refs(pval(P.dict, 'Contents'));
      if (cs.length === 1 && O.get(cs[0]) && !O.get(cs[0]).data) cs = refs(O.get(cs[0]).dict);
      const parts = []; for (const r of cs) { const d = await data(r); if (d) parts.push(bin(d)); }
      await run(parts.join('\n'), P.res, 0); out.push('\n\n');
    }
    return out.join('').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /* ── DEXA report text → values (header columns first, then mass sums to identify columns) ── */
  const NUMRX = /-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d*\.\d+|-?\d+/g;
  const nums = (s) => (String(s).match(NUMRX) || []).map((x) => +x.replace(/,/g, ''));
  const massUnit = (s) => (/\blbs?\b|pounds/i.test(s) ? 'lb' : /\bkg\b/i.test(s) ? 'kg' : /\(\s*g\s*\)|\bgrams?\b|^\s*g\s*$/i.test(s) ? 'g' : null);
  const toKg = (v, u) => (v == null ? null : u === 'lb' ? v * LB : u === 'g' ? v / 1000 : v);
  const REGION = [['la', /^(?:l(?:eft)?\.?\s*arm)\b/i], ['ra', /^(?:r(?:ight)?\.?\s*arm)\b/i], ['ll', /^(?:l(?:eft)?\.?\s*leg)\b/i], ['rl', /^(?:r(?:ight)?\.?\s*leg)\b/i], ['arms', /^arms?\b/i], ['legs', /^legs?\b/i], ['tr', /^trunk\b/i], ['and', /^android\b/i], ['gyn', /^gynoid\b/i], ['head', /^head\b/i], ['tot', /^(?:total|whole body|body total)\b/i]];
  const HDR = /(total\s*body\s*fat\s*%|%\s*body\s*fat|body\s*fat\s*%|%\s*fat|fat\s*%|lean\s*\+\s*bmc|lean(?:\s*(?:mass|tissue))?|fat[- ]free(?:\s*mass)?|tissue\s*\(\s*(?:g|kg|lbs?)\s*\)|fat(?:\s*(?:mass|tissue))?|\bbmc\b|total(?:\s*mass)?|centile|percentile|\bbmd\b|t[- ]?score|z[- ]?score|\barea\b|\bmass\b)(\s*\(\s*(?:g|kg|lbs?|g\/cm²|g\/cm2|cm²|cm2)\s*\))?/gi;
  function header(line) {
    const cols = []; let m; HDR.lastIndex = 0;
    while ((m = HDR.exec(line))) {
      const w = m[1].toLowerCase(), u = m[2] ? massUnit(m[2]) : null;
      const k = /%/.test(w) ? 'pct' : /lean\s*\+\s*bmc/.test(w) ? 'leanbmc' : /lean|fat[- ]free/.test(w) ? 'lean' : /^tissue/.test(w) ? 'skip' : /^fat/.test(w) ? 'fat' : /bmc/.test(w) ? 'bmc' : /centile|percentile|area/.test(w) ? 'skip' : /bmd/.test(w) ? 'bmd' : /^t[- ]?score/.test(w) ? 't' : /^z/.test(w) ? 'z' : 'total';
      cols.push({ k, u });
    }
    if (cols.length < 2) return null;
    const kinds = cols.map((c) => c.k);
    if (!kinds.some((k) => ['fat', 'lean', 'leanbmc', 'bmd', 't', 'pct'].includes(k))) return null;
    if (nums(line.replace(/cm[²2]|\^2|g\/cm/gi, '')).length > 1) return null;
    let seen = false; cols.forEach((c) => { if (c.k === 'pct') { if (seen) c.k = 'skip'; seen = true; } });
    return { cols, bone: kinds.includes('bmd') || kinds.includes('t') };
  }
  function byMass(n) {
    const near = (a, b) => Math.abs(a - b) <= Math.max(0.2, Math.abs(b) * 0.015), L = n.length;
    for (let k = 0; k < L; k++) for (let i = 0; i < L; i++) for (let j = i + 1; j < L; j++) {
      if (i === k || j === k || !(n[k] > 0) || !near(n[i] + n[j], n[k])) continue;
      for (let p = 0; p < L; p++) { if (p === i || p === j || p === k) continue; for (const [fi, oi] of [[i, j], [j, i]]) if (near((n[fi] / n[k]) * 100, n[p])) return { fat: { v: n[fi] }, leanbmc: { v: n[oi] }, total: { v: n[k] }, pct: { v: n[p] } }; }
    }
    for (let k = 0; k < L; k++) for (let i = 0; i < L; i++) for (let j = i + 1; j < L; j++) for (let l = j + 1; l < L; l++) {
      if ([i, j, l].includes(k) || !(n[k] > 0) || !near(n[i] + n[j] + n[l], n[k])) continue;
      for (let p = 0; p < L; p++) { if ([i, j, l, k].includes(p)) continue; for (const fi of [i, j, l]) if (near((n[fi] / n[k]) * 100, n[p])) { const rest = [i, j, l].filter((x) => x !== fi).sort((a, b) => n[b] - n[a]); return { fat: { v: n[fi] }, lean: { v: n[rest[0]] }, bmc: { v: n[rest[1]] }, total: { v: n[k] }, pct: { v: n[p] } }; } }
    }
    return null;
  }
  function mapComp(n, hdr, gUnit) {
    let o = null;
    if (hdr && !hdr.bone && n.length >= hdr.cols.length - 1) { o = {}; hdr.cols.forEach((c, i) => { if (i < n.length && c.k !== 'skip' && !(c.k in o)) o[c.k] = { v: n[i], u: c.u }; }); }
    const sane = (q) => { if (!q) return false; if (q.pct && (q.pct.v < 0 || q.pct.v > 80)) return false; if (!q.fat && !q.lean && !q.leanbmc) return false; if (q.total && q.fat && (q.leanbmc || q.lean) && (q.fat.u || '') === (q.total.u || '')) { const sum = q.fat.v + (q.leanbmc ? q.leanbmc.v : q.lean.v + (q.bmc ? q.bmc.v : 0)); if (Math.abs(sum - q.total.v) > q.total.v * 0.03 + 0.2) return false; } return true; };
    if (!sane(o)) { o = byMass(n); if (!o) return null; }
    const tu = o.total && (o.total.u || (o.total.v > 600 ? 'g' : null));
    const kg = (c) => (c ? toKg(c.v, c.u || tu || (c.v > 600 ? 'g' : gUnit)) : null);
    const R = { pct: o.pct ? o.pct.v : null, fat: kg(o.fat), total: kg(o.total), bmc: kg(o.bmc), lean: kg(o.lean), leanbmc: kg(o.leanbmc) };
    if (R.lean == null && R.leanbmc != null && R.bmc != null) R.lean = R.leanbmc - R.bmc;
    if (R.pct == null && R.fat != null && R.total) R.pct = (R.fat / R.total) * 100;
    return R;
  }
  function parseDateText(T) {
    const today = dayKey(), cands = [];
    T.split('\n').forEach((line) => {
      line = line.replace(/(?:birth\s*date|date\s*of\s*birth|\bdob\b|\bborn\b)\s*[:#]?\s*[A-Za-z]{0,9}\.?\s*[\d/.,-]+(?:\s+\d{4})?/gi, ' ');
      for (const m of line.matchAll(/\b(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/.]\d{1,2}[/.]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.? \d{1,2},? \d{4}|\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]* \d{4})\b/gi)) {
        const d = parseDay(m[1], false) || parseDay(m[1], true); if (d && d <= today) cands.push({ d, scan: /scan|exam|measure|acqui|test date|visit|report/i.test(line) });
      }
    });
    const s = cands.filter((c) => c.scan); return (s.length ? s : cands).map((c) => c.d).sort().pop() || null;
  }
  function parseDexa(text) {
    const T = String(text).replace(/\r/g, '\n').replace(/[   ]/g, ' ').replace(/[−–]/g, '-');
    const lines = T.split('\n').map((l) => l.replace(/[|│]/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
    const F = {}, seg = {}, found = new Set();
    const gUnit = (T.match(/\blbs?\b/gi) || []).length > (T.match(/\bkg\b/gi) || []).length ? 'lb' : 'kg';
    const set = (k, v, d = 2) => { if (v == null || !Number.isFinite(v) || F[k] != null) return; F[k] = rd(v, d); found.add(k); };
    const setSeg = (r, k, v) => { if (v == null || !Number.isFinite(v) || v < 0) return; (seg[r] = seg[r] || {}); if (seg[r][k] == null) { seg[r][k] = rd(v, 2); found.add(`seg.${r}.${k}`); } };
    let hdr = null; const pctOf = {};
    for (const line of lines) {
      const H = header(line); if (H) { hdr = H; continue; }
      const reg = REGION.find(([, rx]) => rx.test(line)); if (!reg) continue;
      const n = nums(line.replace(reg[1], '')); if (n.length < 2) continue;
      if (hdr && hdr.bone) {
        if (reg[0] !== 'tot') continue;
        const o = {}; hdr.cols.forEach((c, i) => { if (i < n.length && !(c.k in o)) o[c.k] = n[i]; });
        let bmd = o.bmd, t = o.t, z = o.z;
        if (bmd == null || bmd > 3) { const bi = n.findIndex((v) => v > 0.2 && v < 2.5 && !Number.isInteger(v)); if (bi >= 0) { bmd = n[bi]; [t, z] = n.slice(bi + 1).filter((v) => v > -7 && v < 7); } }
        if (o.bmc != null && o.bmc > 0) { const bu = (hdr.cols.find((c) => c.k === 'bmc') || {}).u || (o.bmc > 100 ? 'g' : gUnit); set('bmc', toKg(o.bmc, bu)); }
        if (bmd > 0.2 && bmd < 2.5) set('bmd', bmd, 3); if (t > -7 && t < 7) set('t', t, 1); if (z > -7 && z < 7) set('z', z, 1);
        continue;
      }
      const R = mapComp(n, hdr, gUnit); if (!R) continue;
      if (reg[0] === 'tot') { set('w', R.total); set('fat', R.fat); set('lean', R.lean); set('bmc', R.bmc); set('bf', R.pct, 1); }
      else if (['la', 'ra', 'll', 'rl', 'tr'].includes(reg[0])) { setSeg(reg[0], 'lean', R.lean != null ? R.lean : R.leanbmc); setSeg(reg[0], 'fat', R.fat); }
      else if (reg[0] === 'and' || reg[0] === 'gyn') pctOf[reg[0]] = R.pct;
    }
    const grab = (rx, d = 2) => { const m = rx.exec(T); return m ? +m[1].replace(/,/g, '') : null; };
    let m = /(?:\bVAT\b|visceral)[^\n\d]{0,40}?\bmass\b\s*(?:\((g|kg|lbs?)\))?[^\d\n-]{0,14}(\d[\d,]*\.?\d*)\s*(g\b|kg\b|lbs?\b)?/i.exec(T);
    if (m) { const v = +m[2].replace(/,/g, ''), u = massUnit(m[1] || m[3] || '') || (v > 20 ? 'g' : gUnit); set('vat', toKg(v, u), 3); }
    m = /(?:\bVAT\b|visceral)[^\n\d]{0,40}?\bvolume\b\s*(?:\((cm3|cm³|in3|in³)\))?[^\d\n]{0,14}(\d[\d,]*\.?\d*)\s*(cm3|cm³|in3|in³)?/i.exec(T);
    if (m) { const v = +m[2].replace(/,/g, ''); set('vatv', /in/i.test(m[1] || m[3] || '') ? v * 16.387 : v, 0); }
    set('ag', grab(/(?:A\s*\/\s*G|android\s*\/\s*gynoid)(?:\s+fat)?\s+ratio[^\d\n]{0,8}(\d*\.?\d+)/i));
    if (F.ag == null && pctOf.and && pctOf.gyn) set('ag', pctOf.and / pctOf.gyn);
    if (F.bmd == null) set('bmd', grab(/(?:total\s+(?:body\s+)?)?BMD[^\d\n]{0,22}(\d\.\d{2,4})/i), 3);
    if (F.t == null) set('t', grab(/T[- ]?score[^\d\n-]{0,12}(-?\d+(?:\.\d+)?)/i), 1);
    if (F.z == null) set('z', grab(/Z[- ]?score[^\d\n-]{0,12}(-?\d+(?:\.\d+)?)/i), 1);
    if (F.bf == null) set('bf', grab(/(?:total\s+)?body\s+fat\s*(?:%|percent(?:age)?)[^\d\n]{0,10}(\d+(?:\.\d+)?)/i), 1);
    if (F.w == null) { m = /(?:weight|total\s+mass)[^\d\n]{0,12}(\d+(?:\.\d+)?)\s*(kg|lbs?)\b/i.exec(T); if (m) set('w', toKg(+m[1], massUnit(m[2]))); }
    const d = parseDateText(T); if (d) { F.d = d; found.add('d'); }
    const dev = /(Hologic(?: Horizon)?|GE (?:Lunar|HealthCare|Healthcare)(?: iDXA| Prodigy)?|Lunar (?:iDXA|Prodigy)|iDXA|Horizon [A-Z]|Discovery [A-Z]|BodySpec|DexaFit)/i.exec(T); if (dev) { F.dev = dev[1]; found.add('dev'); }
    if (F.bf != null && (F.bf < 2 || F.bf > 75)) { delete F.bf; found.delete('bf'); }
    if (F.w != null && (F.w < 20 || F.w > 350)) { delete F.w; found.delete('w'); }
    return { fields: F, seg, found: [...found] };
  }
  function draftFrom(text, from) {
    const P = parseDexa(text), base = blankDraft();
    REG.forEach(([k]) => { if (P.seg[k]) base.seg[k] = { ...base.seg[k], ...P.seg[k] }; });
    BC.draft = { ...base, ...P.fields, seg: base.seg, found: P.found, from }; BC.du = 'kg'; BC.paste = false;
    BC.note = P.found.filter((k) => k !== 'd' && k !== 'dev').length ? `Read ${P.found.filter((k) => k !== 'd' && k !== 'dev').length} values from the report.` : 'No DEXA values were recognised. Enter them below.';
  }

  /* ── register ── */
  OS.register('bodycomp', {
    title: 'Body composition', icon: 'scale',
    render(s) {
      ensure(s); BC.charts = {};
      const body = BC.tab === 'scale' ? scaleTab(s) : BC.tab === 'dexa' ? dexaTab(s) : BC.tab === 'compare' ? compareTab(s) : overview(s);
      return `${OS.ui.head('Smart scale + DEXA · on-device', 'Body composition', 'Fat, lean mass, bone and visceral fat from your smart scale and DEXA scans on one timeline. Files are read on this device.')}
        <div class="bc"><div class="seg kt-tabs" role="tablist" aria-label="Body composition">${TABS.map(([k, l]) => `<button role="tab" aria-selected="${BC.tab === k}" data-act="bc-tab" data-t="${k}">${l}</button>`).join('')}</div>${body}</div>`;
    },
    mount(root) { bindCharts(root); }
  });

  OS.act('bc-tab', (el) => { const t = el.dataset.t; BC.tab = TABS.some(([k]) => k === t) ? t : 'overview'; if (t === 'scale') BC.view = BC.view || 'apple'; OS.render(); });
  OS.act('bc-src', (el) => { BC.src = el.dataset.k; OS.render(); });
  OS.act('bc-view', (el) => { BC.view = el.dataset.k; BC.snote = ''; OS.render(); });
  OS.act('bc-example', () => { OS.update((st) => { const S = ensure(st); if (!S.scans.some((x) => x.sample)) S.scans.push(...sampleScans()); }, { keepSample: true }); OS.toast('Sample scans added. Remove them any time.'); });
  OS.act('bc-unsample', () => { OS.update((st) => { const S = ensure(st); S.scans = S.scans.filter((x) => !x.sample); }, { keepSample: true }); OS.toast('Sample scans removed'); });
  OS.act('bc-del', (el) => { if (!confirm('Delete this scan?')) return; OS.update((st) => { const S = ensure(st); S.scans = S.scans.filter((x) => x.id !== el.dataset.id); syncProfile(st); }); });
  OS.act('bc-undo', () => { const B = BC.lastBatch; if (!B) return; OS.update((st) => { const S = ensure(st); S.scans = S.scans.filter((x) => x.batch !== B.id); syncProfile(st); }); BC.lastBatch = null; OS.toast(`Removed ${B.n} imported readings`); });
  OS.act('bc-ble', () => bleConnect());
  OS.act('bc-ble-off', () => { try { BC.ble && BC.ble.dev.gatt.disconnect(); } catch { /* already gone */ } BC.ble = null; OS.render(); });
  OS.act('bc-ble-save', () => {
    const B = BC.ble; if (!B || !ok(B.r.w)) return; const r = B.r;
    addBatch([{ d: dayKey(), w: r.w, bf: r.bf, smm: r.smm, water: ok(r.waterKg) ? rd((r.waterKg / r.w) * 100, 1) : null, bmr: r.bmr, dev: B.name }], { src: 'ble', kind: 'bia' });
    BC.lastBatch = null; B.r = {}; B.status = 'Saved. Step on again for another reading.';
    OS.toast('Reading saved'); OS.render();
  });
  OS.change('bc-apple', (el) => { const file = el.files && el.files[0]; el.value = ''; if (file) appleFile(file); });
  OS.change('bc-pick', (el) => { if (BC.pending) BC.pending.pick[el.dataset.k] = el.checked; });
  OS.act('bc-pend-x', () => { BC.pending = null; OS.render(); });
  OS.act('bc-apple-go', () => {
    const P = BC.pending; if (!P) return;
    const rows = Object.entries(P.by).filter(([k]) => P.pick[k]).flatMap(([src, rs]) => rs.map((r) => ({ d: r.d, w: r.w, bf: ok(r.bf) ? r.bf : ok(r.lean) && ok(r.w) ? rd(((r.w - r.lean) / r.w) * 100, 1) : null, dev: src })));
    if (!rows.length) { OS.toast('Tick at least one source'); return; }
    const n = addBatch(rows, { src: 'apple', kind: 'bia' }); BC.pending = null;
    BC.snote = n ? `Imported ${n} day${n > 1 ? 's' : ''} of readings.` : 'Nothing new: those readings were already here.';
    if (n) OS.logEvent('scan', 'Apple Health import', `${n} body-composition readings`, { src: 'file', go: 'bodycomp' });
    OS.render();
  });
  OS.change('bc-csv', async (el) => {
    const file = el.files && el.files[0]; el.value = ''; if (!file) return;
    try {
      const R = csvRows(await file.text()); if (!R.rows.length) throw new Error('No rows with a date and a weight or body fat.');
      const n = addBatch(R.rows.map((r) => ({ ...r, dev: file.name.replace(/\.[^.]+$/, '').slice(0, 40) })), { src: 'csv', kind: 'bia' });
      BC.snote = `Imported ${n} reading${n === 1 ? '' : 's'} (${R.cols.length} columns recognised${R.lbs ? ', weights read as pounds' : ''}${R.dmy ? ', dates read as day/month' : ''}).`;
      if (n) OS.logEvent('scan', 'Scale CSV import', `${n} readings from ${file.name}`, { src: 'file', go: 'bodycomp' });
    } catch (e) { BC.snote = e.message || String(e); }
    OS.render();
  });
  OS.change('bc-su', (el) => { BC.su = el.value === 'lb' ? 'lb' : 'kg'; OS.render(); });
  OS.act('bc-man', (form) => {
    const g = (k) => num(form.elements[k] && form.elements[k].value), m = (k) => { const v = g(k); return v == null ? null : BC.su === 'lb' ? v * LB : v; };
    const w = m('w'), bf = g('bf'); const d = form.elements.d.value;
    if (!d || (!ok(w) && !ok(bf))) { OS.toast('Add the date and at least weight or body fat'); return; }
    if ((ok(w) && (w < 20 || w > 350)) || (ok(bf) && (bf < 2 || bf > 75))) { OS.toast('Check the numbers: one is outside a possible range'); return; }
    const sg = {}; REG.forEach(([k]) => { const l = m(`${k}_lean`), fa = m(`${k}_fat`); if (ok(l) || ok(fa)) sg[k] = { lean: rd(l, 2), fat: rd(fa, 2) }; });
    const x = { d, w: rd(w, 2), bf: rd(bf, 1), smm: rd(m('smm'), 2), water: rd(g('water'), 1), bmc: rd(m('bmc'), 2), vatR: rd(g('vatR'), 0), bmr: rd(g('bmr'), 0), mage: rd(g('mage'), 0), dev: (form.elements.dev.value || '').trim().slice(0, 40) || null };
    if (Object.keys(sg).length) x.seg = sg;
    const n = addBatch([x], { src: 'manual', kind: 'bia' }); BC.lastBatch = null;
    OS.toast(n ? 'Reading saved' : 'A reading from that device on that day is already saved');
  });
  // DEXA
  OS.act('bc-paste', () => { BC.paste = !BC.paste; BC.note = ''; OS.render(); setTimeout(() => { const t = document.getElementById('bc-text'); if (t) t.focus(); }, 0); });
  OS.act('bc-hand', () => { BC.draft = blankDraft(); BC.note = ''; OS.render(); });
  OS.act('bc-text', (form) => { const t = form.elements.t.value || ''; if (t.trim().length < 20) { OS.toast('Paste the report text first'); return; } draftFrom(t, 'text'); OS.render(); });
  OS.change('bc-pdf', async (el) => {
    const file = el.files && el.files[0]; el.value = ''; if (!file) return;
    BC.busy = 'Reading the PDF on this device…'; BC.note = ''; OS.render();
    try {
      const text = await pdfText(await file.arrayBuffer());
      if (!text || text.replace(/\s/g, '').length < 40) throw new Error('No text found in this PDF. Scanned reports are images: paste or type the numbers instead.');
      draftFrom(text, 'pdf');
    } catch (e) { BC.note = e.message || String(e); }
    BC.busy = ''; OS.render();
  });
  OS.act('bc-du', (el) => { BC.du = el.dataset.k === 'lb' ? 'lb' : 'kg'; OS.render(); });
  OS.change('bc-df', (el) => {
    const D = BC.draft; if (!D) return; const k = el.dataset.k;
    let v = el.type === 'number' ? num(el.value) : el.value;
    if (el.dataset.mass && v != null) v = BC.du === 'lb' ? v * LB : v;
    const path = k.split('.'), last = path.pop(), obj = path.reduce((a, p) => (a[p] = a[p] || {}), D); obj[last] = v;
  });
  OS.act('bc-dx', () => { BC.draft = null; BC.note = ''; OS.render(); });
  OS.act('bc-dsave', () => {
    const D = BC.draft; if (!D) return;
    const x = { d: D.d, dev: (D.dev || '').trim().slice(0, 60) || null }; ['w', 'bf', 'fat', 'lean', 'bmc', 'vat', 'vatv', 'ag', 'bmd', 't', 'z'].forEach((k) => { if (ok(D[k])) x[k] = rd(+D[k], { vat: 3, bmd: 3, vatv: 0, bf: 1, t: 1, z: 1 }[k] ?? 2); });
    const sg = {}; REG.forEach(([k]) => { const v = D.seg[k] || {}; if (ok(v.lean) || ok(v.fat)) sg[k] = { lean: ok(v.lean) ? rd(+v.lean, 2) : null, fat: ok(v.fat) ? rd(+v.fat, 2) : null }; }); if (Object.keys(sg).length) x.seg = sg;
    const Dv = derive(x, hOf(OS.state));
    if (!x.d || !/^\d{4}-\d{2}-\d{2}$/.test(x.d)) { OS.toast('Add the scan date'); return; }
    if (!ok(Dv.bf) && !ok(Dv.fat) && !ok(x.w) && !ok(x.bmd)) { OS.toast('Add at least body fat, fat mass, weight or bone density'); return; }
    if ((ok(Dv.bf) && (Dv.bf < 2 || Dv.bf > 75)) || (ok(x.w) && (x.w < 20 || x.w > 350)) || (ok(x.t) && Math.abs(x.t) > 7) || (ok(x.z) && Math.abs(x.z) > 7)) { OS.toast('Check the numbers: one is outside a possible range'); return; }
    OS.update((st) => { ensure(st).scans.push({ id: uid(), at: new Date().toISOString(), src: D.from === 'hand' ? 'manual' : 'file', kind: 'dexa', ...x }); syncProfile(st); }, { render: false });
    BC.draft = null; BC.note = ''; OS.toast('DEXA scan saved'); OS.render();
  });

  OS.bodycomp = { derive, parseDexa, pdfText, parseWM, parseBCM, zipEntry, scanHealthXml, groupHealth, parseCSV, csvRows, pairs, sampleScans, state: BC };
  OS.pdfText = pdfText;
})();
