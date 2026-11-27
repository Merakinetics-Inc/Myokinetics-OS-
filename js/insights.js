/* ═══ MYO — INSIGHTS: one daily table from every Myo log, what moves with what, and experiments on yourself ═══
   Week        · this week against last week for every tracked measure, with 4-week sparklines
   Patterns    · Spearman correlations between measures, same day and next day, from at least 14 shared days;
                 only moderate or stronger links (|ρ| ≥ 0.3, p < 0.05) are shown, with scatter plots
   Experiments · n-of-1 tests: a baseline block and a change block, compared by mean difference, Cohen's d and a
                 bootstrap 90% interval; any daily measure, or a 1–10 rating you enter each day
   Everything is computed on this device from data already in Myo. Patterns are leads to test, not proof of cause. */
(function () {
  'use strict';
  const { esc, icon, pill, clamp, dayKey, addDays, fmtDate, spark, uid } = OS;
  const TABS = [['week', 'This week'], ['pat', 'Patterns'], ['exp', 'Experiments']];
  const IN = { tab: 'week', example: false };
  // key, label, unit, better direction, decimals
  const M = [['ready', 'Readiness', '', 'up', 0], ['hrv', 'HRV', 'ms', 'up', 0], ['rhr', 'Resting heart rate', 'bpm', 'down', 0], ['sleepH', 'Sleep', 'h', 'up', 1], ['sleepQ', 'Sleep quality', '/5', 'up', 1],
    ['steps', 'Steps', '', 'up', 0], ['strain', 'Strain', '', null, 1], ['vol', 'Training volume', 'kg', null, 0], ['kcal', 'Calories', 'kcal', null, 0], ['prot', 'Protein', 'g', null, 0],
    ['heat', 'Heat exposure', 'min', null, 0], ['cold', 'Cold exposure', 'min', null, 0], ['mood', 'Mood', '/5', 'up', 1], ['energy', 'Energy', '/5', 'up', 1], ['stress', 'Stress', '/5', 'down', 1],
    ['sym', 'Symptoms logged', '', 'down', 0], ['score', 'Myo Score', '', 'up', 0], ['upf', 'Ultra-processed items', '', 'down', 0]];
  const lc = (t) => (/^Myo|^[A-Z]{2}/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1));
  const meta = (k) => M.find((m) => m[0] === k) || [k, k, '', null, 1];

  /* ── one row per day ── */
  function daily(s) {
    if (IN.example) return exampleDays();
    const D = {}, put = (d, k, v, add) => { if (!d || v == null || v === '' || !Number.isFinite(+v)) return; const r = (D[String(d).slice(0, 10)] = D[String(d).slice(0, 10)] || {}); r[k] = add && r[k] != null ? r[k] + +v : +v; };
    const W = s.wear || {};
    ['oura', 'whoop'].forEach((p) => ((W[p] && W[p].days) || []).forEach((x) => { put(x.d, 'hrv', x.hrv); put(x.d, 'rhr', x.rhr); put(x.d, 'sleepH', x.sleepH); put(x.d, 'ready', x.score); put(x.d, 'strain', x.strain); put(x.d, 'steps', x.steps); }));
    ((s.sleep && s.sleep.diary) || []).forEach((r) => { if (r.tst) put(r.d, 'sleepH', r.tst / 60); put(r.d, 'sleepQ', r.q); });
    Object.entries((s.life && s.life.mood) || {}).forEach(([d, m]) => { if (m) { put(d, 'mood', m.mood); put(d, 'energy', m.energy); put(d, 'stress', m.stress); } });
    Object.entries((s.nutrition && s.nutrition.meals) || {}).forEach(([d, ms]) => { (ms || []).forEach((m) => { put(d, 'kcal', m.kcal, true); put(d, 'prot', m.p, true); if (m.nova === 4) put(d, 'upf', 1, true); }); });
    ((s.training && s.training.log) || []).forEach((r) => put(r.date, 'vol', r.volume, true));
    const kinds = {}; ((OS.recovery && OS.recovery.MODS) || []).forEach((m) => { kinds[m.k] = m.kind; });
    ((s.recovery && s.recovery.logs) || []).forEach((r) => { const k = kinds[r.k] || (/sauna|bath|heat|infrared|hot/.test(r.k) ? 'heat' : /cold|plunge|cryo|shower|ice/.test(r.k) ? 'cold' : null); if (k === 'heat' || k === 'cold') put(r.d, k, r.min, true); });
    (s.symptoms || []).forEach((r) => put(r.at, 'sym', 1, true));
    (s.scoreLog || []).forEach((r) => put(r[0], 'score', r[1]));
    return D;
  }
  // 60 example days with known links: hard training lowers next-day HRV, more sleep lifts mood, stress costs sleep quality
  function exampleDays() {
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }, g = () => (rnd() + rnd() + rnd() - 1.5) / 0.5;
    const D = {}; let vPrev = 0;
    for (let i = 59; i >= 0; i--) {
      const d = dayKey(addDays(new Date(), -i)), vol = rnd() < 0.55 ? Math.round(6000 + 5000 * rnd()) : 0, stress = clamp(Math.round(2.6 + g() * 0.9), 1, 5), sleepH = +clamp(7.1 - 0.25 * (stress - 3) + g() * 0.45, 5, 9.2).toFixed(1);
      const hrv = Math.round(64 - vPrev / 900 + 3 * (sleepH - 7) + g() * 3), r = { vol, stress, sleepH, hrv, rhr: Math.round(55 + vPrev / 3000 - 0.08 * (hrv - 60) + g()), sleepQ: clamp(Math.round(3.6 - 0.45 * (stress - 3) + g() * 0.6), 1, 5), mood: clamp(Math.round(3.4 + 0.7 * (sleepH - 7) - 0.3 * (stress - 3) + g() * 0.6), 1, 5), kcal: Math.round(2500 + vol / 25 + g() * 180), prot: Math.round(150 + g() * 18) };
      r.energy = clamp(Math.round(r.mood + g() * 0.5), 1, 5); r.ready = clamp(Math.round(70 + (hrv - 62) * 1.2 - (r.rhr - 55) * 1.5), 30, 99);
      D[d] = r; vPrev = vol;
    }
    return D;
  }

  /* ── statistics ── */
  const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); };
  function ranks(a) { const o = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]), r = new Array(a.length); for (let i = 0; i < o.length;) { let j = i; while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++; const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[o[k][1]] = avg; i = j + 1; } return r; }
  function pearson(x, y) { const mx = mean(x), my = mean(y); let a = 0, b = 0, c = 0; for (let i = 0; i < x.length; i++) { const dx = x[i] - mx, dy = y[i] - my; a += dx * dy; b += dx * dx; c += dy * dy; } return b && c ? a / Math.sqrt(b * c) : 0; }
  const spearman = (x, y) => pearson(ranks(x), ranks(y));
  // two-sided p for a correlation, from the t distribution (normal approximation of t with a df correction)
  function pval(r, n) { if (n < 4 || Math.abs(r) >= 1) return 0; const t = Math.abs(r) * Math.sqrt((n - 2) / (1 - r * r)), z = t * (1 - 1 / (4 * (n - 2))) / Math.sqrt(1 + (t * t) / (2 * (n - 2))); return 2 * (1 - ncdf(z)); }
  function ncdf(z) { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp((-z * z) / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; }
  function pairs(D) {
    const days = Object.keys(D).sort(), keys = M.map((m) => m[0]).filter((k) => days.filter((d) => D[d][k] != null).length >= 14), out = [];
    keys.forEach((a, i) => keys.forEach((b, j) => {
      if (a === b) return;
      [0, 1].forEach((lag) => {
        if (lag === 0 && j <= i) return;
        const xs = [], ys = [];
        days.forEach((d) => { const d2 = lag ? dayKey(addDays(new Date(`${d}T12:00:00`), 1)) : d; if (D[d][a] != null && D[d2] && D[d2][b] != null) { xs.push(D[d][a]); ys.push(D[d2][b]); } });
        if (xs.length < 14 || sd(xs) === 0 || sd(ys) === 0) return;
        const r = spearman(xs, ys), p = pval(r, xs.length);
        if (Math.abs(r) >= 0.3 && p < 0.05) out.push({ a, b, lag, r, p, n: xs.length, xs, ys });
      });
    }));
    // keep the stronger of same-day or next-day for the same ordered pair
    const best = {}; out.forEach((x) => { const k = [x.a, x.b].sort().join('|'); if (!best[k] || Math.abs(x.r) > Math.abs(best[k].r)) best[k] = x; });
    return Object.values(best).sort((p, q) => Math.abs(q.r) - Math.abs(p.r)).slice(0, 8);
  }
  const strength = (r) => (Math.abs(r) >= 0.7 ? 'Strong' : Math.abs(r) >= 0.5 ? 'Moderate to strong' : 'Moderate');
  function bootCI(a, b, n = 2000) {
    let seed = 99; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }, out = [];
    for (let i = 0; i < n; i++) { let sa = 0, sb = 0; for (let k = 0; k < a.length; k++) sa += a[Math.floor(rnd() * a.length)]; for (let k = 0; k < b.length; k++) sb += b[Math.floor(rnd() * b.length)]; out.push(sb / b.length - sa / a.length); }
    out.sort((p, q) => p - q); return [out[Math.floor(n * 0.05)], out[Math.floor(n * 0.95)]];
  }
  function analyse(e, D) {
    const t0 = new Date(`${e.start}T12:00:00`), A = [], B = [];
    for (let i = 0; i < e.base + e.len; i++) { const d = dayKey(addDays(t0, i)), v = e.metric === 'rating' ? (e.ratings || {})[d] : D[d] && D[d][e.metric]; if (v == null) continue; (i < e.base ? A : B).push(+v); }
    const end = dayKey(addDays(t0, e.base + e.len - 1)), phase = dayKey(new Date()) < e.start ? 'Not started' : dayKey(new Date()) < dayKey(addDays(t0, e.base)) ? 'Baseline' : dayKey(new Date()) <= end ? 'Change' : 'Finished';
    if (A.length < 5 || B.length < 5) return { A, B, phase, end, ready: false };
    const diff = mean(B) - mean(A), pooled = Math.sqrt(((A.length - 1) * sd(A) ** 2 + (B.length - 1) * sd(B) ** 2) / (A.length + B.length - 2)) || 1, d = diff / pooled, ci = bootCI(A, B);
    return { A, B, phase, end, ready: true, diff, d, ci, clear: (ci[0] > 0 || ci[1] < 0) && Math.abs(d) >= 0.5 };
  }

  /* ── views ── */
  const fmtv = (k, v) => (v == null ? '—' : (Math.round(v * 10 ** meta(k)[4]) / 10 ** meta(k)[4]).toLocaleString());
  function weekTab(s) {
    const D = daily(s), wk = (o) => Array.from({ length: 7 }, (_, i) => dayKey(addDays(new Date(), -i - o))), cur = wk(0), prev = wk(7), last28 = Array.from({ length: 28 }, (_, i) => dayKey(addDays(new Date(), -27 + i)));
    const rows = M.map(([k]) => { const a = cur.map((d) => D[d] && D[d][k]).filter((v) => v != null), b = prev.map((d) => D[d] && D[d][k]).filter((v) => v != null), sp = last28.map((d) => D[d] && D[d][k]).filter((v) => v != null); return { k, a: a.length ? mean(a) : null, b: b.length ? mean(b) : null, n: a.length, sp }; }).filter((r) => r.a != null || r.b != null);
    if (!rows.length) return empty();
    return `<section class="card"><div class="card-h"><h2>This week against last week</h2><span class="muted small">Daily averages</span></div>
        <div class="tbl-wrap"><table class="tbl compact in-week"><caption class="sr">This week against last week</caption><thead><tr><th scope="col">Measure</th><th scope="col">This week</th><th scope="col">Last week</th><th scope="col">Change</th><th scope="col">4 weeks</th></tr></thead><tbody>
        ${rows.map((r) => { const m = meta(r.k), ch = r.a != null && r.b != null ? r.a - r.b : null, rel = ch != null && r.b ? Math.abs(ch / r.b) : 0, good = ch == null || !m[3] || rel < 0.03 ? null : (ch > 0) === (m[3] === 'up');
          return `<tr><th scope="row">${esc(m[1])}</th><td class="num">${fmtv(r.k, r.a)}${m[2] ? ` <span class="muted small">${esc(m[2])}</span>` : ''}</td><td class="num">${fmtv(r.k, r.b)}</td>
            <td>${ch == null ? '—' : `<span class="num">${ch > 0 ? '+' : ch < 0 ? '−' : ''}${fmtv(r.k, Math.abs(ch))}</span> ${good == null ? '' : pill(good ? 'good' : 'warn', good ? 'Better' : 'Worse')}`}</td><td>${r.sp.length > 1 ? spark(r.sp, 96, 24) : ''}</td></tr>`; }).join('')}</tbody></table></div>
        <p class="fine">"Better" and "Worse" appear only for measures with a clear direction and changes over 3%. Training, calories and exposure minutes have no good direction on their own.</p></section>`;
  }
  function empty() {
    return `<section class="card"><p class="small">Insights need a few weeks of daily data: connect a wearable, keep the sleep diary, check in your mood, or log meals and training.</p>
      <button class="btn ghost sm" data-act="in-example">${IN.example ? 'Close the example' : 'See an example with 60 days of data'}</button></section>`;
  }
  function scatter(p, W = 260) {
    const H = 170, L = 38, R = 8, T = 8, B = 30, xs = p.xs, ys = p.ys, x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const X = (v) => L + ((v - x0) / (x1 - x0 || 1)) * (W - L - R), Y = (v) => T + (1 - (v - y0) / (y1 - y0 || 1)) * (H - T - B), ma = meta(p.a), mb = meta(p.b);
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${ma[1]} against ${mb[1]}${p.lag ? ' the next day' : ''}`)}">
      <line class="bc-grid" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/><line class="bc-grid" x1="${L}" x2="${L}" y1="${T}" y2="${H - B}"/>
      <text class="bc-ax" x="${L - 4}" y="${T + 8}" text-anchor="end">${fmtv(p.b, y1)}</text><text class="bc-ax" x="${L - 4}" y="${H - B}" text-anchor="end">${fmtv(p.b, y0)}</text>
      <text class="bc-ax" x="${L}" y="${H - B + 13}">${fmtv(p.a, x0)}</text><text class="bc-ax" x="${W - R}" y="${H - B + 13}" text-anchor="end">${fmtv(p.a, x1)}</text>
      <text class="bc-ax" x="${(L + W - R) / 2}" y="${H - 3}" text-anchor="middle">${esc(ma[1])}${ma[2] ? ` (${esc(ma[2])})` : ''}</text>
      ${xs.map((v, i) => `<circle class="in-dot" cx="${X(v).toFixed(1)}" cy="${Y(ys[i]).toFixed(1)}" r="4"><title>${esc(ma[1])} ${fmtv(p.a, v)} · ${esc(mb[1])} ${fmtv(p.b, ys[i])}</title></circle>`).join('')}</svg>`;
  }
  function patTab(s) {
    const D = daily(s), P = pairs(D), n = Object.keys(D).length;
    if (n < 14) return empty();
    return `<section class="card"><div class="card-h"><h2>What moves together</h2><span class="muted small">${n} days of data</span></div>
        ${P.length ? `<div class="in-grid">${P.map((p) => { const ma = meta(p.a), mb = meta(p.b); return `<figure class="in-pair"><figcaption>When <b>${esc(lc(ma[1]))}</b> is higher, <b>${esc(lc(mb[1]))}</b> is ${p.r > 0 ? 'higher' : 'lower'}${p.lag ? ' <b>the next day</b>' : ''}
          <span class="small muted">${strength(p.r)} · ρ ${p.r.toFixed(2)} · ${p.n} days</span></figcaption>${scatter(p)}
          <button class="link small" data-act="in-try" data-a="${p.a}" data-b="${p.b}">Test it with an experiment</button></figure>`; }).join('')}</div>` : '<p class="small">No moderate or stronger links yet. That is useful too: what you track varies independently, or there isn\'t enough variation to see a link.</p>'}
        <p class="fine">Spearman rank correlation, same day or with the first measure one day earlier; only links with |ρ| ≥ 0.3 and p &lt; 0.05 are shown. Checking many pairs will turn up some chance links, and a link can come from a third factor. Test anything that matters with an experiment.</p></section>
      ${IN.example ? '<p class="small muted">Example data, not saved. <button class="link" data-act="in-example">Close the example</button></p>' : ''}`;
  }
  function expTab(s) {
    const D = daily(s), E = ((s.insights && s.insights.exps) || []).slice().reverse(), today = dayKey(new Date()), pre = IN.prefill || {};
    return `<section class="card"><div class="card-h"><h2>Start an experiment</h2></div>
        <form class="lb-grid" data-submit="in-new"><label class="lb-wide">What will you change?<input name="name" maxlength="80" required value="${esc(pre.name || '')}" placeholder="No caffeine after noon"></label>
          <label>Measure the effect on<select name="metric">${M.map((m) => `<option value="${m[0]}" ${pre.metric === m[0] ? 'selected' : ''}>${esc(m[1])}</option>`).join('')}<option value="rating">A 1–10 rating I enter</option></select></label>
          <label>Rating name (if you rate)<input name="rname" maxlength="30" placeholder="Focus"></label>
          <label>Start<input type="date" name="start" value="${today}" required></label><label>Baseline days<input type="number" name="base" min="5" max="60" value="14"></label><label>Change days<input type="number" name="len" min="5" max="60" value="14"></label>
          <div class="lb-wide"><button class="btn sm">${icon('plus', 14)} Start</button></div></form>
        <p class="fine">Live as normal during the baseline, then make the one change and keep everything else steady. Two weeks of each is a good minimum; longer is better for noisy measures such as HRV.</p></section>
      ${E.map((e) => { const R = analyse(e, D), m = e.metric === 'rating' ? ['rating', e.rname || 'Rating', '/10', 'up', 1] : meta(e.metric);
        return `<section class="card"><div class="card-h"><h2>${esc(e.name)}</h2>${pill(R.phase === 'Finished' ? 'good' : R.phase === 'Change' ? 'warn' : 'muted', R.phase)}</div>
          <p class="small muted">${esc(m[1])} · baseline from ${esc(fmtDate(e.start))} for ${e.base} days, then ${e.len} days of the change, ending ${esc(fmtDate(R.end))}</p>
          ${e.metric === 'rating' && R.phase !== 'Finished' && R.phase !== 'Not started' ? `<form class="row" data-submit="in-rate" data-id="${e.id}"><label>Today's ${esc(m[1].toLowerCase())}, 1–10 <input type="number" name="v" min="1" max="10" required value="${(e.ratings || {})[today] || ''}"></label><button class="btn sm">Save</button></form>` : ''}
          <div class="lb-tiles"><div><span>Baseline</span><b>${R.A.length ? fmtv(e.metric, mean(R.A)) : '—'}</b><em>${R.A.length} day${R.A.length === 1 ? '' : 's'} with data</em></div><div><span>With the change</span><b>${R.B.length ? fmtv(e.metric, mean(R.B)) : '—'}</b><em>${R.B.length} day${R.B.length === 1 ? '' : 's'} with data</em></div>
            <div><span>Difference</span><b>${R.ready ? `${R.diff > 0 ? '+' : R.diff < 0 ? '−' : ''}${fmtv(e.metric, Math.abs(R.diff))}` : '—'}</b><em>${R.ready ? `90% interval ${fmtv(e.metric, R.ci[0])} to ${fmtv(e.metric, R.ci[1])} · d ${R.d.toFixed(2)}` : 'Needs 5 days in each block'}</em></div></div>
          ${R.ready ? `<p class="small">${R.clear ? `<b>A clear change.</b> ${esc(m[1])} was ${R.diff > 0 ? 'higher' : 'lower'} during the change, by more than day-to-day noise.` : '<b>No clear change.</b> The difference is within day-to-day variation so far.'} One person's experiment can't rule out other things that changed at the same time.</p>` : ''}
          <button class="link small" data-act="in-del" data-id="${e.id}">Delete experiment</button></section>`; }).join('')}`;
  }

  OS.register('insights', {
    title: 'Insights', icon: 'insights',
    render(s) {
      const body = { week: weekTab, pat: patTab, exp: expTab }[IN.tab](s);
      return `${OS.ui.head('Every log, one table · on-device', 'Insights', 'See how your week compares, which of your measures move together, and run experiments on yourself to find what actually works for you.')}
        <div class="in bc fl"><div class="seg kt-tabs" role="tablist" aria-label="Insights">${TABS.map(([k, l]) => `<button role="tab" aria-selected="${IN.tab === k}" data-act="in-tab" data-t="${k}">${l}</button>`).join('')}</div>${body}
        ${IN.example && IN.tab === 'week' ? '<p class="small muted">Example data, not saved. <button class="link" data-act="in-example">Close the example</button></p>' : ''}</div>`;
    }
  });
  const save = (fn) => OS.update((s) => { s.insights = s.insights || {}; s.insights.exps = s.insights.exps || []; fn(s.insights); });
  OS.act('in-tab', (el) => { IN.tab = TABS.some(([k]) => k === el.dataset.t) ? el.dataset.t : 'week'; OS.render(); });
  OS.act('in-example', () => { IN.example = !IN.example; OS.render(); });
  OS.act('in-try', (el) => { IN.prefill = { metric: el.dataset.b, name: `Change my ${meta(el.dataset.a)[1].toLowerCase()}` }; IN.tab = 'exp'; OS.render(); });
  OS.act('in-new', (f) => {
    const E = f.elements, e = { id: uid(), name: E.name.value.trim(), metric: E.metric.value, rname: E.rname.value.trim(), start: E.start.value, base: clamp(+E.base.value || 14, 5, 60), len: clamp(+E.len.value || 14, 5, 60), ratings: {} };
    if (!e.name || !e.start) return; save((X) => { X.exps.push(e); }); IN.prefill = null;
    OS.logEvent('note', `Experiment started: ${e.name}`, `${e.base} baseline days, then ${e.len} days of the change`, { go: 'insights', src: 'manual' });
  });
  OS.act('in-rate', (f) => { const v = clamp(+f.elements.v.value, 1, 10), id = f.dataset.id; save((X) => { const e = X.exps.find((x) => x.id === id); if (e) { e.ratings = e.ratings || {}; e.ratings[dayKey(new Date())] = v; } }); OS.toast('Saved'); });
  OS.act('in-del', (el) => { if (!confirm('Delete this experiment and its ratings?')) return; save((X) => { X.exps = X.exps.filter((e) => e.id !== el.dataset.id); }); });
  OS.insights = { daily, pairs, spearman, pval, analyse, bootCI, M, state: IN, exampleDays,
    status(s) { const E = (s.insights && s.insights.exps) || [], live = E.filter((e) => analyse(e, {}).phase !== 'Finished').length; return live ? [`${live} experiment${live > 1 ? 's' : ''} running`, 'good'] : null; } };
})();
