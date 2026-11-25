/* ═══ MYO — SHARED RECORD VIEWER (share.html) ═══
   Decodes a record from the link's #fragment (made by js/score.js) on this device and shows it read-only.
   The fragment never reaches a server. Every value is escaped before display. */
(function () {
  'use strict';
  const app = document.getElementById('app');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PARTS = ['Biology', 'Recovery', 'Training', 'Fuel', 'Life'];
  const ST = { g: ['p-g', 'Optimal or peak'], w: ['p-w', 'Below optimal'], b: ['p-b', 'Out of range'], m: ['p-m', 'No result'] };
  const fail = (msg) => { app.innerHTML = `<div class="card"><h1>This link can't be opened</h1><p class="muted">${esc(msg)}</p></div>`; };

  async function decode(frag) {
    if (!/^1[zj][A-Za-z0-9_-]+$/.test(frag)) throw new Error('The link is incomplete. Ask for the QR code again.');
    const b64 = frag.slice(2).replace(/-/g, '+').replace(/_/g, '/'), bin = atob(b64 + '==='.slice((b64.length + 3) % 4)), bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    let out = bytes;
    if (frag[1] === 'z') {
      if (!window.DecompressionStream) throw new Error('This browser is too old to open the record. Try an up-to-date browser.');
      out = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    }
    const o = JSON.parse(new TextDecoder().decode(out));
    if (!o || o.v !== 1 || !Array.isArray(o.s)) throw new Error('This is not a Myo record.');
    return o;
  }
  function ring(v) {
    const r = 64, c = 2 * Math.PI * r, off = c * (1 - (v == null ? 0 : Math.max(0, Math.min(100, v))) / 100);
    return `<svg viewBox="0 0 150 150" width="150" height="150" aria-hidden="true"><circle cx="75" cy="75" r="${r}" fill="none" stroke="var(--line)" stroke-width="12"/><circle cx="75" cy="75" r="${r}" fill="none" stroke="var(--accent)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 75 75)"/></svg>`;
  }
  function render(o) {
    const today = Math.floor(Date.now() / 864e5), expired = o.exp && today > o.exp;
    if (expired) return fail('This shared record has expired. Ask for a new QR code.');
    const day = (d) => (d ? new Date(d + 'T12:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
    const n = (v) => (v == null ? '—' : esc(v));
    app.innerHTML = `
      <div class="brand">Myo <span>built on Myokinetics OS</span></div>
      <div><h1>${o.n ? `${esc(o.n)}'s` : 'A'} Myo record</h1><p class="muted small">Shared on ${day(o.at)}${o.a ? ` · age ${n(o.a[0])}, ${o.a[1] === 'F' ? 'female' : 'male'}` : ''} · read-only</p></div>
      ${o.rf && o.rf.length ? `<section class="card alert" role="alert"><h2>Needs in-person care</h2><ul>${o.rf.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
      <section class="card top" aria-label="Scores"><div class="score">${ring(o.s[0])}<b>${n(o.s[0])}</b></div>
        <div class="parts"><div><span>Readiness</span><b>${n(o.s[1])}</b></div>${PARTS.map((p, i) => `<div><span>${p}</span><b>${n(o.p && o.p[i])}</b></div>`).join('')}</div></section>
      ${o.m ? `<section class="card"><h2>Lab results</h2><p class="muted small">Dated ${day(o.ld)}</p><div class="wrap"><table><thead><tr><th scope="col">Marker</th><th scope="col">Result</th><th scope="col">Optimal</th><th scope="col">Status</th></tr></thead><tbody>${o.m.map(([name, v, u, st, opt]) => `<tr><th scope="row">${esc(name)}</th><td class="num">${esc(v)} ${esc(u)}</td><td>${esc(opt)}</td><td><span class="pill ${(ST[st] || ST.m)[0]}">${(ST[st] || ST.m)[1]}</span></td></tr>`).join('')}</tbody></table></div></section>` : ''}
      ${o.vt ? `<section class="card"><h2>Vitals and sleep</h2><table><tbody><tr><th scope="row">Resting heart rate</th><td class="num">${n(o.vt[0])} bpm</td></tr><tr><th scope="row">HRV</th><td class="num">${n(o.vt[1])} ms</td></tr><tr><th scope="row">Sleep last night</th><td class="num">${n(o.vt[2])} h</td></tr><tr><th scope="row">Sleep score</th><td class="num">${n(o.vt[3])}</td></tr></tbody></table></section>` : ''}
      ${o.pr ? `<section class="card"><h2>Today's protocol</h2><ul>${o.pr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
      <footer>Shared by the member from Myo, a wellness app. This is not a medical record or a diagnosis. The record travels inside this link and was not stored on any server. It expires on ${o.exp ? day(new Date(o.exp * 864e5).toISOString().slice(0, 10)) : '—'}.</footer>`;
  }
  const frag = location.hash.slice(1);
  if (!frag) fail('There is no record in this link. Ask for the QR code again.');
  else decode(frag).then(render).catch((e) => fail((e && e.message && !/JSON|atob|decode/i.test(e.message)) ? e.message : 'The link is damaged or incomplete. Ask for the QR code again.'));
})();
