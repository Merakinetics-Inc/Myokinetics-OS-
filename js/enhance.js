/* ═══ MYO — STACK: evidence-graded supplements + PED reference and harm-reduction monitoring ═══
   Supplements: doses, timing, evidence grade, WADA status, matched to athlete type, labs and DNA.
   PEDs: what each class is, legal and WADA status, risks and what to monitor. No cycles or doses:
   the OS does not start, stop or dose prescription drugs or hormones. */
(function () {
  'use strict';
  const { esc, pill, icon } = OS;

  // [id, name, grade, does, dose, timing, archetypes, wada, labGate?, gene?]
  const SUPPS = [
    { id: 'creatine', name: 'Creatine monohydrate', grade: 'A', does: 'More phosphocreatine: strength, power, repeated sprints, lean mass.', dose: '3–5 g daily (optional 20 g/day split for 5–7 days to load)', when: 'Any time, daily', for: ['crossfit', 'bodybuilder', 'powerlifter', 'climber', 'runner'], wada: 'Permitted' },
    { id: 'caffeine', name: 'Caffeine', grade: 'A', does: 'Lower perceived effort; more endurance, power and focus.', dose: '3–6 mg/kg (2–3 mg/kg also works)', when: '30–60 min before', for: ['crossfit', 'runner', 'powerlifter', 'climber', 'bodybuilder'], wada: 'Permitted (monitored)', gene: 'cyp1a2' },
    { id: 'protein', name: 'Protein (whey, casein, plant blends)', grade: 'A', does: 'Hits daily protein for muscle repair and growth.', dose: '1.6–2.2 g/kg a day; 0.3–0.4 g/kg per meal', when: 'Spread over 4–5 meals', for: ['crossfit', 'bodybuilder', 'powerlifter', 'climber', 'runner'], wada: 'Choose third-party tested' },
    { id: 'carbs', name: 'Carbohydrate in training', grade: 'A', does: 'Keeps blood glucose and output up in long sessions.', dose: '30–60 g/h (up to 90 g/h with glucose + fructose)', when: 'Sessions over 60–90 min', for: ['runner', 'crossfit'], wada: 'Permitted' },
    { id: 'sodium', name: 'Sodium / electrolytes', grade: 'A', does: 'Replaces sweat losses; protects output in heat and long efforts.', dose: '300–600 mg sodium per hour', when: 'Sessions over 2 h or in heat', for: ['runner', 'crossfit'], wada: 'Permitted' },
    { id: 'betaala', name: 'Beta-alanine', grade: 'A', does: 'Raises muscle carnosine; buffers acid in 30 s–10 min efforts.', dose: '3.2–6.4 g daily in 0.8–1.6 g doses, for 4+ weeks', when: 'With meals (reduces tingling)', for: ['crossfit', 'climber', 'bodybuilder'], wada: 'Permitted' },
    { id: 'bicarb', name: 'Sodium bicarbonate', grade: 'A', does: 'Blood buffer for 1–7 min maximal efforts.', dose: '0.2–0.3 g/kg', when: '60–180 min before, with a carb meal', for: ['crossfit'], wada: 'Permitted' },
    { id: 'nitrate', name: 'Dietary nitrate (beetroot)', grade: 'B', does: 'Better oxygen cost and muscle efficiency; smaller effect in elite endurance athletes.', dose: '6–8 mmol (about 400–500 mg nitrate)', when: '2–3 h before', for: ['runner', 'crossfit'], wada: 'Permitted' },
    { id: 'omega3', name: 'Omega-3 (EPA + DHA)', grade: 'B', does: 'Raises omega-3 index; supports recovery, heart and joint health.', dose: '2 g EPA + DHA daily', when: 'With a meal that has fat', for: ['runner', 'crossfit', 'bodybuilder', 'powerlifter', 'climber'], wada: 'Permitted', lab: ['o3', 'lt', 8] },
    { id: 'vitd', name: 'Vitamin D3 (+ K2)', grade: 'B', does: 'Corrects low vitamin D, which limits strength, immunity and bone.', dose: '1,000–5,000 IU daily, set by your level', when: 'Breakfast, with fat', for: ['runner', 'crossfit', 'bodybuilder', 'powerlifter', 'climber'], wada: 'Permitted', lab: ['vitd', 'lt', 40], gene: 'gc' },
    { id: 'collagen', name: 'Collagen + vitamin C', grade: 'B', does: 'Supports tendon and ligament collagen synthesis.', dose: '15 g collagen + 50 mg vitamin C', when: '30–60 min before tendon loading', for: ['climber', 'runner', 'crossfit'], wada: 'Permitted', gene: 'col5a1' },
    { id: 'iron', name: 'Iron', grade: 'B', does: 'Restores oxygen-carrying capacity, but only when stores are low.', dose: 'Set by ferritin; test first', when: 'Morning, away from coffee and calcium', for: ['runner'], wada: 'Permitted (no IV over 100 mL)', lab: ['ferr', 'lt', 50] },
    { id: 'mg', name: 'Magnesium glycinate', grade: 'C', does: 'Corrects low magnesium; may help sleep quality.', dose: '200–400 mg', when: 'Bedtime', for: ['runner', 'crossfit', 'bodybuilder', 'powerlifter', 'climber'], wada: 'Permitted', lab: ['mg', 'lt', 5.2] },
    { id: 'cherry', name: 'Tart cherry', grade: 'C', does: 'May reduce soreness between hard sessions or race days.', dose: '30 mL concentrate twice daily', when: 'Around heavy blocks or competitions', for: ['runner', 'crossfit'], wada: 'Permitted' },
    { id: 'citrulline', name: 'Citrulline malate', grade: 'C', does: 'Small, inconsistent gains in reps to failure.', dose: '6–8 g', when: '60 min before', for: ['bodybuilder'], wada: 'Permitted' },
    { id: 'ashwa', name: 'Ashwagandha', grade: 'C', does: 'Some data for strength, recovery and stress; product quality varies.', dose: '300–600 mg root extract', when: 'Evening', for: ['bodybuilder', 'powerlifter'], wada: 'Permitted' },
    { id: 'bcaa', name: 'BCAAs', grade: 'D', does: 'Redundant when daily protein is met. Spend the money on food.', dose: 'Not recommended', when: '—', for: [], wada: 'Permitted' }
  ];
  const GRADE = { A: ['peak', 'Strong evidence'], B: ['good', 'Good evidence'], C: ['warn', 'Mixed evidence'], D: ['bad', 'Not worth it'] };

  // PED classes: reference only. risk: high | extreme
  const PEDS = [
    { id: 'aas', name: 'Testosterone and anabolic steroids', risk: 'high', what: 'Testosterone and synthetic derivatives that drive muscle protein synthesis.',
      legal: 'US Schedule III. Legal only with a prescription, such as TRT for diagnosed low testosterone.', wada: 'Prohibited at all times (S1)',
      risks: ['Shuts down natural testosterone; infertility', 'Thick blood (high hematocrit): clot and stroke risk', 'HDL falls, LDL and ApoB rise; high blood pressure', 'Heart muscle thickening with long-term use', 'Liver injury with oral forms; acne, gynecomastia, mood swings, dependence'],
      monitor: ['hct', 'sbp', 'dbp', 'hdl', 'apob', 'alt', 'e2', 'lh', 'psa'] },
    { id: 'sarms', name: 'SARMs', risk: 'high', what: 'Selective androgen receptor modulators sold as "research chemicals".',
      legal: 'Not approved for any human use in the US. FDA warns of liver injury and heart attack and stroke risk. Often mislabelled or contaminated.', wada: 'Prohibited at all times (S1)',
      risks: ['Testosterone suppression', 'Large HDL drops', 'Drug-induced liver injury reports', 'Unknown dose and contents in most products'],
      monitor: ['hdl', 'alt', 'lh', 'tt'] },
    { id: 'gh', name: 'Growth hormone and peptides', risk: 'high', what: 'GH, GH secretagogues, IGF-1 and research peptides such as BPC-157.',
      legal: 'GH is prescription-only and illegal to distribute for unapproved uses. Most peptides are unapproved, with unknown purity.', wada: 'Prohibited at all times (S2; unapproved substances S0)',
      risks: ['Insulin resistance and raised blood sugar', 'Fluid retention, carpal tunnel, joint pain', 'Contamination and injection infections with grey-market products'],
      monitor: ['glu', 'ins', 'a1c', 'igf1'] },
    { id: 'epo', name: 'EPO and blood doping', risk: 'extreme', what: 'Raises red blood cell mass to carry more oxygen.',
      legal: 'Prescription only (anaemia from kidney disease or chemotherapy).', wada: 'Prohibited at all times (S2, M1)',
      risks: ['Very thick blood: clots, stroke, heart attack', 'Sudden deaths in endurance athletes'],
      monitor: ['hct', 'hgb'] },
    { id: 'insulin', name: 'Insulin (non-diabetic use)', risk: 'extreme', what: 'Used to push nutrients into muscle.',
      legal: 'Prescription medicine for diabetes.', wada: 'Prohibited at all times (S4)',
      risks: ['Severe low blood sugar: seizures, coma, death, sometimes within an hour'], monitor: ['glu'] },
    { id: 'clen', name: 'Clenbuterol and beta-2 agonists', risk: 'high', what: 'Stimulant bronchodilators used for fat loss.',
      legal: 'Clenbuterol is not approved for human use in the US.', wada: 'Prohibited at all times (S1)',
      risks: ['Fast heart rate and arrhythmia', 'Heart muscle injury', 'Tremor, low potassium, insomnia'], monitor: ['rhr', 'sbp', 'dbp'] },
    { id: 'dnp', name: 'DNP (2,4-dinitrophenol)', risk: 'extreme', what: 'Industrial chemical sold for fat loss.',
      legal: 'Banned for human consumption.', wada: 'Prohibited',
      risks: ['Uncontrollable overheating; many deaths, including at small overdoses', 'No safe dose exists. Myo will never include it.'], monitor: [] },
    { id: 'diuretic', name: 'Diuretics', risk: 'high', what: 'Drugs that pull water; used to make weight or mask other drugs.',
      legal: 'Prescription only.', wada: 'Prohibited at all times as masking agents (S5)',
      risks: ['Dehydration, cramps, low potassium and sodium', 'Arrhythmia and kidney injury'], monitor: ['egfr', 'sbp'] },
    { id: 'thyroid', name: 'Thyroid hormone (T3/T4) for fat loss', risk: 'high', what: 'Speeds metabolism; used off-label to cut.',
      legal: 'Prescription only.', wada: 'Not on the WADA list',
      risks: ['Arrhythmia, bone loss, muscle loss', 'Suppresses your own thyroid'], monitor: ['tsh', 'ft3', 'rhr'] },
    { id: 'stims', name: 'Strong stimulants', risk: 'high', what: 'Amphetamines, ephedrine, DMAA and similar.',
      legal: 'Amphetamines are Schedule II; DMAA is illegal in supplements; ephedrine is restricted.', wada: 'Prohibited in competition (S6)',
      risks: ['High blood pressure, arrhythmia', 'Heatstroke in training', 'Dependence'], monitor: ['sbp', 'rhr'] }
  ];
  // monitoring labs not in the core biomarker panel; core ones are read from s.markers
  const MON = {
    hct: { name: 'Hematocrit', unit: '%', warn: [null, 52], act: [null, 54], urgent: 60 },
    sbp: { name: 'Blood pressure, systolic', unit: 'mmHg', warn: [null, 130], act: [null, 140], urgent: 180 },
    dbp: { name: 'Blood pressure, diastolic', unit: 'mmHg', warn: [null, 85], act: [null, 90], urgent: 120 },
    e2: { name: 'Estradiol', unit: 'pg/mL', warn: [10, 40], act: [5, 60] },
    lh: { name: 'LH', unit: 'IU/L', warn: [1.5, null], act: [0.5, null] },
    psa: { name: 'PSA', unit: 'ng/mL', warn: [null, 2.5], act: [null, 4] },
    igf1: { name: 'IGF-1', unit: 'ng/mL', warn: [null, 300], act: [null, 400] }
  };
  const CORE = { hdl: 'hdl', apob: 'apob', alt: 'alt', tt: 'tt', glu: 'glu', ins: 'ins', a1c: 'a1c', hgb: 'hgb', egfr: 'egfr', tsh: 'tsh', ft3: 'ft3' };

  function ensure(s) { if (!s.enhance) s.enhance = { using: {}, tested: false, labs: {} }; return s.enhance; }
  const inR = (v, r) => (r[0] == null || v >= r[0]) && (r[1] == null || v <= r[1]);
  function monStatus(k, v) {
    const m = MON[k]; if (v == null || v === '' || isNaN(v)) return null;
    if (m.urgent != null && v >= m.urgent) return ['bad', 'Urgent'];
    if (!inR(v, m.act)) return ['bad', 'Act this week'];
    if (!inR(v, m.warn)) return ['warn', 'Watch'];
    return ['good', 'In range'];
  }

  OS.register('enhance', {
    title: 'Stack', icon: 'stack',
    render(s, sc) {
      const E = ensure(s), A = s.athlete || {}, target = A.target, dna = A.dna || {};
      const tab = view;
      const mk = (id) => s.markers.find((m) => m.id === id);
      const inProto = new Set((s.customProtocol || []).map((i) => i.id));
      const suppRows = SUPPS.map((x) => {
        const g = GRADE[x.grade], fits = target && x.for.includes(target);
        let lab = '';
        if (x.lab) { const m = mk(x.lab[0]); if (m) { const low = Number(m.value) < x.lab[2]; lab = low ? `<span class="tag tag-go">Your labs: yes · ${esc(m.name)} ${m.value}</span>` : `<span class="tag">Labs fine · ${esc(m.name)} ${m.value}</span>`; } }
        let gene = '';
        if (x.gene === 'cyp1a2' && dna.cyp1a2 != null) gene = `<span class="tag">${dna.cyp1a2 === 0 ? 'Fast caffeine metaboliser: full dose' : 'Slow metaboliser: 1–2 mg/kg, before noon'}</span>`;
        if (x.gene === 'gc' && dna.gc) gene = '<span class="tag">GC variant: aim for the top of the range</span>';
        if (x.gene === 'col5a1' && dna.col5a1 === 2) gene = '<span class="tag tag-go">COL5A1 TT: recommended for you</span>';
        const added = inProto.has('stk-' + x.id);
        return `<article class="supp ${fits ? 'fit' : ''}">
          <div class="supp-h"><b>${esc(x.name)}</b>${pill(g[0], `${x.grade} · ${g[1]}`)}</div>
          <p>${esc(x.does)}</p>
          <dl><div><dt>Dose</dt><dd>${esc(x.dose)}</dd></div><div><dt>When</dt><dd>${esc(x.when)}</dd></div><div><dt>WADA</dt><dd>${esc(x.wada)}</dd></div></dl>
          <div class="supp-tags">${fits ? `<span class="tag tag-go">Fits your ${esc(OS.athlete ? OS.athlete.ARCH[target].name : target)} plan</span>` : ''}${lab}${gene}</div>
          ${x.grade !== 'D' ? `<button class="btn ${added ? 'ghost' : ''} sm" data-act="stk-add" data-id="${x.id}">${added ? 'In protocol · remove' : 'Add to protocol'}</button>` : ''}
        </article>`;
      }).join('');
      const pedCards = PEDS.map((p) => `<article class="ped ped-${p.risk}">
          <div class="supp-h"><b>${esc(p.name)}</b>${pill(p.risk === 'extreme' ? 'bad' : 'warn', p.risk === 'extreme' ? 'Extreme risk' : 'High risk')}</div>
          <p>${esc(p.what)}</p>
          <dl><div><dt>Legal (US)</dt><dd>${esc(p.legal)}</dd></div><div><dt>WADA</dt><dd>${esc(p.wada)}</dd></div></dl>
          <ul class="ped-risks">${p.risks.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
          ${p.id === 'dnp' ? '' : `<label class="ped-use"><input type="checkbox" data-change="stk-use" data-id="${p.id}" ${E.using[p.id] ? 'checked' : ''}> I use this or am on it by prescription. Turn on monitoring.</label>`}
        </article>`).join('');
      const usingIds = Object.keys(E.using).filter((k) => E.using[k]);
      const need = [...new Set(PEDS.filter((p) => E.using[p.id]).flatMap((p) => p.monitor))];
      const monRows = need.map((k) => {
        if (MON[k]) { const v = E.labs[k], st = monStatus(k, Number(v)); return `<tr><td><b>${esc(MON[k].name)}</b><span class="muted small block">${esc(MON[k].unit)}</span></td><td><input class="mon-in" type="number" step="any" value="${v ?? ''}" data-change="stk-lab" data-k="${k}" aria-label="${esc(MON[k].name)}"></td><td>${st ? pill(st[0], st[1]) : '<span class="muted small">Enter latest</span>'}</td></tr>`; }
        if (k === 'rhr') return `<tr><td><b>Resting heart rate</b><span class="muted small block">from your wearable</span></td><td class="num">${s.vitals.rhr} bpm</td><td>${pill(s.vitals.rhr > 100 ? 'bad' : s.vitals.rhr > 80 ? 'warn' : 'good', s.vitals.rhr > 100 ? 'Act this week' : s.vitals.rhr > 80 ? 'Watch' : 'In range')}</td></tr>`;
        const m = mk(CORE[k]); if (!m) return '';
        const e = OS.markerEval(m);
        return `<tr><td><b>${esc(m.name)}</b><span class="muted small block">Biology panel</span></td><td class="num">${m.value} ${esc(m.unit)}</td><td>${pill(e.status, e.label)}</td></tr>`;
      }).join('');
      const nS = SUPPS.filter((x) => inProto.has('stk-' + x.id)).length;
      return `${OS.ui.head('Supplements · ergogenic aids · PED safety', 'Stack', 'Evidence-graded supplements matched to your athlete type, labs and DNA, plus a straight reference on performance-enhancing drugs.',
        `<div class="hstat"><span>In protocol</span><b class="num">${nS}</b></div><div class="hstat"><span>Monitoring</span><b class="num">${usingIds.length ? need.length + ' labs' : 'Off'}</b></div>`)}
      <div class="stk-bar"><div class="seg">${[['supps', 'Supplements'], ['peds', 'Performance-enhancing drugs'], ['monitor', 'Monitoring']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="stk-tab" data-tab="${k}" aria-pressed="${tab === k}">${l}</button>`).join('')}</div>
        <label class="ped-use tested"><input type="checkbox" data-change="stk-tested" ${E.tested ? 'checked' : ''}> I compete in drug-tested sport</label></div>
      ${E.tested ? '<div class="banner" role="note"><strong>Tested athlete.</strong> Supplements can be contaminated with banned substances, and you are responsible for anything in your sample. Buy only batch-tested products (Informed Sport, NSF Certified for Sport) and check every medicine on Global DRO before you take it.</div>' : ''}
      ${tab === 'supps' ? `<p class="muted small">Grades follow the sports-nutrition consensus (IOC 2018, ISSN position stands). A = strong evidence for performance, D = not worth buying.${target ? ` Highlighted for your ${esc(OS.athlete ? OS.athlete.ARCH[target].name : target)} target.` : ''}</p><div class="supp-grid">${suppRows}</div>` : ''}
      ${tab === 'peds' ? `<div class="banner" role="note"><strong>Reference, not a prescription.</strong> Myo doesn't give cycles, doses or sourcing for drugs or hormones. If you use one, prescribed or not, turn on monitoring so Myo watches the bloodwork that catches harm early.</div><div class="supp-grid">${pedCards}</div>` : ''}
      ${tab === 'monitor' ? (usingIds.length ? `<div class="grid g-2-1"><section class="card"><div class="card-h"><h2>Your monitoring panel</h2><span class="muted small">${usingIds.map((k) => esc(PEDS.find((p) => p.id === k).name)).join(' · ')}</span></div>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Marker</th><th>Latest</th><th>Status</th></tr></thead><tbody>${monRows}</tbody></table></div>
          <p class="fine">Hematocrit at 54% or more and blood pressure at 140/90 or more need action within days. Hematocrit at 60%+ or blood pressure at 180/120+ is an emergency and shows as a red flag across the app.</p></section>
        <section class="card"><div class="card-h"><h2>Harm reduction</h2></div><ul class="ath-list">
          <li>Get baseline bloodwork before starting, again at 6–8 weeks, then every 3 months.</li>
          <li>A prescriber (TRT or sports-medicine clinic) can monitor you and adjust safely. Prescribed medicine is far safer than underground products, which are often under- or over-dosed and contaminated.</li>
          <li>Never share needles or vials. Use sterile, single-use equipment.</li>
          <li>Donate blood or see your prescriber if hematocrit climbs; don't wait for symptoms.</li>
          <li>Chest pain, sudden shortness of breath, one-sided weakness, severe headache or a hot, swollen calf: emergency care now.</li>
          <li>Myo sees this panel and will flag trends, but won't change drug doses.</li></ul></section></div>`
        : `<section class="card"><p>Monitoring is off. On the Performance-enhancing drugs tab, tick any drug you use or are prescribed, such as TRT. Myo then adds hematocrit, blood pressure, lipids, liver and hormone checks here and flags dangerous values across the app.</p><button class="btn ghost" data-act="stk-tab" data-tab="peds">Open the drug reference</button></section>`) : ''}`;
    }
  });

  let view = 'supps';
  OS.act('stk-tab', (el) => { view = el.dataset.tab; OS.render(); });
  OS.act('stk-add', (el) => {
    const x = SUPPS.find((y) => y.id === el.dataset.id), id = 'stk-' + x.id;
    OS.update((s) => {
      const has = (s.customProtocol || []).some((i) => i.id === id);
      s.customProtocol = (s.customProtocol || []).filter((i) => i.id !== id);
      if (!has) s.customProtocol.push({ id, cat: 'supplement', title: `${x.name}: ${x.dose}`.slice(0, 90), detail: x.does, time: x.when.slice(0, 20), marker: null, custom: true });
    });
  });
  OS.change('stk-use', (el) => OS.update((s) => { ensure(s).using[el.dataset.id] = el.checked; }));
  OS.change('stk-tested', (el) => OS.update((s) => { ensure(s).tested = el.checked; }));
  OS.change('stk-lab', (el) => OS.update((s) => { const L = ensure(s).labs; if (el.value === '') delete L[el.dataset.k]; else L[el.dataset.k] = Number(el.value); }));

  OS.stack = { SUPPS, PEDS, MON, monStatus };
})();
