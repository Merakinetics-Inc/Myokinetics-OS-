/* ═══ MYO — FACE AND VOICE: silent commands from lip movements, signals from facial skin, and clear voice in noise ═══
   Silent commands · teach Myo a few words by mouthing them; it learns your lip and jaw micromovements (MediaPipe Face
                     Landmarker's 478 points and mouth blendshapes) and recognises them by dynamic time warping, so
                     you can move around Myo hands-free and without a sound. Templates stay on this device.
   Face scan       · heart rate from the colour changes the pulse makes in facial skin (the POS camera-pulse method,
                     Wang et al. 2017), blink rate, and expression signals (smile, brow, squint) — signals, not emotions
   Voice in noise  · record, then compare the raw microphone with Myo's spectral noise reduction: spectrograms,
                     measured signal-to-noise gain, and A/B playback; whispered notes to the Log book where dictation exists
   Inspired by Q.ai's research areas (silent speech from facial micromovements, audio in noise, facial cue sensing);
   Myo isn't affiliated with Q.ai. Video and audio are processed in memory on this device and never uploaded; only
   numbers are saved. Wellness estimates, not a medical device. */
(function () {
  'use strict';
  const { esc, icon, pill, clamp, dayKey } = OS;
  const TABS = [['silent', 'Silent commands'], ['vitals', 'Face scan'], ['voice', 'Voice in noise']];
  const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14', MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
  const CMDS = [['today', 'Today', 'go:today'], ['train', 'Training', 'go:training'], ['log', 'Log book', 'go:logbook'], ['next', 'Next tab', 'next'], ['back', 'Back', 'back'], ['sos', 'SOS page', 'go:emergency']];
  const MOUTH = ['jawOpen', 'mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthLeft', 'mouthRight', 'mouthSmileLeft', 'mouthSmileRight', 'mouthStretchLeft', 'mouthStretchRight', 'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper', 'mouthPressLeft', 'mouthPressRight', 'mouthLowerDownLeft', 'mouthLowerDownRight', 'mouthUpperUpLeft', 'mouthUpperUpRight'];
  const EXPR = [['smile', 'Smile', ['mouthSmileLeft', 'mouthSmileRight']], ['browDown', 'Brow lowered', ['browDownLeft', 'browDownRight']], ['browUp', 'Brow raised', ['browInnerUp']], ['squint', 'Eyes narrowed', ['eyeSquintLeft', 'eyeSquintRight']], ['press', 'Lips pressed', ['mouthPressLeft', 'mouthPressRight']]];
  const FV = { tab: 'silent', src: null, stream: null, video: null, lm: null, loading: false, err: '', raf: 0, t0: 0,
    cmd: { mode: 'idle', target: null, base: null, calib: [], seq: [], active: false, quiet: 0, live: false, last: null, msg: '' },
    vit: null, voice: { rec: null, raw: null, out: null, sr: 48000, level: null, busy: false, err: '' } };
  const KEY = 'myo-silent';
  const loadT = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const saveT = (t) => { try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* private mode */ } };

  /* ── maths shared by all three ── */
  function fft(re, im) { const n = re.length; for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let len = 2; len <= n; len <<= 1) { const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a); for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const p = i + k, q = p + len / 2, tr = re[q] * cr - im[q] * ci, ti = re[q] * ci + im[q] * cr; re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } } } }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1), sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length || 1)); };

  /* ── silent commands: features, dynamic time warping, nearest template with a margin ── */
  function features(bs, lm) {
    const g = {}; (bs || []).forEach((c) => { g[c.categoryName] = c.score; });
    const d = (a, b) => Math.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y), fw = d(234, 454) || 1;
    return [...MOUTH.map((k) => g[k] || 0), d(13, 14) / fw * 4, d(78, 308) / fw * 2];
  }
  function dtw(a, b, sc) {
    const n = a.length, m = b.length, w = Math.max(Math.abs(n - m), Math.ceil(Math.max(n, m) * 0.3)), D = Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(Infinity)); D[0][0] = 0;
    for (let i = 1; i <= n; i++) for (let j = Math.max(1, i - w); j <= Math.min(m, i + w); j++) { let c = 0; for (let k = 0; k < a[i - 1].length; k++) { const z = (a[i - 1][k] - b[j - 1][k]) / sc[k]; c += z * z; } D[i][j] = Math.sqrt(c) + Math.min(D[i - 1][j], D[i][j - 1], D[i - 1][j - 1]); }
    return D[n][m] / (n + m);
  }
  function scales(T) { const all = Object.values(T).flat().flat(); if (!all.length) return null; return all[0].map((_, k) => Math.max(0.03, sd(all.map((f) => f[k])))); }
  function classify(seq, T) {
    const sc = scales(T); if (!sc) return null; const per = Object.entries(T).filter(([, xs]) => xs.length >= 2).map(([k, xs]) => [k, Math.min(...xs.map((x) => dtw(seq, x, sc)))]).sort((a, b) => a[1] - b[1]);
    if (!per.length) return null; const [best, second] = per, intra = Object.values(T).filter((xs) => xs.length >= 2).flatMap((xs) => xs.flatMap((x, i) => xs.slice(i + 1).map((y) => dtw(x, y, sc)))), lim = (intra.length ? mean(intra) : best[1]) * 1.7;
    const margin = second ? second[1] / best[1] : 9, ok = best[1] <= lim && margin >= 1.12;
    return { key: best[0], dist: best[1], lim, margin, ok };
  }
  function onSilentFrame(bs, lm) {
    const C = FV.cmd, f = features(bs, lm);
    if (!C.base) { C.calib.push(f); if (C.calib.length >= 45) { C.base = f.map((_, k) => mean(C.calib.map((x) => x[k]))); C.spread = Math.max(0.08, mean(C.calib.map((x) => x.reduce((a, v, k) => a + Math.abs(v - C.base[k]), 0)))); C.msg = C.mode === 'enroll' ? `Now mouth "${label(C.target)}" silently.` : 'Ready: mouth a command.'; paintSilent(); } return; }
    const act = f.reduce((a, v, k) => a + Math.abs(v - C.base[k]), 0) / C.spread;
    if (act > 3.2) { C.active = true; C.quiet = 0; C.seq.push(f); if (C.seq.length > 90) C.seq.shift(); }
    else if (C.active) { C.seq.push(f); if (++C.quiet > 8) { const seq = C.seq.slice(0, -8); C.active = false; C.seq = []; C.quiet = 0; if (seq.length >= 6) utterance(seq); } }
    const m = document.getElementById('fv-act'); if (m) m.style.width = `${clamp(act / 8 * 100, 0, 100)}%`;
  }
  const label = (k) => (CMDS.find((c) => c[0] === k) || [k, k])[1];
  function utterance(seq) {
    const C = FV.cmd, T = loadT();
    if (C.mode === 'enroll' && C.target) { T[C.target] = (T[C.target] || []).concat([seq]).slice(-5); saveT(T); const n = T[C.target].length; C.msg = n >= 3 ? `Got ${n} samples of "${label(C.target)}". Pick the next command.` : `Sample ${n} saved. Mouth "${label(C.target)}" again.`; if (n >= 3) C.target = null; paintSilent(); return; }
    if (C.mode === 'listen') { const r = classify(seq, T); C.last = r; if (r && r.ok) { C.msg = `Heard: ${label(r.key)}`; run(r.key); } else C.msg = r ? `Not sure (closest: ${label(r.key)}). Try again.` : 'Teach at least two commands first.'; paintSilent(); pillPaint(); }
  }
  function run(key) {
    const a = (CMDS.find((c) => c[0] === key) || [])[2]; if (!a) return;
    if (a.startsWith('go:')) OS.go(a.slice(3));
    else if (a === 'back') history.back();
    else if (a === 'next') { const cur = document.querySelector('#view .kt-tabs [aria-selected="true"]'), nx = cur && cur.nextElementSibling; if (nx) nx.click(); }
  }

  /* ── face scan: POS camera pulse, blinks, expression signals ── */
  function pos(rgb, fps) {
    const L = Math.max(8, Math.round(1.6 * fps)), N = rgb.length, H = new Float64Array(N);
    for (let n = L; n <= N; n++) {
      const w = rgb.slice(n - L, n), mu = [0, 1, 2].map((c) => mean(w.map((p) => p[c])) || 1), Cn = w.map((p) => [p[0] / mu[0], p[1] / mu[1], p[2] / mu[2]]);
      const S1 = Cn.map((p) => p[1] - p[2]), S2 = Cn.map((p) => p[1] + p[2] - 2 * p[0]), a = sd(S1) / (sd(S2) || 1), h = S1.map((v, i) => v + a * S2[i]), hm = mean(h);
      for (let i = 0; i < L; i++) H[n - L + i] += h[i] - hm;
    }
    return H;
  }
  function pulseRate(sig, fps) {
    const N = 1024, re = new Float64Array(N), im = new Float64Array(N), m = mean(Array.from(sig)), n = Math.min(sig.length, N);
    for (let i = 0; i < n; i++) re[i] = (sig[sig.length - n + i] - m) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
    fft(re, im); const df = fps / N, k0 = Math.ceil(0.7 / df), k1 = Math.floor(3.0 / df), P = []; for (let k = 0; k <= k1 + 1; k++) P[k] = re[k] * re[k] + im[k] * im[k];
    let kb = k0; for (let k = k0; k <= k1; k++) if (P[k] > P[kb]) kb = k;
    const a = P[kb - 1], b = P[kb], c = P[kb + 1], off = a - 2 * b + c ? (0.5 * (a - c)) / (a - 2 * b + c) : 0, f = (kb + clamp(off, -0.5, 0.5)) * df;
    let band = 0, near = 0; for (let k = k0; k <= k1; k++) { band += P[k]; if (Math.abs(k - kb) <= 2) near += P[k]; }
    return { bpm: f * 60, q: band ? near / band : 0 };
  }
  function resample(t, v, fps) { if (t.length < 2) return []; const out = [], t0 = t[0], t1 = t[t.length - 1]; let j = 0; for (let x = t0; x <= t1; x += 1 / fps) { while (j < t.length - 2 && t[j + 1] < x) j++; const u = (x - t[j]) / ((t[j + 1] - t[j]) || 1); out.push(v[j].map((c, k) => c + (v[j + 1][k] - c) * clamp(u, 0, 1))); } return out; }
  function vitStep(t, rgb, bs) {
    const V = FV.vit; V.t.push(t); V.rgb.push(rgb);
    const g = {}; (bs || []).forEach((c) => { g[c.categoryName] = c.score; });
    const blink = ((g.eyeBlinkLeft || 0) + (g.eyeBlinkRight || 0)) / 2; if (blink > 0.5 && !V.eyeShut) { V.blinks.push(t); V.eyeShut = true; } else if (blink < 0.3) V.eyeShut = false;
    EXPR.forEach(([k, , ks]) => { const v = mean(ks.map((x) => g[x] || 0)); V.expr[k] = (V.expr[k] || []).concat([v]).slice(-900); });
    if (t - (V.lastCalc || 0) > 1 && t - V.t[0] > 8) { V.lastCalc = t; const i0 = V.t.findIndex((x) => x >= t - 12), u = resample(V.t.slice(i0), V.rgb.slice(i0), 30); if (u.length > 120) { const r = pulseRate(pos(u, 30), 30); V.hr = r.bpm; V.q = r.q; V.hrs.push(r.bpm); } }
    paintVit();
  }
  function demoFrame(t) {
    const base = (OS.state.vitals && OS.state.vitals.rhr) || 62, ph = 2 * Math.PI * (base / 60) * (t - 0.18 * Math.cos(t / 6)), p = Math.sin(ph) + 0.35 * Math.sin(2 * ph + 0.8),   // rate = base × (1 + 0.03 sin(t/6)), phase integrated
      mo = 1.5 * Math.sin(t / 2.3) + (Math.random() - 0.5) * 0.6;
    const rgb = [170 + mo + 0.18 * p, 120 + mo * 0.8 + 0.42 * p, 100 + mo * 0.7 + 0.12 * p], bl = (t % 3.7) < 0.15 ? 0.9 : 0.05;
    return { rgb, bs: [{ categoryName: 'eyeBlinkLeft', score: bl }, { categoryName: 'eyeBlinkRight', score: bl }, { categoryName: 'mouthSmileLeft', score: 0.25 + 0.2 * Math.sin(t / 5) }, { categoryName: 'mouthSmileRight', score: 0.25 + 0.2 * Math.sin(t / 5) }, { categoryName: 'browDownLeft', score: 0.1 }, { categoryName: 'browDownRight', score: 0.1 }, { categoryName: 'browInnerUp', score: 0.15 }] };
  }
  function roiColor(g, lm, W, H) {
    const fw = Math.hypot((lm[454].x - lm[234].x) * W, (lm[454].y - lm[234].y) * H), r = Math.max(4, fw * 0.07), boxes = [[lm[151], r * 1.4], [lm[50], r], [lm[280], r]];
    let R = 0, G = 0, B = 0, n = 0; FV.rois = boxes.map(([p, s]) => [p.x * W - s, p.y * H - s, 2 * s, 2 * s]);
    FV.rois.forEach(([x, y, w, h]) => { const d = g.getImageData(Math.max(0, x | 0), Math.max(0, y | 0), Math.max(1, w | 0), Math.max(1, h | 0)).data; for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; n++; } });
    return n ? [R / n, G / n, B / n] : null;
  }

  /* ── camera and landmarker ── */
  async function loadLM() {
    if (FV.lm) return FV.lm; FV.loading = true; paintStatus();
    const vision = await import(MP + '/vision_bundle.mjs'), files = await vision.FilesetResolver.forVisionTasks(MP + '/wasm');
    const mk = (d) => vision.FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL, delegate: d }, runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true });
    try { FV.lm = await mk('GPU'); } catch { FV.lm = await mk('CPU'); }
    FV.loading = false; paintStatus(); return FV.lm;
  }
  async function startCam(src, file) {
    stopCam(); FV.err = ''; FV.src = src; FV.t0 = performance.now();
    if (src === 'demo') { FV.timer = setInterval(() => { const t = (performance.now() - FV.t0) / 1000, d = demoFrame(t); if (FV.vit && FV.vit.on) vitStep(t, d.rgb, d.bs); }, 1000 / 30); return; }
    try {
      await loadLM();
      FV.video = document.createElement('video'); FV.video.muted = true; FV.video.playsInline = true;
      if (src === 'file') { FV.video.src = URL.createObjectURL(file); FV.video.loop = true; } else { FV.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } }, audio: false }); FV.video.srcObject = FV.stream; }
      await FV.video.play();
      const off = document.createElement('canvas'); off.width = 320; off.height = 240; const og = off.getContext('2d', { willReadFrequently: true });
      let lastT = -1;
      const tick = () => {
        if (!FV.video) return;
        const v = FV.video, now = performance.now();
        if (v.readyState >= 2 && v.currentTime !== lastT) {
          lastT = v.currentTime; const r = FV.lm.detectForVideo(v, now), lm = r.faceLandmarks && r.faceLandmarks[0], bs = r.faceBlendshapes && r.faceBlendshapes[0] && r.faceBlendshapes[0].categories;
          FV.face = !!lm; FV.lmPts = lm;
          if (lm) {
            if (FV.cmd.mode !== 'idle') onSilentFrame(bs, lm);
            if (FV.vit && FV.vit.on) { og.drawImage(v, 0, 0, 320, 240); const c = roiColor(og, lm, 320, 240); if (c) vitStep((now - FV.t0) / 1000, c, bs); }
          }
          drawPreview();
        }
        FV.raf = requestAnimationFrame(tick);
      };
      FV.raf = requestAnimationFrame(tick);
    } catch (e) { FV.loading = false; FV.err = e && e.name === 'NotAllowedError' ? 'Camera permission was not given.' : e && e.name === 'NotFoundError' ? 'No camera found.' : `Couldn't start face tracking: ${(e && e.message) || e}`; stopCam(); OS.render(); }
  }
  function stopCam() { cancelAnimationFrame(FV.raf); clearInterval(FV.timer); if (FV.stream) FV.stream.getTracks().forEach((t) => t.stop()); if (FV.video && FV.video.src && FV.video.src.startsWith('blob:')) URL.revokeObjectURL(FV.video.src); FV.stream = null; FV.video = null; FV.src = null; FV.face = false; }
  function drawPreview() {
    const cv = document.getElementById('fv-cv'); if (!cv || !FV.video) return; const v = FV.video, g = cv.getContext('2d');
    if (cv.width !== v.videoWidth && v.videoWidth) { cv.width = v.videoWidth; cv.height = v.videoHeight; }
    g.save(); g.translate(cv.width, 0); g.scale(-1, 1); g.drawImage(v, 0, 0, cv.width, cv.height);
    const lm = FV.lmPts; if (lm) { g.fillStyle = 'rgba(56,189,248,.9)'; [13, 14, 78, 308, 61, 291, 0, 17].forEach((i) => { g.beginPath(); g.arc(lm[i].x * cv.width, lm[i].y * cv.height, 2.5, 0, 7); g.fill(); });
      if (FV.vit && FV.vit.on && FV.rois) { g.strokeStyle = 'rgba(52,211,153,.9)'; g.lineWidth = 2; const s = cv.width / 320; FV.rois.forEach(([x, y, w, h]) => g.strokeRect(x * s, y * s, w * s, h * s)); } }
    g.restore();
    const st = document.getElementById('fv-face'); if (st) st.textContent = FV.face ? 'Face found' : 'Looking for a face…';
  }

  /* ── voice in noise: spectral gating, SNR from frame energy percentiles ── */
  function stftMag(x, N = 1024, hop = 256) { const w = Float64Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N)), frames = []; for (let s = 0; s + N <= x.length; s += hop) { const re = new Float64Array(N), im = new Float64Array(N); for (let i = 0; i < N; i++) re[i] = x[s + i] * w[i]; fft(re, im); frames.push({ re, im }); } return { frames, w, N, hop }; }
  function enhance(x, opt = {}) {
    const S = stftMag(x), N = S.N, hop = S.hop, B = N / 2 + 1, mags = S.frames.map((f) => Float64Array.from({ length: B }, (_, k) => Math.hypot(f.re[k], f.im[k]))), en = mags.map((m) => m.reduce((a, v) => a + v * v, 0));
    const order = en.map((e, i) => [e, i]).sort((a, b) => a[0] - b[0]), quiet = order.slice(0, Math.max(3, Math.floor(order.length * 0.2))).map((p) => p[1]);
    const noise = Float64Array.from({ length: B }, (_, k) => mean(quiet.map((i) => mags[i][k]))), alpha = opt.alpha || 2.0, floor = opt.floor || 0.08, out = new Float64Array(x.length), wsum = new Float64Array(x.length);
    let prev = new Float64Array(B).fill(1);
    S.frames.forEach((f, t) => {
      const g = new Float64Array(B); for (let k = 0; k < B; k++) { const raw = Math.max(floor, 1 - alpha * noise[k] / (mags[t][k] + 1e-9)); g[k] = raw > prev[k] ? 0.6 * raw + 0.4 * prev[k] : 0.25 * raw + 0.75 * prev[k]; }
      prev = g; const re = new Float64Array(N), im = new Float64Array(N);
      for (let k = 0; k < B; k++) { re[k] = f.re[k] * g[k]; im[k] = f.im[k] * g[k]; if (k && k < N / 2) { re[N - k] = re[k]; im[N - k] = -im[k]; } }
      for (let i = 0; i < N; i++) im[i] = -im[i]; fft(re, im); const s = t * hop;
      for (let i = 0; i < N; i++) { out[s + i] += (re[i] / N) * S.w[i]; wsum[s + i] += S.w[i] * S.w[i]; }
    });
    for (let i = 0; i < out.length; i++) out[i] = wsum[i] > 1e-6 ? out[i] / wsum[i] : 0;
    return Float32Array.from(out);
  }
  function snr(x, sr) { const fl = Math.round(sr * 0.03), e = []; for (let s = 0; s + fl <= x.length; s += fl) { let q = 0; for (let i = s; i < s + fl; i++) q += x[i] * x[i]; e.push(q / fl + 1e-12); } e.sort((a, b) => a - b); const lo = e[Math.floor(e.length * 0.1)], hi = e[Math.floor(e.length * 0.9)]; return 10 * Math.log10(hi / lo); }
  function drawSpec(id, x) {
    const cv = document.getElementById(id); if (!cv || !x) return; const S = stftMag(x, 512, 256), W = cv.width = Math.min(900, S.frames.length), H = cv.height = 160, g = cv.getContext('2d'), img = g.createImageData(W, H), fmax = 120;
    for (let c = 0; c < W; c++) { const f = S.frames[Math.floor((c / W) * S.frames.length)]; for (let y = 0; y < H; y++) { const k = Math.floor(((H - 1 - y) / H) * fmax), m = Math.hypot(f.re[k], f.im[k]), v = clamp((20 * Math.log10(m + 1e-6) + 40) / 60, 0, 1), o = (y * W + c) * 4; img.data[o] = 20 + 30 * v; img.data[o + 1] = 40 + 150 * v; img.data[o + 2] = 80 + 175 * v; img.data[o + 3] = 255; } }
    g.putImageData(img, 0, 0);
  }
  let AC = null;
  async function record(sec, ns) {
    const V = FV.voice; V.err = ''; V.busy = 'rec'; OS.render();
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)(); await AC.resume();
      const st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: !!ns, autoGainControl: false, channelCount: 1 } });
      const src = AC.createMediaStreamSource(st), proc = AC.createScriptProcessor(4096, 1, 1), parts = [], mute = AC.createGain(); mute.gain.value = 0;
      proc.onaudioprocess = (e) => parts.push(Float32Array.from(e.inputBuffer.getChannelData(0))); src.connect(proc); proc.connect(mute); mute.connect(AC.destination);
      await new Promise((r) => setTimeout(r, sec * 1000)); proc.disconnect(); src.disconnect(); st.getTracks().forEach((t) => t.stop());
      const n = parts.reduce((a, p) => a + p.length, 0), x = new Float32Array(n); let o = 0; parts.forEach((p) => { x.set(p, o); o += p.length; });
      setVoice(x, AC.sampleRate, ns);
    } catch (e) { V.err = e && e.name === 'NotAllowedError' ? 'Microphone permission was not given.' : (e.message || String(e)); V.busy = false; OS.render(); }
  }
  function setVoice(x, sr, ns) { const V = FV.voice; V.raw = x; V.sr = sr; V.ns = !!ns; V.busy = 'proc'; OS.render(); setTimeout(() => { V.out = enhance(x); V.snrIn = snr(x, sr); V.snrOut = snr(V.out, sr); V.busy = false; OS.render(); }, 30); }
  function demoVoice() { const sr = 16000, n = sr * 6, x = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / sr, syl = Math.max(0, Math.sin(2 * Math.PI * 2.2 * t)) ** 2 * (t % 2 < 1.4 ? 1 : 0), f0 = 140 + 25 * Math.sin(2 * Math.PI * 0.7 * t); ph += (2 * Math.PI * f0) / sr; let v = 0; for (let h = 1; h <= 12; h++) v += Math.sin(h * ph) / h * (h * f0 > 300 && h * f0 < 3000 ? 1.4 : 0.6); x[i] = 0.12 * syl * v + 0.05 * (Math.random() * 2 - 1) + 0.03 * Math.sin(2 * Math.PI * 60 * t); } setVoice(x, sr, false); }
  function play(which) { const V = FV.voice, x = which === 'out' ? V.out : V.raw; if (!x) return; AC = AC || new (window.AudioContext || window.webkitAudioContext)(); AC.resume(); const b = AC.createBuffer(1, x.length, V.sr); b.copyToChannel(x, 0); const s = AC.createBufferSource(); s.buffer = b; s.connect(AC.destination); if (FV.player) try { FV.player.stop(); } catch { /* */ } FV.player = s; s.start(); }

  /* ── views ── */
  function paintStatus() { const el = document.getElementById('fv-status'); if (el) el.textContent = FV.loading ? 'Loading face tracking (about 4 MB, once)…' : FV.err || ''; }
  function paintSilent() { const el = document.getElementById('fv-msg'); if (el) el.textContent = FV.cmd.msg; const t = document.getElementById('fv-tpl'); if (t) t.innerHTML = tplList(); }
  const tplList = () => { const T = loadT(); return CMDS.map(([k, l]) => { const n = (T[k] || []).length; return `<li><button class="chip-btn ${FV.cmd.target === k ? 'on' : ''}" data-act="fv-teach" data-k="${k}" ${FV.cmd.mode === 'enroll' ? '' : 'disabled'}>${esc(l)}</button> <span class="small ${n >= 2 ? '' : 'muted'}">${n} sample${n === 1 ? '' : 's'}</span></li>`; }).join(''); };
  function pillPaint() {
    let p = document.getElementById('fv-pill');
    if (!FV.cmd.live) { if (p) p.remove(); return; }
    if (!p) { p = document.createElement('div'); p.id = 'fv-pill'; p.className = 'fv-pill'; p.setAttribute('role', 'status'); document.body.appendChild(p); p.addEventListener('click', (e) => { if (e.target.closest('[data-fv-stop]')) stopLive(); }); }
    p.innerHTML = `<span class="fv-dot" aria-hidden="true"></span> Silent commands on${FV.cmd.msg ? ` · ${esc(FV.cmd.msg)}` : ''} <button data-fv-stop>Stop</button>`;
  }
  function stopLive() { FV.cmd.live = false; FV.cmd.mode = 'idle'; stopCam(); pillPaint(); if (OS.current === 'face') OS.render(); }
  function silentTab() {
    const C = FV.cmd, T = loadT(), ready = CMDS.filter(([k]) => (T[k] || []).length >= 2).length, cam = FV.src === 'camera' || FV.src === 'file';
    return `<section class="card"><div class="card-h"><h2>Talk to Myo without a sound</h2>${pill(ready >= 2 ? 'good' : 'muted', `${ready} of ${CMDS.length} commands taught`)}</div>
        <p class="small">Myo watches the tiny movements of your lips and jaw while you mouth a word, compares them with the samples you taught it, and runs the command. Useful in a quiet room, a noisy gym, or when your hands are busy.</p>
        <div class="fv-stage"><canvas id="fv-cv" class="fv-cv" aria-label="Your camera, mirrored, with lip points"></canvas>${cam ? '' : '<div class="fv-off">Camera off</div>'}</div>
        <p class="small"><b id="fv-face">${cam ? 'Looking for a face…' : ''}</b> <span id="fv-status" class="muted">${esc(FV.loading ? 'Loading face tracking…' : FV.err)}</span></p>
        ${C.mode !== 'idle' ? '<div class="fv-meter" aria-hidden="true"><i id="fv-act"></i></div>' : ''}<p class="fv-msg" id="fv-msg" role="status">${esc(C.msg)}</p>
        <div class="st-go">${C.mode === 'idle' ? `<button class="btn" data-act="fv-mode" data-m="enroll">${icon('plus', 16)} Teach commands</button><button class="btn ghost" data-act="fv-mode" data-m="listen" ${ready >= 2 ? '' : 'disabled'}>${icon('play', 16)} Start listening</button>` : `<button class="btn ghost" data-act="fv-mode" data-m="idle">${icon('pause', 16)} Stop</button>${C.mode === 'listen' && !C.live ? '<button class="btn ghost" data-act="fv-live">Keep on while I use Myo</button>' : ''}`}</div>
        <ul class="fv-tpl" id="fv-tpl">${tplList()}</ul>
        <p class="fine">Teaching: press Teach commands, keep a neutral face for 2 seconds, pick a command, then mouth it 3 times with a pause between. Commands: Today, Training, Log book, Next tab, Back, and SOS page (opens Emergency; it never calls anyone). Your movement samples stay in this browser. <button class="link small" data-act="fv-forget">Delete my samples</button></p></section>
      <section class="card"><div class="card-h"><h2>How well it works</h2></div><ul class="small bc-ref">
        <li>Recognition compares the shape and timing of each movement with your own samples (dynamic time warping), and refuses when no command is a clear match, so a stray yawn does nothing.</li>
        <li>It works best facing the camera in steady light, mouthing clearly. Five samples per command beat three.</li>
        <li>Built for a handful of commands, not free speech: reading arbitrary words from lips needs large trained models.</li></ul></section>`;
  }
  function paintVit() {
    const V = FV.vit; if (!V) return; const set = (id, v) => { const el = document.getElementById(id); if (el && el.textContent !== String(v)) el.textContent = v; }, t = V.t.length ? V.t[V.t.length - 1] - V.t[0] : 0;
    set('fv-hr', V.hr ? Math.round(V.hr) : '—'); set('fv-q', V.hr ? `${Math.round(V.q * 100)}%` : '—'); set('fv-bl', t > 10 ? Math.round((V.blinks.length / t) * 60) : '—'); set('fv-t', `${Math.floor(t)} s`);
    EXPR.forEach(([k]) => { const b = document.getElementById(`fv-e-${k}`); if (b && V.expr[k]) b.style.width = `${clamp(mean(V.expr[k].slice(-30)) * 100, 0, 100)}%`; });
    if (V.on && t >= V.dur) finishVit();
  }
  function finishVit() { const V = FV.vit; V.on = false; V.done = true; const t = V.t[V.t.length - 1] - V.t[0]; V.sum = { at: new Date().toISOString(), src: FV.src === 'demo' ? 'demo' : 'face', dur: Math.round(t), hr: V.hrs.length ? Math.round(mean(V.hrs.slice(-8))) : null, q: Math.round((V.q || 0) * 100), blink: t ? Math.round((V.blinks.length / t) * 60) : null, expr: Object.fromEntries(EXPR.map(([k]) => [k, V.expr[k] ? Math.round(mean(V.expr[k]) * 100) : 0])) }; if (FV.src !== 'demo') stopCam(); else { clearInterval(FV.timer); FV.src = null; } OS.render(); }
  function vitTab(s) {
    const V = FV.vit, run = V && V.on, S = V && V.sum, log = ((s.face && s.face.log) || []).slice(-6).reverse(), cam = FV.src === 'camera' || FV.src === 'file';
    return `<section class="card"><div class="card-h"><h2>30-second face scan</h2>${run ? pill('good', 'Scanning') : ''}</div>
        <p class="small">Each heartbeat changes the colour of facial skin very slightly. Myo measures it in three skin patches (forehead and cheeks) and finds the pulse with the POS method; it also counts blinks and tracks expression signals.</p>
        ${run && FV.src !== 'demo' ? `<div class="fv-stage"><canvas id="fv-cv" class="fv-cv" aria-label="Your camera, mirrored, with the skin patches used"></canvas></div><p class="small"><b id="fv-face">Looking for a face…</b> <span id="fv-status" class="muted">${esc(FV.loading ? 'Loading face tracking…' : '')}</span></p>` : ''}
        ${FV.err ? `<p class="small" role="alert">${esc(FV.err)}</p>` : ''}
        <div class="st-go">${run ? `<button class="btn ghost" data-act="fv-vstop">${icon('pause', 16)} Stop</button><span class="small muted">Time <b id="fv-t">0 s</b></span>` : `<button class="btn" data-act="fv-vgo" data-s="camera">${icon('play', 16)} Start with camera</button><label class="btn ghost bc-file">${icon('upload', 16)} Use a selfie video<input class="sr" type="file" accept="video/*" data-change="fv-vfile"></label><button class="btn ghost" data-act="fv-vgo" data-s="demo">Demo</button>`}</div>
        ${run || S ? `<div class="st-read">${[['Heart rate', 'fv-hr', 'bpm', S && S.hr], ['Signal quality', 'fv-q', 'peak share', S && `${S.q}%`], ['Blinks', 'fv-bl', 'a minute', S && S.blink]].map(([l, id, u, v]) => `<div><span>${l}</span><b class="num" id="${id}">${v != null && v !== undefined ? v : '—'}</b><em>${u}</em></div>`).join('')}</div>
          <h3 class="em-h">Expression signals</h3><ul class="fl-bars fv-expr">${EXPR.map(([k, l]) => `<li><span>${l}</span><i class="fl-track"><i id="fv-e-${k}" style="width:${S ? S.expr[k] : 0}%"></i></i><b class="num">${S ? S.expr[k] : ''}</b></li>`).join('')}</ul>` : ''}
        ${S ? `<div class="st-go">${S.src === 'demo' ? '<span class="small muted">Demo scans are not saved.</span>' : `<button class="btn sm" data-act="fv-vsave">Save to Log book</button>`}<a class="btn ghost sm" href="#mind">Check in how you feel</a></div>` : ''}
        <p class="fine">Expression signals describe what your face did, not how you feel: the same expression means different things in different people, so Myo doesn't infer emotions or mental state from faces. Camera heart rate is a wellness estimate; good light and stillness matter. Video is processed in memory and never stored or sent.</p></section>
      ${log.length ? `<section class="card"><div class="card-h"><h2>Saved scans</h2></div><div class="tbl-wrap"><table class="tbl compact"><caption class="sr">Saved face scans</caption><thead><tr><th scope="col">When</th><th scope="col">Heart rate</th><th scope="col">Quality</th><th scope="col">Blinks/min</th></tr></thead><tbody>${log.map((r) => `<tr><th scope="row" class="small">${esc(new Date(r.at).toLocaleString())}</th><td class="num">${r.hr ?? '—'}</td><td class="num">${r.q}%</td><td class="num">${r.blink ?? '—'}</td></tr>`).join('')}</tbody></table></div></section>` : ''}`;
  }
  function voiceTab() {
    const V = FV.voice, dict = OS.caps && OS.caps.dictation, sr = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
    return `<section class="card"><div class="card-h"><h2>Voice in noise</h2></div>
        <p class="small">Record 6 seconds of speech or a whisper with the noise around you. Myo learns the noise from the quietest moments, removes it frequency by frequency, and measures how much clearer the voice is.</p>
        <div class="st-go"><button class="btn" data-act="fv-rec" data-ns="0" ${V.busy ? 'disabled' : ''}>${icon('mic', 16)} ${V.busy === 'rec' ? 'Recording…' : 'Record 6 s (raw microphone)'}</button><button class="btn ghost" data-act="fv-rec" data-ns="1" ${V.busy ? 'disabled' : ''}>With the browser's noise suppression</button><button class="btn ghost" data-act="fv-vdemo" ${V.busy ? 'disabled' : ''}>Demo</button></div>
        ${V.err ? `<p class="small" role="alert">${esc(V.err)}</p>` : ''}${V.busy === 'proc' ? '<p class="small muted">Cleaning up…</p>' : ''}
        ${V.out ? `<div class="lb-tiles"><div><span>Before</span><b>${V.snrIn.toFixed(1)}</b><em>dB voice over noise${V.ns ? ' (browser suppression on)' : ''}</em></div><div><span>After Myo</span><b>${V.snrOut.toFixed(1)}</b><em>dB</em></div><div><span>Gain</span><b>${(V.snrOut - V.snrIn >= 0 ? '+' : '') + (V.snrOut - V.snrIn).toFixed(1)}</b><em>dB clearer</em></div></div>
          <figure class="fv-spec"><figcaption class="small">Before <button class="link small" data-act="fv-play" data-w="raw">${icon('play', 12)} Play</button></figcaption><canvas id="fv-sp-raw" aria-label="Spectrogram before noise reduction"></canvas></figure>
          <figure class="fv-spec"><figcaption class="small">After <button class="link small" data-act="fv-play" data-w="out">${icon('play', 12)} Play</button></figcaption><canvas id="fv-sp-out" aria-label="Spectrogram after noise reduction"></canvas></figure>
          <p class="fine">Spectrograms show 0 to about ${Math.round(120 * V.sr / 512 / 100) / 10} kHz over time; brighter is louder. Voice over noise is the gap between the loudest and quietest tenths of the recording.</p>` : ''}</section>
      <section class="card"><div class="card-h"><h2>Whisper a note</h2></div>
        ${dict || sr ? `<p class="small">Whisper or speak a note; it goes to your Log book as text.</p><div class="st-go"><button class="btn ghost" data-act="fv-note">${icon('mic', 16)} ${FV.noting ? 'Listening… tap to finish' : 'Start a note'}</button></div><p class="small" id="fv-note-txt">${esc(FV.noteText || '')}</p>` : '<p class="small muted">Speech to text isn\'t available in this browser.</p>'}
        <p class="fine">Speech to text is done by your browser or by Claude's dictation, not by Myo; whispered speech is harder for it than normal speech.</p></section>`;
  }

  OS.register('face', {
    title: 'Face and voice', icon: 'face',
    render(s) {
      const body = { silent: silentTab, vitals: vitTab, voice: voiceTab }[FV.tab](s);
      return `${OS.ui.head('Silent speech · facial signals · voice in noise', 'Face and voice', 'Control Myo by mouthing words, read your pulse and expression signals from your face, and hear yourself clearly in noise. Everything runs on this device.')}
        <div class="fv bc fl"><div class="seg kt-tabs" role="tablist" aria-label="Face and voice">${TABS.map(([k, l]) => `<button role="tab" aria-selected="${FV.tab === k}" data-act="fv-tab" data-t="${k}">${l}</button>`).join('')}</div>${body}
        <p class="fine">Inspired by Q.ai's work on silent speech, audio in noise and facial cue sensing; Myo isn't affiliated with Q.ai. Face tracking uses Google's MediaPipe Face Landmarker, downloaded once from Google's servers; your video stays on this device.</p></div>`;
    },
    mount() {
      if (FV.tab === 'voice' && FV.voice.out) { drawSpec('fv-sp-raw', FV.voice.raw); drawSpec('fv-sp-out', FV.voice.out); }
      paintSilent();
      return () => { if (location.hash.slice(1) !== 'face' && !FV.cmd.live) { stopCam(); FV.cmd.mode = 'idle'; if (FV.vit) FV.vit.on = false; } };
    }
  });
  OS.act('fv-tab', (el) => { if (!FV.cmd.live) { stopCam(); FV.cmd.mode = 'idle'; } if (FV.vit) FV.vit.on = false; FV.tab = TABS.some(([k]) => k === el.dataset.t) ? el.dataset.t : 'silent'; OS.render(); });
  OS.act('fv-mode', async (el) => {
    const m = el.dataset.m, C = FV.cmd;
    if (m === 'idle') { C.live = false; C.mode = 'idle'; C.msg = ''; stopCam(); pillPaint(); OS.render(); return; }
    C.mode = m; C.base = null; C.calib = []; C.seq = []; C.active = false; C.target = null; C.msg = 'Keep a neutral face for 2 seconds…'; OS.render();
    if (FV.vit) FV.vit.on = false;
    if (FV.src !== 'camera' && FV.src !== 'file') await startCam('camera');
  });
  OS.act('fv-teach', (el) => { FV.cmd.target = el.dataset.k; FV.cmd.msg = FV.cmd.base ? `Mouth "${label(el.dataset.k)}" silently, 3 times with a pause between.` : 'Keep a neutral face for 2 seconds first…'; paintSilent(); });
  OS.act('fv-live', () => { FV.cmd.live = true; pillPaint(); OS.toast('Silent commands stay on while you use Myo. Tap Stop on the pill to end.'); OS.render(); });
  OS.act('fv-forget', () => { if (!confirm('Delete your silent-command samples from this browser?')) return; try { localStorage.removeItem(KEY); } catch { /* */ } paintSilent(); OS.render(); });
  OS.act('fv-vgo', async (el) => { FV.vit = { on: true, dur: 30, t: [], rgb: [], blinks: [], expr: {}, hrs: [], hr: null, q: 0 }; FV.err = ''; OS.render(); await startCam(el.dataset.s); });
  OS.change('fv-vfile', async (el) => { const f = el.files && el.files[0]; el.value = ''; if (!f) return; FV.vit = { on: true, dur: 30, t: [], rgb: [], blinks: [], expr: {}, hrs: [], hr: null, q: 0 }; OS.render(); await startCam('file', f); });
  OS.act('fv-vstop', () => { if (FV.vit && FV.vit.t.length > 30) finishVit(); else { if (FV.vit) FV.vit.on = false; stopCam(); OS.render(); } });
  OS.act('fv-vsave', () => { const S = FV.vit && FV.vit.sum; if (!S) return; OS.update((s) => { s.face = s.face || {}; s.face.log = (s.face.log || []).concat([S]).slice(-300); }); OS.logEvent('body', 'Face scan', [S.hr ? `${S.hr} bpm` : '', `quality ${S.q}%`, S.blink != null ? `${S.blink} blinks/min` : ''].filter(Boolean).join(' · '), { go: 'face', src: 'device' }); FV.vit = null; OS.toast('Saved to your Log book'); });
  OS.act('fv-rec', (el) => record(6, el.dataset.ns === '1'));
  OS.act('fv-vdemo', () => demoVoice());
  OS.act('fv-play', (el) => play(el.dataset.w));
  OS.act('fv-note', async () => {
    if (FV.noting) { FV.noting = false; if (FV.rec && FV.rec.stop) { try { await FV.rec.stop(); } catch { /* */ } } const t = (FV.noteText || '').trim(); if (t) { OS.logEvent('note', 'Voice note', t.slice(0, 500), { go: 'logbook', src: 'manual' }); OS.toast('Note saved to your Log book'); } FV.noteText = ''; OS.render(); return; }
    FV.noteText = ''; FV.noting = true; OS.render(); const d = OS.caps && OS.caps.dictation;
    if (d) { d.onFinal(({ text }) => { FV.noteText = `${FV.noteText || ''} ${text}`.trim(); const el = document.getElementById('fv-note-txt'); if (el) el.textContent = FV.noteText; }); try { await d.start(); FV.rec = d; } catch { FV.noting = false; OS.render(); } return; }
    const R = new (window.SpeechRecognition || window.webkitSpeechRecognition)(); R.continuous = true; R.interimResults = false; R.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) FV.noteText = `${FV.noteText || ''} ${e.results[i][0].transcript}`.trim(); const el = document.getElementById('fv-note-txt'); if (el) el.textContent = FV.noteText; }; R.onerror = () => { FV.noting = false; OS.render(); }; R.start(); FV.rec = R;
  });
  OS.face = { features, dtw, classify, pos, pulseRate, resample, enhance, snr, demoFrame, state: FV, CMDS,
    status(s) { const T = loadT(), n = CMDS.filter(([k]) => (T[k] || []).length >= 2).length, L = ((s.face && s.face.log) || []).slice(-1)[0]; return FV.cmd.live ? ['Silent commands on', 'good'] : L && L.hr ? [`Last face scan ${L.hr} bpm`, 'good'] : n ? [`${n} silent commands taught`, 'muted'] : null; } };
})();
