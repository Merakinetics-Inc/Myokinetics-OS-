/* ═══ MYOKINETICS OS v4 — SYSTEM: architecture map of the whole ecosystem ═══ */
(function () {
  'use strict';
  const { esc, pill } = OS;

  const LAYERS = [
    { n: 'L5', name: 'Experiences', note: 'Where members, coaches and operators work', mods: [
      ['Member app', 'iOS · Android · web. This build.', 'live', 'today'], ['X-ray Mirror', 'Face + hand tracking: skull, brain, muscles, hand bones (X-Ray Mirror by Hashem Al-Ghaili)', 'live', 'mirror'], ['Myo avatar', 'Living-cell AI avatar: the nucleus holds Myo\'s neural network; voice in and out', 'live', 'coach'], ['3D body', 'Real anatomy (BodyParts3D): nine systems, tap an organ for your markers', 'live', 'body'], ['Machine HMI', 'On-machine screen, session handoff from phone', 'planned'], ['Coach console', 'Roster, programs, AR clips, messaging', 'planned'], ['Facility console', 'Fleet health, utilization, floor plans', 'live', 'gym']] },
    { n: 'L4', name: 'Intelligence', note: 'Engines that turn data into decisions', mods: [
      ['Myo AI coach', 'LLM with tool access to the health graph', 'live', 'coach'], ['Human function engine', 'Movement, cognition, mood and behaviour tests and scores', 'live', 'function'], ['Ascend tiers', 'Baseline, Peak Human, Exo, Neural, Integrated', 'live', 'augment'], ['Myo Score engine', 'Biology 30 · recovery 20 · training 20 · nutrition 15 · life 15', 'live', 'today'], ['Protocol engine', 'Rules: biomarker + readiness → daily actions', 'live', 'today'], ['Form engine', 'Joint-angle rules on pose data, rep and tempo detection', 'sim', 'ar'], ['Adaptive load', 'RPE + e1RM progression, deload scheduling', 'live', 'training'], ['Facility planner', 'Clearance, reachability, flow score, capacity', 'live', 'gym']] },
    { n: 'L3', name: 'Health graph & services', note: 'One record per member, consent-scoped', mods: [
      ['Identity & consent', 'Supabase Auth sign-in (email code, Google, Apple); per-member private row, sharing grants', 'live', 'profile'], ['Biomarker store', 'Values, units, optimal vs lab ranges, history', 'live', 'biology'], ['Training log', 'Sessions, sets, loads, machine telemetry', 'live', 'training'], ['Device registry', 'Machines, firmware, pairing, ownership', 'live', 'machines'], ['Nutrition & life', 'Meals, water, habits, goals, schedule, mood', 'live', 'life'], ['Event stream', 'Rep, set and session events across machines', 'sim', 'machines']] },
    { n: 'L2', name: 'Ingest & edge', note: 'Every input normalized into the graph', mods: [
      ['Lab ingest', 'CSV / text today; PDF + HL7 FHIR next', 'live', 'biology'], ['Imaging ingest', 'DICOM CT / MRI / DEXA parsed on-device; 3-plane + 3D hologram', 'live', 'imaging'], ['Wearable sync', 'Oura · WHOOP · Apple Health · Garmin', 'sim', 'biology'], ['Machine gateway', 'BLE 5.0 GATT · MQTT over TLS · OTA', 'sim', 'machines'], ['FTMS bridge', 'Third-party bikes, rowers, treadmills', 'planned', 'machines'], ['AR pipeline', 'LiDAR + RGB → 33-joint pose on local edge', 'sim', 'ar'], ['Augmentation gateway', 'Exoskeleton, EEG, prosthesis and implant feeds', 'planned', 'augment']] },
    { n: 'L1', name: 'Devices', note: 'Merakinetics hardware and partner devices', mods: [
      ['APS Machine 2.0', 'Adaptive shoulder press, bilateral load', 'sim', 'machines'], ['ISO Flow', 'Isokinetic cable, torque + speed', 'sim', 'machines'], ['Dumbbell Hangers', 'Smart storage, pair-lifted detection', 'sim', 'machines'], ['MK-Pro Rack', 'Bar path via AR-Vision', 'sim', 'machines'], ['AR-Vision v2.4', 'LiDAR + RGB form camera', 'sim', 'ar'], ['Medivis (partner)', 'FDA-cleared surgical AR imaging · partnership pending', 'planned', 'imaging'], ['Wearables', 'Ring, strap, watch', 'sim', 'biology']] }
  ];
  const CROSS = [['Security & compliance', 'Encryption in transit and at rest, HIPAA-ready data handling, audit trail, consent before any share.'], ['Red-flag escalation', 'Dangerous lab or vital values trigger an urgent in-person-care alert and pause optimisation of that marker. Everything else runs inside the OS.'], ['Multi-tenant B2B', 'Facilities own fleets and floor plans; members own their health graph and choose what a gym sees.']];
  const ST = { live: ['good', 'In this build'], sim: ['warn', 'Sample feed'], planned: ['muted', 'Planned'] };
  const LOOP = [['Measure', 'Labs, wearables, machine telemetry, AR form data'], ['Score', 'Myo Score and per-system biology scores'], ['Prescribe', 'Daily protocol and adaptive training'], ['Execute', 'Train on connected machines with AR correction; live the plan'], ['Retest', 'New labs every 90 days, trends update the protocol']];
  const ENTITIES = [['Member', 'profile, goals, consent grants'], ['Biomarker', 'value, unit, lab range, optimal range, weight, history'], ['Protocol item', 'category, time, linked biomarker, done by day'], ['Program → Session → Exercise → Set', 'load, reps, RPE, machine, telemetry ref'], ['Machine', 'model, link, firmware, owner (member or facility)'], ['Rep event', 'machine, force/torque curve, ROM, tempo, form flags'], ['Facility', 'rooms, floor plans, fleet, members'], ['Meal · Habit · Block · Goal', 'life-management records by day']];

  const MVP = [
    ['Welcome and setup', 'live', 'Introduction, six-step setup that ticks itself off, profile and goals', 'welcome'],
    ['Myo hub', 'live', 'The living-cell avatar wired to every function, with a live status line on each', 'myo'],
    ['Find anything', 'live', 'Ctrl K, ⌘K or / searches every page and common action', null],
    ['Myo Mode', 'live', 'Full-screen neuro and body dashboard, full-system scan, procedure care (prep and recovery only)', 'mode'],
    ['Myo Score and QR sharing', 'live', 'Five-system score with a daily trend; records shared by QR inside the link, nothing stored', 'score'],
    ['Motion Lab', 'live', 'XR vector analysis: jump height, drop-jump RSI, squat knee control, from video or camera', 'motion'],
    ['Kitchen', 'live', 'Open Food Facts search and barcodes, recipes with cook mode, week plan, supplement log', 'kitchen'],
    ['Meal-prep partners', 'partial', 'POST /v1/meals on the Ingest API is built and tested; deploy with supabase/deploy.ps1', 'kitchen'],
    ['Biochem', 'live', 'Eight metabolic pathways mapped to the member\'s labs, with graded levers', 'biochem'],
    ['Evidence', 'live', 'PubMed watch for new trials and meta-analyses, with a human review queue', 'evidence'],
    ['Heart', 'live', 'Original schematic anatomy, one heartbeat at your heart rate (Wiggers), ECG rhythm with breathing, coronary C-arm views with foreshortening', 'heart'],
    ['Live sensors', 'live', 'Camera pulse, heart sounds, breathing and Bluetooth RR as an observable operator pipeline; raw signals never stored', 'stream'],
    ['Log book', 'live', 'Every input on one timeline with its source; symptom log with emergency guidance; CSV export', 'logbook'],
    ['Digital twin', 'live', '3D body reshaped from your measurements, eleven systems scored from your data, 12-month what-if run through the app\'s own Myo Score and biological-age models, AI briefing', 'twin'],
    ['Live wearable sync', 'live', 'Oura and WHOOP webhooks into the proxy, a 15-minute catch-up job, and the app checking for changed days every 3 minutes', 'wearables'],
    ['Surgery', 'live', 'Member companion (prep, day-of status, recovery red flags) and an operational OR board for teams (stage times, WHO-adapted checklist, counts, turnover)', 'surgery'],
    ['Insights', 'live', 'Daily table from every log; week-on-week review; Spearman links (|ρ| ≥ 0.3, p < 0.05, same or next day) with scatter plots; n-of-1 experiments with Cohen\'s d and a bootstrap 90% interval', 'insights'],
    ['Cycle health', 'live', 'Period, symptom and temperature calendar; phase and next period from your own average and spread; ovulation estimate (not contraception); history and symptoms by phase; perimenopause and menopause; red flags', 'cycle'],
    ['Environment', 'live', 'Open-Meteo weather, UV, US AQI, PM2.5 and pollen; NWS heat index and wind chill; EPA and WHO categories; best 2-hour window to train outside', 'env'],
    ['Care and calendar', 'live', 'Care team, appointments with after-visit notes, a visit sheet built from your data, routines with reminders, one calendar of dated items across Myo, .ics export', 'care'],
    ['Food system', 'live', 'Planting calendar from your frost dates, plantings, harvests with calories, pantry use-by; Open Food Facts barcode scan with NOVA, Nutri-Score and additives; hand-portion plate builder; photo estimates via Myo AI; additive reference and avoid list; produce residues and garden spray pre-harvest intervals', 'food'],
    ['Emergency', 'live', 'Local emergency number, 16 first-aid protocols, location to read out or text, CPR metronome with wake lock, seizure timer saved to the Log book, medical ID and wallet card, kit checklist; works offline', 'emergency'],
    ['Myo chip', 'planned', 'Implant concept: architecture, neuromorphic event-driven front end (level-crossing ECG simulation, keep-alive against static blindness), power budget, frame format with a Web Crypto simulator (ECDH pairing, AES-GCM, replay and tamper rejection, ECDSA-signed firmware), device API and data model, threat model and regulatory path', 'chip'],
    ['Blood flow', 'live', 'Circulation reference with your blood volume and output; Doppler monitor (spectral display, PSV, EDV, RI, PI, artery or vein pattern) from a pocket Doppler audio; camera perfusion index; vascular ultrasound', 'flow'],
    ['Live ultrasound', 'live', 'USB video capture, screen share or clip; freeze, calibrate on the image ruler, distance and ellipse calipers, snapshots to Imaging, clip recording; general, vascular and pregnancy presets', 'ultrasound'],
    ['Pregnancy', 'live', 'Dates from LMP, due date or dating-scan CRL (Robinson); scans and Hadlock weight; growth chart with the 10th–90th band; movements and red flags; no home fetal monitoring', 'pregnancy'],
    ['Wave therapy', 'live', 'StemWave and radial or focused shockwave sessions by area, with pain and function across the course (not affiliated)', 'wave'],
    ['Body atlas', 'live', 'Eleven systems, their connections, germ layers, embryo-to-old-age milestones and life curves', 'atlas'],
    ['Body composition', 'live', 'Bluetooth Weight Scale and Body Composition services; Apple Health export for app-only scales such as the Hume Pod; CSV; DEXA PDF reports read on-device; scale-to-DEXA offset', 'bodycomp'],
    ['BCI lab', 'live', 'OpenBCI Cyton (Web Serial), Muse (Bluetooth, beta) and EDF/BDF through a timed EEG pipeline; alpha-switch decoder with ITR; implant link and power calculator; OS.neural API', 'bci'],
    ['Scan formats', 'live', 'DICOM uncompressed, JPEG baseline, JPEG lossless, RLE and deflated; NIfTI; ultrasound and angiogram cine; JPEG 2000 planned', 'imaging'],
    ['Mind', 'live', 'PHQ-9, GAD-7 and WHO-5 self-checks, CBT tools, crisis support; answers stay on the device', 'mind'],
    ['Labs, score, protocol', 'live', 'PDF, CSV and pasted lab import; 24 markers scored against optimal and peak; daily protocol', 'biology'],
    ['3D body', 'live', 'Real anatomy of nine systems (BodyParts3D) with organ pop-outs tied to markers', 'body'],
    ['Training and AR form', 'live', 'Programs, adaptive load, MoveNet pose coaching on camera or video', 'training'],
    ['Imaging', 'live', 'On-device DICOM viewer: three planes and 3D', 'imaging'],
    ['MedTech integrations', 'partial', 'Bluetooth health profiles and the Console work on the device; the hosted Ingest API is built and tested (deploy with supabase/deploy.ps1); vendor partner keys (Dexcom, Withings, Garmin, Vielight) are next', 'connect'],
    ['Sleep study', 'live', '14-night protocol, sleep diary, PDF report, EDF+ recording and CSV uploads read on the device', 'sleep'],
    ['Recovery and physical therapy', 'live', 'Sonosphere sound studio, heat, cold and light protocols, rehab plans with pain monitoring', 'recovery'],
    ['Myo AI coach', 'partial', 'Live inside Claude. On the hosted app the myo-ai function answers signed-in members once its Anthropic key is set (supabase/MYO_AI.md)', 'coach'],
    ['Data rights', 'live', 'Download, restore and delete; account deletion cascades through delete_my_account()', 'profile'],
    ['Report', 'live', 'A printable one-page summary for the member or a clinician', 'report'],
    ['Wearables', 'partial', 'File import live; the Supabase proxy (phase 1 and 2: webhooks, daily cache) is built and tested; run supabase/deploy.ps1 with your Oura and WHOOP app keys', 'wearables'],
    ['Accounts and sync', 'partial', 'Supabase sign-in and cloud sync built; needs the project URL and key', 'profile'],
    ['Machines', 'sim', 'APS, ISO Flow and Hangers run on sample telemetry until BLE hardware pairs', 'machines'],
    ['Membership and payments', 'planned', 'Not built: needs a billing provider and plans', null],
    ['Clinician review', 'planned', 'Not built: needs licensed partners for any medical service', null],
    ['Installable and offline', 'live', 'Web app manifest and service worker: install from the browser, open offline', null],
    ['Privacy policy and terms', 'live', 'privacy.html and terms.html, linked from sign-in, Profile and here. Counsel review before launch', null],
    ['App store release', 'planned', 'Native shell, privacy labels and store review after the web launch', null]
  ];
  const MVP_ST = { live: ['good', 'In this build'], partial: ['warn', 'Needs backend config'], sim: ['warn', 'Sample feed'], planned: ['muted', 'Planned'] };

  function appCard() {
    const errs = OS.errors || [], sw = (OS.sw && OS.sw.state) || 'off', mode = OS.Persist.mode;
    const swTxt = { ready: 'Ready: Myo opens without a connection', installing: 'Getting ready', starting: 'Starting', failed: "Couldn't start", off: 'Not used in this view' }[sw] || sw;
    const saved = mode === 'cloud' ? 'This device and your Myo account' : mode === 'account' ? 'Your Claude account' : mode === 'device' ? 'This device' : 'Memory only';
    return `<section class="card app-card"><div class="card-h"><h2>This app</h2><span class="muted small">Myo ${esc(OS.VERSION)} · build ${OS.BUILD}</span></div>
      <dl class="dl"><dt>Offline</dt><dd>${swTxt}</dd><dt>Saved to</dt><dd>${saved}</dd><dt>Storage used</dt><dd id="app-store">Checking…</dd><dt>Errors this session</dt><dd>${errs.length}</dd></dl>
      <div class="row">${OS.installPrompt ? '<button class="btn" data-act="install">Install Myo</button>' : ''}<button class="btn ghost" data-act="diag-copy">Copy diagnostics</button><a class="btn ghost" href="privacy.html">Privacy policy</a><a class="btn ghost" href="terms.html">Terms</a></div>
      ${errs.length ? `<details class="diag"><summary class="small">Recent errors</summary><ul>${errs.slice(-8).reverse().map((e) => `<li><span class="mono small">${esc(String(e.at).slice(11, 19))}</span> ${esc(e.kind)}: ${esc(e.msg)} <span class="muted small">${esc(e.where)}</span></li>`).join('')}</ul></details>` : ''}
      <p class="fine">Diagnostics hold the app version, browser and error messages, never your health data.</p></section>`;
  }
  OS.act('diag-copy', async () => {
    const d = { app: 'Myo', version: OS.VERSION, build: OS.BUILD, at: new Date().toISOString(), ua: navigator.userAgent, online: navigator.onLine, sw: OS.sw && OS.sw.state, saved: OS.Persist.mode, page: OS.current, errors: OS.errors || [] };
    try { await navigator.clipboard.writeText(JSON.stringify(d, null, 2)); OS.toast('Diagnostics copied'); } catch { OS.toast("Couldn't copy here. Open Recent errors instead."); }
  });
  OS.on('install', () => { if (OS.current === 'system') OS.render(); });

  OS.register('system', {
    title: 'System', icon: 'system',
    mount(root) {
      const el = root.querySelector('#app-store');
      if (el && navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(({ usage, quota }) => { el.textContent = `${(usage / 1e6).toFixed(1)} MB of ${(quota / 1e9).toFixed(1)} GB`; }).catch(() => { el.textContent = 'Unknown'; });
      else if (el) el.textContent = 'Unknown';
    },
    render() {
      const counts = { live: 0, sim: 0, planned: 0 }; LAYERS.forEach((l) => l.mods.forEach((m) => counts[m[2]]++));
      return `${OS.ui.head('Architecture', 'How Myo runs on Myokinetics OS', 'Five layers from hardware to experience. Each module links to where it runs in this app.',
        `<div class="hstat"><span>In this build</span><b class="num">${counts.live}</b></div><div class="hstat"><span>Sample feed</span><b class="num">${counts.sim}</b></div><div class="hstat"><span>Planned</span><b class="num">${counts.planned}</b></div>`)}
      ${appCard()}
      <section class="card mvp-card"><div class="card-h"><h2>MVP readiness</h2><span class="muted small">${MVP.filter((x) => x[1] === 'live').length} of ${MVP.length} live · the rest need a backend, hardware or partners</span></div>
        <ul class="mvp">${MVP.filter(([, , , r]) => !r || OS.views[r]).map(([n, st, d, r]) => `<li><${r ? `a href="#${r}"` : 'div'} class="mvp-i"><span class="mvp-n"><b>${esc(n)}</b><span class="muted small">${esc(d)}</span></span>${pill(...MVP_ST[st])}</${r ? 'a' : 'div'}></li>`).join('')}</ul></section>
      <section class="card loop-card">
        <div class="card-h"><h2>The core loop</h2><span class="muted small">Biology layer follows the FitScript pattern: labs → score → protocol → retest. Myokinetics adds machines, AR and life in the middle.</span></div>
        <ol class="loop">${LOOP.map(([a, b], i) => `<li><span class="loop-n num">${i + 1}</span><b>${a}</b><span class="muted small">${b}</span></li>`).join('')}</ol>
      </section>
      <div class="arch">
        <div class="layers">${LAYERS.map((l) => `<section class="layer"><header><span class="mono">${l.n}</span><div><b>${l.name}</b><span class="muted small block">${l.note}</span></div></header>
          <div class="mods">${l.mods.map(([n, d, st, r]) => `<${r ? `button data-act="go" data-to="${r}"` : 'div'} class="mod st-${st}"><span class="mod-top"><b>${esc(n)}</b>${pill(ST[st][0], ST[st][1])}</span><span class="muted small">${esc(d)}</span></${r ? 'button' : 'div'}>`).join('')}</div></section>`).join('')}</div>
        <aside class="cross">${CROSS.map(([a, b]) => `<section><b>${a}</b><p class="muted small">${b}</p></section>`).join('')}</aside>
      </div>
      <div class="grid g-2">
        <section class="card"><div class="card-h"><h2>Data model</h2><span class="muted small">Health graph entities</span></div>
          <dl class="dl">${ENTITIES.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl></section>
        <section class="card"><div class="card-h"><h2>Topology</h2><span class="muted small">Matches the shared electronics architecture</span></div>
          <pre class="topo mono">           ┌──────────────────────┐
           │  Merakinetics cloud  │  health graph · AI · fleet
           └─────┬──────────┬─────┘
     HTTPS/MQTT  │          │  HTTPS/MQTT
     ┌───────────┴──┐    ┌──┴───────────┐
     │ APS Machine  │    │   ISO Flow   │   + Hangers · Rack · AR-Vision
     └───────────┬──┘    └──┬───────────┘
          BLE 5.0│          │BLE 5.0
           ┌─────┴──────────┴─────┐
           │   Myo app            │  REST ↔ cloud
           └──────────────────────┘</pre>
        </section>
      </div>`;
    }
  });
})();
