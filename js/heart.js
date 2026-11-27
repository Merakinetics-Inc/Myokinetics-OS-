/* ═══ MYO — HEART: anatomy, the cardiac cycle, rhythm and coronary views, tied to your own numbers ═══
   Anatomy   · an original schematic of the four chambers, valves, great vessels and conduction system; tap any part
   Cycle     · one heartbeat at your resting heart rate: pressures, volume, ECG and heart sounds on one time axis,
               valves opening and closing on the heart beside it, optional synthesised "lub-dub"
   Rhythm    · an ECG strip built from your resting heart rate and HRV, with breathing-linked variation (a slider
               shows why slow breathing raises HRV) and every wave and interval labelled
   Coronary  · a 3D coronary tree projected like a cath-lab C-arm: RAO/LAO rotation, cranial/caudal angulation, the
               standard views, dominance, a fluoroscopy look and how much of each vessel is foreshortened
   Your heart· resting heart rate, HRV, blood pressure, VO2max and the lipid and inflammation markers that matter
   Every drawing and model here is original and schematic. This page teaches; it never reads or interprets a member's
   own ECG, heart sounds or angiogram. */
(function () {
  'use strict';
  const { esc, icon, pill, clamp } = OS;
  const H = { tab: 'anatomy', sel: null, flow: true, cond: false, play: true, slow: false, sound: false,
    alpha: -30, beta: -30, sys: 'left', dom: 'right', look: 'fluoro', labels: true, fs: true, breath: 6 };
  const TABS = [['anatomy', 'Anatomy'], ['cycle', 'Cycle'], ['rhythm', 'Rhythm'], ['coronary', 'Coronary views'], ['you', 'Your heart']];
  const reduce = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const hrOf = (s) => clamp(Math.round((s.vitals && s.vitals.rhr) || 60), 40, 150);

  /* ── anatomy: the parts, what they do, and which of your numbers relate ── */
  const PARTS = {
    ra: ['Right atrium', 'Collects oxygen-poor blood from the body through the two venae cavae and passes it to the right ventricle. Its wall holds the sinoatrial (SA) node, the heart\'s natural pacemaker.', 'Resting heart rate is set here, by the SA node.'],
    rv: ['Right ventricle', 'Pumps blood through the pulmonary valve to the lungs. Lung pressures are low (about 25 mmHg at peak), so its wall is thin.', 'Endurance training enlarges both ventricles in step.'],
    la: ['Left atrium', 'Receives oxygen-rich blood from the lungs through four pulmonary veins. Its final squeeze, the atrial kick, adds roughly a fifth of each filling.', 'Long-standing high blood pressure makes this chamber work harder.'],
    lv: ['Left ventricle', 'The main pump. It drives blood through the aortic valve to the whole body at about 120 mmHg, so its wall is the thickest, around 1 cm.', 'Your VO2max and resting heart rate track how much blood it moves per beat.'],
    sep: ['Septum', 'The muscular wall between the left and right ventricles. The electrical signal runs down it in the bundle branches.', null],
    tv: ['Tricuspid valve', 'Three leaflets between the right atrium and right ventricle. It shuts as the ventricle contracts, making part of the first heart sound (lub).', null],
    pv: ['Pulmonary valve', 'Opens as the right ventricle ejects into the pulmonary trunk; it closes at the end of ejection, part of the second heart sound (dub).', null],
    mv: ['Mitral valve', 'Two leaflets between the left atrium and left ventricle, tethered by chordae. Its closure is the loudest part of "lub".', null],
    av: ['Aortic valve', 'Three cusps at the start of the aorta. It opens when left ventricular pressure passes aortic pressure and closes at the end of ejection, the "dub".', null],
    ao: ['Aorta', 'The body\'s main artery. It arches over the heart and runs down in front of the spine. Its stretch absorbs each beat and keeps blood moving between beats.', 'Your blood pressure is the pressure inside it.'],
    pa: ['Pulmonary trunk', 'Carries oxygen-poor blood from the right ventricle and splits into the left and right pulmonary arteries.', null],
    svc: ['Superior vena cava', 'Returns blood from the head, neck and arms to the right atrium.', null],
    ivc: ['Inferior vena cava', 'Returns blood from the abdomen and legs to the right atrium. Leg muscles squeezing the veins help it along.', null],
    pvs: ['Pulmonary veins', 'Four veins bringing freshly oxygenated blood from the lungs to the left atrium.', null],
    sa: ['Sinoatrial node', 'A cluster of pacemaker cells that fires 60 to 100 times a minute at rest. Your nervous system speeds it up or slows it down beat to beat, which is what HRV measures.', 'Heart rate and HRV.'],
    avn: ['Atrioventricular node', 'Delays the signal for about a tenth of a second so the atria finish emptying before the ventricles contract. This delay is the PR interval on an ECG.', null],
    his: ['Bundle of His and bundle branches', 'Carry the signal down the septum to both ventricles. Their speed is why the QRS complex on an ECG is narrow.', null],
    purk: ['Purkinje fibres', 'Spread the signal through the ventricle walls from the apex upward, so the ventricles squeeze from the bottom up, like wringing out a tube.', null],
    cor: ['Coronary arteries', 'The heart\'s own blood supply, running over its surface from the root of the aorta. Plaque builds in their walls over decades.', 'ApoB, Lp(a) and hs-CRP are the markers most tied to coronary plaque. See Coronary views.']
  };
  const flowPath = (d, cls) => `<path class="ht-flow ${cls}" d="${d}"/>`;
  function heartSVG(opts = {}) {
    const sel = opts.sel, k = (id) => `data-act="ht-part" data-k="${id}" class="ht-p ht-${id}${sel === id ? ' sel' : ''}"`;
    const v = (id, x1, y1, x2, y2, dir) => { // a valve: closed = a line across, open = two leaflets swung downstream
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dy = dir * 16;
      return `<g ${k(id)} tabindex="0" role="button" aria-label="${PARTS[id][0]}"><line class="ht-valve-hit" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>
        <g class="ht-vc"><line x1="${x1}" y1="${y1}" x2="${mx}" y2="${my}"/><line x1="${mx}" y1="${my}" x2="${x2}" y2="${y2}"/></g>
        <g class="ht-vo"><line x1="${x1}" y1="${y1}" x2="${x1 + (mx - x1) * 0.45}" y2="${y1 + dy}"/><line x1="${x2}" y1="${y2}" x2="${x2 - (x2 - mx) * 0.45}" y2="${y2 + dy}"/></g></g>`;
    };
    return `<svg class="ht-svg" viewBox="0 0 420 440" role="img" aria-label="Schematic of the heart: four chambers, valves, great vessels${opts.cond ? ' and conduction system' : ''}">
      <g class="ht-vessels">
        <path ${k('ivc')} d="M84 432 L84 252 C84 232 96 220 114 214 L120 228 C108 232 108 242 108 254 L108 432 Z"/>
        <path ${k('pvs')} d="M334 148 L376 138 L379 154 L338 164 Z M336 192 L378 200 L375 216 L333 208 Z"/>
      </g>
      <path class="ht-myo" d="M98 168 C96 142 116 128 150 128 L262 128 C302 124 344 136 346 176 C350 232 344 300 318 352 C296 390 268 410 246 414 C200 380 132 330 108 262 C100 236 98 200 98 168 Z"/>
      <path ${k('sep')} d="M230 240 L236 240 L248 398 L240 396 Z"/>
      <g class="ht-ch">
        <path ${k('ra')} d="M110 160 C110 140 130 134 160 134 C190 134 204 146 204 166 L204 226 L116 226 C110 214 110 190 110 160 Z"/>
        <path ${k('rv')} d="M116 240 L230 240 C232 300 236 350 240 394 C190 366 140 320 116 240 Z"/>
        <path ${k('la')} d="M264 166 C264 146 278 134 300 134 C324 134 338 148 338 172 C338 198 326 214 310 226 L266 226 C264 210 264 186 264 166 Z"/>
        <g class="ht-lvg"><path ${k('lv')} d="M236 240 L308 240 C334 262 340 312 316 350 C298 376 270 392 248 398 C244 350 240 290 236 240 Z"/></g>
      </g>
      <path ${k('ao')} d="M234 240 L234 80 C234 42 268 28 300 30 C338 32 362 54 362 94 L362 122 L340 122 L340 94 C340 68 324 54 300 54 C276 54 258 64 258 84 L258 240 Z"/>
      <path ${k('pa')} d="M206 240 L206 114 L112 114 L112 96 L350 96 L350 114 L230 114 L230 240 Z"/>
      <path ${k('svc')} d="M140 20 L166 20 L166 140 L140 140 Z"/>
      ${v('tv', 124, 233, 198, 233, 1)}${v('mv', 270, 233, 304, 233, 1)}${v('pv', 206, 204, 230, 204, -1)}${v('av', 234, 204, 258, 204, -1)}
      <path class="ht-cor-o" d="M260 214 C254 240 246 300 246 388 M260 214 C292 220 322 230 338 252 M232 214 C200 232 146 238 116 246 C106 272 120 318 150 350"/><path ${k('cor')} d="M260 214 C254 240 246 300 246 388 M260 214 C292 220 322 230 338 252 M232 214 C200 232 146 238 116 246 C106 272 120 318 150 350" fill="none"/>
      ${opts.flow ? `<g class="ht-flows" aria-hidden="true">
        ${flowPath('M153 28 L153 196', 'de')}${flowPath('M96 424 L96 252 L128 220', 'de')}${flowPath('M160 196 L162 312', 'de')}${flowPath('M184 320 L218 250 L218 105 L124 105', 'de')}${flowPath('M218 105 L340 105', 'de')}
        ${flowPath('M372 146 L300 178', 'ox')}${flowPath('M372 208 L300 190', 'ox')}${flowPath('M292 196 L288 320', 'ox')}${flowPath('M274 336 L246 250 L246 76 C246 54 270 42 300 42 C330 44 351 62 351 96 L351 118', 'ox')}</g>` : ''}
      ${opts.cond ? `<g class="ht-cond">
        <circle ${k('sa')} cx="164" cy="146" r="7"/><circle ${k('avn')} cx="212" cy="232" r="6"/>
        <path ${k('his')} d="M212 232 L233 252 M233 252 L222 330 M233 252 L242 330" fill="none"/>
        <path ${k('purk')} d="M222 330 C206 350 180 340 160 318 M242 330 C254 370 292 356 308 328 M232 330 C236 360 240 384 244 396" fill="none"/></g>` : ''}
      ${opts.labels !== false ? `<g class="ht-lbl" aria-hidden="true">
        <text x="160" y="188">RA</text><text x="170" y="292">RV</text><text x="302" y="186">LA</text><text x="282" y="300">LV</text>
        <text x="300" y="22">Aorta</text><text x="172" y="18" text-anchor="start">SVC</text><text x="60" y="424">IVC</text><text x="384" y="182" text-anchor="start">PV</text><text x="299" y="90">PA</text></g>` : ''}
    </svg>`;
  }
  function anatomy(s) {
    const p = H.sel && PARTS[H.sel];
    return `<div class="grid g-2-1 ht-anat"><section class="card ht-stage"><div class="card-h"><h2>Inside the heart</h2>
        <div class="seg" role="group" aria-label="Layers"><button aria-pressed="${H.flow}" data-act="ht-layer" data-k="flow">Blood flow</button><button aria-pressed="${H.cond}" data-act="ht-layer" data-k="cond">Conduction</button></div></div>
        ${heartSVG({ sel: H.sel, flow: H.flow, cond: H.cond })}
        <p class="ht-key small"><span><i class="ht-sw ox"></i>Oxygen-rich</span><span><i class="ht-sw de"></i>Oxygen-poor</span>${H.cond ? '<span><i class="ht-sw cond"></i>Electrical path</span>' : ''}<span class="muted">Viewed from the front: your right is on the left.</span></p></section>
      <section class="card ht-info" aria-live="polite">${p ? `<div class="card-h"><h2>${esc(p[0])}</h2><button class="btn ghost sm" data-act="ht-part" data-k="">Clear</button></div>
        <p>${esc(p[1])}</p>${p[2] ? `<p class="ht-you">${icon('myo', 16)} ${esc(p[2])}</p>` : ''}
        ${H.sel === 'cor' ? '<button class="btn sm" data-act="ht-tab" data-t="coronary">Open coronary views</button>' : ''}`
        : `<div class="card-h"><h2>Tap a part</h2></div><p class="muted">Tap any chamber, valve or vessel to see what it does. Turn on Conduction to see the electrical path that times each beat.</p>`}
        <h3 class="ht-h3">All parts</h3><div class="ht-chips">${Object.entries(PARTS).filter(([kk]) => H.cond || !['sa', 'avn', 'his', 'purk'].includes(kk)).map(([kk, v]) => `<button class="chip-btn ${H.sel === kk ? 'on' : ''}" data-act="ht-part" data-k="${kk}">${esc(v[0])}</button>`).join('')}</div>
        <a class="btn ghost sm" href="#body">${icon('body', 14)} See the real heart in 3D</a></section></div>`;
  }

  /* ── one heartbeat: a time model built from your heart rate ── */
  const ss = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const gauss = (t, c, sd, a) => a * Math.exp(-((t - c) ** 2) / (2 * sd * sd));
  function model(hr) {
    hr = clamp(hr, 40, 140);
    const C = 60000 / hr, lvet = clamp(413 - 1.7 * hr, 220, 330), mvC = 50, avO = 110, avC = avO + lvet, mvO = avC + 80;
    const aOn = C - Math.min(150, (C - mvO) * 0.45), rfE = mvO + Math.min(150, (aOn - mvO) * 0.6);
    const lvpEj = (u) => 80 + 44 * Math.sin(Math.PI * Math.pow(u, 0.75) * 0.88) * (1 - 0.2 * u), pAvc = lvpEj(1), pN = pAvc + 2;
    const S = C - (avC + 30) + avO, tau = S / Math.log((pN - 40) / 40);
    const lvv = (t) => {
      if (t < avO) return 120;
      if (t < avC) return 120 - 70 * (1 - Math.pow(1 - (t - avO) / lvet, 1.8));
      if (t < mvO) return 50;
      const pre = (x) => 50 + 55 * (1 - Math.exp(-(x - mvO) / 60)) + 3 * (x - mvO) / (aOn - mvO);
      if (t < aOn) return pre(t);
      const v0 = pre(aOn); return v0 + (120 - v0) * ss((t - aOn) / (C - aOn - 10));
    };
    const lvp = (t) => {
      if (t < mvC) return 8 + 2 * ss(t / mvC);
      if (t < avO) return 10 + 70 * ss((t - mvC) / (avO - mvC));
      if (t < avC) return lvpEj((t - avO) / lvet);
      if (t < mvO) return pAvc - (pAvc - 5) * ss((t - avC) / (mvO - avC));
      if (t < aOn) return 4 + 2 * (t - mvO) / (aOn - mvO);
      const u = (t - aOn) / (C - aOn); return 6 + 2 * u + 4 * Math.sin(Math.PI * u);
    };
    const aop = (t) => {
      if (t >= avO && t < avC) { const u = (t - avO) / lvet; return Math.max(80, lvpEj(u) - 3 * Math.sin(Math.PI * u)); }
      if (t >= avC && t < avC + 30) { const v = (t - avC) / 30; return pAvc - 7 * Math.sin(Math.PI * v) * (1 - v) + 2 * ss(v); }
      const sTime = t >= avC + 30 ? t - (avC + 30) : t + C - (avC + 30);
      return 40 + (pN - 40) * Math.exp(-sTime / tau);
    };
    const xd = avO + 0.3 * lvet;
    const lap = (t) => {
      if (t < mvC) return 6 + 1 * ss(t / mvC);
      if (t < avO) return 7 + 2.5 * Math.sin(Math.PI * (t - mvC) / (avO - mvC));
      if (t < xd) return 7 - 4 * ss((t - avO) / (xd - avO));
      if (t < mvO) return 3 + 10 * ss((t - xd) / (mvO - xd));
      if (t < rfE) return 13 - 8 * ss((t - mvO) / (rfE - mvO));
      if (t < aOn) return 5 + (t - rfE) / (aOn - rfE);
      const u = (t - aOn) / (C - aOn); return 6 + 6 * Math.sin(Math.PI * u);
    };
    const ecg = (t) => [-C, 0, C].reduce((a, o) => { const x = t + o; return a + gauss(x, C - 110, 22, 0.15) + gauss(x, 12, 5, -0.08) + gauss(x, 38, 8, 1) + gauss(x, 58, 7, -0.22) + gauss(x, avC - 70, 40, 0.28); }, 0);
    const snd = (t) => { const b = (c, w, a) => (t >= c && t < c + w ? a * Math.sin(Math.PI * (t - c) / w) : 0); return b(mvC, 70, 1) + b(avC, 45, 0.75); };
    const phases = [['as0', 0, mvC], ['ivc', mvC, avO], ['ej', avO, avC], ['ivr', avC, mvO], ['rf', mvO, rfE], ['dia', rfE, aOn], ['as', aOn, C]];
    return { hr, C, mvC, avO, avC, mvO, aOn, rfE, lvv, lvp, aop, lap, ecg, snd, phases };
  }
  const PH = {
    ivc: ['Isovolumetric contraction', 'The ventricles start to squeeze. Mitral and tricuspid valves have just shut (the "lub"), and the aortic valve is still closed, so pressure climbs fast with no change in volume.', { mv: 0, tv: 0, av: 0, pv: 0 }],
    ej: ['Ejection', 'Ventricular pressure passes aortic pressure, the aortic and pulmonary valves open, and about 70 mL leaves each ventricle.', { mv: 0, tv: 0, av: 1, pv: 1 }],
    ivr: ['Isovolumetric relaxation', 'The ventricles relax. Aortic pressure is now higher, so the aortic and pulmonary valves snap shut (the "dub"). All four valves are closed.', { mv: 0, tv: 0, av: 0, pv: 0 }],
    rf: ['Rapid filling', 'Ventricular pressure drops below atrial pressure, the mitral and tricuspid valves open and most filling happens in this short window.', { mv: 1, tv: 1, av: 0, pv: 0 }],
    dia: ['Slow filling (diastasis)', 'Blood trickles in from the veins. At faster heart rates this phase is the first to shrink.', { mv: 1, tv: 1, av: 0, pv: 0 }],
    as: ['Atrial contraction', 'The P wave fires the atria, which top up the ventricles with their last squeeze (the atrial kick).', { mv: 1, tv: 1, av: 0, pv: 0 }],
    as0: ['Atrial contraction ends', 'The QRS has started the ventricles; in a moment rising pressure shuts the mitral and tricuspid valves.', { mv: 1, tv: 1, av: 0, pv: 0 }]
  };
  const PH_SHORT = { as0: 'AC', ivc: 'IVC', ej: 'Ejection', ivr: 'IVR', rf: 'Rapid fill', dia: 'Diastasis', as: 'Atrial' };
  function wiggers(M, W = 660) {
    const L = 46, R = 92, X = (t) => L + (t / M.C) * (W - L - R), N = 240;
    const ts = Array.from({ length: N + 1 }, (_, i) => (i / N) * M.C);
    const panel = (y0, h, lo, hi) => (v) => y0 + h - ((v - lo) / (hi - lo)) * h;
    const P = panel(30, 150, 0, 140), V = panel(206, 70, 40, 130), E = panel(300, 60, -0.35, 1.1), Sd = panel(380, 34, -1.1, 1.1);
    const line = (f, Y) => ts.map((t, i) => `${i ? 'L' : 'M'}${X(t).toFixed(1)} ${Y(f(t)).toFixed(1)}`).join('');
    const end = (f, Y) => Y(f(M.C - 1));
    const labs = [['Aortic', 'ao', end(M.aop, P)], ['Left ventricle', 'lv', end(M.lvp, P)], ['Left atrium', 'la', end(M.lap, P)]].sort((a, b) => a[2] - b[2]);
    for (let i = 1; i < labs.length; i++) labs[i][2] = Math.max(labs[i][2], labs[i - 1][2] + 14);
    const band = M.phases.filter(([k]) => k !== 'as0').map(([k, a, b], i) => `<rect class="ht-ph ${i % 2 ? 'alt' : ''}" x="${X(a)}" y="22" width="${Math.max(0, X(b) - X(a))}" height="398"/><text class="ht-ph-t" x="${(X(a) + X(b)) / 2}" y="16" text-anchor="middle">${X(b) - X(a) > 34 ? PH_SHORT[k] : ''}</text>`).join('');
    const yt = (Y, vals, u) => vals.map((v) => `<line class="ht-grid" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ht-ax" x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${v}${u || ''}</text>`).join('');
    const xt = [0, 200, 400, 600, 800, 1000, 1200, 1400].filter((t) => t < M.C).map((t) => `<text class="ht-ax" x="${X(t)}" y="434" text-anchor="middle">${t}</text>`).join('');
    return `<svg class="ht-wig" viewBox="0 0 ${W} 446" role="img" aria-label="One heartbeat at ${M.hr} beats a minute: aortic, left ventricular and left atrial pressure, left ventricular volume, ECG and heart sounds over ${Math.round(M.C)} milliseconds.">
      ${band}
      <text class="ht-pn" x="${L}" y="42">Pressure (mmHg)</text>${yt(P, [0, 40, 80, 120])}
      <path class="ht-tr ao" d="${line(M.aop, P)}"/><path class="ht-tr lv" d="${line(M.lvp, P)}"/><path class="ht-tr la" d="${line(M.lap, P)}"/>
      ${labs.map(([n, c, y]) => `<line class="ht-lead ${c}" x1="${W - R + 2}" x2="${W - R + 8}" y1="${y}" y2="${y}"/><text class="ht-dl" x="${W - R + 11}" y="${y + 4}">${n}</text>`).join('')}
      <text class="ht-pn" x="${L}" y="202">LV volume (mL)</text>${yt(V, [50, 120])}<path class="ht-tr vol" d="${line(M.lvv, V)}"/>
      <text class="ht-dl" x="${W - R + 11}" y="${V(120) + 4}">End-diastolic</text><text class="ht-dl" x="${(X(M.avC) + X(M.mvO)) / 2}" y="${V(50) + 16}" text-anchor="middle">End-systolic</text>
      <text class="ht-pn" x="${L}" y="300">ECG</text><path class="ht-tr ecg" d="${line(M.ecg, E)}"/>
      <text class="ht-dl" x="${X(38) + 8}" y="${E(0.9)}" text-anchor="start">QRS</text><text class="ht-dl" x="${X(M.avC - 70)}" y="${E(0.28) - 8}" text-anchor="middle">T</text><text class="ht-dl" x="${X(M.C - 110)}" y="${E(0.15) - 8}" text-anchor="middle">P</text>
      <text class="ht-pn" x="${L}" y="380">Heart sounds</text><path class="ht-snd" d="${line(M.snd, Sd)}${ts.slice().reverse().map((t) => `L${X(t).toFixed(1)} ${Sd(-M.snd(t)).toFixed(1)}`).join("")}Z"/>
      <text class="ht-dl" x="${X(M.mvC + 35)}" y="${Sd(-1.1) + 12}" text-anchor="middle">S1 lub</text><text class="ht-dl" x="${X(M.avC + 22)}" y="${Sd(-1.1) + 12}" text-anchor="middle">S2 dub</text>
      ${xt}<text class="ht-ax" x="${W - R}" y="434" text-anchor="end">ms</text>
      <line class="ht-cur" id="ht-cur" x1="${L}" x2="${L}" y1="22" y2="420"/>
    </svg>`;
  }
  function cycle(s) {
    const M = model(hrOf(s)), sv = 70, ef = Math.round((70 / 120) * 100), co = (sv * M.hr / 1000).toFixed(1);
    return `<div class="grid g-2-1 ht-cyc"><section class="card"><div class="card-h"><div><h2>One heartbeat at ${M.hr} bpm</h2><span class="muted small">Your resting heart rate · ${Math.round(M.C)} ms per beat</span></div>
        <div class="ht-ctl"><button class="btn sm" data-act="ht-play">${H.play ? icon('pause', 14) + ' Pause' : icon('play', 14) + ' Play'}</button>
        <div class="seg" role="group" aria-label="Speed"><button aria-pressed="${!H.slow}" data-act="ht-slow" data-v="0">Real time</button><button aria-pressed="${H.slow}" data-act="ht-slow" data-v="1">Slow ×4</button></div>
        <button class="btn ghost sm" data-act="ht-sound" aria-pressed="${H.sound}">${icon('speaker', 14)} ${H.sound ? 'Sound on' : 'Sound off'}</button></div></div>
        <div class="ht-legend small" aria-hidden="true"><span><i class="ht-sw ao"></i>Aortic pressure</span><span><i class="ht-sw lv"></i>Left ventricle</span><span><i class="ht-sw la"></i>Left atrium</span></div>
        <div class="ht-wig-wrap">${wiggers(M)}</div>
        <p class="fine">A textbook model scaled to your heart rate (Wiggers diagram). Ejection time follows Weissler's formula; the pressures and volumes are typical adult values, not measurements of you. Sound is synthesised.</p></section>
      <section class="card ht-now" aria-live="polite"><div class="ht-mini">${heartSVG({ flow: false, cond: false, labels: true })}</div>
        <h3 id="ht-ph-n">${PH.ivc[0]}</h3><p class="small" id="ht-ph-d">${PH.ivc[1]}</p>
        <ul class="ht-valves" id="ht-valves">${['mv', 'av', 'tv', 'pv'].map((v) => `<li data-v="${v}"><span>${PARTS[v][0]}</span><b>closed</b></li>`).join('')}</ul>
        <div class="ht-nums"><div><span>Stroke volume</span><b class="num">${sv}</b><em>mL</em></div><div><span>Ejection fraction</span><b class="num">${ef}</b><em>%</em></div><div><span>Output at ${M.hr} bpm</span><b class="num">${co}</b><em>L/min</em></div></div></section></div>`;
  }

  /* ── rhythm: an ECG strip from your heart rate and HRV ── */
  function strip(s) {
    const hr = hrOf(s), hrv = clamp((s.vitals && s.vitals.hrv) || 50, 10, 150), br = H.breath, rr0 = 60 / hr, Tb = 60 / br;
    const A = (clamp(hrv, 10, 150) * 2 * (Tb / 10) / (rr0 / 1.1)) / 1000 / (1 + ((br - 6) / 4) ** 2); // sized so slow breathing reproduces your own RMSSD
    const beats = []; let t = 0.35;
    while (t < 10.2) { beats.push(t); t += rr0 - A * Math.sin((2 * Math.PI * t) / Tb); }
    const rrs = beats.slice(1).map((b, i) => (b - beats[i]) * 1000), rmssd = Math.sqrt(rrs.slice(1).reduce((a, r, i) => a + (r - rrs[i]) ** 2, 0) / Math.max(1, rrs.length - 1));
    const W = 1000, PX = 100, Y0 = 150, MV = 40; // 100 px per second, 40 px per millivolt
    const qt = (rr) => 0.4 * Math.sqrt(rr);
    const wave = (x) => beats.reduce((a, b, i) => { const rr = (beats[i + 1] || b + rr0) - b, q = b, d = x - q; if (d < -0.3 || d > 0.7) return a; return a + gauss(d, -0.12, 0.022, 0.15) + gauss(d, 0.012, 0.006, -0.1) + gauss(d, 0.04, 0.01, 1.1) + gauss(d, 0.066, 0.009, -0.28) + gauss(d, qt(rr) - 0.11, 0.045, 0.3); }, 0);
    const N = 2000, pts = Array.from({ length: N + 1 }, (_, i) => { const x = (i / N) * 10; return `${i ? 'L' : 'M'}${(x * PX).toFixed(1)} ${(Y0 - wave(x) * MV).toFixed(1)}`; }).join('');
    const grid = [];
    for (let x = 0; x <= W; x += 4) grid.push(`<line class="${x % 20 ? 'ht-eg' : 'ht-eG'}" x1="${x}" x2="${x}" y1="40" y2="220"/>`);
    for (let y = 40; y <= 220; y += 4) grid.push(`<line class="${(y - 40) % 20 ? 'ht-eg' : 'ht-eG'}" x1="0" x2="${W}" y1="${y}" y2="${y}"/>`);
    const b1 = beats[1], rr1 = beats[2] - beats[1], X = (sec) => sec * PX, br2 = (x1, x2, y, lab) => `<path class="ht-br" d="M${X(x1)} ${y + 5}V${y}H${X(x2)}V${y + 5}"/><text class="ht-brt" x="${(X(x1) + X(x2)) / 2}" y="${y - 4}" text-anchor="middle">${lab}</text>`;
    const breath = Array.from({ length: 201 }, (_, i) => { const x = (i / 200) * 10; return `${i ? 'L' : 'M'}${(x * PX).toFixed(1)} ${(22 - 10 * Math.sin((2 * Math.PI * x) / Tb)).toFixed(1)}`; }).join('');
    return { hr, rmssd, rrs, svg: `<svg class="ht-ecg" viewBox="0 0 ${W} 232" role="img" aria-label="Ten-second ECG strip at about ${hr} beats a minute with ${br} breaths a minute; beat-to-beat variation ${Math.round(rmssd)} ms.">
      <path class="ht-breath" d="${breath}"/><text class="ht-brt" x="6" y="10" text-anchor="start">Breathing: in ↑ out ↓</text>
      <g>${grid.join('')}</g><path class="ht-tr ecg" d="${pts}"/>
      ${br2(b1 - 0.12 - 0.045, b1 + 0.0, 196, 'PR')}${br2(b1 - 0.002, b1 + 0.085, 210, 'QRS')}${br2(b1 - 0.002, b1 + qt(rr1) + 0.02, 70, 'QT')}${br2(b1 + 0.04, beats[2] + 0.04, 52, `RR ${Math.round(rr1 * 1000)} ms`)}
      <text class="ht-brt" x="${X(b1 - 0.12)}" y="${Y0 - 0.15 * MV - 10}" text-anchor="middle">P</text><text class="ht-brt" x="${X(b1 + 0.04)}" y="${Y0 - 1.1 * MV - 6}" text-anchor="middle">R</text><text class="ht-brt" x="${X(b1 + qt(rr1) - 0.11)}" y="${Y0 - 0.3 * MV - 10}" text-anchor="middle">T</text>
    </svg>` };
  }
  function rhythm(s) {
    const S = strip(s);
    return `<section class="card"><div class="card-h"><div><h2>Your rhythm, drawn as an ECG</h2><span class="muted small">Built from your resting heart rate and HRV · 25 mm/s · 10 mm/mV</span></div></div>
        <div class="ht-ecg-wrap">${S.svg}</div>
        <div class="ht-br-ctl"><label for="ht-br">Breathing rate <b class="num" id="ht-br-v">${H.breath}</b> breaths a minute</label><input id="ht-br" type="range" min="4" max="16" step="1" value="${H.breath}">
          <div class="ht-nums"><div><span>Average heart rate</span><b class="num">${S.hr}</b><em>bpm</em></div><div><span>Beat-to-beat variation (RMSSD)</span><b class="num" id="ht-rmssd">${Math.round(S.rmssd)}</b><em>ms</em></div></div></div>
        <p class="small">Heart rate rises a little as you breathe in and falls as you breathe out (respiratory sinus arrhythmia). Slide the breathing rate toward 6 a minute: the variation grows, which is why slow breathing is used to raise HRV.</p>
        <p class="fine">Simulated from your numbers to teach how an ECG reads. Myo does not read or interpret ECGs. If a watch or strap flags an irregular rhythm, or you have palpitations with dizziness, chest pain or fainting, see a clinician.</p></section>
      <div class="grid g-3 ht-waves">${[['P wave', 'The atria fire. Normally under 120 ms.'], ['PR interval', 'From atria to ventricles, held back by the AV node: 120 to 200 ms.'], ['QRS complex', 'The ventricles fire. Narrow, under 120 ms, because the bundle branches are fast.'], ['ST segment and T wave', 'The ventricles reset (repolarise) ready for the next beat.'], ['QT interval', 'All of ventricular firing and resetting. It shortens as heart rate rises.'], ['RR interval', 'Time between beats. Its beat-to-beat change is HRV.']].map(([n, d]) => `<section class="card"><h3>${n}</h3><p class="small">${d}</p></section>`).join('')}</div>`;
  }

  /* ── coronary views: a 3D tree on a heart-shaped surface, projected like a C-arm ── */
  const v3 = { add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; } };
  // patient axes: x = patient's left, y = anterior, z = head. Long axis from base to apex points left, forward and down.
  const LAX = v3.norm([0.58, 0.58, -0.57]), E1 = v3.norm(v3.sub([0, 1, 0], v3.mul(LAX, LAX[1]))), E2 = v3.norm(v3.cross(LAX, E1));
  const LEN = 9, R0 = 4.6, rad = (f) => (f <= 0 ? R0 * (1 + f * 0.6) : f >= 1 ? 0 : R0 * Math.pow(1 - f, 0.55) * (1 + 0.25 * f));
  const surf = (f, th, rf = 1.03) => { const a = (th * Math.PI) / 180, r = rad(f) * rf; return v3.add(v3.mul(LAX, f * LEN), v3.add(v3.mul(E1, Math.cos(a) * r), v3.mul(E2, Math.sin(a) * r))); };
  function tree(dom) {
    const V = [];
    const add = (k, name, sys, pts, r0, r1, main) => V.push({ k, name, sys, pts, r0, r1, main });
    add('lm', 'Left main', 'L', [[-0.14, 40, 0.42], [-0.06, 44, 0.8], [0, 45, 1.03]], 4.6, 4.3, true);
    add('lad', 'LAD', 'L', [[0, 45, 1.03], [0.06, 28], [0.18, 16], [0.4, 12], [0.6, 10], [0.8, 8], [0.95, 4, 1.08]], 3.8, 1.4, true);
    add('d1', 'Diagonal 1', 'L', [[0.22, 15], [0.32, 38], [0.45, 58], [0.56, 68]], 2.2, 1.1);
    add('d2', 'Diagonal 2', 'L', [[0.46, 11], [0.56, 34], [0.68, 50], [0.77, 58]], 1.8, 1.0);
    [0.18, 0.32, 0.47].forEach((f, i) => add('sp' + i, 'Septal', 'L', [[f, 14], [f + 0.08, 0, 0.86], [f + 0.18, -14, 0.7]], 1.4, 0.7));
    const cxEnd = dom === 'left' ? 180 : dom === 'co' ? 168 : 148;
    add('lcx', 'Circumflex', 'L', [[0, 45, 1.03], [0.02, 70], [0.03, 100], [0.04, 128], ...(cxEnd > 150 ? [[0.05, 155], [0.05, cxEnd]] : [[0.05, cxEnd]])], 3.6, dom === 'left' ? 2.6 : 2.0, true);
    add('om1', 'Obtuse marginal 1', 'L', [[0.025, 84], [0.2, 88], [0.4, 93], [0.6, 97], [0.72, 99]], 2.2, 1.1);
    add('om2', 'Obtuse marginal 2', 'L', [[0.04, 118], [0.22, 121], [0.42, 125], [0.62, 128]], 1.9, 1.0);
    const rEnd = dom === 'left' ? -125 : -180;
    add('rca', 'RCA', 'R', [[-0.14, -25, 0.42], [-0.05, -30, 0.85], [0, -40], [0.02, -70], [0.04, -100], ...(dom === 'left' ? [[0.05, rEnd]] : [[0.05, -130], [0.05, -160], [0.05, -180]])], 4.2, dom === 'left' ? 1.6 : 2.6, true);
    add('conus', 'Conus branch', 'R', [[-0.04, -32], [0.06, -20], [0.14, -10]], 1.2, 0.7);
    add('san', 'SA nodal', 'R', [[-0.04, -34], [-0.1, -55, 1.0], [-0.2, -72, 0.95]], 1.0, 0.7);
    add('am', 'Acute marginal', 'R', [[0.04, -100], [0.2, -101], [0.4, -105], [0.6, -108]], 1.8, 1.0);
    const pdaSys = dom === 'left' ? 'L' : 'R';
    add('pda', 'PDA', pdaSys, [[0.05, -180], [0.2, -181], [0.4, -183], [0.6, -185], [0.82, -186]], 2.4, 1.1, true);
    if (dom !== 'left') add('plv', 'Posterolateral', dom === 'co' ? 'L' : 'R', dom === 'co' ? [[0.05, 168], [0.12, 160], [0.24, 154], [0.38, 150]] : [[0.05, -180], [0.08, -195], [0.2, -203], [0.35, -208]], 2.0, 1.1);
    // sample each vessel smoothly (Catmull-Rom through the control points)
    V.forEach((v) => {
      const P = v.pts.map((p) => [p[0], p[1], p[2] == null ? 1.03 : p[2]]), out = [];
      for (let i = 0; i < P.length - 1; i++) {
        const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
        for (let s = 0; s < 10; s++) { const t = s / 10, t2 = t * t, t3 = t2 * t; out.push([0, 1, 2].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3))); }
      }
      out.push(P[P.length - 1]);
      v.xyz = out.map((p) => surf(p[0], p[1], p[2]));
    });
    return V;
  }
  function viewBasis(alpha, beta) {
    const a = (alpha * Math.PI) / 180, b = (beta * Math.PI) / 180, D = [Math.sin(a) * Math.cos(b), Math.cos(a) * Math.cos(b), Math.sin(b)];
    const up = v3.norm(v3.sub([0, 0, 1], v3.mul(D, D[2]))), right = v3.cross(up, v3.mul(D, -1));
    return { D, up, right };
  }
  const angLabel = (a, b) => `${a === 0 ? 'AP' : a < 0 ? `RAO ${-a}°` : `LAO ${a}°`}${b === 0 ? '' : b > 0 ? ` · CRA ${b}°` : ` · CAU ${-b}°`}`;
  const PRESETS = {
    left: [['Spider', 45, -35, 'Left main bifurcation and proximal circumflex'], ['RAO caudal', -30, -30, 'Circumflex and obtuse marginals, proximal LAD'], ['AP caudal', -10, -30, 'Left main and proximal circumflex'], ['AP cranial', -10, 40, 'Mid and distal LAD, diagonals'], ['LAO cranial', 40, 35, 'LAD and diagonal origins, septals'], ['RAO cranial', -30, 30, 'Mid and distal LAD'], ['Lateral', 90, 0, 'Mid LAD and circumflex'], ['AP', 0, 0, 'Overview']],
    right: [['LAO', 50, 0, 'Proximal and mid RCA, its C-shaped course'], ['RAO', -30, 0, 'Mid RCA and the length of the PDA'], ['AP', 0, 0, 'Overview'], ['AP cranial', 0, 30, 'Crux, PDA and posterolateral branches'], ['LAO cranial', 40, 30, 'PDA origin at the crux']]
  };
  const SEGS = [['lm', 'Left main', 0, 1], ['lad', 'Proximal LAD', 0, 0.35], ['lad', 'Mid LAD', 0.35, 0.7], ['lad', 'Distal LAD', 0.7, 1], ['lcx', 'Circumflex', 0, 1], ['om1', 'Obtuse marginal 1', 0, 1], ['rca', 'Proximal RCA', 0, 0.35], ['rca', 'Mid RCA', 0.35, 0.7], ['rca', 'Distal RCA', 0.7, 1], ['pda', 'PDA', 0, 1]];
  function foreshort(V, B) {
    const by = Object.fromEntries(V.map((v) => [v.k, v]));
    return SEGS.map(([k, name, a, b]) => {
      const v = by[k]; if (!v) return null;
      const pts = v.xyz, i0 = Math.floor(a * (pts.length - 1)), i1 = Math.ceil(b * (pts.length - 1)); let L3 = 0, L2 = 0;
      for (let i = i0; i < i1; i++) { const d = v3.sub(pts[i + 1], pts[i]); L3 += Math.hypot(d[0], d[1], d[2]); L2 += Math.hypot(v3.dot(d, B.right), v3.dot(d, B.up)); }
      return { k, name, sys: v.sys, r: L3 ? L2 / L3 : 1 };
    }).filter(Boolean);
  }
  function drawCor(cv) {
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth || 600, h = Math.round(w * 0.78);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + 'px';
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(cv), col = (n, d) => (css.getPropertyValue(n) || d).trim() || d;
    const fluoro = H.look === 'fluoro', B = viewBasis(H.alpha, H.beta), V = tree(H.dom);
    const centre = surf(0.3, 20, 0), sc = Math.min(w, h) / 14, cx = w / 2, cy = h / 2;
    const P = (p) => { const q = v3.sub(p, centre), dep = v3.dot(q, B.D), k = 1 / (1 - dep / 60); return [cx + v3.dot(q, B.right) * sc * k, cy - v3.dot(q, B.up) * sc * k, dep, k]; };
    g.fillStyle = fluoro ? '#b9bcc0' : col('--ht-cor-bg', '#0b1530'); g.fillRect(0, 0, w, h);
    if (fluoro) { const gr = g.createRadialGradient(cx, cy, h * 0.1, cx, cy, h * 0.75); gr.addColorStop(0, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0.35)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    // spine: a column behind the heart, so the projection has an anchor
    const spine = []; for (let z = -16; z <= 10; z += 2.2) spine.push(P([-0.6, -8.5, z]));
    g.strokeStyle = fluoro ? 'rgba(60,62,66,0.28)' : 'rgba(150,170,210,0.16)'; g.lineWidth = sc * 2.6; g.lineCap = 'butt'; g.beginPath(); spine.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
    g.strokeStyle = fluoro ? 'rgba(70,72,76,0.32)' : 'rgba(150,170,210,0.22)'; g.lineWidth = 1.5;
    spine.forEach((p, i) => { if (!i) return; const q = spine[i - 1], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, dx = p[0] - q[0], dy = p[1] - q[1], L = Math.hypot(dx, dy) || 1; g.beginPath(); g.moveTo(mx - (dy / L) * sc * 1.3, my + (dx / L) * sc * 1.3); g.lineTo(mx + (dy / L) * sc * 1.3, my - (dx / L) * sc * 1.3); g.stroke(); });
    // heart silhouette: convex hull of the surface
    const sp = []; for (let f = -0.1; f <= 1.001; f += 0.05) for (let t = 0; t < 360; t += 15) sp.push(P(surf(f, t, 1)));
    const hull = convexHull(sp.map((p) => [p[0], p[1]]));
    g.fillStyle = fluoro ? 'rgba(40,40,46,0.10)' : col('--ht-cor-heart', 'rgba(110,140,220,0.16)'); g.beginPath(); hull.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill();
    // aorta and catheter
    const root = surf(-0.16, 5, 0.2), asc = v3.add(root, [-0.3, 0.6, 5]), arch = v3.add(asc, [1.8, -2.0, 1.4]), desc = v3.add(arch, [1.2, -1.5, -1.6]), low = v3.add(desc, [0, -0.5, -16]);
    const aoPts = [root, asc, arch, desc, low].map(P);
    g.strokeStyle = fluoro ? 'rgba(40,40,46,0.10)' : 'rgba(120,150,220,0.12)'; g.lineWidth = sc * 2.6; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); aoPts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
    if (H.sys !== 'both') {
      const ost = H.sys === 'left' ? surf(-0.14, 40, 0.42) : surf(-0.14, -25, 0.42), cath = [low, desc, arch, asc, v3.add(root, [0, 0, 0.6]), ost].map(P);
      g.strokeStyle = fluoro ? 'rgba(25,25,30,0.75)' : col('--muted', '#8aa'); g.lineWidth = 2.2; g.beginPath(); cath.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
    }
    // vessels, far segments first
    const show = V.filter((v) => H.sys === 'both' || (H.sys === 'left' ? v.sys === 'L' : v.sys === 'R'));
    const segs = [];
    show.forEach((v) => { const pp = v.xyz.map(P), n = pp.length; for (let i = 0; i < n - 1; i++) { const u = i / (n - 1), r = v.r0 + (v.r1 - v.r0) * u; segs.push({ a: pp[i], b: pp[i + 1], d: (pp[i][2] + pp[i + 1][2]) / 2, r, sys: v.sys, k: v.k }); } });
    segs.sort((x, y) => x.d - y.d);
    const cL = col('--ht-c1', '#3987e5'), cR = col('--ht-c2', '#d95926');
    segs.forEach((s) => {
      const wpx = Math.max(1.2, (s.r / 10) * sc * 1.25 * s.a[3]);
      g.lineWidth = wpx; g.lineCap = 'round';
      g.strokeStyle = fluoro ? `rgba(18,18,22,${clamp(0.55 + s.d / 30, 0.35, 0.92).toFixed(2)})` : s.sys === 'L' ? cL : cR;
      g.globalAlpha = fluoro ? 1 : clamp(0.72 + s.d / 20, 0.45, 1);
      g.beginPath(); g.moveTo(s.a[0], s.a[1]); g.lineTo(s.b[0], s.b[1]); g.stroke(); g.globalAlpha = 1;
    });
    // foreshortened stretches: a dashed halo where under 45% of the true length shows
    const FS = foreshort(show, B);
    if (H.fs) {
      const by = Object.fromEntries(show.map((v) => [v.k, v]));
      g.setLineDash([4, 4]); g.lineWidth = 1.6; g.strokeStyle = fluoro ? '#9a1d1d' : col('--warn', '#c98a04');
      FS.filter((x) => x.r < 0.45).forEach((x) => { const seg = SEGS.find((q) => q[1] === x.name), v = by[seg[0]], n = v.xyz.length, i0 = Math.floor(seg[2] * (n - 1)), i1 = Math.ceil(seg[3] * (n - 1)), pp = v.xyz.slice(i0, i1 + 1).map(P), m = pp[Math.floor(pp.length / 2)]; g.beginPath(); g.arc(m[0], m[1], Math.max(9, sc * 0.9), 0, Math.PI * 2); g.stroke(); });
      g.setLineDash([]);
    }
    if (H.labels) {
      g.font = '600 12px Inter, system-ui, sans-serif'; g.textBaseline = 'middle';
      const placed = [];
      show.filter((v) => v.name !== 'Septal' || v.k === 'sp1').forEach((v) => {
        const m = P(v.xyz[Math.floor(v.xyz.length * (v.main ? 0.55 : 0.85))]); let x = m[0] + 10, y = m[1];
        for (let i = 0; i < 8 && placed.some((q) => Math.abs(q[0] - x) < 70 && Math.abs(q[1] - y) < 14); i++) y += 14;
        placed.push([x, y]);
        const txt = v.name, tw = g.measureText(txt).width;
        g.fillStyle = fluoro ? 'rgba(255,255,255,0.78)' : 'rgba(5,10,30,0.72)'; g.fillRect(x - 3, y - 9, tw + 6, 18);
        g.fillStyle = fluoro ? '#111' : '#eef3ff'; g.fillText(txt, x, y);
      });
    }
    g.font = '600 13px JetBrains Mono, ui-monospace, monospace'; g.textBaseline = 'top'; g.fillStyle = fluoro ? '#111' : '#eef3ff'; g.fillText(angLabel(H.alpha, H.beta), 12, 10);
    g.font = '11px Inter, system-ui, sans-serif'; g.fillText(H.sys === 'both' ? 'Both systems' : H.sys === 'left' ? 'Left coronary injection' : 'Right coronary injection', 12, 28);
    const R2 = 26, ox = w - R2 - 14, oy = h - R2 - 14; // orientation: R/L and head arrows for this view
    g.strokeStyle = fluoro ? '#222' : '#cfe0ff'; g.fillStyle = g.strokeStyle; g.lineWidth = 1.5;
    [[[1, 0, 0], 'L'], [[-1, 0, 0], 'R'], [[0, 0, 1], 'H'], [[0, 1, 0], 'A']].forEach(([d, l]) => { const x = v3.dot(d, B.right), y = v3.dot(d, B.up); if (Math.hypot(x, y) < 0.2) return; g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + x * R2, oy - y * R2); g.stroke(); g.textBaseline = 'middle'; g.fillText(l, ox + x * (R2 + 8) - 3, oy - y * (R2 + 8)); });
    return FS;
  }
  function convexHull(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (const q of p.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  function carm() { // a top-down and side view of where the detector sits
    const a = (H.alpha * Math.PI) / 180, b = (H.beta * Math.PI) / 180;
    return `<svg class="ht-carm" viewBox="0 0 220 96" role="img" aria-label="Detector at ${angLabel(H.alpha, H.beta)}">
      <g transform="translate(52 50)"><ellipse rx="30" ry="20" class="ht-pt"/><text y="34" text-anchor="middle" class="ht-ax">From the feet</text><text x="-38" y="4" class="ht-ax" text-anchor="middle">R</text><text x="38" y="4" class="ht-ax" text-anchor="middle">L</text>
        <line x1="0" y1="0" x2="${(Math.sin(a) * 40).toFixed(1)}" y2="${(-Math.cos(a) * 40).toFixed(1)}" class="ht-beam"/><rect x="-9" y="-4" width="18" height="8" class="ht-det" transform="translate(${(Math.sin(a) * 40).toFixed(1)} ${(-Math.cos(a) * 40).toFixed(1)}) rotate(${H.alpha})"/></g>
      <g transform="translate(160 50)"><ellipse rx="34" ry="11" class="ht-pt"/><text y="34" text-anchor="middle" class="ht-ax">From the side</text><text x="-44" y="4" class="ht-ax" text-anchor="middle">Feet</text><text x="45" y="4" class="ht-ax" text-anchor="middle">Head</text>
        <line x1="0" y1="0" x2="${(Math.sin(b) * 40).toFixed(1)}" y2="${(-Math.cos(b) * 40).toFixed(1)}" class="ht-beam"/><rect x="-9" y="-4" width="18" height="8" class="ht-det" transform="translate(${(Math.sin(b) * 40).toFixed(1)} ${(-Math.cos(b) * 40).toFixed(1)}) rotate(${H.beta})"/></g></svg>`;
  }
  function fsTable(FS) {
    const rows = (FS || []).map((x) => `<tr><th scope="row">${esc(x.name)}</th><td class="num">${Math.round(x.r * 100)}%</td><td>${x.r >= 0.8 ? pill('good', 'Well laid out') : x.r >= 0.45 ? pill('muted', 'Partly shortened') : pill('warn', 'Foreshortened')}</td></tr>`).join('');
    return `<table class="tbl compact ht-fs"><caption class="sr">How much of each segment's true length this view shows</caption><thead><tr><th scope="col">Segment</th><th scope="col">Length shown</th><th scope="col">In this view</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  function coronary() {
    const B = viewBasis(H.alpha, H.beta), V = tree(H.dom).filter((v) => H.sys === 'both' || (H.sys === 'left' ? v.sys === 'L' : v.sys === 'R')), FS = foreshort(V, B);
    const seg = (act, cur, opts, label) => `<div class="seg" role="group" aria-label="${label}">${opts.map(([k, l]) => `<button aria-pressed="${cur === k}" data-act="${act}" data-v="${k}">${l}</button>`).join('')}</div>`;
    const pre = PRESETS[H.sys === 'right' ? 'right' : 'left'];
    return `<div class="grid g-2-1 ht-corv"><section class="card"><div class="card-h"><div><h2>Coronary views</h2><span class="muted small">How each C-arm angle lays out the arteries · drag the image to turn it</span></div>
        <div class="ht-ctl">${seg('ht-sys', H.sys, [['left', 'Left'], ['right', 'Right'], ['both', 'Both']], 'Coronary system')}${seg('ht-look', H.look, [['fluoro', 'Fluoro'], ['color', 'Colour']], 'Look')}</div></div>
        ${H.look === 'color' && H.sys === 'both' ? '<p class="ht-legend small" aria-hidden="true"><span><i class="ht-sw ao"></i>Left coronary system</span><span><i class="ht-sw lv"></i>Right coronary system</span></p>' : ''}
        <canvas id="ht-cor-cv" class="ht-cor-cv" role="img" aria-label="Coronary arteries projected at ${angLabel(H.alpha, H.beta)}. The table lists how much of each segment shows."></canvas>
        <div class="ht-sliders">
          <label>Rotation <b class="num" id="ht-a-v">${H.alpha === 0 ? 'AP' : H.alpha < 0 ? 'RAO ' + -H.alpha + '°' : 'LAO ' + H.alpha + '°'}</b><input type="range" id="ht-a" min="-90" max="90" step="5" value="${H.alpha}"><span class="ht-ends"><span>RAO 90</span><span>AP</span><span>LAO 90</span></span></label>
          <label>Angulation <b class="num" id="ht-b-v">${H.beta === 0 ? '0°' : H.beta < 0 ? 'CAU ' + -H.beta + '°' : 'CRA ' + H.beta + '°'}</b><input type="range" id="ht-b" min="-45" max="45" step="5" value="${H.beta}"><span class="ht-ends"><span>CAU 45</span><span>0</span><span>CRA 45</span></span></label></div>
        <div class="ht-tog"><label class="ped-use tested"><input type="checkbox" data-change="ht-labels" ${H.labels ? 'checked' : ''}> Labels</label><label class="ped-use tested"><input type="checkbox" data-change="ht-fs" ${H.fs ? 'checked' : ''}> Circle foreshortened segments</label>
          <span class="lbl">Dominance</span>${seg('ht-dom', H.dom, [['right', 'Right'], ['left', 'Left'], ['co', 'Co']], 'Dominance')}</div></section>
      <section class="card"><div class="card-h"><h2>Standard views</h2><span class="muted small">${H.sys === 'right' ? 'Right coronary' : H.sys === 'both' ? 'Left coronary views shown' : 'Left coronary'}</span></div>
        <div class="ht-presets">${pre.map(([n, a, b, why]) => `<button class="ht-pre ${H.alpha === a && H.beta === b ? 'on' : ''}" data-act="ht-pre" data-a="${a}" data-b="${b}"><b>${n}</b><span class="num">${angLabel(a, b)}</span><em>${esc(why)}</em></button>`).join('')}</div>
        ${carm()}
        <div id="ht-fs-t">${fsTable(FS)}</div>
        <p class="fine">A schematic tree on a heart-shaped surface, for learning how angles change what shows. Real anatomy varies widely; this is not a planning tool and Myo does not read angiograms. You can open your own angiogram cine on the Imaging page.</p></section></div>`;
  }

  /* ── your heart: the numbers you hold ── */
  function you(s, sc) {
    const vt = s.vitals || {}, L = OS.longevity ? OS.longevity.summary(s, sc) : {}, bp = s.enhance && s.enhance.labs ? [s.enhance.labs.sbp, s.enhance.labs.dbp] : [null, null];
    const tile = (label, v, unit, st, sub) => `<div class="ht-tile"><span>${label}</span><b class="num">${v == null ? '—' : v}</b><em>${unit}</em>${st ? pill(st[0], st[1]) : ''}${sub ? `<small>${sub}</small>` : ''}</div>`;
    const mk = ['apob', 'ldl', 'lpa', 'hdl', 'tg', 'crp', 'a1c', 'hcy'].map((id) => s.markers.find((m) => m.id === id)).filter(Boolean);
    const rows = mk.map((m) => { const e = OS.markerEval(m); return `<tr><th scope="row">${esc(m.name)}</th><td class="num">${OS.hasValue(m) ? esc(m.value) : '—'} <span class="muted small">${esc(m.unit)}</span></td><td>${pill(e.status, e.label)}</td><td class="small muted">${esc(OS.ui.fmtR(m.optimal || []))}</td></tr>`; }).join('');
    const bpOk = bp[0] && bp[1], bpSt = !bpOk ? null : bp[0] >= 180 || bp[1] >= 120 ? ['bad', 'Very high: see below'] : bp[0] >= 130 || bp[1] >= 80 ? ['warn', 'Above 130/80'] : bp[0] < 120 && bp[1] < 80 ? ['good', 'Under 120/80'] : ['warn', 'Elevated'];
    return `<div class="ht-tiles">
        ${tile('Resting heart rate', vt.rhr, 'bpm', vt.rhr == null ? null : vt.rhr <= (vt.rhrBase || vt.rhr) ? ['good', 'At or below your base'] : ['warn', 'Above your base'], vt.rhrBase ? `Your base ${vt.rhrBase}` : '')}
        ${tile('HRV', vt.hrv, 'ms', vt.hrv == null ? null : vt.hrv >= (vt.hrvBase || 0) ? ['good', 'Above your base'] : ['warn', 'Below your base'], vt.hrvBase ? `Your base ${vt.hrvBase}` : '')}
        ${tile('Blood pressure', bpOk ? `${bp[0]}/${bp[1]}` : null, 'mmHg', bpSt, bpOk ? '' : 'Add it on Enhance or with a Bluetooth cuff')}
        ${tile('VO2max', L.vo2 && L.vo2.v ? L.vo2.v.toFixed(1) : null, 'mL/kg/min', null, L.vo2 ? esc(L.vo2.src || '') : '')}
        ${tile('Cardio fitness pillar', L.pillars && L.pillars.cardio != null ? L.pillars.cardio : null, '/ 100', null, 'From Longevity')}</div>
      ${bpSt && bpSt[0] === 'bad' ? '<div class="banner bad" role="alert"><b>Blood pressure this high needs checking today.</b> Re-measure after 5 minutes seated. If it stays at or above 180/120, or you have chest pain, shortness of breath, weakness, vision or speech changes, call your local emergency number.</div>' : ''}
      <div class="grid g-2"><section class="card"><div class="card-h"><h2>Markers tied to the arteries</h2><a class="btn ghost sm" href="#biology">Biology</a></div>
        <div class="tbl-wrap"><table class="tbl compact"><caption class="sr">Your heart-related lab markers</caption><thead><tr><th scope="col">Marker</th><th scope="col">Yours</th><th scope="col">Status</th><th scope="col">Optimal</th></tr></thead><tbody>${rows}</tbody></table></div>
        <p class="fine">ApoB counts the particles that lodge in artery walls; Lp(a) is mostly inherited and worth knowing once; hs-CRP reflects inflammation. A coronary calcium scan is one way clinicians look for plaque directly; ask your doctor whether it fits you.</p></section>
      <section class="card"><div class="card-h"><h2>Check it live</h2></div>
        <p>Measure your pulse with your phone's camera, listen to your heart sounds, or stream a Bluetooth chest strap with beat-by-beat HRV.</p>
        <a class="btn sm" href="#stream">${icon('stream', 14)} Open live sensors</a> <a class="btn ghost sm" href="#logbook">${icon('logbook', 14)} Log a symptom</a>
        <h3 class="ht-h3">Get help now for</h3><ul class="ht-red small"><li>Chest pain, pressure or tightness, especially with sweating, nausea or pain spreading to the arm, jaw or back</li><li>Fainting, or a racing or very slow heartbeat with dizziness</li><li>Sudden shortness of breath</li><li>Face drooping, arm weakness or slurred speech</li></ul>
        <p class="small"><b>Call your local emergency number</b> (911 in the US). Don't drive yourself.</p></section></div>`;
  }

  /* ── page ── */
  OS.register('heart', {
    title: 'Heart', icon: 'heart',
    render(s, sc) {
      const body = { anatomy, cycle, rhythm, coronary, you }[H.tab](s, sc);
      return `${OS.ui.head('Cardiovascular · anatomy to your numbers', 'Heart', 'How your heart is built, how one beat works, how its rhythm reads, how cardiologists see the coronary arteries, and the numbers that matter for yours.')}
        <div class="seg kt-tabs" role="tablist" aria-label="Heart">${TABS.map(([k, l]) => `<button role="tab" aria-selected="${H.tab === k}" data-act="ht-tab" data-t="${k}">${l}</button>`).join('')}</div>
        <div class="ht">${body}</div>`;
    },
    mount(root, s) {
      const stops = [];
      if (H.tab === 'cycle') stops.push(mountCycle(root, s));
      if (H.tab === 'rhythm') {
        const r = root.querySelector('#ht-br');
        const on = () => { H.breath = +r.value; const S = strip(s), w = root.querySelector('.ht-ecg-wrap'); if (w) w.innerHTML = S.svg; root.querySelector('#ht-br-v').textContent = H.breath; root.querySelector('#ht-rmssd').textContent = Math.round(S.rmssd); };
        r.addEventListener('input', on); stops.push(() => r.removeEventListener('input', on));
      }
      if (H.tab === 'coronary') stops.push(mountCor(root));
      return () => stops.forEach((f) => { try { f(); } catch { /* page already gone */ } });
    }
  });
  function mountCor(root) {
    const cv = root.querySelector('#ht-cor-cv'), a = root.querySelector('#ht-a'), b = root.querySelector('#ht-b');
    const sync = () => {
      const FS = drawCor(cv);
      root.querySelector('#ht-a-v').textContent = H.alpha === 0 ? 'AP' : H.alpha < 0 ? `RAO ${-H.alpha}°` : `LAO ${H.alpha}°`;
      root.querySelector('#ht-b-v').textContent = H.beta === 0 ? '0°' : H.beta < 0 ? `CAU ${-H.beta}°` : `CRA ${H.beta}°`;
      const t = root.querySelector('#ht-fs-t'); if (t) t.innerHTML = fsTable(FS);
      const c = root.querySelector('.ht-carm'); if (c) c.outerHTML = carm();
      root.querySelectorAll('.ht-pre').forEach((x) => x.classList.toggle('on', +x.dataset.a === H.alpha && +x.dataset.b === H.beta));
      cv.setAttribute('aria-label', `Coronary arteries projected at ${angLabel(H.alpha, H.beta)}. The table lists how much of each segment shows.`);
    };
    const onA = () => { H.alpha = +a.value; sync(); }, onB = () => { H.beta = +b.value; sync(); };
    a.addEventListener('input', onA); b.addEventListener('input', onB);
    let drag = null;
    const down = (e) => { drag = { x: e.clientX, y: e.clientY, a: H.alpha, b: H.beta }; cv.setPointerCapture(e.pointerId); };
    const move = (e) => { if (!drag) return; H.alpha = clamp(Math.round((drag.a + (e.clientX - drag.x) * 0.4) / 1), -90, 90); H.beta = clamp(Math.round(drag.b - (e.clientY - drag.y) * 0.3), -45, 45); a.value = H.alpha; b.value = H.beta; sync(); };
    const up = () => { drag = null; };
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    const ro = new ResizeObserver(() => requestAnimationFrame(sync)); ro.observe(cv.parentElement);
    sync();
    return () => { ro.disconnect(); a.removeEventListener('input', onA); b.removeEventListener('input', onB); };
  }
  let AC = null;
  function thump(at, f, dur, gain) {
    const o = AC.createOscillator(), o2 = AC.createOscillator(), g = AC.createGain(), lp = AC.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 220; o.frequency.setValueAtTime(f, at); o.frequency.exponentialRampToValueAtTime(f * 0.7, at + dur); o2.frequency.value = f * 2.1;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(gain, at + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(AC.destination); o.start(at); o2.start(at); o.stop(at + dur + 0.02); o2.stop(at + dur + 0.02);
  }
  function mountCycle(root, s) {
    const M = model(hrOf(s)), svg = root.querySelector('.ht-wig'), cur = root.querySelector('#ht-cur'), mini = root.querySelector('.ht-mini svg');
    if (!svg || !cur) return () => {};
    const W = 660, L = 46, R = 92, X = (t) => L + (t / M.C) * (W - L - R);
    let raf = 0, t0 = performance.now(), tPrev = -1, lastPh = '', nextBeat = 0;
    const lv = mini && mini.querySelector('.ht-lvg'), valves = root.querySelector('#ht-valves');
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const speed = H.slow ? 0.25 : 1;
      let t = H.play && !reduce() ? (((now - t0) * speed) % M.C) : tPrev < 0 ? M.mvC + 30 : tPrev;
      if (tPrev >= 0 && t === tPrev && !H.play) return;
      tPrev = t;
      cur.setAttribute('x1', X(t)); cur.setAttribute('x2', X(t));
      const ph = M.phases.find(([, a, b]) => t >= a && t < b) || M.phases[0], k = ph[0];
      if (lv) { const vol = M.lvv(t), sc = 0.82 + 0.18 * ((vol - 50) / 70); lv.setAttribute('transform', `translate(284 312) scale(${sc.toFixed(3)}) translate(-284 -312)`); }
      if (k !== lastPh) {
        lastPh = k; const P = PH[k];
        root.querySelector('#ht-ph-n').textContent = P[0]; root.querySelector('#ht-ph-d').textContent = P[1];
        if (mini) Object.entries(P[2]).forEach(([vk, open]) => { const el = mini.querySelector('.ht-' + vk); if (el) el.classList.toggle('open', !!open); });
        if (valves) valves.querySelectorAll('li').forEach((li) => { const open = !!P[2][li.dataset.v]; li.classList.toggle('open', open); li.querySelector('b').textContent = open ? 'open' : 'closed'; });
      }
      if (H.sound && H.play && AC) { // schedule the next beat's sounds a little ahead of time
        const beatLen = M.C / speed / 1000;
        if (!nextBeat || nextBeat < AC.currentTime) { const into = (((now - t0) * speed) % M.C) / speed / 1000; nextBeat = AC.currentTime + (beatLen - into); }
        if (nextBeat - AC.currentTime < 0.25) { thump(nextBeat + M.mvC / speed / 1000, 70, 0.11, 0.5); thump(nextBeat + M.avC / speed / 1000, 95, 0.07, 0.35); nextBeat += beatLen; }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }

  /* ── actions ── */
  OS.act('ht-tab', (el) => { H.tab = el.dataset.t; OS.render(); });
  OS.act('ht-part', (el) => { H.sel = el.dataset.k || null; if (H.sel && ['sa', 'avn', 'his', 'purk'].includes(H.sel)) H.cond = true; if (H.tab !== 'anatomy') H.tab = 'anatomy'; OS.render(); });
  OS.act('ht-layer', (el) => { H[el.dataset.k] = !H[el.dataset.k]; OS.render(); });
  OS.act('ht-play', () => { H.play = !H.play; OS.render(); });
  OS.act('ht-slow', (el) => { H.slow = el.dataset.v === '1'; OS.render(); });
  OS.act('ht-sound', () => {
    H.sound = !H.sound;
    if (H.sound) { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); AC.resume(); H.play = true; } catch { H.sound = false; OS.toast('Sound is not available in this browser'); } }
    OS.render();
  });
  OS.act('ht-sys', (el) => { H.sys = el.dataset.v; const p = PRESETS[H.sys === 'right' ? 'right' : 'left'][0]; if (H.sys === 'right') { H.alpha = p[1]; H.beta = p[2]; } OS.render(); });
  OS.act('ht-look', (el) => { H.look = el.dataset.v; OS.render(); });
  OS.act('ht-dom', (el) => { H.dom = el.dataset.v; OS.render(); });
  OS.act('ht-pre', (el) => { H.alpha = +el.dataset.a; H.beta = +el.dataset.b; OS.render(); });
  OS.change('ht-labels', (el) => { H.labels = el.checked; OS.render(); });
  OS.change('ht-fs', (el) => { H.fs = el.checked; OS.render(); });
  document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('.ht-svg [data-act="ht-part"]')) { e.preventDefault(); e.target.closest('[data-act]').dispatchEvent(new MouseEvent('click', { bubbles: true })); } });

  OS.heart = { model, tree, viewBasis, foreshort, state: H };
})();
