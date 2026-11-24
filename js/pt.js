/* ═══ MYO — PHYSICAL THERAPY: exercise-based rehab with pain monitoring ═══
   Red-flag screen first (sends you to care), then seven regions with a common condition each and a
   four-phase plan (calm, restore, strengthen, return) with criteria to move on. Daily pain and function log
   with the traffic-light pain rule; the region's muscles highlighted on the 3D body; AR-Vision for range and
   form, ISO Flow for left-right strength symmetry. General exercise guidance, not a diagnosis. */
(function () {
  'use strict';
  const { esc, icon, pill, dayKey, spark } = OS;

  const FLAGS = [
    ['trauma', 'Pain started after a fall, crash or big impact', 'urgent'],
    ['neuro', 'New numbness, weakness, or trouble controlling bladder or bowel', 'emergency'],
    ['systemic', 'Fever, unexplained weight loss, or a history of cancer', 'urgent'],
    ['night', 'Constant pain at night that rest and position don\'t change', 'soon'],
    ['joint', 'A hot, red, swollen joint', 'urgent'],
    ['vascular', 'Chest pain, or a swollen, tender calf', 'emergency']
  ];
  const PHASES = ['Calm', 'Restore', 'Strengthen', 'Return'];
  // region → condition, 3D muscle groups and view, and four phases of [exercise, dose, cue]
  const R = {
    shoulder: { name: 'Shoulder', cond: 'Rotator cuff related shoulder pain', hi: ['delts', 'rotator'], view: 'torso', ar: 'press',
      phases: [
        [['Pendulum swings', '2 × 30 s', 'Let the arm hang and draw small circles with your body, not your arm'], ['Isometric external rotation', '5 × 30 s hold', 'Elbow at your side, press the back of the hand into a wall at about 30% effort'], ['Scapular setting', '3 × 10', 'Draw the shoulder blades gently back and down']],
        [['Wall slides', '3 × 10', 'Forearms on the wall, slide up only as far as stays comfortable'], ['Side-lying external rotation', '3 × 12, light', 'Towel under the elbow, rotate up slowly'], ['Cross-body stretch', '3 × 30 s', 'Stop before pinching at the front']],
        [['External rotation on ISO Flow or a band', '3 × 12–15', 'Slow and even; ISO Flow keeps the speed constant'], ['Prone Y-T-W raises', '3 × 10 each', 'Thumbs up, squeeze the shoulder blades'], ['APS press in a pain-free range', '3 × 8, light', 'Stop short of the painful arc']],
        [['Overhead carry', '3 × 30 m', 'Arm locked out, ribs down'], ['Wall ball throws', '3 × 15', 'Fast but controlled'], ['Full pressing and pulling', 'Back to programme', 'Add 10% load a week if pain stays ≤ 3/10']]],
      gates: ['Pain at rest 2/10 or less', 'Full pain-free arm raise', 'External rotation strength at least 90% of the other side on ISO Flow'] },
    knee: { name: 'Knee', cond: 'Front-of-knee pain (patellofemoral)', hi: ['quads', 'hamstrings'], view: 'legs', ar: 'squat',
      phases: [
        [['Quad sets', '3 × 10, 5 s hold', 'Push the back of the knee into the floor'], ['Straight-leg raise', '3 × 12', 'Lock the knee first, lift to the other knee\'s height'], ['Side-lying hip abduction', '3 × 15', 'Toes forward, lead with the heel']],
        [['Wall sit, 0–45°', '5 × 30 s', 'Shallow enough to stay at pain 3/10 or less'], ['Low step-ups', '3 × 10 each', 'Knee tracks over the second toe'], ['Banded clamshells', '3 × 15', 'Don\'t roll the hips back']],
        [['Split squat', '3 × 8 each', 'Upright trunk, slow down'], ['Leg extension on ISO Flow', '3 × 10', 'Start in a 90–45° range, widen as pain allows'], ['Single-leg Romanian deadlift', '3 × 8 each', 'Hinge at the hip, soft knee']],
        [['Lateral hops', '3 × 10', 'Land quietly, knee over toes'], ['Jump-landing drills', '3 × 5', 'Stick each landing for 2 s'], ['Walk-run programme', '3 × a week', 'Add 10% a week if pain settles within 24 h']]],
      gates: ['Pain on stairs 2/10 or less', 'Single-leg squat to a box without the knee caving in', 'Quad strength and hop tests at least 90% of the other side'] },
    back: { name: 'Low back', cond: 'Non-specific low back pain', hi: ['back', 'glutes', 'core'], view: 'torso', ar: 'squat',
      phases: [
        [['Walking', '10–20 min a day', 'Most low back pain settles faster when you keep moving'], ['Cat-camel', '2 × 10', 'Move slowly through a comfortable range'], ['Child\'s pose or knee hugs', '3 × 30 s', 'Breathe out into the stretch']],
        [['Bird-dog', '3 × 8 each side', 'Keep the hips level'], ['Dead bug', '3 × 8 each side', 'Low back stays heavy on the floor'], ['Glute bridge', '3 × 12', 'Squeeze the glutes, not the back']],
        [['Romanian deadlift, light', '3 × 8', 'Hinge at the hips, neutral spine'], ['Side plank', '3 × 20–30 s each', 'Straight line from head to heels'], ['Suitcase carry', '3 × 30 m each', 'Stand tall, don\'t lean']],
        [['Deadlift progression', 'Back to programme', 'Add load slowly; pain should settle by the next morning'], ['Loaded carries', '3 × 40 m', 'Mix sides and grips'], ['Sport and lifting', 'Full return', 'Keep two core sessions a week']]],
      gates: ['Walking 30 min with pain 3/10 or less', 'Bird-dog and dead bug without pain', 'Hinging with load without pain the next day'] },
    hip: { name: 'Hip', cond: 'Outer hip (gluteal tendon) pain', hi: ['glutes'], view: 'legs', ar: 'squat',
      phases: [
        [['Standing isometric abduction', '5 × 30 s', 'Push the outside of the knee into a wall'], ['Glute bridge', '3 × 10', 'Feet hip width'], ['Avoid crossing legs and sleeping on that side', 'All day', 'Pillow between the knees at night']],
        [['Side-lying abduction (hip straight)', '3 × 12', 'Don\'t let the hip bend forward'], ['Banded side walks', '3 × 10 m', 'Small steps, steady tension']],
        [['Step-ups', '3 × 10 each', 'Drive through the heel'], ['Single-leg squat to a box', '3 × 8 each', 'Pelvis stays level'], ['Hip thrust', '3 × 10', 'Pause at the top']],
        [['Hopping drills', '3 × 10', 'Quiet landings'], ['Return to running', 'Walk-run plan', 'Avoid steep cambers early on']]],
      gates: ['Lying on that side is comfortable', 'Single-leg stance 30 s without pain', 'Hop 10 times without pain'] },
    ankle: { name: 'Ankle', cond: 'Lateral ankle sprain', hi: ['calves', 'tibialis'], view: 'legs', ar: 'squat',
      phases: [
        [['Protect and elevate', 'First 2–3 days', 'Avoid what hurts; raise the ankle above the heart'], ['Ankle alphabet', '2 × each letter', 'Move only at the ankle'], ['Towel scrunches', '3 × 20', 'Grip with the toes']],
        [['Double-leg calf raises', '3 × 15', 'Slow up, slower down'], ['Single-leg balance', '3 × 30 s', 'Eyes open, then closed'], ['Banded eversion', '3 × 15', 'Turn the foot out against the band']],
        [['Single-leg calf raises', '3 × 12', 'Full height each rep'], ['Balance on a cushion', '3 × 30 s', 'Add catches as it gets easy'], ['Hops in place', '3 × 10', 'Soft and quiet']],
        [['Figure-of-eight runs', '4 × 30 s', 'Tighten the loops each round'], ['Cutting drills', '3 × 6 each side', 'Brace or tape for the first weeks back']]],
      gates: ['Walking without a limp', 'Single-leg balance 30 s', '20 single-leg calf raises, equal to the other side'] },
    neck: { name: 'Neck', cond: 'Desk-related neck pain and stiffness', hi: ['neck'], view: 'head', ar: 'press',
      phases: [
        [['Chin tucks', '3 × 10', 'Glide the head back, not down'], ['Gentle rotation', '2 × 10 each way', 'Within comfort'], ['Upper trapezius stretch', '3 × 30 s', 'Ear toward shoulder, shoulder down']],
        [['Deep neck flexor holds', '5 × 10 s', 'Lying down, nod slightly and lift the head 1 cm'], ['Banded rows', '3 × 15', 'Shoulders down and back']],
        [['Prone Y and T raises', '3 × 10', 'Lead with the shoulder blades'], ['Face pulls', '3 × 15', 'Pull to the forehead, elbows high'], ['Shrugs', '3 × 12', 'Pause at the top']],
        [['Desk routine', 'Every 45 min', 'Stand, roll the shoulders, three chin tucks'], ['Screen at eye height', 'Daily', 'Arm\'s length away']]],
      gates: ['Full head turn both ways', 'Pain 2/10 or less after a work day', '30 s deep neck flexor hold'] },
    elbow: { name: 'Elbow and wrist', cond: 'Outer elbow pain (tennis elbow)', hi: ['forearms'], view: 'torso', ar: 'press',
      phases: [
        [['Isometric wrist extension', '5 × 45 s', 'Pain 3/10 or less; this often eases pain'], ['Grip breaks', 'Through the day', 'Loosen the grip on mouse, phone and bags']],
        [['Slow wrist extension with a light dumbbell', '3 × 15', '3 s down, use the other hand to lift'], ['Forearm rotation', '3 × 15', 'Hold a hammer near the head']],
        [['Grip strengthening', '3 × 10 s holds', 'Ball or gripper'], ['Rubber bar twist (Tyler twist)', '3 × 15', 'Slow return'], ['Rows and curls, light', '3 × 12', 'Neutral wrist']],
        [['Back to racket or lifting', 'Gradual', 'Add 10% a week; watch next-morning pain']]],
      gates: ['Gripping a cup without pain', 'Pain 3/10 or less during loaded wrist work', 'Grip strength at least 90% of the other side'] }
  };
  const REG_KEYS = Object.keys(R);

  function ensure(s) { if (!s.pt) s.pt = { region: 'knee', phase: 0, logs: [], flags: {} }; if (!s.pt.logs) s.pt.logs = []; if (!s.pt.flags) s.pt.flags = {}; return s.pt; }
  const light = (p) => (p <= 2 ? ['good', 'Green: keep going'] : p <= 5 ? ['warn', 'Amber: hold the load'] : ['bad', 'Red: reduce the load']);

  OS.register('pt', {
    title: 'Physical therapy', icon: 'pt',
    render(s) {
      const P = ensure(s), reg = R[P.region] || R.knee, ph = Math.max(0, Math.min(3, P.phase || 0));
      const flagged = FLAGS.filter(([k]) => P.flags[k]), worst = flagged.some((f) => f[2] === 'emergency') ? 'emergency' : flagged.length ? 'urgent' : null;
      const logs = P.logs.filter((l) => l.region === P.region).slice(-14), last = logs[logs.length - 1];
      const trend = logs.length > 1 ? spark(logs.map((l) => l.pain), 160, 36, { min: 0, max: 10 }) : '';
      return `${OS.ui.head('Body · rehab', 'Physical therapy', 'Exercise-based rehab with pain monitoring. Myo guides recovery exercise; it does not diagnose. If pain is severe or getting worse, see a physiotherapist or doctor.',
        `<div class="hstat"><span>Region</span><b>${esc(reg.name)}</b></div><div class="hstat"><span>Phase</span><b class="num">${ph + 1} · ${PHASES[ph]}</b></div>${last ? `<div class="hstat"><span>Pain today</span><b class="num">${last.pain}/10</b></div>` : ''}`)}
      ${worst ? `<div class="redflag" role="alert"><div class="rf-h">${icon('biology', 18)}<b>${worst === 'emergency' ? 'Call your local emergency number or go to an emergency department now' : 'Get assessed by a doctor or physiotherapist before exercising this'}</b></div><ul>${flagged.map(([, l]) => `<li>${esc(l)}</li>`).join('')}</ul><p>Myo has paused the exercise plan for this region until a clinician has checked you.</p></div>` : ''}
      <div class="pt-regions" role="group" aria-label="Body region">${REG_KEYS.map((k) => `<button class="chip-btn ${k === P.region ? 'on' : ''}" data-act="pt-region" data-k="${k}" aria-pressed="${k === P.region}">${esc(R[k].name)}</button>`).join('')}</div>
      <div class="grid g-2-1">
        <div class="stack">
          <section class="card"><div class="card-h"><div><p class="eyebrow">${esc(reg.name)}</p><h2>${esc(reg.cond)}</h2></div><button class="btn sm" data-act="pt-add" ${worst ? 'disabled' : ''}>Add today's exercises to my protocol</button></div>
            <div class="seg pt-phases" role="group" aria-label="Phase">${PHASES.map((n, i) => `<button class="${i === ph ? 'on' : ''}" data-act="pt-phase" data-i="${i}" aria-pressed="${i === ph}">${i + 1} · ${n}</button>`).join('')}</div>
            ${worst ? '<p class="muted">The plan is hidden while a red flag is ticked.</p>' : `<ol class="pt-ex">${reg.phases[ph].map(([n, d, c]) => `<li><div><b>${esc(n)}</b><span class="muted small block">${esc(c)}</span></div><span class="num pt-dose">${esc(d)}</span></li>`).join('')}</ol>
            <div class="pt-gate">${icon('check', 15)}<div><b>${ph < 3 ? `Move to phase ${ph + 2} when` : 'Back to full training when'}</b><span class="small">${esc(reg.gates[Math.min(ph, 2)])}, and pain settles within 24 hours.</span></div></div>`}
            <div class="row"><a class="btn ghost sm" href="#ar" data-act="ar-open" data-ex="${reg.ar}">${icon('ar', 14)} Check form and range in AR-Vision</a><a class="btn ghost sm" href="#machines">${icon('machines', 14)} Test strength symmetry on ISO Flow</a></div></section>
          <section class="card"><div class="card-h"><h2>How much pain is OK</h2><span class="muted small">The traffic-light rule</span></div>
            <ul class="pt-lights"><li><span class="pill pill-good">0–2</span> Safe. Progress as planned.</li><li><span class="pill pill-warn">3–5</span> Acceptable if it settles by the next morning. Keep the load the same.</li><li><span class="pill pill-bad">6+</span> Too much. Drop the load or range, and tell Myo.</li></ul></section>
        </div>
        <div class="stack">
          <section class="card holo pt-body" aria-label="Muscles involved">${OS.Anatomy ? `<div class="a3d" data-a3d="compact" data-systems="skin,muscular,skeletal" data-view="${reg.view}" data-hi="${reg.hi.join(',')}"></div>` : ''}<p class="holo-note">Highlighted: the muscles this plan works.</p></section>
          <section class="card"><div class="card-h"><h2>Today's check-in</h2>${last ? pill(...light(last.pain)) : ''}</div>
            <form data-submit="pt-log" class="stack-sm">
              <label class="field" for="pt-pain"><span>Pain now (0 none · 10 worst)</span><input id="pt-pain" name="pain" type="range" min="0" max="10" value="${last ? last.pain : 3}"></label>
              <label class="field" for="pt-func"><span>What you can do today (0 nothing · 10 everything)</span><input id="pt-func" name="func" type="range" min="0" max="10" value="${last ? last.func : 6}"></label>
              <label class="ped-use"><input type="checkbox" name="done" ${last && last.d === dayKey() && last.done ? 'checked' : ''}> I did today's exercises</label>
              <button class="btn sm">Save check-in</button></form>
            ${trend ? `<div class="pt-trend"><span class="small muted">Pain, last ${logs.length} check-ins</span>${trend}</div>` : '<p class="fine">Check in daily: Myo moves you to the next phase only when pain stays green.</p>'}</section>
          <section class="card"><div class="card-h"><h2>Red-flag check</h2></div>
            <ul class="pt-flags">${FLAGS.map(([k, l]) => `<li><label class="ped-use"><input type="checkbox" data-change="pt-flag" data-k="${k}" ${P.flags[k] ? 'checked' : ''}> ${esc(l)}</label></li>`).join('')}</ul>
            <p class="fine">Any tick pauses the plan and tells you where to get help.</p></section>
        </div>
      </div>
      <p class="fine">Plans follow common physiotherapy practice for these conditions. Rehab after surgery or a fracture should follow your surgeon's and physiotherapist's plan; Myo can track it. Telehealth physiotherapy partners are planned.</p>`;
    },
    mount(root) { return OS.Anatomy ? OS.Anatomy.mountAll(root) : undefined; }
  });

  OS.act('pt-region', (el) => OS.update((s) => { const P = ensure(s); if (P.region !== el.dataset.k) { P.region = el.dataset.k; P.phase = 0; } }, { keepSample: true }));
  OS.act('pt-phase', (el) => OS.update((s) => { ensure(s).phase = +el.dataset.i; }, { keepSample: true }));
  OS.change('pt-flag', (el) => OS.update((s) => { ensure(s).flags[el.dataset.k] = el.checked; }, { keepSample: true }));
  OS.act('pt-log', (f) => {
    const pain = +f.elements.pain.value, func = +f.elements.func.value, done = f.elements.done.checked;
    OS.update((s) => { const P = ensure(s); P.logs = P.logs.filter((l) => !(l.d === dayKey() && l.region === P.region)); P.logs.push({ d: dayKey(), region: P.region, pain, func, done }); }, { keepSample: true });
    OS.toast(pain >= 6 ? 'Saved. Pain is high: drop the load or range, and see a clinician if it keeps rising.' : `Saved. ${light(pain)[1]}.`);
  });
  OS.act('pt-add', () => {
    const P = ensure(OS.state), reg = R[P.region], ph = P.phase || 0;
    OS.update((s) => {
      s.customProtocol = s.customProtocol || [];
      const id = 'pt-' + P.region;
      s.customProtocol = s.customProtocol.filter((x) => x.id !== id);
      s.customProtocol.push({ id, cat: 'training', time: 'Evening', title: `Rehab · ${reg.name}, phase ${ph + 1}`, detail: reg.phases[ph].map((x) => `${x[0]} ${x[1]}`).join(' · '), marker: null, route: 'pt' });
    }, { keepSample: true });
    OS.toast(`${reg.name} rehab added to today's protocol`);
  });
  OS.pt = { REGIONS: R };
})();
