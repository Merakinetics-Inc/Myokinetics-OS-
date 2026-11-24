/* ═══ MYO — ATHLETE BUILDER: turn a member into any athlete type ═══
   Inputs: genetic profile (11 performance SNPs, parsed on-device from a 23andMe / AncestryDNA raw file),
   biomarkers, wearables, training loads, body-scan proportions, Lumen-style breath readings.
   Output: fit per archetype, capacity gaps, a 12-week phased protocol, fuel, stack, recovery, benchmarks,
   and a full plan written by Myo. */
(function () {
  'use strict';
  const { esc, clamp, icon, pill, dayKey, addDays, targets, markerEval, fmt } = OS;

  /* ── qualities + archetypes ──────────────────────────────────────── */
  const Q = [['strength', 'Strength'], ['power', 'Power'], ['hypertrophy', 'Muscle'], ['aerobic', 'Aerobic'], ['anaerobic', 'Anaerobic'], ['mobility', 'Mobility'], ['relative', 'Strength : weight']];
  const ARCH = {
    crossfit: {
      name: 'CrossFitter', tag: 'Mixed-modal work capacity', glyph: 'CF',
      demand: { strength: .8, power: .85, hypertrophy: .5, aerobic: .8, anaerobic: 1, mobility: .75, relative: .85 },
      bf: '10–14%', protein: 2.0, carbs: 5, perWeek: 5,
      phases: [['Base capacity', 'Aerobic base, gymnastics volume, squat and press strength'], ['Strength + skill', 'Heavy barbell, muscle-ups, handstand work, threshold intervals'], ['Intensity', 'Benchmark WODs, competition simulations, peak and taper']],
      week: [['Mon', 'Strength: back squat 5×5 + gymnastics EMOM 12'], ['Tue', 'Engine: 5×4 min row/bike at threshold'], ['Wed', 'APS Shoulder Press 4×6 (AR-Vision) + short metcon'], ['Thu', 'Recovery: zone 2 40 min + mobility'], ['Fri', 'Olympic lifting + couplet metcon (Fran-style)'], ['Sat', 'Long chipper 25–35 min, mixed modal'], ['Sun', 'Rest']],
      stack: ['Creatine monohydrate 5 g daily', 'Beta-alanine 3.2 g daily, split doses', 'Electrolytes 500–1,000 mg sodium in training'],
      bench: [['fran', 'Fran', 'min:sec'], ['row2k', '2k row', 'min:sec'], ['bsq', 'Back squat 1RM', 'lb'], ['pullups', 'Max strict pull-ups', 'reps']]
    },
    runner: {
      name: 'Runner', tag: 'Aerobic engine, economy, durability', glyph: 'RN',
      demand: { strength: .45, power: .4, hypertrophy: .15, aerobic: 1, anaerobic: .6, mobility: .5, relative: .75 },
      bf: '8–12%', protein: 1.7, carbs: 7, perWeek: 6,
      phases: [['Aerobic base', '80% easy volume, strides, strength twice a week'], ['Threshold', 'Tempo and cruise intervals, hill repeats, long run growth'], ['Race-specific', 'VO₂max intervals, race-pace work, 10-day taper']],
      week: [['Mon', 'Easy 45 min + strides'], ['Tue', 'Threshold: 4×8 min at LT pace'], ['Wed', 'Easy 40 min + ISO Flow single-leg strength'], ['Thu', 'VO₂max: 6×3 min hard, 2 min jog'], ['Fri', 'Rest or 30 min easy'], ['Sat', 'Long run 90–120 min, last 20 at marathon pace'], ['Sun', 'Easy 40 min + mobility']],
      stack: ['Dietary nitrate 6–8 mmol (beetroot) 2–3 h before key sessions', 'Electrolytes with long runs', 'Iron only if ferritin drops below 50'],
      bench: [['5k', '5k', 'min:sec'], ['10k', '10k', 'min:sec'], ['lt', 'Threshold pace', 'min/km'], ['vo2', 'VO₂max estimate', 'ml/kg/min']]
    },
    bodybuilder: {
      name: 'Bodybuilder', tag: 'Muscle, symmetry, conditioning', glyph: 'BB',
      demand: { strength: .6, power: .3, hypertrophy: 1, aerobic: .35, anaerobic: .4, mobility: .4, relative: .3 },
      bf: 'Off-season 10–13%, stage 5–7%', protein: 2.2, carbs: 4.5, perWeek: 5,
      phases: [['Accumulation', '12–20 hard sets per muscle a week, RIR 2–3, lagging parts first'], ['Intensification', 'Lengthened partials, drop sets, RIR 0–1, deload week 8'], ['Peak / mini-cut', '0.5–0.75% bodyweight loss a week, keep volume, posing practice']],
      week: [['Mon', 'Push: APS Shoulder Press + incline press + ISO Flow fly'], ['Tue', 'Pull: rows, pulldowns, rear delts'], ['Wed', 'Legs: squat pattern, hinge, calves'], ['Thu', 'Zone 2 30 min + posing'], ['Fri', 'Upper: lagging parts priority'], ['Sat', 'Lower: hamstrings and glutes priority'], ['Sun', 'Rest']],
      stack: ['Creatine monohydrate 5 g daily', 'Whey or EAA 30–40 g around training', 'Caffeine pre-training as tolerated'],
      bench: [['weight', 'Bodyweight', 'kg'], ['waist', 'Waist', 'cm'], ['arm', 'Arm (flexed)', 'cm'], ['taper', 'Shoulder : hip (body scan)', '×']]
    },
    powerlifter: {
      name: 'Powerlifter', tag: 'Max squat, bench, deadlift', glyph: 'PL',
      demand: { strength: 1, power: .7, hypertrophy: .6, aerobic: .25, anaerobic: .4, mobility: .5, relative: .5 },
      bf: 'Weight-class driven, 12–18%', protein: 2.0, carbs: 4, perWeek: 4,
      phases: [['Hypertrophy base', 'Competition lifts at 65–75%, back-off volume, weak-point accessories'], ['Strength', '80–90% triples and doubles, paused variations'], ['Peak', 'Singles at 90–97%, openers, 7–10 day taper']],
      week: [['Mon', 'Squat 5×3 @ 80% (AR-Vision depth check) + accessories'], ['Tue', 'Bench 5×4 + APS Shoulder Press 3×8'], ['Wed', 'Rest or zone 2 25 min'], ['Thu', 'Deadlift 4×3 + ISO Flow posterior chain'], ['Fri', 'Bench variation + upper back'], ['Sat', 'Squat variation + conditioning 10 min'], ['Sun', 'Rest']],
      stack: ['Creatine monohydrate 5 g daily', 'Caffeine 3 mg/kg before top sets', 'Sodium and fluids up on heavy days'],
      bench: [['sq', 'Squat 1RM', 'lb'], ['bp', 'Bench 1RM', 'lb'], ['dl', 'Deadlift 1RM', 'lb'], ['bw', 'Bodyweight', 'kg']]
    },
    climber: {
      name: 'Climber', tag: 'Finger strength, pulling, strength-to-weight', glyph: 'CL',
      demand: { strength: .6, power: .7, hypertrophy: .15, aerobic: .55, anaerobic: .65, mobility: .85, relative: 1 },
      bf: '7–12%', protein: 1.8, carbs: 4.5, perWeek: 5,
      phases: [['Tendon + base', 'Hangboard repeaters at low load, volume climbing, antagonist work'], ['Max strength', 'Max hangs 20 mm, weighted pull-ups, limit bouldering'], ['Power endurance', '4×4s, linked circuits, projecting and redpoint']],
      week: [['Mon', 'Limit bouldering 90 min + max hangs'], ['Tue', 'ISO Flow antagonist push + shoulder health'], ['Wed', 'Aerobic capacity: ARC 3×20 min'], ['Thu', 'Rest + mobility (hips, shoulders)'], ['Fri', 'Weighted pull-ups + campus or power'], ['Sat', 'Project day outdoors or route volume'], ['Sun', 'Rest']],
      stack: ['Collagen 15 g + vitamin C 50 mg, 45 min before finger loading', 'Creatine monohydrate 3–5 g daily', 'Omega-3 2 g EPA + DHA'],
      bench: [['grade', 'Max boulder grade', 'V'], ['hang', 'Max hang 20 mm, 10 s', '% bodyweight'], ['wpu', 'Weighted pull-up 1RM', '% bodyweight'], ['route', 'Max route grade', 'YDS']]
    }
  };

  /* ── genetics: performance-associated SNPs, parsed locally ───────── */
  const GENES = [
    { id: 'actn3', gene: 'ACTN3', rs: 'rs1815739', eff: ['T'], gt: ['RR', 'RX', 'XX'], what: 'Fast-twitch fibre protein',
      say: ['Both copies of fast-twitch α-actinin-3: a power and sprint lean', 'Mixed: power and endurance both trainable', 'No α-actinin-3: endurance lean, more eccentric soreness'],
      fx: [{ power: .08, strength: .04 }, {}, { aerobic: .05, power: -.06 }], tw: [null, null, 'Extra 24 h after heavy eccentric or plyometric days; progress jumps slowly'] },
    { id: 'ace', gene: 'ACE', rs: 'rs4341', eff: ['C'], gt: ['D/D', 'I/D', 'I/I'], what: 'Blood-pressure enzyme (I/D proxy)',
      say: ['D/D: strength and power responders', 'I/D: balanced', 'I/I: endurance responders'], fx: [{ strength: .05, power: .03 }, {}, { aerobic: .06 }], tw: [null, null, null] },
    { id: 'ppargc1a', gene: 'PPARGC1A', rs: 'rs8192678', eff: ['T'], gt: ['Gly/Gly', 'Gly/Ser', 'Ser/Ser'], what: 'Mitochondria builder (PGC-1α)',
      say: ['Strong aerobic trainability', 'Typical aerobic response', 'Smaller aerobic response per session'], fx: [{ aerobic: .05 }, {}, { aerobic: -.04 }], tw: [null, null, 'Add 60–90 min zone 2 a week to get the same aerobic gain'] },
    { id: 'col5a1', gene: 'COL5A1', rs: 'rs12722', eff: ['T'], gt: ['CC', 'CT', 'TT'], what: 'Tendon and ligament collagen',
      say: ['Lower soft-tissue injury association', 'Typical', 'Stiffer tendons, higher soft-tissue injury association'], fx: [{ mobility: .03 }, {}, { mobility: -.04 }], tw: [null, null, 'Collagen 15 g + vitamin C before tendon loading; slower load progressions'] },
    { id: 'mct1', gene: 'SLC16A1 (MCT1)', rs: 'rs1049434', eff: ['T'], gt: ['AA', 'AT', 'TT'], what: 'Lactate transporter',
      say: ['Faster lactate clearance association', 'Typical', 'Slower lactate clearance association'], fx: [{ anaerobic: .05 }, {}, { anaerobic: -.04 }], tw: [null, null, 'Longer rest between glycolytic intervals (1:3 work:rest to start)'] },
    { id: 'ampd1', gene: 'AMPD1', rs: 'rs17602729', eff: ['A'], gt: ['GG', 'GA', 'AA'], what: 'Muscle energy recycling',
      say: ['Typical', 'One reduced-function copy: slower recovery from repeated sprints', 'Reduced function: slower high-intensity recovery'], fx: [{}, { anaerobic: -.02 }, { anaerobic: -.05 }], tw: [null, 'Keep 48 h between high-intensity days', 'Keep 48–72 h between high-intensity days'] },
    { id: 'cyp1a2', gene: 'CYP1A2', rs: 'rs762551', eff: ['C'], gt: ['AA', 'AC', 'CC'], what: 'Caffeine metabolism',
      say: ['Fast caffeine metaboliser: caffeine boosts performance', 'Slow metaboliser', 'Slow metaboliser'], fx: [{}, {}, {}], tw: ['Caffeine 3 mg/kg 45 min before key sessions', 'Caffeine 1–2 mg/kg, before noon only', 'Caffeine 1 mg/kg at most, or skip; before noon only'] },
    { id: 'comt', gene: 'COMT', rs: 'rs4680', eff: ['A'], gt: ['Val/Val', 'Val/Met', 'Met/Met'], what: 'Dopamine clearance',
      say: ['Thrives under pressure; may need more arousal to peak', 'Balanced', 'Stress- and stimulant-sensitive; sharp focus when calm'], fx: [{}, {}, {}], tw: ['Loud, high-arousal warm-ups before maximal efforts', null, 'Box breathing before competition; cap stimulants'] },
    { id: 'mthfr', gene: 'MTHFR', rs: 'rs1801133', eff: ['T', 'A'], gt: ['CC', 'CT', 'TT'], what: 'Folate metabolism (C677T)',
      say: ['Typical folate metabolism', 'Mildly reduced enzyme activity', 'Reduced enzyme activity; homocysteine tends to run high'], fx: [{}, {}, {}], tw: [null, 'Methylfolate 400 mcg if homocysteine is above 8', 'Methylfolate 800 mcg + methyl-B12 1,000 mcg; retest homocysteine'] },
    { id: 'gc', gene: 'GC', rs: 'rs2282679', eff: ['G'], gt: ['TT', 'TG', 'GG'], what: 'Vitamin D binding protein',
      say: ['Typical vitamin D levels', 'Tends to run lower vitamin D', 'Tends to run low vitamin D'], fx: [{}, {}, {}], tw: [null, 'Vitamin D3 5,000 IU, target 50–60 ng/mL', 'Vitamin D3 5,000–7,000 IU, target 50–60 ng/mL, retest at 8 weeks'] },
    { id: 'fto', gene: 'FTO', rs: 'rs9939609', eff: ['A'], gt: ['TT', 'TA', 'AA'], what: 'Appetite and fat mass',
      say: ['Typical appetite regulation', 'Slightly higher appetite tendency', 'Higher appetite and fat-mass tendency'], fx: [{}, {}, {}], tw: [null, 'Protein at the top of your range; high-volume meals', 'Protein 2.2 g/kg, high-volume meals, 10k+ steps daily'] }
  ];
  const SAMPLE_DNA = { actn3: 0, ace: 1, ppargc1a: 1, col5a1: 2, mct1: 1, ampd1: 0, cyp1a2: 1, comt: 1, mthfr: 1, gc: 1, fto: 1 };

  function ensure(s) {
    if (!s.athlete) {
      const t = new Date(), br = [3, 2, 3, 2, 2, 3, 2].map((v, i) => ({ d: dayKey(addDays(t, i - 6)), v }));
      s.athlete = { target: 'crossfit', dna: s.sample ? { ...SAMPLE_DNA } : {}, dnaSource: s.sample ? 'Sample genotype' : '', breath: s.sample ? br : [], bench: {}, plans: {} };
    }
    return s.athlete;
  }

  /* ── capacity model from every input ─────────────────────────────── */
  const e1rm = (w, r) => (r > 0 ? w * (1 + r / 30) : 0);
  const mScore = (s, id) => { const m = s.markers.find((x) => x.id === id); return m ? markerEval(m).score / 100 : 0.75; };
  function capacities(s, sc) {
    const A = ensure(s), p = s.profile, vt = s.vitals, bwLb = p.weightKg * 2.2046, bmi = p.weightKg / Math.pow(p.heightCm / 100, 2);
    const ex = s.training.session.exercises;
    const best = Math.max(0, ...ex.map((e) => Math.max(e1rm(+e.target.load, +e.target.reps), ...e.sets.filter((x) => x.done).map((x) => e1rm(+x.w, +x.r)))));
    const press = ex.find((e) => /press/i.test(e.name));
    const pressE = press ? Math.max(e1rm(+press.target.load, +press.target.reps), ...press.sets.filter((x) => x.done).map((x) => e1rm(+x.w, +x.r))) : best;
    const scan = OS.Scan && OS.Scan.photos && [...OS.Scan.photos].reverse().find((x) => x.metrics && x.metrics.view === 'front');
    const taper = scan ? (scan.metrics.items.find((x) => x.k === 'taper') || {}).value : null;
    const postureGood = scan ? scan.metrics.items.filter((x) => x.status === 'good').length / Math.max(1, scan.metrics.items.filter((x) => x.status !== 'info').length) : null;
    const br = A.breath.slice(-7), amAvg = br.length ? br.reduce((a, b) => a + b.v, 0) / br.length : null;
    const c = {
      strength: clamp((pressE / bwLb) / 0.9, 0, 1) * 0.75 + mScore(s, 'tt') * 0.25,
      aerobic: clamp((72 - vt.rhr) / 30, 0, 1) * 0.45 + clamp((vt.hrv - 25) / 75, 0, 1) * 0.35 + (amAvg != null ? clamp((5 - amAvg) / 4, 0, 1) : 0.5) * 0.2,
      anaerobic: clamp(sc.readiness / 100, 0, 1) * 0.5 + mScore(s, 'hgb') * 0.25 + mScore(s, 'mg') * 0.25,
      hypertrophy: (taper ? clamp((taper - 1.15) / 0.65, 0, 1) : 0.55) * 0.6 + clamp(sc.parts.training / 100, 0, 1) * 0.4,
      mobility: (postureGood != null ? postureGood : 0.62) * 0.7 + clamp(sc.parts.life / 100, 0, 1) * 0.3,
      relative: 0
    };
    c.power = c.strength * 0.55 + clamp(sc.readiness / 100, 0, 1) * 0.25 + mScore(s, 'ck') * 0.2;
    c.relative = c.strength * 0.55 + clamp(1 - (bmi - 20) / 12, 0, 1) * 0.45;
    // genetics shift the estimate a little; measured data dominates
    GENES.forEach((g) => { const n = A.dna[g.id]; if (n == null) return; Object.entries(g.fx[n] || {}).forEach(([k, v]) => { c[k] = (c[k] || 0) + v; }); });
    Object.keys(c).forEach((k) => { c[k] = clamp(c[k], 0.05, 1); });
    const src = { pressE: Math.round(pressE), bwLb: Math.round(bwLb), bmi: bmi.toFixed(1), taper, postureGood, amAvg };
    return { c, src };
  }
  function fitOf(arch, c) {
    const d = ARCH[arch].demand; let num = 0, den = 0;
    Object.entries(d).forEach(([k, w]) => { num += w * Math.pow(Math.min(1, c[k] / w), 2.2); den += w; });
    return Math.round((num / den) * 100);
  }

  /* ── charts ──────────────────────────────────────────────────────── */
  function radar(c, demand) {
    const N = Q.length, R = 110, cx = 150, cy = 140;
    const pt = (i, v) => { const a = -Math.PI / 2 + (i / N) * Math.PI * 2; return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v]; };
    const poly = (vals) => vals.map((v, i) => pt(i, v).map((n) => n.toFixed(1)).join(',')).join(' ');
    const rings = [0.25, 0.5, 0.75, 1].map((r) => `<polygon points="${poly(Q.map(() => r))}" class="rd-ring"/>`).join('');
    const spokes = Q.map((_, i) => { const [x, y] = pt(i, 1); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="rd-ring"/>`; }).join('');
    const labels = Q.map(([, l], i) => { const [x, y] = pt(i, 1.2); return `<text x="${x}" y="${y}" text-anchor="${x < cx - 5 ? 'end' : x > cx + 5 ? 'start' : 'middle'}" dominant-baseline="middle">${esc(l)}</text>`; }).join('');
    return `<svg class="radar" viewBox="0 0 300 280" role="img" aria-label="Your capacities against the target athlete profile">${rings}${spokes}
      <polygon points="${poly(Q.map(([k]) => demand[k]))}" class="rd-target"/><polygon points="${poly(Q.map(([k]) => c[k]))}" class="rd-you"/>
      ${Q.map(([k], i) => { const [x, y] = pt(i, c[k]); return `<circle cx="${x}" cy="${y}" r="3" class="rd-dot"/>`; }).join('')}${labels}</svg>`;
  }

  /* ── protocol builder ────────────────────────────────────────────── */
  function build(s, sc, arch) {
    const A = ensure(s), a = ARCH[arch], { c, src } = capacities(s, sc);
    const gaps = Q.map(([k, l]) => ({ k, l, gap: a.demand[k] - c[k], cur: c[k], need: a.demand[k] })).filter((g) => g.gap > 0.03).sort((x, y) => y.gap - x.gap);
    const tg = targets(s.profile), kg = s.profile.weightKg;
    const br = A.breath.slice(-7), am = br.length ? br.reduce((x, y) => x + y.v, 0) / br.length : null;
    let carbs = a.carbs, fuelNote = 'No breath readings yet; carbs follow training load.';
    if (am != null) {
      if (am >= 3.8) { carbs = Math.max(3, a.carbs - 1); fuelNote = `Morning breath average ${am.toFixed(1)}: you wake up burning mostly carbs. Carbs come down to ${carbs} g/kg, moved around training; zone 2 fasted twice a week to build fat oxidation.`; }
      else if (am <= 2.2) { carbs = a.carbs + 0.5; fuelNote = `Morning breath average ${am.toFixed(1)}: strong fat burning overnight. Carbs up to ${carbs} g/kg, loaded before and after the hardest sessions.`; }
      else fuelNote = `Morning breath average ${am.toFixed(1)}: metabolically flexible. Carbs ${carbs} g/kg, periodised: high on hard days, low on rest days.`;
    }
    const protein = Math.round(a.protein * kg + (A.dna.fto === 2 ? 0.2 * kg : 0));
    const carbG = Math.round(carbs * kg), fatG = Math.round(kg * 0.9);
    const kcal = protein * 4 + carbG * 4 + fatG * 9;
    const gene = GENES.map((g) => ({ g, n: A.dna[g.id] })).filter((x) => x.n != null && x.g.tw[x.n]).map((x) => ({ gene: x.g.gene, gt: x.g.gt[x.n], tip: x.g.tw[x.n] }));
    const stack = [...a.stack];
    const caf = gene.find((x) => x.gene === 'CYP1A2'); if (caf) stack.push(caf.tip);
    ['COL5A1', 'MTHFR', 'GC'].forEach((n) => { const x = gene.find((y) => y.gene === n); if (x && !stack.some((t) => t.startsWith(x.tip.slice(0, 12)))) stack.push(x.tip); });
    const sc2 = sc.markers.filter((x) => x.e.status !== 'good' && ['ferr', 'vitd', 'o3', 'mg', 'tt', 'hgb'].includes(x.m.id)).map((x) => x.m.name);
    const rec = [`Sleep ${s.vitals.sleepH < 8 ? '8+ h; you average ' + s.vitals.sleepH + ' h' : '8 h, holding'}`, `Train hard only when HRV is within 7% of your ${s.vitals.hrvBase} ms baseline; otherwise swap to zone 2`];
    gene.filter((x) => ['ACTN3', 'AMPD1', 'COMT', 'PPARGC1A', 'SLC16A1 (MCT1)'].includes(x.gene)).forEach((x) => rec.push(x.tip));
    return { a, arch, c, src, gaps, fit: fitOf(arch, c), nutrition: { kcal, protein, carbs: carbG, fat: fatG, note: fuelNote, maint: tg.kcal }, stack, rec, gene, labs: sc2 };
  }

  /* ── view ────────────────────────────────────────────────────────── */
  OS.register('athlete', {
    title: 'Athlete', icon: 'athlete',
    render(s, sc) {
      const A = ensure(s), arch = A.target, P = build(s, sc, arch), a = P.a;
      const fits = Object.keys(ARCH).map((k) => ({ k, f: fitOf(k, P.c) })).sort((x, y) => y.f - x.f);
      const top = fits[0].k, genesN = Object.keys(A.dna).length;
      const cards = Object.entries(ARCH).map(([k, x]) => { const f = fits.find((y) => y.k === k).f; return `<button class="arch ${k === arch ? 'on' : ''}" data-act="ath-target" data-arch="${k}" aria-pressed="${k === arch}">
        <span class="arch-g">${x.glyph}</span><span class="arch-n">${esc(x.name)}</span><span class="arch-t">${esc(x.tag)}</span>
        <span class="arch-f"><b class="num">${f}%</b> fit${k === top ? ' · <em>best natural fit</em>' : ''}</span></button>`; }).join('');
      const gapRows = Q.map(([k, l]) => `<div class="gap-r"><span>${esc(l)}</span><span class="gap-t"><span class="gap-need" style="left:${(a.demand[k] * 100).toFixed(0)}%"></span><span class="gap-you" style="width:${(P.c[k] * 100).toFixed(0)}%"></span></span><b class="num">${Math.round(P.c[k] * 100)}<small>/${Math.round(a.demand[k] * 100)}</small></b></div>`).join('');
      const plan = A.plans[arch];
      const dnaRows = GENES.map((g) => { const n = A.dna[g.id]; return `<tr><td><b>${esc(g.gene)}</b><span class="muted small block">${esc(g.what)} · ${g.rs}</span></td>
        <td><select data-change="ath-dna" data-gene="${g.id}" aria-label="${esc(g.gene)} genotype"><option value="">Unknown</option>${g.gt.map((t, i) => `<option value="${i}" ${n === i ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></td>
        <td class="small">${n == null ? '<span class="muted">Not loaded</span>' : esc(g.say[n])}</td></tr>`; }).join('');
      const br = A.breath.slice(-7);
      const brDots = br.map((b) => `<div class="br-d"><span class="br-bar lv-${b.v}" style="height:${b.v * 20}%"></span><em>${esc(new Date(b.d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'narrow' }))}</em></div>`).join('');
      const today = dayKey(), todayBr = A.breath.find((b) => b.d === today);
      return `${OS.ui.head('Athlete development · DNA + biomarkers + training + metabolism', 'Athlete builder', 'Pick the athlete you want to become. Myo builds the path from your genetics, labs, wearables, machine data and body scans.',
        `<div class="hstat"><span>Target</span><b>${esc(a.name)}</b></div><div class="hstat"><span>Fit today</span><b class="num">${P.fit}%</b></div><div class="hstat"><span>Genes</span><b class="num">${genesN}/${GENES.length}</b></div>`)}
      <div class="arch-row">${cards}</div>

      <div class="grid g-2">
        <section class="card">
          <div class="card-h"><h2>You vs. ${esc(a.name)}</h2><span class="legend"><i class="lg-you"></i>You <i class="lg-target"></i>Target</span></div>
          <div class="ath-split">${radar(P.c, a.demand)}<div class="gaps">${gapRows}</div></div>
          <p class="fine">Built from: press e1RM ${P.src.pressE} lb at ${P.src.bwLb} lb bodyweight · RHR ${s.vitals.rhr} · HRV ${s.vitals.hrv} ms · BMI ${P.src.bmi}${P.src.taper ? ` · body-scan V-taper ${P.src.taper}×` : ' · no body scan yet'}${P.src.amAvg != null ? ` · breath ${P.src.amAvg.toFixed(1)}` : ''} · ${genesN} genes. Measured data outweighs DNA.</p>
        </section>
        <section class="card">
          <div class="card-h"><h2>12-week path</h2>${pill('peak', `${a.perWeek} sessions / week`)}</div>
          <p class="ath-gaps">${P.gaps.length ? `Biggest gaps: ${P.gaps.slice(0, 3).map((g) => `<b>${esc(g.l.toLowerCase())}</b> (${Math.round(g.cur * 100)} → ${Math.round(g.need * 100)})`).join(', ')}. Every block leads with them.` : 'You already meet the profile. This path is about peaking.'}</p>
          <ol class="phases">${a.phases.map(([n, d], i) => `<li><span class="ph-w num">Wk ${i * 4 + 1}–${i * 4 + 4}</span><b>${esc(n)}</b><span>${esc(d)}${i === 0 && P.gaps[0] ? `; extra ${esc(P.gaps[0].l.toLowerCase())} work` : ''}</span></li>`).join('')}</ol>
          <div class="week">${a.week.map(([d, t]) => `<div><span>${d}</span><p>${esc(t)}</p></div>`).join('')}</div>
          <div class="row"><button class="btn" data-act="ath-adopt">${A.active === arch ? 'Re-apply to my plan' : 'Make this my program'}</button>${A.active === arch ? '<span class="muted small">Active program</span>' : ''}</div>
        </section>
      </div>

      <div class="grid g-2">
        <section class="card">
          <div class="card-h"><h2>Fuel</h2><span class="muted small">Daily target · maintenance ${fmt(P.nutrition.maint)} kcal</span></div>
          <div class="kv4"><div><span>Energy</span><b class="num">${fmt(P.nutrition.kcal)}</b></div><div><span>Protein</span><b class="num">${P.nutrition.protein} g</b></div><div><span>Carbs</span><b class="num">${P.nutrition.carbs} g</b></div><div><span>Fat</span><b class="num">${P.nutrition.fat} g</b></div></div>
          <div class="mbreath">
            <div class="br-h"><b>Metabolism · breath readings</b><span class="muted small">1 = burning fat · 5 = burning carbs</span></div>
            <div class="br-chart">${brDots || '<p class="muted small">No readings yet.</p>'}</div>
            <div class="br-log"><span class="small">${todayBr ? `Today's morning reading: <b>${todayBr.v}</b>. Change it:` : 'Log this morning\'s reading from your Lumen or any breath CO₂ device:'}</span><div class="seg">${[1, 2, 3, 4, 5].map((v) => `<button data-act="ath-breath" data-v="${v}" class="${todayBr && todayBr.v === v ? 'on' : ''}" aria-pressed="${!!(todayBr && todayBr.v === v)}">${v}</button>`).join('')}</div></div>
            <p class="small">${esc(P.nutrition.note)}</p>
          </div>
          <p class="fine">Body-fat target for ${esc(a.name.toLowerCase())}s: ${esc(a.bf)}. Lumen has no public data feed, so readings are entered by hand for now.</p>
        </section>
        <section class="card">
          <div class="card-h"><h2>Stack and recovery</h2><span class="chip chip-supplement">Adjusted to your DNA</span></div>
          <ul class="ath-list">${P.stack.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
          ${P.labs.length ? `<p class="small muted">Lab levers that cap this athlete type: ${esc(P.labs.join(', '))}. Your daily protocol already targets them.</p>` : ''}
          <h3 class="ath-h3">Recovery rules</h3>
          <ul class="ath-list">${P.rec.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        </section>
      </div>

      <div class="grid g-2">
        <section class="card">
          <div class="card-h"><h2>Genetic profile</h2><span class="muted small">${esc(A.dnaSource || 'Not loaded')}</span></div>
          <div class="row"><label class="btn ghost sm file">${icon('upload', 14)} Import 23andMe / AncestryDNA raw file<input type="file" accept=".txt,.csv,.tsv,text/plain" data-change="ath-dna-file"></label>${genesN ? '<button class="btn ghost sm" data-act="ath-dna-clear">Clear genotypes</button>' : ''}</div>
          <div class="tbl-wrap"><table class="tbl dna"><thead><tr><th>Gene</th><th>Genotype</th><th>What it means for training</th></tr></thead><tbody>${dnaRows}</tbody></table></div>
          <p class="fine">Your raw file is read on this device. Only these ${GENES.length} genotypes are kept; the rest of the file is discarded. Each gene shifts the plan a little, because single genes explain a small share of performance.</p>
        </section>
        <section class="card">
          <div class="card-h"><h2>Benchmarks</h2><span class="muted small">Retest every 4 weeks</span></div>
          <form class="bench" data-submit="ath-bench">${a.bench.map(([k, l, u]) => `<label class="field" for="bn-${k}"><span>${esc(l)} <em>${esc(u)}</em></span><input id="bn-${k}" name="${k}" value="${esc((A.bench[arch] || {})[k] || '')}" placeholder="${esc(u)}"></label>`).join('')}<div class="form-end"><button class="btn ghost sm">Save benchmarks</button></div></form>
          <div class="myo-plan">
            <div class="card-h"><h2>Myo's full plan</h2><span class="chip chip-ai">AI coach</span></div>
            ${plan ? `<div class="md">${mdl(plan.text)}</div><p class="fine">Written ${esc(new Date(plan.at).toLocaleDateString())}.</p>` : `<p class="muted small">Myo writes your full 12-week ${esc(a.name.toLowerCase())} program: exact sessions, loads from your machine data, fuel by day, stack, deloads and test days, all from your DNA, labs, wearables and scans.</p>`}
            <button class="btn" data-act="ath-myo" ${busy ? 'disabled' : ''}>${icon('coach', 15)} ${busy ? 'Myo is building your plan…' : plan ? 'Rebuild with Myo' : 'Build my plan with Myo'}</button>
          </div>
        </section>
      </div>`;
    }
  });

  function mdl(t) {
    const L = esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split('\n'); let o = '', ul = false;
    L.forEach((l) => {
      const h = l.match(/^#{1,4}\s+(.*)/), li = l.match(/^\s*[-•*]\s+(.*)/);
      if (li) { if (!ul) { o += '<ul>'; ul = true; } o += `<li>${li[1]}</li>`; return; }
      if (ul) { o += '</ul>'; ul = false; }
      if (h) o += `<h3>${h[1]}</h3>`; else if (l.trim()) o += `<p>${l}</p>`;
    });
    return o + (ul ? '</ul>' : '');
  }

  /* ── actions ─────────────────────────────────────────────────────── */
  let busy = false;
  OS.act('ath-target', (el) => OS.update((s) => { ensure(s).target = el.dataset.arch; }, { keepSample: true }));
  OS.change('ath-dna', (el) => OS.update((s) => { const A = ensure(s); if (el.value === '') delete A.dna[el.dataset.gene]; else A.dna[el.dataset.gene] = +el.value; A.dnaSource = 'Entered by hand'; }));
  OS.act('ath-dna-clear', () => OS.update((s) => { const A = ensure(s); A.dna = {}; A.dnaSource = ''; }));
  OS.act('ath-breath', (el) => OS.update((s) => { const A = ensure(s), d = dayKey(); A.breath = A.breath.filter((b) => b.d !== d).concat({ d, v: +el.dataset.v }).sort((x, y) => x.d.localeCompare(y.d)).slice(-60); }));
  OS.act('ath-bench', (f) => { const vals = {}; [...f.elements].forEach((e) => { if (e.name) vals[e.name] = e.value.trim().slice(0, 20); }); OS.update((s) => { const A = ensure(s); A.bench[A.target] = vals; }); OS.toast('Benchmarks saved'); });
  OS.change('ath-dna-file', (el) => {
    const f = el.files && el.files[0]; el.value = ''; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      const want = Object.fromEntries(GENES.map((g) => [g.rs, g])), found = {};
      String(rd.result).split(/\r?\n/).forEach((line) => {
        if (!line || line[0] === '#') return;
        const c = line.split(/[\t,]+/).map((x) => x.replace(/"/g, '').trim()), g = want[c[0]];
        if (!g) return;
        const call = (c.length >= 5 ? c[3] + c[4] : c[3] || '').toUpperCase();
        if (!/^[ACGT]{2}$/.test(call)) return;
        found[g.id] = [...call].filter((a) => g.eff.includes(a)).length;
      });
      const n = Object.keys(found).length;
      if (!n) { OS.toast('No matching genotypes found. Use the raw data .txt from 23andMe or AncestryDNA.'); return; }
      OS.update((s) => { const A = ensure(s); A.dna = found; A.dnaSource = `${f.name.slice(0, 40)} · ${n} of ${GENES.length} found`; });
      OS.toast(`Loaded ${n} of ${GENES.length} genotypes. The rest of the file was discarded.`);
    };
    rd.readAsText(f);
  });
  OS.act('ath-adopt', () => {
    const s = OS.state, sc = OS.scores(s), A = ensure(s), P = build(s, sc, A.target), a = P.a;
    OS.update((st) => {
      const AA = ensure(st); AA.active = A.target;
      st.training.program = { name: `${a.name} · ${a.phases[0][0]}`, week: 1, weeks: 12, perWeek: a.perWeek, focus: a.phases[0][1] };
      st.customProtocol = (st.customProtocol || []).filter((i) => !String(i.id).startsWith('ath-'));
      P.stack.slice(0, 5).forEach((t, i) => st.customProtocol.push({ id: 'ath-' + i, cat: 'supplement', title: t.length > 70 ? t.slice(0, 68) + '…' : t, detail: `${a.name} program`, time: 'Daily', marker: null, custom: true }));
      st.customProtocol.push({ id: 'ath-fuel', cat: 'nutrition', title: `Fuel: ${fmt(P.nutrition.kcal)} kcal · ${P.nutrition.protein} g protein · ${P.nutrition.carbs} g carbs`, detail: P.nutrition.note, time: 'Daily', marker: null, custom: true });
    });
    OS.toast(`${a.name} program is live: training, fuel and stack added to Today.`);
  });
  OS.act('ath-myo', async () => {
    if (busy) return;
    const s = OS.state, sc = OS.scores(s), A = ensure(s), P = build(s, sc, A.target), a = P.a;
    const sample = OS.caps && OS.caps.sample;
    const fallback = () => [`## ${a.name} · 12 weeks`, ...a.phases.map(([n, d], i) => `### Weeks ${i * 4 + 1}–${i * 4 + 4}: ${n}\n- ${d}\n- Lead with ${P.gaps[0] ? P.gaps[0].l.toLowerCase() : 'your weakest quality'}`), '### Every week', ...a.week.map(([d, t]) => `- **${d}** ${t}`), '### Fuel', `- ${P.nutrition.kcal} kcal · ${P.nutrition.protein} g protein · ${P.nutrition.carbs} g carbs · ${P.nutrition.fat} g fat`, '### Stack', ...P.stack.map((t) => `- ${t}`), '', '*Offline plan. Open Myo in Claude for the full AI-written program.*'].join('\n');
    if (!sample) { OS.update((st) => { ensure(st).plans[A.target] = { text: fallback(), at: new Date().toISOString() }; }); return; }
    busy = true; OS.render();
    const data = {
      target: a.name, fit: P.fit, capacities: Object.fromEntries(Q.map(([k]) => [k, Math.round(P.c[k] * 100)])), demand: Object.fromEntries(Q.map(([k]) => [k, Math.round(a.demand[k] * 100)])),
      gaps: P.gaps.map((g) => g.l), genetics: GENES.filter((g) => A.dna[g.id] != null).map((g) => `${g.gene} ${g.gt[A.dna[g.id]]}: ${g.say[A.dna[g.id]]}`),
      profile: s.profile, vitals: s.vitals, readiness: sc.readiness, biomarkers: sc.markers.map(({ m, e }) => `${m.name} ${m.value} ${m.unit} (${e.label}, peak ${OS.ui.fmtR(OS.peakOf(m))})`), redFlags: sc.redFlags,
      machines: s.machines.map((m) => `${m.name}: ${m.kind}`), currentLoads: s.training.session.exercises.map((e) => `${e.name} ${e.target.sets}×${e.target.reps} @ ${e.target.load} ${e.target.unit}`),
      breathAvg: P.src.amAvg, benchmarks: A.bench[A.target] || {}, baseTemplate: { phases: a.phases, week: a.week, fuel: P.nutrition, stack: P.stack, recovery: P.rec }
    };
    const prompt = `You are Myo, the autonomous performance physiologist inside the Myo app (built on Myokinetics OS). Build this member's 12-week program to become a ${a.name}. Use every input: genetics, biomarkers (aim for peak ranges), wearables, current machine loads, breath-based metabolism and benchmarks. Use the base template, then personalise it: exact sessions per week with sets, reps, loads or paces derived from current loads, progression rules, deloads, test days, fuel by training day versus rest day, supplement timing and recovery rules. Use Merakinetics machines where they fit (APS Machine, ISO Flow, Dumbbell Hangers, MK-Pro Rack, AR-Vision for form). Format: "### " headings per block and "- " bullets, under 450 words, decisive, no hedging. Boundaries: no prescription drugs, hormones or PEDs. If redFlags is not empty, open with it and tell them to get in-person care today.\n\nDATA:\n${JSON.stringify(data)}`;
    let text;
    try { const r = await sample(prompt, { cache: false, modelTier: 'complex' }); text = (r.text || '').trim(); }
    catch (e) { text = fallback() + (e && e.code === 'not_granted' ? '\n\nAI access was declined, so this is the offline plan.' : ''); }
    busy = false;
    OS.update((st) => { ensure(st).plans[A.target] = { text, at: new Date().toISOString() }; });
  });

  OS.athlete = { ARCH, GENES, capacities, fitOf, build, mdl };
})();
