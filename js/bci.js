/* ═══ MYO — BCI LAB: brain–computer interface design and interfacing, toward full Myo BCI integration ═══
   Interface stack  · sensor → front end → edge processing → link → Myo Neural SDK → pipeline → decoders → intent bus
                      → apps, with consent and safety rails across every layer; device classes from scalp EEG to implants
   Signal lab       · live EEG from an OpenBCI Cyton (Web Serial), a Muse headband (Web Bluetooth, beta), an EDF/EDF+/BDF
                      recording, or a synthetic demo; notch, band-pass, artefact gate, Welch spectrum and band power,
                      every operator timed; electrode map with per-channel signal quality
   Decoder          · an alpha-switch BCI (close your eyes to select) with calibration, a scanning menu, a guided accuracy
                      test and the information transfer rate; no flashing stimuli
   Implant design   · channels, sampling, on-device reduction, radio and power against link and heat budgets
   Myo Neural API   · OS.neural: start, stop, on('features' | 'state' | 'intent' | 'marker'), mark; live event console,
                      stream descriptor, device profiles and formats
   Roadmap & rights · staged path from wellness EEG to implant partners, standards, neural-data rights, boundaries
   Boundaries: no surgical, implant-insertion or do-it-yourself guidance; no stimulation; no diagnosis from EEG.
   Raw EEG stays in memory on this device; only session summaries are saved, and only when you choose. */
(function () {
  'use strict';
  const { esc, icon, pill, clamp } = OS;
  const TABS = [['stack', 'Interface stack'], ['lab', 'Signal lab'], ['decode', 'Decoder'], ['design', 'Implant design'], ['api', 'Myo Neural API'], ['road', 'Roadmap & rights']];
  const BANDS = [['delta', 'Delta', 1, 4], ['theta', 'Theta', 4, 8], ['alpha', 'Alpha', 8, 13], ['beta', 'Beta', 13, 30], ['gamma', 'Gamma', 30, 45]];
  const SRC = {
    demo: { name: 'Demo signal', sub: '8-channel synthetic EEG with alpha, blinks and mains hum', input: 'Simulated' },
    cyton: { name: 'OpenBCI Cyton', sub: '8 channels at 250 Hz through its USB dongle', input: 'Web Serial' },
    muse: { name: 'Muse headband', sub: '4 channels at 256 Hz', input: 'Bluetooth · beta' },
    file: { name: 'EEG recording', sub: 'EDF, EDF+ or BDF, played through the pipeline', input: 'File' }
  };
  const OPS = [['src', 'Source', 'samples in'], ['notch', 'Notch', 'mains hum and its harmonic'], ['band', 'Band-pass', '1–45 Hz'], ['gate', 'Artefact gate', 'blinks, movement, flat or noisy'], ['spec', 'Spectrum', 'Welch PSD, Hann window'], ['feat', 'Features', 'band power, engagement, alpha'], ['dec', 'Decoder', 'alpha switch → intents'], ['out', 'Intent bus', 'OS.neural events']];
  const MENU = ['Start breathwork', 'Log: feeling calm', 'Log: feeling focused', 'Pause music'];
  const CAL_S = 20, DWELL = 1.0, TRIAL = 5;
  const RADIO = { ble1: ['Bluetooth LE, 1M PHY', 0.7e6], ble2: ['Bluetooth LE, 2M PHY', 1.4e6], nf: ['Near-field or UWB custom link', 20e6], wired: ['Wired (percutaneous connector)', 100e6] };
  const MODES = { raw: 'Raw broadband', lfp: 'Local field potentials (to 1 kHz)', sbp: 'Spike-band power (50 Hz per channel)', spikes: 'Spike events only', intent: 'Decoded intent only' };

  function guessMains() {
    let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* old browser */ }
    if (/^America\//.test(tz)) return /Argentina|Montevideo|Asuncion|Santiago|La_Paz/.test(tz) ? 50 : 60;
    return /Seoul|Taipei|Manila|Riyadh|Tokyo|Osaka/.test(tz) ? 60 : 50;
  }
  const NS = { tab: 'stack', src: 'demo', mains: guessMains(), scale: 50, view: 'flt', run: null, last: null, eyes: false, speed: 1, file: null, busy: '', listeners: {}, con: [],
    dec: { phase: 'idle', cal: { open: [], closed: [] }, thr: null, sd: null, sep: null, acc: null, closed: false, since: null, lastFire: -9, menu: 0, menuT: 0, picks: [], test: null, conf: 0, phaseT: 0, lastTest: null, lo: null, hi: null },
    design: { ch: 1024, fs: 20000, bits: 10, mode: 'sbp', radio: 'ble2', afe: 6, ebit: 10, proc: 2, area: 4, mah: 100 } };

  /* ── event bus: OS.neural ── */
  function emit(type, e) {
    const msg = { type, ...e };
    if (type !== 'features' || (NS.run && NS.run.nFeat % 4 === 0)) { NS.con.unshift(msg); NS.con = NS.con.slice(0, 14); }
    (NS.listeners[type] || []).forEach((fn) => { try { fn(msg); } catch (err) { console.error('[Myo neural listener]', err); } });
  }

  /* ── DSP: biquads, FFT, Hann ── */
  function biquad(type, fs, f0, Q) {
    const w = (2 * Math.PI * f0) / fs, c = Math.cos(w), s = Math.sin(w), al = s / (2 * Q);
    let b0, b1, b2; if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; } else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; } else { b0 = 1; b1 = -2 * c; b2 = 1; }
    const a0 = 1 + al, B0 = b0 / a0, B1 = b1 / a0, B2 = b2 / a0, A1 = (-2 * c) / a0, A2 = (1 - al) / a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    return (x) => { const y = B0 * x + B1 * x1 + B2 * x2 - A1 * y1 - A2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
  }
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const a = i + k, b = a + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr; re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } }
    }
  }
  const hann = (N) => { const w = new Float64Array(N); let u = 0; for (let k = 0; k < N; k++) { w[k] = 0.5 - 0.5 * Math.cos((2 * Math.PI * k) / (N - 1)); u += w[k] * w[k]; } return { w, u }; };
  function chain(fs) { const m = NS.mains; return { x0: null, me: 0, hp: biquad('hp', fs, 1, 0.7071), n1: biquad('notch', fs, m, 25), n2: 2 * m < fs * 0.47 ? biquad('notch', fs, 2 * m, 25) : null, lp: biquad('lp', fs, Math.min(45, fs * 0.45), 0.7071) }; }
  const clean = (l) => String(l || '').replace(/^EEG\s+/i, '').replace(/[-–/].*$/, '').trim() || 'Ch';

  /* ── the session ── */
  function session(src, fs, labels, extra = {}) {
    const n = labels.length, cap = Math.round(fs * 10), N = fs > 300 ? 1024 : 512;
    return { src, fs, labels, n, cap, w: 0, total: 0, t0: performance.now(), wall0: Date.now(), raw: labels.map(() => new Float32Array(cap)), flt: labels.map(() => new Float32Array(cap)),
      chain: labels.map(() => chain(fs)), N, win: hann(N), psd: labels.map(() => new Float64Array(N / 2 + 1)), nFeat: 0, sinceFeat: 0,
      q: labels.map(() => ({ s: 'wait', why: 'Starting' })), bands: null, rel: null, eng: null, alpha: null, blinks: [], lastBlink: -9, dropped: 0, lastNum: null, marks: [], featLog: [],
      stats: Object.fromEntries(OPS.map(([k]) => [k, { n: 0, sum: 0, lat: [] }])), stop: [], note: '', sum: { n: 0, rel: [0, 0, 0, 0, 0], eng: 0, q: 0 }, raf: null, lastGen: null, carry: 0, ...extra };
  }
  const stat = (S, k, ms, n = 1) => { const x = S.stats[k]; x.n += n; x.sum += ms; x.lat.push(ms); if (x.lat.length > 200) x.lat.shift(); };
  function pushBlock(S, frames) {
    const m = frames.length; if (!m) return;
    const w0 = S.w, cap = S.cap; let t = performance.now();
    stat(S, 'src', 0, m);
    const tmp = [];
    for (let c = 0; c < S.n; c++) {
      const C = S.chain[c], col = new Float32Array(m), R = S.raw[c];
      for (let k = 0; k < m; k++) { const x = frames[k][c] || 0; R[(w0 + k) % cap] = x; if (C.x0 == null) C.x0 = x; const a = C.hp(x - C.x0); let b = C.n1(a); if (C.n2) b = C.n2(b); const d = a - b; C.me = C.me * 0.998 + d * d * 0.002; col[k] = b; }
      tmp.push(col);
    }
    stat(S, 'notch', performance.now() - t, m); t = performance.now();
    for (let c = 0; c < S.n; c++) { const C = S.chain[c], col = tmp[c], F = S.flt[c]; for (let k = 0; k < m; k++) F[(w0 + k) % cap] = C.lp(col[k]); }
    stat(S, 'band', performance.now() - t, m);
    S.w = (w0 + m) % cap; S.total += m; S.sinceFeat += m;
    const hop = Math.round(S.fs / 4);
    while (S.sinceFeat >= hop) { S.sinceFeat -= hop; if (S.total >= S.N) features(S); }
  }
  const at = (S, arr, back) => arr[(S.w - 1 - back + S.cap * 4) % S.cap];
  function features(S) {
    let t = performance.now();
    const L1 = Math.min(S.cap, Math.round(S.fs)), tt = S.total / S.fs;
    for (let c = 0; c < S.n; c++) {
      let s2 = 0, hi = -Infinity, lo = Infinity; for (let k = 0; k < L1; k++) { const v = at(S, S.flt[c], k); s2 += v * v; if (v > hi) hi = v; if (v < lo) lo = v; }
      const rms = Math.sqrt(s2 / L1), hum = Math.sqrt(S.chain[c].me);
      S.q[c] = tt < 2 ? { s: 'wait', why: 'Settling' } : rms < 0.3 ? { s: 'poor', why: 'Flat: check contact' } : rms > 80 ? { s: 'poor', why: 'Very noisy' } : hi - lo > 150 ? { s: 'fair', why: 'Blink or movement' } : hum > 15 ? { s: 'fair', why: 'Mains interference' } : { s: 'good', why: 'Clean' };
    }
    const fr = S.labels.map((l, c) => (/^(Fp|AF|F\d|Fz)/i.test(l) ? c : -1)).filter((c) => c >= 0);
    // blinks: a large, brief swing on the frontal channels (peak to peak over half a second)
    if (fr.length && tt > 2) { let p2p = 0; const L = Math.round(S.fs / 2); fr.forEach((c) => { let hi = -Infinity, lo = Infinity; for (let k = 0; k < L; k++) { const v = at(S, S.flt[c], k); if (v > hi) hi = v; if (v < lo) lo = v; } p2p = Math.max(p2p, hi - lo); }); if (p2p > 110 && tt - S.lastBlink > 0.6) { S.lastBlink = tt; S.blinks.push(tt); } }
    S.blinks = S.blinks.filter((b) => tt - b < 60);
    stat(S, 'gate', performance.now() - t); t = performance.now();
    const N = S.N, re = new Float64Array(N), im = new Float64Array(N), df = S.fs / N, A = S.nFeat ? 0.35 : 1;
    for (let c = 0; c < S.n; c++) {
      for (let k = 0; k < N; k++) { re[k] = at(S, S.flt[c], N - 1 - k) * S.win.w[k]; im[k] = 0; }
      fft(re, im);
      const P = S.psd[c];
      for (let k = 0; k <= N / 2; k++) { const p = ((re[k] * re[k] + im[k] * im[k]) / (S.fs * S.win.u)) * (k && k < N / 2 ? 2 : 1); P[k] = P[k] * (1 - A) + p * A; }
    }
    stat(S, 'spec', performance.now() - t); t = performance.now();
    const bp = S.labels.map((_, c) => BANDS.map(([, , lo, hi]) => { let s = 0; for (let k = Math.ceil(lo / df); k * df < hi && k <= N / 2; k++) s += S.psd[c][k] * df; return s; }));
    const good = S.q.map((q, c) => (q.s === 'good' || q.s === 'fair' ? c : -1)).filter((c) => c >= 0), use = good.length ? good : S.labels.map((_, c) => c);
    const mean = BANDS.map((_, b) => use.reduce((a, c) => a + bp[c][b], 0) / use.length), tot = mean.reduce((a, b) => a + b, 0) || 1;
    S.bands = bp; S.rel = mean.map((v) => v / tot); S.eng = mean[3] / (mean[1] + mean[2] || 1);
    const post = S.labels.map((l, c) => (/^(O|PO|P\d|Pz|TP|T5|T6)/i.test(l) ? c : -1)).filter((c) => c >= 0), pc = post.length ? post : use;
    S.alpha = Math.log10(pc.reduce((a, c) => a + bp[c][2], 0) / pc.length + 1e-9);
    if (tt > 3) { S.sum.n++; S.sum.rel = S.sum.rel.map((v, i) => v + S.rel[i]); S.sum.eng += S.eng; S.sum.q += good.length / S.n; }
    S.nFeat++;
    if (S.nFeat % 4 === 0 && S.featLog.length < 7200) S.featLog.push([+tt.toFixed(2), ...S.rel.map((v) => +v.toFixed(4)), +S.eng.toFixed(4), +S.alpha.toFixed(4), good.length]);
    stat(S, 'feat', performance.now() - t); t = performance.now();
    decode(S);
    stat(S, 'dec', performance.now() - t); t = performance.now();
    emit('features', { t: +tt.toFixed(2), rel: Object.fromEntries(BANDS.map(([k], i) => [k, +S.rel[i].toFixed(3)])), engagement: +S.eng.toFixed(3), quality: S.q.map((q) => q.s) });
    stat(S, 'out', performance.now() - t);
  }

  /* ── alpha-switch decoder ── */
  let AC = null;
  function beep(fq, d) {
    try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime; o.frequency.value = fq; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.15, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(AC.destination); o.start(t); o.stop(t + d + 0.05); } catch { /* no audio */ }
  }
  const demoFollow = (want, delay = 600, sure = false) => { const S = NS.run; if (!S || S.src !== 'demo') return; setTimeout(() => { NS.eyes = sure || Math.random() < 0.9 ? !!want : !want; }, delay); };
  function startCal() {
    const S = NS.run, D = NS.dec; if (!S) return;
    Object.assign(D, { phase: 'cal-open', cal: { open: [], closed: [] }, phaseT: S.total / S.fs, thr: null, test: null });
    beep(440, 0.3); demoFollow(false, 0); OS.render();
  }
  function finishCal(S) {
    const D = NS.dec, o = D.cal.open, c = D.cal.closed;
    const mean = (x) => x.reduce((a, b) => a + b, 0) / (x.length || 1), sdv = (x, m) => Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, x.length - 1));
    const mo = mean(o), mc = mean(c), sd = Math.sqrt((sdv(o, mo) ** 2 + sdv(c, mc) ** 2) / 2) || 0.05;
    Object.assign(D, { thr: (mo + mc) / 2, sd, sep: (mc - mo) / sd, lo: mo - 2 * sd, hi: mc + 2 * sd, menuT: S.total / S.fs, closed: false, lastFire: S.total / S.fs + 1.5 });
    D.acc = (o.filter((v) => v < D.thr).length + c.filter((v) => v >= D.thr).length) / (o.length + c.length || 1);
    D.phase = D.sep >= 1 ? 'ready' : 'weak';
    demoFollow(false, 0); beep(660, 0.15); setTimeout(() => beep(880, 0.15), 180);
    emit('calibrated', { threshold: +D.thr.toFixed(3), separation: +D.sep.toFixed(2), accuracy: +D.acc.toFixed(2) });
    if (OS.current === 'bci') OS.render();
  }
  const bitsPer = (P, N = 2) => (P <= 1 / N ? 0 : P >= 1 ? Math.log2(N) : Math.log2(N) + P * Math.log2(P) + (1 - P) * Math.log2((1 - P) / (N - 1)));
  function startTest() {
    const S = NS.run, D = NS.dec; if (!S || D.thr == null) return;
    const tr = [1, 1, 1, 1, 1, 0, 0, 0, 0, 0].sort(() => Math.random() - 0.5);
    D.test = { trials: tr, i: -1, res: [], votes: [], t0: 0 }; D.phase = 'test'; nextTrial(S); OS.render();
  }
  function nextTrial(S) {
    const D = NS.dec, T = D.test; T.i++; T.votes = [];
    if (T.i >= T.trials.length) {
      const P = T.res.filter(Boolean).length / T.res.length; D.lastTest = { P, itr: (bitsPer(P) * 60) / TRIAL, n: T.res.length, at: Date.now() };
      D.test = null; D.phase = 'ready'; D.lastFire = S.total / S.fs + 1.5; demoFollow(false, 0); beep(880, 0.12); setTimeout(() => beep(880, 0.12), 160);
      emit('test', { accuracy: +P.toFixed(2), itrBitsPerMin: +D.lastTest.itr.toFixed(1), trials: D.lastTest.n });
      if (OS.current === 'bci') OS.render(); return;
    }
    T.t0 = S.total / S.fs; const want = T.trials[T.i]; beep(want ? 880 : 440, 0.3); demoFollow(want);
  }
  function decode(S) {
    const D = NS.dec, t = S.total / S.fs, a = S.alpha;
    if (D.phase === 'cal-open' || D.phase === 'cal-closed') {
      const el = t - D.phaseT; if (el > 3) (D.phase === 'cal-open' ? D.cal.open : D.cal.closed).push(a);
      if (el >= CAL_S) { if (D.phase === 'cal-open') { D.phase = 'cal-closed'; D.phaseT = t; beep(880, 0.3); demoFollow(true, 600, true); } else finishCal(S); }
      return;
    }
    if (D.thr == null) return;
    const h = D.sd * 0.3, was = D.closed;
    D.closed = was ? a > D.thr - h : a > D.thr + h;
    D.conf = 1 / (1 + Math.exp((-2 * Math.abs(a - D.thr)) / (D.sd || 0.1)));
    if (D.closed && !was) D.since = t; if (!D.closed) D.since = null;
    if (D.closed !== was) emit('state', { t: +t.toFixed(2), state: D.closed ? 'eyes-closed' : 'eyes-open', confidence: +D.conf.toFixed(2) });
    if (D.phase === 'ready') {
      if (D.closed && D.since != null && t - D.since >= DWELL && t - D.lastFire > 2.5) {
        D.lastFire = t; const opt = MENU[D.menu]; D.picks.unshift({ at: Date.now(), opt }); D.picks = D.picks.slice(0, 6);
        emit('intent', { t: +t.toFixed(2), kind: 'select', target: opt, confidence: +D.conf.toFixed(2), dwellMs: DWELL * 1000, decoder: 'alpha-switch' }); beep(660, 0.12);
      }
      if (!D.closed && t - D.menuT > 2.5) { D.menu = (D.menu + 1) % MENU.length; D.menuT = t; }
    }
    if (D.phase === 'test' && D.test) { const T = D.test, el = t - T.t0; if (el >= 1.5) T.votes.push(D.closed ? 1 : 0); if (el >= TRIAL) { const v = T.votes.reduce((x, y) => x + y, 0) / (T.votes.length || 1) >= 0.5 ? 1 : 0; T.res.push(v === T.trials[T.i]); nextTrial(S); } }
  }

  /* ── sources ── */
  function pinkGen() { let b0 = 0, b1 = 0, b2 = 0; return () => { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; return (0.35 * b0 + 0.8 * b1 + b2 + w * 0.1848) * 0.5; }; }
  function demoGen(fs) {
    const L = ['Fp1', 'Fp2', 'C3', 'C4', 'P3', 'P4', 'O1', 'O2'], AW = [0.12, 0.12, 0.35, 0.35, 0.7, 0.7, 1, 1], BW = [1, 1, 0.18, 0.18, 0.06, 0.06, 0.03, 0.03];
    const PH = L.map(() => Math.random() * 6.28), pk = L.map(() => pinkGen());
    let t = 0, amp = 4, nextBlink = 2 + Math.random() * 3, blinkT = -9, was = false;
    return { labels: L, next(n) {
      const out = [];
      for (let k = 0; k < n; k++) {
        t += 1 / fs; amp += ((NS.eyes ? 24 : 4) - amp) / (0.35 * fs);
        if (NS.eyes !== was) { was = NS.eyes; blinkT = t; }
        if (!NS.eyes && t > nextBlink) { blinkT = t; nextBlink = t + 2 + Math.random() * 4; }
        const bl = 130 * Math.exp(-(((t - blinkT - 0.15) / 0.07) ** 2)), am = 1 + 0.35 * Math.sin(2 * Math.PI * 0.4 * t), fr = new Float32Array(8);
        for (let c = 0; c < 8; c++) fr[c] = 6 * pk[c]() + amp * am * AW[c] * Math.sin(2 * Math.PI * 10.2 * t + PH[c]) + 1.6 * Math.sin(2 * Math.PI * 21 * t + 2 * PH[c]) + bl * BW[c] + 8 * Math.sin(2 * Math.PI * NS.mains * t) + 40;
        out.push(fr);
      }
      return out;
    } };
  }
  const CY_SCALE = (4.5 / 24 / (2 ** 23 - 1)) * 1e6;
  function parseCyton(m, S) {
    const frames = []; let i = 0;
    while (i + 33 <= m.length) {
      if (m[i] !== 0xa0 || (m[i + 32] & 0xf0) !== 0xc0) { i++; continue; }
      const sn = m[i + 1]; if (S.lastNum != null) S.dropped += (sn - S.lastNum - 1 + 256) % 256; S.lastNum = sn;
      const fr = new Float32Array(8); for (let c = 0; c < 8; c++) { const b = i + 2 + 3 * c; let v = (m[b] << 16) | (m[b + 1] << 8) | m[b + 2]; if (v & 0x800000) v -= 0x1000000; fr[c] = v * CY_SCALE; }
      frames.push(fr); i += 33;
    }
    return { frames, rest: m.slice(i) };
  }
  async function startCyton() {
    if (!('serial' in navigator)) throw new Error('Web Serial needs Chrome or Edge on a computer.');
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    const S = session('cyton', 250, ['Fp1', 'Fp2', 'C3', 'C4', 'P7', 'P8', 'O1', 'O2']);
    const writer = port.writable.getWriter(), enc = new TextEncoder(), send = (c) => writer.write(enc.encode(c)).catch(() => {});
    const reader = port.readable.getReader(); let alive = true, pend = new Uint8Array(0);
    (async () => {
      try { while (alive) { const { value, done } = await reader.read(); if (done) break; if (!value) continue; const m = new Uint8Array(pend.length + value.length); m.set(pend); m.set(value, pend.length); const r = parseCyton(m, S); pend = r.rest.length > 4096 ? r.rest.slice(-66) : r.rest; if (r.frames.length) pushBlock(S, r.frames); } }
      catch (e) { if (alive) S.note = `Serial: ${e.message || e}`; }
    })();
    send('v'); setTimeout(() => { if (alive) { send('b'); S.note = 'Streaming from the board'; } }, 1500);
    S.note = 'Resetting the board…';
    S.stop.push(async () => { alive = false; await send('s'); try { await reader.cancel(); } catch { /* closed */ } try { reader.releaseLock(); writer.releaseLock(); await port.close(); } catch { /* closed */ } });
    return S;
  }
  const MU = { svc: 0xfe8d, ctrl: '273e0001-4c4d-454d-96be-f03bac821358', eeg: ['273e0003', '273e0004', '273e0005', '273e0006'].map((x) => `${x}-4c4d-454d-96be-f03bac821358`), labels: ['TP9', 'AF7', 'AF8', 'TP10'] };
  function unpack12(b) { const o = []; for (let i = 0; i < b.length; i++) { if (i % 3 === 0) o.push((b[i] << 4) | (b[i + 1] >> 4)); else { o.push(((b[i] & 0xf) << 8) | b[i + 1]); i++; } } return o; }
  async function startMuse() {
    if (!navigator.bluetooth) throw new Error('Web Bluetooth needs Chrome or Edge on Android, Windows, macOS or ChromeOS.');
    const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: [MU.svc] }] });
    const g = await dev.gatt.connect(), svc = await g.getPrimaryService(MU.svc), ctrl = await svc.getCharacteristic(MU.ctrl);
    const cmd = (c) => { const e = new TextEncoder().encode(`X${c}\n`); e[0] = e.length - 1; return ctrl.writeValue(e); };
    const S = session('muse', 256, MU.labels), Q = MU.labels.map(() => []);
    const drain = () => { const k = Math.min(...Q.map((q) => q.length)); if (!k) return; const frames = []; for (let i = 0; i < k; i++) { const fr = new Float32Array(4); for (let c = 0; c < 4; c++) fr[c] = Q[c][i]; frames.push(fr); } Q.forEach((q) => q.splice(0, k)); pushBlock(S, frames); };
    for (let c = 0; c < 4; c++) {
      const ch = await svc.getCharacteristic(MU.eeg[c]);
      ch.addEventListener('characteristicvaluechanged', (ev) => { const dv = ev.target.value; Q[c].push(...unpack12(new Uint8Array(dv.buffer, dv.byteOffset + 2, dv.byteLength - 2)).map((v) => 0.48828125 * (v - 0x800))); drain(); });
      await ch.startNotifications();
    }
    await cmd('h'); await cmd('p21'); await cmd('s'); await cmd('d');
    S.note = 'Streaming from the headband';
    dev.addEventListener('gattserverdisconnected', () => { S.note = 'Headband disconnected'; });
    S.stop.push(async () => { try { await cmd('h'); } catch { /* gone */ } try { dev.gatt.disconnect(); } catch { /* gone */ } });
    return S;
  }
  function parseEDF(buf, name = 'recording') {
    const u8 = new Uint8Array(buf); if (u8.length < 256) throw new Error('This file is too small to be EDF or BDF.');
    const A = (o, n) => String.fromCharCode(...u8.subarray(o, o + n)).trim();
    const bdf = u8[0] === 255, ns = parseInt(A(252, 4), 10), hb = parseInt(A(184, 8), 10), nRec0 = parseInt(A(236, 8), 10), dur = parseFloat(A(244, 8)) || 1;
    if (!(ns > 0 && ns < 512) || hb !== 256 * (ns + 1)) throw new Error('This does not look like an EDF or BDF file.');
    let o = 256; const fld = (len) => { const a = []; for (let i = 0; i < ns; i++) { a.push(A(o, len)); o += len; } return a; };
    const labels = fld(16); fld(80); const dim = fld(8), pmin = fld(8).map(Number), pmax = fld(8).map(Number), dmin = fld(8).map(Number), dmax = fld(8).map(Number); fld(80); const nsamp = fld(8).map(Number);
    const bps = bdf ? 3 : 2, rec = nsamp.reduce((a, b) => a + b, 0) * bps, avail = Math.floor((u8.length - hb) / rec), nRec = nRec0 > 0 ? Math.min(nRec0, avail) : avail;
    if (nRec < 1) throw new Error('This file has a header but no data records.');
    const rate = nsamp.map((n) => n / dur), sig = labels.map((l, i) => i).filter((i) => !/annotation|status/i.test(labels[i]) && rate[i] >= 100);
    if (!sig.length) throw new Error('No EEG-rate signals (100 Hz or faster) in this file.');
    const cnt = {}; sig.forEach((i) => { cnt[rate[i]] = (cnt[rate[i]] || 0) + 1; });
    const fs = +Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0], keep = sig.filter((i) => rate[i] === fs).slice(0, 32), maxRec = Math.min(nRec, Math.ceil(3600 / dur));
    const unitK = (d) => { const x = d.toLowerCase(); return x === 'v' ? 1e6 : x === 'mv' ? 1000 : x === 'nv' ? 0.001 : 1; };
    const offs = []; let p = 0; nsamp.forEach((n) => { offs.push(p); p += n * bps; });
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), per = nsamp[keep[0]];
    const data = keep.map((i) => {
      const g = (pmax[i] - pmin[i]) / (dmax[i] - dmin[i] || 1), off = pmin[i] - g * dmin[i], k = unitK(dim[i]), n = nsamp[i], out = new Float32Array(maxRec * per);
      for (let r = 0; r < maxRec; r++) { const base = hb + r * rec + offs[i]; for (let s = 0; s < n; s++) { let v; if (bdf) { const b = base + s * 3; v = u8[b] | (u8[b + 1] << 8) | (u8[b + 2] << 16); if (v & 0x800000) v -= 0x1000000; } else v = dv.getInt16(base + s * 2, true); out[r * n + s] = (v * g + off) * k; } }
      return out;
    });
    return { name, labels: keep.map((i) => clean(labels[i]) || `Ch${i + 1}`), fs, data, seconds: maxRec * dur, bdf, start: `${A(168, 8)} ${A(176, 8)}` };
  }

  /* ── run, stop, save ── */
  async function start(kind) {
    if (NS.run) await stop(false);
    let S;
    if (kind === 'demo') { const G = demoGen(256); S = session('demo', 256, G.labels, { gen: G }); NS.eyes = false; }
    else if (kind === 'cyton') S = await startCyton();
    else if (kind === 'muse') S = await startMuse();
    else if (kind === 'file' && NS.file) S = session('file', NS.file.fs, NS.file.labels, { fileData: NS.file, pos: 0, fileName: NS.file.name });
    else if (kind && kind.arrayBuffer) { NS.file = parseEDF(await kind.arrayBuffer(), kind.name); S = session('file', NS.file.fs, NS.file.labels, { fileData: NS.file, pos: 0, fileName: NS.file.name }); }
    else throw new Error('Unknown source');
    NS.src = S.src; NS.run = S; NS.last = null; NS.dec.phase = NS.dec.thr != null ? 'ready' : 'idle'; NS.dec.test = null;
    emit('started', { source: S.src, channels: S.labels, sampleRate: S.fs });
    if (OS.current === 'bci') OS.render();
    if ((S.gen || S.fileData) && !S.pump) { S.pump = setInterval(() => pump(S), 40); S.stop.push(() => clearInterval(S.pump)); }
    if (!S.raf) S.raf = requestAnimationFrame(loop);
    return S;
  }
  function summaryOf(S) {
    const n = S.sum.n || 1;
    return { at: new Date().toISOString(), src: S.src, dur: Math.round(S.total / S.fs), ch: S.n, fs: S.fs, rel: Object.fromEntries(BANDS.map(([k], i) => [k, +(S.sum.rel[i] / n).toFixed(3)])), eng: +(S.sum.eng / n).toFixed(3), q: Math.round((S.sum.q / n) * 100), blinks: S.blinks.length, file: S.fileName || null, test: NS.dec.lastTest ? { acc: Math.round(NS.dec.lastTest.P * 100), itr: +NS.dec.lastTest.itr.toFixed(1) } : null, featLog: S.featLog, labels: S.labels };
  }
  async function stop(render = true) {
    const S = NS.run; if (!S) return;
    NS.run = null; cancelAnimationFrame(S.raf);
    for (const f of S.stop) { try { await f(); } catch { /* device already gone */ } }
    if (S.sum.n) NS.last = summaryOf(S);
    if (NS.dec.phase !== 'ready' && NS.dec.phase !== 'weak') NS.dec.phase = NS.dec.thr != null ? 'ready' : 'idle';
    NS.dec.test = null; NS.eyes = false;
    emit('stopped', { source: S.src, seconds: Math.round(S.total / S.fs) });
    if (render && OS.current === 'bci') OS.render();
  }
  // demo and file sources run on a timer so the pipeline keeps real time even when drawing slows or the tab is hidden
  function pump(S) {
    if (NS.run !== S) return;
    const now = performance.now(), dt = S.lastGen == null ? 0.04 : Math.min(1, (now - S.lastGen) / 1000); S.lastGen = now;
    const want = dt * S.fs * (S.fileData ? NS.speed : 1) + S.carry, n = Math.floor(want); S.carry = want - n;
    if (n <= 0) return;
    if (S.gen) { pushBlock(S, S.gen.next(n)); return; }
    const F = S.fileData, len = F.data[0].length, k = Math.min(n, len - S.pos), frames = [];
    for (let i = 0; i < k; i++) { const fr = new Float32Array(S.n); for (let c = 0; c < S.n; c++) fr[c] = F.data[c][S.pos + i]; frames.push(fr); }
    S.pos += k; pushBlock(S, frames);
    if (S.pos >= len) { S.note = 'End of recording'; stop(); }
  }
  function loop() {
    const S = NS.run; if (!S) return;
    const now = performance.now();
    draw(S); if (now - (S.lastUi || 0) > 200) { S.lastUi = now; readouts(S); }
    S.raf = requestAnimationFrame(loop);
  }

  /* ── drawing ── */
  const cssv = (el, k, d) => (getComputedStyle(el).getPropertyValue(k) || '').trim() || d;
  function sizeCv(cv) { const r = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight; if (cv.width !== Math.round(w * r) || cv.height !== Math.round(h * r)) { cv.width = Math.round(w * r); cv.height = Math.round(h * r); } const g = cv.getContext('2d'); g.setTransform(r, 0, 0, r, 0, 0); return [g, w, h]; }
  function draw(S) {
    const tr = document.getElementById('bci-tr'), sp = document.getElementById('bci-sp');
    if (tr && tr.clientWidth) {
      const [g, W, H] = sizeCv(tr), lanes = S.n, lh = H / lanes, ns = Math.min(S.cap, Math.round(5 * S.fs)), src = NS.view === 'raw' ? S.raw : S.flt, x0 = 46;
      const ink = cssv(tr, '--bci-ink', '#223'), mute = cssv(tr, '--muted', '#889'), line = cssv(tr, '--line', '#ddd');
      g.clearRect(0, 0, W, H); g.font = '11px ui-monospace, monospace'; g.textBaseline = 'middle';
      const step = Math.max(1, Math.floor(ns / ((W - x0) * 1.5)));
      for (let c = 0; c < lanes; c++) {
        const y0 = lh * (c + 0.5); g.strokeStyle = line; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, y0); g.lineTo(W, y0); g.stroke();
        g.fillStyle = mute; g.fillText(S.labels[c], 4, y0);
        let mean = 0; if (NS.view === 'raw') { for (let k = 0; k < ns; k += step) mean += at(S, src[c], k); mean /= Math.ceil(ns / step); }
        g.strokeStyle = ink; g.lineWidth = 1.1; g.beginPath();
        for (let k = 0; k < ns; k += step) { const v = at(S, src[c], ns - 1 - k) - mean, x = x0 + (k / ns) * (W - x0), y = y0 - clamp(v / NS.scale, -1.2, 1.2) * (lh / 2) * 0.9; if (k) g.lineTo(x, y); else g.moveTo(x, y); }
        g.stroke();
      }
      g.fillStyle = mute; g.textBaseline = 'alphabetic'; g.fillText('5 s ago', x0, H - 3); g.textAlign = 'right'; g.fillText('now', W - 2, H - 3); g.textAlign = 'left';
    }
    if (sp && sp.clientWidth && S.nFeat) {
      const [g, W, H] = sizeCv(sp), L = 40, R = 8, T = 18, B = 22, df = S.fs / S.N, c1 = cssv(sp, '--bci-c1', '#2a78d6'), mute = cssv(sp, '--muted', '#889'), line = cssv(sp, '--line', '#ddd'), band = cssv(sp, '--card-2', '#f3f4f7');
      g.clearRect(0, 0, W, H); g.font = '11px system-ui, sans-serif';
      const X = (f) => L + ((f - 1) / 44) * (W - L - R);
      const good = S.q.map((q, c) => (q.s === 'good' || q.s === 'fair' ? c : -1)).filter((c) => c >= 0), use = good.length ? good : S.labels.map((_, c) => c);
      const P = []; for (let k = Math.ceil(1 / df); k * df <= 45; k++) P.push([k * df, Math.log10(use.reduce((a, c) => a + S.psd[c][k], 0) / use.length + 1e-6)]);
      let lo = Math.floor(Math.min(...P.map((p) => p[1]))), hi = Math.ceil(Math.max(...P.map((p) => p[1]))); if (hi - lo < 2) hi = lo + 2;
      const Y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B);
      BANDS.forEach(([, n, a, b], i) => { if (i % 2 === 0) { g.fillStyle = band; g.fillRect(X(a), T, X(b) - X(a), H - T - B); } g.fillStyle = mute; g.textAlign = 'center'; g.fillText(n, (X(a) + X(b)) / 2, 12); });
      g.strokeStyle = line; g.fillStyle = mute; g.textAlign = 'right';
      for (let v = lo; v <= hi; v++) { g.beginPath(); g.moveTo(L, Y(v)); g.lineTo(W - R, Y(v)); g.stroke(); g.fillText(v === 0 ? '1' : `10${v < 0 ? '⁻' : ''}${String(Math.abs(v)).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d])}`, L - 4, Y(v) + 4); }
      g.textAlign = 'center'; [1, 10, 20, 30].forEach((fq) => g.fillText(`${fq}`, X(fq), H - 6)); g.textAlign = 'right'; g.fillText('45 Hz', W - R, H - 6);
      g.strokeStyle = c1; g.lineWidth = 2; g.beginPath(); P.forEach(([fq, v], i) => (i ? g.lineTo(X(fq), Y(v)) : g.moveTo(X(fq), Y(v)))); g.stroke();
      g.textAlign = 'left';
    }
  }
  const p95 = (a) => { if (!a.length) return 0; const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * 0.95))]; };
  const ms = (v) => (v < 0.1 ? '<0.1 ms' : `${v.toFixed(v < 1 ? 2 : 1)} ms`);
  function readouts(S) {
    const el = (id) => document.getElementById(id), set = (id, v) => { const e = el(id); if (e && e.textContent !== v) e.textContent = v; };
    const secs = (performance.now() - S.t0) / 1000;
    OPS.forEach(([k]) => { const x = S.stats[k], n = document.querySelector(`.bci [data-op="${k}"]`); if (!n) return; n.classList.toggle('st-on', x.n > 0); const s = n.querySelector('.st-op-s'); if (s) s.textContent = x.n ? `${Math.round(x.n / secs)}/s · avg ${ms(x.sum / x.n)} · p95 ${ms(p95(x.lat))}` : 'waiting'; });
    if (S.rel) {
      set('bci-eng', S.eng.toFixed(2)); set('bci-alpha', `${Math.round(S.rel[2] * 100)}%`); set('bci-blink', String(S.blinks.length)); set('bci-rate', `${Math.round(S.total / Math.max(0.5, secs))}`);
      BANDS.forEach(([k], i) => { const b = el(`bci-b-${k}`); if (b) { b.style.width = `${(S.rel[i] * 100).toFixed(1)}%`; set(`bci-bv-${k}`, `${Math.round(S.rel[i] * 100)}%`); } });
    }
    set('bci-time', `${Math.floor(S.total / S.fs / 60)}:${String(Math.floor((S.total / S.fs) % 60)).padStart(2, '0')}`); set('bci-drop', String(S.dropped)); set('bci-note', S.note || '');
    S.q.forEach((q, c) => { const d = el(`bci-q-${c}`); if (d) { d.className = `bci-q ${q.s}`; d.title = q.why; } const e = el(`bci-e-${c}`); if (e) e.setAttribute('class', `bci-el ${q.s}`); });
    const qs = el('bci-qsum'); if (qs) { const g = S.q.filter((q) => q.s === 'good').length; set('bci-qsum', `${g} of ${S.n} channels clean${S.q.find((q) => q.s !== 'good' && q.s !== 'wait') ? ` · ${S.q.map((q, c) => (q.s !== 'good' && q.s !== 'wait' ? `${S.labels[c]}: ${q.why.toLowerCase()}` : '')).filter(Boolean).slice(0, 3).join(', ')}` : ''}`); }
    const D = NS.dec;
    if (el('bci-dstate')) {
      const cal = D.phase === 'cal-open' || D.phase === 'cal-closed', tl = cal ? Math.max(0, Math.ceil(CAL_S - (S.total / S.fs - D.phaseT))) : 0;
      set('bci-dstate', cal ? (D.phase === 'cal-open' ? `Keep your eyes open · ${tl} s` : `Close your eyes and relax · ${tl} s`) : D.thr == null ? 'Not calibrated' : D.closed ? 'Eyes closed' : 'Eyes open');
      const st = el('bci-dstate'); st.classList.toggle('on', !!D.closed);
      set('bci-conf', D.thr == null ? '' : `${Math.round(D.conf * 100)}% confident`);
      const mk = el('bci-mk'); if (mk && D.lo != null && S.alpha != null) mk.style.left = `${clamp(((S.alpha - D.lo) / (D.hi - D.lo)) * 100, 0, 100)}%`;
      document.querySelectorAll('.bci-menu li').forEach((li, i) => li.classList.toggle('on', i === D.menu && D.phase === 'ready'));
      if (D.test) set('bci-tst', `Trial ${D.test.i + 1} of ${D.test.trials.length} · ${D.test.trials[D.test.i] ? 'high tone: close your eyes' : 'low tone: keep your eyes open'}`);
      const pk = el('bci-picks'); if (pk) { const h = D.picks.map((p) => `<li><b>${esc(p.opt)}</b> <span class="muted small">${new Date(p.at).toLocaleTimeString()}</span></li>`).join(''); if (pk.innerHTML !== h) pk.innerHTML = h; }
    }
    const con = el('bci-con'); if (con) { const t = NS.con.map((m) => JSON.stringify(m)).join('\n'); if (con.textContent !== t) con.textContent = t; }
  }

  /* ── pages ── */
  const LAYERS = [
    ['Sensors', 'Electrodes on the scalp, in the ear, on muscle, inside a blood vessel, on the brain surface or in the cortex.', 'live', 'Scalp EEG today; implanted sensors only through partners in approved trials'],
    ['Analog front end', 'Amplifies microvolt signals, filters them and digitises them, close to the electrodes.', 'partner', 'Inside the headset or implant, set by its maker'],
    ['Edge processing', 'Shrinks the data before the radio: spike detection, band power, or decoded output on the device.', 'design', 'Sized in Implant design; Myo specifies, partners build'],
    ['Link', 'Moves data off the body: USB dongle, Bluetooth Low Energy, or near-field links for implants.', 'live', 'Web Serial and Web Bluetooth in this app'],
    ['Myo Neural SDK', 'Device profiles, time-stamped streams, event markers, signal quality and the session lifecycle.', 'live', 'OS.neural in this app'],
    ['Signal pipeline', 'Notch, band-pass, artefact gate, spectrum and band power, each step timed.', 'live', 'Signal lab'],
    ['Decoders', 'Turn features into states (calm, focus) or intents (select, move), calibrated per person and session.', 'live', 'Alpha switch today; motor imagery and muscle gestures next'],
    ['Intent bus', 'Consented, rate-limited events that apps subscribe to. Never raw signals.', 'live', "OS.neural.on('intent')"],
    ['Apps', 'Focus primers before training, breathwork and sleep wind-down, mobility devices, communication.', 'planned', 'Mind, Recovery, Training, Augment']
  ];
  const STATUS = { live: ['good', 'In Myo'], design: ['warn', 'Design tool'], partner: ['muted', 'Device maker'], planned: ['muted', 'Planned'], trial: ['muted', 'Partner trials only'], beta: ['warn', 'Beta'] };
  const CLASSES = [
    ['Scalp EEG headband or cap', 'On the head', '4–64', '250–1,000 Hz', 'Band power; slow choices (one every few seconds)', 'live'],
    ['Ear-EEG', 'In or around the ear', '2–8', '250–500 Hz', 'Band power, sleep, attention', 'planned'],
    ['Surface EMG', 'On the forearm or limb', '8–16', '1–2 kHz', 'Gestures and prosthesis control', 'planned'],
    ['fNIRS', 'On the forehead', '8–32', '~10 Hz', 'Blood-oxygen changes in the cortex', 'planned'],
    ['Endovascular electrodes', 'Inside a vein beside the motor cortex', '~16', '~2 kHz', 'Click and select, for people with paralysis', 'trial'],
    ['Surface ECoG (thin film)', 'On the brain surface', '64–1,024+', '1–2 kHz', 'Speech and movement decoding in research', 'trial'],
    ['Intracortical arrays', 'In the cortex', '96–1,024+', '20–30 kHz', 'Cursor, typing and robotic-arm control', 'trial']
  ];
  const POS = { FP1: [-0.3, -0.9], FP2: [0.3, -0.9], FPZ: [0, -0.95], AF7: [-0.6, -0.74], AF3: [-0.3, -0.72], AF4: [0.3, -0.72], AF8: [0.6, -0.74], F7: [-0.8, -0.5], F3: [-0.4, -0.48], FZ: [0, -0.46], F4: [0.4, -0.48], F8: [0.8, -0.5], T7: [-0.95, 0], T3: [-0.95, 0], C3: [-0.47, 0], CZ: [0, 0], C4: [0.47, 0], T8: [0.95, 0], T4: [0.95, 0], TP9: [-1.06, 0.3], TP10: [1.06, 0.3], P7: [-0.8, 0.5], T5: [-0.8, 0.5], P3: [-0.4, 0.48], PZ: [0, 0.46], P4: [0.4, 0.48], P8: [0.8, 0.5], T6: [0.8, 0.5], O1: [-0.3, 0.9], OZ: [0, 0.95], O2: [0.3, 0.9] };
  function headMap(labels, q) {
    const pts = labels.map((l, c) => [l, POS[l.toUpperCase()], c]).filter((x) => x[1]);
    return `<svg class="bci-head" viewBox="-130 -130 260 260" role="img" aria-label="Electrode positions on the 10-20 system"><circle class="bci-skull" r="100"/><path class="bci-skull" d="M-12 -99 L0 -116 L12 -99"/><path class="bci-skull" d="M-100 -14 q-14 14 0 28 M100 -14 q14 14 0 28"/>
      ${pts.map(([l, [x, y], c]) => `<g><circle id="bci-e-${c}" class="bci-el ${q ? q[c].s : 'wait'}" cx="${x * 100}" cy="${y * 100}" r="9"/><text class="bci-elt" x="${x * 100}" y="${y * 100 + 22}" text-anchor="middle">${esc(l)}</text></g>`).join('')}</svg>`;
  }
  function stackTab() {
    return `<section class="card"><div class="card-h"><h2>The Myo neural interface stack</h2><span class="muted small">From sensor to app; tap a layer</span></div>
        <div class="bci-stack"><div class="bci-rail">Consent and data rights</div>
          <ol class="bci-layers">${LAYERS.map(([n, d, st, where]) => `<li><details><summary><b>${n}</b>${pill(STATUS[st][0], STATUS[st][1])}</summary><p class="small">${esc(d)}</p><p class="fine">${esc(where)}</p></details></li>`).join('')}</ol>
          <div class="bci-rail">Safety interlocks</div></div>
        <ul class="small bc-ref bci-rails"><li><b>Consent and data rights, across every layer:</b> consent per data type, revocable at any time; raw signals stay on the device.</li><li><b>Safety interlocks, across every layer:</b> a fail-safe on signal loss, confidence thresholds, rate limits, a stop that always wins, and no stimulation.</li></ul>
        <p class="fine">Every device, from a headband today to an implant through a clinical partner, plugs in at the Link layer through a device profile. Everything above it stays the same, so apps written now keep working as the hardware changes.</p></section>
      <section class="card"><div class="card-h"><h2>Device classes</h2><span class="muted small">Typical figures</span></div>
        <div class="tbl-wrap"><table class="tbl compact"><caption class="sr">Brain and body interface device classes</caption><thead><tr><th scope="col">Interface</th><th scope="col">Where</th><th scope="col">Channels</th><th scope="col">Sampling</th><th scope="col">What it supports</th><th scope="col">In Myo</th></tr></thead>
        <tbody>${CLASSES.map(([n, w, c, f, u, st]) => `<tr><th scope="row">${n}</th><td class="small">${w}</td><td class="num">${c}</td><td class="num">${f}</td><td class="small">${u}</td><td>${pill(STATUS[st][0], STATUS[st][1])}</td></tr>`).join('')}</tbody></table></div>
        <p class="fine">Implanted interfaces today are investigational devices for people with paralysis, placed by neurosurgical teams inside approved studies. Myo connects to them only through their makers, inside those studies.</p></section>`;
  }
  function plan() { return `<div class="st-plan" role="list">${OPS.map(([k, n, d], i) => `<div class="st-op" role="listitem" data-op="${k}"><b>${n}</b><span class="st-op-d">${esc(d)}</span><span class="st-op-s">waiting</span></div>${i < OPS.length - 1 ? '<span class="st-arrow" aria-hidden="true">→</span>' : ''}`).join('')}</div>`; }
  function sourceCard(compact) {
    const S = NS.run, cur = S ? S.src : NS.src;
    const card = (k) => `<button class="st-src ${cur === k ? 'on' : ''}" data-act="bci-src" data-k="${k}" ${S ? 'disabled' : ''} aria-pressed="${cur === k}"><b>${SRC[k].name}</b><span>${SRC[k].sub}</span><em>${SRC[k].input}</em></button>`;
    const how = { demo: 'No hardware needed. Use the eyes button to simulate closing your eyes: alpha rises at the back of the head.', cyton: 'Plug in the OpenBCI USB dongle, switch the board to PC, press Start and choose the serial port. Electrodes follow the default OpenBCI montage.', muse: 'Turn the headband on, press Start and choose it in the list. Built from the open Muse protocol; not yet tested on hardware here.', file: 'Choose an EDF, EDF+ or BDF recording. It plays through the same pipeline at the speed you pick. The first hour is read.' }[cur];
    return `<section class="card bci-src"><div class="card-h"><h2>Source</h2>${S ? pill('good', 'Running') : ''}</div>
      ${compact ? '' : `<div class="st-srcs">${Object.keys(SRC).map(card).join('')}</div>`}
      <p class="small">${esc(how)}</p>
      <div class="st-go">${S ? `<button class="btn" data-act="bci-stop">${icon('pause', 16)} Stop</button>${S.src === 'demo' ? `<button class="btn ghost ${NS.eyes ? 'on' : ''}" data-act="bci-eyes" aria-pressed="${NS.eyes}">${NS.eyes ? 'Demo: eyes closed' : 'Demo: eyes open'}</button>` : ''}${S.src === 'file' ? `<label class="small">Speed <select data-change="bci-speed">${[1, 2, 4].map((v) => `<option value="${v}" ${NS.speed === v ? 'selected' : ''}>${v}×</option>`).join('')}</select></label>` : ''}`
        : cur === 'file' ? `<label class="btn bc-file">${icon('upload', 16)} Choose a recording<input class="sr" type="file" accept=".edf,.bdf,.rec" data-change="bci-file"></label>` : `<button class="btn" data-act="bci-start">${icon('play', 16)} Start</button>`}
        <label class="small">Mains <select data-change="bci-mains" ${S ? 'disabled' : ''}><option value="50" ${NS.mains === 50 ? 'selected' : ''}>50 Hz</option><option value="60" ${NS.mains === 60 ? 'selected' : ''}>60 Hz</option></select></label>
        <span class="muted small" id="bci-note" role="status">${esc(NS.busy || (S && S.note) || '')}</span></div></section>`;
  }
  function labTab() {
    const S = NS.run, L = NS.last;
    return `${sourceCard(false)}
      <section class="card bci-pipe"><div class="card-h"><h2>Pipeline</h2><span class="muted small">${S ? 'Live: rate and latency of every operator' : 'The plan, before it runs'}</span></div>${plan()}</section>
      ${S ? `<div class="grid g-2 bci-live">
        <section class="card"><div class="card-h"><h2>Signals</h2><div class="seg" role="group" aria-label="Trace view">${[['flt', 'Filtered'], ['raw', 'Raw']].map(([k, l]) => `<button class="${NS.view === k ? 'on' : ''}" data-act="bci-view" data-k="${k}">${l}</button>`).join('')}</div></div>
          <canvas id="bci-tr" class="bci-tr" aria-label="Live EEG traces, last 5 seconds, one lane per channel"></canvas>
          <div class="bci-ctl small"><label>Scale <select data-change="bci-scale">${[25, 50, 100, 200].map((v) => `<option value="${v}" ${NS.scale === v ? 'selected' : ''}>±${v} µV</option>`).join('')}</select></label><span>Time <b id="bci-time">0:00</b></span>${S.src === 'cyton' ? '<span>Dropped <b id="bci-drop">0</b></span>' : '<span hidden id="bci-drop"></span>'}<button class="btn ghost sm" data-act="bci-mark">Add marker</button></div></section>
        <section class="card"><div class="card-h"><h2>Spectrum</h2><span class="muted small">Mean of clean channels, µV²/Hz</span></div>
          <canvas id="bci-sp" class="bci-sp" aria-label="Power spectrum from 1 to 45 hertz with EEG bands marked"></canvas>
          <div class="bci-bars">${BANDS.map(([k, n, a, b]) => `<div><span>${n} <i class="muted">${a}–${b} Hz</i></span><i class="bci-bar"><i id="bci-b-${k}"></i></i><b id="bci-bv-${k}">—</b></div>`).join('')}</div></section></div>
      <div class="grid g-2">
        <section class="card"><div class="card-h"><h2>Electrodes</h2><span class="muted small" id="bci-qsum"></span></div>${headMap(S.labels, S.q)}
          <ul class="bci-chips small">${S.labels.map((l, c) => `<li><i id="bci-q-${c}" class="bci-q ${S.q[c].s}"></i>${esc(l)}</li>`).join('')}</ul>
          <ul class="bci-qkey small"><li><i class="bci-q good"></i>Clean</li><li><i class="bci-q fair"></i>Blink, movement or hum</li><li><i class="bci-q poor"></i>Flat or very noisy</li></ul></section>
        <section class="card"><div class="card-h"><h2>Readouts</h2></div><div class="st-read">
          <div><span>Engagement β/(α+θ)</span><b class="num" id="bci-eng">—</b><em>index</em></div><div><span>Relative alpha</span><b class="num" id="bci-alpha">—</b><em>of 1–45 Hz power</em></div>
          <div><span>Blinks</span><b class="num" id="bci-blink">—</b><em>last minute</em></div><div><span>Sample rate</span><b class="num" id="bci-rate">${S.fs}</b><em>Hz</em></div></div>
          <p class="fine">Indices describe your signal, not your mind or health. Engagement tends to rise with focused tasks; alpha rises when you close your eyes and relax.</p></section></div>` : ''}
      ${!S && L ? `<section class="card"><div class="card-h"><h2>Last session</h2><span class="muted small">${esc(SRC[L.src] ? SRC[L.src].name : L.src)} · ${Math.floor(L.dur / 60)}:${String(L.dur % 60).padStart(2, '0')}</span></div>
        <div class="st-read">${BANDS.map(([k, n]) => `<div><span>${n}</span><b class="num">${Math.round(L.rel[k] * 100)}%</b><em>relative power</em></div>`).join('')}<div><span>Clean channels</span><b class="num">${L.q}%</b><em>average</em></div></div>
        <div class="st-go">${L.src === 'demo' ? '<p class="small muted">Demo sessions are not saved.</p>' : L.dur < 20 ? '<p class="small muted">Sessions under 20 seconds are not saved.</p>' : L.saved ? '<p class="small">Saved to your Log book.</p>' : '<button class="btn" data-act="bci-save">Save summary</button>'}
          ${L.featLog.length ? '<button class="btn ghost" data-act="bci-csv">Download features (CSV)</button>' : ''}</div>
        <p class="fine">Only the summary is saved: band shares, engagement, signal quality and duration. Raw EEG is never stored or uploaded.</p></section>` : ''}`;
  }
  function decodeTab() {
    const S = NS.run, D = NS.dec, cal = D.phase === 'cal-open' || D.phase === 'cal-closed';
    return `${sourceCard(true)}
      <section class="card"><div class="card-h"><h2>Alpha switch</h2>${D.thr != null ? pill(D.phase === 'weak' ? 'warn' : 'good', D.phase === 'weak' ? 'Weak separation' : 'Calibrated') : pill('muted', 'Not calibrated')}</div>
        <p class="small">Closing your eyes raises alpha waves (8–13 Hz) at the back of the head. Myo learns your open and closed levels, then treats a one-second eyes-closed hold as a click. It works with any headset that covers the back of the head, and uses no flashing lights.</p>
        ${S ? `<div class="bci-dec"><div class="bci-state" id="bci-dstate" aria-live="polite">${cal ? 'Calibrating' : D.thr == null ? 'Not calibrated' : 'Eyes open'}</div><div class="muted small" id="bci-conf"></div>
          ${D.lo != null ? `<div class="bci-meter" aria-hidden="true"><i class="bci-thr" style="left:${clamp(((D.thr - D.lo) / (D.hi - D.lo)) * 100, 0, 100)}%"></i><i class="bci-mk" id="bci-mk"></i><span>open</span><span>closed</span></div>` : ''}</div>
          <div class="st-go">${cal ? '<span class="small">Follow the tones: low tone, eyes open; high tone, eyes closed. 20 seconds each.</span>' : `<button class="btn" data-act="bci-cal">${D.thr == null ? 'Calibrate (40 s)' : 'Recalibrate'}</button>${D.thr != null && D.phase !== 'test' ? '<button class="btn ghost" data-act="bci-test">Guided accuracy test (50 s)</button>' : ''}`}</div>
          ${D.phase === 'test' ? '<p class="small" id="bci-tst" aria-live="polite"></p>' : ''}
          ${D.thr != null ? `<p class="fine">Separation ${D.sep.toFixed(1)} (d′; 1.5 or more works well) · training accuracy ${Math.round(D.acc * 100)}%.${D.phase === 'weak' ? ' Separation is weak: check the back electrodes, sit still, relax with eyes closed, and recalibrate.' : ''}</p>` : ''}`
          : '<p class="small">Start a source above. The demo works without hardware.</p>'}</section>
      ${S && D.thr != null ? `<div class="grid g-2"><section class="card"><div class="card-h"><h2>Scanning menu</h2></div>
          <p class="small">The highlight steps every 2.5 seconds. Close your eyes when it reaches what you want, and hold for one second.</p>
          <ol class="bci-menu">${MENU.map((m) => `<li>${esc(m)}</li>`).join('')}</ol><ul class="bci-picks" id="bci-picks"></ul></section>
        <section class="card"><div class="card-h"><h2>Accuracy</h2></div>${D.lastTest ? `<div class="st-read"><div><span>Accuracy</span><b class="num">${Math.round(D.lastTest.P * 100)}%</b><em>${D.lastTest.n} trials</em></div><div><span>Information transfer</span><b class="num">${D.lastTest.itr.toFixed(1)}</b><em>bits per minute</em></div></div>` : '<p class="small">Run the guided test: ten 5-second trials, cued by tones, scored by the decoder.</p>'}
          <p class="fine">Information transfer rate (Wolpaw): bits per choice from accuracy and the number of options, times choices per minute. Two options every 5 seconds tops out at 12 bits per minute; implanted research systems reach far higher.</p></section></div>` : ''}
      <p class="fine">Flicker-based BCIs (SSVEP) are faster but can trigger seizures in people with photosensitive epilepsy, so Myo does not use them. If you have epilepsy, talk to your clinician before any neurofeedback.</p>`;
  }
  function designCalc(P) {
    const raw = P.ch * P.fs * P.bits, tx = P.mode === 'raw' ? raw : P.mode === 'lfp' ? P.ch * Math.min(P.fs, 1000) * P.bits : P.mode === 'sbp' ? P.ch * 50 * 16 : P.mode === 'spikes' ? P.ch * 20 * 24 : 20 * 256;
    const cap = RADIO[P.radio][1], pAfe = (P.ch * P.afe) / 1000, pRadio = tx * P.ebit * 1e-6, pProc = P.mode === 'raw' ? 0.2 : P.proc, pTot = pAfe + pRadio + pProc;
    return { raw, tx, cap, util: tx / cap, pAfe, pRadio, pProc, pTot, flux: pTot / P.area, budget: 40 * P.area, hours: (P.mah * 3.7) / pTot };
  }
  const rate = (b) => (b >= 1e6 ? `${(b / 1e6).toFixed(b >= 1e8 ? 0 : 1)} Mbit/s` : b >= 1e3 ? `${(b / 1e3).toFixed(b >= 1e5 ? 0 : 1)} kbit/s` : `${Math.round(b)} bit/s`);
  function designTab() {
    const P = NS.design, R = designCalc(P);
    const lg = (v) => Math.log10(Math.max(1, v)), lo = 2, hi = Math.max(9, Math.ceil(lg(Math.max(R.raw, R.cap)))), pct = (v) => clamp(((lg(v) - lo) / (hi - lo)) * 100, 1, 100);
    const anchor = (p) => (p > 70 ? 'transform:translateX(-100%)' : p < 30 ? 'transform:none' : '');
    const row = (v, label, cls) => { const p = pct(v); return `<div class="bci-row"><span>${label}</span><div class="bci-track"><i class="bci-rb ${cls}" style="width:${p.toFixed(1)}%"></i><b style="${p > 62 ? `right:${(100 - p + 1).toFixed(1)}%;color:var(--card)` : `left:calc(${p.toFixed(1)}% + 6px)`}">${rate(v)}</b></div></div>`; };
    const rateSvg = `<div class="bci-rows" role="img" aria-label="Raw data ${rate(R.raw)}, sent ${rate(R.tx)}, radio capacity ${rate(R.cap)} (log scale)">${row(R.raw, 'Raw signal', 'raw')}${row(R.tx, 'Sent', 'tx')}
      <div class="bci-row"><span></span><div class="bci-track" style="background:none;height:6px"><i class="bci-mark" style="left:${pct(R.cap).toFixed(1)}%"><span style="${anchor(pct(R.cap))}">radio ${rate(R.cap)}</span></i></div></div></div><p class="fine" style="margin-top:22px">Log scale: each step is ten times more data.</p>`;
    const tot = Math.max(R.pTot, R.budget), parts = [['afe', R.pAfe], ['proc', R.pProc], ['radio', R.pRadio]];
    const powSvg = `<div class="bci-pbar" role="img" aria-label="Power ${R.pTot.toFixed(1)} milliwatts against a heat budget of ${R.budget.toFixed(0)} milliwatts">${parts.map(([k, v]) => `<i class="bci-pw ${k}" style="width:${Math.max(0.6, (v / tot) * 100).toFixed(1)}%"></i>`).join('')}<i class="bci-mark" style="left:${((R.budget / tot) * 100).toFixed(1)}%;position:absolute"><span style="${anchor((R.budget / tot) * 100)}">heat budget ${R.budget.toFixed(0)} mW</span></i></div>`;
    const sel = (k, opts) => `<select data-change="bci-d" data-k="${k}">${opts.map(([v, l]) => `<option value="${v}" ${String(P[k]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    const nin = (k, step, mn, mx) => `<input type="number" data-change="bci-d" data-k="${k}" value="${P[k]}" step="${step}" min="${mn}" max="${mx}">`;
    const v1 = R.util <= 0.6 ? ['good', 'Fits the radio with headroom'] : R.util <= 1 ? ['warn', 'Fits, with little headroom'] : ['bad', `Does not fit: send ${Math.ceil(R.util)}× less data`];
    const v2 = R.flux <= 40 ? ['good', `${R.flux.toFixed(1)} mW/cm², under the heat budget`] : ['bad', `${R.flux.toFixed(1)} mW/cm², over the heat budget`];
    return `<section class="card"><div class="card-h"><h2>Implant link and power budget</h2><span class="muted small">A design calculator</span></div>
        <p class="small">Every implanted BCI trades channels and sampling against what a tiny radio can send and how much heat brain tissue can take. Set a design and see where it lands.</p>
        <div class="lb-grid bci-form">
          <label>Channels ${nin('ch', 1, 1, 4096)}</label><label>Sample rate ${sel('fs', [[250, '250 Hz'], [1000, '1 kHz'], [2000, '2 kHz'], [10000, '10 kHz'], [20000, '20 kHz'], [30000, '30 kHz']])}</label><label>Bits per sample ${sel('bits', [[8, '8'], [10, '10'], [12, '12'], [16, '16'], [24, '24']])}</label>
          <label>On-device processing ${sel('mode', Object.entries(MODES))}</label><label>Radio ${sel('radio', Object.entries(RADIO).map(([k, v]) => [k, `${v[0]} (~${rate(v[1])})`]))}</label>
          <label>Front-end power per channel (µW) ${nin('afe', 0.5, 0.5, 100)}</label><label>Radio energy (nJ per bit) ${nin('ebit', 0.5, 0.1, 200)}</label><label>Processing power (mW) ${nin('proc', 0.5, 0, 100)}</label>
          <label>Device area (cm²) ${nin('area', 0.5, 0.5, 40)}</label><label>Battery (mAh, 3.7 V) ${nin('mah', 10, 10, 2000)}</label></div></section>
      <div class="grid g-2">
        <section class="card"><div class="card-h"><h2>Data</h2>${pill(v1[0], v1[1])}</div>${rateSvg}
          <p class="small">${P.ch.toLocaleString()} channels × ${P.fs.toLocaleString()} Hz × ${P.bits} bits = <b>${rate(R.raw)}</b> raw. ${P.mode === 'raw' ? 'Sending it raw' : `${MODES[P.mode]} sends`} <b>${rate(R.tx)}</b>, ${Math.round(R.util * 100)}% of the radio.</p>
          <p class="fine">Spike-band power assumes one 16-bit value per channel every 20 ms; spike events assume 20 events per channel per second at 24 bits; decoded intent assumes 20 updates per second.</p></section>
        <section class="card"><div class="card-h"><h2>Power and heat</h2>${pill(v2[0], v2[1])}</div>${powSvg}
          <ul class="bc-leg"><li><i class="bc-sw bci-pw afe"></i>Front end <b>${R.pAfe.toFixed(1)} mW</b></li><li><i class="bc-sw bci-pw proc"></i>Processing <b>${R.pProc.toFixed(1)} mW</b></li><li><i class="bc-sw bci-pw radio"></i>Radio <b>${R.pRadio.toFixed(1)} mW</b></li></ul>
          <p class="small">Total <b>${R.pTot.toFixed(1)} mW</b> over ${P.area} cm². About <b>${R.hours >= 48 ? `${(R.hours / 24).toFixed(1)} days` : `${R.hours.toFixed(1)} hours`}</b> per charge.</p>
          <p class="fine">Design papers often use about 40 mW/cm² as a heat-flux ceiling for brain implants, to keep tissue warming near 1 °C; the active-implant standard ISO 14708-1 limits implant surfaces to 2 °C above body temperature. These are planning figures, not a safety assessment.</p></section></div>
      <section class="card"><div class="card-h"><h2>Every processing option, same design</h2></div><div class="tbl-wrap"><table class="tbl compact"><caption class="sr">Data rate and radio fit for each on-device processing option</caption><thead><tr><th scope="col">On-device processing</th><th scope="col">Sent</th><th scope="col">Radio use</th><th scope="col">Radio power</th></tr></thead>
        <tbody>${Object.keys(MODES).map((m) => { const r = designCalc({ ...P, mode: m }); return `<tr${m === P.mode ? ' class="on"' : ''}><th scope="row">${MODES[m]}</th><td class="num">${rate(r.tx)}</td><td class="num">${r.util > 1 ? `${Math.round(r.util * 100)}% · too much` : `${Math.round(r.util * 100)}%`}</td><td class="num">${r.pRadio.toFixed(2)} mW</td></tr>`; }).join('')}</tbody></table></div></section>`;
  }
  const API_SAMPLE = `// start a source: 'demo', 'cyton' or 'muse' (from a click), or pass an EDF/BDF File
await OS.neural.start('demo');

OS.neural.on('features', (f) => show(f.rel.alpha, f.engagement)); // 4 times a second
OS.neural.on('state', (e) => console.log(e.state, e.confidence));  // eyes-open / eyes-closed
OS.neural.on('intent', (e) => choose(e.target));                   // after a 1 s dwell
OS.neural.mark('set-1-start');                                     // a marker in the stream

await OS.neural.stop();`;
  function apiTab() {
    const S = NS.run;
    const desc = S ? { name: 'myo.eeg', type: 'EEG', source: S.src, channel_count: S.n, nominal_srate: S.fs, channel_format: 'float32', unit: 'microvolts', channels: S.labels.map((l) => ({ label: l, type: 'EEG', placement: POS[l.toUpperCase()] ? '10-20' : 'device' })), filters: { highpass_hz: 1, lowpass_hz: 45, notch_hz: [NS.mains, NS.mains * 2].filter((f) => f < S.fs * 0.47) }, created_at: new Date(S.wall0).toISOString() } : null;
    const PROF = [['Demo signal', 'Simulated', '8', '256 Hz', 'live'], ['OpenBCI Cyton', 'Web Serial (USB dongle)', '8', '250 Hz', 'live'], ['Muse headband', 'Web Bluetooth', '4', '256 Hz', 'beta'], ['EDF, EDF+ and BDF recordings', 'File', 'up to 32', 'any', 'live'], ['Generic Bluetooth EEG profile', 'Web Bluetooth', '—', '—', 'planned'], ['Lab Streaming Layer bridge', 'Desktop helper', '—', '—', 'planned'], ['Implanted BCI partners', "Maker's own software kit, inside its trials", '—', '—', 'trial']];
    return `<section class="card"><div class="card-h"><h2>OS.neural</h2><span class="muted small">The interface every Myo page and future device uses</span></div>
        <pre class="bci-code"><code>${esc(API_SAMPLE)}</code></pre>
        <p class="small">Events carry a stream time in seconds. Intents and states are the only things apps need; raw samples never leave the pipeline.</p></section>
      <div class="grid g-2">
        <section class="card"><div class="card-h"><h2>Live events</h2><span class="muted small">${S ? 'Newest first' : 'Start a source to see events'}</span></div><pre class="bci-con" id="bci-con" aria-live="off">${esc(NS.con.map((m) => JSON.stringify(m)).join('\n'))}</pre>
          ${S ? '' : '<div class="st-go"><button class="btn sm" data-act="bci-start-demo">Start the demo</button></div>'}</section>
        <section class="card"><div class="card-h"><h2>Stream descriptor</h2></div><pre class="bci-code small"><code>${esc(JSON.stringify(desc || { name: 'myo.eeg', type: 'EEG', channel_count: 8, nominal_srate: 256, unit: 'microvolts', channels: '[ … ]' }, null, 2))}</code></pre></section></div>
      <section class="card"><div class="card-h"><h2>Device profiles</h2></div><div class="tbl-wrap"><table class="tbl compact"><caption class="sr">Supported and planned device profiles</caption><thead><tr><th scope="col">Device</th><th scope="col">Transport</th><th scope="col">Channels</th><th scope="col">Rate</th><th scope="col">Status</th></tr></thead>
        <tbody>${PROF.map(([n, t, c, r, st]) => `<tr><th scope="row">${n}</th><td class="small">${t}</td><td class="num">${c}</td><td class="num">${r}</td><td>${pill(STATUS[st][0], STATUS[st][1])}</td></tr>`).join('')}</tbody></table></div>
        <p class="fine">Formats: EDF, EDF+ and BDF in; per-second feature CSV out; BIDS-EEG export planned. A new device needs only a profile: transport, channel labels, sample rate and a packet parser.</p></section>`;
  }
  function roadTab() {
    const STG = [['Now', 'Wellness EEG', 'Consumer and research headsets for focus, calm, neurofeedback breathwork and sleep wind-down. Wellness claims only, no diagnosis, raw EEG kept on the device.'],
      ['Next', 'Clinical-grade software', 'A quality system and medical-device software lifecycle (ISO 13485, IEC 62304, ISO 14971 risk management), ethics-board-approved studies, data in open formats (EDF, BIDS).'],
      ['Partner', 'Implant partner integration', "Connect to implanted BCIs from licensed makers, inside their FDA investigational device exemption (IDE) studies, through the makers' own software kits. Myo is the app layer: training, mobility, communication."],
      ['Long term', 'Myo implant program', 'A Class III device developed with clinical partners: biocompatibility (ISO 10993), active-implant safety (ISO 14708-1), electrical safety for external parts (IEC 60601-1), cybersecurity (FDA section 524B), Breakthrough Device designation where it fits, and premarket approval. Implants are placed only by neurosurgical teams in approved studies.']];
    return `<section class="card"><div class="card-h"><h2>Path to full Myo BCI integration</h2></div>
        <ol class="bci-road">${STG.map(([w, t, d], i) => `<li><span class="bci-stage">${i + 1}</span><div><b>${t}</b> <span class="muted small">${w}</span><p class="small">${esc(d)}</p></div></li>`).join('')}</ol></section>
      <div class="grid g-2">
        <section class="card"><div class="card-h"><h2>Neural-data rights</h2></div><ul class="small bc-ref">
          <li>Raw neural signals stay on your device by default. Only summaries are saved, and only when you choose.</li>
          <li>Consent is per data type and can be withdrawn. Delete everything any time from your data rights page.</li>
          <li>Neural data is never sold or used for advertising.</li>
          <li>Colorado and California (both in 2024) added neural data to the sensitive personal data their privacy laws protect. Myo treats it that way everywhere.</li>
          <li>Export your data in open formats.</li></ul></section>
        <section class="card"><div class="card-h"><h2>Boundaries</h2></div><ul class="small bc-ref">
          <li>No surgical, implant-insertion or do-it-yourself implant guidance. Implants are placed only by clinical teams in approved studies.</li>
          <li>No brain stimulation protocols (such as tDCS or TMS). Myo records; it never stimulates.</li>
          <li>No diagnosis from EEG: Myo does not detect seizures, sleep disorders or any condition.</li>
          <li>No flashing-light stimuli, because of the seizure risk.</li>
          <li>Implanted BCIs today are investigational devices for people with paralysis, in clinical trials.</li></ul></section></div>`;
  }

  /* ── register ── */
  OS.register('bci', {
    title: 'BCI lab', icon: 'bci',
    render(s) {
      const n = ((s.neuro && s.neuro.log) || []).length;
      const body = NS.tab === 'lab' ? labTab() : NS.tab === 'decode' ? decodeTab() : NS.tab === 'design' ? designTab() : NS.tab === 'api' ? apiTab() : NS.tab === 'road' ? roadTab() : stackTab();
      return `${OS.ui.head('Brain–computer interface · design and interfacing', 'BCI lab', `The software layer for Myo BCI: connect EEG today, decode simple intents, size future implants, and build on one interface. ${n ? `${n} saved session${n > 1 ? 's' : ''}.` : ''}`)}
        <div class="bci"><div class="seg kt-tabs" role="tablist" aria-label="BCI lab">${TABS.map(([k, l]) => `<button role="tab" aria-selected="${NS.tab === k}" data-act="bci-tab" data-t="${k}">${l}</button>`).join('')}</div>${body}
        <p class="fine">Myo BCI is in development. Wellness use only: EEG readings here are not medical measurements and Myo does not diagnose. Raw EEG stays in memory on this device.</p></div>`;
    },
    mount() {
      if (NS.run) { if (!NS.run.raf) NS.run.raf = requestAnimationFrame(loop); readouts(NS.run); }
      return () => { if (NS.run && location.hash.slice(1) !== 'bci') stop(false); };
    }
  });

  OS.act('bci-tab', (el) => { NS.tab = TABS.some(([k]) => k === el.dataset.t) ? el.dataset.t : 'stack'; OS.render(); });
  OS.act('bci-src', (el) => { if (NS.run) return; NS.src = el.dataset.k; NS.busy = ''; OS.render(); });
  const go = async (kind) => { NS.busy = ''; try { await start(kind); } catch (e) { if (!(e && e.name === 'NotFoundError')) { NS.busy = e.message || String(e); OS.render(); } } };
  OS.act('bci-start', () => go(NS.src));
  OS.act('bci-start-demo', () => { NS.src = 'demo'; go('demo'); });
  OS.act('bci-stop', () => stop());
  OS.act('bci-eyes', () => { NS.eyes = !NS.eyes; OS.render(); });
  OS.act('bci-view', (el) => { NS.view = el.dataset.k === 'raw' ? 'raw' : 'flt'; OS.render(); });
  OS.act('bci-mark', () => { const S = NS.run; if (!S) return; const t = +(S.total / S.fs).toFixed(2); S.marks.push(t); emit('marker', { t, label: `marker ${S.marks.length}` }); OS.toast(`Marker ${S.marks.length} at ${t} s`); });
  OS.change('bci-scale', (el) => { NS.scale = +el.value || 50; });
  OS.change('bci-speed', (el) => { NS.speed = +el.value || 1; });
  OS.change('bci-mains', (el) => { NS.mains = +el.value === 60 ? 60 : 50; });
  OS.change('bci-file', async (el) => { const file = el.files && el.files[0]; el.value = ''; if (!file) return; NS.busy = 'Reading the recording…'; OS.render(); await go(file); });
  OS.act('bci-cal', () => startCal());
  OS.act('bci-test', () => startTest());
  OS.change('bci-d', (el) => { const k = el.dataset.k, v = el.tagName === 'SELECT' && !/^\d/.test(el.value) ? el.value : +el.value; if (typeof v === 'number' && !(v > 0) && k !== 'proc') return; NS.design[k] = v; OS.render(); });
  OS.act('bci-save', () => {
    const L = NS.last; if (!L || L.saved || L.src === 'demo' || L.dur < 20) return;
    const { featLog, labels, ...sum } = L;
    OS.update((s) => { s.neuro = s.neuro || { log: [] }; s.neuro.log = (s.neuro.log || []).concat([sum]).slice(-500); });
    L.saved = true; OS.toast('Session summary saved'); OS.render();
  });
  OS.act('bci-csv', () => {
    const L = NS.last; if (!L || !L.featLog.length) return;
    const head = ['t_s', ...BANDS.map(([k]) => `rel_${k}`), 'engagement', 'log10_alpha_uV2', 'clean_channels'];
    const blob = new Blob([[head.join(','), ...L.featLog.map((r) => r.join(','))].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `myo-eeg-features-${L.at.slice(0, 10)}.csv`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });

  OS.neural = {
    start: (kind) => start(kind), stop: () => stop(), mark: (label) => { const S = NS.run; if (!S) return null; const t = +(S.total / S.fs).toFixed(2); S.marks.push(t); emit('marker', { t, label: String(label || 'marker') }); return t; },
    on: (type, fn) => { (NS.listeners[type] = NS.listeners[type] || []).push(fn); return () => OS.neural.off(type, fn); },
    off: (type, fn) => { NS.listeners[type] = (NS.listeners[type] || []).filter((f) => f !== fn); },
    get session() { return NS.run; }, state: NS, parseEDF, parseCyton, unpack12, fft, biquad, designCalc, bitsPer, pushBlock, BANDS
  };
})();
