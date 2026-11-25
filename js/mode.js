/* ═══ MYO — MYO MODE: the full-screen dashboard, neuro and body, with a full-system scan ═══
   Left: neuro (autonomic balance from HRV, sleep, cognition and mind). Centre: the real 3D body (OS.Anatomy) under a
   scan beam, with Myo's cell. Right: body systems from labs, vitals and training. "Run full scan" walks eight systems
   from the member's own data and ends with a summary, red flags first, and the next actions.
   This is a wellness review of data Myo already holds, not a medical screening. Procedure care helps a member prepare for
   and recover from a procedure their own surgical team plans; Myo does not plan, guide or perform surgery. */
(function () {
  'use strict';
  const { esc, icon, pill, dash, dayKey, targets } = OS;
  const MM = { step: -1, running: false, done: false, max: false, panel: false, t: null };
  const sysOf = (sc, names) => sc.markers.filter((x) => names.includes(x.m.system));
  const markerLine = (xs) => { const sx = xs.filter((x) => x.e.score != null); if (!sx.length) return ['No lab results yet', 'muted']; const bad = sx.filter((x) => x.e.status === 'bad'), warn = sx.filter((x) => x.e.status === 'warn'); return [bad.length ? `${bad.map((x) => x.m.name).join(', ')} out of range` : warn.length ? `${warn.length} of ${sx.length} below optimal: ${warn.slice(0, 2).map((x) => x.m.name).join(', ')}` : `All ${sx.length} markers optimal or peak`, bad.length ? 'bad' : warn.length ? 'warn' : 'good']; };
  const worst = (sts) => (sts.includes('bad') ? 'bad' : sts.includes('warn') ? 'warn' : sts.every((x) => x === 'muted') ? 'muted' : 'good');

  // every system: name, side, and the readout lines from data Myo already holds
  function systems(s, sc) {
    const vt = s.vitals || {}, fn = OS.fn ? OS.fn.summary(s, sc) : null, tg = targets(s.profile), k = dayKey();
    const p = (s.nutrition.meals[k] || []).reduce((a, m) => a + (+m.p || 0), 0);
    const hrvLine = vt.hrv == null ? ['HRV: connect a ring or strap', 'muted'] : [`HRV ${vt.hrv} ms${vt.hrvBase ? ` (baseline ${vt.hrvBase})` : ''}`, vt.hrvBase && vt.hrv < vt.hrvBase * 0.85 ? 'warn' : 'good'];
    const sleepLine = vt.sleepH == null ? ['Sleep: no data yet', 'muted'] : [`Slept ${vt.sleepH} h${vt.sleepScore ? `, score ${vt.sleepScore}` : ''}`, vt.sleepH >= 7 ? 'good' : 'warn'];
    const cog = fn && fn.dims.cognition != null ? [`Cognition tests ${fn.dims.cognition}/100`, fn.dims.cognition >= 70 ? 'good' : 'warn'] : ['Cognition: take the tests in Function', 'muted'];
    const moods = Object.entries(s.life.mood || {}).sort().slice(-1)[0];
    const mind = OS.mind && OS.mind.latest ? OS.mind.latest() : null;
    const moodLine = mind ? [`${mind.label}: ${mind.band}`, mind.status] : moods ? [`Mood ${moods[1].mood}/5, stress ${moods[1].stress}/5`, moods[1].mood >= 3 && moods[1].stress <= 3 ? 'good' : 'warn'] : ['Mood: no check-in yet', 'muted'];
    const train7 = (s.training.log || []).filter((l) => l.date >= OS.dayKey(OS.addDays(new Date(), -7))).length;
    const motion = s.motion && s.motion.log && s.motion.log.at(-1);
    return [
      { k: 'neuro', side: 'l', name: 'Nervous system', lines: [hrvLine, cog], go: 'function' },
      { k: 'mind', side: 'l', name: 'Mind', lines: [moodLine], go: 'mind' },
      { k: 'recovery', side: 'l', name: 'Recovery and sleep', lines: [sc.readiness == null ? ['Readiness: no data yet', 'muted'] : [`Readiness ${sc.readiness}`, sc.readiness >= 60 ? 'good' : 'warn'], sleepLine], go: 'sleep' },
      { k: 'cardio', side: 'r', name: 'Cardiovascular', lines: [vt.rhr == null ? ['Resting heart rate: no data', 'muted'] : [`Resting heart rate ${vt.rhr} bpm`, vt.rhr <= 65 ? 'good' : 'warn'], markerLine(sysOf(sc, ['Cardiometabolic', 'Blood']))], go: 'biology' },
      { k: 'metabolic', side: 'r', name: 'Metabolic', lines: [markerLine(sysOf(sc, ['Metabolic']))], go: 'biochem' },
      { k: 'hormonal', side: 'r', name: 'Hormones and thyroid', lines: [markerLine(sysOf(sc, ['Hormonal', 'Thyroid']))], go: 'biochem' },
      { k: 'muscle', side: 'r', name: 'Muscle and movement', lines: [[`${train7} session${train7 === 1 ? '' : 's'} in 7 days`, train7 >= 3 ? 'good' : train7 ? 'warn' : 'muted'], motion ? [`Motion Lab: ${motion.text}`, 'good'] : ['Movement screen: try Motion Lab', 'muted']], go: 'motion' },
      { k: 'fuel', side: 'r', name: 'Nutrition', lines: [[`Protein ${Math.round(p)} of ${tg.p} g today`, p >= tg.p * 0.8 ? 'good' : p ? 'warn' : 'muted'], markerLine(sysOf(sc, ['Nutrients', 'Inflammation']))], go: 'kitchen' }
    ].map((x) => ({ ...x, status: worst(x.lines.map((l) => l[1])) }));
  }
  const panel = (x, i) => `<section class="mm-sys ${MM.step === i ? 'scan' : ''} ${MM.step > i || MM.done ? 'done' : ''}" data-k="${x.k}"><header><i class="mm-dot st-${x.status}" aria-hidden="true"></i><b>${esc(x.name)}</b><a href="#${x.go}" class="mm-go" aria-label="Open ${esc(x.name)}">${icon('link', 13)}</a></header><ul>${x.lines.map(([t, st]) => `<li class="st-${st}">${esc(t)}</li>`).join('')}</ul></section>`;

  function procedure(s) {
    const P = s.procedure || {}, pain = (P.pain || []).slice(-7);
    const PRE = [['ask', 'Questions written down for your surgeon: risks, recovery time, activity limits'], ['meds', 'Medicine and supplement list given to your surgical team (they decide what to pause)'], ['prehab', 'Prehab plan from your physical therapist'], ['protein', 'Protein target met for the two weeks before'], ['smoke', 'No smoking or vaping'], ['help', 'Ride home and help for the first days arranged'], ['sleep', 'Sleep window protected the week before']];
    return `<section class="card mm-proc" id="mm-proc"><div class="card-h"><h2>Procedure care</h2><button class="btn ghost sm" data-act="mm-proc">Close</button></div>
      <p class="small">Prepare for and recover from a procedure your surgical team has planned. Myo doesn't plan, guide or perform surgery: follow your team's instructions first.</p>
      <form data-submit="mm-proc-save" class="form-grid"><label class="field" for="mp-n"><span>Procedure</span><input id="mp-n" name="n" maxlength="60" value="${esc(P.name || '')}" placeholder="e.g. ACL reconstruction"></label><label class="field" for="mp-d"><span>Date</span><input id="mp-d" name="d" type="date" value="${esc(P.date || '')}"></label><div class="form-end"><button class="btn sm">Save</button></div></form>
      <div class="grid g-2"><div><h3>Before</h3><ul class="mm-checks">${PRE.map(([k, t]) => `<li><label><input type="checkbox" data-change="mm-check" data-k="${k}" ${(P.checks || {})[k] ? 'checked' : ''}> ${esc(t)}</label></li>`).join('')}</ul></div>
        <div><h3>After: pain log</h3>${pain.length ? `<ul class="mm-pain">${pain.map((x) => `<li><span class="num">${OS.fmtDate(x.d)}</span><b class="num">${x.v}/10</b><span class="muted small">${esc(x.note || '')}</span></li>`).join('')}</ul>` : '<p class="muted small">Log pain once a day after the procedure.</p>'}
          <form data-submit="mm-pain" class="row"><label class="sr" for="mp-p">Pain 0 to 10</label><input id="mp-p" name="v" type="number" min="0" max="10" required placeholder="0–10" style="width:80px"><label class="sr" for="mp-note">Note</label><input id="mp-note" name="note" maxlength="80" placeholder="Note (optional)"><button class="btn sm">Log</button></form>
          <p class="fine">Call your surgical team or emergency services for fever, spreading redness, calf pain or swelling, chest pain, shortness of breath, or pain that suddenly gets worse.</p>
          <div class="row"><a class="btn ghost sm" href="#pt">Rehab plans</a><a class="btn ghost sm" href="#imaging">Your scans</a></div></div></div></section>`;
  }

  OS.register('mode', {
    title: 'Myo Mode', icon: 'mode',
    render(s, sc) {
      const xs = systems(s, sc), L = xs.filter((x) => x.side === 'l'), R = xs.filter((x) => x.side === 'r'), k = dayKey(), done = s.protocolDone[k] || {};
      const todo = OS.protocol(s, sc).filter((i) => !done[i.id]).slice(0, 3);
      const sum = MM.done ? (() => { const c = { good: 0, warn: 0, bad: 0, muted: 0 }; xs.forEach((x) => { c[x.status]++; }); return `<div class="mm-sum" role="status"><b>Scan complete.</b> ${c.good} on track, ${c.warn} to improve, ${c.bad} out of range, ${c.muted} without data.${sc.redFlags.length ? ` <span class="mm-rf">Red flag: ${esc(sc.redFlags.map((f) => f.name).join(', '))}. Get in-person care today.</span>` : ''}</div>`; })() : '';
      return `<section class="mm ${MM.max ? 'mm-max' : ''}" id="mm" aria-label="Myo Mode">
        <header class="mm-bar"><span class="mm-brand">MYO MODE</span><span class="mm-clock num" id="mm-clock"></span><span class="mm-src">${esc(s.vitals && s.vitals.src ? s.vitals.src : s.sample ? 'Sample member' : 'This device')}</span><span class="hdr-sp"></span>
          <button class="btn ghost sm" data-act="mm-proc">Procedure care</button><button class="btn ghost sm" data-act="mm-full" aria-pressed="${MM.max}">${MM.max ? 'Exit full screen' : 'Full screen'}</button></header>
        <div class="mm-grid">
          <div class="mm-col"><p class="mm-h">Neuro</p>${L.map((x) => panel(x, xs.indexOf(x))).join('')}</div>
          <div class="mm-center"><div class="mm-body"><div class="a3d" data-a3d="compact" data-systems="skin,cardiovascular,nervous" aria-label="3D body"></div><i class="mm-beam ${MM.running ? 'on' : ''}" aria-hidden="true"></i><canvas class="mm-cell" id="mm-cell" aria-hidden="true"></canvas></div>
            <div class="mm-scores"><div><span>Myo Score</span><b class="num">${dash(sc.mk)}</b></div><div><span>Readiness</span><b class="num">${dash(sc.readiness)}</b></div><div><span>Red flags</span><b class="num">${sc.redFlags.length}</b></div></div></div>
          <div class="mm-col"><p class="mm-h">Body</p>${R.map((x) => panel(x, xs.indexOf(x))).join('')}</div>
        </div>
        <footer class="mm-foot">
          <div class="mm-run"><button class="btn" data-act="mm-scan" ${MM.running ? 'disabled' : ''}>${icon('play', 15)} ${MM.running ? `Scanning ${esc(xs[MM.step] ? xs[MM.step].name : '')}…` : MM.done ? 'Scan again' : 'Run full scan'}</button>
            <div class="mm-prog" role="progressbar" aria-label="Scan progress" aria-valuemin="0" aria-valuemax="${xs.length}" aria-valuenow="${MM.done ? xs.length : Math.max(0, MM.step)}"><i style="width:${MM.done ? 100 : Math.max(0, MM.step) / xs.length * 100}%"></i></div></div>
          ${sum}
          <div class="mm-manage"><p class="mm-h">Manage now</p><ul>${todo.map((i) => `<li><button class="mm-todo" data-act="proto-toggle" data-id="${esc(i.id)}">${icon('check', 14)} ${esc(i.title)}</button></li>`).join('') || '<li class="muted small">Today\'s protocol is done.</li>'}</ul>
            <div class="row"><button class="btn ghost sm" data-act="water" data-ml="250">+250 ml water</button><a class="btn ghost sm" href="#life">Breathwork</a><a class="btn ghost sm" href="#recovery">Sonosphere</a><a class="btn ghost sm" href="#coach">${icon('coach', 14)} Ask Myo</a></div></div>
        </footer>
        <p class="fine mm-note">Myo Mode reviews data Myo already holds: it is a wellness check, not a medical screening or diagnosis.</p>
      </section>
      ${MM.panel ? procedure(s) : ''}`;
    },
    mount(root) {
      const stop3d = OS.Anatomy ? OS.Anatomy.mountAll(root) : null;
      const stopAv = OS.Avatar ? OS.Avatar.mount(root.querySelector('#mm-cell'), { small: false }) : () => {};
      const clock = root.querySelector('#mm-clock'), tick = () => { if (clock) clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); };
      tick(); const ct = setInterval(tick, 1000);
      const onFs = () => { const on = !!document.fullscreenElement; if (MM.max !== on && !on) { MM.max = false; OS.render(); } };
      document.addEventListener('fullscreenchange', onFs);
      if (MM.panel && OS._mmScroll) { const p = document.getElementById('mm-proc'); if (p) p.scrollIntoView({ block: 'start', behavior: 'smooth' }); OS._mmScroll = false; }
      return () => { clearInterval(ct); document.removeEventListener('fullscreenchange', onFs); if (typeof stop3d === 'function') stop3d(); stopAv(); };
    }
  });
  OS.on('route', (n) => { if (n !== 'mode') { if (MM.t) clearInterval(MM.t); MM.running = false; MM.step = -1; if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); MM.max = false; } });
  // the scan steps through the panels in place (no re-render, so the 3D body keeps running), then renders the summary
  OS.act('mm-scan', (btn) => {
    if (MM.running) return;
    const secs = [...document.querySelectorAll('#mm .mm-sys')], n = secs.length, bar = document.querySelector('#mm .mm-prog'), beam = document.querySelector('#mm .mm-beam');
    const paint = () => {
      secs.forEach((el, i) => { el.classList.toggle('scan', i === MM.step); el.classList.toggle('done', i < MM.step); });
      if (bar) { bar.firstElementChild.style.width = `${(MM.step / n) * 100}%`; bar.setAttribute('aria-valuenow', String(MM.step)); }
      const cur = secs[MM.step]; if (btn && cur) btn.lastChild.textContent = ` Scanning ${cur.querySelector('b').textContent}…`;
    };
    MM.running = true; MM.done = false; MM.step = 0; if (btn) btn.disabled = true; if (beam) beam.classList.add('on'); if (OS.Avatar) OS.Avatar.set('thinking'); paint();
    MM.t = setInterval(() => {
      MM.step++; if (OS.Avatar && OS.Avatar.burst) OS.Avatar.burst();
      if (MM.step >= n) { clearInterval(MM.t); MM.running = false; MM.done = true; MM.step = -1; if (OS.Avatar) OS.Avatar.set('idle'); if (OS.current === 'mode') OS.render(); return; }
      paint();
    }, 900);
  });
  OS.act('mm-full', async () => {
    const el = document.getElementById('mm');
    if (!MM.max) { MM.max = true; try { if (el && el.requestFullscreen && document.fullscreenEnabled) await document.documentElement.requestFullscreen(); } catch { /* the page fills the window instead */ } }
    else { MM.max = false; if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); }
    OS.render();
  });
  OS.act('mm-proc', () => { MM.panel = !MM.panel; OS._mmScroll = MM.panel; if (MM.panel && MM.max) { MM.max = false; if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } OS.render(); });
  OS.act('mm-proc-save', (f) => OS.update((s) => { s.procedure = s.procedure || {}; s.procedure.name = f.elements.n.value.trim().slice(0, 60); s.procedure.date = f.elements.d.value || ''; }, { keepSample: true }));
  OS.change('mm-check', (el) => OS.update((s) => { s.procedure = s.procedure || {}; (s.procedure.checks = s.procedure.checks || {})[el.dataset.k] = el.checked; }, { keepSample: true }));
  OS.act('mm-pain', (f) => OS.update((s) => { s.procedure = s.procedure || {}; (s.procedure.pain = s.procedure.pain || []).push({ d: dayKey(), v: Math.max(0, Math.min(10, +f.elements.v.value || 0)), note: f.elements.note.value.trim().slice(0, 80) }); s.procedure.pain = s.procedure.pain.slice(-60); }, { keepSample: true }));
  OS.mode = { systems };
})();
