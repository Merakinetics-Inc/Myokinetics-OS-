/* ═══ MYO — EMERGENCY: call first, then the right steps, big and simple, working offline ═══
   Now       · one-tap call to the local emergency number, 16 first-aid protocols (cardiac arrest, heart attack,
               stroke, seizure, choking, severe allergy, bleeding, low blood sugar, overdose, asthma, heat stroke,
               hypothermia, burns, fainting, head injury, mental-health crisis), your location to read out or text
   CPR coach · 110 compressions a minute with a click, hands-only or 30:2, two-minute swap prompts, screen kept on
   Seizure   · timer with the five-minute call point; saved seizures go to the Log book
   Medical ID· allergies, conditions, medicines, implants, blood type and contacts, on screen for responders or as a
               printed wallet card; it never leaves this device
   Prepare   · first-aid kit checklist and training
   First-aid steps follow public guidance from resuscitation councils, the Red Cross and national health services.
   They don't replace training or the emergency dispatcher, whose instructions come first. */
(function () {
  'use strict';
  const { esc, icon, pill, clamp, dayKey, fmtDate } = OS;
  const TABS = [['now', 'Now'], ['cpr', 'CPR coach'], ['seizure', 'Seizure timer'], ['id', 'Medical ID'], ['prep', 'Prepare']];
  const EM = { tab: 'now', proto: null, loc: null, locErr: '', locBusy: false, cpr: null, sz: null, szDone: null, mode: 'hands' };
  const REGION = { US: '911', CA: '911', MX: '911', GB: '999', IE: '112', AU: '000', NZ: '111', IN: '112', JP: '119', KR: '119', CN: '120', ZA: '112', BR: '192', AE: '999', SA: '997', PH: '911', SG: '995', HK: '999', IL: '101', TR: '112' };
  const guessNumber = () => { const m = (navigator.language || '').match(/-([A-Z]{2})$/i); return (m && REGION[m[1].toUpperCase()]) || '112'; };
  const E = (s) => s.emergency || {};
  const num = (s) => E(s).number || guessNumber();

  // key, title, short, signs, steps, don'ts, call when (every protocol starts with calling unless it says otherwise)
  const P = [
    ['arrest', 'Not breathing normally', 'Unresponsive, no normal breathing: cardiac arrest', ['Doesn\'t respond when you shout and tap the shoulders', 'Not breathing, or only gasping'],
      ['Call the emergency number and put the phone on speaker.', 'Send someone for an AED (defibrillator). Don\'t leave to look for one yourself.', 'Push hard and fast in the centre of the chest: 5–6 cm deep, 100–120 a minute. Use the CPR coach.', 'When the AED arrives, switch it on and do what it says. Keep pushing until it tells you to stop.', 'Keep going until help takes over, the person breathes normally, or you are too exhausted to continue.'],
      ['Don\'t stop to check for a pulse.', 'Don\'t worry about hurting them: CPR can only help.'], 'Always, straight away.'],
    ['heart', 'Heart attack', 'Chest pain or pressure', ['Pain, pressure or tightness in the chest that lasts or comes back', 'Pain spreading to an arm, the jaw, neck, back or stomach', 'Breathlessness, sweating, nausea, light-headedness', 'Women, older people and people with diabetes often have milder or unusual symptoms'],
      ['Call the emergency number now, even if you are not sure.', 'Sit them down and keep them calm and still. Loosen tight clothing.', 'The dispatcher may tell you to give aspirin: follow their advice, unless the person is allergic.', 'If they become unresponsive and stop breathing normally, start CPR.'],
      ['Don\'t let them drive themselves to hospital.', 'Don\'t wait to see if it passes.'], 'Always, straight away.'],
    ['stroke', 'Stroke', 'BE FAST: face, arm, speech', ['Balance: sudden loss of balance', 'Eyes: sudden loss of vision', 'Face: one side droops', 'Arms: one arm drifts down or is weak', 'Speech: slurred or confused', 'Time: call now'],
      ['Call the emergency number now and say you think it is a stroke.', 'Note the time the symptoms started, or when they were last seen well. Treatment depends on it.', 'Keep them comfortable. If they are unresponsive but breathing, put them in the recovery position.'],
      ['Don\'t give food, drink or medicine.', 'Don\'t let them sleep it off.'], 'Always, straight away.'],
    ['seizure', 'Seizure', 'Shaking, stiffening or unresponsive', ['Stiffening and jerking of the body', 'Falling, staring, unresponsive', 'Breathing may be noisy; lips may look blue briefly'],
      ['Start the seizure timer.', 'Move hard or sharp things away. Cushion the head.', 'Loosen anything tight around the neck.', 'When the jerking stops, roll them onto their side (recovery position).', 'Stay until they are fully awake and talking. Speak calmly.'],
      ['Don\'t hold them down or stop the movements.', 'Don\'t put anything in their mouth.', 'Don\'t give food or drink until fully awake.'], 'If it lasts more than 5 minutes, another follows, it is their first, they are injured, pregnant or diabetic, it happened in water, or they don\'t wake up or breathe normally afterwards.'],
    ['choking', 'Choking', 'Can\'t breathe, speak or cough', ['Clutching the throat', 'Can\'t speak, cough or breathe', 'Lips turning blue'],
      ['If they can cough, encourage them to keep coughing.', 'If they can\'t: give up to 5 firm back blows between the shoulder blades with the heel of your hand.', 'Then up to 5 abdominal thrusts: stand behind, fist above the belly button, pull sharply in and up.', 'Keep alternating 5 back blows and 5 thrusts. Call the emergency number if it doesn\'t clear.', 'If they become unresponsive, start CPR.'],
      ['Babies under 1: use 5 back blows and 5 chest thrusts with two fingers, never abdominal thrusts.', 'Pregnant or larger people: chest thrusts instead of abdominal thrusts.', 'Anyone given abdominal thrusts should be checked by a doctor afterwards.'], 'If it doesn\'t clear quickly, or they become unresponsive.'],
    ['allergy', 'Severe allergic reaction', 'Swelling, wheeze, faint after a trigger', ['Swelling of the lips, tongue or throat', 'Wheezing, hoarse voice, trouble breathing or swallowing', 'Feeling faint, pale and floppy', 'Often with hives, after a food, sting or medicine'],
      ['Use their adrenaline (epinephrine) auto-injector straight away, in the outer thigh, as its instructions show.', 'Call the emergency number and say "anaphylaxis".', 'Lie them down with legs raised. If breathing is hard, let them sit up.', 'If there is no improvement after 5 minutes and a second auto-injector is available, use it.', 'Stay with them: symptoms can come back.'],
      ['Don\'t make them stand or walk.', 'Don\'t wait to see if antihistamines work.'], 'Always, even if they feel better.'],
    ['bleeding', 'Severe bleeding', 'Blood spurting or soaking through', ['Spurting or steadily pouring blood', 'Blood soaking through clothing or bandages'],
      ['Call the emergency number.', 'Press firmly on the wound with a clean cloth or your hand, and keep pressing.', 'If blood soaks through, add more cloth on top; don\'t lift the first layer.', 'For life-threatening bleeding from an arm or leg, apply a tourniquet 5–7 cm above the wound if you have one and are trained; tighten until bleeding stops and note the time.', 'Keep them lying down and warm.'],
      ['Don\'t remove an object stuck in a wound: press around it.'], 'For heavy bleeding that doesn\'t stop with pressure.'],
    ['hypo', 'Low blood sugar', 'Shaky, sweaty, confused, with diabetes', ['Shaky, sweaty, pale, hungry', 'Confused, irritable or drowsy', 'Often someone with diabetes'],
      ['If they are awake and can swallow: give fast sugar, such as 150–200 ml of fruit juice or regular soft drink, or glucose tablets.', 'Wait 15 minutes. If still low or no better, give fast sugar again.', 'Once better, give a snack with starch, such as a sandwich or biscuits.', 'If they are unconscious: put them in the recovery position and call. Use their glucagon kit only if you are trained.'],
      ['Don\'t give anything by mouth if they are drowsy or unconscious.'], 'If they don\'t improve, become unconscious or have a seizure.'],
    ['overdose', 'Overdose or poisoning', 'Unresponsive, slow breathing, tiny pupils', ['Very sleepy or can\'t be woken', 'Slow, shallow or no breathing; blue lips', 'Pinpoint pupils (opioids)'],
      ['Call the emergency number.', 'If opioids may be involved and naloxone is available, give it as its packaging shows.', 'If they aren\'t breathing normally, start CPR.', 'If breathing, put them in the recovery position and stay: naloxone can wear off before the drug does.', 'For a swallowed poison or medicine with no symptoms yet, call poison control (US: 1-800-222-1222).'],
      ['Don\'t make them vomit.', 'Don\'t leave them alone to sleep it off.'], 'If they are hard to wake, breathing slowly, or you aren\'t sure.'],
    ['asthma', 'Asthma attack', 'Breathless, wheezing, can\'t finish sentences', ['Wheezing, coughing, tight chest', 'Too breathless to speak in sentences', 'Their reliever inhaler isn\'t helping'],
      ['Sit them upright and keep them calm. Loosen tight clothing.', 'Help them use their reliever (usually blue) inhaler as their asthma action plan says, with a spacer if they have one.', 'Call the emergency number if they don\'t improve, get worse, or are too breathless to speak.'],
      ['Don\'t make them lie down.'], 'If the inhaler isn\'t helping, lips turn blue, or they are exhausted.'],
    ['heat', 'Heat stroke', 'Hot, confused, stopped sweating', ['Very high body temperature, hot skin', 'Confusion, slurred speech, collapse or seizure', 'Can follow saunas, hot baths, or exercise in heat'],
      ['Call the emergency number.', 'Move them somewhere cool and remove extra clothing.', 'Cool them fast: cold water immersion if possible, or soak with water and fan; ice packs in the armpits, groin and neck.', 'Keep cooling until help arrives.'],
      ['Don\'t give drinks if they are confused or drowsy.'], 'Always, straight away.'],
    ['cold', 'Hypothermia', 'Cold, shivering, slow, confused', ['Shivering (stops when it gets severe)', 'Pale, cold skin; slurred speech; clumsiness; confusion', 'Can follow cold water, cold plunges, or being outdoors'],
      ['Call the emergency number if severe or they are confused.', 'Move them somewhere warm and dry; replace wet clothes.', 'Warm them gradually: blankets, a hat, skin-to-skin; warm sweet drinks only if fully alert.', 'Handle them gently.'],
      ['Don\'t use hot water, a hot bath or direct heat.', 'Don\'t rub their limbs or give alcohol.'], 'If confused, drowsy, or shivering has stopped.'],
    ['burn', 'Burns', 'Heat, chemical or electrical', ['Red, blistered, white or charred skin', 'Burns on the face, hands, feet, genitals or across joints are always serious'],
      ['Cool the burn under cool running water for 20 minutes.', 'Remove jewellery and clothing near the burn unless stuck to the skin.', 'Cover loosely with cling film or a clean plastic bag.', 'For chemical burns, brush off dry chemical and rinse for at least 20 minutes. For electrical burns, switch off the power before touching them.'],
      ['Don\'t use ice, butter, creams or toothpaste.', 'Don\'t burst blisters.'], 'For large or deep burns, burns on the face, hands, feet or genitals, chemical or electrical burns, or a child.'],
    ['faint', 'Fainting', 'Collapsed briefly, now waking', ['Brief loss of consciousness', 'Often after standing, heat, pain or a shock'],
      ['Lay them on their back and raise their legs.', 'Loosen tight clothing and give them space and air.', 'If they don\'t come round within a minute, check breathing and call the emergency number.', 'When they wake, let them sit up slowly.'],
      ['Don\'t sit them up suddenly.'], 'If they stay unresponsive, had chest pain, palpitations, a seizure, injured themselves, or fainted while exercising.'],
    ['head', 'Head injury', 'After a blow to the head', ['Knocked out, even briefly', 'Vomiting, worsening headache, confusion, drowsiness', 'Clear fluid from the nose or ears; unequal pupils'],
      ['Call the emergency number for any of the signs above, a seizure, or if they take blood thinners.', 'If a neck injury is possible, keep the head and neck still.', 'Hold a cold pack on a bump for up to 20 minutes.', 'Someone should stay with them for the next 24 hours.'],
      ['Don\'t let them go back to sport the same day.'], 'For any of the warning signs.'],
    ['crisis', 'Mental health crisis', 'Thoughts of suicide or self-harm', ['Talking about wanting to die or being a burden', 'Saying goodbye, giving things away', 'Severe agitation or not making sense'],
      ['If someone is in immediate danger, call the emergency number.', 'In the US, call or text 988 (Suicide and Crisis Lifeline). Elsewhere, findahelpline.com lists free lines.', 'Stay with them. Ask directly about suicide: it doesn\'t put the idea in their head.', 'Listen without judging. Remove means of harm if it is safe to do so.'],
      ['Don\'t leave them alone.', 'Don\'t promise to keep it secret.'], 'If they are in immediate danger.']
  ];
  const proto = (k) => P.find((p) => p[0] === k);

  /* ── wake lock and a click ── */
  let lock = null, AC = null;
  async function keepAwake(on) { try { if (on && 'wakeLock' in navigator) lock = await navigator.wakeLock.request('screen'); else if (lock) { await lock.release(); lock = null; } } catch { lock = null; } }
  function click(hi) {
    try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime; o.frequency.value = hi ? 1320 : 880; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07); o.connect(g).connect(AC.destination); o.start(t); o.stop(t + 0.08); } catch { /* no audio */ }
  }
  const mmss = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

  /* ── CPR coach ── */
  function cprStart() {
    if (EM.cpr) return;
    const C = { t0: Date.now(), n: 0, cyc: 0, pause: 0, iv: null };
    C.iv = setInterval(() => {
      if (C.pause > 0) { C.pause--; if (!C.pause) C.n = 0; paintCpr(); return; }
      C.n++; click(EM.mode === '30:2' ? C.n === 1 : C.n % 10 === 1);
      if (EM.mode === '30:2' && C.n >= 30) { C.cyc++; C.pause = 8; }   // about 4 s for two breaths
      paintCpr();
    }, 60000 / 110 / (1));
    EM.cpr = C; keepAwake(true); OS.render();
  }
  function cprStop() { if (!EM.cpr) return; clearInterval(EM.cpr.iv); EM.cpr = null; keepAwake(false); OS.render(); }
  function paintCpr() {
    const C = EM.cpr; if (!C) return;
    const el = (id) => document.getElementById(id), t = Date.now() - C.t0, swap = Math.floor(t / 120000);
    if (el('em-cpr-n')) el('em-cpr-n').textContent = C.pause ? 'Give 2 breaths' : EM.mode === '30:2' ? `${C.n} of 30` : String(C.n);
    if (el('em-cpr-t')) el('em-cpr-t').textContent = mmss(t);
    const d = el('em-beat'); if (d && !C.pause) { d.classList.remove('go'); void d.offsetWidth; d.classList.add('go'); }
    const sw = el('em-swap'); if (sw) sw.hidden = !(swap > 0 && t % 120000 < 15000);
  }

  /* ── seizure timer ── */
  function szStart() { if (EM.sz) return; EM.szDone = null; EM.sz = { t0: Date.now(), warned: false, iv: setInterval(paintSz, 250) }; keepAwake(true); OS.render(); }
  function szStop() { const S = EM.sz; if (!S) return; clearInterval(S.iv); EM.sz = null; keepAwake(false); EM.szDone = { at: new Date(S.t0).toISOString(), dur: Math.round((Date.now() - S.t0) / 1000) }; OS.render(); }
  function paintSz() {
    const S = EM.sz; if (!S) return; const t = Date.now() - S.t0, el = document.getElementById('em-sz-t'); if (el) el.textContent = mmss(t);
    if (t >= 300000 && !S.warned) { S.warned = true; [0, 300, 600].forEach((d) => setTimeout(() => click(true), d)); OS.render(); }
  }

  /* ── views ── */
  const callBtn = (s) => `<a class="em-call" href="tel:${esc(num(s))}">${icon('phone', 22)} Call ${esc(num(s))}</a>`;
  function protoView(s, p) {
    return `<section class="card em-proto"><div class="card-h"><h2>${esc(p[1])}</h2><button class="btn ghost sm" data-act="em-proto" data-k="">All emergencies</button></div>
        <h3 class="em-h">Signs</h3><ul class="em-signs">${p[3].map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        <h3 class="em-h">Do this</h3><ol class="em-steps">${p[4].map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
        ${p[0] === 'arrest' || p[0] === 'heart' || p[0] === 'choking' || p[0] === 'overdose' ? '<button class="btn" data-act="em-tab" data-t="cpr">Open the CPR coach</button>' : p[0] === 'seizure' ? '<button class="btn" data-act="em-sz-go">Start the seizure timer</button>' : ''}
        <h3 class="em-h">Don't</h3><ul class="em-dont">${p[5].map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        <p class="em-when"><b>Call the emergency number:</b> ${esc(p[6])}</p></section>`;
  }
  function nowTab(s) {
    const p = EM.proto && proto(EM.proto), C = E(s).contacts || [];
    return `${p ? protoView(s, p) : `<section class="card"><div class="card-h"><h2>What's happening?</h2></div>
        <div class="em-grid">${P.map((x) => `<button class="em-type" data-act="em-proto" data-k="${x[0]}"><b>${esc(x[1])}</b><span>${esc(x[2])}</span></button>`).join('')}</div></section>`}
      <section class="card"><div class="card-h"><h2>Your location</h2></div>
        ${EM.loc ? `<p class="em-loc num">${EM.loc.lat.toFixed(5)}, ${EM.loc.lon.toFixed(5)}</p><p class="small muted">Accurate to about ${Math.round(EM.loc.acc)} m, at ${new Date(EM.loc.at).toLocaleTimeString()}. Read this out to the dispatcher if you can't give an address.</p>
          <div class="st-go"><a class="btn ghost sm" href="https://www.google.com/maps/search/?api=1&query=${EM.loc.lat.toFixed(5)},${EM.loc.lon.toFixed(5)}" target="_blank" rel="noopener">Open in maps</a>${C.map((c) => `<a class="btn ghost sm" href="sms:${esc(c.phone)}?&body=${encodeURIComponent(`I need help. My location: https://maps.google.com/?q=${EM.loc.lat.toFixed(5)},${EM.loc.lon.toFixed(5)}`)}">Text ${esc(c.name)}</a>`).join('')}</div>`
        : `<button class="btn ghost" data-act="em-loc" ${EM.locBusy ? 'disabled' : ''}>${EM.locBusy ? 'Finding you…' : 'Show my location'}</button>${EM.locErr ? `<p class="small" role="alert">${esc(EM.locErr)}</p>` : ''}`}
        <p class="fine">Location is shown on this screen only. Texting it opens your messages app with the text ready for you to send.</p>
        <a class="btn ghost sm" href="https://www.google.com/maps/search/AED+defibrillator" target="_blank" rel="noopener">Find a defibrillator nearby</a></section>`;
  }
  function cprTab() {
    const C = EM.cpr;
    return `<section class="card em-cpr"><div class="card-h"><h2>CPR coach</h2><div class="seg" role="group" aria-label="Mode">${[['hands', 'Hands-only'], ['30:2', '30 pushes, 2 breaths']].map(([k, l]) => `<button aria-pressed="${EM.mode === k}" data-act="em-mode" data-k="${k}" ${C ? 'disabled' : ''}>${l}</button>`).join('')}</div></div>
        <div class="em-beatbox"><i id="em-beat" class="em-beat" aria-hidden="true"></i><b id="em-cpr-n" class="num" aria-live="off">${C ? '' : 'Ready'}</b><span>Time <b id="em-cpr-t" class="num">0:00</b></span></div>
        <p id="em-swap" class="banner warn" hidden>Two minutes: swap with another person if you can, without stopping for more than a few seconds. Follow the AED if it speaks.</p>
        <div class="st-go">${C ? `<button class="btn" data-act="em-cpr-stop">${icon('pause', 16)} Stop</button>` : `<button class="btn em-go" data-act="em-cpr-go">${icon('play', 16)} Start the beat</button>`}</div>
        <ol class="em-steps small"><li>Kneel beside them. Heel of one hand in the centre of the chest, other hand on top, arms straight.</li><li>Push down 5–6 cm with each click and let the chest come all the way back up.</li><li>Hands-only CPR is right for untrained helpers. If you are trained, give 2 breaths after every 30 pushes.</li><li>Children: one or two hands, about 5 cm. Babies: two fingers, about 4 cm, and give breaths if you can.</li></ol>
        <p class="fine">The beat is 110 a minute, inside the recommended 100–120. The screen stays on while it runs. Practise here any time so the rhythm feels familiar.</p></section>`;
  }
  function szTab(s) {
    const S = EM.sz, D = EM.szDone, log = ((E(s).log) || []).filter((r) => r.kind === 'seizure').slice(-8).reverse(), over = S && Date.now() - S.t0 >= 300000;
    return `<section class="card em-sz"><div class="card-h"><h2>Seizure timer</h2></div>
        ${over ? `<div class="banner bad" role="alert"><b>Five minutes: call the emergency number now.</b> ${callBtnInline()}</div>` : ''}
        <div class="em-beatbox"><b id="em-sz-t" class="num">${S ? mmss(Date.now() - S.t0) : D ? mmss(D.dur * 1000) : '0:00'}</b><span>${S ? 'Timing' : D ? 'Stopped' : 'Start when the seizure begins'}</span></div>
        <div class="st-go">${S ? `<button class="btn" data-act="em-sz-stop">${icon('pause', 16)} Seizure stopped</button>` : `<button class="btn em-go" data-act="em-sz-go">${icon('play', 16)} Start</button>`}</div>
        ${D ? `<form class="lb-grid" data-submit="em-sz-save"><label>What it looked like<select name="type"><option>Shaking or stiffening</option><option>Staring or absent</option><option>Twitching on one side</option><option>Not sure</option></select></label>
          <label>Back to normal after (minutes)<input type="number" name="rec" min="0" max="600"></label><label class="lb-wide">Notes<input name="note" maxlength="200" placeholder="Injuries, triggers, what helped"></label>
          <div class="lb-wide"><button class="btn sm">Save to Log book</button> <button type="button" class="btn ghost sm" data-act="em-sz-x">Discard</button></div></form>` : ''}
        <ul class="small bc-ref"><li>Most seizures stop by themselves within 2 minutes.</li><li>Call if it lasts more than 5 minutes, another starts, it is a first seizure, or they don't wake up normally.</li><li>A rescue medicine prescribed by their doctor should be given exactly as their seizure plan says.</li></ul>
        ${log.length ? `<h3 class="em-h">Saved</h3><ul class="fd-pan">${log.map((r) => `<li><b>${esc(fmtDate(r.at.slice(0, 10)))}</b> ${mmss(r.dur * 1000)} · ${esc(r.type || '')}${r.note ? ` <span class="muted small">${esc(r.note)}</span>` : ''}</li>`).join('')}</ul>` : ''}</section>`;
  }
  let numRef = '112'; const callBtnInline = () => `<a class="btn sm" href="tel:${esc(numRef)}">Call ${esc(numRef)}</a>`;
  function idTab(s) {
    const I = E(s).id || {}, C = E(s).contacts || [], pr = s.profile || {}, preg = OS.pregnancy && OS.pregnancy.status && OS.pregnancy.status(s);
    const f = (k, l, ph, wide) => `<label${wide ? ' class="lb-wide"' : ''}>${l}<input name="${k}" maxlength="200" value="${esc(I[k] || '')}" placeholder="${esc(ph)}"></label>`;
    return `<section class="card em-card" aria-label="Medical ID"><div class="card-h"><h2>Medical ID</h2><button class="btn ghost sm" data-act="em-print">Print wallet card</button></div>
        <dl class="em-dl">${[['Name', I.name], ['Born', I.dob], ['Blood type', I.blood], ['Allergies', I.allergies], ['Conditions', [I.conditions, preg ? `Pregnant, ${preg}` : ''].filter(Boolean).join('; ')], ['Medicines', I.meds], ['Implants and devices', I.implants], ['Notes', I.notes], ['Organ donor', I.donor]].filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('') || '<dd class="muted">Nothing added yet.</dd>'}</dl>
        ${C.length ? `<h3 class="em-h">Emergency contacts</h3><ul class="fd-pan">${C.map((c, i) => `<li><b>${esc(c.name)}</b> <span class="muted small">${esc(c.rel || '')}</span> <a class="link" href="tel:${esc(c.phone)}">${esc(c.phone)}</a> <button class="lb-del" data-act="em-cdel" data-i="${i}" aria-label="Remove ${esc(c.name)}">${icon('x', 12)}</button></li>`).join('')}</ul>` : ''}</section>
      <section class="card"><div class="card-h"><h2>Edit</h2><span class="muted small">Stays on this device</span></div>
        <form class="lb-grid" data-submit="em-id">${f('name', 'Name', pr.name || '')}${f('dob', 'Date of birth', 'YYYY-MM-DD')}
          <label>Blood type<select name="blood">${['', 'O+', 'O−', 'A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'Not known'].map((b) => `<option ${I.blood === b ? 'selected' : ''}>${b}</option>`).join('')}</select></label>
          ${f('allergies', 'Allergies', 'Penicillin, peanuts, latex', true)}${f('conditions', 'Conditions', 'Epilepsy, type 1 diabetes, asthma', true)}${f('meds', 'Medicines', 'Names, as your prescriber wrote them', true)}
          ${f('implants', 'Implants and devices', 'Pacemaker, insulin pump, stent', true)}${f('notes', 'Notes for responders', 'Anything they should know', true)}
          <label>Organ donor<select name="donor">${['', 'Yes', 'No'].map((b) => `<option ${I.donor === b ? 'selected' : ''}>${b}</option>`).join('')}</select></label>
          <label>Emergency number<input name="number" maxlength="6" inputmode="numeric" value="${esc(E(s).number || '')}" placeholder="${esc(guessNumber())}"></label>
          <div class="lb-wide"><button class="btn sm">Save medical ID</button></div></form></section>
      <section class="card"><div class="card-h"><h2>Add an emergency contact</h2></div>
        <form class="lb-grid" data-submit="em-contact"><label>Name<input name="name" maxlength="40" required></label><label>Relationship<input name="rel" maxlength="30"></label><label>Phone<input name="phone" type="tel" maxlength="24" required></label><div class="lb-wide"><button class="btn ghost sm">${icon('plus', 14)} Add contact</button></div></form>
        <p class="fine">Phones can show a medical ID on the lock screen (Health on iPhone, Safety and emergency on Android). Copy these details there too, so responders can see them without unlocking.</p></section>`;
  }
  function prepTab(s) {
    const kit = E(s).kit || {}, KIT = ['Adhesive bandages, assorted', 'Sterile gauze pads and roller bandages', 'Adhesive tape', 'Elastic bandage', 'Triangular bandage', 'Disposable gloves', 'Scissors and tweezers', 'Antiseptic wipes', 'Instant cold packs', 'Foil blanket', 'CPR face shield', 'Tourniquet (with training)', 'Burn gel or cling film', 'Thermometer', 'Torch with spare batteries', 'List of emergency numbers'];
    const done = KIT.filter((k) => kit[k]).length;
    return `<div class="grid g-2"><section class="card"><div class="card-h"><h2>First-aid kit</h2><span class="muted small">${done} of ${KIT.length}</span></div>
          <ul class="em-kit">${KIT.map((k) => `<li><label><input type="checkbox" data-change="em-kit" data-k="${esc(k)}" ${kit[k] ? 'checked' : ''}> ${esc(k)}</label></li>`).join('')}</ul>
          <p class="fine">Check dates every six months. Keep your own and family members' prescribed emergency medicines (auto-injectors, inhalers, glucagon) where everyone knows.</p></section>
        <section class="card"><div class="card-h"><h2>Be ready</h2></div><ul class="small bc-ref">
          <li><b>Learn CPR and first aid</b> in a hands-on course from the Red Cross, a heart foundation or a first-aid charity. A few hours doubles or triples someone's chance of surviving a cardiac arrest.</li>
          <li><b>Know where the nearest AED is</b> at home, work and the gym.</li>
          <li><b>Fill in your Medical ID</b> and add it to your phone's lock screen.</li>
          <li><b>Teach children</b> how to call the emergency number and say their address.</li>
          <li><b>Training alone?</b> Saunas, cold plunges and hard sessions carry real risk. Tell someone, and keep your phone within reach.</li></ul></section></div>`;
  }

  OS.register('emergency', {
    title: 'Emergency', icon: 'sos',
    render(s) {
      numRef = num(s);
      const body = { now: nowTab, cpr: cprTab, seizure: szTab, id: idTab, prep: prepTab }[EM.tab](s);
      return `<div class="em">${OS.ui.head('First aid · works offline', 'Emergency', 'Call first. Then follow the steps for what is happening, use the CPR coach or seizure timer, and show your medical ID to responders.')}
        ${callBtn(s)}
        <div class="seg kt-tabs" role="tablist" aria-label="Emergency">${TABS.map(([k, l]) => `<button role="tab" aria-selected="${EM.tab === k}" data-act="em-tab" data-t="${k}">${l}</button>`).join('')}</div>${body}
        <p class="fine">General first aid based on public guidance from resuscitation councils, the Red Cross and national health services. It doesn't replace training. The emergency dispatcher's instructions always come first.</p></div>`;
    },
    mount() { if (EM.cpr) paintCpr(); return () => { if (location.hash.slice(1) !== 'emergency') { cprStop(); if (EM.sz) { /* keep timing a seizure even if they look elsewhere */ } } }; }
  });
  const save = (fn) => OS.update((s) => { s.emergency = s.emergency || {}; fn(s.emergency); }, { keepSample: true });
  OS.act('em-tab', (el) => { EM.tab = TABS.some(([k]) => k === el.dataset.t) ? el.dataset.t : 'now'; OS.render(); window.scrollTo && document.getElementById('main') && (document.getElementById('main').scrollTop = 0); });
  OS.act('em-proto', (el) => { EM.proto = el.dataset.k || null; EM.tab = 'now'; OS.render(); const m = document.getElementById('main'); if (m) m.scrollTop = 0; });
  OS.act('em-loc', () => {
    if (!navigator.geolocation) { EM.locErr = 'This browser cannot get your location.'; OS.render(); return; }
    EM.locBusy = true; EM.locErr = ''; OS.render();
    navigator.geolocation.getCurrentPosition((p) => { EM.loc = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, at: Date.now() }; EM.locBusy = false; OS.render(); },
      (e) => { EM.locBusy = false; EM.locErr = e.code === 1 ? 'Location permission was not given.' : 'Could not get your location. Describe nearby roads or landmarks.'; OS.render(); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  });
  OS.act('em-mode', (el) => { if (!EM.cpr) { EM.mode = el.dataset.k === '30:2' ? '30:2' : 'hands'; OS.render(); } });
  OS.act('em-cpr-go', cprStart);
  OS.act('em-cpr-stop', cprStop);
  OS.act('em-sz-go', () => { EM.tab = 'seizure'; szStart(); });
  OS.act('em-sz-stop', szStop);
  OS.act('em-sz-x', () => { EM.szDone = null; OS.render(); });
  OS.act('em-sz-save', (f) => {
    const D = EM.szDone; if (!D) return; const r = { at: D.at, kind: 'seizure', dur: D.dur, type: f.elements.type.value, rec: f.elements.rec.value ? +f.elements.rec.value : null, note: f.elements.note.value.trim() };
    save((X) => { X.log = (X.log || []).concat([r]).slice(-500); }); EM.szDone = null;
    OS.logEvent('symptom', 'Seizure', [`${mmss(r.dur * 1000)}`, r.type, r.rec != null ? `back to normal after ${r.rec} min` : '', r.note].filter(Boolean).join(' · '), { go: 'emergency', src: 'manual' });
    OS.toast('Saved to your Log book');
  });
  OS.act('em-id', (f) => {
    const g = (k) => f.elements[k].value.trim(), n = g('number').replace(/[^\d+]/g, '');
    save((X) => { X.id = { name: g('name'), dob: g('dob'), blood: f.elements.blood.value, allergies: g('allergies'), conditions: g('conditions'), meds: g('meds'), implants: g('implants'), notes: g('notes'), donor: f.elements.donor.value }; X.number = n || null; });
    OS.toast('Medical ID saved on this device');
  });
  OS.act('em-contact', (f) => { const g = (k) => f.elements[k].value.trim(); if (!g('name') || !g('phone')) return; save((X) => { X.contacts = (X.contacts || []).concat([{ name: g('name'), rel: g('rel'), phone: g('phone').replace(/[^\d+\-() ]/g, '') }]).slice(0, 8); }); });
  OS.act('em-cdel', (el) => save((X) => { X.contacts = (X.contacts || []).filter((_, i) => i !== +el.dataset.i); }));
  OS.change('em-kit', (el) => save((X) => { X.kit = X.kit || {}; X.kit[el.dataset.k] = el.checked; }));
  OS.act('em-print', () => {
    const s = OS.state, I = E(s).id || {}, C = E(s).contacts || [], w = window.open('', '_blank', 'width=420,height=600');
    if (!w) { OS.toast('Allow pop-ups to print the card'); return; }
    const row = (k, v) => (v ? `<tr><th>${k}</th><td>${esc(v)}</td></tr>` : '');
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Medical ID</title><style>body{font:12px system-ui,sans-serif;margin:16px}.c{border:2px solid #b91c1c;border-radius:10px;padding:10px 12px;width:3.37in}h1{font-size:14px;margin:0 0 6px;color:#b91c1c}th{text-align:left;padding:2px 8px 2px 0;vertical-align:top;color:#555;font-weight:600}td{padding:2px 0}</style>
      <div class="c"><h1>MEDICAL ID</h1><table>${row('Name', I.name)}${row('Born', I.dob)}${row('Blood', I.blood)}${row('Allergies', I.allergies)}${row('Conditions', I.conditions)}${row('Medicines', I.meds)}${row('Implants', I.implants)}${row('Notes', I.notes)}${C.slice(0, 3).map((c) => row(`Call ${esc(c.rel || 'contact')}`, `${c.name} ${c.phone}`)).join('')}</table></div>`);
    w.document.close(); w.focus(); setTimeout(() => { try { w.print(); } catch { /* user can print from the window */ } }, 300);
  });
  OS.emergency = { P, proto, guessNumber, num, state: EM, start: (k) => { EM.proto = k; EM.tab = 'now'; OS.go('emergency'); } };
})();
