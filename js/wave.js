/* ═══ MYO — ACOUSTIC WAVE SESSIONS: track StemWave and other acoustic or shockwave treatments at a provider ═══
   Log    · each session's area, pulses and setting from the provider's screen, and pain and function before and
            about a day after
   Trend  · pain and function by area across sessions (small multiples), change from the first session
   Learn  · how acoustic and shockwave treatment works, where the evidence is and isn't, and what to tell the
            provider first
   Myo isn't affiliated with StemWave or any device maker; the name only identifies the service you had. Myo
   doesn't recommend a treatment, setting or number of sessions. */
(function () {
  'use strict';
  const { esc, icon, pill, clamp, dayKey, fmtDate } = OS;
  const TABS = [['log', 'Sessions'], ['trend', 'Progress'], ['learn', 'How it works']];
  const AREAS = ['Neck', 'Upper back', 'Lower back', 'Shoulder', 'Elbow', 'Wrist or hand', 'Hip or buttock', 'Thigh or hamstring', 'Knee', 'Calf or Achilles', 'Heel or foot', 'Other'];
  const KINDS = [['stemwave', 'StemWave'], ['radial', 'Radial shockwave'], ['focused', 'Focused shockwave'], ['other', 'Other acoustic wave']];
  const WV = { tab: 'log', side: '' };
  const log = (s) => ((s.wave && s.wave.sessions) || []).slice().sort((a, b) => a.d.localeCompare(b.d));

  function byArea(s) {
    const g = {}; log(s).forEach((x) => { (g[x.area] = g[x.area] || []).push(x); });
    return Object.entries(g).map(([area, xs]) => {
      const pain = xs.map((x) => (x.after != null ? +x.after : x.before != null ? +x.before : null)).filter((v) => v != null), fn = xs.map((x) => (x.func != null ? +x.func : null)).filter((v) => v != null);
      const first = xs[0], last = xs[xs.length - 1], p0 = first.before != null ? +first.before : pain[0], p1 = pain[pain.length - 1];
      return { area, xs, n: xs.length, days: Math.round((Date.parse(last.d) - Date.parse(first.d)) / 864e5), p0, p1, pain, fn };
    });
  }

  function logTab(s) {
    const xs = log(s).reverse();
    return `<section class="card"><div class="card-h"><h2>Log a session</h2><span class="muted small">Ask the provider for the numbers on their screen</span></div>
        <form data-submit="wv-add" class="lb-grid">
          <label>Date<input type="date" name="d" required value="${dayKey(new Date())}" max="${dayKey(new Date())}"></label>
          <label>Treatment<select name="kind">${KINDS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
          <label>Area<select name="area" required>${AREAS.map((a) => `<option>${a}</option>`).join('')}</select></label>
          <label>Side<select name="side"><option value="">Not applicable</option><option>Left</option><option>Right</option><option>Both</option></select></label>
          <label>Pulses delivered<input type="number" name="pulses" min="0" max="20000" step="100" inputmode="numeric" placeholder="e.g. 3000"></label>
          <label>Setting (as shown)<input name="setting" maxlength="40" placeholder="Intensity, bar or mJ/mm², frequency"></label>
          <label>Pain before, 0 to 10 <output id="wv-b">5</output><input type="range" name="before" min="0" max="10" value="5" data-change="wv-out" data-o="wv-b"></label>
          <label>Function, 0 to 10 <output id="wv-f">5</output><input type="range" name="func" min="0" max="10" value="5" data-change="wv-out" data-o="wv-f"></label>
          <label>Provider (optional)<input name="prov" maxlength="60" placeholder="Clinic name"></label>
          <label class="lb-wide">Note (optional)<input name="note" maxlength="200" placeholder="How it felt, anything the provider said"></label>
          <div class="lb-wide"><button class="btn sm">${icon('plus', 14)} Save session</button></div></form>
        <p class="fine">Function: 10 is everything you want to do with that area, without limits. Add the pain about a day later on the session below; that is when soreness from the treatment itself has usually settled.</p></section>
      <section class="card"><div class="card-h"><h2>Your sessions</h2><span class="muted small">${xs.length}</span></div>
        ${xs.length ? `<div class="tbl-wrap"><table class="tbl compact"><caption class="sr">Acoustic wave sessions</caption><thead><tr><th scope="col">Date</th><th scope="col">Area</th><th scope="col">Treatment</th><th scope="col">Pulses</th><th scope="col">Pain before</th><th scope="col">Pain next day</th><th scope="col">Function</th><th scope="col"><span class="sr">Actions</span></th></tr></thead>
          <tbody>${xs.map((x) => `<tr><th scope="row" class="small">${esc(fmtDate(x.d))}</th><td class="small">${esc(x.area)}${x.side ? ` · ${esc(x.side)}` : ''}</td><td class="small">${esc((KINDS.find(([k]) => k === x.kind) || [, 'Other'])[1])}${x.setting ? ` <span class="muted">${esc(x.setting)}</span>` : ''}</td><td class="num">${x.pulses ?? '—'}</td><td class="num">${x.before ?? '—'}</td>
            <td class="num">${x.after != null ? x.after : `<select class="wv-after" data-change="wv-after" data-at="${x.at}" aria-label="Pain the day after the ${esc(fmtDate(x.d))} session"><option value="">Add</option>${Array.from({ length: 11 }, (_, i) => `<option>${i}</option>`).join('')}</select>`}</td><td class="num">${x.func ?? '—'}</td>
            <td><button class="lb-del" data-act="wv-del" data-at="${x.at}" aria-label="Delete the ${esc(fmtDate(x.d))} session">${icon('x', 12)}</button></td></tr>${x.note || x.prov ? `<tr><td colspan="8" class="small muted">${esc([x.prov, x.note].filter(Boolean).join(' · '))}</td></tr>` : ''}`).join('')}</tbody></table></div>` : '<p class="small muted">No sessions yet.</p>'}</section>`;
  }

  // one small chart per area: pain (lower is better) and function (higher is better) on the same 0–10 scale
  function mini(a, W = 300) {
    const H = 120, L = 24, R = 8, T = 8, B = 18, n = a.xs.length;
    const X = (i) => L + (n > 1 ? i / (n - 1) : 0.5) * (W - L - R), Y = (v) => T + (1 - v / 10) * (H - T - B);
    const ser = (key, cls) => { const pts = a.xs.map((x, i) => [i, key === 'pain' ? (x.after != null ? +x.after : x.before != null ? +x.before : null) : x.func != null ? +x.func : null]).filter((p) => p[1] != null);
      return `${pts.length > 1 ? `<path class="bc-ln ${cls}" d="${pts.map(([i, v], j) => `${j ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ')}"/>` : ''}${pts.map(([i, v]) => `<circle class="bc-mk ${cls}" cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="4"><title>Session ${i + 1}: ${key === 'pain' ? 'pain' : 'function'} ${v}</title></circle>`).join('')}`; };
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(a.area)}: pain and function over ${n} sessions">${[0, 5, 10].map((v) => `<line class="bc-grid" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="bc-ax" x="${L - 5}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
      ${n > 1 ? `<text class="bc-ax" x="${L}" y="${H - 4}">Session 1</text><text class="bc-ax" x="${W - R}" y="${H - 4}" text-anchor="end">${n}</text>` : ''}${ser('pain', 'bc-fat')}${ser('func', 'bc-lean')}</svg>`;
  }
  function trendTab(s) {
    const A = byArea(s);
    if (!A.length) return '<section class="card"><p class="small muted">Log sessions to see progress by area.</p></section>';
    return `<section class="card"><div class="card-h"><h2>Progress by area</h2></div>
        <ul class="bc-leg"><li><i class="bc-sw bc-fat"></i>Pain (next day when logged), lower is better</li><li><i class="bc-sw bc-lean"></i>Function, higher is better</li></ul>
        <div class="wv-grid">${A.map((a) => { const d = a.p0 != null && a.p1 != null ? a.p1 - a.p0 : null; return `<figure class="wv-mini"><figcaption><b>${esc(a.area)}</b> <span class="muted small">${a.n} session${a.n > 1 ? 's' : ''}${a.days ? ` over ${Math.max(1, Math.round(a.days / 7))} wk` : ''}</span>
          ${d != null && a.n > 1 ? `<span class="small">Pain ${a.p0} → ${a.p1} ${pill(d <= -2 ? 'good' : d >= 2 ? 'warn' : 'muted', d <= -2 ? 'Easing' : d >= 2 ? 'Worse' : 'Little change')}</span>` : ''}</figcaption>${mini(a)}</figure>`; }).join('')}</div>
        <p class="fine">Change by 2 or more points on a 0–10 scale is usually noticeable. Pain often eases over several weeks after a course rather than right after a session. If pain is worse after three sessions, or gets steadily worse, stop and talk to the provider or your doctor.</p></section>
      <section class="card"><div class="card-h"><h2>Alongside</h2></div><p class="small">Rehab exercises do most of the long-term work for tendons. Pair sessions with a plan in <a href="#pt">Rehab</a>, and log heat, cold and light in <a href="#recovery">Recovery</a>.</p></section>`;
  }
  function learnTab() {
    return `<div class="grid g-2"><section class="card"><div class="card-h"><h2>How it works</h2></div><ul class="small bc-ref">
          <li>A handpiece sends short pressure pulses (acoustic waves) into the tissue. <b>Radial</b> devices spread the energy from the skin; <b>focused</b> devices concentrate it at a depth. StemWave describes its device as low-intensity acoustic wave treatment.</li>
          <li>In studies the pulses stretch and compress cells, which can trigger signals for blood vessel growth, collagen repair and reduced pain signalling, and raise local blood flow for a while. See <a href="#flow">Blood flow</a>.</li>
          <li>A typical course is a few short sessions a week apart. It can be uncomfortable during the session and sore for a day or two.</li></ul></section>
        <section class="card"><div class="card-h"><h2>What the evidence says</h2></div><ul class="small bc-ref">
          <li>The strongest evidence is for shockwave in a few long-lasting tendon and heel problems: heel pain from the plantar fascia, calcium deposits in the shoulder tendons, tennis elbow, and some hip-side and Achilles tendon pain.</li>
          <li>Evidence for other uses is weaker or mixed. Claims about activating stem cells come mainly from lab and animal research.</li>
          <li>Results depend on the device, energy and number of pulses. Ask the provider which device they use and what evidence supports it for your problem.</li></ul>
          <a class="btn ghost sm" href="#evidence">${icon('evidence', 14)} Search studies</a></section></div>
      <div class="banner" role="note"><b>Tell the provider first if any of these apply:</b> you are or may be pregnant; you have a pacemaker or another implanted device; you take blood thinners or have a bleeding disorder; there is an infection, a tumour, open skin or a recent steroid injection at the area; the area is over the lungs, a major nerve or vessel, or a child's growth plate. Get checked before treatment if the pain followed an injury, or comes with numbness, weakness, fever, or a hot, swollen joint.</div>
      <section class="card"><div class="card-h"><h2>Finding a provider</h2></div><p class="small">StemWave lists clinics that offer its treatment on its website. Myo isn't affiliated with StemWave or any device maker, and doesn't recommend a treatment, setting or number of sessions.</p>
        <a class="btn ghost sm" href="https://stemwave.com/" target="_blank" rel="noopener">stemwave.com</a></section>`;
  }

  OS.register('wave', {
    title: 'Wave therapy', icon: 'wave',
    render(s) {
      const body = WV.tab === 'trend' ? trendTab(s) : WV.tab === 'learn' ? learnTab() : logTab(s);
      return `${OS.ui.head('StemWave · radial and focused shockwave', 'Wave therapy', 'Track acoustic wave sessions at a provider, by area, with pain and function across the course, and learn how it works and where the evidence is.')}
        <div class="wv bc"><div class="seg kt-tabs" role="tablist" aria-label="Wave therapy">${TABS.map(([k, l]) => `<button role="tab" aria-selected="${WV.tab === k}" data-act="wv-tab" data-t="${k}">${l}</button>`).join('')}</div>${body}</div>`;
    }
  });
  const save = (fn) => OS.update((s) => { s.wave = s.wave || { sessions: [] }; s.wave.sessions = s.wave.sessions || []; fn(s.wave); });
  OS.act('wv-tab', (el) => { WV.tab = TABS.some(([k]) => k === el.dataset.t) ? el.dataset.t : 'log'; OS.render(); });
  OS.change('wv-out', (el) => { const o = document.getElementById(el.dataset.o); if (o) o.textContent = el.value; });
  OS.act('wv-add', (f) => {
    const E = f.elements, x = { at: Date.now(), d: E.d.value, kind: E.kind.value, area: E.area.value, before: +E.before.value, func: +E.func.value };
    if (E.side.value) x.side = E.side.value; if (+E.pulses.value > 0) x.pulses = Math.round(+E.pulses.value);
    ['setting', 'prov', 'note'].forEach((k) => { const v = E[k].value.trim(); if (v) x[k] = v; });
    save((W) => { W.sessions.push(x); W.sessions = W.sessions.slice(-500); });
    OS.logEvent('training', `Wave therapy · ${x.area}`, [`pain ${x.before}/10`, `function ${x.func}/10`, x.pulses ? `${x.pulses} pulses` : ''].filter(Boolean).join(' · '), { go: 'wave', src: 'manual' });
    OS.toast('Session saved');
  });
  OS.change('wv-after', (el) => { if (el.value === '') return; save((W) => { const x = W.sessions.find((r) => String(r.at) === el.dataset.at); if (x) x.after = +el.value; }); });
  OS.act('wv-del', (el) => { save((W) => { W.sessions = W.sessions.filter((r) => String(r.at) !== el.dataset.at); }); });
  OS.wave = { byArea, AREAS, KINDS, status(s) { const n = log(s).length; return n ? `${n} session${n > 1 ? 's' : ''}` : null; } };
})();
