/* ═══ MYOKINETICS OS v4 — AR-VISION: real pose tracking + form rules engine ═══
   Sources: live camera · uploaded video · reference demo rig.
   Pose: Google MoveNet SinglePose Lightning (17 COCO keypoints) on TensorFlow.js, model bundled in models/.
   Every source produces the same keypoint dict, so one rules engine scores all of them. */
(function () {
  'use strict';
  const { esc, clamp, lerp, pill, icon } = OS;

  const AR = OS.AR = { ex: 'press', src: 'demo', faults: {}, ecc: 3, paused: false, reps: 0, videoURL: null, videoName: '' };
  const TFJS = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';
  const MODEL_URL = 'models/movenet-lightning/model.json';
  const WEIGHTS_URL = 'models/movenet-lightning/weights.b64.txt';
  const NAMES = ['nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear', 'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist', 'left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle'];
  const EDGES = [['left_shoulder', 'right_shoulder'], ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'], ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'], ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'], ['left_hip', 'right_hip'], ['left_hip', 'left_knee'], ['left_knee', 'left_ankle'], ['right_hip', 'right_knee'], ['right_knee', 'right_ankle']];
  const MIN_SCORE = 0.3;

  /* ── pose engine ─────────────────────────────────────────────────── */
  const Pose = {
    model: null, loading: null, backend: '', canvas: null, ctx: null, error: '',
    load(onStatus) {
      if (this.model) return Promise.resolve(this);
      if (this.loading) return this.loading;
      this.loading = (async () => {
        onStatus('Loading TensorFlow.js…');
        if (!window.tf) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = TFJS; s.onload = res; s.onerror = () => rej(new Error("TensorFlow.js didn't load. Check your connection.")); document.head.appendChild(s); });
        const tf = window.tf;
        try { if (!(await tf.setBackend('webgl'))) throw 0; } catch { await tf.setBackend('cpu'); }
        await tf.ready(); this.backend = tf.getBackend();
        onStatus('Loading MoveNet pose model, 4.8 MB…');
        // weights ship as base64 text (artifact hosting serves text, not .bin), decoded and loaded from memory
        const [spec, b64] = await Promise.all([fetch(MODEL_URL).then((r) => { if (!r.ok) throw new Error('Pose model files are missing.'); return r.json(); }), fetch(WEIGHTS_URL).then((r) => { if (!r.ok) throw new Error('Pose model weights are missing.'); return r.text(); })]);
        const bin = atob(b64.trim()), bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        this.model = await tf.loadGraphModel(tf.io.fromMemory({
          modelTopology: spec.modelTopology, format: spec.format, generatedBy: spec.generatedBy, convertedBy: spec.convertedBy, signature: spec.signature, userDefinedMetadata: spec.userDefinedMetadata,
          weightSpecs: spec.weightsManifest.flatMap((g) => g.weights), weightData: bytes.buffer
        }));
        const warm = this.model.execute(tf.zeros([1, 192, 192, 3], 'int32')); await warm.data(); warm.dispose();
        this.canvas = document.createElement('canvas'); this.canvas.width = this.canvas.height = 192;
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        return this;
      })();
      this.loading.catch((e) => { this.error = (e && e.message) || 'The pose model failed to load.'; this.loading = null; });
      return this.loading;
    },
    // letterbox the frame into 192×192, run MoveNet, map keypoints back to source pixels
    async estimate(src, w, h) {
      const S = 192, k = Math.min(S / w, S / h), dw = w * k, dh = h * k, ox = (S - dw) / 2, oy = (S - dh) / 2;
      this.ctx.fillStyle = '#000'; this.ctx.fillRect(0, 0, S, S); this.ctx.drawImage(src, ox, oy, dw, dh);
      const tf = window.tf;
      const out = tf.tidy(() => this.model.execute(tf.browser.fromPixels(this.canvas).toInt().expandDims(0)));
      const d = await out.data(); out.dispose();
      const kp = {};
      for (let i = 0; i < 17; i++) kp[NAMES[i]] = { x: (d[i * 3 + 1] * S - ox) / k, y: (d[i * 3] * S - oy) / k, score: d[i * 3 + 2] };
      return kp;
    }
  };
  OS.Pose = Pose;

  const smoothKp = (prev, next, a = 0.55) => {
    if (!prev) return next; const o = {};
    for (const n of NAMES) { const p = prev[n], q = next[n]; o[n] = q.score < MIN_SCORE || !p || p.score < MIN_SCORE ? q : { x: lerp(p.x, q.x, a), y: lerp(p.y, q.y, a), score: q.score }; }
    return o;
  };
  const angle = (a, b, c) => { const v1 = [a.x - b.x, a.y - b.y], v2 = [c.x - b.x, c.y - b.y]; const d = Math.hypot(...v1) * Math.hypot(...v2) || 1; return Math.acos(clamp((v1[0] * v2[0] + v1[1] * v2[1]) / d, -1, 1)) * 180 / Math.PI; };

  /* ── rules engine: keypoints over time → angles, reps, tempo, faults ── */
  function makeAnalyzer(ex, getTarget, onCue) {
    const st = { phase: 'init', topV: 0, lastTopT: 0, reps: 0, eccStart: 0, minV: 999, minT: 0, ecc: 0, con: 0, acc: null, pending: null, last: {}, hot: {}, hotUntil: 0, lastRep: null };
    const pick = (kp, n) => (kp[n] && kp[n].score >= MIN_SCORE ? kp[n] : null);
    const startAcc = () => ({ maxTilt: 0, tiltSide: '', minKnee: 999, maxTorso: 0, maxDrift: 0, hipBelow: false, topL: 0, topR: 0 });
    const flash = (names, t) => { names.forEach((n) => { st.hot[n] = true; }); st.hotUntil = t + 1800; };

    function tempoCue(t) {
      const target = getTarget();
      if (st.ecc && st.ecc < target * 0.75) onCue('warn', `Eccentric was ${st.ecc.toFixed(1)} s. Lower for ${target} s to match the hypertrophy tempo.`);
    }

    function finishPress(t) {
      const p = st.pending; st.pending = null; if (!p) return;
      const asym = Math.abs(p.topL - p.topR), shortSide = p.topL < p.topR ? 'Left' : 'Right';
      let clean = true; tempoCue(t);
      if (p.maxTilt > 4) { clean = false; flash([p.tiltSide.toLowerCase() + '_shoulder'], t); onCue('bad', `${p.tiltSide} shoulder rising ${p.maxTilt.toFixed(0)}° at lockout. Pull the shoulder blade down before you press.`); }
      if (asym > 12) { clean = false; flash([shortSide.toLowerCase() + '_elbow'], t); onCue('bad', `${shortSide} arm locks out ${asym.toFixed(0)}° short of the other. Drive both handles to full extension.`); }
      else if (Math.max(p.topL, p.topR) < 160) { clean = false; onCue('warn', `Lockout reached ${Math.max(p.topL, p.topR).toFixed(0)}°. Finish each rep with straight arms.`); }
      const sym = clamp(100 - asym * 0.9 - p.maxTilt * 1.6, 0, 100);
      st.lastRep = { sym, asym, tilt: p.maxTilt, top: Math.min(p.topL, p.topR) };
      if (clean) onCue('good', `Rep ${st.reps}: full lockout, shoulders level, symmetry ${sym.toFixed(0)}%.`);
    }

    function step(kp, t) {
      if (t > st.hotUntil) st.hot = {};
      if (ex === 'press') {
        const P = ['left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist'].map((n) => pick(kp, n));
        if (P.some((x) => !x)) return { ready: false, msg: 'Face the camera with both shoulders, elbows and hands in frame.' };
        const [LS, RS, LE, RE, LW, RW] = P;
        const LH = pick(kp, 'left_hip'), RH = pick(kp, 'right_hip');
        const span = Math.abs(LS.x - RS.x), torsoLen = LH && RH ? Math.abs((LH.y + RH.y) / 2 - (LS.y + RS.y) / 2) : span * 1.6;
        if (span < torsoLen * 0.45) return { ready: false, msg: 'Turn to face the camera square-on. The press check needs both shoulders side by side.' };
        const eL = angle(LS, LE, LW), eR = angle(RS, RE, RW);
        const tilt = Math.atan2(Math.abs(LS.y - RS.y), Math.abs(LS.x - RS.x) || 1) * 180 / Math.PI;
        const tiltSide = LS.y < RS.y ? 'Left' : 'Right';
        const sig = Math.max(eL, eR), HI = 155, LO = 105;
        if (st.phase === 'init') { if (sig > HI) st.phase = 'up'; }
        else if (st.phase === 'up') {
          if (st.pending) { st.pending.topL = Math.max(st.pending.topL, eL); st.pending.topR = Math.max(st.pending.topR, eR); if (tilt > st.pending.maxTilt) { st.pending.maxTilt = tilt; st.pending.tiltSide = tiltSide; } if (t - st.pending.at > 700) finishPress(t); }
          if (sig >= st.topV - 4) { st.topV = Math.max(st.topV, sig); st.lastTopT = t; }
          if (sig < HI - 8) { if (st.pending) finishPress(t); st.phase = 'down'; st.eccStart = st.lastTopT || t; st.topV = 0; st.minV = sig; st.minT = t; }
        } else {
          if (sig < st.minV) { st.minV = sig; st.minT = t; }
          if (sig > HI && st.minV < LO) {
            st.reps++; st.ecc = (st.minT - st.eccStart) / 1000; st.con = (t - st.minT) / 1000; st.phase = 'up';
            st.pending = { at: t, topL: eL, topR: eR, maxTilt: tilt, tiltSide };
          } else if (sig > HI) st.phase = 'up';
        }
        const lr = st.lastRep;
        return {
          ready: true, phase: st.phase === 'init' ? 'waiting for top' : st.phase === 'up' ? (st.pending ? 'lockout' : 'top') : (st.minT === t ? 'eccentric' : 'concentric'),
          rom: clamp((sig - 70) / (170 - 70) * 100, 0, 100),
          arcs: [['right_shoulder', 'right_elbow', 'right_wrist', eR], ['left_shoulder', 'left_elbow', 'left_wrist', eL]],
          rows: [
            ['Right elbow', eR, '≥ 165° top', lr ? (lr.top >= 160 || st.lastRep.asym <= 12 ? 'good' : 'bad') : 'good'],
            ['Left elbow', eL, '≥ 165° top', lr ? (lr.asym <= 12 ? 'good' : 'bad') : 'good'],
            ['Shoulder tilt', tilt, '≤ 3°', tilt <= 3 ? 'good' : tilt <= 6 ? 'warn' : 'bad'],
            ['Symmetry, last rep', lr ? lr.sym : 100, '≥ 95%', !lr || lr.sym >= 95 ? 'good' : lr.sym >= 88 ? 'warn' : 'bad', '%']
          ]
        };
      }
      // squat: side-on, use whichever side the camera sees best
      const side = ['shoulder', 'hip', 'knee', 'ankle'].reduce((a, j) => a + (kp['left_' + j]?.score || 0) - (kp['right_' + j]?.score || 0), 0) >= 0 ? 'left' : 'right';
      const P = ['shoulder', 'hip', 'knee', 'ankle'].map((j) => pick(kp, side + '_' + j));
      if (P.some((x) => !x)) return { ready: false, msg: 'Stand side-on to the camera with shoulder, hip, knee and ankle in frame.' };
      const [S, H, K, A] = P;
      const knee = angle(H, K, A), hip = angle(S, H, K);
      const torso = Math.atan2(Math.abs(S.x - H.x), Math.max(1, H.y - S.y)) * 180 / Math.PI;
      const shin = Math.hypot(K.x - A.x, K.y - A.y) || 1, drift = Math.abs(S.x - A.x) / shin * 100;
      const below = H.y >= K.y - shin * 0.04;
      const HI = 160, LO = 125;
      if (st.phase === 'init') { if (knee > HI) st.phase = 'up'; }
      else if (st.phase === 'up') {
        if (knee >= st.topV - 4) { st.topV = Math.max(st.topV, knee); st.lastTopT = t; }
        if (knee < HI - 6) { st.phase = 'down'; st.eccStart = st.lastTopT || t; st.topV = 0; st.minV = knee; st.minT = t; st.acc = startAcc(); }
      } else {
        const a = st.acc; a.minKnee = Math.min(a.minKnee, knee); a.maxTorso = Math.max(a.maxTorso, torso); a.maxDrift = Math.max(a.maxDrift, drift); a.hipBelow = a.hipBelow || below;
        if (knee < st.minV) { st.minV = knee; st.minT = t; }
        if (knee > HI) {
          st.phase = 'up';
          if (st.minV < LO) {
            st.reps++; st.ecc = (st.minT - st.eccStart) / 1000; st.con = (t - st.minT) / 1000;
            let clean = true; tempoCue(t);
            if (!a.hipBelow && a.minKnee > 95) { clean = false; flash([side + '_hip', side + '_knee'], t); onCue('bad', `Hip stayed above parallel (knee bottomed at ${a.minKnee.toFixed(0)}°). Sit 2–3 inches deeper.`); }
            if (a.maxTorso > 50) { clean = false; flash([side + '_shoulder', side + '_hip'], t); onCue('bad', `Torso lean hit ${a.maxTorso.toFixed(0)}°. Keep the chest up and brace before you descend.`); }
            st.lastRep = { minKnee: a.minKnee, maxTorso: a.maxTorso, depth: a.hipBelow, drift: a.maxDrift };
            if (clean) onCue('good', `Rep ${st.reps}: ${a.hipBelow ? 'below parallel' : 'to depth'}, torso ${a.maxTorso.toFixed(0)}°, knee ${a.minKnee.toFixed(0)}° at the bottom.`);
          }
        }
      }
      const lr = st.lastRep;
      return {
        ready: true, phase: st.phase === 'init' ? 'waiting to stand' : st.phase === 'up' ? 'standing' : (st.minT === t ? 'eccentric' : 'concentric'),
        rom: clamp((175 - knee) / (175 - 75) * 100, 0, 100),
        arcs: [[side + '_ankle', side + '_knee', side + '_hip', knee], [side + '_shoulder', side + '_hip', side + '_knee', hip]],
        rows: [
          ['Knee, bottom of last rep', lr ? lr.minKnee : knee, '≤ 95°', !lr ? 'good' : lr.minKnee <= 95 || lr.depth ? 'good' : 'bad'],
          ['Hip angle', hip, 'live', 'good'],
          ['Torso lean', torso, '≤ 45°', torso <= 45 ? 'good' : torso <= 52 ? 'warn' : 'bad'],
          ['Shoulder vs ankle', drift, '≤ 30% shin', drift <= 30 ? 'good' : drift <= 45 ? 'warn' : 'bad', '%']
        ]
      };
    }
    return { st, step };
  }

  /* ── reference demo rig: produces the same 17-keypoint dict ───────── */
  function rigPress(p, faults) {
    const cx = 300, sy = 200, half = 62, L1 = 82, L2 = 80;
    const SR = [cx - half, sy], SL = [cx + half, sy - (faults.shrug ? 20 * (1 - p) : 0)];
    const wrist = (S, s, pp) => [S[0] + s * lerp(10, 75, pp), S[1] - lerp(161, 55, pp)];
    const WR = wrist(SR, -1, p), WL = wrist(SL, 1, faults.uneven ? clamp(p + (1 - p) * 0.18, 0, 1) : p);
    const ik = (S, W, out) => { const dx = W[0] - S[0], dy = W[1] - S[1]; const d = clamp(Math.hypot(dx, dy), 1, L1 + L2 - 0.01); const base = Math.atan2(dy, dx); const a = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)); const c1 = [S[0] + L1 * Math.cos(base + a), S[1] + L1 * Math.sin(base + a)], c2 = [S[0] + L1 * Math.cos(base - a), S[1] + L1 * Math.sin(base - a)]; return (c1[0] - S[0]) * out > (c2[0] - S[0]) * out ? c1 : c2; };
    const P = (xy, sc = 0.95) => ({ x: xy[0], y: xy[1], score: sc });
    const kp = {
      nose: P([cx, sy - 48]), left_eye: P([cx + 8, sy - 54], 0), right_eye: P([cx - 8, sy - 54], 0), left_ear: P([cx + 18, sy - 50], 0), right_ear: P([cx - 18, sy - 50], 0),
      right_shoulder: P(SR), left_shoulder: P(SL), right_elbow: P(ik(SR, WR, -1)), left_elbow: P(ik(SL, WL, 1)), right_wrist: P(WR), left_wrist: P(WL),
      right_hip: P([cx - 38, 330]), left_hip: P([cx + 38, 330]), right_knee: P([cx - 60, 350]), left_knee: P([cx + 60, 350]), right_ankle: P([cx - 66, 410]), left_ankle: P([cx + 66, 410])
    };
    const scene = (ctx, col) => {
      ctx.strokeStyle = col('--stage-grid'); ctx.lineCap = 'round'; ctx.lineWidth = 6;
      [[cx - 175, 40, cx - 175, 410], [cx + 175, 40, cx + 175, 410]].forEach(([a, b, c, d]) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); });
      ctx.strokeStyle = col('--stage-dim'); ctx.lineWidth = 3;
      [[cx - 175, WR[1], WR[0] - 8, WR[1]], [cx + 175, WL[1], WL[0] + 8, WL[1]]].forEach(([a, b, c, d]) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); });
      ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(cx - 70, 342); ctx.lineTo(cx + 70, 342); ctx.stroke();
      ctx.setLineDash([5, 5]); ctx.strokeStyle = col('--accent-2'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - 140, sy - 161); ctx.lineTo(cx + 140, sy - 161); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = col('--accent-2'); ctx.font = '10px "Space Mono", ui-monospace, monospace'; ctx.fillText('LOCKOUT TARGET', cx + 70, sy - 167);
    };
    return { kp, scene };
  }
  function rigSquat(p, faults) {
    const A = [250, 395], Ls = 96, Lt = 102, Lb = 128;
    const phiS = lerp(4, 36, p) * Math.PI / 180;
    const K = [A[0] + Ls * Math.sin(phiS), A[1] - Ls * Math.cos(phiS)];
    const kAng = lerp(174, faults.shallow ? 112 : 70, p) * Math.PI / 180;
    const vKA = [-Math.sin(phiS), Math.cos(phiS)];
    const rot = (v, t) => [v[0] * Math.cos(t) - v[1] * Math.sin(t), v[0] * Math.sin(t) + v[1] * Math.cos(t)];
    const c1 = rot(vKA, kAng), c2 = rot(vKA, -kAng), vKH = c1[0] < c2[0] ? c1 : c2;
    const Hp = [K[0] + Lt * vKH[0], K[1] + Lt * vKH[1]];
    const phiT = lerp(8, faults.lean ? 64 : 40, p) * Math.PI / 180;
    const Sh = [Hp[0] + Lb * Math.sin(phiT), Hp[1] - Lb * Math.cos(phiT)];
    const P = (xy, sc = 0.95) => ({ x: xy[0], y: xy[1], score: sc });
    const elb = [Sh[0] - 30, Sh[1] + 44], hand = [Sh[0] - 18, Sh[1] + 10], head = [Sh[0] + 26 * Math.sin(phiT) + 6, Sh[1] - 26 * Math.cos(phiT) - 4];
    const kp = { nose: P(head) };
    NAMES.forEach((n) => { if (!kp[n]) kp[n] = P([0, 0], 0); });
    Object.assign(kp, { left_shoulder: P(Sh), left_elbow: P(elb), left_wrist: P(hand), left_hip: P(Hp), left_knee: P(K), left_ankle: P(A) });
    const scene = (ctx, col) => {
      ctx.strokeStyle = col('--stage-grid'); ctx.lineCap = 'round'; ctx.lineWidth = 6;
      [[120, 40, 120, 405], [470, 40, 470, 405]].forEach(([a, b, c, d]) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); });
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(60, 405); ctx.lineTo(540, 405); ctx.stroke();
      ctx.strokeStyle = col('--stage-dim'); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(A[0] - 14, A[1]); ctx.lineTo(A[0] + 38, A[1]); ctx.stroke();
      ctx.fillStyle = col('--stage-dim'); ctx.beginPath(); ctx.arc(Sh[0] - 4, Sh[1] + 6, 15, 0, Math.PI * 2); ctx.fill();
      ctx.setLineDash([5, 5]); ctx.lineWidth = 1; ctx.strokeStyle = col('--accent-2'); ctx.beginPath(); ctx.moveTo(K[0] - 150, K[1]); ctx.lineTo(K[0] + 40, K[1]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = col('--accent-2'); ctx.font = '10px "Space Mono", ui-monospace, monospace'; ctx.fillText('PARALLEL', K[0] - 150, K[1] - 6);
    };
    return { kp, scene };
  }

  /* ── view ────────────────────────────────────────────────────────── */
  const FAULTS = { press: [['shrug', 'Left shoulder shrug'], ['uneven', 'Uneven lockout'], ['fast', 'Rushed eccentric']], squat: [['shallow', 'Shallow depth'], ['lean', 'Excess forward lean'], ['fast', 'Rushed eccentric']] };
  const TIPS = { press: 'Film from the front, chest height, with both hands in frame at lockout.', squat: 'Film side-on, hip height, 3–4 m away, with your whole body in frame.' };
  OS.register('ar', {
    title: 'AR-Vision', icon: 'ar',
    render() {
      const live = AR.src !== 'demo';
      const seg = (act, key, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button class="${AR[key] === v ? 'on' : ''}" data-act="${act}" data-v="${v}" aria-pressed="${AR[key] === v}">${l}</button>`).join('')}</div>`;
      return `${OS.ui.head('AR-Vision v2.4 · real-time form correction', 'AR-Vision', 'MoveNet pose tracking runs on your device. Joint angles are checked against each exercise\'s targets every frame; nothing leaves the browser.')}
      <div class="ar-ctl">
        ${seg('ar-src', 'src', [['camera', 'Live camera'], ['video', 'Your video'], ['demo', 'Reference demo']])}
        ${seg('ar-ex', 'ex', [['press', 'APS Shoulder Press'], ['squat', 'Rack Squat']])}
        ${AR.src === 'video' ? `<label class="btn ghost sm file">${icon('upload', 14)} ${AR.videoURL ? 'Change video' : 'Choose video'}<input id="ar-file" type="file" accept="video/*" data-change="ar-file"></label>` : ''}
        ${!live ? `<div class="faults"><span class="muted small">Simulate a fault</span>${FAULTS[AR.ex].map(([id, n]) => `<button class="chip-btn ${AR.faults[id] ? 'on' : ''}" data-act="ar-fault" data-f="${id}" aria-pressed="${!!AR.faults[id]}">${n}</button>`).join('')}</div>` : ''}
        <label class="field-inline" for="ar-ecc">Eccentric target <select id="ar-ecc" data-change="ar-ecc">${[2, 3, 4].map((n) => `<option value="${n}" ${AR.ecc === n ? 'selected' : ''}>${n} s</option>`).join('')}</select></label>
        <button class="btn ghost sm" data-act="ar-pause" id="ar-pause">${AR.paused ? icon('play', 14) + ' Resume' : icon('pause', 14) + ' Pause'}</button>
      </div>
      <div class="grid g-ar">
        <section class="card flush ar-stage">
          <canvas id="arc" aria-label="Pose overlay"></canvas>
          <div class="ar-badge"><span class="live" id="ar-status"><i></i>${live ? 'Starting…' : 'Reference demo'}</span></div>
          <div class="ar-msg" id="ar-msg" hidden></div>
          ${live ? `<p class="ar-tip small">${esc(TIPS[AR.ex])}</p>` : ''}
        </section>
        <div class="stack">
          <section class="card"><div class="kv4 ar-kv" id="ar-kv"></div></section>
          <section class="card flush"><div class="card-h pad"><h2>Joint angles</h2><span class="muted small">live</span></div><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Joint</th><th class="r">Now</th><th class="r">Target</th><th>Status</th></tr></thead><tbody id="ar-angles"></tbody></table></div></section>
          <section class="card"><div class="card-h"><h2>Correction feed</h2><button class="btn sm" data-act="ar-log">Send reps to session</button></div><ul class="cues" id="ar-cues"></ul></section>
        </div>
      </div>
      <p class="fine">Pose model: Google MoveNet SinglePose Lightning, 17 body keypoints, running locally with TensorFlow.js. ${live ? '' : 'The reference demo animates a model athlete through the same rules engine so you can see each fault get caught.'} Form cues are coaching guidance, not a clinical assessment.</p>`;
    },
    mount(root) { return arMount(root); }
  });

  OS.act('ar-src', (el) => { AR.src = el.dataset.v; AR.paused = false; OS.render(); });
  OS.act('ar-ex', (el) => { AR.ex = el.dataset.v; AR.faults = {}; OS.render(); });
  OS.act('ar-fault', (el) => { AR.faults[el.dataset.f] = !AR.faults[el.dataset.f]; el.classList.toggle('on'); el.setAttribute('aria-pressed', !!AR.faults[el.dataset.f]); });
  OS.change('ar-ecc', (el) => { AR.ecc = +el.value; });
  OS.change('ar-file', (el) => {
    const f = el.files && el.files[0]; if (!f) return;
    if (AR.videoURL) URL.revokeObjectURL(AR.videoURL);
    AR.videoURL = URL.createObjectURL(f); AR.videoName = f.name; AR.paused = false; OS.render();
  });
  OS.act('ar-pause', (el) => { AR.paused = !AR.paused; el.innerHTML = AR.paused ? icon('play', 14) + ' Resume' : icon('pause', 14) + ' Pause'; if (AR._video) { AR.paused ? AR._video.pause() : AR._video.play().catch(() => {}); } });
  OS.act('ar-log', () => {
    const reps = AR.reps || 0; if (!reps) { OS.toast('No reps counted yet.'); return; }
    const name = AR.ex === 'press' ? 'APS Shoulder Press' : 'Rack Squat';
    OS.update((s) => {
      let ex = s.training.session.exercises.find((e) => e.name === name);
      if (!ex) { ex = { id: OS.uid(), name, machine: AR.ex === 'press' ? 'aps' : 'rack', target: { sets: 3, reps: 5, load: 135, unit: 'lb' }, sets: [] }; s.training.session.exercises.push(ex); }
      ex.sets.push({ w: ex.target.load, r: reps, rpe: '', done: true });
    }, { render: false });
    AR.reps = 0; if (AR._an) AR._an.st.reps = 0; OS.toast(`${reps} reps logged to ${name}`);
  });

  function arMount(root) {
    const cv = root.querySelector('#arc'), ctx = cv.getContext('2d');
    const kvEl = root.querySelector('#ar-kv'), angEl = root.querySelector('#ar-angles'), cueEl = root.querySelector('#ar-cues');
    const statusEl = root.querySelector('#ar-status'), msgEl = root.querySelector('#ar-msg');
    const css = getComputedStyle(document.documentElement), col = (n) => css.getPropertyValue(n).trim();
    const dpr = window.devicePixelRatio || 1, live = AR.src !== 'demo';
    let W = 600, H = 440, view = { k: 1, ox: 0, oy: 0 }, raf, alive = true, stream = null, video = null;
    let kp = null, lastRes = null, busy = false, errored = false, frames = 0, fpsT = performance.now(), fps = 0, scan = 0, lastT = performance.now();

    const cues = [];
    const addCue = (sev, text) => { if (cues[0] && cues[0].text === text && Date.now() - cues[0].at < 4000) return; cues.unshift({ sev, text, at: Date.now() }); cues.length = Math.min(cues.length, 6); renderCues(); };
    const renderCues = () => { cueEl.innerHTML = cues.map((c) => `<li class="cue cue-${c.sev}"><span class="cue-dot"></span><p>${esc(c.text)}</p><span class="muted small num">${Math.round((Date.now() - c.at) / 1000)}s</span></li>`).join('') || `<li class="muted small">${live ? 'Cues appear after your first full rep.' : 'Watching the first rep…'}</li>`; };
    renderCues();
    const an = AR._an = makeAnalyzer(AR.ex, () => (AR.src === 'demo' && AR.faults.fast ? AR.ecc : AR.ecc), addCue);
    AR.reps = 0;
    const setStatus = (t, ok = true) => { statusEl.innerHTML = `<i></i>${esc(t)}`; statusEl.classList.toggle('off', !ok); };
    const setMsg = (t) => { msgEl.hidden = !t; msgEl.textContent = t || ''; };

    // canvas sizing: demo uses a fixed 600×440 stage; video/camera fit the source aspect
    const size = () => {
      const cw = cv.parentElement.clientWidth;
      let srcW = 600, srcH = 440;
      if (video && video.videoWidth) { srcW = video.videoWidth; srcH = video.videoHeight; }
      const ch = Math.min(cw * srcH / srcW, live ? 620 : cw * 440 / 600);
      cv.width = cw * dpr; cv.height = ch * dpr; cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
      W = cw; H = ch;
      const k = Math.min(cw / srcW, ch / srcH); view = { k, ox: (cw - srcW * k) / 2, oy: (ch - srcH * k) / 2 };
    };
    size(); const ro = new ResizeObserver(size); ro.observe(cv.parentElement);

    // ── drawing ──
    const map = (p) => [view.ox + p.x * view.k, view.oy + p.y * view.k];
    function bg() {
      ctx.fillStyle = col('--stage'); ctx.fillRect(0, 0, W, H);
      if (live && video && video.readyState >= 2) { ctx.drawImage(video, view.ox, view.oy, video.videoWidth * view.k, video.videoHeight * view.k); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, 0, W, H); }
      else {
        ctx.strokeStyle = col('--stage-grid'); ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      }
      scan = (scan + 2.2) % H; const g = ctx.createLinearGradient(0, scan - 40, 0, scan); g.addColorStop(0, 'rgba(56,189,248,0)'); g.addColorStop(1, 'rgba(56,189,248,0.12)'); ctx.fillStyle = g; ctx.fillRect(0, scan - 40, W, 40);
      ctx.strokeStyle = col('--accent'); ctx.lineWidth = 2; const c = 18;
      [[8, 8, 1, 1], [W - 8, 8, -1, 1], [8, H - 8, 1, -1], [W - 8, H - 8, -1, -1]].forEach(([x, y, sx, sy]) => { ctx.beginPath(); ctx.moveTo(x, y + sy * c); ctx.lineTo(x, y); ctx.lineTo(x + sx * c, y); ctx.stroke(); });
    }
    function skeleton(kpts, res) {
      const good = col('--accent'), bad = col('--bad'), hot = an.st.hot;
      const ok = (n) => kpts[n] && kpts[n].score >= MIN_SCORE;
      ctx.lineCap = 'round';
      EDGES.forEach(([a, b]) => { if (!ok(a) || !ok(b)) return; const p = map(kpts[a]), q = map(kpts[b]); ctx.strokeStyle = hot[a] || hot[b] ? bad : good; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); });
      if (ok('nose')) { const n = map(kpts.nose); ctx.strokeStyle = good; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(n[0], n[1], Math.max(10, 20 * view.k * (live ? 0 : 1)) || 14, 0, Math.PI * 2); ctx.stroke(); }
      NAMES.forEach((n) => { if (n.includes('eye') || n.includes('ear') || n === 'nose' || !ok(n)) return; const p = map(kpts[n]); ctx.fillStyle = col('--stage'); ctx.strokeStyle = hot[n] ? bad : good; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p[0], p[1], 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
      if (res && res.ready) res.arcs.forEach(([a, b, c, deg]) => {
        if (!ok(a) || !ok(b) || !ok(c)) return;
        const A = map(kpts[a]), B = map(kpts[b]), C = map(kpts[c]), colr = hot[b] ? bad : good;
        const a1 = Math.atan2(A[1] - B[1], A[0] - B[0]), a2 = Math.atan2(C[1] - B[1], C[0] - B[0]);
        let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        ctx.strokeStyle = colr; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(B[0], B[1], 22, a1, a1 + d, d < 0); ctx.stroke();
        const mid = a1 + d / 2, tx = B[0] + Math.cos(mid) * 42, ty = B[1] + Math.sin(mid) * 42 + 4, label = deg.toFixed(0) + '°';
        ctx.font = '700 12px "Space Mono", ui-monospace, monospace'; ctx.textAlign = 'center';
        const tw = ctx.measureText(label).width + 8; ctx.fillStyle = 'rgba(4,10,9,0.72)'; ctx.fillRect(tx - tw / 2, ty - 12, tw, 16);
        ctx.fillStyle = colr; ctx.fillText(label, tx, ty); ctx.textAlign = 'left';
      });
    }
    function hud(res) {
      ctx.fillStyle = col('--accent'); ctx.font = '11px "Space Mono", ui-monospace, monospace';
      ctx.fillText(`AR-VISION v2.4 · MOVENET 17-JOINT · ${(res && res.phase || '—').toUpperCase()}`, 18, 26);
      if (live) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillText(Pose.model ? `${Pose.backend.toUpperCase()} · ${fps} fps` : '', 18, H - 16); }
    }
    function panels(res) {
      if (!res || !res.ready) return;
      AR.reps = an.st.reps;
      kvEl.innerHTML = `<div><span>Reps</span><b class="num">${an.st.reps}</b></div><div><span>Phase</span><b>${res.phase}</b></div><div><span>Tempo ecc / con</span><b class="num">${an.st.ecc ? an.st.ecc.toFixed(1) : '–'} / ${an.st.con ? an.st.con.toFixed(1) : '–'} s</b></div><div><span>Range of motion</span><b class="num">${res.rom.toFixed(0)}%</b></div>`;
      angEl.innerHTML = res.rows.map(([n, v, tg, st, u]) => `<tr><td>${n}</td><td class="r num">${v.toFixed(0)}${u || '°'}</td><td class="r num muted">${tg}</td><td>${pill(st, st === 'good' ? 'OK' : st === 'warn' ? 'Watch' : 'Fix')}</td></tr>`).join('');
    }
    panels({ ready: true, phase: '—', rom: 0, rows: [], arcs: [] });

    // ── demo clock ──
    let t0 = performance.now(), phaseName = 'top';
    function demoP(now) {
      const ecc = AR.faults.fast ? 0.9 : AR.ecc, segs = [0.6, ecc, 0.3, 1.1], total = segs.reduce((a, b) => a + b, 0);
      const tt = ((now - t0) / 1000) % total; let acc = 0, i = 0; while (i < 3 && tt > acc + segs[i]) { acc += segs[i]; i++; }
      const f = (tt - acc) / segs[i], ease = (x) => 0.5 - Math.cos(Math.PI * x) / 2;
      return i === 0 ? 0 : i === 1 ? ease(f) : i === 2 ? 1 : 1 - ease(f);
    }

    // ── live sources ──
    async function startLive() {
      video = document.createElement('video'); video.muted = true; video.playsInline = true; video.setAttribute('playsinline', ''); AR._video = video;
      if (AR.src === 'camera') {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setStatus('Camera unavailable', false); setMsg("This view can't use a camera. Choose Your video and upload a recording of your set instead."); return; }
        try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); }
        catch (e) { setStatus('Camera blocked', false); setMsg(e && e.name === 'NotAllowedError' ? "Camera access was blocked. Allow it in your browser, or choose Your video and upload a recording." : "This view can't open a camera. Choose Your video and upload a recording of your set instead."); return; }
        if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
        video.srcObject = stream;
      } else {
        if (!AR.videoURL) { setStatus('No video yet', false); setMsg('Choose a video of one set. ' + TIPS[AR.ex]); return; }
        video.src = AR.videoURL; video.loop = true;
      }
      await new Promise((res) => { if (video.readyState >= 1) res(); else video.onloadedmetadata = res; });
      size();
      try { await video.play(); } catch { setMsg('Press Resume to start the video.'); AR.paused = true; }
      setStatus('Loading pose model…');
      try { await Pose.load((t) => setStatus(t)); }
      catch (e) { setStatus('Model failed', false); setMsg(Pose.error || 'The pose model failed to load.'); return; }
      if (!alive) return;
      setStatus(`Tracking · ${AR.src === 'camera' ? 'live camera' : AR.videoName}`); setMsg('');
    }
    if (live) startLive();

    async function infer() {
      if (busy || !Pose.model || !video || video.readyState < 2 || video.paused || !video.videoWidth) return;
      busy = true;
      try {
        const raw = await Pose.estimate(video, video.videoWidth, video.videoHeight);
        if (!alive) return;
        kp = smoothKp(kp, raw);
        lastRes = an.step(kp, performance.now());
        if (!lastRes.ready) setMsg(lastRes.msg); else if (!msgEl.hidden && msgEl.textContent !== '') setMsg('');
        frames++; const now = performance.now(); if (now - fpsT > 1000) { fps = Math.round(frames * 1000 / (now - fpsT)); frames = 0; fpsT = now; }
        if (lastRes.ready && frames % 3 === 0) panels(lastRes);
        if (errored) { errored = false; setStatus(`Tracking · ${AR.src === 'camera' ? 'live camera' : AR.videoName}`); }
      } catch (e) { errored = true; console.warn('AR-Vision inference', e); setStatus('Tracking paused, retrying', false); }
      finally { busy = false; }
    }

    let frame = 0;
    const loop = (now) => {
      if (!alive) return;
      raf = requestAnimationFrame(loop); frame++;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (live) {
        infer();
        bg(); if (kp) skeleton(kp, lastRes); hud(lastRes);
      } else {
        if (AR.paused) { t0 += now - lastT; lastT = now; return; }
        lastT = now;
        const p = demoP(now);
        const rig = AR.ex === 'press' ? rigPress(p, AR.faults) : rigSquat(p, AR.faults);
        view = { k: Math.min(W / 600, H / 440), ox: (W - 600 * Math.min(W / 600, H / 440)) / 2, oy: 0 };
        bg();
        ctx.save(); ctx.translate(view.ox, view.oy); ctx.scale(view.k, view.k); rig.scene(ctx, col); ctx.restore();
        lastRes = an.step(rig.kp, now);
        skeleton(rig.kp, lastRes); hud(lastRes);
        if (frame % 6 === 0) panels(lastRes);
      }
      if (frame % 60 === 0) renderCues();
    };
    raf = requestAnimationFrame(loop);
    return () => {
      alive = false; cancelAnimationFrame(raf); ro.disconnect();
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (video) { video.pause(); video.removeAttribute('src'); video.srcObject = null; }
      AR._video = null;
    };
  }
})();
