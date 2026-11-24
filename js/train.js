/* ═══ MYOKINETICS OS v4 — PERFORMANCE LAYER: Training · Machines · AR-Vision ═══ */
(function () {
  'use strict';
  const { esc, clamp, lerp, dayKey, fmtDate, fmt, pill, icon } = OS;
  const H = () => OS.ui;
  const e1rm = (w, r) => (r > 0 ? w * (1 + r / 30) : 0);
  const MUSCLE_LOAD = {
    'APS Shoulder Press': { delts: 1, triceps: 0.7, chest: 0.3, core: 0.3 }, 'Incline Dumbbell Press': { chest: 1, delts: 0.6, triceps: 0.5 },
    'ISO Flow Cable Fly': { chest: 0.9, delts: 0.3, biceps: 0.2 }, 'ISO Flow Rotational Press': { core: 1, obliques: 0.9, chest: 0.4, delts: 0.4 },
    'Rope Triceps Extension': { triceps: 1, forearms: 0.3 }, 'Rack Squat': { quads: 1, adductors: 0.6, core: 0.5, calves: 0.3 }
  };
  function muscleLoad(ses) {
    const done = {}, plan = {};
    ses.exercises.forEach((e) => { const m = MUSCLE_LOAD[e.name] || {}; const f = e.sets.filter((x) => x.done).length / Math.max(1, e.sets.length); Object.entries(m).forEach(([k, v]) => { done[k] = (done[k] || 0) + v * f; plan[k] = (plan[k] || 0) + v; }); });
    const max = Math.max(1, ...Object.values(plan)); const out = {};
    Object.keys(plan).forEach((k) => { out[k] = { done: done[k] / max, plan: plan[k] / max }; });
    return out;
  }
  const machineOf = (s, id) => s.machines.find((m) => m.id === id) || { name: id, status: 'offline' };

  /* ═══ TRAINING ════════════════════════════════════════════════════ */
  OS.register('training', {
    title: 'Training', icon: 'training',
    mount(root) { return OS.Anatomy ? OS.Anatomy.mountAll(root) : undefined; },
    render(s, sc) {
      const T = s.training, ses = T.session, pr = T.program;
      const all = ses.exercises.flatMap((e) => e.sets);
      const done = all.filter((x) => x.done);
      const vol = ses.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).reduce((b, x) => b + (+x.w || 0) * (+x.r || 0), 0), 0);
      const exRows = ses.exercises.map((e, ei) => {
        const m = machineOf(s, e.machine);
        const best = Math.max(0, ...e.sets.filter((x) => x.done).map((x) => e1rm(+x.w, +x.r)));
        const allDone = e.sets.every((x) => x.done);
        const easy = allDone && e.sets.every((x) => +x.rpe && +x.rpe <= 8);
        return `<section class="ex ${allDone ? 'ex-done' : ''}">
          <div class="ex-h">
            <div><p class="ex-n">${esc(e.name)}</p><p class="muted small"><span class="dot dot-${m.status}"></span> ${esc(m.name)} · target ${e.target.sets}×${e.target.reps} @ ${e.target.load} ${e.target.unit}</p></div>
            <div class="ex-r">${best ? `<span class="hstat sm"><span>e1RM</span><b class="num">${fmt(best)}</b></span>` : ''}${OS.Videos ? OS.Videos.videoBtn(e.name) : ''}${e.machine === 'aps' || /squat|press/i.test(e.name) ? `<button class="btn ghost sm" data-act="ar-open" data-ex="${/squat/i.test(e.name) ? 'squat' : 'press'}">${icon('ar', 14)} AR form</button>` : ''}</div>
          </div>
          <div class="sets" role="table" aria-label="${esc(e.name)} sets">
            <div class="set set-h" role="row"><span>Set</span><span>${esc(e.target.unit)}</span><span>Reps</span><span>RPE</span><span></span></div>
            ${e.sets.map((x, i) => `<div class="set ${x.done ? 'on' : ''}" role="row"><span class="num">${i + 1}</span>
              <label class="sr" for="w-${ei}-${i}">Load set ${i + 1}</label><input id="w-${ei}-${i}" type="number" step="0.5" inputmode="decimal" value="${x.w}" data-change="set" data-e="${ei}" data-i="${i}" data-f="w">
              <label class="sr" for="r-${ei}-${i}">Reps set ${i + 1}</label><input id="r-${ei}-${i}" type="number" inputmode="numeric" placeholder="${e.target.reps}" value="${x.r}" data-change="set" data-e="${ei}" data-i="${i}" data-f="r">
              <label class="sr" for="p-${ei}-${i}">RPE set ${i + 1}</label><input id="p-${ei}-${i}" type="number" step="0.5" min="5" max="10" placeholder="—" value="${x.rpe}" data-change="set" data-e="${ei}" data-i="${i}" data-f="rpe">
              <button class="check" data-act="set-done" data-e="${ei}" data-i="${i}" aria-pressed="${x.done}" aria-label="Complete set ${i + 1}">${icon('check', 14)}</button></div>`).join('')}
          </div>
          <div class="ex-f"><button class="link small" data-act="set-add" data-e="${ei}">${icon('plus', 14)} Add set</button>${easy ? `<span class="ai-note">${icon('coach', 14)} All sets at RPE 8 or below. Next session: ${fmt(e.target.load * 1.025 + 0.01, 1)} ${e.target.unit} (+2.5%).</span>` : ''}</div>
        </section>`;
      }).join('');
      const log = T.log.slice(-15);
      const maxV = Math.max(...log.map((l) => l.volume), 1);
      const niceMax = Math.ceil(maxV / 2000) * 2000;
      const bars = log.map((l, i) => { const h = (l.volume / niceMax) * 120; return `<g><rect x="${40 + i * 22}" y="${140 - h}" width="14" height="${h}" rx="2" fill="var(--accent)" opacity="${i === log.length - 1 ? 1 : 0.55}"><title>${fmtDate(l.date)} · ${l.name} · ${fmt(l.volume)} lb</title></rect></g>`; }).join('');
      const ticks = [0, niceMax / 2, niceMax].map((v) => `<g><line x1="34" x2="${40 + log.length * 22}" y1="${140 - (v / niceMax) * 120}" y2="${140 - (v / niceMax) * 120}" stroke="var(--line)"/><text x="30" y="${144 - (v / niceMax) * 120}" text-anchor="end" class="axis">${fmt(v / 1000)}k</text></g>`).join('');
      return `${H().head(`${pr.name} · week ${pr.week} of ${pr.weeks}`, `Today: ${ses.name}`, `${done.length} of ${all.length} sets · ${fmt(vol)} lb volume · readiness ${sc.readiness}`, `<div class="hstat"><span>Training score</span><b class="num">${sc.parts.training.toFixed(0)}</b></div><button class="btn" data-act="session-finish">${icon('check', 16)} Finish session</button>`)}
      <div class="grid g-2-1">
        <div class="stack">${exRows}</div>
        <div class="stack">
          ${OS.Videos ? OS.Videos.card() : ''}
          ${(() => { const ml = muscleLoad(ses); const lit = Object.fromEntries(Object.entries(ml).map(([k, v]) => [k, Math.max(v.done, v.plan * 0.3)])); const top = Object.entries(ml).sort((a, b) => b[1].plan - a[1].plan).slice(0, 5);
            return `<section class="card holo musc-card"><div class="musc-body">${OS.Anatomy ? `<div class="a3d" data-a3d="compact" data-systems="skin,muscular" data-view="torso" data-hi="${top.filter(([, v]) => v.plan > 0).map(([k]) => k).join(',')}" aria-label="Muscles worked today, highlighted on a 3D body"></div>` : OS.anatomy.muscleMap(lit)}</div><div class="musc-side"><p class="eyebrow">Muscles worked today</p>
              <ul class="musc-list">${top.map(([k, v]) => `<li><span>${OS.anatomy.MUSCLE_NAMES[k]}</span><span class="musc-bar"><i style="width:${(v.plan * 100).toFixed(0)}%"></i><b style="width:${(v.done * 100).toFixed(0)}%"></b></span><em class="num">${Math.round(v.done / Math.max(0.01, v.plan) * 100)}%</em></li>`).join('')}</ul>
              <p class="holo-note">Highlighted in orange on the body: the muscles this session trains. Bars: bright is done, faint is planned.</p></div></section>`; })()}
          <section class="card">
            <div class="card-h"><h2>Block progress</h2><span class="num muted">${pr.week}/${pr.weeks}</span></div>
            <div class="weeks">${Array.from({ length: pr.weeks }, (_, i) => `<span class="${i < pr.week - 1 ? 'on' : i === pr.week - 1 ? 'cur' : ''}">${i + 1}</span>`).join('')}</div>
            <p class="muted small">${esc(pr.focus)}. Deload is planned for week ${pr.weeks - 2 > pr.week ? pr.weeks - 2 : pr.weeks}.</p>
          </section>
          <section class="card">
            <div class="card-h"><h2>Session volume</h2><span class="muted small">Last ${log.length} sessions, lb</span></div>
            <div class="chart-wrap"><svg viewBox="0 0 ${50 + log.length * 22} 150" class="chart" role="img" aria-label="Session volume bar chart">${ticks}${bars}</svg></div>
          </section>
          <section class="card">
            <div class="card-h"><h2>Programs</h2></div>
            <ul class="programs">${T.programs.map((p) => `<li class="${p.name === pr.name ? 'cur' : ''}"><div><b>${esc(p.name)}</b><span class="muted small block">${esc(p.detail)}</span></div><span class="chip">${esc(p.tag)}</span></li>`).join('')}</ul>
          </section>
        </div>
      </div>`;
    }
  });
  OS.change('set', (el) => {
    const { e, i, f } = el.dataset; const v = el.value === '' ? '' : parseFloat(el.value);
    OS.update((s) => { s.training.session.exercises[+e].sets[+i][f] = v; }, { render: false });
  });
  OS.act('set-done', (el) => OS.update((s) => {
    const ex = s.training.session.exercises[+el.dataset.e], x = ex.sets[+el.dataset.i];
    x.done = !x.done; if (x.done && x.r === '') x.r = ex.target.reps;
  }));
  OS.act('set-add', (el) => OS.update((s) => { const ex = s.training.session.exercises[+el.dataset.e]; const last = ex.sets[ex.sets.length - 1]; ex.sets.push({ w: last ? last.w : ex.target.load, r: '', rpe: '', done: false }); }));
  OS.act('session-finish', () => {
    const s = OS.state, ses = s.training.session;
    const vol = ses.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).reduce((b, x) => b + (+x.w || 0) * (+x.r || 0), 0), 0);
    const sets = ses.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);
    if (!sets) { OS.toast('Complete at least one set first.'); return; }
    OS.update((st) => {
      st.training.log = st.training.log.filter((l) => !(l.date === dayKey() && l.name === ses.name));
      st.training.log.push({ date: dayKey(), name: ses.name, volume: Math.round(vol), sets });
      st.training.session.exercises.forEach((e) => { if (e.sets.every((x) => x.done) && e.sets.every((x) => +x.rpe && +x.rpe <= 8)) e.target.load = Math.round(e.target.load * 1.025 * 2) / 2; });
      st.protocolDone[dayKey()] = { ...(st.protocolDone[dayKey()] || {}), 'p-train': true };
    });
    OS.toast(`Session saved: ${fmt(vol)} lb across ${sets} sets.`);
  });
  OS.act('ar-open', (el) => { OS.AR.ex = el.dataset.ex; OS.go('ar'); });
  OS.trainLoad = () => muscleLoad(OS.state.training.session);

  /* ═══ MACHINES ════════════════════════════════════════════════════ */
  let selMachine = 'aps', pairing = null;
  OS.register('machines', {
    title: 'Machines', icon: 'machines',
    render(s) {
      const m = machineOf(s, selMachine);
      const counts = s.machines.reduce((a, x) => (a[x.status] = (a[x.status] || 0) + 1, a), {});
      return `${H().head('Equipment ecosystem', 'Machines', `${counts.online || 0} connected · ${counts.beta || 0} in beta · ${counts.planned || 0} planned`, `<button class="btn" data-act="pair">${icon('link', 16)} Pair a device</button>`)}
      ${pairing ? pairCard() : ''}
      <div class="fleet">${s.machines.map((x) => `<button class="mcard ${x.id === selMachine ? 'on' : ''}" data-act="msel" data-id="${x.id}">
          <span class="mcard-top"><span class="dot dot-${x.status}"></span><span class="small">${esc(OS.statusText(x.status))}</span></span>
          <b>${esc(x.name)}</b><span class="muted small">${esc(x.kind)}</span><span class="mono small">${esc(x.link)}</span></button>`).join('')}</div>
      <div class="grid g-2-1">
        <section class="card">
          <div class="card-h"><h2>${esc(m.name)} · live ${esc(m.metric.toLowerCase())}</h2>${m.status === 'planned' ? pill('warn', 'Planned') : `<span class="live"><i></i>Sample stream</span>`}</div>
          <div class="tele-wrap"><canvas id="tele" height="220" aria-label="Live telemetry chart for ${esc(m.name)}"></canvas></div>
          <div class="kv4" id="tele-kv"></div>
        </section>
        <section class="card">
          <div class="card-h"><h2>Device</h2></div>
          <dl class="dl">
            <dt>Model</dt><dd>${esc(m.kind)}</dd>
            <dt>Link</dt><dd class="mono">${esc(m.link)}</dd>
            <dt>Sensors</dt><dd>${esc(m.sensors)}</dd>
            <dt>Firmware</dt><dd class="mono">${esc(m.fw)}</dd>
            <dt>Telemetry topic</dt><dd class="mono small">mk/{facility}/${esc(m.id)}/telemetry</dd>
            <dt>Rep events</dt><dd class="mono small">mk/{facility}/${esc(m.id)}/rep</dd>
          </dl>
          ${m.id === 'arv' ? `<button class="btn ghost" data-act="go" data-to="ar">${icon('ar', 16)} Open AR-Vision</button>` : ''}
        </section>
      </div>
      <section class="card">
        <div class="card-h"><h2>Connection protocol</h2><span class="muted small">Shared electronics architecture across APS Machine and ISO Flow</span></div>
        <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Layer</th><th>Standard</th><th>Carries</th></tr></thead><tbody>
          <tr><td>Phone ↔ machine</td><td class="mono">BLE 5.0 GATT · custom MK service</td><td>Rep events, load, ROM, session start/stop</td></tr>
          <tr><td>Third-party cardio</td><td class="mono">Bluetooth FTMS (0x1826)</td><td>Power, cadence, speed, distance</td></tr>
          <tr><td>Heart rate</td><td class="mono">BLE Heart Rate (0x180D)</td><td>HR straps and watches during sessions</td></tr>
          <tr><td>Machine ↔ cloud</td><td class="mono">MQTT over TLS 1.3 · HTTPS</td><td>Fleet telemetry, firmware OTA, maintenance</td></tr>
          <tr><td>App ↔ cloud</td><td class="mono">REST + event stream</td><td>Health graph sync, coach, facility analytics</td></tr>
        </tbody></table></div>
      </section>`;
    },
    mount(root, s) {
      const cv = root.querySelector('#tele'); if (!cv) return;
      const m = machineOf(s, selMachine), kv = root.querySelector('#tele-kv');
      const ctx = cv.getContext('2d');
      const css = getComputedStyle(document.documentElement);
      const col = (n) => css.getPropertyValue(n).trim() || '#00c8b4';
      const dpr = window.devicePixelRatio || 1;
      const size = () => { const w = cv.parentElement.clientWidth; cv.width = w * dpr; cv.height = 220 * dpr; cv.style.width = w + 'px'; cv.style.height = '220px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
      size(); const ro = new ResizeObserver(size); ro.observe(cv.parentElement);
      const N = 240, A = [], B = []; let t = 0, reps = 0, peak = 0, lastPhase = 0, raf;
      const sample = () => {
        t += 1 / 30;
        if (m.status === 'planned' || m.status === 'idle') return [m.base * 0.02 * Math.random(), null];
        const cyc = (t % 3.2) / 3.2, phase = Math.sin(cyc * Math.PI * 2);
        if (lastPhase < 0 && phase >= 0) reps++; lastPhase = phase;
        const env = Math.max(0, Math.sin(cyc * Math.PI)) ** 1.4;
        const a = m.base * (0.15 + 0.85 * env) + (Math.random() - 0.5) * m.base * 0.04;
        const b = m.id === 'aps' ? a * (0.94 + 0.02 * Math.sin(t)) : null;
        return [a, b];
      };
      const draw = () => {
        const [a, b] = sample(); A.push(a); if (b != null) B.push(b); if (A.length > N) A.shift(); if (B.length > N) B.shift();
        peak = Math.max(peak * 0.999, a);
        const w = cv.clientWidth, h = 220, max = m.base * 1.15 || 1;
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = col('--line'); ctx.lineWidth = 1; ctx.font = '10px "Space Mono", ui-monospace, monospace'; ctx.fillStyle = col('--muted');
        for (let i = 0; i <= 4; i++) { const y = 10 + (i * (h - 30)) / 4; ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(w, y); ctx.stroke(); ctx.fillText(fmt(max * (1 - i / 4), max < 5 ? 1 : 0), 2, y + 3); }
        const line = (arr, c, dash) => { ctx.beginPath(); ctx.setLineDash(dash || []); ctx.strokeStyle = c; ctx.lineWidth = 2; arr.forEach((v, i) => { const x = 40 + (i * (w - 40)) / (N - 1), y = 10 + (1 - v / max) * (h - 30); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); ctx.setLineDash([]); };
        line(A, col('--accent')); if (B.length) line(B, col('--accent-2'), [4, 3]);
        ctx.fillStyle = col('--muted'); ctx.fillText('last 8 s', w - 60, h - 6);
        if (kv && (raf % 6 === 0)) {
          const sym = B.length ? 100 - Math.abs(A[A.length - 1] - B[B.length - 1]) / Math.max(1, A[A.length - 1]) * 100 : null;
          kv.innerHTML = `<div><span>${esc(m.metric)}</span><b class="num">${fmt(a, max < 5 ? 2 : 0)} ${esc(m.unit)}</b></div><div><span>Peak</span><b class="num">${fmt(peak, max < 5 ? 2 : 0)}</b></div><div><span>Reps detected</span><b class="num">${reps}</b></div><div><span>${sym != null ? 'L/R symmetry' : 'Signal'}</span><b class="num">${sym != null ? fmt(sym, 1) + '%' : m.status === 'online' || m.status === 'beta' ? 'Good' : '—'}</b></div>`;
        }
        raf = requestAnimationFrame(draw);
      };
      for (let i = 0; i < N - 1; i++) { const [a, b] = sample(); A.push(a); if (b != null) B.push(b); peak = Math.max(peak, a); }
      reps = 0; raf = 0; draw();
      return () => { cancelAnimationFrame(raf); ro.disconnect(); };
    }
  });
  function pairCard() {
    if (pairing.step === 'scan') return `<section class="card pair"><div class="card-h"><h2>Scanning for Merakinetics devices…</h2><button class="icon-btn" data-act="pair-x" aria-label="Cancel">${icon('x', 16)}</button></div><div class="scanbar"><i></i></div><p class="muted small">Sample pairing flow. On the phone app this uses Bluetooth LE and asks for permission first.</p></section>`;
    return `<section class="card pair"><div class="card-h"><h2>Found ${pairing.found.length} devices</h2><button class="icon-btn" data-act="pair-x" aria-label="Close">${icon('x', 16)}</button></div>
      <ul class="found">${pairing.found.map((f, i) => `<li><div><b>${esc(f.name)}</b><span class="mono small block">${esc(f.serial)} · RSSI ${f.rssi} dBm</span></div><button class="btn sm" data-act="pair-add" data-i="${i}">Add</button></li>`).join('')}</ul></section>`;
  }
  OS.act('msel', (el) => { selMachine = el.dataset.id; OS.render(); });
  OS.act('pair', () => { pairing = { step: 'scan' }; OS.render(); setTimeout(() => { if (!pairing) return; pairing = { step: 'found', found: [{ name: 'APS Machine 2.0 #2', serial: 'MK-APS-0242', rssi: -58, base: 'aps' }, { name: 'ISO Flow #2', serial: 'MK-ISO-0117', rssi: -64, base: 'isoflow' }] }; if (OS.current === 'machines') OS.render(); }, 1800); });
  OS.act('pair-x', () => { pairing = null; OS.render(); });
  OS.act('pair-add', (el) => {
    const f = pairing.found.splice(+el.dataset.i, 1)[0];
    OS.update((s) => { const b = s.machines.find((m) => m.id === f.base); s.machines.splice(s.machines.indexOf(b) + 1, 0, { ...b, id: b.id + '-' + f.serial.slice(-4), name: f.name, status: 'online' }); s.machinesPaired = true; });
    if (!pairing.found.length) { pairing = null; OS.render(); }
    OS.toast(`${f.name} paired`);
  });

})();
