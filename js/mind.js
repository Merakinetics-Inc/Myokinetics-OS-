/* ═══ MYO — MIND: mental health check-ins, validated self-checks, strategies, guides and where to get help ═══
   Self-checks are the standard free screening questionnaires: PHQ-9 (depression) and GAD-7 (anxiety), developed by
   Drs. Spitzer, Williams, Kroenke and colleagues with an educational grant from Pfizer, no permission required to
   reproduce; and the WHO-5 Well-Being Index (World Health Organization). A score is a screening result, not a diagnosis:
   only a licensed clinician can diagnose. Any answer above 0 on PHQ-9 question 9 shows crisis support at once.
   Privacy: answers and thought records stay on this device (localStorage "myo-mind"); they are never synced or sent
   to Myo AI. They are included in "Download my data" and removed by "Delete my data". */
(function () {
  'use strict';
  const { esc, icon, pill, dayKey, addDays } = OS;
  const KEY = 'myo-mind';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };
  const write = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* private mode: lasts for this visit */ } };
  const TABS = [['checkin', 'Check in'], ['checks', 'Self-checks'], ['tools', 'Strategies'], ['guides', 'Guides'], ['help', 'Get help']];
  const FREQ = ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'];
  const TOOLS = {
    phq9: { name: 'PHQ-9', about: 'Low mood and depression', intro: 'Over the last 2 weeks, how often have you been bothered by any of the following problems?', opts: FREQ, max: 27,
      items: ['Little interest or pleasure in doing things', 'Feeling down, depressed, or hopeless', 'Trouble falling or staying asleep, or sleeping too much', 'Feeling tired or having little energy', 'Poor appetite or overeating', 'Feeling bad about yourself — or that you are a failure or have let yourself or your family down', 'Trouble concentrating on things, such as reading the newspaper or watching television', 'Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual', 'Thoughts that you would be better off dead or of hurting yourself in some way'],
      bands: [[4, 'Minimal', 'good'], [9, 'Mild', 'warn'], [14, 'Moderate', 'warn'], [19, 'Moderately severe', 'bad'], [27, 'Severe', 'bad']] },
    gad7: { name: 'GAD-7', about: 'Anxiety', intro: 'Over the last 2 weeks, how often have you been bothered by the following problems?', opts: FREQ, max: 21,
      items: ['Feeling nervous, anxious or on edge', 'Not being able to stop or control worrying', 'Worrying too much about different things', 'Trouble relaxing', 'Being so restless that it is hard to sit still', 'Becoming easily annoyed or irritable', 'Feeling afraid as if something awful might happen'],
      bands: [[4, 'Minimal', 'good'], [9, 'Mild', 'warn'], [14, 'Moderate', 'warn'], [21, 'Severe', 'bad']] },
    who5: { name: 'WHO-5', about: 'Well-being', intro: 'Over the last two weeks…', opts: ['At no time', 'Some of the time', 'Less than half of the time', 'More than half of the time', 'Most of the time', 'All of the time'], max: 100, pct: true,
      items: ['I have felt cheerful and in good spirits', 'I have felt calm and relaxed', 'I have felt active and vigorous', 'I woke up feeling fresh and rested', 'My daily life has been filled with things that interest me'],
      bands: [[28, 'Low well-being: worth talking to a clinician', 'bad'], [50, 'Below average well-being', 'warn'], [100, 'Good well-being', 'good']] }
  };
  const NEXT = {
    good: 'Keep the habits that are working. Check in again in a month, or sooner if things change.',
    warn: 'Try the strategies on this page for two weeks, then retake this check. If it stays the same or gets worse, talk to your doctor or a therapist.',
    bad: 'Please talk to a doctor or mental health professional soon, ideally this week. These symptoms are common and treatable. If you feel unsafe, use the crisis lines at the top of this page now.'
  };
  const M = { tab: 'checkin', tool: null, ans: {}, result: null, crisis: false };
  const band = (tool, score) => TOOLS[tool].bands.find((b) => score <= b[0]);
  const crisisBar = () => `<div class="mind-crisis" role="note"><b>In crisis or thinking about suicide?</b> Call or text <a href="tel:988">988</a> (US Suicide &amp; Crisis Lifeline), or call your local emergency number. Outside the US, <a href="https://findahelpline.com" target="_blank" rel="noopener">find a helpline</a>.</div>`;

  function latest() {
    const d = read(), c = (d.checks || []).at(-1); if (!c) return null;
    const b = band(c.tool, c.score); return { label: TOOLS[c.tool].name, band: b[1].split(':')[0], status: b[2], at: c.at };
  }

  function checkin(s) {
    const k = dayKey(), today = (s.life.mood || {})[k] || {}, days = Array.from({ length: 14 }, (_, i) => dayKey(addDays(new Date(), i - 13)));
    const row = (key, label, lo, hi) => `<fieldset class="mind-scale"><legend>${label}</legend><div class="mind-opts">${[1, 2, 3, 4, 5].map((v) => `<button type="button" class="${today[key] === v ? 'on' : ''}" data-act="mind-mood" data-k="${key}" data-v="${v}" aria-pressed="${today[key] === v}">${v}</button>`).join('')}</div><span class="small muted">${lo} → ${hi}</span></fieldset>`;
    const L = latest();
    return `<div class="grid g-2"><section class="card"><div class="card-h"><h2>How are you today?</h2><span class="muted small">Takes 10 seconds</span></div>
        ${row('mood', 'Mood', 'very low', 'very good')}${row('energy', 'Energy', 'drained', 'full')}${row('stress', 'Stress', 'calm', 'overwhelmed')}
        <p class="fine">Mood and stress also feed your Life score.</p></section>
      <section class="card"><div class="card-h"><h2>Last 14 days</h2><span class="muted small">Mood (blue) and stress (amber)</span></div>
        <svg class="mind-trend" viewBox="0 0 420 140" role="img" aria-label="Mood and stress over 14 days">${[1, 3, 5].map((v) => `<line x1="20" x2="410" y1="${120 - v * 20}" y2="${120 - v * 20}" stroke="var(--line)" stroke-dasharray="3 4"/>`).join('')}
          ${['mood', 'stress'].map((key, j) => { const pts = days.map((d, i) => [20 + i * 30, (s.life.mood || {})[d] && (s.life.mood || {})[d][key]]).filter((p) => p[1]); return pts.length ? `<path d="${pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${120 - p[1] * 20}`).join('')}" fill="none" stroke="${j ? '#d48b00' : 'var(--accent)'}" stroke-width="2"/>${pts.map((p) => `<circle cx="${p[0]}" cy="${120 - p[1] * 20}" r="3" fill="${j ? '#d48b00' : 'var(--accent)'}"/>`).join('')}` : ''; }).join('')}</svg>
        ${L ? `<p class="small">Latest self-check: <b>${esc(L.label)}</b> ${pill(L.status, L.band)} on ${esc(new Date(L.at).toLocaleDateString())}.</p>` : '<p class="small muted">No self-checks yet. They take 2 minutes on the Self-checks tab.</p>'}</section></div>`;
  }

  function checks() {
    const d = read(), hist = (d.checks || []).slice(-8).reverse();
    if (M.result) {
      const r = M.result, T = TOOLS[r.tool], b = band(r.tool, r.score);
      return `<section class="card mind-result" aria-live="polite"><div class="card-h"><h2>${T.name} result</h2><button class="btn ghost sm" data-act="mind-tool-x">Done</button></div>
        ${M.crisis ? `<div class="banner bad" role="alert"><b>You said you've had thoughts of being better off dead or of hurting yourself.</b> You deserve support right now. Call or text <a href="tel:988">988</a>, or <a href="sms:988">text 988</a>, to reach the Suicide &amp; Crisis Lifeline any time; in an emergency call 911 or your local number. If you can, tell someone you trust how you're feeling today.</div>` : ''}
        <p class="mind-score"><b class="num">${r.score}${T.pct ? '%' : ` / ${T.max}`}</b> ${pill(b[2], b[1])}</p>
        <p>${esc(NEXT[b[2]])}</p>
        <p class="fine">This is a screening result, not a diagnosis. Only a licensed clinician can diagnose depression or anxiety, and they will look at more than a questionnaire. Your answers stay on this device.</p></section>`;
    }
    if (M.tool) {
      const T = TOOLS[M.tool];
      return `<section class="card"><div class="card-h"><h2>${T.name}: ${esc(T.about)}</h2><button class="btn ghost sm" data-act="mind-tool-x">Cancel</button></div>
        <form data-submit="mind-submit" class="mind-q"><p class="small">${esc(T.intro)}</p>
        ${T.items.map((q, i) => `<fieldset><legend>${i + 1}. ${esc(q)}</legend><div class="mind-ans">${T.opts.map((o, v) => `<label><input type="radio" name="q${i}" value="${v}" required ${M.ans[i] === v ? 'checked' : ''}> ${esc(o)}</label>`).join('')}</div></fieldset>`).join('')}
        <div class="row"><button class="btn">See my result</button></div></form></section>`;
    }
    return `<div class="grid g-2"><section class="card"><div class="card-h"><h2>Self-checks</h2><span class="muted small">Validated questionnaires, 2 minutes each</span></div>
        <ul class="mind-tools">${Object.entries(TOOLS).map(([k, T]) => `<li><span><b>${T.name}</b><span class="muted small block">${esc(T.about)} · ${T.items.length} questions</span></span><button class="btn sm" data-act="mind-tool" data-k="${k}">Start</button></li>`).join('')}</ul>
        <p class="fine">These screen for symptoms; they don't diagnose. A clinician can tell you what a score means for you.</p></section>
      <section class="card"><div class="card-h"><h2>Your history</h2><span class="muted small">On this device only</span></div>
        ${hist.length ? `<ul class="mind-hist">${hist.map((c) => { const b = band(c.tool, c.score); return `<li><span>${esc(new Date(c.at).toLocaleDateString())}</span><b>${TOOLS[c.tool].name}</b><span class="num">${c.score}${TOOLS[c.tool].pct ? '%' : ''}</span>${pill(b[2], b[1].split(':')[0])}</li>`; }).join('')}</ul><button class="btn ghost sm" data-act="mind-clear">Clear history</button>` : '<p class="muted small">Results appear here so you can see change over time.</p>'}</section></div>`;
  }

  const STRATS = [
    ['Box breathing', '4 seconds in, hold 4, out 4, hold 4, for 5 minutes. Slows the heart and quiets the stress response.', '#life', 'Start in Life'],
    ['5-4-3-2-1 grounding', 'Name 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste. Pulls attention out of a spiral and into the room.', null, null],
    ['Move for 20 minutes', 'A brisk walk or any training lifts mood within the hour, and regular exercise reduces depression and anxiety symptoms over weeks.', '#training', 'Training'],
    ['Protect your sleep', 'A fixed wake time and no screens for the last 30 minutes do more for mood than most supplements.', '#sleep', 'Sleep'],
    ['Worry time', 'Write worries down as they come, then give them 15 minutes at a set time each day. Outside that window, park them.', null, null],
    ['Reach out', 'Message one person today. Connection is one of the strongest protections for mental health.', null, null]
  ];
  function tools(s) {
    const d = read(), tr = (d.thoughts || []).slice(-3).reverse();
    return `<div class="mind-strats">${STRATS.map(([t, b, href, l]) => `<article class="card"><h3>${esc(t)}</h3><p class="small">${esc(b)}</p>${href ? `<a class="btn ghost sm" href="${href}">${esc(l)}</a>` : ''}</article>`).join('')}</div>
      <div class="grid g-2"><section class="card"><div class="card-h"><h2>Thought record</h2><span class="muted small">A core CBT skill</span></div>
        <form data-submit="mind-thought" class="stack-sm">
          <label class="field" for="mt-s"><span>What happened?</span><input id="mt-s" name="s" maxlength="160" required></label>
          <label class="field" for="mt-t"><span>What went through your mind?</span><input id="mt-t" name="t" maxlength="160" required></label>
          <label class="field" for="mt-e"><span>Feeling and how strong (0–100)</span><input id="mt-e" name="e" maxlength="40" placeholder="e.g. anxious 70"></label>
          <label class="field" for="mt-f"><span>Evidence for and against the thought</span><input id="mt-f" name="f" maxlength="200"></label>
          <label class="field" for="mt-b"><span>A more balanced thought</span><input id="mt-b" name="b" maxlength="160"></label>
          <label class="field" for="mt-r"><span>Feeling now (0–100)</span><input id="mt-r" name="r" type="number" min="0" max="100"></label>
          <button class="btn sm">Save to this device</button></form>
        ${tr.length ? `<ul class="mind-hist">${tr.map((x) => `<li><span>${esc(new Date(x.at).toLocaleDateString())}</span><span>${esc(x.t)} → ${esc(x.b || '…')}</span></li>`).join('')}</ul>` : ''}</section>
      <section class="card"><div class="card-h"><h2>Plan something that lifts you</h2><span class="muted small">Behavioural activation</span></div>
        <p class="small">Low mood shrinks the things we do, which lowers mood further. Scheduling one small enjoyable or meaningful activity breaks the loop.</p>
        <form data-submit="mind-act" class="form-grid"><label class="field" for="ma-n"><span>Activity</span><input id="ma-n" name="n" maxlength="60" required placeholder="e.g. Call Sam, walk in the park"></label><label class="field" for="ma-t"><span>Time today</span><input id="ma-t" name="t" type="time" required value="18:00"></label><div class="form-end"><button class="btn sm">Add to my day</button></div></form></section></div>`;
  }
  const GUIDES = [
    ['Low mood or depression?', 'Feeling down for a few days is normal. When low mood, loss of interest, poor sleep or energy, and trouble concentrating last most days for two weeks or more, it may be depression, which is common and very treatable with talking therapies, medication or both. Start with your doctor or a therapist.'],
    ['Anxiety', 'Anxiety is the body\'s alarm system turned up too high: racing thoughts, tension, restlessness, a fast heart. Breathing exercises help in the moment; cognitive behavioural therapy (CBT) has strong evidence for lasting change.'],
    ['Stress or burnout?', 'Stress is too much pressure; burnout is the exhaustion and detachment that follow months of it. Recovery needs rest and changes to the load itself, not just better coping.'],
    ['When to get help', 'Get help if symptoms last more than two weeks, get in the way of work, relationships or sleep, or if you use alcohol or drugs to cope. Get help now if you think about harming yourself.'],
    ['How therapy works', 'CBT teaches you to notice and change thought and behaviour patterns; ACT helps you act on your values alongside hard feelings. Most people notice change within 6–12 sessions. Online and video therapy work well too.'],
    ['Talking to your doctor', 'Say how long you\'ve felt this way and what it affects. Bring your PHQ-9 or GAD-7 score from this page: doctors use the same questionnaires. Ask what the options are, including therapy.']
  ];
  const guides = () => `<div class="mind-guides">${GUIDES.map(([t, b]) => `<details class="card"><summary><b>${esc(t)}</b></summary><p class="small">${esc(b)}</p></details>`).join('')}</div>`;
  const help = () => `<section class="card"><div class="card-h"><h2>Where to get help</h2><span class="muted small">United States, unless noted</span></div>
      <ul class="mind-help">
        <li><b>988 Suicide &amp; Crisis Lifeline</b><span>Call or text <a href="tel:988">988</a>, or chat at <a href="https://988lifeline.org" target="_blank" rel="noopener">988lifeline.org</a>. Free, confidential, 24/7.</span></li>
        <li><b>Crisis Text Line</b><span>Text HOME to <a href="sms:741741&body=HOME">741741</a>.</span></li>
        <li><b>Emergency</b><span>Call <a href="tel:911">911</a> if you or someone else is in immediate danger.</span></li>
        <li><b>SAMHSA National Helpline</b><span><a href="tel:18006624357">1-800-662-4357</a>: free referrals for mental health and substance use, 24/7.</span></li>
        <li><b>Find treatment</b><span><a href="https://findtreatment.gov" target="_blank" rel="noopener">findtreatment.gov</a> lists licensed providers near you.</span></li>
        <li><b>Outside the US</b><span><a href="https://findahelpline.com" target="_blank" rel="noopener">findahelpline.com</a> lists free helplines in many countries.</span></li>
      </ul>
      <p class="fine">Myo doesn't diagnose or treat mental health conditions and isn't monitored in real time. It can't contact anyone for you.</p></section>`;

  OS.register('mind', {
    title: 'Mind', icon: 'mind',
    render(s) {
      const body = { checkin, checks, tools, guides, help }[M.tab](s);
      return `${OS.ui.head('Mental health', 'Mind', 'Check in, take a validated self-check, learn strategies that work and find support. What you write here stays on this device.')}
        ${crisisBar()}
        <div class="seg kt-tabs" role="tablist" aria-label="Mind">${TABS.map(([k, l]) => `<button role="tab" aria-selected="${M.tab === k}" data-act="mind-tab" data-t="${k}">${l}</button>`).join('')}</div>
        ${body}`;
    }
  });
  OS.act('mind-tab', (el) => { M.tab = el.dataset.t; M.tool = null; M.result = null; OS.render(); });
  OS.act('mind-tool', (el) => { M.tool = el.dataset.k; M.ans = {}; M.result = null; M.crisis = false; OS.render(); });
  OS.act('mind-tool-x', () => { M.tool = null; M.result = null; M.crisis = false; OS.render(); });
  OS.act('mind-submit', (f) => {
    const T = TOOLS[M.tool], vals = T.items.map((_, i) => Number(new FormData(f).get('q' + i)));
    if (vals.some((v) => !Number.isFinite(v))) return;
    const raw = vals.reduce((a, b) => a + b, 0), score = T.pct ? raw * 4 : raw;
    M.crisis = M.tool === 'phq9' && vals[8] > 0;
    const d = read(); (d.checks = d.checks || []).push({ at: new Date().toISOString(), tool: M.tool, score, answers: vals }); d.checks = d.checks.slice(-100); write(d);
    M.result = { tool: M.tool, score }; M.tool = null; OS.render();
    const el = document.querySelector('.mind-result'); if (el) { el.setAttribute('tabindex', '-1'); el.focus(); }
  });
  OS.act('mind-clear', () => { const d = read(); d.checks = []; write(d); OS.render(); OS.toast('Self-check history cleared'); });
  OS.act('mind-mood', (el) => OS.update((s) => { const k = dayKey(); s.life.mood = s.life.mood || {}; s.life.mood[k] = s.life.mood[k] || {}; s.life.mood[k][el.dataset.k] = +el.dataset.v; }));
  OS.act('mind-thought', (f) => { const e = f.elements, d = read(); (d.thoughts = d.thoughts || []).push({ at: new Date().toISOString(), s: e.s.value.trim(), t: e.t.value.trim(), e: e.e.value.trim(), f: e.f.value.trim(), b: e.b.value.trim(), r: e.r.value }); d.thoughts = d.thoughts.slice(-100); write(d); OS.render(); OS.toast('Saved on this device'); });
  OS.act('mind-act', (f) => { OS.update((s) => s.life.blocks.push({ id: OS.uid(), t: f.elements.t.value, dur: 30, title: f.elements.n.value.trim().slice(0, 60), cat: 'mind' })); OS.toast('Added to your day plan'); });
  OS.mind = { latest, read, TOOLS };
})();
