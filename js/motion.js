/* ═══ MYO — MOTION LAB: XR vector analysis for plyometrics and movement assessment ═══
   Pose from MoveNet (OS.Pose, js/ar.js) on an uploaded video or the camera, or a synthetic demo. Every frame draws joint
   velocity vectors, a hip-centre trail and knee angle arcs. Tests:
   · Countermovement jump: jump height from flight time, h = g·t²/8, with each threshold crossing corrected by its speed.
   · Drop jump: ground contact time from landing impact to take-off, rebound height, reactive strength index (RSI = h / contact).
   · Overhead squat and single-leg squat: knee frontal-plane projection angle (valgus), pelvic drop, trunk shift, depth.
   Scale: the body's nose-to-ankle span is about 0.88 of standing height, which turns pixels into metres.
   These are screening estimates from a 2D camera, not clinical measurements; a 120–240 fps slow-motion clip is most accurate. */
(function () {
  'use strict';
  const { esc, icon, clamp, dayKey, pill } = OS;
  const G = 9.81;
  const TESTS = {
    cmj: { name: 'Countermovement jump', view: 'Front or side, whole body in frame, phone at hip height 3 m away', what: 'Jump height, flight time, countermovement depth, take-off speed' },
    drop: { name: 'Drop jump', view: 'Side view, box and landing spot in frame', what: 'Contact time, rebound height, reactive strength index' },
    ohs: { name: 'Overhead squat', view: 'Front view, arms overhead, feet shoulder-width, 5 slow reps', what: 'Knee valgus each side, trunk shift, depth' },
    sls: { name: 'Single-leg squat', view: 'Front view, squat on one leg to about 60° of knee bend, 5 reps', what: 'Knee valgus, pelvic drop, trunk shift' }
  };
  const ENVS = {
    gym: { name: 'Gym floor', tips: ['Clear 2 m around you; racks and mirrors confuse the tracker less when they are behind the camera.', 'Mount the phone on a bench or tripod at hip height, 3–4 m away.', 'Wear fitted clothes; loose shorts hide the knees.'], tests: ['cmj', 'drop', 'ohs', 'sls'] },
    field: { name: 'Field or track', tips: ['Film with the sun behind the camera, not behind you.', 'Use a tripod; handheld shake adds false movement.', 'Jump on firm ground; sand and soft turf lengthen contact times.'], tests: ['cmj', 'drop'] },
    home: { name: 'Home', tips: ['Clear a 2 × 2 m space with a plain wall behind you.', 'Prop the phone at hip height on books or a shelf.', 'Turn on the room lights; dim rooms blur fast movement.'], tests: ['cmj', 'ohs', 'sls'] }
  };
  const ST = { test: 'cmj', src: 'demo', env: 'gym', slow: 1, video: null, videoName: '', last: null };
  const IN_CLAUDE = !!(window.claude && window.claude.use);
  const LBL = (n) => n.replace('left_', 'L ').replace('right_', 'R ').replace('_', ' ');

  /* ── geometry ── */
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, score: Math.min(a.score, b.score) });
  const ang = (a, b, c) => { const v1 = [a.x - b.x, a.y - b.y], v2 = [c.x - b.x, c.y - b.y]; const d = Math.hypot(...v1) * Math.hypot(...v2) || 1; return Math.acos(clamp((v1[0] * v2[0] + v1[1] * v2[1]) / d, -1, 1)) * 180 / Math.PI; };
  // knee valgus as the shank's inward tilt: degrees the knee sits inside the foot, seen from the front (positive = inward).
  // Steadier than the hip-knee-ankle projection angle at deep knee bend, where the foreshortened thigh exaggerates it.
  function inward(knee, ankle, side) {
    const dx = side === 'left' ? ankle.x - knee.x : knee.x - ankle.x;   // the subject's left knee shows on the image's right
    return Math.atan2(dx, Math.max(1, ankle.y - knee.y)) * 180 / Math.PI;
  }
  const fppa = inward;

  // least-squares parabola through [t, height] samples → [take-off, touch-down] where it meets zero
  function flightFit(pts) {
    if (pts.length < 4) return null;
    const tm = pts.reduce((a, p) => a + p[0], 0) / pts.length, S = [0, 0, 0, 0, 0], T = [0, 0, 0];
    pts.forEach(([t, y]) => { const x = t - tm; let xp = 1; for (let k = 0; k < 5; k++) { S[k] += xp; if (k < 3) T[k] += xp * y; xp *= x; } });
    const M = [[S[4], S[3], S[2]], [S[3], S[2], S[1]], [S[2], S[1], S[0]]], det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const D = det(M); if (!D) return null;
    const col = (i) => M.map((r, j) => r.map((v, k) => (k === i ? [T[2], T[1], T[0]][j] : v)));
    const a = det(col(0)) / D, b = det(col(1)) / D, c = det(col(2)) / D, disc = b * b - 4 * a * c;
    if (a >= 0 || disc <= 0) return null;
    const r1 = (-b + Math.sqrt(disc)) / (2 * a), r2 = (-b - Math.sqrt(disc)) / (2 * a);
    return [Math.min(r1, r2) + tm, Math.max(r1, r2) + tm];
  }

  /* ── demo: a synthetic athlete facing the camera (600 × 440 frame) ── */
  const BASE = { nose: [300, 90], left_eye: [307, 84], right_eye: [293, 84], left_ear: [315, 88], right_ear: [285, 88], left_shoulder: [335, 140], right_shoulder: [265, 140], left_elbow: [345, 195], right_elbow: [255, 195], left_wrist: [350, 245], right_wrist: [250, 245], left_hip: [320, 240], right_hip: [280, 240], left_knee: [318, 320], right_knee: [282, 320], left_ankle: [316, 395], right_ankle: [284, 395] };
  const ease = (u) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(u, 0, 1));
  function synth(test, t) {
    const kp = {}; for (const [n, [x, y]] of Object.entries(BASE)) kp[n] = { x, y, score: 0.95 };
    const shift = (names, dx, dy) => names.forEach((n) => { kp[n].x += dx; kp[n].y += dy; });
    const UP = ['nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear', 'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist'];
    const ALL = Object.keys(BASE);
    if (test === 'cmj' || test === 'drop') {
      const P = 3.2, u = t % P;
      let dip = 0, lift = 0, box = 0;
      if (test === 'cmj') {
        if (u > 0.7 && u < 1.25) dip = 40 * Math.sin(Math.PI * (u - 0.7) / 0.55);
        if (u >= 1.25 && u < 1.75) { const v = (u - 1.25) / 0.5; lift = 4 * 60 * v * (1 - v); }
        if (u >= 1.75 && u < 2.1) dip = 28 * Math.sin(Math.PI * (u - 1.75) / 0.35);
      } else {
        if (u < 0.8) box = -45;
        else if (u < 1.1) { const v = (u - 0.8) / 0.3; box = -45 * (1 - v * v); }
        if (u >= 1.1 && u < 1.32) dip = 22 * Math.sin(Math.PI * (u - 1.1) / 0.22);
        if (u >= 1.32 && u < 1.77) { const v = (u - 1.32) / 0.45; lift = 4 * 48 * v * (1 - v); }
        if (u >= 1.77 && u < 2.1) dip = 24 * Math.sin(Math.PI * (u - 1.77) / 0.33);
      }
      shift(UP.concat(['left_hip', 'right_hip']), 0, dip); shift(['left_knee', 'right_knee'], 0, dip * 0.45); kp.left_knee.x += dip * 0.12; kp.right_knee.x -= dip * 0.12;
      const swing = test === 'cmj' && u > 1.0 && u < 1.6 ? Math.sin(Math.PI * (u - 1.0) / 0.6) : 0; shift(['left_wrist', 'right_wrist'], 0, -110 * swing); shift(['left_elbow', 'right_elbow'], 0, -55 * swing);
      shift(ALL, 0, box - lift);
    } else {
      const P = 3, u = (t % P) / P, d = ease(u < 0.5 ? u * 2 : (1 - u) * 2) * (test === 'ohs' ? 90 : 55);
      shift(['left_wrist', 'right_wrist'], 0, -230); kp.left_wrist.x -= 20; kp.right_wrist.x += 20; shift(['left_elbow', 'right_elbow'], 0, -115);
      if (test === 'sls') { kp.right_ankle.y -= 60; kp.right_ankle.x += 6; kp.right_knee.y -= 30; }
      shift(UP.concat(['left_hip', 'right_hip']), test === 'sls' ? d * 0.15 : 0, d);
      shift(['left_knee', 'right_knee'], 0, d * 0.4);
      kp.left_knee.x -= (test === 'sls' ? 16 : 11) * d / 90;          // the left knee drifts inward at depth
      if (test === 'sls') { kp.right_hip.y += 9 * d / 55; kp.right_knee.y += 9 * d / 55; }
    }
    return kp;
  }

  /* ── analysis: one state machine per session ── */
  function makeLab(test, stature) {
    const L = { test, ground: null, air: false, t0: 0, v0: 0, vel: {}, prev: null, prevT: 0, trail: [], bodyPx: null, standHip: null, maxDip: 0, results: [], reps: [], cur: null, impact: null, fallV: 0 };
    L.feed = (kp, t) => {
      const ok = (n) => kp[n] && kp[n].score >= 0.3;
      if (!['left_hip', 'right_hip', 'left_ankle', 'right_ankle', 'nose'].every(ok)) { L.prev = null; return; }
      const hip = mid(kp.left_hip, kp.right_hip), ank = mid(kp.left_ankle, kp.right_ankle);
      const span = Math.hypot(kp.nose.x - ank.x, kp.nose.y - ank.y) / 0.88;
      L.bodyPx = L.bodyPx ? L.bodyPx * 0.95 + span * 0.05 : span;
      const pxm = L.bodyPx / (stature / 100);
      const dt = L.prev ? t - L.prevT : 0;
      // joint velocity vectors (m/s), smoothed
      if (L.prev && dt > 0 && dt < 0.5) {
        ['nose', 'left_wrist', 'right_wrist', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle'].forEach((n) => { if (!ok(n) || !L.prev[n]) return; const vx = (kp[n].x - L.prev[n].x) / dt / pxm, vy = (kp[n].y - L.prev[n].y) / dt / pxm, o = L.vel[n] || { vx, vy }; L.vel[n] = { vx: o.vx * 0.5 + vx * 0.5, vy: o.vy * 0.5 + vy * 0.5 }; });
        const ph = mid(L.prev.left_hip, L.prev.right_hip), vy = (hip.y - ph.y) / dt / pxm, vx = (hip.x - ph.x) / dt / pxm, o = L.vel.hip || { vx, vy };
        L.vel.hip = { vx: o.vx * 0.5 + vx * 0.5, vy: o.vy * 0.5 + vy * 0.5 };
      }
      L.trail.push([hip.x, hip.y]); if (L.trail.length > 90) L.trail.shift();
      if (test === 'cmj' || test === 'drop') jump(kp, t, hip, ank, pxm, dt);
      else squat(kp, t, hip, pxm);
      L.prev = kp; L.prevT = t;
    };
    function jump(kp, t, hip, ank, pxm, dt) {
      const thr = 0.015 * L.bodyPx;
      L.ground = L.ground == null ? ank.y : Math.max(L.ground, ank.y);
      if (!L.air && !L.standHip) L.standHip = hip.y;
      if (!L.air) { L.standHip = L.standHip * 0.98 + hip.y * 0.02; L.maxDip = Math.max(L.maxDip, (hip.y - L.standHip) / pxm); }
      const up = L.ground - ank.y, prevUp = L.prevUp == null ? up : L.prevUp, vA = dt > 0 ? (up - prevUp) / dt : 0;   // feet height px, upward speed px/s
      L.prevUp = up;
      // drop jump: the landing impact is when the falling feet stop (half a frame back)
      if (test === 'drop' && !L.air) { if (-vA > 0.8 * pxm) L.fallV = -vA; else if (L.fallV && Math.abs(vA) < 0.3 * pxm) { L.impact = t - dt / 2; L.fallV = 0; } }
      // flight: a parabola fitted through every airborne frame, solved for where the feet leave and meet the ground,
      // so neither the frame rate nor the threshold biases flight time (falls back to linear crossings)
      if (!L.air && up > thr && vA > 0) { L.air = true; L.t0 = t - up / vA; L.pts = [[L.prevT, prevUp], [t, up]]; }
      else if (L.air && up > thr) L.pts.push([t, up]);
      else if (L.air && up <= thr) {
        L.air = false; L.pts.push([t, up]);
        const down = Math.max(1, (prevUp - up) / (dt || 1)), lin = [L.t0, L.prevT + prevUp / down], fit = flightFit(L.pts.slice(1, -1)) || lin;
        const flight = fit[1] - fit[0], slow = ST.slow || 1, ft = flight / slow, before = L.impact;
        if (ft > 0.12 && ft < 1.2) {
          const h = G * ft * ft / 8, r = { at: new Date().toISOString(), flight: ft, h, dip: L.maxDip, v: Math.sqrt(2 * G * h) };
          if (test === 'drop' && before && fit[0] > before) { const ct = (fit[0] - before) / slow; if (ct > 0.08 && ct < 1.0) { r.contact = ct; r.rsi = h / ct; } }
          if (test === 'cmj' || r.rsi) L.results.push(r);
          L.last = r;
        }
        // a drop jump's contact starts at this touchdown; stepping off a box isn't a parabola, so use the linear estimate there
        L.maxDip = 0; L.impact = ft > 0.12 && ft < 1.2 ? fit[1] : lin[1];
      }
    }
    function squat(kp, t, hip, pxm) {
      const ok = (n) => kp[n] && kp[n].score >= 0.3;
      if (!['left_knee', 'right_knee', 'left_shoulder', 'right_shoulder'].every(ok)) return;
      if (L.standHip == null || (!L.cur && hip.y < L.standHip)) L.standHip = hip.y;
      const depth = (hip.y - L.standHip) / pxm;
      const sh = mid(kp.left_shoulder, kp.right_shoulder), stance = test === 'sls' ? (kp.left_ankle.y >= kp.right_ankle.y ? 'left' : 'right') : null;
      const frame = { depth, vL: inward(kp.left_knee, kp.left_ankle, 'left'), vR: inward(kp.right_knee, kp.right_ankle, 'right'),
        kasr: Math.abs(kp.left_knee.x - kp.right_knee.x) / Math.max(1, Math.abs(kp.left_ankle.x - kp.right_ankle.x)),
        trunk: Math.atan2(sh.x - hip.x, hip.y - sh.y) * 180 / Math.PI, pelvis: Math.atan2(kp.left_hip.y - kp.right_hip.y, kp.left_hip.x - kp.right_hip.x) * 180 / Math.PI, stance,
        kneeBend: 180 - ang(kp[stance === 'right' ? 'right_hip' : 'left_hip'], kp[stance === 'right' ? 'right_knee' : 'left_knee'], kp[stance === 'right' ? 'right_ankle' : 'left_ankle']) };
      if (!L.cur && depth > 0.08) L.cur = { bottom: frame };
      if (L.cur) { if (frame.depth > L.cur.bottom.depth) L.cur.bottom = frame; if (depth < 0.03) { L.reps.push(L.cur.bottom); L.cur = null; if (L.reps.length > 10) L.reps.shift(); } }
    }
    L.summary = () => {
      if (test === 'cmj') { if (!L.results.length) return null; const best = L.results.reduce((a, b) => (b.h > a.h ? b : a)); return { n: L.results.length, best, avg: L.results.reduce((a, r) => a + r.h, 0) / L.results.length }; }
      if (test === 'drop') { const rs = L.results.filter((r) => r.rsi); if (!rs.length) return null; const best = rs.reduce((a, b) => (b.rsi > a.rsi ? b : a)); return { n: rs.length, best }; }
      if (!L.reps.length) return null;
      const avg = (k) => L.reps.reduce((a, r) => a + r[k], 0) / L.reps.length;
      return { n: L.reps.length, vL: avg('vL'), vR: avg('vR'), kasr: avg('kasr'), trunk: avg('trunk'), pelvis: avg('pelvis'), depth: avg('depth'), knee: avg('kneeBend'), stance: L.reps.at(-1).stance };
    };
    return L;
  }

  /* ── view ── */
  const f2 = (v, d = 2) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(d));
  function resultHTML(test, S) {
    if (!S) return `<p class="muted small">${test === 'cmj' || test === 'drop' ? 'Jump when ready. Each landing records a jump.' : 'Squat slowly; each rep that returns to standing is scored.'}</p>`;
    const flag = (v, lim) => (Math.abs(v) > lim ? pill('warn', 'Check') : pill('good', 'Within range'));
    if (test === 'cmj') return `<dl class="dl ml-res"><dt>Best jump</dt><dd><b class="num">${f2(S.best.h * 100, 1)} cm</b></dd><dt>Average of ${S.n}</dt><dd class="num">${f2(S.avg * 100, 1)} cm</dd><dt>Flight time</dt><dd class="num">${f2(S.best.flight * 1000, 0)} ms</dd><dt>Take-off speed</dt><dd class="num">${f2(S.best.v)} m/s</dd><dt>Countermovement</dt><dd class="num">${f2(S.best.dip * 100, 0)} cm</dd></dl>`;
    if (test === 'drop') return `<dl class="dl ml-res"><dt>Reactive strength index</dt><dd><b class="num">${f2(S.best.rsi)}</b> m/s</dd><dt>Ground contact</dt><dd class="num">${f2(S.best.contact * 1000, 0)} ms</dd><dt>Rebound height</dt><dd class="num">${f2(S.best.h * 100, 1)} cm</dd><dt>Valid jumps</dt><dd class="num">${S.n}</dd></dl>`;
    const kv = test === 'sls' ? (S.stance === 'right' ? S.vR : S.vL) : null;
    const inFlag = (v) => (v > 10 ? pill('warn', 'Knee drifts in') : pill('good', 'Over the foot'));
    return `<dl class="dl ml-res">${test === 'ohs' ? `<dt>Left knee</dt><dd class="num">${f2(S.vL, 0)}° in ${inFlag(S.vL)}</dd><dt>Right knee</dt><dd class="num">${f2(S.vR, 0)}° in ${inFlag(S.vR)}</dd><dt>Knee-to-ankle width</dt><dd class="num">${f2(S.kasr, 2)} ${S.kasr < 0.8 ? pill('warn', 'Narrow') : pill('good', 'Good')}</dd>` : `<dt>${S.stance === 'right' ? 'Right' : 'Left'} knee</dt><dd class="num">${f2(kv, 0)}° in ${inFlag(kv)}</dd><dt>Pelvic drop</dt><dd class="num">${f2(Math.abs(S.pelvis), 0)}° ${flag(S.pelvis, 6)}</dd><dt>Knee bend</dt><dd class="num">${f2(S.knee, 0)}°</dd>`}<dt>Trunk shift</dt><dd class="num">${f2(Math.abs(S.trunk), 0)}° ${flag(S.trunk, 8)}</dd><dt>Depth</dt><dd class="num">${f2(S.depth * 100, 0)} cm</dd><dt>Reps scored</dt><dd class="num">${S.n}</dd></dl>
      <p class="fine">Cut-offs (knee more than 10° inside the foot, knee-to-ankle width under 0.8, pelvis 6°, trunk 8°) are screening guides, not diagnoses. Repeated flags are worth showing a coach or physical therapist.</p>`;
  }

  OS.register('motion', {
    title: 'Motion Lab', icon: 'motion',
    render(s) {
      const T = TESTS[ST.test], E = ENVS[ST.env], log = ((s.motion && s.motion.log) || []).slice(-8).reverse();
      return `${OS.ui.head('Training · XR', 'Motion Lab', 'Vector analysis of your movement from a video or camera: jump height, reactive strength, knee control and trunk position.', `<a class="btn ghost" href="#ar">${icon('ar', 16)} Form coaching</a>`)}
        <div class="seg ml-tests" role="tablist" aria-label="Test">${Object.entries(TESTS).map(([k, t]) => `<button role="tab" aria-selected="${ST.test === k}" data-act="ml-test" data-v="${k}">${t.name}</button>`).join('')}</div>
        <div class="grid ml-grid">
          <section class="card ml-stage-card"><div class="ml-src row">
              <button class="btn sm ${ST.src === 'demo' ? '' : 'ghost'}" data-act="ml-src" data-v="demo">Demo athlete</button>
              <label class="btn sm ${ST.src === 'video' ? '' : 'ghost'} rights-file">${icon('upload', 14)} ${ST.videoName ? esc(ST.videoName.slice(0, 24)) : 'Upload video'}<input type="file" accept="video/*" class="sr" data-change="ml-video"></label>
              <button class="btn sm ${ST.src === 'camera' ? '' : 'ghost'}" data-act="ml-src" data-v="camera" ${IN_CLAUDE ? 'disabled title="The camera works on Myo\'s own web address"' : ''}>Camera</button>
              ${ST.src === 'video' ? `<label class="ml-slow"><span class="small muted">Clip speed</span><select data-change="ml-slow" aria-label="Slow-motion factor">${[[1, 'Real time'], [4, 'Slow-mo 120 fps'], [8, 'Slow-mo 240 fps']].map(([v, l]) => `<option value="${v}" ${ST.slow === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}
            </div>
            <div class="ml-stage"><canvas id="ml-cv" aria-label="Motion analysis view: skeleton, joint velocity vectors and angles"></canvas><p class="ml-status" id="ml-status" role="status"></p></div>
            <p class="fine">${esc(T.view)}. ${IN_CLAUDE ? 'Inside Claude, upload a video; the camera works on Myo\'s own web address.' : 'Video and camera frames are analysed on this device and never uploaded.'}</p></section>
          <aside class="stack">
            <section class="card"><div class="card-h"><h2>${esc(T.name)}</h2><span class="muted small">${esc(T.what)}</span></div><div id="ml-res">${resultHTML(ST.test, null)}</div>
              <div class="row"><button class="btn sm" data-act="ml-save">Save result</button><button class="btn ghost sm" data-act="ml-reset">Reset</button></div></section>
            <section class="card"><div class="card-h"><h2>Live vectors</h2><span class="muted small">Speed of each joint</span></div><ul class="ml-vec" id="ml-vec"><li class="muted small">Waiting for a body in frame…</li></ul></section>
            <section class="card"><div class="card-h"><h2>Environment</h2></div><div class="chips">${Object.entries(ENVS).map(([k, e]) => `<button class="chip-btn ${ST.env === k ? 'on' : ''}" data-act="ml-env" data-v="${k}" aria-pressed="${ST.env === k}">${e.name}</button>`).join('')}</div>
              <ul class="ml-tips">${E.tips.map((x) => `<li>${esc(x)}</li>`).join('')}</ul><p class="fine">Suits: ${E.tests.map((k) => TESTS[k].name).join(', ')}.</p></section>
          </aside></div>
        <section class="card"><div class="card-h"><h2>Saved results</h2><span class="muted small">${log.length ? 'Latest first' : 'None yet'}</span></div>
          ${log.length ? `<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th scope="col">Date</th><th scope="col">Test</th><th scope="col">Result</th><th scope="col">Where</th></tr></thead><tbody>${log.map((r) => `<tr><td>${OS.fmtDate(r.d)}</td><td>${esc(TESTS[r.test] ? TESTS[r.test].name : r.test)}</td><td class="num">${esc(r.text)}</td><td>${esc(ENVS[r.env] ? ENVS[r.env].name : '')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">Save a result to track it over time.</p>'}</section>`;
    },
    mount(root, s) {
      const cv = root.querySelector('#ml-cv'), ctx = cv.getContext('2d'), stEl = root.querySelector('#ml-status'), resEl = root.querySelector('#ml-res'), vecEl = root.querySelector('#ml-vec');
      const dpr = Math.min(2, window.devicePixelRatio || 1), stature = (s.profile && s.profile.heightCm) || 175;
      const lab = ST.lab = makeLab(ST.test, stature);
      let raf = 0, alive = true, video = null, stream = null, busy = false, kp = null, W = 600, H = 440, view = { k: 1, ox: 0, oy: 0 }, srcW = 600, srcH = 440, lastUI = 0;
      const status = (t) => { stEl.textContent = t || ''; stEl.hidden = !t; };
      const size = () => { const cw = cv.parentElement.clientWidth || 600, ch = Math.min(560, cw * srcH / srcW); cv.width = cw * dpr; cv.height = ch * dpr; cv.style.height = ch + 'px'; W = cw; H = ch; const k = Math.min(cw / srcW, ch / srcH); view = { k, ox: (cw - srcW * k) / 2, oy: (ch - srcH * k) / 2 }; };
      const ro = new ResizeObserver(() => requestAnimationFrame(size)); ro.observe(cv.parentElement); size();
      const P = (p) => [view.ox + p.x * view.k, view.oy + p.y * view.k];
      const arrow = (x, y, dx, dy, col, w = 2) => { const L = Math.hypot(dx, dy); if (L < 3) return; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, y + dy); ctx.stroke(); const a = Math.atan2(dy, dx); ctx.beginPath(); ctx.moveTo(x + dx, y + dy); ctx.lineTo(x + dx - 8 * Math.cos(a - 0.45), y + dy - 8 * Math.sin(a - 0.45)); ctx.lineTo(x + dx - 8 * Math.cos(a + 0.45), y + dy - 8 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill(); };
      const EDGES = [['left_shoulder', 'right_shoulder'], ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'], ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'], ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'], ['left_hip', 'right_hip'], ['left_hip', 'left_knee'], ['left_knee', 'left_ankle'], ['right_hip', 'right_knee'], ['right_knee', 'right_ankle']];
      function draw(t) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#040b22'; ctx.fillRect(0, 0, W, H);
        if (video && video.readyState >= 2) { ctx.drawImage(video, view.ox, view.oy, srcW * view.k, srcH * view.k); ctx.fillStyle = 'rgba(2,8,30,.35)'; ctx.fillRect(0, 0, W, H); }
        else { ctx.strokeStyle = 'rgba(124,200,255,.08)'; ctx.lineWidth = 1; for (let x = 0; x < W; x += 28) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y < H; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } }
        if (!kp) return;
        const ok = (n) => kp[n] && kp[n].score >= 0.3, pxm = lab.bodyPx ? lab.bodyPx / (stature / 100) * view.k : 1;
        // ground line and hip trail
        if (lab.ground != null) { const gy = view.oy + lab.ground * view.k; ctx.strokeStyle = 'rgba(143,216,255,.35)'; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(0, gy + 4); ctx.lineTo(W, gy + 4); ctx.stroke(); ctx.setLineDash([]); }
        ctx.strokeStyle = 'rgba(167,139,250,.7)'; ctx.lineWidth = 2; ctx.beginPath(); lab.trail.forEach(([x, y], i) => { const [px, py] = [view.ox + x * view.k, view.oy + y * view.k]; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.stroke();
        ctx.lineCap = 'round';
        EDGES.forEach(([a, b]) => { if (!ok(a) || !ok(b)) return; const p = P(kp[a]), q = P(kp[b]); ctx.strokeStyle = 'rgba(86,196,255,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); });
        Object.keys(kp).forEach((n) => { if (!ok(n)) return; const p = P(kp[n]); ctx.fillStyle = '#e6f7ff'; ctx.beginPath(); ctx.arc(p[0], p[1], 3.2, 0, Math.PI * 2); ctx.fill(); });
        // knee angle arcs
        [['left_hip', 'left_knee', 'left_ankle'], ['right_hip', 'right_knee', 'right_ankle']].forEach(([a, b, c]) => { if (![a, b, c].every(ok)) return; const p = P(kp[b]), a1 = Math.atan2(kp[a].y - kp[b].y, kp[a].x - kp[b].x), a2 = Math.atan2(kp[c].y - kp[b].y, kp[c].x - kp[b].x); ctx.strokeStyle = 'rgba(251,191,36,.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p[0], p[1], 16, Math.min(a1, a2), Math.max(a1, a2)); ctx.stroke(); ctx.fillStyle = '#fde68a'; ctx.font = '600 11px ui-monospace, monospace'; ctx.fillText(`${Math.round(ang(kp[a], kp[b], kp[c]))}°`, p[0] + 20, p[1] + 4); });
        // velocity vectors: 0.15 s look-ahead, colour by speed
        const vecs = Object.entries(lab.vel);
        vecs.forEach(([n, v]) => { const at = n === 'hip' ? (ok('left_hip') && ok('right_hip') ? mid(kp.left_hip, kp.right_hip) : null) : ok(n) ? kp[n] : null; if (!at) return; const p = P(at), sp = Math.hypot(v.vx, v.vy); arrow(p[0], p[1], v.vx * pxm * 0.15, v.vy * pxm * 0.15, sp > 2 ? '#fb8a4a' : sp > 0.8 ? '#fbbf24' : '#34d399', n === 'hip' ? 3 : 2); });
        if (lab.air) { ctx.fillStyle = '#fb8a4a'; ctx.font = '700 12px ui-monospace, monospace'; ctx.fillText('AIRBORNE', 14, 22); }
        if (lab.last && t - (lab.lastShown || 0) < 2.5) { ctx.fillStyle = '#ffffff'; ctx.font = '700 20px Inter, sans-serif'; ctx.fillText(`${(lab.last.h * 100).toFixed(1)} cm${lab.last.rsi ? ` · RSI ${lab.last.rsi.toFixed(2)}` : ''}`, 14, H - 18); }
      }
      function ui() {
        resEl.innerHTML = resultHTML(ST.test, lab.summary());
        const v = Object.entries(lab.vel).map(([n, x]) => [n, Math.hypot(x.vx, x.vy), x.vy]).sort((a, b) => b[1] - a[1]).slice(0, 6);
        vecEl.innerHTML = v.length ? v.map(([n, sp, vy]) => `<li><span>${esc(n === 'hip' ? 'Hip centre' : LBL(n))}</span><b class="num">${sp.toFixed(2)} m/s</b><span class="muted small">${vy < -0.2 ? 'rising' : vy > 0.2 ? 'falling' : 'steady'}</span></li>`).join('') : '<li class="muted small">Waiting for a body in frame…</li>';
      }
      let lastLast = null;
      async function frame(now) {
        if (!alive) return; raf = requestAnimationFrame(frame);
        let t = now / 1000;
        if (ST.src === 'demo') { kp = synth(ST.test, t); lab.feed(kp, t); }
        else if (video && video.readyState >= 2 && OS.Pose.model && !busy) {
          busy = true;
          try { const k = await OS.Pose.estimate(video, srcW, srcH); t = ST.src === 'video' ? video.currentTime : t; kp = k; lab.feed(k, t); } catch { /* skip this frame */ }
          busy = false;
        }
        if (lab.last !== lastLast) { lastLast = lab.last; lab.lastShown = t; }
        draw(t);
        if (now - lastUI > 250) { lastUI = now; ui(); }
      }
      async function startLive() {
        status('Loading the pose model…');
        try { await OS.Pose.load(status); } catch (e) { status(OS.Pose.error || 'The pose model failed to load.'); return; }
        video = document.createElement('video'); video.muted = true; video.playsInline = true; video.loop = ST.src === 'video';
        if (ST.src === 'video') { if (!ST.video) { status('Choose a video file.'); return; } video.src = ST.video; }
        else { try { stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); video.srcObject = stream; } catch { status('Camera access was declined or is unavailable. Upload a video instead.'); return; } }
        await video.play().catch(() => {});
        video.addEventListener('loadedmetadata', () => { srcW = video.videoWidth; srcH = video.videoHeight; size(); });
        if (video.videoWidth) { srcW = video.videoWidth; srcH = video.videoHeight; size(); }
        status('');
      }
      if (ST.src !== 'demo') startLive(); else status('');
      raf = requestAnimationFrame(frame);
      return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); if (stream) stream.getTracks().forEach((x) => x.stop()); if (video) { video.pause(); video.removeAttribute('src'); } };
    }
  });

  OS.act('ml-test', (el) => { ST.test = el.dataset.v; OS.render(); });
  OS.act('ml-src', (el) => { ST.src = el.dataset.v; OS.render(); });
  OS.act('ml-env', (el) => { ST.env = el.dataset.v; OS.render(); });
  OS.act('ml-reset', () => OS.render());
  OS.change('ml-slow', (el) => { ST.slow = +el.value || 1; OS.render(); });
  OS.change('ml-video', (el) => { const f = el.files && el.files[0]; if (!f) return; if (ST.video) URL.revokeObjectURL(ST.video); ST.video = URL.createObjectURL(f); ST.videoName = f.name; ST.src = 'video'; OS.render(); });
  OS.act('ml-save', () => {
    const S = ST.lab && ST.lab.summary();
    if (!S) { OS.toast('Nothing to save yet: record a jump or a few reps first.'); return; }
    const text = ST.test === 'cmj' ? `${(S.best.h * 100).toFixed(1)} cm best of ${S.n}` : ST.test === 'drop' ? `RSI ${S.best.rsi.toFixed(2)} · ${Math.round(S.best.contact * 1000)} ms contact` : ST.test === 'ohs' ? `Knees in L ${Math.round(S.vL)}° R ${Math.round(S.vR)}° · trunk ${Math.round(Math.abs(S.trunk))}°` : `Knee in ${Math.round(S.stance === 'right' ? S.vR : S.vL)}° · pelvis ${Math.round(Math.abs(S.pelvis))}°`;
    OS.update((s) => { s.motion = s.motion || { log: [] }; s.motion.log.push({ d: dayKey(), test: ST.test, env: ST.env, text, src: ST.src, data: S }); s.motion.log = s.motion.log.slice(-200); }, { keepSample: true });
    OS.toast(ST.src === 'demo' ? 'Saved (from the demo athlete)' : 'Saved');
  });
  OS.motion = { synth, makeLab, fppa };
})();
