/* ═══ MYOKINETICS OS v4 — BODY SCAN: progress photos → pose → hologram / anatomy layers ═══
   Modes for the command-center stage:
     camera  · plain progress-photo view: take, upload, live camera, gallery
     holo    · the photo rebuilt as a blue hologram with x-ray skeleton and organs lit by biomarker status
     anatomy · realistic layers peeled over the photo: skin → muscle → organs → skeleton
   Photos stay on this device (IndexedDB). Only pose measurements go to Myo when the member asks. */
(function () {
  'use strict';
  const { esc, clamp, icon } = OS;
  const MIN = 0.3;
  const LS_KEY = 'mk-scan-ui';

  const Scan = OS.Scan = {
    mode: '3d', photos: [], cur: null, status: '', busy: false, ready: false, persistent: true,
    layers: { skin: true, muscle: true, organs: true, skeleton: false }, skin: 0.55,
    urls: {}, holo: {}, stream: null, ai: {}
  };
  try { const u = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); if (u.mode && u.v3d) Scan.mode = u.mode; if (u.layers) Object.assign(Scan.layers, u.layers); if (u.skin != null) Scan.skin = u.skin; } catch {}
  const saveUI = () => { try { localStorage.setItem(LS_KEY, JSON.stringify({ mode: Scan.mode, layers: Scan.layers, skin: Scan.skin, v3d: 1 })); } catch {} };

  /* ── on-device photo store ───────────────────────────────────────── */
  const DB = {
    db: null,
    open() {
      if (this.db) return Promise.resolve(this.db);
      return new Promise((res, rej) => {
        let r; try { r = indexedDB.open('mk-scan', 1); } catch (e) { return rej(e); }
        r.onupgradeneeded = () => r.result.createObjectStore('photos', { keyPath: 'id' });
        r.onsuccess = () => { this.db = r.result; res(this.db); };
        r.onerror = () => rej(r.error);
      });
    },
    async tx(mode, fn) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction('photos', mode), st = t.objectStore('photos'), out = fn(st); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); }); },
    all() { return this.tx('readonly', (st) => st.getAll()); },
    put(rec) { return this.tx('readwrite', (st) => st.put(rec)); },
    del(id) { return this.tx('readwrite', (st) => st.delete(id)); }
  };
  async function loadPhotos() {
    try { Scan.photos = ((await DB.all()) || []).sort((a, b) => a.date.localeCompare(b.date)); }
    catch { Scan.persistent = false; }
    Scan.cur = Scan.photos.length ? Scan.photos[Scan.photos.length - 1].id : null;
    Scan.ready = true;
    if (OS.current === 'today') OS.render();
  }
  const save = async (rec) => { if (!Scan.persistent) return; try { await DB.put(rec); } catch { Scan.persistent = false; } };
  const curPhoto = () => Scan.photos.find((p) => p.id === Scan.cur) || null;
  const urlOf = (p) => Scan.urls[p.id] || (Scan.urls[p.id] = URL.createObjectURL(p.blob));

  /* ── geometry helpers ────────────────────────────────────────────── */
  const V = (a, b) => ({ x: b.x - a.x, y: b.y - a.y });
  const len = (v) => Math.hypot(v.x, v.y);
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const ok = (p) => p && p.score >= MIN;
  const f1 = (n) => Math.round(n * 10) / 10;

  // body frame from keypoints (in whatever pixel space kp is given)
  function frame(kp) {
    const ls = kp.left_shoulder, rs = kp.right_shoulder, lh = kp.left_hip, rh = kp.right_hip;
    if (![ls, rs, lh, rh].every(ok)) return null;
    const S = mid(ls, rs), H = mid(lh, rh), d0 = V(S, H), T = len(d0);
    if (T < 10) return null;
    const sw = len(V(rs, ls)), front = sw >= T * 0.45;
    const d = { x: d0.x / T, y: d0.y / T };
    // p points toward the subject's left; for side views fall back to the perpendicular
    let p = sw > 1 ? { x: (ls.x - rs.x) / sw, y: (ls.y - rs.y) / sw } : { x: -d.y, y: d.x };
    const W = front ? sw : T * 0.62;
    const ears = [kp.left_ear, kp.right_ear].filter(ok), eyes = [kp.left_eye, kp.right_eye].filter(ok);
    let hc, hr;
    if (ears.length === 2) { hc = mid(ears[0], ears[1]); hr = Math.max(len(V(ears[0], ears[1])) * 0.62, W * 0.24); }
    else if (ok(kp.nose)) { hc = { x: kp.nose.x, y: kp.nose.y - T * 0.06 }; hr = Math.max(eyes.length === 2 ? len(V(eyes[0], eyes[1])) * 1.35 : 0, W * 0.26, T * 0.2); if (ears.length === 1) hc = mid(hc, ears[0]); }
    else { hc = { x: S.x - d.x * T * 0.42, y: S.y - d.y * T * 0.42 }; hr = T * 0.2; }
    return { S, H, T, sw, W, d, p, front, hc, hr, top: hc.y - hr * 1.25 };
  }
  // SVG matrix mapping torso unit space (x ∈ [-1,1] across, y ∈ [0,1] shoulders→hips)
  const torsoM = (F) => `matrix(${F.p.x * F.W / 2} ${F.p.y * F.W / 2} ${F.d.x * F.T} ${F.d.y * F.T} ${F.S.x} ${F.S.y})`;
  // matrix mapping segment unit space (x across scaled by width, y 0→1 from a to b)
  function segM(a, b, w) { const v = V(a, b), L = len(v) || 1, ux = v.x / L, uy = v.y / L; return `matrix(${-uy * w} ${ux * w} ${v.x} ${v.y} ${a.x} ${a.y})`; }

  /* ── posture + proportion metrics ────────────────────────────────── */
  function metrics(kp) {
    const F = frame(kp);
    if (!F) return { view: 'none', items: [] };
    const items = [];
    const deg = (a, b) => Math.atan2(b.y - a.y, Math.abs(a.x - b.x)) * 180 / Math.PI;
    if (F.front) {
      const st = deg(kp.left_shoulder, kp.right_shoulder); // + = left shoulder higher
      items.push({ k: 'shoulders', label: 'Shoulder level', value: Math.abs(f1(st)), unit: '°', status: Math.abs(st) < 2 ? 'good' : Math.abs(st) < 4 ? 'warn' : 'bad', note: Math.abs(st) < 1 ? 'Level' : `${st > 0 ? 'Left' : 'Right'} side higher` });
      const ht = deg(kp.left_hip, kp.right_hip);
      items.push({ k: 'hips', label: 'Hip level', value: Math.abs(f1(ht)), unit: '°', status: Math.abs(ht) < 2 ? 'good' : Math.abs(ht) < 4 ? 'warn' : 'bad', note: Math.abs(ht) < 1 ? 'Level' : `${ht > 0 ? 'Left' : 'Right'} hip higher` });
      if (ok(kp.nose)) {
        const sh = ((kp.nose.x - F.H.x) * Math.sign(kp.left_shoulder.x - kp.right_shoulder.x)) / F.sw * 100;
        items.push({ k: 'shift', label: 'Head over hips', value: Math.abs(Math.round(sh)), unit: '%', status: Math.abs(sh) < 6 ? 'good' : Math.abs(sh) < 12 ? 'warn' : 'bad', note: Math.abs(sh) < 3 ? 'Centred' : `Shifted to your ${sh > 0 ? 'left' : 'right'}` });
      }
      const hw = len(V(kp.right_hip, kp.left_hip));
      if (hw > 1) items.push({ k: 'taper', label: 'Shoulder : hip', value: f1(F.sw / hw), unit: '×', status: 'info', note: 'V-taper ratio, tracked across photos' });
      if ([kp.left_knee, kp.right_knee, kp.left_ankle, kp.right_ankle].every(ok)) {
        const r = len(V(kp.right_knee, kp.left_knee)) / Math.max(1, len(V(kp.right_ankle, kp.left_ankle)));
        items.push({ k: 'knees', label: 'Knee track', value: f1(r), unit: '×', status: r > 0.85 ? 'good' : r > 0.7 ? 'warn' : 'bad', note: r > 0.85 ? 'Knees over ankles' : 'Knees drifting inward' });
      }
    } else {
      const side = (kp.left_ear?.score || 0) + (kp.left_shoulder.score) > (kp.right_ear?.score || 0) + kp.right_shoulder.score ? 'left' : 'right';
      const ear = kp[side + '_ear'], sh = kp[side + '_shoulder'];
      if (ok(ear) && ok(kp.nose)) {
        const dir = Math.sign(kp.nose.x - ear.x) || 1, fh = ((ear.x - sh.x) * dir) / F.T * 100;
        items.push({ k: 'fhead', label: 'Head forward', value: Math.max(0, Math.round(fh)), unit: '%', status: fh < 8 ? 'good' : fh < 15 ? 'warn' : 'bad', note: fh < 8 ? 'Ear stacked over shoulder' : 'Ear ahead of shoulder' });
      }
    }
    return { view: F.front ? 'front' : 'side', items };
  }

  /* ── anatomy geometry (shared by hologram + realistic layers) ────── */
  const LUNG_R = 'M-0.1 0.03 C-0.34 0 -0.74 0.1 -0.76 0.44 C-0.76 0.52 -0.52 0.54 -0.3 0.48 C-0.12 0.43 -0.1 0.22 -0.1 0.03 Z';
  const LUNG_L = 'M0.1 0.03 C0.34 0 0.74 0.1 0.76 0.44 C0.76 0.52 0.56 0.54 0.4 0.5 C0.3 0.47 0.3 0.4 0.22 0.38 C0.14 0.34 0.1 0.2 0.1 0.03 Z';
  const HEART = 'M0.02 0.22 C0.2 0.16 0.36 0.28 0.3 0.42 C0.24 0.52 0.1 0.52 0.04 0.46 C-0.06 0.38 -0.08 0.27 0.02 0.22 Z';
  const LIVER = 'M-0.74 0.46 C-0.42 0.4 0.04 0.42 0.16 0.48 C0.06 0.58 -0.4 0.67 -0.68 0.63 C-0.78 0.57 -0.78 0.5 -0.74 0.46 Z';
  const STOMACH = 'M0.16 0.47 C0.44 0.41 0.64 0.5 0.55 0.63 C0.46 0.74 0.2 0.72 0.1 0.65 C0.2 0.61 0.33 0.61 0.31 0.55 C0.29 0.51 0.2 0.51 0.16 0.47 Z';
  const COLON = 'M-0.46 0.98 L-0.5 0.72 C-0.48 0.66 0.48 0.66 0.5 0.72 L0.47 0.96 C0.4 1.02 0.14 0.98 0.06 1.04';
  const SMALL = (() => { let d = 'M-0.3 0.74', dir = 1; for (let i = 0; i < 5; i++) { const y = 0.74 + i * 0.05; d += ` C${0.4 * dir} ${y - 0.03} ${0.4 * dir} ${y + 0.03} ${0.3 * dir} ${y + 0.025}`; dir = -dir; d += ` L${0.3 * dir} ${y + 0.025}`; } return d; })();
  const PANCREAS = 'M-0.02 0.62 C0.14 0.58 0.36 0.6 0.44 0.6 C0.36 0.66 0.12 0.67 -0.02 0.66 Z';
  const KIDNEYS = '<ellipse cx="-0.36" cy="0.72" rx="0.1" ry="0.07"/><ellipse cx="0.36" cy="0.72" rx="0.1" ry="0.07"/>';
  const THYROID = '<ellipse cx="-0.06" cy="-0.1" rx="0.06" ry="0.035"/><ellipse cx="0.06" cy="-0.1" rx="0.06" ry="0.035"/>';
  const RIBS = Array.from({ length: 7 }, (_, i) => { const y = 0.06 + i * 0.075, w = 0.7 - Math.abs(i - 2.5) * 0.05; return `<path d="M-0.04 ${y} C${-w * 0.7} ${y - 0.05} ${-w} ${y + 0.02} ${-w + 0.06} ${y + 0.1}"/><path d="M0.04 ${y} C${w * 0.7} ${y - 0.05} ${w} ${y + 0.02} ${w - 0.06} ${y + 0.1}"/>`; }).join('');
  const PELVIS = 'M-0.62 0.86 C-0.7 0.98 -0.5 1.1 -0.2 1.12 L0.2 1.12 C0.5 1.1 0.7 0.98 0.62 0.86 C0.4 0.94 -0.4 0.94 -0.62 0.86 Z';
  const SPINDLE = 'M0 0 C0.55 0.16 0.55 0.84 0 1 C-0.55 0.84 -0.55 0.16 0 0 Z';
  // organ → biomarker system, label, unit-space anchor
  const ORGANS = [
    { k: 'brain', label: 'Brain', sys: 'Hormonal', head: true },
    { k: 'thyroid', label: 'Thyroid', sys: 'Thyroid', at: [0, -0.1] },
    { k: 'lungs', label: 'Lungs', sys: 'Blood', at: [-0.45, 0.25] },
    { k: 'heart', label: 'Heart', sys: 'Cardiometabolic', at: [0.16, 0.36] },
    { k: 'liver', label: 'Liver & kidneys', sys: 'Liver & kidney', at: [-0.4, 0.54] },
    { k: 'stomach', label: 'Gut', sys: 'Nutrients', at: [0.38, 0.58] },
    { k: 'pancreas', label: 'Pancreas', sys: 'Metabolic', at: [0.2, 0.63] },
    { k: 'pelvis', label: 'Hormonal', sys: 'Hormonal', at: [0, 1.02], hide: true }
  ];
  const toPx = (F, u, v) => ({ x: F.S.x + F.p.x * F.W / 2 * u + F.d.x * F.T * v, y: F.S.y + F.p.y * F.W / 2 * u + F.d.y * F.T * v });

  function limbs(kp, F) {
    const segs = [
      ['left_shoulder', 'left_elbow', 0.3, 'biceps'], ['left_elbow', 'left_wrist', 0.24, 'forearm'], ['right_shoulder', 'right_elbow', 0.3, 'biceps'], ['right_elbow', 'right_wrist', 0.24, 'forearm'],
      ['left_hip', 'left_knee', 0.42, 'quad'], ['left_knee', 'left_ankle', 0.3, 'calf'], ['right_hip', 'right_knee', 0.42, 'quad'], ['right_knee', 'right_ankle', 0.3, 'calf']
    ];
    return segs.filter(([a, b]) => ok(kp[a]) && ok(kp[b])).map(([a, b, w, m]) => ({ a: kp[a], b: kp[b], w: w * F.W, m }));
  }

  /* ── hologram: photo → luminance + edges → blue ramp, masked by a pose silhouette ── */
  function crop(p) {
    const kp = p.kp, pts = kp ? Object.values(kp).filter(ok) : [];
    const F = kp && frame(kp);
    if (!F || pts.length < 6) return { x: 0, y: 0, w: p.w, h: p.h };
    const ys = pts.map((q) => q.y), xs = pts.map((q) => q.x);
    let top = Math.min(F.top, ...ys) - F.T * 0.35, bot = Math.max(...ys) + F.T * 0.28;
    top = Math.max(0, top); bot = Math.min(p.h, bot);
    const h = bot - top, cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    let w = Math.max((Math.max(...xs) - Math.min(...xs)) * 1.6, h * 0.66);
    w = Math.min(w, p.w);
    const x = clamp(cx - w / 2, 0, p.w - w);
    return { x, y: top, w, h };
  }
  const RAMP = [[0, [2, 8, 30]], [0.3, [10, 40, 140]], [0.55, [31, 91, 255]], [0.78, [96, 200, 255]], [1, [236, 248, 255]]];
  function ramp(v) { for (let i = 1; i < RAMP.length; i++) if (v <= RAMP[i][0]) { const [a, ca] = RAMP[i - 1], [b, cb] = RAMP[i], t = (v - a) / (b - a); return ca.map((c, j) => c + (cb[j] - c) * t); } return RAMP[RAMP.length - 1][1]; }
  function silhouette(ctx, kp, F, scale) {
    ctx.fillStyle = ctx.strokeStyle = '#fff'; ctx.lineCap = ctx.lineJoin = 'round';
    const W = F.W;
    limbs(kp, F).forEach(({ a, b, w }) => { ctx.lineWidth = w * 1.05; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); });
    ['left', 'right'].forEach((s) => { const an = kp[s + '_ankle'], kn = kp[s + '_knee']; if (ok(an) && ok(kn)) { const v = V(kn, an), L = len(v); ctx.lineWidth = W * 0.22; ctx.beginPath(); ctx.moveTo(an.x, an.y); ctx.lineTo(an.x + v.x / L * W * 0.2, an.y + v.y / L * W * 0.2); ctx.stroke(); } });
    ['left', 'right'].forEach((s) => { const w = kp[s + '_wrist'], e = kp[s + '_elbow']; if (ok(w) && ok(e)) { const v = V(e, w), L = len(v); ctx.lineWidth = W * 0.2; ctx.beginPath(); ctx.moveTo(w.x, w.y); ctx.lineTo(w.x + v.x / L * W * 0.25, w.y + v.y / L * W * 0.25); ctx.stroke(); } });
    const c = (u, v) => toPx(F, u, v);
    const poly = [c(-1.05, 0.02), c(1.05, 0.02), c(0.95, 0.5), c(0.85, 1.08), c(-0.85, 1.08), c(-0.95, 0.5)];
    ctx.lineWidth = W * 0.18; ctx.beginPath(); poly.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.lineWidth = W * 0.32; ctx.beginPath(); ctx.moveTo(F.S.x, F.S.y); ctx.lineTo(F.hc.x, F.hc.y); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(F.hc.x, F.hc.y - F.hr * 0.1, F.hr * 0.95, F.hr * 1.2, 0, 0, Math.PI * 2); ctx.fill();
  }
  function renderHolo(p, img) {
    const C = p.crop, Hpx = 900, sc = Hpx / C.h, Wpx = Math.round(C.w * sc);
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const src = mk(Wpx, Hpx), sx = src.getContext('2d', { willReadFrequently: true });
    sx.drawImage(img, C.x, C.y, C.w, C.h, 0, 0, Wpx, Hpx);
    const id = sx.getImageData(0, 0, Wpx, Hpx), d = id.data, N = Wpx * Hpx;
    // mask
    const mc = mk(Wpx, Hpx), mx = mc.getContext('2d', { willReadFrequently: true });
    const kpc = p.kpc, F = kpc && frame(kpc);
    if (F) { mx.filter = `blur(${Math.max(4, F.W * 0.07)}px)`; silhouette(mx, kpc, F); mx.filter = 'none'; }
    else { const g = mx.createRadialGradient(Wpx / 2, Hpx / 2, Hpx * 0.1, Wpx / 2, Hpx / 2, Hpx * 0.55); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); mx.fillStyle = g; mx.fillRect(0, 0, Wpx, Hpx); }
    const md = mx.getImageData(0, 0, Wpx, Hpx).data;
    // luminance + robust contrast inside the mask
    const L = new Float32Array(N), hist = new Uint32Array(256); let cnt = 0;
    for (let i = 0; i < N; i++) { const l = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11); L[i] = l / 255; if (md[i * 4 + 3] > 128) { hist[l | 0]++; cnt++; } }
    let lo = 0, hi = 255, acc = 0; for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc < cnt * 0.02) lo = i; if (acc < cnt * 0.98) hi = i; }
    lo /= 255; hi = Math.max(lo + 0.1, hi / 255);
    const out = sx.createImageData(Wpx, Hpx), o = out.data;
    for (let y = 0; y < Hpx; y++) for (let x = 0; x < Wpx; x++) {
      const i = y * Wpx + x, m = md[i * 4 + 3] / 255;
      const l = clamp((L[i] - lo) / (hi - lo), 0, 1);
      let e = 0;
      if (x > 0 && y > 0 && x < Wpx - 1 && y < Hpx - 1) {
        const a = L[i - Wpx - 1], b = L[i - Wpx], c = L[i - Wpx + 1], dd = L[i - 1], f = L[i + 1], g = L[i + Wpx - 1], h = L[i + Wpx], k = L[i + Wpx + 1];
        const gx = -a - 2 * dd - g + c + 2 * f + k, gy = -a - 2 * b - c + g + 2 * h + k; e = clamp(Math.hypot(gx, gy) * 2.4, 0, 1);
      }
      let v = clamp((0.22 + 0.5 * l) + e * 0.75, 0, 1);
      v = v * m + v * 0.1 * (1 - m);
      const [r, gg, bb] = ramp(v);
      o[i * 4] = r; o[i * 4 + 1] = gg; o[i * 4 + 2] = bb; o[i * 4 + 3] = 255 * clamp(0.03 + m * (0.9 + e * 0.3), 0, 1);
    }
    const res = mk(Wpx, Hpx), rx = res.getContext('2d');
    sx.putImageData(out, 0, 0);
    rx.drawImage(src, 0, 0);
    // wireframe mesh clipped to the body
    const mesh = mk(Wpx, Hpx), mm = mesh.getContext('2d');
    mm.strokeStyle = 'rgba(150, 215, 255, .26)'; mm.lineWidth = 1;
    for (let x = 0; x < Wpx; x += 12) { mm.beginPath(); mm.moveTo(x + .5, 0); mm.lineTo(x + .5, Hpx); mm.stroke(); }
    for (let y = 0; y < Hpx; y += 12) { mm.beginPath(); mm.moveTo(0, y + .5); mm.lineTo(Wpx, y + .5); mm.stroke(); }
    mm.globalCompositeOperation = 'destination-in'; mm.drawImage(mc, 0, 0);
    rx.globalCompositeOperation = 'lighter'; rx.drawImage(mesh, 0, 0);
    // bloom
    rx.globalAlpha = 0.45; rx.filter = 'blur(10px)'; rx.drawImage(src, 0, 0); rx.filter = 'none'; rx.globalAlpha = 1;
    rx.globalCompositeOperation = 'source-over';
    // scanlines + a couple of glitch slices
    rx.globalCompositeOperation = 'source-atop'; rx.fillStyle = 'rgba(0, 6, 24, .22)'; for (let y = 0; y < Hpx; y += 4) rx.fillRect(0, y, Wpx, 1); rx.globalCompositeOperation = 'source-over';
    let seed = [...p.id].reduce((a, ch) => a + ch.charCodeAt(0), 0);
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 3; i++) { const y = Math.floor(Hpx * (0.15 + rnd() * 0.7)), h = 3 + Math.floor(rnd() * 8), dx = Math.round((rnd() - 0.5) * 18); const sl = rx.getImageData(0, y, Wpx, h); rx.putImageData(sl, dx, y); }
    return res;
  }

  /* ── overlay SVG (hologram + anatomy) in crop pixel space ────────── */
  function statusOf(systems, sys) { const s = systems.find((x) => x.sy === sys); return s ? s : { status: 'good', score: 100 }; }
  function overlay(p, systems, style) {
    const kp = p.kpc, F = kp && frame(kp), W = p.cw, H = 900;
    if (!F) return `<svg class="scan-ov" viewBox="0 0 ${W} ${H}" aria-hidden="true"></svg>`;
    const TM = torsoM(F), L = style === 'anatomy' ? Scan.layers : { muscle: false, organs: true, skeleton: true };
    const nss = 'vector-effect="non-scaling-stroke"';
    const st = (o) => statusOf(systems, o.sys);
    const organ = (k, path, extra = '') => { const o = ORGANS.find((x) => x.k === k), s = st(o); return `<g class="og og-${k} st-${s.status}" data-act="go-sys" data-sys="${esc(o.sys)}" ${extra}>${path}<title>${esc(o.label)} · ${esc(o.sys)} ${Math.round(s.score)}</title></g>`; };
    let g = '';
    // muscle (anatomy only)
    if (L.muscle) {
      const pecs = `<path d="M-0.04 0.06 C-0.4 0.02 -0.86 0.06 -0.92 0.16 C-0.86 0.34 -0.4 0.42 -0.06 0.34 Z"/><path d="M0.04 0.06 C0.4 0.02 0.86 0.06 0.92 0.16 C0.86 0.34 0.4 0.42 0.06 0.34 Z"/>`;
      const abs = Array.from({ length: 4 }, (_, r) => [-1, 1].map((sx) => `<rect x="${sx < 0 ? -0.27 : 0.03}" y="${0.42 + r * 0.13}" width="0.24" height="0.115" rx="0.05"/>`).join('')).join('');
      const obl = `<path d="M-0.34 0.4 C-0.7 0.44 -0.86 0.7 -0.8 0.96 L-0.32 0.96 Z"/><path d="M0.34 0.4 C0.7 0.44 0.86 0.7 0.8 0.96 L0.32 0.96 Z"/>`;
      const traps = `<path d="M-0.18 -0.22 C-0.5 -0.06 -0.9 -0.02 -1 0.06 L1 0.06 C0.9 -0.02 0.5 -0.06 0.18 -0.22 Z"/>`;
      const delts = ['left', 'right'].map((s) => { const sh = kp[s + '_shoulder'], el = kp[s + '_elbow']; if (!ok(sh) || !ok(el)) return ''; const v = V(sh, el), a = { x: sh.x - v.x * 0.12, y: sh.y - v.y * 0.12 }, b = { x: sh.x + v.x * 0.42, y: sh.y + v.y * 0.42 }; return `<path transform="${segM(a, b, F.W * 0.42)}" d="${SPINDLE}"/>`; }).join('');
      const bellies = limbs(kp, F).map(({ a, b, w, m }) => { const t0 = m === 'calf' ? 0.04 : m === 'forearm' ? 0.02 : 0.1, t1 = m === 'calf' ? 0.7 : m === 'forearm' ? 0.85 : 0.92; const A = { x: a.x + (b.x - a.x) * t0, y: a.y + (b.y - a.y) * t0 }, B = { x: a.x + (b.x - a.x) * t1, y: a.y + (b.y - a.y) * t1 }; return `<path transform="${segM(A, B, w * 1.02)}" d="${SPINDLE}"/>`; }).join('');
      g += `<g class="ly-muscle"><g transform="${TM}">${traps}${obl}${pecs}${abs}</g>${delts}${bellies}</g>`;
    }
    if (L.skeleton) {
      const bones = limbs(kp, F).map(({ a, b }) => `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`).join('');
      const joints = Object.entries(kp).filter(([n, q]) => ok(q) && !/eye|ear|nose/.test(n)).map(([, q]) => `<circle cx="${q.x}" cy="${q.y}" r="${F.W * 0.035}"/>`).join('');
      g += `<g class="ly-bone"><g transform="${TM}"><g ${nss}>${RIBS}<path d="M0 -0.3 L0 0.92" class="spine"/><path d="M-0.9 0.02 L0.9 0.02"/><path d="${PELVIS}"/></g></g>${bones}${joints}
        <ellipse cx="${F.hc.x}" cy="${F.hc.y - F.hr * 0.12}" rx="${F.hr * 0.72}" ry="${F.hr * 0.9}"/></g>`;
    }
    if (L.organs) {
      const br = ORGANS[0], bs = st(br);
      g += `<g class="ly-organ"><g transform="${TM}">
        ${organ('lungs', `<path d="${LUNG_R}" ${nss}/><path d="${LUNG_L}" ${nss}/>`)}
        ${organ('liver', `<path d="${LIVER}" ${nss}/>${KIDNEYS.replace(/\/>/g, ` ${nss}/>`)}`)}
        ${organ('stomach', `<path d="M0.02 -0.3 C0.04 0.1 0.12 0.3 0.2 0.48" class="eso" fill="none" ${nss}/><path d="${STOMACH}" ${nss}/><path d="${COLON}" class="colon" fill="none" ${nss}/><path d="${SMALL}" class="small" fill="none" ${nss}/>`)}
        ${organ('pancreas', `<path d="${PANCREAS}" ${nss}/>`)}
        ${organ('heart', `<path d="${HEART}" ${nss}/>`)}
        ${organ('thyroid', THYROID.replace(/\/>/g, ` ${nss}/>`))}
        </g>
        <g class="og og-brain st-${bs.status}" data-act="go-sys" data-sys="${esc(br.sys)}"><path d="M${F.hc.x - F.hr * 0.6} ${F.hc.y - F.hr * 0.1} C${F.hc.x - F.hr * 0.7} ${F.hc.y - F.hr * 1.05} ${F.hc.x + F.hr * 0.7} ${F.hc.y - F.hr * 1.05} ${F.hc.x + F.hr * 0.6} ${F.hc.y - F.hr * 0.1} C${F.hc.x + F.hr * 0.3} ${F.hc.y + F.hr * 0.05} ${F.hc.x - F.hr * 0.3} ${F.hc.y + F.hr * 0.05} ${F.hc.x - F.hr * 0.6} ${F.hc.y - F.hr * 0.1} Z"/><title>Brain · Hormonal axis ${Math.round(bs.score)}</title></g></g>`;
    }
    // callouts: organs (holo) or layer names (anatomy)
    let labels = '';
    if (L.organs) {
      const fs = Math.max(16, W * 0.03), items = ORGANS.filter((o) => !o.hide).map((o) => { const a = o.head ? { x: F.hc.x, y: F.hc.y - F.hr * 0.5 } : toPx(F, o.at[0], o.at[1]), s = st(o); return { o, a, s }; });
      const left = [], right = []; items.forEach((it) => (it.a.x < F.S.x ? left : right).push(it));
      [[left, -1], [right, 1]].forEach(([arr, side]) => {
        arr.sort((a, b) => a.a.y - b.a.y); let lastY = -1e9;
        arr.forEach((it) => {
          const y = Math.max(it.a.y, lastY + fs * 2.4); lastY = y;
          const x = side < 0 ? fs * 0.6 : W - fs * 0.6, anchor = side < 0 ? 'start' : 'end';
          const ex = side < 0 ? Math.min(it.a.x - fs, x + fs * 7.6) : Math.max(it.a.x + fs, x - fs * 7.6);
          labels += `<g class="cl st-${it.s.status}" data-act="go-sys" data-sys="${esc(it.o.sys)}">
            <path d="M${it.a.x} ${it.a.y} L${ex} ${y} L${x + (side < 0 ? fs * 7 : -fs * 7)} ${y}" fill="none"/><circle cx="${it.a.x}" cy="${it.a.y}" r="${fs * 0.22}"/>
            <text x="${x}" y="${y - fs * 0.35}" text-anchor="${anchor}" font-size="${fs}">${esc(it.o.label)}</text>
            <text class="cl-sub" x="${x}" y="${y + fs * 0.95}" text-anchor="${anchor}" font-size="${fs * 0.78}">${esc(it.o.sys)} · ${Math.round(it.s.score)}</text></g>`;
        });
      });
    }
    const halo = style === 'holo' ? `<g class="halo"><ellipse cx="${F.hc.x}" cy="${Math.max(F.W * 0.2, F.top - F.hr * 0.6)}" rx="${F.W * 0.95}" ry="${F.W * 0.16}"/></g>` : '';
    return `<svg class="scan-ov ov-${style}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${style === 'holo' ? 'Hologram' : 'Anatomy layers'} of your progress photo"><defs><linearGradient id="mk-mus" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#6e1c18"/><stop offset=".42" stop-color="#c9584c"/><stop offset=".58" stop-color="#b84a40"/><stop offset="1" stop-color="#6e1c18"/></linearGradient><radialGradient id="mk-org" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></radialGradient></defs>${halo}${g}${labels}</svg>`;
  }

  /* ── stage center per mode ───────────────────────────────────────── */
  function modeSeg() {
    const b = (m, label) => `<button data-act="scan-mode" data-mode="${m}" aria-pressed="${Scan.mode === m}">${label}</button>`;
    return `<div class="cc-modes" role="group" aria-label="Command center view">${b('3d', '3D body')}${b('camera', `${icon('upload', 13)} Camera`)}${b('holo', 'Photo hologram')}${b('anatomy', 'Photo layers')}</div>`;
  }
  const fileBtns = (cls = 'cam-btn') => `<label class="${cls}">${icon('upload', 14)} Take photo<input type="file" accept="image/*" capture="user" data-change="scan-file"></label>
    <label class="${cls} ghost">Upload<input type="file" accept="image/*" data-change="scan-file"></label>`;

  function center(s, sc, systems, figure) {
    const p = curPhoto();
    if (Scan.mode === '3d') return '<div class="a3d" data-a3d="compact" data-systems="skin,cardiovascular" aria-label="3D body"></div>';
    if (Scan.mode === 'camera') return cameraView(p);
    if (!p) return `${figure}<div class="scan-cta">${Scan.mode === 'anatomy' ? 'Add a progress photo to peel back your own anatomy layers.' : 'Add a progress photo to see your own hologram.'}<div class="scan-cta-b">${fileBtns('gc-add')}</div></div>`;
    if (!p.kp) return `<div class="scan-wrap"><img class="scan-img" src="${urlOf(p)}" alt="Progress photo"><div class="scan-busy">${esc(Scan.status || 'Scanning pose…')}</div></div>`;
    const style = Scan.mode;
    return `<div class="scan-wrap sw-${style}" style="--ar:${p.cw} / 900">
      ${style === 'holo' ? `<canvas class="scan-holo" width="${p.cw}" height="900" data-photo="${esc(p.id)}"></canvas>`
        : `<div class="scan-base" style="background-image:url('${urlOf(p)}');background-size:${(p.w / p.crop.w * 100).toFixed(2)}% auto;background-position:${(p.crop.x / Math.max(1, p.w - p.crop.w) * 100).toFixed(2)}% ${(p.crop.y / Math.max(1, p.h - p.crop.h) * 100).toFixed(2)}%;opacity:${Scan.layers.skin ? Scan.skin : 0.12}"></div>`}
      ${overlay(p, systems, style)}
      ${style === 'holo' ? '<div class="cc-scan" aria-hidden="true"></div>' : ''}
      </div>
      ${style === 'anatomy' ? layerBar() : ''}`;
  }
  function layerBar() {
    const c = (k, label) => `<button class="lyr ly-${k}" data-act="scan-layer" data-layer="${k}" aria-pressed="${!!Scan.layers[k]}">${label}</button>`;
    return `<div class="layer-bar">${c('skin', 'Skin')}${c('muscle', 'Muscle')}${c('organs', 'Organs')}${c('skeleton', 'Skeleton')}
      <label class="lyr-range">Peel <input type="range" min="0" max="100" value="${Math.round((1 - Scan.skin) * 100)}" data-change="scan-peel" aria-label="Peel skin layer"></label></div>`;
  }
  function cameraView(p) {
    const live = !!Scan.stream;
    const strip = Scan.photos.slice().reverse().map((q) => `<button class="thumb ${q.id === Scan.cur ? 'on' : ''}" data-act="scan-pick" data-id="${esc(q.id)}" aria-label="Photo from ${esc(new Date(q.date).toLocaleDateString())}"><img src="${urlOf(q)}" alt=""><span>${esc(new Date(q.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))}</span></button>`).join('');
    const body = live ? `<video class="cam-video" autoplay playsinline muted></video><div class="cam-guide" aria-hidden="true"></div>`
      : p ? `<img class="cam-photo" src="${urlOf(p)}" alt="Progress photo from ${esc(new Date(p.date).toLocaleDateString())}"><span class="cam-date num">${esc(new Date(p.date).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }))}</span>`
      : `<div class="cam-empty"><div class="cam-guide" aria-hidden="true"></div><p><b>Progress photo</b>Stand 2–3 m back, full body in frame, facing the camera in fitted clothes and even light. Same spot, same time of day each week.</p></div>`;
    return `<div class="cam">
      <div class="cam-view">${body}</div>
      <div class="cam-bar">
        ${live ? `<button class="cam-btn" data-act="scan-snap">Capture</button><button class="cam-btn ghost" data-act="scan-live">Stop camera</button>`
          : `${fileBtns()}<button class="cam-btn ghost" data-act="scan-live">Live camera</button>${p ? `<button class="cam-btn ghost danger" data-act="scan-del" data-id="${esc(p.id)}">Delete</button>` : ''}`}
      </div>
      ${Scan.status ? `<p class="cam-status">${esc(Scan.status)}</p>` : ''}
      ${strip ? `<div class="cam-strip">${strip}</div>` : ''}
      <p class="cam-note">${Scan.persistent ? 'Photos stay on this device.' : "This browser won't keep photos, so they last until you close the page."} Only pose measurements, never the photo, go to Myo when you ask for an insight.</p>
    </div>`;
  }

  /* ── insight card under the stage ────────────────────────────────── */
  function insight(s, sc, systems) {
    const p = curPhoto();
    if (!p || !p.kp) return '';
    const m = p.metrics || { items: [] };
    const first = Scan.photos.find((q) => q.metrics && q.metrics.view === 'front' && q.id !== p.id && q.date < p.date);
    const tp = m.items.find((x) => x.k === 'taper'), tp0 = first && first.metrics.items.find((x) => x.k === 'taper');
    const days = first ? Math.round((new Date(p.date) - new Date(first.date)) / 864e5) : 0;
    const chips = m.items.map((x) => `<div class="mt st-${x.status}"><span>${esc(x.label)}</span><b class="num">${x.value}${esc(x.unit)}</b><em>${esc(x.note)}</em></div>`).join('');
    const organs = ORGANS.filter((o) => !o.hide).map((o) => { const st = statusOf(systems, o.sys); return `<button class="org-chip st-${st.status}" data-act="go-sys" data-sys="${esc(o.sys)}"><i></i>${esc(o.label)}<b class="num">${Math.round(st.score)}</b></button>`; }).join('');
    const ai = Scan.ai[p.id] || p.ai;
    return `<section class="card scan-insight">
      <div class="card-h"><h2>Body scan insight</h2><span class="muted small">${esc(new Date(p.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric' }))} · ${m.view === 'front' ? 'front view' : m.view === 'side' ? 'side view' : 'pose not found'}</span></div>
      ${chips ? `<div class="mt-row">${chips}${tp && tp0 ? `<div class="mt st-info"><span>Since ${esc(new Date(first.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))}</span><b class="num">${tp.value - tp0.value >= 0 ? '+' : ''}${f1(tp.value - tp0.value)}×</b><em>V-taper over ${days} days</em></div>` : ''}</div>`
        : `<p class="muted">${m.view === 'none' ? 'The scan could not find your shoulders and hips. Retake the photo with your whole body in frame.' : 'Side view found. Take a front-on photo for symmetry and proportion checks.'}</p>`}
      <div class="org-row">${organs}</div>
      <div class="scan-ai">${ai ? `<p>${esc(ai).replace(/\n\n/g, '</p><p>')}</p>` : `<p class="muted">${esc(offlineInsight(s, sc, systems, p))}</p>`}
        <button class="btn" data-act="scan-ai" ${Scan.busy ? 'disabled' : ''}>${icon('coach', 15)} ${Scan.busy ? 'Myo is reading your scan…' : ai ? 'Ask Myo again' : 'Ask Myo for a scan insight'}</button></div>
      <p class="fine">Posture and proportion come from 17 points found on your photo. Organ colours reflect your blood work.</p>
    </section>`;
  }
  function offlineInsight(s, sc, systems, p) {
    const m = p.metrics || { items: [] }, off = m.items.filter((x) => x.status === 'warn' || x.status === 'bad');
    const worst = systems.filter((x) => x.status !== 'good').sort((a, b) => a.score - b.score)[0];
    const parts = [];
    parts.push(off.length ? `${off.map((x) => `${x.label.toLowerCase()} (${x.note.toLowerCase()})`).join(' and ')} stood out in this photo.` : 'Posture looks balanced in this photo.');
    if (off.some((x) => x.k === 'shoulders')) parts.push('Matches the shoulder elevation AR-Vision flagged on the press, so keep the band external rotations before pressing.');
    if (worst) parts.push(`On the inside, ${worst.sy.toLowerCase()} is your weakest system at ${Math.round(worst.score)}.`);
    parts.push('Retake from the same spot weekly to track change.');
    return parts.join(' ');
  }

  /* ── pipeline: file → downscaled JPEG → pose → metrics ───────────── */
  const loadImg = (url) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("That file couldn't be opened as an image.")); i.src = url; });
  async function addPhoto(blobIn) {
    if (Scan.busy) return;
    Scan.busy = true; Scan.status = 'Preparing photo…'; OS.render();
    try {
      const u = URL.createObjectURL(blobIn), img = await loadImg(u);
      const k = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
      const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); URL.revokeObjectURL(u);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
      const rec = { id: 'ph' + Date.now().toString(36), date: new Date().toISOString(), w, h, blob, kp: null };
      Scan.photos.push(rec); Scan.cur = rec.id; OS.render();
      await analyse(rec, c);
      await save(rec);
      Scan.status = '';
      OS.toast(rec.metrics.view === 'none' ? 'Photo saved. No full body found for the scan.' : 'Scan ready');
    } catch (e) { Scan.status = (e && e.message) || 'Scan failed.'; }
    Scan.busy = false; OS.render();
  }
  async function analyse(rec, canvas) {
    Scan.status = 'Loading pose model…'; OS.render();
    await OS.Pose.load((t) => { Scan.status = t; const el = document.querySelector('.scan-busy, .cam-status'); if (el) el.textContent = t; });
    Scan.status = 'Scanning pose…';
    rec.kp = await OS.Pose.estimate(canvas, rec.w, rec.h);
    derive(rec);
  }
  function derive(rec) {
    rec.metrics = metrics(rec.kp);
    rec.crop = crop(rec);
    const s = 900 / rec.crop.h; rec.cw = Math.round(rec.crop.w * s);
    rec.kpc = {}; Object.entries(rec.kp).forEach(([n, q]) => { rec.kpc[n] = { x: (q.x - rec.crop.x) * s, y: (q.y - rec.crop.y) * s, score: q.score }; });
  }

  /* ── actions ─────────────────────────────────────────────────────── */
  OS.act('scan-mode', (el) => { Scan.mode = el.dataset.mode; if (Scan.mode !== 'camera') stopLive(); saveUI(); OS.render(); });
  OS.act('scan-layer', (el) => { const k = el.dataset.layer; Scan.layers[k] = !Scan.layers[k]; saveUI(); OS.render(); });
  OS.change('scan-peel', (el) => { Scan.skin = 1 - el.value / 100; saveUI(); const b = document.querySelector('.scan-base'); if (b) b.style.opacity = Scan.layers.skin ? Scan.skin : 0.12; });
  OS.change('scan-file', (el) => { const f = el.files && el.files[0]; el.value = ''; if (f) { stopLive(); addPhoto(f); } });
  OS.act('scan-pick', (el) => { Scan.cur = el.dataset.id; OS.render(); });
  OS.act('scan-del', async (el) => {
    const id = el.dataset.id, p = Scan.photos.find((q) => q.id === id); if (!p) return;
    if (!confirm('Delete this progress photo from this device? This cannot be undone.')) return;
    Scan.photos = Scan.photos.filter((q) => q.id !== id); if (Scan.urls[id]) URL.revokeObjectURL(Scan.urls[id]); delete Scan.urls[id]; delete Scan.holo[id];
    try { await DB.del(id); } catch {}
    Scan.cur = Scan.photos.length ? Scan.photos[Scan.photos.length - 1].id : null; OS.render();
  });
  function stopLive() { if (Scan.stream) { Scan.stream.getTracks().forEach((t) => t.stop()); Scan.stream = null; } }
  OS.act('scan-live', async () => {
    if (Scan.stream) { stopLive(); OS.render(); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { Scan.status = "This view can't use a camera. Use Take photo or Upload instead."; OS.render(); return; }
    try { Scan.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false }); Scan.status = ''; }
    catch (e) { Scan.status = e && e.name === 'NotAllowedError' ? 'Camera access was blocked. Allow it in your browser, or use Take photo or Upload.' : "This view can't open a camera. Use Take photo or Upload instead."; }
    OS.render();
  });
  OS.act('scan-snap', async () => {
    const v = document.querySelector('.cam-video'); if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    const x = c.getContext('2d'); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(v, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92)); stopLive(); addPhoto(blob);
  });
  OS.act('scan-ai', async () => {
    const p = curPhoto(); if (!p || Scan.busy) return;
    const s = OS.state, sc = OS.scores(s), systems = OS.ui.systemsOf(s, sc);
    const sample = OS.caps && OS.caps.sample;
    if (!sample) { Scan.ai[p.id] = offlineInsight(s, sc, systems, p) + '\n\nOffline coach. Open Myo in Claude for the full read.'; OS.render(); return; }
    Scan.busy = true; OS.render();
    const first = Scan.photos.find((q) => q.metrics && q.id !== p.id && q.date < p.date);
    const data = {
      photo_date: p.date.slice(0, 10), view: p.metrics.view, posture: p.metrics.items.map(({ label, value, unit, note, status }) => ({ label, value: value + unit, note, status })),
      earlier_photo: first ? { date: first.date.slice(0, 10), posture: first.metrics.items.map(({ label, value, unit }) => ({ label, value: value + unit })) } : null,
      systems: systems.map((x) => ({ system: x.sy, score: Math.round(x.score), status: x.status })),
      readiness: sc.readiness, goal: s.profile.goal, ar_vision_note: 'Left shoulder elevation flagged on the APS shoulder press last session.'
    };
    const prompt = `You are Myo, the AI inside the Myo app (built on Myokinetics OS). A member took a progress photo; on-device pose estimation produced the measurements below (you do not see the photo). Write a short body-scan insight in 3 short paragraphs, plain text, no headings or lists: 1) what the posture and proportion numbers say, including change versus the earlier photo if given; 2) how that connects to their biomarker systems and training (be careful: organ status comes from blood labs, not imaging); 3) the two most useful actions this week. Under 140 words. Speak as their performance physiologist: confident, specific, aimed at peak. Optimise; do not diagnose disease.\n\nDATA:\n${JSON.stringify(data)}`;
    try { const r = await sample(prompt, { cache: false, modelTier: 'quick' }); p.ai = Scan.ai[p.id] = (r.text || '').trim(); save(p); }
    catch (e) { Scan.ai[p.id] = offlineInsight(s, sc, systems, p) + (e && e.code === 'not_granted' ? '\n\nAI access was declined, so this is the offline read.' : '\n\nMyo is unavailable right now, so this is the offline read.'); }
    Scan.busy = false; OS.render();
  });
  OS.on('route', (name) => { if (name !== 'today') stopLive(); });

  /* ── mount: paint hologram canvas, attach live stream ────────────── */
  function mount(root) {
    const cv = root.querySelector('canvas.scan-holo');
    if (cv) {
      const p = Scan.photos.find((q) => q.id === cv.dataset.photo);
      const paint = (src) => cv.getContext('2d').drawImage(src, 0, 0);
      if (Scan.holo[p.id]) paint(Scan.holo[p.id]);
      else loadImg(urlOf(p)).then((img) => { const k = img.naturalWidth / p.w; const pp = Object.assign({}, p, { crop: { x: p.crop.x * k, y: p.crop.y * k, w: p.crop.w * k, h: p.crop.h * k } }); Scan.holo[p.id] = renderHolo(pp, img); if (cv.isConnected) paint(Scan.holo[p.id]); }).catch(() => {});
    }
    const v = root.querySelector('.cam-video'); if (v && Scan.stream) v.srcObject = Scan.stream;
  }

  OS.Scan = Object.assign(Scan, { modeSeg, center, insight, mount });
  if (window.indexedDB) loadPhotos(); else { Scan.persistent = false; Scan.ready = true; }
  // re-derive crop / metrics if a stored record predates a geometry change
  Scan._derive = derive;
})();
