/* ═══ MYOKINETICS OS v4 — BOOT: shell, nav, delegation, capabilities, persistence ═══ */
(function () {
  'use strict';
  const { icon, esc } = OS;
  // navigation: groups for the top pill bar (menus on desktop), four tabs + a menu sheet on phones
  const GROUPS = [
    { k: 'intro', label: 'Intro', items: ['welcome'] },
    { k: 'today', label: 'Today', items: ['today'] },
    { k: 'body', label: 'Body', items: ['body', 'atlas', 'heart', 'flow', 'bodycomp', 'biology', 'biochem', 'sleep', 'looks', 'recovery', 'wave', 'pt', 'surgery', 'imaging', 'ultrasound', 'mirror', 'function', 'longevity', 'wearables'] },
    { k: 'training', label: 'Training', items: ['training', 'motion', 'athlete', 'ar', 'machines', 'gym'] },
    { k: 'myo', label: 'Myo', items: ['myo', 'twin', 'mode', 'score', 'stream', 'bci', 'coach'] },
    { k: 'life', label: 'Life', items: ['fuel', 'kitchen', 'life', 'mind', 'pregnancy', 'logbook', 'enhance'] },
    { k: 'more', label: 'More', items: ['connect', 'evidence', 'report', 'augment', 'system'] }
  ];
  const DESC = { mode: 'Full-screen neuro and body dashboard with a full scan', score: 'Your five systems, trend and QR sharing', kitchen: 'Food search, recipes, week plan, supplements, partners', mind: 'Check-ins, self-checks, strategies and support', motion: 'XR vector analysis: jumps and movement screens', biochem: 'Metabolic pathways mapped to your labs', evidence: 'New studies and the review queue', myo: 'Every function around the living cell', coach: 'Ask Myo by voice or text', report: 'A printable summary for you or your clinician', profile: 'Account, sync and your data rights', today: "Today's protocol and scores", connect: 'MedTech devices, Bluetooth and the Ingest API', looks: 'Physique, skin, face and procedures build', sleep: '14-night study, sleep reports and recordings', recovery: 'Sonosphere sound, heat, cold, red light', pt: 'Rehab plans with pain monitoring', body: 'Real 3D anatomy, every system', biology: 'Biomarkers against optimal ranges', imaging: 'CT, MRI, X-ray, ultrasound and DEXA viewer', heart: 'Anatomy, one heartbeat, ECG rhythm, coronary views', stream: 'Camera pulse, heart sounds, breathing, Bluetooth strap', logbook: 'Every input on one timeline, plus symptoms', bodycomp: 'Smart scale, DEXA and your scale-to-DEXA offset', twin: 'A 3D model of you: systems, what-if plans, AI', surgery: 'Surgery companion and OR workflow board', atlas: 'Every system, how they connect, embryo to old age', flow: 'Circulation, Doppler monitor, perfusion, vascular scans', ultrasound: 'Live view, freeze and measure from any scanner', pregnancy: 'Dates, scans, growth chart and red flags', wave: 'StemWave and shockwave sessions by area', bci: 'EEG lab, decoders, implant design, neural API', mirror: 'Live x-ray of head and hands', function: 'Movement, cognition and mood tests', longevity: 'Biological age and healthspan plan', wearables: 'Oura and WHOOP sync', training: "Today's session and program", athlete: 'Build toward an athlete type', ar: 'Form coaching on camera', machines: 'APS, ISO Flow and connected gear', gym: 'Plan a facility', fuel: 'Meals, protein and water', life: 'Habits, schedule and goals', enhance: 'Supplements, graded by evidence', augment: 'Ascend tiers and devices', system: 'How Myo is built and MVP status', welcome: 'Introduction and setup' };
  OS.navDesc = DESC;
  const TABS = ['today', 'myo', 'body', 'training'];
  const chev = '<svg class="chev" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 4.5l3 3 3-3"/></svg>';
  const groups = () => GROUPS.map((g) => ({ ...g, items: g.items.filter((n) => OS.views[n]) })).filter((g) => g.items.length);
  OS.navGroups = groups;
  OS.caps = { sample: null, downloads: null, tts: null, dictation: null };
  // state: device copy first so the first frame is real, then the account copy when it answers
  const local = OS.Persist.loadLocal();
  OS.state = local && local.v === 4 ? local : OS.seed();

  function closeMenus(except) { document.querySelectorAll('.tn-i[aria-expanded="true"]').forEach((b) => { if (b !== except) { b.setAttribute('aria-expanded', 'false'); const m = document.getElementById(b.getAttribute('aria-controls')); if (m) m.hidden = true; } }); }
  function buildNav() {
    const top = document.getElementById('topnav'), tab = document.getElementById('tabbar');
    top.innerHTML = groups().map((g) => g.items.length === 1
      ? `<a class="tn-i" href="#${g.items[0]}" data-group="${g.k}" data-route="${g.items[0]}">${g.label}</a>`
      : `<button type="button" class="tn-i" data-group="${g.k}" aria-expanded="false" aria-controls="tn-${g.k}">${g.label}${chev}</button><div class="tn-menu" id="tn-${g.k}" hidden>${g.items.map((n) => `<a href="#${n}" data-route="${n}"><span>${icon(OS.views[n].icon, 18)}</span><b>${esc(OS.views[n].title)}</b><small>${esc(DESC[n] || '')}</small></a>`).join('')}</div>`).join('');
    tab.innerHTML = TABS.filter((n) => OS.views[n]).map((n) => `<a href="#${n}" data-route="${n}">${icon(OS.views[n].icon, 20)}<span>${esc(OS.views[n].title)}</span></a>`).join('') + `<button type="button" data-act="nav-sheet" aria-haspopup="dialog">${icon('system', 20)}<span>Menu</span></button>`;
    top.addEventListener('click', (e) => {
      const b = e.target.closest('button.tn-i'); if (b) { const open = b.getAttribute('aria-expanded') !== 'true'; closeMenus(b); b.setAttribute('aria-expanded', String(open)); document.getElementById(b.getAttribute('aria-controls')).hidden = !open; return; }
      if (e.target.closest('a')) closeMenus();
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('#topnav')) closeMenus(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeMenus(); const sh = document.getElementById('sheet'); if (sh && !sh.hidden) sh.hidden = true; } });
  }
  OS.act('skip', () => { const h = document.querySelector('#view h1') || document.getElementById('main'); h.setAttribute('tabindex', '-1'); h.focus(); });
  OS.act('nav-sheet', () => {
    const sh = document.getElementById('sheet'), cur = OS.current;
    sh.innerHTML = `<div class="sheet-in" role="dialog" aria-label="All of Myo"><span class="sheet-grip"></span>${groups().map((g) => `<section><h3>${g.label}</h3><div class="sheet-grid">${g.items.map((n) => `<a href="#${n}" ${n === cur ? 'aria-current="page"' : ''}><span>${icon(OS.views[n].icon, 18)}</span>${esc(OS.views[n].title)}</a>`).join('')}</div></section>`).join('')}</div>`;
    sh.hidden = false;
  });
  document.addEventListener('click', (e) => { const sh = document.getElementById('sheet'); if (sh && !sh.hidden && (e.target === sh || e.target.closest('.sheet a'))) sh.hidden = true; });
  function header() {
    const sc = OS.scores(OS.state);
    document.getElementById('hdr-score').textContent = OS.dash(sc.mk);
    document.getElementById('hdr-ready').textContent = OS.dash(sc.readiness);
    const u = OS.auth && OS.auth.user, av = document.getElementById('avatar');
    av.textContent = u ? OS.auth.initials() : (OS.state.profile.initials || 'MK');
    av.dataset.auth = u ? 'in' : 'out';
    av.title = u ? `Signed in as ${u.email || 'member'}` : 'Profile and sign-in';
    const mode = OS.Persist.mode;
    document.getElementById('save-state').textContent = mode === 'cloud' ? 'Synced to your Myo account' : mode === 'account' ? 'Synced to your account' : mode === 'device' ? 'Saved on this device' : 'Not saved';
  }
  OS.on('header', header);
  OS.on('saved', header);
  OS.on('route', (name) => {
    document.querySelectorAll('#topnav [data-route], #tabbar [data-route]').forEach((a) => a.setAttribute('aria-current', a.dataset.route === name ? 'page' : 'false'));
    const g = groups().find((x) => x.items.includes(name));
    document.querySelectorAll('#topnav .tn-i[data-group]').forEach((b) => b.classList.toggle('on', !!g && b.dataset.group === g.k));
    const mb = document.querySelector('#tabbar [data-act="nav-sheet"]'); if (mb) mb.setAttribute('aria-current', TABS.includes(name) ? 'false' : 'page');
    closeMenus();
  });

  // event delegation: data-act (click), data-change (change), data-submit (forms)
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'FORM') return;
    const fn = OS.acts[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.addEventListener('change', (e) => { const el = e.target.closest('[data-change]'); if (el && OS.changes[el.dataset.change]) OS.changes[el.dataset.change](el, e); });
  document.addEventListener('submit', (e) => { const f = e.target.closest('form[data-submit]'); if (!f) return; e.preventDefault(); const fn = OS.acts[f.dataset.submit]; if (fn) fn(f, e); });
  window.addEventListener('hashchange', () => OS.render());

  buildNav();
  // first open: introduce Myo before anything else
  if (!location.hash && !OS.state.welcomed) location.hash = 'welcome';
  OS.render();
  if (OS.Avatar) OS.Avatar.mount(document.getElementById('orb-cv'), { small: true });
  if (OS.Avatar) OS.Avatar.on((st) => { const o = document.getElementById('orb'); if (o) { o.dataset.st = st; o.title = 'Myo · ' + OS.Avatar.label(st); } });

  // capabilities light up when the viewer answers; the app works without them
  if (window.claude && window.claude.use) {
    window.claude.use('sample').then((s) => { OS.caps.sample = s; if (OS.current === 'coach') OS.render(); }).catch(() => {});
    window.claude.use('downloads').then((d) => { OS.caps.downloads = d; }).catch(() => {});
    window.claude.use('tts').then((t) => { if (!t) return; OS.caps.tts = t; if (OS.Avatar) t.onState(({ state }) => { if (state === 'speaking') OS.Avatar.set('speaking'); else if (OS.Avatar.state === 'speaking') OS.Avatar.set('idle'); }); if (OS.current === 'coach') OS.render(); }).catch(() => {});
    window.claude.use('dictation').then((d) => { if (!d) return; OS.caps.dictation = d; if (OS.Avatar) OS.Avatar.wireDictation(d); if (OS.current === 'coach') OS.render(); }).catch(() => {});
  }
  OS.Persist.connect().then((remote) => {
    if (remote && remote.v === 4) { OS.state = remote; OS.render(); }
    header();
  });

  // installable and offline-capable on hosted copies (sw.js). Claude's viewer and file:// pages skip it.
  OS.sw = { state: 'off' };
  if ('serviceWorker' in navigator && !(window.claude && window.claude.use) && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    OS.sw.state = 'starting';
    navigator.serviceWorker.register('sw.js').then((reg) => {
      OS.sw.state = navigator.serviceWorker.controller ? 'ready' : 'installing';
      navigator.serviceWorker.ready.then(() => { OS.sw.state = 'ready'; });
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    }).catch((e) => { OS.sw.state = 'failed'; OS.logError('sw', e && e.message, 'register'); });
  }
  // install prompt (Chromium): offered from the System page, never popped up unasked
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); OS.installPrompt = e; OS.emit('install'); });
  window.addEventListener('appinstalled', () => { OS.installPrompt = null; OS.toast('Myo is installed. Open it from your home screen or app list.'); });
  OS.act('install', async () => { const p = OS.installPrompt; if (!p) return; p.prompt(); try { await p.userChoice; } catch { /* dismissed */ } OS.installPrompt = null; OS.render(); });
  const offline = () => document.documentElement.toggleAttribute('data-offline', !navigator.onLine);
  window.addEventListener('online', () => { offline(); OS.toast('Back online'); });
  window.addEventListener('offline', () => { offline(); OS.toast("You're offline. Myo keeps working on this device and syncs when you're back."); });
  offline();
})();
