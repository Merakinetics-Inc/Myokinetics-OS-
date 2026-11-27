/* ═══ MYO — CYCLE HEALTH: periods, cycle phases, symptoms, and the years around menopause ═══
   Calendar  · tap a day to log flow, symptoms and morning temperature; logged, predicted and estimated days shown
   Cycle     · today's cycle day and phase; next period from your own average and spread; an ovulation estimate
               (next period − 14 days) and the six-day fertile window around it
   History   · cycle and period lengths, and which symptoms cluster in which phase
   Life stage· perimenopause and menopause symptoms and education
   Calendar estimates are not contraception and can't confirm ovulation. Myo doesn't diagnose or advise on hormones or
   medicines; red flags send you to a clinician. Data stays on this device. */
(function () {
  'use strict';
  const { esc, icon, pill, clamp, dayKey, addDays, fmtDate } = OS;
  const TABS = [['cal', 'Calendar'], ['now', 'This cycle'], ['hist', 'History'], ['stage', 'Life stage'], ['care', 'When to get help']];
  const CY = { tab: 'now', sel: null, month: null, example: false };
  const FLOW = ['None', 'Spotting', 'Light', 'Medium', 'Heavy'];
  const SYMS = ['Cramps', 'Headache', 'Bloating', 'Breast tenderness', 'Acne', 'Tiredness', 'Low mood', 'Anxiety', 'Irritability', 'Cravings', 'Back pain', 'Nausea', 'Poor sleep', 'Hot flush', 'Night sweats', 'Brain fog', 'Joint aches', 'Vaginal dryness'];
  const DAY = 864e5, ms = (d) => new Date(`${d}T12:00:00`).getTime(), dd = (a, b) => Math.round((ms(b) - ms(a)) / DAY);

  function example() {
    const days = {}, lens = [29, 27, 30, 28, 31, 28]; let start = addDays(new Date(), -lens.reduce((a, b) => a + b, 0) - 9);
    lens.forEach((L, c) => { [4, 4, 3, 2, 1].forEach((f, i) => { days[dayKey(addDays(start, i))] = { flow: f, sym: i < 2 ? ['Cramps', ...(c % 2 ? ['Tiredness'] : [])] : [] }; }); [-3, -2, -1].forEach((k) => { const d = dayKey(addDays(start, L + k)); days[d] = { flow: 0, sym: ['Bloating', ...(k === -1 ? ['Breast tenderness', 'Low mood'] : [])] }; }); start = addDays(start, L); });
    [4, 4, 3, 2, 1].forEach((f, i) => { days[dayKey(addDays(start, i))] = { flow: f, sym: i === 0 ? ['Cramps'] : [] }; });
    return { days, stage: 'cycling', example: true };
  }
  const C = (s) => (CY.example ? example() : s.cycle || { days: {}, stage: 'cycling' });

  function model(c) {
    const fd = Object.keys(c.days || {}).filter((d) => (c.days[d].flow || 0) >= 2).sort(), periods = [];
    fd.forEach((d) => { const p = periods[periods.length - 1]; if (p && dd(p.end, d) <= 2) p.end = d; else periods.push({ start: d, end: d }); });
    periods.forEach((p) => { p.len = dd(p.start, p.end) + 1; });
    const cycles = []; for (let i = 1; i < periods.length; i++) { const L = dd(periods[i - 1].start, periods[i].start); if (L >= 15 && L <= 60) cycles.push({ start: periods[i - 1].start, len: L }); }
    const recent = cycles.slice(-6).map((x) => x.len), avg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 28, sdv = recent.length > 1 ? Math.sqrt(recent.reduce((a, b) => a + (b - avg) ** 2, 0) / (recent.length - 1)) : 3;
    const plen = periods.slice(-6).map((p) => p.len), pavg = plen.length ? plen.reduce((a, b) => a + b, 0) / plen.length : 5;
    const last = periods[periods.length - 1], today = dayKey(new Date());
    if (!last) return { periods, cycles, avg, sdv, pavg, known: recent.length };
    const next = dayKey(addDays(new Date(`${last.start}T12:00:00`), Math.round(avg))), win = Math.max(2, Math.round(sdv)), ov = dayKey(addDays(new Date(`${next}T12:00:00`), -14));
    const fert = [dayKey(addDays(new Date(`${ov}T12:00:00`), -5)), dayKey(addDays(new Date(`${ov}T12:00:00`), 1))], cd = dd(last.start, today) + 1;
    const phase = today <= last.end || cd <= Math.round(pavg) ? 'menstrual' : today >= fert[0] && today <= fert[1] ? 'ovulatory' : today < fert[0] ? 'follicular' : cd > avg + 7 ? 'late' : 'luteal';
    return { periods, cycles, avg, sdv, pavg, known: recent.length, last, next, win, ov, fert, cd, phase };
  }
  const PHASE = {
    menstrual: ['Period', 'Oestrogen and progesterone are at their lowest. Cramps come from prostaglandins making the uterus contract; heat, movement and anti-inflammatory painkillers (as the pack says) help many people.'],
    follicular: ['Follicular phase', 'Oestrogen rises as an egg matures. Many people feel energy and mood lift.'],
    ovulatory: ['Fertile window (estimate)', 'A surge of LH releases the egg. Fertility is highest in the five days before ovulation and the day of it. Morning temperature rises about 0.3–0.5 °C after ovulation.'],
    luteal: ['Luteal phase', 'Progesterone rises, warming the body slightly. In the last days before a period, bloating, breast tenderness, sleep changes and mood dips are common.'],
    late: ['Period later than usual', 'Stress, illness, travel, weight change and hard training can delay a period. If you could be pregnant, take a pregnancy test.']
  };

  /* ── views ── */
  function calTab(s) {
    const c = C(s), M = model(c), base = CY.month ? new Date(`${CY.month}-01T12:00:00`) : new Date(), y = base.getFullYear(), mo = base.getMonth(), first = new Date(y, mo, 1), startDow = (first.getDay() + 6) % 7, nDays = new Date(y, mo + 1, 0).getDate(), today = dayKey(new Date());
    const pred = new Set(), fert = new Set();
    if (M.next) for (let k = 0; k < 3; k++) { const st = addDays(new Date(`${M.next}T12:00:00`), Math.round(M.avg) * k); for (let i = 0; i < Math.round(M.pavg); i++) pred.add(dayKey(addDays(st, i))); if (k === 0) for (let d = new Date(`${M.fert[0]}T12:00:00`); dayKey(d) <= M.fert[1]; d = addDays(d, 1)) fert.add(dayKey(d)); }
    const cells = []; for (let i = 0; i < startDow; i++) cells.push('<li class="cy-pad" aria-hidden="true"></li>');
    for (let i = 1; i <= nDays; i++) { const d = dayKey(new Date(y, mo, i)), r = (c.days || {})[d] || {}, f = r.flow || 0, cls = [f ? `cy-f${f}` : '', !f && pred.has(d) && d > today ? 'cy-pred' : '', fert.has(d) ? 'cy-fert' : '', d === today ? 'cy-today' : '', CY.sel === d ? 'cy-sel' : ''].filter(Boolean).join(' ');
      cells.push(`<li><button class="${cls}" data-act="cy-day" data-d="${d}" aria-label="${esc(fmtDate(d))}${f ? `, ${FLOW[f].toLowerCase()} flow` : ''}${!f && pred.has(d) && d > today ? ', predicted period' : ''}${fert.has(d) ? ', estimated fertile window' : ''}${(r.sym || []).length ? `, ${r.sym.length} symptoms` : ''}">${i}${(r.sym || []).length ? '<i class="cy-sym" aria-hidden="true"></i>' : ''}</button></li>`); }
    const sel = CY.sel && ((c.days || {})[CY.sel] || {});
    const prevM = dayKey(new Date(y, mo - 1, 1)).slice(0, 7), nextM = dayKey(new Date(y, mo + 1, 1)).slice(0, 7);
    return `<section class="card"><div class="card-h"><h2>${first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2><div class="row"><button class="btn ghost sm" data-act="cy-month" data-m="${prevM}" aria-label="Previous month">‹</button><button class="btn ghost sm" data-act="cy-month" data-m="${nextM}" aria-label="Next month">›</button></div></div>
        <ol class="cy-week" aria-hidden="true">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<li>${d}</li>`).join('')}</ol><ol class="cy-grid">${cells.join('')}</ol>
        <ul class="bc-leg"><li><i class="bc-sw cy-sw-f"></i>Period</li><li><i class="bc-sw cy-sw-pred"></i>Predicted</li><li><i class="bc-sw cy-sw-fert"></i>Fertile window (estimate)</li><li><i class="bc-sw cy-sw-sym"></i>Symptoms logged</li></ul></section>
      ${CY.sel ? `<section class="card"><div class="card-h"><h2>${esc(fmtDate(CY.sel))}</h2>${CY.example ? pill('muted', 'Example') : ''}</div>
        <fieldset class="cy-flow"><legend>Flow</legend>${FLOW.map((l, i) => `<button class="chip-btn ${(sel.flow || 0) === i ? 'on' : ''}" aria-pressed="${(sel.flow || 0) === i}" data-act="cy-flow" data-v="${i}">${l}</button>`).join('')}</fieldset>
        <fieldset class="cy-flow"><legend>Symptoms</legend>${SYMS.map((l) => `<button class="chip-btn ${(sel.sym || []).includes(l) ? 'on' : ''}" aria-pressed="${(sel.sym || []).includes(l)}" data-act="cy-sym" data-v="${esc(l)}">${esc(l)}</button>`).join('')}</fieldset>
        <form class="row" data-submit="cy-bbt"><label>Morning temperature (°C) <input name="t" type="number" min="34" max="39" step="0.01" value="${sel.bbt || ''}"></label><button class="btn ghost sm">Save</button></form></section>` : '<p class="small muted">Tap a day to log your period, symptoms or morning temperature.</p>'}`;
  }
  function nowTab(s) {
    const c = C(s), M = model(c), preg = s.pregnancy && (s.pregnancy.lmp || s.pregnancy.edd || s.pregnancy.dating) && !CY.example;
    if (!M.last) return `<section class="card"><div class="card-h"><h2>Start tracking</h2></div><p class="small">Log the first day of your last period to begin. Predictions improve after two or three cycles.</p>
        <form class="row" data-submit="cy-start"><label>First day of your last period <input type="date" name="d" max="${dayKey(new Date())}" required></label><button class="btn sm">Start</button></form>
        <button class="btn ghost sm" data-act="cy-example">See an example</button></section>`;
    const P = PHASE[M.phase], toNext = dd(dayKey(new Date()), M.next);
    return `${preg ? '<div class="banner" role="note">Pregnancy tracking is on, so period predictions are paused. Your dates are on the <a href="#pregnancy">Pregnancy</a> page.</div>' : ''}
      <section class="card"><div class="card-h"><h2>Day ${M.cd}</h2>${pill(M.phase === 'late' ? 'warn' : 'muted', P[0])}</div>
        <div class="cy-bar" role="img" aria-label="Cycle day ${M.cd} of about ${Math.round(M.avg)}">${(() => { const L = Math.max(Math.round(M.avg), M.cd), seg = (a, b, cls) => `<i class="${cls}" style="left:${((a - 1) / L) * 100}%;width:${((b - a + 1) / L) * 100}%"></i>`, fo = dd(M.last.start, M.fert[0]) + 1, fe = dd(M.last.start, M.fert[1]) + 1;
          return `${seg(1, Math.round(M.pavg), 'cy-b-p')}${seg(fo, fe, 'cy-b-f')}<b style="left:${((M.cd - 0.5) / L) * 100}%"></b>`; })()}</div>
        <div class="lb-tiles">${[['Next period', M.phase === 'late' ? 'Late' : fmtDate(M.next), M.phase === 'late' ? `day ${M.cd}` : `${toNext >= 0 ? `in ${toNext} days` : ''} · ±${M.win}`], ['Average cycle', Math.round(M.avg), `days · ${M.known} cycle${M.known === 1 ? '' : 's'} logged`], ['Average period', Math.round(M.pavg), 'days'], ['Ovulation estimate', fmtDate(M.ov), 'next period − 14 days']].map(([l, v, u]) => `<div><span>${l}</span><b>${esc(String(v))}</b><em>${esc(u)}</em></div>`).join('')}</div>
        <p class="small">${esc(P[1])}</p>
        <p class="fine">Predictions use your last ${Math.max(1, M.known)} cycle${M.known === 1 ? '' : 's'}. They are not contraception: calendar estimates can't tell when you ovulate. If avoiding or planning pregnancy matters, talk to a clinician about reliable methods.</p></section>
      <section class="card"><div class="card-h"><h2>Training and food through the cycle</h2></div><ul class="small bc-ref">
        <li>Studies find, at most, small and inconsistent differences in strength or endurance across the cycle. Train by how you feel rather than a phase plan.</li>
        <li>Heavy periods drain iron. Eat iron-rich foods and ask for a ferritin test if you are tired, breathless or training feels harder than it should; ferritin is in <a href="#biology">Biology</a>.</li>
        <li>Sleep and heat tolerance can dip before a period, when body temperature runs higher. Keep a cool bedroom.</li>
        <li>Link your symptoms to sleep, mood and readiness in <a href="#insights">Insights</a>.</li></ul></section>
      ${CY.example ? '<p class="small muted">Example data, not saved. <button class="link" data-act="cy-example">Close the example</button></p>' : ''}`;
  }
  function histTab(s) {
    const c = C(s), M = model(c), cyc = M.cycles.slice(-12).reverse(), mx = Math.max(40, ...cyc.map((x) => x.len));
    const by = { menstrual: {}, follicular: {}, luteal: {} }, tot = { menstrual: 0, follicular: 0, luteal: 0 };
    M.cycles.forEach((cy) => { for (let i = 0; i < cy.len; i++) { const d = dayKey(addDays(new Date(`${cy.start}T12:00:00`), i)), r = (c.days || {})[d], ph = i < Math.round(M.pavg) ? 'menstrual' : i >= cy.len - 14 ? 'luteal' : 'follicular'; tot[ph]++; ((r && r.sym) || []).forEach((x) => { by[ph][x] = (by[ph][x] || 0) + 1; }); } });
    const symList = [...new Set(Object.values(by).flatMap((o) => Object.keys(o)))].sort((a, b) => Object.values(by).reduce((t, o) => t + (o[b] || 0), 0) - Object.values(by).reduce((t, o) => t + (o[a] || 0), 0)).slice(0, 8);
    return `<section class="card"><div class="card-h"><h2>Cycle lengths</h2><span class="muted small">Most recent first</span></div>
        ${cyc.length ? `<ul class="fl-bars cy-bars" aria-label="Cycle lengths">${cyc.map((x) => `<li><span>${esc(fmtDate(x.start))}</span><i class="fl-track"><i style="width:${((x.len / mx) * 100).toFixed(1)}%"></i></i><b class="num">${x.len} d</b></li>`).join('')}</ul>
          <p class="small">Average ${Math.round(M.avg)} days, varying by about ±${Math.round(M.sdv)}. ${M.sdv > 7 ? 'Cycle lengths vary by more than a week: worth mentioning to a clinician.' : 'Most adult cycles are 21–35 days, and a few days of variation is normal.'}</p>` : '<p class="small muted">Log two periods to see cycle lengths.</p>'}</section>
      <section class="card"><div class="card-h"><h2>Symptoms by phase</h2><span class="muted small">Share of days with the symptom</span></div>
        ${symList.length ? `<div class="tbl-wrap"><table class="tbl compact"><caption class="sr">Symptoms by phase</caption><thead><tr><th scope="col">Symptom</th><th scope="col">Period</th><th scope="col">Follicular</th><th scope="col">Luteal</th></tr></thead><tbody>${symList.map((x) => `<tr><th scope="row">${esc(x)}</th>${['menstrual', 'follicular', 'luteal'].map((p) => `<td class="num">${tot[p] ? Math.round(((by[p][x] || 0) / tot[p]) * 100) : 0}%</td>`).join('')}</tr>`).join('')}</tbody></table></div>
          <p class="fine">Luteal days are counted as the last 14 of each cycle. Symptoms that cluster before periods and lift once they start are typical of PMS; if they disrupt life, a clinician can help.</p>` : '<p class="small muted">Log symptoms on the calendar to see patterns.</p>'}</section>`;
  }
  function stageTab(s) {
    const c = C(s), st = c.stage || 'cycling', since = dayKey(addDays(new Date(), -27)), V = ['Hot flush', 'Night sweats', 'Poor sleep', 'Low mood', 'Anxiety', 'Brain fog', 'Joint aches', 'Vaginal dryness'];
    const cnt = Object.fromEntries(V.map((v) => [v, Object.entries(c.days || {}).filter(([d, r]) => d >= since && (r.sym || []).includes(v)).length]));
    return `<section class="card"><div class="card-h"><h2>Your life stage</h2></div>
        <div class="seg kt-tabs" role="group" aria-label="Life stage">${[['cycling', 'Regular cycles'], ['peri', 'Perimenopause'], ['post', 'After menopause']].map(([k, l]) => `<button aria-pressed="${st === k}" data-act="cy-stage" data-k="${k}">${l}</button>`).join('')}</div>
        <p class="small">${st === 'cycling' ? 'Perimenopause usually starts in the 40s: cycles become irregular and symptoms such as hot flushes and poor sleep appear.' : st === 'peri' ? 'In perimenopause, hormones swing and cycles change length. Menopause is confirmed after 12 months without a period; the average age is about 51.' : 'After menopause, any bleeding from the vagina needs checking by a doctor promptly.'}</p></section>
      <section class="card"><div class="card-h"><h2>Last 4 weeks</h2><span class="muted small">Days with each symptom</span></div>
        <ul class="fl-bars" aria-label="Menopause-related symptoms in the last 4 weeks">${V.map((v) => `<li><span>${esc(v)}</span><i class="fl-track"><i style="width:${((cnt[v] / 28) * 100).toFixed(1)}%"></i></i><b class="num">${cnt[v]}</b></li>`).join('')}</ul>
        <p class="fine">Log these on the calendar. A record like this makes an appointment much more useful.</p></section>
      <section class="card"><div class="card-h"><h2>What helps</h2></div><ul class="small bc-ref">
        <li><b>Strength training</b> protects bone and muscle, which fall faster after menopause. See <a href="#training">Training</a> and bone density in <a href="#bodycomp">Body composition</a>.</li>
        <li><b>Sleep:</b> a cool bedroom, layers you can shed, and regular hours help with night sweats.</li>
        <li><b>Treatment:</b> hormone therapy and non-hormonal medicines work well for many people. Whether they suit you is a conversation with your clinician; Myo doesn't advise on them.</li>
        <li><b>Heart health</b> risk rises after menopause: keep an eye on blood pressure, lipids and ApoB in <a href="#biology">Biology</a>.</li></ul></section>`;
  }
  function careTab() {
    const RED = [['Now', ['Severe pain in the lower tummy, especially on one side, with a positive pregnancy test or a missed period', 'Heavy bleeding with dizziness or fainting', 'Fever with pelvic pain or unusual discharge']], ['Soon', ['Soaking a pad or tampon every hour for several hours, or passing clots larger than a coin', 'Periods lasting more than 7 days', 'Bleeding between periods or after sex', 'Any bleeding after menopause', 'Cycles regularly shorter than 21 or longer than 35 days', 'No period for 3 months (and not pregnant)', 'Period pain that stops you doing normal things', 'PMS symptoms that disrupt work, relationships or bring thoughts of self-harm']]];
    return `${RED.map(([w, xs]) => `<section class="card"><div class="card-h"><h2>${w === 'Now' ? 'Get urgent care now' : 'See a clinician soon'}</h2>${w === 'Now' ? '<a class="btn sm" href="#emergency">Emergency</a>' : ''}</div><ul class="small bc-ref">${xs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>`).join('')}
      <p class="fine">These can have many causes, often simple to treat. Myo can't tell which; a clinician can. Take your calendar and history to the appointment.</p>`;
  }

  OS.register('cycle', {
    title: 'Cycle health', icon: 'cycle',
    render(s) {
      const body = { cal: calTab, now: nowTab, hist: histTab, stage: stageTab, care: careTab }[CY.tab](s);
      return `${OS.ui.head('Periods · phases · menopause · on-device', 'Cycle health', 'Track your period and symptoms, see where you are in your cycle and what comes next, and follow the changes around menopause.')}
        <div class="cy bc fl"><div class="seg kt-tabs" role="tablist" aria-label="Cycle health">${TABS.map(([k, l]) => `<button role="tab" aria-selected="${CY.tab === k}" data-act="cy-tab" data-t="${k}">${l}</button>`).join('')}</div>${body}</div>`;
    }
  });
  const save = (fn) => { if (CY.example) { OS.toast('This is an example; close it to log your own'); return; } OS.update((s) => { s.cycle = s.cycle || { days: {}, stage: 'cycling' }; s.cycle.days = s.cycle.days || {}; fn(s.cycle); }); };
  const day = (X, d) => (X.days[d] = X.days[d] || { flow: 0, sym: [] });
  const tidy = (X, d) => { const r = X.days[d]; if (r && !r.flow && !(r.sym || []).length && !r.bbt) delete X.days[d]; };
  OS.act('cy-tab', (el) => { CY.tab = TABS.some(([k]) => k === el.dataset.t) ? el.dataset.t : 'now'; OS.render(); });
  OS.act('cy-example', () => { CY.example = !CY.example; CY.sel = null; OS.render(); });
  OS.act('cy-month', (el) => { CY.month = el.dataset.m; OS.render(); });
  OS.act('cy-day', (el) => { CY.sel = CY.sel === el.dataset.d ? null : el.dataset.d; OS.render(); });
  OS.act('cy-flow', (el) => { const d = CY.sel; if (!d) return; save((X) => { day(X, d).flow = +el.dataset.v; tidy(X, d); }); });
  OS.act('cy-sym', (el) => { const d = CY.sel, v = el.dataset.v; if (!d) return; save((X) => { const r = day(X, d); r.sym = (r.sym || []).includes(v) ? r.sym.filter((x) => x !== v) : [...(r.sym || []), v]; tidy(X, d); }); });
  OS.act('cy-bbt', (f) => { const d = CY.sel, t = +f.elements.t.value; if (!d) return; save((X) => { const r = day(X, d); if (t >= 34 && t <= 39) r.bbt = t; else delete r.bbt; tidy(X, d); }); });
  OS.act('cy-start', (f) => { const d = f.elements.d.value; if (!d) return; CY.example = false; save((X) => { [3, 3, 2, 2, 1].forEach((fl, i) => { const k = dayKey(addDays(new Date(`${d}T12:00:00`), i)); if (k <= dayKey(new Date())) day(X, k).flow = fl; }); }); OS.toast('Started. Adjust the days on the calendar if needed'); });
  OS.act('cy-stage', (el) => save((X) => { X.stage = el.dataset.k; }));
  OS.cycle = { model, example, state: CY, status(s) { const c = s.cycle; if (!c || !Object.keys(c.days || {}).length) return null; const M = model(c); return M.last ? [`Day ${M.cd} · ${PHASE[M.phase][0].toLowerCase()}`, M.phase === 'late' ? 'warn' : 'muted'] : null; } };
})();
