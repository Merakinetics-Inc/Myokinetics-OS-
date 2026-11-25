/* ═══ MYO — REPORT: a one-page summary to keep, print or share with a clinician ═══
   Built from the member's own data on this device. It lists results and Myo's plan; it is not a diagnosis.
   The print stylesheet in index.html hides the app chrome so this page prints on its own. */
(function () {
  'use strict';
  const { esc, dayKey, protocol, targets, dash } = OS;
  const PARTS = [['biology', 'Biology'], ['recovery', 'Recovery'], ['training', 'Training'], ['nutrition', 'Fuel'], ['life', 'Life']];

  function render(s, sc) {
    const p = s.profile, k = dayKey(), fmtR = OS.ui.fmtR;
    const who = p.name || (OS.auth && OS.auth.user && OS.auth.user.email) || (s.sample ? 'Sample member' : 'Member');
    const labs = sc.markers.filter((x) => x.e.score != null);
    const items = protocol(s, sc), done = s.protocolDone[k] || {};
    const vt = s.vitals || {}, tg = targets(p);
    const since = OS.dayKey(OS.addDays(new Date(), -28)), sessions = (s.training.log || []).filter((l) => l.date >= since).length;
    const generated = new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const row = ({ m, e }) => `<tr class="st-${e.status}"><th scope="row">${esc(m.name)}</th><td class="num">${esc(m.value)}</td><td>${esc(m.unit)}</td><td>${esc(fmtR(m.optimal))}</td><td>${esc(fmtR(OS.peakOf(m)))}</td><td>${OS.pill(e.status, e.label)}</td></tr>`;
    return `${OS.ui.head('Report', 'Your Myo summary', 'One page to keep, print or share with a clinician. It lists your data and Myo’s plan, and it is not a diagnosis.', '<button class="btn" data-act="report-print">Print or save as PDF</button>')}
      ${OS.sampleBanner ? OS.sampleBanner(s) : ''}
      <article class="card report" aria-label="Myo summary">
        <header class="rp-h"><div class="rp-brand"><b>Myo</b><span>built on Myokinetics OS</span></div>
          <dl class="rp-who"><dt>Member</dt><dd>${esc(who)}</dd><dt>Age · sex</dt><dd>${esc(p.age)} · ${p.sex === 'F' ? 'Female' : 'Male'}</dd><dt>Generated</dt><dd>${esc(generated)}</dd><dt>Labs dated</dt><dd>${s.labsDate ? esc(OS.fmtDate(s.labsDate)) : '—'}</dd></dl></header>
        ${sc.redFlags.length ? `<section class="rp-flags" role="alert"><h2>Needs in-person care</h2><ul>${sc.redFlags.map((f) => `<li><b>${esc(f.name)} ${esc(f.value)} ${esc(f.unit)}</b>: ${esc(f.why)}.</li>`).join('')}</ul></section>` : ''}
        <section class="rp-scores" aria-label="Scores">
          <div><span>Myo Score</span><b class="num">${dash(sc.mk)}</b></div><div><span>Readiness</span><b class="num">${dash(sc.readiness)}</b></div>
          ${PARTS.map(([key, l]) => `<div><span>${l}</span><b class="num">${dash(sc.parts[key] == null ? null : Math.round(sc.parts[key]))}</b></div>`).join('')}
        </section>
        <section><h2>Lab results</h2>${labs.length ? `<div class="tbl-wrap"><table class="rp-tbl"><thead><tr><th scope="col">Marker</th><th scope="col">Result</th><th scope="col">Unit</th><th scope="col">Optimal</th><th scope="col">Peak</th><th scope="col">Status</th></tr></thead><tbody>${labs.map(row).join('')}</tbody></table></div>` : '<p class="muted">No lab results yet.</p>'}</section>
        <div class="rp-2">
          <section><h2>Vitals and sleep</h2><dl class="dl"><dt>Resting heart rate</dt><dd>${dash(vt.rhr)} bpm</dd><dt>HRV</dt><dd>${dash(vt.hrv)} ms</dd><dt>Sleep last night</dt><dd>${dash(vt.sleepH)} h</dd><dt>Sleep score</dt><dd>${dash(vt.sleepScore)}</dd><dt>Source</dt><dd>${esc(vt.src || (vt.rhr == null ? 'None connected' : s.sample ? 'Sample data' : 'Entered'))}</dd></dl></section>
          <section><h2>Training and fuel</h2><dl class="dl"><dt>Program</dt><dd>${esc(s.training.program.name)}</dd><dt>Sessions, last 28 days</dt><dd>${sessions}</dd><dt>Daily energy target</dt><dd>${tg.kcal} kcal</dd><dt>Protein target</dt><dd>${tg.p} g</dd><dt>Water target</dt><dd>${tg.water} ml</dd></dl></section>
        </div>
        <section><h2>Today’s protocol</h2><ul class="rp-list">${items.map((i) => `<li><span class="rp-chk" aria-label="${done[i.id] ? 'Done' : 'Not done'}">${done[i.id] ? '✓' : ''}</span><b>${esc(i.title)}</b><span class="muted small"> · ${esc(i.time)}</span></li>`).join('')}</ul></section>
        <p class="fine rp-terms">${esc(OS.TERMS)}</p>
      </article>`;
  }
  OS.act('report-print', () => window.print());
  OS.register('report', { title: 'Report', icon: 'report', render });
})();
