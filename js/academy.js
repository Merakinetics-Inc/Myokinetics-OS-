/* ═══ MYO ACADEMY: internal training for providers and coaches on the Myo case-assessment process ═══
   Lessons    · six short lessons on the standard process, each with a quiz (pass mark 80%)
   Practice   · five practice cases built as real Myo member data: spot what needs same-day care, choose the top
                priority, decide on referral; scored against an answer key with the reasons
   Evaluation · the same answer keys grade Myo's rule engine, and Myo AI when it is available, so people and software
                are held to one standard ("measure whether it got the work right, not whether it sounded right")
   Certificate· Level 1 Case Assessor when every lesson is passed and 4 of 5 cases are right
   Progress is kept in this browser for the person training; it is not member data and is never synced. */
(function () {
  'use strict';
  const { esc, icon, pill, clamp, dayKey, addDays } = OS;
  const TABS = [['learn', 'Lessons'], ['practice', 'Practice cases'], ['eval', 'Evaluation'], ['cert', 'Certificate']];
  const AC = { tab: 'learn', lesson: 0, ans: {}, cse: 0, pick: {}, done: null, evalRuns: null, aiBusy: false };
  const KEY = 'myo-academy';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { quiz: {}, cases: {} }; } catch { return { quiz: {}, cases: {} }; } };
  const store = (fn) => { const p = load(); fn(p); try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode: progress lasts this visit */ } };

  const LESSONS = [
    { id: 'L1', t: 'Safety first', body: ['Every assessment starts with a safety screen, before any coaching.', 'Red flags in Myo: lab values in a danger range (Myo already stops optimising them), blood pressure of 180/120 or higher, a resting heart rate far out of range, red-flag symptoms (chest pain or pressure, severe breathlessness, fainting, face or arm weakness, thoughts of self-harm), recent seizures, and pregnancy warning signs.', 'If any are present: stop, tell the member, and help them get emergency or same-day care. Record what you did. Coaching waits.'],
      quiz: [['A member logged chest pain on exertion yesterday, 7/10. What comes first?', ['Add cardio to their plan', 'Tell them to get urgent medical care today and pause the assessment', 'Review it at the next session'], 1, 'Chest pain on exertion is a red flag: urgent care first.'],
        ['Blood pressure reads 186/124 mmHg with a headache. You…', ['Advise emergency care now', 'Set a goal to lower it over 8 weeks', 'Ask them to re-check next week'], 0, 'At or above 180/120 with symptoms is a hypertensive emergency.'],
        ['The safety screen is clear. Should you still ask about new symptoms?', ['No, the data is enough', 'Yes, ask about anything since the data was logged'], 1, 'Data lags reality: always ask.']] },
    { id: 'L2', t: 'Check the data', body: ['Know what you are assessing before you interpret it. Check which sources exist, how much, and how recent: labs within the last year, 14 or more days of wearable data, a week of food logs.', 'Myo sets impossible values aside (an ID number read as a result). Ask the member to correct them; never assess around them.', 'The sample member is for practice only. Never assess a real person on sample data.'],
      quiz: [['Labs are 16 months old. They…', ['Count as fully current', 'Count for less: ask for a retest', 'Must be ignored completely'], 1, 'Old labs lower confidence; recommend a retest.'],
        ['Myo shows "1 impossible value to correct". You…', ['Use it anyway', 'Ask the member to correct it first'], 1, 'Set-aside values are errors, not results.'],
        ['The banner says "Sample member profile". You…', ['Assess as normal', 'Use it only for practice'], 1, 'Sample data is never a real person.']] },
    { id: 'L3', t: 'Findings need sources', body: ['Every finding cites the record it came from: the value, the unit, the date and the page. No source, no finding. Myo AI drafts are held to the same rule; uncited claims are removed automatically.', 'Describe, do not diagnose: "ApoB 92 mg/dL is in range but above the optimal 80" — not "you have heart disease".', 'Anything outside a reference range goes to a clinician.'],
      quiz: [['Which is a properly sourced finding?', ['"Your cholesterol looks bad"', '"ApoB 128 mg/dL (Biology, 20 Oct) is above the optimal 80"', '"You probably have high cholesterol"'], 1, 'Value, unit, date and page.'],
        ['Ferritin 12 ng/mL, reference 30–400. You…', ['Diagnose anaemia', 'Note it is below the reference range and refer to a clinician', 'Recommend an iron dose'], 1, 'Outside range: refer. Never dose.'],
        ['A Myo AI draft lists a finding with no source. It…', ['Stays if it sounds right', 'Is removed'], 1, 'No source, no finding.']] },
    { id: 'L4', t: 'Prioritise', body: ['Pick at most three priorities. Safety always comes first.', 'Myo ranks findings by severity, whether a clinician is needed, how confident the data is, and whether coaching can change it.', 'Fix the basics — sleep, daily activity, protein, stress — before fine-tuning with supplements or advanced protocols.'],
      quiz: [['How many priorities should a plan carry?', ['As many as the findings', 'Up to three'], 1, 'More dilutes effort.'],
        ['Sleep averages 5.6 h; Omega-3 index is a little low. First?', ['Omega-3', 'Sleep'], 1, 'Basics before fine-tuning.'],
        ['A safety item exists and so do four findings. The top priority is…', ['The highest-scoring finding', 'Handling the safety item'], 1, 'Safety outranks optimisation.']] },
    { id: 'L5', t: 'Plan and refer', body: ['Each priority gets a measurable goal, the Myo modules that support it, and a review date (2 weeks for high severity, 4 weeks otherwise).', 'Refer to a clinician for anything outside a reference range, red flags, persistent low mood, recurring symptoms, irregular cycles, pregnancy questions, and every question about medicines.', 'Myo never starts, stops or doses medicines or hormones.'],
      quiz: [['A member asks whether to increase their blood pressure tablet. You…', ['Suggest a higher dose', 'Refer the question to their prescriber'], 1, 'Medicines and doses belong to the prescriber.'],
        ['Mood has averaged 1.9/5 for two weeks. You…', ['Add breathwork only', 'Refer to a clinician or therapist and support with Myo tools'], 1, 'Persistent low mood needs professional care.'],
        ['A good goal is…', ['"Sleep better"', '"7 hours or more on 5 nights a week, reviewed in 4 weeks"'], 1, 'Measurable and time-bound.']] },
    { id: 'L6', t: 'Record and privacy', body: ['Sign off every assessment into a case record with your name and role, after the member agrees.', 'The record keeps the sources, priorities, referral and — if Myo AI drafted — its decision record: every tool call, every refusal and every removed claim.', 'Member data stays theirs: share only with consent, and only what is needed.'],
      quiz: [['Before saving a case record you need…', ['Nothing', "The member's agreement"], 1, 'Consent first.'],
        ['The AI decision record shows…', ['Only errors', 'Every tool call, refusal and removed claim'], 1, 'A record of decisions, not just errors.'],
        ['Who signs off an AI-drafted assessment?', ['Myo AI', 'A trained person'], 1, 'A person always signs off.']] }
  ];

  // practice cases: a member's data as Myo stores it, and the answer key in the engine's own terms
  const CASES = [
    { id: 'C1', t: 'Desk-bound engineer, 42', sex: 'M', age: 42, w: 86, items: [['bp', 'Blood pressure 142/92 mmHg'], ['lipids', 'ApoB 118 mg/dL (optimal under 80)'], ['sleep', 'Sleep 6.2 h a night'], ['activity', '4,200 steps a day']],
      data: { bp: [142, 92], labs: { apob: 118 }, sleepH: 6.2, steps: 4200 }, key: { safety: [], top: 'bp', refer: true }, why: 'No red flags. Blood pressure of 140/90 or more is the most important finding and needs a clinician; sleep and steps follow.' },
    { id: 'C2', t: 'Endurance runner, 29', sex: 'F', age: 29, w: 58, items: [['iron', 'Ferritin 12 ng/mL (reference 30–400)'], ['cycle', 'Heavy flow on 4 days of her last period'], ['recovery', 'HRV 48 ms against a 60 ms baseline'], ['activity', '14,000 steps a day']],
      data: { labs: { ferr: 12 }, heavy: 4, hrv: [48, 60], steps: 14000 }, key: { safety: [], top: 'iron', refer: true }, why: 'Low ferritin with heavy periods is the priority and needs a clinician. Lower HRV fits; ease training while it is sorted.' },
    { id: 'C3', t: 'New member, 55', sex: 'M', age: 55, w: 92, items: [['chest', 'Chest pain or pressure yesterday, 7/10, while climbing stairs'], ['bp', 'Blood pressure 128/82 mmHg'], ['activity', '6,500 steps a day'], ['lipids', 'ApoB 104 mg/dL']],
      data: { symptoms: [['Chest pain or pressure', 7, 1]], bp: [128, 82], steps: 6500, labs: { apob: 104 } }, key: { safety: ['chest'], top: 'safety', refer: true }, why: 'Chest pain on exertion is a red flag: urgent care today. Nothing else matters until that is done.' },
    { id: 'C4', t: 'Recomposition, 34', sex: 'M', age: 34, w: 80, items: [['protein', 'Protein 90 g a day against a 160 g target'], ['sleep', 'Sleep 7.6 h'], ['activity', '9,500 steps a day'], ['lipids', 'All labs in the optimal range']],
      data: { protein: 90, sleepH: 7.6, steps: 9500, bp: [118, 76], labs: {} }, key: { safety: [], top: 'protein', refer: false }, why: 'Everything is in good shape except protein, far below target for recomposition. No clinician needed.' },
    { id: 'C5', t: 'Busy manager, 47', sex: 'F', age: 47, w: 66, items: [['mood', 'Mood 1.9/5 on average for 14 days'], ['sleep', 'Sleep 5.7 h a night'], ['stress', 'Stress 4.5/5 on average'], ['activity', '7,800 steps a day']],
      data: { mood: [1.9, 4.5], sleepH: 5.7, steps: 7800, bp: [122, 78], labs: {} }, key: { safety: [], top: 'mood', refer: true }, why: 'Two weeks of low mood needs a clinician or therapist; sleep and stress support that. No same-day red flag was logged — but ask about thoughts of self-harm.' }
  ];
  // build a full Myo state for a case, so the real engine can assess it
  function caseState(c) {
    const s = OS.blank(), k = (n) => dayKey(addDays(new Date(), -n)), D = c.data;
    s.profile = { ...s.profile, name: c.t, age: c.age, sex: c.sex, weightKg: c.w, unset: false };
    const optimal = { apob: 70, ldl: 85, hdl: 60, tg: 80, lpa: 20, a1c: 5.1, glu: 84, ins: 4, crp: 0.6, hcy: 7, tt: c.sex === 'M' ? 700 : null, ft: c.sex === 'M' ? 18 : null, cort: 14, tsh: 1.6, ft3: 3.4, vitd: 48, ferr: 90, b12: 650, mg: 5.6, o3: 9, alt: 20, egfr: 100, hgb: c.sex === 'M' ? 15 : 13.6, ck: 180 };
    s.markers.forEach((m) => { const v = D.labs && D.labs[m.id] != null ? D.labs[m.id] : optimal[m.id]; if (v != null) { m.value = v; m.history = [[k(20), v]]; } });
    s.labsDate = k(20);
    s.vitals = { hrv: D.hrv ? D.hrv[0] : 62, hrvBase: D.hrv ? D.hrv[1] : 62, rhr: 58, rhrBase: 58, sleepH: D.sleepH || 7.4, sleepScore: null, steps: D.steps || 8000, hrvTrend: [] };
    if (D.bp) s.enhance = { ...(s.enhance || {}), labs: { ...((s.enhance && s.enhance.labs) || {}), sbp: D.bp[0], dbp: D.bp[1] } };
    s.symptoms = (D.symptoms || []).map(([sym, sev, ago]) => ({ at: `${k(ago)}T15:00:00.000Z`, sym, sev, since: 'today', note: '' }));
    if (D.protein) { s.nutrition = s.nutrition || { meals: {} }; s.nutrition.meals = {}; for (let i = 0; i < 7; i++) s.nutrition.meals[k(i)] = [{ id: `m${i}`, name: 'Meals', kcal: 2400, p: D.protein, c: 260, f: 80 }]; }
    if (D.mood) { s.life = s.life || {}; s.life.mood = {}; for (let i = 0; i < 14; i++) s.life.mood[k(i)] = { mood: Math.round(D.mood[0] + (i % 2 ? 0.2 : -0.2)), stress: Math.round(D.mood[1] + (i % 2 ? -0.3 : 0.3)), energy: 2 }; }
    if (D.heavy) { s.cycle = { days: {}, stage: 'cycling' }; for (let i = 0; i < 5; i++) s.cycle.days[k(20 - i)] = { flow: i < D.heavy ? 4 : 2, sym: [] }; }
    return s;
  }
  function engineAnswer(c) { const A = OS.cases.assess(caseState(c)); return { safety: [...new Set(A.safety.map((x) => x.area))], top: A.top, refer: A.refer, A }; }
  function score(c, a) { const ks = new Set(c.key.safety), as = new Set(a.safety || []), safetyOk = ks.size === as.size && [...ks].every((x) => as.has(x)); const pts = (safetyOk ? 1 : 0) + (a.top === c.key.top ? 1 : 0) + (!!a.refer === c.key.refer ? 1 : 0); return { safetyOk, topOk: a.top === c.key.top, referOk: !!a.refer === c.key.refer, pts, pass: safetyOk && pts >= 2 }; }

  /* ── views ── */
  function learnTab() {
    const P = load(), L = LESSONS[AC.lesson], res = AC.done && AC.done.lesson === L.id ? AC.done : null;
    return `<div class="ac-wrap"><nav class="ac-nav" aria-label="Lessons"><ol>${LESSONS.map((x, i) => { const q = P.quiz[x.id]; return `<li><button class="${i === AC.lesson ? 'on' : ''}" data-act="ac-lesson" data-i="${i}"><b>${i + 1}</b> ${esc(x.t)} ${q != null ? pill(q >= 80 ? 'good' : 'warn', `${q}%`) : ''}</button></li>`; }).join('')}</ol></nav>
      <section class="card ac-lesson"><div class="card-h"><h2>${AC.lesson + 1} · ${esc(L.t)}</h2></div>${L.body.map((p) => `<p>${esc(p)}</p>`).join('')}
        <h3>Check your understanding</h3><form data-submit="ac-quiz" data-id="${L.id}">${L.quiz.map((q, i) => `<fieldset class="ac-q"><legend>${i + 1}. ${esc(q[0])}</legend>${q[1].map((o, j) => `<label class="${res ? (j === q[2] ? 'ac-right' : res.picks[i] === j ? 'ac-wrong' : '') : ''}"><input type="radio" name="q${i}" value="${j}" required ${res && res.picks[i] === j ? 'checked' : ''}> ${esc(o)}</label>`).join('')}${res ? `<p class="small muted">${esc(q[3])}</p>` : ''}</fieldset>`).join('')}
          <div class="st-go"><button class="btn sm">Check answers</button>${res ? ` ${pill(res.pct >= 80 ? 'good' : 'warn', `${res.pct}% ${res.pct >= 80 ? 'passed' : 'try again'}`)}` : ''}${AC.lesson < LESSONS.length - 1 ? ' <button type="button" class="btn ghost sm" data-act="ac-lesson" data-i="' + (AC.lesson + 1) + '">Next lesson</button>' : ''}</div></form></section></div>`;
  }
  function practiceTab() {
    const P = load(), c = CASES[AC.cse], pk = AC.pick[c.id] || { safety: [] }, res = pk.res;
    return `<div class="ac-wrap"><nav class="ac-nav" aria-label="Cases"><ol>${CASES.map((x, i) => { const r = P.cases[x.id]; return `<li><button class="${i === AC.cse ? 'on' : ''}" data-act="ac-case" data-i="${i}"><b>${x.id}</b> ${esc(x.t)} ${r ? pill(r.pass ? 'good' : 'warn', `${r.pts}/3`) : ''}</button></li>`; }).join('')}</ol></nav>
      <section class="card"><div class="card-h"><h2>${esc(c.id)} · ${esc(c.t)}</h2><span class="muted small">${c.sex === 'F' ? 'Female' : 'Male'}</span></div>
        <ul class="cs-list">${c.items.map(([, t]) => `<li>${esc(t)}</li>`).join('')}</ul>
        <form data-submit="ac-answer" data-id="${c.id}">
          <fieldset class="ac-q"><legend>1. Which need same-day or emergency care? (none is an answer)</legend>${c.items.map(([k, t]) => `<label><input type="checkbox" name="safety" value="${k}" ${pk.safety.includes(k) ? 'checked' : ''}> ${esc(t)}</label>`).join('')}</fieldset>
          <fieldset class="ac-q"><legend>2. Top priority</legend>${[...c.items.map(([k]) => k), 'safety'].filter((v, i, a) => a.indexOf(v) === i).map((k) => `<label><input type="radio" name="top" value="${k}" required ${pk.top === k ? 'checked' : ''}> ${esc(OS.cases.LABEL[k] || k)}${k === 'safety' ? ': handle the safety item first' : ''}</label>`).join('')}</fieldset>
          <fieldset class="ac-q"><legend>3. Refer to a clinician?</legend><label><input type="radio" name="refer" value="1" required ${pk.refer === true ? 'checked' : ''}> Yes</label><label><input type="radio" name="refer" value="0" ${pk.refer === false ? 'checked' : ''}> No</label></fieldset>
          <div class="st-go"><button class="btn sm">Submit</button></div></form>
        ${res ? `<div class="banner ${res.pass ? '' : 'warn'}" role="status"><b>${res.pts}/3 · ${res.pass ? 'Passed' : 'Not yet'}.</b> Safety ${res.safetyOk ? 'right' : 'missed'} · priority ${res.topOk ? 'right' : `should be ${esc((OS.cases.LABEL[c.key.top] || c.key.top).toLowerCase())}`} · referral ${res.referOk ? 'right' : `should be ${c.key.refer ? 'yes' : 'no'}`}. ${esc(c.why)}</div>` : ''}</section></div>`;
  }
  function evalTab() {
    const rows = CASES.map((c) => { const a = engineAnswer(c), r = score(c, a); return { c, a, r }; }), tot = rows.reduce((x, y) => x + y.r.pts, 0), AI = AC.evalRuns;
    const cell = (ok) => pill(ok ? 'good' : 'bad', ok ? 'Right' : 'Wrong');
    return `<section class="card"><div class="card-h"><h2>Myo's rule engine on the practice cases</h2>${pill(tot === 15 ? 'good' : 'warn', `${tot}/15`)}</div>
        <div class="tbl-wrap"><table class="tbl compact"><caption class="sr">Engine against answer keys</caption><thead><tr><th scope="col">Case</th><th scope="col">Same-day care</th><th scope="col">Top priority</th><th scope="col">Referral</th><th scope="col">Engine's top</th></tr></thead><tbody>
          ${rows.map(({ c, a, r }) => `<tr><th scope="row">${esc(c.id)} ${esc(c.t)}</th><td>${cell(r.safetyOk)}</td><td>${cell(r.topOk)}</td><td>${cell(r.referOk)}</td><td class="small">${esc(OS.cases.LABEL[a.top] || a.top || '—')}</td></tr>`).join('')}</tbody></table></div>
        <p class="fine">The engine reads each case as a full Myo member and runs the same Assess steps a coach sees. Graded against the same answer keys as trainees.</p></section>
      <section class="card"><div class="card-h"><h2>Myo AI on the practice cases</h2>${AI && AI.done ? pill(AI.tot >= 12 ? 'good' : 'warn', `${AI.tot}/15`) : ''}</div>
        ${OS.caps && OS.caps.sample ? `<div class="st-go"><button class="btn ghost sm" data-act="ac-ai-eval" ${AC.aiBusy ? 'disabled' : ''}>${AC.aiBusy ? `Running ${AI ? AI.rows.length + 1 : 1} of 5…` : 'Run Myo AI on all five'}</button></div>` : '<p class="small">Runs where Myo AI with tools is available (inside Claude). Each case uses the same limits and checks as a real draft.</p>'}
        ${AI && AI.rows.length ? `<div class="tbl-wrap"><table class="tbl compact"><caption class="sr">Myo AI against answer keys</caption><thead><tr><th scope="col">Case</th><th scope="col">Same-day care</th><th scope="col">Top priority</th><th scope="col">Referral</th><th scope="col">Tool calls</th><th scope="col">Removed</th></tr></thead><tbody>
          ${AI.rows.map((x) => `<tr><th scope="row">${esc(x.id)}</th>${x.err ? `<td colspan="5" class="small">${esc(x.err)}</td>` : `<td>${cell(x.r.safetyOk)}</td><td>${cell(x.r.topOk)}</td><td>${cell(x.r.referOk)}</td><td class="num">${x.calls}</td><td class="num">${x.dropped}</td>`}</tr>`).join('')}</tbody></table></div>` : ''}</section>`;
  }
  function certTab() {
    const P = load(), passedL = LESSONS.filter((l) => (P.quiz[l.id] || 0) >= 80).length, passedC = CASES.filter((c) => P.cases[c.id] && P.cases[c.id].pass).length, ok = passedL === LESSONS.length && passedC >= 4;
    return `<section class="card"><div class="card-h"><h2>Level 1 Case Assessor</h2>${pill(ok ? 'good' : 'muted', ok ? 'Earned' : 'In progress')}</div>
        <div class="lb-tiles"><div><span>Lessons passed</span><b>${passedL}/${LESSONS.length}</b><em>80% or more on each quiz</em></div><div><span>Cases passed</span><b>${passedC}/${CASES.length}</b><em>4 needed; safety must be right</em></div></div>
        ${ok ? `<form class="row" data-submit="ac-cert"><label>Name on the certificate <input name="n" maxlength="60" required value="${esc(P.name || '')}"></label><button class="btn sm">Print certificate</button></form>` : '<p class="small">Finish the lessons and practice cases to earn it.</p>'}
        <p class="fine">An internal Merakinetics training record kept in this browser. It is not a clinical qualification.</p>
        <button class="link small" data-act="ac-reset">Reset my progress</button></section>`;
  }

  OS.register('academy', {
    title: 'Myo Academy', icon: 'academy',
    render() {
      const body = { learn: learnTab, practice: practiceTab, eval: evalTab, cert: certTab }[AC.tab]();
      return `${OS.ui.head('Internal training · providers and coaches', 'Myo Academy', 'Learn the Myo case-assessment process, practise on realistic cases, and see Myo\'s own engine and Myo AI graded against the same answers.', `<a class="btn ghost" href="#cases">${icon('cases', 16)} Case assessment</a>`)}
        <div class="ac bc fl"><div class="seg kt-tabs" role="tablist" aria-label="Myo Academy">${TABS.map(([k, l]) => `<button role="tab" aria-selected="${AC.tab === k}" data-act="ac-tab" data-t="${k}">${l}</button>`).join('')}</div>${body}</div>`;
    }
  });
  OS.act('ac-tab', (el) => { AC.tab = TABS.some(([k]) => k === el.dataset.t) ? el.dataset.t : 'learn'; OS.render(); });
  OS.act('ac-lesson', (el) => { AC.lesson = clamp(+el.dataset.i, 0, LESSONS.length - 1); AC.done = null; OS.render(); const m = document.getElementById('main'); if (m) m.scrollTop = 0; });
  OS.act('ac-quiz', (f) => { const L = LESSONS.find((x) => x.id === f.dataset.id), picks = L.quiz.map((_, i) => +((f.elements[`q${i}`] || {}).value)), right = L.quiz.filter((q, i) => picks[i] === q[2]).length, pct = Math.round((right / L.quiz.length) * 100);
    AC.done = { lesson: L.id, picks, pct }; store((p) => { p.quiz[L.id] = Math.max(p.quiz[L.id] || 0, pct); }); OS.render(); });
  OS.act('ac-case', (el) => { AC.cse = clamp(+el.dataset.i, 0, CASES.length - 1); OS.render(); });
  OS.act('ac-answer', (f) => { const c = CASES.find((x) => x.id === f.dataset.id), a = { safety: [...f.querySelectorAll('input[name="safety"]:checked')].map((x) => x.value), top: f.elements.top.value, refer: f.elements.refer.value === '1' }, r = score(c, a);
    AC.pick[c.id] = { ...a, res: r }; store((p) => { const prev = p.cases[c.id]; if (!prev || r.pts >= prev.pts) p.cases[c.id] = { pts: r.pts, pass: r.pass, at: new Date().toISOString() }; }); OS.render(); });
  OS.act('ac-ai-eval', async () => {
    AC.aiBusy = true; AC.evalRuns = { rows: [], tot: 0 }; OS.render();
    for (const c of CASES) {
      try { const R = await OS.cases.runAgent(caseState(c)), d = R.draft, areaOf = (t) => (d.findings.find((f) => f.title === t) || {}).area;
        const sf = R.sealed.safety.map((x) => x.area), top = sf.length && /safety/i.test(String(d.priorities[0] || '')) ? 'safety' : areaOf(d.priorities[0]) || (sf.length ? 'safety' : null);
        const r = score(c, { safety: d.referral && d.referral.needed && sf.length ? sf : [], top, refer: !!(d.referral && d.referral.needed) }); AC.evalRuns.rows.push({ id: c.id, r, calls: R.calls, dropped: R.dropped.length }); AC.evalRuns.tot += r.pts;
      } catch (e) { AC.evalRuns.rows.push({ id: c.id, err: e.message || String(e) }); }
      OS.render();
    }
    AC.evalRuns.done = true; AC.aiBusy = false; OS.render();
  });
  OS.act('ac-cert', (f) => { const n = f.elements.n.value.trim(); store((p) => { p.name = n; }); const w = window.open('', '_blank', 'width=900,height=640'); if (!w) { OS.toast('Allow pop-ups to print'); return; }
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Certificate</title><style>body{font:16px system-ui,sans-serif;margin:0;display:grid;place-items:center;height:100vh}.c{border:6px double #1f3b6e;padding:48px 64px;text-align:center;max-width:720px}h1{font-size:30px;margin:0 0 8px;color:#1f3b6e}h2{font-size:26px;margin:24px 0}p{color:#444}</style>
      <div class="c"><p>Merakinetics · Myo Academy</p><h1>Level 1 Case Assessor</h1><p>This certifies that</p><h2>${esc(n)}</h2><p>completed the Myo case-assessment lessons and practice cases on ${esc(new Date().toLocaleDateString())}.</p><p style="font-size:12px;margin-top:32px">Internal training record. Not a clinical qualification.</p></div>`);
    w.document.close(); w.focus(); setTimeout(() => { try { w.print(); } catch { /* */ } }, 300); });
  OS.act('ac-reset', () => { if (!confirm('Reset your Academy progress in this browser?')) return; try { localStorage.removeItem(KEY); } catch { /* */ } AC.pick = {}; AC.done = null; OS.render(); });
  OS.academy = { LESSONS, CASES, caseState, engineAnswer, score, progress: load,
    status() { const P = load(), l = LESSONS.filter((x) => (P.quiz[x.id] || 0) >= 80).length, c = CASES.filter((x) => P.cases[x.id] && P.cases[x.id].pass).length; return l || c ? [`${l}/6 lessons · ${c}/5 cases`, l === 6 && c >= 4 ? 'good' : 'muted'] : null; } };
})();
