/* ═══ MYO — LOG BOOK: one timeline of everything that came into Myo, plus a symptom and note log ═══
   Timeline · built from the logs each page already keeps (labs, sensor sessions, training, Motion Lab, rehab,
              recovery, meals, sleep diary, check-ins, scans) and from OS.logEvent entries (imports, scan files,
              settings that change your numbers). Each entry shows where it came from: device, file, manual or sample.
   Symptoms · what, how bad (0–10), since when and a note. Emergency symptoms show what to do at once; anything rated
              8 or more suggests contacting a clinician. Myo never suggests a diagnosis from symptoms.
   Export   · the filtered timeline as CSV, made on this device.
   Symptoms and notes sync with your account when you're signed in and are part of "Download my data". */
(function () {
  'use strict';
  const { esc, icon, pill, dayKey, addDays, fmtDate } = OS;
  const LB = { cat: 'all', range: 30, form: false, sym: '', red: null };
  const CATS = [['all', 'All'], ['body', 'Body signals'], ['symptom', 'Symptoms'], ['labs', 'Labs'], ['training', 'Training'], ['food', 'Food'], ['sleep', 'Sleep'], ['mind', 'Mind'], ['scan', 'Scans'], ['note', 'Notes and system']];
  const SYMS = ['Headache', 'Dizziness or light-headedness', 'Palpitations', 'Chest pain or pressure', 'Shortness of breath', 'Fainting or near-fainting', 'Face drooping, arm weakness or speech trouble', 'Fatigue', 'Muscle or joint pain', 'Back pain', 'Nausea or stomach upset', 'Poor sleep', 'Low mood', 'Anxiety', 'Thoughts of harming yourself', 'Fever', 'Cough or cold', 'Other'];
  const RED = {
    'Chest pain or pressure': 'Chest pain or pressure can be a heart attack. Call your local emergency number (911 in the US) now, especially with sweating, nausea, breathlessness or pain spreading to the arm, jaw or back. Don\'t drive yourself.',
    'Shortness of breath': 'If you are struggling to breathe, can\'t speak in full sentences, or your lips look blue or grey, call your local emergency number now.',
    'Fainting or near-fainting': 'Fainting, especially during exercise or with chest pain or a racing heart, needs urgent assessment. Call your local emergency number if it happened with any of those, or you were injured.',
    'Face drooping, arm weakness or speech trouble': 'These are stroke signs. Call your local emergency number now and note the time they started. Every minute matters.',
    'Thoughts of harming yourself': 'You deserve support right now. Call or text 988 (US Suicide & Crisis Lifeline) or your local emergency number. If you are outside the US, findahelpline.com lists free lines.'
  };
  const CAT_ICON = { body: 'stream', symptom: 'alert', labs: 'biology', training: 'training', food: 'kitchen', sleep: 'sleep', mind: 'mind', scan: 'imaging', note: 'report' };
  const SRC_LABEL = { device: 'Device', file: 'File', manual: 'You', sample: 'Sample', app: 'Myo' };

  /* ── gather every entry from the logs other pages keep ── */
  function entries(s) {
    const E = [], smp = s.sample ? 'sample' : null;
    const add = (at, cat, title, detail, src, go) => { if (!at) return; const day = String(at).slice(0, 10); E.push({ at: String(at).length > 10 ? at : `${at}T12:00:00`, day, cat, title, detail: detail || '', src, go }); };
    // labs: one entry per result day
    const byDay = {};
    (s.markers || []).forEach((m) => (m.history || []).forEach(([d, v]) => { if (!d || !OS.plausible(m.id, v)) return; (byDay[d] = byDay[d] || []).push(`${m.name} ${v}`); }));
    Object.entries(byDay).forEach(([d, xs]) => add(d, 'labs', `${xs.length} lab result${xs.length > 1 ? 's' : ''}`, xs.slice(0, 6).join(' · ') + (xs.length > 6 ? ` · +${xs.length - 6} more` : ''), smp || 'file', 'biology'));
    ((s.sensors && s.sensors.log) || []).forEach((r) => add(r.at, 'body', `${OS.stream && OS.stream.SRC[r.src] ? OS.stream.SRC[r.src].name : 'Sensor'} session`, [r.hr ? `${r.hr} bpm` : '', r.hrv ? `HRV ${r.hrv} ms` : '', r.br ? `${r.br} breaths/min` : '', `quality ${r.q}`, `${r.dur} s`].filter(Boolean).join(' · '), 'device', 'stream'));
    if (OS.cycle && s.cycle) OS.cycle.model(s.cycle).periods.forEach((p) => add(p.start, 'body', 'Period started', `${p.len} day${p.len > 1 ? 's' : ''}`, 'manual', 'cycle'));
    ((s.flow && s.flow.log) || []).forEach((r) => add(r.at, 'body', `Doppler reading${r.site ? ` · ${r.site}` : ''}`, [r.psv != null ? `peak ${r.psv} cm/s` : '', r.ri != null ? `RI ${r.ri}` : '', r.hr ? `pulse ${r.hr}` : '', `${r.dur} s`].filter(Boolean).join(' · '), r.src === 'file' ? 'file' : 'device', 'flow'));
    ((s.bodycomp && s.bodycomp.scans) || []).forEach((x) => add(x.d, 'scan', x.kind === 'dexa' ? 'DEXA scan' : 'Smart scale reading', [x.w != null ? `${x.w} kg` : '', x.bf != null ? `body fat ${x.bf}%` : '', x.t != null ? `T-score ${x.t}` : '', x.dev || ''].filter(Boolean).join(' · '), x.sample ? 'sample' : x.src === 'manual' ? 'manual' : x.src === 'ble' ? 'device' : 'file', 'bodycomp'));
    ((s.neuro && s.neuro.log) || []).forEach((r) => add(r.at, 'mind', 'BCI lab session', [`${Math.max(1, Math.round(r.dur / 60))} min`, r.rel ? `alpha ${Math.round(r.rel.alpha * 100)}%` : '', r.q != null ? `${r.q}% clean channels` : '', r.test ? `decoder ${r.test.acc}%` : ''].filter(Boolean).join(' · '), r.src === 'file' ? 'file' : 'device', 'bci'));
    ((s.training && s.training.log) || []).forEach((r) => add(r.date, 'training', r.name || 'Training session', r.volume ? `${r.volume.toLocaleString()} kg volume${r.sets ? ` · ${r.sets} sets` : ''}` : '', smp || 'manual', 'training'));
    ((s.motion && s.motion.log) || []).forEach((r) => add(r.d, 'training', 'Motion Lab', r.text, r.src === 'demo' ? 'sample' : 'device', 'motion'));
    ((s.pt && s.pt.logs) || []).forEach((r) => add(r.d, 'training', `Rehab check-in · ${r.region}`, `pain ${r.pain}/10 · function ${r.func}/10${r.done ? ' · exercises done' : ''}`, 'manual', 'pt'));
    ((s.recovery && s.recovery.logs) || []).forEach((r) => add(r.d, 'training', `Recovery · ${r.k}`, `${r.min} min${r.temp != null ? ` at ${r.temp}°` : ''}${r.note ? ` · ${r.note}` : ''}`, 'manual', 'recovery'));
    Object.entries((s.nutrition && s.nutrition.meals) || {}).forEach(([d, ms]) => { if (!ms || !ms.length) return; const kc = ms.reduce((a, m) => a + (+m.kcal || 0), 0), p = ms.reduce((a, m) => a + (+m.p || 0), 0); add(d, 'food', `${ms.length} meal${ms.length > 1 ? 's' : ''} logged`, `${Math.round(kc).toLocaleString()} kcal · ${Math.round(p)} g protein`, smp || 'manual', 'fuel'); });
    ((s.sleep && s.sleep.diary) || []).forEach((r) => add(r.d, 'sleep', 'Sleep diary', [r.tst ? `${(r.tst / 60).toFixed(1)} h asleep` : '', r.q ? `quality ${r.q}/5` : ''].filter(Boolean).join(' · '), 'manual', 'sleep'));
    Object.entries((s.life && s.life.mood) || {}).forEach(([d, m]) => { if (!m) return; const xs = [['mood', 'mood'], ['energy', 'energy'], ['stress', 'stress']].filter(([k]) => m[k]).map(([k, l]) => `${l} ${m[k]}/5`); if (xs.length) add(d, 'mind', 'Check-in', xs.join(' · '), 'manual', 'mind'); });
    if (s.imaging && s.imaging.savedAt) add(s.imaging.savedAt, 'scan', `Body composition from ${s.imaging.modality}`, `muscle ${s.imaging.muscleCm2} cm² · fat ${s.imaging.fatCm2} cm² · index ${s.imaging.muscleIndex}`, s.imaging.demo ? 'sample' : 'file', 'imaging');
    (s.symptoms || []).forEach((r) => add(r.at, 'symptom', r.sym, [`${r.sev}/10`, r.since ? `since ${r.since}` : '', r.note].filter(Boolean).join(' · '), 'manual', 'logbook'));
    (s.events || []).forEach((r) => add(r.at, r.cat || 'note', r.title || r.text, r.title ? r.text : r.detail || '', r.src || 'app', r.go));
    return E.sort((a, b) => b.at.localeCompare(a.at));
  }
  const inRange = (e) => LB.range === 0 || e.day >= dayKey(addDays(new Date(), -LB.range + 1));

  function symptomForm() {
    const red = LB.red && RED[LB.red];
    return `<section class="card lb-form"><div class="card-h"><h2>Log a symptom</h2><button class="btn ghost sm" data-act="lb-form" data-v="0">Close</button></div>
      <form data-submit="lb-sym" class="lb-grid">
        <label>What<select name="sym" data-change="lb-sym-pick" required><option value="">Choose…</option>${SYMS.map((x) => `<option ${LB.sym === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
        ${LB.sym === 'Other' ? '<label>Describe it<input name="other" maxlength="60" required></label>' : ''}
        <label>How bad, 0 to 10 <output id="lb-sev-v">3</output><input name="sev" type="range" min="0" max="10" value="3" data-change="lb-sev"></label>
        <label>Since<select name="since"><option>just now</option><option>today</option><option>yesterday</option><option>2–3 days</option><option>a week or more</option></select></label>
        <label class="lb-wide">Note (optional)<input name="note" maxlength="200" placeholder="What were you doing? Anything that helped?"></label>
        <div class="lb-wide"><button class="btn sm">${icon('plus', 14)} Save to log book</button></div>
      </form>
      ${red ? `<div class="banner bad" role="alert"><b>${esc(LB.red)}.</b> ${esc(red)} <a href="#emergency">Open Emergency</a></div>` : ''}
      <p class="fine">For tracking, not diagnosis. Myo won't suggest what a symptom means; it helps you spot patterns and bring a clear record to your clinician.</p></section>`;
  }
  function noteForm() {
    return `<form class="lb-note" data-submit="lb-note"><label class="sr" for="lb-note-t">Add a note</label><input id="lb-note-t" name="t" maxlength="240" placeholder="Add a note to today: a new supplement, a hard week, a change in routine…"><button class="btn ghost sm">${icon('plus', 14)} Add note</button></form>`;
  }

  OS.register('logbook', {
    title: 'Log book', icon: 'logbook',
    render(s) {
      const all = entries(s), list = all.filter((e) => (LB.cat === 'all' || e.cat === LB.cat) && inRange(e)), week = all.filter((e) => e.day >= dayKey(addDays(new Date(), -6)));
      const cnt = (c) => week.filter((e) => e.cat === c).length, days = [...new Set(list.map((e) => e.day))].slice(0, 120);
      const lastSym = (s.symptoms || []).slice(-1)[0];
      return `${OS.ui.head('Timeline · every input in one place', 'Log book', 'Everything that has come into Myo, from labs and sensor sessions to meals, sleep and check-ins, with where each one came from. Log symptoms and notes here too.')}
      <div class="lb-tiles"><div><span>This week</span><b class="num">${week.length}</b><em>entries</em></div><div><span>Symptoms this week</span><b class="num">${cnt('symptom')}</b><em>${lastSym ? `last: ${esc(lastSym.sym)}` : 'none logged'}</em></div><div><span>Body signal sessions</span><b class="num">${cnt('body')}</b><em>this week</em></div><div><span>Training entries</span><b class="num">${cnt('training')}</b><em>this week</em></div></div>
      <div class="lb-bar"><button class="btn sm" data-act="lb-form" data-v="1">${icon('alert', 14)} Log a symptom</button>${noteForm()}</div>
      ${LB.form ? symptomForm() : ''}
      <section class="card"><div class="card-h"><h2>Timeline</h2><div class="lb-ctl">
          <div class="seg" role="group" aria-label="Range">${[[7, '7 days'], [30, '30 days'], [90, '90 days'], [0, 'All']].map(([v, l]) => `<button aria-pressed="${LB.range === v}" data-act="lb-range" data-v="${v}">${l}</button>`).join('')}</div>
          <button class="btn ghost sm" data-act="lb-csv">${icon('download', 14)} Export CSV</button></div></div>
        <div class="lb-cats" role="group" aria-label="Show">${CATS.map(([k, l]) => `<button class="chip-btn ${LB.cat === k ? 'on' : ''}" aria-pressed="${LB.cat === k}" data-act="lb-cat" data-v="${k}">${l}</button>`).join('')}</div>
        ${list.length ? days.map((d) => `<div class="lb-day"><h3>${d === dayKey() ? 'Today' : d === dayKey(addDays(new Date(), -1)) ? 'Yesterday' : esc(new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: d.slice(0, 4) === dayKey().slice(0, 4) ? undefined : 'numeric' }))}</h3>
          <ul>${list.filter((e) => e.day === d).map((e) => `<li class="lb-e lb-${e.cat}"><span class="lb-i" aria-hidden="true">${icon(CAT_ICON[e.cat] || 'report', 16)}</span>
            <div><b>${esc(e.title)}</b>${e.detail ? `<span class="small">${esc(e.detail)}</span>` : ''}</div>
            <span class="lb-meta">${e.at.length > 11 && !/T12:00:00/.test(e.at) ? `<time class="small muted">${esc(new Date(e.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }))}</time>` : ''}${pill(e.src === 'sample' ? 'warn' : 'muted', SRC_LABEL[e.src] || e.src)}${e.go && e.go !== 'logbook' ? `<a class="small" href="#${e.go}">Open</a>` : ''}${e.cat === 'symptom' || (e.cat === 'note' && e.src === 'manual') ? `<button class="lb-del" data-act="lb-del" data-at="${esc(e.at)}" aria-label="Delete this entry">${icon('x', 14)}</button>` : ''}</span></li>`).join('')}</ul></div>`).join('')
          : `<p class="muted">Nothing here for this filter. ${LB.range ? 'Try a longer range, or ' : ''}log a symptom or a note above.</p>`}
        ${s.sample ? '<p class="fine">Entries marked Sample come from the demo member. They go away when you start with your own data.</p>' : ''}</section>
      <p class="fine">Symptoms and notes are saved with the rest of your record: on this device, and in your account if you're signed in. They are included in Download my data and removed by Delete my data. Mind self-check answers stay on this device only and are not shown here.</p>`;
    }
  });

  OS.act('lb-form', (el) => { LB.form = el.dataset.v === '1'; LB.red = null; LB.sym = ''; OS.render(); });
  OS.change('lb-sym-pick', (el) => { LB.sym = el.value; LB.red = RED[el.value] ? el.value : null; OS.render(); const sel = document.querySelector('.lb-form select[name="sym"]'); if (sel) sel.focus(); });
  OS.change('lb-sev', (el) => { const o = document.getElementById('lb-sev-v'); if (o) o.textContent = el.value; });
  document.addEventListener('input', (e) => { if (e.target && e.target.name === 'sev' && e.target.closest('.lb-form')) { const o = document.getElementById('lb-sev-v'); if (o) o.textContent = e.target.value; } });
  OS.act('lb-sym', (f) => {
    const d = new FormData(f), sym = d.get('sym') === 'Other' ? String(d.get('other') || '').trim().slice(0, 60) || 'Other' : String(d.get('sym') || ''); if (!sym) return;
    const sev = Math.max(0, Math.min(10, +d.get('sev') || 0)), rec = { at: new Date().toISOString(), sym, sev, since: String(d.get('since') || ''), note: String(d.get('note') || '').trim().slice(0, 200) };
    LB.red = RED[sym] ? sym : null; LB.form = !!LB.red; LB.sym = LB.red ? sym : '';
    OS.update((s) => { s.symptoms = (s.symptoms || []).concat([rec]).slice(-1000); }, { keepSample: true });
    OS.toast(LB.red ? 'Saved. Please read what to do now.' : sev >= 8 ? 'Saved. At 8 or more, please contact a clinician today.' : 'Saved to your log book');
  });
  OS.act('lb-note', (f) => {
    const t = String(new FormData(f).get('t') || '').trim().slice(0, 240); if (!t) return;
    OS.update((s) => { s.events = (s.events || []).concat([{ at: new Date().toISOString(), cat: 'note', title: 'Note', text: t, src: 'manual' }]).slice(-1500); }, { keepSample: true });
    OS.toast('Note added');
  });
  OS.act('lb-del', (el) => {
    const at = el.dataset.at; if (!confirm('Delete this entry? This cannot be undone.')) return;
    OS.update((s) => { s.symptoms = (s.symptoms || []).filter((r) => r.at !== at); s.events = (s.events || []).filter((r) => !(r.at === at && r.src === 'manual')); }, { keepSample: true });
  });
  OS.act('lb-cat', (el) => { LB.cat = el.dataset.v; OS.render(); });
  OS.act('lb-range', (el) => { LB.range = +el.dataset.v; OS.render(); });
  OS.act('lb-csv', () => {
    const all = entries(OS.state).filter((e) => (LB.cat === 'all' || e.cat === LB.cat) && inRange(e));
    const q = (x) => `"${String(x == null ? '' : x).replace(/"/g, '""')}"`;
    const csv = ['date,time,category,title,detail,source'].concat(all.map((e) => [e.day, /T12:00:00/.test(e.at) ? '' : e.at.slice(11, 16), e.cat, e.title, e.detail, SRC_LABEL[e.src] || e.src].map(q).join(','))).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), a = document.createElement('a');
    a.href = url; a.download = `myo-log-book-${dayKey()}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    OS.toast(`Exported ${all.length} entries`);
  });

  OS.logbook = { entries, latestSymptom: (s) => (s.symptoms || []).slice(-1)[0] || null };
})();
