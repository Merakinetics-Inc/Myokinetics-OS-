/* ═══ MYO — LONGEVITY: biological age, healthspan pillars and an evidence-graded longevity protocol ═══
   Biological age: Levine PhenoAge (2018) from 9 routine labs + age. Fitness age: VO2max against
   age norms (FRIEND registry medians). Pillars score the levers with the strongest mortality data.
   Prescription geroprotectors are reference only: no doses (same boundary as Stack). */
(function () {
  'use strict';
  const { esc, pill, icon, clamp } = OS;

  // PhenoAge inputs not in the core panel. Glucose and hs-CRP come from Biology.
  const PH = [
    ['alb', 'Albumin', 'g/dL', 3.5, 5.5], ['cr', 'Creatinine', 'mg/dL', 0.5, 1.4], ['lym', 'Lymphocytes', '%', 15, 50],
    ['mcv', 'MCV', 'fL', 75, 105], ['rdw', 'RDW', '%', 10, 17], ['alp', 'Alkaline phosphatase', 'U/L', 25, 150], ['wbc', 'White blood cells', '×10³/µL', 2, 15]
  ];
  const SAMPLE_PH = { alb: 4.7, cr: 1.0, lym: 33, mcv: 89, rdw: 13.2, alp: 64, wbc: 5.6 };
  // FRIEND treadmill VO2max medians by decade (ml/kg/min)
  const VO2_MED = { M: [[20, 48], [30, 43], [40, 38.5], [50, 34], [60, 30], [70, 26], [80, 22]], F: [[20, 38], [30, 34], [40, 30.5], [50, 27], [60, 24], [70, 21], [80, 18]] };

  // Protocol: [id, pillar, grade, title, detail, cat, time]
  const PROTO = [
    ['z2', 'cardio', 'A', 'Zone 2 cardio, 150–240 min a week', 'Conversational pace (60–70% HRmax), 3–4 sessions. Builds mitochondria and insulin sensitivity.', 'training', 'Daily'],
    ['vo2', 'cardio', 'A', 'VO₂max intervals once a week', '4 × 4 min at 90–95% HRmax, 3 min easy between. VO₂max is the strongest single predictor of all-cause mortality.', 'training', 'Weekly'],
    ['str', 'muscle', 'A', 'Strength train 2–3× a week, every major pattern', 'Squat, hinge, push, pull, carry. Keep 2 reps in reserve. Muscle and grip strength protect against falls, frailty and metabolic disease.', 'training', 'Weekly'],
    ['pwr', 'muscle', 'B', 'Power and balance work, 10 min', 'Jumps, fast step-ups, single-leg balance. Power declines fastest with age and predicts falls.', 'training', 'Twice weekly'],
    ['prot', 'metabolic', 'A', 'Protein 1.6 g/kg a day, fibre 30 g+', 'Spread protein over 3–4 meals. Mostly whole foods; plants, fish, olive oil.', 'nutrition', 'All day'],
    ['alc', 'metabolic', 'A', 'Alcohol: as little as possible', 'Under 3 drinks a week, none within 3 h of bed. Alcohol raises cancer risk and wrecks sleep quality.', 'nutrition', 'All day'],
    ['sleep', 'sleep', 'A', '7–9 h sleep, same times every day', 'Sleep regularity predicts mortality as well as duration does. Keep wake time within 30 min, weekends too.', 'sleep', '22:30'],
    ['sauna', 'cardio', 'B', 'Sauna 4–7× a week, 20 min at 80 °C', 'Linked with lower cardiovascular and all-cause mortality in Finnish cohorts. Hydrate; skip after alcohol.', 'mind', 'Evening'],
    ['social', 'mind', 'B', 'Daily social contact and a sense of purpose', 'Loneliness carries a mortality risk similar to smoking. Schedule it like training.', 'mind', 'Daily'],
    ['nonic', 'cardio', 'A', 'No smoking or vaping; daily sunscreen', 'Nicotine raises blood pressure and arterial stiffness. UV drives most skin ageing and skin cancer.', 'mind', 'Morning'],
    ['crea', 'muscle', 'B', 'Creatine 3–5 g daily', 'Helps keep muscle and strength with age; early data for cognition.', 'supplement', 'Daily'],
    ['o3', 'cardio', 'B', 'Omega-3, 2 g EPA + DHA', 'Aim for an omega-3 index of 8% or higher.', 'supplement', 'Dinner'],
    ['tre', 'metabolic', 'C', 'Eating window of 10–12 h', 'Mixed evidence beyond its effect on total calories. Stop eating 3 h before bed.', 'nutrition', 'All day']
  ];
  const PROTO_GRADE = { A: ['peak', 'A · strong'], B: ['good', 'B · good'], C: ['warn', 'C · mixed'] };
  const PILLARS = [
    ['cardio', 'Cardiorespiratory fitness'], ['muscle', 'Muscle and strength'], ['metabolic', 'Metabolic health'],
    ['heart', 'Heart and arteries'], ['inflam', 'Inflammation'], ['sleep', 'Sleep and recovery'], ['mind', 'Mind and connection']
  ];

  // Geroprotectors: reference only, no doses for prescription drugs
  const GERO = [
    { name: 'Rapamycin (sirolimus)', kind: 'Prescription', ev: 'Extends lifespan in mice across labs. Human ageing trials are small; it suppresses immunity at transplant doses.', st: 'Off-label for ageing; needs a prescriber.' },
    { name: 'Metformin', kind: 'Prescription', ev: 'Diabetes drug. The TAME trial on ageing is still pending. It can blunt fitness gains from training.', st: 'Off-label for ageing; needs a prescriber.' },
    { name: 'GLP-1 agonists (semaglutide, tirzepatide)', kind: 'Prescription', ev: 'Lower cardiovascular events in people with obesity. Muscle loss is a risk without strength training and protein.', st: 'Prescription for obesity or diabetes.' },
    { name: 'SGLT2 inhibitors', kind: 'Prescription', ev: 'Protect heart and kidneys in people with diabetes, heart failure or kidney disease.', st: 'Prescription only.' },
    { name: 'NAD⁺ precursors (NR, NMN)', kind: 'Supplement', ev: 'Raise blood NAD⁺ levels. No proven effect on human ageing outcomes yet.', st: 'Sold as supplements; quality varies. Grade C.' },
    { name: 'Senolytics (fisetin, dasatinib + quercetin)', kind: 'Mixed', ev: 'Clear senescent cells in animals. Human evidence is early and small.', st: 'Dasatinib is a prescription cancer drug. Fisetin is a supplement. Grade D.' }
  ];
  // Screenings: [title, from age, sex|null, how often]
  const SCREEN = [
    ['Blood pressure check', 18, null, 'Every year'], ['Lipids + ApoB, and Lp(a) once in your life', 18, null, 'Every 1–3 years'], ['Skin check', 18, null, 'Every year'],
    ['Dental cleaning', 18, null, 'Every 6 months'], ['Eye exam', 18, null, 'Every 2 years'], ['Cervical screening', 21, 'F', 'Every 3–5 years to 65'],
    ['DEXA scan: body composition and bone baseline', 30, null, 'Baseline, then every 2–3 years'], ['Coronary calcium (CAC) scan', 40, null, 'Once from 40, if risk factors'],
    ['Mammogram', 40, 'F', 'Every 2 years'], ['Colorectal cancer screening', 45, null, 'Colonoscopy every 10 years, or stool test yearly'],
    ['Prostate (PSA) discussion', 50, 'M', 'Every 2 years from 55–69'], ['Low-dose lung CT', 50, null, 'Yearly, only with a heavy smoking history'], ['Bone density', 65, 'F', 'From 65']
  ];

  function ensure(s) {
    if (!s.longevity) s.longevity = { ph: s.sample ? { ...SAMPLE_PH } : {}, phSrc: s.sample ? 'Sample panel' : '', vo2: null, grip: null, waist: s.sample ? 84 : null, plan: null };
    return s.longevity;
  }
  const mk = (s, id) => s.markers.find((m) => m.id === id);

  // Levine 2018 PhenoAge. Inputs in US units, converted to the model's units.
  const phenoReady = (s) => !PH.some(([k]) => ensure(s).ph[k] == null || isNaN(ensure(s).ph[k]));
  // the model itself, for any day: glucose mg/dL, hs-CRP mg/L and age at that day (the year-to-date chart rebuilds past points)
  function phenoCalc(L, gluMg, crpMgL, age) {
    if (PH.some(([k]) => L[k] == null || isNaN(L[k])) || !Number.isFinite(Number(gluMg)) || !Number.isFinite(Number(crpMgL)) || age == null) return null;
    const xb = -19.907 - 0.0336 * (L.alb * 10) + 0.0095 * (L.cr * 88.4) + 0.1953 * (gluMg / 18.016) + 0.0954 * Math.log(Math.max(0.01, crpMgL) / 10)
      - 0.0120 * L.lym + 0.0268 * L.mcv + 0.3306 * L.rdw + 0.00188 * L.alp + 0.0554 * L.wbc + 0.0804 * age;
    const M = 1 - Math.exp(-Math.exp(xb) * (Math.exp(120 * 0.0076927) - 1) / 0.0076927);
    const v = 141.50225 + Math.log(-0.00553 * Math.log(1 - M)) / 0.090165;
    return Number.isFinite(v) ? v : null;
  }
  function phenoAge(s) {
    const glu = mk(s, 'glu'), crp = mk(s, 'crp');
    if (!glu || !crp || !OS.hasValue(glu) || !OS.hasValue(crp) || !OS.plausible('glu', glu.value) || !OS.plausible('crp', crp.value)) return null;
    return phenoCalc(ensure(s).ph, Number(glu.value), Number(crp.value), s.profile.age);
  }
  // VO2max: measured > athlete benchmark > Uth estimate from resting HR
  function vo2Of(s) {
    const G = ensure(s), b = s.athlete && s.athlete.bench && s.athlete.bench.runner && parseFloat(s.athlete.bench.runner.vo2);
    if (G.vo2) return { v: +G.vo2, src: 'Measured' };
    if (b) return { v: b, src: 'Runner benchmark' };
    if (!s.vitals.rhr) return { v: null, src: 'Needs a resting heart rate or a VO2max test' };
    return { v: 15.3 * (208 - 0.7 * s.profile.age) / s.vitals.rhr, src: 'Estimated from resting HR' };
  }
  function fitnessAge(sex, v) {
    if (v == null || !Number.isFinite(v)) return null;
    const t = VO2_MED[sex === 'F' ? 'F' : 'M'];
    if (v >= t[0][1]) return 25 - (v - t[0][1]) * 0.8;
    for (let i = 0; i < t.length - 1; i++) {
      const [a1, v1] = t[i], [a2, v2] = t[i + 1];
      if (v <= v1 && v >= v2) return a1 + 5 + ((v1 - v) / (v1 - v2)) * (a2 - a1);
    }
    return 85 + (t[t.length - 1][1] - v) * 1.5;
  }
  // Elite = top 2.5% for age, about 1.5× the median
  const vo2Target = (sex, age) => { const t = VO2_MED[sex === 'F' ? 'F' : 'M'], row = t.find((r, i) => age < (t[i + 1] || [999])[0]) || t[t.length - 1]; return Math.round(row[1] * 1.45); };

  function pillars(s, sc) {
    const e = (id) => { const m = mk(s, id); return m ? OS.markerEval(m).score : null; };
    const avg = (xs) => { const v = xs.filter((x) => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
    const v = vo2Of(s), tgt = vo2Target(s.profile.sex, s.profile.age), labs = (s.enhance && s.enhance.labs) || {};
    const cap = OS.athlete ? OS.athlete.capacities(s, sc).c : null;
    const G = ensure(s), wht = G.waist ? G.waist / s.profile.heightCm : null;
    const bp = labs.sbp ? clamp(100 - Math.max(0, labs.sbp - 115) * 2.2 - Math.max(0, (labs.dbp || 75) - 75) * 2, 20, 100) : null;
    return {
      cardio: v.v == null ? null : Math.round(clamp(v.v / tgt, 0, 1) * 100),
      muscle: cap ? Math.round((cap.strength * 0.6 + cap.power * 0.4) * 100) : null,
      metabolic: avg([e('a1c'), e('ins'), e('glu'), e('tg'), wht ? Math.round(clamp(100 - (wht - 0.45) * 400, 20, 100)) : null]),
      heart: avg([e('apob'), e('lpa'), e('hdl'), bp]),
      inflam: avg([e('crp'), e('hcy')]),
      sleep: s.vitals.sleepH == null ? null : Math.round(clamp(((s.vitals.sleepScore ?? 75) + clamp(100 - Math.abs(s.vitals.sleepH - 8) * 25, 0, 100)) / 2, 0, 100)),
      mind: sc.parts.life == null ? null : Math.round(sc.parts.life)
    };
  }

  function summary(s, sc) {
    const pa = phenoAge(s), v = vo2Of(s), fa = fitnessAge(s.profile.sex, v.v);
    const parts = [pa, fa].filter((x) => x != null), myo = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
    return { age: s.profile.age, phenoAge: pa, vo2: v, fitnessAge: fa, myoAge: myo, pillars: pillars(s, sc || OS.scores(s)) };
  }

  const tone = (n) => (n == null ? 'muted' : n >= 85 ? 'peak' : n >= 70 ? 'good' : n >= 55 ? 'warn' : 'bad');
  const d1 = (x) => (x == null ? '—' : x.toFixed(1));
  const delta = (bio, age) => { if (bio == null || age == null) return '—'; const d = bio - age; return `${d <= 0 ? '−' : '+'}${Math.abs(d).toFixed(1)} y`; };

  function ageLine(age, pts) {
    const lo = Math.min(age, ...pts.map((p) => p[1])) - 6, hi = Math.max(age, ...pts.map((p) => p[1])) + 6, X = (a) => 20 + ((a - lo) / (hi - lo)) * 560;
    return `<svg class="lg-line" viewBox="0 0 600 70" role="img" aria-label="Biological ages against your age of ${age}">
      <defs><linearGradient id="lgg" x1="0" x2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset=".5" stop-color="#3b82f6"/><stop offset="1" stop-color="#f43f5e"/></linearGradient></defs>
      <text x="20" y="66" class="lg-t">Younger</text><text x="580" y="66" text-anchor="end" class="lg-t">Older</text>
      <rect x="20" y="22" width="560" height="8" rx="4" fill="url(#lgg)" opacity=".55"/>
      <line x1="${X(age)}" x2="${X(age)}" y1="6" y2="46" stroke="currentColor" stroke-width="3" stroke-dasharray="4 4"/>
      <text x="${X(age)}" y="66" text-anchor="middle" class="lg-t b">You ${age}</text>
      ${pts.map(([l, a], i) => `<circle cx="${X(a)}" cy="26" r="11" class="lg-dot lg-d${i}"><title>${esc(l)} ${d1(a)}</title></circle>`).join('')}
    </svg>`;
  }

  OS.register('longevity', {
    title: 'Longevity', icon: 'longevity',
    mount(root, s, sc) { return OS.lifespan ? OS.lifespan.mount(root, s, sc) : undefined; },
    render(s, sc) {
      const G = ensure(s), S = summary(s, sc), age = s.profile.age, P = S.pillars;
      const inProto = new Set((s.customProtocol || []).map((i) => i.id));
      const pts = [S.phenoAge != null ? ['PhenoAge', S.phenoAge] : null, ['Fitness age', S.fitnessAge]].filter(Boolean);
      const labs = (s.enhance && s.enhance.labs) || {}, tgt = vo2Target(s.profile.sex, age);
      const weakest = PILLARS.filter(([k]) => P[k] != null).sort((a, b) => P[a[0]] - P[b[0]]).slice(0, 2).map(([k]) => k);
      const pillarRows = PILLARS.map(([k, l]) => `<div class="lg-pil ${weakest.includes(k) ? 'focus' : ''}"><div class="lg-pil-h"><span>${esc(l)}</span><b class="num">${P[k] ?? '—'}</b></div>
          <div class="lg-bar"><i class="t-${tone(P[k])}" style="width:${P[k] ?? 0}%"></i></div>${weakest.includes(k) ? '<span class="tag tag-go">Biggest lever now</span>' : ''}</div>`).join('');
      const targets = [['apob', '< 60 mg/dL'], ['lpa', '< 30 nmol/L, test once'], ['a1c', '4.6–5.1%'], ['ins', '2–5 µIU/mL'], ['crp', '< 0.5 mg/L'], ['hcy', '< 7 µmol/L'], ['o3', '8–12%'], ['vitd', '50–60 ng/mL']]
        .map(([id, t]) => { const m = mk(s, id); if (!m) return ''; const e = OS.markerEval(m); return `<tr><td><b>${esc(m.name)}</b></td><td class="num">${OS.dash(m.value)} ${esc(m.unit)}</td><td class="num">${esc(t)}</td><td>${pill(e.status, e.label)}</td></tr>`; }).join('')
        + `<tr><td><b>VO₂max</b><span class="muted small block">${esc(S.vo2.src)}</span></td><td class="num">${S.vo2.v == null ? '—' : d1(S.vo2.v) + ' ml/kg/min'}</td><td class="num">≥ ${tgt} (elite for age)</td><td>${S.vo2.v == null ? pill('muted', 'No data yet') : pill(S.vo2.v >= tgt ? 'good' : S.vo2.v >= tgt * 0.8 ? 'warn' : 'bad', S.vo2.v >= tgt ? 'Elite' : S.vo2.v >= tgt * 0.8 ? 'Above average' : 'Build it')}</td></tr>`
        + `<tr><td><b>Blood pressure</b></td><td class="num">${labs.sbp ? `${labs.sbp}/${labs.dbp || '?'}` : '—'} mmHg</td><td class="num">< 120/80</td><td>${labs.sbp ? pill(labs.sbp < 120 && (labs.dbp || 0) < 80 ? 'good' : labs.sbp < 140 ? 'warn' : 'bad', labs.sbp < 120 && (labs.dbp || 0) < 80 ? 'Peak' : labs.sbp < 140 ? 'Raised' : 'High') : '<span class="muted small">Enter below</span>'}</td></tr>`
        + `<tr><td><b>Waist-to-height</b></td><td class="num">${G.waist ? (G.waist / s.profile.heightCm).toFixed(2) : '—'}</td><td class="num">< 0.50</td><td>${G.waist ? pill(G.waist / s.profile.heightCm < 0.5 ? 'good' : 'warn', G.waist / s.profile.heightCm < 0.5 ? 'Peak' : 'Above target') : '<span class="muted small">Enter below</span>'}</td></tr>`;
      const protoCards = PROTO.map(([id, pil, gr, t, d]) => {
        const g = PROTO_GRADE[gr], on = inProto.has('lng-' + id), lead = weakest.includes(pil);
        return `<article class="supp ${lead ? 'fit' : ''}"><div class="supp-h"><b>${esc(t)}</b>${pill(g[0], g[1])}</div><p>${esc(d)}</p>
          <div class="supp-tags"><span class="tag">${esc((PILLARS.find((p) => p[0] === pil) || [, pil])[1])}</span>${lead ? '<span class="tag tag-go">Targets your weakest pillar</span>' : ''}</div>
          <button class="btn ${on ? 'ghost' : ''} sm" data-act="lng-add" data-id="${id}">${on ? 'In protocol · remove' : 'Add to protocol'}</button></article>`;
      }).join('');
      const scr = SCREEN.filter(([, from, sex]) => !sex || sex === s.profile.sex).map(([t, from, , how]) => `<li class="${age >= from ? 'due' : ''}"><b>${esc(t)}</b><span>${age >= from ? 'Due now · ' : `From ${from} · `}${esc(how)}</span></li>`).join('');
      const plan = G.plan;
      return `${OS.ui.head('Healthspan · biological age · longevity protocol', 'Longevity', 'Add healthy years, not just years. Myo measures how fast you are ageing and aims every lever at slowing it.',
        `<div class="hstat"><span>Myo age</span><b class="num">${d1(S.myoAge)}</b></div><div class="hstat"><span>vs your age</span><b class="num">${delta(S.myoAge, age)}</b></div>`)}
      <section class="lg-hero">
        <div class="lg-hero-l">
          <span class="lg-k">Biological age</span>
          <div class="lg-big"><b class="num">${d1(S.myoAge)}</b><span>years<br>you are ${age}</span></div>
          <p>${S.myoAge == null ? 'Add a resting heart rate (connect a ring or strap) or a VO₂max test, plus the PhenoAge blood markers, and Myo estimates how fast your body is ageing.' : S.myoAge < age ? `Your body is ageing like someone ${Math.abs(S.myoAge - age).toFixed(1)} years younger. Keep pushing the two weakest pillars.` : `Your body is ageing like someone ${Math.abs(S.myoAge - age).toFixed(1)} years older. The protocol below targets the fastest wins.`}</p>
        </div>
        <div class="lg-hero-r">
          ${ageLine(age, pts)}
          <div class="lg-mini"><div><span><i class="lg-key lg-d0"></i>PhenoAge</span><b class="num">${d1(S.phenoAge)}</b><em>${S.phenoAge != null ? delta(S.phenoAge, age) : 'Add 7 labs below'}</em></div>
            <div><span><i class="lg-key lg-d1"></i>Fitness age</span><b class="num">${d1(S.fitnessAge)}</b><em>VO₂max ${d1(S.vo2.v)}</em></div>
            <div><span>Peak markers</span><b class="num">${sc.peak}</b><em>of ${sc.markers.length}</em></div></div>
        </div>
      </section>
      ${OS.lifespan ? OS.lifespan.card(s, sc) : ''}
      <div class="grid g-2-1">
        <section class="card"><div class="card-h"><h2>Healthspan pillars</h2><span class="muted small">0–100 · aim for 85+</span></div><div class="lg-pils">${pillarRows}</div></section>
        <section class="card"><div class="card-h"><h2>Your numbers</h2></div>
          <form class="bench" data-submit="lng-in">
            <label class="field" for="lg-vo2"><span>VO₂max <em>ml/kg/min, from a lab test or watch</em></span><input id="lg-vo2" name="vo2" type="number" step="0.1" value="${G.vo2 ?? ''}" placeholder="${S.vo2.v == null ? 'e.g. 45' : d1(S.vo2.v) + ' est.'}"></label>
            <label class="field" for="lg-grip"><span>Grip strength <em>kg, best hand</em></span><input id="lg-grip" name="grip" type="number" step="0.5" value="${G.grip ?? ''}"></label>
            <label class="field" for="lg-waist"><span>Waist <em>cm, at the navel</em></span><input id="lg-waist" name="waist" type="number" step="0.5" value="${G.waist ?? ''}"></label>
            <label class="field" for="lg-sbp"><span>Blood pressure <em>systolic / diastolic</em></span><span class="row"><input id="lg-sbp" name="sbp" type="number" value="${labs.sbp ?? ''}" placeholder="120" aria-label="Systolic"><input name="dbp" type="number" value="${labs.dbp ?? ''}" placeholder="80" aria-label="Diastolic"></span></label>
            <button class="btn sm">Save</button></form></section>
      </div>
      <section class="card"><div class="card-h"><h2>Longevity protocol</h2><span class="muted small">A = strong evidence · highlighted cards target your weakest pillars</span></div><div class="supp-grid">${protoCards}</div></section>
      <div class="grid g-2">
        <section class="card"><div class="card-h"><h2>Longevity targets</h2><span class="muted small">Peak, not just normal</span></div>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Marker</th><th>You</th><th>Target</th><th>Status</th></tr></thead><tbody>${targets}</tbody></table></div></section>
        <section class="card"><div class="card-h"><h2>PhenoAge labs</h2><span class="muted small">${esc(G.phSrc || 'Not entered')}</span></div>
          <form class="bench lg-ph" data-submit="lng-ph">${PH.map(([k, l, u]) => `<label class="field" for="ph-${k}"><span>${esc(l)} <em>${esc(u)}</em></span><input id="ph-${k}" name="${k}" type="number" step="any" value="${G.ph[k] ?? ''}"></label>`).join('')}
            <button class="btn sm">Save labs</button></form>
          <p class="fine">PhenoAge (Levine et al., 2018) combines these 7 standard blood-panel values with fasting glucose and hs-CRP from Biology. A gap of more than a few years from your age is meaningful; retest with every lab draw.</p></section>
      </div>
      <div class="grid g-2">
        <section class="card"><div class="card-h"><h2>Screening timeline</h2><span class="muted small">Book these with a clinician · Myo tracks them</span></div><ul class="lg-scr">${scr}</ul></section>
        <section class="card"><div class="card-h"><h2>Geroprotectors</h2><span class="muted small">Reference · no doses</span></div>
          <div class="lg-gero">${GERO.map((g) => `<div><div class="supp-h"><b>${esc(g.name)}</b><span class="tag">${esc(g.kind)}</span></div><p>${esc(g.ev)}</p><p class="muted small">${esc(g.st)}</p></div>`).join('')}</div>
          <p class="fine">Myo doesn't dose prescription drugs. Exercise, sleep, protein and blood-pressure and ApoB control beat every pill on this list for proven years gained.</p></section>
      </div>
      <section class="card myo-plan"><div class="card-h"><h2>Myo's longevity plan</h2><span class="chip chip-ai">AI coach</span></div>
        ${plan ? `<div class="md">${OS.athlete ? OS.athlete.mdl(plan.text) : esc(plan.text)}</div><p class="fine">Written ${esc(new Date(plan.at).toLocaleDateString())}.</p>` : '<p class="muted small">Myo reads your biological age, pillars, labs, wearables and training, then writes a 12-month plan to lower your biological age: priorities by quarter, weekly training split, nutrition, sleep, retest dates and the targets to hit.</p>'}
        <button class="btn" data-act="lng-myo" ${busy ? 'disabled' : ''}>${icon('coach', 15)} ${busy ? 'Myo is writing your plan…' : plan ? 'Rewrite with Myo' : 'Build my longevity plan'}</button></section>`;
    }
  });

  /* ── actions ─────────────────────────────────────────────────────── */
  let busy = false;
  const num = (v) => (v === '' || v == null || isNaN(+v) ? null : +v);
  OS.act('lng-in', (f) => {
    const v = Object.fromEntries([...f.elements].filter((e) => e.name).map((e) => [e.name, num(e.value)]));
    OS.update((s) => {
      const G = ensure(s); G.vo2 = v.vo2; G.grip = v.grip; G.waist = v.waist;
      s.enhance = s.enhance || { using: {}, tested: false, labs: {} };
      ['sbp', 'dbp'].forEach((k) => { if (v[k] == null) delete s.enhance.labs[k]; else s.enhance.labs[k] = v[k]; });
    });
    OS.toast('Saved. Biological age and pillars updated.');
  });
  OS.act('lng-ph', (f) => {
    OS.update((s) => { const G = ensure(s); [...f.elements].forEach((e) => { if (!e.name) return; const n = num(e.value); if (n == null) delete G.ph[e.name]; else G.ph[e.name] = n; }); G.phSrc = 'Entered ' + new Date().toLocaleDateString(); });
    OS.toast('PhenoAge labs saved');
  });
  OS.act('lng-add', (el) => {
    const p = PROTO.find((x) => x[0] === el.dataset.id), id = 'lng-' + p[0];
    OS.update((s) => {
      const has = (s.customProtocol || []).some((i) => i.id === id);
      s.customProtocol = (s.customProtocol || []).filter((i) => i.id !== id);
      if (!has) s.customProtocol.push({ id, cat: p[5], title: p[3], detail: p[4], time: p[6], marker: null, custom: true });
    });
  });
  OS.act('lng-myo', async () => {
    if (busy) return;
    const s = OS.state, sc = OS.scores(s), S = summary(s, sc), G = ensure(s);
    const weak = PILLARS.filter(([k]) => S.pillars[k] != null).sort((a, b) => S.pillars[a[0]] - S.pillars[b[0]]);
    const fallback = () => [`## Lower your biological age: 12 months`, `You are ${s.profile.age}; Myo age ${d1(S.myoAge)} (PhenoAge ${d1(S.phenoAge)}, fitness age ${d1(S.fitnessAge)}).`,
      `### Months 1–3: ${weak[0][1]}`, ...PROTO.filter((p) => p[1] === weak[0][0]).map((p) => `- ${p[3]}`),
      `### Months 4–6: ${weak[1][1]}`, ...PROTO.filter((p) => p[1] === weak[1][0]).map((p) => `- ${p[3]}`),
      '### Months 7–12: consolidate', '- Zone 2 150+ min and one VO₂max session every week', '- Strength 3× a week; retest grip and 5RM each quarter',
      '### Retest', '- Full labs and PhenoAge every 90 days', `- VO₂max test at month 6; target ${vo2Target(s.profile.sex, s.profile.age)} ml/kg/min`].join('\n');
    const sample = OS.caps && OS.caps.sample;
    if (!sample) { OS.update((st) => { ensure(st).plan = { text: fallback(), at: new Date().toISOString() }; }); return; }
    busy = true; OS.render();
    const data = {
      profile: s.profile, chronologicalAge: s.profile.age, myoAge: +d1(S.myoAge), phenoAge: S.phenoAge && +d1(S.phenoAge), fitnessAge: +d1(S.fitnessAge), vo2max: { value: S.vo2.v == null ? null : +S.vo2.v.toFixed(1), source: S.vo2.src, eliteTarget: vo2Target(s.profile.sex, s.profile.age) },
      pillars: S.pillars, weakestPillars: weak.slice(0, 2).map((w) => w[1]), gripKg: G.grip, waistCm: G.waist, bloodPressure: s.enhance && s.enhance.labs ? { sbp: s.enhance.labs.sbp, dbp: s.enhance.labs.dbp } : null,
      biomarkers: sc.markers.map(({ m, e }) => `${m.name} ${m.value} ${m.unit} (${e.label}, peak ${OS.ui.fmtR(OS.peakOf(m))})`), phenoLabs: G.ph, vitals: s.vitals, redFlags: sc.redFlags,
      training: s.training.program, protocolLibrary: PROTO.map((p) => `${p[3]} [${p[2]}]`)
    };
    const prompt = `You are Myo, the autonomous performance physiologist inside the Myo app (built on Myokinetics OS). Write this member's 12-month longevity plan to lower their biological age and extend healthspan. Prioritise the two weakest pillars first, use their real numbers, and aim biomarkers at peak ranges.
Structure in markdown: a 2-line summary with their Myo age vs real age; then Quarter 1–4 headings, each with training (weekly split with zone 2 minutes, VO2max intervals, strength days), nutrition, sleep and recovery, and the measurable targets for that quarter; then a Retest schedule.
Rules: evidence-based only, and say the evidence grade for anything below strong. Never give doses, cycles or sourcing for prescription drugs or hormones (rapamycin, metformin, GLP-1s, testosterone); you may say "discuss with a prescriber". Supplements with doses are fine. If redFlags is not empty, open with it and tell them to get in-person care first. Under 450 words.
Member data (JSON): ${JSON.stringify(data)}`;
    let text;
    try { const r = await sample(prompt, { cache: false, modelTier: 'complex' }); text = (r.text || '').trim() || fallback(); }
    catch (e) { text = fallback() + (e && e.code === 'not_granted' ? '\n\nAI access was declined, so this is the offline plan.' : ''); }
    busy = false;
    OS.update((st) => { ensure(st).plan = { text, at: new Date().toISOString() }; });
  });

  OS.longevity = { summary, phenoAge, phenoCalc, phenoReady, fitnessAge, vo2Target, ensure };
})();
