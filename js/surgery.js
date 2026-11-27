/* ═══ MYO — SURGERY: a member's surgery companion, and an operating-room workflow board for surgical teams ═══
   My surgery  · plan, countdown and milestones, the prep checklist (shared with Myo Mode's Procedure care),
                 prehab readiness from the member's own data, questions for the surgeon
   Day of      · a family status tracker (checked in → in surgery → in recovery → home) with shareable updates
   Recovery    · a daily check-in (pain, temperature, wound, calf, breathing, fluids) with red-flag escalation,
                 pain and resting-heart-rate trends against the pre-surgery baseline
   OR board    · for surgical teams: rooms and cases, stage times, a checklist adapted from the WHO Surgical Safety
                 Checklist (sign in, time out, sign out), counts with discrepancy alerts, team roster, event log,
                 on-time starts, turnover and overrun, CSV export
   Boundaries: operational and educational only. Myo does not plan, guide or perform surgery, interpret monitoring or
   give clinical instructions; the surgical team's instructions and the hospital's policies always come first.
   The OR board keeps case IDs, not patient names, on this device. */
(function () {
  'use strict';
  const { esc, icon, pill, clamp, dayKey, addDays, fmtDate, uid } = OS;
  const SG = { tab: 'me', red: null, sel: null, filter: 'all' };
  const TABS = [['me', 'My surgery'], ['day', 'Day of surgery'], ['recover', 'Recovery'], ['or', 'OR board · teams']];
  const PRE = [['ask', 'Questions written down for your surgeon: risks, recovery time, activity limits'], ['meds', 'Full medicine and supplement list (including blood thinners, diabetes and weight-loss medicines, herbal products) given to your surgical team; they decide what to pause'], ['fast', "Your team's eating and drinking instructions for the day before, written down"], ['prehab', 'Prehab plan from your physical therapist'], ['protein', 'Protein target met for the two weeks before'], ['smoke', 'No smoking or vaping'], ['help', 'Ride home and help for the first days arranged'], ['home', 'Home ready: clear paths, essentials within reach, a chair with arms'], ['sleep', 'Sleep window protected the week before'], ['bag', 'Bag packed: ID, insurance card, medicine list, charger, loose clothes']];
  const MILES = [[-42, 'Six weeks out', 'Start prehab and daily walks, stop smoking and vaping, and ask your team which tests you need.'], [-14, 'Two weeks out', 'Hit your protein target daily, protect sleep, and hand your full medicine list to your team.'], [-7, 'One week out', 'Arrange your ride and help at home, set up the house, and confirm the arrival time.'], [-1, 'Day before', "Follow your team's eating, drinking and washing instructions exactly. Pack your bag."], [0, 'Surgery day', 'Bring your medicine list and ID. Hand this phone to your companion for status updates.'], [3, 'First days home', 'Walk a little every few hours, log pain daily, and watch the red flags.'], [14, 'Two weeks', 'Wound check or follow-up with your team; rehab ramps up as they advise.']];
  const QUESTIONS = ['What exactly will be done, and what are the main risks for me?', 'How long will I stay, and when can I walk, drive, work and train again?', 'Which of my medicines and supplements should I pause, and when?', 'What should I eat and drink before, and when do I stop?', 'How will my pain be managed, and what should I do if it is not controlled?', 'Who do I call with a problem after hours?', 'When is my follow-up, and when do stitches or dressings come off?'];
  const DAY = [['in', 'Checked in'], ['preop', 'In pre-op'], ['or', 'In the operating room'], ['under', 'Surgery under way'], ['rec', 'In recovery'], ['room', 'Moved to a room'], ['home', 'Going home']];
  const RED = {
    now: 'Call your local emergency number now (911 in the US).',
    team: 'Call your surgical team today, or their after-hours line. If you cannot reach them, go to urgent care or the emergency department.'
  };

  function ensure(s) { s.procedure = s.procedure || {}; const P = s.procedure; P.checks = P.checks || {}; P.pain = P.pain || []; P.checkins = P.checkins || []; P.status = P.status || {}; P.qs = P.qs || {}; return P; }
  const daysTo = (d) => (d ? Math.round((Date.parse(d + 'T12:00:00') - Date.parse(dayKey() + 'T12:00:00')) / 864e5) : null);
  const tm = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');

  /* ── member: plan, prep, prehab ── */
  function prehab(s) {
    const sc = OS.scores(s), log = (s.training && s.training.log) || [], since = dayKey(addDays(new Date(), -28));
    const sessions = log.filter((x) => x.date >= since).length, L = OS.longevity ? OS.longevity.summary(s, sc) : null;
    const items = [['Training in the last 4 weeks', sessions, `${sessions} session${sessions === 1 ? '' : 's'}`, clamp((sessions / 10) * 100, 0, 100), 'training'],
      ['Readiness today', sc.readiness, sc.readiness == null ? 'No wearable data' : String(sc.readiness), sc.readiness, 'wearables'],
      ['Sleep', s.vitals && s.vitals.sleepH, s.vitals && s.vitals.sleepH ? `${s.vitals.sleepH} h a night` : 'No data', s.vitals && s.vitals.sleepH ? clamp(100 - Math.abs(s.vitals.sleepH - 7.75) * 25, 0, 100) : null, 'sleep'],
      ['Fitness (VO2max)', L && L.vo2 && L.vo2.v, L && L.vo2 && L.vo2.v ? `${Math.round(L.vo2.v)} ml/kg/min` : 'No data', L && L.vo2 && L.vo2.v ? clamp((L.vo2.v / 45) * 90, 0, 100) : null, 'longevity']];
    const have = items.filter((x) => x[3] != null);
    return { items, score: have.length ? Math.round(have.reduce((a, x) => a + x[3], 0) / have.length) : null };
  }
  function meTab(s) {
    const P = ensure(s), dt = daysTo(P.date), H = prehab(s), done = PRE.filter(([k]) => P.checks[k]).length;
    return `<section class="card"><div class="card-h"><h2>Your surgery</h2>${dt == null ? '' : pill(dt > 0 ? 'warn' : dt === 0 ? 'good' : 'muted', dt > 0 ? `In ${dt} day${dt === 1 ? '' : 's'}` : dt === 0 ? 'Today' : `${-dt} day${dt === -1 ? '' : 's'} ago`)}</div>
        <form data-submit="sg-plan" class="lb-grid sg-form">
          <label>Procedure<input name="n" maxlength="80" value="${esc(P.name || '')}" placeholder="e.g. ACL reconstruction"></label>
          <label>Date<input name="d" type="date" value="${esc(P.date || '')}"></label>
          <label>Hospital or centre<input name="where" maxlength="80" value="${esc(P.where || '')}"></label>
          <label>Surgical team contact<input name="call" maxlength="40" value="${esc(P.call || '')}" placeholder="Phone number for questions"></label>
          <label>Anaesthesia, if you know<select name="anes">${['', 'General', 'Regional (spinal or nerve block)', 'Local with sedation', 'Local only', 'Not sure yet'].map((x) => `<option ${P.anes === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
          <div class="lb-wide"><button class="btn sm">${icon('check', 14)} Save</button></div></form></section>
      <div class="grid g-2">
        <section class="card"><div class="card-h"><h2>Getting ready</h2><span class="muted small">${done} of ${PRE.length}</span></div>
          <ul class="mm-checks sg-checks">${PRE.map(([k, t]) => `<li><label class="ped-use tested"><input type="checkbox" data-change="sg-check" data-k="${k}" ${P.checks[k] ? 'checked' : ''}> ${esc(t)}</label></li>`).join('')}</ul>
          <p class="fine">The same list appears in Myo Mode's Procedure care.</p></section>
        <section class="card"><div class="card-h"><h2>Milestones</h2></div>
          <ol class="sg-miles">${MILES.map(([d, t, x]) => { const when = P.date ? fmtDate(dayKey(addDays(new Date(P.date + 'T12:00:00'), d))) : ''; const past = dt != null && -dt >= d; return `<li class="${past ? 'past' : ''}"><b>${t}</b>${when ? ` <span class="muted small">${when}</span>` : ''}<p class="small">${esc(x)}</p></li>`; }).join('')}</ol></section></div>
      <div class="grid g-2">
        <section class="card"><div class="card-h"><h2>Prehab readiness</h2>${H.score != null ? pill(H.score >= 75 ? 'good' : H.score >= 50 ? 'warn' : 'bad', `${H.score} / 100`) : ''}</div>
          <p class="small">Fitter, well-slept, well-fed people tend to recover faster. This reads your own Myo data; it is not a surgical fitness assessment, which your team does.</p>
          <ul class="sg-pre">${H.items.map(([l, , txt, v, go]) => `<li><span>${l}</span><b>${esc(txt)}</b><i class="tw-bar"><i class="${v == null ? 'muted' : v >= 75 ? 'good' : v >= 50 ? 'warn' : 'bad'}" style="width:${v ?? 0}%"></i></i><a class="link small" href="#${go}">Open</a></li>`).join('')}</ul></section>
        <section class="card"><div class="card-h"><h2>Questions for your surgeon</h2></div>
          <ul class="mm-checks sg-checks">${QUESTIONS.map((q, i) => `<li><label class="ped-use tested"><input type="checkbox" data-change="sg-q" data-k="${i}" ${P.qs[i] ? 'checked' : ''}> ${esc(q)}</label></li>`).join('')}</ul>
          <form data-submit="sg-myq" class="tw-ask"><label class="sr" for="sg-myq">Add your own question</label><input id="sg-myq" name="q" maxlength="160" placeholder="Add your own question"><button class="btn sm">Add</button></form>
          ${(P.myqs || []).length ? `<ul class="small sg-myqs">${P.myqs.map((q, i) => `<li>${esc(q)} <button class="lb-del" data-act="sg-myq-del" data-i="${i}" aria-label="Remove question">${icon('x', 12)}</button></li>`).join('')}</ul>` : ''}</section></div>
      <p class="fine">Myo helps you prepare for and recover from a procedure your surgical team plans. It does not plan, guide or perform surgery: your team's instructions come first.</p>`;
  }

  /* ── member: day of surgery ── */
  function dayTab(s) {
    const P = ensure(s), st = P.status, cur = [...DAY].reverse().find(([k]) => st[k]);
    const text = statusText(P);
    return `<section class="card"><div class="card-h"><h2>Status for family</h2>${cur ? pill('good', cur[1]) : pill('muted', 'Not started')}</div>
        <p class="small">Give this phone to the person waiting for you. Each time the hospital updates them, tap the step to time-stamp it, then send the update.</p>
        <ol class="sg-steps">${DAY.map(([k, l], i) => `<li class="${st[k] ? 'done' : ''} ${cur && cur[0] === k ? 'cur' : ''}"><button class="sg-step" data-act="sg-stage" data-k="${k}" aria-pressed="${!!st[k]}"><span class="sg-n">${i + 1}</span><b>${l}</b><span class="muted small">${st[k] ? tm(st[k]) : 'Tap when it happens'}</span></button></li>`).join('')}</ol>
        <div class="st-go"><button class="btn" data-act="sg-share" ${cur ? '' : 'disabled'}>${icon('send', 16)} Send update</button><button class="btn ghost sm" data-act="sg-stage-reset">Start over</button></div>
        <pre class="sg-msg" aria-label="Update text">${esc(text)}</pre></section>
      <section class="card"><div class="card-h"><h2>While you wait</h2></div><ul class="small bc-ref">
        <li>Many hospitals show a status board with a tracking number instead of a name. Ask for the number at check-in.</li>
        <li>Surgeries often run longer than planned; a long wait is common and is not, by itself, a sign of a problem.</li>
        <li>The surgeon or a nurse usually speaks with the family after surgery. Keep your phone charged and on.</li>
        <li>Recovery-room visits are often short and limited to one or two people.</li></ul></section>`;
  }
  function statusText(P) {
    const st = P.status, cur = [...DAY].reverse().find(([k]) => st[k]);
    if (!cur) return 'No updates yet.';
    return `Update${P.name ? ` on ${P.name}` : ''}: ${cur[1].toLowerCase()} since ${tm(st[cur[0]])}.\n${DAY.filter(([k]) => st[k]).map(([k, l]) => `${tm(st[k])}  ${l}`).join('\n')}`;
  }

  /* ── member: recovery ── */
  function redOf(c) {
    if (c.chest || c.breath === 'bad' || c.blood) return { lvl: 'now', why: [c.chest && 'chest pain', c.breath === 'bad' && 'hard to breathe', c.blood && 'coughing up blood'].filter(Boolean) };
    const tC = c.tempU === 'F' && c.temp != null ? (c.temp - 32) / 1.8 : c.temp;
    const why = [tC != null && tC >= 38 && `temperature ${c.temp}°${c.tempU || 'C'}`, c.wound === 'red' && 'redness spreading from the wound', c.wound === 'pus' && 'pus or a bad smell from the wound', c.wound === 'open' && 'the wound opening', c.calf && 'calf pain or swelling', c.fluids && "can't keep fluids down", c.urine && 'no urine for 8 hours or more', c.pain >= 8 && 'pain at 8 or more'].filter(Boolean);
    return why.length ? { lvl: 'team', why } : null;
  }
  function recoverTab(s) {
    const P = ensure(s), ci = P.checkins.slice().reverse(), dt = daysTo(P.date);
    const W = s.wear || {}, src = ['oura', 'whoop'].find((k) => W[k] && W[k].days && W[k].days.length);
    let rhr = '';
    if (src && P.date) {
      const days = W[src].days, pre = days.filter((x) => x.d < P.date && x.d >= dayKey(addDays(new Date(P.date + 'T12:00:00'), -14)) && x.rhr), post = days.filter((x) => x.d >= P.date && x.rhr);
      const base = pre.length ? pre.reduce((a, x) => a + x.rhr, 0) / pre.length : null, last = post.slice(-1)[0];
      if (base && last) rhr = `<p class="small">Resting heart rate: <b>${Math.round(last.rhr)} bpm</b> on ${fmtDate(last.d)}, against ${Math.round(base)} bpm in the two weeks before surgery. It usually runs higher for a while after surgery and settles back as you recover.</p>`;
    }
    const pain = P.pain.slice(-14);
    const chart = pain.length >= 2 ? (() => { const W2 = 560, H2 = 130, X = (i) => 30 + (i / (pain.length - 1)) * (W2 - 40), Y = (v) => 10 + (1 - v / 10) * (H2 - 30);
      return `<svg class="sg-pain" viewBox="0 0 ${W2} ${H2}" role="img" aria-label="Pain over the last ${pain.length} logs, 0 to 10">${[0, 5, 10].map((v) => `<line class="bc-grid" x1="30" x2="${W2 - 10}" y1="${Y(v)}" y2="${Y(v)}"/><text class="bc-ax" x="24" y="${Y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
        <path class="bc-ln bc-fat" d="${pain.map((x, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(x.v).toFixed(1)}`).join(' ')}"/>${pain.map((x, i) => `<circle class="bc-mk bc-fat" cx="${X(i).toFixed(1)}" cy="${Y(x.v).toFixed(1)}" r="3.5"><title>${fmtDate(x.d)}: ${x.v}/10</title></circle>`).join('')}
        <text class="bc-ax" x="30" y="${H2 - 6}">${fmtDate(pain[0].d)}</text><text class="bc-ax" x="${W2 - 10}" y="${H2 - 6}" text-anchor="end">${fmtDate(pain[pain.length - 1].d)}</text></svg>`; })() : '<p class="small muted">Two or more daily logs draw your pain trend.</p>';
    const red = SG.red;
    return `<section class="card"><div class="card-h"><h2>Daily check-in</h2>${dt != null && dt <= 0 ? `<span class="muted small">Day ${-dt} after surgery</span>` : ''}</div>
        <form data-submit="sg-checkin" class="lb-grid sg-form">
          <label>Pain now, 0 to 10<input name="pain" type="number" min="0" max="10" required></label>
          <label>Temperature<span class="sg-temp"><input name="temp" type="number" step="0.1" min="30" max="110" inputmode="decimal"><select name="tempU"><option>C</option><option>F</option></select></span></label>
          <label>Wound<select name="wound"><option value="ok">Dry, or as your team expected</option><option value="fluid">A little clear fluid</option><option value="red">Redness spreading from it</option><option value="pus">Pus or a bad smell</option><option value="open">Edges opening</option></select></label>
          <label>Breathing<select name="breath"><option value="ok">Normal</option><option value="bad">Short of breath or hard to breathe</option></select></label>
          <fieldset class="lb-wide sg-flags"><legend class="small">Tick any that apply</legend>
            ${[['chest', 'Chest pain'], ['blood', 'Coughing up blood'], ['calf', 'Calf pain or swelling'], ['fluids', "Can't keep fluids down"], ['urine', 'No urine for 8 hours or more']].map(([k, l]) => `<label class="ped-use tested"><input type="checkbox" name="${k}"> ${l}</label>`).join('')}</fieldset>
          <label class="lb-wide">Note<input name="note" maxlength="140" placeholder="Walking, sleep, appetite, anything new"></label>
          <div class="lb-wide"><button class="btn sm">${icon('plus', 14)} Save check-in</button></div></form>
        ${red ? `<div class="banner bad sg-red" role="alert"><b>${red.lvl === 'now' ? 'Emergency' : 'Call your surgical team today'}:</b> ${esc(red.why.join(', '))}. ${RED[red.lvl]}${P.call && red.lvl === 'team' ? ` Your team: <a href="tel:${esc(P.call.replace(/[^\d+]/g, ''))}">${esc(P.call)}</a>.` : ''}</div>` : ''}
        <p class="fine">For tracking, not diagnosis. Your surgical team's instructions come first; if something worries you, call them.</p></section>
      <div class="grid g-2">
        <section class="card"><div class="card-h"><h2>Pain trend</h2></div>${chart}${rhr}<div class="st-go"><a class="btn ghost sm" href="#pt">Rehab plans</a><a class="btn ghost sm" href="#logbook">Log book</a></div></section>
        <section class="card"><div class="card-h"><h2>Check-ins</h2><span class="muted small">${ci.length}</span></div>
          ${ci.length ? `<div class="tbl-wrap"><table class="tbl compact"><caption class="sr">Recovery check-ins</caption><thead><tr><th scope="col">Day</th><th scope="col">Pain</th><th scope="col">Temp</th><th scope="col">Wound</th><th scope="col">Flags</th></tr></thead><tbody>
            ${ci.slice(0, 14).map((c) => { const r = redOf(c); return `<tr><th scope="row" class="small">${esc(fmtDate(c.d))}</th><td class="num">${c.pain}</td><td class="num">${c.temp != null ? `${c.temp}°${c.tempU || 'C'}` : '—'}</td><td class="small">${esc({ ok: 'As expected', fluid: 'Clear fluid', red: 'Spreading redness', pus: 'Pus or smell', open: 'Opening' }[c.wound] || '')}</td><td>${r ? pill('bad', r.lvl === 'now' ? 'Emergency' : 'Call team') : pill('good', 'None')}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="small muted">No check-ins yet.</p>'}</section></div>`;
  }

  /* ── OR board for surgical teams ── */
  const STAGES = [['sched', 'Scheduled'], ['preop', 'In pre-op'], ['inroom', 'In room'], ['anes', 'Anaesthesia start'], ['incision', 'Incision'], ['closing', 'Closing'], ['out', 'Out of room'], ['pacu', 'In recovery (PACU)'], ['done', 'PACU discharge']];
  const CHECK = {
    signin: ['Sign in', 'Before induction of anaesthesia', ['Patient has confirmed identity, site, procedure and consent', 'Site marked, or not applicable', 'Anaesthesia machine and medication check complete', 'Pulse oximeter on the patient and working', 'Known allergies checked', 'Difficult airway or aspiration risk checked; equipment and help available if yes', 'Risk of more than 500 ml blood loss (7 ml/kg in children) checked; access and fluids planned if yes']],
    timeout: ['Time out', 'Before skin incision', ['Every team member introduced by name and role', 'Surgeon, anaesthetist and nurse confirm patient, site and procedure', 'Antibiotic prophylaxis given in the last 60 minutes, or not applicable', 'Surgeon: critical or non-routine steps, expected duration and blood loss reviewed', 'Anaesthesia team: patient-specific concerns reviewed', 'Nursing team: sterility, including indicator results, confirmed; equipment issues raised', 'Essential imaging displayed, or not applicable']],
    signout: ['Sign out', 'Before the patient leaves the room', ['Name of the procedure recorded', 'Instrument, sponge and needle counts complete and correct', 'Specimens labelled with the patient identifier', 'Equipment problems to address noted', 'Key concerns for recovery reviewed by surgeon, anaesthetist and nurse']]
  };
  const COUNTS = [['sponges', 'Sponges'], ['sharps', 'Sharps and needles'], ['instr', 'Instruments']];
  function orEnsure(s) { if (!s.ortools || !Array.isArray(s.ortools.cases)) s.ortools = { cases: [], day: dayKey() }; return s.ortools; }
  const stageOf = (c) => [...STAGES].reverse().find(([k]) => c.times && c.times[k]) || STAGES[0];
  const mins = (a, b) => (a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 60000) : null);
  const hhmm = (m) => (m == null ? '—' : m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);
  const phaseDone = (c, k) => CHECK[k][2].every((_, i) => c.check && c.check[k] && c.check[k][i]);
  const countOk = (c, k) => { const x = (c.counts || {})[k]; if (!x || x.final == null || x.final === '') return null; return +x.final === (+x.start || 0) + (+x.added || 0); };
  function kpis(O) {
    const cs = O.cases, rooms = [...new Set(cs.map((c) => c.room))].sort();
    let onTime = 0, firsts = 0; const turns = [], over = [];
    rooms.forEach((r) => {
      const list = cs.filter((c) => c.room === r).sort((a, b) => (a.sched || '').localeCompare(b.sched || ''));
      const f = list[0]; if (f && f.times && f.times.inroom && f.sched) { firsts++; const sch = Date.parse(`${O.day}T${f.sched}`); if (Date.parse(f.times.inroom) - sch <= 5 * 60000) onTime++; }
      for (let i = 1; i < list.length; i++) { const t = mins(list[i - 1].times && list[i - 1].times.out, list[i].times && list[i].times.inroom); if (t != null && t >= 0) turns.push(t); }
      list.forEach((c) => { const d = mins(c.times && c.times.inroom, c.times && c.times.out); if (d != null && c.est) over.push(d - c.est); });
    });
    const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
    return { rooms, onTime, firsts, turn: avg(turns), over: avg(over), done: cs.filter((c) => c.times && c.times.out).length, live: cs.filter((c) => c.times && c.times.inroom && !c.times.out).length, total: cs.length };
  }
  function sampleDay() {
    const d = dayKey(), at = (h, m) => new Date(`${d}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).toISOString();
    const mk = (room, caseId, proc, sched, est, times, extra = {}) => ({ id: uid(), room, caseId, proc, sched, est, times, team: { surgeon: 'Surgeon A', anaes: 'Anaesthetist B', scrub: 'Scrub C', circ: 'Circulator D' }, check: {}, counts: {}, events: [], sample: true, ...extra });
    const full = (n) => Array.from({ length: n }, () => true);
    return [
      mk('OR 1', 'C-1041', 'Laparoscopic cholecystectomy', '07:30', 75, { sched: at(6, 0), preop: at(6, 50), inroom: at(7, 32), anes: at(7, 40), incision: at(8, 0), closing: at(8, 52), out: at(9, 5), pacu: at(9, 10) }, { check: { signin: full(7), timeout: full(7), signout: full(5) }, counts: { sponges: { start: 20, added: 10, final: 30 }, sharps: { start: 12, added: 0, final: 12 }, instr: { start: 64, added: 0, final: 64 } } }),
      mk('OR 1', 'C-1042', 'Inguinal hernia repair', '09:15', 60, { sched: at(6, 0), preop: at(8, 40), inroom: at(9, 31), anes: at(9, 38), incision: at(9, 55) }, { check: { signin: full(7), timeout: full(7) }, counts: { sponges: { start: 10, added: 5 }, sharps: { start: 8, added: 2 }, instr: { start: 48, added: 0 } } }),
      mk('OR 1', 'C-1043', 'Knee arthroscopy', '11:00', 50, { sched: at(6, 0), preop: at(10, 5) }),
      mk('OR 2', 'C-2071', 'Total hip replacement', '07:30', 120, { sched: at(6, 0), preop: at(6, 45), inroom: at(7, 41), anes: at(7, 50), incision: at(8, 25), closing: at(10, 5), out: at(10, 30), pacu: at(10, 36) }, { check: { signin: full(7), timeout: full(7), signout: full(5) }, counts: { sponges: { start: 30, added: 10, final: 40 }, sharps: { start: 15, added: 5, final: 20 }, instr: { start: 112, added: 4, final: 116 } } }),
      mk('OR 2', 'C-2072', 'Carpal tunnel release', '11:00', 35, { sched: at(6, 0), preop: at(10, 20), inroom: at(11, 4) }, { check: { signin: full(7) } }),
      mk('OR 3', 'C-3011', 'Cataract extraction', '08:00', 25, { sched: at(6, 0), preop: at(7, 20), inroom: at(7, 58), anes: at(8, 2), incision: at(8, 10), closing: at(8, 27), out: at(8, 33), pacu: at(8, 36), done: at(9, 20) }, { check: { signin: full(7), timeout: full(7), signout: full(5) } }),
      mk('OR 3', 'C-3012', 'Cataract extraction', '08:45', 25, { sched: at(6, 0), preop: at(8, 10), inroom: at(8, 49), anes: at(8, 52), incision: at(9, 0), closing: at(9, 18), out: at(9, 24), pacu: at(9, 27) }, { check: { signin: full(7), timeout: full(7), signout: full(5) } })
    ];
  }
  function orTab(s) {
    const O = orEnsure(s), K = kpis(O), sel = O.cases.find((c) => c.id === SG.sel);
    const rows = O.cases.slice().sort((a, b) => a.room.localeCompare(b.room) || (a.sched || '').localeCompare(b.sched || ''));
    const now = new Date().toISOString();
    const caseRow = (c) => { const [k, l] = stageOf(c), since = c.times && c.times[k], inRoom = mins(c.times && c.times.inroom, (c.times && c.times.out) || now);
      const warn = (c.times && c.times.incision && !phaseDone(c, 'timeout')) || COUNTS.some(([x]) => countOk(c, x) === false);
      return `<tr class="${SG.sel === c.id ? 'on' : ''}"><th scope="row"><button class="link" data-act="sg-case" data-id="${c.id}">${esc(c.caseId)}</button></th><td class="small">${esc(c.room)}</td><td class="small">${esc(c.proc)}</td><td class="num">${esc(c.sched || '—')}</td>
        <td>${pill(k === 'done' || k === 'pacu' ? 'good' : k === 'sched' || k === 'preop' ? 'muted' : 'warn', l)} <span class="muted small">${since && k !== 'sched' ? tm(since) : ''}</span></td><td class="num">${c.times && c.times.inroom ? hhmm(inRoom) : '—'}${c.est ? ` / ${c.est} min` : ''}</td><td>${warn ? pill('bad', 'Check') : ''}</td></tr>`; };
    return `<div class="banner sg-or-note" role="note"><b>For surgical teams.</b> An operational board: stage times, checklist completion, counts and turnover. It gives no clinical guidance and does not replace your hospital's policies or systems. Use case IDs, not patient names: this board is stored on this device until Myo runs on a HIPAA-compliant service under your hospital's agreement.</div>
      <section class="card"><div class="card-h"><h2>Today's rooms</h2><span class="muted small">${esc(fmtDate(O.day))}</span></div>
        <div class="lb-tiles">${[['Cases', `${K.done}/${K.total}`, 'out of room'], ['In rooms now', K.live, 'cases'], ['First-case on-time starts', K.firsts ? `${K.onTime}/${K.firsts}` : '—', 'in room within 5 min'], ['Average turnover', K.turn == null ? '—' : K.turn, K.turn == null ? '' : 'min, out to next in'], ['Average overrun', K.over == null ? '—' : (K.over > 0 ? '+' : '') + K.over, K.over == null ? '' : 'min against estimate']].map(([l, v, u]) => `<div><span>${l}</span><b>${v}</b><em>${u}</em></div>`).join('')}</div>
        ${rows.length ? `<div class="tbl-wrap"><table class="tbl compact sg-board"><caption class="sr">Cases by room</caption><thead><tr><th scope="col">Case</th><th scope="col">Room</th><th scope="col">Procedure</th><th scope="col">Start</th><th scope="col">Status</th><th scope="col">In room / est.</th><th scope="col"><span class="sr">Alerts</span></th></tr></thead><tbody>${rows.map(caseRow).join('')}</tbody></table></div>` : '<p class="small muted">No cases yet. Add one below, or load a sample day to explore.</p>'}
        <div class="st-go">${O.cases.some((c) => c.sample) ? '<button class="btn ghost sm" data-act="sg-or-clear-sample">Remove sample day</button>' : '<button class="btn ghost sm" data-act="sg-or-sample">Load a sample day</button>'}${O.cases.length ? '<button class="btn ghost sm" data-act="sg-or-csv">Download case times (CSV)</button>' : ''}</div></section>
      ${sel ? caseCard(sel) : ''}
      <section class="card"><div class="card-h"><h2>Add a case</h2></div>
        <form data-submit="sg-or-add" class="lb-grid sg-form">
          <label>Case ID<input name="caseId" maxlength="20" required placeholder="e.g. C-1044 (not a name)"></label><label>Room<input name="room" maxlength="12" required placeholder="OR 1"></label>
          <label>Procedure<input name="proc" maxlength="80" required></label><label>Scheduled start<input name="sched" type="time" required></label><label>Estimated minutes<input name="est" type="number" min="5" max="900"></label>
          <label>Surgeon (role or initials)<input name="surgeon" maxlength="30"></label><div class="lb-wide"><button class="btn sm">${icon('plus', 14)} Add case</button></div></form></section>`;
  }
  function caseCard(c) {
    const [k] = stageOf(c), next = STAGES[STAGES.findIndex(([x]) => x === k) + 1];
    const tOutWarn = next && next[0] === 'incision' && !phaseDone(c, 'timeout'), sOutWarn = next && next[0] === 'out' && !phaseDone(c, 'signout'), sInWarn = next && next[0] === 'anes' && !phaseDone(c, 'signin');
    const step = (x, l) => `<li class="${c.times && c.times[x] ? 'done' : ''}"><span>${l}</span><b class="num">${c.times && c.times[x] ? tm(c.times[x]) : '—'}</b></li>`;
    return `<section class="card sg-case"><div class="card-h"><h2>${esc(c.caseId)} · ${esc(c.proc)}</h2><button class="btn ghost sm" data-act="sg-case" data-id="">Close</button></div>
      <div class="grid g-2"><div><h3 class="bc-h3">Stages</h3><ol class="sg-stages">${STAGES.map(([x, l]) => step(x, l)).join('')}</ol>
          ${next ? `<div class="st-go"><button class="btn" data-act="sg-or-next" data-id="${c.id}">Mark: ${esc(next[1])} now</button><button class="btn ghost sm" data-act="sg-or-undo" data-id="${c.id}">Undo last</button></div>` : '<p class="small">Case complete.</p>'}
          ${tOutWarn ? '<p class="banner warn small" role="status">Time out is not complete yet.</p>' : sInWarn ? '<p class="banner warn small" role="status">Sign in is not complete yet.</p>' : sOutWarn ? '<p class="banner warn small" role="status">Sign out is not complete yet.</p>' : ''}
          <h3 class="bc-h3">Counts</h3><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th scope="col">Item</th><th scope="col">Start</th><th scope="col">Added</th><th scope="col">Final</th><th scope="col">Status</th></tr></thead><tbody>
            ${COUNTS.map(([x, l]) => { const v = (c.counts || {})[x] || {}, ok = countOk(c, x); return `<tr><th scope="row">${l}</th>${['start', 'added', 'final'].map((f) => `<td><input class="sg-cnt" type="number" min="0" max="999" value="${v[f] ?? ''}" data-change="sg-or-count" data-id="${c.id}" data-k="${x}" data-f="${f}" aria-label="${l} ${f}"></td>`).join('')}<td>${ok == null ? pill('muted', 'Open') : ok ? pill('good', 'Correct') : pill('bad', 'Discrepancy')}</td></tr>`; }).join('')}</tbody></table></div>
          ${COUNTS.some(([x]) => countOk(c, x) === false) ? '<p class="banner bad small" role="alert">Count discrepancy: stop and follow your hospital\'s count policy before closing.</p>' : ''}</div>
        <div>${Object.entries(CHECK).map(([key, [name, when, items]]) => `<h3 class="bc-h3">${name} <span class="muted">· ${when}</span> ${phaseDone(c, key) ? pill('good', 'Complete') : ''}</h3><ul class="mm-checks sg-checks">${items.map((t, i) => `<li><label class="ped-use tested"><input type="checkbox" data-change="sg-or-check" data-id="${c.id}" data-k="${key}" data-i="${i}" ${c.check && c.check[key] && c.check[key][i] ? 'checked' : ''}> ${esc(t)}</label></li>`).join('')}</ul>`).join('')}
          <p class="fine">Checklist adapted from the WHO Surgical Safety Checklist (2009). Adapt it to your hospital's version.</p></div></div>
      <div class="grid g-2"><div><h3 class="bc-h3">Team</h3><form data-submit="sg-or-team" class="lb-grid sg-form" data-id="${c.id}">${[['surgeon', 'Surgeon'], ['anaes', 'Anaesthesia'], ['scrub', 'Scrub'], ['circ', 'Circulator']].map(([f, l]) => `<label>${l}<input name="${f}" maxlength="30" value="${esc((c.team || {})[f] || '')}"></label>`).join('')}<div class="lb-wide"><button class="btn sm">Save team</button></div></form></div>
        <div><h3 class="bc-h3">Event log</h3><form data-submit="sg-or-event" class="tw-ask" data-id="${c.id}"><label class="sr" for="sg-ev">Event</label><input id="sg-ev" name="t" maxlength="140" placeholder="e.g. Extra instrument tray opened"><button class="btn sm">Log</button></form>
          <ul class="small sg-events">${(c.events || []).slice().reverse().map((e) => `<li><b class="num">${tm(e.at)}</b> ${esc(e.t)}</li>`).join('') || '<li class="muted">Nothing logged.</li>'}</ul></div></div></section>`;
  }

  OS.register('surgery', {
    title: 'Surgery', icon: 'surgery',
    render(s) {
      const body = SG.tab === 'day' ? dayTab(s) : SG.tab === 'recover' ? recoverTab(s) : SG.tab === 'or' ? orTab(s) : meTab(s);
      return `${OS.ui.head('Surgery companion · OR workflow', 'Surgery', 'Prepare for your procedure, keep family updated on the day, and track recovery with clear red flags. Surgical teams get an operational board for rooms, checklists and counts.')}
        <div class="sg"><div class="seg kt-tabs" role="tablist" aria-label="Surgery">${TABS.map(([k, l]) => `<button role="tab" aria-selected="${SG.tab === k}" data-act="sg-tab" data-t="${k}">${l}</button>`).join('')}</div>${body}</div>`;
    },
    mount() { if (SG.tab !== 'or') return; const t = setInterval(() => { if (OS.current === 'surgery' && SG.tab === 'or' && !document.querySelector('.sg-case input:focus, .sg-form input:focus')) OS.render(); }, 60000); return () => clearInterval(t); }
  });

  const upd = (fn) => OS.update((s) => { fn(ensure(s), s); }, { keepSample: true });
  OS.act('sg-tab', (el) => { SG.tab = TABS.some(([k]) => k === el.dataset.t) ? el.dataset.t : 'me'; OS.render(); });
  OS.act('sg-plan', (f) => upd((P) => { P.name = f.elements.n.value.trim().slice(0, 80); P.date = f.elements.d.value || ''; P.where = f.elements.where.value.trim().slice(0, 80); P.call = f.elements.call.value.trim().slice(0, 40); P.anes = f.elements.anes.value; }));
  OS.change('sg-check', (el) => upd((P) => { P.checks[el.dataset.k] = el.checked; }));
  OS.change('sg-q', (el) => upd((P) => { P.qs[el.dataset.k] = el.checked; }));
  OS.act('sg-myq', (f) => { const q = f.elements.q.value.trim(); if (!q) return; upd((P) => { P.myqs = (P.myqs || []).concat([q.slice(0, 160)]); }); });
  OS.act('sg-myq-del', (el) => upd((P) => { P.myqs.splice(+el.dataset.i, 1); }));
  OS.act('sg-stage', (el) => { const k = el.dataset.k; upd((P) => { if (P.status[k]) delete P.status[k]; else P.status[k] = new Date().toISOString(); }); });
  OS.act('sg-stage-reset', () => { if (confirm('Clear all of today\'s status steps?')) upd((P) => { P.status = {}; }); });
  OS.act('sg-share', async () => {
    const t = statusText(ensure(OS.state));
    try { if (navigator.share) { await navigator.share({ text: t }); return; } } catch { /* cancelled */ return; }
    try { await navigator.clipboard.writeText(t); OS.toast('Update copied. Paste it into a message.'); } catch { OS.toast('Select the update text below and copy it.'); }
  });
  OS.act('sg-checkin', (f) => {
    const e = f.elements, num = (v) => (v === '' || v == null ? null : +v);
    const c = { d: dayKey(), at: new Date().toISOString(), pain: clamp(+e.pain.value || 0, 0, 10), temp: num(e.temp.value), tempU: e.tempU.value, wound: e.wound.value, breath: e.breath.value, chest: e.chest.checked, blood: e.blood.checked, calf: e.calf.checked, fluids: e.fluids.checked, urine: e.urine.checked, note: e.note.value.trim().slice(0, 140) };
    SG.red = redOf(c);
    upd((P) => { P.checkins = P.checkins.filter((x) => x.d !== c.d).concat([c]); P.pain = P.pain.filter((x) => x.d !== c.d).concat([{ d: c.d, v: c.pain, note: c.note }]); });
    OS.logEvent(SG.red ? 'symptom' : 'note', 'Surgery recovery check-in', `pain ${c.pain}/10${c.temp != null ? ` · ${c.temp}°${c.tempU}` : ''}${SG.red ? ` · red flag: ${SG.red.why.join(', ')}` : ''}`, { go: 'surgery' });
    if (!SG.red) OS.toast('Check-in saved');
  });
  // OR board
  const orUpd = (id, fn) => OS.update((s) => { const c = orEnsure(s).cases.find((x) => x.id === id); if (c) fn(c); }, { keepSample: true });
  OS.act('sg-case', (el) => { SG.sel = el.dataset.id || null; OS.render(); });
  OS.act('sg-or-sample', () => OS.update((s) => { const O = orEnsure(s); O.day = dayKey(); O.cases = O.cases.concat(sampleDay()); }, { keepSample: true }));
  OS.act('sg-or-clear-sample', () => OS.update((s) => { const O = orEnsure(s); O.cases = O.cases.filter((c) => !c.sample); }, { keepSample: true }));
  OS.act('sg-or-add', (f) => { const e = f.elements, id = uid(); OS.update((s) => { const O = orEnsure(s); O.day = dayKey(); O.cases.push({ id, caseId: e.caseId.value.trim().slice(0, 20), room: e.room.value.trim().slice(0, 12), proc: e.proc.value.trim().slice(0, 80), sched: e.sched.value, est: +e.est.value || null, times: { sched: new Date().toISOString() }, team: { surgeon: e.surgeon.value.trim().slice(0, 30) }, check: {}, counts: {}, events: [] }); }, { keepSample: true }); SG.sel = id; OS.render(); });
  OS.act('sg-or-next', (el) => orUpd(el.dataset.id, (c) => { const [k] = stageOf(c), nx = STAGES[STAGES.findIndex(([x]) => x === k) + 1]; if (!nx) return; c.times = c.times || {}; c.times[nx[0]] = new Date().toISOString(); c.events = (c.events || []).concat([{ at: c.times[nx[0]], t: nx[1] }]); }));
  OS.act('sg-or-undo', (el) => orUpd(el.dataset.id, (c) => { const [k] = stageOf(c); if (k !== 'sched' && c.times) { delete c.times[k]; c.events = (c.events || []).concat([{ at: new Date().toISOString(), t: `Undid ${STAGES.find(([x]) => x === k)[1]}` }]); } }));
  OS.change('sg-or-check', (el) => orUpd(el.dataset.id, (c) => { c.check = c.check || {}; c.check[el.dataset.k] = c.check[el.dataset.k] || []; c.check[el.dataset.k][+el.dataset.i] = el.checked; if (phaseDone(c, el.dataset.k)) c.events = (c.events || []).concat([{ at: new Date().toISOString(), t: `${CHECK[el.dataset.k][0]} complete` }]); }));
  OS.change('sg-or-count', (el) => orUpd(el.dataset.id, (c) => { c.counts = c.counts || {}; const x = (c.counts[el.dataset.k] = c.counts[el.dataset.k] || {}); x[el.dataset.f] = el.value === '' ? null : clamp(Math.round(+el.value), 0, 999); }));
  OS.act('sg-or-team', (f) => orUpd(f.dataset.id, (c) => { c.team = { surgeon: f.elements.surgeon.value.trim(), anaes: f.elements.anaes.value.trim(), scrub: f.elements.scrub.value.trim(), circ: f.elements.circ.value.trim() }; }));
  OS.act('sg-or-event', (f) => { const t = f.elements.t.value.trim(); if (t) orUpd(f.dataset.id, (c) => { c.events = (c.events || []).concat([{ at: new Date().toISOString(), t: t.slice(0, 140) }]); }); });
  OS.act('sg-or-csv', () => {
    const O = orEnsure(OS.state), head = ['case_id', 'room', 'procedure', 'scheduled', 'est_min', ...STAGES.slice(1).map(([k]) => k), 'in_room_min', 'sign_in', 'time_out', 'sign_out', 'counts_ok'];
    const rows = O.cases.map((c) => [c.caseId, c.room, c.proc, c.sched, c.est || '', ...STAGES.slice(1).map(([k]) => (c.times && c.times[k]) || ''), mins(c.times && c.times.inroom, c.times && c.times.out) ?? '', phaseDone(c, 'signin'), phaseDone(c, 'timeout'), phaseDone(c, 'signout'), COUNTS.every(([x]) => countOk(c, x) !== false)]);
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const blob = new Blob([[head.join(','), ...rows.map((r) => r.map(q).join(','))].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `or-board-${O.day}.csv`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });

  OS.surgery = { redOf, statusText, kpis, phaseDone, countOk, sampleDay, STAGES, CHECK, state: SG };
})();
