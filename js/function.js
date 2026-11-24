/* ═══ MYO — HUMAN FUNCTION: movement · mind · behaviour, measured and analysed ═══
   Real measurements: in-browser tests (reaction time, finger tapping, digit span, single-leg balance),
   daily check-ins (mood, energy, stress, focus, optional note), plus data already in the OS: posture from
   scans, training consistency, steps, sleep, habit and protocol adherence. Myo analyses the patterns.
   Safety: very low mood or crisis language shows the 988 Suicide & Crisis Lifeline. */
(function () {
  'use strict';
  const { esc, pill, icon, clamp, dayKey, addDays } = OS;
  const CRISIS = /suicid|kill myself|end (it|my life)|self[- ]?harm|hurt myself|don'?t want to (live|be here)/i;

  function ensure(s) {
    if (!s.fn) {
      s.fn = { checkins: [], tests: [], analysis: null, shareNotes: false };
      if (s.sample) {
        const k = (d) => dayKey(addDays(new Date(), d));
        [[4, 4, 2, 4], [3, 3, 3, 3], [4, 4, 2, 4], [5, 4, 2, 5], [3, 3, 4, 3], [4, 4, 3, 4]].forEach(([m, e, st, f], i) => s.fn.checkins.push({ d: k(i - 6), mood: m, energy: e, stress: st, focus: f, note: '' }));
        s.fn.tests.push({ t: 'rt', v: 274, d: k(-3) }, { t: 'tap', v: 58, d: k(-3) }, { t: 'span', v: 7, d: k(-2) }, { t: 'bal', v: 31, d: k(-2) });
        s.fn.sampleSeed = true;
      }
    }
    return s.fn;
  }
  const latest = (F, t) => [...F.tests].reverse().find((x) => x.t === t);
  const TESTS = {
    rt: { n: 'Reaction time', u: 'ms', score: (v) => clamp(100 - (v - 220) / 3.2, 10, 100), how: 'Tap the panel the instant it turns cyan. Five trials; Myo keeps the median.' },
    tap: { n: 'Finger tapping', u: 'taps / 10 s', score: (v) => clamp((v / 65) * 100, 10, 100), how: 'Tap the pad as fast as you can with one finger for 10 seconds.' },
    span: { n: 'Digit span', u: 'digits', score: (v) => clamp(((v - 3) / 6) * 100, 10, 100), how: 'Watch the digits, then type them back. Each round adds one.' },
    bal: { n: 'Single-leg balance', u: 's, eyes open', score: (v) => clamp((v / 45) * 100, 10, 100), how: 'Stand on one leg, hands on hips. Start the timer, stop it when your foot touches down. Stop at 60 s.' }
  };

  function summary(s, sc) {
    sc = sc || OS.scores(s); const F = ensure(s), k7 = [...Array(7)].map((_, i) => dayKey(addDays(new Date(), -i)));
    const ts = (t) => { const x = latest(F, t); return x ? TESTS[t].score(x.v) : null; };
    const avg = (xs) => { const v = xs.filter((x) => x != null && !isNaN(x)); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
    const scan = OS.Scan && OS.Scan.photos && [...OS.Scan.photos].reverse().find((x) => x.metrics);
    const posture = scan ? Math.round(scan.metrics.items.filter((x) => x.status === 'good').length / Math.max(1, scan.metrics.items.filter((x) => x.status !== 'info').length) * 100) : null;
    const trainDays = new Set(s.training.log.filter((l) => l.date >= dayKey(addDays(new Date(), -14))).map((l) => l.date)).size;
    const ci = F.checkins.slice(-7);
    const mind = ci.length ? Math.round(ci.reduce((a, c) => a + ((c.mood + c.energy + c.focus + (6 - c.stress)) / 4 - 1) / 4 * 100, 0) / ci.length) : null;
    const habitPct = s.life.habits.length ? Math.round(s.life.habits.reduce((a, h) => a + k7.filter((d) => h.log[d]).length, 0) / (s.life.habits.length * 7) * 100) : null;
    const protoDays = k7.filter((d) => Object.values(s.protocolDone[d] || {}).filter(Boolean).length >= 2).length;
    const sleepReg = s.vitals.sleepH == null ? null : clamp(100 - Math.abs(s.vitals.sleepH - 8) * 25, 0, 100);
    const dims = {
      movement: avg([posture, ts('bal'), ts('tap'), clamp(s.vitals.steps / 100, 0, 100), clamp(trainDays / 8 * 100, 0, 100)]),
      cognition: avg([ts('rt'), ts('span')]),
      mind, behaviour: avg([habitPct, Math.round(protoDays / 7 * 100), sleepReg]), recovery: sc.readiness
    };
    const overall = avg(Object.values(dims));
    return { overall, dims, posture, trainDays, habitPct, protoDays, steps: s.vitals.steps, tests: F.tests.length, latest: Object.fromEntries(Object.keys(TESTS).map((t) => [t, latest(F, t) ? latest(F, t).v : null])), checkins: ci.map((c) => ({ d: c.d, mood: c.mood, energy: c.energy, stress: c.stress, focus: c.focus })) };
  }
  const tone = (n) => (n == null ? 'muted' : n >= 85 ? 'peak' : n >= 70 ? 'good' : n >= 55 ? 'warn' : 'bad');

  /* ── test runners (module state survives re-render) ──────────────── */
  const R = { test: null, phase: 'idle', trials: [], t0: 0, timer: 0, taps: 0, seq: '', span: 4, miss: 0, best: 0, show: '' };
  const stopTimers = () => { clearTimeout(R.timer); clearInterval(R.iv); };
  function save(t, v) { OS.update((s) => { const F = ensure(s); F.tests.push({ t, v: Math.round(v), d: dayKey() }); F.tests = F.tests.slice(-120); }); OS.toast(`${TESTS[t].n}: ${Math.round(v)} ${TESTS[t].u}. Saved.`); }
  function panel() {
    if (!R.test) return `<div class="fn-pad idle"><p>Pick a test above.</p></div>`;
    const T = TESTS[R.test];
    if (R.test === 'rt') return `<button class="fn-pad ${R.phase}" data-act="fn-rt-hit" aria-live="polite">${R.phase === 'idle' ? `<b>Start</b><span>${esc(T.how)}</span>` : R.phase === 'wait' ? '<b>Wait for cyan…</b>' : R.phase === 'go' ? '<b>TAP!</b>' : R.phase === 'early' ? '<b>Too soon</b><span>Tap to try again</span>' : `<b>${R.trials[R.trials.length - 1]} ms</b><span>Trial ${R.trials.length} of 5 · tap for next</span>`}</button>`;
    if (R.test === 'tap') return `<button class="fn-pad ${R.phase}" data-act="fn-tap-hit">${R.phase === 'idle' ? `<b>Start</b><span>${esc(T.how)}</span>` : R.phase === 'run' ? `<b class="num">${R.taps}</b><span id="fn-tap-left">10.0 s</span>` : `<b class="num">${R.taps}</b><span>taps in 10 s · tap to retry</span>`}</button>`;
    if (R.test === 'span') return `<div class="fn-pad ${R.phase}">${R.phase === 'idle' ? `<b>Ready?</b><span>${esc(T.how)}</span><button class="btn sm" data-act="fn-span-go">Start</button>` : R.phase === 'show' ? `<b class="fn-digit num">${esc(R.show)}</b><span>${R.span} digits</span>` : R.phase === 'input' ? `<form data-submit="fn-span-ans" class="row"><input name="a" inputmode="numeric" autocomplete="off" aria-label="Type the digits" class="fn-in"><button class="btn sm">Check</button></form><span>Type the ${R.span} digits</span>` : `<b class="num">${R.best}</b><span>longest span · </span><button class="btn ghost sm" data-act="fn-span-go">Again</button>`}</div>`;
    if (R.test === 'bal') return `<button class="fn-pad ${R.phase}" data-act="fn-bal-hit">${R.phase === 'idle' ? `<b>Start timer</b><span>${esc(T.how)}</span>` : R.phase === 'run' ? '<b id="fn-bal-t" class="num">0.0 s</b><span>Tap when your foot touches down</span>' : `<b class="num">${R.last} s</b><span>tap to retry</span>`}</button>`;
    return '';
  }
  const repaint = () => { const el = document.getElementById('fn-panel'); if (el) el.innerHTML = panel(); };

  OS.register('function', {
    title: 'Function', icon: 'function',
    render(s, sc) {
      const F = ensure(s), S = summary(s, sc), last = F.checkins[F.checkins.length - 1];
      const crisis = last && (last.mood <= 1 || CRISIS.test(last.note || ''));
      const D = [['movement', 'Movement'], ['cognition', 'Cognition'], ['mind', 'Mood & mind'], ['behaviour', 'Behaviour'], ['recovery', 'Recovery']];
      const k14 = [...Array(14)].map((_, i) => dayKey(addDays(new Date(), i - 13)));
      const today = F.checkins.find((c) => c.d === dayKey()) || { mood: 3, energy: 3, stress: 3, focus: 3, note: '' };
      const sl = (k, l, lo, hi) => `<label class="field fn-sl"><span>${l} <em>${lo} → ${hi}</em></span><input type="range" min="1" max="5" step="1" name="${k}" value="${today[k]}" aria-label="${l}"></label>`;
      const spark = (vals) => { if (vals.length < 2) return ''; const w = 160, h = 34, mx = Math.max(...vals), mn = Math.min(...vals), r = mx - mn || 1; return `<svg viewBox="0 0 ${w} ${h}" class="fn-spark" aria-hidden="true"><polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - 4 - ((v - mn) / r) * (h - 8)}`).join(' ')}"/></svg>`; };
      const plan = F.analysis;
      return `${OS.ui.head('Movement · thoughts · behaviour', 'Human Function', 'How you move, think, feel and act, measured with real tests and your own data, then read by Myo.',
        `<div class="hstat"><span>Function score</span><b class="num">${S.overall ?? '—'}</b></div><div class="hstat"><span>Tests logged</span><b class="num">${S.tests}</b></div>`)}
      ${crisis ? `<div class="banner bad" role="alert"><strong>You don't have to carry this alone.</strong> If you're thinking about suicide or self-harm, call or text <b>988</b> (Suicide & Crisis Lifeline, US) now, or your local emergency number. Optimisation can wait.</div>` : ''}
      ${F.sampleSeed && s.sample ? '<div class="banner" role="note"><strong>Sample history.</strong> The sample member has a week of check-ins and tests so you can see the analysis. Take a test or check in to add your own.</div>' : ''}
      <div class="grid g-2-1">
        <section class="card"><div class="card-h"><h2>Function profile</h2><span class="muted small">0–100</span></div>
          <div class="lg-pils">${D.map(([k, l]) => `<div class="lg-pil"><div class="lg-pil-h"><span>${l}</span><b class="num">${S.dims[k] ?? '—'}</b></div><div class="lg-bar"><i class="t-${tone(S.dims[k])}" style="width:${S.dims[k] ?? 0}%"></i></div></div>`).join('')}</div></section>
        <section class="card"><div class="card-h"><h2>Today's check-in</h2><span class="muted small">${F.checkins.some((c) => c.d === dayKey()) ? 'Saved' : 'Not yet'}</span></div>
          <form data-submit="fn-checkin" class="fn-ci">${sl('mood', 'Mood', 'low', 'great')}${sl('energy', 'Energy', 'drained', 'charged')}${sl('stress', 'Stress', 'calm', 'overloaded')}${sl('focus', 'Focus', 'scattered', 'locked in')}
            <label class="field"><span>What's on your mind <em>optional, stays private</em></span><textarea name="note" rows="2" maxlength="500">${esc(today.note || '')}</textarea></label>
            <label class="ped-use"><input type="checkbox" name="share" ${F.shareNotes ? 'checked' : ''}> Let Myo read my notes when analysing</label>
            <button class="btn sm">Save check-in</button></form></section>
      </div>
      <section class="card"><div class="card-h"><h2>Function tests</h2><span class="muted small">Real measurements, about a minute each</span></div>
        <div class="fn-tests">${Object.entries(TESTS).map(([k, T]) => { const x = latest(F, k), hist = F.tests.filter((y) => y.t === k).slice(-8).map((y) => y.v); return `<button class="fn-t ${R.test === k ? 'on' : ''}" data-act="fn-pick" data-t="${k}"><b>${T.n}</b><span class="num">${x ? `${x.v} ${T.u}` : 'Not taken'}</span>${spark(hist)}</button>`; }).join('')}</div>
        <div id="fn-panel">${panel()}</div></section>
      <div class="grid g-3">
        <section class="card"><div class="card-h"><h2>Movement</h2></div><ul class="sees">
          <li><span>Posture (latest scan)</span><b class="num">${S.posture != null ? S.posture + '%' : '—'}</b></li><li><span>Steps today</span><b class="num">${OS.fmt(S.steps)}</b></li>
          <li><span>Training days, 14 d</span><b class="num">${S.trainDays}</b></li><li><span>Balance</span><b class="num">${S.latest.bal ?? '—'} s</b></li></ul>
          <a class="link small" href="#ar">Check live form in AR-Vision →</a></section>
        <section class="card"><div class="card-h"><h2>Thoughts and mind</h2></div><ul class="sees">
          <li><span>Reaction time</span><b class="num">${S.latest.rt ?? '—'} ms</b></li><li><span>Digit span</span><b class="num">${S.latest.span ?? '—'}</b></li>
          <li><span>Mood, 7 d avg</span><b class="num">${S.checkins.length ? (S.checkins.reduce((a, c) => a + c.mood, 0) / S.checkins.length).toFixed(1) : '—'}/5</b></li><li><span>Stress, 7 d avg</span><b class="num">${S.checkins.length ? (S.checkins.reduce((a, c) => a + c.stress, 0) / S.checkins.length).toFixed(1) : '—'}/5</b></li></ul>
          <div class="fn-heat">${k14.map((d) => { const c = F.checkins.find((x) => x.d === d); return `<i title="${d}${c ? ` · mood ${c.mood}/5` : ''}" class="${c ? 'm' + c.mood : ''}"></i>`; }).join('')}</div><p class="fine">Mood, last 14 days.</p></section>
        <section class="card"><div class="card-h"><h2>Behaviour</h2></div><ul class="sees">
          <li><span>Habits kept, 7 d</span><b class="num">${S.habitPct ?? '—'}%</b></li><li><span>Protocol days, 7 d</span><b class="num">${S.protoDays}/7</b></li>
          <li><span>Sleep</span><b class="num">${OS.dash(s.vitals.sleepH)} h</b></li><li><span>Readiness</span><b class="num">${OS.dash(sc.readiness)}</b></li></ul>
          <a class="link small" href="#life">Habits and schedule in Life →</a></section>
      </div>
      <section class="card myo-plan"><div class="card-h"><h2>Myo's function analysis</h2><span class="chip chip-ai">AI coach</span></div>
        ${plan ? `<div class="md">${OS.athlete ? OS.athlete.mdl(plan.text) : esc(plan.text)}</div><p class="fine">Written ${esc(new Date(plan.at).toLocaleString())}.</p>` : '<p class="muted small">Myo links how you move, think, feel and behave: which habits lift your mood, how sleep shifts reaction time, where movement quality drops, and the three changes that matter most this week.</p>'}
        <button class="btn" data-act="fn-myo" ${busy ? 'disabled' : ''}>${icon('coach', 15)} ${busy ? 'Myo is analysing…' : plan ? 'Re-analyse' : 'Analyse my function'}</button></section>
      <p class="fine">These are wellness measures, not diagnoses of neurological or mental-health conditions. Big unexplained changes in memory, coordination or mood belong with a clinician.</p>`;
    },
    mount() { return () => { stopTimers(); if (R.phase === 'wait' || R.phase === 'go' || R.phase === 'run' || R.phase === 'show') { R.phase = 'idle'; } }; }
  });

  /* ── actions ─────────────────────────────────────────────────────── */
  let busy = false;
  OS.act('fn-pick', (el) => { stopTimers(); R.test = el.dataset.t; R.phase = 'idle'; R.trials = []; R.taps = 0; document.querySelectorAll('.fn-t').forEach((b) => b.classList.toggle('on', b === el)); repaint(); });
  // reaction time
  OS.act('fn-rt-hit', () => {
    if (R.phase === 'wait') { stopTimers(); R.phase = 'early'; return repaint(); }
    if (R.phase === 'go') { R.trials.push(Math.round(performance.now() - R.t0)); if (R.trials.length >= 5) { const m = [...R.trials].sort((a, b) => a - b)[2]; save('rt', m); R.phase = 'idle'; R.trials = []; return; } R.phase = 'result'; return repaint(); }
    R.phase = 'wait'; repaint(); R.timer = setTimeout(() => { R.phase = 'go'; R.t0 = performance.now(); repaint(); }, 1200 + Math.random() * 2600);
  });
  // tapping
  OS.act('fn-tap-hit', () => {
    if (R.phase === 'run') { R.taps++; const b = document.querySelector('.fn-pad b'); if (b) b.textContent = R.taps; return; }
    R.phase = 'run'; R.taps = 0; R.t0 = performance.now(); repaint();
    R.iv = setInterval(() => { const left = 10 - (performance.now() - R.t0) / 1000, el = document.getElementById('fn-tap-left'); if (el) el.textContent = Math.max(0, left).toFixed(1) + ' s'; if (left <= 0) { stopTimers(); R.phase = 'done'; save('tap', R.taps); } }, 100);
  });
  // digit span
  function spanRound() {
    R.seq = [...Array(R.span)].map(() => (Math.random() * 10) | 0).join(''); R.phase = 'show'; let i = 0;
    const next = () => { if (i >= R.seq.length) { R.phase = 'input'; repaint(); const inp = document.querySelector('.fn-in'); if (inp) inp.focus(); return; } R.show = R.seq[i++]; repaint(); R.timer = setTimeout(() => { R.show = ''; repaint(); R.timer = setTimeout(next, 220); }, 800); };
    next();
  }
  OS.act('fn-span-go', () => { stopTimers(); R.span = 4; R.miss = 0; R.best = 0; spanRound(); });
  OS.act('fn-span-ans', (f) => {
    const a = (f.elements.a.value || '').replace(/\D/g, '');
    if (a === R.seq) { R.best = R.span; R.span++; R.miss = 0; spanRound(); }
    else if (++R.miss >= 2) { R.phase = 'done'; if (R.best) save('span', R.best); else repaint(); }
    else spanRound();
  });
  // balance
  OS.act('fn-bal-hit', () => {
    if (R.phase === 'run') { stopTimers(); R.last = Math.min(60, ((performance.now() - R.t0) / 1000)).toFixed(1); R.phase = 'done'; save('bal', +R.last); return; }
    R.phase = 'run'; R.t0 = performance.now(); repaint();
    R.iv = setInterval(() => { const s = (performance.now() - R.t0) / 1000, el = document.getElementById('fn-bal-t'); if (el) el.textContent = s.toFixed(1) + ' s'; if (s >= 60) { stopTimers(); R.last = '60.0'; R.phase = 'done'; save('bal', 60); } }, 100);
  });
  OS.act('fn-checkin', (f) => {
    const v = (n) => clamp(+f.elements[n].value || 3, 1, 5), note = (f.elements.note.value || '').trim().slice(0, 500);
    OS.update((s) => { const F = ensure(s); F.checkins = F.checkins.filter((c) => c.d !== dayKey()); F.checkins.push({ d: dayKey(), mood: v('mood'), energy: v('energy'), stress: v('stress'), focus: v('focus'), note }); F.checkins = F.checkins.slice(-120); F.shareNotes = f.elements.share.checked; });
    OS.toast(CRISIS.test(note) ? 'Saved. Please see the support line at the top of the page.' : 'Check-in saved');
  });
  OS.act('fn-myo', async () => {
    if (busy) return;
    const s = OS.state, sc = OS.scores(s), S = summary(s, sc), F = ensure(s);
    const weak = Object.entries(S.dims).filter(([, v]) => v != null).sort((a, b) => a[1] - b[1]);
    const fallback = () => [`## Function score ${S.overall}`, `Lowest: **${weak[0][0]} ${weak[0][1]}**, then ${weak[1][0]} ${weak[1][1]}.`, '### This week',
      ...(weak.slice(0, 2).map(([k]) => ({ movement: '- Movement: 10 min mobility daily and a balance test every 3 days', cognition: '- Cognition: protect 7.5 h sleep; retest reaction time after a rest day', mind: '- Mind: 10 min breathwork at 21:45 and a daily check-in', behaviour: '- Behaviour: stack one habit onto your morning light walk', recovery: '- Recovery: swap one hard session for Zone 2 until readiness is back over 70' }[k]))),
      '- Retest all four function tests next week to see the trend'].join('\n');
    const sample = OS.caps && OS.caps.sample;
    if (!sample) { OS.update((st) => { ensure(st).analysis = { text: fallback(), at: new Date().toISOString() }; }); return; }
    busy = true; OS.render();
    const data = { functionSummary: S, notes: F.shareNotes ? F.checkins.slice(-7).filter((c) => c.note).map((c) => ({ d: c.d, note: c.note })) : 'not shared', vitals: s.vitals, readiness: sc.readiness, habits: s.life.habits.map((h) => h.name), training: s.training.program, redFlags: sc.redFlags };
    const prompt = `You are Myo, the AI brain of the Myo app (built on Myokinetics OS). Analyse this member's human function: movement, cognition, mood and mind, behaviour and recovery. Find links between them in the data (e.g. sleep vs reaction time, habits vs mood, training days vs stress), name the weakest area, and give the three highest-impact changes for this week with measurable targets and a retest plan.
Rules: these are wellness measures; do not diagnose neurological or mental-health conditions. If any note or very low mood suggests crisis or self-harm, open with care and the 988 Suicide & Crisis Lifeline (US) or local emergency services. Markdown with "##"/"###" headings and "-" bullets, under 350 words.
Data (JSON): ${JSON.stringify(data)}`;
    let text;
    try { const r = await sample(prompt, { cache: false, modelTier: 'complex' }); text = (r.text || '').trim() || fallback(); }
    catch (e) { text = fallback() + (e && e.code === 'not_granted' ? '\n\nAI access was declined, so this is the offline analysis.' : ''); }
    busy = false;
    OS.update((st) => { ensure(st).analysis = { text, at: new Date().toISOString() }; });
  });

  OS.fn = { summary, TESTS };
})();
