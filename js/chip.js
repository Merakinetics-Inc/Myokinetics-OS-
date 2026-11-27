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
  const TABS = [['arch', 'Architecture'], ['hw', 'Hardware and power'], ['proto', 'Protocol simulator'], ['server', 'Server'], ['safety', 'Safety and regulation']];
  const CH = { tab: 'arch', sim: null, pw: { cap: 20, usable: 80, sync: 15, kb: 30 } };

  /* ── power budget: [block, average µA, note] ── */
  function budget(pw) {
    const air = pw.kb / 50 + 0.4, ble = (5000 * air) / (pw.sync * 60);   // 5 mA while the radio is on, ~50 kB/s effective
    const rows = [['ECG front end, continuous', 15, '250 samples/s, one lead'], ['Microcontroller, duty-cycled', 20, 'Beat detection, HRV, summaries'], ['Accelerometer', 3, 'Low-power mode, 12.5 Hz'],
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

  /* ── tabs ── */
  const NODES = [
    ['Body', 'biology', ['Heart: ECG', 'Skin and tissue: temperature, bio-impedance', 'Movement: accelerometer', 'Later: interstitial glucose; neural channels through the BCI lab']],
    ['Myo chip', 'chip', ['Analogue front end and microcontroller', 'Secure element with the device identity key', 'Bluetooth LE 5.3 and NFC', 'Rechargeable cell, wireless charging', '14 days of on-chip storage']],
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
      ['Power', 'Rechargeable solid-state cell, wireless charging pad', 'No battery swap surgery; charging heat kept within 2 °C of body temperature'], ['Storage', '4 MB flash', '14 days of summaries plus flagged ECG strips']];
    return `<section class="card"><div class="card-h"><h2>Blocks</h2></div><div class="tbl-wrap"><table class="tbl compact"><caption class="sr">Hardware blocks</caption><thead><tr><th scope="col">Block</th><th scope="col">Choice</th><th scope="col">Why</th></tr></thead><tbody>${BLOCKS.map((b) => `<tr><th scope="row">${esc(b[0])}</th><td class="small">${esc(b[1])}</td><td class="small">${esc(b[2])}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="card"><div class="card-h"><h2>Power budget</h2><span class="muted small">Average current</span></div>
        <form class="lb-grid" data-submit="ch-pw"><label>Cell capacity (mAh)<input name="cap" type="number" min="1" max="500" step="1" value="${pw.cap}"></label><label>Usable share (%)<input name="usable" type="number" min="30" max="100" value="${pw.usable}"></label>
          <label>Sync every (minutes)<input name="sync" type="number" min="1" max="240" value="${pw.sync}"></label><label>Data per sync (kB)<input name="kb" type="number" min="1" max="2000" value="${pw.kb}"></label><div class="lb-wide"><button class="btn sm">Recalculate</button></div></form>
        <ul class="fl-bars" aria-label="Average current by block">${B.rows.map((r) => `<li><span>${esc(r[0])}</span><i class="fl-track"><i style="width:${((r[1] / mx) * 100).toFixed(1)}%"></i></i><b class="num">${r[1] < 10 ? r[1].toFixed(1) : Math.round(r[1])}</b></li>`).join('')}</ul>
        <div class="lb-tiles"><div><span>Total</span><b>${B.tot.toFixed(1)}</b><em>µA average</em></div><div><span>Between charges</span><b>${B.days.toFixed(0)}</b><em>days</em></div><div><span>Charging</span><b>${Math.ceil(pw.cap / 5)}</b><em>h at a 5 mA pad rate</em></div></div>
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
      const body = { arch: archTab, hw: hwTab, proto: protoTab, server: serverTab, safety: safetyTab }[CH.tab](s);
      return `${OS.ui.head('Concept · engineering', 'Myo chip', 'The architecture for an implantable Myo sensor and how it connects the body, the Myo app and Myo\'s servers. A design for engineers and partners: not a product, and not for implantation.')}
        <div class="ch bc fl"><div class="seg kt-tabs" role="tablist" aria-label="Myo chip">${TABS.map(([k, l]) => `<button role="tab" aria-selected="${CH.tab === k}" data-act="ch-tab" data-t="${k}">${l}</button>`).join('')}</div>${body}</div>`;
    },
    mount() { paint(); return () => { if (location.hash.slice(1) !== 'chip') simStop(); }; }
  });
  OS.act('ch-tab', (el) => { CH.tab = TABS.some(([k]) => k === el.dataset.t) ? el.dataset.t : 'arch'; OS.render(); });
  OS.act('ch-pw', (f) => { const g = (k, a, b, d) => clamp(+f.elements[k].value || d, a, b); CH.pw = { cap: g('cap', 1, 500, 20), usable: g('usable', 30, 100, 80), sync: g('sync', 1, 240, 15), kb: g('kb', 1, 2000, 30) }; OS.render(); });
  OS.act('ch-go', () => simStart(OS.state));
  OS.act('ch-stop', () => { simStop(); OS.render(); });
  OS.act('ch-replay', () => { const M = CH.sim; if (M && M.prev) sendFrame(M, 1, null, { replay: true }); });
  OS.act('ch-tamper', () => { const M = CH.sim; if (M) sendFrame(M, 1, new Uint8Array(10), { tamper: true }); });
  OS.act('ch-ota', () => ota(false));
  OS.act('ch-ota-bad', () => ota(true));
  OS.chip = { budget, encodeVitals, decodeVitals, header, ivOf, state: CH, sendFrame, ota, simStart, simStop };
})();
