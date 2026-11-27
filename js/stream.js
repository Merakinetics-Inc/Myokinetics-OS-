/* ═══ MYO — LIVE SENSORS: a streaming pipeline from body signals to numbers, with every step visible ═══
   Sources   · camera pulse (fingertip over the lens and flash: photoplethysmography), heart sounds (microphone on the
               chest: phonocardiogram), breathing (motion sensors with the phone on the belly), a Bluetooth heart-rate
               strap (GATT 0x180D with beat-to-beat RR intervals) and a synthetic demo signal
   Pipeline  · each source runs as a graph of operators (extract → filter → detect → measure → quality gate → sinks),
               in the spirit of streaming-AI runtimes: the plan is shown before it runs, and while it runs every
               operator reports its rate and latency so the whole sensor-to-number path is observable
   Inputs    · a map of every input interface this device offers and where Myo uses it
   Privacy   · camera frames and audio are processed in memory and never stored or sent; only the session summary
               (time, source, heart rate, HRV, breathing rate, quality) is saved, and only when you choose.
   Wellness readings, not diagnosis: Myo does not detect arrhythmias or murmurs. */
(function () {
  'use strict';
  const { esc, icon, pill, clamp } = OS;
  const SRC = {
    camera: { name: 'Camera pulse', sub: 'Fingertip over the rear camera and flash', input: 'Camera', kind: 'ppg', how: ['Rest your fingertip lightly over the rear camera and flash. Don\'t press hard: that squeezes the blood out.', 'Keep still and breathe normally for 30 to 60 seconds.', 'On a laptop, cover the webcam with a fingertip in a bright room.'] },
    mic: { name: 'Heart sounds', sub: 'Microphone pressed to your chest', input: 'Microphone', kind: 'pcg', how: ['In a quiet room, press the bottom of the phone (where the microphone is) firmly to bare skin, just left of the breastbone.', 'Hold your breath out for a few seconds at a time if the sounds are faint.', 'Wear headphones if you turn on Listen, or the speaker will feed back.'] },
    motion: { name: 'Breathing', sub: 'Phone lying on your belly', input: 'Motion sensors', kind: 'resp', how: ['Lie on your back and rest the phone flat on your belly, below the ribs.', 'Breathe normally for at least a minute; keep the rest of your body still.'] },
    ble: { name: 'Chest strap', sub: 'Bluetooth heart rate with RR intervals', input: 'Bluetooth', kind: 'rr', how: ['Wet the strap\'s electrodes and put it on, then press Start and choose it in the list.', 'Most chest straps (and some watches in broadcast mode) send beat-to-beat RR intervals, the gold standard for HRV at home.'] },
    demo: { name: 'Demo signal', sub: 'A synthetic pulse at your resting heart rate', input: 'Simulated', kind: 'ppg', how: ['No sensor needed: a made-up pulse runs through the same pipeline so you can see how it works.', 'Demo sessions are never saved to your record.'] }
  };
  const OPS = {
    ppg: [['src', 'Source', 'frames'], ['ext', 'Extract', 'mean red light in the centre of the frame'], ['flt', 'Band-pass', 'remove drift and noise (≈0.7–4 Hz)'], ['det', 'Beat detect', 'systolic peaks, 330 ms refractory'], ['mea', 'Measure', 'heart rate, RR intervals, RMSSD'], ['qa', 'Quality gate', 'finger contact, steady RR'], ['out', 'Sinks', 'chart · readouts · session']],
    pcg: [['src', 'Source', 'audio'], ['flt', 'Band-pass', '25–150 Hz in the audio graph'], ['ext', 'Envelope', 'RMS energy each frame'], ['det', 'Periodicity', 'autocorrelation, 0.4–1.5 s'], ['mea', 'Measure', 'heart rate from the S1–S1 period'], ['qa', 'Quality gate', 'periodicity strength'], ['out', 'Sinks', 'chart · readouts · session']],
    resp: [['src', 'Source', 'motion events'], ['ext', 'Axis select', 'the axis that moves most'], ['flt', 'Low-pass', 'keep breathing (< 0.7 Hz)'], ['det', 'Periodicity', 'autocorrelation, 2–12 s'], ['mea', 'Measure', 'breaths a minute'], ['qa', 'Quality gate', 'periodicity strength'], ['out', 'Sinks', 'chart · readouts · session']],
    rr: [['src', 'Source', 'GATT notifications'], ['ext', 'Parse', 'Heart Rate Measurement 0x2A37'], ['flt', 'Artefact filter', 'drop RR more than 20% off the median'], ['mea', 'Measure', 'heart rate, RMSSD'], ['qa', 'Quality gate', 'skin contact, clean beats'], ['out', 'Sinks', 'chart · readouts · session']]
  };
  const ST = { src: 'demo', run: null, last: null, listen: false };
  const now = () => performance.now() / 1000;
  const median = (a) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
  const meanSince = (arr, t0) => { let s = 0, n = 0; for (let i = arr.length - 1; i >= 0 && arr[i][0] >= t0; i--) { s += arr[i][1]; n++; } return n ? s / n : 0; };
  const maxAbsSince = (arr, t0) => { let m = 0; for (let i = arr.length - 1; i >= 0 && arr[i][0] >= t0; i--) m = Math.max(m, Math.abs(arr[i][1])); return m; };
  const trim = (arr, t0) => { let i = 0; while (i < arr.length && arr[i][0] < t0) i++; if (i) arr.splice(0, i); };

  /* ── the session: buffers, operator stats and the per-sample steps ── */
  function session(src) {
    const kind = SRC[src].kind, ops = OPS[kind];
    return { src, kind, t0: now(), raw: [], det: [], proc: [], beats: [], rr: [], hr: null, hrv: null, br: null, q: 0, contact: true, frames: 0, dropped: 0, lastT: null, dts: [],
      stats: Object.fromEntries(ops.map(([k]) => [k, { n: 0, sum: 0, lat: [] }])), stop: [], note: '', lastPer: 0 };
  }
  function timed(S, k, fn) { const a = performance.now(), r = fn(), d = performance.now() - a, st = S.stats[k]; if (st) { st.n++; st.sum += d; st.lat.push(d); if (st.lat.length > 240) st.lat.shift(); } return r; }
  function frameClock(S, t) {
    if (S.lastT != null) { const dt = t - S.lastT; S.dts.push(dt); if (S.dts.length > 120) S.dts.shift(); const m = median(S.dts); if (m && dt > m * 2.5) S.dropped++; }
    S.lastT = t; S.frames++;
  }
  function measureRR(S) {
    const rr = S.rr.slice(-40); if (rr.length < 3) return;
    const med = median(rr.slice(-10)), good = rr.filter((x) => Math.abs(x - med) / med < 0.2);
    S.hr = Math.round(60000 / med);
    const pairs = []; for (let i = 1; i < rr.length; i++) if (Math.abs(rr[i] - med) / med < 0.2 && Math.abs(rr[i - 1] - med) / med < 0.2) pairs.push(rr[i] - rr[i - 1]);
    S.hrv = pairs.length >= 8 ? Math.round(Math.sqrt(pairs.reduce((a, d) => a + d * d, 0) / pairs.length)) : null;
    const last = rr.slice(-10), ok = last.filter((x) => Math.abs(x - med) / med < 0.2).length / last.length;
    return { ok, good: good.length };
  }
  // pulse wave (camera or demo): detrend, smooth, find systolic peaks
  function ppgStep(S, t, v) {
    frameClock(S, t);
    S.raw.push([t, v]);
    const y = timed(S, 'flt', () => { const d = v - meanSince(S.raw, t - 1.2); S.det.push([t, d]); const yy = meanSince(S.det, t - 0.12); S.proc.push([t, yy]); return yy; });
    timed(S, 'det', () => {
      const n = S.proc.length; if (n < 3) return;
      const a = S.proc[n - 3][1], b = S.proc[n - 2][1], den = a - 2 * b + y, tb = S.proc[n - 2][0] + (den ? clamp((0.5 * (a - y)) / den, -0.5, 0.5) : 0) * (t - S.proc[n - 2][0]), amp = maxAbsSince(S.proc, t - 2.5); // parabolic peak time: finer than one camera frame
      const gap = S.rr.length >= 4 ? Math.max(0.33, (0.6 * median(S.rr.slice(-8))) / 1000) : 0.4; // a beat can't come sooner than 60% of the usual interval: skips the dicrotic notch
      if (b > a && b >= y && b > 0.55 * amp && amp > 0 && tb - (S.lastBeat == null ? -9 : S.lastBeat) > gap) { S.beats.push(tb); if (S.lastBeat != null) { const r = (tb - S.lastBeat) * 1000; if (r < 2000) S.rr.push(r); } S.lastBeat = tb; }
    });
    const m = timed(S, 'mea', () => measureRR(S));
    timed(S, 'qa', () => { S.q = Math.round(100 * (m ? m.ok : 0) * (S.contact ? 1 : 0.15)); });
    // perfusion index: the pulsing part of the light as a share of the steady part, over the last 2.5 s
    if (!S.piT || t - S.piT > 0.5) { S.piT = t; let lo = Infinity, hi = -Infinity; for (let i = S.proc.length - 1; i >= 0 && S.proc[i][0] >= t - 2.5; i--) { lo = Math.min(lo, S.proc[i][1]); hi = Math.max(hi, S.proc[i][1]); } const dc = Math.abs(meanSince(S.raw, t - 2.5)); S.pi = dc > 1 && hi > lo && S.q >= 40 ? Math.round(((hi - lo) / dc) * 1000) / 10 : null; }
    const tc = t - 12; trim(S.raw, tc); trim(S.det, tc); trim(S.proc, tc); while (S.beats.length && S.beats[0] < tc) S.beats.shift();
  }
  // periodicity by autocorrelation over the recent window, resampled to a fixed rate
  function period(arr, t1, win, fs, lo, hi) {
    const t0 = t1 - win, xs = []; let j = 0;
    for (let t = t0; t <= t1; t += 1 / fs) { while (j < arr.length - 1 && arr[j + 1][0] < t) j++; const a = arr[j], b = arr[Math.min(arr.length - 1, j + 1)]; if (!a || a[0] > t) { xs.push(null); continue; } const u = b[0] > a[0] ? (t - a[0]) / (b[0] - a[0]) : 0; xs.push(a[1] + (b[1] - a[1]) * clamp(u, 0, 1)); }
    const v = xs.filter((x) => x != null); if (v.length < fs * win * 0.8) return null;
    const m = v.reduce((a, b) => a + b, 0) / v.length, x = v.map((q) => q - m), e = x.reduce((a, b) => a + b * b, 0) || 1;
    let best = 0, lag = 0; const L0 = Math.round(lo * fs), L1 = Math.min(x.length - 2, Math.round(hi * fs)), acf = [];
    for (let L = L0; L <= L1; L++) { let s = 0; for (let i = 0; i + L < x.length; i++) s += x[i] * x[i + L]; const r = s / e; acf[L] = r; if (r > best) { best = r; lag = L; } }
    if (!lag) return null;
    const a = acf[lag - 1] ?? best, c = acf[lag + 1] ?? best, den = a - 2 * best + c, off = den ? clamp(0.5 * (a - c) / den, -0.5, 0.5) : 0; // parabolic refine
    return { sec: (lag + off) / fs, conf: best };
  }
  function pcgStep(S, t, env) {
    frameClock(S, t);
    S.raw.push([t, env]);
    timed(S, 'ext', () => { const fl = Math.min(...S.raw.filter((r) => r[0] >= t - 2).map((r) => r[1])); S.proc.push([t, Math.max(0, meanSince(S.raw, t - 0.04) - fl)]); });
    if (t - S.lastPer > 0.5 && t - S.t0 > 4) {
      S.lastPer = t;
      const p = timed(S, 'det', () => period(S.proc, t, 6, 50, 0.4, 1.5));
      timed(S, 'mea', () => { if (p && p.conf > 0.2) S.hr = Math.round(60 / p.sec); });
      timed(S, 'qa', () => { S.q = p ? Math.round(clamp((p.conf - 0.15) / 0.5, 0, 1) * 100) : 0; });
    }
    const n = S.proc.length; if (n > 2) { const a = S.proc[n - 3][1], b = S.proc[n - 2][1], c = S.proc[n - 1][1], tb = S.proc[n - 2][0], amp = maxAbsSince(S.proc, t - 3); if (b > a && b >= c && b > 0.5 * amp && tb - (S.lastBeat == null ? -9 : S.lastBeat) > 0.18) { S.beats.push(tb); S.lastBeat = tb; } }
    const tc = t - 12; trim(S.raw, tc); trim(S.proc, tc); while (S.beats.length && S.beats[0] < tc) S.beats.shift();
  }
  function respStep(S, t, acc) {
    frameClock(S, t);
    const ax = timed(S, 'ext', () => { S.axes = S.axes || [[], [], []]; acc.forEach((a, i) => { S.axes[i].push([t, a]); trim(S.axes[i], t - 20); }); const vari = S.axes.map((A) => { const m = A.reduce((s, r) => s + r[1], 0) / A.length; return A.reduce((s, r) => s + (r[1] - m) ** 2, 0) / A.length; }); return vari.indexOf(Math.max(...vari)); });
    S.raw.push([t, acc[ax]]);
    timed(S, 'flt', () => { const dt = S.dts.length ? S.dts[S.dts.length - 1] : 1 / 60, rc = 1 / (2 * Math.PI * 0.7), al = dt / (rc + dt); S.lp = S.lp == null ? acc[ax] : S.lp + al * (acc[ax] - S.lp); S.det.push([t, S.lp]); S.proc.push([t, S.lp - meanSince(S.det, t - 10)]); });
    if (t - S.lastPer > 1 && t - S.t0 > 15) {
      S.lastPer = t;
      const p = timed(S, 'det', () => period(S.proc, t, Math.min(30, t - S.t0 - 1), 10, 2, 12));
      timed(S, 'mea', () => { if (p && p.conf > 0.25) S.br = Math.round((60 / p.sec) * 10) / 10; });
      timed(S, 'qa', () => { S.q = p ? Math.round(clamp((p.conf - 0.2) / 0.5, 0, 1) * 100) : 0; });
    }
    const tc = t - 40; trim(S.raw, tc); trim(S.det, tc); trim(S.proc, tc);
  }
  function rrStep(S, t, pkt) {
    frameClock(S, t);
    const P = timed(S, 'ext', () => parseHRM(pkt));
    S.contact = P.contact !== false;
    S.raw.push([t, P.hr]);
    timed(S, 'flt', () => { P.rr.forEach((r) => { S.rr.push(r); S.proc.push([t, r]); S.beats.push(t); }); });
    const m = timed(S, 'mea', () => measureRR(S));
    if (!P.rr.length) S.hr = P.hr;
    timed(S, 'qa', () => { S.q = Math.round(100 * (m ? m.ok : P.hr ? 0.5 : 0) * (S.contact ? 1 : 0)); });
    const tc = t - 120; trim(S.raw, tc); trim(S.proc, tc); while (S.beats.length && S.beats[0] < tc) S.beats.shift();
  }
  function parseHRM(dv) {
    const f = dv.getUint8(0), wide = f & 1; let i = 1;
    const hr = wide ? dv.getUint16(i, true) : dv.getUint8(i); i += wide ? 2 : 1;
    const contact = (f & 0x06) === 0x04 ? false : (f & 0x06) === 0x06 ? true : null;
    if (f & 0x08) i += 2;
    const rr = []; if (f & 0x10) for (; i + 1 < dv.byteLength; i += 2) rr.push((dv.getUint16(i, true) / 1024) * 1000);
    return { hr, rr, contact };
  }

  /* ── sources ── */
  async function startCamera(S) {
    const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 30 } }, audio: false });
    const track = st.getVideoTracks()[0];
    try { const caps = track.getCapabilities ? track.getCapabilities() : {}; if (caps.torch) await track.applyConstraints({ advanced: [{ torch: true }] }); S.note = caps.torch ? 'Flash on' : 'No flash on this camera: use a bright room'; } catch { S.note = 'Could not turn on the flash'; }
    const video = document.createElement('video'); video.muted = true; video.playsInline = true; video.srcObject = st; await video.play();
    const c = document.createElement('canvas'); c.width = 40; c.height = 30; const g = c.getContext('2d', { willReadFrequently: true });
    let alive = true;
    const grab = () => {
      if (!alive) return;
      const t = now();
      const v = timed(S, 'src', () => { g.drawImage(video, 0, 0, 40, 30); return g.getImageData(10, 7, 20, 16).data; });
      const rgb = timed(S, 'ext', () => { let r = 0, gg = 0, b = 0; for (let i = 0; i < v.length; i += 4) { r += v[i]; gg += v[i + 1]; b += v[i + 2]; } const n = v.length / 4; return [r / n, gg / n, b / n]; });
      S.contact = rgb[0] > 60 && rgb[0] > 1.6 * rgb[1] && rgb[0] > 1.4 * rgb[2];
      ppgStep(S, t, -rgb[0]);
      if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(grab); else requestAnimationFrame(grab);
    };
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(grab); else requestAnimationFrame(grab);
    S.stop.push(() => { alive = false; st.getTracks().forEach((x) => x.stop()); video.srcObject = null; });
  }
  async function startMic(S) {
    const st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
    const AC = new (window.AudioContext || window.webkitAudioContext)(); await AC.resume();
    const src = AC.createMediaStreamSource(st), hp = AC.createBiquadFilter(), lp = AC.createBiquadFilter(), an = AC.createAnalyser(), mon = AC.createGain();
    hp.type = 'highpass'; hp.frequency.value = 25; lp.type = 'lowpass'; lp.frequency.value = 150; an.fftSize = 4096; mon.gain.value = ST.listen ? 4 : 0;
    src.connect(hp); hp.connect(lp); lp.connect(an); lp.connect(mon); mon.connect(AC.destination);
    S.mon = mon; S.note = `Microphone at ${Math.round(AC.sampleRate / 1000)} kHz`;
    const buf = new Float32Array(an.fftSize); let alive = true, last = AC.currentTime;
    const tick = () => {
      if (!alive) return; requestAnimationFrame(tick);
      const t = now();
      const env = timed(S, 'src', () => { an.getFloatTimeDomainData(buf); const n = clamp(Math.round((AC.currentTime - last) * AC.sampleRate), 256, buf.length); last = AC.currentTime; let s = 0; for (let i = buf.length - n; i < buf.length; i++) s += buf[i] * buf[i]; return Math.sqrt(s / n); });
      timed(S, 'flt', () => 0);
      pcgStep(S, t, env * 1000);
    };
    requestAnimationFrame(tick);
    S.stop.push(() => { alive = false; st.getTracks().forEach((x) => x.stop()); try { AC.close(); } catch { /* closed */ } });
  }
  async function startMotion(S) {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') { const p = await DeviceMotionEvent.requestPermission(); if (p !== 'granted') throw new Error('Motion access was not allowed'); }
    let seen = false;
    const on = (e) => { const a = e.accelerationIncludingGravity; if (!a || a.x == null) return; seen = true; const t = now(); timed(S, 'src', () => 0); respStep(S, t, [a.x, a.y, a.z]); };
    window.addEventListener('devicemotion', on);
    S.stop.push(() => window.removeEventListener('devicemotion', on));
    setTimeout(() => { if (!seen && ST.run === S) { S.note = 'No motion data: this device has no motion sensors, or the browser blocks them.'; } }, 2500);
  }
  async function startBLE(S) {
    const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] });
    const gatt = await dev.gatt.connect(), svc = await gatt.getPrimaryService('heart_rate'), ch = await svc.getCharacteristic('heart_rate_measurement');
    const on = (e) => { const t = now(); timed(S, 'src', () => 0); rrStep(S, t, e.target.value); };
    ch.addEventListener('characteristicvaluechanged', on); await ch.startNotifications();
    S.note = `Connected to ${dev.name || 'heart rate strap'}`;
    const gone = () => { S.note = 'Strap disconnected'; };
    dev.addEventListener('gattserverdisconnected', gone);
    S.stop.push(() => { try { ch.removeEventListener('characteristicvaluechanged', on); ch.stopNotifications().catch(() => {}); dev.removeEventListener('gattserverdisconnected', gone); if (dev.gatt.connected) dev.gatt.disconnect(); } catch { /* already gone */ } });
  }
  function startDemo(S, s) {
    const base = clamp((s.vitals && s.vitals.rhr) || 60, 45, 100); let ph = 0, tl = now(), alive = true, acc = 0;
    S.note = `Synthetic pulse around ${base} bpm with breathing-linked variation`;
    const tick = () => {
      if (!alive) return; requestAnimationFrame(tick);
      const t = now(); acc += t - tl; tl = t;
      while (acc >= 1 / 30) { // a steady 30 Hz, like a camera
        acc -= 1 / 30; const ts = t - acc, hrI = base * (1 + 0.05 * Math.sin((2 * Math.PI * (ts - S.t0)) / 10));
        ph += (1 / 30) * (hrI / 60); const p = ph % 1;
        const v = timed(S, 'src', () => 100 + 4 * (Math.exp(-(((p - 0.15) / 0.07) ** 2)) + 0.35 * Math.exp(-(((p - 0.45) / 0.09) ** 2))) + 1.5 * Math.sin((2 * Math.PI * (ts - S.t0)) / 7) + (Math.random() - 0.5) * 0.6);
        timed(S, 'ext', () => 0); S.contact = true; ppgStep(S, ts, v);
      }
    };
    requestAnimationFrame(tick);
    S.stop.push(() => { alive = false; });
  }

  /* ── live drawing: two lanes on one time axis (raw above, processed below), readouts, operator stats ── */
  function draw(S) {
    const cv = document.getElementById('st-wave'); if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth || 600, h = 220;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const css = getComputedStyle(cv), C = (n) => css.getPropertyValue(n).trim();
    const t1 = now(), span = S.kind === 'resp' ? 30 : S.kind === 'rr' ? 60 : 8, t0 = t1 - span, X = (t) => ((t - t0) / span) * (w - 8) + 4;
    const lane = (arr, y0, hh, color, lw) => {
      const pts = arr.filter((r) => r[0] >= t0); if (pts.length < 2) return null;
      let lo = Infinity, hi = -Infinity; pts.forEach((r) => { lo = Math.min(lo, r[1]); hi = Math.max(hi, r[1]); }); if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
      const Y = (v) => y0 + hh - ((v - lo) / (hi - lo)) * hh;
      g.strokeStyle = color; g.lineWidth = lw; g.lineJoin = 'round'; g.beginPath(); pts.forEach((r, i) => (i ? g.lineTo(X(r[0]), Y(r[1])) : g.moveTo(X(r[0]), Y(r[1])))); g.stroke();
      return { Y, pts };
    };
    g.strokeStyle = C('--line') || '#dde5f2'; g.lineWidth = 1; [0, 1, 2].forEach((i) => { const x = X(t1 - (i * span) / 2); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h - 16); g.stroke(); });
    g.fillStyle = C('--muted') || '#53638a'; g.font = '11px Inter, system-ui, sans-serif';
    const names = { ppg: ['Raw light level', 'Filtered pulse'], pcg: ['Sound energy', 'Envelope above the noise floor'], resp: ['Motion (strongest axis)', 'Breathing wave'], rr: ['Heart rate (bpm)', 'Beat-to-beat RR (ms)'] }[S.kind];
    g.fillText(names[0], 6, 12); g.fillText(names[1], 6, 104);
    g.fillText(`${span} s ago`, 6, h - 3); g.textAlign = 'right'; g.fillText('now', w - 4, h - 3); g.textAlign = 'left';
    lane(S.raw, 18, 70, C('--st-raw') || '#9aa8c4', 1.2);
    const P = lane(S.proc, 110, 86, C('--st-c1') || '#2a78d6', 2);
    if (P && S.kind !== 'resp') {
      g.fillStyle = C('--st-c2') || '#eb6834';
      S.beats.filter((b) => b >= t0).forEach((b) => { const r = P.pts.reduce((a, q) => (Math.abs(q[0] - b) < Math.abs(a[0] - b) ? q : a), P.pts[0]); g.beginPath(); g.arc(X(b), P.Y(r[1]), 4, 0, Math.PI * 2); g.fill(); });
    }
  }
  function readouts(S) {
    const set = (id, v) => { const el = document.getElementById(id); if (el && el.textContent !== String(v)) el.textContent = v; };
    const el = (S.t1 || now()) - S.t0;
    set('st-hr', S.hr == null ? '—' : S.hr); set('st-hrv', S.hrv == null ? '—' : S.hrv); set('st-br', S.br == null ? '—' : S.br);
    set('st-q', S.q == null ? '—' : S.q); set('st-pi', S.pi == null ? '—' : S.pi.toFixed(1)); set('st-time', `${Math.floor(el / 60)}:${String(Math.floor(el % 60)).padStart(2, '0')}`);
    set('st-note', S.kind === 'ppg' && !S.contact && S.src === 'camera' ? 'No fingertip on the lens yet' : S.note || '');
    const qb = document.getElementById('st-qbar'); if (qb) qb.style.width = clamp(S.q || 0, 0, 100) + '%';
    OPS[S.kind].forEach(([k]) => {
      const st = S.stats[k], box = document.querySelector(`.st-op[data-op="${k}"]`); if (!box || !st) return;
      const lat = st.lat.slice().sort((a, b) => a - b), avg = lat.length ? lat.reduce((a, b) => a + b, 0) / lat.length : 0, p95 = lat.length ? lat[Math.floor(lat.length * 0.95)] : 0, rate = st.n / Math.max(1, el);
      const f = (ms) => (ms < 0.1 ? '<0.1 ms' : `${ms.toFixed(ms < 10 ? 2 : 0)} ms`);
      box.querySelector('.st-op-s').textContent = k === 'out' ? `${S.frames} frames · ${S.dropped} dropped` : `${rate.toFixed(rate < 10 ? 1 : 0)}/s · avg ${f(avg)} · p95 ${f(p95)}`;
      box.classList.toggle('st-on', st.n > 0 || k === 'out');
    });
  }
  function loop() {
    const S = ST.run; if (!S) return;
    S.t1 = now(); draw(S);
    if (!S.lastRead || S.t1 - S.lastRead > 0.2) { S.lastRead = S.t1; readouts(S); }
    S.raf = requestAnimationFrame(loop);
  }

  /* ── start, stop, save ── */
  async function start(s) {
    const S = session(ST.src);
    try {
      if (ST.src === 'camera') { if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('This browser has no camera access'); await startCamera(S); }
      else if (ST.src === 'mic') { if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('This browser has no microphone access'); await startMic(S); }
      else if (ST.src === 'motion') { if (typeof DeviceMotionEvent === 'undefined') throw new Error('This device has no motion sensors'); await startMotion(S); }
      else if (ST.src === 'ble') { if (!navigator.bluetooth) throw new Error('Web Bluetooth needs Chrome or Edge on Android, Windows, macOS or ChromeOS'); await startBLE(S); }
      else startDemo(S, s);
    } catch (e) { S.stop.forEach((f) => { try { f(); } catch { /* */ } }); OS.toast(e && e.name === 'NotAllowedError' ? 'Permission was not given' : e && e.name === 'NotFoundError' ? 'No device was chosen' : (e && e.message) || 'Could not start'); return; }
    S.stats.out = S.stats.out || { n: 0, sum: 0, lat: [] };
    ST.run = S; ST.last = null;
    OS.render();
    S.raf = requestAnimationFrame(loop);
  }
  function stop(save) {
    const S = ST.run; if (!S) return;
    cancelAnimationFrame(S.raf); S.stop.forEach((f) => { try { f(); } catch { /* */ } });
    ST.run = null;
    const dur = Math.round((S.t1 || now()) - S.t0);
    ST.last = { at: new Date().toISOString(), src: S.src, dur, hr: S.hr, hrv: S.hrv, br: S.br, q: S.q, demo: S.src === 'demo', ...(S.kind === 'ppg' && S.pi != null ? { pi: S.pi } : {}) };
    if (save && ST.last.src !== 'demo' && dur >= 20 && (ST.last.hr || ST.last.br)) {
      const r = ST.last;
      OS.update((st) => { st.sensors = st.sensors || { log: [] }; st.sensors.log.push(r); st.sensors.log = st.sensors.log.slice(-300); });
      return;
    }
    OS.render();
  }

  /* ── input interfaces on this device ── */
  function inputs() {
    const has = {
      camera: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia), mic: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia), motion: typeof DeviceMotionEvent !== 'undefined',
      ble: !!navigator.bluetooth, usb: !!navigator.usb, serial: !!navigator.serial, hid: !!navigator.hid, nfc: 'NDEFReader' in window, files: true, net: true
    };
    const rows = [
      ['camera', 'Camera', 'Pulse from a fingertip, movement and form, body and skin scans, food barcodes', [['stream', 'Live sensors'], ['motion', 'Motion Lab'], ['ar', 'Form coach'], ['looks', 'Looks'], ['kitchen', 'Kitchen']], 'live'],
      ['mic', 'Microphone', 'Heart sounds, voice for Myo AI, sleep sounds', [['stream', 'Live sensors'], ['coach', 'Coach'], ['sleep', 'Sleep']], 'live'],
      ['motion', 'Motion sensors', 'Breathing with the phone on your belly', [['stream', 'Live sensors']], 'live'],
      ['ble', 'Bluetooth', 'Heart-rate straps, blood pressure cuffs, scales, pulse oximeters, thermometers, gym machines', [['stream', 'Live sensors'], ['connect', 'Connect'], ['machines', 'Machines']], 'live'],
      ['files', 'Files', 'Lab PDFs and CSVs, CT/MRI/X-ray/ultrasound DICOM and NIfTI scans, FHIR and HL7 records', [['biology', 'Biology'], ['imaging', 'Imaging'], ['connect', 'Connect']], 'live'],
      ['net', 'Cloud accounts', 'Oura and WHOOP; partners (CGMs, meal-prep) through the Myo Ingest API', [['wearables', 'Wearables'], ['connect', 'Connect']], 'live'],
      ['usb', 'USB', 'Lab-grade devices such as ECG patches and spirometers', [], 'planned'],
      ['serial', 'Serial', 'Research and maker sensors (EMG, EEG boards)', [], 'planned'],
      ['hid', 'HID', 'Foot pedals and controllers for hands-free capture', [], 'planned'],
      ['nfc', 'NFC', 'Implanted or wearable NFC tags you own', [['augment', 'Augment']], 'planned']
    ];
    return `<div class="tbl-wrap"><table class="tbl compact st-inputs"><caption class="sr">Input interfaces on this device and where Myo uses them</caption>
      <thead><tr><th scope="col">Interface</th><th scope="col">What Myo reads</th><th scope="col">Where</th><th scope="col">This device</th></tr></thead>
      <tbody>${rows.map(([k, n, what, where, stat]) => `<tr><th scope="row">${n}</th><td class="small">${what}</td><td class="small">${where.length ? where.map(([r, l]) => `<a href="#${r}">${l}</a>`).join(' · ') : pill('muted', 'Planned')}</td><td>${has[k] ? pill(stat === 'planned' ? 'muted' : 'good', stat === 'planned' ? 'Available' : 'Ready') : pill('muted', 'Not in this browser')}</td></tr>`).join('')}</tbody></table></div>`;
  }
  const BODY = [['Heart', 'Camera pulse, heart sounds, chest strap, watch exports, blood pressure cuff'], ['Lungs', 'Breathing rate (motion), blood oxygen (oximeter)'], ['Blood', 'Lab results, continuous glucose through partners'], ['Muscles and movement', 'Camera pose (jumps, squats, form), gym machines'], ['Body composition', 'Smart scale, DEXA and CT scans'], ['Brain and mind', 'Self-checks, cognition tests; EEG headbands planned'], ['Sleep and recovery', 'Ring or strap, sleep sound recordings'], ['Temperature', 'Thermometer, ring skin temperature']];

  function plan(kind) {
    return `<div class="st-plan" role="list">${OPS[kind].map(([k, n, d], i) => `<div class="st-op" role="listitem" data-op="${k}"><b>${n}</b><span class="st-op-d">${esc(d)}</span><span class="st-op-s">${i === 0 ? 'waiting' : ''}</span></div>${i < OPS[kind].length - 1 ? '<span class="st-arrow" aria-hidden="true">→</span>' : ''}`).join('')}</div>`;
  }

  OS.register('stream', {
    title: 'Live sensors', icon: 'stream',
    render(s) {
      const S = ST.run, cur = S ? S.src : ST.src, src = SRC[cur], kind = src.kind, L = ST.last, log = ((s.sensors && s.sensors.log) || []).slice(-12).reverse();
      const card = (k) => `<button class="st-src ${cur === k ? 'on' : ''}" data-act="st-src" data-k="${k}" ${S ? 'disabled' : ''} aria-pressed="${cur === k}"><b>${SRC[k].name}</b><span>${SRC[k].sub}</span><em>${SRC[k].input}</em></button>`;
      return `${OS.ui.head('Streaming pipeline · on-device', 'Live sensors', 'Turn your phone\'s camera, microphone and motion sensors, or a Bluetooth strap, into live body signals. Every step from sensor to number is shown as it runs. Nothing raw leaves this device.')}
      <section class="card st"><div class="card-h"><h2>1 · Choose a source</h2>${S ? pill('good', 'Running') : ''}</div>
        <div class="st-srcs">${Object.keys(SRC).map(card).join('')}</div>
        <ol class="st-how small">${src.how.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
        ${cur === 'mic' ? `<label class="ped-use tested"><input type="checkbox" data-change="st-listen" ${ST.listen ? 'checked' : ''}> Listen through headphones (digital stethoscope)</label>` : ''}
        <div class="st-go">${S ? `<button class="btn" data-act="st-stop">${icon('pause', 16)} Stop and save</button><button class="btn ghost" data-act="st-cancel">Discard</button>` : `<button class="btn" data-act="st-start">${icon('play', 16)} Start</button>`}<span class="muted small" id="st-note">${esc(S ? S.note : '')}</span></div></section>
      <section class="card st"><div class="card-h"><h2>2 · The pipeline</h2><span class="muted small">${S ? 'Live: rate and latency of every operator' : 'The plan for this source, before it runs'}</span></div>
        ${plan(kind)}
        <p class="fine">Compose, run, observe: each operator is timed on every sample, so you can see where the time goes from sensor to number. The p95 is the latency 95% of samples beat.</p></section>
      ${S || L ? `<section class="card st"><div class="card-h"><h2>3 · Signal</h2><span class="muted small">${S ? 'Two lanes on one time axis' : 'Last session'}</span></div>
        ${S ? '<canvas id="st-wave" class="st-wave" aria-label="Live signal: raw input above, processed signal below, with detected beats marked"></canvas>' : ''}
        <div class="st-read">
          <div><span>Heart rate</span><b class="num" id="st-hr">${L && L.hr ? L.hr : '—'}</b><em>bpm</em></div>
          <div><span>HRV (RMSSD)</span><b class="num" id="st-hrv">${L && L.hrv ? L.hrv : '—'}</b><em>ms</em></div>
          <div><span>Breathing</span><b class="num" id="st-br">${L && L.br ? L.br : '—'}</b><em>per min</em></div>
          ${kind === 'ppg' ? `<div><span>Perfusion index</span><b class="num" id="st-pi">${L && L.pi != null ? L.pi.toFixed(1) : '—'}</b><em>% · <a href="#flow">what it means</a></em></div>` : ''}
          <div><span>Signal quality</span><b class="num" id="st-q">${L ? L.q : '—'}</b><em>/ 100</em><i class="st-qbar"><i id="st-qbar" style="width:${L ? L.q : 0}%"></i></i></div>
          <div><span>Time</span><b class="num" id="st-time">${L ? `${Math.floor(L.dur / 60)}:${String(L.dur % 60).padStart(2, '0')}` : '0:00'}</b><em>min:s</em></div></div>
        ${!S && L ? `<div class="st-after">${L.demo ? '<p class="small muted">Demo sessions are not saved.</p>' : L.dur < 20 ? '<p class="small muted">Sessions under 20 seconds are not saved.</p>' : ''}
          ${!L.demo && L.hr && L.q >= 60 && L.src !== 'mic' ? `<button class="btn ghost sm" data-act="st-rhr">Use ${L.hr} bpm as today's resting heart rate</button>` : ''}
          ${L.hr && (L.hr > 120 || L.hr < 40) ? '<p class="small">A resting heart rate outside 40 to 120 can be normal for some people, but if you also feel faint, breathless or have chest pain, call your local emergency number.</p>' : ''}</div>` : ''}</section>` : ''}
      <div class="grid g-2">
        <section class="card"><div class="card-h"><h2>Sessions</h2><span class="muted small">Saved summaries only</span></div>
          ${log.length ? `<div class="tbl-wrap"><table class="tbl compact"><caption class="sr">Saved sensor sessions</caption><thead><tr><th scope="col">When</th><th scope="col">Source</th><th scope="col">HR</th><th scope="col">HRV</th><th scope="col">Breaths</th><th scope="col">Quality</th></tr></thead>
            <tbody>${log.map((r) => `<tr><th scope="row" class="small">${esc(new Date(r.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</th><td class="small">${esc(SRC[r.src] ? SRC[r.src].name : r.src)}</td><td class="num">${r.hr || '—'}</td><td class="num">${r.hrv || '—'}</td><td class="num">${r.br || '—'}</td><td class="num">${r.q}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">No sessions yet. Sessions of 20 seconds or more are saved when you press Stop and save.</p>'}</section>
        <section class="card"><div class="card-h"><h2>Body signals and where they come from</h2></div>
          <ul class="st-body">${BODY.map(([b, d]) => `<li><b>${b}</b><span class="small">${d}</span></li>`).join('')}</ul></section></div>
      <section class="card"><div class="card-h"><h2>Every input on this device</h2><span class="muted small">Checked in this browser just now</span></div>${inputs()}</section>
      <p class="fine">Live sensors give wellness estimates. Camera and microphone readings are less accurate than a chest strap, and Myo does not detect irregular rhythms, murmurs or any condition. Camera frames and audio are processed in memory and never stored or uploaded.</p>`;
    },
    mount() {
      if (ST.run && !ST.run.raf) ST.run.raf = requestAnimationFrame(loop);
      return () => { if (ST.run && location.hash.slice(1) !== 'stream') { cancelAnimationFrame(ST.run.raf); ST.run.stop.forEach((f) => { try { f(); } catch { /* */ } }); ST.run = null; } };
    }
  });
  OS.act('st-src', (el) => { if (ST.run) return; ST.src = el.dataset.k; ST.last = null; OS.render(); });
  OS.act('st-start', () => start(OS.state));
  OS.act('st-stop', () => stop(true));
  OS.act('st-cancel', () => stop(false));
  OS.change('st-listen', (el) => { ST.listen = el.checked; if (ST.run && ST.run.mon) ST.run.mon.gain.value = ST.listen ? 4 : 0; });
  OS.act('st-rhr', () => { const L = ST.last; if (!L || !L.hr) return; OS.update((s) => { s.vitals = s.vitals || {}; s.vitals.rhr = L.hr; }); OS.toast(`Resting heart rate set to ${L.hr} bpm for today`); });

  OS.stream = { parseHRM, period, session, ppgStep, pcgStep, respStep, rrStep, state: ST, SRC };
})();
