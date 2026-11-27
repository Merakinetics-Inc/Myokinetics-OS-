/* ═══ MYO — LIVE ULTRASOUND: show, freeze, measure and keep frames from any ultrasound that outputs video ═══
   Sources  · a video capture device (an HDMI, VGA or S-video output through a USB capture dongle appears as a camera),
              a shared screen or window (a handheld probe's own app on this computer, or a mirrored phone), an
              exported clip or image, or a demo phantom
   Tools    · freeze, calibrate the scale against the image's own centimetre ruler, distance and ellipse calipers
              (circumference by Ramanujan's formula), labels, snapshots into Imaging, clip recording
   Presets  · general, vascular (vessel diameter and depth) and pregnancy (CRL, BPD, HC, AC, FL), whose measurements
              can be sent to the Pregnancy page
   Frames stay on this device. Myo shows and measures images; it does not interpret them. Use the scanner according
   to its own labeling and your clinician's instructions. */
(function () {
  'use strict';
  const { esc, icon, clamp } = OS;
  const PRESET = {
    general: [['dist', 'Distance', 'dist'], ['ell', 'Ellipse', 'ell']],
    vascular: [['diam', 'Vessel diameter', 'dist'], ['depth', 'Depth', 'dist'], ['ell', 'Vessel outline', 'ell']],
    pregnancy: [['crl', 'CRL', 'dist'], ['bpd', 'BPD', 'dist'], ['hc', 'HC', 'ell'], ['ac', 'AC', 'ell'], ['fl', 'FL', 'dist']]
  };
  const NAMES = { crl: 'Crown-rump length', bpd: 'Biparietal diameter', hc: 'Head circumference', ac: 'Abdominal circumference', fl: 'Femur length', diam: 'Vessel diameter', depth: 'Depth', dist: 'Distance', ell: 'Ellipse' };
  const US = { src: 'demo', devId: '', devs: [], stream: null, video: null, img: null, frozen: false, freezeCv: null, scale: null, tool: null, pts: [], meas: [], snaps: [], rec: null, recUrl: null, err: '', preset: 'general', label: '', raf: 0, t0: performance.now(), box: null, w: 960, h: 720 };

  /* ── sources ── */
  async function listDevices() {
    try { US.devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput'); } catch { US.devs = []; }
  }
  function stopSource() {
    if (US.stream) US.stream.getTracks().forEach((t) => t.stop());
    US.stream = null; if (US.video) { try { US.video.pause(); } catch { /* */ } if (US.video.src && US.video.src.startsWith('blob:')) URL.revokeObjectURL(US.video.src); US.video.srcObject = null; US.video.removeAttribute('src'); }
    US.img = null; US.frozen = false;
  }
  async function startSource(kind, file) {
    US.err = ''; stopSource(); US.src = kind;
    if (!US.video) { US.video = document.createElement('video'); US.video.muted = true; US.video.playsInline = true; US.video.loop = true; }
    try {
      if (kind === 'capture') {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('This browser cannot open video devices.');
        US.stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: US.devId ? { exact: US.devId } : undefined, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        US.video.srcObject = US.stream; await US.video.play(); await listDevices();
      } else if (kind === 'screen') {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) throw new Error('Screen sharing is not available in this browser.');
        US.stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
        US.video.srcObject = US.stream; await US.video.play();
        US.stream.getVideoTracks()[0].addEventListener('ended', () => { US.stream = null; US.src = 'demo'; paint(); });
      } else if (kind === 'file' && file) {
        if (/^image\//.test(file.type)) { US.img = await createImageBitmap(file); }
        else { US.video.src = URL.createObjectURL(file); await US.video.play(); }
      }
    } catch (e) { US.err = e && e.name === 'NotAllowedError' ? 'Permission was not given.' : e && e.name === 'NotFoundError' ? 'No video device found. Plug in the capture device and try again.' : (e.message || String(e)); US.src = 'demo'; }
    US.pts = []; paint();
  }
  // demo phantom: speckle in a sector, with a pulsating vessel (or a sac for the pregnancy preset)
  let speck = null;
  function phantom(g, W, H, t) {
    if (!speck) { speck = document.createElement('canvas'); speck.width = 256; speck.height = 256; const c = speck.getContext('2d'), d = c.createImageData(256, 256); for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() ** 2.2 * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } c.putImageData(d, 0, 0); }
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.save(); g.beginPath(); g.moveTo(W / 2, 40); g.arc(W / 2, 40, H - 80, Math.PI / 2 - 0.62, Math.PI / 2 + 0.62); g.closePath(); g.clip();
    g.globalAlpha = 0.85; for (let y = 0; y < H; y += 256) for (let x = 0; x < W; x += 256) g.drawImage(speck, x + ((t * 7) % 3), y); g.globalAlpha = 1;
    const grad = g.createLinearGradient(0, 40, 0, H); grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = grad; g.fillRect(0, 0, W, H);
    if (US.preset === 'pregnancy') { g.fillStyle = '#050505'; g.beginPath(); g.ellipse(W / 2, H * 0.52, 170, 120, 0.1, 0, 7); g.fill(); g.fillStyle = 'rgba(210,210,210,.85)'; g.beginPath(); g.ellipse(W / 2 - 20, H * 0.52 + 10, 70, 46, 0.2, 0, 7); g.fill(); g.beginPath(); g.arc(W / 2 + 62, H * 0.47, 34, 0, 7); g.fill(); }
    else { const r = 38 + 4 * Math.max(0, Math.sin(t * 2 * Math.PI * 1.1)) ** 3; g.fillStyle = '#030303'; g.beginPath(); g.ellipse(W / 2 - 40, H * 0.45, r * 1.15, r, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(230,230,230,.8)'; g.lineWidth = 3; g.stroke(); g.fillStyle = '#060606'; g.beginPath(); g.ellipse(W / 2 + 90, H * 0.47, 52, 26, 0, 0, 7); g.fill(); }
    g.restore();
    // depth ruler, 1 cm ticks at 54 px (the calibration target)
    g.strokeStyle = '#ddd'; g.fillStyle = '#ddd'; g.font = '13px system-ui'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(W - 40, 60); g.lineTo(W - 40, 60 + 54 * 10); g.stroke();
    for (let i = 0; i <= 10; i++) { g.beginPath(); g.moveTo(W - 40, 60 + i * 54); g.lineTo(W - (i % 5 ? 48 : 56), 60 + i * 54); g.stroke(); if (i % 5 === 0) g.fillText(String(i), W - 30, 64 + i * 54); }
    g.fillText('DEMO · cm', 16, 26);
  }

  /* ── drawing ── */
  function frameSize() { const v = US.video; if (US.img) return [US.img.width, US.img.height]; if (v && v.videoWidth && US.src !== 'demo') return [v.videoWidth, v.videoHeight]; return [960, 720]; }
  function loop() {
    const cv = US.box && US.box.querySelector('.us-cv'); if (!cv) return;
    const [W, H] = frameSize(); if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; US.w = W; US.h = H; }
    const g = cv.getContext('2d');
    if (US.frozen && US.freezeCv) g.drawImage(US.freezeCv, 0, 0);
    else if (US.img) g.drawImage(US.img, 0, 0);
    else if (US.src !== 'demo' && US.video && US.video.readyState >= 2) g.drawImage(US.video, 0, 0, W, H);
    else phantom(g, W, H, (performance.now() - US.t0) / 1000);
    overlay(g);
    US.raf = requestAnimationFrame(loop);
  }
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const ramanujan = (a, b) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
  function overlay(g) {
    const s = US.w / 960, mark = (p, c) => { g.strokeStyle = c; g.lineWidth = 2 * s; g.beginPath(); g.moveTo(p[0] - 8 * s, p[1]); g.lineTo(p[0] + 8 * s, p[1]); g.moveTo(p[0], p[1] - 8 * s); g.lineTo(p[0], p[1] + 8 * s); g.stroke(); };
    g.font = `${15 * s}px system-ui`;
    US.meas.forEach((m, i) => {
      g.strokeStyle = '#ffd54a'; g.fillStyle = '#ffd54a'; g.lineWidth = 2 * s; g.setLineDash([6 * s, 4 * s]);
      if (m.kind === 'dist') { g.beginPath(); g.moveTo(...m.pts[0]); g.lineTo(...m.pts[1]); g.stroke(); }
      else { const [a, b, c, d] = m.pts, cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, rot = Math.atan2(b[1] - a[1], b[0] - a[0]); g.beginPath(); g.ellipse(cx, cy, dist(a, b) / 2, dist(c, d) / 2, rot, 0, 7); g.stroke(); }
      g.setLineDash([]); m.pts.forEach((p) => mark(p, '#ffd54a'));
      const p = m.pts[1]; g.fillText(`${i + 1}  ${m.label} ${fmtVal(m)}`, p[0] + 10 * s, p[1] - 8 * s);
    });
    if (US.tool) { US.pts.forEach((p) => mark(p, US.tool === 'cal' ? '#4ade80' : '#5ac8fa')); if (US.pts.length >= 2 && US.tool !== 'ell') { g.strokeStyle = US.tool === 'cal' ? '#4ade80' : '#5ac8fa'; g.beginPath(); g.moveTo(...US.pts[0]); g.lineTo(...US.pts[1]); g.stroke(); } }
    g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText(US.scale ? `Scale ${US.scale.toFixed(1)} px/cm` : 'Not calibrated', 16 * s, US.h - 16 * s);
    if (US.frozen) { g.fillStyle = '#5ac8fa'; g.fillText('FROZEN', US.w - 90 * s, 26 * s); }
  }
  const fmtVal = (m) => (m.cm == null ? `${Math.round(m.px)} px` : m.kind === 'dist' ? `${(m.cm * 10).toFixed(1)} mm` : `${m.cm.toFixed(1)} cm`);

  /* ── pointer tools ── */
  function onClick(e) {
    if (!US.tool) return;
    const cv = e.currentTarget, r = cv.getBoundingClientRect(), p = [((e.clientX - r.left) / r.width) * cv.width, ((e.clientY - r.top) / r.height) * cv.height];
    if (!US.frozen) freeze(true);
    US.pts.push(p);
    const need = US.tool === 'ell' ? 4 : 2;
    if (US.pts.length < need) { paintStatus(); return; }
    if (US.tool === 'cal') { const px = dist(US.pts[0], US.pts[1]); US.calPx = px; US.tool = 'calin'; US.pts = []; paint(); return; }
    const kind = US.tool, item = PRESET[US.preset].find(([k]) => k === US.label) || PRESET[US.preset].find(([, , t]) => t === kind), lab = item ? item[1] : NAMES[kind];
    let m;
    if (kind === 'dist') { const px = dist(US.pts[0], US.pts[1]); m = { kind, pts: US.pts.slice(), px, cm: US.scale ? px / US.scale : null }; }
    else { const a = dist(US.pts[0], US.pts[1]) / 2, b = dist(US.pts[2], US.pts[3]) / 2, px = ramanujan(a, b); m = { kind: 'ell', pts: US.pts.slice(), px, cm: US.scale ? px / US.scale : null, area: US.scale ? (Math.PI * a * b) / US.scale ** 2 : null }; }
    m.key = item ? item[0] : kind; m.label = lab; US.meas.push(m); US.pts = [];
    if (OS.logEvent) { /* measurements are logged when sent or saved, not on every click */ }
    paint();
  }
  function freeze(on) {
    const cv = US.box && US.box.querySelector('.us-cv'); if (!cv) return;
    US.frozen = on;
    if (on) { US.freezeCv = document.createElement('canvas'); US.freezeCv.width = cv.width; US.freezeCv.height = cv.height; const g = US.freezeCv.getContext('2d'); if (US.img) g.drawImage(US.img, 0, 0); else if (US.src !== 'demo' && US.video && US.video.readyState >= 2) g.drawImage(US.video, 0, 0, cv.width, cv.height); else phantom(g, cv.width, cv.height, (performance.now() - US.t0) / 1000); }
  }

  /* ── panel ── */
  function controls() {
    const P = PRESET[US.preset], rec = !!(US.rec && US.rec.state === 'recording');
    return `<div class="us-srcs" role="group" aria-label="Video source">${[['demo', 'Demo'], ['capture', 'Capture device'], ['screen', 'Share a screen'], ['file', 'Open a clip or image']].map(([k, l]) => k === 'file' ? `<label class="chip-btn ${US.src === k ? 'on' : ''}">${l}<input class="sr" type="file" accept="video/*,image/*" data-change="us-file"></label>` : `<button class="chip-btn ${US.src === k ? 'on' : ''}" data-act="us-src" data-k="${k}">${l}</button>`).join('')}
        ${US.src === 'capture' && US.devs.length > 1 ? `<select data-change="us-dev" aria-label="Capture device">${US.devs.map((d, i) => `<option value="${esc(d.deviceId)}" ${d.deviceId === US.devId ? 'selected' : ''}>${esc(d.label || `Camera ${i + 1}`)}</option>`).join('')}</select>` : ''}</div>
      ${US.err ? `<p class="small us-err" role="alert">${esc(US.err)}</p>` : ''}
      <div class="us-tools">
        <button class="btn sm ${US.frozen ? 'on' : ''}" data-act="us-freeze" aria-pressed="${US.frozen}">${icon(US.frozen ? 'play' : 'pause', 14)} ${US.frozen ? 'Live' : 'Freeze'}</button>
        <button class="btn ghost sm ${US.tool === 'cal' || US.tool === 'calin' ? 'on' : ''}" data-act="us-tool" data-k="cal">Calibrate</button>
        ${P.map(([k, l, t]) => `<button class="btn ghost sm ${US.tool === t && US.label === k ? 'on' : ''}" data-act="us-tool" data-k="${t}" data-l="${k}" title="${esc(NAMES[k] || l)}">${esc(l)}</button>`).join('')}
        <button class="btn ghost sm" data-act="us-snap">${icon('upload', 14)} Snapshot</button>
        <button class="btn ghost sm ${rec ? 'on' : ''}" data-act="us-rec">${rec ? 'Stop recording' : 'Record clip'}</button>
        ${US.meas.length ? '<button class="btn ghost sm" data-act="us-clear">Clear measurements</button>' : ''}</div>
      ${US.tool === 'calin' ? `<form class="us-cal" data-submit="us-cal"><label>Those two points are <input name="cm" type="number" step="0.1" min="0.1" max="40" value="1" required> cm apart on the image's ruler</label><button class="btn sm">Set scale</button></form>` : ''}
      <p class="small muted" id="us-status" role="status">${status()}</p>
      ${US.meas.length ? `<ol class="us-meas">${US.meas.map((m, i) => `<li><b>${esc(m.label)}</b> <span class="num">${fmtVal(m)}</span>${m.area ? ` <span class="muted small">area ${m.area.toFixed(1)} cm²</span>` : ''} <button class="lb-del" data-act="us-del" data-i="${i}" aria-label="Delete measurement ${i + 1}">${icon('x', 12)}</button></li>`).join('')}</ol>
        ${US.preset === 'pregnancy' && US.scale && OS.pregnancy ? '<button class="btn sm" data-act="us-to-preg">Send to Pregnancy</button>' : ''}` : ''}
      ${US.snaps.length ? `<div class="us-snaps">${US.snaps.map((s, i) => `<figure><img src="${s.url}" alt="Snapshot ${i + 1}"><figcaption><button class="link small" data-act="us-snap-img" data-i="${i}">To Imaging</button> <a class="link small" href="${s.url}" download="${esc(s.name)}">Download</a></figcaption></figure>`).join('')}</div>` : ''}
      ${US.recUrl ? `<p class="small"><a class="link" href="${US.recUrl}" download="myo-ultrasound-${Date.now()}.webm">Download recorded clip</a> (WebM, stays on this device until you save it)</p>` : ''}`;
  }
  function status() {
    if (US.tool === 'cal') return `Calibrate: click two marks on the image's centimetre ruler (${US.pts.length} of 2).`;
    if (US.tool === 'calin') return 'Enter how far apart those marks are.';
    if (US.tool === 'dist') return `Click the two ends (${US.pts.length} of 2). The image freezes while you measure.`;
    if (US.tool === 'ell') return `Click the ends of the long axis, then of the short axis (${US.pts.length} of 4).`;
    return US.scale ? 'Pick a measurement tool, or freeze to look closely.' : 'Calibrate first so measurements read in millimetres.';
  }
  const paintStatus = () => { const el = US.box && US.box.querySelector('#us-status'); if (el) el.textContent = status(); };
  function paint() { const c = US.box && US.box.querySelector('.us-ctl'); if (c) c.innerHTML = controls(); }

  function mount(box, opts = {}) {
    US.box = box; US.preset = opts.preset || 'general';
    box.innerHTML = `<div class="us-stage"><canvas class="us-cv" aria-label="Ultrasound image. Use the tools below to freeze and measure."></canvas></div><div class="us-ctl"></div>`;
    const cv = box.querySelector('.us-cv'); cv.addEventListener('click', onClick);
    paint(); cancelAnimationFrame(US.raf); US.raf = requestAnimationFrame(loop);
    const route = location.hash.slice(1);
    const off = () => { stopSource(); US.src = 'demo'; if (US.rec && US.rec.state === 'recording') US.rec.stop(); };
    // leaving the page stops the camera or screen share; a re-render of the same page keeps it if the viewer comes back
    return () => { cancelAnimationFrame(US.raf); US.box = null; if (location.hash.slice(1) !== route) off(); else setTimeout(() => { if (!US.box) off(); }, 0); };
  }

  OS.act('us-src', (el) => { const k = el.dataset.k; if (k === 'demo') { stopSource(); US.src = 'demo'; paint(); } else startSource(k); });
  OS.change('us-file', (el) => { const f = el.files && el.files[0]; el.value = ''; if (f) startSource('file', f); });
  OS.change('us-dev', (el) => { US.devId = el.value; startSource('capture'); });
  OS.act('us-freeze', () => { freeze(!US.frozen); paint(); });
  OS.act('us-tool', (el) => { const k = el.dataset.k; US.tool = US.tool === k && US.label === (el.dataset.l || '') ? null : k; US.label = el.dataset.l || ''; US.pts = []; paint(); });
  OS.act('us-cal', (form) => { const cm = +form.elements.cm.value; if (!(cm > 0) || !US.calPx) return; US.scale = US.calPx / cm; US.tool = null; US.meas.forEach((m) => { m.cm = m.px / US.scale; }); paint(); OS.toast(`Scale set: ${US.scale.toFixed(1)} pixels per cm`); });
  OS.act('us-clear', () => { US.meas = []; paint(); });
  OS.act('us-del', (el) => { US.meas.splice(+el.dataset.i, 1); paint(); });
  OS.act('us-snap', () => {
    const cv = US.box && US.box.querySelector('.us-cv'); if (!cv) return;
    cv.toBlob((b) => { if (!b) return; const name = `myo-ultrasound-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`; US.snaps.unshift({ url: URL.createObjectURL(b), blob: b, name }); US.snaps = US.snaps.slice(0, 8); paint(); }, 'image/png');
  });
  OS.act('us-snap-img', async (el) => { const s = US.snaps[+el.dataset.i]; if (!s || !OS.imaging) return; await OS.imaging.importFiles([new File([s.blob], s.name, { type: 'image/png' })]); OS.toast('Snapshot saved to Imaging on this device'); });
  OS.act('us-rec', () => {
    const cv = US.box && US.box.querySelector('.us-cv'); if (!cv) return;
    if (US.rec && US.rec.state === 'recording') { US.rec.stop(); return; }
    if (!window.MediaRecorder || !cv.captureStream) { OS.toast('Recording is not supported in this browser'); return; }
    const chunks = [], rec = new MediaRecorder(cv.captureStream(30), { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm' });
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => { if (US.recUrl) URL.revokeObjectURL(US.recUrl); US.recUrl = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' })); paint(); };
    rec.start(); US.rec = rec; paint(); setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, 60000);
  });
  OS.act('us-to-preg', () => { const out = {}; US.meas.forEach((m) => { if (m.cm != null && ['crl', 'bpd', 'hc', 'ac', 'fl'].includes(m.key)) out[m.key] = +(m.cm * 10).toFixed(1); }); if (!Object.keys(out).length) { OS.toast('Measure CRL, BPD, HC, AC or FL first'); return; } OS.pregnancy.addMeasures(out); OS.toast('Sent to Pregnancy as a new scan entry for today'); });

  OS.register('ultrasound', {
    title: 'Live ultrasound', icon: 'ultrasound',
    render() {
      return `${OS.ui.head('Any scanner with a video output · on-device', 'Live ultrasound', 'Show a live ultrasound feed from a capture device or a probe app, freeze it, calibrate and measure, and keep snapshots in Imaging. Frames never leave this device.')}
        <div class="us-page"><section class="card"><div class="card-h"><h2>Viewer</h2><div class="seg" role="group" aria-label="Measurement preset">${[['general', 'General'], ['vascular', 'Vascular'], ['pregnancy', 'Pregnancy']].map(([k, l]) => `<button class="${US.preset === k ? 'on' : ''}" data-act="us-preset" data-k="${k}">${l}</button>`).join('')}</div></div><div class="us-box"></div></section>
        <div class="grid g-2"><section class="card"><div class="card-h"><h2>Connecting a scanner</h2></div><ul class="small bc-ref">
          <li><b>Cart or portable scanners:</b> connect the HDMI, VGA or S-video output to a USB video capture dongle. It appears here as a camera: choose Capture device.</li>
          <li><b>Handheld probes</b> (phone or tablet apps): run the app on this computer, or mirror the phone to it, and choose Share a screen.</li>
          <li><b>Exported studies:</b> open a clip or image here, or DICOM files in <a href="#imaging">Imaging</a>.</li>
          <li><b>Calibrate</b> on the image's own depth ruler before measuring; change the depth and you must calibrate again.</li></ul></section>
          <section class="card"><div class="card-h"><h2>Use and privacy</h2></div><ul class="small bc-ref">
          <li>Video is processed in this browser and never uploaded. Snapshots go to Imaging on this device; clips download to it.</li>
          <li>Myo shows and measures images; it does not interpret them. Readings depend on the calibration and where you click, and are not a substitute for the scanner's own measurements.</li>
          <li>Use the scanner as its maker and your clinician instruct. Regulators advise against non-medical "keepsake" ultrasound in pregnancy.</li></ul></section></div></div>`;
    },
    mount(root) { const box = root.querySelector('.us-box'); return box ? mount(box, { preset: US.preset }) : null; }
  });
  OS.act('us-preset', (el) => { US.preset = el.dataset.k; US.tool = null; US.pts = []; OS.render(); });
  OS.us = { mount, state: US, ramanujan, PRESET };
})();
