/* ═══ MYO — MYO CHIP: design and architecture for an implantable Myo sensor, from body to app to server ═══
   Architecture · body signals → chip (front end, microcontroller, secure element, radio, power) → relay (phone or
                  Myo band) → Myo app → Myo cloud, with what crosses each link
   Hardware     · block choices and a live power budget (average current → days per charge)
   Protocol     · the frame format, and a working end-to-end simulator in this browser's Web Crypto: NFC-tap pairing
                  by ECDH P-256, AES-GCM frames with the header as associated data, replay and tamper rejection,
                  firmware manifests signed with ECDSA P-256 and checked before install
   Server       · the device API and data model planned on Myo's Supabase project
   Safety       · threat model, fail-safe states, standards and the regulatory path
   A concept for engineers and partners. It is not a medical device, isn't available, and must not be implanted. Human
   use could only ever happen inside an approved clinical investigation; Myo gives no surgical or self-implant guidance. */
(function () {
  'use strict';
  const { esc, icon, pill, clamp } = OS;
  const TABS = [['arch', 'Architecture'], ['hw', 'Hardware and power'], ['neuro', 'Neuromorphic sensing'], ['proto', 'Protocol simulator'], ['server', 'Server'], ['safety', 'Safety and regulation']];
  const CH = { tab: 'arch', sim: null, pw: { cap: 20, usable: 80, sync: 15, kb: 30, neuro: false }, nm: { delta: 0.05, keep: true, flat: false } };

  /* ── power budget: [block, average µA, note] ── */
  function budget(pw) {
    const air = pw.kb / 50 + 0.4, ble = (5000 * air) / (pw.sync * 60);   // 5 mA while the radio is on, ~50 kB/s effective
    const rows = [...(pw.neuro ? [['ECG front end, event-driven', 3, 'Level-crossing: samples only on change'], ['Event processor', 2, 'Small spiking network: beats and motion'], ['Microcontroller, wakes on events', 6, 'Summaries and sync only']] : [['ECG front end, continuous', 15, '250 samples/s, one lead'], ['Microcontroller, duty-cycled', 20, 'Beat detection, HRV, summaries']]), ['Accelerometer', 3, 'Low-power mode, 12.5 Hz'],
      ['Flash logging', 2, '14 days of summaries'], ['Bio-impedance, hourly burst', 1, 'Fluid and tissue trend'], ['Temperature, every minute', 0.5, 'Thermistor'], ['Bluetooth sync', ble, `${pw.kb} kB every ${pw.sync} min`], ['Sleep and leakage', 1, 'Regulators, real-time clock']];
    const tot = rows.reduce((a, r) => a + r[1], 0), days = (pw.cap * 1000 * (pw.usable / 100)) / tot / 24;
    return { rows, tot, days };
  }

  /* ── crypto helpers ── */
  const S = () => window.crypto && window.crypto.subtle;
  const hex = (b, n) => Array.from(new Uint8Array(b).slice(0, n || undefined)).map((x) => x.toString(16).padStart(2, '0')).join('');
  async function fp(key) { const raw = await S().exportKey('raw', key); return hex(await S().digest('SHA-256', raw), 6).match(/../g).join(':'); }
  const HDR = 18;
  function header(type, dev, seq, ts) { const h = new Uint8Array(HDR), v = new DataView(h.buffer); h[0] = 1; h[1] = type; h.set(dev, 2); v.setUint32(10, seq); v.setUint32(14, ts); return h; }
  const ivOf = (dev, seq) => { const iv = new Uint8Array(12); iv.set(dev, 0); new DataView(iv.buffer).setUint32(8, seq); return iv; };
  function encodeVitals(x) { const b = new Uint8Array(10), v = new DataView(b.buffer); b[0] = x.hr; b[1] = x.hrv; v.setUint16(2, Math.round(x.temp * 100)); v.setUint16(4, x.act); v.setUint16(6, x.imp); b[8] = x.bat; b[9] = x.q; return b; }
  function decodeVitals(b) { const v = new DataView(b.buffer, b.byteOffset); return { hr: b[0], hrv: b[1], temp: v.getUint16(2) / 100, act: v.getUint16(4), imp: v.getUint16(6), bat: b[8], q: b[9] }; }

  /* ── the simulator ── */
  async function simStart(s) {
    if (!S()) { CH.simErr = 'Web Crypto needs a secure (https) page.'; OS.render(); return; }
    simStop(); CH.simErr = '';
    const M = { log: [], sent: 0, ok: 0, bad: 0, bytes: 0, seq: 0, last: 0, prev: null, frame: null, vit: null, dev: crypto.getRandomValues(new Uint8Array(8)), bat: 86, t: 0, iv: null, ota: null };
    const L = (who, txt, st) => { M.log.unshift({ at: new Date().toLocaleTimeString(), who, txt, st }); M.log = M.log.slice(0, 14); };
    CH.sim = M; OS.render();
    // 1 · pairing: each side makes a P-256 key pair; public keys cross over NFC; both derive the same AES-GCM key
    const ecdh = { name: 'ECDH', namedCurve: 'P-256' }, chip = await S().generateKey(ecdh, false, ['deriveKey']), app = await S().generateKey(ecdh, false, ['deriveKey']);
    const aes = { name: 'AES-GCM', length: 128 };
    M.kChip = await S().deriveKey({ name: 'ECDH', public: app.publicKey }, chip.privateKey, aes, true, ['encrypt', 'decrypt']);
    M.kApp = await S().deriveKey({ name: 'ECDH', public: chip.publicKey }, app.privateKey, aes, true, ['encrypt', 'decrypt']);
    const a = await fp(M.kChip), b = await fp(M.kApp);
    L('Pairing', `NFC tap: public keys exchanged, both sides derived key ${a}${a === b ? ' (match)' : ` vs ${b}`}`, a === b ? 'good' : 'bad');
    // the server's firmware-signing key; the chip holds only the public half, fixed at manufacture
    M.sign = await S().generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
    L('Server', 'Firmware signing key ready; chip trusts its public key only', 'muted');
    const base = (s.vitals && s.vitals.rhr) || 62, hrvB = (s.vitals && s.vitals.hrv) || 55;
    M.iv = setInterval(async () => {
      if (CH.sim !== M) return;
      M.t++; M.bat = Math.max(1, M.bat - 0.01);
      const x = { hr: Math.round(base + 4 * Math.sin(M.t / 9) + (Math.random() - 0.5) * 3), hrv: Math.round(hrvB + 6 * Math.sin(M.t / 13) + (Math.random() - 0.5) * 4), temp: 36.6 + 0.15 * Math.sin(M.t / 30), act: Math.round(40 + 30 * Math.abs(Math.sin(M.t / 7))), imp: Math.round(520 + 6 * Math.sin(M.t / 20)), bat: Math.round(M.bat), q: 96 };
      await sendFrame(M, 1, encodeVitals(x));
    }, 1000);
  }
  async function sendFrame(M, type, payload, opts = {}) {
    const L = (who, txt, st) => { M.log.unshift({ at: new Date().toLocaleTimeString(), who, txt, st }); M.log = M.log.slice(0, 14); };
    const t0 = performance.now(); let frame;
    if (opts.replay && M.prev) frame = M.prev.slice();
    else {
      M.seq++; const h = header(type, M.dev, M.seq, Math.floor(Date.now() / 1000));
      const ct = new Uint8Array(await S().encrypt({ name: 'AES-GCM', iv: ivOf(M.dev, M.seq), additionalData: h }, M.kChip, payload));
      frame = new Uint8Array(HDR + ct.length); frame.set(h); frame.set(ct, HDR); M.prev = frame.slice();
    }
    if (opts.tamper) frame[HDR + 2] ^= 0x5a;
    M.sent++; M.bytes += frame.length; M.frame = frame;
    // relay: forwards bytes it cannot read; app: header checks, replay window, then authenticated decryption
    const v = new DataView(frame.buffer), seq = v.getUint32(10), h = frame.slice(0, HDR);
    if (frame[0] !== 1) { M.bad++; L('App', 'Rejected: unknown version', 'bad'); return paint(); }
    if (seq <= M.last) { M.bad++; L('App', `Rejected replay: sequence ${seq} already seen`, 'bad'); return paint(); }
    try {
      const pt = new Uint8Array(await S().decrypt({ name: 'AES-GCM', iv: ivOf(frame.slice(2, 10), seq), additionalData: h }, M.kApp, frame.slice(HDR)));
      M.last = seq; M.ok++; M.vit = decodeVitals(pt); M.lat = performance.now() - t0;
      if (opts.tamper || opts.replay || M.ok % 10 === 1) L('App', `Frame ${seq} verified and decoded, ${frame.length} bytes`, 'good');
    } catch { M.bad++; L('App', `Rejected frame ${seq}: authentication tag failed (tampered)`, 'bad'); }
    paint();
  }
  async function ota(tampered) {
    const M = CH.sim; if (!M) return;
    const L = (who, txt, st) => { M.log.unshift({ at: new Date().toLocaleTimeString(), who, txt, st }); M.log = M.log.slice(0, 14); };
    const img = crypto.getRandomValues(new Uint8Array(65536)), ver = '0.2.1', hash = hex(await S().digest('SHA-256', img));
    const manifest = new TextEncoder().encode(JSON.stringify({ model: 'myo-chip-c0', ver, size: img.length, sha256: hash }));
    const sig = await S().sign({ name: 'ECDSA', hash: 'SHA-256' }, M.sign.privateKey, manifest);
    L('Server', `Signed firmware ${ver} manifest (${img.length / 1024} KB image)`, 'muted');
    if (tampered) img[1234] ^= 0xff;
    const okSig = await S().verify({ name: 'ECDSA', hash: 'SHA-256' }, M.sign.publicKey, sig, manifest), okHash = hex(await S().digest('SHA-256', img)) === hash;
    if (okSig && okHash) { L('Chip', `Signature and image hash verified; written to slot B, rebooted, self-test passed, committed ${ver}`, 'good'); M.fw = ver; }
    else L('Chip', `Refused update: ${okSig ? 'image hash does not match the signed manifest' : 'bad signature'}; still running the old firmware`, 'bad');
    paint();
  }
  function simStop() { if (CH.sim && CH.sim.iv) clearInterval(CH.sim.iv); CH.sim = null; }
  function paint() {
    const M = CH.sim, el = (id) => document.getElementById(id); if (!M || !el('ch-sim')) return;
    const V = M.vit, set = (id, t) => { const e = el(id); if (e && e.textContent !== String(t)) e.textContent = t; };
    if (V) { set('ch-hr', V.hr); set('ch-hrv', V.hrv); set('ch-temp', V.temp.toFixed(2)); set('ch-act', V.act); set('ch-imp', V.imp); set('ch-bat', V.bat); }
    set('ch-sent', M.sent); set('ch-ok', M.ok); set('ch-bad', M.bad); set('ch-bytes', M.bytes); set('ch-lat', M.lat ? M.lat.toFixed(1) : '—'); set('ch-fw', M.fw || '0.2.0');
    const f = M.frame; if (f && el('ch-hex')) el('ch-hex').innerHTML = `<span class="ch-h">${hex(f.slice(0, HDR)).match(/../g).join(' ')}</span> <span class="ch-c">${hex(f.slice(HDR, f.length - 16)).match(/../g).join(' ')}</span> <span class="ch-t">${hex(f.slice(f.length - 16)).match(/../g).join(' ')}</span>`;
    if (el('ch-log')) el('ch-log').innerHTML = M.log.map((r) => `<li class="st-${r.st}"><time>${esc(r.at)}</time> <b>${esc(r.who)}</b> ${esc(r.txt)}</li>`).join('');
  }

  /* ── neuromorphic sensing: an event-driven (level-crossing) front end, simulated on a synthetic ECG ── */
  function nmSim(o) {
    const fs = 1000, dur = o.dur || 6, beat = 60 / (o.hr || 62), tR = 0.25, d = o.delta, n = Math.round(dur * fs);
    let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
    const g = (t, c, w) => Math.exp(-(((t - c) / w) ** 2));
    const ecg = (t) => { const b = t % beat; return 0.12 * g(b, tR - 0.16, 0.025) - 0.12 * g(b, tR - 0.03, 0.008) + 1.0 * g(b, tR, 0.01) - 0.25 * g(b, tR + 0.03, 0.01) + 0.3 * g(b, tR + 0.25, 0.045) + 0.05 * Math.sin((2 * Math.PI * t) / 4) + 0.004 * rnd(); };
    const x = new Float64Array(n), rec = new Float64Array(n), ev = [], refs = [], det = [];
    for (let i = 0; i < n; i++) x[i] = o.flat ? 0.2 : ecg(i / fs);
    let L = x[0], last = 0, prevL = L; refs.push(0);
    for (let i = 0; i < n; i++) {
      const t = i / fs;
      while (x[i] - L >= d) { L += d; ev.push([t, 1]); last = t; }
      while (L - x[i] >= d) { L -= d; ev.push([t, -1]); last = t; }
      if (o.keep && t - last >= 0.25) { L = x[i]; refs.push(t); last = t; }
      if (!o.flat && prevL < 0.55 && L >= 0.55 && (!det.length || t - det[det.length - 1] > 0.25)) det.push(t);
      prevL = L; rec[i] = L;
    }
    let se = 0; for (let i = 0; i < n; i++) se += (x[i] - rec[i]) ** 2;
    const trueR = []; for (let k = 0; k * beat + tR < dur; k++) trueR.push(k * beat + tR);
    const lat = det.map((t) => { const r = trueR.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a), trueR[0]); return (t - r) * 1000; });
    const rr = det.slice(1).map((t, i) => t - det[i]), hrDet = rr.length ? 60 / (rr.reduce((a, b) => a + b, 0) / rr.length) : null;
    const bitsConv = 250 * 12 * dur, bitsEv = ev.length * 9 + refs.length * 20;
    return { fs, dur, x, rec, ev, refs, det, rms: Math.sqrt(se / n), lat: lat.length ? lat.reduce((a, b) => a + b, 0) / lat.length : null, hrDet, hr: 60 / beat, bitsConv, bitsEv, evRate: ev.length / dur };
  }
  function nmSvg(R, W = 640) {
    const H = 210, L = 34, Rr = 8, T = 10, B = 40, t0 = R.dur - 3, i0 = Math.round(t0 * R.fs), v0 = -0.4, v1 = 1.1, X = (t) => L + ((t - t0) / 3) * (W - L - Rr), Y = (v) => T + (1 - (v - v0) / (v1 - v0)) * (H - T - B);
    let p1 = '', p2 = ''; for (let i = i0; i < R.x.length; i += 2) { p1 += `${i === i0 ? 'M' : 'L'}${X(i / R.fs).toFixed(1)} ${Y(R.x[i]).toFixed(1)}`; }
    let prev = null; for (let i = i0; i < R.rec.length; i++) { const x = X(i / R.fs).toFixed(1), y = Y(R.rec[i]).toFixed(1); if (prev == null) p2 += `M${x} ${y}`; else if (R.rec[i] !== R.rec[i - 1]) p2 += `L${x} ${Y(R.rec[i - 1]).toFixed(1)}L${x} ${y}`; prev = y; }
    p2 += `L${X(R.dur).toFixed(1)} ${prev}`;
    const ticks = R.ev.filter((e) => e[0] >= t0).map((e) => `<line class="${e[1] > 0 ? 'nm-up' : 'nm-dn'}" x1="${X(e[0]).toFixed(1)}" x2="${X(e[0]).toFixed(1)}" y1="${H - B + 8}" y2="${H - B + (e[1] > 0 ? 18 : 24)}"/>`).join('');
    const refs = R.refs.filter((t) => t >= t0).map((t) => `<rect class="nm-ref" x="${(X(t) - 3).toFixed(1)}" y="${H - B + 26}" width="6" height="6" transform="rotate(45 ${X(t).toFixed(1)} ${H - B + 29})"/>`).join('');
    const det = R.det.filter((t) => t >= t0).map((t) => `<line class="nm-det" x1="${X(t).toFixed(1)}" x2="${X(t).toFixed(1)}" y1="${T}" y2="${H - B + 4}"/>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Last 3 seconds: the ECG, the signal rebuilt from events, event marks and keep-alive references">
      ${[0, 0.5, 1].map((v) => `<line class="bc-grid" x1="${L}" x2="${W - Rr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="bc-ax" x="${L - 4}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${v}</text>`).join('')}
      <text class="bc-ax" x="${L}" y="${H - 2}">mV · 3 s</text>${det}<path class="nm-x" d="${p1}"/><path class="nm-rec" d="${p2}"/>${ticks}${refs}</svg>`;
  }
  function neuroTab(s) {
    const N = CH.nm, R = nmSim({ hr: (s.vitals && s.vitals.rhr) || 62, delta: N.delta, keep: N.keep, flat: N.flat }), ratio = R.bitsConv / Math.max(1, R.bitsEv);
    const CMP = [['What is reported', 'Every sample, 250 times a second', 'Only changes larger than a set step, the moment they happen'], ['Data', '3,000 bits a second, flat line or not', 'Scales with activity: almost nothing between beats'], ['Timing of a beat', 'Rounded to the 4 ms sample grid', 'Time-stamped by a fast clock, sub-millisecond'],
      ['Front-end power', 'Converter and processor run continuously', 'Circuits sleep until the signal moves'], ['Weak spot', 'Wastes power on unchanging signal', '"Static blindness": a still signal sends nothing, so it looks the same as a dead sensor']];
    return `<section class="card"><div class="card-h"><h2>Sense changes, not time</h2></div>
        <p class="small">Neuromorphic sensors copy the retina: each element reports only when what it sees changes, as a sparse stream of events, instead of sending complete frames on a clock. In vision this gives microsecond latency, very wide dynamic range and milliwatt power. The same idea suits an implant, where energy is the hardest limit and most of a heartbeat is a flat line.</p>
        <div class="tbl-wrap"><table class="tbl compact"><caption class="sr">Conventional and event-driven front ends</caption><thead><tr><th scope="col"></th><th scope="col">Conventional (fixed-rate)</th><th scope="col">Neuromorphic (event-driven)</th></tr></thead><tbody>${CMP.map((r) => `<tr><th scope="row" class="small">${esc(r[0])}</th><td class="small">${esc(r[1])}</td><td class="small">${esc(r[2])}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="card"><div class="card-h"><h2>Try it: an event-driven ECG front end</h2></div>
        <div class="st-go"><label class="small">Step size <select data-change="ch-nm-delta">${[0.02, 0.05, 0.1, 0.2].map((v) => `<option value="${v}" ${N.delta === v ? 'selected' : ''}>${v} mV</option>`).join('')}</select></label>
          <label class="ped-use tested"><input type="checkbox" data-change="ch-nm-keep" ${N.keep ? 'checked' : ''}> Keep-alive reference every 250 ms</label>
          <label class="ped-use tested"><input type="checkbox" data-change="ch-nm-flat" ${N.flat ? 'checked' : ''}> Still signal (lead lost contact)</label></div>
        <div class="nm-plot">${nmSvg(R)}</div>
        <ul class="bc-leg"><li><i class="bc-sw nm-sw-x"></i>ECG at the electrodes</li><li><i class="bc-sw nm-sw-rec"></i>Rebuilt from events</li><li><i class="bc-sw nm-sw-up"></i>Rising event</li><li><i class="bc-sw nm-sw-dn"></i>Falling event</li><li><i class="bc-sw nm-sw-ref"></i>Keep-alive reference</li><li><i class="bc-sw nm-sw-det"></i>Beat detected</li></ul>
        <div class="lb-tiles">${[['Events', Math.round(R.evRate), 'a second, against 250 fixed samples'], ['Data', R.bitsEv ? `${ratio.toFixed(ratio < 10 ? 1 : 0)}×` : '—', 'less than fixed-rate 12-bit samples'], ['Rebuild error', N.flat ? '—' : `${((R.rms / 1) * 100).toFixed(1)}%`, 'RMS, of a 1 mV R wave'],
          ['Beat timing', R.lat != null ? `${R.lat > 0 ? '+' : ''}${R.lat.toFixed(1)}` : '—', R.lat != null ? 'ms from the true R peak (upstroke trigger)' : 'no beats'], ['Heart rate', R.hrDet ? Math.round(R.hrDet) : '—', `from events · true ${Math.round(R.hr)}`]].map(([l, v, u]) => `<div><span>${l}</span><b>${esc(String(v))}</b><em>${esc(u)}</em></div>`).join('')}</div>
        <p class="small">${N.flat ? (N.keep ? 'A still signal produces no events, but the keep-alive references show the chip is working and report the level: Myo can tell a lost lead from a dead sensor.' : '<b>Static blindness:</b> a still signal produces no events at all, so the chip cannot tell a flat line from a broken sensor. Turn on the keep-alive reference.') : 'Smaller steps follow the waveform more closely but send more events. The beat is detected on the upstroke, a few milliseconds before the peak, with a timestamp from the fast clock rather than a 4 ms sample grid.'}</p></section>
      <div class="grid g-2"><section class="card"><div class="card-h"><h2>In the Myo chip</h2></div><ul class="small bc-ref">
          <li><b>Event front end:</b> a level-crossing (send-on-delta) converter on the ECG and bio-impedance channels, so data and power scale with activity.</li>
          <li><b>Event processor:</b> a small spiking network classifies beats and motion as events arrive; the main microcontroller wakes only for summaries and sync.</li>
          <li><b>Fusion:</b> slow conventional channels (temperature, hourly impedance, accelerometer context) are fused with the fast event channel, the way event cameras are paired with thermal sensors.</li>
          <li><b>Against static blindness:</b> a keep-alive reference sample and a tiny injected test signal, the electronic version of the eye's micro-saccades, prove every channel is alive.</li>
          <li><b>Better HRV:</b> beat times stamped by a fast clock avoid the 4 ms rounding of 250 Hz sampling, which matters for short-term HRV.</li></ul></section>
        <section class="card"><div class="card-h"><h2>Trade-offs</h2></div><ul class="small bc-ref">
          <li>Event circuits need more transistors per channel, so channel count is limited; an implant needs only a few channels.</li>
          <li>Noise near the step size makes spurious events: the step must sit above the noise floor, with hysteresis.</li>
          <li>Event streams need new algorithms and new validation; regulators will expect them tested against conventional recordings.</li></ul>
          <p class="fine">Principles from event-based vision as summarised in <a href="https://aquamarine-perigee-50d.notion.site/Neuromorphic-Sensors-422c69da363380a7afedfeeea69effde" target="_blank" rel="noopener">Neuromorphic Sensors</a> (vedantswadia.com), applied here to biosignals. The simulation uses a synthetic ECG at your resting heart rate.</p></section></div>`;
  }

  /* ── tabs ── */
  const NODES = [
    ['Body', 'biology', ['Heart: ECG', 'Skin and tissue: temperature, bio-impedance', 'Movement: accelerometer', 'Later: interstitial glucose; neural channels through the BCI lab']],
    ['Myo chip', 'chip', ['Analogue front end and microcontroller', 'Neuromorphic option: an event-driven front end that reports only changes', 'Secure element with the device identity key', 'Bluetooth LE 5.3 and NFC', 'Rechargeable cell, wireless charging', '14 days of on-chip storage']],
    ['Relay', 'phone', ['Phone or Myo band', 'Forwards encrypted frames it cannot read', 'Store and forward when offline']],
    ['Myo app', 'myo', ['Pairs by NFC tap and holds the data key', 'Decrypts, checks and decodes frames', 'Feeds Live sensors, the digital twin and red flags']],
    ['Myo cloud', 'stream', ['Device registry and pairing records', 'Signed firmware and staged rollouts', 'Daily summaries the member chooses to sync', 'Audit log of every access']]
  ];
  const LINKS = ['Electrodes and sensors in contact with tissue', 'BLE LE Secure Connections + app-layer AES-GCM', 'Same frames, still encrypted', 'HTTPS with the member\'s sign-in; row-level security'];
  function archTab() {
    return `<section class="card"><div class="card-h"><h2>From body to cloud</h2></div>
        <ol class="ch-flow">${NODES.map((n, i) => `<li class="ch-node"><h3>${icon(n[1], 16)} ${esc(n[0])}</h3><ul class="small">${n[2].map((x) => `<li>${esc(x)}</li>`).join('')}</ul></li>${i < LINKS.length ? `<li class="ch-link" aria-label="Link: ${esc(LINKS[i])}"><span>${esc(LINKS[i])}</span></li>` : ''}`).join('')}</ol>
        <p class="fine">Data is encrypted on the chip and opened only in the member's own app. The relay and the network see sealed frames; the cloud stores what the member chooses to sync.</p></section>
      <div class="grid g-2"><section class="card"><div class="card-h"><h2>Design principles</h2></div><ul class="small bc-ref">
          <li><b>Sensing only.</b> Version 0 measures; it never stimulates or delivers anything. A fault can only stop data, never harm.</li>
          <li><b>Member owns the key.</b> Pairing happens by a deliberate NFC tap; unpairing destroys the key.</li>
          <li><b>Works offline.</b> The chip keeps 14 days of summaries; the app keeps working without the cloud.</li>
          <li><b>Every update signed.</b> The chip runs only firmware signed by Myo's key, installed to a spare slot with automatic rollback.</li>
          <li><b>Minimum data.</b> Summaries by default; raw ECG strips only when the member asks.</li></ul></section>
        <section class="card"><div class="card-h"><h2>How it fits Myo today</h2></div><ul class="small bc-ref">
          <li><a href="#stream">Live sensors</a> already runs the beat, HRV and breathing pipeline the chip's summaries feed.</li>
          <li><a href="#twin">Digital twin</a> takes the chip's daily summaries as a live data source.</li>
          <li><a href="#bci">BCI lab</a> covers neural interfaces, electrode arrays and the implant link and power calculator.</li>
          <li><a href="#connect">Integrations</a> lists the chip as a planned device.</li></ul></section></div>
      <div class="banner" role="note"><b>Concept only.</b> The Myo chip is a design for engineers and partners. It is not a medical device, isn't available, and must not be implanted. Human use could only happen in an approved clinical investigation run by qualified clinicians. Myo gives no surgical or self-implant guidance.</div>`;
  }
  function hwTab() {
    const pw = CH.pw, B = budget(pw), mx = Math.max(...B.rows.map((r) => r[1]));
    const BLOCKS = [['Size', 'About 45 × 7 × 4 mm, 1.2 cm³', 'The size of today\'s insertable heart monitors'], ['Enclosure', 'Titanium body with a glass or ceramic radio window', 'Proven implant materials; tested to ISO 10993'], ['Front end', 'One-lead ECG, bio-impedance and temperature channels', 'Electrodes at each end of the body'],
      ['Microcontroller', 'Low-power Arm Cortex-M class with DSP', 'Beat detection and summaries on the chip, so the radio sleeps'], ['Security', 'Secure element: device key, monotonic counter, secure boot', 'Keys never leave the chip'], ['Radio', 'Bluetooth LE 5.3; NFC for pairing and wake-up', 'Works with any phone; NFC needs touch range, which makes pairing deliberate'],
      ['Power', 'Rechargeable solid-state cell, wireless charging pad', 'No battery swap surgery; charging heat kept within 2 °C of body temperature'], ['Neuromorphic option', 'Level-crossing (send-on-delta) front end and a small spiking event processor', 'Data and power scale with how much the signal changes, not with time'], ['Storage', '4 MB flash', '14 days of summaries plus flagged ECG strips']];
    return `<section class="card"><div class="card-h"><h2>Blocks</h2></div><div class="tbl-wrap"><table class="tbl compact"><caption class="sr">Hardware blocks</caption><thead><tr><th scope="col">Block</th><th scope="col">Choice</th><th scope="col">Why</th></tr></thead><tbody>${BLOCKS.map((b) => `<tr><th scope="row">${esc(b[0])}</th><td class="small">${esc(b[1])}</td><td class="small">${esc(b[2])}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="card"><div class="card-h"><h2>Power budget</h2><span class="muted small">Average current</span></div>
        <form class="lb-grid" data-submit="ch-pw"><label>Cell capacity (mAh)<input name="cap" type="number" min="1" max="500" step="1" value="${pw.cap}"></label><label>Usable share (%)<input name="usable" type="number" min="30" max="100" value="${pw.usable}"></label>
          <label>Sync every (minutes)<input name="sync" type="number" min="1" max="240" value="${pw.sync}"></label><label>Data per sync (kB)<input name="kb" type="number" min="1" max="2000" value="${pw.kb}"></label><label class="ped-use tested fd-chk"><input type="checkbox" name="neuro" ${pw.neuro ? 'checked' : ''}> Neuromorphic front end</label><div class="lb-wide"><button class="btn sm">Recalculate</button></div></form>
        <ul class="fl-bars" aria-label="Average current by block">${B.rows.map((r) => `<li><span>${esc(r[0])}</span><i class="fl-track"><i style="width:${((r[1] / mx) * 100).toFixed(1)}%"></i></i><b class="num">${r[1] < 10 ? r[1].toFixed(1) : Math.round(r[1])}</b></li>`).join('')}</ul>
        <div class="lb-tiles"><div><span>Total</span><b>${B.tot.toFixed(1)}</b><em>µA average</em></div><div><span>Between charges</span><b>${B.days.toFixed(0)}</b><em>days${pw.neuro ? ' with the neuromorphic front end' : ''}</em></div><div><span>${pw.neuro ? 'Conventional front end' : 'With a neuromorphic front end'}</span><b>${budget({ ...pw, neuro: !pw.neuro }).days.toFixed(0)}</b><em>days</em></div><div><span>Charging</span><b>${Math.ceil(pw.cap / 5)}</b><em>h at a 5 mA pad rate</em></div></div>
        <p class="fine">Estimates for design trade-offs, in µA: the radio is assumed to draw 5 mA while on at about 50 kB/s with 0.4 s of connection overhead. Bench measurements replace these numbers.</p></section>`;
  }
  function protoTab() {
    const M = CH.sim, FIELDS = [['Version', 1, 'Frame format version'], ['Type', 1, '1 vitals summary · 2 ECG strip · 3 out-of-range event · 16 status · 32 command reply'], ['Device ID', 8, 'From the secure element'], ['Sequence', 4, 'Strictly increasing; the app rejects anything not newer'], ['Time', 4, 'Seconds since 1970'], ['Payload', 'n', 'AES-GCM ciphertext; the 18 header bytes are authenticated too'], ['Tag', 16, 'Authentication tag']];
    return `<section class="card"><div class="card-h"><h2>Frame format</h2><span class="muted small">Little frames, sealed end to end</span></div>
        <div class="tbl-wrap"><table class="tbl compact"><caption class="sr">Frame fields</caption><thead><tr><th scope="col">Field</th><th scope="col">Bytes</th><th scope="col">Notes</th></tr></thead><tbody>${FIELDS.map((f) => `<tr><th scope="row">${f[0]}</th><td class="num">${f[1]}</td><td class="small">${esc(f[2])}</td></tr>`).join('')}</tbody></table></div>
        <p class="fine">The nonce is the device ID plus the sequence number, so it never repeats under one key. A vitals frame is 44 bytes: heart rate, HRV, temperature, activity, impedance, battery and signal quality.</p></section>
      <section class="card" id="ch-sim"><div class="card-h"><h2>End-to-end simulator</h2>${M ? pill('good', 'Running') : ''}</div>
        <p class="small">Runs the real protocol in this browser with Web Crypto: pairing, encrypted frames once a second, the app's checks, and signed firmware updates. Try to break it.</p>
        <div class="st-go">${M ? `<button class="btn" data-act="ch-stop">${icon('pause', 16)} Stop</button><button class="btn ghost sm" data-act="ch-replay">Replay an old frame</button><button class="btn ghost sm" data-act="ch-tamper">Tamper with a frame</button><button class="btn ghost sm" data-act="ch-ota">Push signed firmware</button><button class="btn ghost sm" data-act="ch-ota-bad">Push a modified image</button>` : `<button class="btn" data-act="ch-go">${icon('play', 16)} Pair and start</button>`}</div>
        ${CH.simErr ? `<p class="small" role="alert">${esc(CH.simErr)}</p>` : ''}
        ${M ? `<div class="st-read">${[['Heart rate', 'ch-hr', 'bpm'], ['HRV', 'ch-hrv', 'ms'], ['Temperature', 'ch-temp', '°C'], ['Activity', 'ch-act', 'counts'], ['Impedance', 'ch-imp', 'Ω'], ['Battery', 'ch-bat', '%']].map(([l, id, u]) => `<div><span>${l}</span><b class="num" id="${id}">—</b><em>${u}</em></div>`).join('')}</div>
          <div class="lb-tiles ch-stats">${[['Frames sent', 'ch-sent'], ['Accepted', 'ch-ok'], ['Rejected', 'ch-bad'], ['Bytes', 'ch-bytes'], ['Check and decrypt, ms', 'ch-lat'], ['Firmware', 'ch-fw']].map(([l, id]) => `<div><span>${l}</span><b id="${id}">—</b></div>`).join('')}</div>
          <p class="small">Last frame: <code id="ch-hex" class="ch-hex"></code></p><ul class="bc-leg"><li><i class="bc-sw ch-sw-h"></i>Header, authenticated</li><li><i class="bc-sw ch-sw-c"></i>Encrypted payload</li><li><i class="bc-sw ch-sw-t"></i>Tag</li></ul>
          <ol id="ch-log" class="ch-log" aria-live="polite"></ol>` : ''}
        <p class="fine">Simulated values follow your resting heart rate and HRV. Nothing here talks to real hardware or leaves this page.</p></section>`;
  }
  function serverTab() {
    const API = [['POST', '/v1/devices/pair', 'App, signed-in member', 'Register a chip: device ID, public key, maker certificate'], ['GET', '/v1/devices', 'App', 'The member\'s chips and their status'], ['POST', '/v1/devices/{id}/summaries', 'App', 'Daily summaries the member chooses to sync'],
      ['GET', '/v1/devices/{id}/firmware', 'App, for the chip', 'Latest signed manifest for this model and rollout group'], ['POST', '/v1/devices/{id}/config', 'App, member re-confirms', 'Sampling settings, signed by the server and checked by the chip'], ['DELETE', '/v1/devices/{id}', 'App', 'Unpair: revoke keys, stop sync, keep or delete history as the member chooses']];
    const TABLES = [['devices', 'id, member_id, model, hardware_rev, firmware, public_key, paired_at, status'], ['device_summaries', 'member_id, device_id, day, hr_mean, hrv, temp, activity, impedance, quality'], ['firmware', 'model, version, sha256, signature, notes, rollout_percent, released_at'], ['device_audit', 'actor, device_id, action, at, detail']];
    return `<section class="card"><div class="card-h"><h2>Device API</h2>${pill('muted', 'Planned')}</div>
        <div class="tbl-wrap"><table class="tbl compact"><caption class="sr">Planned device API</caption><thead><tr><th scope="col">Method</th><th scope="col">Path</th><th scope="col">Caller</th><th scope="col">Does</th></tr></thead><tbody>${API.map((r) => `<tr><td><code>${r[0]}</code></td><th scope="row"><code>${esc(r[1])}</code></th><td class="small">${esc(r[2])}</td><td class="small">${esc(r[3])}</td></tr>`).join('')}</tbody></table></div>
        <p class="fine">Runs as a Supabase Edge Function beside the wearables and ingest functions, with the member's sign-in on every call. There are no remote commands that change how the body is treated: version 0 senses only.</p></section>
      <section class="card"><div class="card-h"><h2>Data model</h2><span class="muted small">Private schema, row-level security</span></div>
        <div class="tbl-wrap"><table class="tbl compact"><caption class="sr">Planned tables</caption><thead><tr><th scope="col">Table</th><th scope="col">Columns</th></tr></thead><tbody>${TABLES.map((t) => `<tr><th scope="row"><code>${t[0]}</code></th><td class="small">${esc(t[1])}</td></tr>`).join('')}</tbody></table></div>
        <p class="fine">Raw signals stay on the chip and in the app. The server holds summaries only, and members can download or delete everything from Your data rights.</p></section>`;
  }
  function safetyTab() {
    const THREATS = [['A fake chip pairs with the app', 'Maker certificate checked at pairing; NFC touch range'], ['Someone listens to the radio', 'AES-GCM inside Bluetooth\'s own encryption'], ['Old frames are replayed', 'Strictly increasing sequence numbers'], ['Frames are altered', 'Authentication tag over header and payload'],
      ['Malicious firmware', 'Signed manifests, secure boot, rollback on failed self-test'], ['Lost or stolen phone', 'Phone lock plus app sign-in; unpair from another device'], ['Server breach', 'Summaries only; no keys on the server; audit log'], ['Radio jamming', 'Chip keeps recording and syncs later; sensing never depends on the link']];
    const STD = [['ISO 14708-1', 'Active implantable devices: general safety, including the 2 °C surface-temperature limit'], ['ISO 10993', 'Biocompatibility of materials'], ['ISO 14971', 'Risk management'], ['IEC 62304', 'Medical device software life cycle'], ['IEC 62366-1', 'Usability engineering'], ['ISO 13485', 'Quality management system'],
      ['ISO 14117', 'Electromagnetic compatibility for active implants'], ['ISO/TS 10974', 'MRI safety testing for active implants'], ['FD&C Act §524B', 'US cybersecurity duties for connected devices: software bill of materials, patching, vulnerability handling'], ['FCC rules', 'Bluetooth under Part 15; MedRadio (401–406 MHz) under Part 95 if used']];
    const ROAD = [['Now', 'Concept, architecture and protocol simulator'], ['Bench', 'Prototype electronics outside the body, power and radio tests, security review'], ['Verification', 'Biocompatibility, electrical safety, EMC and MRI testing; software and risk files'], ['FDA pre-submission', 'Agree the pathway and studies with the FDA'],
      ['Clinical investigation', 'Investigational device exemption and ethics approval; early feasibility study run by clinicians'], ['Market', 'Pathway depends on claims: sensing-only insertable heart monitors have usually been cleared through 510(k); new sensing claims such as implanted glucose have needed premarket approval. In the EU, active implants are Class III under the MDR.']];
    return `<section class="card"><div class="card-h"><h2>Threat model</h2></div><div class="tbl-wrap"><table class="tbl compact"><caption class="sr">Threats and mitigations</caption><thead><tr><th scope="col">Threat</th><th scope="col">Mitigation</th></tr></thead><tbody>${THREATS.map((t) => `<tr><th scope="row" class="small">${esc(t[0])}</th><td class="small">${esc(t[1])}</td></tr>`).join('')}</tbody></table></div></section>
      <div class="grid g-2"><section class="card"><div class="card-h"><h2>Fail-safe behaviour</h2></div><ul class="small bc-ref">
          <li>Any fault drops the chip into a safe mode: sensing paused, status advertised, nothing else.</li><li>Charging stops if the case warms by more than 2 °C.</li><li>A failed firmware self-test rolls back to the previous image automatically.</li><li>No function of the body depends on the chip working.</li></ul></section>
        <section class="card"><div class="card-h"><h2>Road to people</h2></div><ol class="small bc-ref">${ROAD.map((r) => `<li><b>${esc(r[0])}:</b> ${esc(r[1])}</li>`).join('')}</ol></section></div>
      <section class="card"><div class="card-h"><h2>Standards</h2></div><div class="tbl-wrap"><table class="tbl compact"><caption class="sr">Standards</caption><tbody>${STD.map((t) => `<tr><th scope="row" class="small">${esc(t[0])}</th><td class="small">${esc(t[1])}</td></tr>`).join('')}</tbody></table></div>
        <p class="fine">A planning list for regulatory and quality advisers to confirm; requirements depend on the final design and claims.</p></section>
      <div class="banner" role="note"><b>No surgical or self-implant guidance.</b> Implantation is a medical procedure for qualified clinicians inside an approved study. Myo will not describe how to implant, insert or remove a device.</div>`;
  }

  OS.register('chip', {
    title: 'Myo chip', icon: 'chip',
    render(s) {
      const body = { arch: archTab, hw: hwTab, neuro: neuroTab, proto: protoTab, server: serverTab, safety: safetyTab }[CH.tab](s);
      return `${OS.ui.head('Concept · engineering', 'Myo chip', 'The architecture for an implantable Myo sensor and how it connects the body, the Myo app and Myo\'s servers. A design for engineers and partners: not a product, and not for implantation.')}
        <div class="ch bc fl"><div class="seg kt-tabs" role="tablist" aria-label="Myo chip">${TABS.map(([k, l]) => `<button role="tab" aria-selected="${CH.tab === k}" data-act="ch-tab" data-t="${k}">${l}</button>`).join('')}</div>${body}</div>`;
    },
    mount() { paint(); return () => { if (location.hash.slice(1) !== 'chip') simStop(); }; }
  });
  OS.act('ch-tab', (el) => { CH.tab = TABS.some(([k]) => k === el.dataset.t) ? el.dataset.t : 'arch'; OS.render(); });
  OS.act('ch-pw', (f) => { const g = (k, a, b, d) => clamp(+f.elements[k].value || d, a, b); CH.pw = { cap: g('cap', 1, 500, 20), usable: g('usable', 30, 100, 80), sync: g('sync', 1, 240, 15), kb: g('kb', 1, 2000, 30), neuro: f.elements.neuro.checked }; OS.render(); });
  OS.act('ch-go', () => simStart(OS.state));
  OS.act('ch-stop', () => { simStop(); OS.render(); });
  OS.act('ch-replay', () => { const M = CH.sim; if (M && M.prev) sendFrame(M, 1, null, { replay: true }); });
  OS.act('ch-tamper', () => { const M = CH.sim; if (M) sendFrame(M, 1, new Uint8Array(10), { tamper: true }); });
  OS.act('ch-ota', () => ota(false));
  OS.act('ch-ota-bad', () => ota(true));
  OS.change('ch-nm-delta', (el) => { CH.nm.delta = +el.value || 0.05; OS.render(); });
  OS.change('ch-nm-keep', (el) => { CH.nm.keep = el.checked; OS.render(); });
  OS.change('ch-nm-flat', (el) => { CH.nm.flat = el.checked; OS.render(); });
  OS.chip = { nmSim, budget, encodeVitals, decodeVitals, header, ivOf, state: CH, sendFrame, ota, simStart, simStop };
})();
