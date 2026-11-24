/* ═══ MYO — LOOKS: a visual engineering build process for physique, skin, face and procedures ═══
   Pipeline: Baseline → Target → Blueprint → Skin → Face & grooming → Procedures → Progress.
   · Baseline: tape measurements → body-fat estimate (US Navy or RFM), lean mass, FFMI, proportion ratios
   · Target: six physique builds with sex-specific body-fat and shoulder:waist ranges
   · Blueprint: now-vs-target engineering drawing (widths to scale), 12-month projection from typical rates,
     phase timeline (cut / build / refine) with calories, protein and per-muscle weekly sets, 3D muscle emphasis
   · Skin: Fitzpatrick type, skin type and concerns → evidence-graded AM/PM routine; even tone, never lightening
   · Face & grooming: non-surgical levers, plus myths and harmful trends called out
   · Procedures: injectables, lasers, implants and surgery with downtime, longevity, cost tier and risks;
     dangerous practices; a consult checklist; a self-check for appearance distress before booking anything
   · Progress: on-device photos (shared with Body Scan) in a before/after slider, measurement trends
   Myo never rates faces or bodies, never doses prescription drugs or hormones, and keeps photos on this device. */
(function () {
  'use strict';
  const { esc, icon, pill, dayKey, clamp } = OS;

  const MUS = { delts: 'Shoulders', back: 'Back and lats', chest: 'Chest', biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms', core: 'Abs', obliques: 'Obliques', quads: 'Quads', adductors: 'Inner thighs', calves: 'Calves', rotator: 'Rotator cuff', glutes: 'Glutes', hamstrings: 'Hamstrings', neck: 'Neck and traps', tibialis: 'Shins' };
  const ALL_MUS = ['delts', 'back', 'chest', 'biceps', 'triceps', 'core', 'quads', 'glutes', 'hamstrings', 'calves', 'neck'];
  // t: shape template relative to waist = 1 (chest, hips, thigh, calf, neck) for the mini drawings
  const ARCH = [
    { k: 'vtaper', name: 'V-taper', line: 'Wide shoulders and back over a narrow waist.', hi: ['delts', 'back', 'chest'], hi2: ['rotator', 'biceps', 'triceps', 'core'], bf: { M: [10, 13], F: [18, 22] }, swr: { M: [1.55, 1.65], F: [1.4, 1.5] }, view: 'torso', t: [1.25, 1.08, 0.66, 0.44, 0.48] },
    { k: 'athletic', name: 'Athletic all-rounder', line: 'Balanced muscle head to toe, ready for any sport.', hi: ['delts', 'back', 'quads', 'glutes'], hi2: ['chest', 'hamstrings', 'core', 'calves'], bf: { M: [12, 15], F: [20, 24] }, swr: { M: [1.45, 1.55], F: [1.35, 1.45] }, view: 'torso', t: [1.2, 1.12, 0.72, 0.46, 0.48] },
    { k: 'lean', name: 'Lean line', line: 'Long, light and defined, like a swimmer or dancer.', hi: ['back', 'delts', 'core'], hi2: ['obliques', 'calves', 'glutes'], bf: { M: [9, 12], F: [17, 21] }, swr: { M: [1.45, 1.55], F: [1.35, 1.45] }, view: 'torso', t: [1.15, 1.06, 0.62, 0.42, 0.45] },
    { k: 'power', name: 'Power build', line: 'Dense and strong: thick back, legs and traps.', hi: ['back', 'quads', 'glutes', 'hamstrings'], hi2: ['chest', 'neck', 'forearms', 'delts'], bf: { M: [15, 20], F: [22, 28] }, swr: { M: [1.4, 1.5], F: [1.3, 1.4] }, view: 'legs', t: [1.22, 1.16, 0.8, 0.5, 0.54] },
    { k: 'xframe', name: 'X-frame', line: 'Shoulders and hips wide, waist narrow: an hourglass build.', hi: ['glutes', 'delts', 'back', 'hamstrings'], hi2: ['quads', 'adductors', 'core'], bf: { M: [11, 14], F: [20, 25] }, swr: { M: [1.5, 1.6], F: [1.4, 1.5] }, view: 'legs', t: [1.18, 1.25, 0.78, 0.47, 0.46] },
    { k: 'classic', name: 'Classic proportion', line: 'Old-school symmetry: arms, calves and neck in proportion.', hi: ['delts', 'chest', 'biceps', 'triceps', 'calves'], hi2: ['back', 'neck', 'quads'], bf: { M: [10, 12], F: [18, 21] }, swr: { M: [1.55, 1.62], F: [1.4, 1.48] }, view: 'torso', t: [1.28, 1.1, 0.7, 0.5, 0.5] }
  ];
  const TAGE = ['Under 1 year', '1–3 years', '3+ years'];
  const GAIN = { M: [5, 2.5, 1], F: [2.5, 1.25, 0.5] }; // typical lean kg per year by training age

  const FITZ = [['I', 'Always burns, never tans', '#f3d9c6'], ['II', 'Usually burns, tans a little', '#e6bd9c'], ['III', 'Sometimes burns, tans gradually', '#cf9c74'], ['IV', 'Rarely burns, tans easily', '#a9744b'], ['V', 'Very rarely burns', '#7a4e2e'], ['VI', 'Never burns, deeply pigmented', '#47291a']];
  const STYPE = [['oily', 'Oily'], ['combo', 'Combination'], ['normal', 'Normal'], ['dry', 'Dry'], ['sensitive', 'Sensitive']];
  const CONC = [['acne', 'Breakouts'], ['marks', 'Dark marks after spots, uneven tone'], ['melasma', 'Melasma (patchy brown areas)'], ['aging', 'Fine lines and sun damage'], ['texture', 'Texture, pores, acne scars'], ['redness', 'Redness or flushing'], ['dry', 'Dry, tight or irritated'], ['bumps', 'Razor bumps, ingrown hairs'], ['kp', 'Rough bumps on arms (KP)'], ['circles', 'Dark circles'], ['hair', 'Thinning scalp hair']];
  const ACT = {
    spf: ['Broad-spectrum sunscreen SPF 30+', 'A', 'Prevents burning, dark marks, melasma flares and photoaging. The base of every routine.', 'Every morning, two finger-lengths for face and neck; reapply every 2 hours outdoors.'],
    tint: ['Tinted mineral sunscreen with iron oxides', 'B', 'Also blocks visible light, which drives melasma and dark marks, especially in deeper skin tones.', 'Every morning in place of plain sunscreen.'],
    clean: ['Gentle, non-foaming cleanser', 'B', 'Cleans without stripping the skin barrier.', 'Evening always; morning a rinse is enough for dry skin.'],
    moist: ['Moisturiser with ceramides', 'B', 'Repairs the barrier and cuts irritation from active ingredients.', 'Morning and evening.'],
    adap: ['Adapalene 0.1% gel (over-the-counter retinoid)', 'A', 'Clears and prevents breakouts, smooths texture, fades marks and treats sun damage.', 'Evening, a pea-sized amount for the whole face; start 2–3 nights a week and build up. Not during pregnancy.'],
    bpo: ['Benzoyl peroxide 2.5–5% wash', 'A', 'Kills acne bacteria with no resistance; works on face, chest and back.', 'Leave on 1–2 minutes, then rinse. It bleaches towels.'],
    aza: ['Azelaic acid 10–20%', 'A', 'Treats breakouts, redness and dark marks; gentle on sensitive skin and deeper skin tones, and pregnancy-safe.', 'Once or twice a day.'],
    nia: ['Niacinamide 4–5%', 'B', 'Evens tone, calms redness, reduces oil and supports the barrier.', 'Morning or evening.'],
    vitc: ['Vitamin C serum', 'B', 'Antioxidant under sunscreen; brightens and evens tone.', 'Morning, before sunscreen.'],
    txa: ['Tranexamic acid serum', 'B', 'Fades melasma and stubborn dark marks.', 'Once or twice a day.'],
    sal: ['Salicylic acid 0.5–2%', 'B', 'Unclogs pores; helps blackheads and razor bumps.', 'Evening, a few times a week; not on retinoid nights at first.'],
    urea: ['Urea 10% or lactic acid body lotion', 'B', 'Smooths rough bumps (KP) and dry body skin.', 'Daily after showering.'],
    minox: ['Minoxidil 5% foam (over the counter)', 'A', 'Slows pattern hair loss and regrows some hair.', 'As labelled. Takes 4–6 months, works only while used, and early shedding is normal.'],
    shave: ['Shave or trim technique', 'B', 'Cuts razor bumps, which are most common with curly or coily hair.', 'Single blade, with the grain, no skin stretching; or trim to 1 mm. Laser hair removal is the long-term fix.'],
    eyes: ['Sleep, cold compress and allergy control', 'C', 'Reduce puffiness and some dark circles; pigment-type circles also respond to sunscreen and azelaic acid.', 'Daily.']
  };
  const DERM_RX = ['Prescription retinoids (tretinoin, tazarotene)', 'Antibiotics or isotretinoin for severe or scarring acne', 'Spironolactone for hormonal acne in women', 'Hydroquinone or triple-combination cream for melasma', 'Ivermectin or metronidazole cream for rosacea', 'Finasteride or oral minoxidil for hair loss'];

  const FACE = [
    ['leaner', 'Lower body fat', 'B', 'Jawline and cheekbones show more as body fat falls; the face follows the body.', 'Run the blueprint cut.'],
    ['sleep', 'Sleep 7–9 hours, little alcohol', 'B', 'Short sleep shows as puffiness, dull skin and darker under-eyes; people rate sleep-deprived faces as more tired.', 'See the Sleep page.'],
    ['posture', 'Head and shoulder posture', 'B', 'A forward head shortens the neck line and softens the jaw in profile.', 'A side progress photo measures "Head forward". Chin tucks and upper-back work.'],
    ['skin', 'A real skin routine', 'A', 'Daily sunscreen and a retinoid are the best-evidenced anti-aging steps there are.', 'Skin step.'],
    ['hairloss', 'Treat hair loss early', 'A', 'Treatment keeps more hair than it regrows, so starting early matters.', 'Minoxidil in the Skin step; a dermatologist for prescription options.'],
    ['hair', 'Haircut and hairline', 'C', 'A cut suited to face shape and hair type reframes the whole face.', 'Ask for a cut for your face shape; keep it up every 3–5 weeks.'],
    ['brows', 'Brows and facial hair', 'C', 'Tidy brows and a beard shaped to the jaw sharpen the face.', 'Set the beard neckline about two fingers above the Adam\'s apple.'],
    ['teeth', 'Teeth', 'B', 'Whiter, straighter teeth change a smile more than most procedures.', 'Dentist check, whitening, aligners if needed.'],
    ['fit', 'Clothes that fit', 'C', 'Tailoring at the shoulders and waist shows a V-taper or hourglass before the body gets there.', 'Shoulder seams on the shoulder bone; shirts tapered at the waist.'],
    ['eyes', 'Frames and eyes', 'C', 'Frames sized to the face; treating allergies and dry eyes makes eyes look clearer.', 'Optician fitting.']
  ];
  const MYTHS = [
    ['Mewing (tongue posture to reshape the jaw)', 'N', 'No evidence it changes adult bone. Good tongue and head posture can tidy the profile a little; it won\'t move the jaw.'],
    ['Bone smashing', 'X', 'Hitting the face to "remodel" bone causes fractures, nerve damage and asymmetry.'],
    ['Hard gum or jaw trainers for hours', 'N', 'Jaw-muscle growth is modest and can widen the lower face; long sessions can strain the jaw joint.'],
    ['Face yoga and facial exercises', 'N', 'One small study found slightly fuller cheeks; the evidence is weak.'],
    ['DIY palate expanders or "thumb pulling"', 'X', 'Can damage teeth and gums. Adult jaw width needs an orthodontist.'],
    ['Dehydrating or diuretics for definition', 'X', 'Dangerous for heart rhythm and kidneys, and the effect lasts hours.']
  ];
  // [k, category, name, what it does, who does it, downtime, how long it lasts, cost tier, risks]
  const PROCS = [
    ['tox', 'face', 'Neuromodulator injections (botulinum toxin)', 'Softens forehead, frown and crow\'s-feet lines; can slim a large jaw muscle.', 'Physician, or a nurse under one', '0–1 day', '3–4 months', '$', 'Bruising, headache, brief eyelid or brow droop, uneven result.'],
    ['filler', 'face', 'Hyaluronic-acid fillers', 'Shape or volume for lips, cheeks, chin, jawline or under-eyes. Can be dissolved.', 'Physician or trained nurse injector', '1–3 days of swelling', '6–18 months', '$$', 'Lumps and swelling; rarely a blocked blood vessel that can scar skin or affect sight. Choose an injector who keeps the dissolving enzyme (hyaluronidase) on hand.'],
    ['deoxy', 'face', 'Fat-dissolving injection under the chin', 'Shrinks a small double chin over 2–4 sessions.', 'Dermatologist or plastic surgeon', '1–2 weeks of swelling', 'Permanent for treated fat', '$$', 'Swelling and numbness; rarely a nerve injury that changes the smile for weeks.'],
    ['chin', 'face', 'Chin implant or sliding genioplasty', 'More chin projection and a stronger profile; genioplasty moves your own bone.', 'Plastic, facial plastic or maxillofacial surgeon', '1–2 weeks', 'Permanent', '$$$', 'Infection, implant shift, lip or chin numbness, asymmetry.'],
    ['jaw', 'face', 'Jaw angle implants', 'A wider, squarer jawline.', 'Facial plastic or maxillofacial surgeon', '2–3 weeks', 'Permanent', '$$$$', 'Infection, asymmetry, nerve injury, visible implant edges.'],
    ['ortho', 'face', 'Jaw surgery (orthognathic)', 'Moves the jaws to fix the bite, which also changes the profile. Done with braces; often insured when the bite needs it.', 'Maxillofacial surgeon with an orthodontist', '6–12 weeks', 'Permanent', '$$$$', 'Numbness, relapse, the risks of major surgery.'],
    ['rhino', 'face', 'Rhinoplasty', 'Reshapes the nose and can improve breathing.', 'Plastic or facial plastic surgeon', '1–2 weeks visible; swelling settles over a year', 'Permanent', '$$$$', 'Breathing changes, asymmetry; about 1 in 10 have a revision.'],
    ['bleph', 'face', 'Eyelid surgery', 'Removes heavy upper-lid skin or lower-lid bags.', 'Plastic, facial plastic or oculoplastic surgeon', '1–2 weeks', 'Many years', '$$$', 'Dry eyes, trouble closing the eyes, asymmetry.'],
    ['peel', 'skin', 'Chemical peels', 'Light peels brighten and even tone; deeper peels treat lines and scars.', 'Dermatologist; light peels by a trained aesthetician', '0–10 days by depth', 'Weeks to years', '$–$$', 'Dark or light patches, especially in deeper skin tones: stick to light peels with an experienced provider.'],
    ['needle', 'skin', 'Microneedling (with or without radiofrequency)', 'Improves acne scars, texture and pores, and is safe across skin tones.', 'Dermatologist or medical clinic', '1–3 days of redness', 'Lasting, after 3–6 sessions', '$–$$', 'Redness; infection if not sterile. Home rollers deeper than 0.5 mm are a bad idea.'],
    ['laser', 'skin', 'Fractional laser resurfacing', 'Lines, sun damage, scars and texture.', 'Dermatologist or plastic surgeon', '3–10 days', 'Years', '$$–$$$', 'Dark marks or lightening in deeper skin tones (non-ablative settings are safer), infection, scarring.'],
    ['ipl', 'skin', 'IPL and vascular lasers', 'Redness, broken veins and sun spots.', 'Dermatologist', '1–3 days', 'Months to years', '$$', 'Burns and pigment changes. IPL is not for deeper skin tones.'],
    ['lhr', 'skin', 'Laser hair removal', 'Long-term hair reduction; ends razor bumps. Nd:YAG 1064 nm lasers are the safer choice for deeper skin tones.', 'Dermatologist or supervised laser clinic', 'None', 'Long-term after 6–8 sessions', '$$', 'Burns or pigment changes with the wrong laser for your skin type.'],
    ['cryo', 'body', 'Fat freezing (cryolipolysis)', 'Trims a small pinchable bulge by around a fifth. Not weight loss.', 'Medical aesthetic clinic', 'None to a few days', 'Permanent for removed cells', '$$', 'Numbness; rarely the treated fat grows instead (paradoxical adipose hyperplasia) and needs surgery.'],
    ['lipo', 'body', 'Liposuction', 'Removes stubborn fat to refine contour. Not a weight-loss tool.', 'Plastic surgeon', '1–2 weeks; compression for 4–6', 'Permanent if weight stays stable', '$$$', 'Uneven contour, fluid collections, blood clots, rarely fat embolism.'],
    ['pec', 'body', 'Pectoral implants', 'A fuller upper chest when training has plateaued.', 'Plastic surgeon', '2 weeks off work; no chest training for about 6', 'Long-term', '$$$$', 'Fluid collection, implant shift, scar-capsule tightening, infection.'],
    ['calf', 'body', 'Calf implants', 'Bigger or more even calves. Calf size is strongly genetic.', 'Plastic surgeon', '2–4 weeks', 'Long-term', '$$$', 'Asymmetry, implant shift; rarely nerve or pressure problems in the calf.'],
    ['glute', 'body', 'Gluteal implants', 'Glute projection with a silicone implant.', 'Plastic surgeon', '3–6 weeks of limited sitting', 'Long-term', '$$$$', 'Infection, wound breakdown, implant shift.'],
    ['bbl', 'body', 'Gluteal fat grafting ("BBL")', 'Moves your own fat to the hips and glutes.', 'Plastic surgeon only', '2–3 weeks of limited sitting', 'Permanent for fat that survives', '$$$$', 'Has had one of the highest death rates in aesthetic surgery, from fat entering large veins. Safety guidance: fat only above the muscle, ideally under ultrasound. Ask how they make sure of that.'],
    ['breast', 'body', 'Breast augmentation', 'Size and shape with implants or fat grafting.', 'Plastic surgeon', '1–2 weeks; 6 before heavy upper-body training', 'Implants are not lifetime devices', '$$$$', 'Capsule tightening, rupture, revision surgery; a rare lymphoma (BIA-ALCL) linked mostly to textured implants; some report whole-body symptoms.'],
    ['gyno', 'body', 'Male chest reduction (gynecomastia)', 'Removes gland tissue and fat. See a doctor first: medicines, hormones or supplements can be the cause.', 'Plastic surgeon', '1–2 weeks', 'Permanent once the cause is gone', '$$$', 'Uneven contour, nipple numbness, regrowth if the cause continues.'],
    ['tummy', 'body', 'Tummy tuck', 'Removes loose skin and tightens the abdominal wall after big weight loss or pregnancy.', 'Plastic surgeon', '2–4 weeks', 'Permanent if weight is stable', '$$$$', 'Fluid collection, wound problems, blood clots, a long scar.'],
    ['fue', 'hair', 'Hair transplant (FUE or FUT)', 'Moves follicles from the back of the head to thinning areas. Most people keep medical treatment going to protect the rest.', 'Hair restoration surgeon', '7–10 days', 'Permanent for moved follicles', '$$$–$$$$', 'Poor growth, scarring, an unnatural hairline from low-quality clinics.'],
    ['teeth', 'hair', 'Whitening, aligners and veneers', 'Whitening brightens, aligners straighten, veneers reshape. Veneers remove enamel and need replacing every 10–15 years.', 'Dentist or orthodontist', 'None', 'Varies', '$–$$$$', 'Sensitivity, relapse without retainers, permanent enamel loss with veneers.']
  ];
  const PCAT = [['all', 'All'], ['face', 'Face'], ['skin', 'Skin'], ['body', 'Body'], ['hair', 'Hair and teeth']];
  const DANGER = [
    ['Injected oils ("synthol", site-enhancement oil)', 'Abscesses, nerve damage and permanent deformity; removal can need surgery.'],
    ['Silicone or "pumping" injections by non-medical people', 'Deaths, migrating lumps and lifelong inflammation.'],
    ['Melanotan tanning injections or nasal sprays', 'Not approved anywhere; new and changing moles, nausea, raised blood pressure.'],
    ['Skin-lightening creams bought online', 'Can contain mercury or strong steroids: kidney damage, thin skin, stretch marks.'],
    ['Needle-free "hyaluron pens" and self-injected filler', 'Regulators warn of blocked vessels, scarring and blindness.'],
    ['Tanning beds', 'A proven cause of melanoma. Sunless tanner gives colour safely.'],
    ['Performance drugs for looks', 'Steroids, SARMs and similar carry heart, liver, fertility and mood risks. Myo does not plan them; the Stack page covers risks and monitoring.']
  ];
  const CONSULT = ['Board-certified in the specialty for this procedure', 'Operates in an accredited facility with a certified anaesthesia provider', 'Does this often, and shows results on people with your skin tone and build', 'Explains the risks, and who handles a complication and how', 'Gives one total price: surgeon, anaesthesia, facility, garments, revisions', 'Has a recovery plan, including time off training and work', 'Knows every medicine, supplement and performance drug you take', 'You stopped nicotine for as long as they ask (it slows healing)', 'At least 2 weeks between the consult and booking', 'If abroad: a follow-up and complication plan for when you are home'];
  const SELF = [['time', 'I think about a part of my appearance for more than an hour a day'], ['check', 'I check mirrors, compare myself, or hide the area many times a day'], ['life', 'Worry about my looks gets in the way of work, school, dating or going out'], ['seen', 'People say the flaw is barely visible, but it feels obvious to me'], ['after', 'After past changes or procedures I feel just as bad, or move on to a new area']];
  const STEPS = [['base', 'Baseline', 'Measure'], ['target', 'Target', 'Pick the build'], ['blue', 'Blueprint', 'Gap and plan'], ['skin', 'Skin', 'Routine'], ['face', 'Face', 'Grooming levers'], ['proc', 'Procedures', 'Options, safely'], ['prog', 'Progress', 'Photos and trends']];
  const FIELDS = [['weight', 'Weight', 'kg', 1], ['waist', 'Waist at the navel', 'cm', 1], ['shoulders', 'Shoulders, around the widest point', 'cm', 1], ['hips', 'Hips, around the widest point', 'cm', 1], ['chest', 'Chest, under the armpits', 'cm'], ['neck', 'Neck, below the Adam\'s apple', 'cm'], ['arm', 'Upper arm, flexed', 'cm'], ['thigh', 'Thigh, widest', 'cm'], ['calf', 'Calf, widest', 'cm'], ['bf', 'Body fat from a scan (optional)', '%']];

  let tab = 'base', pcat = 'all', pa = null, pb = null;
  try { tab = localStorage.getItem('myo-looks-tab') || 'base'; } catch {}
  const urls = {};

  function ensure(s) {
    if (!s.looks) s.looks = { arch: null, sex: null, tage: 1, hCm: null, meas: [], skin: { fitz: null, type: null, concerns: [] }, face: {}, short: [], self: {} };
    const L = s.looks;
    if (!Array.isArray(L.meas)) L.meas = []; if (!Array.isArray(L.short)) L.short = [];
    if (!L.skin) L.skin = { fitz: null, type: null, concerns: [] }; if (!L.skin.concerns) L.skin.concerns = [];
    if (!L.face) L.face = {}; if (!L.self) L.self = {};
    return L;
  }
  const sexOf = (s, L) => L.sex || (s.profile && s.profile.sex === 'F' ? 'F' : 'M');
  const hOf = (s, L) => +L.hCm || (s.profile && +s.profile.heightCm) || 175;
  const archOf = (L) => ARCH.find((a) => a.k === L.arch) || null;
  const latest = (L) => [...L.meas].sort((a, b) => a.d.localeCompare(b.d)).pop() || null;
  const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100;
  const mid = (r) => (r[0] + r[1]) / 2;

  /* ── body maths ── */
  function bodyFat(m, sex, h) {
    if (m.bf) return { v: +m.bf, how: 'from your scan' };
    const lg = Math.log10, i = (x) => x / 2.54;
    if (m.waist && m.neck && (sex === 'M' || m.hips) && m.waist > m.neck) {
      const v = sex === 'M' ? 86.01 * lg(i(m.waist - m.neck)) - 70.041 * lg(i(h)) + 36.76 : 163.205 * lg(i(m.waist + m.hips - m.neck)) - 97.684 * lg(i(h)) - 78.387;
      if (Number.isFinite(v) && v > 3 && v < 60) return { v: r1(v), how: 'tape estimate (US Navy)' };
    }
    if (m.waist) { const v = (sex === 'M' ? 64 : 76) - 20 * (h / m.waist); if (v > 3 && v < 60) return { v: r1(v), how: 'waist estimate (RFM)' }; }
    return null;
  }
  function stats(m, sex, h) {
    if (!m) return null;
    const bf = bodyFat(m, sex, h), lean = bf ? m.weight * (1 - bf.v / 100) : null, hm = h / 100;
    const ffmi = lean ? lean / (hm * hm) : null;
    return { bf, lean, ffmi, nffmi: ffmi ? ffmi + 6.1 * (1.8 - hm) : null, swr: m.shoulders && m.waist ? m.shoulders / m.waist : null, whr: m.waist && m.hips ? m.waist / m.hips : null, whtr: m.waist / h };
  }
  const fill = (m) => { const w = m.waist; return { neck: m.neck || w * 0.46, shoulders: m.shoulders || w * 1.38, chest: m.chest || w * 1.17, waist: w, hips: m.hips || w * 1.12, thigh: m.thigh || (m.hips || w * 1.12) * 0.58, calf: m.calf || (m.hips || w * 1.12) * 0.38, arm: m.arm || w * 0.42 }; };
  function tdee(s, L, weight) {
    const p = s.profile || {}, h = hOf(s, L), age = +p.age || 30, sex = sexOf(s, L);
    return (10 * weight + 6.25 * h - 5 * age + (sex === 'M' ? 5 : -161)) * (+p.activity || 1.5);
  }
  // 12-month projection from typical rates (rough by design; bodies vary)
  function project(s, L) {
    const m = latest(L), A = archOf(L); if (!m || !A) return null;
    const sex = sexOf(s, L), h = hOf(s, L), st = stats(m, sex, h); if (!st || !st.bf) return null;
    const bfT = mid(A.bf[sex]), fatNow = m.weight * st.bf.v / 100, leanNow = m.weight - fatNow;
    const cutFat = fatNow - (leanNow * bfT) / (100 - bfT);
    const cut = cutFat > 1.5 ? Math.ceil(cutFat / (m.weight * 0.0075)) : 0, refine = 6, build = Math.max(12, 52 - cut - refine);
    const gain = GAIN[sex][L.tage ?? 1] * Math.min(1, (build + cut * 0.3) / 46);
    const leanT = leanNow + gain, fatT = (leanT * bfT) / (100 - bfT), dF = fatT - fatNow;
    const pri = (g) => (A.hi.includes(g) ? 1 : A.hi2.includes(g) ? 0.5 : 0.2), cur = fill(m);
    const tgt = {
      neck: cur.neck + dF * 0.1 + gain * 0.3 * pri('neck'), shoulders: cur.shoulders + dF * 0.35 + gain * 1.6 * (pri('delts') + pri('back')) / 2,
      chest: cur.chest + dF * 0.45 + gain * 1.2 * (pri('chest') + pri('back')) / 2, waist: cur.waist + dF * 0.9,
      hips: cur.hips + dF * 0.6 + gain * 1.2 * pri('glutes'), thigh: cur.thigh + dF * 0.3 + gain * 0.8 * (pri('quads') + pri('hamstrings')) / 2,
      calf: cur.calf + dF * 0.08 + gain * 0.35 * pri('calves'), arm: cur.arm + dF * 0.15 + gain * 0.5 * (pri('biceps') + pri('triceps')) / 2
    };
    const T = tdee(s, L, m.weight), kc = (x) => Math.round(x / 50) * 50;
    const phases = [];
    if (cut) phases.push({ k: 'cut', name: 'Cut', weeks: cut, kcal: kc(T - 450), protein: Math.round(m.weight * 2.2), body: `Lose about ${r1(cutFat)} kg of fat at 0.5–1% of body weight a week. Keep lifting heavy so muscle stays.`, cardio: '8–10k steps a day; 2 easy cardio sessions' });
    phases.push({ k: 'build', name: cut ? 'Lean build' : 'Build', weeks: build, kcal: kc(T + (st.bf.v > A.bf[sex][1] ? 0 : 250)), protein: Math.round(m.weight * 1.8), body: `Add about ${r1(gain)} kg of lean mass. Gain no more than ${L.tage ? '0.25–0.5' : '0.5–1'}% of body weight a month; if the waist grows faster than the shoulders, cut calories by 150.`, cardio: '7–9k steps a day; 1–2 conditioning sessions' });
    phases.push({ k: 'refine', name: 'Refine', weeks: refine, kcal: kc(T - 250), protein: Math.round(m.weight * 2), body: 'A short, gentle cut to sharpen definition; skin, grooming and posture finish. Retake photos and measure.', cardio: 'Steps as in the cut' });
    return { A, sex, h, m, st, cur, tgt, bfT, gain, weightT: leanT + fatT, phases, swrT: tgt.shoulders / tgt.waist, ffmiT: (leanT / ((h / 100) ** 2)) + 6.1 * (1.8 - h / 100) };
  }

  /* ── drawings ── */
  const wid = (c, r) => (2 * c) / (Math.PI * (1 + r)); // front width from a circumference, elliptical section
  const f1 = (x) => x.toFixed(1);
  function halfW(c, k) { return { n: wid(c.neck, 0.9) * k / 2, s: wid(c.shoulders, 0.55) * k / 2, c: wid(c.chest, 0.7) * k / 2, w: wid(c.waist, 0.75) * k / 2, h: wid(c.hips, 0.65) * k / 2, t: wid(c.thigh, 0.9) * k / 2, ca: wid(c.calf, 0.9) * k / 2 }; }
  function outline(d, cx) {
    const tw = d.t, legC = Math.max(tw + 1.5, d.h - tw * 0.95);
    const R = [[d.n, 50], [d.n * 1.1, 62], [d.n + (d.s - d.n) * 0.6, 72], [d.s, 94], [d.c, 130], [(d.c + d.w) / 2, 163], [d.w, 196], [d.h, 234], [legC + tw, 270], [legC + tw * 0.6, 334], [legC + d.ca, 364], [legC + d.ca * 0.42, 404], [legC - d.ca * 0.42, 404], [legC - d.ca * 0.85, 366], [legC - tw * 0.55, 334], [Math.max(1.5, legC - tw), 276]];
    const pts = [...R, [0, 264], ...R.slice().reverse().map(([x, y]) => [-x, y])].map(([x, y]) => [cx + x, y]);
    const n = pts.length; let p = `M${f1(pts[0][0])},${f1(pts[0][1])}`;
    for (let i = 0; i < n; i++) {
      const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n], e = pts[(i + 2) % n];
      p += `C${f1(b[0] + (c[0] - a[0]) / 6)},${f1(b[1] + (c[1] - a[1]) / 6)} ${f1(c[0] - (e[0] - b[0]) / 6)},${f1(c[1] - (e[1] - b[1]) / 6)} ${f1(c[0])},${f1(c[1])}`;
    }
    return p + 'Z';
  }
  const DIMS = [['S', 'shoulders', 'Shoulders', 94], ['C', 'chest', 'Chest', 130], ['W', 'waist', 'Waist', 196], ['H', 'hips', 'Hips', 234], ['T', 'thigh', 'Thigh', 270], ['K', 'calf', 'Calf', 364]];
  function blueprint(P) {
    const k = 190 / Math.max(wid(P.cur.shoulders, 0.55), wid(P.tgt.shoulders, 0.55)), cx = 140;
    const a = halfW(P.cur, k), b = halfW(P.tgt, k), key = { shoulders: 's', chest: 'c', waist: 'w', hips: 'h', thigh: 't', calf: 'ca' };
    const dims = DIMS.map(([tag, f, , y]) => {
      const hw = Math.max(a[key[f]], b[key[f]]), legC = Math.max(b.t + 1.5, b.h - b.t * 0.95);
      const x0 = f === 'thigh' || f === 'calf' ? cx + legC - b[key[f]] : cx - hw, x1 = f === 'thigh' || f === 'calf' ? cx + legC + b[key[f]] : cx + hw;
      return `<g class="lk-dim"><line x1="${f1(x0)}" x2="${f1(x1)}" y1="${y}" y2="${y}" marker-start="url(#lk-ar)" marker-end="url(#lk-ar)"/><line x1="${f1(x1 + 3)}" x2="262" y1="${y}" y2="${y}" class="lk-lead"/><circle cx="272" cy="${y}" r="9"/><text x="272" y="${y + 3.5}" text-anchor="middle">${tag}</text></g>`;
    }).join('');
    return `<svg viewBox="0 0 290 420" class="lk-bp" role="img" aria-label="Blueprint: your outline now (dashed) and the projected target outline (solid). Widths to scale, heights schematic.">
      <defs><pattern id="lk-grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" class="lk-gl"/></pattern><pattern id="lk-grid5" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" class="lk-gl2"/></pattern>
      <marker id="lk-ar" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 1L8 4L0 7z" class="lk-arh"/></marker></defs>
      <rect width="290" height="420" fill="url(#lk-grid)"/><rect width="290" height="420" fill="url(#lk-grid5)"/>
      <line x1="${cx}" x2="${cx}" y1="4" y2="414" class="lk-axis"/>
      <ellipse cx="${cx}" cy="27" rx="15" ry="19" class="lk-tgt"/>
      <path d="${outline(b, cx)}" class="lk-tgt"/><path d="${outline(a, cx)}" class="lk-now"/>${dims}</svg>`;
  }
  function mini(A, sex) {
    const t = A.t, w = 80, f = sex === 'F' ? [1.12, 1.08] : [1, 1], c = { waist: w, shoulders: w * mid(A.swr[sex]), chest: w * t[0], hips: w * t[1] * f[0], thigh: w * t[2] * f[1], calf: w * t[3], neck: w * t[4] };
    const d = halfW(c, 150 / wid(c.shoulders, 0.55)), hi = A.hi.length;
    return `<svg viewBox="0 0 200 420" class="lk-mini" aria-hidden="true"><ellipse cx="100" cy="27" rx="14" ry="18"/><path d="${outline(d, 100)}"/><text x="100" y="416" text-anchor="middle">${hi} priorities</text></svg>`;
  }

  /* ── skin routine ── */
  function routine(sk) {
    const c = new Set(sk.concerns), deep = ['IV', 'V', 'VI'].includes(sk.fitz), am = ['clean'], pm = ['clean'], extra = [];
    const amT = [], pmT = [];
    if (c.has('acne') || c.has('texture') || c.has('aging')) pmT.push('adap');
    if (c.has('acne')) amT.push('bpo');
    if (c.has('marks') || c.has('melasma') || c.has('redness')) (pmT.length ? amT : pmT).push('aza');
    if (c.has('melasma')) pmT.push('txa');
    if (c.has('aging') || (c.has('marks') && !c.has('melasma'))) amT.push('vitc');
    if (sk.type === 'oily' || c.has('redness')) amT.push('nia');
    if (c.has('bumps')) { pmT.push('sal'); extra.push('shave'); }
    if (c.has('kp')) extra.push('urea');
    if (c.has('hair')) extra.push('minox');
    if (c.has('circles')) extra.push('eyes');
    const uniq = (xs) => [...new Set(xs)];
    const pmSel = uniq(pmT).slice(0, 2), amSel = uniq(amT).filter((x) => !pmSel.includes(x)).slice(0, 2); // at most two actives each
    am.push(...amSel, 'moist', c.has('melasma') || (deep && c.has('marks')) ? 'tint' : 'spf');
    pm.push(...pmSel, 'moist');
    return { am: uniq(am), pm: uniq(pm), extra: uniq(extra) };
  }

  /* ── view ── */
  const gp = (g) => pill(g === 'A' ? 'good' : g === 'X' ? 'bad' : g === 'N' ? 'warn' : 'muted', g === 'X' ? 'Harmful' : g === 'N' ? 'Not supported' : `Evidence ${g}`);
  const n1 = (x, d = 1) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(d));
  function stepState(s, L) {
    const P = project(s, L);
    return { base: L.meas.length > 0, target: !!L.arch, blue: !!P, skin: !!(L.skin.fitz && L.skin.type), face: Object.values(L.face).some(Boolean), proc: L.short.length > 0 || Object.keys(L.self).length > 0, prog: L.meas.length > 1 || ((OS.Scan && OS.Scan.photos) || []).length > 1 };
  }

  OS.register('looks', {
    title: 'Looks', icon: 'looks',
    render(s) {
      const L = ensure(s), sex = sexOf(s, L), h = hOf(s, L), m = latest(L), st = stats(m, sex, h), A = archOf(L), done = stepState(s, L);
      const body = { base: tBase, target: tTarget, blue: tBlue, skin: tSkin, face: tFace, proc: tProc, prog: tProg }[tab] || tBase;
      return `${OS.ui.head('Body · looks', 'Looks', 'Engineer your look in stages: physique, skin, face and grooming, with honest evidence for every option, procedures included.',
        `<div class="hstat"><span>Body fat</span><b class="num">${st && st.bf ? st.bf.v + '%' : '—'}</b></div><div class="hstat"><span>Shoulder : waist</span><b class="num">${st && st.swr ? n1(st.swr, 2) : '—'}</b></div><div class="hstat"><span>Build</span><b>${A ? esc(A.name) : 'Not set'}</b></div>`)}
      <nav class="lk-steps" aria-label="Build stages">${STEPS.map(([k, n, sub], i) => `<button type="button" class="lk-step ${tab === k ? 'on' : ''} ${done[k] ? 'done' : ''}" data-act="lk-tab" data-t="${k}" ${tab === k ? 'aria-current="step"' : ''}><span class="lk-sn">${done[k] ? icon('check', 13) : i + 1}</span><span><b>${n}</b><small>${sub}</small></span></button>`).join('')}</nav>
      ${body(s, L, sex, h, m, st, A)}
      <p class="fine lk-foot">Looks are personal. Myo shows evidence, trade-offs and timelines; it never scores faces or bodies. Photos stay on this device.</p>`;
    },
    mount(root) {
      const cl = tab === 'blue' && OS.Anatomy ? OS.Anatomy.mountAll(root) : null;
      const onIn = (e) => { if (e.target.matches('.lk-cmp-range')) e.target.closest('.lk-cmp').style.setProperty('--cut', e.target.value + '%'); };
      root.addEventListener('input', onIn);
      return () => { if (cl) cl(); root.removeEventListener('input', onIn); if (OS.current !== 'looks') Object.keys(urls).forEach((k) => { URL.revokeObjectURL(urls[k]); delete urls[k]; }); };
    }
  });

  function tBase(s, L, sex, h, m, st) {
    const v = (k) => (m && m[k] != null ? m[k] : '');
    const scan = OS.Scan && OS.Scan.photos ? [...OS.Scan.photos].reverse().find((p) => p.metrics && p.metrics.items && p.metrics.items.some((i) => i.k === 'taper')) : null;
    const taper = scan && scan.metrics.items.find((i) => i.k === 'taper');
    return `<div class="grid g-2-1">
      <section class="card"><div class="card-h"><h2>Measurements</h2><span class="muted small">Same time of day, after waking</span></div>
        <form data-submit="lk-meas" class="form-grid lk-form">
          <label class="field"><span>Date</span><input name="d" type="date" value="${dayKey()}"></label>
          <label class="field"><span>Height (cm)</span><input name="hCm" type="number" min="120" max="230" step="0.5" value="${h}"></label>
          ${FIELDS.map(([k, n, u, req]) => `<label class="field"><span>${esc(n)} (${u})${req ? '' : ' <i class="muted">optional</i>'}</span><input name="${k}" type="number" step="0.1" min="0" ${req ? 'required' : ''} value="${esc(v(k))}"></label>`).join('')}
          <label class="field"><span>Ranges for</span><select name="sex"><option value="M" ${sex === 'M' ? 'selected' : ''}>Male physiology</option><option value="F" ${sex === 'F' ? 'selected' : ''}>Female physiology</option></select></label>
          <label class="field"><span>Lifting experience</span><select name="tage">${TAGE.map((t, i) => `<option value="${i}" ${(L.tage ?? 1) === i ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <div class="form-end"><button class="btn sm">Save measurements</button></div></form>
        <p class="fine">Tape snug on the skin, not pressing in. Shoulders: arms relaxed, tape over the widest part of the deltoids.</p></section>
      <section class="card"><div class="card-h"><h2>Where you are now</h2>${m ? `<span class="muted small">${esc(m.d)}${m.sample ? ' · example' : ''}</span>` : ''}</div>
        ${st ? `<dl class="lk-kv">
          <div><dt>Body fat</dt><dd class="num">${st.bf ? st.bf.v + '%' : '—'}</dd><small>${st.bf ? esc(st.bf.how) : 'Add neck or a scan value'}</small></div>
          <div><dt>Lean mass</dt><dd class="num">${n1(st.lean)} kg</dd></div>
          <div><dt>FFMI (height-adjusted)</dt><dd class="num">${n1(st.nffmi)}</dd><small>Lean mass for your height</small></div>
          <div><dt>Shoulder : waist</dt><dd class="num">${n1(st.swr, 2)}</dd></div>
          <div><dt>Waist : height</dt><dd class="num">${n1(st.whtr, 2)} ${pill(st.whtr < 0.5 ? 'good' : st.whtr < 0.6 ? 'warn' : 'bad', st.whtr < 0.5 ? 'Healthy' : st.whtr < 0.6 ? 'Raised' : 'High')}</dd><small>Health marker: under 0.5</small></div>
          <div><dt>Waist : hip</dt><dd class="num">${n1(st.whr, 2)}</dd></div>
          ${m.arm || m.calf ? `<div><dt>Arm · calf · neck</dt><dd class="num">${n1(m.arm, 0)} · ${n1(m.calf, 0)} · ${n1(m.neck, 0)}</dd><small>Classic ideal: about equal</small></div>` : ''}
          ${taper ? `<div><dt>Photo scan</dt><dd class="num">${taper.value}×</dd><small>Shoulder : hip from your last front photo</small></div>` : ''}
        </dl>` : `<p class="muted small">Save your first measurements to see body fat, lean mass and proportions.</p><button class="btn ghost sm" data-act="lk-sample">Load example measurements</button>`}
        <div class="row"><button class="btn sm" data-act="lk-tab" data-t="target">Next: pick a build</button></div></section></div>`;
  }

  function tTarget(s, L, sex) {
    return `<section class="card"><div class="card-h"><h2>Pick the build</h2><span class="muted small">Ranges shown for ${sex === 'M' ? 'male' : 'female'} physiology</span></div>
      <div class="lk-arch">${ARCH.map((A) => `<button type="button" class="lk-ac ${L.arch === A.k ? 'on' : ''}" data-act="lk-arch" data-k="${A.k}" aria-pressed="${L.arch === A.k}">
        ${mini(A, sex)}<div><b>${esc(A.name)}</b><span class="small muted">${esc(A.line)}</span>
        <dl><div><dt>Body fat</dt><dd>${A.bf[sex][0]}–${A.bf[sex][1]}%</dd></div><div><dt>Shoulder : waist</dt><dd>${A.swr[sex][0].toFixed(2)}–${A.swr[sex][1].toFixed(2)}</dd></div></dl>
        <span class="lk-chips">${A.hi.map((g) => `<i>${esc(MUS[g])}</i>`).join('')}</span></div></button>`).join('')}</div>
      <p class="fine">Frame size, muscle insertions and where you store fat are partly genetic, so the same build looks different on everyone. Targets set a direction, not a verdict.</p>
      ${L.arch ? '<div class="row"><button class="btn sm" data-act="lk-tab" data-t="blue">Next: see the blueprint</button></div>' : ''}</section>`;
  }

  function tBlue(s, L) {
    const P = project(s, L);
    if (!P) return `<section class="card"><h2>Blueprint</h2><p class="muted">The blueprint needs ${!L.meas.length ? 'measurements' : !L.arch ? 'a target build' : 'a body-fat value (add your neck measurement or a scan result)'} first.</p><div class="row"><button class="btn sm" data-act="lk-tab" data-t="${!L.meas.length ? 'base' : 'target'}">Go there</button><button class="btn ghost sm" data-act="lk-sample">Load an example</button></div></section>`;
    const { A, sex, cur, tgt, phases } = P, tot = phases.reduce((a, p) => a + p.weeks, 0), swrOk = P.swrT >= A.swr[sex][0];
    const pri = A.hi, sec = A.hi2, rest = ALL_MUS.filter((g) => !pri.includes(g) && !sec.includes(g));
    return `<div class="grid g-2">
      <section class="card lk-bpc"><div class="card-h"><h2>Build blueprint</h2><span class="lk-leg"><i class="now"></i>Now <i class="tgt"></i>12 months</span></div>
        <div class="lk-bpw">${blueprint(P)}
          <div><div class="tbl-wrap"><table class="tbl compact lk-dims"><thead><tr><th></th><th>cm</th><th>Now</th><th>Target</th><th></th></tr></thead><tbody>
            ${DIMS.map(([tag, f, n]) => { const d = tgt[f] - cur[f]; return `<tr><td><span class="lk-tag">${tag}</span></td><td>${n}${L.meas.length && latest(L)[f] ? '' : ' <i class="muted">est.</i>'}</td><td class="num">${n1(cur[f])}</td><td class="num">${n1(tgt[f])}</td><td class="num ${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '+' : '−'}${n1(Math.abs(d))}</td></tr>`; }).join('')}
            <tr><td></td><td>Weight (kg)</td><td class="num">${n1(P.m.weight)}</td><td class="num">${n1(P.weightT)}</td><td class="num">${P.weightT >= P.m.weight ? '+' : '−'}${n1(Math.abs(P.weightT - P.m.weight))}</td></tr>
            <tr><td></td><td>Body fat (%)</td><td class="num">${P.st.bf.v}</td><td class="num">${n1(P.bfT)}</td><td></td></tr>
            <tr><td></td><td>Shoulder : waist</td><td class="num">${n1(P.st.swr, 2)}</td><td class="num">${n1(P.swrT, 2)}</td><td>${pill(swrOk ? 'good' : 'warn', swrOk ? 'In range' : 'Short')}</td></tr>
          </tbody></table></div>
          <div class="lk-tb"><b>MYO BUILD BLUEPRINT</b><span>Build: ${esc(A.name)}</span><span>Rev ${L.meas.length} · ${esc(P.m.d)}</span><span>Widths to scale · heights schematic</span></div></div></div>
        <p class="fine">A rough projection from typical rates for your experience (about ${n1(P.gain)} kg of lean mass in the year). Real results vary a lot. ${swrOk ? '' : 'The shoulder : waist target needs more than a year, or more waist reduction, for most people.'}</p></section>
      <section class="card holo lk-emph"><div class="card-h"><h2>Build emphasis</h2><span class="muted small">Hard sets per week</span></div>
        ${OS.Anatomy ? `<div class="a3d" data-a3d="compact" data-systems="skin,muscular" data-view="${A.view}" data-hi="${pri.join(',')}" aria-label="Priority muscles for the ${esc(A.name)} build, highlighted"></div>` : ''}
        <ul class="lk-sets"><li><b>Priority</b><span>${pri.map((g) => esc(MUS[g])).join(', ')}</span><em>14–20 sets</em></li><li><b>Secondary</b><span>${sec.map((g) => esc(MUS[g])).join(', ')}</span><em>10–14 sets</em></li><li><b>Maintain</b><span>${rest.map((g) => esc(MUS[g])).join(', ') || '—'}</span><em>6–8 sets</em></li></ul>
        <p class="fine">Train each muscle twice a week, most sets 1–3 reps short of failure, and add weight or reps week to week.</p>
        <div class="row"><button class="btn sm" data-act="lk-coach">Ask Myo to write the program</button><button class="btn ghost sm" data-go="training" data-act="lk-go">Open Training</button></div></section></div>
      <section class="card"><div class="card-h"><h2>Timeline</h2><span class="muted small">${tot} weeks · check in every 4</span></div>
        <div class="lk-tl" role="img" aria-label="${phases.map((p) => `${p.name} ${p.weeks} weeks`).join(', ')}">${phases.map((p) => `<span class="lk-ph ${p.k}" style="flex:${p.weeks}"><b>${p.name}</b><small>${p.weeks} wk</small></span>`).join('')}</div>
        <div class="lk-phs">${phases.map((p) => `<article class="lk-pc ${p.k}"><h3>${p.name} <span class="muted small">${p.weeks} weeks</span></h3><dl><div><dt>Calories</dt><dd class="num">${p.kcal} kcal</dd></div><div><dt>Protein</dt><dd class="num">${p.protein} g</dd></div></dl><p class="small">${esc(p.body)}</p><p class="small muted">${esc(p.cardio)}</p></article>`).join('')}</div>
        <p class="fine">Calories from your profile's age and activity (Mifflin-St Jeor); adjust by the scale and the tape after 2–3 weeks. ${P.ffmiT > 25 ? '<b>Your target is past an FFMI of 25, about the top of what people reach without drugs. Myo plans natural builds only.</b>' : ''} Calves, chin and jaw shape are largely genetic; the Procedures step covers implants for people who want them.</p></section>`;
  }

  function tSkin(s, L) {
    const sk = L.skin, R = sk.fitz && sk.type ? routine(sk) : null, deep = ['IV', 'V', 'VI'].includes(sk.fitz);
    const item = (k) => { const [n, g, why, how] = ACT[k]; return `<li><div class="lk-ri"><b>${esc(n)}</b>${gp(g)}</div><span class="small">${esc(why)}</span><span class="small muted">${esc(how)}</span></li>`; };
    return `<div class="grid g-2">
      <section class="card"><div class="card-h"><h2>Skin profile</h2><span class="muted small">Fitzpatrick skin type</span></div>
        <div class="lk-fitz" role="radiogroup" aria-label="Fitzpatrick skin type">${FITZ.map(([k, n, c]) => `<button type="button" role="radio" aria-checked="${sk.fitz === k}" class="${sk.fitz === k ? 'on' : ''}" data-act="lk-fitz" data-k="${k}"><i style="background:${c}"></i><b>${k}</b><small>${esc(n)}</small></button>`).join('')}</div>
        <div class="seg lk-stype" role="group" aria-label="Skin type">${STYPE.map(([k, n]) => `<button type="button" class="${sk.type === k ? 'on' : ''}" data-act="lk-stype" data-k="${k}">${n}</button>`).join('')}</div>
        <fieldset class="lk-conc"><legend class="small muted">What you want to work on</legend>${CONC.map(([k, n]) => `<label class="ped-use"><input type="checkbox" data-change="lk-conc" data-k="${k}" ${sk.concerns.includes(k) ? 'checked' : ''}> ${esc(n)}</label>`).join('')}</fieldset></section>
      <section class="card"><div class="card-h"><h2>Your routine</h2>${R ? pill('good', 'Built') : pill('muted', 'Pick type and skin type')}</div>
        ${R ? `<h3 class="lk-rh">Morning</h3><ol class="lk-rt">${R.am.map(item).join('')}</ol><h3 class="lk-rh">Evening</h3><ol class="lk-rt">${R.pm.map(item).join('')}</ol>${R.extra.length ? `<h3 class="lk-rh">Body, scalp and extras</h3><ul class="lk-rt">${R.extra.map(item).join('')}</ul>` : ''}
          <p class="fine">Add one new product every 2 weeks and patch-test it behind the ear first. Stinging that lasts or a rash means stop.</p>` : '<p class="muted small">Pick your Fitzpatrick type and skin type to build a routine.</p>'}</section></div>
      <div class="grid g-2">
        <section class="card"><div class="card-h"><h2>Tone and colour</h2></div><ul class="ath-list">
          <li><b>Myo works on even tone and glow, never lightening.</b> Lightening creams sold online can contain mercury or strong steroids.</li>
          ${deep ? '<li>Deeper skin tones mark easily after spots, peels and lasers (post-inflammatory hyperpigmentation). Treat breakouts early, keep routines gentle, and choose providers experienced with your skin type.</li><li>For hair removal, Nd:YAG lasers are the safer choice; IPL is not.</li>' : sk.fitz ? '<li>Lighter skin types burn faster and carry more skin-cancer risk: daily sunscreen, and a yearly skin check if you have many moles or family history.</li>' : ''}
          <li>For a tan, sunless tanner (DHA) is safe. Tanning beds cause melanoma, and tanning injections are unapproved.</li></ul></section>
        <section class="card"><div class="card-h"><h2>See a dermatologist</h2></div><ul class="ath-list">
          <li class="lk-red">A mole that changes in size, shape or colour, bleeds, or looks unlike your others; a sore that won't heal.</li>
          <li class="lk-red">Painful deep acne or any scarring: prescription treatment early prevents permanent marks.</li>
          <li class="lk-red">Sudden patchy hair loss, or a spreading rash with fever or blisters (urgent).</li></ul>
          <p class="small">Options a dermatologist may discuss: ${DERM_RX.map(esc).join('; ')}. They decide if and how; Myo doesn't dose them.</p></section></div>`;
  }

  function tFace(s, L) {
    return `<section class="card"><div class="card-h"><h2>Face and grooming levers</h2><span class="muted small">Tick the ones in your plan</span></div>
      <div class="lk-levers">${FACE.map(([k, n, g, what, how]) => `<label class="lk-lv ${L.face[k] ? 'on' : ''}"><input type="checkbox" data-change="lk-face" data-k="${k}" ${L.face[k] ? 'checked' : ''}><span><span class="lk-ri"><b>${esc(n)}</b>${gp(g)}</span><span class="small">${esc(what)}</span><span class="small muted">${esc(how)}</span></span></label>`).join('')}</div></section>
      <section class="card"><div class="card-h"><h2>Trends to skip</h2><span class="muted small">Popular online, not backed or harmful</span></div>
        <ul class="lk-myth">${MYTHS.map(([n, g, t]) => `<li><div class="lk-ri"><b>${esc(n)}</b>${gp(g)}</div><span class="small">${esc(t)}</span></li>`).join('')}</ul></section>`;
  }

  function tProc(s, L) {
    const age = s.profile && +s.profile.age, minor = age && age < 18, flags = SELF.filter(([k]) => L.self[k]).length;
    const list = PROCS.filter((p) => pcat === 'all' || p[1] === pcat), short = PROCS.filter((p) => L.short.includes(p[0]));
    return `${minor ? '<div class="banner warn" role="note"><strong>Cosmetic procedures aren\'t covered for under-18s.</strong> The information below is for learning only; bodies and faces are still changing.</div>' : ''}
      ${flags >= 3 || (L.self.life && flags >= 2) ? `<div class="banner warn" role="note"><strong>Pause before booking anything.</strong> What you ticked can be signs of body dysmorphic disorder, which is common and treatable, usually with CBT. Procedures rarely ease it. A doctor or therapist is a good first step. If you have thoughts of harming yourself, call your local emergency number or a crisis line (988 in the US).</div>` : ''}
      <section class="card"><div class="card-h"><h2>Before you book: a self-check</h2><span class="muted small">Private, stays on this device</span></div>
        <ul class="rc-screen">${SELF.map(([k, n]) => `<li><label class="ped-use"><input type="checkbox" data-change="lk-self" data-k="${k}" ${L.self[k] ? 'checked' : ''}> ${esc(n)}</label></li>`).join('')}</ul></section>
      <section class="card"><div class="card-h"><h2>Procedures and implants</h2><div class="seg" role="group" aria-label="Filter">${PCAT.map(([k, n]) => `<button type="button" class="${pcat === k ? 'on' : ''}" data-act="lk-pcat" data-k="${k}">${n}</button>`).join('')}</div></div>
        <div class="lk-procs">${list.map(([k, , n, does, who, down, lasts, cost, risks]) => `<article class="lk-pr ${L.short.includes(k) ? 'on' : ''}"><div class="lk-ri"><b>${esc(n)}</b><span class="lk-cost" title="Cost tier">${esc(cost)}</span></div>
          <p class="small">${esc(does)}</p><dl><div><dt>Who</dt><dd>${esc(who)}</dd></div><div><dt>Downtime</dt><dd>${esc(down)}</dd></div><div><dt>Lasts</dt><dd>${esc(lasts)}</dd></div></dl>
          <p class="small lk-risk">${icon('alert', 13)} ${esc(risks)}</p>${minor ? '' : `<button type="button" class="btn ${L.short.includes(k) ? '' : 'ghost'} sm" data-act="lk-short" data-k="${k}" aria-pressed="${L.short.includes(k)}">${L.short.includes(k) ? 'On consult list' : 'Add to consult list'}</button>`}</article>`).join('')}</div>
        <p class="fine">Cost tiers (US, very approximate): $ under $500 · $$ $500–2,500 · $$$ $2,500–8,000 · $$$$ over $8,000. Myo gives no medical advice on whether a procedure suits you; a board-certified specialist does.</p></section>
      ${short.length ? `<section class="card"><div class="card-h"><h2>Consult checklist</h2><span class="muted small">${short.map((p) => esc(p[2])).join(' · ')}</span></div>
        <ul class="rc-screen">${CONSULT.map((c, i) => `<li><label class="ped-use"><input type="checkbox" data-change="lk-cons" data-i="${i}" ${(L.consult || {})[i] ? 'checked' : ''}> ${esc(c)}</label></li>`).join('')}</ul><p class="fine">Bring this list and your photos to the consult. Questions to ask: what result is realistic for me, what if I don't like it, and how many of these did you do last year?</p></section>` : ''}
      <section class="card"><div class="card-h"><h2>Never do these</h2></div><ul class="lk-myth">${DANGER.map(([n, t]) => `<li><div class="lk-ri"><b>${esc(n)}</b>${gp('X')}</div><span class="small">${esc(t)}</span></li>`).join('')}</ul></section>`;
  }

  function tProg(s, L) {
    const ph = ((OS.Scan && OS.Scan.photos) || []).filter((p) => p.blob), url = (p) => urls[p.id] || (urls[p.id] = URL.createObjectURL(p.blob));
    if (ph.length && (!pa || !ph.some((p) => p.id === pa))) pa = ph[0].id;
    if (ph.length && (!pb || !ph.some((p) => p.id === pb))) pb = ph[ph.length - 1].id;
    const A = ph.find((p) => p.id === pa), B = ph.find((p) => p.id === pb), opt = (sel) => ph.map((p) => `<option value="${esc(p.id)}" ${p.id === sel ? 'selected' : ''}>${esc(p.date.slice(0, 10))}${p.metrics && p.metrics.view && p.metrics.view !== 'none' ? ' · ' + esc(p.metrics.view) : ''}</option>`).join('');
    const ms = [...L.meas].sort((a, b) => a.d.localeCompare(b.d)), sex = sexOf(s, L), h = hOf(s, L);
    const ser = (f) => ms.map((m) => f(m)).filter((x) => x != null && Number.isFinite(x));
    const trend = [['Weight', (m) => m.weight, 'kg'], ['Waist', (m) => m.waist, 'cm'], ['Shoulders', (m) => m.shoulders, 'cm'], ['Body fat', (m) => (bodyFat(m, sex, h) || {}).v, '%'], ['Shoulder : waist', (m) => (m.shoulders && m.waist ? r2(m.shoulders / m.waist) : null), '']];
    return `<div class="grid g-2">
      <section class="card"><div class="card-h"><h2>Before and after</h2><label class="btn sm file">${icon('upload', 14)} Add photo<input type="file" accept="image/*" data-change="scan-file"></label></div>
        ${A && B ? `<div class="row lk-pick"><label class="field-inline small">Before <select data-change="lk-pa">${opt(pa)}</select></label><label class="field-inline small">After <select data-change="lk-pb">${opt(pb)}</select></label></div>
          <div class="lk-cmp" style="--cut:50%"><img src="${url(A)}" alt="Before, ${esc(A.date.slice(0, 10))}"><img src="${url(B)}" class="b" alt="After, ${esc(B.date.slice(0, 10))}"><span class="lk-cut" aria-hidden="true"></span><input type="range" class="lk-cmp-range" min="0" max="100" value="50" aria-label="Slide between before and after"></div>`
          : '<p class="muted small">Add front, side and back photos every 4 weeks. They are shared with Body Scan, which measures shoulder : hip and posture from them.</p>'}
        <p class="fine">Same spot, light, distance and time of day; relaxed, then flexed. Photos never leave this device.</p></section>
      <section class="card"><div class="card-h"><h2>Trends</h2><span class="muted small">${ms.length} check-ins</span></div>
        ${ms.length ? `<ul class="lk-trend">${trend.map(([n, f, u]) => { const v = ser(f); if (!v.length) return ''; const d = v[v.length - 1] - v[0]; return `<li><span>${n}</span>${v.length > 1 ? OS.spark(v, 110, 28) : '<span></span>'}<b class="num">${v[v.length - 1]}${u ? ' ' + u : ''}</b><small class="num">${v.length > 1 ? (d >= 0 ? '+' : '−') + n1(Math.abs(d), u ? 1 : 2) : ''}</small></li>`; }).join('')}</ul>
          <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Date</th><th>Weight</th><th>Waist</th><th>Shoulders</th><th>Hips</th><th></th></tr></thead><tbody>${ms.slice().reverse().map((m) => `<tr><td class="num">${esc(m.d)}${m.sample ? ' <span class="chip">Example</span>' : ''}</td><td class="num">${n1(m.weight)}</td><td class="num">${n1(m.waist)}</td><td class="num">${n1(m.shoulders)}</td><td class="num">${n1(m.hips)}</td><td><button class="icon-btn" data-act="lk-mdel" data-d="${esc(m.d)}" aria-label="Delete ${esc(m.d)}">×</button></td></tr>`).join('')}</tbody></table></div>`
          : '<p class="muted small">No measurements yet.</p><button class="btn ghost sm" data-act="lk-sample">Load example measurements</button>'}</section></div>`;
  }

  /* ── actions ── */
  OS.act('lk-tab', (el) => { tab = el.dataset.t; try { localStorage.setItem('myo-looks-tab', tab); } catch {} OS.render(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  OS.act('lk-go', (el) => OS.go(el.dataset.go));
  OS.act('lk-meas', (f) => {
    const e = f.elements, m = { d: e.d.value || dayKey() };
    FIELDS.forEach(([k]) => { const v = parseFloat(e[k].value); if (Number.isFinite(v) && v > 0) m[k] = v; });
    if (!m.weight || !m.waist || !m.shoulders || !m.hips) { OS.toast('Weight, waist, shoulders and hips are needed.'); return; }
    if (m.bf && (m.bf < 3 || m.bf > 60)) { OS.toast('Body fat should be between 3 and 60%.'); return; }
    OS.update((s) => { const L = ensure(s); L.meas = L.meas.filter((x) => x.d !== m.d); L.meas.push(m); L.sex = e.sex.value; L.tage = +e.tage.value; const hv = parseFloat(e.hCm.value); if (hv >= 120 && hv <= 230) L.hCm = hv; }, { keepSample: true });
    OS.toast('Measurements saved.');
  });
  OS.act('lk-mdel', (el) => OS.update((s) => { const L = ensure(s); L.meas = L.meas.filter((x) => x.d !== el.dataset.d); }, { keepSample: true }));
  OS.act('lk-arch', (el) => OS.update((s) => { ensure(s).arch = el.dataset.k; }, { keepSample: true }));
  OS.act('lk-fitz', (el) => OS.update((s) => { ensure(s).skin.fitz = el.dataset.k; }, { keepSample: true }));
  OS.act('lk-stype', (el) => OS.update((s) => { ensure(s).skin.type = el.dataset.k; }, { keepSample: true }));
  OS.change('lk-conc', (el) => OS.update((s) => { const sk = ensure(s).skin, k = el.dataset.k; sk.concerns = sk.concerns.filter((x) => x !== k); if (el.checked) sk.concerns.push(k); }, { keepSample: true }));
  OS.change('lk-face', (el) => OS.update((s) => { ensure(s).face[el.dataset.k] = el.checked; }, { keepSample: true }));
  OS.change('lk-cons', (el) => OS.update((s) => { const L = ensure(s); L.consult = { ...(L.consult || {}), [el.dataset.i]: el.checked }; }, { keepSample: true }));
  OS.change('lk-self', (el) => OS.update((s) => { ensure(s).self[el.dataset.k] = el.checked; }, { keepSample: true }));
  OS.act('lk-short', (el) => OS.update((s) => { const L = ensure(s), k = el.dataset.k; L.short = L.short.includes(k) ? L.short.filter((x) => x !== k) : [...L.short, k]; }, { keepSample: true }));
  OS.act('lk-pcat', (el) => { pcat = el.dataset.k; OS.render(); });
  OS.change('lk-pa', (el) => { pa = el.value; OS.render(); });
  OS.change('lk-pb', (el) => { pb = el.value; OS.render(); });
  OS.act('lk-sample', () => {
    OS.update((s) => {
      const L = ensure(s), sex = sexOf(s, L), d = (n) => dayKey(new Date(Date.now() - n * 864e5));
      const ex = sex === 'M'
        ? [[56, 84, 92, 116, 100, 101, 38.5, 36, 58, 37.5], [28, 82.6, 89.5, 117, 100.5, 99.5, 38.5, 36.3, 57.5, 37.5], [0, 81.4, 87.2, 118, 101, 98.5, 38.6, 36.7, 57.5, 37.8]]
        : [[56, 66, 78, 100, 88, 102, 32.5, 29, 58, 36], [28, 65.2, 76.5, 100.5, 88.5, 101.5, 32.4, 29.2, 57.8, 36], [0, 64.5, 75, 101, 89, 101.5, 32.3, 29.5, 57.8, 36.2]];
      ex.forEach(([ago, weight, waist, shoulders, chest, hips, neck, arm, thigh, calf]) => { const m = { d: d(ago), weight, waist, shoulders, chest, hips, neck, arm, thigh, calf, sample: true }; L.meas = L.meas.filter((x) => x.d !== m.d); L.meas.push(m); });
      if (!L.arch) L.arch = sex === 'M' ? 'vtaper' : 'xframe';
    }, { keepSample: true });
    OS.toast('Loaded 3 example check-ins, marked as examples.');
  });
  OS.act('lk-coach', () => {
    const s = OS.state, L = ensure(s), P = project(s, L); if (!P) return;
    const ph = P.phases[0];
    const msg = `Write me a 4-week training block for a ${P.A.name} build. Priority muscles: ${P.A.hi.map((g) => MUS[g]).join(', ')} (14–20 hard sets a week); secondary: ${P.A.hi2.map((g) => MUS[g]).join(', ')} (10–14). Lifting experience: ${TAGE[L.tage ?? 1]}. I'm in the ${ph.name.toLowerCase()} phase at about ${ph.kcal} kcal and ${ph.protein} g protein. Current shoulder : waist ${n1(P.st.swr, 2)}, body fat about ${P.st.bf.v}%.`;
    OS.go('coach'); setTimeout(() => { if (OS.coachSend) OS.coachSend(msg); }, 150);
  });

  OS.looks = { bodyFat, stats, project, routine };
})();
