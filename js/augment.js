/* ═══ MYO — AUGMENT: the Ascend path from baseline human to augmented human ═══
   Tiers: Baseline → Peak Human (biology + training) → Exo-Augmented (wearables + Merakinetics machines)
   → Neural-Linked (non-invasive EEG today; implants only via trials) → Integrated (devices fitted by clinical teams).
   Reference cards for exoskeletons, brain-computer interfaces, brain-to-brain research, prosthetics and implants,
   each with its real-world stage and how Myo integrates it. Integration protocols say who owns each step.
   Boundaries: no surgical or implant-insertion steps, no DIY body modification, no elective amputation. */
(function () {
  'use strict';
  const { esc, pill, icon, clamp } = OS;

  const STAGE = { available: ['good', 'Available now'], cleared: ['good', 'FDA-cleared'], approved: ['good', 'FDA-approved'], trial: ['warn', 'Clinical trial'], research: ['muted', 'Research'], concept: ['muted', 'Concept'], no: ['bad', 'Not supported'] };
  const INTEG = { live: ['peak', 'In Myo'], sample: ['warn', 'Sample feed'], planned: ['muted', 'Planned'], partner: ['muted', 'Needs partner'], trialonly: ['muted', 'Trial access only'], no: ['bad', 'Never'] };
  const TECH = {
    exo: [
      { n: 'Merakinetics Exo-Sync', m: 'Merakinetics R&D', st: 'concept', ig: 'sample', w: 'Pairs a wearable exoskeleton with APS Machine and ISO Flow so assist or resistance follows your readiness and program. The simulator below runs on sample telemetry.' },
      { n: 'Consumer hip and knee exos', m: 'e.g. Hypershell, Dnsys', st: 'available', ig: 'planned', w: 'Battery hip or knee assist for hiking, walking and stairs. Myo would log assist level as training load.' },
      { n: 'ReWalk Personal', m: 'Lifeward', st: 'cleared', ig: 'partner', w: 'Powered lower-limb exoskeleton that lets some people with spinal cord injury stand and walk. FDA-cleared for personal use since 2014.' },
      { n: 'EksoNR', m: 'Ekso Bionics', st: 'cleared', ig: 'partner', w: 'Rehab exoskeleton used in clinics after stroke, spinal cord injury and brain injury.' },
      { n: 'ReStore soft exosuit', m: 'Lifeward (from Harvard Wyss research)', st: 'cleared', ig: 'partner', w: 'Soft ankle exosuit for stroke gait rehab, FDA-cleared in 2019.' },
      { n: 'Industrial lift-assist exos', m: 'e.g. German Bionic', st: 'available', ig: 'planned', w: 'Back and hip assist for lifting at work; cuts spinal load during repeated lifts.' },
      { n: 'Full-body powered exoskeletons', m: 'Military and industrial programs', st: 'research', ig: 'no', w: 'Strength-amplifying suits remain prototypes limited by power, weight and safety.' }
    ],
    bci: [
      { n: 'Consumer EEG headbands', m: 'e.g. Muse, Emotiv, OpenBCI, Neurable', st: 'available', ig: 'sample', w: 'Read brainwave bands from the scalp: focus, calm, meditation depth, sleep stages. No surgery. This is the BCI Myo can use today; the panel below is a sample feed.' },
      { n: 'Neuralink N1 (Telepathy)', m: 'Neuralink', st: 'trial', ig: 'trialonly', w: 'Implanted chip with thin electrode threads placed by a surgical robot. In the PRIME study since 2024, people with paralysis control computers by thought. Investigational; not available to healthy people.' },
      { n: 'Stentrode', m: 'Synchron', st: 'trial', ig: 'trialonly', w: 'Electrode array delivered through a blood vessel, no open brain surgery. Investigational, in early feasibility studies for paralysis.' },
      { n: 'Layer 7 cortical interface', m: 'Precision Neuroscience', st: 'cleared', ig: 'trialonly', w: 'Thin-film electrode array on the brain surface. FDA 510(k)-cleared in 2025 for temporary use of up to 30 days, mainly during neurosurgery.' },
      { n: 'Utah array (BrainGate research)', m: 'Blackrock Neurotech', st: 'research', ig: 'trialonly', w: 'Implanted research arrays used since 2004 to decode movement and speech in people with paralysis.' },
      { n: 'Non-invasive language decoding', m: 'University research (fMRI)', st: 'research', ig: 'no', w: 'fMRI decoders have reconstructed the gist of words a cooperating person hears or imagines. It needs an MRI scanner and hours of training per person.' }
    ],
    link: [
      { n: 'BrainNet', m: 'University of Washington, 2019', st: 'research', ig: 'no', w: 'Three people played a Tetris-like game sharing yes/no decisions brain-to-brain (EEG to magnetic stimulation), about 81% accurate.' },
      { n: 'Internet brain-to-brain words', m: 'Grau et al., 2014', st: 'research', ig: 'no', w: 'Simple words were coded as binary and sent between India and France via EEG and magnetic stimulation. Slow, a few bits per minute.' },
      { n: 'Brain-triggered movement', m: 'University of Washington, 2013', st: 'research', ig: 'no', w: "One person's EEG triggered another person's finger movement through magnetic stimulation." },
      { n: 'Myo Mind-Link', m: 'Merakinetics concept', st: 'concept', ig: 'planned', w: 'Consent-based sharing of EEG-derived states (focus, calm, fatigue) between training partners and a coach, never raw thoughts. Uses consumer EEG headbands.' },
      { n: 'Thought-to-thought telepathy', m: '—', st: 'research', ig: 'no', w: 'Nothing today transmits thoughts between people. Myo will not claim it until it exists and is proven safe.' }
    ],
    body: [
      { n: 'Myoelectric hands and arms', m: 'e.g. Psyonic Ability Hand, Open Bionics Hero Arm, Ottobock bebionic', st: 'available', ig: 'planned', w: 'Muscle signals in the residual limb drive the hand. Fitted by a prosthetist. Myo would run grip and EMG training on ISO Flow.' },
      { n: 'Microprocessor and powered legs', m: 'e.g. Össur Power Knee, Ottobock Genium', st: 'available', ig: 'planned', w: 'Knees and ankles that adapt to speed, stairs and slopes. Myo would track gait symmetry with AR-Vision.' },
      { n: 'Osseointegration (OPRA)', m: 'Integrum', st: 'approved', ig: 'partner', w: 'Titanium implant anchored in the femur so a prosthesis attaches directly to bone, no socket. FDA-approved in 2020 for above-knee amputation.' },
      { n: 'Targeted muscle reinnervation', m: 'Surgical technique', st: 'available', ig: 'partner', w: 'Nerves rerouted into spare muscles give a prosthesis more control signals and can reduce nerve pain.' },
      { n: 'Agonist–antagonist myoneural interface', m: 'MIT research', st: 'research', ig: 'no', w: 'Surgery that keeps muscle pairs working together; a 2024 study showed more natural walking with a bionic leg.' },
      { n: 'Cochlear implants', m: 'Several makers', st: 'approved', ig: 'no', w: 'Restore hearing by stimulating the auditory nerve. FDA-approved since the 1980s.' },
      { n: 'Implantable glucose sensor (Eversense 365)', m: 'Senseonics', st: 'cleared', ig: 'planned', w: 'One-year sensor under the skin of the upper arm, FDA-cleared in 2024. Myo would stream glucose into Biology.' },
      { n: 'NFC/RFID chip implants', m: 'Consumer biohacking', st: 'available', ig: 'planned', w: 'Glass or flex chips in the hand for door access and contact sharing. Not FDA-regulated; placed by body-modification professionals. Risks: infection, migration, MRI issues.' },
      { n: 'Magnet implants', m: 'Consumer biohacking', st: 'available', ig: 'no', w: 'Small fingertip magnets that let you sense magnetic fields. Coating failures and MRI incompatibility are real risks.' },
      { n: 'Elective amputation or limb replacement', m: '—', st: 'no', ig: 'no', w: "Replacing healthy limbs or organs with machines is not supported, and no clinical team offers it. Today's prosthetics do not outperform a healthy limb." }
    ]
  };
  const TABS = [['ascend', 'Ascend'], ['exo', 'Exoskeleton'], ['bci', 'Brain–computer interface'], ['link', 'Neuro-link'], ['body', 'Prosthetics & implants'], ['proto', 'Integration protocols']];
  const DEVICES = [['exo', 'Wearable exoskeleton'], ['eeg', 'EEG headband'], ['prosthesis_upper', 'Upper-limb prosthesis'], ['prosthesis_lower', 'Lower-limb prosthesis'], ['osseo', 'Osseointegrated implant'], ['cochlear', 'Cochlear implant'], ['pacemaker', 'Pacemaker or ICD'], ['cgm', 'Implanted glucose sensor'], ['nfc', 'NFC/RFID chip'], ['magnet', 'Magnet implant'], ['joint', 'Joint replacement or metal hardware'], ['neural', 'Neural implant (trial)']];
  const PATHS = {
    exo: { n: 'Wearable exoskeleton', data: ['Assist / resist level', 'Joint torque and angle', 'Steps, cadence, distance', 'Battery and fault codes'], steps: [
      ['Assess', 'Myo', 'Baseline strength, joint range, gait and readiness from Training, AR-Vision and wearables.'], ['Qualify', 'Maker / clinician', 'Fit and weight limits from the maker; medical exos need a clinical prescription.'],
      ['Fit', 'Maker / clinician', 'Sizing and strap fit by the provider. Myo is not involved.'], ['Pair', 'You + Myo', 'Consent, then pair over Bluetooth; the exo joins the device registry beside APS Machine and ISO Flow.'],
      ['Calibrate', 'Myo', 'Record unassisted baseline walks and lifts; set assist curves from them.'], ['Train', 'Myo', 'Assist for volume and recovery days, resist for strength days; taper assist so your own capacity keeps rising.'],
      ['Monitor', 'Myo + you', 'Skin pressure points, joint pain, fall events and device faults pause the program and alert you.']] },
    eeg: { n: 'Non-invasive EEG', data: ['Band power: delta, theta, alpha, beta, gamma', 'Focus and calm indices', 'Sleep staging', 'Signal quality'], steps: [
      ['Assess', 'Myo', 'Baseline focus, mood and reaction time on the Function page.'], ['Qualify', 'You', 'Consumer devices need no prescription. Avoid if you have a seizure disorder and flashing-light neurofeedback.'],
      ['Fit', 'You', 'Headband on clean, dry skin; check contact quality.'], ['Pair', 'You + Myo', 'Consent per data type; raw EEG stays on the device by default.'],
      ['Calibrate', 'Myo', 'Two minutes eyes-closed and eyes-open to set your personal bands.'], ['Train', 'Myo', 'Neurofeedback breathwork, pre-lift focus primers, sleep wind-down.'],
      ['Monitor', 'Myo', 'Trends feed readiness; Myo never infers diagnoses from EEG.']] },
    prosthesis: { n: 'Prosthesis', data: ['Grip and gait events', 'EMG signal strength', 'Socket or implant load', 'Daily wear time'], steps: [
      ['Assess', 'Myo', 'Residual-limb strength, hip and core capacity, balance and cardio baseline.'], ['Qualify', 'Clinical team', 'Surgeon, physiatrist and prosthetist decide device and surgery. Myo does not.'],
      ['Fit', 'Clinical team', 'Socket fitting, osseointegration surgery or TMR are clinical procedures with their own rehab rules.'], ['Pair', 'You + Myo', 'Connect the device app or sensor feed with consent.'],
      ['Calibrate', 'Prosthetist + Myo', 'EMG thresholds and gait parameters set by the prosthetist; Myo records them.'], ['Train', 'Myo', 'Progressive loading on Merakinetics machines inside the limits your clinical team sets.'],
      ['Monitor', 'Myo + clinical team', 'Skin breakdown, redness, drainage, fever or new pain stop training and go to your team the same day.']] },
    implant: { n: 'Implanted sensor or chip', data: ['Sensor readings (e.g. glucose)', 'Implant site checks', 'MRI safety status'], steps: [
      ['Assess', 'Myo', 'Why you want it, what data it adds, and MRI or sport conflicts.'], ['Qualify', 'Clinician', 'Medical implants (CGM, cochlear, cardiac) are prescribed. Consumer chips are your decision; choose a licensed professional.'],
      ['Place', 'Clinician / professional', 'Insertion is never done by Myo or by yourself.'], ['Pair', 'You + Myo', 'Connect the sensor app; list the implant here so Imaging flags MRI safety.'],
      ['Calibrate', 'Device', 'Follow the maker’s warm-up and calibration.'], ['Train', 'Myo', 'Use the data, e.g. glucose-guided fuelling around training.'],
      ['Monitor', 'Myo + you', 'Swelling, heat, discharge or fever at the site means care today.']] }
  };

  function ensure(s) { if (!s.augment) s.augment = { implants: {}, assist: 20, mode: 'assist', path: 'exo' }; return s.augment; }
  // Ascend tiers from real member data
  function tiers(s) {
    const sc = OS.scores(s), G = ensure(s), on = (k) => !!G.implants[k], n = sc.markers.length || 1;
    const L = OS.longevity ? OS.longevity.summary(s, sc) : null, F = OS.fn ? OS.fn.summary(s, sc) : null;
    const peak = (clamp(sc.mk / 90, 0, 1) + clamp(sc.peak / (n * 0.5), 0, 1) + (L ? clamp(L.pillars.cardio / 85, 0, 1) + clamp((L.pillars.muscle || 60) / 85, 0, 1) : 1.2)) / 4;
    const online = s.machines.filter((m) => m.status === 'online').length;
    const exo = clamp((on('exo') ? 0.5 : 0) + Math.min(3, online) / 3 * 0.3 + (OS.AR && OS.AR.reps ? 0.2 : 0.1), 0, 1);
    const neural = clamp((on('eeg') ? 0.6 : 0) + (F ? clamp(F.tests / 3, 0, 1) * 0.4 : 0), 0, 1);
    const integ = clamp(['prosthesis_upper', 'prosthesis_lower', 'osseo', 'cochlear', 'cgm', 'neural', 'nfc'].filter(on).length ? 1 : 0, 0, 1);
    const list = [
      { id: 0, name: 'Baseline', p: 1, d: 'Every member starts here: measured, scored, protocol running.' },
      { id: 1, name: 'Peak Human', p: peak, d: 'Biology and training at the top of human range: Myo Score 90, half your markers at peak, elite fitness for age, strong muscle.' },
      { id: 2, name: 'Exo-Augmented', p: exo, d: 'Machines in the loop: wearable exo plus Merakinetics machines and AR-Vision coaching your every rep.' },
      { id: 3, name: 'Neural-Linked', p: neural, d: 'Your brain state in the loop: EEG headband plus cognition tests. Implanted BCIs only through clinical trials.' },
      { id: 4, name: 'Integrated', p: integ, d: 'Devices inside the body, fitted by clinical teams or licensed professionals and paired with Myo. Never a goal for its own sake.' }
    ];
    let cur = list[0]; for (let i = 1; i < list.length; i++) { if (list[i].p >= 0.999 && cur.id === i - 1) cur = list[i]; }
    return { list, cur };
  }

  let tab = 'ascend';
  // integration preview: the real body, muscles, skeleton and nerves, the systems each tier works on
  const stage = () => (OS.Anatomy ? '<section class="a3d au-a3d" data-a3d="compact" data-systems="skin,muscular,skeletal,nervous" aria-label="Muscles, skeleton and nerves"></section>' : '');

  OS.register('augment', {
    title: 'Augment', icon: 'augment',
    render(s, sc) {
      const G = ensure(s), T = tiers(s), nDev = Object.values(G.implants).filter(Boolean).length;
      const card = (x) => `<article class="supp au-card"><div class="supp-h"><b>${esc(x.n)}</b>${pill(...STAGE[x.st])}</div><p class="muted small">${esc(x.m)}</p><p>${esc(x.w)}</p><div class="supp-tags"><span class="tag">Myo: ${INTEG[x.ig][1]}</span></div></article>`;
      const lowR = sc.readiness < 60;
      let body = '';
      if (tab === 'ascend') {
        body = `${stage(T)}<section class="au-ascend">${T.list.map((t) => `<div class="au-tier ${t.id <= T.cur.id ? 'done' : ''} ${t.id === T.cur.id + 1 ? 'next' : ''}"><div class="au-tn"><span>Tier ${t.id}</span><b>${esc(t.name)}</b></div><div class="lg-bar"><i class="t-${t.p >= 1 ? 'peak' : t.p > 0.6 ? 'good' : 'warn'}" style="width:${Math.round(t.p * 100)}%"></i></div><p class="small">${esc(t.d)}</p><span class="num au-pct">${Math.round(t.p * 100)}%</span></div>`).join('')}</section>
        <div class="grid g-2">
          <section class="card"><div class="card-h"><h2>My devices and implants</h2><span class="muted small">${nDev} listed</span></div>
            <div class="au-dev">${DEVICES.map(([k, l]) => `<label class="ped-use"><input type="checkbox" data-change="au-dev" data-k="${k}" ${G.implants[k] ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div>
            <p class="fine">Imaging shows MRI safety warnings from this list; Myo reads it for training limits. Ticking a box connects nothing yet; device pairing arrives per the protocols tab.</p></section>
          <section class="card"><div class="card-h"><h2>Boundaries</h2></div><ul class="ath-list">
            <li>Myo integrates devices; it never gives surgical, implant-insertion or DIY body-modification steps.</li>
            <li>Implanted brain-computer interfaces (Neuralink, Synchron and others) are reached only through clinical trials, today for people with paralysis.</li>
            <li>Replacing healthy limbs or organs with machines is not supported.</li>
            <li>The fastest real upgrade is Tier 1: peak biology and training, which Myo runs every day.</li></ul>
            <button class="btn ghost sm" data-act="au-tab" data-t="proto">See integration protocols</button></section>
        </div>`;
      }
      if (tab === 'exo') body = `<section class="card"><div class="card-h"><h2>Exo-Sync simulator</h2><span class="chip">Sample telemetry</span></div>
          <div class="au-exo"><canvas id="au-exo-cv" aria-label="Hip torque: you and the exoskeleton"></canvas>
          <div class="au-exo-ctl"><div class="seg">${[['assist', 'Assist'], ['transparent', 'Transparent'], ['resist', 'Resist']].map(([k, l]) => `<button class="${G.mode === k ? 'on' : ''}" data-act="au-mode" data-v="${k}" ${k === 'resist' && lowR ? 'disabled title="Readiness below 60"' : ''}>${l}</button>`).join('')}</div>
            <label class="field"><span>Level <em id="au-lvl">${G.assist}%</em></span><input type="range" min="0" max="40" value="${G.assist}" id="au-assist" aria-label="Assist or resist level"></label>
            <ul class="sees" id="au-exo-kv"></ul>
            ${lowR ? `<p class="small" style="color:var(--warn)">Readiness is ${sc.readiness}: resist mode is locked today, assist only.</p>` : `<p class="fine">Readiness ${sc.readiness}: all modes open.</p>`}</div></div></section>
        <div class="supp-grid">${TECH.exo.map(card).join('')}</div>`;
      if (tab === 'bci') body = `<section class="card"><div class="card-h"><h2>Neural feed</h2><span class="chip">Sample feed · EEG headband</span></div>
          <div class="au-eeg"><canvas id="au-eeg-cv" aria-label="EEG band power, sample feed"></canvas><ul class="sees" id="au-eeg-kv"></ul></div>
          <p class="fine">A consumer EEG headband would stream here and into Myo's readiness. This is simulated until a headband is paired.</p></section>
        <div class="supp-grid">${TECH.bci.map(card).join('')}</div>`;
      if (tab === 'link') body = `<div class="banner" role="note"><strong>Where "neuro-telepathy" really stands.</strong> Labs have sent yes/no signals between brains at a few bits per minute. No technology transmits thoughts. Myo Mind-Link would share consented brain <em>states</em> from headbands, not thoughts.</div><div class="supp-grid">${TECH.link.map(card).join('')}</div>`;
      if (tab === 'body') body = `<div class="supp-grid">${TECH.body.map(card).join('')}</div>`;
      if (tab === 'proto') {
        const P = PATHS[G.path];
        body = `<div class="seg au-paths">${Object.entries(PATHS).map(([k, v]) => `<button class="${G.path === k ? 'on' : ''}" data-act="au-path" data-v="${k}">${esc(v.n)}</button>`).join('')}</div>
        <div class="grid g-2-1"><section class="card"><div class="card-h"><h2>${esc(P.n)}: integration protocol</h2></div>
          <ol class="au-steps">${P.steps.map(([n, who, d], i) => `<li><span class="au-sn num">${i + 1}</span><div><b>${esc(n)}</b> <span class="tag ${/Myo/.test(who) ? 'tag-go' : ''}">${esc(who)}</span><p class="small">${esc(d)}</p></div></li>`).join('')}</ol></section>
          <section class="card"><div class="card-h"><h2>Data Myo ingests</h2></div><ul class="ath-list">${P.data.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>
            <p class="fine">Every feed is opt-in per data type and can be revoked. Device data joins the same health graph as labs, wearables and machines.</p></section></div>`;
      }
      return `${OS.ui.head('Human augmentation · integration protocols', 'Ascend', 'The human operating system: from baseline to peak human, then machines, neural links and integrated devices, each step real, measured and safe.',
        `<div class="hstat"><span>Your tier</span><b>${T.cur.id} · ${esc(T.cur.name)}</b></div>`)}
      <div class="seg au-tabs">${TABS.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="au-tab" data-t="${k}" aria-pressed="${tab === k}">${l}</button>`).join('')}</div>
      ${body}`;
    },
    mount(root, s, sc) {
      const a3d = OS.Anatomy ? OS.Anatomy.mountAll(root) : null;
      const stopBody = () => { if (a3d) a3d(); };
      const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      const exoCv = root.querySelector('#au-exo-cv'), eegCv = root.querySelector('#au-eeg-cv');
      if (!exoCv && !eegCv) return stopBody;
      const G = ensure(OS.state), dpr = Math.min(2, window.devicePixelRatio || 1);
      const rng = root.querySelector('#au-assist'), lvl = root.querySelector('#au-lvl');
      const onIn = () => { G.assist = +rng.value; lvl.textContent = G.assist + '%'; };
      if (rng) rng.addEventListener('input', onIn);
      const onCh = () => OS.update((st) => { ensure(st).assist = +rng.value; }, { render: false });
      if (rng) rng.addEventListener('change', onCh);
      let raf = 0, alive = true, last = 0, bands = [0.3, 0.35, 0.5, 0.4, 0.15];
      const css = getComputedStyle(document.documentElement), col = (n) => css.getPropertyValue(n).trim();
      function fit(cv) { const w = cv.clientWidth, h = cv.clientHeight; if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); } const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); return [c, w, h]; }
      function exo(t) {
        const [c, w, h] = fit(exoCv); c.clearRect(0, 0, w, h);
        const k = G.mode === 'transparent' ? 0 : (G.mode === 'resist' ? -1 : 1) * G.assist / 100;
        c.strokeStyle = col('--line'); c.lineWidth = 1; c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
        const wave = (amp, color, lw) => { c.strokeStyle = color; c.lineWidth = lw; c.beginPath(); for (let x = 0; x <= w; x += 3) { const ph = (x / w) * Math.PI * 4 + t * 2.2, y = h / 2 - Math.sin(ph) * amp * (h * 0.38) * (0.9 + 0.1 * Math.sin(ph * 3)); x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); };
        wave(1 - k * 0.8, col('--accent'), 2.5); wave(k, '#22d3ee', 2);
        c.fillStyle = col('--muted'); c.font = '11px ui-monospace, monospace'; c.fillText('YOUR HIP TORQUE', 8, 14); c.fillStyle = '#22d3ee'; c.fillText(G.mode === 'resist' ? 'EXO RESISTANCE' : 'EXO ASSIST', 8, 28);
        if (tick % 4 === 0) {
          const kv = root.querySelector('#au-exo-kv'); if (kv) kv.innerHTML = `<li><span>Mode</span><b>${G.mode}</b></li><li><span>Your share of the work</span><b class="num">${Math.round((1 - k * 0.8) * 100)}%</b></li><li><span>Est. metabolic cost</span><b class="num">${k > 0 ? '−' + Math.min(20, Math.round(k * 40)) : k < 0 ? '+' + Math.round(-k * 60) : '±0'}%</b></li>`;
        }
      }
      function eeg(t) {
        const [c, w, h] = fit(eegCv); c.clearRect(0, 0, w, h);
        const N = ['Delta', 'Theta', 'Alpha', 'Beta', 'Gamma'], base = [0.3, 0.35, 0.55 + Math.sin(t * 0.3) * 0.15, 0.42 + Math.sin(t * 0.21 + 1) * 0.15, 0.15];
        bands = bands.map((b, i) => b + (base[i] + (Math.random() - 0.5) * 0.12 - b) * 0.15);
        const bw = w / 5;
        bands.forEach((b, i) => { const bh = clamp(b, 0.02, 1) * (h - 26); const g = c.createLinearGradient(0, h - 20 - bh, 0, h - 20); g.addColorStop(0, '#67e8f9'); g.addColorStop(1, '#1d4ed8'); c.fillStyle = g; c.fillRect(i * bw + bw * 0.2, h - 20 - bh, bw * 0.6, bh); c.fillStyle = col('--muted'); c.font = '11px ui-monospace, monospace'; c.textAlign = 'center'; c.fillText(N[i], i * bw + bw / 2, h - 5); });
        c.textAlign = 'left';
        if (tick % 4 === 0) {
          const focus = Math.round(clamp(bands[3] / (bands[2] + bands[1]) * 100, 0, 100)), calm = Math.round(clamp(bands[2] / (bands[3] + bands[4] + 0.2) * 70, 0, 100));
          const kv = root.querySelector('#au-eeg-kv'); if (kv) kv.innerHTML = `<li><span>Focus</span><b class="num">${focus}</b></li><li><span>Calm</span><b class="num">${calm}</b></li><li><span>Signal</span><b>Sample</b></li>`;
        }
      }
      let tick = -1;
      const loop = (now) => { if (!alive) return; raf = requestAnimationFrame(loop); if (now - last < 50) return; last = now; tick++; const t = now / 1000; if (exoCv) exo(t); if (eegCv) eeg(t); if (reduce) { cancelAnimationFrame(raf); } };
      raf = requestAnimationFrame(loop);
      return () => { stopBody(); alive = false; cancelAnimationFrame(raf); if (rng) { rng.removeEventListener('input', onIn); rng.removeEventListener('change', onCh); } };
    }
  });

  OS.act('au-tab', (el) => { tab = el.dataset.t; OS.render(); });
  OS.act('au-path', (el) => OS.update((s) => { ensure(s).path = el.dataset.v; }, { keepSample: true }));
  OS.act('au-mode', (el) => OS.update((s) => { ensure(s).mode = el.dataset.v; }, { keepSample: true }));
  OS.change('au-dev', (el) => OS.update((s) => { ensure(s).implants[el.dataset.k] = el.checked; }));
  OS.augment = { tier: (s) => tiers(s).cur, tiers, PATHS };
})();
