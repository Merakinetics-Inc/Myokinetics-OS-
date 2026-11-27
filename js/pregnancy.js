/* ═══ MYO — PREGNANCY: dates, scans, growth and the live ultrasound viewer, with red flags first ═══
   Dates    · gestational age and due date from the first day of the last period (EDD = LMP + 280 days), a due date
              the maternity team gave, or a dating scan's crown-rump length (Robinson: GA days = 8.052·√CRL mm + 23.73)
   Scans    · CRL, BPD, HC, AC, FL and the report's weight estimate, typed in or sent from the live ultrasound viewer;
              estimated fetal weight by Hadlock (HC, AC, FL in cm):
              log10 EFW = 1.326 − 0.00326·AC·FL + 0.0107·HC + 0.0438·AC + 0.158·FL
   Growth   · estimated weight against Hadlock's 1991 in-utero curve, ln EFW = 0.578 + 0.332·GA − 0.00354·GA²,
              with the 10th–90th percentile band (SD 12.7%)
   Care     · red flags, baby's movements (call the maternity unit; never a home Doppler), a typical schedule
   Myo does not diagnose, interpret scans or monitor the baby's heart. The maternity team's report wins every time. */
(function () {
  'use strict';
  const { esc, icon, pill, clamp, dayKey, addDays, fmtDate } = OS;
  const TABS = [['week', 'This week'], ['scans', 'Scans'], ['growth', 'Growth'], ['live', 'Live ultrasound'], ['care', 'Care and red flags']];
  const PG = { tab: 'week', example: false };
  const DAY = 864e5;
  const MEAS = [['crl', 'CRL', 'Crown-rump length'], ['bpd', 'BPD', 'Biparietal diameter'], ['hc', 'HC', 'Head circumference'], ['ac', 'AC', 'Abdominal circumference'], ['fl', 'FL', 'Femur length']];

  /* ── formulas ── */
  const crlToDays = (crl) => 8.052 * Math.sqrt(crl) + 23.73;
  const daysToCrl = (d) => ((d - 23.73) / 8.052) ** 2;
  const hadlock = (hc, ac, fl) => (hc > 0 && ac > 0 && fl > 0 ? 10 ** (1.326 - 0.00326 * (ac / 10) * (fl / 10) + 0.0107 * (hc / 10) + 0.0438 * (ac / 10) + 0.158 * (fl / 10)) : null);   // mm in, grams out
  const median = (wk) => Math.exp(0.578 + 0.332 * wk - 0.00354 * wk * wk);
  const SD = 0.127;
  const ncdf = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp((-z * z) / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
  const pctile = (efw, wk) => Math.round(clamp(ncdf((efw / median(wk) - 1) / SD) * 100, 1, 99));
  const ms = (d) => new Date(`${d}T12:00:00`).getTime();
  const ord = (n) => `${n}${[11, 12, 13].includes(n % 100) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;

  // the dating basis, most reliable first: a dating scan, a due date the team gave, the last period
  function dating(P) {
    if (!P) return null;
    if (P.dating && P.dating.date && +P.dating.crl >= 3 && +P.dating.crl <= 95) { const at = crlToDays(+P.dating.crl); return { lmp: ms(P.dating.date) - at * DAY, basis: `Dating scan on ${fmtDate(P.dating.date)} (CRL ${P.dating.crl} mm)` }; }
    if (P.edd) return { lmp: ms(P.edd) - 280 * DAY, basis: 'Due date from your maternity team' };
    if (P.lmp) return { lmp: ms(P.lmp), basis: 'First day of your last period' };
    return null;
  }
  function gaOn(P, d) { const D = dating(P); if (!D) return null; return Math.round(((d ? ms(d) : Date.now()) - D.lmp) / DAY); }
  const wd = (days) => `${Math.floor(days / 7)}w ${days % 7}d`;
  const efwOf = (x) => (+x.efw > 0 ? +x.efw : hadlock(+x.hc, +x.ac, +x.fl));

  /* ── an example, shown on request and never saved ── */
  function example() {
    const today = new Date(), lmp = dayKey(addDays(today, -(27 * 7 + 3)));
    const at = (wk) => dayKey(addDays(new Date(`${lmp}T12:00:00`), Math.round(wk * 7)));
    return { lmp, dating: { date: at(12.4), crl: 62 }, scans: [{ d: at(12.4), crl: 62, src: 'manual' }, { d: at(20.3), bpd: 48, hc: 178, ac: 154, fl: 33, src: 'manual' }, { d: at(26.1), bpd: 66, hc: 243, ac: 219, fl: 49, src: 'manual' }], moves: {}, example: true };
  }
  const preg = (s) => (PG.example ? example() : s.pregnancy && (s.pregnancy.lmp || s.pregnancy.edd || s.pregnancy.dating) ? s.pregnancy : null);

  /* ── week by week (education) ── */
  const WEEKS = [
    [4, 'The embryo implants. The neural tube, which becomes the brain and spinal cord, starts to form.'],
    [6, 'The heart tube has started beating. Buds for arms and legs appear.'],
    [8, 'Every major organ has started forming. Fingers and toes are separating.'],
    [10, 'The embryonic period ends and the fetal period begins: growth and maturing from here on.'],
    [12, 'Kidneys start making urine. The face has its profile. This is around the usual dating scan.'],
    [16, 'Bones are hardening. Many people feel the first flutters between 16 and 22 weeks.'],
    [20, 'Around the anomaly scan. Hearing is developing; the baby swallows and practises breathing movements.'],
    [24, 'The lungs start making surfactant. Movements are stronger and form a pattern you can learn.'],
    [28, 'Eyes open. The brain grows fast; fat builds under the skin.'],
    [32, 'Bones are fully formed but soft. Most babies settle head-down over the coming weeks.'],
    [37, 'Full term begins. The lungs and brain keep maturing until birth.'],
    [40, 'The due date. Only a small share of babies arrive on it; 37 to 42 weeks is normal.']
  ];
  function weekCard(days) {
    const wk = days / 7, i = Math.max(0, WEEKS.findIndex((w, j) => wk >= w[0] && (j === WEEKS.length - 1 || wk < WEEKS[j + 1][0]))), row = WEEKS[i];
    const size = wk >= 7 && wk < 14 ? `About ${Math.round(daysToCrl(days))} mm crown to rump (Robinson median)` : wk >= 20 && wk <= 42 ? `About ${Math.round(median(wk) / 10) * 10} g (Hadlock median)` : '';
    return `<section class="card"><div class="card-h"><h2>Week ${Math.floor(wk)}</h2>${size ? `<span class="muted small">${size}</span>` : ''}</div><p>${esc(row[1])}</p>
      <a class="btn ghost sm" href="#atlas">${icon('atlas', 14)} Embryo to adult in the Body atlas</a></section>`;
  }

  function setupCard(s) {
    const P = s.pregnancy || {};
    return `<section class="card"><div class="card-h"><h2>Start tracking a pregnancy</h2></div>
      <p class="small">Fill in one. A dating scan is the most accurate; Myo uses it over the other two when you add it.</p>
      <form data-submit="pg-setup" class="lb-grid">
        <label>First day of the last period<input type="date" name="lmp" value="${esc(P.lmp || '')}" max="${dayKey(new Date())}"></label>
        <label>Or the due date you were given<input type="date" name="edd" value="${esc(P.edd || '')}"></label>
        <label>Or a dating scan: date<input type="date" name="dd" max="${dayKey(new Date())}"></label>
        <label>and its CRL (mm)<input type="number" name="crl" min="3" max="95" step="0.1" inputmode="decimal"></label>
        <div class="lb-wide"><button class="btn sm">Start</button> <button type="button" class="btn ghost sm" data-act="pg-example">See an example</button></div>
      </form><p class="fine">Pregnancy data stays on this device with the rest of Myo. You can remove it at any time from Care and red flags.</p></section>`;
  }

  function weekTab(s, P) {
    if (!P) return setupCard(s);
    const D = dating(P), ga = gaOn(P), edd = dayKey(new Date(D.lmp + 280 * DAY)), left = Math.round((ms(edd) - Date.now()) / DAY);
    const tri = ga < 14 * 7 ? 'First trimester' : ga < 28 * 7 ? 'Second trimester' : 'Third trimester', pct = clamp((ga / 280) * 100, 0, 100);
    const mv = P.moves && P.moves[dayKey(new Date())];
    return `<section class="card pg-now"><div class="card-h"><h2>${ga >= 0 ? wd(ga) : 'Not started'}</h2><span class="muted small">${tri}</span></div>
        <div class="pg-track" role="img" aria-label="${Math.round(pct)}% of 40 weeks"><i style="width:${pct.toFixed(1)}%"></i><b style="left:${((14 / 40) * 100).toFixed(1)}%"></b><b style="left:${((28 / 40) * 100).toFixed(1)}%"></b></div>
        <div class="pg-tri small muted"><span>1st</span><span>2nd</span><span>3rd</span></div>
        <div class="lb-tiles">${[['Due date', fmtDate(edd), ''], ['To go', left >= 0 ? left : 0, left >= 0 ? 'days' : 'past the due date'], ['Weeks', Math.floor(ga / 7), `and ${ga % 7} days`]].map(([l, v, u]) => `<div><span>${l}</span><b>${esc(String(v))}</b><em>${esc(u)}</em></div>`).join('')}</div>
        <p class="fine">Dated by: ${esc(D.basis)}. Your maternity team's dates take priority if they differ.</p></section>
      ${ga >= 24 * 7 ? `<section class="card"><div class="card-h"><h2>Baby's movements today</h2></div>
        <p class="small">Get to know your baby's usual pattern. There is no set number of kicks to count.</p>
        <div class="st-go"><button class="btn ghost sm ${mv === 'usual' ? 'on' : ''}" data-act="pg-move" data-v="usual">Moving as usual</button><button class="btn ghost sm ${mv === 'less' ? 'on' : ''}" data-act="pg-move" data-v="less">Less than usual, or changed</button></div>
        ${mv === 'less' ? `<div class="banner bad" role="alert"><b>Contact your maternity unit or labour ward now</b>, day or night. Don't wait until tomorrow, and don't use a home heartbeat monitor or app to reassure yourself: hearing a heartbeat does not mean the baby is well.</div>` : ''}</section>` : ''}
      ${weekCard(Math.max(28, ga))}
      ${PG.example ? '<p class="small muted">This is an example and is not saved. <button class="link" data-act="pg-example">Close the example</button></p>' : ''}`;
  }

  function scansTab(s, P) {
    if (!P) return setupCard(s);
    const rows = (P.scans || []).slice().sort((a, b) => a.d.localeCompare(b.d));
    return `<section class="card"><div class="card-h"><h2>Add a scan</h2><span class="muted small">From your scan report, in mm</span></div>
        <form data-submit="pg-scan" class="lb-grid pg-form">
          <label>Date<input type="date" name="d" required value="${dayKey(new Date())}" max="${dayKey(new Date())}"></label>
          ${MEAS.map(([k, l, n]) => `<label title="${n}">${l} <span class="muted">${n}</span><input type="number" name="${k}" min="1" max="${k === 'hc' || k === 'ac' ? 450 : 120}" step="0.1" inputmode="decimal"></label>`).join('')}
          <label>Estimated weight on the report (g)<input type="number" name="efw" min="10" max="6000" step="1" inputmode="numeric"></label>
          <label class="lb-wide">Note (optional)<input name="note" maxlength="160" placeholder="Hospital, sonographer's comments"></label>
          <div class="lb-wide"><button class="btn sm" ${PG.example ? 'disabled' : ''}>${icon('plus', 14)} Save scan</button></div></form></section>
      <section class="card"><div class="card-h"><h2>Your scans</h2><span class="muted small">${rows.length}</span></div>
        ${rows.length ? `<div class="tbl-wrap"><table class="tbl compact"><caption class="sr">Pregnancy scans</caption><thead><tr><th scope="col">Date</th><th scope="col">Age</th>${MEAS.map(([, l, n]) => `<th scope="col" title="${n}">${l}</th>`).join('')}<th scope="col">Weight</th><th scope="col"><span class="sr">Actions</span></th></tr></thead>
          <tbody>${rows.map((x) => { const ga = gaOn(P, x.d), w = efwOf(x); return `<tr><th scope="row" class="small">${esc(fmtDate(x.d))}${x.src === 'ultrasound' ? ` ${pill('muted', 'Viewer')}` : ''}</th><td class="num">${ga != null ? wd(ga) : '—'}</td>${MEAS.map(([k]) => `<td class="num">${x[k] != null ? x[k] : '—'}</td>`).join('')}<td class="num">${w ? `${Math.round(w)} g${+x.efw > 0 ? '' : '*'}` : '—'}</td>
            <td>${PG.example ? '' : `${x.crl && !(P.dating && P.dating.date === x.d) ? `<button class="link small" data-act="pg-date" data-d="${esc(x.d)}" data-crl="${x.crl}">Use to date</button> ` : ''}<button class="lb-del" data-act="pg-del" data-d="${esc(x.d)}" data-i="${esc(String(x.at || ''))}" aria-label="Delete the scan from ${esc(fmtDate(x.d))}">${icon('x', 12)}</button>`}</td></tr>${x.note ? `<tr class="pg-note"><td colspan="9" class="small muted">${esc(x.note)}</td></tr>` : ''}`; }).join('')}</tbody></table></div>
          <p class="fine">* Estimated by Myo with Hadlock's formula from HC, AC and FL. Different formulas and machines can differ by 10–15%; the weight on your report is the one to go by.</p>` : '<p class="small muted">No scans yet. Type in a report above, or measure in Live ultrasound and send it here.</p>'}</section>`;
  }

  /* ── growth chart: estimated weight against gestational age, Hadlock's 10th–90th band ── */
  function growthSvg(P, W) {
    const pts = (P.scans || []).map((x) => ({ x, ga: gaOn(P, x.d), w: efwOf(x) })).filter((p) => p.ga != null && p.w && p.ga >= 14 * 7 && p.ga <= 43 * 7).map((p) => ({ ...p, wk: p.ga / 7 }));
    const H = 260, L = 50, R = 16, T = 12, B = 30, x0 = 14, x1 = 42, y1 = 4500;
    const X = (wk) => L + ((wk - x0) / (x1 - x0)) * (W - L - R), Y = (g) => T + (1 - g / y1) * (H - T - B);
    const wks = []; for (let w = x0; w <= x1; w += 0.5) wks.push(w);
    const band = `M${wks.map((w) => `${X(w).toFixed(1)} ${Y(median(w) * (1 + 1.2816 * SD)).toFixed(1)}`).join(' L')} L${wks.slice().reverse().map((w) => `${X(w).toFixed(1)} ${Y(median(w) * (1 - 1.2816 * SD)).toFixed(1)}`).join(' L')} Z`;
    const mid = `M${wks.map((w) => `${X(w).toFixed(1)} ${Y(median(w)).toFixed(1)}`).join(' L')}`;
    const grid = [0, 1000, 2000, 3000, 4000].map((g) => `<line class="bc-grid" x1="${L}" x2="${W - R}" y1="${Y(g).toFixed(1)}" y2="${Y(g).toFixed(1)}"/><text class="bc-ax" x="${L - 6}" y="${(Y(g) + 4).toFixed(1)}" text-anchor="end">${g ? `${g / 1000} kg` : '0'}</text>`).join('');
    const xt = (W < 420 ? [14, 28, 42] : [14, 20, 24, 28, 32, 36, 40]).map((w) => `<text class="bc-ax" x="${X(w).toFixed(1)}" y="${H - 10}" text-anchor="middle">${w} wk</text>`).join('');
    const line = pts.length > 1 ? `<path class="bc-ln pg-you" d="${pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.wk).toFixed(1)} ${Y(p.w).toFixed(1)}`).join(' ')}"/>` : '';
    const dots = pts.map((p, i) => `<circle class="bc-mk pg-you" cx="${X(p.wk).toFixed(1)}" cy="${Y(p.w).toFixed(1)}" r="5" data-i="${i}"/>`).join('');
    PG.chart = { W, pts: pts.map((p) => ({ px: X(p.wk), html: `<b>${esc(fmtDate(p.x.d))}</b> · ${wd(p.ga)}<br>${Math.round(p.w)} g${+p.x.efw > 0 ? ' (report)' : ' (Hadlock estimate)'} · about the ${ord(pctile(p.w, p.wk))} percentile` })) };
    return { pts, svg: `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Estimated weight by week against the 10th to 90th percentile band">${grid}${xt}<path class="pg-band" d="${band}"/><path class="pg-mid" d="${mid}"/>${line}${dots}
      <text class="bc-end" x="${X(39.6).toFixed(1)}" y="${(Y(median(39.6) * (1 + 1.2816 * SD)) - 6).toFixed(1)}" text-anchor="end">90th</text><text class="bc-end" x="${X(41.8).toFixed(1)}" y="${(Y(median(41.8) * (1 - 1.2816 * SD)) + 16).toFixed(1)}" text-anchor="end">10th</text>
      <line class="bc-cross" x1="0" x2="0" y1="${T}" y2="${H - B}" style="display:none"/><rect class="bc-hit" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}"/></svg><div class="bc-tip" hidden></div>` };
  }
  function growthTab(s, P) {
    if (!P) return setupCard(s);
    const g = growthSvg(P, 640), last = g.pts[g.pts.length - 1];
    let note = '';
    if (last) { const p = pctile(last.w, last.wk); note = p < 10 || p > 90 ? `The latest estimate sits ${p < 10 ? 'below the 10th' : 'above the 90th'} percentile line on this chart. Growth is judged from the trend over several scans, with the maternity team's own charts and formulas. If they haven't talked it through with you, ask at your next appointment.` : 'The latest estimate sits inside the 10th–90th band on this chart.'; }
    return `<section class="card"><div class="card-h"><h2>Estimated weight by week</h2><span class="muted small">From 14 weeks</span></div>
        ${g.pts.length ? `<div class="bc-chart pg-chart" data-w="640">${g.svg}</div>
          <ul class="bc-leg pg-leg"><li><i class="bc-sw pg-sw-you"></i>Your scans</li><li><i class="bc-sw pg-sw-mid"></i>50th percentile</li><li><i class="bc-sw pg-sw-band"></i>10th to 90th percentile</li></ul>
          <p class="small">${esc(note)}</p>` : '<p class="small muted">Add a scan from 14 weeks with HC, AC and FL, or the weight on your report, to see it here.</p>'}
        <p class="fine">Reference: Hadlock 1991 in-utero weight standard. Your hospital may use a different or customised chart; theirs is the one that counts. Estimates from a scan can be 10–15% off the true weight.</p></section>`;
  }
  function bindChart(root) {
    const el = root.querySelector('.pg-chart'); if (!el) return;
    const P = preg(OS.state), w = Math.round(el.clientWidth);
    if (w && Math.abs(w - PG.chart.W) > 8) el.innerHTML = growthSvg(P, clamp(w, 280, 1100)).svg;
    const svg = el.querySelector('svg'), tip = el.querySelector('.bc-tip'), cross = el.querySelector('.bc-cross'), C = PG.chart;
    if (!C.pts.length) return;
    const move = (e) => {
      const r = svg.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * C.W;
      let best = C.pts[0]; C.pts.forEach((p) => { if (Math.abs(p.px - x) < Math.abs(best.px - x)) best = p; });
      cross.setAttribute('x1', best.px); cross.setAttribute('x2', best.px); cross.style.display = '';
      tip.innerHTML = best.html; tip.hidden = false; tip.style.left = `${clamp((best.px / C.W) * r.width, 90, Math.max(90, r.width - 90))}px`;
    };
    svg.addEventListener('pointermove', move); svg.addEventListener('pointerdown', move);
    svg.addEventListener('pointerleave', () => { tip.hidden = true; cross.style.display = 'none'; });
  }

  function liveTab() {
    return `<section class="card"><div class="card-h"><h2>Live ultrasound</h2><a class="btn ghost sm" href="#ultrasound">Open full screen</a></div>
        <p class="small">Show the picture from a clinical scanner's video output or a handheld probe's app, freeze it, calibrate on its ruler and measure CRL, BPD, HC, AC and FL. Send the measurements here as a scan entry.</p>
        <div class="us-box" data-preset="pregnancy"></div></section>
      <div class="banner" role="note"><b>For scans done by a trained professional.</b> Regulators advise against "keepsake" or home ultrasound in pregnancy: use it only for a medical reason and as short as possible. Myo measures what you click and does not interpret images or check the baby's heartbeat.</div>`;
  }

  function careTab(s, P) {
    const RED = ['Bleeding from the vagina', 'Fluid leaking from the vagina', 'Your baby moving less than usual, or a change in the pattern', 'A severe headache, problems with your vision, or sudden swelling of the face, hands or feet', 'Severe or constant pain in your tummy', 'A high temperature, or feeling very unwell', 'Itching, especially on the hands and feet', 'Regular tightenings or contractions before 37 weeks', 'Thoughts of harming yourself or your baby'];
    return `<div class="banner bad" role="note"><b>Call your maternity unit, labour ward or emergency number now if you have:</b><ul class="small">${RED.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>Day or night: maternity units would always rather see you. In the US, call 988 for a mental health crisis.</div>
      <div class="grid g-2"><section class="card"><div class="card-h"><h2>Baby's heartbeat and movements</h2></div><ul class="small bc-ref">
          <li>Myo has no fetal heartbeat monitor. Regulators in the US and UK advise against home Dopplers and heartbeat apps: they can't tell whether a baby is well, and a reassuring sound can delay getting help.</li>
          <li>From about 24 weeks, learn your baby's pattern of movements. If it slows, changes or stops, call your maternity unit straight away.</li></ul></section>
        <section class="card"><div class="card-h"><h2>A typical schedule</h2><span class="muted small">Varies by country and need</span></div><ul class="small bc-ref">
          <li><b>8–12 weeks:</b> first appointment with a midwife or doctor.</li><li><b>11–14 weeks:</b> dating scan, often with screening tests.</li>
          <li><b>18–21 weeks:</b> anomaly (anatomy) scan.</li><li><b>24–28 weeks:</b> blood tests; glucose test if offered.</li>
          <li><b>From 28 weeks:</b> more frequent check-ups of blood pressure, urine and growth.</li></ul>
          <p class="fine">Ask your midwife or doctor about supplements, medicines, exercise and food in pregnancy. Myo doesn't advise on medicines or doses.</p></section></div>
      ${s.pregnancy && !PG.example ? `<section class="card"><div class="card-h"><h2>Your pregnancy data</h2></div><p class="small">If this pregnancy has ended, or you no longer want to track it, you can remove all of it from this device.</p>
        <button class="btn ghost sm" data-act="pg-remove">Remove pregnancy data</button></section>` : ''}`;
  }

  OS.register('pregnancy', {
    title: 'Pregnancy', icon: 'pregnancy',
    render(s) {
      const P = preg(s), body = { week: weekTab, scans: scansTab, growth: growthTab, live: liveTab, care: careTab }[PG.tab](s, P);
      return `${OS.ui.head('Dates · scans · growth · on-device', 'Pregnancy', 'Your dates, your scan measurements and growth chart, a live viewer for clinical ultrasound, and the signs that mean call now.')}
        <div class="pg bc"><div class="seg kt-tabs" role="tablist" aria-label="Pregnancy">${TABS.map(([k, l]) => `<button role="tab" aria-selected="${PG.tab === k}" data-act="pg-tab" data-t="${k}">${l}</button>`).join('')}</div>${body}</div>`;
    },
    mount(root) {
      bindChart(root);
      const box = root.querySelector('.us-box'); return box && OS.us ? OS.us.mount(box, { preset: 'pregnancy' }) : null;
    }
  });

  const save = (fn) => OS.update((s) => { s.pregnancy = s.pregnancy || { scans: [], moves: {} }; s.pregnancy.scans = s.pregnancy.scans || []; s.pregnancy.moves = s.pregnancy.moves || {}; fn(s.pregnancy); });
  OS.act('pg-tab', (el) => { PG.tab = TABS.some(([k]) => k === el.dataset.t) ? el.dataset.t : 'week'; OS.render(); });
  OS.act('pg-example', () => { PG.example = !PG.example; OS.render(); });
  OS.act('pg-setup', (f) => {
    const v = (n) => f.elements[n].value, crl = +v('crl'), lmp = v('lmp'), edd = v('edd'), dd = v('dd');
    if (dd && !(crl >= 3 && crl <= 95)) { OS.toast('Add the CRL from the dating scan, between 3 and 95 mm'); return; }
    if (!lmp && !edd && !dd) { OS.toast('Fill in one of the dates'); return; }
    PG.example = false;
    save((P) => { if (lmp) P.lmp = lmp; if (edd) P.edd = edd; if (dd) { P.dating = { date: dd, crl }; if (!P.scans.some((x) => x.d === dd)) P.scans.push({ d: dd, crl, src: 'manual', at: Date.now() }); } P.started = P.started || dayKey(new Date()); });
    OS.logEvent('note', 'Pregnancy tracking started', 'Dates are set; due date and weeks are on the Pregnancy page', { go: 'pregnancy', src: 'manual' });
  });
  OS.act('pg-scan', (f) => {
    const x = { d: f.elements.d.value, src: 'manual', at: Date.now() };
    MEAS.forEach(([k]) => { const n = +f.elements[k].value; if (n > 0) x[k] = n; });
    if (+f.elements.efw.value > 0) x.efw = Math.round(+f.elements.efw.value);
    const note = f.elements.note.value.trim(); if (note) x.note = note;
    if (!MEAS.some(([k]) => x[k]) && !x.efw) { OS.toast('Add at least one measurement'); return; }
    addScan(x);
  });
  function addScan(x) {
    save((P) => { P.scans.push(x); if (x.crl && !P.dating && x.crl >= 3 && x.crl <= 95) P.dating = { date: x.d, crl: x.crl }; });
    const parts = MEAS.filter(([k]) => x[k]).map(([k, l]) => `${l} ${x[k]} mm`); if (x.efw) parts.push(`weight ${x.efw} g`);
    OS.logEvent('scan', 'Pregnancy scan', parts.join(' · '), { go: 'pregnancy', src: x.src === 'ultrasound' ? 'device' : 'manual' });
  }
  OS.act('pg-del', (el) => { save((P) => { const i = P.scans.findIndex((x) => x.d === el.dataset.d && String(x.at || '') === el.dataset.i); if (i >= 0) P.scans.splice(i, 1); }); });
  OS.act('pg-date', (el) => { save((P) => { P.dating = { date: el.dataset.d, crl: +el.dataset.crl }; }); OS.toast('Dates now come from that scan'); });
  OS.act('pg-move', (el) => { if (PG.example) { OS.toast('This is an example'); return; } const v = el.dataset.v; save((P) => { P.moves[dayKey(new Date())] = v; }); if (v === 'less') OS.logEvent('symptom', 'Baby moving less than usual', 'Advised to contact the maternity unit now', { go: 'pregnancy', src: 'manual' }); });
  OS.act('pg-remove', () => { if (!confirm('Remove all pregnancy dates, scans and notes from this device? This cannot be undone.')) return; OS.update((s) => { delete s.pregnancy; }); PG.tab = 'week'; OS.toast('Pregnancy data removed'); });
  OS.pregnancy = {
    addMeasures(m) { if (!OS.state.pregnancy) { OS.state.pregnancy = { scans: [], moves: {} }; } addScan({ d: dayKey(new Date()), ...m, src: 'ultrasound', at: Date.now() }); },
    dating, gaOn, hadlock, median, pctile, crlToDays, daysToCrl, state: PG,
    status(s) { const P = s.pregnancy && (s.pregnancy.lmp || s.pregnancy.edd || s.pregnancy.dating) ? s.pregnancy : null; if (!P) return null; const ga = gaOn(P); return ga != null ? wd(ga) : null; }
  };
})();
