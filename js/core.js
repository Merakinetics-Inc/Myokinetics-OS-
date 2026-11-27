/* ═══════════════════════════════════════════════════════════════════
   MYOKINETICS OS v4 — CORE
   State store · persistence adapter · score engine · protocol engine
   · router · DOM helpers. Every view module registers into OS.views.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── helpers ─────────────────────────────────────────────────────── */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const uid = () => Math.random().toString(36).slice(2, 9);
  const dayKey = (d = new Date()) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const fmtDate = (k) => new Date(k + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const fmt = (n, d = 0) => Number(n).toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });

  function spark(vals, w = 120, h = 32, opts = {}) {
    if (!vals.length) return '';
    const min = opts.min ?? Math.min(...vals), max = opts.max ?? Math.max(...vals);
    const span = max - min || 1, pad = 3;
    const pts = vals.map((v, i) => [pad + (i * (w - pad * 2)) / Math.max(1, vals.length - 1), h - pad - ((v - min) / span) * (h - pad * 2)]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = line + ` L${pts[pts.length - 1][0].toFixed(1)} ${h} L${pts[0][0].toFixed(1)} ${h} Z`;
    const last = pts[pts.length - 1];
    const col = opts.color || 'var(--accent)';
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
      <path d="${area}" fill="${col}" opacity=".12"/>
      <path d="${line}" fill="none" stroke="${col}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.6" fill="${col}"/></svg>`;
  }

  function ring(value, size = 120, stroke = 9, label = '') {
    const none = value == null || !Number.isFinite(Number(value));
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - (none ? 0 : clamp(value, 0, 100)) / 100);
    return `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(label)} ${none ? 'not scored yet' : Math.round(value) + ' of 100'}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--accent)" stroke-width="${stroke}" stroke-linecap="round"
        stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
  }

  const pill = (status, text) => `<span class="pill pill-${status}">${esc(text)}</span>`;

  /* ── icons (24px stroke) ─────────────────────────────────────────── */
  const ICONS = {
    today: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
    biology: '<path d="M7 3c0 6 10 6 10 12s-10 6-10 6"/><path d="M17 3c0 6-10 6-10 12"/><path d="M8.5 7h7M8.5 17h7"/>',
    training: '<path d="M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12"/>',
    machines: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M12 15v3"/>',
    ar: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><circle cx="12" cy="9" r="2"/><path d="M12 11v4M9 13l3-1 3 1M10 19l2-4 2 4"/>',
    gym: '<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 12h7v9M14 3v6h7"/>',
    fuel: '<path d="M12 21c-4 0-7-3-7-7 0-5 7-11 7-11s7 6 7 11c0 4-3 7-7 7z"/>',
    life: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    coach: '<path d="M4 5h16v11H9l-5 4z"/><path d="M9 10h.01M12 10h.01M15 10h.01"/>',
    system: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="8.5" y="14" width="7" height="7"/><path d="M6.5 10v2h11v-2M12 12v2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    rotate: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',
    send: '<path d="M4 12l16-8-6 16-2-7z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    play: '<path d="M7 5l12 7-12 7z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    athlete: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 21h6M10 17h4"/>',
    wearable: '<rect x="7" y="6" width="10" height="12" rx="3"/><path d="M9 6l1-3h4l1 3M9 18l1 3h4l1-3M12 10v2.5l1.5 1"/>',
    imaging: '<rect x="3" y="3" width="18" height="18" rx="3"/><ellipse cx="12" cy="12" rx="5" ry="7"/><path d="M12 5v14M7.5 9.5h9M7.5 14.5h9"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    speaker: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>',
    mirror: '<rect x="5" y="2" width="14" height="20" rx="3"/><circle cx="12" cy="7" r="2"/><path d="M12 9v6M9 11.5h6M9 13.5h6M10 19l2-4 2 4"/>',
    function: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
    augment: '<rect x="7" y="7" width="10" height="10" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>',
    longevity: '<path d="M6 3h12M6 21h12"/><path d="M7 3v2a5 5 0 0 0 10 0V3M7 21v-2a5 5 0 0 1 10 0v2"/>',
    stack: '<path d="M10.5 3.5a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7-7z"/><path d="M7 7l7 7"/>',
    body: '<circle cx="12" cy="4.2" r="2.1"/><path d="M12 6.6v7.2M7.5 9.2c1.6.8 3 1.2 4.5 1.2s2.9-.4 4.5-1.2M9.6 21l2.4-7.2 2.4 7.2"/>',
    home: '<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5M10 20v-5h4v5"/>',
    recovery: '<path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/>',
    looks: '<path d="M12 3l2.2 5.6L20 11l-5.8 2.4L12 19l-2.2-5.6L4 11l5.8-2.4z"/><path d="M19 3v4M17 5h4"/>',
    alert: '<path d="M12 4L2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    sleep: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/><path d="M16 3h3l-3 4h3"/>',
    pt: '<path d="M7 3v6a5 5 0 0 0 10 0V3M12 14v7M9 21h6"/><circle cx="12" cy="9" r="1.5"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1 0 1.6-.7 1.6-1.6 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4.1-4-7.4-9-7.4z"/><circle cx="7.5" cy="11" r="1.1"/><circle cx="10.2" cy="7.3" r="1.1"/><circle cx="14.6" cy="7.3" r="1.1"/><circle cx="17" cy="11" r="1.1"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
    myo: '<circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="1.3"/><path d="M12 7.8V3.5M12 16.2v4.3M7.8 12H3.5M16.2 12h4.3M9 9 6 6M15 15l3 3"/><circle cx="12" cy="3" r=".9"/><circle cx="21" cy="12" r=".9"/><circle cx="3" cy="12" r=".9"/><circle cx="12" cy="21" r=".9"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    report: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 15.5h7M9 19h4"/>',
    shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
    kitchen: '<path d="M4 11h16v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z"/><path d="M2 11h20M9 4c0 1.5 1 1.5 1 3M13 4c0 1.5 1 1.5 1 3"/>',
    motion: '<circle cx="13" cy="4.5" r="2"/><path d="M8 21l3-6 3 2v5M11 15l1-5 4 2 3-1M12 10l-4 1-2 3"/><path d="M3 8h3M2 12h3"/>',
    pathway: '<circle cx="5" cy="6" r="2.2"/><circle cx="19" cy="6" r="2.2"/><circle cx="12" cy="18" r="2.2"/><path d="M7.2 6h9.6M6.2 8l4.6 8M17.8 8l-4.6 8"/>',
    evidence: '<path d="M5 4h10l4 4v12H5z"/><path d="M15 4v4h4"/><circle cx="11" cy="13" r="3"/><path d="M13.2 15.2 16 18"/>',
    score: '<path d="M4.5 16a8 8 0 1 1 15 0"/><path d="M12 16l4-5"/><circle cx="12" cy="16" r="1.3"/>',
    mode: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><circle cx="12" cy="12" r="3"/><path d="M4 12h3M17 12h3"/>',
    mind: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3h1V4z"/><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3h-1V4z"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/><path d="M3 12.5h4.5l1.8-2.6 2.6 5 1.9-3.2h7.2"/>',
    stream: '<circle cx="4.5" cy="12" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><circle cx="19.5" cy="12" r="2"/><path d="M6.2 10.8 10.3 7.2M6.2 13.2l4.1 3.6M13.7 7.2l4.1 3.6M13.7 16.8l4.1-3.6"/>',
    logbook: '<path d="M6 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M8 3v18M11 8h4.5M11 12h4.5M11 16h3"/>'
  };
  const icon = (n, s = 20) => `<svg class="ico" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

  /* ── seed data (sample member, clearly labelled in UI) ───────────── */
  function seed() {
    const t = new Date();
    const k = (n) => dayKey(addDays(t, n));
    const M = (id, name, system, unit, value, normal, optimal, weight, prev, aliases = []) => ({
      id, name, system, unit, value, normal, optimal, weight, aliases,
      history: [[k(-270), prev[0]], [k(-180), prev[1]], [k(-39), value]]
    });
    const markers = [
      M('apob', 'ApoB', 'Cardiometabolic', 'mg/dL', 92, [null, 130], [null, 80], 3, [104, 98], ['apolipoprotein b']),
      M('ldl', 'LDL-C', 'Cardiometabolic', 'mg/dL', 118, [null, 130], [null, 100], 2, [131, 124], ['ldl', 'ldl cholesterol']),
      M('hdl', 'HDL-C', 'Cardiometabolic', 'mg/dL', 52, [40, null], [55, null], 2, [47, 50], ['hdl', 'hdl cholesterol']),
      M('tg', 'Triglycerides', 'Cardiometabolic', 'mg/dL', 104, [null, 150], [null, 90], 2, [142, 121], ['trig']),
      M('lpa', 'Lp(a)', 'Cardiometabolic', 'nmol/L', 18, [null, 75], [null, 30], 1, [19, 18], ['lipoprotein a']),
      M('a1c', 'HbA1c', 'Metabolic', '%', 5.4, [null, 5.7], [4.6, 5.3], 3, [5.6, 5.5], ['hemoglobin a1c', 'a1c']),
      M('glu', 'Fasting glucose', 'Metabolic', 'mg/dL', 91, [70, 99], [75, 90], 2, [97, 94], ['glucose']),
      M('ins', 'Fasting insulin', 'Metabolic', 'µIU/mL', 8.1, [2.6, 24.9], [2, 6], 2, [11.4, 9.6], ['insulin']),
      M('crp', 'hs-CRP', 'Inflammation', 'mg/L', 1.3, [null, 3], [null, 1], 3, [2.4, 1.8], ['crp', 'c-reactive protein']),
      M('hcy', 'Homocysteine', 'Inflammation', 'µmol/L', 9.6, [null, 15], [null, 8], 1, [11.2, 10.1], []),
      M('tt', 'Total testosterone', 'Hormonal', 'ng/dL', 548, [264, 916], [600, 900], 2, [497, 520], ['testosterone']),
      M('ft', 'Free testosterone', 'Hormonal', 'ng/dL', 12.1, [8.7, 25.1], [15, 25], 2, [10.4, 11.3], []),
      M('cort', 'Cortisol (AM)', 'Hormonal', 'µg/dL', 17.2, [6.2, 19.4], [10, 18], 1, [19.1, 18.0], ['cortisol']),
      M('tsh', 'TSH', 'Thyroid', 'mIU/L', 2.1, [0.45, 4.5], [0.5, 2.5], 2, [2.4, 2.2], []),
      M('ft3', 'Free T3', 'Thyroid', 'pg/mL', 3.2, [2.0, 4.4], [3.0, 4.0], 1, [3.0, 3.1], ['ft3']),
      M('vitd', 'Vitamin D (25-OH)', 'Nutrients', 'ng/mL', 31, [30, 100], [40, 60], 3, [22, 26], ['vitamin d', '25-oh vitamin d']),
      M('ferr', 'Ferritin', 'Nutrients', 'ng/mL', 96, [30, 400], [50, 150], 2, [88, 91], []),
      M('b12', 'Vitamin B12', 'Nutrients', 'pg/mL', 512, [232, 1245], [500, 1000], 1, [430, 470], ['b12']),
      M('mg', 'RBC magnesium', 'Nutrients', 'mg/dL', 4.7, [4.2, 6.8], [5.2, 6.5], 2, [4.5, 4.6], ['magnesium']),
      M('o3', 'Omega-3 index', 'Nutrients', '%', 5.1, [4, null], [8, 12], 2, [4.2, 4.6], ['omega-3', 'omega 3 index']),
      M('alt', 'ALT', 'Liver & kidney', 'U/L', 26, [0, 44], [null, 25], 1, [31, 28], []),
      M('egfr', 'eGFR', 'Liver & kidney', 'mL/min', 104, [60, null], [90, null], 1, [101, 103], []),
      M('hgb', 'Hemoglobin', 'Blood', 'g/dL', 15.1, [13, 17], [14, 16], 1, [14.8, 15.0], []),
      M('ck', 'Creatine kinase', 'Muscle', 'U/L', 236, [44, 1083], [null, 300], 1, [410, 280], ['ck'])
    ];

    const ex = (id, name, machine, sets, reps, load, unit, done = 0) => ({
      id, name, machine, target: { sets, reps, load, unit },
      sets: Array.from({ length: sets }, (_, i) => ({ w: load, r: i < done ? reps : '', rpe: i < done ? [7, 7.5, 8, 8.5][i] : '', done: i < done }))
    });

    const meals = {};
    [[-3, [['Greek yogurt bowl', 520, 42, 58, 12], ['Chicken rice bowl', 760, 58, 88, 18], ['Salmon + potatoes', 820, 52, 70, 32], ['Whey + banana', 310, 30, 38, 4]]],
     [-2, [['Egg scramble + toast', 610, 38, 46, 28], ['Turkey wrap', 640, 46, 62, 20], ['Steak + rice', 880, 62, 84, 30]]],
     [-1, [['Oats + whey', 540, 40, 72, 10], ['Poke bowl', 720, 48, 86, 18], ['Chicken pasta', 840, 58, 92, 22], ['Cottage cheese', 220, 28, 10, 6]]],
     [0, [['Greek yogurt bowl', 520, 42, 58, 12], ['Pre-workout shake', 280, 30, 32, 4]]]]
      .forEach(([d, arr]) => { meals[k(d)] = arr.map(([name, kcal, p, c, f]) => ({ id: uid(), name, kcal, p, c, f })); });

    const habitLog = (pattern) => { const o = {}; pattern.forEach((v, i) => { if (v) o[k(i - 6)] = true; }); return o; };

    return {
      v: 4,
      sample: true,
      profile: { name: 'Sample Member', initials: 'SM', age: 34, sex: 'M', weightKg: 82, heightCm: 180, goal: 'recomp', activity: 1.55 },
      markers, labsDate: k(-39), retestDays: 90,
      wearables: { oura: true, whoop: false, apple: true, garmin: false },
      vitals: { hrv: 68, hrvBase: 62, rhr: 54, rhrBase: 56, sleepH: 7.4, sleepScore: 86, steps: 8420, hrvTrend: [58, 61, 60, 64, 59, 66, 68] },
      protocolDone: { [k(0)]: { 'p-vitd': true, 'p-light': true } },
      customProtocol: [],
      training: {
        program: { name: 'Hypertrophy Block A', week: 4, weeks: 8, perWeek: 4, focus: 'Upper push · bilateral balance' },
        programs: [
          { name: 'Hypertrophy Block A', detail: 'Upper/lower split, 4 sessions a week. APS Machine + ISO Flow + Dumbbell Hangers.', tag: 'Week 4 of 8' },
          { name: 'Unilateral Mastery', detail: 'Single-leg progression with bilateral force matching. Rehab and performance.', tag: 'Phase 2' },
          { name: 'Rotational Power', detail: 'ISO Flow isokinetic rotation work with torque and symmetry tracking.', tag: 'Sport' }
        ],
        session: {
          name: 'Upper Push', date: k(0),
          exercises: [
            ex('e1', 'APS Shoulder Press', 'aps', 4, 8, 95, 'lb', 4),
            ex('e2', 'Incline Dumbbell Press', 'hangers', 4, 10, 40, 'lb', 2),
            ex('e3', 'ISO Flow Cable Fly', 'isoflow', 3, 12, 35, 'lb'),
            ex('e4', 'ISO Flow Rotational Press', 'isoflow', 3, 10, 30, 'lb'),
            ex('e5', 'Rope Triceps Extension', 'isoflow', 3, 12, 45, 'lb')
          ]
        },
        log: [-26, -24, -22, -21, -19, -17, -15, -14, -12, -10, -8, -7, -5, -3, -1].map((d, i) => ({ date: k(d), name: ['Upper Push', 'Lower', 'Upper Pull', 'Lower'][i % 4], volume: 8200 + i * 180 + (i % 3) * 400, sets: 20 + (i % 4) }))
      },
      machines: [
        { id: 'aps', name: 'APS Machine 2.0', kind: 'Adaptive Shoulder Press', link: 'BLE 5.0 · MQTT/TLS', status: 'online', fw: '2.4.1', sensors: 'Bilateral load cells, ROM encoder, rep velocity', metric: 'Force L/R', unit: 'N', base: 420 },
        { id: 'isoflow', name: 'ISO Flow', kind: 'Isokinetic cable system', link: 'BLE 5.0 · MQTT/TLS', status: 'online', fw: '1.9.0', sensors: 'Torque transducer, cable speed, symmetry', metric: 'Torque', unit: 'Nm', base: 260 },
        { id: 'hangers', name: 'Dumbbell Hangers', kind: 'Smart storage rack', link: 'BLE 5.0', status: 'beta', fw: '0.6.2', sensors: 'Pair-lifted detection (prototype)', metric: 'Pair in use', unit: 'lb', base: 40 },
        { id: 'rack', name: 'MK-Pro Rack System', kind: 'Modular power rack', link: 'via AR-Vision', status: 'idle', fw: '—', sensors: 'Bar path from AR-Vision camera', metric: 'Bar speed', unit: 'm/s', base: 0.6 },
        { id: 'arv', name: 'AR-Vision Module v2.4', kind: 'LiDAR + RGB pose camera', link: 'Wi-Fi 6 · local edge', status: 'online', fw: '2.4.0', sensors: '2.4M LiDAR pts/s, 33-joint pose', metric: 'Tracking', unit: '%', base: 98 },
        { id: 'ftms', name: 'Third-party cardio', kind: 'Any Bluetooth FTMS bike, rower or treadmill', link: 'BLE FTMS profile', status: 'planned', fw: '—', sensors: 'Power, cadence, speed, HR', metric: 'Power', unit: 'W', base: 180 }
      ],
      nutrition: { meals, water: { [k(0)]: 1250 } },
      life: {
        habits: [
          { id: 'h1', name: 'Morning light, 10 min', cat: 'sleep', log: habitLog([1, 1, 0, 1, 1, 1, 1]) },
          { id: 'h2', name: 'Train or walk 8k steps', cat: 'move', log: habitLog([1, 1, 1, 0, 1, 1, 0]) },
          { id: 'h3', name: 'Protein at every meal', cat: 'fuel', log: habitLog([1, 0, 1, 1, 1, 0, 1]) },
          { id: 'h4', name: 'Screens off by 22:30', cat: 'sleep', log: habitLog([0, 1, 1, 0, 1, 1, 0]) },
          { id: 'h5', name: '10 min breathwork', cat: 'mind', log: habitLog([1, 0, 0, 1, 1, 0, 0]) }
        ],
        blocks: [
          { id: uid(), t: '06:30', dur: 20, title: 'Wake · morning light walk', cat: 'sleep' },
          { id: uid(), t: '07:15', dur: 30, title: 'Breakfast · 40 g protein', cat: 'fuel' },
          { id: uid(), t: '08:00', dur: 180, title: 'Deep work · product engineering', cat: 'work' },
          { id: uid(), t: '11:30', dur: 70, title: 'Upper Push session', cat: 'move' },
          { id: uid(), t: '12:45', dur: 45, title: 'Lunch · post-workout carbs', cat: 'fuel' },
          { id: uid(), t: '14:00', dur: 150, title: 'Meetings · investor calls', cat: 'work' },
          { id: uid(), t: '17:30', dur: 30, title: 'Zone 2 walk', cat: 'move' },
          { id: uid(), t: '19:00', dur: 60, title: 'Dinner · family', cat: 'life' },
          { id: uid(), t: '21:45', dur: 15, title: 'Breathwork · wind down', cat: 'mind' },
          { id: uid(), t: '22:30', dur: 480, title: 'Sleep window', cat: 'sleep' }
        ],
        goals: [
          { id: 'g1', name: 'Raise Vitamin D to 40+ ng/mL', progress: 31, target: 40, unit: 'ng/mL', start: 22 },
          { id: 'g2', name: 'APS Shoulder Press 8RM', progress: 95, target: 115, unit: 'lb', start: 75 },
          { id: 'g3', name: 'Average 7.5 h sleep', progress: 7.2, target: 7.5, unit: 'h', start: 6.4 },
          { id: 'g4', name: 'Bodyweight for recomposition', progress: 82, target: 80, unit: 'kg', start: 85 }
        ],
        mood: { [k(-2)]: { mood: 4, stress: 3 }, [k(-1)]: { mood: 3, stress: 4 } }
      },
      gym: { name: 'Studio floor A', w: 50, l: 35, clear: 3, items: [
        { id: uid(), type: 'aps', x: 3, y: 3, rot: 0 }, { id: uid(), type: 'aps', x: 11, y: 3, rot: 0 },
        { id: uid(), type: 'iso', x: 20, y: 3, rot: 0 }, { id: uid(), type: 'iso', x: 30, y: 3, rot: 0 },
        { id: uid(), type: 'rack', x: 40, y: 3, rot: 0 }, { id: uid(), type: 'hangers', x: 3, y: 30, rot: 0 },
        { id: uid(), type: 'bench', x: 5, y: 22, rot: 0 }, { id: uid(), type: 'bench', x: 10, y: 22, rot: 0 },
        { id: uid(), type: 'turf', x: 18, y: 17, rot: 1 }, { id: uid(), type: 'tread', x: 44, y: 18, rot: 0 },
        { id: uid(), type: 'arv', x: 26, y: 13, rot: 0 }
      ] },
      chat: []
    };
  }

  /* ── a member's own start: the catalogue stays (markers, machines, programs), everything personal is empty ── */
  function blank() {
    const s = seed();
    s.sample = false; s.fresh = true; delete s.sampleEdited;
    // neutral body numbers keep the calculators working until the member saves their profile (profile.unset)
    s.profile = { name: '', initials: '', age: 35, sex: 'M', weightKg: 75, heightCm: 175, goal: 'recomp', activity: 1.55, unset: true };
    s.markers.forEach((m) => { m.value = null; m.history = []; });
    s.labsDate = null;
    s.wearables = { oura: false, whoop: false, apple: false, garmin: false };
    s.vitals = { hrv: null, hrvBase: null, rhr: null, rhrBase: null, sleepH: null, sleepScore: null, steps: null, hrvTrend: [] };
    s.protocolDone = {}; s.customProtocol = [];
    s.training.program = { name: 'No program yet', week: 1, weeks: 8, perWeek: 3, focus: 'Pick a program to start' };
    s.training.session = { name: 'No session planned', date: dayKey(), exercises: [] };
    s.training.log = [];
    s.nutrition = { meals: {}, water: {} };
    s.life = { habits: [], blocks: [], goals: [], mood: {} };
    s.gym = { name: 'My floor', w: 40, l: 30, clear: 3, items: [] };
    s.chat = [];
    return s;
  }
  // a number for display, or an em dash when there is no data yet
  const dash = (x, d) => (x == null || x === '' || !Number.isFinite(Number(x)) ? '—' : d == null ? String(x) : Number(x).toFixed(d));
  const hasValue = (m) => m && m.value != null && m.value !== '' && Number.isFinite(Number(m.value));

  /* ── score engine ────────────────────────────────────────────────── */
  const inRange = (v, r) => (r[0] == null || v >= r[0]) && (r[1] == null || v <= r[1]);
  // Peak tier: the top of the performance / longevity range, inside optimal. Keyed by marker id.
  const PEAK = {
    apob: [null, 60], ldl: [null, 70], hdl: [60, null], tg: [null, 70], lpa: [null, 30], a1c: [4.6, 5.1], glu: [75, 86], ins: [2, 5],
    crp: [null, 0.5], hcy: [null, 7], tt: [700, 900], ft: [18, 25], cort: [10, 16], tsh: [0.8, 2.0], ft3: [3.3, 4.0], vitd: [50, 60],
    ferr: [70, 150], b12: [600, 1000], mg: [5.6, 6.5], o3: [10, 12], alt: [null, 20], egfr: [100, null], hgb: [14.5, 16], ck: [null, 300]
  };
  const peakOf = (m) => m.peak || PEAK[m.id] || m.optimal;
  // Red flags: values dangerous enough to need in-person care today. Not optimisation targets.
  const DANGER = {
    glu: [54, 300, 'Blood glucose at this level can be dangerous'], a1c: [null, 10, 'HbA1c this high means blood sugar is badly out of control'],
    hgb: [8, 20, 'Hemoglobin this far out of range can be dangerous'], egfr: [30, null, 'Kidney filtration this low needs urgent assessment'],
    alt: [null, 200, 'A liver enzyme this high needs urgent assessment'], ck: [null, 5000, 'Creatine kinase this high can mean muscle breakdown that harms the kidneys'],
    tsh: [0.1, 10, 'Thyroid signalling this far out of range needs assessment'], ferr: [10, 1000, 'Iron stores this far out of range need assessment'],
    b12: [150, null, 'B12 this low can cause nerve damage'], vitd: [10, null, 'Vitamin D this low needs assessment'],
    crp: [null, 50, 'Inflammation this high can mean an acute infection']
  };
  // The widest values a real result can take (beyond the most extreme lab reports). Anything outside is an ID, a phone
  // number or a typo read into the wrong field: set aside for the member to correct, never scored, never a red flag.
  // Keep in step with PLAUSIBLE in supabase/functions/ingest/normalize.ts.
  const PLAUSIBLE = { apob: [5, 400], ldl: [5, 1000], hdl: [2, 250], tg: [5, 10000], lpa: [0, 1000], a1c: [2, 25], glu: [5, 2000], ins: [0, 1000], crp: [0, 500], hcy: [0, 500], tt: [0, 5000], ft: [0, 500], cort: [0, 200], tsh: [0, 1000], ft3: [0, 50], vitd: [0, 500], ferr: [0, 100000], b12: [0, 20000], mg: [0.5, 20], o3: [0, 30], alt: [0, 20000], egfr: [0, 250], hgb: [1, 30], ck: [0, 1000000] };
  const plausible = (id, v) => { const x = Number(v), r = PLAUSIBLE[id]; return Number.isFinite(x) && (!r || (x >= r[0] && x <= r[1])); };
  function redFlags(s) {
    const out = [];
    s.markers.forEach((m) => { const d = DANGER[m.id]; if (!d || !hasValue(m) || !plausible(m.id, m.value)) return; const v = Number(m.value); if ((d[0] != null && v < d[0]) || (d[1] != null && v > d[1])) out.push({ id: m.id, name: m.name, value: v, unit: m.unit, why: d[2] }); });
    const vt = s.vitals || {};
    const el = (s.enhance && s.enhance.labs) || {};
    if (el.hct >= 60 && el.hct <= 85) out.push({ id: 'hct', name: 'Hematocrit', value: el.hct, unit: '%', why: 'Blood this thick sharply raises the risk of clots and stroke' });
    if ((el.sbp >= 180 && el.sbp <= 320) || (el.dbp >= 120 && el.dbp <= 220)) out.push({ id: 'bp', name: 'Blood pressure', value: `${el.sbp || '?'}/${el.dbp || '?'}`, unit: 'mmHg', why: 'Blood pressure this high is a hypertensive crisis' });
    if (vt.rhr && vt.rhr >= 20 && vt.rhr <= 250 && (vt.rhr > 120 || vt.rhr < 35)) out.push({ id: 'rhr', name: 'Resting heart rate', value: vt.rhr, unit: 'bpm', why: 'A resting heart rate this far out of range needs assessment' });
    return out;
  }
  const TERMS = 'Myo, built on Myokinetics OS, is a physician-optional performance and wellness system. It measures, scores and optimises your physiology toward peak ranges and runs your protocol for you. It does not diagnose or treat disease, and it does not start, stop or dose prescription medications or hormones. If a lab value or vital reaches a dangerous level, the OS stops optimising that marker and tells you to get in-person care the same day.';
  // distance from a value to a range, normalised by a reference width
  const gap = (v, r, width) => { const d = r[0] != null && v < r[0] ? r[0] - v : r[1] != null && v > r[1] ? v - r[1] : 0; return clamp(d / (width || 1), 0, 1); };
  function markerEval(m) {
    if (!hasValue(m)) return { status: 'muted', tier: 'none', label: 'No result yet', score: null };
    if (!plausible(m.id, m.value)) return { status: 'warn', tier: 'error', label: 'Check this value', score: null };
    const v = Number(m.value), pk = peakOf(m), o = m.optimal;
    const ow = ((o[1] ?? (o[0] ?? v) * 1.5) - (o[0] ?? 0)) || Math.abs(v) || 1;
    if (DANGER[m.id] && ((DANGER[m.id][0] != null && v < DANGER[m.id][0]) || (DANGER[m.id][1] != null && v > DANGER[m.id][1]))) return { status: 'bad', tier: 'danger', label: 'Red flag', score: 20 };
    if (inRange(v, pk)) return { status: 'good', tier: 'peak', label: 'Peak', score: 100 };
    if (inRange(v, o)) return { status: 'good', tier: 'optimal', label: 'Optimal', score: Math.round(88 + 11 * (1 - gap(v, pk, ow * 0.6))) };
    if (inRange(v, m.normal)) {
      const width = (m.normal[1] ?? (o[1] ?? v) * 1.5) - (m.normal[0] ?? 0) || 1;
      return { status: 'warn', tier: 'normal', label: 'Below optimal', score: Math.round(60 + 25 * (1 - gap(v, o, width * 0.5))) };
    }
    return { status: 'bad', tier: 'out', label: 'Out of range', score: 35 };
  }
  // Every part is null until there is data for it, and the Myo Score averages only the parts that have data:
  // a new member sees "—", never a made-up number.
  function scores(s) {
    const mk = s.markers.map((m) => ({ m, e: markerEval(m) }));
    const scored = mk.filter((x) => x.e.score != null);
    const tw = scored.reduce((a, x) => a + x.m.weight, 0);
    const biology = tw ? scored.reduce((a, x) => a + x.e.score * x.m.weight, 0) / tw : null;
    const vt = s.vitals || {};
    const num = (x) => (x == null || x === '' ? null : Number.isFinite(Number(x)) ? Number(x) : null);
    const hrv = num(vt.hrv), rhr = num(vt.rhr), sleepH = num(vt.sleepH);
    let readiness = null;
    if (hrv != null || rhr != null || sleepH != null) {
      const hb = num(vt.hrvBase) ?? hrv, rb = num(vt.rhrBase) ?? rhr, ss = num(vt.sleepScore);
      readiness = clamp(70 + (hrv != null && hb ? (hrv / hb - 1) * 60 : 0) + (rhr != null && rb != null ? (rb - rhr) * 2.5 : 0) + (sleepH != null ? (sleepH - 7) * 8 : 0) + (ss != null ? (ss - 80) * 0.5 : 0), 0, 100);
    }
    const since = dayKey(addDays(new Date(), -7));
    const log = s.training.log || [], sesEx = (s.training.session && s.training.session.exercises) || [];
    const sessions7 = log.filter((l) => l.date >= since).length;
    const ses = sesEx.flatMap((e) => e.sets);
    const sessionPct = ses.filter((x) => x.done).length / Math.max(1, ses.length);
    const training = log.length || ses.some((x) => x.done) ? clamp((sessions7 / (s.training.program.perWeek || 3)) * 85 + sessionPct * 15, 0, 100) : null;
    const tg = targets(s.profile);
    const days = [-3, -2, -1].map((d) => s.nutrition.meals[dayKey(addDays(new Date(), d))] || []).filter((ms) => ms.length);
    const nutrition = days.length ? clamp(days.reduce((a, ms) => {
      const kcal = ms.reduce((x, m) => x + m.kcal, 0), p = ms.reduce((x, m) => x + m.p, 0);
      return a + (clamp(p / tg.p, 0, 1.1) * 55 + (1 - clamp(Math.abs(kcal - tg.kcal) / tg.kcal, 0, 1)) * 45);
    }, 0) / days.length, 0, 100) : null;
    const keys = Array.from({ length: 7 }, (_, i) => dayKey(addDays(new Date(), i - 6)));
    const habits = s.life.habits || [], moods = Object.values(s.life.mood || {}).slice(-5);
    const hab = habits.length ? habits.reduce((a, h) => a + keys.filter((kk) => h.log[kk]).length, 0) / (habits.length * 7) : null;
    const moodAvg = moods.length ? moods.reduce((a, m) => a + (m.mood * 2 - m.stress + 3), 0) / moods.length / 10 : null;
    const life = hab == null && moodAvg == null ? null : clamp((hab ?? 0.5) * 70 + (moodAvg ?? 0.6) * 30, 0, 100);
    const parts = { biology, recovery: readiness, training, nutrition, life };
    const W = { biology: 0.3, recovery: 0.2, training: 0.2, nutrition: 0.15, life: 0.15 };
    const have = Object.keys(W).filter((k) => parts[k] != null), ww = have.reduce((a, k) => a + W[k], 0);
    const mkScore = ww ? have.reduce((a, k) => a + parts[k] * W[k], 0) / ww : null;
    const r = (x) => (x == null ? null : Math.round(x));
    return { mk: r(mkScore), parts, readiness: r(readiness), markers: mk, flagged: scored.filter((x) => x.e.status !== 'good'), suspect: mk.filter((x) => x.e.tier === 'error'), peak: scored.filter((x) => x.e.tier === 'peak').length, redFlags: redFlags(s), empty: !have.length };
  }

  function targets(p) {
    const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'F' ? -161 : 5);
    const adj = { cut: -400, recomp: 0, gain: 300 }[p.goal] ?? 0;
    const kcal = Math.round((bmr * (p.activity || 1.55) + adj) / 10) * 10;
    const prot = Math.round(p.weightKg * 2.0), fat = Math.round(p.weightKg * 0.9);
    const carb = Math.max(0, Math.round((kcal - prot * 4 - fat * 9) / 4));
    return { kcal, p: prot, f: fat, c: carb, water: Math.round(p.weightKg * 35 / 250) * 250 };
  }

  /* ── protocol engine: biomarkers + readiness → today's plan ─────── */
  const RULES = [
    { id: 'p-vitd', when: (g) => g('vitd') < 40, cat: 'supplement', time: 'Breakfast', title: 'Vitamin D3 5,000 IU + K2 100 mcg', detail: 'Take with a meal that has fat. Retest in 90 days, target 40–60 ng/mL.', marker: 'vitd' },
    { id: 'p-o3', when: (g) => g('o3') < 8, cat: 'supplement', time: 'Dinner', title: 'Omega-3, 2 g EPA + DHA', detail: 'Supports Omega-3 index toward 8%+ and lowers triglycerides.', marker: 'o3' },
    { id: 'p-mg', when: (g) => g('mg') < 5.2, cat: 'supplement', time: 'Bedtime', title: 'Magnesium glycinate, 400 mg', detail: 'Before bed. Supports sleep quality and RBC magnesium.', marker: 'mg' },
    { id: 'p-z2', when: (g) => g('apob') > 80 || g('ins') > 6, cat: 'training', time: 'Evening', title: 'Zone 2 cardio, 30 min', detail: 'Conversational pace (about 60–70% HRmax). Builds insulin sensitivity and supports lipids. 150 min a week.', marker: 'apob' },
    { id: 'p-fiber', when: (g) => g('ldl') > 100 || g('apob') > 80, cat: 'nutrition', time: 'All day', title: 'Fiber 35 g, including 10 g soluble', detail: 'Oats, beans, psyllium, berries. Lowers LDL and ApoB over 8–12 weeks.', marker: 'ldl' },
    { id: 'p-crp', when: (g) => g('crp') > 1, cat: 'nutrition', time: 'All day', title: 'Two servings oily fish or leafy greens', detail: 'Anti-inflammatory pattern while hs-CRP is above 1.0 mg/L.', marker: 'crp' },
    { id: 'p-hcy', when: (g) => g('hcy') > 8, cat: 'supplement', time: 'Breakfast', title: 'Methylated B-complex', detail: 'Folate, B6 and B12 support homocysteine clearance.', marker: 'hcy' },
    { id: 'p-cort', when: (g) => g('cort') > 18 || g('ft') < 15, cat: 'sleep', time: '22:30', title: 'Sleep window 22:30 → 06:30', detail: 'Eight hours in bed. Sleep debt suppresses testosterone and raises AM cortisol.', marker: 'ft' },
    { id: 'p-light', when: () => true, cat: 'sleep', time: '06:45', title: 'Morning light, 10 minutes outdoors', detail: 'Anchors circadian rhythm. Improves sleep onset tonight.', marker: null },
    { id: 'p-breath', when: (g) => g('cort') > 16, cat: 'mind', time: '21:45', title: 'Box breathing, 4-4-4-4 for 5 minutes', detail: 'Downshifts the nervous system before sleep.', marker: 'cort' }
  ];
  function protocol(s, sc) {
    const g = (id) => Number((s.markers.find((m) => m.id === id) || {}).value ?? NaN);
    const flagged = new Set((sc.redFlags || redFlags(s)).map((f) => f.id));
    const items = RULES.filter((r) => { try { return !flagged.has(r.marker) && r.when(g); } catch { return false; } }).map((r) => ({ ...r }));
    const rd = sc.readiness;
    const sess = s.training.session;
    if (!sess.exercises.length) items.unshift({ id: 'p-train', cat: 'training', time: 'Today', title: 'Choose a training program', detail: 'Pick a program on Training and Myo builds each session around your readiness.', marker: null, route: 'training' });
    else if (rd == null) items.unshift({ id: 'p-train', cat: 'training', time: '11:30', title: `${sess.name} · ${s.training.program.name}`, detail: `${sess.exercises.length} exercises. Connect a ring or strap and Myo will adjust the load to your readiness each day.`, marker: null, route: 'training' });
    else items.unshift(rd >= 60
      ? { id: 'p-train', cat: 'training', time: '11:30', title: `${sess.name} · ${s.training.program.name}`, detail: `Readiness ${rd}. Train as written: ${sess.exercises.length} exercises on APS Machine, ISO Flow and Dumbbell Hangers.`, marker: null, route: 'training' }
      : { id: 'p-train', cat: 'training', time: '11:30', title: 'Recovery session instead of Upper Push', detail: `Readiness ${rd} is below 60. Swap to 30 min mobility plus Zone 2 and push the heavy session 24 h.`, marker: null, route: 'training' });
    const tg = targets(s.profile);
    items.push({ id: 'p-prot', cat: 'nutrition', time: 'All day', title: `Protein ${tg.p} g across 4 meals`, detail: `About ${Math.round(tg.p / 4)} g per meal (2.0 g/kg). Track it in Fuel.`, marker: null, route: 'fuel' });
    return items.concat(s.customProtocol || []);
  }

  /* ── persistence adapter: Claude account (db) | Myo account (Supabase, js/auth.js) → device (localStorage) ── */
  const LS_KEY = 'myokinetics-os-v4';
  const Persist = {
    mode: 'memory', ref: null, cloud: null, timer: null,
    loadLocal() { try { const raw = localStorage.getItem(LS_KEY); if (raw) { this.mode = 'device'; return JSON.parse(raw); } this.mode = 'device'; } catch { this.mode = 'memory'; } return null; },
    async connect() {
      try {
        if (!window.claude || !window.claude.use) return null;
        const [user, db] = await Promise.all([window.claude.use('user'), window.claude.use('db')]);
        if (!user || !db) return null;
        const id = await user.id();
        if (!id) return null;
        this.ref = db.doc(`data/users/${id}/os/state`);
        const snap = await Promise.race([this.ref.get(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000))]);
        this.mode = 'account';
        if (snap.exists) { const d = snap.data(); if (d && d.json) return JSON.parse(d.json); }
      } catch (e) { this.ref = null; }
      return null;
    },
    save(state) {
      clearTimeout(this.timer);
      this.timer = setTimeout(async () => {
        state._savedAt = Date.now();
        const json = JSON.stringify(state);
        try { localStorage.setItem(LS_KEY, json); } catch {}
        if (this.ref) { try { await this.ref.set({ json, updatedAt: new Date().toISOString() }); } catch (e) { /* keep device copy */ } }
        if (this.cloud) { try { await this.cloud.save(state); } catch (e) { /* auth.js reports sync errors */ } }
        OS.emit('saved');
      }, 700);
    }
  };

  /* ── diagnostics: the last 25 errors, kept for this tab only, with no member data ── */
  const errors = [];
  try { JSON.parse(sessionStorage.getItem('myo-errors') || '[]').forEach((e) => errors.push(e)); } catch { /* none */ }
  function logError(kind, msg, where) {
    if (/ResizeObserver loop/.test(String(msg))) return;   // a harmless browser notice, not an app error
    errors.push({ at: new Date().toISOString(), kind, msg: String(msg || '').slice(0, 240), where: String(where || '').slice(0, 120) });
    while (errors.length > 25) errors.shift();
    try { sessionStorage.setItem('myo-errors', JSON.stringify(errors)); } catch { /* memory only */ }
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('error', (e) => logError('error', e.message, e.filename ? `${String(e.filename).split('/').pop()}:${e.lineno}` : ''));
    window.addEventListener('unhandledrejection', (e) => logError('promise', e.reason && (e.reason.message || e.reason), ''));
  }

  /* ── OS kernel: store, bus, router ───────────────────────────────── */
  const listeners = {};
  const OS = {
    VERSION: '1.3.0', BUILD: 33, errors, logError,
    esc, clamp, lerp, uid, dayKey, addDays, fmtDate, fmt, spark, ring, pill, icon,
    seed, blank, hasValue, plausible, PLAUSIBLE, dash, scores, targets, protocol, markerEval, Persist, peakOf, redFlags, TERMS,
    views: {}, order: [], acts: {}, changes: {},
    state: null, current: null, cleanup: null,
    on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    emit(ev, d) { (listeners[ev] || []).forEach((f) => f(d)); },
    register(name, view) { this.views[name] = view; if (!view.hidden) this.order.push(name); },
    act(name, fn) { this.acts[name] = fn; },
    change(name, fn) { this.changes[name] = fn; },
    // one line on the Log book timeline: imports, scans, changes that move your numbers
    logEvent(cat, title, text, extra = {}) { if (!this.state) return; this.update((s) => { s.events = (s.events || []).concat([{ at: new Date().toISOString(), cat, title, text, ...extra }]).slice(-1500); }, { keepSample: true, render: false }); },
    update(fn, opts = {}) {
      fn(this.state);
      if (this.state.sample && !opts.keepSample) this.state.sampleEdited = true;
      Persist.save(this.state);
      if (opts.render !== false) this.render();
      else this.emit('header');
    },
    go(name) { if (location.hash.slice(1) !== name) location.hash = name; else this.render(); },
    render() {
      const name = this.views[location.hash.slice(1)] ? location.hash.slice(1) : 'today';
      const root = document.getElementById('view');
      const scroller = document.getElementById('main');
      const same = name === this.current;
      const keep = same ? scroller.scrollTop : 0;
      if (this.cleanup) { try { this.cleanup(); } catch {} this.cleanup = null; }
      this.current = name;
      const v = this.views[name];
      const sc = scores(this.state);
      // one page failing must never blank the app: show what broke and keep navigation working
      try {
        root.innerHTML = v.render(this.state, sc);
        const c = v.mount && v.mount(root, this.state, sc);
        if (typeof c === 'function') this.cleanup = c;
      } catch (e) {
        console.error('[Myo] page failed:', name, e);
        logError('page', (e && e.message) || String(e), name);
        root.innerHTML = `<section class="card"><h2>This page couldn't load</h2><p class="small">${esc((e && e.message) || String(e))}</p><p class="fine">Your data is safe. Try another page, or reload.</p></section>`;
      }
      scroller.scrollTop = keep;
      document.title = v.title && name !== 'today' ? `${v.title} · Myo` : 'Myo';
      // a new page: move keyboard and screen-reader focus to its heading (not on re-renders of the same page)
      if (!same && this._routed) { const h = root.querySelector('h1'); if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch { /* old browsers */ } } }
      this._routed = true;
      this.emit('route', name);
      this.emit('header');
    },
    toast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg; t.hidden = false; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
      clearTimeout(this._tt); this._tt = setTimeout(() => { t.hidden = true; }, 2600);
    }
  };
  window.OS = OS;
})();
