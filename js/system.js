/* ═══ MYOKINETICS OS v4 — SYSTEM: architecture map of the whole ecosystem ═══ */
(function () {
  'use strict';
  const { esc, pill } = OS;

  const LAYERS = [
    { n: 'L5', name: 'Experiences', note: 'Where members, coaches and operators work', mods: [
      ['Member app', 'iOS · Android · web. This build.', 'live', 'today'], ['X-ray Mirror', 'Face + hand tracking: skull, brain, muscles, hand bones (X-Ray Mirror by Hashem Al-Ghaili)', 'live', 'mirror'], ['Myo avatar', 'Living-cell AI avatar: the nucleus holds Myo\'s neural network; voice in and out', 'live', 'coach'], ['3D body', 'Real anatomy (BodyParts3D): nine systems, tap an organ for your markers', 'live', 'body'], ['Machine HMI', 'On-machine screen, session handoff from phone', 'planned'], ['Coach console', 'Roster, programs, AR clips, messaging', 'planned'], ['Facility console', 'Fleet health, utilization, floor plans', 'live', 'gym']] },
    { n: 'L4', name: 'Intelligence', note: 'Engines that turn data into decisions', mods: [
      ['Myo AI coach', 'LLM with tool access to the health graph', 'live', 'coach'], ['Human function engine', 'Movement, cognition, mood and behaviour tests and scores', 'live', 'function'], ['Ascend tiers', 'Baseline, Peak Human, Exo, Neural, Integrated', 'live', 'augment'], ['MK Score engine', 'Biology 30 · recovery 20 · training 20 · nutrition 15 · life 15', 'live', 'today'], ['Protocol engine', 'Rules: biomarker + readiness → daily actions', 'live', 'today'], ['Form engine', 'Joint-angle rules on pose data, rep and tempo detection', 'sim', 'ar'], ['Adaptive load', 'RPE + e1RM progression, deload scheduling', 'live', 'training'], ['Facility planner', 'Clearance, reachability, flow score, capacity', 'live', 'gym']] },
    { n: 'L3', name: 'Health graph & services', note: 'One record per member, consent-scoped', mods: [
      ['Identity & consent', 'Supabase Auth sign-in (email code, Google, Apple); per-member private row, sharing grants', 'live', 'profile'], ['Biomarker store', 'Values, units, optimal vs lab ranges, history', 'live', 'biology'], ['Training log', 'Sessions, sets, loads, machine telemetry', 'live', 'training'], ['Device registry', 'Machines, firmware, pairing, ownership', 'live', 'machines'], ['Nutrition & life', 'Meals, water, habits, goals, schedule, mood', 'live', 'life'], ['Event stream', 'Rep, set and session events across machines', 'sim', 'machines']] },
    { n: 'L2', name: 'Ingest & edge', note: 'Every input normalized into the graph', mods: [
      ['Lab ingest', 'CSV / text today; PDF + HL7 FHIR next', 'live', 'biology'], ['Imaging ingest', 'DICOM CT / MRI / DEXA parsed on-device; 3-plane + 3D hologram', 'live', 'imaging'], ['Wearable sync', 'Oura · WHOOP · Apple Health · Garmin', 'sim', 'biology'], ['Machine gateway', 'BLE 5.0 GATT · MQTT over TLS · OTA', 'sim', 'machines'], ['FTMS bridge', 'Third-party bikes, rowers, treadmills', 'planned', 'machines'], ['AR pipeline', 'LiDAR + RGB → 33-joint pose on local edge', 'sim', 'ar'], ['Augmentation gateway', 'Exoskeleton, EEG, prosthesis and implant feeds', 'planned', 'augment']] },
    { n: 'L1', name: 'Devices', note: 'Merakinetics hardware and partner devices', mods: [
      ['APS Machine 2.0', 'Adaptive shoulder press, bilateral load', 'sim', 'machines'], ['ISO Flow', 'Isokinetic cable, torque + speed', 'sim', 'machines'], ['Dumbbell Hangers', 'Smart storage, pair-lifted detection', 'sim', 'machines'], ['MK-Pro Rack', 'Bar path via AR-Vision', 'sim', 'machines'], ['AR-Vision v2.4', 'LiDAR + RGB form camera', 'sim', 'ar'], ['Medivis (partner)', 'FDA-cleared surgical AR imaging · partnership pending', 'planned', 'imaging'], ['Wearables', 'Ring, strap, watch', 'sim', 'biology']] }
  ];
  const CROSS = [['Security & compliance', 'Encryption in transit and at rest, HIPAA-ready data handling, audit trail, consent before any share.'], ['Red-flag escalation', 'Dangerous lab or vital values trigger an urgent in-person-care alert and pause optimisation of that marker. Everything else runs inside the OS.'], ['Multi-tenant B2B', 'Facilities own fleets and floor plans; members own their health graph and choose what a gym sees.']];
  const ST = { live: ['good', 'In this build'], sim: ['warn', 'Sample feed'], planned: ['muted', 'Planned'] };
  const LOOP = [['Measure', 'Labs, wearables, machine telemetry, AR form data'], ['Score', 'MK Score and per-system biology scores'], ['Prescribe', 'Daily protocol and adaptive training'], ['Execute', 'Train on connected machines with AR correction; live the plan'], ['Retest', 'New labs every 90 days, trends update the protocol']];
  const ENTITIES = [['Member', 'profile, goals, consent grants'], ['Biomarker', 'value, unit, lab range, optimal range, weight, history'], ['Protocol item', 'category, time, linked biomarker, done by day'], ['Program → Session → Exercise → Set', 'load, reps, RPE, machine, telemetry ref'], ['Machine', 'model, link, firmware, owner (member or facility)'], ['Rep event', 'machine, force/torque curve, ROM, tempo, form flags'], ['Facility', 'rooms, floor plans, fleet, members'], ['Meal · Habit · Block · Goal', 'life-management records by day']];

  const MVP = [
    ['Welcome and setup', 'live', 'Introduction, six-step setup that ticks itself off, profile and goals', 'welcome'],
    ['Labs, score, protocol', 'live', 'PDF, CSV and pasted lab import; 24 markers scored against optimal and peak; daily protocol', 'biology'],
    ['3D body', 'live', 'Real anatomy of nine systems (BodyParts3D) with organ pop-outs tied to markers', 'body'],
    ['Training and AR form', 'live', 'Programs, adaptive load, MoveNet pose coaching on camera or video', 'training'],
    ['Imaging', 'live', 'On-device DICOM viewer: three planes and 3D', 'imaging'],
    ['MedTech integrations', 'partial', 'Bluetooth health profiles and the Console work on the device; the hosted Ingest API is built and tested (deploy with supabase/deploy.ps1); vendor partner keys (Dexcom, Withings, Garmin, Vielight) are next', 'connect'],
    ['Sleep study', 'live', '14-night protocol, sleep diary, PDF report, EDF+ recording and CSV uploads read on the device', 'sleep'],
    ['Recovery and physical therapy', 'live', 'Sonosphere sound studio, heat, cold and light protocols, rehab plans with pain monitoring', 'recovery'],
    ['Myo AI coach', 'partial', 'Live inside Claude; the hosted app needs a model API proxy', 'coach'],
    ['Wearables', 'partial', 'File import live; the Supabase proxy (phase 1 and 2: webhooks, daily cache) is built and tested; run supabase/deploy.ps1 with your Oura and WHOOP app keys', 'wearables'],
    ['Accounts and sync', 'partial', 'Supabase sign-in and cloud sync built; needs the project URL and key', 'profile'],
    ['Machines', 'sim', 'APS, ISO Flow and Hangers run on sample telemetry until BLE hardware pairs', 'machines'],
    ['Membership and payments', 'planned', 'Not built: needs a billing provider and plans', null],
    ['Clinician review', 'planned', 'Not built: needs licensed partners for any medical service', null],
    ['App store release', 'planned', 'Install as a web app first; native shell, privacy labels and review after', null]
  ];
  const MVP_ST = { live: ['good', 'In this build'], partial: ['warn', 'Needs backend config'], sim: ['warn', 'Sample feed'], planned: ['muted', 'Planned'] };

  OS.register('system', {
    title: 'System', icon: 'system',
    render() {
      const counts = { live: 0, sim: 0, planned: 0 }; LAYERS.forEach((l) => l.mods.forEach((m) => counts[m[2]]++));
      return `${OS.ui.head('Architecture', 'How Myo runs on Myokinetics OS', 'Five layers from hardware to experience. Each module links to where it runs in this app.',
        `<div class="hstat"><span>In this build</span><b class="num">${counts.live}</b></div><div class="hstat"><span>Sample feed</span><b class="num">${counts.sim}</b></div><div class="hstat"><span>Planned</span><b class="num">${counts.planned}</b></div>`)}
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
