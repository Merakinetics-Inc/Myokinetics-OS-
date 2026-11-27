/* ═══ MYO — FIND: one search for every page and the common actions (Ctrl+K, ⌘K or /) ═══
   A modal combobox: type to filter, arrows to move, Enter to open, Esc to close. Focus returns to
   where it was. Pages come from the registered views, so new pages appear here on their own. */
(function () {
  'use strict';
  const { esc, icon } = OS;
  const ACTIONS = [
    { t: 'Open the Myo hub', d: 'Every function around the living cell', ic: 'myo', go: 'myo', kw: 'hub map all functions home neural' },
    { t: 'Talk to Myo', d: 'Ask the AI coach by voice or text', ic: 'coach', go: 'coach', kw: 'ai chat ask question voice' },
    { t: 'Import lab results', d: 'PDF, CSV or pasted values on Biology', ic: 'upload', go: 'biology', kw: 'labs blood test pdf csv upload biomarkers' },
    { t: 'Connect a wearable', d: 'Oura or WHOOP', ic: 'wearable', go: 'wearables', kw: 'oura whoop ring strap sync hrv' },
    { t: 'Log a meal', d: 'Protein, calories and water on Fuel', ic: 'fuel', go: 'fuel', kw: 'food protein calories eat water nutrition' },
    { t: 'Start a sleep study', d: '14 nights with a diary', ic: 'sleep', go: 'sleep', kw: 'sleep study diary insomnia' },
    { t: 'Sign in or sync', d: 'Your Myo account', ic: 'user', go: 'profile', kw: 'account login sign in sync email' },
    { t: 'Download my data', d: 'A JSON copy of everything Myo stores for you', ic: 'download', act: 'data-export', kw: 'export backup json data rights gdpr ccpa' },
    { t: 'Print my report', d: 'A one-page summary for you or your clinician', ic: 'report', go: 'report', kw: 'pdf print share clinician doctor summary' },
    { t: 'Privacy policy', d: 'How Myo handles your data', ic: 'shield', href: 'privacy.html', kw: 'privacy data policy hipaa' },
    { t: 'Terms of use', d: 'The rules for using Myo', ic: 'shield', href: 'terms.html', kw: 'terms legal conditions' }
  ];
  let open = false, sel = 0, results = [], back = null;

  // extra words people search with, per page
  const KW = {
    biology: 'labs blood tests biomarkers vitamin cholesterol apob', today: 'protocol plan daily dashboard score', body: '3d anatomy organs muscles',
    sleep: 'insomnia apnea edf hypnogram', recovery: 'sauna cold plunge red light sonosphere sound breath', pt: 'rehab injury pain physio',
    imaging: 'dicom ct mri dexa scan', mirror: 'xray camera skull hands', function: 'reaction memory balance mood cognition tests',
    longevity: 'biological age phenoage vo2max healthspan', wearables: 'oura whoop ring strap hrv', training: 'workout program session sets',
    athlete: 'dna genetics crossfit runner powerlifter', ar: 'form camera pose movenet', machines: 'aps iso flow hardware bluetooth',
    gym: 'facility layout floor plan', fuel: 'food meals protein calories water nutrition', life: 'habits schedule goals mood',
    enhance: 'supplements stack peds', looks: 'skin physique face dermatology aesthetics', connect: 'integrations api devices fhir hl7 bluetooth vielight',
    augment: 'ascend implants exoskeleton tiers', system: 'architecture status version diagnostics install offline', profile: 'account sign in sync data delete export',
    coach: 'ai chat ask voice', myo: 'hub map all functions', report: 'pdf print clinician summary', welcome: 'intro setup start onboarding',
    kitchen: 'food calories recipes meal prep plan shopping barcode supplements cook', motion: 'jump plyometrics vertical rsi drop squat valgus movement screen xr vector', biochem: 'metabolism pathways insulin lipids methylation thyroid biochemistry',
    food: 'food farm farming garden grow plant harvest crop pantry storage canning barcode scanner calorie calories scan additives e numbers ultra processed nova nutri score pesticides residues organic spray wash', chip: 'myo chip implant implantable sensor architecture hardware power battery protocol encryption firmware ota server api bluetooth nfc security regulatory fda', emergency: 'emergency sos help 911 999 112 first aid cpr aed defibrillator heart attack cardiac arrest stroke seizure choking allergy anaphylaxis epipen bleeding overdose naloxone asthma burn heat stroke hypothermia faint head injury crisis medical id',
    flow: 'blood flow circulation doppler artery arteries vein veins venous arterial capillaries lymph perfusion velocity vascular pulse resistive pulsatility index', ultrasound: 'ultrasound sonography sonogram scanner probe capture hdmi measure caliper calibrate vascular fetal biometry', pregnancy: 'pregnancy pregnant baby fetus fetal due date edd lmp gestational age dating scan crl growth weight percentile trimester movements kicks midwife maternity', wave: 'stemwave stem wave shockwave acoustic wave eswt therapy tendon plantar heel tennis elbow pain sessions provider',
    evidence: 'studies research pubmed trials science learning', score: 'myo score qr share record', mode: 'full screen dashboard scan neuro body surgery procedure', mind: 'mental health anxiety depression stress mood phq gad therapy crisis', heart: 'heart cardiac cycle ecg ekg rhythm coronary angiography angiogram angio valves anatomy lub dub wiggers rao lao cath', stream: 'live sensors camera pulse ppg microphone heart sounds stethoscope breathing respiration bluetooth strap rr hrv pipeline stream inputs devices', logbook: 'log book timeline history symptoms journal notes events export csv diary', bodycomp: 'body composition smart scale hume pod bioimpedance bia dexa dxa body fat lean mass muscle visceral fat bone density t-score almi ffmi segmental apple health weight', twin: 'digital twin 3d avatar model simulation what if plan projection ai ask systems body', surgery: 'surgery operation procedure pre op prehab recovery wound red flags family status or board operating room checklist who time out counts turnover anaesthesia anesthesia', atlas: 'body atlas anatomy systems physiology education embryo fetus development aging ageing life stages germ layers connections organs', bci: 'bci brain computer interface eeg neural neuro implant openbci cyton muse alpha decoder intent electrodes 10-20 edf bdf neurofeedback itr'
  };
  function index() {
    const pages = Object.keys(OS.views).filter((n) => OS.views[n].title).map((n) => ({ t: OS.views[n].title, d: (OS.navDesc && OS.navDesc[n]) || '', ic: OS.views[n].icon, go: n, kw: `${n} ${KW[n] || ''}`, page: true }));
    return pages.concat(ACTIONS);
  }
  function search(q) {
    const v = q.trim().toLowerCase(), all = index();
    if (!v) return all.filter((x) => !x.page).concat(all.filter((x) => x.page)).slice(0, 12);
    return all.map((x, i) => {
      const t = x.t.toLowerCase(), rest = `${x.d} ${x.kw || ''}`.toLowerCase();
      const words = v.split(/\s+/);
      const ok = words.every((w) => t.includes(w) || rest.includes(w));
      const score = !ok ? 0 : (t.startsWith(v) ? 4 : t.includes(v) ? 3 : words.every((w) => t.includes(w)) ? 2 : 1) + (x.page ? 0.1 : 0);
      return { x, score, i };
    }).filter((r) => r.score).sort((a, b) => b.score - a.score || a.i - b.i).slice(0, 12).map((r) => r.x);
  }

  function el() {
    let d = document.getElementById('pal');
    if (d) return d;
    d = document.createElement('div'); d.id = 'pal'; d.className = 'pal'; d.hidden = true;
    d.innerHTML = `<div class="pal-in" role="dialog" aria-modal="true" aria-label="Find in Myo">
      <div class="pal-q">${icon('search', 18)}<label class="sr" for="pal-in">Search pages and actions</label><input id="pal-in" role="combobox" aria-expanded="true" aria-controls="pal-list" aria-autocomplete="list" placeholder="Search pages and actions" autocomplete="off" spellcheck="false" enterkeyhint="go"><kbd>Esc</kbd></div>
      <ul id="pal-list" role="listbox" aria-label="Results"></ul>
      <p class="pal-foot" aria-hidden="true"><span>↑ ↓ move</span><span>Enter open</span><span>Esc close</span></p></div>`;
    document.body.appendChild(d);
    const inp = d.querySelector('#pal-in');
    inp.addEventListener('input', () => { sel = 0; paint(); });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(results.length - 1, sel + 1); paint(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); paint(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (results[sel]) run(results[sel]); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'Tab') e.preventDefault();   // one control: keep focus in the dialog
    });
    d.addEventListener('mousedown', (e) => { if (e.target === d) close(); });
    d.querySelector('#pal-list').addEventListener('click', (e) => { const li = e.target.closest('[data-i]'); if (li) run(results[+li.dataset.i]); });
    return d;
  }
  function paint() {
    const d = el(), inp = d.querySelector('#pal-in'), list = d.querySelector('#pal-list');
    results = search(inp.value);
    list.innerHTML = results.length ? results.map((x, i) => `<li role="option" id="pal-o-${i}" data-i="${i}" aria-selected="${i === sel}"><span class="pal-ic">${icon(x.ic, 17)}</span><span class="pal-t"><b>${esc(x.t)}</b>${x.d ? `<small>${esc(x.d)}</small>` : ''}</span><span class="pal-k">${x.page ? 'Page' : 'Action'}</span></li>`).join('')
      : '<li class="pal-none" role="presentation">Nothing matches. Try another word, like “labs” or “sleep”.</li>';
    inp.setAttribute('aria-activedescendant', results.length ? `pal-o-${sel}` : '');
    const cur = list.querySelector(`#pal-o-${sel}`); if (cur) cur.scrollIntoView({ block: 'nearest' });
  }
  function show() {
    if (open) return;
    const d = el(); back = document.activeElement; open = true; sel = 0;
    d.querySelector('#pal-in').value = ''; d.hidden = false; paint();
    setTimeout(() => d.querySelector('#pal-in').focus(), 0);
    const b = document.getElementById('pal-btn'); if (b) b.setAttribute('aria-expanded', 'true');
  }
  function close() {
    const d = document.getElementById('pal'); if (!d || !open) return;
    d.hidden = true; open = false;
    const b = document.getElementById('pal-btn'); if (b) b.setAttribute('aria-expanded', 'false');
    if (back && back.focus && document.contains(back)) try { back.focus(); } catch { /* gone */ }
  }
  function run(x) {
    close();
    if (x.go) OS.go(x.go);
    else if (x.act && OS.acts[x.act]) OS.acts[x.act](document.body);
    else if (x.href) location.href = x.href;
  }

  document.addEventListener('keydown', (e) => {
    const typing = e.target && (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable);
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); open ? close() : show(); }
    else if (e.key === '/' && !typing && !open && !e.ctrlKey && !e.metaKey) { e.preventDefault(); show(); }
  });
  OS.act('find', () => show());
  OS.find = { open: show, close, search };
})();
