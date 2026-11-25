/* ═══ MYOKINETICS OS v4 — HEALTH LAYER: Today · Biology · Fuel · Life · Profile ═══ */
(function () {
  'use strict';
  const { esc, clamp, dayKey, addDays, fmtDate, fmt, spark, ring, pill, icon, targets, protocol, markerEval, dash: D } = OS;
  const vs = (a, b, unit = '') => (a == null || b == null ? '' : `${a - b >= 0 ? '+' : ''}${Math.round((a - b) * 10) / 10}${unit} vs base`);

  const CAT = { supplement: 'Supplement', training: 'Training', nutrition: 'Nutrition', sleep: 'Sleep', mind: 'Mind', move: 'Move', fuel: 'Fuel', work: 'Work', life: 'Life' };
  const catChip = (c) => `<span class="chip chip-${c}">${esc(CAT[c] || c)}</span>`;
  // "Start with my own data": two steps, then the member's own empty Myo (OS.blank) replaces the sample member
  let freshAsk = false;
  const freshConfirm = () => `<div class="confirm fresh-confirm" role="group" aria-label="Start with your own data"><p><b>Clear the sample member?</b> This removes the example labs, wearable nights, meals, training log, day plan and goals so Myo starts empty with your own data. Your appearance settings and progress photos stay. You can bring the sample back from Profile.</p><div class="row"><button class="btn" data-act="fresh">Yes, start with my own data</button><button class="btn ghost" data-act="fresh-cancel">Keep the sample</button></div></div>`;
  const sampleBanner = (s) => s.sample ? `<div class="banner sample-banner" role="note"><div><strong>Sample member profile.</strong> Every number here is example data so you can see the system working.</div>
    ${freshAsk ? freshConfirm() : `<div class="row"><button class="btn sm" data-act="fresh-ask">Start with my own data</button><button class="link small" data-act="go" data-to="profile">Edit profile instead</button></div>`}</div>` : '';
  OS.sampleBanner = sampleBanner;
  OS.act('fresh-ask', () => { freshAsk = true; OS.render(); });
  OS.act('fresh-cancel', () => { freshAsk = false; OS.render(); });
  OS.act('fresh', () => {
    const old = OS.state, keep = { termsAccepted: old.termsAccepted, welcomed: old.welcomed };
    freshAsk = false;
    OS.state = Object.assign(OS.blank(), keep);
    OS.Persist.save(OS.state);   // signed in, this also replaces the sample in the member's account
    OS.go('welcome');
    setTimeout(() => { const el = document.getElementById('wl-setup'); if (el) el.scrollIntoView({ block: 'start' }); }, 60);
    OS.toast('Started fresh. Begin with your profile, then labs and a wearable.');
  });
  const head = (eyebrow, title, sub = '', right = '') => `<header class="vhead"><div><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${right ? `<div class="vhead-r">${right}</div>` : ''}</header>`;

  function rangeBar(m) {
    const v = OS.hasValue(m) ? Number(m.value) : null;
    const nums = [m.normal[0], m.normal[1], m.optimal[0], m.optimal[1], v].filter((x) => x != null);
    let lo = Math.min(...nums), hi = Math.max(...nums);
    const span = hi - lo || Math.abs(hi) || 1;
    lo = Math.max(0, lo - span * 0.25); hi = hi + span * 0.25;
    const X = (x) => clamp(((x - lo) / (hi - lo)) * 100, 0, 100);
    const band = (r, cls) => { const a = X(r[0] ?? lo), b = X(r[1] ?? hi); return `<span class="rb-${cls}" style="left:${a}%;width:${Math.max(1, b - a)}%"></span>`; };
    const e = markerEval(m);
    return `<div class="rbar" title="Normal ${fmtR(m.normal)} · Optimal ${fmtR(m.optimal)} · Peak ${fmtR(OS.peakOf(m))} ${esc(m.unit)}">${band(m.normal, 'normal')}${band(m.optimal, 'opt')}${band(OS.peakOf(m), 'peak')}<span class="rb-tick rb-${e.status}" style="left:${X(v)}%"></span></div>`;
  }
  function systemsOf(s, sc) {
    return [...new Set(s.markers.map((m) => m.system))].map((sy) => {
      const xs = sc.markers.filter((x) => x.m.system === sy), w = xs.reduce((a, x) => a + x.m.weight, 0);
      const sx = xs.filter((x) => x.e.score != null), sw = sx.reduce((a, x) => a + x.m.weight, 0);
      const score = sw ? sx.reduce((a, x) => a + x.e.score * x.m.weight, 0) / sw : null, bad = xs.filter((x) => x.e.status === 'bad').length, warn = xs.filter((x) => x.e.status === 'warn').length;
      return { sy, n: xs.length, score, bad: bad + warn, status: !sx.length ? 'muted' : bad ? 'bad' : warn ? 'warn' : 'good', xs };
    });
  }
  // urgent-care alert for dangerous values; the only place the OS sends you out
  const redFlagBanner = (sc) => sc.redFlags && sc.redFlags.length ? `<div class="redflag" role="alert"><div class="rf-h">${icon('biology', 18)}<b>Red flag: get in-person care today</b></div>
    <ul>${sc.redFlags.map((f) => `<li><b>${esc(f.name)} ${f.value} ${esc(f.unit)}.</b> ${esc(f.why)}.</li>`).join('')}</ul>
    <p>The OS has stopped optimising ${sc.redFlags.length > 1 ? 'these markers' : 'this marker'} until a clinician has seen the result. Go to urgent care or call your local emergency number if you feel unwell.</p></div>` : '';
  const termsCard = (s) => s.termsAccepted ? '' : `<div class="terms-card" role="note"><div><b>How Myo works</b><p>${esc(OS.TERMS)}</p></div><button class="btn" data-act="terms-accept">Got it</button></div>`;
  OS.act('terms-accept', () => OS.update((s) => { s.termsAccepted = new Date().toISOString(); }, { keepSample: true }));
  const fmtR = (r) => r[0] == null ? `< ${r[1]}` : r[1] == null ? `> ${r[0]}` : `${r[0]}–${r[1]}`;

  /* ═══ TODAY ═══════════════════════════════════════════════════════ */
  OS.register('today', {
    title: 'Today', icon: 'today',
    mount(root, s, sc) { const a3d = OS.Anatomy ? OS.Anatomy.mountAll(root) : null; if (OS.Scan) OS.Scan.mount(root, s, sc); return () => { if (a3d) a3d(); }; },
    render(s, sc) {
      const today = dayKey();
      const done = s.protocolDone[today] || {};
      const items = protocol(s, sc);
      const doneN = items.filter((i) => done[i.id]).length;
      const P = sc.parts;
      const bars = [['Biology', P.biology, 'biology'], ['Recovery', P.recovery, 'biology'], ['Training', P.training, 'training'], ['Nutrition', P.nutrition, 'fuel'], ['Life', P.life, 'life']]
        .map(([n, v, r]) => `<button class="sbar" data-act="go" data-to="${r}"><span>${n}</span><span class="sbar-track"><span style="width:${v == null ? 0 : v.toFixed(0)}%"></span></span><b class="num">${D(v, 0)}</b></button>`).join('');
      const vt = s.vitals;
      const now = new Date(), mins = now.getHours() * 60 + now.getMinutes();
      const blocks = [...s.life.blocks].sort((a, b) => a.t.localeCompare(b.t));
      const toM = (t) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
      const cur = blocks.find((b) => mins >= toM(b.t) && mins < toM(b.t) + b.dur);
      const next = blocks.find((b) => toM(b.t) > mins);
      const ses = s.training.session.exercises;
      const setsAll = ses.flatMap((e) => e.sets), setsDone = setsAll.filter((x) => x.done).length;
      const flagged = sc.flagged.sort((a, b) => a.e.score - b.e.score).slice(0, 4);
      const insight = coachLine(s, sc);
      const grouped = items.map((i) => `
        <li class="proto ${done[i.id] ? 'is-done' : ''}">
          <button class="check" data-act="proto-toggle" data-id="${esc(i.id)}" aria-pressed="${!!done[i.id]}" aria-label="Mark ${esc(i.title)} done">${icon('check', 16)}</button>
          <div class="proto-body"><div class="proto-top">${catChip(i.cat)}<span class="proto-time num">${esc(i.time || '')}</span></div>
          <p class="proto-title">${esc(i.title)}</p><p class="proto-detail">${esc(i.detail || '')}</p>
          ${i.marker ? `<button class="link small" data-act="go" data-to="biology">Linked marker: ${esc((s.markers.find((m) => m.id === i.marker) || {}).name || i.marker)}</button>` : ''}
          ${i.route ? `<button class="link small" data-act="go" data-to="${i.route}">Open ${esc(OS.views[i.route].title)}</button>` : ''}</div>
        </li>`).join('');
      return `${redFlagBanner(sc)}${termsCard(s)}${sampleBanner(s)}
      ${head(now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }), 'Command center', `${doneN} of ${items.length} protocol actions done · ${sc.readiness == null ? 'connect a ring or strap for readiness' : 'readiness ' + sc.readiness}`)}
      ${commandStage(s, sc, items, done, setsDone)}
      ${OS.Scan ? OS.Scan.insight(s, sc, systemsOf(s, sc)) : ''}
      <div class="grid g-3">
        <section class="card">
          <div class="card-h"><h2>Your body, scored</h2><button class="link small" data-act="go" data-to="biology">Biology</button></div>
          <div class="score-body"><div class="score-ring">${ring(sc.mk, 148, 10, 'MK Score')}<div class="score-num"><b class="num">${D(sc.mk)}</b><span>${sc.mk == null ? 'Add data' : 'MK Score'}</span></div></div>
          <div class="sbars">${bars}</div></div>
        </section>
        <section class="card">
          <div class="card-h"><h2>Readiness</h2>${sc.readiness == null ? pill('muted', 'No data yet') : pill(sc.readiness >= 75 ? 'good' : sc.readiness >= 60 ? 'warn' : 'bad', sc.readiness >= 75 ? 'Primed' : sc.readiness >= 60 ? 'Moderate' : 'Recover')}</div>
          <div class="big num">${D(sc.readiness)}<small>/100</small></div>
          <div class="kv3">
            <div><span>HRV</span><b class="num">${D(vt.hrv)} ms</b><em class="${vt.hrv >= vt.hrvBase ? 'up' : 'down'}">${vs(vt.hrv, vt.hrvBase)}</em></div>
            <div><span>Resting HR</span><b class="num">${D(vt.rhr)} bpm</b><em class="${vt.rhr <= vt.rhrBase ? 'up' : 'down'}">${vs(vt.rhr, vt.rhrBase)}</em></div>
            <div><span>Sleep</span><b class="num">${D(vt.sleepH)} h</b><em>${vt.sleepScore == null ? '' : 'score ' + vt.sleepScore}</em></div>
          </div>
          <div class="spark-row"><span class="muted small">HRV, 7 days</span>${spark(vt.hrvTrend, 160, 34)}</div>
        </section>
        <section class="card">
          <div class="card-h"><h2>Right now</h2><button class="link small" data-act="go" data-to="life">Open day plan</button></div>
          ${cur ? `<div class="now-block">${catChip(cur.cat)}<p class="now-title">${esc(cur.title)}</p><p class="muted num">${cur.t} · ${cur.dur} min</p></div>` : `<p class="muted">Nothing scheduled this minute.</p>`}
          ${next ? `<div class="next-block"><span class="eyebrow">Next · ${next.t}</span><p>${esc(next.title)}</p></div>` : ''}
          <div class="mini-prog"><span>Session</span><span class="sbar-track"><span style="width:${setsAll.length ? (setsDone / setsAll.length * 100).toFixed(0) : 0}%"></span></span><b class="num">${setsDone}/${setsAll.length} sets</b></div>
        </section>
      </div>

      <div class="grid g-2-1">
        <section class="card">
          <div class="card-h"><h2>Today's protocol</h2><span class="muted small">Your plan to move every marker toward peak</span></div>
          <ol class="proto-list">${grouped}</ol>
          <p class="fine">Built from your biomarkers, readiness and goals. Myo rewrites it after every retest and every wearable sync.</p>
        </section>
        <div class="stack">
          <section class="card insight">
            <div class="card-h"><h2>Myo says</h2><span class="chip chip-ai">AI coach</span></div>
            <p>${insight}</p>
            <button class="btn" data-act="go" data-to="coach">${icon('coach', 16)} Ask Myo</button>
          </section>
          <section class="card">
            <div class="card-h"><h2>Needs attention</h2><button class="link small" data-act="go" data-to="biology">All ${s.markers.length} markers</button></div>
            <ul class="flag-list">${flagged.map((x) => `<li><div><b>${esc(x.m.name)}</b><span class="muted small">${esc(x.m.system)}</span></div><div class="flag-v"><span class="num">${x.m.value} ${esc(x.m.unit)}</span>${pill(x.e.status, x.e.tier === 'danger' ? 'Red flag' : x.e.status === 'bad' ? 'Out' : 'Below optimal')}</div></li>`).join('') || '<li class="muted">All markers optimal.</li>'}</ul>
          </section>
          <section class="card">
            <div class="card-h"><h2>Equipment</h2><button class="link small" data-act="go" data-to="machines">Fleet</button></div>
            <ul class="mach-mini">${s.machines.slice(0, 5).map((m) => `<li><span class="dot dot-${m.status}"></span><span>${esc(m.name)}</span><span class="muted small">${esc(statusText(m.status))}</span></li>`).join('')}</ul>
          </section>
        </div>
      </div>`;
    }
  });

  /* ═══ COMMAND STAGE — holographic body with floating glass readouts ═══ */
  function smoothPath(pts) {
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], cx = (x0 + x1) / 2; d += ` C${cx} ${y0} ${cx} ${y1} ${x1} ${y1}`; }
    return d;
  }
  function ecg(w = 180, h = 40) {
    const beat = (x) => `L${x} 24 L${x + 8} 24 Q${x + 11} 18 ${x + 14} 24 L${x + 20} 24 L${x + 23} 28 L${x + 27} 4 L${x + 31} 34 L${x + 34} 24 L${x + 42} 24 Q${x + 48} 15 ${x + 54} 24`;
    return `<svg class="cc-ecg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path d="M0 24 ${beat(4)} ${beat(62)} ${beat(120)} L${w} 24"/></svg>`;
  }
  const doseRe = /^(.*?),?\s+(\d[\d,.]*\s?(?:IU|mg|mcg|g)\b.*)$/;
  function commandStage(s, sc, items, done, setsDone) {
    const vt = s.vitals, today = dayKey(), tg = targets(s.profile);
    const water = s.nutrition.water[today] || 0, wf = clamp(water / tg.water, 0, 1);
    const P = sc.parts;
    const parts = [['B', 'Biology', P.biology], ['R', 'Recovery', P.recovery], ['T', 'Training', P.training], ['N', 'Nutrition', P.nutrition], ['L', 'Life', P.life]];
    const tr = (vt.hrvTrend || []).filter((v) => v != null), tmax = Math.max(...tr), tmin = Math.min(...tr) * 0.8;
    const hrvBars = tr.map((v, i) => `<i style="height:${tmax > tmin ? (((v - tmin) / (tmax - tmin)) * 100).toFixed(0) : 50}%" class="${i === tr.length - 1 ? 'on' : ''}"></i>`).join('');
    const wpts = [0.04, 0.16, 0.22, 0.4, 0.5, 0.74, 1].map((f, i) => [i * 30, 46 - (f * wf * 40 + 3)]);
    const wline = smoothPath(wpts);
    const active = Math.round((vt.steps || 0) * 0.04 + setsDone * 9);
    const supps = items.filter((i) => i.cat === 'supplement').slice(0, 3).map((i) => {
      const m = i.title.match(doseRe), name = m ? m[1] : i.title, dose = m ? m[2] : '';
      return `<li><button class="cc-supp ${done[i.id] ? 'is-done' : ''}" data-act="proto-toggle" data-id="${esc(i.id)}" aria-pressed="${!!done[i.id]}">
        <span class="cc-supp-top"><b>${esc(name)}</b><span class="num">${esc(dose)}</span></span>
        <span class="cc-supp-sub">${done[i.id] ? 'Taken' : esc(i.time || '')} · ${esc((i.detail || '').split('.')[0])}</span></button></li>`;
    }).join('');
    const sync = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
    const SC = OS.Scan, systems = systemsOf(s, sc), fig = `${OS.anatomy.bodyMap(systems, null, 'go-sys')}<div class="cc-scan" aria-hidden="true"></div>`;
    return `<section class="cc-stage mode-${SC ? SC.mode : 'holo'}" aria-label="Body command center">
      <div class="cc-gridbg" aria-hidden="true"></div>
      <div class="cc-top"><p class="cc-hud" aria-hidden="true"><span class="cc-live"></span>MK-OS // ${SC && SC.mode === '3d' ? 'ANATOMY · BODYPARTS3D' : SC && SC.mode === 'camera' ? 'PROGRESS CAMERA' : SC && SC.mode === 'anatomy' ? 'ANATOMY LAYERS' : 'BODY SCAN'} · ${s.markers.length} MARKERS · SYNC ${sync}</p>${SC ? SC.modeSeg() : ''}</div>
      <div class="cc-fig">
        <div class="cc-orbit" aria-hidden="true"><i></i><i></i><i></i></div>
        ${SC ? SC.center(s, sc, systems, fig) : fig}
      </div>

      <button class="gc a-score" data-act="go" data-to="biology">
        <span class="gc-h">${icon('biology', 15)} MK Score</span>
        <span class="gc-bars gc-bars-l">${parts.map(([k, n, v]) => `<i style="height:${v == null ? 0 : v.toFixed(0)}%" title="${n} ${D(v, 0)}"><em>${k}</em></i>`).join('')}</span>
        <span class="gc-v"><b class="num">${D(sc.mk)}</b><small>/100</small></span>
      </button>

      <div class="gc a-ready">
        <span class="gc-h">${icon('today', 15)} Readiness</span>
        <span class="gc-bars">${hrvBars}</span>
        <span class="gc-v"><b class="num">${D(sc.readiness)}</b><small>/100</small></span>
        <span class="gc-f">${vt.hrv == null ? 'Connect a ring or strap' : `HRV ${vt.hrv} ms ${vs(vt.hrv, vt.hrvBase) ? '· ' + vs(vt.hrv, vt.hrvBase) : ''}`}</span>
      </div>

      <div class="gc a-hyd">
        <span class="gc-h">${icon('fuel', 15)} Hydration</span>
        <svg class="gc-area" viewBox="0 0 180 48" preserveAspectRatio="none" aria-hidden="true"><path class="fill" d="${wline} L180 48 L0 48 Z"/><path class="ln" d="${wline}"/></svg>
        <span class="gc-v"><b class="num">${(water / 1000).toFixed(water % 1000 ? 2 : 1).replace(/0$/, '')}</b><small>Liters</small></span>
        <span class="gc-row"><span class="gc-f">of ${(tg.water / 1000).toFixed(1)} L target</span><button class="gc-add" data-act="water" data-ml="250" aria-label="Log 250 ml of water">+250 ml</button></span>
      </div>

      <div class="gc a-hr">
        <span class="gc-h">${icon('biology', 15)} Resting HR</span>
        ${ecg()}
        <span class="gc-v"><b class="num">${D(vt.rhr)}</b><small>BPM</small></span>
        <span class="gc-f">${vt.rhr == null ? 'Connect a ring or strap' : `${vs(vt.rhr, vt.rhrBase).replace(' vs base', ' vs baseline')}${vt.sleepH == null ? '' : ' · sleep ' + vt.sleepH + ' h'}`}</span>
      </div>

      <div class="gc gc-dark a-supp">
        <span class="gc-h">Today's stack <span class="gc-tag">Protocol</span></span>
        <ul class="cc-supps">${supps || '<li class="gc-f">No supplements in today\'s protocol.</li>'}</ul>
      </div>

      <button class="gc a-cal" data-act="go" data-to="training">
        <span class="gc-h">${icon('training', 15)} Active cals</span>
        <span class="gc-v"><b class="num">${fmt(active)}</b><small>kcal</small></span>
        <span class="gc-f">${fmt(vt.steps)} steps · ${setsDone} sets done</span>
      </button>

      <p class="cc-hud cc-hud-b" aria-hidden="true">${s.vitals.src ? (/sample/.test(s.vitals.src) ? 'SAMPLE FEED · ' : 'LIVE DATA · ') : s.sample ? 'SAMPLE FEED · ' : ''}${Object.entries(s.wearables).filter(([, v]) => v).map(([k]) => k.toUpperCase()).join(' + ')} · TAP A MARKER TO OPEN ITS SYSTEM</p>
    </section>`;
  }
  const statusText = (st) => ({ online: 'Connected', idle: 'Idle', beta: 'Beta', planned: 'Planned', offline: 'Offline' }[st] || st);
  OS.statusText = statusText;

  function coachLine(s, sc) {
    const worst = [...sc.flagged].sort((a, b) => a.e.score - b.e.score)[0];
    const vt = s.vitals;
    const parts = [];
    if (sc.readiness == null) parts.push(sc.empty ? 'Welcome to Myo. Add your labs, connect a ring or strap, and log a session: your scores and daily plan build from your own data.' : 'Connect a ring or strap so Myo can read your readiness each morning.');
    else if (sc.readiness >= 75) parts.push(`HRV is ${vt.hrv - vt.hrvBase >= 0 ? 'up ' + (vt.hrv - vt.hrvBase) : 'down ' + (vt.hrvBase - vt.hrv)} ms on your baseline and you slept ${vt.sleepH} h, so today is a good day to push load on the APS Shoulder Press.`);
    else if (sc.readiness >= 60) parts.push(`Readiness is ${sc.readiness}. Keep today's working sets at RPE 7–8 and skip any top set.`);
    else parts.push(`Readiness is ${sc.readiness}. Swap the heavy session for mobility and Zone 2, then retest readiness tomorrow.`);
    if (worst) parts.push(`Your biggest lever in the labs is <b>${esc(worst.m.name)}</b> at ${worst.m.value} ${esc(worst.m.unit)} (optimal ${fmtR(worst.m.optimal)}).`);
    const arv = s.training.session.exercises[0];
    if (arv) parts.push('AR-Vision flagged left shoulder elevation last session. Do 2 sets of band external rotations before pressing.');
    return parts.join(' ');
  }
  OS.coachLine = coachLine;

  OS.act('proto-toggle', (el) => { const id = el.dataset.id, k = dayKey(); OS.update((s) => { s.protocolDone[k] = s.protocolDone[k] || {}; s.protocolDone[k][id] = !s.protocolDone[k][id]; }); });
  OS.act('go', (el) => OS.go(el.dataset.to));

  /* ═══ BIOLOGY ═════════════════════════════════════════════════════ */
  let sysFilter = 'All', editId = null;
  OS.register('biology', {
    title: 'Biology', icon: 'biology',
    mount(root) { return OS.Anatomy ? OS.Anatomy.mountAll(root) : undefined; },
    render(s, sc) {
      const systems = [...new Set(s.markers.map((m) => m.system))];
      const bySys = systemsOf(s, sc);
      const optimal = sc.markers.filter((x) => x.e.status === 'good').length, peakN = sc.peak;
      const due = s.labsDate ? dayKey(addDays(new Date(s.labsDate + 'T12:00:00'), s.retestDays)) : null;
      const daysLeft = due ? Math.round((new Date(due + 'T12:00:00') - new Date()) / 864e5) : null;
      const rows = sc.markers.filter((x) => sysFilter === 'All' || x.m.system === sysFilter).map(({ m, e }) => `
        <tr>
          <td><b>${esc(m.name)}</b><span class="muted small block">${esc(m.system)}</span></td>
          <td class="num">${editId === m.id
            ? `<form data-submit="marker-save" data-id="${m.id}" class="inline-edit"><label class="sr" for="mv-${m.id}">New value</label><input id="mv-${m.id}" name="v" type="number" step="any" value="${m.value ?? ''}" autofocus><button class="btn sm">Save</button></form>`
            : `<button class="valbtn" data-act="marker-edit" data-id="${m.id}" title="Edit value"><b>${D(m.value)}</b> <span class="muted">${esc(m.unit)}</span></button>`}</td>
          <td class="rcell">${rangeBar(m)}<span class="muted small">optimal ${fmtR(m.optimal)}</span></td>
          <td>${pill(e.tier === 'peak' ? 'peak' : e.status, e.label)}</td>
          <td class="tcell">${spark(m.history.map((h) => h[1]), 90, 26, { color: e.status === 'good' ? 'var(--good)' : e.status === 'warn' ? 'var(--warn)' : 'var(--bad)' })}</td>
        </tr>`).join('');
      const wear = [['oura', 'Oura Ring', 'Sleep, HRV, temperature'], ['whoop', 'WHOOP', 'Strain, recovery, HRV'], ['apple', 'Apple Health', 'Steps, workouts, HR'], ['garmin', 'Garmin Connect', 'Training load, VO2max']];
      return `${sampleBanner(s)}
      ${redFlagBanner(sc)}${head('Biology layer · labs → score → protocol → retest', 'Biomarkers', `${s.markers.length} markers across ${systems.length} systems · ${s.labsDate ? 'last labs ' + fmtDate(s.labsDate) : 'no labs yet: import a PDF or CSV below'}`,
        `<div class="hstat"><span>Biology score</span><b class="num">${D(sc.parts.biology, 0)}</b></div><div class="hstat"><span>At peak</span><b class="num">${peakN}/${s.markers.length}</b></div><div class="hstat"><span>Optimal+</span><b class="num">${optimal}/${s.markers.length}</b></div><div class="hstat"><span>Retest</span><b class="num">${daysLeft == null ? '—' : daysLeft > 0 ? daysLeft + ' d' : 'Due'}</b></div>`)}
      <div class="grid g-body">
        <section class="card holo body-card" aria-label="3D body">
          ${OS.Anatomy ? '<div class="a3d" data-a3d="compact" data-systems="skin,cardiovascular,digestive,urinary,endocrine"></div>' : OS.anatomy.bodyMap(bySys, sysFilter === 'All' ? null : sysFilter)}
        </section>
        <section class="card sys-detail">
          <p class="muted small">${bySys.filter((x) => x.status === 'good').length} of ${bySys.length} systems optimal · tap a marker on the body</p>
          <div class="sys-chips">
            <button class="schip ${sysFilter === 'All' ? 'on' : ''}" data-act="sys" data-sys="All">All systems</button>
            ${bySys.map((x) => `<button class="schip ${sysFilter === x.sy ? 'on' : ''}" data-act="sys" data-sys="${esc(x.sy)}"><i class="st-${x.status}"></i>${esc(x.sy)}</button>`).join('')}
          </div>
          ${(() => {
            const cur = bySys.find((x) => x.sy === sysFilter);
            const list = cur ? cur.xs : [...sc.flagged].sort((a, b) => a.e.score - b.e.score).slice(0, 5);
            return `<div class="sys-head"><div><span class="eyebrow">${cur ? 'System' : 'Biggest levers'}</span><h2 class="sys-name">${esc(cur ? cur.sy : 'Across all systems')}</h2></div>${cur ? pill(cur.status, cur.status === 'good' ? 'Optimal' : cur.status === 'warn' ? 'Near optimal' : 'Needs work') : ''}<b class="num sys-score">${D(cur ? cur.score : sc.parts.biology, 0)}</b></div>
            <ul class="sys-list">${list.map(({ m, e }) => `<li><div class="sys-li-h"><b>${esc(m.name)}</b>${pill(e.tier === 'peak' ? 'peak' : e.status, e.label)}</div>
              <div class="sys-kv"><span><em>Where you stand</em><b class="num">${D(m.value)} <small>${esc(m.unit)}</small></b></span><span><em>Optimal range</em><b class="num">${fmtR(m.optimal)} <small>${esc(m.unit)}</small></b></span></div>${rangeBar(m)}</li>`).join('') || `<li class="muted">${sc.markers.some((x) => x.e.score != null) ? 'Every marker in range.' : 'No lab results yet. Import them below.'}</li>`}</ul>`;
          })()}
        </section>
      </div>
      <section class="card flush">
        <div class="card-h pad"><h2>${esc(sysFilter === 'All' ? 'All biomarkers' : sysFilter)}</h2><span class="legend"><i class="lg-normal"></i>Lab normal <i class="lg-opt"></i>Optimal <i class="lg-peak"></i>Peak</span></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Marker</th><th>Value</th><th>Range</th><th>Status</th><th>Trend</th></tr></thead><tbody>${rows}</tbody></table></div>
      </section>
      <div class="grid g-2">
        <section class="card">
          <div class="card-h"><h2>Import lab results</h2><span class="muted small">PDF, CSV or pasted text</span></div>
          <p class="muted small">Choose a lab PDF (read on this device, never uploaded) or a CSV, or paste one marker per line: <code>name, value</code>. Works with Quest, Labcorp, Function Health or any panel. Names are matched to the ${s.markers.length} markers above.</p>
          <form data-submit="labs-import" class="stack-sm">
            <label class="sr" for="labs-text">Lab results</label>
            <textarea id="labs-text" name="t" rows="5" placeholder="Vitamin D, 38&#10;ApoB, 84&#10;hs-CRP, 0.9"></textarea>
            <div class="row"><label class="btn ghost file">${icon('upload', 16)} Choose file<input id="labs-file" type="file" accept=".pdf,.csv,.txt,application/pdf,text/csv,text/plain" data-change="labs-file"></label><label class="field-inline" for="labs-date">Draw date <input id="labs-date" name="d" type="date" value="${dayKey()}"></label><button class="btn">Import</button></div>
          </form>
        </section>
        <section class="card">
          <div class="card-h"><h2>Wearables</h2><a class="link small" href="#wearables">Connect Oura or WHOOP →</a></div>
          <ul class="wear">${wear.map(([id, n, d]) => `<li><div><b>${n}</b><span class="muted small block">${d}</span></div><button class="toggle" role="switch" aria-checked="${!!s.wearables[id]}" data-act="wear" data-id="${id}" aria-label="${n}"><span></span></button></li>`).join('')}</ul>
          <p class="fine">${s.vitals.src ? 'Readiness runs on ' + esc(s.vitals.src) + '.' : 'Readiness runs on sample vitals until you connect Oura or WHOOP on the Wearables page.'}</p>
        </section>
      </div>
      <p class="fine">Optimal and peak ranges follow performance and longevity research and sit well inside lab reference ranges. Peak is where the OS aims you.</p>`;
    }
  });
  OS.act('sys', (el) => { sysFilter = el.dataset.sys; OS.render(); });
  OS.act('go-sys', (el) => { sysFilter = el.dataset.sys; OS.go('biology'); });
  OS.act('marker-edit', (el) => { editId = el.dataset.id; OS.render(); });
  OS.act('marker-save', (form) => {
    const v = parseFloat(form.querySelector('input').value), id = form.dataset.id; editId = null;
    if (!isFinite(v)) return OS.render();
    OS.update((s) => { const m = s.markers.find((x) => x.id === id); m.value = v; const k = dayKey(); const h = m.history; if (h.length && h[h.length - 1][0] === k) h[h.length - 1][1] = v; else h.push([k, v]); });
    OS.toast('Marker updated. Protocol recalculated.');
  });
  OS.act('wear', (el) => OS.update((s) => { s.wearables[el.dataset.id] = !s.wearables[el.dataset.id]; }));
  // PDF lab reports: pdf.js reads the text on-device (no upload); each row becomes "name, value"
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  let pdfP = null;
  function loadPdf() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!pdfP) pdfP = new Promise((res, rej) => {
      const add = (src) => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error("Couldn't load the PDF reader. Check your connection.")); document.head.appendChild(s); });
      // the worker script runs on this page (pdf.js "fake worker"), since the page may not start workers from a CDN
      add(PDFJS + 'pdf.min.js').then(() => add(PDFJS + 'pdf.worker.min.js')).then(() => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; res(window.pdfjsLib); }).catch((e) => { pdfP = null; rej(e); });
    });
    return pdfP;
  }
  async function pdfToLines(file) {
    const lib = await loadPdf(), doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), disableWorker: true, isEvalSupported: false }).promise, out = [];
    for (let n = 1; n <= Math.min(doc.numPages, 20); n++) {
      const tc = await (await doc.getPage(n)).getTextContent(), rows = new Map();
      tc.items.forEach((it) => { const y = Math.round(it.transform[5] / 3); const r = rows.get(y) || []; r.push([it.transform[4], it.str]); rows.set(y, r); });
      [...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([, r]) => { const line = r.sort((a, b) => a[0] - b[0]).map((x) => x[1]).join(' ').replace(/\s+/g, ' ').trim(); if (line) out.push(line); });
    }
    return out;
  }
  OS.pdfToLines = pdfToLines; // shared with the Sleep page's report reader
  // "Vitamin D, 25-OH  38  ng/mL  30-100" → "Vitamin D, 25-OH, 38"
  const rowToPair = (line) => { const m = line.match(/^([A-Za-z][A-Za-z0-9 ()\-\/,.%+]*?[A-Za-z)])\s*[:,]?\s+([<>]?\s*\d+(?:\.\d+)?)(?:\s|$)/); return m ? `${m[1].replace(/,\s*$/, '')}, ${m[2].replace(/[<>\s]/g, '')}` : null; };
  OS.change('labs-file', async (el) => {
    const f = el.files && el.files[0]; if (!f) return;
    const ta = document.getElementById('labs-text');
    if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') {
      ta.value = 'Reading PDF on this device…';
      try { const pairs = (await pdfToLines(f)).map(rowToPair).filter(Boolean); ta.value = pairs.join('\n'); OS.toast(pairs.length ? `Found ${pairs.length} result rows. Check them, then Import.` : 'No result rows found in that PDF. Paste the values instead.'); }
      catch (e) { ta.value = ''; OS.toast(e.message || "Couldn't read that PDF."); }
      return;
    }
    const r = new FileReader(); r.onload = () => { ta.value = String(r.result).slice(0, 20000); }; r.readAsText(f);
  });
  const norm = (x) => x.toLowerCase().replace(/[^a-z0-9]/g, '');
  OS.act('labs-import', (form) => {
    const text = form.querySelector('textarea').value, date = form.querySelector('input[type=date]').value || dayKey();
    const hits = [], miss = [];
    OS.update((s) => {
      text.split(/\r?\n/).forEach((line) => {
        // the value must be a clean number; otherwise read the whole row ("Vitamin D, 25-Hydroxy 41 ng/mL 30-100")
        const clean = (p) => /^[<>]?\s*\d+(\.\d+)?$/.test(p);
        let parts = line.split(/[,\t;]/).map((p) => p.trim()).filter(Boolean);
        if (parts.length < 2 || !parts.slice(1).some(clean)) { const pr = rowToPair(line.replace(/[\t;]/g, ' ')); if (!pr) return; const i = pr.lastIndexOf(', '); parts = [pr.slice(0, i), pr.slice(i + 2)]; }
        const val = parseFloat((parts.slice(1).find(clean) || '').replace(/[<>\s]/g, ''));
        if (!isFinite(val)) return;
        const key = norm(parts[0]);
        const m = s.markers.find((mm) => norm(mm.name) === key || norm(mm.id) === key || mm.aliases.some((a) => norm(a) === key)) ||
                  s.markers.find((mm) => key.length > 3 && (norm(mm.name).includes(key) || key.includes(norm(mm.name)))) ||
                  s.markers.map((mm) => [mm, Math.max(0, ...mm.aliases.map((a) => norm(a)).filter((a) => a.length > 3 && key.includes(a)).map((a) => a.length))]).filter((x) => x[1]).sort((a, b) => b[1] - a[1]).map((x) => x[0])[0];
        if (!m) { miss.push(parts[0]); return; }
        m.value = val; m.history.push([date, val]); m.history.sort((a, b) => a[0].localeCompare(b[0])); hits.push(m.name);
      });
      if (hits.length) { s.labsDate = !s.labsDate || date > s.labsDate ? date : s.labsDate; s.fresh = false; s.sample = false; s.labsImported = date; }
    });
    OS.toast(hits.length ? `Imported ${hits.length} marker${hits.length > 1 ? 's' : ''}${miss.length ? `. Not matched: ${miss.slice(0, 3).join(', ')}` : ''}.` : 'No markers matched. Use one "name, value" per line.');
  });

  /* ═══ FUEL ════════════════════════════════════════════════════════ */
  OS.register('fuel', {
    title: 'Fuel', icon: 'fuel',
    render(s, sc) {
      const k = dayKey(), tg = targets(s.profile);
      const meals = s.nutrition.meals[k] || [];
      const sum = meals.reduce((a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f }), { kcal: 0, p: 0, c: 0, f: 0 });
      const water = s.nutrition.water[k] || 0;
      const macro = (n, v, t, u) => `<div class="macro"><div class="macro-h"><span>${n}</span><b class="num">${fmt(v)}<small> / ${fmt(t)} ${u}</small></b></div><span class="sbar-track lg"><span style="width:${clamp(v / t * 100, 0, 100).toFixed(0)}%"></span></span></div>`;
      const supps = protocol(s, sc).filter((i) => i.cat === 'supplement');
      const done = s.protocolDone[k] || {};
      const presets = [['Whey shake', 140, 25, 4, 2], ['Chicken breast 6 oz', 280, 52, 0, 6], ['Rice, 1 cup', 205, 4, 45, 0], ['Eggs ×3', 215, 18, 1, 15], ['Greek yogurt', 150, 20, 8, 4], ['Banana', 105, 1, 27, 0]];
      const week = [-6, -5, -4, -3, -2, -1, 0].map((d) => { const ms = s.nutrition.meals[dayKey(addDays(new Date(), d))] || []; return ms.reduce((a, m) => a + m.p, 0); });
      return `${head('Nutrition · hydration · supplements', 'Fuel', `Targets for ${s.profile.weightKg} kg, goal: ${esc({ cut: 'fat loss', recomp: 'recomposition', gain: 'muscle gain' }[s.profile.goal])}`, `<div class="hstat"><span>Nutrition score</span><b class="num">${D(sc.parts.nutrition, 0)}</b></div>`)}
      <div class="grid g-2-1">
        <section class="card">
          <div class="card-h"><h2>Today</h2><span class="num muted">${fmt(sum.kcal)} / ${fmt(tg.kcal)} kcal</span></div>
          <div class="macros">${macro('Protein', sum.p, tg.p, 'g')}${macro('Carbs', sum.c, tg.c, 'g')}${macro('Fat', sum.f, tg.f, 'g')}${macro('Energy', sum.kcal, tg.kcal, 'kcal')}</div>
          <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Meal</th><th class="r">kcal</th><th class="r">P</th><th class="r">C</th><th class="r">F</th><th></th></tr></thead>
          <tbody>${meals.map((m) => `<tr><td>${esc(m.name)}</td><td class="r num">${m.kcal}</td><td class="r num">${m.p}</td><td class="r num">${m.c}</td><td class="r num">${m.f}</td><td class="r"><button class="icon-btn" data-act="meal-del" data-id="${m.id}" aria-label="Remove ${esc(m.name)}">${icon('x', 14)}</button></td></tr>`).join('') || '<tr><td colspan="6" class="muted">No meals logged yet today.</td></tr>'}</tbody></table></div>
          <form data-submit="meal-add" class="meal-form">
            <label class="sr" for="meal-n">Meal</label><input id="meal-n" name="n" placeholder="Meal name" required>
            <label class="sr" for="meal-k">kcal</label><input id="meal-k" name="k" type="number" min="0" placeholder="kcal" required>
            <label class="sr" for="meal-p">Protein</label><input id="meal-p" name="p" type="number" min="0" placeholder="P g">
            <label class="sr" for="meal-c">Carbs</label><input id="meal-c" name="c" type="number" min="0" placeholder="C g">
            <label class="sr" for="meal-f">Fat</label><input id="meal-f" name="f" type="number" min="0" placeholder="F g">
            <button class="btn">${icon('plus', 16)} Log</button>
          </form>
          <div class="presets"><span class="muted small">Quick add</span>${presets.map((p, i) => `<button class="chip-btn" data-act="meal-preset" data-i="${i}">${esc(p[0])}</button>`).join('')}</div>
        </section>
        <div class="stack">
          <section class="card">
            <div class="card-h"><h2>Hydration</h2><span class="num muted">${fmt(water)} / ${fmt(tg.water)} ml</span></div>
            <div class="water"><div class="water-fill" style="height:${clamp(water / tg.water * 100, 0, 100).toFixed(0)}%"></div><b class="num">${Math.round(water / tg.water * 100)}%</b></div>
            <div class="row center"><button class="btn ghost" data-act="water" data-ml="-250">−250</button><button class="btn" data-act="water" data-ml="250">+250 ml</button><button class="btn" data-act="water" data-ml="500">+500 ml</button></div>
          </section>
          <section class="card">
            <div class="card-h"><h2>Supplement stack</h2><span class="muted small">From protocol</span></div>
            <ul class="supp">${supps.map((i) => `<li class="${done[i.id] ? 'is-done' : ''}"><button class="check" data-act="proto-toggle" data-id="${i.id}" aria-pressed="${!!done[i.id]}" aria-label="Mark ${esc(i.title)} taken">${icon('check', 14)}</button><div><b>${esc(i.title)}</b><span class="muted small block">${esc(i.time)}</span></div></li>`).join('') || '<li class="muted">No supplements indicated by your labs.</li>'}</ul>
          </section>
          <section class="card"><div class="card-h"><h2>Protein, 7 days</h2><span class="muted small">target ${tg.p} g</span></div>${spark(week, 260, 60, { min: 0 })}</section>
        </div>
      </div>`;
    }
  });
  const PRESETS = [['Whey shake', 140, 25, 4, 2], ['Chicken breast 6 oz', 280, 52, 0, 6], ['Rice, 1 cup', 205, 4, 45, 0], ['Eggs ×3', 215, 18, 1, 15], ['Greek yogurt', 150, 20, 8, 4], ['Banana', 105, 1, 27, 0]];
  const addMeal = (m) => OS.update((s) => { const k = dayKey(); (s.nutrition.meals[k] = s.nutrition.meals[k] || []).push({ id: OS.uid(), ...m }); });
  OS.act('meal-add', (f) => { const g = (n) => Math.max(0, parseFloat(f.elements[n].value) || 0); addMeal({ name: f.elements.n.value.trim() || 'Meal', kcal: g('k'), p: g('p'), c: g('c'), f: g('f') }); OS.toast('Meal logged'); });
  OS.act('meal-preset', (el) => { const p = PRESETS[+el.dataset.i]; addMeal({ name: p[0], kcal: p[1], p: p[2], c: p[3], f: p[4] }); });
  OS.act('meal-del', (el) => OS.update((s) => { const k = dayKey(); s.nutrition.meals[k] = (s.nutrition.meals[k] || []).filter((m) => m.id !== el.dataset.id); }));
  OS.act('water', (el) => OS.update((s) => { const k = dayKey(); s.nutrition.water[k] = Math.max(0, (s.nutrition.water[k] || 0) + +el.dataset.ml); }));

  /* ═══ LIFE ════════════════════════════════════════════════════════ */
  let breath = null;
  OS.register('life', {
    title: 'Life', icon: 'life',
    render(s, sc) {
      const k = dayKey();
      const days = Array.from({ length: 7 }, (_, i) => dayKey(addDays(new Date(), i - 6)));
      const blocks = [...s.life.blocks].sort((a, b) => a.t.localeCompare(b.t));
      const now = new Date(), mins = now.getHours() * 60 + now.getMinutes();
      const toM = (t) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
      const streak = (h) => { let n = 0; for (let i = 0; i < 365; i++) { if (h.log[dayKey(addDays(new Date(), -i))]) n++; else if (i > 0) break; } return n; };
      const mood = s.life.mood[k] || {};
      const scale = (key, label, val) => `<div class="scale"><span>${label}</span><div class="seg" role="group" aria-label="${label}">${[1, 2, 3, 4, 5].map((n) => `<button class="${val === n ? 'on' : ''}" data-act="mood" data-k="${key}" data-v="${n}" aria-pressed="${val === n}">${n}</button>`).join('')}</div></div>`;
      return `${head('Schedule · habits · goals · mind', 'Life', 'Your day, built around training and recovery', `<div class="hstat"><span>Life score</span><b class="num">${D(sc.parts.life, 0)}</b></div>`)}
      <div class="grid g-2-1">
        <section class="card">
          <div class="card-h"><h2>Day plan</h2><span class="muted small">${blocks.length} blocks</span></div>
          <ol class="timeline">${blocks.map((b) => { const st = toM(b.t), en = st + b.dur; const live = mins >= st && mins < en; const past = mins >= en; return `<li class="tl ${live ? 'live' : ''} ${past ? 'past' : ''}"><span class="tl-t num">${b.t}</span><span class="tl-dot dot-${b.cat}"></span><div class="tl-b">${catChip(b.cat)}<p>${esc(b.title)}</p><span class="muted small num">${b.dur} min</span></div><button class="icon-btn" data-act="block-del" data-id="${b.id}" aria-label="Remove ${esc(b.title)}">${icon('x', 14)}</button></li>`; }).join('')}</ol>
          <form data-submit="block-add" class="block-form">
            <label class="sr" for="blk-t">Start</label><input id="blk-t" name="t" type="time" value="${String(now.getHours() + 1).padStart(2, '0').slice(-2)}:00" required>
            <label class="sr" for="blk-d">Minutes</label><input id="blk-d" name="d" type="number" min="5" step="5" value="30" required>
            <label class="sr" for="blk-n">Title</label><input id="blk-n" name="n" placeholder="What's the block?" required>
            <label class="sr" for="blk-c">Category</label><select id="blk-c" name="c">${['work', 'move', 'fuel', 'sleep', 'mind', 'life'].map((c) => `<option value="${c}">${CAT[c]}</option>`).join('')}</select>
            <button class="btn">${icon('plus', 16)} Add</button>
          </form>
        </section>
        <div class="stack">
          <section class="card">
            <div class="card-h"><h2>Check-in</h2><span class="muted small">Today</span></div>
            ${scale('mood', 'Mood', mood.mood)}${scale('stress', 'Stress', mood.stress)}
          </section>
          <section class="card breath-card">
            <div class="card-h"><h2>Box breathing</h2><span class="muted small">4 · 4 · 4 · 4</span></div>
            <div class="breath"><div class="breath-orb" id="orb"></div><span id="breath-label">Ready</span></div>
            <button class="btn" data-act="breath" id="breath-btn">${icon('play', 16)} Start 5 min</button>
          </section>
        </div>
      </div>
      <div class="grid g-2">
        <section class="card">
          <div class="card-h"><h2>Habits</h2><span class="muted small">Last 7 days</span></div>
          <div class="habits"><div class="hab-days"><span></span>${days.map((d) => `<span class="small muted">${new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'narrow' })}</span>`).join('')}<span class="small muted">Streak</span></div>
          ${s.life.habits.map((h) => `<div class="hab-row"><span class="hab-n">${esc(h.name)}</span>${days.map((d) => `<button class="hab-cell ${h.log[d] ? 'on' : ''}" data-act="habit" data-id="${h.id}" data-day="${d}" aria-pressed="${!!h.log[d]}" aria-label="${esc(h.name)} on ${fmtDate(d)}"></button>`).join('')}<b class="num">${streak(h)}</b></div>`).join('')}</div>
          <form data-submit="habit-add" class="row"><label class="sr" for="hab-n">New habit</label><input id="hab-n" name="n" placeholder="New habit" required><button class="btn ghost">${icon('plus', 16)} Add habit</button></form>
        </section>
        <section class="card">
          <div class="card-h"><h2>Goals</h2><span class="muted small">Linked to labs and training</span></div>
          <ul class="goals">${s.life.goals.map((g) => { const pct = clamp((g.progress - g.start) / (g.target - g.start) * 100, 0, 100); return `<li><div class="goal-h"><b>${esc(g.name)}</b><span class="num">${g.progress} → ${g.target} ${esc(g.unit)}</span></div><span class="sbar-track lg"><span style="width:${pct.toFixed(0)}%"></span></span><div class="goal-ctl"><span class="muted small num">${pct.toFixed(0)}%</span><button class="icon-btn" data-act="goal" data-id="${g.id}" data-d="-1" aria-label="Decrease">−</button><button class="icon-btn" data-act="goal" data-id="${g.id}" data-d="1" aria-label="Increase">+</button></div></li>`; }).join('')}</ul>
        </section>
      </div>`;
    },
    mount() { return () => { if (breath) { clearInterval(breath.t); breath = null; } }; }
  });
  OS.act('block-add', (f) => OS.update((s) => s.life.blocks.push({ id: OS.uid(), t: f.elements.t.value, dur: +f.elements.d.value || 30, title: f.elements.n.value.trim(), cat: f.elements.c.value })));
  OS.act('block-del', (el) => OS.update((s) => { s.life.blocks = s.life.blocks.filter((b) => b.id !== el.dataset.id); }));
  OS.act('habit', (el) => OS.update((s) => { const h = s.life.habits.find((x) => x.id === el.dataset.id); h.log[el.dataset.day] = !h.log[el.dataset.day]; if (!h.log[el.dataset.day]) delete h.log[el.dataset.day]; }));
  OS.act('habit-add', (f) => OS.update((s) => s.life.habits.push({ id: OS.uid(), name: f.elements.n.value.trim(), cat: 'life', log: {} })));
  OS.act('goal', (el) => OS.update((s) => { const g = s.life.goals.find((x) => x.id === el.dataset.id); const step = Math.abs(g.target - g.start) > 20 ? 5 : Math.abs(g.target - g.start) > 4 ? 1 : 0.1; g.progress = Math.round((g.progress + step * +el.dataset.d) * 10) / 10; }));
  OS.act('mood', (el) => OS.update((s) => { const k = dayKey(); s.life.mood[k] = s.life.mood[k] || {}; s.life.mood[k][el.dataset.k] = +el.dataset.v; }));
  OS.act('breath', () => {
    const lbl = document.getElementById('breath-label'), orb = document.getElementById('orb'), btn = document.getElementById('breath-btn');
    if (breath) { clearInterval(breath.t); breath = null; lbl.textContent = 'Ready'; orb.style.transform = 'scale(.55)'; btn.innerHTML = icon('play', 16) + ' Start 5 min'; return; }
    const phases = [['Breathe in', 1], ['Hold', 1], ['Breathe out', 0.55], ['Hold', 0.55]];
    let i = 0, sec = 0; const end = Date.now() + 300000;
    const tick = () => {
      if (Date.now() > end) { OS.acts.breath(); OS.toast('Breathwork done'); return; }
      const ph = phases[Math.floor(i / 4) % 4]; lbl.textContent = `${ph[0]} · ${4 - (i % 4)}`; orb.style.transform = `scale(${ph[1]})`; i++; sec++;
    };
    breath = { t: setInterval(tick, 1000) }; tick(); btn.innerHTML = icon('pause', 16) + ' Stop';
  });

  /* ═══ PROFILE (hidden route) ══════════════════════════════════════ */
  OS.register('profile', {
    title: 'Profile', icon: 'user', hidden: true,
    render(s) {
      const p = s.profile, mode = OS.Persist.mode;
      const f = (id, label, input) => `<label class="field" for="${id}"><span>${label}</span>${input}</label>`;
      return `${head('Member', 'Profile and data', '')}
      ${OS.auth ? OS.auth.card() : ''}
      <div class="grid g-2">
        <section class="card">
          <div class="card-h"><h2>About you</h2></div>
          <form data-submit="profile-save" class="form-grid">
            ${f('pf-name', 'Name', `<input id="pf-name" name="name" value="${esc(p.name)}">`)}
            ${f('pf-age', 'Age', `<input id="pf-age" name="age" type="number" min="14" max="99" value="${p.age}">`)}
            ${f('pf-sex', 'Sex (for reference ranges)', `<select id="pf-sex" name="sex"><option value="M" ${p.sex === 'M' ? 'selected' : ''}>Male</option><option value="F" ${p.sex === 'F' ? 'selected' : ''}>Female</option></select>`)}
            ${f('pf-w', 'Weight (kg)', `<input id="pf-w" name="w" type="number" step="0.1" value="${p.weightKg}">`)}
            ${f('pf-h', 'Height (cm)', `<input id="pf-h" name="h" type="number" value="${p.heightCm}">`)}
            ${f('pf-goal', 'Goal', `<select id="pf-goal" name="goal">${[['cut', 'Fat loss'], ['recomp', 'Recomposition'], ['gain', 'Muscle gain']].map(([v, l]) => `<option value="${v}" ${p.goal === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
            ${f('pf-act', 'Activity level', `<select id="pf-act" name="act">${[[1.375, 'Light'], [1.55, 'Moderate'], [1.725, 'High'], [1.9, 'Athlete']].map(([v, l]) => `<option value="${v}" ${p.activity == v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
            <div class="form-end"><button class="btn">Save profile</button></div>
          </form>
        </section>
        <section class="card">
          <div class="card-h"><h2>Your data</h2></div>
          <p class="fine"><b>Terms.</b> ${esc(OS.TERMS)}</p>
          <p>${mode === 'cloud' ? 'Synced to your Myo account. Only you can read your row, on any device where you sign in.' : mode === 'account' ? 'Saved privately to your Claude account. Only you can read it, on any device.' : mode === 'device' ? (OS.auth && OS.auth.url && !(window.claude && window.claude.use) ? 'Saved in this browser only. Sign in to your Myo account above to sync it to your other devices.' : 'Saved in this browser only. Open the app in Claude while signed in to sync it to your account.') : 'Storage is unavailable in this view. Changes last until you close the page.'}</p>
          ${s.sample ? (freshAsk ? freshConfirm() : '<div class="row"><button class="btn" data-act="fresh-ask">Start with my own data</button></div>') : ''}
          <div class="row"><button class="btn ghost" data-act="reset-ask">${s.sample ? 'Reset the sample' : 'Reset to sample data'}</button></div>
          <div id="reset-confirm" hidden class="confirm"><p>This replaces everything you've logged with the sample member${OS.auth && OS.auth.user ? ', on this device and in your Myo account' : ''}. You can't undo it.</p><div class="row"><button class="btn danger" data-act="reset">Replace my data</button><button class="btn ghost" data-act="reset-cancel">Keep my data</button></div></div>
        </section>
      </div>
      ${OS.rights ? OS.rights.card(s) : ''}`;
    }
  });
  OS.act('profile-save', (f) => {
    const e = f.elements;
    OS.update((s) => { const p = s.profile; p.name = e.name.value.trim() || p.name; p.initials = p.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(); p.age = +e.age.value || p.age; p.sex = e.sex.value; p.weightKg = +e.w.value || p.weightKg; p.heightCm = +e.h.value || p.heightCm; p.goal = e.goal.value; p.activity = +e.act.value; s.sample = false; });
    OS.toast('Profile saved. Targets recalculated.');
  });
  OS.act('reset-ask', () => { document.getElementById('reset-confirm').hidden = false; });
  OS.act('reset-cancel', () => { document.getElementById('reset-confirm').hidden = true; });
  OS.act('reset', () => { OS.state = OS.seed(); OS.Persist.save(OS.state); OS.go('today'); OS.toast('Sample data restored'); });

  OS.ui = { head, catChip, sampleBanner, fmtR, systemsOf };
})();
