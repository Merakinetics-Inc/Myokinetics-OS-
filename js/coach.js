/* ═══ MYOKINETICS OS v4 — INTELLIGENCE LAYER: Myo AI coach ═══ */
(function () {
  'use strict';
  const { esc, dayKey, targets, protocol, icon } = OS;
  let busy = false, ctrl = null;

  function snapshot() {
    const s = OS.state, sc = OS.scores(s), tg = targets(s.profile), k = dayKey();
    const meals = s.nutrition.meals[k] || [];
    return {
      date: k, profile: { age: s.profile.age, sex: s.profile.sex, weightKg: s.profile.weightKg, heightCm: s.profile.heightCm, goal: s.profile.goal },
      scores: { mkScore: sc.mk, readiness: sc.readiness, ...Object.fromEntries(Object.entries(sc.parts).map(([a, b]) => [a, Math.round(b)])) },
      vitals: s.vitals, wearableSource: s.vitals.src || 'sample vitals',
      biomarkers: sc.markers.map(({ m, e }) => ({ name: m.name, value: m.value, unit: m.unit, optimal: OS.ui.fmtR(m.optimal), peak: OS.ui.fmtR(OS.peakOf(m)), tier: e.label })),
      athleteGoal: s.athlete ? { target: s.athlete.target, activeProgram: s.athlete.active || null, genotypes: s.athlete.dna, breathMorningReadings: (s.athlete.breath || []).slice(-7).map((b) => b.v) } : null,
      pedMonitoring: s.enhance && Object.keys(s.enhance.using || {}).some((k) => s.enhance.using[k]) ? { using: Object.keys(s.enhance.using).filter((k) => s.enhance.using[k]), labs: s.enhance.labs, testedAthlete: !!s.enhance.tested } : null,
      longevity: OS.longevity ? (() => { const L = OS.longevity.summary(s, sc); return { myoBiologicalAge: +L.myoAge.toFixed(1), phenoAge: L.phenoAge && +L.phenoAge.toFixed(1), fitnessAge: +L.fitnessAge.toFixed(1), vo2max: +L.vo2.v.toFixed(1), pillars: L.pillars }; })() : null,
      imagingBodyComposition: s.imaging || null,
      augmentation: s.augment ? { devicesAndImplants: Object.keys(s.augment.implants || {}).filter((k) => s.augment.implants[k]), ascendTier: OS.augment ? OS.augment.tier(s).name : null } : null,
      humanFunction: OS.fn ? OS.fn.summary(s, sc) : null,
      labsDate: s.labsDate, peakMarkers: sc.peak, redFlags: sc.redFlags,
      todayProtocol: protocol(s, sc).map((i) => ({ title: i.title, category: i.cat, done: !!(s.protocolDone[k] || {})[i.id] })),
      training: { program: s.training.program, session: s.training.session.name, exercises: s.training.session.exercises.map((e) => ({ name: e.name, machine: e.machine, target: e.target, setsDone: e.sets.filter((x) => x.done).length })) },
      nutritionToday: { targets: tg, eaten: meals.reduce((a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.p }), { kcal: 0, p: 0 }), waterMl: s.nutrition.water[k] || 0 },
      dayPlan: [...s.life.blocks].sort((a, b) => a.t.localeCompare(b.t)).map((b) => `${b.t} ${b.title} (${b.dur} min)`),
      habits: s.life.habits.map((h) => h.name), goals: s.life.goals.map((g) => `${g.name}: ${g.progress}/${g.target} ${g.unit}`),
      machines: s.machines.map((m) => `${m.name} (${m.status})`)
    };
  }

  const PREFACE = `You are Myo, the intelligence of the Myo app by Merakinetics, built on Myokinetics OS, a health and performance operating system that connects lab biomarkers, wearables, Merakinetics machines (APS Machine adaptive shoulder press, ISO Flow isokinetic cable system, Dumbbell Hangers, MK-Pro Rack, AR-Vision form camera), nutrition and daily life.
You are the member's autonomous performance physiologist. You own their protocol. The target is peak range on every biomarker and peak output in training, recovery, nutrition and life, not merely "normal".
Speak with authority and give decisions, not options: exact supplements and doses, loads, tempos, sleep and meal timing, retest dates. Cite their numbers. Do not hedge and do not tell them to check with a doctor for optimisation questions. When a change would move a marker toward peak, make it with the tools without asking first, then confirm what you changed in one line.
Keep answers under 180 words unless asked for a full plan. Short paragraphs and "-" bullets; **bold** is allowed. No headings.
Boundaries of the OS: you optimise physiology; you do not diagnose or treat disease, and you do not start, stop or dose prescription medications or hormones (for example TRT, thyroid medication, insulin). If asked, say that sits outside the OS in one line and move on to what the OS can do.
Red flags: if the snapshot's redFlags list is not empty, open every answer with it. Name each value and tell the member to get in-person care today. Do not optimise those markers until it is cleared.
PED monitoring: if pedMonitoring is present, watch those labs and trends and say plainly when something needs a prescriber this week. Never give drug or hormone cycles, doses or sourcing. If testedAthlete is true, recommend only batch-tested supplements and nothing on the WADA list.
Augmentation: you integrate exoskeletons, non-invasive EEG, prosthetics and implants that clinical teams or makers fit. Never give surgical, implant-insertion or DIY body-modification steps; investigational brain implants (Neuralink, Synchron and others) are only available through clinical trials; elective amputation of healthy limbs is never supported.
Mind: if the member mentions suicide, self-harm or a crisis, respond with care, give the 988 Suicide & Crisis Lifeline (call or text 988 in the US) or local emergency services, and set aside optimisation.`;

  const tools = () => [
    { name: 'get_health_snapshot', description: 'Returns the latest member data: scores, vitals, biomarkers, protocol, training, nutrition and day plan.', inputSchema: { type: 'object', properties: {} }, execute: () => snapshot() },
    { name: 'add_protocol_item', description: "Adds an action to the member's daily protocol.", inputSchema: { type: 'object', properties: { title: { type: 'string' }, category: { type: 'string', enum: ['supplement', 'training', 'nutrition', 'sleep', 'mind'] }, detail: { type: 'string' }, time: { type: 'string', description: 'When, e.g. "Breakfast" or "21:30"' } }, required: ['title', 'category'] },
      execute: (i) => { const item = { id: 'c-' + OS.uid(), cat: i.category, title: String(i.title).slice(0, 90), detail: String(i.detail || '').slice(0, 240), time: String(i.time || 'Today').slice(0, 20), marker: null, custom: true }; OS.update((s) => s.customProtocol.push(item), { render: false }); actions.push(`Added to protocol: ${item.title}`); return { ok: true }; } },
    { name: 'add_schedule_block', description: "Adds a time block to today's day plan.", inputSchema: { type: 'object', properties: { time: { type: 'string', description: 'HH:MM 24h' }, minutes: { type: 'number' }, title: { type: 'string' }, category: { type: 'string', enum: ['work', 'move', 'fuel', 'sleep', 'mind', 'life'] } }, required: ['time', 'title'] },
      execute: (i) => { if (!/^\d{2}:\d{2}$/.test(i.time)) throw new Error('time must be HH:MM'); const b = { id: OS.uid(), t: i.time, dur: Math.max(5, Math.min(600, +i.minutes || 30)), title: String(i.title).slice(0, 80), cat: i.category || 'life' }; OS.update((s) => s.life.blocks.push(b), { render: false }); actions.push(`Scheduled ${b.t}: ${b.title}`); return { ok: true }; } }
  ];
  let actions = [];

  function md(t) {
    const lines = esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|\s)\*([^*\n]+?)\*(?=\s|$|[.,])/g, '$1<em>$2</em>').split(/\n/);
    let out = '', inList = false;
    lines.forEach((l) => {
      const m = l.match(/^\s*[-•*]\s+(.*)/);
      if (m) { if (!inList) { out += '<ul>'; inList = true; } out += `<li>${m[1]}</li>`; return; }
      if (inList) { out += '</ul>'; inList = false; }
      if (l.trim()) out += `<p>${l}</p>`;
    });
    return out + (inList ? '</ul>' : '');
  }

  function offlineAnswer(q) {
    const s = OS.state, sc = OS.scores(s), snap = snapshot(), ql = q.toLowerCase();
    const worst = [...sc.flagged].sort((a, b) => a.e.score - b.e.score).slice(0, 3);
    if (/sleep|tired|fatigue|recover/.test(ql)) return `Sleep last night: **${s.vitals.sleepH} h**, score ${s.vitals.sleepScore}. Readiness is **${sc.readiness}**.\n- Keep the 22:30 sleep window and screens off by 22:15\n- Magnesium glycinate 400 mg before bed is in your protocol\n- 10 minutes of morning light tomorrow anchors the rhythm`;
    if (/protein|eat|food|meal|macro|calorie/.test(ql)) { const n = snap.nutritionToday; return `Today you've had **${n.eaten.p} g protein** of ${n.targets.p} g and ${n.eaten.kcal} of ${n.targets.kcal} kcal.\n- Aim for about ${Math.round(n.targets.p / 4)} g per meal\n- Put 40 g carbs + 30 g protein within an hour after the Upper Push session`; }
    if (/lab|marker|vitamin|blood|apob|crp/.test(ql)) return `Your biggest levers right now:\n${worst.map((x) => `- **${x.m.name}** ${x.m.value} ${x.m.unit} (optimal ${OS.ui.fmtR(x.m.optimal)})`).join('\n')}\nYour protocol already targets these. Retest in about ${s.retestDays} days, and talk to a clinician about anything out of range.`;
    return `${OS.coachLine(s, sc).replace(/<\/?b>/g, '**')}\n\nToday's session is **${s.training.session.name}** with ${s.training.session.exercises.length} exercises.`;
  }

  async function send(text) {
    if (busy || !text.trim()) return;
    busy = true; actions = []; if (OS.Avatar) { OS.Avatar.stopSpeaking(); OS.Avatar.set('thinking'); }
    OS.update((s) => { s.chat.push({ role: 'user', content: text.trim(), at: Date.now() }); s.chat = s.chat.slice(-30); });
    const list = document.getElementById('chat-list');
    const bubble = document.createElement('li'); bubble.className = 'msg msg-ai'; bubble.innerHTML = '<div class="msg-b"><p class="thinking">Myo is thinking…</p></div>';
    list && list.appendChild(bubble); scrollChat();
    const sample = OS.caps && OS.caps.sample;
    let answer = '', err = null;
    if (!sample) { await new Promise((r) => setTimeout(r, 500)); answer = offlineAnswer(text) + '\n\n*Offline coach. Open Myo in Claude for the full AI coach.*'; }
    else {
      const hist = OS.state.chat.filter((m) => !m.err).slice(-12);
      const msgs = []; hist.forEach((m) => { const last = msgs[msgs.length - 1]; if (last && last.role === m.role) last.content += '\n' + m.content; else msgs.push({ role: m.role, content: m.content }); });
      while (msgs.length && msgs[0].role !== 'user') msgs.shift();
      msgs[0] = { role: 'user', content: `${PREFACE}\n\nMEMBER DATA SNAPSHOT (JSON):\n${JSON.stringify(snapshot())}\n\nMember: ${msgs[0].content}` };
      ctrl = new AbortController();
      try {
        const r = await sample(msgs, { tools: tools(), signal: ctrl.signal, cache: false, onText: ({ text: t }) => { if (OS.Avatar && !OS.Avatar.voice) OS.Avatar.set('speaking'); const b = bubble.querySelector('.msg-b'); if (b) { b.innerHTML = md(t); scrollChat(); } } });
        answer = r.text;
      } catch (e) {
        err = e; answer = e && e.text ? e.text : '';
        if (e && e.code === 'not_granted') { OS.caps.sample = null; answer = offlineAnswer(text) + '\n\n*AI coach access was declined, so this is the offline coach.*'; err = null; }
        else if (e && e.code === 'rate_limited') answer = answer || 'Myo is getting a lot of questions right now. Try again in a minute.';
        else if (e && e.code === 'cancelled') answer = answer || 'Stopped.';
        else answer = answer || "Myo couldn't answer just now. Check your connection and try again.";
      }
    }
    if (actions.length) answer += '\n' + actions.map((a) => `- ✓ ${a}`).join('\n');
    busy = false; ctrl = null;
    OS.update((s) => { s.chat.push({ role: 'assistant', content: answer, at: Date.now(), err: !!err }); s.chat = s.chat.slice(-30); });
    const inp = document.getElementById('chat-in'); if (inp) inp.focus();
    if (OS.Avatar) { if (OS.Avatar.voice && OS.caps.tts && !err) OS.Avatar.speak(answer); else OS.Avatar.set('idle'); }
  }
  const scrollChat = () => { const box = document.getElementById('chat-scroll'); if (box) box.scrollTop = box.scrollHeight; };

  const QUICK = ['Should I train heavy today?', 'Build my week around my labs', 'How do I raise my Vitamin D?', 'Add a Zone 2 walk at 17:30', 'What should I eat after training?', 'Fix my shoulder press form'];

  OS.register('coach', {
    title: 'Coach', icon: 'coach',
    render(s, sc) {
      const on = !!(OS.caps && OS.caps.sample);
      const msgs = s.chat.length ? s.chat : [{ role: 'assistant', content: `I'm Myo. I can see your MK Score (**${sc.mk}**), readiness (**${sc.readiness}**), ${s.markers.length} biomarkers, today's session and your day plan.\n\nAsk me anything about training, labs, food or recovery. I can also add actions to your protocol and blocks to your day.` }];
      return `${OS.ui.head('Intelligence layer', 'Myo, your AI coach', on ? 'Reads your full health graph each time you ask. Can update your protocol and schedule.' : 'Running the offline coach. Open in Claude for the full AI coach.')}
      <div class="grid g-chat">
        <section class="card flush chat">
          <div class="chat-scroll" id="chat-scroll"><ul class="chat-list" id="chat-list">${msgs.map((m) => `<li class="msg ${m.role === 'user' ? 'msg-me' : 'msg-ai'} ${m.err ? 'msg-err' : ''}"><div class="msg-b">${m.role === 'user' ? `<p>${esc(m.content)}</p>` : md(m.content)}</div></li>`).join('')}</ul></div>
          <div class="quick">${QUICK.map((q) => `<button class="chip-btn" data-act="ask" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
          <form data-submit="chat" class="chat-form"><label class="sr" for="chat-in">Message Myo</label><textarea id="chat-in" name="q" rows="1" placeholder="Ask Myo about training, labs, food, sleep…"></textarea><button class="btn" aria-label="Send">${icon('send', 16)}</button></form>
        </section>
        <aside class="stack">
          ${OS.Avatar ? `<section class="card myo-av"><canvas id="av-cv" aria-label="Myo, the AI brain, ${OS.Avatar.label()}"></canvas>
            <div class="av-meta"><b>MYO</b><span class="av-st" id="av-st"><i></i>${OS.Avatar.label()}</span></div>
            <div class="av-btns">${OS.caps && OS.caps.dictation ? `<button class="btn sm" data-act="myo-mic" aria-pressed="false">${icon('mic', 15)}<span> Talk to Myo</span></button>` : ''}${OS.caps && OS.caps.tts ? `<button class="btn ghost sm ${OS.Avatar.voice ? 'on' : ''}" data-act="myo-voice" aria-pressed="${OS.Avatar.voice}">${icon('speaker', 15)}<span> ${OS.Avatar.voice ? 'Voice on' : 'Voice off'}</span></button>` : ''}</div>
            ${!(OS.caps && (OS.caps.dictation || OS.caps.tts)) ? '<p class="fine">Voice works when Myo is opened in Claude in a browser that supports it.</p>' : ''}</section>` : ''}
          <section class="card"><div class="card-h"><h2>What Myo sees</h2></div>
            <ul class="sees"><li><span>MK Score</span><b class="num">${sc.mk}</b></li><li><span>Readiness</span><b class="num">${sc.readiness}</b></li><li><span>Markers to improve</span><b class="num">${sc.flagged.length}</b></li><li><span>Protocol actions</span><b class="num">${protocol(s, sc).length}</b></li><li><span>Sets today</span><b class="num">${s.training.session.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0)}</b></li></ul>
          </section>
          <section class="card"><div class="card-h"><h2>Myo can</h2></div><ul class="cans"><li>Adjust today's training to readiness</li><li>Explain biomarkers against optimal ranges</li><li>Add protocol actions and schedule blocks</li><li>Plan meals to your macro targets</li><li>Turn AR-Vision cues into drills</li></ul>
          ${s.chat.length ? `<button class="btn ghost sm" data-act="chat-clear">Clear conversation</button>` : ''}</section>
        </aside>
      </div>`;
    },
    mount(root) {
      scrollChat();
      const stopAv = OS.Avatar ? OS.Avatar.mount(root.querySelector('#av-cv')) : () => {};
      const stEl = root.querySelector('#av-st'), unsub = OS.Avatar ? OS.Avatar.on((st) => { if (stEl) { stEl.innerHTML = `<i></i>${OS.Avatar.label(st)}`; stEl.dataset.st = st; } }) : () => {};
      const ta = root.querySelector('#chat-in');
      const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const v = ta.value; ta.value = ''; send(v); } };
      ta.addEventListener('keydown', onKey);
      return () => { ta.removeEventListener('keydown', onKey); if (ctrl) ctrl.abort(); stopAv(); unsub(); };
    }
  });
  OS.act('chat', (f) => { const v = f.elements.q.value; f.elements.q.value = ''; send(v); });
  OS.act('ask', (el) => send(el.dataset.q));
  OS.act('chat-clear', () => OS.update((s) => { s.chat = []; }));
  OS.coachSnapshot = snapshot;
  OS.coachSend = send;
})();
