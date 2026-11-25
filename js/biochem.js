/* ═══ MYO — BIOCHEM: metabolic pathways, mapped onto the member's labs, with levers to manage them ═══
   Eight pathways. Each is drawn as a short chain of steps; the steps a lab measures light up with that marker's status.
   Levers are lifestyle, nutrition and supplement actions with an evidence grade (A strong, B moderate, C early);
   any lever can be added to the daily protocol. Prescription treatments are named as "with your prescriber" only:
   Myo doesn't start, stop or dose them. Educational, not a diagnosis. */
(function () {
  'use strict';
  const { esc, icon, pill } = OS;
  // step: [label, marker id or null]; lever: [title, grade, detail, protocol category]
  const PATHS = [
    { k: 'glucose', name: 'Glucose and insulin', what: 'How your body moves sugar from blood into muscle and liver, and how hard insulin has to work.',
      steps: [['Carbohydrate in', null], ['Blood glucose', 'glu'], ['Insulin signal', 'ins'], ['Muscle and liver uptake', null], ['Long-term glucose (HbA1c)', 'a1c'], ['Excess to fat (triglycerides)', 'tg']],
      levers: [['Walk 10–15 minutes after your largest meal', 'A', 'Muscle contraction moves glucose in without insulin; lowers the after-meal rise.', 'training'], ['Strength train 3 times a week', 'A', 'More muscle is more glucose storage and better insulin sensitivity.', 'training'], ['Eat protein and vegetables before starches', 'B', 'Meal order blunts the glucose spike.', 'nutrition'], ['Sleep 7–9 hours', 'A', 'One short night measurably reduces insulin sensitivity the next day.', 'sleep'], ['30 g fibre a day', 'B', 'Slows absorption and feeds gut bacteria that help glucose control.', 'nutrition']],
      rx: 'Metformin, GLP-1 and other glucose medicines are decisions for your prescriber.' },
    { k: 'lipids', name: 'Lipid transport (ApoB particles)', what: 'How cholesterol and fat travel in ApoB-carrying particles, which drive plaque in arteries.',
      steps: [['Liver makes VLDL', null], ['Triglycerides delivered', 'tg'], ['LDL particles (ApoB)', 'apob'], ['LDL cholesterol', 'ldl'], ['HDL reverse transport', 'hdl'], ['Inherited Lp(a)', 'lpa']],
      levers: [['10 g soluble fibre a day (oats, psyllium, beans)', 'A', 'Binds bile acids so the liver pulls LDL from blood.', 'nutrition'], ['Swap saturated fat for olive oil, nuts and fish', 'A', 'Lowers LDL and ApoB over 4–8 weeks.', 'nutrition'], ['Omega-3 from oily fish twice a week', 'B', 'Lowers triglycerides; little effect on LDL.', 'nutrition'], ['150 minutes of Zone 2 a week', 'B', 'Lowers triglycerides and raises HDL function.', 'training'], ['Plant sterols 2 g a day', 'B', 'Blocks cholesterol absorption; lowers LDL about 8–10%.', 'supplement']],
      rx: 'Statins and other lipid-lowering medicines are decisions for your prescriber. Lp(a) is mostly inherited; tell your clinician if it is high.' },
    { k: 'methyl', name: 'Methylation (folate, B12, homocysteine)', what: 'A cycle that recycles homocysteine using folate and B12; it supports DNA, nerves and neurotransmitters.',
      steps: [['Folate from food', null], ['Methyl donor (5-MTHF)', null], ['B12-dependent recycling', 'b12'], ['Homocysteine cleared', 'hcy'], ['SAMe for methylation', null]],
      levers: [['Leafy greens, legumes and eggs daily', 'B', 'Natural folate, B6 and choline feed the cycle.', 'nutrition'], ['B12 from food or a supplement if you eat little animal food', 'A', 'B12 deficiency raises homocysteine and harms nerves.', 'supplement'], ['Methylated B-complex', 'B', 'Lowers homocysteine when B vitamins are low.', 'supplement'], ['Limit alcohol', 'B', 'Alcohol depletes folate and B6.', 'nutrition']],
      rx: '' },
    { k: 'inflam', name: 'Inflammation', what: 'Signals that turn up the immune response; low-grade, long-running inflammation shows as hs-CRP.',
      steps: [['Triggers: excess fat, poor sleep, smoking', null], ['Cytokine signalling (IL-6)', null], ['Liver makes CRP', 'crp'], ['Omega-3 resolvers', 'o3'], ['Resolution', null]],
      levers: [['Two servings of oily fish a week, or EPA + DHA', 'A', 'Raises the omega-3 index and helps inflammation resolve.', 'supplement'], ['Lose 5–10% of body weight if overweight', 'A', 'Visceral fat is a major source of IL-6.', 'nutrition'], ['Regular moderate exercise', 'A', 'Lowers resting CRP over months.', 'training'], ['Sleep 7–9 hours', 'B', 'Short sleep raises inflammatory markers.', 'sleep'], ['Retest CRP when you are well', 'A', 'A cold or hard training can raise CRP for days.', 'mind']],
      rx: 'A CRP above 10 mg/L usually means infection or injury: see a clinician.' },
    { k: 'iron', name: 'Iron and oxygen transport', what: 'Iron absorbed from food is stored as ferritin and built into haemoglobin, which carries oxygen.',
      steps: [['Iron in food', null], ['Absorption (vitamin C helps)', null], ['Iron stores (ferritin)', 'ferr'], ['Haemoglobin', 'hgb'], ['Oxygen to muscle', null]],
      levers: [['Pair iron foods with vitamin C', 'B', 'Doubles non-haem iron absorption.', 'nutrition'], ['Tea and coffee away from iron-rich meals', 'B', 'Tannins block absorption.', 'nutrition'], ['Retest after heavy training blocks', 'C', 'Endurance athletes lose more iron.', 'training']],
      rx: 'Iron supplements only after a test shows low ferritin: too much iron is harmful. Ask your clinician.' },
    { k: 'thyroid', name: 'Thyroid and energy', what: 'The brain signals the thyroid (TSH); the thyroid makes hormone that the body turns into active T3, which sets metabolic rate.',
      steps: [['Brain signal (TSH)', 'tsh'], ['Thyroid makes T4', null], ['Converted to active T3', 'ft3'], ['Cells set energy use', null]],
      levers: [['Eat enough: avoid long, steep calorie deficits', 'B', 'Low energy availability lowers T3.', 'nutrition'], ['Selenium-rich foods (2 Brazil nuts) and iodised salt', 'C', 'Both are cofactors; more than enough brings no extra benefit.', 'nutrition'], ['Sleep and stress management', 'C', 'Chronic stress hormones blunt T4-to-T3 conversion.', 'sleep']],
      rx: 'Thyroid medication is for your prescriber. Out-of-range TSH needs a clinician, not supplements.' },
    { k: 'vitd', name: 'Vitamin D and minerals', what: 'Vitamin D from sun or food is activated in liver and kidney; magnesium is a cofactor at each step.',
      steps: [['Sun or food vitamin D', null], ['Liver: 25-OH vitamin D', 'vitd'], ['Magnesium cofactor', 'mg'], ['Kidney: active vitamin D', null], ['Bone, muscle, immunity', null]],
      levers: [['Vitamin D3 with K2, taken with a meal that has fat', 'A', 'Raises 25-OH D predictably; retest in 90 days.', 'supplement'], ['Magnesium glycinate at night', 'B', 'Supports vitamin D activation and sleep.', 'supplement'], ['10–20 minutes of midday sun when the UV index allows', 'B', 'The skin makes vitamin D; never burn.', 'mind']],
      rx: '' },
    { k: 'hpa', name: 'Stress and sex hormones', what: 'The stress axis (cortisol) and the sex-hormone axis (testosterone) share inputs: sleep, energy and training load.',
      steps: [['Sleep and recovery', null], ['Morning cortisol', 'cort'], ['Brain signal (LH)', null], ['Total testosterone', 'tt'], ['Free testosterone', 'ft']],
      levers: [['Fixed sleep window, 7–9 hours', 'A', 'Testosterone is made mostly during sleep.', 'sleep'], ['Eat enough to match training', 'A', 'Low energy availability suppresses the sex-hormone axis.', 'nutrition'], ['Deload every 4–6 weeks', 'B', 'Long overload raises cortisol and lowers testosterone.', 'training'], ['Daily breathwork or a walk outside', 'B', 'Downshifts the stress response.', 'mind'], ['Keep body fat in a healthy range', 'A', 'Excess fat converts testosterone to oestrogen.', 'nutrition']],
      rx: 'Testosterone therapy and other hormones are decisions for your prescriber; Myo never doses them.' }
  ];
  let open = null;

  function status(s, id) {
    if (!id) return null;
    const m = s.markers.find((x) => x.id === id); if (!m) return null;
    const e = OS.markerEval(m);
    return { m, e };
  }
  function pathScore(s, P) { const xs = P.steps.map(([, id]) => status(s, id)).filter((x) => x && x.e.score != null); return xs.length ? Math.round(xs.reduce((a, x) => a + x.e.score, 0) / xs.length) : null; }

  // the pathway as a chain of steps: measured steps carry the marker's value and colour
  function chain(s, P) {
    const W = 760, n = P.steps.length, gap = 14, bw = (W - 32 - gap * (n - 1)) / n, y0 = 24, h = 92;
    const col = { good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)', muted: 'var(--line-2)' };
    const words = (t) => { const out = []; let line = ''; t.split(' ').forEach((w) => { if ((line + ' ' + w).trim().length > Math.max(8, Math.floor(bw / 7.2))) { out.push(line.trim()); line = w; } else line += ' ' + w; }); out.push(line.trim()); return out.slice(0, 3); };
    return `<svg class="bc-chain" viewBox="0 0 ${W} ${y0 + h + 40}" role="img" aria-label="${esc(P.name)} pathway: ${esc(P.steps.map((x) => x[0]).join(', then '))}">
      <defs><marker id="bc-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--muted)"/></marker></defs>
      ${P.steps.map(([label, id], i) => {
        const x = 16 + i * (bw + gap), st = status(s, id), c = st ? col[st.e.status] : 'var(--line)', lines = words(label);
        return `<g>${i ? `<line x1="${x - gap + 2}" y1="${y0 + h / 2}" x2="${x - 2}" y2="${y0 + h / 2}" stroke="var(--muted)" stroke-width="1.4" marker-end="url(#bc-ar)"/>` : ''}
          <rect x="${x}" y="${y0}" width="${bw}" height="${h}" rx="10" fill="${st ? `color-mix(in srgb, ${c} 12%, var(--card))` : 'var(--card)'}" stroke="${c}" stroke-width="${st ? 2 : 1.2}"/>
          ${lines.map((l, j) => `<text x="${x + bw / 2}" y="${y0 + 26 + j * 15}" text-anchor="middle" font-size="12" font-weight="${st ? 600 : 500}" fill="var(--fg)">${esc(l)}</text>`).join('')}
          ${st ? `<text x="${x + bw / 2}" y="${y0 + h - 14}" text-anchor="middle" font-size="12" class="num" fill="var(--fg)">${st.e.score == null ? 'No result' : `${esc(st.m.value)} ${esc(st.m.unit)}`}</text>` : ''}</g>`;
      }).join('')}
      <text x="16" y="${y0 + h + 28}" font-size="11.5" fill="var(--muted)">Coloured steps are measured by your labs: green optimal or peak, amber below optimal, red out of range or a red flag.</text></svg>`;
  }

  OS.register('biochem', {
    title: 'Biochem', icon: 'pathway',
    render(s) {
      const cards = PATHS.map((P) => ({ P, sc: pathScore(s, P) })).sort((a, b) => (a.sc ?? 101) - (b.sc ?? 101));
      const P = open && PATHS.find((x) => x.k === open);
      const detail = P ? (() => {
        const meas = P.steps.map(([, id]) => status(s, id)).filter(Boolean);
        return `<section class="card bc-detail" id="bc-detail"><div class="card-h"><h2>${esc(P.name)}</h2><button class="btn ghost sm" data-act="bc-close">Close</button></div>
          <p class="small">${esc(P.what)}</p>
          <div class="bc-chain-wrap">${chain(s, P)}</div>
          ${meas.length ? `<div class="chips">${meas.map(({ m, e }) => `<a class="chip" href="#biology">${esc(m.name)}: ${e.score == null ? 'no result' : `${esc(m.value)} ${esc(m.unit)}`} ${pill(e.status, e.label)}</a>`).join('')}</div>` : ''}
          <h3>Levers</h3><ul class="bc-levers">${P.levers.map(([t, g, d, cat], i) => `<li><span class="bc-grade g-${g}" title="Evidence grade ${g}">${g}</span><span><b>${esc(t)}</b><span class="muted small block">${esc(d)}</span></span><button class="btn ghost sm" data-act="bc-add" data-p="${P.k}" data-i="${i}">${icon('plus', 14)} Protocol</button></li>`).join('')}</ul>
          ${P.rx ? `<p class="fine"><b>With your prescriber:</b> ${esc(P.rx)}</p>` : ''}</section>`;
      })() : '';
      return `${OS.ui.head('Body · Biochemistry', 'Metabolic pathways', 'See how your labs connect inside the body, and which levers move each pathway. Pathways most in need sit first.', `<a class="btn ghost" href="#biology">${icon('biology', 16)} Labs</a>`)}
        ${OS.sampleBanner ? OS.sampleBanner(s) : ''}
        ${detail}
        <div class="bc-grid">${cards.map(({ P: p, sc }) => `<button class="card bc-card ${open === p.k ? 'on' : ''}" data-act="bc-open" data-p="${p.k}"><span class="bc-sc num ${sc == null ? 'none' : sc >= 88 ? 'good' : sc >= 60 ? 'warn' : 'bad'}">${OS.dash(sc)}</span><span><b>${esc(p.name)}</b><span class="muted small block">${esc(p.what)}</span></span></button>`).join('')}</div>
        <p class="fine">Pathway scores average the marker scores along each pathway. This is education to guide your plan, not a diagnosis. Grades: A strong evidence from trials or meta-analyses, B moderate, C early or mixed.</p>`;
    },
    mount(root) { if (open) { const d = root.querySelector('#bc-detail'); if (d && OS._bcScroll) { d.scrollIntoView({ block: 'start', behavior: 'smooth' }); OS._bcScroll = false; } } }
  });
  OS.act('bc-open', (el) => { open = el.dataset.p; OS._bcScroll = true; OS.render(); });
  OS.act('bc-close', () => { open = null; OS.render(); });
  OS.act('bc-add', (el) => {
    const P = PATHS.find((x) => x.k === el.dataset.p), L = P && P.levers[+el.dataset.i]; if (!L) return;
    OS.update((s) => { if (!s.customProtocol.some((x) => x.title === L[0])) s.customProtocol.push({ id: 'bc-' + OS.uid(), cat: L[3], title: L[0], detail: `${L[2]} (${P.name}, evidence ${L[1]})`, time: 'Today', marker: null, custom: true }); });
    OS.toast('Added to your protocol');
  });
  OS.biochem = { PATHS, pathScore };
})();
