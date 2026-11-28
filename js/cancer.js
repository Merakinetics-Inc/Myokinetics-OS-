/* ═══ MYO — CANCER EARLY-DETECTION SUPPORT: screening on time, warning signs noticed, the right questions asked ═══
   Myo does not detect or diagnose cancer. Detection needs a regulated diagnostic test or device. This page helps
   with what a member can do:
   Plan      · a screening plan from age, organs and risk (USPSTF recommendations; ACS where USPSTF is silent on
               higher risk), with the next due date from the member's own results and due items on the Care calendar
   Signs     · warning signs that need a clinician within two weeks, and the few that need emergency care now
   Your data · patterns in Myo data worth raising with a clinician (iron-deficiency anemia, weight loss without
               trying, new diabetes with weight loss after 50, persistent inflammation), each with its source
   Tests     · what each screening test is, how often, and its limits, including multi-cancer blood tests
   Results   · a log of screenings with results; a result that needs follow-up shows until it's marked done
   Everything stays on this device. */
(function () {
  'use strict';
  const { esc, icon, pill, dayKey, addDays, fmtDate, uid } = OS;
  const TABS = [['plan', 'Screening plan'], ['signs', 'Warning signs'], ['data', 'Your data'], ['tests', 'Tests explained'], ['log', 'Results']];
  const CX = { tab: 'plan' };
  const USPSTF = (p) => `https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/${p}`;
  const SRC = {
    breast: ['USPSTF 2024: breast cancer screening', USPSTF('breast-cancer-screening')],
    cervical: ['USPSTF 2018: cervical cancer screening', USPSTF('cervical-cancer-screening')],
    colorectal: ['USPSTF 2021: colorectal cancer screening', USPSTF('colorectal-cancer-screening')],
    lung: ['USPSTF 2021: lung cancer screening', USPSTF('lung-cancer-screening')],
    prostate: ['USPSTF 2018: prostate cancer screening', USPSTF('prostate-cancer-screening')],
    skin: ['USPSTF 2023: skin cancer screening', USPSTF('skin-cancer-screening')],
    brca: ['USPSTF 2019: BRCA risk assessment and genetic counseling', USPSTF('brca-related-cancer-risk-assessment-genetic-counseling-and-genetic-testing')],
    hepc: ['USPSTF 2020: hepatitis C screening', USPSTF('hepatitis-c-screening')],
    acs: ['American Cancer Society: early detection guidelines', 'https://www.cancer.org/cancer/screening/american-cancer-society-guidelines-for-the-early-detection-of-cancer.html'],
    nice: ['NICE NG12: suspected cancer, recognition and referral', 'https://www.nice.org.uk/guidance/ng12'],
    nci: ['National Cancer Institute: cancer screening', 'https://www.cancer.gov/about-cancer/screening']
  };
  const src = (k) => { const x = SRC[k]; return x ? `<a href="${x[1]}" target="_blank" rel="noopener">${esc(x[0])}</a>` : ''; };

  // screening tests: id → [label, screening, years until the next one after a normal result]
  const TESTS = {
    mammo: ['Mammogram', 'breast', 2], bmri: ['Breast MRI', 'breast', 1],
    pap: ['Pap test (cytology)', 'cervical', 3], hpv: ['HPV test', 'cervical', 5], cotest: ['Pap and HPV together', 'cervical', 5],
    colo: ['Colonoscopy', 'colorectal', 10], fit: ['Stool test (FIT)', 'colorectal', 1], sdna: ['Stool DNA-FIT test', 'colorectal', 3],
    ctc: ['CT colonography', 'colorectal', 5], sig: ['Flexible sigmoidoscopy', 'colorectal', 5], crcblood: ['Colorectal blood test', 'colorectal', 3],
    ldct: ['Low-dose lung CT', 'lung', 1], psa: ['PSA blood test', 'prostate', 2], skin: ['Skin check by a clinician', 'skin', 1],
    liverus: ['Liver ultrasound', 'liver', 0.5], gen: ['Genetic counseling or testing', 'brca', 0], mced: ['Multi-cancer blood test', 'mced', 0], other: ['Other', 'other', 0]
  };
  const RESULT = { normal: ['good', 'Normal'], follow: ['warn', 'Needs follow-up'], done: ['good', 'Follow-up done'], unsure: ['muted', 'Waiting for results'] };

  function ensure(s) {
    if (!s.cancer) {
      const f = s.profile && s.profile.sex === 'F';
      s.cancer = { risk: { breast: f, cervix: f, prostate: !f, smoke: 'never', packs: '', years: '', quit: '', famBreast: false, famCrc: '', famProstate: false, black: false, brca: false, lynch: false, ibd: false, chestRad: false, liver: false }, tests: [], signs: [] };
      if (s.sample) s.cancer.tests.push({ id: uid(), kind: 'skin', d: dayKey(addDays(new Date(), -240)), result: 'normal', note: 'Sample entry: mole check at a routine visit' });
    }
    return s.cancer;
  }
  const packYears = (r) => r.smoke === 'never' ? 0 : Math.round((+r.packs || 0) * (+r.years || 0) * 10) / 10;
  const yearsSinceQuit = (r) => r.smoke === 'former' && r.quit ? new Date().getFullYear() - +r.quit : 0;
  const plus = (d, yrs) => dayKey(addDays(new Date(`${d}T12:00:00`), Math.round(yrs * 365.25)));
  const lastOf = (C, scr) => (C.tests || []).filter((t) => TESTS[t.kind] && TESTS[t.kind][1] === scr).sort((a, b) => b.d.localeCompare(a.d))[0];

  /* ── the plan ── each item: { k, name, st, line, tests, src, next } ── */
  function plan(s) {
    const C = ensure(s), r = C.risk, age = +(s.profile && s.profile.age) || 0, today = dayKey(new Date()), out = [];
    const timing = (k, years) => {   // up to date / due, from the newest logged test for this screening
      const t = lastOf(C, k);
      if (!t) return { st: 'due', next: today, note: 'No test logged in Myo yet.' };
      if (t.result === 'follow') return { st: 'follow', next: null, note: `Your ${TESTS[t.kind][0].toLowerCase()} on ${fmtDate(t.d)} needs follow-up. Follow your clinician's plan, then mark it done in Results.` };
      if (t.result === 'unsure') return { st: 'wait', next: null, note: `Waiting for the result of your ${TESTS[t.kind][0].toLowerCase()} on ${fmtDate(t.d)}.` };
      const yrs = TESTS[t.kind][2] || years, next = plus(t.d, yrs);
      return next <= today ? { st: 'due', next: today, note: `Last: ${TESTS[t.kind][0].toLowerCase()} on ${fmtDate(t.d)}.` } : { st: next <= dayKey(addDays(new Date(), 90)) ? 'soon' : 'ok', next, note: `Last: ${TESTS[t.kind][0].toLowerCase()} on ${fmtDate(t.d)}. Next by ${fmtDate(next)}.` };
    };
    const add = (o) => out.push(o);

    if (r.breast) {
      if (r.brca || r.chestRad) add({ k: 'breast', name: 'Breast', st: 'discuss', line: 'A BRCA variant or chest radiation when young means higher risk. Ask about yearly MRI and mammogram, often from about 30.', tests: 'Mammogram and breast MRI', src: 'acs' });
      else if (age >= 40 && age <= 74) add({ k: 'breast', name: 'Breast', ...timing('breast', 2), line: 'Mammogram every 2 years from 40 to 74.', tests: 'Mammogram', src: 'breast' });
      else if (age < 40) add({ k: 'breast', name: 'Breast', st: 'later', line: `Routine mammograms start at 40${age ? `, in ${40 - age} year${40 - age === 1 ? '' : 's'}` : ''}. Know how your breasts normally look and feel.`, tests: 'Mammogram', src: 'breast' });
      else add({ k: 'breast', name: 'Breast', st: 'discuss', line: 'From 75 the evidence is unclear. Decide with your clinician based on your health.', tests: 'Mammogram', src: 'breast' });
      if (r.famBreast && !r.brca) add({ k: 'brca', name: 'Inherited risk (BRCA)', st: 'discuss', line: 'A family history of breast, ovarian, tubal or peritoneal cancer: ask for a risk assessment, and genetic counseling if it shows higher risk.', tests: 'Risk assessment tool, then genetic counseling', src: 'brca' });
    }
    if (r.cervix) {
      if (age >= 21 && age <= 29) add({ k: 'cervical', name: 'Cervical', ...timing('cervical', 3), line: 'Pap test every 3 years from 21 to 29.', tests: 'Pap test', src: 'cervical' });
      else if (age >= 30 && age <= 65) add({ k: 'cervical', name: 'Cervical', ...timing('cervical', 5), line: 'From 30 to 65: an HPV test every 5 years, a Pap test every 3, or both together every 5.', tests: 'HPV test, Pap test, or both', src: 'cervical' });
      else if (age > 65) add({ k: 'cervical', name: 'Cervical', st: 'none', line: 'After 65 you can usually stop if past results were normal and you are not at high risk. Check with your clinician.', tests: '', src: 'cervical' });
      else add({ k: 'cervical', name: 'Cervical', st: 'later', line: 'Screening starts at 21. The HPV vaccine protects best when given young.', tests: 'Pap test', src: 'cervical' });
    }
    // colorectal: family history moves the start earlier (ACS and the US Multi-Society Task Force)
    const famAge = +r.famCrc || 0, crcStart = famAge ? Math.max(18, Math.min(40, famAge - 10)) : 45;
    if (r.lynch || r.ibd) add({ k: 'colorectal', name: 'Colorectal', st: 'discuss', line: `${r.lynch ? 'Lynch syndrome' : 'Inflammatory bowel disease'} needs colonoscopy more often and earlier, set by your specialist (often every 1 to 2 years).`, tests: 'Colonoscopy', src: 'acs' });
    else if (famAge && age >= crcStart && age <= 75) add({ k: 'colorectal', name: 'Colorectal', ...timing('colorectal', 5), line: `A parent, sibling or child with colorectal cancer: colonoscopy every 5 years from ${crcStart} (40, or 10 years before their age at diagnosis).`, tests: 'Colonoscopy', src: 'acs' });
    else if (age >= 45 && age <= 75) add({ k: 'colorectal', name: 'Colorectal', ...timing('colorectal', 10), line: 'From 45 to 75. Choose a test with your clinician: a stool test every year, stool DNA every 1 to 3 years, CT colonography every 5, or colonoscopy every 10.', tests: 'Stool test or colonoscopy', src: 'colorectal' });
    else if (age > 75 && age <= 85) add({ k: 'colorectal', name: 'Colorectal', st: 'discuss', line: 'From 76 to 85, decide with your clinician based on your health and past screening.', tests: '', src: 'colorectal' });
    else if (age < crcStart) add({ k: 'colorectal', name: 'Colorectal', st: 'later', line: `Screening starts at ${crcStart}${age ? `, in ${crcStart - age} year${crcStart - age === 1 ? '' : 's'}` : ''}. Blood in your stool or a lasting change in bowel habit needs a clinician at any age.`, tests: 'Stool test or colonoscopy', src: famAge ? 'acs' : 'colorectal' });
    // lung: 50 to 80, 20 pack-years, smoking now or quit in the last 15 years
    const py = packYears(r), q = yearsSinceQuit(r);
    if (r.smoke !== 'never') {
      if (age >= 50 && age <= 80 && py >= 20 && (r.smoke === 'current' || q <= 15)) add({ k: 'lung', name: 'Lung', ...timing('lung', 1), line: `Yearly low-dose CT: you're 50 to 80 with ${py} pack-years${r.smoke === 'former' ? `, quit ${q} year${q === 1 ? '' : 's'} ago` : ''}. Quitting is the biggest single step.`, tests: 'Low-dose CT', src: 'lung' });
      else add({ k: 'lung', name: 'Lung', st: r.smoke === 'former' && q > 15 ? 'none' : 'later', line: py < 20 ? `Screening needs 20 pack-years or more (you have ${py}). ${r.smoke === 'current' ? 'Quitting at any age lowers your risk.' : ''}` : age < 50 ? 'Screening starts at 50 with your smoking history.' : 'More than 15 years since quitting: screening is no longer recommended.', tests: 'Low-dose CT', src: 'lung' });
    }
    if (r.prostate) {
      const high = r.black || r.famProstate;
      if (age >= 55 && age <= 69) add({ k: 'prostate', name: 'Prostate', st: 'discuss', ...(lastOf(C, 'prostate') ? { note: timing('prostate', 2).note } : {}), line: 'From 55 to 69, PSA testing is your choice: it can find cancer early but also leads to false alarms and treatment of cancers that would never harm you. Decide with your clinician.', tests: 'PSA blood test', src: 'prostate' });
      else if (age >= 70) add({ k: 'prostate', name: 'Prostate', st: 'none', line: 'From 70, routine PSA screening is not recommended.', tests: '', src: 'prostate' });
      else if (high && age >= 40) add({ k: 'prostate', name: 'Prostate', st: 'discuss', line: 'Higher risk (Black ancestry, or a father or brother with prostate cancer): talk about PSA testing from 40 to 45.', tests: 'PSA blood test', src: 'acs' });
      else add({ k: 'prostate', name: 'Prostate', st: 'later', line: `The PSA conversation starts at ${high ? 40 : 55}.`, tests: 'PSA blood test', src: high ? 'acs' : 'prostate' });
    }
    if (r.liver) add({ k: 'liver', name: 'Liver', ...timing('liver', 0.5), line: 'Cirrhosis or chronic hepatitis B: specialists advise an ultrasound every 6 months, often with an AFP blood test.', tests: 'Liver ultrasound', src: 'acs' });
    add({ k: 'skin', name: 'Skin', st: 'self', line: 'No routine skin exam is recommended for everyone. Check your own skin each month and show a clinician any mole that changes (ABCDE below).', tests: 'Self-check', src: 'skin' });
    return out;
  }
  const ST = { due: ['bad', 'Due now'], soon: ['warn', 'Due soon'], ok: ['good', 'Up to date'], follow: ['warn', 'Follow-up'], wait: ['muted', 'Waiting'], discuss: ['muted', 'Talk to your clinician'], later: ['muted', 'Not yet'], none: ['muted', 'Not needed'], self: ['muted', 'Self-check'] };
  // for the Care calendar: due items today, upcoming ones on their date
  function calendar(s) {
    return plan(s).filter((p) => p.next && ['due', 'soon', 'ok'].includes(p.st)).map((p) => ({ d: p.next, title: `${p.st === 'due' ? 'Due: ' : ''}${p.name} cancer screening${p.tests ? ` (${p.tests.toLowerCase()})` : ''}` }));
  }

  /* ── warning signs (NICE NG12, ACS) ── */
  const NOW = ['Vomiting blood, or black tarry stool with dizziness or fainting', 'Coughing up more than a little blood', 'New back pain with leg weakness, numbness, or loss of bladder or bowel control'];
  const SIGNS = [
    ['wt', 'Losing weight without trying (5% or more in 6 to 12 months)'], ['lump', 'A new lump or swelling: breast, testicle, neck, armpit or groin'],
    ['bowel', 'Blood in your stool, or a change in bowel habit lasting 3 weeks or more'], ['urine', 'Blood in your urine'],
    ['cough', 'Coughing up blood, or a cough or hoarse voice lasting 3 weeks or more'], ['swallow', 'Trouble swallowing, or heartburn or indigestion lasting 3 weeks or more'],
    ['bleed', 'Bleeding after menopause, between periods or after sex'], ['bloat', 'Bloating most days for 3 weeks or more'],
    ['mole', 'A mole that changes, or a sore or spot that does not heal in 3 to 4 weeks'], ['sweat', 'Night sweats, fevers or tiredness without a reason, for 3 weeks or more'],
    ['bruise', 'Bruising or bleeding you can\'t explain'], ['pain', 'New pain that lasts 3 weeks or more (bone, back or belly)'],
    ['mouth', 'A mouth ulcer, or a red or white patch, lasting 3 weeks or more'], ['breast', 'A change in a breast: dimpled skin, a turned-in nipple or nipple discharge']
  ];
  const ABCDE = [['A', 'Asymmetry', 'one half differs from the other'], ['B', 'Border', 'ragged, notched or blurred'], ['C', 'Colour', 'several shades, or changing'], ['D', 'Diameter', 'larger than 6 mm, or growing'], ['E', 'Evolving', 'any change in size, shape, colour, itching or bleeding']];

  /* ── patterns in Myo data worth raising (never a finding, always with a source) ── */
  function signals(s) {
    const out = [], mk = (id) => s.markers.find((m) => m.id === id), val = (m) => (m && OS.hasValue(m) ? Number(m.value) : null);
    const age = +(s.profile && s.profile.age) || 0, f = s.profile && s.profile.sex === 'F';
    const hgb = val(mk('hgb')), ferr = val(mk('ferr')), crp = val(mk('crp')), a1c = mk('a1c');
    const lowHb = hgb != null && hgb < (f ? 12 : 13);
    if (lowHb && ferr != null && ferr < 30) out.push({ t: 'Iron-deficiency anemia', d: `Hemoglobin ${hgb} g/dL and ferritin ${ferr} ng/mL. In men, and in women after menopause, this needs a clinician to look for a cause, which can include slow bleeding in the gut.`, src: 'nice', lvl: 'warn' });
    else if (lowHb) out.push({ t: 'Low hemoglobin', d: `Hemoglobin ${hgb} g/dL is below the usual range. Ask your clinician what is causing it.`, src: 'nice', lvl: 'warn' });
    // weight: body-composition weigh-ins over the last 6 to 12 months, when you aren't trying to lose weight
    const W = ((s.bodycomp && s.bodycomp.scans) || []).map((x) => ({ d: x.d, w: Number(x.w || x.weight) })).filter((x) => x.d && x.w > 0).sort((a, b) => a.d.localeCompare(b.d));
    const lost = (() => { if (W.length < 2) return null; const end = W[W.length - 1], from = dayKey(addDays(new Date(`${end.d}T12:00:00`), -365)), base = W.filter((x) => x.d >= from); if (!base.length) return null; const top = base.reduce((a, b) => (b.w > a.w ? b : a)); return top.w > 0 && top.d < end.d ? { pct: Math.round(((top.w - end.w) / top.w) * 1000) / 10, from: top.d, to: end.d } : null; })();
    const trying = s.profile && s.profile.goal === 'cut';
    if (lost && lost.pct >= 5 && !trying) out.push({ t: 'Weight loss without a weight-loss goal', d: `Down ${lost.pct}% since ${fmtDate(lost.from)}. Losing 5% or more without trying is worth raising with a clinician.`, src: 'nice', lvl: 'warn' });
    // new diabetes after 50 alongside weight loss (NICE NG12 pancreas)
    if (a1c && OS.hasValue(a1c) && Number(a1c.value) >= 6.5 && age >= 50 && lost && lost.pct >= 5 && (a1c.history || []).some((h) => Number(h[1]) < 6.5)) out.push({ t: 'New high blood sugar with weight loss', d: `HbA1c rose to ${a1c.value}% while your weight fell. After 50, this combination is one clinicians check further.`, src: 'nice', lvl: 'warn' });
    if (crp != null && crp > 10) out.push({ t: 'High inflammation marker', d: `hs-CRP ${crp} mg/L. Usually an infection or injury; if it stays high on a repeat test without a reason, ask your clinician.`, src: 'nci', lvl: 'muted' });
    const ticked = (ensure(s).signs || []).filter((x) => x.d >= dayKey(addDays(new Date(), -60)));
    if (ticked.length) out.push({ t: `${ticked.length} warning sign${ticked.length === 1 ? '' : 's'} noted in the last 60 days`, d: ticked.map((x) => (SIGNS.find((y) => y[0] === x.k) || [, x.k])[1]).join('; ') + '.', src: 'nice', lvl: 'warn' });
    return out;
  }

  /* ── view ── */
  function planTab(s) {
    const C = ensure(s), r = C.risk, P = plan(s), age = +(s.profile && s.profile.age) || 0;
    const chk = (k, l) => `<label class="cx-chk"><input type="checkbox" data-change="cx-risk" data-k="${k}" ${r[k] ? 'checked' : ''}> ${l}</label>`;
    const due = P.filter((p) => p.st === 'due' || p.st === 'follow').length;
    return `<div class="grid g-2 cx-top">
      <section class="card"><div class="card-h"><h2>Your screening plan</h2><span class="muted small">${age ? `Age ${age}` : '<a href="#profile">Add your age</a>'}${due ? ` · ${due} to act on` : ''}</span></div>
        <ul class="cx-plan">${P.map((p) => `<li class="cx-p st-${p.st}"><div class="cx-ph"><b>${esc(p.name)}</b>${pill(...ST[p.st])}</div><p class="small">${esc(p.line)}</p>${p.note ? `<p class="small muted">${esc(p.note)}</p>` : ''}
          <p class="fine">${src(p.src)}${p.st === 'due' || p.st === 'soon' || p.st === 'discuss' ? ` · <button class="link small" data-act="cx-book" data-t="${esc(`${p.name} cancer screening`)}">Book it in Care</button>` : ''}</p></li>`).join('')}</ul></section>
      <section class="card"><div class="card-h"><h2>About you</h2><span class="muted small">Changes the plan; stays on this device</span></div>
        <div class="cx-risk">
          <fieldset><legend>Screen the organs you have</legend>${chk('breast', 'Breasts')}${chk('cervix', 'Cervix')}${chk('prostate', 'Prostate')}</fieldset>
          <fieldset><legend>Smoking</legend><div class="seg sm" role="group" aria-label="Smoking">${[['never', 'Never'], ['current', 'Smoke now'], ['former', 'Quit']].map(([v, l]) => `<button type="button" aria-pressed="${r.smoke === v}" data-act="cx-smoke" data-v="${v}">${l}</button>`).join('')}</div>
            ${r.smoke !== 'never' ? `<div class="form-grid cx-sm"><label class="field" for="cx-packs"><span>Packs a day</span><input id="cx-packs" type="number" min="0" max="6" step="0.25" data-change="cx-num" data-k="packs" value="${esc(r.packs)}"></label><label class="field" for="cx-years"><span>Years smoked</span><input id="cx-years" type="number" min="0" max="80" data-change="cx-num" data-k="years" value="${esc(r.years)}"></label>${r.smoke === 'former' ? `<label class="field" for="cx-quit"><span>Year you quit</span><input id="cx-quit" type="number" min="1940" max="${new Date().getFullYear()}" data-change="cx-num" data-k="quit" value="${esc(r.quit)}"></label>` : ''}</div><p class="fine">${packYears(r)} pack-years (packs a day × years).</p>` : ''}</fieldset>
          <fieldset><legend>Family (parents, siblings, children)</legend>${chk('famBreast', 'Breast, ovarian, tubal or peritoneal cancer')}${chk('famProstate', 'Prostate cancer (father or brother)')}
            <label class="field cx-inline" for="cx-famcrc"><span>Colorectal cancer: their age at diagnosis</span><input id="cx-famcrc" type="number" min="0" max="100" placeholder="none" data-change="cx-num" data-k="famCrc" value="${esc(r.famCrc)}"></label></fieldset>
          <fieldset><legend>Your history</legend>${chk('brca', 'BRCA or another inherited cancer gene')}${chk('lynch', 'Lynch syndrome')}${chk('ibd', "Crohn's or ulcerative colitis for 8+ years")}${chk('chestRad', 'Radiation to the chest before 30')}${chk('liver', 'Cirrhosis or chronic hepatitis B')}${r.prostate ? chk('black', 'Black or African ancestry (higher prostate risk)') : ''}</fieldset>
        </div></section>
    </div>
    <section class="card"><div class="card-h"><h2>Lower your risk</h2><span class="muted small">Prevention that screening can't replace</span></div>
      <ul class="cx-prev">${[['Don\'t smoke or vape', 'Smoking causes about 1 in 5 cancers. Quitting helps at any age.'], ['HPV vaccine', 'Recommended through 26; from 27 to 45, ask your clinician. Prevents most cervical and many throat cancers.'], ['Hepatitis B vaccine and a one-time hepatitis C test', 'Protects the liver. Every adult 18 to 79 should be tested once for hepatitis C.'], ['Less alcohol', 'Risk rises with every drink; none is safest.'], ['Sun protection', 'Shade, clothing and SPF 30+; no tanning beds.'], ['Move, and keep a healthy weight', 'Linked to lower risk of at least 13 cancers.']].map(([a, b]) => `<li><b>${a}</b><span class="muted small">${b}</span></li>`).join('')}</ul>
      <p class="fine">${src('hepc')} · ${src('acs')}</p></section>`;
  }
  function signsTab(s) {
    const C = ensure(s), today = dayKey(new Date()), on = new Set((C.signs || []).filter((x) => x.d >= dayKey(addDays(new Date(), -60))).map((x) => x.k));
    return `<section class="card cx-now" role="note"><div class="card-h"><h2>${icon('sos', 18)} Get emergency care now</h2><button class="btn sm" data-act="go" data-to="emergency">Emergency</button></div>
        <ul>${NOW.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
      <section class="card"><div class="card-h"><h2>See a clinician within 2 weeks</h2><span class="muted small">Most of the time these turn out not to be cancer, but each needs checking</span></div>
        <ul class="cx-signs">${SIGNS.map(([k, l]) => `<li><label><input type="checkbox" data-change="cx-sign" data-k="${k}" ${on.has(k) ? 'checked' : ''}> ${esc(l)}</label></li>`).join('')}</ul>
        ${on.size ? `<div class="banner warn" role="alert"><strong>You noted ${on.size} sign${on.size === 1 ? '' : 's'}.</strong> Book a visit and say how long it has been going on. Myo has added ${on.size === 1 ? 'it' : 'them'} to Visit prep and the Log book. <button class="btn sm" data-act="cx-book" data-t="Warning sign check">Book a visit</button></div>` : '<p class="fine">Tick any you have. Myo adds them to your Log book and your Care visit prep.</p>'}
        <p class="fine">${src('nice')} · ${src('acs')}</p></section>
      <section class="card"><div class="card-h"><h2>Check your skin: ABCDE</h2><span class="muted small">Once a month, in good light, with a mirror</span></div>
        <ul class="cx-abcde">${ABCDE.map(([l, a, b]) => `<li><span class="cx-l num">${l}</span><b>${a}</b><span class="muted small">${b}</span></li>`).join('')}</ul>
        <p class="fine">Photos of a mole can help you notice change. Keep them on this device in Imaging; Myo never rates or diagnoses a mole. ${src('skin')}</p></section>`;
  }
  function dataTab(s) {
    const S = signals(s);
    return `<section class="card"><div class="card-h"><h2>Patterns in your data worth raising</h2><span class="muted small">From your labs, weigh-ins and notes in Myo</span></div>
        ${S.length ? `<ul class="cx-sig">${S.map((x) => `<li class="lvl-${x.lvl}"><b>${esc(x.t)}</b><p class="small">${esc(x.d)}</p><p class="fine">${src(x.src)}</p></li>`).join('')}</ul>` : '<p class="small">Nothing in your Myo data matches the patterns below right now.</p>'}
        <p class="fine">Myo looks for: iron-deficiency anemia; losing 5% or more of your weight without a weight-loss goal; new high blood sugar with weight loss after 50; inflammation that stays high; warning signs you noted. These are reasons to talk to a clinician, not signs that you have cancer. Myo can't detect cancer from your data.</p>
        <div class="row"><a class="btn ghost" href="#care">Visit prep</a><a class="btn ghost" href="#biology">Your labs</a><a class="btn ghost" href="#learn">Learn: cancer biology</a></div></section>`;
  }
  const EXPLAIN = [
    ['Mammogram', 'X-ray of the breasts.', 'Finds cancers before they can be felt. About 1 in 10 people are called back for more pictures; most callbacks are not cancer. Dense breasts make it harder to read.'],
    ['Pap and HPV tests', 'Cells from the cervix, collected by a clinician; some HPV tests can be self-collected.', 'HPV testing finds the virus that causes most cervical cancer, years before cells change.'],
    ['Stool tests (FIT, stool DNA)', 'A sample you collect at home.', 'Look for hidden blood or DNA changes. A positive result needs a colonoscopy to finish the screening.'],
    ['Colonoscopy', 'A camera through the colon, under sedation.', 'Can find and remove precancerous polyps in the same visit. Small risk of bleeding or a tear.'],
    ['CT colonography', 'A CT scan of the colon.', 'Less invasive; a finding needs a colonoscopy.'],
    ['Colorectal blood test', 'A blood draw; one was FDA-approved in 2024 for adults 45 and over at average risk.', 'Finds fewer precancerous polyps than stool tests or colonoscopy. A positive result needs a colonoscopy.'],
    ['Low-dose lung CT', 'A quick CT with a low radiation dose.', 'Lowers lung cancer deaths in people with a heavy smoking history. Findings are common and most are not cancer.'],
    ['PSA blood test', 'Measures prostate-specific antigen.', 'Can rise for many reasons (enlarged prostate, infection, cycling, recent ejaculation). Can find slow cancers that would never cause harm.'],
    ['Multi-cancer early detection (MCED) blood tests', 'Look for signals from many cancers in one blood draw.', "Not FDA-approved and not part of any screening guideline yet. They miss many early cancers, and a positive result often isn't cancer and leads to more scans. Large trials are still running. They don't replace the screenings above."]
  ];
  function testsTab() {
    return `<section class="card"><div class="card-h"><h2>The tests, plainly</h2><span class="muted small">What they are and what they can't do</span></div>
        <div class="cx-tests">${EXPLAIN.map(([a, b, c]) => `<article><h3>${esc(a)}</h3><p class="small">${esc(b)}</p><p class="small muted">${esc(c)}</p></article>`).join('')}</div>
        <p class="fine">Screening is for people without symptoms. If you have a warning sign, see a clinician for a diagnostic test instead of waiting for screening. ${src('nci')}</p></section>`;
  }
  function logTab(s) {
    const C = ensure(s), T = (C.tests || []).slice().sort((a, b) => b.d.localeCompare(a.d));
    return `<div class="grid g-2"><section class="card"><div class="card-h"><h2>Log a screening</h2></div>
        <form data-submit="cx-add" class="form-grid">
          <label class="field" for="cx-kind"><span>Test</span><select id="cx-kind" name="kind">${Object.entries(TESTS).map(([k, [l]]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></label>
          <label class="field" for="cx-d"><span>Date</span><input id="cx-d" name="d" type="date" max="${dayKey(new Date())}" value="${dayKey(new Date())}"></label>
          <label class="field" for="cx-res"><span>Result</span><select id="cx-res" name="result">${Object.entries(RESULT).map(([k, [, l]]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
          <label class="field" for="cx-note"><span>Note (optional)</span><input id="cx-note" name="note" maxlength="200" placeholder="Where, who, what's next"></label>
          <div class="form-end"><button class="btn">Save</button></div></form>
        <p class="fine">Your next due date is worked out from the newest test of each kind. Results stay on this device.</p></section>
      <section class="card"><div class="card-h"><h2>Your screenings</h2><span class="muted small">${T.length} logged</span></div>
        ${T.length ? `<ul class="cx-log">${T.map((t) => `<li><div><b>${esc((TESTS[t.kind] || ['Test'])[0])}</b><span class="muted small block">${esc(fmtDate(t.d))}${t.note ? ` · ${esc(t.note)}` : ''}</span></div><span class="row">${pill(...(RESULT[t.result] || RESULT.unsure))}${t.result === 'follow' || t.result === 'unsure' ? `<button class="btn ghost sm" data-act="cx-res" data-id="${t.id}" data-v="${t.result === 'follow' ? 'done' : 'normal'}">${t.result === 'follow' ? 'Mark follow-up done' : 'Result was normal'}</button>` : ''}<button class="link small" data-act="cx-del" data-id="${t.id}" aria-label="Remove ${esc((TESTS[t.kind] || ['test'])[0])}">Remove</button></span></li>`).join('')}</ul>` : '<p class="muted small">No screenings logged yet.</p>'}</section></div>`;
  }

  OS.register('cancer', {
    title: 'Cancer screening', icon: 'cancer',
    render(s) {
      const body = { plan: planTab, signs: signsTab, data: dataTab, tests: testsTab, log: logTab }[CX.tab](s);
      return `${OS.ui.head('Screening · warning signs · your data', 'Cancer screening', 'Keep up with the screenings for your age and risk, know the warning signs, and bring the right questions to your clinician.')}
        <div class="banner" role="note"><strong>Myo can't detect or diagnose cancer.</strong> Finding cancer takes a regulated medical test, read by a clinician. Myo keeps your screening on schedule and helps you notice what to raise.</div>
        <div class="cx bc fl"><div class="seg kt-tabs" role="tablist" aria-label="Cancer screening">${TABS.map(([k, l]) => `<button role="tab" aria-selected="${CX.tab === k}" data-act="cx-tab" data-t="${k}">${l}</button>`).join('')}</div>${body}</div>`;
    }
  });

  const put = (fn, o) => OS.update((s) => { fn(ensure(s)); }, o);
  OS.act('cx-tab', (el) => { CX.tab = TABS.some(([k]) => k === el.dataset.t) ? el.dataset.t : 'plan'; OS.render(); });
  OS.change('cx-risk', (el) => put((C) => { C.risk[el.dataset.k] = el.checked; }));
  OS.change('cx-num', (el) => put((C) => { C.risk[el.dataset.k] = el.value === '' ? '' : String(Math.max(0, +el.value || 0)); }));
  OS.act('cx-smoke', (el) => put((C) => { C.risk.smoke = el.dataset.v; }));
  OS.change('cx-sign', (el) => {
    const k = el.dataset.k, l = (SIGNS.find((x) => x[0] === k) || [, k])[1];
    put((C) => { C.signs = (C.signs || []).filter((x) => x.k !== k); if (el.checked) C.signs.push({ k, d: dayKey(new Date()) }); });
    if (el.checked) OS.logEvent('symptom', 'Warning sign noted', l, { route: 'cancer' });
  });
  OS.act('cx-add', (f) => {
    const E = f.elements, t = { id: uid(), kind: E.kind.value, d: E.d.value, result: E.result.value, note: E.note.value.trim().slice(0, 200) };
    if (!t.d || !TESTS[t.kind]) { OS.toast('Choose the test and date'); return; }
    put((C) => { C.tests.push(t); });
    OS.logEvent('note', `Screening: ${TESTS[t.kind][0]}`, RESULT[t.result][1], { route: 'cancer' });
    OS.toast('Screening saved');
  });
  OS.act('cx-res', (el) => put((C) => { const t = C.tests.find((x) => x.id === el.dataset.id); if (t) t.result = el.dataset.v; }));
  OS.act('cx-del', (el) => put((C) => { C.tests = C.tests.filter((x) => x.id !== el.dataset.id); }));
  OS.act('cx-book', (el) => { if (OS.care && OS.care.state) { OS.care.state.prefill = el.dataset.t; OS.care.state.tab = 'visits'; } OS.go('care'); });

  OS.cancer = { plan, signals, calendar, ensure, TESTS, SIGNS, status(s) { try { const P = plan(s), d = P.filter((p) => p.st === 'due' || p.st === 'follow').length; return d ? [`${d} screening${d === 1 ? '' : 's'} to act on`, 'warn'] : ['Screening up to date', 'good']; } catch { return ['Screening plan', 'muted']; } } };
})();
