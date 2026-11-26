/* ═══ MYO — LIFESPAN DASHBOARD: Longevity, year to date ═══
   Biological ages against calendar age from 1 January, plus the longevity markers that move them.
   Data: a daily snapshot (s.longevity.log: day, Myo age, PhenoAge, fitness age, pillar average) logged from the first
   visit on, and PhenoAge rebuilt for each past day with glucose and hs-CRP results, using the latest values for the
   other seven PhenoAge labs (drawn hollow and labelled "rebuilt"). Nothing else is estimated or filled in.
   Colours: the validated reference categorical palette, slots 1–3 (blue, orange, aqua), stepped for dark mode, plus a
   marker shape per series; calendar age is a neutral reference line. A table view carries every number. */
(function () {
  'use strict';
  const { esc, dayKey, pill } = OS;
  const SERIES = [['myo', 'Myo age', 'circle'], ['pheno', 'PhenoAge', 'diamond'], ['fit', 'Fitness age', 'square']];
  const MINI = ['apob', 'a1c', 'crp', 'ins', 'vitd', 'o3'];
  const YEAR = 365.25 * 864e5;
  const V = { view: 'chart' };
  const t = (d) => Date.parse(d + 'T12:00:00Z');
  const r1 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10) / 10);
  const f1 = (x) => (x == null ? '—' : x.toFixed(1));
  const sgn = (x, d = 1) => (x == null ? '—' : `${x > 0 ? '+' : x < 0 ? '−' : '±'}${Math.abs(x).toFixed(d)}`);
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmt = (d) => `${MON[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)}`;

  /* ── the daily log: one row a day, updated in place when values change that day; written quietly ── */
  function liveRow(s, sc) {
    if (!OS.longevity) return null;
    const S = OS.longevity.summary(s, sc || OS.scores(s));
    if (S.myoAge == null && S.phenoAge == null && S.fitnessAge == null) return null;
    const pv = Object.values(S.pillars || {}).filter((x) => x != null), pav = pv.length ? Math.round(pv.reduce((a, b) => a + b, 0) / pv.length) : null;
    return [dayKey(), r1(S.myoAge), r1(S.phenoAge), r1(S.fitnessAge), pav];
  }
  function snapshot(s, sc) {
    const row = liveRow(s, sc); if (!row) return;
    const G = OS.longevity.ensure(s), k = row[0];
    G.log = G.log || [];
    const last = G.log[G.log.length - 1];
    if (last && last[0] === k) { if (JSON.stringify(last) === JSON.stringify(row)) return; G.log[G.log.length - 1] = row; } else G.log.push(row);
    G.log = G.log.slice(-800); OS.Persist.save(s);
  }
  OS.on('route', () => { try { snapshot(OS.state, OS.scores(OS.state)); } catch { /* never block a page */ } });

  /* ── this year's points ── */
  function ytd(s) {
    const today = dayKey(), y = today.slice(0, 4), y0 = `${y}-01-01`, y1 = `${y}-12-31`, age = s.profile.age;
    const ageAt = (d) => age - (t(today) - t(d)) / YEAR;
    const G = s.longevity || {}, rows = new Map();
    const mk = (id) => s.markers.find((m) => m.id === id);
    const at = (m, d) => { const h = ((m && m.history) || []).filter((x) => x[0] <= d && OS.plausible(m.id, x[1])); return h.length ? h[h.length - 1][1] : null; };
    const glu = mk('glu'), crp = mk('crp');
    if (OS.longevity && OS.longevity.phenoReady(s)) {
      const days = [...new Set([...((glu && glu.history) || []), ...((crp && crp.history) || [])].map((x) => x[0]))].filter((d) => d >= y0 && d <= today).sort();
      days.forEach((d) => { const g = at(glu, d), c = at(crp, d); if (g == null || c == null) return; const p = OS.longevity.phenoCalc(G.ph, g, c, ageAt(d)); if (p != null) rows.set(d, { d, pheno: r1(p), rec: true }); });
    }
    // stored days, then today from live values: the page draws before the route snapshot saves
    const live = liveRow(s), logRows = (G.log || []).filter((r) => r[0] >= y0 && r[0] < today);
    if (live) logRows.push(live);
    logRows.forEach(([d, myo, pheno, fit, pil]) => {
      const cur = rows.get(d) || { d };
      rows.set(d, { ...cur, myo, fit, pil, pheno: pheno ?? cur.pheno, rec: pheno == null ? !!cur.rec : false });
    });
    const pts = [...rows.values()].sort((a, b) => a.d.localeCompare(b.d)).map((p) => ({ ...p, cal: ageAt(p.d) }));
    return { y, y0, y1, today, ageAt, pts };
  }
  // the series with most points this year leads the headline numbers (Myo age once the log has grown)
  function lead(D) {
    const n = (k) => D.pts.filter((p) => p[k] != null).length;
    return ['myo', 'pheno', 'fit'].sort((a, b) => n(b) - n(a))[0];
  }
  function pace(D, k) {
    const xs = D.pts.filter((p) => p[k] != null);
    if (xs.length < 2 || t(xs.at(-1).d) - t(xs[0].d) < 60 * 864e5) return null;
    const mx = xs.reduce((a, p) => a + p.cal, 0) / xs.length, my = xs.reduce((a, p) => a + p[k], 0) / xs.length;
    const num = xs.reduce((a, p) => a + (p.cal - mx) * (p[k] - my), 0), den = xs.reduce((a, p) => a + (p.cal - mx) ** 2, 0);
    return den ? num / den : null;
  }

  /* ── the main chart, drawn at the container's width ── */
  function shape(kind, x0, y0, cls, fill) {
    const x = Math.round(Number(x0) * 10) / 10, y = Math.round(Number(y0) * 10) / 10;
    if (kind === 'diamond') return `<path class="${cls}" d="M${x} ${y - 6}L${x + 6} ${y}L${x} ${y + 6}L${x - 6} ${y}Z" ${fill}/>`;
    if (kind === 'square') return `<rect class="${cls}" x="${x - 4.5}" y="${y - 4.5}" width="9" height="9" rx="1.5" ${fill}/>`;
    return `<circle class="${cls}" cx="${x}" cy="${y}" r="5" ${fill}/>`;
  }
  function chart(D, w) {
    const W = Math.max(320, Math.min(860, w)), H = W < 560 ? 260 : 300, L = 40, R = W < 560 ? 78 : 104, T = 16, B = 30;
    const X = (d) => L + (t(d) - t(D.y0)) / (t(D.y1) - t(D.y0)) * (W - L - R);
    const vals = D.pts.flatMap((p) => SERIES.map(([k]) => p[k]).filter((v) => v != null)).concat([D.ageAt(D.y0), D.ageAt(D.y1)]);
    let lo = Math.floor(Math.min(...vals) - 1.5), hi = Math.ceil(Math.max(...vals) + 1.5);
    const step = hi - lo > 24 ? 5 : hi - lo > 10 ? 2 : 1; lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    const Y = (v) => T + (hi - v) / (hi - lo) * (H - T - B);
    const ticks = []; for (let v = lo; v <= hi; v += step) ticks.push(v);
    const months = MON.map((m, i) => ({ m, d: `${D.y}-${String(i + 1).padStart(2, '0')}-01` })).filter((_, i) => W >= 560 || i % 2 === 0);
    const tx = X(D.today);
    // direct labels in the right gutter, spread so they never overlap
    const labs = SERIES.map(([k, name]) => { const xs = D.pts.filter((p) => p[k] != null); const p = xs.at(-1); return p ? { k, name, v: p[k], x: X(p.d), y: Y(p[k]) } : null; }).filter(Boolean)
      .concat([{ k: 'cal', name: 'Calendar age', v: D.ageAt(D.today), x: tx, y: Y(D.ageAt(D.today)) }]).sort((a, b) => a.y - b.y);
    for (let i = 1; i < labs.length; i++) labs[i].ly = Math.max(labs[i].y, (labs[i - 1].ly ?? labs[i - 1].y) + 26);
    labs.forEach((l) => { l.ly = l.ly ?? l.y; });
    const over = labs.length && labs.at(-1).ly > H - B - 4 ? labs.at(-1).ly - (H - B - 4) : 0; labs.forEach((l) => { l.ly -= over; });
    return `<svg class="ls-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Biological ages against calendar age, ${D.y} to date. Details in the table view.">
      <g class="ls-grid">${ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`).join('')}</g>
      <g class="ls-axis">${months.map(({ m, d }) => `<text x="${X(d)}" y="${H - 8}">${m}</text>`).join('')}<line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/></g>
      <line class="ls-today" x1="${tx}" x2="${tx}" y1="${T}" y2="${H - B}"/><text class="ls-today-t" x="${tx - 4}" y="${T + 10}" text-anchor="end">Today</text>
      <path class="ls-cal" d="M${X(D.y0)} ${Y(D.ageAt(D.y0))}L${tx} ${Y(D.ageAt(D.today))}"/><path class="ls-cal ahead" d="M${tx} ${Y(D.ageAt(D.today))}L${X(D.y1)} ${Y(D.ageAt(D.y1))}"/>
      ${SERIES.map(([k, , kind]) => { const xs = D.pts.filter((p) => p[k] != null); if (!xs.length) return ''; return `<g class="ls-s ls-${k}">${xs.length > 1 ? `<path class="ls-line" d="${xs.map((p, i) => `${i ? 'L' : 'M'}${X(p.d).toFixed(1)} ${Y(p[k]).toFixed(1)}`).join('')}"/>` : ''}
          ${xs.map((p) => shape(kind, X(p.d), Y(p[k]), `ls-pt ${p.rec && k === 'pheno' ? 'rec' : ''}`, '')).join('')}</g>`; }).join('')}
      <g class="ls-labels">${labs.map((l) => `<line class="ls-lead ls-lead-${l.k}" x1="${l.x + 7}" y1="${l.y}" x2="${W - R + 4}" y2="${l.ly}"/><text class="ls-lab" x="${W - R + 8}" y="${l.ly - 2}">${esc(l.name)}</text><text class="ls-labv" x="${W - R + 8}" y="${l.ly + 11}">${f1(l.v)}</text>`).join('')}</g>
      <line class="ls-cross" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/>
      <rect class="ls-hit" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"/>
    </svg><div class="ls-tip" role="status" hidden></div>`;
  }
  function table(D) {
    if (!D.pts.length) return '';
    return `<div class="tbl-wrap"><table class="tbl compact ls-table"><caption class="sr">Biological ages, ${D.y} to date</caption><thead><tr><th scope="col">Date</th><th scope="col">Calendar age</th><th scope="col">Myo age</th><th scope="col">PhenoAge</th><th scope="col">Fitness age</th><th scope="col">Source</th></tr></thead>
      <tbody>${[...D.pts].reverse().map((p) => `<tr><th scope="row">${fmt(p.d)}</th><td class="num">${f1(p.cal)}</td><td class="num">${f1(p.myo)}</td><td class="num">${f1(p.pheno)}</td><td class="num">${f1(p.fit)}</td><td class="small">${p.rec && p.myo == null ? 'Rebuilt from that day\'s labs' : 'Daily log'}</td></tr>`).join('')}</tbody></table></div>`;
  }

  /* ── longevity markers, this year: one small chart each, against the optimal band ── */
  function mini(s, id, D) {
    const m = s.markers.find((x) => x.id === id); if (!m) return '';
    const pts = (m.history || []).filter((h) => h[0] >= D.y0 && h[0] <= D.today && OS.plausible(m.id, h[1])).sort((a, b) => a[0].localeCompare(b[0]));
    const e = OS.markerEval(m), o = m.optimal || [null, null];
    if (!pts.length) return `<article class="ls-mini"><header><b>${esc(m.name)}</b>${pill('muted', 'No result this year')}</header><p class="muted small">Import labs on Biology to track it.</p></article>`;
    const W = 260, H = 92, L = 6, R = 6, T = 8, B = 18;
    const vs = pts.map((p) => +p[1]).concat(o.filter((x) => x != null));
    let lo = Math.min(...vs), hi = Math.max(...vs); const pad = (hi - lo) * 0.18 || Math.abs(hi) * 0.1 || 1; lo -= pad; hi += pad;
    const X = (d) => L + (t(d) - t(D.y0)) / (t(D.y1) - t(D.y0)) * (W - L - R), Y = (v) => T + (hi - v) / (hi - lo) * (H - T - B);
    const b0 = o[1] == null ? T : Y(o[1]), b1 = o[0] == null ? H - B : Y(o[0]);
    const first = pts[0], last = pts.at(-1), d = +last[1] - +first[1];
    return `<article class="ls-mini"><header><b>${esc(m.name)}</b>${pill(e.status, e.label)}</header>
      <p class="ls-mini-v"><b class="num">${esc(last[1])}</b> <span class="muted small">${esc(m.unit)}</span>${pts.length > 1 ? ` <span class="small">${sgn(d, Math.abs(d) < 10 ? 1 : 0)} since ${fmt(first[0])}</span>` : ''}</p>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(m.name)}: ${pts.map((p) => `${fmt(p[0])} ${p[1]}`).join(', ')}. Optimal ${esc(OS.ui.fmtR(o))} ${esc(m.unit)}.">
        <rect class="ls-band" x="${L}" y="${Math.min(b0, b1)}" width="${W - L - R}" height="${Math.max(2, Math.abs(b1 - b0))}"/>
        <line class="ls-mini-axis" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/><text x="${L}" y="${H - 4}" class="ls-mini-t">Jan</text><text x="${W - R}" y="${H - 4}" text-anchor="end" class="ls-mini-t">Dec</text>
        ${pts.length > 1 ? `<path class="ls-mini-line" d="${pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(+p[1]).toFixed(1)}`).join('')}"/>` : ''}
        ${pts.map((p, i) => `<circle class="ls-mini-pt ${i === pts.length - 1 ? 'last' : ''}" cx="${X(p[0]).toFixed(1)}" cy="${Y(+p[1]).toFixed(1)}" r="4"><title>${fmt(p[0])}: ${p[1]} ${esc(m.unit)}</title></circle>`).join('')}
      </svg><p class="ls-mini-o small muted">Optimal ${esc(OS.ui.fmtR(o))} ${esc(m.unit)} (shaded)</p></article>`;
  }

  function card(s, sc) {
    const D = ytd(s), S = OS.longevity.summary(s, sc), age = s.profile.age;
    const k = lead(D), xs = D.pts.filter((p) => p[k] != null), name = SERIES.find((x) => x[0] === k)[1];
    const change = xs.length > 1 ? xs.at(-1)[k] - xs[0][k] : null, pc = pace(D, k);
    const logged = D.pts.filter((p) => p.pil != null).map((p) => [p.d, p.pil]), pil = logged.length ? logged.at(-1)[1] : null, pil0 = logged.length > 1 ? logged[0][1] : null;
    const tile = (label, val, sub, cls = '') => `<div class="ls-tile ${cls}"><span>${label}</span><b class="num">${val}</b><em>${sub}</em></div>`;
    const empty = !D.pts.length;
    return `<section class="card ls" aria-labelledby="ls-h">
      <div class="card-h"><div><h2 id="ls-h">Lifespan dashboard · ${D.y} to date</h2><span class="muted small">1 January to ${fmt(D.today)} · updates every day you open Myo</span></div>
        ${empty ? '' : `<div class="seg" role="group" aria-label="Show as"><button aria-pressed="${V.view === 'chart'}" data-act="ls-view" data-v="chart">Chart</button><button aria-pressed="${V.view === 'table'}" data-act="ls-view" data-v="table">Table</button></div>`}</div>
      <div class="ls-tiles">
        ${tile('Myo age now', f1(S.myoAge), S.myoAge == null ? 'needs labs or a resting HR' : `${sgn(S.myoAge - age)} y vs your age ${age}`)}
        ${tile(`${name} since ${xs.length ? fmt(xs[0].d) : 'January'}`, change == null ? '—' : `${sgn(change)} y`, change == null ? 'needs two results this year' : change < 0 ? 'lower: biologically younger' : change > 0 ? 'higher: biologically older' : 'no change', change == null ? '' : change < 0 ? 'good' : 'warn')}
        ${tile('Pace of ageing', pc == null ? '—' : pc.toFixed(2), pc == null ? 'needs results 2 months apart' : pc < 0 ? 'years per year: falling' : pc < 1 ? 'years per year: slower than the calendar' : 'years per year: faster than the calendar', pc == null ? '' : pc < 1 ? 'good' : 'warn')}
        ${tile('Healthspan pillars', pil == null ? '—' : pil, pil0 == null ? 'average of 7 · tracking starts today' : `average of 7 · ${sgn(pil - pil0, 0)} since ${fmt(logged[0][0])}`)}
      </div>
      ${empty ? `<p class="muted">Your chart starts with your first biological age. Add the 7 PhenoAge labs below with fasting glucose and hs-CRP on Biology, or connect a ring or strap for a fitness age.</p>` : `
      <div class="ls-legend" aria-hidden="true">${SERIES.filter(([kk]) => D.pts.some((p) => p[kk] != null)).map(([kk, n, kind]) => `<span><svg width="14" height="14" viewBox="-7 -7 14 14">${shape(kind, 0, 0, `ls-pt ls-${kk}-f`, '')}</svg>${n}</span>`).join('')}<span><svg width="22" height="8"><path class="ls-cal" d="M1 4H21"/></svg>Calendar age</span>${D.pts.some((p) => p.rec) ? '<span><svg width="14" height="14" viewBox="-7 -7 14 14"><path class="ls-pt rec ls-pheno-f" d="M0 -6L6 0L0 6L-6 0Z"/></svg>Rebuilt from past labs</span>' : ''}</div>
      <div class="ls-chart" id="ls-chart" ${V.view === 'table' ? 'hidden' : ''}></div>
      <div class="ls-tablewrap" ${V.view === 'chart' ? 'hidden' : ''}>${table(D)}</div>`}
      <p class="fine">Below the calendar-age line means your body is ageing slower than the years. Hollow points are rebuilt from that day's glucose and hs-CRP with your latest values for the other PhenoAge labs. Myo age and fitness age are logged daily from your first visit. Biological age is an estimate to guide your plan, not a lifespan prediction.</p>
      <h3 class="ls-sub">Longevity markers this year</h3>
      <div class="ls-minis">${MINI.map((id) => mini(s, id, D)).join('')}</div>
    </section>`;
  }

  function mount(root, s) {
    const box = root.querySelector('#ls-chart'); if (!box) return;
    const D = ytd(s);
    let raf = 0;
    const draw = () => { raf = 0; box.innerHTML = chart(D, box.clientWidth || 720); wire(); };
    // crosshair: the nearest day with data, its values, and calendar age
    function wire() {
      const svg = box.querySelector('svg'), hit = svg.querySelector('.ls-hit'), cross = svg.querySelector('.ls-cross'), tip = box.querySelector('.ls-tip');
      const W = +svg.getAttribute('width'), L = 40, R = W < 560 ? 78 : 104;
      const X = (d) => L + (t(d) - t(D.y0)) / (t(D.y1) - t(D.y0)) * (W - L - R);
      const move = (ev) => {
        const r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) * (W / r.width);
        let best = null; D.pts.forEach((p) => { const dx = Math.abs(X(p.d) - x); if (!best || dx < best.dx) best = { p, dx }; });
        if (!best || best.dx > 40) { cross.setAttribute('visibility', 'hidden'); tip.hidden = true; return; }
        const p = best.p, px = X(p.d);
        cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('visibility', 'visible');
        tip.innerHTML = `<b>${fmt(p.d)}</b>${SERIES.filter(([k]) => p[k] != null).map(([k, n]) => `<span><i class="ls-sw ls-${k}-f"></i>${n} ${f1(p[k])}${k === 'pheno' && p.rec ? ' (rebuilt)' : ''}</span>`).join('')}<span class="muted">Calendar age ${f1(p.cal)}</span>`;
        tip.hidden = false;
        const left = px * (r.width / W); tip.style.left = `${Math.min(Math.max(8, left + 12), r.width - tip.offsetWidth - 8)}px`;
      };
      hit.addEventListener('pointermove', move); hit.addEventListener('pointerdown', move);
      hit.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); tip.hidden = true; });
    }
    draw();
    const ro = window.ResizeObserver ? new ResizeObserver(() => { if (!raf) raf = requestAnimationFrame(draw); }) : null;
    if (ro) ro.observe(box);
    return () => { if (ro) ro.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }

  OS.act('ls-view', (el) => { V.view = el.dataset.v; OS.render(); });
  OS.lifespan = { card, mount, ytd, snapshot };
})();
