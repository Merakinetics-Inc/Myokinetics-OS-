/* ═══ MYO — MYO SCORE: the score system explained, its history, and record sharing by QR code ═══
   The Myo Score is the weighted average of five systems (core.js scores()): Biology 30%, Recovery 20%, Training 20%,
   Fuel 15%, Life 15%, over the parts that have data. A snapshot is kept once a day for the trend.
   Sharing: the member picks what to include; the record is compressed into the link's #fragment, which browsers never
   send to a server, and drawn as a QR code (qrcode-generator 1.4.4, MIT, from cdnjs). share.html decodes it on the
   reader's device. Anyone with the link or code can read it until it expires; nothing is stored anywhere. */
(function () {
  'use strict';
  const { esc, icon, ring, dayKey, pill, dash } = OS;
  const QR_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
  const PUBLIC_VIEWER = 'https://merakinetics-inc.github.io/Myokinetics-OS-/share.html';
  const PARTS = [
    ['biology', 'Biology', 0.3, '#38bdf8', 'biology', ['Lab markers scored against optimal and peak ranges, weighted by importance', 'Moves with every retest; your protocol targets the lowest markers']],
    ['recovery', 'Recovery', 0.2, '#a78bfa', 'recovery', ['Readiness from HRV and resting heart rate against your baseline, plus sleep', 'Moves daily with sleep, stress and training load']],
    ['training', 'Training', 0.2, '#fb8a4a', 'training', ['Sessions in the last 7 days against your plan, and today\'s completed sets', 'Moves when you train as planned']],
    ['nutrition', 'Fuel', 0.15, '#a3d65c', 'fuel', ['Protein and calories over the last three days against your targets', 'Moves when you log meals and hit protein']],
    ['life', 'Life', 0.15, '#6b97ff', 'life', ['Habits kept over 7 days and mood against stress', 'Moves with your daily habits and check-ins']]
  ];
  const TIER = (v) => (v == null ? ['muted', 'Not scored yet'] : v >= 90 ? ['good', 'Peak'] : v >= 80 ? ['good', 'Optimal'] : v >= 60 ? ['warn', 'Strong'] : ['bad', 'Building']);
  const SH = { open: false, inc: { labs: true, vitals: true, protocol: false, name: false }, days: 7, url: '', qr: null, err: '' };

  // one snapshot a day, written quietly (it doesn't mark the sample member as edited)
  function snapshot(s, sc) {
    const k = dayKey(); s.scoreLog = s.scoreLog || [];
    const last = s.scoreLog[s.scoreLog.length - 1];
    if (sc.mk == null || (last && last[0] === k)) return;
    s.scoreLog.push([k, sc.mk, ...PARTS.map(([p]) => (sc.parts[p] == null ? null : Math.round(sc.parts[p])))]);
    s.scoreLog = s.scoreLog.slice(-400); OS.Persist.save(s);
  }
  OS.on('route', () => { try { snapshot(OS.state, OS.scores(OS.state)); } catch { /* never block a page */ } });

  function trend(log) {
    if (log.length < 2) return '<p class="muted small">Your trend builds one point a day. Come back tomorrow.</p>';
    const W = 640, H = 160, xs = log.map((r, i) => 40 + i * (W - 60) / (log.length - 1)), ys = log.map((r) => 20 + (100 - r[1]) / 100 * (H - 50));
    const path = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join('');
    return `<svg class="sc-trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="Myo Score over ${log.length} days, from ${log[0][1]} to ${log.at(-1)[1]}">
      ${[60, 80, 90].map((v) => { const y = 20 + (100 - v) / 100 * (H - 50); return `<line x1="40" x2="${W - 20}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-dasharray="3 4"/><text x="34" y="${y + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${v}</text>`; }).join('')}
      <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linejoin="round"/>
      ${log.map((r, i) => `<circle cx="${xs[i].toFixed(1)}" cy="${ys[i].toFixed(1)}" r="3" fill="var(--accent)"><title>${OS.fmtDate(r[0])}: ${r[1]}</title></circle>`).join('')}
      <text x="40" y="${H - 8}" font-size="11" fill="var(--muted)">${OS.fmtDate(log[0][0])}</text><text x="${W - 20}" y="${H - 8}" text-anchor="end" font-size="11" fill="var(--muted)">${OS.fmtDate(log.at(-1)[0])}</text></svg>`;
  }

  /* ── sharing ── */
  async function encode(obj) {
    const json = JSON.stringify(obj), bytes = new TextEncoder().encode(json);
    let out = bytes, tag = 'j';
    if (window.CompressionStream) { try { out = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()); tag = 'z'; } catch { out = bytes; } }
    let bin = ''; out.forEach((b) => { bin += String.fromCharCode(b); });
    return '1' + tag + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function record(s, sc) {
    const o = { v: 1, at: dayKey(), exp: Math.floor(Date.now() / 864e5) + SH.days, s: [sc.mk, sc.readiness], p: PARTS.map(([p]) => (sc.parts[p] == null ? null : Math.round(sc.parts[p]))) };
    if (SH.inc.name && s.profile.name) o.n = s.profile.name.slice(0, 40);
    o.a = [s.profile.age, s.profile.sex];
    if (SH.inc.labs) { o.ld = s.labsDate || null; o.m = sc.markers.filter((x) => x.e.score != null).map(({ m, e }) => [m.name, +m.value, m.unit, e.status[0], OS.ui.fmtR(m.optimal)]); }
    if (SH.inc.vitals) { const vt = s.vitals || {}; o.vt = [vt.rhr ?? null, vt.hrv ?? null, vt.sleepH ?? null, vt.sleepScore ?? null]; }
    if (SH.inc.protocol) o.pr = OS.protocol(s, sc).slice(0, 12).map((i) => i.title.slice(0, 70));
    if (sc.redFlags.length) o.rf = sc.redFlags.map((f) => `${f.name} ${f.value} ${f.unit}`);
    return o;
  }
  const loadQR = () => (window.qrcode ? Promise.resolve(window.qrcode) : new Promise((res, rej) => { const el = document.createElement('script'); el.src = QR_LIB; el.onload = () => (window.qrcode ? res(window.qrcode) : rej(new Error('QR library missing'))); el.onerror = () => rej(new Error("The QR library couldn't load. Check your connection.")); document.head.appendChild(el); }));
  function drawQR(cv, qr, scale) {
    const n = qr.getModuleCount(), m = 4, px = (n + 2 * m) * scale; cv.width = px; cv.height = px;
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, px, px); g.fillStyle = '#030b26';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) g.fillRect((c + m) * scale, (r + m) * scale, scale, scale);
  }
  async function makeShare() {
    SH.err = ''; SH.url = ''; SH.qr = null; OS.render();
    try {
      const s = OS.state, sc = OS.scores(s);
      if (sc.mk == null) throw new Error('There is no Myo Score to share yet. Add labs, a wearable or a training session first.');
      const frag = await encode(record(s, sc));
      const base = location.protocol === 'https:' && !(window.claude && window.claude.use) ? new URL('share.html', location.href).href : PUBLIC_VIEWER;
      SH.url = `${base}#${frag}`;
      const qrcode = await loadQR(), qr = qrcode(0, 'L');
      qr.addData(SH.url, 'Byte'); qr.make(); SH.qr = qr;
    } catch (e) { SH.err = /overflow/i.test(String(e && e.message || e)) ? 'That is too much for one QR code. Leave out the protocol or the labs and try again.' : (e && e.message) || "The QR code couldn't be made."; }
    OS.render();
  }

  OS.register('score', {
    title: 'Myo Score', icon: 'score',
    render(s, sc) {
      const [st, tl] = TIER(sc.mk), log = s.scoreLog || [];
      const share = SH.open ? `<section class="card sc-share" id="sc-share" aria-label="Share your record"><div class="card-h"><h2>Share your record</h2><button class="btn ghost sm" data-act="sc-share-x">Close</button></div>
          <fieldset class="sc-inc"><legend class="small">Include</legend>
            <label><input type="checkbox" checked disabled> Myo Score, readiness and the five systems</label>
            ${[['labs', 'Lab results with ranges'], ['vitals', 'Resting heart rate, HRV and sleep'], ['protocol', 'Today\'s protocol'], ['name', 'My name']].map(([k, l]) => `<label><input type="checkbox" data-change="sc-inc" data-k="${k}" ${SH.inc[k] ? 'checked' : ''}> ${l}</label>`).join('')}</fieldset>
          <label class="field sc-exp" for="sc-days"><span>Link works for</span><select id="sc-days" data-change="sc-days">${[[1, '1 day'], [7, '7 days'], [30, '30 days']].map(([v, l]) => `<option value="${v}" ${SH.days === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <div class="row"><button class="btn" data-act="sc-make">${icon('link', 16)} Create QR code</button></div>
          ${SH.err ? `<p class="acct-err" role="alert">${esc(SH.err)}</p>` : ''}
          ${SH.qr ? `<div class="sc-qr"><canvas id="sc-qr-cv" role="img" aria-label="QR code that opens your shared Myo record"></canvas>
            <div class="sc-qr-side"><p class="small">Scan with a phone camera to open a read-only page with what you chose. It expires in ${SH.days === 1 ? '1 day' : SH.days + ' days'}.</p>
              <div class="row"><button class="btn sm" data-act="sc-copy">Copy link</button><button class="btn ghost sm" data-act="sc-png">${icon('download', 14)} Save QR image</button></div>
              <p class="fine">The record travels inside the link itself; Merakinetics stores nothing. Anyone who has the link or the code can read it until it expires, so share it only with people you trust, such as your clinician or coach.</p></div></div>` : ''}
        </section>` : '';
      return `${OS.ui.head('Score system', 'Myo Score', 'One number for your whole system: five parts, weighted, each built from your own data.', `<button class="btn" data-act="sc-share">${icon('link', 16)} Share with a QR code</button>`)}
        ${OS.sampleBanner ? OS.sampleBanner(s) : ''}
        ${share}
        <div class="grid sc-top">
          <section class="card sc-hero"><div class="sc-ring">${ring(sc.mk, 190, 14, 'Myo Score')}<div class="sc-num"><b class="num">${dash(sc.mk)}</b><span>${pill(st, tl)}</span></div></div>
            <dl class="dl"><dt>Readiness today</dt><dd class="num">${dash(sc.readiness)}</dd><dt>Systems with data</dt><dd class="num">${PARTS.filter(([p]) => sc.parts[p] != null).length} of 5</dd><dt>Markers at peak</dt><dd class="num">${sc.peak}</dd></dl>
            <p class="fine">Tiers: Peak 90+, Optimal 80–89, Strong 60–79, Building under 60. Parts without data are left out of the average, never guessed.</p></section>
          <section class="card"><div class="card-h"><h2>Trend</h2><span class="muted small">${log.length} day${log.length === 1 ? '' : 's'} recorded</span></div>${trend(log)}</section>
        </div>
        <div class="sc-parts">${PARTS.map(([p, l, w, c, route, why]) => { const v = sc.parts[p], [ps, pl] = TIER(v == null ? null : Math.round(v)); return `<a class="card sc-part" href="#${route}"><span class="sc-pbar" style="--c:${c};--v:${v == null ? 0 : Math.round(v)}%"></span><div class="sc-ph"><b>${l}</b><span class="muted small">${Math.round(w * 100)}% of the score</span></div><b class="num sc-pv">${dash(v == null ? null : Math.round(v))}</b>${pill(ps, pl)}<ul class="small muted">${why.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></a>`; }).join('')}</div>`;
    },
    mount(root) {
      const cv = root.querySelector('#sc-qr-cv'); if (cv && SH.qr) drawQR(cv, SH.qr, 5);
      if (SH.open && OS._scScroll) { const el = root.querySelector('#sc-share'); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); OS._scScroll = false; }
    }
  });
  OS.act('sc-share', () => { SH.open = true; SH.qr = null; SH.url = ''; OS._scScroll = true; OS.render(); });
  OS.act('sc-share-x', () => { SH.open = false; SH.qr = null; SH.url = ''; OS.render(); });
  OS.change('sc-inc', (el) => { SH.inc[el.dataset.k] = el.checked; SH.qr = null; SH.url = ''; OS.render(); });
  OS.change('sc-days', (el) => { SH.days = +el.value || 7; SH.qr = null; SH.url = ''; OS.render(); });
  OS.act('sc-make', () => makeShare());
  OS.act('sc-copy', async () => { try { await navigator.clipboard.writeText(SH.url); OS.toast('Link copied'); } catch { OS.toast("Couldn't copy here. Use the QR code instead."); } });
  OS.act('sc-png', () => {
    if (!SH.qr) return; const cv = document.createElement('canvas'); drawQR(cv, SH.qr, 10);
    cv.toBlob(async (b) => {
      const name = `myo-record-${dayKey()}.png`, dl = OS.caps && OS.caps.downloads;
      if (dl) { try { await dl.save({ filename: name, data: b }); return; } catch { /* declined or unsupported: fall back to a plain download */ } }
      const url = URL.createObjectURL(b), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    }, 'image/png');
  });
  OS.score = { PARTS, TIER, encode, record };
})();
