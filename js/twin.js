/* ═══ MYO — DIGITAL TWIN: a 3D model of the member, built from their own data, that can be asked and run forward ═══
   Body       · the BodyParts3D skin (19.6k vertices) reshaped to the member: height, BMI, body fat, fat-free mass,
                waist and segmental lean mass from Body composition, band by band (legs and arms about their own axes)
   Systems    · eleven body systems scored from labs, vitals, wearables, body composition and fitness, shown on the
                organs inside the body (heart, brain, lungs, liver, pancreas, kidneys, glands, gut) with the heart
                beating at the member's resting heart rate
   Timeline   · then (first scan) → now → the member's plan at 12 months, morphing the body between them
   What if    · training, cardio, protein, energy balance, sleep and steps → 12-month projection of weight, fat, lean
                mass, waist, VO2max, resting HR and HRV, then the app's own Myo Score and biological-age models are run
                on the projected copy of the member's data
   AI         · a briefing and "ask your twin" through Myo AI (hosted, or Claude's sample capability), with an
                on-device fallback built from the same numbers
   A planning model from the member's data, not a medical prediction: it does not diagnose or forecast disease. */
(function () {
  'use strict';
  const { esc, icon, pill, clamp, dayKey, addDays, fmtDate } = OS;
  const TW = { layer: 'status', t: 0, sel: null, lev: null, busy: false, ai: null, q: '', answer: null, err: '', loading: '' };
  const SYS = [
    { k: 'heart', n: 'Heart and circulation', org: ['heart'], mk: ['apob', 'ldl', 'hdl', 'tg', 'lpa', 'hcy'], extra: ['rhr', 'hrv'] },
    { k: 'fitness', n: 'Lungs and fitness', org: ['lungs'], mk: [], extra: ['vo2'] },
    { k: 'metabolic', n: 'Metabolism', org: ['pancreas'], mk: ['a1c', 'glu', 'ins', 'tg'], extra: ['waist', 'vat'] },
    { k: 'liver', n: 'Liver', org: ['liver'], mk: ['alt'], extra: [] },
    { k: 'kidneys', n: 'Kidneys', org: ['kidneys'], mk: ['egfr'], extra: [] },
    { k: 'brain', n: 'Brain and mood', org: ['brain'], mk: ['b12', 'o3'], extra: ['mood'] },
    { k: 'recovery', n: 'Sleep and recovery', org: [], mk: [], extra: ['sleep', 'readiness'] },
    { k: 'hormones', n: 'Hormones', org: ['pituitary', 'adrenals'], mk: ['tt', 'ft', 'cort', 'tsh', 'ft3'], extra: [] },
    { k: 'inflammation', n: 'Inflammation and immunity', org: ['glands'], mk: ['crp', 'hcy', 'ferr'], extra: [] },
    { k: 'muscle', n: 'Muscle', org: [], mk: [], extra: ['ffmi', 'almi'] },
    { k: 'bone', n: 'Bone and nutrients', org: ['gut'], mk: ['vitd', 'mg', 'b12', 'ferr'], extra: ['tscore'] }
  ];
  const LEVERS = [
    ['strength', 'Strength sessions a week', 0, 5, 1, ''], ['cardio', 'Cardio minutes a week', 0, 400, 10, 'min'], ['protein', 'Protein per kg of body weight', 0.8, 2.4, 0.1, 'g'],
    ['kcal', 'Energy balance: eaten minus burned, a day', -750, 500, 25, 'kcal'], ['sleep', 'Sleep a night', 5, 9, 0.25, 'h'], ['steps', 'Steps a day', 2000, 15000, 500, '']
  ];
  const r1 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10) / 10);
  const f1 = (x, d = 1, u = '') => (x == null || !Number.isFinite(x) ? '—' : `${OS.fmt(x, d)}${u}`);
  const sgn = (x, d = 1, u = '') => (x == null || !Number.isFinite(x) ? '—' : `${x > 0.04 ? '+' : x < -0.04 ? '−' : '±'}${OS.fmt(Math.abs(x), d)}${u}`);
  const tone = (v) => (v == null ? 'muted' : v >= 85 ? 'good' : v >= 65 ? 'warn' : 'bad');
  const toneWord = { good: 'Strong', warn: 'Watch', bad: 'Priority', muted: 'No data' };

  /* ── the member, as numbers ── */
  function baseline(s) {
    const p = s.profile || {}, sex = p.sex === 'F' ? 'F' : 'M', h = +p.heightCm || 175, age = +p.age || 35;
    if (OS.bodycomp && OS.bodycomp.ensure) OS.bodycomp.ensure(s);
    const bc = OS.bodycomp ? (s.bodycomp && s.bodycomp.scans ?s.bodycomp.scans.slice().sort((a, b) => a.d.localeCompare(b.d)) : []) : [];
    const last = bc[bc.length - 1] || null, D = last && OS.bodycomp ? OS.bodycomp.derive(last, h) : null;
    const segScan = [...bc].reverse().find((x) => x.seg && ['la', 'ra', 'll', 'rl'].every((k) => x.seg[k] && x.seg[k].lean != null)) || null;
    const w = (D && D.w) || +p.weightKg || 75;
    const bf = D && D.bf != null ? D.bf : (sex === 'F' ? 28 : 18);
    const L = OS.longevity ? OS.longevity.summary(s, OS.scores(s)) : null, lg = s.longevity || {};
    const looksW = s.looks && s.looks.meas && s.looks.meas.length ? [...s.looks.meas].sort((a, b) => a.d.localeCompare(b.d)).pop().waist : null;
    const vt = s.vitals || {};
    return { sex, h, age, w, bf, bfKnown: !!(D && D.bf != null), ffm: w * (1 - bf / 100), waist: +lg.waist || +looksW || null, vo2: L && L.vo2 ? L.vo2.v : null, vo2src: L && L.vo2 ? L.vo2.src : '',
      rhr: +vt.rhr || null, hrv: +vt.hrv || null, sleep: +vt.sleepH || null, steps: +vt.steps || null, myoAge: L ? L.myoAge : null, seg: segScan ? segScan.seg : null, vat: last && last.vat != null ? +last.vat : null,
      tscore: [...bc].reverse().find((x) => x.t != null)?.t ?? null, first: bc[0] || null, firstD: bc[0] && OS.bodycomp ? OS.bodycomp.derive(bc[0], h) : null };
  }
  function scoreMetric(k, B, sc, s) {
    const age = B.age, F = B.sex === 'F';
    if (k === 'rhr' && B.rhr) return clamp(100 - Math.max(0, B.rhr - 52) * 2.6, 20, 100);
    if (k === 'hrv' && B.hrv) return clamp(40 + (B.hrv / (F ? 45 : 50) - 0.6) * 75, 20, 100);
    if (k === 'vo2' && B.vo2) { const ref = (F ? 38 : 45) - Math.max(0, age - 30) * 0.32; return clamp(70 + (B.vo2 / ref - 1) * 120, 15, 100); }
    if (k === 'waist' && B.waist) { const r = B.waist / B.h; return clamp(100 - Math.max(0, r - 0.45) * 450, 15, 100); }
    if (k === 'vat' && B.vat != null) return clamp(100 - Math.max(0, B.vat - (F ? 0.4 : 0.5)) * 90, 15, 100);
    if (k === 'sleep' && B.sleep) return clamp(100 - Math.abs(B.sleep - 7.75) * 22 - Math.max(0, 7 - B.sleep) * 10, 15, 100);
    if (k === 'readiness' && sc.readiness != null) return sc.readiness;
    if (k === 'ffmi') { const ffmi = B.ffm / (B.h / 100) ** 2; return B.bfKnown ? clamp(60 + (ffmi - (F ? 15 : 18.5)) * 9, 20, 100) : null; }
    if (k === 'almi' && B.seg) { const alm = ['la', 'ra', 'll', 'rl'].reduce((a, x) => a + +B.seg[x].lean, 0) / (B.h / 100) ** 2; return clamp(55 + (alm - (F ? 5.5 : 7)) * 18, 15, 100); }
    if (k === 'tscore' && B.tscore != null) return clamp(80 + B.tscore * 12, 15, 100);
    if (k === 'mood') { const m = Object.values((s.life && s.life.mood) || {}).slice(-7); return m.length ? clamp(m.reduce((a, x) => a + (x.mood || 3) * 2 - (x.stress || 3) + 3, 0) / m.length * 10, 10, 100) : null; }
    return null;
  }
  function systems(s, B) {
    const sc = OS.scores(s), ev = Object.fromEntries(sc.markers.map((x) => [x.m.id, x]));
    return SYS.map((S) => {
      const parts = [];
      S.mk.forEach((id) => { const x = ev[id]; if (x && x.e.score != null) parts.push({ k: x.m.name, v: x.e.score, lab: `${x.m.value} ${x.m.unit || ''}`.trim(), st: x.e.status }); });
      S.extra.forEach((k) => { const v = scoreMetric(k, B, sc, s); if (v != null) parts.push({ k: { rhr: 'Resting heart rate', hrv: 'HRV', vo2: 'VO2max', waist: 'Waist to height', vat: 'Visceral fat', sleep: 'Sleep', readiness: 'Readiness', ffmi: 'Fat-free mass index', almi: 'Limb lean mass', tscore: 'Bone density', mood: 'Mood check-ins' }[k], v: Math.round(v),
        lab: { rhr: B.rhr && `${B.rhr} bpm`, hrv: B.hrv && `${B.hrv} ms`, vo2: B.vo2 && `${r1(B.vo2)} ml/kg/min`, waist: B.waist && `${B.waist} cm`, vat: B.vat != null && `${Math.round(B.vat * 1000)} g`, sleep: B.sleep && `${B.sleep} h`, readiness: sc.readiness != null && `${sc.readiness}`, ffmi: `${r1(B.ffm / (B.h / 100) ** 2)} kg/m²`, almi: '', tscore: B.tscore != null && `T ${B.tscore}`, mood: '' }[k] || '' }); });
      const score = parts.length ? Math.round(parts.reduce((a, p) => a + p.v, 0) / parts.length) : null;
      return { ...S, score, tone: tone(score), parts };
    });
  }
  function completeness(s, B) {
    const W = s.wear || {}, live = ['oura', 'whoop'].some((k) => W[k] && W[k].days && W[k].days.length && W[k].via !== 'sample' && W[k].days.slice(-1)[0].d >= dayKey(addDays(new Date(), -3)));
    const labs = (s.markers || []).filter((m) => OS.hasValue(m)).length, bc = (s.bodycomp && s.bodycomp.scans) || [];
    const items = [['Height, weight, age and sex', !(s.profile && s.profile.unset), 15, 'welcome'], ['A body-composition scan', bc.some((x) => !x.sample), 15, 'bodycomp'], ['Arm, leg and trunk results', bc.some((x) => x.seg && !x.sample), 10, 'bodycomp'],
      ['A DEXA scan', bc.some((x) => x.kind === 'dexa' && !x.sample), 10, 'bodycomp'], ['10 or more lab results', labs >= 10, 20, 'biology'], ['A wearable syncing live', live, 15, 'wearables'], ['A measured VO2max', !!(s.longevity && s.longevity.vo2), 10, 'longevity'], ['Waist measurement', !!B.waist, 5, 'looks']];
    return { items, pct: items.reduce((a, x) => a + (x[1] ? x[2] : 0), 0), live };
  }

  /* ── what if: 12-month projection, then the app's own scores on the projected member ── */
  function defaultLevers(s, B) {
    const P = (s.twin && s.twin.plan) || {};
    return { strength: P.strength ?? Math.min(5, (s.training && s.training.program && s.training.program.perWeek) || 3), cardio: P.cardio ?? 120, protein: P.protein ?? 1.6, kcal: P.kcal ?? 0, sleep: P.sleep ?? clamp(Math.round((B.sleep || 7) * 4) / 4, 5, 9), steps: P.steps ?? clamp(Math.round((B.steps || 7000) / 500) * 500, 2000, 15000) };
  }
  function project(s, B, L) {
    const steps0 = B.steps || 7000, F = B.sex === 'F', floorPct = F ? 15 : 8;
    const trains = L.strength >= 2, prot = L.protein >= 1.6, ffmi0 = B.ffm / (B.h / 100) ** 2;
    // training-driven lean gain over a year (typical gains by sessions, protein, age, sex and how trained already)
    const gainYr = [0, 0.8, 1.6, 2.3, 2.8, 3.1][L.strength] * (L.protein >= 1.6 ? 1 : L.protein >= 1.2 ? 0.75 : 0.45) * (B.age > 60 ? 0.55 : B.age > 45 ? 0.75 : 1) * (F ? 0.6 : 1) * clamp(1.4 - ffmi0 / (F ? 22 : 26), 0.2, 1);
    // month by month: energy balance shrinks as weight changes (about 30 to 38 kcal a day per kg), the Forbes relation splits
    // each kilogram between fat and lean (leaner bodies lose more lean), training and protein protect lean mass,
    // and fat stops at a healthy floor
    let fat = B.w - B.ffm, ffm = B.ffm, w = B.w, floored = false;
    for (let m = 0; m < 12; m++) {
      const bal = L.kcal + (L.kcal < 0 ? 30 : 38) * (B.w - w);   // expenditure follows weight (more so when overfed)
      let pLean = 10.4 / (10.4 + Math.max(1, fat));
      if (bal < 0) pLean *= trains && prot ? 0.35 : trains || prot ? 0.65 : 1; else pLean = Math.min(pLean, 0.3);   // surplus lean comes mostly from training, below
      const rho = pLean * 1800 + (1 - pLean) * 9400, dW = (bal * 30.4) / rho;
      fat += dW * (1 - pLean); ffm += dW * pLean;
      ffm += (gainYr / 12) * (bal < -250 ? 0.5 : bal > 150 ? 1.3 : 1);   // lean gained by training: harder in a deficit, easier in a surplus
      if (L.strength === 0) ffm -= (B.age > 40 ? 0.4 : 0.2) / 12;   // muscle drifts down without loading
      const floorKg = ((ffm / (1 - floorPct / 100)) * floorPct) / 100;
      if (fat < floorKg) { fat = floorKg; floored = true; }
      w = fat + ffm;
    }
    const vo2pct = clamp((L.cardio / 150) * 6, 0, 14) + (L.cardio >= 150 ? 2 : 0) - (L.cardio < 60 ? 1.5 : 0) + (L.steps - steps0) / 4000;
    // absolute VO2max follows lean mass; relative VO2max divides by the new weight; capped at a 25% rise in a year
    const vo2 = B.vo2 ? Math.min(B.vo2 * 1.25, (B.vo2 * B.w * (1 + vo2pct / 100) * Math.pow(ffm / B.ffm, 0.7)) / w) : null;
    const short = Math.max(0, 7 - L.sleep);
    const rhr = B.rhr ? clamp(B.rhr - clamp(vo2pct, -3, 14) * 0.38 + short * 1.5, 38, 110) : null;
    const hrv = B.hrv ? B.hrv * (1 + clamp(vo2pct, -3, 14) * 0.007 + (L.sleep - 7) * 0.04) : null;
    const dFat = fat - (B.w - B.ffm), waist = B.waist ? B.waist + dFat * 0.85 : null;
    // run the app's own engines on a copy of the member with these numbers
    const c = JSON.parse(JSON.stringify(s));
    c.profile.weightKg = Math.round(w * 10) / 10;
    c.vitals = { ...c.vitals, rhr: rhr ? Math.round(rhr) : c.vitals.rhr, hrv: hrv ? Math.round(hrv) : c.vitals.hrv, sleepH: L.sleep, steps: L.steps };
    c.longevity = { ...(c.longevity || {}), vo2: vo2 ? Math.round(vo2 * 10) / 10 : (c.longevity || {}).vo2, waist: waist ? Math.round(waist) : (c.longevity || {}).waist };
    const sc0 = OS.scores(s), sc1 = OS.scores(c), A0 = OS.longevity ? OS.longevity.summary(s, sc0) : null, A1 = OS.longevity ? OS.longevity.summary(c, sc1) : null;
    return { w, ffm, fat, bf: (fat / w) * 100, floored, waist, vo2, rhr, hrv, sleep: L.sleep, mk0: sc0.mk, mk1: sc1.mk, ready0: sc0.readiness, ready1: sc1.readiness, age0: A0 && A0.myoAge, age1: A1 && A1.myoAge };
  }
  function topLevers(s, B, L) {
    const base = project(s, B, L), out = [];
    const tries = [['strength', Math.min(5, L.strength + 2), 'Two more strength sessions a week'], ['cardio', Math.min(400, L.cardio + 90), '90 more cardio minutes a week'], ['protein', Math.min(2.4, Math.max(1.6, L.protein + 0.4)), 'Protein up to ' + f1(Math.min(2.4, Math.max(1.6, L.protein + 0.4)), 1) + ' g/kg'],
      ['sleep', Math.min(9, Math.max(7.5, L.sleep + 0.75)), 'Sleep ' + f1(Math.min(9, Math.max(7.5, L.sleep + 0.75)), 2) + ' h a night'], ['steps', Math.min(15000, L.steps + 3000), '3,000 more steps a day']];
    tries.forEach(([k, v, label]) => { if (v === L[k]) return; const P = project(s, B, { ...L, [k]: v }); const gain = ((P.mk1 ?? 0) - (base.mk1 ?? 0)) + ((base.age1 ?? 0) - (P.age1 ?? 0)) * 3 + ((base.vo2 && P.vo2) ? (P.vo2 - base.vo2) * 0.8 : 0) + (base.bf - P.bf) * 0.6; out.push({ label, gain, P }); });
    return out.sort((a, b) => b.gain - a.gain).slice(0, 3);
  }

  /* ── the 3D body ── */
  const G = { scene: null };
  const FAT_LO = 8, FAT_HI = 40;
  function factors(v) {
    const hm = v.h / 100, bmi = v.w / (hm * hm), fb = Math.sqrt(clamp(bmi / 22.5, 0.55, 2.4)), F = v.sex === 'F';
    const fatAdj = clamp(((v.bf ?? (F ? 28 : 18)) - (F ? 28 : 18)) / 20, -0.5, 1.1), mus = clamp((v.ffm / (hm * hm)) / (F ? 15.5 : 19), 0.75, 1.35);
    let arm = mus, leg = mus;
    if (v.seg) { const a = (+v.seg.la.lean + +v.seg.ra.lean) / 2, l = (+v.seg.ll.lean + +v.seg.rl.lean) / 2, s2 = (hm / 1.75) ** 2; arm = clamp(Math.sqrt(a / ((F ? 2.3 : 3.5) * s2)), 0.75, 1.4); leg = clamp(Math.sqrt(l / ((F ? 7.6 : 10.2) * s2)), 0.75, 1.35); }
    const waist = v.waist ? clamp((v.waist / v.h) / 0.47, 0.7, 1.9) : fb * (1 + 0.2 * fatAdj - 0.05 * (mus - 1));
    return { calf: fb ** 0.6 * (1 + 0.12 * (leg - 1)), thigh: fb * (1 + 0.16 * (leg - 1) + 0.1 * fatAdj), hip: fb * (1 + (F ? 0.16 : 0.1) * fatAdj), waist, chest: fb * (1 + 0.06 * fatAdj + 0.12 * (mus - 1)),
      shoulder: fb ** 0.6 * (1 + 0.16 * (mus - 1)), neck: fb ** 0.5, head: 1, arm: fb ** 0.8 * (1 + 0.28 * (arm - 1) + 0.1 * fatAdj), belly: 1 + 0.16 * Math.max(-0.3, fatAdj), sH: v.h / 100 / 1.718 };
  }
  const ANCH = [[0, 'calf'], [0.12, 'calf'], [0.27, 'knee'], [0.4, 'thigh'], [0.47, 'hip'], [0.53, 'hip'], [0.6, 'waist'], [0.67, 'chest'], [0.75, 'chest'], [0.8, 'shoulder'], [0.85, 'neck'], [0.88, 'head'], [1.01, 'head']];
  function girthAt(F, h) {
    const val = (k) => (k === 'knee' ? (F.calf + F.thigh) / 2 : F[k]);
    for (let i = 0; i < ANCH.length - 1; i++) { const [h0, k0] = ANCH[i], [h1, k1] = ANCH[i + 1]; if (h <= h1) { const t = clamp((h - h0) / (h1 - h0 || 1), 0, 1), e = t * t * (3 - 2 * t); return val(k0) * (1 - e) + val(k1) * e; } }
    return 1;
  }
  // per vertex: height fraction, region (0 torso, 1/2 legs, 3/4 arms), band; per band and region the centroid
  function prep(pos) {
    const n = pos.length / 3, NB = 140; let y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < n; i++) { const y = pos[i * 3 + 1]; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const H = y1 - y0, hh = new Float32Array(n), reg = new Uint8Array(n), band = new Uint16Array(n), sum = new Float64Array(NB * 5 * 3);
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], h = (y - y0) / H, b = Math.min(NB - 1, Math.floor(h * NB));
      const r = h < 0.47 ? (x < 0 ? 1 : 2) : h >= 0.45 && h <= 0.82 && Math.abs(x) > 0.185 ? (x < 0 ? 3 : 4) : 0;
      hh[i] = h; reg[i] = r; band[i] = b; const o = (b * 5 + r) * 3; sum[o] += x; sum[o + 1] += pos[i * 3 + 2]; sum[o + 2]++;
    }
    for (let o = 0; o < sum.length; o += 3) if (sum[o + 2]) { sum[o] /= sum[o + 2]; sum[o + 1] /= sum[o + 2]; }
    return { n, y0, H, hh, reg, band, cen: sum };
  }
  function shapeInto(out, pos, P, F) {
    for (let i = 0; i < P.n; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], h = P.hh[i], r = P.reg[i], o = (P.band[i] * 5 + r) * 3;
      const cx = r === 0 ? 0 : P.cen[o], cz = P.cen[o + 1] || z;
      let f = r >= 3 ? F.arm : girthAt(F, h), fz = f;
      if (r === 0 && h > 0.5 && h < 0.66 && z > cz) fz = f * F.belly;   // the belly carries more of a fat change than the back
      let nx = cx + (x - cx) * f; const nz = cz + (z - cz) * fz;
      if (r >= 3) nx = P.cen[o] * girthAt(F, h) + (x - P.cen[o]) * f;   // arms follow the torso outwards
      out[i * 3] = nx * F.sH; out[i * 3 + 1] = (y - P.y0) * F.sH; out[i * 3 + 2] = nz * F.sH;
    }
  }
  function regionFat(seg, bf) {
    const pc = (k) => (seg && seg[k] && seg[k].fat != null && seg[k].lean != null ? (+seg[k].fat / (+seg[k].fat + +seg[k].lean)) * 100 : bf);
    return { 0: pc('tr'), 1: pc('rl'), 2: pc('ll'), 3: pc('ra'), 4: pc('la') };
  }
  async function buildScene(box, s, B, plan) {
    const T = await OS.Anatomy.three();
    const W = box.clientWidth || 600, H = box.clientHeight || 560;
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(W, H, false);
    const cv = renderer.domElement; cv.className = 'tw-cv'; cv.setAttribute('aria-label', 'Your digital twin in 3D. Drag to turn it, scroll or pinch to zoom.'); box.querySelector('.tw-cvbox').appendChild(cv);
    const scene = new T.Scene(), cam = new T.PerspectiveCamera(32, W / H, 0.01, 20);
    scene.add(new T.HemisphereLight(0xffffff, 0x445566, 1.6)); const dl = new T.DirectionalLight(0xffffff, 1.4); dl.position.set(1.2, 2.5, 2.4); scene.add(dl);
    const dl2 = new T.DirectionalLight(0x99bbff, 0.6); dl2.position.set(-2, 1, -1.5); scene.add(dl2);
    const root = new T.Group(); scene.add(root);
    const st = { T, renderer, scene, cam, root, box, yaw: 0.4, pitch: 0.05, dist: 3.3 * (B.h / 175), tgt: (B.h / 100) * 0.52, raf: 0, alive: true, auto: true, organs: {}, skin: null, t0: performance.now(), rhr: B.rhr || 62, pulse: null };
    G.scene = st; startLoop(st);
    const setLoad = (t) => { TW.loading = t; const el = box.querySelector('.tw-load'); if (el) { el.hidden = !t; el.textContent = t; } };
    // skin, reshaped
    setLoad('Shaping your body…');
    const skin = await OS.Anatomy.load('skin'); if (!st.alive) return st;
    const base = skin.g.attributes.position.array, P = prep(base);
    const geo = new T.BufferGeometry(); const pos = new Float32Array(base.length); const col = new Float32Array(base.length);
    geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3)); geo.setIndex(skin.g.index);
    const shapes = { now: new Float32Array(base.length), then: null, plan: new Float32Array(base.length) };
    const vNow = { h: B.h, w: B.w, bf: B.bf, ffm: B.ffm, waist: B.waist, sex: B.sex, seg: B.seg };
    shapeInto(shapes.now, base, P, factors(vNow));
    if (B.firstD && B.firstD.w && B.first && B.first.d < dayKey(addDays(new Date(), -21))) { shapes.then = new Float32Array(base.length); shapeInto(shapes.then, base, P, factors({ ...vNow, w: B.firstD.w, bf: B.firstD.bf ?? B.bf, ffm: B.firstD.ffm ?? B.ffm, waist: null, seg: B.first.seg && B.first.seg.la ? B.first.seg : B.seg })); }
    st.reshapePlan = (pl) => { shapeInto(shapes.plan, base, P, factors({ ...vNow, w: pl.w, bf: pl.bf, ffm: pl.ffm, waist: pl.waist })); st.morph(TW.t); };
    st.shapes = shapes; st.P = P;
    // the source skin's triangles are wound inconsistently, so lighting must not depend on winding:
    // solid layers use flat shading (each face lit by its own screen-space normal) on both sides, and the
    // see-through layer is an edge-glow shader that uses the same derivative normal
    const solidMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.02, flatShading: true, side: T.DoubleSide });
    const glassMat = new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, uniforms: { uC: { value: new T.Color(0x6f86b5) }, uA: { value: 0.55 } },
      vertexShader: 'varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec3 vV; void main(){ vec3 n = normalize(cross(dFdx(vV), dFdy(vV))); float f = 1.0 - abs(dot(n, normalize(vV))); gl_FragColor = vec4(uC * (0.55 + 0.9 * f), uA * (0.08 + 0.92 * pow(f, 2.2))); }' });
    const skinMat = solidMat;
    const mesh = new T.Mesh(geo, glassMat); mesh.renderOrder = 2; root.add(mesh); st.skin = mesh;
    st.morph = (t) => {
      const a = t < 0 ? (shapes.then || shapes.now) : shapes.now, b = t < 0 ? shapes.now : shapes.plan, k = t < 0 ? 1 + t : t;
      for (let i = 0; i < pos.length; i++) pos[i] = a[i] + (b[i] - a[i]) * k;
      geo.attributes.position.needsUpdate = true; geo.computeBoundingSphere();
    };
    st.paint = () => {
      // one hue, light to dark: a sequential scale for a single measure (fat share by region)
      const fat = regionFat(B.seg, B.bf), base1 = [0.83, 0.66, 0.56], lo = [0.97, 0.9, 0.84], hi = [0.8, 0.27, 0.07];
      for (let i = 0; i < P.n; i++) {
        let c = base1;
        if (TW.layer === 'fat') { const f = clamp((fat[P.reg[i]] - FAT_LO) / (FAT_HI - FAT_LO), 0, 1); c = [lo[0] + (hi[0] - lo[0]) * f, lo[1] + (hi[1] - lo[1]) * f, lo[2] + (hi[2] - lo[2]) * f]; }
        col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
      }
      geo.attributes.color.needsUpdate = true;
      const see = TW.layer === 'status'; mesh.material = see ? glassMat : solidMat; void skinMat;
      Object.values(st.organs).forEach((m) => { m.visible = TW.layer === 'status'; });
    };
    st.reshapePlan(plan); st.paint();
    // organs from the anatomy packs, coloured by the member's system status
    const statusOf = {}; systems(s, B).forEach((x) => x.org.forEach((o) => { statusOf[o] = x; }));
    const COL = { good: 0x1baf7a, warn: 0xe8a33a, bad: 0xe0503f, muted: 0x8c97a8 };
    const want = [['cardiovascular', ['heart']], ['respiratory', ['lungs']], ['digestive', ['liver', 'pancreas', 'gut']], ['urinary', ['kidneys']], ['endocrine', ['adrenals', 'pituitary', 'glands']], ['nervous', ['brain']]];
    const F0 = factors(vNow), sx = F0.sH * clamp(Math.sqrt(F0.waist), 0.9, 1.12);
    for (const [sys, keys] of want) {
      setLoad('Placing your organs…');
      let pack; try { pack = await OS.Anatomy.load(sys); } catch { continue; }
      if (!st.alive) return st;
      for (const k of keys) {
        const tris = []; pack.ranges.forEach((rg) => { if (rg.org === k) for (let t = rg.t0; t < rg.t0 + rg.tn; t++) tris.push(pack.idx[t * 3], pack.idx[t * 3 + 1], pack.idx[t * 3 + 2]); });
        if (!tris.length) continue;
        const g = new T.BufferGeometry(); g.setAttribute('position', pack.g.attributes.position); g.setAttribute('normal', pack.g.attributes.normal); g.setIndex(tris);
        const S = statusOf[k] || { tone: 'muted' };
        const m = new T.Mesh(g, new T.MeshStandardMaterial({ color: COL[S.tone], roughness: 0.45, metalness: 0.05, emissive: COL[S.tone], emissiveIntensity: 0.18, side: T.DoubleSide }));
        m.userData = { k, sys: S.k }; m.scale.set(sx, F0.sH, sx); m.position.y = -P.y0 * F0.sH; m.renderOrder = 1;
        if (k === 'heart') {
          const pa = pack.g.attributes.position.array, c = [0, 0, 0]; for (let i = 0; i < tris.length; i++) { c[0] += pa[tris[i] * 3]; c[1] += pa[tris[i] * 3 + 1]; c[2] += pa[tris[i] * 3 + 2]; } c[0] /= tris.length; c[1] /= tris.length; c[2] /= tris.length;
          const beat = new T.Group(); beat.position.set(c[0] * sx, (c[1] - P.y0) * F0.sH, c[2] * sx); m.position.set(-c[0] * sx, -c[1] * F0.sH, -c[2] * sx);
          beat.add(m); root.add(beat); st.pulse = beat;
        } else root.add(m);
        st.organs[k] = m;
      }
    }
    setLoad(''); st.paint(); st.highlight(TW.sel);
    return st;
  }
  function startLoop(st) {
    const T = st.T, ray = new T.Raycaster(), ndc = new T.Vector2();
    let drag = null;
    const cv = st.renderer.domElement;
    cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, yaw: st.yaw, pitch: st.pitch, moved: false }; st.auto = false; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true; st.yaw = drag.yaw - dx * 0.008; st.pitch = clamp(drag.pitch + dy * 0.004, -0.5, 0.6); });
    cv.addEventListener('pointerup', (e) => {
      if (drag && !drag.moved && TW.layer === 'status') {
        const r = cv.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, st.cam);
        const hit = ray.intersectObjects(Object.values(st.organs).filter((m) => m.visible), false)[0];
        if (hit) { TW.sel = hit.object.userData.sys; OS.render(); }
      }
      drag = null;
    });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); st.dist = clamp(st.dist * (1 + Math.sign(e.deltaY) * 0.08), 1.2, 6); }, { passive: false });
    const ro = new ResizeObserver(() => { const w = st.box.clientWidth, h = st.box.clientHeight; if (!w || !h) return; st.renderer.setSize(w, h, false); st.cam.aspect = w / h; st.cam.updateProjectionMatrix(); });
    ro.observe(st.box); st.ro = ro;
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frame = (now) => {
      if (!st.alive) return;
      if (st.auto && !reduce) st.yaw += 0.0025;
      const ty = st.tgt;
      st.cam.position.set(Math.sin(st.yaw) * Math.cos(st.pitch) * st.dist, ty + Math.sin(st.pitch) * st.dist, Math.cos(st.yaw) * Math.cos(st.pitch) * st.dist); st.cam.lookAt(0, ty, 0);
      if (st.pulse && !reduce) { const per = 60 / st.rhr, ph = ((now - st.t0) / 1000 % per) / per, beat = Math.exp(-(((ph - 0.08) / 0.05) ** 2)) * 0.09 + Math.exp(-(((ph - 0.3) / 0.06) ** 2)) * 0.04; st.pulse.scale.setScalar(1 + beat); }
      st.renderer.render(st.scene, st.cam);
      st.raf = requestAnimationFrame(frame);
    };
    st.raf = requestAnimationFrame(frame);
    st.highlight = (sys) => { Object.values(st.organs).forEach((m) => { const on = !sys || m.userData.sys === sys; m.material.emissiveIntensity = sys && on ? 0.55 : 0.18; m.material.opacity = on ? 1 : 0.25; m.material.transparent = !on; }); };
  }
  function teardown() {
    const st = G.scene; if (!st) return;
    st.alive = false; cancelAnimationFrame(st.raf); if (st.ro) st.ro.disconnect();
    try { st.renderer.dispose(); st.root.traverse((o) => { if (o.material) o.material.dispose(); if (o.geometry && o !== st.skin) { /* shared anatomy attributes stay cached */ } }); if (st.skin) st.skin.geometry.dispose(); } catch { /* already gone */ }
    G.scene = null;
  }

  /* ── page ── */
  function aiFallback(s, B, sys, P, tops) {
    const sorted = sys.filter((x) => x.score != null).sort((a, b) => b.score - a.score), best = sorted.slice(0, 2), worst = sorted.slice(-2).reverse();
    return [`## Your twin today`,
      best.length ? `- Strongest: **${best.map((x) => `${x.n} (${x.score})`).join('**, **')}**` : '- Add labs, a scan or a wearable to score your systems.',
      worst.length ? `- Most room to improve: **${worst.map((x) => `${x.n} (${x.score})`).join('**, **')}**` : '',
      `### Your plan at 12 months`,
      `- Weight ${f1(B.w)} → **${f1(P.w)} kg**, body fat ${f1(B.bf)} → **${f1(P.bf)}%**, fat-free mass ${sgn(P.ffm - B.ffm, 1, ' kg')}`,
      P.vo2 && B.vo2 ? `- VO2max ${f1(B.vo2)} → **${f1(P.vo2)} ml/kg/min**${P.rhr ? `, resting heart rate about **${Math.round(P.rhr)} bpm**` : ''}` : '',
      P.mk1 != null ? `- Myo Score ${P.mk0} → **${P.mk1}**${P.age1 != null && P.age0 != null ? `, biological age ${f1(P.age0)} → **${f1(P.age1)}**` : ''}` : '',
      tops.length ? `### Biggest levers for you\n${tops.map((t) => `- ${t.label}`).join('\n')}` : ''].filter(Boolean).join('\n');
  }
  function projTiles(B, P) {
    const tile = (l, a, b, u, d = 1, better = -1) => { const dv = a != null && b != null ? b - a : null; const cls = dv == null || Math.abs(dv) < 0.05 || !better ? '' : dv * better > 0 ? 'up' : 'down'; return `<div><span>${l}</span><b class="num">${f1(b, d)}</b><em>${u}</em><i class="tw-d ${cls}">${dv == null ? 'now ' + f1(a, d) : `${sgn(dv, d)} from ${f1(a, d)}`}</i></div>`; };
    return `${tile('Weight', B.w, P.w, 'kg', 1, 0)}${tile('Body fat', B.bf, P.bf, '%', 1, -1)}${tile('Fat-free mass', B.ffm, P.ffm, 'kg', 1, 1)}${B.waist ? tile('Waist', B.waist, P.waist, 'cm', 0, -1) : ''}${B.vo2 ? tile('VO2max', B.vo2, P.vo2, 'ml/kg/min', 1, 1) : ''}${B.rhr ? tile('Resting HR', B.rhr, P.rhr, 'bpm', 0, -1) : ''}${B.hrv ? tile('HRV', B.hrv, P.hrv, 'ms', 0, 1) : ''}${P.mk0 != null ? tile('Myo Score', P.mk0, P.mk1, '', 0, 1) : ''}${P.age0 != null ? tile('Biological age', P.age0, P.age1, 'years', 1, -1) : ''}`;
  }
  const dec = (st) => (st >= 1 ? 0 : st === 0.25 ? 2 : 1);
  OS.register('twin', {
    title: 'Digital twin', icon: 'twin',
    render(s) {
      const B = baseline(s), sys = systems(s, B), C = completeness(s, B);
      if (!TW.lev) TW.lev = defaultLevers(s, B);
      const L = TW.lev, P = project(s, B, L), sel = sys.find((x) => x.k === TW.sel);
      const hasThen = !!(B.first && B.firstD && B.first.d < dayKey(addDays(new Date(), -21)));
      const md = (t) => (OS.athlete && OS.athlete.mdl ? OS.athlete.mdl(t) : `<p>${esc(t)}</p>`);
      return `${OS.ui.head('AI digital twin · built from your data', 'Digital twin', 'A 3D model of you, shaped by your measurements and scored by your labs, scans and wearables. Ask it questions, and run your plan forward 12 months before you live it.',
        `<div class="hstat"><span>Twin built</span><b class="num">${C.pct}%</b></div><div class="hstat"><span>Myo Score</span><b class="num">${OS.dash(P.mk0)}</b></div><div class="hstat"><span>Biological age</span><b class="num">${P.age0 != null ? f1(P.age0) : '—'}</b></div>`)}
      <div class="tw">
        <div class="tw-main">
          <section class="card tw-stage"><div class="card-h"><h2>You, in 3D</h2><div class="seg" role="group" aria-label="Layer">${[['status', 'Systems'], ['fat', 'Fat map'], ['body', 'Body']].map(([k, l]) => `<button class="${TW.layer === k ? 'on' : ''}" data-act="tw-layer" data-k="${k}" aria-pressed="${TW.layer === k}">${l}</button>`).join('')}</div></div>
            <div class="tw-3d"><div class="tw-cvbox"></div><p class="tw-load" role="status">${esc(TW.loading || 'Loading your twin…')}</p>
              ${B.rhr ? `<p class="tw-live"><span class="wv-dot ${C.live ? 'on' : ''}" aria-hidden="true"></span>Heart beating at ${Math.round(B.rhr)} bpm${C.live ? ', live from your wearable' : ''}</p>` : ''}</div>
            <div class="tw-time"><label for="tw-t">Timeline</label><input id="tw-t" type="range" min="${hasThen ? -1 : 0}" max="1" step="0.01" value="${TW.t}" aria-valuetext="${TW.t < -0.5 ? 'Then' : TW.t > 0.5 ? 'Plan in 12 months' : 'Now'}">
              <div class="tw-ticks"><span>${hasThen ? `Then · ${esc(fmtDate(B.first.d))}` : ''}</span><span>Now</span><span>Your plan · 12 months</span></div></div>
            ${TW.layer === 'fat' ? (() => { const F = regionFat(B.seg, B.bf); return `<div class="tw-legend"><span>${FAT_LO}% fat</span><i aria-hidden="true"></i><span>${FAT_HI}%+</span></div><p class="small">${B.seg ? `Trunk ${f1(F[0], 0)}% · arms ${f1((F[3] + F[4]) / 2, 0)}% · legs ${f1((F[1] + F[2]) / 2, 0)}%` : `Whole body ${f1(B.bf, 0)}%`}</p>`; })() : ''}
            <p class="fine">${TW.layer === 'fat' ? 'Darker orange means a higher fat share in that region' + (B.seg ? ', from your segmental scan.' : ', from your overall body fat.') : TW.layer === 'status' ? 'Organs are coloured by how that system scores: green strong, amber watch, red priority, grey no data. Tap an organ or a system.' : 'Shape from your height, weight, body fat, fat-free mass' + (B.waist ? ', waist' : '') + (B.seg ? ' and arm and leg lean mass' : '') + '.'} The body is an estimate of your shape, not a scan.</p></section>
          <section class="card"><div class="card-h"><h2>Body systems</h2><span class="muted small">Like a check-up board, from your own data</span></div>
            <ul class="tw-sys">${sys.map((x) => `<li><button class="tw-row ${TW.sel === x.k ? 'on' : ''}" data-act="tw-sel" data-k="${x.k}" aria-pressed="${TW.sel === x.k}"><b>${esc(x.n)}</b><span class="tw-bar"><i class="${x.tone}" style="width:${x.score ?? 0}%"></i></span><span class="tw-num num">${x.score ?? '—'}</span>${pill(x.tone, toneWord[x.tone])}</button></li>`).join('')}</ul>
            ${sel ? `<div class="tw-detail"><h3>${esc(sel.n)}</h3>${sel.parts.length ? `<ul class="small">${sel.parts.map((p) => `<li><span>${esc(p.k)}</span><b class="num">${esc(p.lab || '')}</b>${pill(tone(p.v), String(Math.round(p.v)))}</li>`).join('')}</ul>` : '<p class="small muted">No data for this system yet.</p>'}</div>` : ''}</section>
        </div>
        <section class="card"><div class="card-h"><h2>What if: run your plan forward</h2><span class="muted small">12 months</span></div>
          <div class="tw-whatif"><div class="tw-levers">${LEVERS.map(([k, l, mn, mx, st, u]) => `<label><span>${l} <b class="num" id="tw-v-${k}">${k === 'kcal' ? sgn(L[k], 0) : f1(L[k], dec(st))}</b> ${u}</span><input type="range" min="${mn}" max="${mx}" step="${st}" value="${L[k]}" data-lever="${k}"></label>`).join('')}
            <div class="st-go"><button class="btn sm" data-act="tw-plan">${icon('check', 14)} Make this my plan</button><button class="btn ghost sm" data-act="tw-reset">Reset</button></div></div>
            <div><div class="lb-tiles tw-proj" id="tw-proj">${projTiles(B, P)}</div><p class="small tw-floor" id="tw-floor" ${P.floored ? '' : 'hidden'}>This plan reaches very low body fat, which is hard to sustain and can disrupt hormones, bone and mood. The projection stops at a healthy floor (${B.sex === 'F' ? 15 : 8}%).</p></div></div>
          <p class="fine">Planning estimates from published averages: energy balance with expenditure adapting as weight changes, the Forbes relation for how weight change splits between fat and lean, typical strength-training gains by age and sex, and VO2max responses to weekly cardio. Myo Score and biological age come from the app's own models run on your projected numbers. Bodies vary widely; retest to see your real response.${B.bfKnown ? '' : ' Add a body-composition scan for a sharper projection.'}</p></section>
        <div class="grid g-2">
          <section class="card myo-plan"><div class="card-h"><h2>Ask your twin</h2><span class="chip chip-ai">AI</span></div>
            ${TW.ai ? `<div class="md">${md(TW.ai.text)}</div><p class="fine">Written ${esc(new Date(TW.ai.at).toLocaleString())}${TW.ai.offline ? ' on this device' : ' by Myo AI'}.</p>` : '<p class="small muted">Myo reads your twin: every system score, your data sources and your plan, then explains what is driving your numbers and what to change first.</p>'}
            <div class="st-go"><button class="btn" data-act="tw-brief" ${TW.busy ? 'disabled' : ''}>${icon('coach', 15)} ${TW.busy === 'brief' ? 'Reading your twin…' : 'Brief me'}</button></div>
            <form class="tw-ask" data-submit="tw-ask"><label for="tw-q" class="sr">Ask your twin</label><input id="tw-q" name="q" maxlength="300" placeholder="e.g. What would three more strength sessions a week change?" value="${esc(TW.q)}"><button class="btn sm" ${TW.busy ? 'disabled' : ''}>Ask</button></form>
            ${TW.answer ? `<div class="md tw-answer">${md(TW.answer)}</div>` : ''}${TW.err ? `<p class="small">${esc(TW.err)}</p>` : ''}</section>
          <section class="card"><div class="card-h"><h2>What your twin is built from</h2><span class="muted small">${C.pct}% complete</span></div>
            <ul class="tw-src">${C.items.map(([l, ok, w, go]) => `<li class="${ok ? 'ok' : ''}">${icon(ok ? 'check' : 'plus', 14)}<span>${esc(l)}</span><a class="link small" href="#${go}">${ok ? 'View' : 'Add'}</a></li>`).join('')}</ul>
            <p class="fine">More sources make the twin sharper. Each source stays where it is; the twin reads them on this device.</p></section></div>
        <p class="fine">Your twin is a planning model built from your own data for wellness. It does not diagnose, and it does not predict disease or lifespan. Talk to your clinician about any result that worries you.</p>
      </div>`;
    },
    mount(root, s) {
      const box = root.querySelector('.tw-3d'); if (!box) return;
      const B = baseline(s), P = project(s, B, TW.lev);
      let st = null, dead = false;
      buildScene(box, s, B, P).then((x) => { if (dead || !x) return; st = x; }).catch((e) => { const el = box.querySelector('.tw-load'); if (el) { el.hidden = false; el.textContent = `3D needs WebGL and the anatomy files: ${e.message || e}`; } });
      // the timeline morphs the body; levers update the projection and the plan shape as they move
      const t = root.querySelector('#tw-t');
      if (t) t.addEventListener('input', () => { TW.t = +t.value; if (G.scene && G.scene.morph) G.scene.morph(TW.t); t.setAttribute('aria-valuetext', TW.t < -0.5 ? 'Then' : TW.t > 0.5 ? 'Plan in 12 months' : 'Now'); });
      let pend = 0;
      root.querySelectorAll('[data-lever]').forEach((inp) => inp.addEventListener('input', () => {
        const k = inp.dataset.lever; TW.lev[k] = +inp.value;
        const lab = root.querySelector('#tw-v-' + k); if (lab) lab.textContent = k === 'kcal' ? sgn(+inp.value, 0) : f1(+inp.value, dec(+inp.step));
        clearTimeout(pend); pend = setTimeout(() => {
          const P2 = project(OS.state, B, TW.lev); if (G.scene && G.scene.reshapePlan) G.scene.reshapePlan(P2);
          const box2 = root.querySelector('#tw-proj'); if (box2) box2.innerHTML = projTiles(B, P2); const fl = root.querySelector('#tw-floor'); if (fl) fl.hidden = !P2.floored;
        }, 120);
      }));
      return () => { dead = true; teardown(); };
    }
  });

  OS.act('tw-layer', (el) => { TW.layer = el.dataset.k; OS.render(); });
  OS.act('tw-sel', (el) => { TW.sel = TW.sel === el.dataset.k ? null : el.dataset.k; OS.render(); });
  OS.twinHighlight = (k) => { if (G.scene && G.scene.highlight) G.scene.highlight(k); };
  OS.act('tw-plan', () => { const L = { ...TW.lev }; OS.update((s) => { s.twin = { ...(s.twin || {}), plan: L, planAt: new Date().toISOString() }; }, { render: false }); OS.toast('Saved as your plan. The timeline now runs to it.'); OS.logEvent('note', 'Twin plan saved', `${L.strength} strength sessions, ${L.cardio} cardio min a week, ${L.protein} g/kg protein, ${L.kcal} kcal a day, ${L.sleep} h sleep, ${L.steps} steps`, { go: 'twin' }); });
  OS.act('tw-reset', () => { TW.lev = null; OS.update((s) => { if (s.twin) delete s.twin.plan; }, { render: false }); OS.render(); });
  async function askAI(kind, question) {
    const s = OS.state, B = baseline(s), sys = systems(s, B), L = TW.lev || defaultLevers(s, B), P = project(s, B, L), tops = topLevers(s, B, L), C = completeness(s, B);
    const data = { profile: { age: B.age, sex: B.sex, heightCm: B.h }, now: { weightKg: r1(B.w), bodyFatPct: r1(B.bf), fatFreeKg: r1(B.ffm), waistCm: B.waist, vo2max: r1(B.vo2), restingHr: B.rhr, hrv: B.hrv, sleepH: B.sleep, myoScore: P.mk0, biologicalAge: r1(P.age0) },
      systems: sys.map((x) => ({ system: x.n, score: x.score, evidence: x.parts.map((p) => `${p.k} ${p.lab}`.trim()) })), plan: L, at12Months: { weightKg: r1(P.w), bodyFatPct: r1(P.bf), fatFreeKg: r1(P.ffm), vo2max: r1(P.vo2), restingHr: P.rhr && Math.round(P.rhr), myoScore: P.mk1, biologicalAge: r1(P.age1) },
      biggestLevers: tops.map((t) => t.label), dataCompleteness: C.pct, sampleData: !!s.sample };
    const sample = OS.caps && OS.caps.sample;
    const fallback = () => aiFallback(s, B, sys, P, tops);
    if (!sample) return { text: kind === 'brief' ? fallback() : `${fallback()}\n\n*Myo AI is not available here, so this is the on-device read of your twin. For your question, use What if above to test it.*`, offline: true };
    const prompt = kind === 'brief'
      ? `You are Myo, the physiologist inside the Myo app. This is the member's digital twin: system scores built from their labs, scans and wearables, and a 12-month projection of their current plan. Write a briefing: what is strongest, what is driving the weakest systems (cite the evidence given), and the three changes with the biggest effect for this person, with measurable targets. If sampleData is true, say so in one line. Markdown with "##"/"###" headings and "-" bullets, under 280 words. Wellness guidance only: no diagnosis, no medication or hormone dosing; for any red-flag value, advise seeing a clinician.\nTwin (JSON): ${JSON.stringify(data)}`
      : `You are Myo, the physiologist inside the Myo app. Answer the member's question using their digital twin below. Be specific to their numbers; when the question is a "what if", reason from the projection model (energy balance, training response, VO2max response) and say what would change and roughly how much in 12 months. Markdown, under 220 words. Wellness guidance only: no diagnosis, no medication or hormone dosing, no surgical advice.\nQuestion: ${question}\nTwin (JSON): ${JSON.stringify(data)}`;
    try { const r = await sample(prompt, { cache: false, modelTier: 'complex' }); return { text: (r.text || '').trim() || fallback(), offline: !(r.text || '').trim() }; }
    catch (e) { if (e && e.code === 'not_granted') OS.caps.sample = null; return { text: fallback() + '\n\n*Myo AI could not answer just now, so this is the on-device read.*', offline: true }; }
  }
  OS.act('tw-brief', async () => { if (TW.busy) return; TW.busy = 'brief'; OS.render(); const r = await askAI('brief'); TW.ai = { ...r, at: new Date().toISOString() }; TW.busy = false; OS.render(); });
  OS.act('tw-ask', async (form) => { const q = (form.elements.q.value || '').trim(); if (!q || TW.busy) return; TW.q = q; TW.busy = 'ask'; TW.err = ''; OS.render(); const r = await askAI('ask', q); TW.answer = r.text; TW.busy = false; OS.render(); });

  OS.twin = { baseline, systems, completeness, project, topLevers, factors, prep, shapeInto, state: TW };
})();
