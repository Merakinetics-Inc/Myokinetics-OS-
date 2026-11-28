/* ═══ MYO — CARE AND CALENDAR: your care team, appointments, visit prep, routines, and everything coming up in Myo ═══
   Upcoming  · one calendar of dated items from across Myo (appointments, surgery, pregnancy milestones, period
               predictions, harvests, pantry use-by, experiments, sleep study) plus screenings due for your age, with
               a single .ics export for any phone or computer calendar
   Team      · clinicians, coaches and therapists with tap-to-call
   Visits    · appointments with reasons, prep and after-visit notes; each exports to a calendar with a reminder
   Prep      · a visit sheet built from your own data (red flags, out-of-range labs, recent symptoms, medicines and
               allergies, cycle, pregnancy, body changes) plus your questions, ready to print
   Routines  · daily or weekly reminders, shown while Myo is open and exportable as repeating calendar events
   Everything stays on this device; calendar files are made here and saved by you. */
(function () {
  'use strict';
  const { esc, icon, pill, clamp, dayKey, addDays, fmtDate, uid } = OS;
  const TABS = [['up', 'Upcoming'], ['visits', 'Appointments'], ['team', 'Care team'], ['prep', 'Visit prep'], ['routines', 'Routines']];
  const CA = { tab: 'up' };
  const DOW = [['MO', 'Mon'], ['TU', 'Tue'], ['WE', 'Wed'], ['TH', 'Thu'], ['FR', 'Fri'], ['SA', 'Sat'], ['SU', 'Sun']];
  const K = (s) => s.care || {};

  /* ── everything with a date ── */
  function upcoming(s, days = 120) {
    const today = dayKey(new Date()), until = dayKey(addDays(new Date(), days)), out = [], add = (d, title, cat, go, extra = {}) => { if (d && d >= today && d <= until) out.push({ d, title, cat, go, ...extra }); };
    (K(s).appts || []).forEach((a) => add(a.d, `${a.why || 'Appointment'}${a.who ? ` · ${a.who}` : ''}`, 'Appointment', 'care', { time: a.time, where: a.where, id: a.id }));
    if (s.procedure && s.procedure.date) add(s.procedure.date, s.procedure.name || 'Procedure', 'Surgery', 'surgery');
    if (OS.pregnancy && s.pregnancy && (s.pregnancy.lmp || s.pregnancy.edd || s.pregnancy.dating)) {
      const D = OS.pregnancy.dating(s.pregnancy); if (D) { const at = (w) => dayKey(new Date(D.lmp + w * 7 * 864e5)); add(at(40), 'Due date', 'Pregnancy', 'pregnancy'); [[11, 'Dating scan window opens (11–14 weeks)'], [18, 'Anomaly scan window opens (18–21 weeks)'], [24, 'Blood tests window (24–28 weeks)'], [28, 'Third trimester begins'], [37, 'Full term begins']].forEach(([w, t]) => add(at(w), t, 'Pregnancy', 'pregnancy')); }
    }
    if (OS.cycle && s.cycle) { const M = OS.cycle.model(s.cycle); if (M.next) { add(M.next, `Period expected (±${M.win} days)`, 'Cycle', 'cycle'); add(M.fert[0], 'Fertile window starts (estimate)', 'Cycle', 'cycle'); } }
    const F = s.food || {};
    (F.plantings || []).forEach((p) => { const c = OS.food && OS.food.CROPS.find((x) => x[0] === p.crop); if (c && c[4]) add(dayKey(addDays(new Date(`${p.d}T12:00:00`), p.crop === 'garlic' ? 260 : c[4])), `${c[1]} ready to harvest`, 'Garden', 'food'); });
    (F.pantry || []).forEach((x) => { if (x.useBy) add(x.useBy, `Use by: ${x.name}`, 'Pantry', 'food'); });
    ((s.insights && s.insights.exps) || []).forEach((e) => add(dayKey(addDays(new Date(`${e.start}T12:00:00`), e.base + e.len - 1)), `Experiment ends: ${e.name}`, 'Experiment', 'insights'));
    if (OS.cancer) { try { OS.cancer.calendar(s).forEach((x) => add(x.d, x.title, 'Screening', 'cancer')); } catch { /* the plan never blocks the calendar */ } }
    if (s.sleep && s.sleep.study && s.sleep.study.start) add(dayKey(addDays(new Date(`${s.sleep.study.start}T12:00:00`), 13)), 'Sleep study ends', 'Sleep', 'sleep');
    (K(s).routines || []).forEach((r) => { for (let i = 0; i < 7; i++) { const d = addDays(new Date(), i), code = DOW[(d.getDay() + 6) % 7][0]; if (!r.days || !r.days.length || r.days.includes(code)) { add(dayKey(d), r.title, 'Routine', 'care', { time: r.time, routine: true }); } } });
    return out.sort((a, b) => (a.d + (a.time || '99')).localeCompare(b.d + (b.time || '99')));
  }
  function screeningsDue(s) {
    const age = +(s.profile && s.profile.age) || null, sex = s.profile && s.profile.sex, L = OS.longevity && OS.longevity.SCREEN;
    if (!age || !L) return []; return L.filter(([, from, sx]) => age >= from && (!sx || sx === sex)).map(([t, , , how]) => ({ t, how }));
  }

  /* ── calendar files ── */
  const icsText = (v) => String(v || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const fold = (line) => { const out = []; let l = line; while (l.length > 74) { out.push(l.slice(0, 74)); l = ` ${l.slice(74)}`; } out.push(l); return out.join('\r\n'); };
  const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  function vevent(e) {
    const d = e.d.replace(/-/g, ''), L = ['BEGIN:VEVENT', `UID:${e.uid || uid()}@myo.app`, `DTSTAMP:${stamp()}`];
    if (e.time) { const t = e.time.replace(':', '') + '00', end = new Date(`${e.d}T${e.time}:00`); end.setMinutes(end.getMinutes() + (e.dur || 30)); L.push(`DTSTART:${d}T${t}`, `DTEND:${dayKey(end).replace(/-/g, '')}T${String(end.getHours()).padStart(2, '0')}${String(end.getMinutes()).padStart(2, '0')}00`); }
    else L.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${dayKey(addDays(new Date(`${e.d}T12:00:00`), 1)).replace(/-/g, '')}`);
    if (e.rrule) L.push(`RRULE:${e.rrule}`);
    L.push(`SUMMARY:${icsText(e.title)}`); if (e.where) L.push(`LOCATION:${icsText(e.where)}`); if (e.desc) L.push(`DESCRIPTION:${icsText(e.desc)}`);
    if (e.alarm) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(e.title)}`, `TRIGGER:-PT${e.alarm}M`, 'END:VALARM');
    L.push('END:VEVENT'); return L.map(fold).join('\r\n');
  }
  const ics = (evs) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Merakinetics//Myo//EN', 'CALSCALE:GREGORIAN', ...evs.map(vevent), 'END:VCALENDAR'].join('\r\n') + '\r\n';
  async function save(name, text) {
    const dl = OS.caps && OS.caps.downloads;
    if (dl) { try { await dl.save({ filename: name, data: text }); OS.toast('Calendar file saved'); } catch { /* declined */ } return; }
    const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar' })), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    OS.toast('Calendar file downloaded: open it to add the events');
  }
  const firstDay = (r) => { for (let i = 0; i < 7; i++) { const d = addDays(new Date(), i); if (!r.days || !r.days.length || r.days.includes(DOW[(d.getDay() + 6) % 7][0])) return dayKey(d); } return dayKey(new Date()); };
  const routineEvent = (r) => ({ d: firstDay(r), time: r.time, dur: 15, title: r.title, rrule: r.days && r.days.length && r.days.length < 7 ? `FREQ=WEEKLY;BYDAY=${r.days.join(',')}` : 'FREQ=DAILY', alarm: 0, uid: r.id });

  /* ── reminders while Myo is open ── */
  let lastMin = '';
  setInterval(() => {
    const s = OS.state; if (!s) return; const now = new Date(), hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, key = `${dayKey(now)} ${hm}`, code = DOW[(now.getDay() + 6) % 7][0];
    if (key === lastMin) return; lastMin = key;
    (K(s).routines || []).filter((r) => r.time === hm && (!r.days || !r.days.length || r.days.includes(code))).forEach((r) => {
      OS.toast(`Reminder: ${r.title}`);
      try { if (K(s).notify && 'Notification' in window && Notification.permission === 'granted') new Notification('Myo', { body: r.title, icon: 'icons/icon-192.png', tag: r.id }); } catch { /* not allowed here */ }
    });
  }, 15000);

  /* ── views ── */
  function upTab(s) {
    const U = upcoming(s), byDay = {}, scr = screeningsDue(s); U.filter((e) => !e.routine).forEach((e) => { (byDay[e.d] = byDay[e.d] || []).push(e); });
    const days = Object.keys(byDay).sort();
    return `<section class="card"><div class="card-h"><h2>Next 4 months</h2><button class="btn ghost sm" data-act="ca-ics-all" ${U.length ? '' : 'disabled'}>${icon('download', 14)} Add all to my calendar</button></div>
        ${days.length ? `<ol class="ca-days">${days.map((d) => `<li><h3>${esc(new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }))}</h3><ul>${byDay[d].map((e) => `<li><span class="ca-cat">${esc(e.cat)}</span> ${e.time ? `<b class="num">${esc(e.time)}</b> ` : ''}<a href="#${e.go}">${esc(e.title)}</a></li>`).join('')}</ul></li>`).join('')}</ol>`
        : '<p class="small muted">Nothing dated yet. Appointments, surgery, pregnancy, cycle, garden, pantry and experiments all appear here as you use them.</p>'}
        <p class="fine">The calendar file works with Apple, Google and Outlook calendars. It includes routines as repeating events.</p></section>
      ${scr.length ? `<section class="card"><div class="card-h"><h2>Screenings for your age</h2><a class="btn ghost sm" href="#longevity">Longevity</a></div><ul class="fd-pan">${scr.map((x) => `<li><b>${esc(x.t)}</b> <span class="muted small">${esc(x.how)}</span> <button class="link small" data-act="ca-book" data-t="${esc(x.t)}">Plan it</button></li>`).join('')}</ul>
        <p class="fine">General schedules; your clinician may advise differently based on your history.</p></section>` : ''}`;
  }
  function visitsTab(s) {
    const A = (K(s).appts || []).slice().sort((a, b) => (a.d + (a.time || '')).localeCompare(b.d + (b.time || ''))), today = dayKey(new Date()), up = A.filter((a) => a.d >= today), past = A.filter((a) => a.d < today).reverse(), T = K(s).team || [], pre = CA.prefill || '';
    const row = (a) => `<li class="ca-appt"><div><b>${esc(fmtDate(a.d))}${a.time ? ` · ${esc(a.time)}` : ''}</b> ${esc(a.why || 'Appointment')}${a.who ? ` <span class="muted small">with ${esc(a.who)}</span>` : ''}${a.where ? ` <span class="muted small">at ${esc(a.where)}</span>` : ''}</div>
      ${a.d < today ? `<form data-submit="ca-after" data-id="${a.id}" class="ca-after"><label class="sr" for="ca-a-${a.id}">After-visit notes</label><textarea id="ca-a-${a.id}" name="t" rows="2" maxlength="1500" placeholder="What did they say? Next steps, tests, changes">${esc(a.after || '')}</textarea><button class="btn ghost sm">Save notes</button></form>` : `<div class="st-go"><button class="btn ghost sm" data-act="ca-ics" data-id="${a.id}">${icon('download', 14)} Add to calendar</button><button class="btn ghost sm" data-act="ca-tab" data-t="prep">Prepare</button></div>`}
      <button class="lb-del" data-act="ca-del" data-k="appts" data-id="${a.id}" aria-label="Delete this appointment">${icon('x', 12)}</button></li>`;
    return `<section class="card"><div class="card-h"><h2>Add an appointment</h2></div>
        <form class="lb-grid" data-submit="ca-appt"><label>Date<input type="date" name="d" required min="${dayKey(addDays(new Date(), -365))}"></label><label>Time<input type="time" name="time"></label>
          <label>With<input name="who" maxlength="60" list="ca-team" placeholder="Dr Lee, physio"><datalist id="ca-team">${T.map((t) => `<option value="${esc(t.name)}">`).join('')}</datalist></label><label>Where<input name="where" maxlength="80"></label>
          <label class="lb-wide">Reason<input name="why" maxlength="80" required value="${esc(pre)}" placeholder="Annual check-up"></label><div class="lb-wide"><button class="btn sm">${icon('plus', 14)} Add</button></div></form></section>
      <section class="card"><div class="card-h"><h2>Coming up</h2><span class="muted small">${up.length}</span></div>${up.length ? `<ul class="ca-list">${up.map(row).join('')}</ul>` : '<p class="small muted">None booked.</p>'}</section>
      ${past.length ? `<section class="card"><div class="card-h"><h2>Past visits</h2></div><ul class="ca-list">${past.slice(0, 12).map(row).join('')}</ul></section>` : ''}`;
  }
  function teamTab(s) {
    const T = K(s).team || [];
    return `<section class="card"><div class="card-h"><h2>Your care team</h2></div>
        ${T.length ? `<ul class="ca-list">${T.map((t) => `<li class="ca-appt"><div><b>${esc(t.name)}</b> <span class="muted small">${esc([t.role, t.org].filter(Boolean).join(' · '))}</span></div><div class="st-go">${t.phone ? `<a class="btn ghost sm" href="tel:${esc(t.phone)}">${icon('phone', 14)} ${esc(t.phone)}</a>` : ''}${t.email ? `<a class="btn ghost sm" href="mailto:${esc(t.email)}">Email</a>` : ''}${t.url ? `<a class="btn ghost sm" href="${esc(/^https?:\/\//.test(t.url) ? t.url : `https://${t.url}`)}" target="_blank" rel="noopener">Portal</a>` : ''}</div>
          <button class="lb-del" data-act="ca-del" data-k="team" data-id="${t.id}" aria-label="Remove ${esc(t.name)}">${icon('x', 12)}</button></li>`).join('')}</ul>` : '<p class="small muted">Add your doctor, specialists, physio, dietitian, therapist or coach.</p>'}</section>
      <section class="card"><div class="card-h"><h2>Add someone</h2></div>
        <form class="lb-grid" data-submit="ca-team"><label>Name<input name="name" maxlength="60" required></label><label>Role<input name="role" maxlength="40" placeholder="GP, cardiologist, physio"></label><label>Practice<input name="org" maxlength="60"></label>
          <label>Phone<input name="phone" type="tel" maxlength="24"></label><label>Email<input name="email" type="email" maxlength="80"></label><label>Patient portal<input name="url" maxlength="120" placeholder="portal.example.org"></label>
          <div class="lb-wide"><button class="btn sm">${icon('plus', 14)} Add to team</button></div></form>
        <p class="fine">Share a summary with them from <a href="#report">Report</a> or a QR code from <a href="#score">Myo Score</a>.</p></section>`;
  }
  function prepItems(s) {
    const sc = OS.scores(s), I = (s.emergency && s.emergency.id) || {}, since = dayKey(addDays(new Date(), -30)), out = [];
    (sc.redFlags || []).forEach((f) => out.push(['Urgent', `${f.name}: ${f.value} ${f.unit || ''}`.trim(), f.why]));
    (sc.flagged || []).filter((x) => x.m && x.e && (x.e.status === 'bad' || x.e.status === 'warn') && OS.hasValue(x.m)).sort((x, y) => (x.e.status === 'bad' ? 0 : 1) - (y.e.status === 'bad' ? 0 : 1)).slice(0, 6).forEach(({ m, e }) => out.push(['Labs', `${m.name}: ${m.value}${m.unit ? ` ${m.unit}` : ''}`, e.status === 'bad' ? 'Outside its reference range' : 'In range, not yet optimal']));
    const sym = {}; (s.symptoms || []).filter((r) => r.at.slice(0, 10) >= since).forEach((r) => { (sym[r.sym] = sym[r.sym] || []).push(r.sev); });
    Object.entries(sym).sort((a, b) => b[1].length - a[1].length).slice(0, 5).forEach(([k, v]) => out.push(['Symptoms', `${k}: ${v.length} time${v.length > 1 ? 's' : ''} in 30 days`, `worst ${Math.max(...v)}/10`]));
    if (OS.cancer && s.cancer) {
      const since60 = dayKey(addDays(new Date(), -60));
      (s.cancer.signs || []).filter((x) => x.d >= since60).forEach((x) => out.push(['Warning sign', (OS.cancer.SIGNS.find((y) => y[0] === x.k) || [, x.k])[1], `noted ${fmtDate(x.d)}: say how long it has lasted`]));
      try { OS.cancer.plan(s).filter((p) => p.st === 'due' || p.st === 'follow').forEach((p) => out.push(['Screening', `${p.name} cancer screening: ${p.st === 'due' ? 'due' : 'follow-up open'}`, p.tests || ''])); } catch { /* skip */ }
    }
    const sz = ((s.emergency && s.emergency.log) || []).filter((r) => r.kind === 'seizure' && r.at.slice(0, 10) >= since); if (sz.length) out.push(['Events', `${sz.length} seizure${sz.length > 1 ? 's' : ''} in 30 days`, 'Times and notes are in the Log book']);
    if (OS.cycle && s.cycle) { const M = OS.cycle.model(s.cycle); if (M.known >= 2) out.push(['Cycle', `Cycles average ${Math.round(M.avg)} days (±${Math.round(M.sdv)}), periods ${Math.round(M.pavg)} days`, M.phase === 'late' ? 'Period currently late' : '']); }
    if (OS.pregnancy && s.pregnancy) { const w = OS.pregnancy.status(s); if (w) out.push(['Pregnancy', `${w} pregnant`, '']); }
    const bc = ((s.bodycomp && s.bodycomp.scans) || []).filter((x) => x.w != null && !x.sample).sort((a, b) => a.d.localeCompare(b.d)); if (bc.length > 1) { const a = bc[0], b = bc[bc.length - 1]; out.push(['Body', `Weight ${a.w} → ${b.w} kg`, `${fmtDate(a.d)} to ${fmtDate(b.d)}`]); }
    const L = (s.enhance && s.enhance.labs) || {}; if (L.sbp && L.dbp) out.push(['Body', `Blood pressure ${L.sbp}/${L.dbp} mmHg`, '']);
    if (I.meds) out.push(['Medicines', I.meds, 'From your medical ID']); if (I.allergies) out.push(['Allergies', I.allergies, 'From your medical ID']);
    return out;
  }
  function prepTab(s) {
    const P = prepItems(s), Q = K(s).questions || [];
    return `<section class="card"><div class="card-h"><h2>From your data</h2><button class="btn ghost sm" data-act="ca-print">Print visit sheet</button></div>
        ${P.length ? `<ul class="fd-pan">${P.map(([c, t, n]) => `<li><span class="ca-cat ${c === 'Urgent' ? 'ca-urgent' : ''}">${esc(c)}</span> <b>${esc(t)}</b>${n ? ` <span class="muted small">${esc(n)}</span>` : ''}</li>`).join('')}</ul>` : '<p class="small muted">Nothing flagged. Add labs, symptoms or your medical ID and they appear here.</p>'}</section>
      <section class="card"><div class="card-h"><h2>My questions</h2></div>
        ${Q.length ? `<ol class="ca-q">${Q.map((q, i) => `<li>${esc(q)} <button class="lb-del" data-act="ca-qdel" data-i="${i}" aria-label="Remove question">${icon('x', 12)}</button></li>`).join('')}</ol>` : ''}
        <form class="row" data-submit="ca-q"><label class="sr" for="ca-qi">Question</label><input id="ca-qi" name="q" maxlength="200" placeholder="Is this result something to act on?" required><button class="btn ghost sm">Add</button></form>
        <ul class="small bc-ref"><li>Put your most important question first: visits run short.</li><li>Ask what the next step is, and when and how you'll hear about results.</li><li>Bring someone, or ask if you can record the advice.</li></ul></section>`;
  }
  function routinesTab(s) {
    const R = K(s).routines || [], perm = 'Notification' in window ? Notification.permission : 'unsupported';
    return `<section class="card"><div class="card-h"><h2>Routines</h2><button class="btn ghost sm" data-act="ca-ics-routines" ${R.length ? '' : 'disabled'}>${icon('download', 14)} Add to my calendar</button></div>
        ${R.length ? `<ul class="ca-list">${R.map((r) => `<li class="ca-appt"><div><b class="num">${esc(r.time)}</b> ${esc(r.title)} <span class="muted small">${!r.days || !r.days.length || r.days.length === 7 ? 'every day' : r.days.map((d) => DOW.find((x) => x[0] === d)[1]).join(', ')}</span></div><button class="lb-del" data-act="ca-del" data-k="routines" data-id="${r.id}" aria-label="Delete routine">${icon('x', 12)}</button></li>`).join('')}</ul>` : '<p class="small muted">No routines yet. Try a morning light walk, a wind-down time, a weigh-in, or a stretch break.</p>'}
        <form class="lb-grid" data-submit="ca-routine"><label class="lb-wide">Routine<input name="title" maxlength="60" required placeholder="10-minute walk outside"></label><label>Time<input type="time" name="time" required value="07:30"></label>
          <fieldset class="lb-wide cy-flow"><legend>Days (none means every day)</legend>${DOW.map(([k, l]) => `<label class="chip-btn"><input type="checkbox" name="d" value="${k}"> ${l}</label>`).join('')}</fieldset>
          <div class="lb-wide"><button class="btn sm">${icon('plus', 14)} Add routine</button></div></form></section>
      <section class="card"><div class="card-h"><h2>Reminders</h2></div>
        <p class="small">Myo shows a reminder at each routine's time while it is open. For reminders when Myo is closed, add your routines to your phone's calendar above.</p>
        ${perm === 'unsupported' ? '<p class="small muted">This browser has no notifications.</p>' : perm === 'granted' ? `<label class="ped-use tested"><input type="checkbox" data-change="ca-notify" ${K(s).notify ? 'checked' : ''}> Also show a system notification</label>` : perm === 'denied' ? '<p class="small muted">Notifications are blocked for this site in your browser settings.</p>' : '<button class="btn ghost sm" data-act="ca-perm">Allow notifications</button>'}</section>`;
  }

  OS.register('care', {
    title: 'Care and calendar', icon: 'calendar',
    render(s) {
      const body = { up: upTab, visits: visitsTab, team: teamTab, prep: prepTab, routines: routinesTab }[CA.tab](s);
      return `${OS.ui.head('Team · appointments · everything coming up', 'Care and calendar', 'Keep your care team and appointments in one place, walk into every visit prepared, set routines, and see everything coming up across Myo.')}
        <div class="ca bc fl"><div class="seg kt-tabs" role="tablist" aria-label="Care and calendar">${TABS.map(([k, l]) => `<button role="tab" aria-selected="${CA.tab === k}" data-act="ca-tab" data-t="${k}">${l}</button>`).join('')}</div>${body}</div>`;
    }
  });
  const put = (fn) => OS.update((s) => { s.care = s.care || {}; ['appts', 'team', 'routines', 'questions'].forEach((k) => { s.care[k] = s.care[k] || []; }); fn(s.care); });
  OS.act('ca-tab', (el) => { CA.tab = TABS.some(([k]) => k === el.dataset.t) ? el.dataset.t : 'up'; OS.render(); });
  OS.act('ca-book', (el) => { CA.prefill = el.dataset.t; CA.tab = 'visits'; OS.render(); });
  OS.act('ca-appt', (f) => { const E = f.elements, a = { id: uid(), d: E.d.value, time: E.time.value || '', who: E.who.value.trim(), where: E.where.value.trim(), why: E.why.value.trim() }; if (!a.d) return; put((X) => { X.appts.push(a); }); CA.prefill = ''; OS.logEvent('note', `Appointment: ${a.why}`, [fmtDate(a.d), a.time, a.who].filter(Boolean).join(' · '), { go: 'care', src: 'manual' }); });
  OS.act('ca-after', (f) => { const id = f.dataset.id, t = f.elements.t.value.slice(0, 1500); put((X) => { const a = X.appts.find((x) => x.id === id); if (a) a.after = t; }); OS.toast('Notes saved'); });
  OS.act('ca-del', (el) => { const k = el.dataset.k; put((X) => { X[k] = X[k].filter((x) => x.id !== el.dataset.id); }); });
  OS.act('ca-team', (f) => { const E = f.elements, g = (k) => E[k].value.trim(); if (!g('name')) return; put((X) => { X.team.push({ id: uid(), name: g('name'), role: g('role'), org: g('org'), phone: g('phone').replace(/[^\d+\-() ]/g, ''), email: g('email'), url: g('url') }); }); });
  OS.act('ca-q', (f) => { const q = f.elements.q.value.trim(); if (q) put((X) => { X.questions.push(q); X.questions = X.questions.slice(-30); }); });
  OS.act('ca-qdel', (el) => put((X) => { X.questions.splice(+el.dataset.i, 1); }));
  OS.act('ca-routine', (f) => { const E = f.elements, days = [...f.querySelectorAll('input[name="d"]:checked')].map((x) => x.value); put((X) => { X.routines.push({ id: uid(), title: E.title.value.trim(), time: E.time.value, days: days.length === 7 ? [] : days }); }); });
  OS.change('ca-notify', (el) => put((X) => { X.notify = el.checked; }));
  OS.act('ca-perm', async () => { try { await Notification.requestPermission(); } catch { /* */ } if (Notification.permission === 'granted') put((X) => { X.notify = true; }); else OS.render(); });
  OS.act('ca-ics', (el) => { const a = (K(OS.state).appts || []).find((x) => x.id === el.dataset.id); if (a) save(`myo-appointment-${a.d}.ics`, ics([{ d: a.d, time: a.time, dur: 30, title: a.why || 'Appointment', where: a.where, desc: a.who ? `With ${a.who}` : '', alarm: a.time ? 60 : 0, uid: a.id }])); });
  OS.act('ca-ics-routines', () => save('myo-routines.ics', ics((K(OS.state).routines || []).map(routineEvent))));
  OS.act('ca-ics-all', () => { const s = OS.state, U = upcoming(s).filter((e) => !e.routine); save('myo-calendar.ics', ics([...U.map((e) => ({ d: e.d, time: e.time, title: `${e.title}`, where: e.where, desc: `From Myo · ${e.cat}`, alarm: e.cat === 'Appointment' && e.time ? 60 : 0, uid: e.id || `${e.d}-${e.cat}-${e.title}`.replace(/[^\w-]/g, '').slice(0, 60) })), ...(K(s).routines || []).map(routineEvent)])); });
  OS.act('ca-print', () => {
    const s = OS.state, P = prepItems(s), Q = K(s).questions || [], w = window.open('', '_blank', 'width=700,height=800'); if (!w) { OS.toast('Allow pop-ups to print'); return; }
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Visit sheet</title><style>body{font:13px/1.45 system-ui,sans-serif;margin:24px;max-width:680px}h1{font-size:18px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 6px}li{margin:3px 0}.c{color:#555;font-size:11px;text-transform:uppercase;letter-spacing:.04em;margin-right:6px}</style>
      <h1>Visit sheet</h1><p>${esc((s.emergency && s.emergency.id && s.emergency.id.name) || '')} · ${esc(new Date().toLocaleDateString())}</p><h2>From my data</h2><ul>${P.map(([c, t, n]) => `<li><span class="c">${esc(c)}</span><b>${esc(t)}</b>${n ? ` — ${esc(n)}` : ''}</li>`).join('') || '<li>Nothing flagged</li>'}</ul>
      <h2>My questions</h2><ol>${Q.map((q) => `<li>${esc(q)}</li>`).join('') || '<li></li><li></li><li></li>'}</ol><h2>Notes</h2><p style="border-top:1px solid #ccc;height:160px"></p><p style="color:#777;font-size:11px">Prepared with Myo. Wellness information for discussion with a clinician; not a diagnosis.</p>`);
    w.document.close(); w.focus(); setTimeout(() => { try { w.print(); } catch { /* */ } }, 300);
  });
  OS.care = { upcoming, ics, vevent, prepItems, screeningsDue, state: CA,
    status(s) { const n = upcoming(s, 14).filter((e) => !e.routine).length, a = (K(s).appts || []).filter((x) => x.d >= dayKey(new Date())).sort((p, q) => p.d.localeCompare(q.d))[0]; return a ? [`Next visit ${fmtDate(a.d)}`, 'good'] : n ? [`${n} item${n > 1 ? 's' : ''} in the next 2 weeks`, 'muted'] : null; } };
})();
