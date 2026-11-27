/* ═══ MYO — BLOOD FLOW: how blood moves through arteries, capillaries and veins, and tools to watch it ═══
   Circulation · pressure, speed and total cross-section along the circuit (speed = cardiac output ÷ cross-section),
                 where the blood sits, how veins and lymph return it, with the member's own pressure, heart rate,
                 blood volume (Nadler) and resting cardiac output
   Doppler     · a pocket Doppler's audio (its headphone output into line-in, its speaker to the microphone, or a
                 recording) as a spectral display; the maximum Doppler shift becomes velocity by
                 v = c·Δf / (2·f0·cos θ) with c = 1540 m/s; peak, end-diastolic and mean velocity, resistive and
                 pulsatility indices, the pulse rate in the flow, and whether the signal is pulsatile (artery-like)
                 or steady and breath-linked (vein-like); artery and vein demo signals
   Perfusion   · the camera pulse's perfusion index from Live sensors
   Scans       · the live ultrasound viewer with vascular presets, and Doppler images in Imaging
   Education and wellness only: Myo does not detect narrowing, clots or any condition, and offers no fetal heart
   monitoring (regulators advise against home fetal Dopplers). */
(function () {
  'use strict';
  const { esc, icon, pill, clamp, fmtDate } = OS;
  const TABS = [['circ', 'Circulation'], ['doppler', 'Doppler monitor'], ['perf', 'Perfusion'], ['scans', 'Vascular scans']];
  const FL = { tab: 'circ', src: 'demo-a', f0: 8, angle: 60, site: '', listen: false, run: null, last: null, err: '' };
  const C_SOUND = 1540;   // m/s in soft tissue
  const SITES = ['Radial artery (wrist)', 'Brachial artery (inner elbow)', 'Dorsalis pedis artery (top of foot)', 'Posterior tibial artery (inner ankle)', 'Popliteal artery (behind knee)', 'Femoral vein (groin)', 'Popliteal vein (behind knee)', 'Great saphenous vein (inner leg)', 'Other'];

  /* ── DSP ── */
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let len = 2; len <= n; len <<= 1) { const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang); for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const a = i + k, b = a + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr; re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } } }
  }
  const N = 2048, HANN = (() => { const w = new Float64Array(N); for (let k = 0; k < N; k++) w[k] = 0.5 - 0.5 * Math.cos((2 * Math.PI * k) / (N - 1)); return w; })();
  // one frame → spectrum in dB, and the maximum and mean Doppler frequency: bins 12 dB over the noise floor count as
  // signal, the maximum is where 97% of that signal power lies below (the percentile method, robust to stray noise bins)
  function analyseFrame(x, sr) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let k = 0; k < N; k++) re[k] = (x[k] || 0) * HANN[k];
    fft(re, im);
    const H = N / 2, df = sr / N, k0 = Math.max(2, Math.round(80 / df)), k1 = Math.min(H - 2, Math.round(14000 / df)), p = new Float64Array(H), db = new Float32Array(H);
    for (let k = 0; k < H; k++) p[k] = re[k] * re[k] + im[k] * im[k];
    for (let k = 1; k < H - 1; k++) db[k] = 10 * Math.log10((p[k - 1] + 2 * p[k] + p[k + 1]) / 4 + 1e-12);
    const band = Array.from(db.subarray(k0, k1)).sort((a, b) => a - b), floor = band[Math.floor(band.length * 0.3)], thr = floor + 12;
    let tot = 0, pf = 0;
    for (let k = k0; k <= k1; k++) if (db[k] > thr) { const w = 10 ** (db[k] / 10); tot += w; pf += w * k * df; }
    let kmax = 0;
    if (tot > 0) { let c = 0; for (let k = k0; k <= k1; k++) { if (db[k] > thr) c += 10 ** (db[k] / 10); if (c >= 0.97 * tot) { kmax = k; break; } } }
    return { db, floor, fmax: kmax * df, fmean: tot ? pf / tot : 0, snr: band[band.length - 1] - floor };
  }
  const vel = (f, f0, ang) => (100 * C_SOUND * f) / (2 * f0 * 1e6 * Math.cos((ang * Math.PI) / 180));   // cm/s
  // autocorrelation: the strongest local peak between lo and hi samples (a slow drift alone has no peak)
  function acf(x, lo, hi) {
    const n = x.length, m = x.reduce((a, b) => a + b, 0) / n, d = x.map((v) => v - m), e = d.reduce((a, b) => a + b * b, 0) || 1, r = [];
    for (let L = Math.max(1, lo - 1); L <= Math.min(hi + 1, n - 2); L++) { let s = 0; for (let i = 0; i + L < n; i++) s += d[i] * d[i + L]; r[L] = s / e; }
    let best = 0, lag = 0;
    for (let L = lo; L <= Math.min(hi, n - 3); L++) if (r[L] > r[L - 1] && r[L] >= r[L + 1] && r[L] > best) { best = r[L]; lag = L; }
    return { r: best, lag };
  }
  const smooth = (x, w) => x.map((_, i) => { let s = 0, c = 0; for (let j = Math.max(0, i - w); j <= Math.min(x.length - 1, i + w); j++) { s += x[j]; c++; } return s / c; });
  // the last few seconds of maximum velocity → indices and pattern
  function measure(series, rate) {
    const win = Math.round(rate * 8), xs = series.slice(-win).map((p) => p[1]); if (xs.length < rate * 3) return null;
    const flowFrac = xs.filter((v) => v > 2).length / xs.length;
    const slow = smooth(xs, Math.round(rate * 0.75)), card = acf(xs.map((v, i) => v - slow[i]), Math.round(rate * 0.33), Math.round(rate * 1.6)), resp = acf(smooth(xs, Math.round(rate * 0.5)), Math.round(rate * 2), Math.round(rate * 9));
    const P = card.lag || Math.round(rate), cyc = [];
    for (let i = 0; i + P <= xs.length; i += P) cyc.push(xs.slice(i, i + P));
    const med = (a) => { const b = a.slice().sort((p, q) => p - q); return b.length ? b[b.length >> 1] : null; };
    const psv = med(cyc.map((c) => Math.max(...c))), edv = med(cyc.map((c) => Math.min(...c))), tamax = xs.reduce((a, b) => a + b, 0) / xs.length;
    const ri = psv ? (psv - edv) / psv : null, pi = tamax ? (psv - edv) / tamax : null, sd = Math.sqrt(xs.reduce((a, b) => a + (b - tamax) ** 2, 0) / xs.length), mod = tamax ? sd / tamax : 0;
    const pattern = flowFrac < 0.3 ? 'none' : card.r > 0.45 && ri > 0.45 ? 'pulsatile' : resp.r > 0.3 && mod < 0.5 ? 'phasic' : mod < 0.2 ? 'steady' : 'mixed';
    // without a beat in the flow there is no systole or diastole: report the highest velocity and the mean only
    if (card.r <= 0.45) return { psv: Math.max(...xs), edv: null, tamax, ri: null, pi: null, hr: null, pattern, rCard: card.r, rResp: resp.r, flowFrac };
    return { psv, edv, tamax, ri, pi, hr: Math.round((60 * rate) / P), pattern, rCard: card.r, rResp: resp.r, flowFrac };
  }
  const PATTERN = { pulsatile: ['good', 'Pulsatile: artery-like'], phasic: ['good', 'Steady, rising and falling with breathing: vein-like'], steady: ['muted', 'Steady flow'], mixed: ['warn', 'Mixed or unclear'], none: ['muted', 'No clear flow signal'] };

  /* ── demo signals: synthetic Doppler audio from a velocity waveform ── */
  function demoBuffer(ctx, kind, f0, ang) {
    const sr = ctx.sampleRate, dur = 30, n = sr * dur, buf = ctx.createBuffer(1, n, sr), x = buf.getChannelData(0), K = 12;
    const us = Array.from({ length: K }, (_, i) => 0.35 + (0.65 * i) / (K - 1)), ph = new Float64Array(K), amp = us.map(() => 0.3 + Math.random() * 0.7);
    const hr = 66, per = 60 / hr, g = (t, c, w) => Math.exp(-(((t - c) / w) ** 2));
    const vArt = (t) => { const c = (t % per) / per; return 70 * g(c, 0.12, 0.06) + 14 * g(c, 0.3, 0.05) + 12 * g(c, 0.45, 0.07) + 12; };   // systolic peak, reversal (unsigned), late forward, diastolic floor
    const vVein = (t) => 14 * (1 + 0.45 * Math.sin((2 * Math.PI * t) / 4.5)) + 0.8 * Math.sin((2 * Math.PI * t) / per);
    const vf = kind === 'demo-v' ? vVein : vArt, kf = (2 * f0 * 1e6 * Math.cos((ang * Math.PI) / 180)) / (100 * C_SOUND);
    for (let i = 0; i < n; i++) {
      const t = i / sr, v = vf(t); let s = 0;
      for (let k = 0; k < K; k++) { ph[k] += (2 * Math.PI * kf * v * us[k]) / sr; s += amp[k] * Math.sin(ph[k]); if ((i & 2047) === 0) amp[k] = clamp(amp[k] + (Math.random() - 0.5) * 0.2, 0.2, 1); }
      x[i] = s / K * 0.6 + (Math.random() - 0.5) * 0.02;
    }
    return buf;
  }

  /* ── a session ── */
  let AC = null;
  async function start(kind, file) {
    await stop(false); FL.err = '';
    AC = AC || new (window.AudioContext || window.webkitAudioContext)(); await AC.resume();
    const sr = AC.sampleRate, S = { kind, sr, hop: Math.round(sr / 50), t0: AC.currentTime, series: [], cols: [], pos: 0, buf: null, node: null, an: null, stream: null, gain: AC.createGain(), last: null, m: null, stopFns: [] };
    S.gain.gain.value = FL.listen ? 1 : 0; S.gain.connect(AC.destination);
    if (kind === 'mic') {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('This browser cannot open the microphone or line-in.');
      S.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
      const src = AC.createMediaStreamSource(S.stream), an = AC.createAnalyser(); an.fftSize = N; an.smoothingTimeConstant = 0; src.connect(an); src.connect(S.gain); S.an = an; S.tmp = new Float32Array(N);
      S.stopFns.push(() => { S.stream.getTracks().forEach((t) => t.stop()); src.disconnect(); });
    } else {
      S.buf = kind === 'file' ? await AC.decodeAudioData(await file.arrayBuffer()) : demoBuffer(AC, kind, FL.f0, FL.angle);
      const node = AC.createBufferSource(); node.buffer = S.buf; node.loop = kind !== 'file'; node.connect(S.gain); node.start(); S.node = node; S.t0 = AC.currentTime;
      S.stopFns.push(() => { try { node.stop(); } catch { /* */ } node.disconnect(); });
      if (kind === 'file') node.onended = () => { if (FL.run === S) stop(true); };
    }
    FL.run = S; FL.last = null;
    S.pump = setInterval(() => pump(S), 20);
    S.raf = requestAnimationFrame(() => drawLoop(S));
    if (OS.current === 'flow') OS.render();
  }
  function pump(S) {
    if (FL.run !== S) return;
    if (S.an) { S.an.getFloatTimeDomainData(S.tmp); step(S, S.tmp, AC.currentTime - S.t0); return; }
    const ch = S.buf.getChannelData(0), until = Math.floor((AC.currentTime - S.t0) * S.sr), len = ch.length;
    let guard = 0;
    while (S.pos + S.hop <= until && guard++ < 200) {
      const at = S.pos % len, x = new Float32Array(N); for (let k = 0; k < N; k++) x[k] = ch[(at + k) % len];
      step(S, x, S.pos / S.sr); S.pos += S.hop;
    }
  }
  function step(S, x, t) {
    const a = analyseFrame(x, S.sr), vmax = a.snr > 12 ? vel(a.fmax, FL.f0, FL.angle) : 0, vmean = a.snr > 12 ? vel(a.fmean, FL.f0, FL.angle) : 0;
    S.series.push([t, vmax, vmean]); if (S.series.length > 50 * 60) S.series.splice(0, S.series.length - 50 * 60);
    S.cols.push({ db: a.db, floor: a.floor, vmax }); if (S.cols.length > 600) S.cols.shift();
    if (S.series.length % 25 === 0) S.m = measure(S.series, 50);
  }
  async function stop(save) {
    const S = FL.run; if (!S) return;
    FL.run = null; clearInterval(S.pump); cancelAnimationFrame(S.raf); S.stopFns.forEach((f) => { try { f(); } catch { /* */ } }); try { S.gain.disconnect(); } catch { /* */ }
    const dur = S.series.length ? Math.round(S.series[S.series.length - 1][0] - S.series[0][0]) : 0, m = S.m;
    FL.last = { at: new Date().toISOString(), src: S.kind, site: FL.site, f0: FL.f0, angle: FL.angle, dur, demo: S.kind.startsWith('demo'), ...(m ? { psv: Math.round(m.psv), edv: m.edv != null ? Math.round(m.edv) : null, tamax: Math.round(m.tamax), ri: m.ri != null ? +m.ri.toFixed(2) : null, pi: m.pi != null ? +m.pi.toFixed(2) : null, hr: m.hr, pattern: m.pattern } : {}) };
    if (save && !FL.last.demo && dur >= 10 && m) {
      const r = FL.last;
      OS.update((s) => { s.flow = s.flow || { log: [] }; s.flow.log = (s.flow.log || []).concat([r]).slice(-300); }, { render: false });
      FL.last.saved = true;
    }
    if (OS.current === 'flow') OS.render();
  }

  /* ── drawing ── */
  function drawLoop(S) {
    if (FL.run !== S) return;
    const cv = document.getElementById('fl-spec');
    if (cv && cv.clientWidth) {
      const r = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== Math.round(W * r)) { cv.width = Math.round(W * r); cv.height = Math.round(H * r); }
      const g = cv.getContext('2d'); g.setTransform(r, 0, 0, r, 0, 0); g.fillStyle = '#05070b'; g.fillRect(0, 0, W, H);
      const L = 6, R = 52, T = 8, B = 20, pw = W - L - R, ph = H - T - B, n = S.cols.length, cw = pw / 600;
      const vTop = 120, df = S.sr / N, kPerCm = (2 * FL.f0 * 1e6 * Math.cos((FL.angle * Math.PI) / 180)) / (100 * C_SOUND) / df;   // bins per cm/s
      const rows = Math.min(ph, 220), img = g.createImageData(Math.max(1, Math.round(pw)), rows), iw = img.width;
      for (let c = 0; c < n; c++) {
        const col = S.cols[c], x0 = Math.round(((600 - n + c) / 600) * iw);
        for (let y = 0; y < rows; y++) {
          const v = vTop * (1 - y / rows), k = Math.round(v * kPerCm), d = col.db[k] || -200, s = clamp((d - col.floor - 4) / 30, 0, 1) * 255;
          const o = (y * iw + x0) * 4; for (let w = 0; w < Math.ceil(iw / 600) + 1 && x0 + w < iw; w++) { const oo = o + w * 4; img.data[oo] = s; img.data[oo + 1] = s; img.data[oo + 2] = s; img.data[oo + 3] = 255; }
        }
      }
      const tmp = document.createElement('canvas'); tmp.width = iw; tmp.height = rows; tmp.getContext('2d').putImageData(img, 0, 0);
      g.imageSmoothingEnabled = true; g.drawImage(tmp, L, T, pw, ph);
      // maximum-velocity envelope
      g.strokeStyle = '#ffb347'; g.lineWidth = 1.6; g.beginPath(); let on = false;
      S.cols.forEach((col, c) => { const x = L + ((600 - n + c) / 600) * pw, y = T + (1 - Math.min(col.vmax, vTop) / vTop) * ph; if (col.vmax > 0) { if (on) g.lineTo(x, y); else g.moveTo(x, y); on = true; } else on = false; });
      g.stroke();
      g.fillStyle = '#9aa6b8'; g.font = '11px system-ui'; g.textAlign = 'left';
      [0, 30, 60, 90, 120].forEach((v) => { const y = T + (1 - v / vTop) * ph; g.fillText(`${v}`, W - R + 6, y + 4); g.fillStyle = 'rgba(154,166,184,.25)'; g.fillRect(L, y, pw, 1); g.fillStyle = '#9aa6b8'; });
      g.fillText('cm/s', W - R + 6, H - 6); g.fillText('12 s ago', L + 2, H - 6); g.textAlign = 'right'; g.fillText('now', W - R - 4, H - 6); g.textAlign = 'left';
    }
    if (!S.lastUi || performance.now() - S.lastUi > 250) { S.lastUi = performance.now(); readouts(S); }
    S.raf = requestAnimationFrame(() => drawLoop(S));
  }
  function readouts(S) {
    const m = S.m, set = (id, v) => { const el = document.getElementById(id); if (el && el.textContent !== v) el.textContent = v; };
    set('fl-psv', m ? String(Math.round(m.psv)) : '—'); set('fl-edv', m && m.edv != null ? String(Math.round(m.edv)) : '—'); set('fl-tam', m ? String(Math.round(m.tamax)) : '—');
    set('fl-ri', m && m.ri != null ? m.ri.toFixed(2) : '—'); set('fl-pi', m && m.pi != null ? m.pi.toFixed(2) : '—'); set('fl-hr', m && m.hr ? String(m.hr) : '—');
    const p = document.getElementById('fl-pat'); if (p && m) { const [st, l] = PATTERN[m.pattern]; p.innerHTML = pill(st, l); }
    set('fl-time', `${Math.floor((S.series.length / 50) / 60)}:${String(Math.floor((S.series.length / 50) % 60)).padStart(2, '0')}`);
  }

  /* ── circulation reference: total cross-section (cm²) and mean pressure (mmHg); speed = cardiac output ÷ area ── */
  const SEG = [['Aorta', 2.5, 100], ['Small arteries', 20, 85], ['Arterioles', 40, 55], ['Capillaries', 2500, 25], ['Venules', 250, 15], ['Small veins', 80, 10], ['Venae cavae', 8, 3]];
  const VOL = [['Systemic veins and venules', 64], ['Arteries', 13], ['Pulmonary circulation', 9], ['Arterioles and capillaries', 7], ['Heart', 7]];
  function bars(rows, fmtV, logScale, label) {
    const vals = rows.map((r) => r[1]), mx = logScale ? Math.log10(Math.max(...vals) * 1.2) : Math.max(...vals), mn = logScale ? Math.log10(Math.min(...vals) / 2) : 0;
    const pct = (v) => clamp(((logScale ? Math.log10(v) : v) - mn) / (mx - mn) * 100, 1, 100);
    return `<ul class="fl-bars" aria-label="${esc(label)}">${rows.map(([n, v]) => `<li><span>${esc(n)}</span><i class="fl-track"><i style="width:${pct(v).toFixed(1)}%"></i></i><b class="num">${fmtV(v)}</b></li>`).join('')}</ul>`;
  }
  function circTab(s) {
    const p = s.profile || {}, vt = s.vitals || {}, labs = (s.enhance && s.enhance.labs) || {}, sbp = +labs.sbp || null, dbp = +labs.dbp || null;
    const h = (+p.heightCm || 175) / 100, w = +p.weightKg || 75, F = p.sex === 'F';
    const bv = F ? 0.3561 * h ** 3 + 0.03308 * w + 0.1833 : 0.3669 * h ** 3 + 0.03219 * w + 0.6041;   // Nadler, litres
    const co = vt.rhr ? (vt.rhr * 70) / 1000 : null, map = sbp && dbp ? dbp + (sbp - dbp) / 3 : null;
    const Q = 83;   // cm³/s at rest (5 l/min)
    const tile = (l, v, u, sub) => `<div><span>${l}</span><b>${v}</b><em>${u}</em>${sub ? `<i class="tw-d">${sub}</i>` : ''}</div>`;
    return `<section class="card"><div class="card-h"><h2>Your circulation</h2><span class="muted small">Estimates from your profile and vitals</span></div>
        <div class="lb-tiles">${tile('Blood volume', bv.toFixed(1), 'litres', 'Nadler formula')}${tile('Resting output', co ? co.toFixed(1) : '—', co ? 'l/min' : '', co ? `${vt.rhr} bpm × about 70 ml a beat` : 'Needs a resting heart rate')}
          ${tile('Blood pressure', sbp && dbp ? `${sbp}/${dbp}` : '—', 'mmHg', map ? `mean arterial ${Math.round(map)} mmHg` : 'Add it in Enhance labs')}${tile('One lap of the body', co ? Math.round((bv / co) * 60) : '—', co ? 'seconds' : '', 'blood volume ÷ output')}</div>
        <p class="fine">At rest the whole blood volume passes through the heart about once a minute. Hard exercise can raise output four to six times.</p></section>
      <div class="grid g-2">
        <section class="card"><div class="card-h"><h2>Pressure falls along the way</h2><span class="muted small">Mean, mmHg</span></div>${bars(SEG.map(([n, , pr]) => [n, pr]), (v) => `${v}`, false, 'Mean pressure along the circulation')}
          <p class="fine">The biggest drop is across the arterioles, which set resistance and decide where blood goes.</p></section>
        <section class="card"><div class="card-h"><h2>Speed follows the total width</h2><span class="muted small">cm/s, log scale</span></div>${bars(SEG.map(([n, a]) => [n, Q / a]), (v) => (v < 0.1 ? v.toFixed(2) : v < 10 ? v.toFixed(1) : Math.round(v)), true, 'Average blood speed along the circulation')}
          <p class="fine">Speed = output ÷ total cross-section. Billions of capillaries add up to about 2,500 cm², so blood crawls there (about 0.3 mm/s), which gives time for exchange.</p></section></div>
      <div class="grid g-2">
        <section class="card"><div class="card-h"><h2>Where the blood is</h2><span class="muted small">Share of blood volume</span></div>${bars(VOL, (v) => `${v}%`, false, 'Share of blood volume by part of the circulation')}<p class="fine">Veins are the body's blood reservoir: about two thirds of the blood sits in them.</p></section>
        <section class="card"><div class="card-h"><h2>Arteries, veins, capillaries, lymph</h2></div><ul class="small bc-ref">
          <li><b>Arteries</b> carry blood away from the heart under high pressure; their elastic walls smooth each beat into a pulse you can feel and hear in a Doppler.</li>
          <li><b>Capillaries</b> are one cell thick; oxygen, fuel and waste cross their walls.</li>
          <li><b>Veins</b> return blood at low pressure. One-way valves, the squeeze of working muscles and the suction of each breath move it uphill; that is why venous Doppler signals rise and fall with breathing.</li>
          <li><b>Lymph</b> collects about 3 litres a day of fluid that leaks from capillaries and returns it to the veins.</li></ul>
          <a class="btn ghost sm" href="#heart">${icon('heart', 14)} The heart, beat by beat</a></section></div>`;
  }
  function dopplerTab(s) {
    const S = FL.run, L = FL.last, log = ((s.flow && s.flow.log) || []).slice(-10).reverse();
    const srcBtn = (k, l, sub) => `<button class="st-src ${(S ? S.kind : FL.src) === k ? 'on' : ''}" data-act="fl-src" data-k="${k}" ${S ? 'disabled' : ''}><b>${l}</b><span>${sub}</span></button>`;
    return `<section class="card st"><div class="card-h"><h2>Doppler monitor</h2>${S ? pill('good', 'Running') : ''}</div>
        <div class="st-srcs">${srcBtn('mic', 'Pocket Doppler', 'Headphone output to line-in, or its speaker to the microphone')}${srcBtn('file', 'Recording', 'A WAV or MP3 of Doppler sound')}${srcBtn('demo-a', 'Demo: artery', 'A pulsatile signal, 66 beats a minute')}${srcBtn('demo-v', 'Demo: vein', 'Steady flow that follows breathing')}</div>
        <div class="lb-grid fl-set"><label>Probe frequency<select data-change="fl-f0" ${S ? 'disabled' : ''}>${[2, 3, 4, 5, 8, 10].map((f) => `<option value="${f}" ${FL.f0 === f ? 'selected' : ''}>${f} MHz</option>`).join('')}</select></label>
          <label>Angle to the vessel<select data-change="fl-ang" ${S ? 'disabled' : ''}>${[0, 30, 45, 60].map((a) => `<option value="${a}" ${FL.angle === a ? 'selected' : ''}>${a}°</option>`).join('')}</select></label>
          <label>Site<select data-change="fl-site">${['', ...SITES].map((x) => `<option ${FL.site === x ? 'selected' : ''} value="${esc(x)}">${x || 'Choose…'}</option>`).join('')}</select></label>
          <label class="ped-use tested fl-listen"><input type="checkbox" data-change="fl-listen" ${FL.listen ? 'checked' : ''}> Play the sound (use headphones with a microphone)</label></div>
        <div class="st-go">${S ? `<button class="btn" data-act="fl-stop">${icon('pause', 16)} Stop and save</button><button class="btn ghost" data-act="fl-cancel">Discard</button><span class="muted small">Time <b id="fl-time">0:00</b></span>`
          : FL.src === 'file' ? `<label class="btn bc-file">${icon('upload', 16)} Choose a recording<input class="sr" type="file" accept="audio/*" data-change="fl-file"></label>` : `<button class="btn" data-act="fl-start">${icon('play', 16)} Start</button>`}</div>
        ${FL.err ? `<p class="small" role="alert">${esc(FL.err)}</p>` : ''}
        ${S ? `<canvas id="fl-spec" class="fl-spec" aria-label="Spectral Doppler display: velocity over the last 12 seconds, brighter is stronger signal, with the maximum velocity traced in orange"></canvas>
          <div class="st-read">${[['Peak (PSV)', 'fl-psv', 'cm/s'], ['End-diastolic', 'fl-edv', 'cm/s'], ['Time-averaged peak', 'fl-tam', 'cm/s'], ['Resistive index', 'fl-ri', '(PSV − EDV) ÷ PSV'], ['Pulsatility index', 'fl-pi', '(PSV − EDV) ÷ mean'], ['Pulse in the flow', 'fl-hr', 'per minute']].map(([l, id, u]) => `<div><span>${l}</span><b class="num" id="${id}">—</b><em>${u}</em></div>`).join('')}</div>
          <p id="fl-pat" class="fl-pat"></p>` : ''}
        ${!S && L ? `<div class="st-after"><p class="small"><b>Last reading${L.site ? ` · ${esc(L.site)}` : ''}:</b> ${L.psv != null ? `peak ${L.psv} cm/s, mean ${L.tamax}${L.edv != null ? `, end-diastolic ${L.edv}, RI ${L.ri}, PI ${L.pi}` : ''}${L.hr ? `, pulse ${L.hr}` : ''}. ${PATTERN[L.pattern][1]}.` : 'Not enough clean signal to measure.'}</p>${L.demo ? '<p class="small muted">Demo readings are not saved.</p>' : L.saved ? '<p class="small">Saved to your Log book.</p>' : L.dur < 10 ? '<p class="small muted">Readings under 10 seconds are not saved.</p>' : ''}</div>` : ''}
        <p class="fine">Velocity = 1540 m/s × Doppler shift ÷ (2 × probe frequency × cos angle). Set the probe frequency printed on your Doppler and your best estimate of the angle; at 60° a small angle error changes the result a lot, so compare readings taken the same way. Most pocket Dopplers are non-directional, so reversed flow shows as forward.</p></section>
      <div class="grid g-2">
        <section class="card"><div class="card-h"><h2>Reading the signal</h2></div><ul class="small bc-ref">
          <li><b>Arteries</b> sound like a rhythmic whoosh with each beat. In the limbs at rest the waveform is sharp, with a brief back-and-forth (high resistance); in the brain and kidneys flow continues through diastole (low resistance).</li>
          <li><b>Veins</b> sound like a low wind that rises and falls with breathing, and surges when you squeeze the muscle below the probe.</li>
          <li><b>Resistive and pulsatility indices</b> describe the shape of the waveform, not health. They change with temperature, exercise, posture and angle.</li></ul></section>
        <section class="card"><div class="card-h"><h2>Saved readings</h2><span class="muted small">${log.length}</span></div>
          ${log.length ? `<div class="tbl-wrap"><table class="tbl compact"><caption class="sr">Saved Doppler readings</caption><thead><tr><th scope="col">When</th><th scope="col">Site</th><th scope="col">PSV</th><th scope="col">EDV</th><th scope="col">RI</th><th scope="col">Pattern</th></tr></thead><tbody>${log.map((r) => `<tr><th scope="row" class="small">${esc(fmtDate(r.at.slice(0, 10)))}</th><td class="small">${esc(r.site || '—')}</td><td class="num">${r.psv ?? '—'}</td><td class="num">${r.edv ?? '—'}</td><td class="num">${r.ri ?? '—'}</td><td class="small">${esc(r.pattern ? PATTERN[r.pattern][1].split(':')[0] : '—')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="small muted">No saved readings yet.</p>'}</section></div>
      <div class="banner fl-safe" role="note"><b>Not a diagnostic test.</b> Myo does not detect narrowed arteries, blood clots or any condition. Get urgent care for a leg that is suddenly painful, swollen, cold or pale, or chest pain or sudden breathlessness. Myo offers no fetal heart monitoring: regulators advise against using home Dopplers in pregnancy.</div>`;
  }
  function perfTab(s) {
    const log = ((s.sensors && s.sensors.log) || []).filter((r) => r.pi != null).slice(-8).reverse();
    return `<section class="card"><div class="card-h"><h2>Perfusion: blood reaching the skin</h2></div>
        <p class="small">Each heartbeat swells the tiny vessels in your fingertip a little. The camera pulse in Live sensors measures that swelling as a share of the steady light: the perfusion index. It rises when hands are warm and vessels are open, and falls when they are cold or clamped down.</p>
        <div class="st-go"><a class="btn" href="#stream">${icon('stream', 16)} Measure in Live sensors</a></div>
        <p class="fine">The camera index is relative to your own phone and finger, not the number a pulse oximeter shows. Compare readings taken the same way, at the same temperature.</p></section>
      <section class="card"><div class="card-h"><h2>Your readings</h2></div>${log.length ? `<div class="tbl-wrap"><table class="tbl compact"><caption class="sr">Camera perfusion readings</caption><thead><tr><th scope="col">When</th><th scope="col">Perfusion index</th><th scope="col">Heart rate</th><th scope="col">Quality</th></tr></thead><tbody>${log.map((r) => `<tr><th scope="row" class="small">${esc(new Date(r.at).toLocaleString())}</th><td class="num">${r.pi}</td><td class="num">${r.hr || '—'}</td><td class="num">${r.q}</td></tr>`).join('')}</tbody></table></div>` : '<p class="small muted">No camera readings with a perfusion index yet.</p>'}</section>`;
  }
  function scansTab() {
    return `<section class="card"><div class="card-h"><h2>Vascular ultrasound</h2><a class="btn ghost sm" href="#ultrasound">Open full screen</a></div><div class="us-box" data-preset="vascular"></div></section>
      <section class="card"><div class="card-h"><h2>Doppler images and reports</h2></div><p class="small">Colour and spectral Doppler images from a vascular study open in <a href="#imaging">Imaging</a> as DICOM, PNG or JPEG. The numbers on the image are your sonographer's; Myo shows them and does not re-read them.</p></section>`;
  }

  OS.register('flow', {
    title: 'Blood flow', icon: 'flow',
    render(s) {
      const body = FL.tab === 'doppler' ? dopplerTab(s) : FL.tab === 'perf' ? perfTab(s) : FL.tab === 'scans' ? scansTab() : circTab(s);
      return `${OS.ui.head('Arteries · capillaries · veins · Doppler', 'Blood flow', 'How blood moves through every artery, capillary and vein, and tools to watch it: a Doppler monitor for pocket Dopplers, camera perfusion, and live vascular ultrasound.')}
        <div class="fl"><div class="seg kt-tabs" role="tablist" aria-label="Blood flow">${TABS.map(([k, l]) => `<button role="tab" aria-selected="${FL.tab === k}" data-act="fl-tab" data-t="${k}">${l}</button>`).join('')}</div>${body}</div>`;
    },
    mount(root) {
      let undo = null; const box = root.querySelector('.us-box'); if (box && OS.us) undo = OS.us.mount(box, { preset: 'vascular' });
      if (FL.run && !FL.run.raf) FL.run.raf = requestAnimationFrame(() => drawLoop(FL.run));
      else if (FL.run) { cancelAnimationFrame(FL.run.raf); FL.run.raf = requestAnimationFrame(() => drawLoop(FL.run)); }
      return () => { if (undo) undo(); if (FL.run && location.hash.slice(1) !== 'flow') stop(false); };
    }
  });
  OS.act('fl-tab', (el) => { FL.tab = TABS.some(([k]) => k === el.dataset.t) ? el.dataset.t : 'circ'; OS.render(); });
  OS.act('fl-src', (el) => { if (FL.run) return; FL.src = el.dataset.k; FL.err = ''; OS.render(); });
  const go = async (kind, file) => { try { await start(kind, file); } catch (e) { FL.err = e && e.name === 'NotAllowedError' ? 'Microphone permission was not given.' : (e.message || String(e)); OS.render(); } };
  OS.act('fl-start', () => go(FL.src));
  OS.change('fl-file', (el) => { const f = el.files && el.files[0]; el.value = ''; if (f) go('file', f); });
  OS.act('fl-stop', () => stop(true));
  OS.act('fl-cancel', () => stop(false));
  OS.change('fl-f0', (el) => { FL.f0 = +el.value || 8; });
  OS.change('fl-ang', (el) => { FL.angle = +el.value; });
  OS.change('fl-site', (el) => { FL.site = el.value; });
  OS.change('fl-listen', (el) => { FL.listen = el.checked; if (FL.run) FL.run.gain.gain.value = FL.listen ? 1 : 0; });
  OS.flow = { analyseFrame, measure, vel, demoBuffer, state: FL, get session() { return FL.run; }, start, stop, SEG };
})();
