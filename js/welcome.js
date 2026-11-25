/* ═══ MYO — WELCOME: introduction to the platform and first-run setup ═══
   Shown on first open (no route yet and setup not finished), and from More › Welcome at any time.
   Hero with the live 3D body, the core loop, everything Myo runs, and a six-step setup whose steps
   tick themselves off from the member's real state (profile, labs, wearable, sign-in, machines, Myo). */
(function () {
  'use strict';
  const { esc, icon, pill } = OS;
  const LOOP = [['Measure', 'Labs, wearables, scans, machine telemetry and AR form data', 'biology'], ['Score', 'Myo Score and a score for every body system', 'today'], ['Prescribe', 'A daily protocol and adaptive training', 'today'], ['Execute', 'Train on connected machines with AR correction', 'training'], ['Retest', 'New labs every 90 days; the plan updates itself', 'biology']];
  const RUNS = [
    ['body', 'Body', 'See every system in 3D and pull out any organ with your results.', ['body', 'biology', 'imaging', 'longevity', 'function']],
    ['recovery', 'Recovery and rehab', 'Sonosphere sound baths, heat, cold and red light, and physical therapy plans.', ['recovery', 'pt']],
    ['training', 'Training', 'Programs that adapt to readiness, with AR form coaching.', ['training', 'ar', 'athlete', 'machines']],
    ['coach', 'Myo coach', 'An AI performance physiologist that reads all of it.', ['coach']],
    ['fuel', 'Life', 'Food, water, habits, schedule and supplements.', ['fuel', 'life', 'enhance']],
    ['wearable', 'Wearables', 'Oura and WHOOP sleep, HRV and recovery.', ['wearables']],
    ['augment', 'Ascend', 'From peak human to exoskeletons and neural links.', ['augment', 'mirror']]
  ];
  const WEEK = [['Set up and baseline', 'Profile, sign-in and a look at your 3D body', 'welcome'], ['Labs', 'Upload a recent panel and get your Myo Score', 'biology'], ['Train', 'First adaptive session with AR form checks', 'training'], ['Recover', 'A Sonosphere session and your heat and cold plan', 'recovery'], ['Fuel', 'Hit your protein and water targets', 'fuel'], ['Function', 'Reaction, memory and balance tests', 'function'], ['Review with Myo', 'Ask Myo what moved and what to change', 'coach']];
  const ASK = ['What should I focus on this week?', 'Why is my readiness lower today?', 'Plan my recovery after a heavy leg day'];
  function steps(s) {
    const W = s.wear || {}, wear = (W.oura && W.oura.days && W.oura.days.length) || (W.whoop && W.whoop.days && W.whoop.days.length);
    const signed = (OS.auth && OS.auth.user) || OS.Persist.mode === 'account' || OS.Persist.mode === 'cloud';
    return [
      { k: 'profile', t: 'Tell Myo about you', d: 'Age, sex, body size and goal set your targets and reference ranges.', done: !!(s.profile.name && !/^sample/i.test(s.profile.name)), go: null },
      { k: 'labs', t: 'Add your lab results', d: 'Upload a PDF, CSV or paste any recent bloodwork. No new blood draw needed.', done: !!s.labsImported, go: 'biology' },
      { k: 'wear', t: 'Connect a wearable', d: 'Oura or WHOOP sleep, HRV and recovery set your daily readiness.', done: !!wear, go: 'wearables' },
      { k: 'sync', t: 'Save to your account', d: 'Sign in so your data follows you to every device.', done: !!signed, go: 'profile' },
      { k: 'machines', t: 'Pair your machines', d: 'APS Machine, ISO Flow and Dumbbell Hangers stream every rep.', done: !!(s.machinesPaired), go: 'machines' },
      { k: 'myo', t: 'Meet Myo', d: 'Ask your first question. Myo already knows your scores.', done: !!(s.chat && s.chat.length), go: 'coach' }
    ];
  }
  OS.register('welcome', {
    title: 'Intro', icon: 'home', hidden: true,
    render(s, sc) {
      const st = steps(s), done = st.filter((x) => x.done).length, p = s.profile;
      const f = (id, label, input) => `<label class="field" for="${id}"><span>${label}</span>${input}</label>`;
      return `<section class="wl-hero" aria-label="Welcome to Myo">
        <div class="wl-copy">
          <p class="wl-eyebrow">Myo · built on Myokinetics OS</p>
          <h1>Welcome to the master operating system for your body.</h1>
          <p class="wl-lead">Myo reads your labs, wearables, scans, training and daily life, scores every system of your body, and runs a plan each day that moves you toward peak range. Physician-optional, measured and safe.</p>
          <div class="wl-cta"><a class="btn wl-btn" href="#wl-setup" data-act="wl-scroll">${done === st.length ? 'Review setup' : 'Start setup'}</a><a class="btn ghost wl-btn-ghost" href="#body">Explore your body in 3D</a></div>
          <dl class="wl-stats"><div><dt>Myo Score</dt><dd class="num">${OS.dash(sc.mk)}</dd></div><div><dt>Readiness</dt><dd class="num">${OS.dash(sc.readiness)}</dd></div><div><dt>Biomarkers</dt><dd class="num">${s.markers.length}</dd></div><div><dt>Body systems</dt><dd class="num">9</dd></div></dl>
        </div>
        <div class="wl-figure"><div class="a3d" data-a3d="compact" data-systems="skin,cardiovascular,nervous" aria-label="3D body"></div></div>
      </section>

      <section class="wl-sec wl-myo" aria-labelledby="wl-meet"><div class="wl-myo-grid">
          <div class="wl-myo-av">${OS.Avatar ? '<canvas id="wl-av" aria-label="Myo, drawn as a living cell"></canvas>' : ''}</div>
          <div class="wl-myo-copy"><p class="eyebrow">Meet Myo</p><h2 id="wl-meet">Your AI performance physiologist</h2>
            <p class="wl-p">Myo is the intelligence inside the app, drawn as a living cell: its nucleus is a neural network. It reads every number here (labs, sleep, training, recovery, scans) and tells you what to do next, in plain language.</p>
            <ul class="wl-can"><li>Adjusts today's training to your readiness</li><li>Explains each biomarker against optimal and peak ranges</li><li>Builds your recovery and rehab plans</li><li>Listens and talks where your browser allows voice</li></ul>
            <div class="wl-ask">${ASK.map((q) => `<button class="chip-btn" data-act="wl-ask" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
            <p class="fine">Myo does not diagnose or prescribe medicines. It flags dangerous results and sends you to in-person care.</p></div></div></section>

      <section class="wl-sec" aria-labelledby="wl-how"><div class="wl-sec-h"><p class="eyebrow">How it works</p><h2 id="wl-how">One loop, run every day</h2></div>
        <ol class="wl-loop">${LOOP.map(([t, d, r], i) => `<li><a href="#${r}"><span class="wl-n num">${i + 1}</span><b>${t}</b><span>${d}</span></a></li>`).join('')}</ol>
      </section>

      <section class="wl-sec" aria-labelledby="wl-runs"><div class="wl-sec-h"><p class="eyebrow">Everything in one OS</p><h2 id="wl-runs">What Myo runs for you</h2></div>
        <div class="wl-runs">${RUNS.map(([ic, t, d, items]) => `<article class="wl-run"><span class="wl-ic">${icon(ic, 20)}</span><h3>${t}</h3><p>${d}</p><div class="wl-links">${items.filter((n) => OS.views[n]).map((n) => `<a href="#${n}">${esc(OS.views[n].title)} →</a>`).join('')}</div></article>`).join('')}</div>
      </section>

      <section class="wl-sec" aria-labelledby="wl-week"><div class="wl-sec-h"><p class="eyebrow">Your first week</p><h2 id="wl-week">Seven days to know your body</h2></div>
        <ol class="wl-week">${WEEK.map(([t, d, r], i) => `<li><a href="#${r}"><span class="wl-day">Day ${i + 1}</span><b>${t}</b><span>${d}</span></a></li>`).join('')}</ol>
      </section>

      <section class="wl-sec" id="wl-setup" aria-labelledby="wl-set"><div class="wl-sec-h"><p class="eyebrow">Set up Myo</p><h2 id="wl-set">Six steps to your first real score</h2>${OS.sampleBanner ? OS.sampleBanner(s) : ''}
          <div class="wl-prog"><span class="wl-bar"><i style="width:${Math.round((done / st.length) * 100)}%"></i></span><b class="num">${done} of ${st.length}</b></div></div>
        <ol class="wl-steps">${st.map((x, i) => `<li class="${x.done ? 'is-done' : ''}">
            <span class="wl-check" aria-hidden="true">${x.done ? icon('check', 16) : `<span class="num">${i + 1}</span>`}</span>
            <div class="wl-step"><b>${x.t}</b><p>${x.d}</p>
              ${x.k === 'profile' && !x.done ? `<form data-submit="profile-save" class="form-grid wl-form">
                ${f('wl-name', 'Name', `<input id="wl-name" name="name" autocomplete="name" placeholder="Your name">`)}
                ${f('wl-age', 'Age', `<input id="wl-age" name="age" type="number" min="14" max="99" value="${p.age}">`)}
                ${f('wl-sex', 'Sex (for reference ranges)', `<select id="wl-sex" name="sex"><option value="M" ${p.sex === 'M' ? 'selected' : ''}>Male</option><option value="F" ${p.sex === 'F' ? 'selected' : ''}>Female</option></select>`)}
                ${f('wl-goal', 'Goal', `<select id="wl-goal" name="goal">${[['cut', 'Fat loss'], ['recomp', 'Recomposition'], ['gain', 'Muscle gain']].map(([v, l]) => `<option value="${v}" ${p.goal === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
                ${f('wl-w', 'Weight (kg)', `<input id="wl-w" name="w" type="number" step="0.1" value="${p.weightKg}">`)}
                ${f('wl-h', 'Height (cm)', `<input id="wl-h" name="h" type="number" value="${p.heightCm}">`)}
                <input type="hidden" name="act" value="${p.activity}">
                <div class="form-end"><button class="btn sm">Save and continue</button></div></form>` : ''}
            </div>
            <div class="wl-act">${x.done ? pill('good', 'Done') : x.go ? `<a class="btn ghost sm" href="#${x.go}">${x.k === 'labs' ? 'Upload labs' : x.k === 'wear' ? 'Connect' : x.k === 'sync' ? 'Sign in' : x.k === 'machines' ? 'Pair' : 'Ask Myo'}</a>` : ''}</div>
          </li>`).join('')}</ol>
        <div class="wl-finish"><p class="fine">${esc(OS.TERMS)}</p><button class="btn" data-act="wl-done">${done === st.length ? 'Go to Today' : 'Finish later, go to Today'}</button></div>
      </section>`;
    },
    mount(root) {
      const a = OS.Anatomy ? OS.Anatomy.mountAll(root) : null;
      const av = OS.Avatar ? OS.Avatar.mount(root.querySelector('#wl-av')) : null;
      return () => { if (a) a(); if (av) av(); };
    }
  });
  OS.act('wl-ask', (el) => { const q = el.dataset.q; OS.go('coach'); setTimeout(() => { if (OS.coachSend) OS.coachSend(q); }, 80); });
  OS.act('wl-done', () => { OS.update((s) => { s.welcomed = new Date().toISOString(); }, { keepSample: true, render: false }); OS.go('today'); });
  OS.act('wl-scroll', () => { const el = document.getElementById('wl-setup'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
})();
