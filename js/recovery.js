/* ═══ MYO — RECOVERY: Sonosphere sound, heat, cold, light ═══
   Today's recovery prescription from readiness, HRV and today's training; the Sonosphere sound studio
   (Web Audio: layered tones, singing bowls, pink noise, optional binaural beat, breath pacer); evidence-graded
   protocols for sauna, hot bath, cold plunge, cryochamber, contrast, red light, compression, percussion, float,
   PEMF and hyperbaric oxygen; a safety screen; and weekly dose tracking against research targets.
   Claims are kept to what the evidence supports: frequencies are used for comfort, not as treatment. */
(function () {
  'use strict';
  const { esc, icon, pill, dayKey, addDays } = OS;

  /* ── data ── */
  const GRADE = { A: ['good', 'Strong evidence'], B: ['good', 'Good evidence'], C: ['warn', 'Limited evidence'], D: ['muted', 'Not supported for wellness'] };
  const MODS = [
    { k: 'sauna', name: 'Finnish sauna', kind: 'heat', dose: '80–100 °C · 15–20 min · 2–4 times a week', how: 'Sit upper bench, leave if dizzy, cool down gradually, drink 500 ml water after.', why: 'Regular sauna use is linked with lower cardiovascular and all-cause mortality in long Finnish cohorts, and builds heat tolerance.', grade: 'B', safety: 'No alcohol. Avoid with unstable heart disease, low blood pressure or pregnancy unless your doctor agrees.' },
    { k: 'infrared', name: 'Infrared sauna', kind: 'heat', dose: '45–60 °C · 20–30 min', how: 'Lower air temperature, longer sessions; same hydration rules.', why: 'Gentler heat; far less research than traditional sauna.', grade: 'C', safety: 'Same cautions as sauna.' },
    { k: 'bath', name: 'Hot bath before bed', kind: 'heat', dose: '40–42 °C · 10–20 min · 1–2 h before bed', how: 'Warm water raises skin temperature, then core temperature drops as you cool, which helps sleep onset.', why: 'A meta-analysis found warm bathing 1–2 hours before bed shortens time to fall asleep.', grade: 'B', safety: 'Get out slowly; skip after alcohol.' },
    { k: 'plunge', name: 'Cold plunge', kind: 'cold', dose: '10–15 °C · 1–5 min · about 11 min a week in total', how: 'Enter slowly, breathe out long, keep hands calm. Rewarm naturally with movement.', why: 'Raises alertness and noradrenaline and eases soreness. Within 4–6 h after strength training it can blunt muscle and strength gains.', grade: 'C', safety: 'Never alone. Avoid with heart disease, Raynaud\'s or cold urticaria. Cold shock can cause gasping: no head dunking.' },
    { k: 'shower', name: 'Cold shower finish', kind: 'cold', dose: '30–90 s at the end of a shower', how: 'Easiest daily cold exposure; build up over a week.', why: 'Small studies show better mood and alertness; little effect on recovery.', grade: 'C', safety: 'Same heart cautions as the plunge.' },
    { k: 'cryo', name: 'Cryochamber (whole-body cryotherapy)', kind: 'cold', dose: '−110 to −140 °C · 2–3 min · supervised', how: 'Dry skin, gloves, socks, ear and nose cover; never with wet skin or clothing.', why: 'Modest short-term relief of muscle soreness; no clear performance benefit. The FDA has not cleared it as a medical treatment.', grade: 'C', safety: 'Frostbite risk. Not with uncontrolled blood pressure, heart disease, pregnancy or cold allergy. Staff must supervise.' },
    { k: 'contrast', name: 'Contrast therapy', kind: 'cold', dose: '3–4 rounds: 3 min hot, 1 min cold', how: 'Finish cold for alertness, warm for sleep.', why: 'Can reduce soreness after hard sessions; mechanism mostly circulation and perception.', grade: 'C', safety: 'Heart cautions for both heat and cold.' },
    { k: 'redlight', name: 'Red and near-infrared light', kind: 'light', dose: '630–670 nm + 810–850 nm · 10–20 cm away · 5–20 min', how: 'Bare skin over the target muscles; 3–5 sessions a week.', why: 'Photobiomodulation shows mixed but promising results for muscle recovery and soreness; quality varies by device and dose.', grade: 'C', safety: 'Protect your eyes. Check medicines that make skin sensitive to light.' },
    { k: 'compression', name: 'Pneumatic compression boots', kind: 'tool', dose: '20–30 min after hard sessions', how: 'Moderate pressure; legs slightly raised.', why: 'Mainly lowers perceived soreness and fatigue.', grade: 'C', safety: 'Not with blood clots, open wounds or poor circulation.' },
    { k: 'percussion', name: 'Percussive massage', kind: 'tool', dose: '1–2 min per muscle group', how: 'Move slowly along the muscle; avoid bone and the front of the neck.', why: 'Short-term gains in range of motion and less soreness.', grade: 'C', safety: 'Not over bruises, clots or recent injuries.' },
    { k: 'float', name: 'Float tank', kind: 'tool', dose: '60 min', how: 'Body-temperature salt water, no light or sound.', why: 'Small studies show lower stress and anxiety for a few days.', grade: 'C', safety: 'Not with open cuts, epilepsy or uncontrolled ear problems.' },
    { k: 'pemf', name: 'PEMF mats', kind: 'tool', dose: 'Per device', how: 'Pulsed electromagnetic fields.', why: 'Some medical uses exist (bone healing); wellness recovery claims are not well supported.', grade: 'D', safety: 'Not with pacemakers or implanted electronics.' },
    { k: 'hbot', name: 'Hyperbaric oxygen', kind: 'tool', dose: 'Medical use only', how: 'Treats decompression sickness, carbon monoxide poisoning and some hard-to-heal wounds under medical care.', why: 'Wellness and recovery use is not supported and carries risks (ear and lung barotrauma, oxygen toxicity).', grade: 'D', safety: 'Only in a clinical hyperbaric centre with a medical referral.' }
  ];
  const MOD_BY = Object.fromEntries(MODS.map((m) => [m.k, m]));
  const TARGET = { heat: 57, cold: 11, sound: 60, light: 3 }; // min/week (light = sessions/week)
  const SCREEN = [['heart', 'Heart disease, a heart rhythm problem or a pacemaker'], ['bp', 'High or low blood pressure that isn\'t controlled'], ['preg', 'Pregnancy'], ['raynaud', 'Raynaud\'s, cold urticaria or poor circulation'], ['seizure', 'Seizures or epilepsy'], ['photo', 'Medicines that make skin sensitive to light']];

  // Sonosphere programs: tone layers (Hz), slow swell rate (Hz), pink noise level, singing bowls, binaural offset
  const SONO = [
    { k: 'downshift', name: 'Downshift', min: 10, breath: [4, 6], layers: [110, 165, 220], drift: 0.08, noise: 0.05, bowls: null, beat: 0, use: 'After training or a stressful day: slow breathing at 6 a minute over warm low tones.' },
    { k: 'sleep', name: 'Deep sleep', min: 20, breath: [4, 7], layers: [55, 82.5, 110], drift: 0.05, noise: 0.12, bowls: null, beat: 0, use: 'In bed with lights out. Breathing slows to about 5 a minute; sound fades over the last minute.' },
    { k: 'bowls', name: 'Singing bowls', min: 12, breath: [5, 5], layers: [130.8], drift: 0.06, noise: 0.03, bowls: [261.6, 329.6, 392, 523.3], beat: 0, use: 'Bowl strikes every 10–14 seconds over a soft drone. A classic sound bath.' },
    { k: 'focus', name: 'Focus', min: 15, breath: null, layers: [200], drift: 0.04, noise: 0.05, bowls: null, beat: 10, use: 'Headphones: a 10 Hz difference between ears over pink noise. Evidence for binaural beats is weak; treat it as a calm background.' },
    { k: 'noise', name: 'Pink noise', min: 30, breath: null, layers: [], drift: 0, noise: 0.28, bowls: null, beat: 0, use: 'Masks background sound for sleep or deep work.' }
  ];

  function ensure(s) {
    if (!s.recovery) s.recovery = { logs: [], screen: {} };
    if (!s.recovery.logs) s.recovery.logs = [];
    if (!s.recovery.screen) s.recovery.screen = {};
    return s.recovery;
  }
  const flagged = (R) => Object.values(R.screen).some(Boolean);
  const kindOf = (k) => (k === 'sound' ? 'sound' : MOD_BY[k] ? MOD_BY[k].kind : 'tool');
  function week(R) {
    const from = dayKey(addDays(new Date(), -6)), t = { heat: 0, cold: 0, sound: 0, light: 0 };
    R.logs.filter((l) => l.d >= from).forEach((l) => { const k = kindOf(l.k); if (k === 'light') t.light += 1; else if (t[k] != null) t[k] += +l.min || 0; });
    return t;
  }

  /* ── today's prescription ── */
  function prescription(s, sc, R) {
    const vt = s.vitals || {}, rd = sc.readiness, hrvLow = vt.hrv && vt.hrvBase && vt.hrv < vt.hrvBase * 0.9;
    const load = OS.trainLoad ? OS.trainLoad() : {}, lifted = Object.values(load).some((v) => v.done > 0.3);
    const safe = !flagged(R), items = [];
    let mode, why;
    if (rd < 60 || hrvLow) {
      mode = 'Downshift day'; why = `Readiness ${rd}${hrvLow ? ` and HRV ${vt.hrv} ms below your ${vt.hrvBase} ms base` : ''}: calm the nervous system, skip cold stress.`;
      items.push(['sound', 'Sonosphere · Downshift', '10 min, early evening', 'downshift']);
      if (safe) items.push(['bath', 'Warm bath', '15 min at 40 °C, 90 min before bed']);
      items.push(['redlight', 'Red light', '10 min on tight areas']);
    } else if (lifted) {
      mode = 'Strength day'; why = 'You trained today. Skip cold immersion for 4–6 hours so it doesn\'t blunt the strength signal; use heat and light.';
      if (safe) items.push(['sauna', 'Sauna', '15–20 min at 80–90 °C after training']);
      items.push(['redlight', 'Red light', '10–15 min on the muscles you trained']);
      items.push(['sound', 'Sonosphere · Deep sleep', '20 min in bed', 'sleep']);
    } else {
      mode = 'Balanced day'; why = `Readiness ${rd}: a cold start for alertness, heat later for sleep.`;
      if (safe) items.push(['plunge', 'Cold plunge', '2–3 min at 10–15 °C, morning']);
      if (safe) items.push(['sauna', 'Sauna', '15 min in the evening']);
      items.push(['sound', 'Sonosphere · Singing bowls', '12 min', 'bowls']);
    }
    return { mode, why, items };
  }

  /* ── Sonosphere audio engine (Web Audio; starts only from a tap) ── */
  const SO = { ctx: null, master: null, nodes: [], timers: [], preset: null, t0: 0, vol: 0.6, binaural: false, breath: null, tick: 0 };
  function pinkBuffer(ctx) {
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; }
    }
    return buf;
  }
  function strike(ctx, out, f) {
    const t = ctx.currentTime;
    [[1, 0.28], [2.76, 0.1], [5.4, 0.04], [8.93, 0.015]].forEach(([m, a]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * m; o.detune.value = (Math.random() - 0.5) * 8;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 9 / Math.sqrt(m));
      o.connect(g).connect(out); o.start(t); o.stop(t + 10);
    });
  }
  // stop the session; log it when it ran a minute or more. From a page cleanup (unmounting) never re-render.
  function soStop(logIt, unmounting) {
    SO.timers.forEach((x) => clearTimeout(x)); SO.timers = [];
    if (SO.breath) { clearInterval(SO.breath); SO.breath = null; }
    const p = SO.preset, mins = SO.t0 ? Math.round((Date.now() - SO.t0) / 60000) : 0, ctx = SO.ctx, m = SO.master;
    SO.ctx = null; SO.master = null; SO.nodes = []; SO.preset = null; SO.t0 = 0;
    if (ctx) {
      try { m.gain.cancelScheduledValues(ctx.currentTime); m.gain.setTargetAtTime(0, ctx.currentTime, 0.4); } catch {}
      setTimeout(() => { try { ctx.close(); } catch {} }, 1500);
    }
    if (logIt && p && mins >= 1) OS.update((s) => { ensure(s).logs.push({ d: dayKey(), k: 'sound', min: mins, note: p.name }); }, { keepSample: true, render: !unmounting && OS.current === 'recovery' });
    if (!unmounting) paintPlayer();
  }
  function soStart(k) {
    soStop(true);
    const p = SONO.find((x) => x.k === k); if (!p) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { OS.toast('Sound needs a browser with Web Audio.'); return; }
    const ctx = new AC(), master = ctx.createGain();
    master.gain.value = 0; master.connect(ctx.destination);
    master.gain.linearRampToValueAtTime(SO.vol, ctx.currentTime + 5);
    p.layers.forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = i === 0 ? 'triangle' : 'sine'; o.frequency.value = f; o.detune.value = i * 3;
      g.gain.value = 0.16 / (i + 1);
      lfo.frequency.value = (p.drift || 0.05) * (1 + i * 0.37); lg.gain.value = 0.07 / (i + 1);
      lfo.connect(lg).connect(g.gain); o.connect(g).connect(master); o.start(); lfo.start(); SO.nodes.push(o, lfo);
    });
    if (p.noise) {
      const src = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = pinkBuffer(ctx); src.loop = true; lp.type = 'lowpass'; lp.frequency.value = 900; g.gain.value = p.noise;
      src.connect(lp).connect(g).connect(master); src.start(); SO.nodes.push(src);
    }
    if (p.beat && SO.binaural && ctx.createStereoPanner) {
      [[p.layers[0] || 200, -1], [(p.layers[0] || 200) + p.beat, 1]].forEach(([f, pan]) => { const o = ctx.createOscillator(), g = ctx.createGain(), sp = ctx.createStereoPanner(); o.frequency.value = f; g.gain.value = 0.07; sp.pan.value = pan; o.connect(g).connect(sp).connect(master); o.start(); SO.nodes.push(o); });
    }
    if (p.bowls) {
      const ring = () => { if (!SO.ctx) return; strike(ctx, master, p.bowls[Math.floor(Math.random() * p.bowls.length)]); SO.timers.push(setTimeout(ring, 10000 + Math.random() * 4000)); };
      SO.timers.push(setTimeout(ring, 1500));
    }
    const ms = p.min * 60000;
    SO.timers.push(setTimeout(() => { try { master.gain.setTargetAtTime(0, ctx.currentTime, 8); } catch {} }, Math.max(0, ms - 45000)));
    SO.timers.push(setTimeout(() => { soStop(true); OS.toast(`${p.name} finished · logged ${p.min} min`); }, ms));
    SO.ctx = ctx; SO.master = master; SO.preset = p; SO.t0 = Date.now();
    // breath pacer
    if (p.breath) {
      let phase = 0, left = p.breath[0];
      const beat = () => {
        const orb = document.getElementById('so-orb'), lab = document.getElementById('so-cue');
        left -= 1;
        if (left <= 0) { phase = 1 - phase; left = p.breath[phase]; }
        if (orb) { orb.style.transitionDuration = (phase === 0 ? p.breath[0] : p.breath[1]) + 's'; orb.dataset.phase = phase === 0 ? 'in' : 'out'; }
        if (lab) lab.textContent = phase === 0 ? 'Breathe in' : 'Breathe out';
        paintClock();
      };
      SO.breath = setInterval(beat, 1000);
      const orb = document.getElementById('so-orb'); if (orb) { orb.style.transitionDuration = p.breath[0] + 's'; orb.dataset.phase = 'in'; }
    } else SO.breath = setInterval(paintClock, 1000);
    paintPlayer();
  }
  function paintClock() {
    const el = document.getElementById('so-clock'); if (!el || !SO.preset) return;
    const left = Math.max(0, SO.preset.min * 60 - Math.round((Date.now() - SO.t0) / 1000));
    el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  }
  function paintPlayer() {
    const box = document.getElementById('so-player'); if (!box) return;
    box.innerHTML = playerHTML();
  }
  function playerHTML() {
    const p = SO.preset;
    return `<div class="so-stage ${p ? 'on' : ''}">
        <div class="so-orb-wrap"><div class="so-orb" id="so-orb" data-phase="${p && p.breath ? 'in' : 'idle'}"></div><div class="so-ring"></div><div class="so-ring r2"></div></div>
        <div class="so-now">${p ? `<span class="so-name">${esc(p.name)}</span><b class="num" id="so-clock">${p.min}:00</b><span id="so-cue">${p.breath ? 'Breathe in' : 'Listening'}</span>` : '<span class="so-name">Sonosphere</span><b>Choose a program</b><span>Starts quietly and fades in over 5 seconds</span>'}</div>
      </div>
      <div class="so-ctl">${p ? '<button class="btn" data-act="so-stop">Stop and log</button>' : ''}
        <label class="so-vol" for="so-vol">Volume <input id="so-vol" type="range" min="0" max="1" step="0.05" value="${SO.vol}"></label>
        <label class="ped-use"><input type="checkbox" id="so-bin" ${SO.binaural ? 'checked' : ''}> Headphones (binaural)</label></div>`;
  }

  /* ── view ── */
  OS.register('recovery', {
    title: 'Recovery', icon: 'recovery',
    render(s, sc) {
      const R = ensure(s), rx = prescription(s, sc, R), wk = week(R), flag = flagged(R);
      const bar = (v, t) => `<span class="rc-bar"><i style="width:${Math.min(100, Math.round((v / t) * 100))}%"></i></span>`;
      const logs = R.logs.slice(-8).reverse();
      const mod = (m) => `<article class="rc-mod k-${m.kind}"><div class="rc-mod-h"><b>${esc(m.name)}</b>${pill(...GRADE[m.grade])}</div>
          <p class="rc-dose num">${esc(m.dose)}</p><p class="small">${esc(m.why)}</p>
          <details><summary>How and safety</summary><p class="small">${esc(m.how)}</p><p class="small rc-safe">${icon('biology', 13)} ${esc(m.safety)}</p></details>
          ${m.grade !== 'D' ? `<div class="row"><button class="btn ghost sm" data-act="rc-log" data-k="${m.k}">Log session</button><button class="link small" data-act="rc-add" data-k="${m.k}">Add to today</button></div>` : '<p class="fine">Myo does not schedule this. Ask a clinician if you have a medical reason.</p>'}</article>`;
      return `${OS.ui.head('Body · recovery protocols', 'Recovery', 'Sound, heat, cold and light, dosed to your readiness and today\'s training.',
        `<div class="hstat"><span>Readiness</span><b class="num">${sc.readiness}</b></div><div class="hstat"><span>Heat this week</span><b class="num">${wk.heat} min</b></div><div class="hstat"><span>Cold this week</span><b class="num">${wk.cold} min</b></div>`)}
      ${flag ? '<div class="banner warn" role="note"><strong>Heat and cold are off your plan.</strong> You ticked a health condition below. Talk to your doctor before sauna, cold plunges or cryotherapy; sound, breathing and light remain.</div>' : ''}
      <div class="grid g-2-1">
        <section class="card rc-rx"><div class="card-h"><h2>Today: ${esc(rx.mode)}</h2><span class="muted small">From readiness, HRV and today's training</span></div>
          <p class="small">${esc(rx.why)}</p>
          <ol class="rc-steps">${rx.items.map(([k, t, d, preset], i) => `<li><span class="rc-n num">${i + 1}</span><div><b>${esc(t)}</b><span class="muted small block">${esc(d)}</span></div>${preset ? `<button class="btn sm" data-act="so-start" data-k="${preset}">${icon('speaker', 14)} Start</button>` : `<button class="btn ghost sm" data-act="rc-log" data-k="${k}">Log</button>`}</li>`).join('')}</ol>
          <button class="link small" data-act="rc-add-all">Add all to today's protocol</button></section>
        <section class="card"><div class="card-h"><h2>This week</h2><span class="muted small">Last 7 days vs research targets</span></div>
          <ul class="rc-week">
            <li><span>Heat</span>${bar(wk.heat, TARGET.heat)}<b class="num">${wk.heat}/${TARGET.heat} min</b></li>
            <li><span>Cold</span>${bar(wk.cold, TARGET.cold)}<b class="num">${wk.cold}/${TARGET.cold} min</b></li>
            <li><span>Sound and breath</span>${bar(wk.sound, TARGET.sound)}<b class="num">${wk.sound}/${TARGET.sound} min</b></li>
            <li><span>Red light</span>${bar(wk.light, TARGET.light)}<b class="num">${wk.light}/${TARGET.light}</b></li></ul>
          <p class="fine">Heat and cold targets follow a study of winter swimmers (about 57 min of sauna and 11 min of cold a week). They are a starting point, not a rule.</p></section>
      </div>

      <section class="card so-card" aria-labelledby="so-h"><div class="card-h"><h2 id="so-h">Sonosphere</h2><span class="muted small">Sound bath and breathing studio · Merakinetics chamber pairing planned</span></div>
        <div class="so-grid">
          <div id="so-player" class="so-player">${playerHTML()}</div>
          <div class="so-progs">${SONO.map((p) => `<button class="so-prog ${SO.preset && SO.preset.k === p.k ? 'on' : ''}" data-act="so-start" data-k="${p.k}"><span class="so-prog-h"><b>${esc(p.name)}</b><span class="num muted small">${p.min} min</span></span><span class="small muted">${esc(p.use)}</span></button>`).join('')}</div>
        </div>
        <details class="so-table"><summary>Frequency programs (for the Sonosphere chamber)</summary>
          <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Program</th><th>Tone layers</th><th>Swell</th><th>Noise</th><th>Bowls</th><th>Breath</th><th>Length</th></tr></thead><tbody>
          ${SONO.map((p) => `<tr><td>${esc(p.name)}</td><td class="num">${p.layers.length ? p.layers.join(' · ') + ' Hz' : '—'}${p.beat ? ` · binaural ${p.beat} Hz` : ''}</td><td class="num">${p.drift ? p.drift + ' Hz' : '—'}</td><td class="num">${p.noise ? Math.round(p.noise * 100) + '%' : '—'}</td><td class="num">${p.bowls ? p.bowls.map(Math.round).join(' · ') + ' Hz' : '—'}</td><td class="num">${p.breath ? `${p.breath[0]} s in · ${p.breath[1]} s out` : '—'}</td><td class="num">${p.min} min</td></tr>`).join('')}
          </tbody></table></div></details>
        <p class="fine">Slow breathing at about 6 a minute and calm sound lower heart rate and stress for many people. Claims that particular frequencies (for example 528 Hz) repair DNA or "harmonise" organs are not supported by evidence; Myo picks frequencies for comfort.</p>
      </section>

      <section class="card"><div class="card-h"><h2>Heat, cold, light and tools</h2><span class="muted small">Protocols graded by the evidence behind them</span></div>
        <div class="rc-mods">${MODS.map(mod).join('')}</div></section>

      <div class="grid g-2">
        <section class="card"><div class="card-h"><h2>Safety check</h2><span class="muted small">Tick anything that applies</span></div>
          <ul class="rc-screen">${SCREEN.map(([k, l]) => `<li><label class="ped-use"><input type="checkbox" data-change="rc-screen" data-k="${k}" ${R.screen[k] ? 'checked' : ''}> ${esc(l)}</label></li>`).join('')}</ul>
          <p class="fine">Any tick removes heat and cold from Myo's plan until you clear it. Seek urgent care for chest pain, fainting or confusion during heat or cold.</p></section>
        <section class="card"><div class="card-h"><h2>Recent sessions</h2><span class="muted small">${R.logs.length} logged</span></div>
          ${logs.length ? `<ul class="rc-log">${logs.map((l) => `<li><span class="num muted small">${esc(l.d)}</span><b>${esc(l.k === 'sound' ? 'Sonosphere' : (MOD_BY[l.k] || {}).name || l.k)}</b><span class="small">${l.min ? l.min + ' min' : ''}${l.temp ? ' · ' + esc(String(l.temp)) + ' °C' : ''}${l.note ? ' · ' + esc(l.note) : ''}</span></li>`).join('')}</ul>` : '<p class="muted small">No sessions yet. Log one from a protocol card, or finish a Sonosphere program.</p>'}
          <form class="rc-form" data-submit="rc-log-save" hidden id="rc-form"><input type="hidden" name="k">
            <label class="field" for="rc-min"><span>Minutes</span><input id="rc-min" name="min" type="number" min="1" max="180" value="15"></label>
            <label class="field" for="rc-temp"><span>Temperature °C (optional)</span><input id="rc-temp" name="temp" type="number" step="0.5"></label>
            <div class="row"><button class="btn sm">Save session</button><button type="button" class="btn ghost sm" data-act="rc-log-cancel">Cancel</button></div></form>
        </section>
      </div>`;
    },
    mount(root) {
      const vol = root.querySelector('#so-player');
      const onIn = (e) => {
        if (e.target.id === 'so-vol') { SO.vol = +e.target.value; if (SO.master && SO.ctx) SO.master.gain.setTargetAtTime(SO.vol, SO.ctx.currentTime, 0.2); }
        if (e.target.id === 'so-bin') { SO.binaural = e.target.checked; if (SO.preset && SO.preset.beat) soStart(SO.preset.k); }
      };
      if (vol) { vol.addEventListener('input', onIn); vol.addEventListener('change', onIn); }
      return () => { if (vol) { vol.removeEventListener('input', onIn); vol.removeEventListener('change', onIn); } if (location.hash.slice(1) !== 'recovery') soStop(true, true); }; // a re-render of this page keeps the session playing
    }
  });

  OS.act('so-start', (el) => soStart(el.dataset.k));
  OS.act('so-stop', () => soStop(true));
  OS.act('rc-log', (el) => {
    const f = document.getElementById('rc-form'); if (!f) return;
    f.hidden = false; f.elements.k.value = el.dataset.k;
    const m = MOD_BY[el.dataset.k]; f.querySelector('#rc-min').value = m && m.kind === 'cold' ? 3 : 15;
    f.scrollIntoView({ block: 'center', behavior: 'smooth' }); f.querySelector('#rc-min').focus();
  });
  OS.act('rc-log-cancel', () => { const f = document.getElementById('rc-form'); if (f) f.hidden = true; });
  OS.act('rc-log-save', (f) => {
    const k = f.elements.k.value, min = Math.max(0, Math.min(180, +f.elements.min.value || 0)), temp = f.elements.temp.value;
    if (!min) { OS.toast('Enter the minutes.'); return; }
    OS.update((s) => { ensure(s).logs.push({ d: dayKey(), k, min, temp: temp === '' ? null : +temp }); }, { keepSample: true });
    OS.toast(`Logged ${min} min of ${(MOD_BY[k] || {}).name || k}`);
  });
  const addItem = (s, k, title, detail) => {
    s.customProtocol = s.customProtocol || [];
    const id = 'rc-' + k;
    if (!s.customProtocol.some((x) => x.id === id)) s.customProtocol.push({ id, cat: 'recovery', time: (MOD_BY[k] && MOD_BY[k].kind === 'cold') ? 'Morning' : 'Evening', title, detail, marker: null, route: 'recovery' });
  };
  OS.act('rc-add', (el) => { const m = MOD_BY[el.dataset.k]; OS.update((s) => addItem(s, m.k, m.name, m.dose), { keepSample: true }); OS.toast(`${m.name} added to today's protocol`); });
  OS.act('rc-add-all', () => {
    const s0 = OS.state, rx = prescription(s0, OS.scores(s0), ensure(s0));
    OS.update((s) => rx.items.forEach(([k, t, d]) => addItem(s, k, t, d)), { keepSample: true });
    OS.toast(`Added ${rx.items.length} recovery items to today`);
  });
  OS.change('rc-screen', (el) => OS.update((s) => { ensure(s).screen[el.dataset.k] = el.checked; }, { keepSample: true }));
  OS.recovery = { prescription: (s) => prescription(s, OS.scores(s), ensure(s)), MODS, SONO };
})();
