/* ═══ MYO — INTEGRATIONS: MedTech devices and the Myo Ingest API ═══
   Catalogue  · every device, wearable, lab, imaging and records source, how it connects and where its data lands
   Vielight   · Neuro Pro 2 / Gamma 4 / Alpha 4 / Duo 4, Vagus, X-Plus, MIP: session log with before/after ratings and an
                outcome comparison against sleep, HRV and readiness (Vielight has no public API, so sessions are logged)
   Bluetooth  · live Web Bluetooth for the standard GATT health profiles: heart rate (with RR → RMSSD), blood pressure,
                weight scale, pulse oximeter, thermometer; IEEE-11073 SFLOAT/FLOAT decoding
   API        · Myo Ingest API v1: endpoints, auth, scopes, idempotency, webhooks, code samples in curl / JS / Python
   Console    · the same inputs, validated and applied on this device today: Myo JSON, FHIR R4, HL7 v2 ORU, CSV,
                LibreView CSV. LOINC codes and unit conversions map results onto Biology markers and vitals.
   Readings are for wellness tracking, not diagnosis; very high blood pressure and low oxygen show what to do. */
(function () {
  'use strict';
  const { esc, icon, pill, dayKey } = OS;

  /* ── catalogue ── */
  const ST = { live: ['good', 'Live'], ble: ['good', 'Bluetooth'], log: ['muted', 'Session log'], file: ['muted', 'File import'], partner: ['warn', 'Needs partner keys'], planned: ['muted', 'Planned'] };
  const CAT = [['all', 'All'], ['neuro', 'Neuro and light'], ['cardio', 'Heart and vitals'], ['metabolic', 'Metabolic'], ['sleep', 'Sleep'], ['body', 'Body and imaging'], ['recovery', 'Recovery'], ['clinical', 'Clinical records']];
  // [key, category, name, examples, how it connects, where data lands, status, action]
  const INTEG = [
    ['vielight', 'neuro', 'Vielight Neuro', 'Neuro Pro 2, Gamma 4, Alpha 4, Duo 4', 'Session log with ratings (no public API yet)', 'Integrations › Vielight; module positions in X-ray Mirror', 'log', 'tab:vielight'],
    ['vielight2', 'neuro', 'Vielight Vagus, X-Plus and MIP', 'Vagus, X-Plus 4, MIP intranasal', 'Session log', 'Integrations › Vielight', 'log', 'tab:vielight'],
    ['eeg', 'neuro', 'EEG headbands and lab EEG', 'OpenBCI Cyton, Muse, clinical EEG', 'Web Serial (OpenBCI), Bluetooth (Muse, beta), EDF/EDF+/BDF upload', 'BCI lab; Sleep (hypnogram); 10–20 electrode map in X-ray Mirror', 'live', 'go:bci'],
    ['redlight', 'neuro', 'Red-light panels and beds', 'Any brand', 'Session log, or the Ingest API', 'Recovery', 'log', 'go:recovery'],
    ['hrstrap', 'cardio', 'Heart-rate straps', 'Polar H10, Garmin HRM, Wahoo TICKR', 'Bluetooth Heart Rate profile', 'Heart rate and HRV (RMSSD)', 'ble', 'tab:ble'],
    ['bp', 'cardio', 'Blood-pressure cuffs', 'Omron, Withings BPM, A&D', 'Bluetooth Blood Pressure profile', 'Blood pressure and pulse', 'ble', 'tab:ble'],
    ['oxi', 'cardio', 'Pulse oximeters', 'Bluetooth PLX oximeters', 'Bluetooth Pulse Oximeter profile', 'SpO₂ and pulse', 'ble', 'tab:ble'],
    ['thermo', 'cardio', 'Thermometers', 'Bluetooth thermometers', 'Bluetooth Health Thermometer profile', 'Temperature', 'ble', 'tab:ble'],
    ['garmin', 'cardio', 'Garmin', 'Watches and HRM straps', 'Garmin Health API (business approval)', 'Sleep, HRV, training load', 'partner', 'tab:api'],
    ['polar', 'cardio', 'Polar', 'Watches and H10', 'Polar AccessLink API (OAuth)', 'Training, heart rate, sleep', 'partner', 'tab:api'],
    ['apple', 'cardio', 'Apple Health', 'iPhone, Apple Watch', 'Needs the native iOS app (HealthKit)', 'All vitals', 'planned', null],
    ['hc', 'cardio', 'Health Connect', 'Android phones and watches', 'Needs the native Android app', 'All vitals', 'planned', null],
    ['oura', 'sleep', 'Oura Ring', 'Gen 3, Ring 4', 'OAuth through the Myo proxy, or file export', 'Wearables, Sleep, readiness', 'live', 'go:wearables'],
    ['whoop', 'sleep', 'WHOOP', '4.0, 5.0, MG', 'OAuth through the Myo proxy with webhooks, or file export', 'Wearables, Sleep, readiness', 'live', 'go:wearables'],
    ['sleeplab', 'sleep', 'Sleep studies', 'Polysomnography, home sleep apnea tests', 'PDF report and EDF upload', 'Sleep', 'file', 'go:sleep'],
    ['dexcom', 'metabolic', 'Dexcom CGM', 'G7, Stelo', 'Dexcom API (OAuth, partner approval)', 'Glucose readings (Console meanwhile)', 'partner', 'tab:api'],
    ['libre', 'metabolic', 'FreeStyle Libre', 'Libre 2, Libre 3', 'LibreView CSV export', 'Glucose readings through the Console', 'file', 'tab:console'],
    ['scale', 'body', 'Smart scales', 'Any Bluetooth Weight Scale or Body Composition device', 'Bluetooth Weight Scale and Body Composition profiles', 'Body composition, profile weight', 'ble', 'go:bodycomp'],
    ['hume', 'body', 'Hume Pod', 'Pod, Pod 2.0', "Through the Hume app's Apple Health sync (export.zip), CSV or quick entry", 'Body composition', 'file', 'go:bodycomp'],
    ['dexa', 'body', 'DEXA body-composition reports', 'Hospital and clinic DXA, body-composition studios', 'PDF report read on this device, pasted text, or by hand', 'Body composition', 'file', 'go:bodycomp'],
    ['withings', 'body', 'Withings', 'Body scales, BPM, Sleep Analyzer', 'Withings API (OAuth app keys)', 'Weight, blood pressure, sleep', 'partner', 'tab:api'],
    ['myochip', 'body', 'Myo chip (concept)', 'Implantable Myo sensor: ECG, temperature, motion, bio-impedance', 'Bluetooth LE with NFC pairing; design and protocol simulator only', 'Live sensors, Digital twin', 'planned', 'go:chip'],
    ['ultrasound', 'body', 'Ultrasound scanners', 'Cart and portable scanners with HDMI, VGA or S-video out; handheld probe apps', 'USB video capture, screen share, or an exported clip or image, on this device', 'Live ultrasound, Pregnancy, Blood flow', 'live', 'go:ultrasound'],
    ['doppler', 'cardio', 'Pocket vascular Dopplers', 'Any pocket Doppler with a headphone output or speaker', 'Line-in or microphone audio, or a recording', 'Blood flow: velocity, RI, PI, artery or vein pattern', 'live', 'go:flow'],
    ['dicom', 'body', 'Imaging (CT, MRI, DEXA)', 'Any DICOM export', 'DICOM folder import on this device', 'Imaging', 'live', 'go:imaging'],
    ['xray', 'body', 'X-ray Mirror overlays', 'Camera, video or demo', 'Live face and hand tracking', 'Vielight module and EEG electrode positions on your head', 'live', 'go:mirror'],
    ['machines', 'body', 'Merakinetics machines', 'APS Machine 2.0, ISO Flow, AR-Vision', 'BLE and MQTT (sample feed until hardware ships)', 'Machines, Training', 'live', 'go:machines'],
    ['ftms', 'body', 'Cardio machines', 'Bluetooth FTMS bikes, rowers, treadmills', 'Bluetooth FTMS profile', 'Machines', 'planned', 'go:machines'],
    ['stemwave', 'recovery', 'StemWave and shockwave sessions', 'StemWave, radial and focused shockwave at a provider (not affiliated)', 'Session log: area, pulses, setting, pain and function', 'Wave therapy', 'log', 'go:wave'],
    ['sauna', 'recovery', 'Saunas, plunges, cryochambers, HBOT', 'Any brand', 'Session log, or the Ingest API', 'Recovery', 'log', 'go:recovery'],
    ['labs', 'clinical', 'Lab results', 'Quest, Labcorp, any lab PDF', 'PDF or CSV on Biology; FHIR, HL7 or CSV in the Console', 'Biology markers', 'live', 'tab:console'],
    ['ehr', 'clinical', 'Health records (SMART on FHIR)', 'Epic, Oracle Health, athenahealth', 'SMART on FHIR app launch (registration per EHR)', 'Biology, Imaging', 'partner', 'tab:api']
  ];

  /* ── Vielight ── */
  const VL = [
    ['pro2', 'Neuro Pro 2', 'Transcranial modules plus intranasal; every module adjustable in the Vielight app, 9 ready protocols.', 'custom'],
    ['gamma4', 'Neuro Gamma 4', '810 nm near-infrared pulsed at 40 Hz; aimed at focus and memory.', 'gamma'],
    ['alpha4', 'Neuro Alpha 4', '810 nm near-infrared pulsed at 10 Hz; aimed at calm and sleep.', 'alpha'],
    ['duo4', 'Neuro Duo 4', 'Switches between Gamma (40 Hz) and Alpha (10 Hz).', 'choose'],
    ['vagus', 'Vagus', 'Light aimed at the vagus nerve; marketed for calm.', 'none'],
    ['xplus', 'X-Plus 4', 'Light over the thymus area; marketed for immune support.', 'none'],
    ['mip', 'MIP intranasal', 'Intranasal LED or laser pairs (633, 655 or 470 nm with 810 nm).', 'none']
  ];
  const VL_BY = Object.fromEntries(VL.map((v) => [v[0], v]));
  const MODE = { gamma: 'Gamma · 40 Hz', alpha: 'Alpha · 10 Hz', custom: 'Custom (Pro 2)' };

  /* ── codes: LOINC and Myo codes → markers and vitals ── */
  const LOINC = { '1884-6': 'apob', '13457-7': 'ldl', '18262-6': 'ldl', '2089-1': 'ldl', '2085-9': 'hdl', '2571-8': 'tg', '43583-4': 'lpa', '4548-4': 'a1c', '1558-6': 'glu', '2345-7': 'glu', '20448-7': 'ins', '30522-7': 'crp', '13965-9': 'hcy', '2986-8': 'tt', '2991-8': 'ft', '2143-6': 'cort', '3016-3': 'tsh', '3051-0': 'ft3', '62292-8': 'vitd', '1989-3': 'vitd', '2276-4': 'ferr', '2132-9': 'b12', '1742-6': 'alt', '33914-3': 'egfr', '62238-1': 'egfr', '98979-8': 'egfr', '718-7': 'hgb', '2157-6': 'ck' };
  const VITAL_LOINC = { '8867-4': 'hr', '40443-4': 'rhr', '80404-7': 'hrv', '8480-6': 'sys', '8462-4': 'dia', '29463-7': 'weight', '41982-0': 'bodyfat', '59408-5': 'spo2', '2708-6': 'spo2', '8310-5': 'temp', '9279-1': 'resp', '55423-8': 'steps', '93832-4': 'sleep_min', '2339-0': 'glucose', '15074-8': 'glucose' };
  const VITALS = { hr: ['Heart rate', 'bpm'], rhr: ['Resting heart rate', 'bpm'], hrv: ['HRV', 'ms'], sys: ['Systolic pressure', 'mmHg'], dia: ['Diastolic pressure', 'mmHg'], weight: ['Weight', 'kg'], bodyfat: ['Body fat', '%'], spo2: ['SpO₂', '%'], temp: ['Temperature', '°C'], resp: ['Respiratory rate', '/min'], steps: ['Steps', 'steps'], sleep_min: ['Sleep', 'min'], glucose: ['Glucose', 'mg/dL'] };
  // unit conversions into each marker's unit
  // same table as the server (supabase/functions/ingest/normalize.ts); supabase/tests/ingest.test.ts checks they agree
  const nu = (u) => String(u || '').toLowerCase().replace(/\s|\[|\]/g, '').replace(/µ|μ/g, 'u').replace('/1.73m2', '').replace('mm[hg]', 'mmhg').replace('mm(hg)', 'mmhg');
  const F = (x) => (x - 32) / 1.8;
  const CONV = {
    glu: { 'mmol/l': 18.016 }, glucose: { 'mmol/l': 18.016 }, ldl: { 'mmol/l': 38.67 }, hdl: { 'mmol/l': 38.67 }, tg: { 'mmol/l': 88.57 }, apob: { 'g/l': 100 },
    vitd: { 'nmol/l': 1 / 2.496 }, tt: { 'nmol/l': 28.85 }, ft: { 'pmol/l': 0.02885, 'pg/ml': 0.1 }, ft3: { 'pmol/l': 0.651 }, ins: { 'pmol/l': 1 / 6, 'mu/l': 1, 'miu/l': 1 },
    cort: { 'nmol/l': 0.03625 }, b12: { 'pmol/l': 1.355 }, ferr: { 'ug/l': 1 }, crp: { 'mg/dl': 10 }, hcy: { 'umol/l': 1 }, hgb: { 'g/l': 0.1 }, tsh: { 'uiu/ml': 1, 'mu/l': 1 },
    a1c: { 'mmol/mol': (x) => x / 10.929 + 2.15 }, weight: { lb: 0.45359237, lbs: 0.45359237, 'lb_av': 0.45359237, g: 0.001 },
    temp: { degf: F, '°f': F, f: F, cel: 1, degc: 1, c: 1 }, hr: { '/min': 1, 'beats/min': 1 }, rhr: { '/min': 1, 'beats/min': 1 }, spo2: { '%o2': 1 }, sys: { mmhg: 1 }, dia: { mmhg: 1 }
  };
  function convert(target, unit, want, v) {
    if (!unit || !want || nu(unit) === nu(want)) return { v };
    const c = (CONV[target] || {})[nu(unit)];
    if (c == null) return { v: null, err: `unit ${unit} can't be converted to ${want}` };
    return { v: Math.round((typeof c === 'function' ? c(v) : v * c) * 100) / 100, note: c === 1 ? undefined : `${unit} → ${want}` };
  }

  /* ── state ── */
  function ensure(s) {
    if (!s.medtech) s.medtech = { sessions: [], readings: [], audit: [], plan: 3 };
    const M = s.medtech; ['sessions', 'readings', 'audit'].forEach((k) => { if (!Array.isArray(M[k])) M[k] = []; });
    return M;
  }
  const cfg = () => window.MYO_CONFIG || {};
  const projectUrl = () => (cfg().supabaseUrl || (OS.auth && OS.auth.url) || '').replace(/\/$/, '');
  const apiBase = () => (cfg().ingestApi || (projectUrl() ? projectUrl() + '/functions/v1/ingest' : '')).replace(/\/$/, '');
  const base = () => apiBase() || 'https://<project-ref>.supabase.co/functions/v1/ingest';

  /* ── normalise any supported input into items ── */
  const isoDay = (t) => { if (!t) return dayKey(); const m = String(t).match(/^(\d{4})-?(\d{2})-?(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : dayKey(); };
  function codeTarget(system, code, display) {
    const c = String(code || '').trim(), sys = String(system || '').toLowerCase();
    if (/loinc|^ln$/.test(sys) || /^\d{1,6}-\d$/.test(c)) { if (LOINC[c]) return { marker: LOINC[c] }; if (VITAL_LOINC[c]) return { vital: VITAL_LOINC[c] }; }
    const k = c.toLowerCase();
    if (VITALS[k]) return { vital: k };
    const s = OS.state, mk = s && s.markers ? s.markers.find((m) => m.id === k) : null;
    if (mk) return { marker: mk.id };
    if (display && s && s.markers) { const d = String(display).toLowerCase().replace(/[^a-z0-9]/g, ''); const m2 = s.markers.find((m) => [m.name, ...m.aliases].some((a) => { const x = a.toLowerCase().replace(/[^a-z0-9]/g, ''); return x.length > 2 && (d === x || d.includes(x)); })); if (m2) return { marker: m2.id }; }
    return null;
  }
  function obsItem(o, src) {
    const t = codeTarget(o.system, o.code, o.display), v = typeof o.value === 'number' ? o.value : parseFloat(o.value);
    const it = { kind: 'observation', code: o.code, display: o.display || o.code, value: v, unit: o.unit || '', at: o.at || null, d: isoDay(o.at), src };
    if (!Number.isFinite(v)) return { ...it, err: 'value is not a number' };
    if (!t) return { ...it, err: `unknown code ${o.code}` };
    return { ...it, ...t };
  }
  function fromMyo(x, src) {
    if (!x || typeof x !== 'object') return [{ kind: '?', err: 'not an object' }];
    const s0 = x.source && (x.source.vendor || x.source.device) ? [x.source.vendor, x.source.device].filter(Boolean).join(' ') : src;
    if (x.type === 'observation') return [obsItem({ system: x.code && x.code.system, code: x.code && x.code.code, display: x.code && x.code.display, value: x.value, unit: x.unit, at: x.at }, s0)];
    if (x.type === 'session') { const min = +x.minutes; return [{ kind: 'session', sk: String(x.kind || '').toLowerCase(), device: x.device || '', mode: x.mode || (x.settings && x.settings.pulse_hz === 40 ? 'gamma' : x.settings && x.settings.pulse_hz === 10 ? 'alpha' : ''), min, at: x.start || null, d: isoDay(x.start), settings: x.settings || null, ratings: x.ratings || null, src: s0, err: !(min > 0 && min <= 600) ? 'minutes must be 1–600' : !x.kind ? 'kind is required' : null }]; }
    if (x.type === 'sleep') return [{ kind: 'sleep', d: x.date || isoDay(x.wake_at), bed: x.bed || null, wake: x.wake || null, total: +x.total_min || null, score: x.score ?? null, hrv: x.hrv ?? null, rhr: x.rhr ?? null, q: x.quality ?? null, src: s0, err: !x.date ? 'date is required' : !(x.total_min || (x.bed && x.wake)) ? 'total_min or bed and wake are required' : null }];
    if (x.type === 'meal') {   // keep in step with mealItem() in supabase/functions/ingest/normalize.ts
      const n = (v) => (v == null || v === '' ? null : Number(v)), sv = n(x.servings) ?? 1, kcal = n(x.kcal), p = n(x.protein_g) ?? 0, c = n(x.carbs_g) ?? 0, f = n(x.fat_g) ?? 0, r1 = (v) => Math.round(v * sv * 10) / 10;
      const err = !x.name || !String(x.name).trim() ? 'name is required' : kcal == null || !Number.isFinite(kcal) || kcal < 0 || kcal > 5000 ? 'kcal must be 0–5000' : [p, c, f].some((g) => !Number.isFinite(g) || g < 0 || g > 500) ? 'protein_g, carbs_g and fat_g must be 0–500' : !(sv > 0 && sv <= 10) ? 'servings must be more than 0 and at most 10' : null;
      return [{ kind: 'meal', name: String(x.name || '').slice(0, 80), d: (x.at || x.date) ? isoDay(x.at || x.date) : dayKey(), at: x.at || null, kcal: kcal == null ? null : Math.round(kcal * sv), p: r1(p), c: r1(c), f: r1(f), servings: sv, url: typeof x.recipe_url === 'string' && /^https:\/\//.test(x.recipe_url) ? x.recipe_url : null, src: s0, err }];
    }
    return [{ kind: '?', err: `unknown type "${x.type}"` }];
  }
  function fromFhir(r, src) {
    const out = [];
    const one = (o) => {
      if (!o || o.resourceType !== 'Observation') return;
      const when = o.effectiveDateTime || (o.effectivePeriod && o.effectivePeriod.start) || o.issued;
      const cod = (c) => { const cs = (c && c.coding) || []; return cs.find((x) => /loinc/i.test(x.system || '')) || cs[0] || {}; };
      if (o.valueQuantity) { const c = cod(o.code); out.push(obsItem({ system: c.system, code: c.code, display: c.display || (o.code && o.code.text), value: o.valueQuantity.value, unit: o.valueQuantity.unit || o.valueQuantity.code, at: when }, src)); }
      (o.component || []).forEach((cp) => { if (!cp.valueQuantity) return; const c = cod(cp.code); out.push(obsItem({ system: c.system, code: c.code, display: c.display, value: cp.valueQuantity.value, unit: cp.valueQuantity.unit || cp.valueQuantity.code, at: when }, src)); });
    };
    if (r.resourceType === 'Bundle') (r.entry || []).forEach((e) => one(e.resource)); else one(r);
    return out.length ? out : [{ kind: '?', err: 'no Observation with a value found' }];
  }
  function fromHl7(text, src) {
    const segs = text.replace(/\r\n?/g, '\r').replace(/\n/g, '\r').split('\r').map((x) => x.trim()).filter(Boolean), out = [];
    const msh = segs.find((x) => x.startsWith('MSH')); if (!msh) return [{ kind: '?', err: 'no MSH segment' }];
    const fs = msh[3], cs = msh[4] || '^';
    let obrAt = null;
    const ts = (v) => { const m = /^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?/.exec(v || ''); return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4] || '00'}:${m[5] || '00'}:00` : null; };
    segs.forEach((sg) => {
      const f = sg.split(fs);
      if (f[0] === 'OBR') obrAt = ts(f[7]);
      if (f[0] !== 'OBX') return; // PID and other identifying segments are never read
      if (f[2] && !/^(NM|SN)$/.test(f[2])) return;
      const id = (f[3] || '').split(cs), unit = (f[6] || '').split(cs)[0], val = f[2] === 'SN' ? (f[5] || '').split(cs).filter(Boolean).pop() : f[5];
      out.push(obsItem({ system: id[2] === 'LN' ? 'loinc' : id[2], code: id[0], display: id[1], value: val, unit, at: ts(f[14]) || obrAt }, src));
    });
    return out.length ? out : [{ kind: '?', err: 'no numeric OBX results' }];
  }
  function fromCsv(text, src) {
    let rows = text.split(/\r?\n/).filter((l) => l.trim());
    const sep = (rows[0] || '').includes(';') && !(rows[0] || '').includes(',') ? ';' : rows.join('').includes('\t') && !rows[0].includes(',') ? '\t' : ',';
    const split = (l) => l.split(sep).map((x) => x.trim().replace(/^"|"$/g, ''));
    // LibreView: a title line, then a header with "Device Timestamp" and "Historic Glucose"
    const li = rows.findIndex((l) => /device timestamp/i.test(l) && /glucose/i.test(l));
    if (li >= 0) {
      const h = split(rows[li]).map((x) => x.toLowerCase()), cT = h.findIndex((x) => x.includes('device timestamp')), cG = h.findIndex((x) => x.includes('historic glucose')), unit = /mmol/.test(h[cG]) ? 'mmol/L' : 'mg/dL';
      const out = rows.slice(li + 1).map(split).filter((r) => r[cG]).map((r) => { const m = /(\d{1,2})[-/](\d{1,2})[-/](\d{4})\s+(\d{1,2}):(\d{2})/.exec(r[cT]) || []; const at = m[3] ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}T${m[4].padStart(2, '0')}:${m[5]}:00` : r[cT]; return obsItem({ code: 'glucose', value: r[cG], unit, at }, src || 'LibreView'); });
      return out.length ? out : [{ kind: '?', err: 'no glucose rows' }];
    }
    const h = split(rows.shift() || '').map((x) => x.toLowerCase());
    const col = (re) => h.findIndex((x) => re.test(x));
    const cD = col(/^(date|time|timestamp|at|start)$/), cK = col(/^(kind|type|modality)$/), cM = col(/^(minutes|duration|min)$/), cC = col(/^(code|loinc|marker|name|test)$/), cV = col(/^(value|result)$/), cU = col(/^units?$/), cDev = col(/^device$/), cMode = col(/^mode$/);
    if (cK >= 0 && cM >= 0) return rows.map(split).map((r) => fromMyo({ type: 'session', kind: r[cK], minutes: r[cM], device: cDev >= 0 ? r[cDev] : '', mode: cMode >= 0 ? r[cMode] : '', start: cD >= 0 ? r[cD] : null }, src || 'CSV')[0]);
    if (cC >= 0 && cV >= 0) return rows.map(split).map((r) => obsItem({ code: r[cC], display: r[cC], value: r[cV], unit: cU >= 0 ? r[cU] : '', at: cD >= 0 ? r[cD] : null }, src || 'CSV'));
    return [{ kind: '?', err: 'CSV needs columns date, code, value, unit (results) or date, kind, minutes (sessions)' }];
  }
  function parseInput(text, fmt = 'auto', src = 'Console') {
    const t = String(text || '').trim(); if (!t) return [{ kind: '?', err: 'nothing to read' }];
    const f = fmt !== 'auto' ? fmt : t.startsWith('MSH') ? 'hl7' : /^[[{]/.test(t) ? 'json' : 'csv';
    if (f === 'hl7') return fromHl7(t, src);
    if (f === 'csv') return fromCsv(t, src);
    let j; try { j = JSON.parse(t); } catch (e) { return [{ kind: '?', err: 'JSON: ' + e.message }]; }
    if (j.resourceType) return fromFhir(j, src);
    const list = Array.isArray(j) ? j : Array.isArray(j.items) ? j.items : [j];
    if (list.length > 500) return [{ kind: '?', err: 'at most 500 items per request' }];
    return list.flatMap((x) => (x && x.resourceType ? fromFhir(x, src) : fromMyo(x, src)));
  }
  const REC_K = { sauna: 'sauna', infrared: 'infrared', bath: 'bath', plunge: 'plunge', cold: 'plunge', cold_plunge: 'plunge', shower: 'shower', cryo: 'cryo', cryotherapy: 'cryo', contrast: 'contrast', red_light: 'redlight', redlight: 'redlight', compression: 'compression', percussion: 'percussion', float: 'float', pemf: 'pemf', hbot: 'hbot', hyperbaric: 'hbot' };
  function target(it, s) {
    if (it.err) return { ok: false, to: it.err };
    if (it.kind === 'observation' && it.marker) { const m = s.markers.find((x) => x.id === it.marker); if (!m) return { ok: false, to: 'marker not found' }; const c = convert(it.marker, it.unit, m.unit, it.value); if (c.v != null && !OS.plausible(it.marker, c.v)) return { ok: false, to: `${m.name} ${c.v} ${m.unit} is outside any possible range` }; return c.v == null ? { ok: false, to: c.err } : { ok: true, to: `Biology › ${m.name}`, v: c.v, u: m.unit, note: c.note }; }
    if (it.kind === 'observation' && it.vital) { const [n, u] = VITALS[it.vital]; const c = convert(it.vital, it.unit, u, it.value); return c.v == null ? { ok: false, to: c.err } : { ok: true, to: `Vitals › ${n}`, v: c.v, u, note: c.note }; }
    if (it.kind === 'session') { if (it.sk === 'pbm' || it.sk === 'photobiomodulation') return { ok: true, to: 'Integrations › Vielight sessions', v: it.min, u: 'min' }; const k = REC_K[it.sk]; return k ? { ok: true, to: `Recovery › ${k}`, v: it.min, u: 'min' } : { ok: false, to: `unknown session kind "${it.sk}"` }; }
    if (it.kind === 'sleep') return { ok: true, to: 'Sleep › diary', v: it.total, u: 'min' };
    if (it.kind === 'meal') return { ok: true, to: 'Fuel › meals', v: it.kcal, u: 'kcal' };
    return { ok: false, to: 'not supported' };
  }
  function applyItems(items, srcName) {
    let n = 0;
    OS.update((s) => {
      const M = ensure(s);
      items.forEach((it) => {
        const t = target(it, s); if (!t.ok) return; n++;
        if (it.kind === 'observation' && it.marker) { const m = s.markers.find((x) => x.id === it.marker); m.value = t.v; m.history = (m.history || []).filter((h) => h[0] !== it.d); m.history.push([it.d, t.v]); m.history.sort((a, b) => a[0].localeCompare(b[0])); if (it.d > (s.labsDate || '')) s.labsDate = it.d; s.labsImported = s.labsImported || it.d; }
        else if (it.kind === 'observation') {
          M.readings.push({ at: it.at || new Date().toISOString(), k: it.vital, v: t.v, u: t.u, src: it.src });
          if (it.vital === 'rhr') s.vitals.rhr = Math.round(t.v); if (it.vital === 'hrv') s.vitals.hrv = Math.round(t.v); if (it.vital === 'weight' && s.profile) s.profile.weightKg = Math.round(t.v * 10) / 10;
          if (it.vital === 'steps' && it.d === dayKey()) s.vitals.steps = Math.round(t.v);
          if (it.vital === 'sys' || it.vital === 'dia') { s.vitals.bp = { ...(s.vitals.bp || {}), [it.vital]: Math.round(t.v), at: it.at || new Date().toISOString() }; }
        } else if (it.kind === 'session' && (it.sk === 'pbm' || it.sk === 'photobiomodulation')) {
          const dn = String(it.device || '').toLowerCase(), dev = VL.find((v) => dn.includes(v[1].toLowerCase().replace(/ \d$/, '').replace('neuro ', '').split(' ')[0])) || null;
          const mode = it.mode || (dev && ['gamma', 'alpha', 'custom'].includes(dev[3]) ? dev[3] : '');
          M.sessions.push({ at: it.at || new Date().toISOString(), d: it.d, dev: dev ? dev[0] : 'other', devName: it.device || 'Light therapy device', mode, min: it.min, before: it.ratings && it.ratings.before || null, after: it.ratings && it.ratings.after || null, src: it.src });
        } else if (it.kind === 'session') { if (!s.recovery) s.recovery = { logs: [], screen: {} }; (s.recovery.logs = s.recovery.logs || []).push({ d: it.d, k: REC_K[it.sk], min: it.min, temp: null, src: it.src }); }
        else if (it.kind === 'sleep') {
          if (!s.sleep) s.sleep = { study: null, diary: [], reports: [], recs: [], signs: {} };
          const n0 = { d: it.d, bed: it.bed, wake: it.wake, out: it.wake, sol: 0, waso: 0, q: it.q, src: 'api' };
          if (it.total && it.bed && it.wake && OS.sleep) { const t0 = OS.sleep.nightStats(n0); if (t0) n0.waso = Math.max(0, t0.tib - it.total); }
          const st = OS.sleep ? OS.sleep.nightStats(n0) : null;
          s.sleep.diary = (s.sleep.diary || []).filter((x) => x.d !== it.d); s.sleep.diary.push(st ? { ...n0, ...st } : { ...n0, tst: it.total });
        }
        else if (it.kind === 'meal') {
          const day = (s.nutrition.meals[it.d] = s.nutrition.meals[it.d] || []);
          day.push({ id: OS.uid(), name: it.name, kcal: it.kcal || 0, p: it.p || 0, c: it.c || 0, f: it.f || 0, src: it.src || 'partner', url: it.url || null });
        }
      });
      M.readings = M.readings.slice(-500); M.sessions = M.sessions.slice(-500);
      M.audit.unshift({ at: new Date().toISOString(), src: srcName, n, kinds: [...new Set(items.filter((i) => !i.err).map((i) => i.kind))] }); M.audit = M.audit.slice(0, 40);
    }, { keepSample: true });
    return n;
  }

  /* ── hosted Ingest API (supabase/functions/ingest): keys, webhooks, inbox ── */
  const R = { state: 'unknown', keys: null, hooks: null, newKey: null, newHook: null, busy: '', err: '', pulling: false, lastPull: null };
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { /* private mode */ } return null; };
  const apiReady = () => !!(apiBase() && OS.auth && OS.auth.user);
  async function api(method, path, body) {
    const t = OS.auth && await OS.auth.token(); if (!t) throw new Error('Sign in to your Myo account on the Profile page first.');
    let r; try { r = await fetch(apiBase() + path, { method, headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); }
    catch (e) { R.state = 'down'; throw new Error("Couldn't reach the Ingest API. It may not be deployed yet."); }
    R.state = r.status === 404 && path === '/v1/keys' ? 'down' : 'ok';
    if (r.status === 429) throw new Error('Too many requests. Try again in a minute.');
    const j = r.status === 204 ? {} : await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.detail || `Ingest API error ${r.status}.`);
    return j;
  }
  // server item → the shape applyItems takes
  const fromServer = (x) => x.kind === 'observation' ? { kind: 'observation', marker: x.marker, vital: x.vital, value: x.value, unit: x.unit, d: x.d, at: x.at, display: x.display, code: x.code, src: x.src || x.source }
    : x.kind === 'session' ? { kind: 'session', sk: x.sk, device: x.device, mode: x.mode, min: x.min, d: x.d, at: x.at, ratings: x.ratings, src: x.src || x.source }
    : x.kind === 'meal' ? { kind: 'meal', name: x.name, d: x.d, at: x.at, kcal: x.kcal, p: x.p, c: x.c, f: x.f, servings: x.servings, url: x.url, src: x.src || x.source }
    : { kind: 'sleep', d: x.d, bed: x.bed, wake: x.wake, total: x.total, score: x.score, hrv: x.hrv, rhr: x.rhr, q: x.q, src: x.src || x.source };
  async function pullInbox(manual) {
    if (!apiReady() || R.pulling) return;
    R.pulling = true; let total = 0;
    try {
      const seen = new Set(JSON.parse(ls('myo-ingest-applied') || '[]'));
      for (let guard = 0; guard < 10; guard++) {
        const j = await api('GET', '/v1/inbox?limit=200'), items = j.items || [];
        if (!items.length) break;
        const fresh = items.filter((x) => !seen.has(x.id)); // applied before but not acknowledged: never apply twice
        if (fresh.length) {
          applyItems(fresh.map(fromServer), 'Ingest API');
          const touched = new Set(fresh.filter((x) => x.marker).map((x) => x.marker));
          OS.state.markers.filter((m) => touched.has(m.id)).forEach((m) => { const e = OS.markerEval ? OS.markerEval(m) : null; if (e && e.status === 'bad') emitEvent('marker.out_of_range', { marker: m.id, name: m.name, value: m.value, unit: m.unit }); });
        }
        items.forEach((x) => seen.add(x.id)); ls('myo-ingest-applied', JSON.stringify([...seen].slice(-3000)));
        await api('POST', '/v1/inbox/ack', { ids: items.map((x) => x.id) });
        total += fresh.length; if (!j.more) break;
      }
      R.lastPull = { at: Date.now(), n: total }; R.err = '';
      if (total) { OS.toast(`${total} item${total === 1 ? '' : 's'} arrived through the Ingest API.`); emitScore(); }
      else if (manual) OS.toast('Inbox is empty.');
    } catch (e) { R.err = e.message; if (manual) OS.toast(e.message); }
    finally { R.pulling = false; if (manual && R.keys) loadRemote(true); else if (OS.current === 'connect') OS.render(); }
  }
  const hooksOn = () => Number(ls('myo-ingest-hooks') || 0) > 0;
  async function emitEvent(event, data) { if (!apiReady() || !hooksOn()) return; try { await api('POST', '/v1/events', { event, data }); } catch (e) { /* webhooks are best effort */ } }
  function emitScore() { try { const sc = OS.scores && OS.scores(OS.state); if (!sc || String(sc.mk) === ls('myo-ingest-lastmk')) return; ls('myo-ingest-lastmk', String(sc.mk)); emitEvent('score.updated', { mk: sc.mk, readiness: sc.readiness }); } catch (e) { /* scores unavailable */ } }
  async function loadRemote(force) {
    if (!apiReady() || R.busy || (!force && R.keys)) return;
    R.busy = 'load';
    try { R.keys = (await api('GET', '/v1/keys')).keys; R.hooks = (await api('GET', '/v1/webhooks')).webhooks; ls('myo-ingest-hooks', String(R.hooks.filter((h) => !h.disabled).length)); R.err = ''; }
    catch (e) { R.err = e.message; }
    finally { R.busy = ''; if (OS.current === 'connect') OS.render(); }
  }
  if (typeof document !== 'undefined') { setTimeout(() => pullInbox(false), 8000); setInterval(() => pullInbox(false), 5 * 60e3); }

  /* ── Bluetooth GATT health profiles ── */
  const sfloat = (v) => { if ([0x07ff, 0x0800, 0x07fe, 0x0802, 0x0801].includes(v)) return null; let m = v & 0x0fff, e = v >> 12; if (m >= 0x0800) m -= 0x1000; if (e >= 8) e -= 16; return m * Math.pow(10, e); };
  const float32 = (v) => { let m = v & 0xffffff, e = (v >>> 24) & 0xff; if ([0x7fffff, 0x800000, 0x7ffffe, 0x800002, 0x800001].includes(m)) return null; if (m >= 0x800000) m -= 0x1000000; if (e >= 128) e -= 256; return m * Math.pow(10, e); };
  const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
  function parseHR(dv) { const f = dv.getUint8(0); let o = 1; const hr = f & 1 ? dv.getUint16(o, true) : dv.getUint8(o); o += f & 1 ? 2 : 1; if (f & 8) o += 2; const rr = []; if (f & 16) for (; o + 1 < dv.byteLength; o += 2) rr.push(dv.getUint16(o, true) * 1000 / 1024); return { hr, rr }; }
  function parseBP(dv) { const f = dv.getUint8(0), k = f & 1 ? 7.50062 : 1; const sys = sfloat(dv.getUint16(1, true)), dia = sfloat(dv.getUint16(3, true)); let o = 7; if (f & 2) o += 7; const pulse = f & 4 ? sfloat(dv.getUint16(o, true)) : null; return { sys: sys == null ? null : Math.round(sys * k), dia: dia == null ? null : Math.round(dia * k), pulse: pulse == null ? null : Math.round(pulse) }; }
  function parseWeight(dv) { const f = dv.getUint8(0), raw = dv.getUint16(1, true); if (raw === 0xffff) return { kg: null }; return { kg: r1(f & 1 ? raw * 0.01 * 0.45359237 : raw * 0.005) }; }
  function parsePLX(dv) { return { spo2: r1(sfloat(dv.getUint16(1, true))), pulse: r1(sfloat(dv.getUint16(3, true))) }; }
  function parseTemp(dv) { const f = dv.getUint8(0), t = float32(dv.getUint32(1, true)); return { c: t == null ? null : r1(f & 1 ? (t - 32) / 1.8 : t) }; }
  function rmssd(rr) { const v = rr.filter((x) => x > 300 && x < 2000), d = []; for (let i = 1; i < v.length; i++) if (Math.abs(v[i] - v[i - 1]) < v[i - 1] * 0.2) d.push((v[i] - v[i - 1]) ** 2); return d.length > 10 ? Math.round(Math.sqrt(d.reduce((a, b) => a + b, 0) / d.length)) : null; }
  const BLE = {
    hr: { name: 'Heart rate', sub: 'Chest strap or armband', svc: 0x180d, ch: [0x2a37], parse: parseHR },
    bp: { name: 'Blood pressure', sub: 'Upper-arm or wrist cuff', svc: 0x1810, ch: [0x2a35], parse: parseBP },
    scale: { name: 'Weight', sub: 'Smart scale', svc: 0x181d, ch: [0x2a9d], parse: parseWeight },
    oxi: { name: 'Pulse oximeter', sub: 'Finger clip', svc: 0x1822, ch: [0x2a5f, 0x2a5e], parse: parsePLX },
    temp: { name: 'Temperature', sub: 'Thermometer', svc: 0x1809, ch: [0x2a1c], parse: parseTemp }
  };
  const live = {}; // k → { dev, name, last, hrs: [], rr: [], t0 }
  const bleOk = () => !!(navigator.bluetooth && navigator.bluetooth.requestDevice);
  async function bleConnect(k) {
    const P = BLE[k];
    try {
      const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: [P.svc] }] });
      const srv = await dev.gatt.connect(), svc = await srv.getPrimaryService(P.svc);
      live[k] = { dev, name: dev.name || P.name, last: null, hrs: [], rr: [], t0: Date.now() };
      let n = 0;
      for (const id of P.ch) { try { const c = await svc.getCharacteristic(id); await c.startNotifications(); c.addEventListener('characteristicvaluechanged', (e) => onValue(k, e.target.value)); n++; } catch (e) { /* the device may offer only one of the characteristics */ } }
      if (!n) throw new Error('This device does not send standard measurements.');
      dev.addEventListener('gattserverdisconnected', () => { if (live[k]) { finishHr(k); delete live[k]; if (OS.current === 'connect') OS.render(); } });
      OS.toast(`${live[k].name} connected. ${k === 'hr' ? 'Live heart rate below.' : 'Take a measurement on the device.'}`);
    } catch (e) { if (e && e.name !== 'NotFoundError') OS.toast(e.message || 'Bluetooth connection failed.'); }
    if (OS.current === 'connect') OS.render();
  }
  function bleStop(k) { const L = live[k]; if (!L) return; finishHr(k); try { L.dev.gatt.disconnect(); } catch (e) { /* already gone */ } delete live[k]; OS.render(); }
  function finishHr(k) {
    const L = live[k]; if (k !== 'hr' || !L || L.hrs.length < 10) return;
    const avg = Math.round(L.hrs.reduce((a, b) => a + b, 0) / L.hrs.length), lo = Math.min(...L.hrs), rm = rmssd(L.rr), min = Math.round((Date.now() - L.t0) / 6e4);
    OS.update((s) => { ensure(s).readings.push({ at: new Date().toISOString(), k: 'hr', v: avg, u: 'bpm', lo, hrv: rm, min, src: L.name }); }, { keepSample: true, render: false });
  }
  function onValue(k, dv) {
    const L = live[k]; if (!L) return;
    const v = BLE[k].parse(dv); L.last = v;
    if (k === 'hr') { if (v.hr > 25 && v.hr < 240) L.hrs.push(v.hr); L.rr.push(...v.rr); if (L.rr.length > 600) L.rr.splice(0, L.rr.length - 600); }
    else {
      const rec = k === 'bp' ? [['sys', v.sys, 'mmHg'], ['dia', v.dia, 'mmHg'], ['hr', v.pulse, 'bpm']] : k === 'scale' ? [['weight', v.kg, 'kg']] : k === 'oxi' ? [['spo2', v.spo2, '%'], ['hr', v.pulse, 'bpm']] : [['temp', v.c, '°C']];
      const now = new Date().toISOString();
      OS.update((s) => { const M = ensure(s); rec.filter((r) => r[1] != null).forEach(([kk, val, u]) => M.readings.push({ at: now, k: kk, v: val, u, src: L.name })); if (k === 'bp' && v.sys) s.vitals.bp = { sys: v.sys, dia: v.dia, at: now }; }, { keepSample: true, render: OS.current === 'connect' });
    }
    const el = document.querySelector(`[data-live="${k}"]`); if (el) el.textContent = liveText(k, v);
    if (k === 'hr') { const h = document.querySelector('[data-live="hrv"]'); if (h) { const r = rmssd(L.rr); h.textContent = r ? `${r} ms` : 'collecting…'; } }
  }
  const liveText = (k, v) => !v ? 'waiting…' : k === 'hr' ? `${v.hr} bpm` : k === 'bp' ? `${v.sys}/${v.dia} mmHg${v.pulse ? ' · ' + v.pulse + ' bpm' : ''}` : k === 'scale' ? `${v.kg} kg` : k === 'oxi' ? `${v.spo2}% · ${v.pulse} bpm` : `${v.c} °C`;
  function flag(k, v) {
    if (k === 'bp' && (v.sys >= 180 || v.dia >= 120)) return 'Very high. If you have chest pain, shortness of breath, weakness, or vision or speech changes, call emergency services now. Otherwise rest 5 minutes, measure again, and call your doctor if it stays this high.';
    if (k === 'oxi' && v.spo2 != null && v.spo2 < 92) return 'Low. Warm your hand, sit still and measure again. If it stays below 92% or you are short of breath, get medical help.';
    return null;
  }

  /* ── API reference ── */
  const EX = {
    observation: { type: 'observation', code: { system: 'http://loinc.org', code: '2085-9', display: 'HDL cholesterol' }, value: 58, unit: 'mg/dL', at: '2026-11-18T08:10:00Z', source: { vendor: 'Example Lab' } },
    vital: { items: [{ type: 'observation', code: { system: 'myo', code: 'rhr' }, value: 52, unit: 'bpm', at: '2026-11-22T06:40:00Z', source: { vendor: 'Polar', device: 'H10' } }, { type: 'observation', code: { system: 'http://loinc.org', code: '29463-7' }, value: 179.4, unit: 'lb', at: '2026-11-22T06:45:00Z', source: { vendor: 'Withings' } }] },
    session: { items: [{ type: 'session', kind: 'pbm', device: 'Vielight Neuro Gamma 4', mode: 'gamma', start: '2026-11-22T07:30:00Z', minutes: 20, settings: { wavelength_nm: 810, pulse_hz: 40 }, ratings: { before: { focus: 3, calm: 3 }, after: { focus: 4, calm: 4 } }, source: { vendor: 'Vielight' } }, { type: 'session', kind: 'sauna', start: '2026-11-22T18:00:00Z', minutes: 15, source: { vendor: 'Clinic' } }] },
    sleep: { type: 'sleep', date: '2026-11-22', bed: '23:05', wake: '06:50', total_min: 412, score: 84, hrv: 61, rhr: 52, quality: 4, source: { vendor: 'Example sleep tracker' } },
    meal: { type: 'meal', name: 'Chicken, rice and greens', at: '2026-11-24T12:30:00-05:00', servings: 1, kcal: 640, protein_g: 52, carbs_g: 68, fat_g: 16, recipe_url: 'https://example.com/recipes/chicken-rice', source: { vendor: 'Example meal-prep kitchen' } },
    fhir: { resourceType: 'Bundle', type: 'collection', entry: [{ resource: { resourceType: 'Observation', status: 'final', code: { coding: [{ system: 'http://loinc.org', code: '4548-4', display: 'Hemoglobin A1c' }] }, valueQuantity: { value: 5.3, unit: '%' }, effectiveDateTime: '2026-11-18' } }, { resource: { resourceType: 'Observation', status: 'final', code: { coding: [{ system: 'http://loinc.org', code: '85354-9', display: 'Blood pressure panel' }] }, component: [{ code: { coding: [{ system: 'http://loinc.org', code: '8480-6' }] }, valueQuantity: { value: 118, unit: 'mm[Hg]' } }, { code: { coding: [{ system: 'http://loinc.org', code: '8462-4' }] }, valueQuantity: { value: 76, unit: 'mm[Hg]' } }], effectiveDateTime: '2026-11-21T07:00:00Z' } }] },
    hl7: 'MSH|^~\\&|LAB|EXAMPLE|MYO|MK|202611180915||ORU^R01|MSG0001|P|2.5.1\rOBR|1||A1|24331-1^Lipid panel^LN|||202611180800\rOBX|1|NM|2085-9^HDL Cholesterol^LN||58|mg/dL|>40|N|||F\rOBX|2|NM|2571-8^Triglyceride^LN||1.1|mmol/L|<1.7|N|||F\rOBX|3|NM|1989-3^Vitamin D 25-OH^LN||88|nmol/L|75-250|N|||F',
    csv: 'date,code,value,unit\n2026-11-18,hdl,58,mg/dL\n2026-11-18,vitd,41,ng/mL\n2026-11-22,rhr,52,bpm',
    csvs: 'date,kind,device,minutes,mode\n2026-11-20,pbm,Neuro Gamma 4,20,gamma\n2026-11-21,sauna,,15,\n2026-11-21,plunge,,3,'
  };
  const EP = [
    ['POST', '/v1/observations', 'Lab results and vitals, one item or a batch of up to 500', 'observation', 'observations:write', 'application/json'],
    ['POST', '/v1/observations', 'Vitals from devices (Myo codes or LOINC; pounds convert to kg)', 'vital', 'observations:write', 'application/json'],
    ['POST', '/v1/sessions', 'Device and therapy sessions: photobiomodulation, sauna, cold, cryo, HBOT, red light', 'session', 'sessions:write', 'application/json'],
    ['POST', '/v1/sleep', 'Nightly sleep summaries from any tracker', 'sleep', 'sleep:write', 'application/json'],
    ['POST', '/v1/meals', 'Meals from meal-prep companies and food apps: calories and macros per serving', 'meal', 'meals:write', 'application/json'],
    ['POST', '/v1/fhir', 'FHIR R4 Bundle or Observation with LOINC codes, panels included', 'fhir', 'fhir:write', 'application/fhir+json'],
    ['POST', '/v1/hl7', 'HL7 v2 ORU^R01 lab messages; identifying segments (PID) are dropped', 'hl7', 'hl7:write', 'text/plain'],
    ['POST', '/v1/csv', 'CSV of results (date, code, value, unit) or sessions (date, kind, minutes)', 'csv', 'csv:write', 'text/csv']
  ];
  function sample(lang, ep) {
    const url = base() + ep[1], body = EX[ep[3]], text = typeof body === 'string', file = text ? (ep[3] === 'hl7' ? 'result.hl7' : 'data.csv') : 'payload.json';
    if (lang === 'curl') return ['curl -X POST "' + url + '" \\', '  -H "Authorization: Bearer $MYO_KEY" \\', '  -H "Content-Type: ' + ep[5] + '" \\', '  -H "Idempotency-Key: $(uuidgen)" \\', '  --data-binary @' + file].join('\n');
    if (lang === 'js') return ['const res = await fetch("' + url + '", {', '  method: "POST",', '  headers: {', '    Authorization: "Bearer " + process.env.MYO_KEY,', '    "Content-Type": "' + ep[5] + '",', '    "Idempotency-Key": crypto.randomUUID()', '  },', '  body: ' + (text ? 'payloadText' : 'JSON.stringify(payload)'), '});', 'const { accepted, rejected } = await res.json();'].join('\n');
    return ['import os, uuid, requests', 'r = requests.post(', '    "' + url + '",', '    headers={"Authorization": "Bearer " + os.environ["MYO_KEY"],', '             "Content-Type": "' + ep[5] + '",', '             "Idempotency-Key": str(uuid.uuid4())},', '    ' + (text ? 'data=payload_text.encode()' : 'json=payload') + ')', 'print(r.json())  # {"accepted": n, "rejected": [...]}'].join('\n');
  }
  const exText = (k) => (typeof EX[k] === 'string' ? EX[k] : JSON.stringify(EX[k], null, 2));

  /* ── view ── */
  let tab = 'cat', cat = 'all', lang = 'curl', cFmt = 'auto', cText = '', parsed = null;
  try { tab = localStorage.getItem('myo-connect-tab') || 'cat'; } catch (e) { /* default */ }
  const TABS = [['cat', 'Catalogue'], ['vielight', 'Vielight'], ['ble', 'Bluetooth'], ['api', 'API'], ['console', 'Console']];

  OS.register('connect', {
    title: 'Integrations', icon: 'link',
    render(s) {
      const M = ensure(s), liveN = INTEG.filter((x) => ['live', 'ble'].includes(x[6])).length;
      const body = { cat: tCat, vielight: tVl, ble: tBle, api: tApi, console: tCon }[tab] || tCat;
      return `${OS.ui.head('More · integrations', 'Integrations', 'Connect medical devices, wearables, labs and records. Every source lands in the same places: Biology, Sleep, Recovery and your vitals.',
        `<div class="hstat"><span>Ready to connect</span><b class="num">${liveN} of ${INTEG.length}</b></div><div class="hstat"><span>Readings</span><b class="num">${M.readings.length}</b></div><div class="hstat"><span>Light sessions</span><b class="num">${M.sessions.length}</b></div>`)}
        <div class="seg ig-tabs" role="tablist" aria-label="Integrations">${TABS.map(([k, n]) => `<button type="button" role="tab" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}" data-act="ig-tab" data-t="${k}">${n}</button>`).join('')}</div>
        ${body(s, M)}`;
    },
    mount(root) {
      const onIn = (e) => { if (e.target.id === 'ig-text') cText = e.target.value; };
      root.addEventListener('input', onIn);
      Object.keys(live).forEach((k) => { const el = root.querySelector(`[data-live="${k}"]`); if (el && live[k].last) el.textContent = liveText(k, live[k].last); });
      return () => root.removeEventListener('input', onIn);
    }
  });

  function tCat() {
    // builds can leave pages out (the public build has no X-ray Mirror): hide cards that would link nowhere
    const list = INTEG.filter((x) => (cat === 'all' || x[1] === cat) && !(x[7] && x[7].startsWith('go:') && !OS.views[x[7].slice(3)]));
    return `<section class="card"><div class="card-h"><h2>Device and data catalogue</h2><div class="seg" role="group" aria-label="Category">${CAT.map(([k, n]) => `<button type="button" class="${cat === k ? 'on' : ''}" data-act="ig-cat" data-k="${k}">${n}</button>`).join('')}</div></div>
      <div class="ig-grid">${list.map(([k, , n, ex, how, to, st, act]) => `<article class="ig-card st-${st}"><div class="ig-ch"><b>${esc(n)}</b>${pill(...ST[st])}</div><span class="small muted">${esc(ex)}</span>
        <dl><div><dt>Connects by</dt><dd>${esc(how)}</dd></div><div><dt>Lands in</dt><dd>${esc(to)}</dd></div></dl>
        ${act ? `<button type="button" class="btn ghost sm" data-act="ig-open" data-a="${act}">${act.startsWith('tab:') ? (st === 'partner' ? 'See the API' : 'Open') : 'Go to page'}</button>` : '<span class="fine">Comes with the native apps</span>'}</article>`).join('')}</div>
      <p class="fine">"Needs partner keys" means the vendor issues API access to approved companies; Myo's adapters follow the same pattern as the Oura and WHOOP proxy. Myo is a wellness app: device readings support tracking and conversations with your clinician, not diagnosis.</p></section>`;
  }

  function vlStats(s, M) {
    const ss = M.sessions, days = new Set(ss.map((x) => x.d));
    const W = s.wear || {}, wd = [...((W.oura && W.oura.days) || []), ...((W.whoop && W.whoop.days) || [])];
    const next = (d) => { const t = new Date(d + 'T12:00:00'); t.setDate(t.getDate() + 1); return dayKey(t); };
    const after = wd.filter((x) => days.has(x.d) || [...days].some((d) => next(d) === x.d)), other = wd.filter((x) => !after.includes(x));
    const avg = (xs, f) => { const v = xs.map(f).filter((n) => n != null && Number.isFinite(n)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const rated = ss.filter((x) => x.before && x.after);
    const dF = avg(rated, (x) => x.after.focus - x.before.focus), dC = avg(rated, (x) => x.after.calm - x.before.calm);
    const wk = ss.filter((x) => (Date.now() - Date.parse(x.d)) / 864e5 < 7).length;
    return { n: ss.length, wk, rated: rated.length, dF, dC, cmp: after.length >= 5 && other.length >= 5 ? [['Sleep score', avg(after, (x) => x.sleepScore), avg(other, (x) => x.sleepScore), ''], ['HRV', avg(after, (x) => x.hrv), avg(other, (x) => x.hrv), ' ms'], ['Readiness', avg(after, (x) => x.score), avg(other, (x) => x.score), '']] : null, nA: after.length, nO: other.length };
  }
  function tVl(s, M) {
    const st = vlStats(s, M), last = M.sessions.slice(-8).reverse(), f1 = (x) => (x == null ? '—' : (x > 0 ? '+' : '') + x.toFixed(1));
    return `<div class="grid g-2-1">
      <section class="card"><div class="card-h"><h2>Log a Vielight session</h2><span class="muted small">Photobiomodulation</span></div>
        <form data-submit="vl-log" class="form-grid">
          <label class="field"><span>Device</span><select name="dev" data-change="vl-dev">${VL.map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('')}</select></label>
          <label class="field"><span>Mode</span><select name="mode"><option value="gamma">Gamma · 40 Hz</option><option value="alpha">Alpha · 10 Hz</option><option value="custom">Custom (Pro 2)</option><option value="">Not applicable</option></select></label>
          <label class="field"><span>Date</span><input name="d" type="date" value="${dayKey()}"></label>
          <label class="field"><span>Minutes</span><input name="min" type="number" min="1" max="120" value="20"></label>
          <label class="field"><span>Focus before (1–5)</span><input name="fb" type="number" min="1" max="5" value="3"></label>
          <label class="field"><span>Focus after (1–5)</span><input name="fa" type="number" min="1" max="5" value="3"></label>
          <label class="field"><span>Calm before (1–5)</span><input name="cb" type="number" min="1" max="5" value="3"></label>
          <label class="field"><span>Calm after (1–5)</span><input name="ca" type="number" min="1" max="5" value="3"></label>
          <div class="form-end"><button class="btn sm">Save session</button></div></form>
        <div class="ig-vl">${VL.map(([k, n, d]) => `<div><b>${esc(n)}</b><span class="small muted">${esc(d)}</span></div>`).join('')}</div>
        <p class="fine">Default Neuro sessions run about 20 minutes; follow your device's guide. Vielight states its technology is not FDA approved, and research on light therapy for the brain is early. Ask your doctor first if you have a neurological condition or are pregnant.</p></section>
      <section class="card"><div class="card-h"><h2>Your response</h2>${pill(st.wk >= M.plan ? 'good' : 'muted', `${st.wk} of ${M.plan} this week`)}</div>
        <dl class="ig-kv"><div><dt>Sessions</dt><dd class="num">${st.n}</dd></div><div><dt>Focus change</dt><dd class="num">${f1(st.dF)}</dd></div><div><dt>Calm change</dt><dd class="num">${f1(st.dC)}</dd></div></dl>
        ${st.cmp ? `<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th></th><th>After a session</th><th>Other days</th></tr></thead><tbody>${st.cmp.map(([n, a, b, u]) => `<tr><td>${n}</td><td class="num">${a == null ? '—' : Math.round(a) + u}</td><td class="num">${b == null ? '—' : Math.round(b) + u}</td></tr>`).join('')}</tbody></table></div><p class="fine">${st.nA} days after sessions vs ${st.nO} other days, from your ring or strap. A difference only counts if it holds for weeks.</p>`
          : `<p class="small muted">Log sessions and sync a ring or strap: after 5 days with and 5 without sessions, Myo compares your sleep score, HRV and readiness.</p>`}
        <label class="field-inline small">Plan <input type="number" min="1" max="14" value="${M.plan}" data-change="vl-plan" class="ig-plan"> sessions a week</label>
        ${OS.views.mirror ? `<div class="row"><button class="btn ghost sm" data-act="vl-xray">${icon('mirror', 14)} See module positions on your head</button></div>` : ''}
        ${last.length ? `<ul class="ig-log">${last.map((x) => `<li><span class="num muted small">${esc(x.d)}</span><b>${esc(VL_BY[x.dev] ? VL_BY[x.dev][1] : x.devName)}</b><span class="small">${x.min} min${x.mode && MODE[x.mode] ? ' · ' + MODE[x.mode] : ''}${x.before && x.after ? ` · focus ${x.before.focus}→${x.after.focus}, calm ${x.before.calm}→${x.after.calm}` : ''}</span></li>`).join('')}</ul>` : ''}
      </section></div>
      <section class="card"><div class="card-h"><h2>Direct sync</h2>${pill('warn', 'Needs Vielight partnership')}</div>
        <p class="small">Vielight has no public API. The Neuro Pro 2 app and the Vielight-AI platform hold session data; a partner API or export would let Myo import sessions on its own. Until then, sessions come from this form, a CSV (date, kind, device, minutes, mode) in the Console, or <code>POST /v1/sessions</code> with <code>kind: "pbm"</code> from any system that has them.</p></section>`;
  }

  function tBle(s, M) {
    const ok = bleOk(), recent = M.readings.slice(-10).reverse();
    return `${ok ? '' : '<div class="banner" role="note"><strong>Bluetooth isn\'t available here.</strong> Live device connections need Chrome or Edge on a computer or Android phone, on the hosted Myo (Claude\'s viewer and iPhone browsers block Web Bluetooth). Readings can still come in through the Console or the API.</div>'}
      <div class="ig-ble">${Object.entries(BLE).map(([k, P]) => { const L = live[k]; const fl = L && L.last ? flag(k, L.last) : null; return `<section class="card ig-bc ${L ? 'on' : ''}"><div class="card-h"><h2>${P.name}</h2>${L ? pill('good', 'Connected') : pill('muted', 'Standard profile')}</div>
        <span class="small muted">${P.sub} · service 0x${P.svc.toString(16).toUpperCase()}</span>
        ${L ? `<div class="ig-live"><b class="num" data-live="${k}">${L.last ? liveText(k, L.last) : 'waiting…'}</b>${k === 'hr' ? `<span class="small">HRV (RMSSD) <b class="num" data-live="hrv">${rmssd(L.rr) ? rmssd(L.rr) + ' ms' : 'collecting…'}</b></span>` : ''}<span class="fine">${esc(L.name)}</span></div>${fl ? `<p class="small ig-flag">${esc(fl)}</p>` : ''}
          <div class="row"><button class="btn ghost sm" data-act="ble-stop" data-k="${k}">Disconnect</button>${k === 'hr' ? '<span class="fine">Sit still for 2–5 minutes for a resting reading.</span>' : ''}</div>`
          : `<button class="btn sm" data-act="ble-go" data-k="${k}" ${ok ? '' : 'disabled'}>${icon('link', 14)} Connect</button>`}</section>`; }).join('')}</div>
      <section class="card"><div class="card-h"><h2>Recent readings</h2><span class="muted small">${M.readings.length} stored on this device</span></div>
        ${recent.length ? `<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>When</th><th>Reading</th><th>Value</th><th>From</th><th></th></tr></thead><tbody>${recent.map((r, i) => `<tr><td class="num">${esc(new Date(r.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</td><td>${esc((VITALS[r.k] || [r.k])[0])}${r.min ? ` · ${r.min} min` : ''}</td><td class="num">${r.v} ${esc(r.u || '')}${r.hrv ? ` · HRV ${r.hrv} ms` : ''}</td><td class="small">${esc(r.src || '')}</td><td>${r.k === 'hr' && r.lo ? `<button class="link small" data-act="ig-use" data-i="${M.readings.length - 1 - i}">Use as resting</button>` : r.k === 'weight' ? `<button class="link small" data-act="ig-use" data-i="${M.readings.length - 1 - i}">Set my weight</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`
          : '<p class="muted small">No readings yet. Connect a device, or send them through the Console or API.</p>'}
        <p class="fine">Myo decodes the Bluetooth SIG health profiles (IEEE-11073 values) on this device. Proprietary devices that skip these profiles need their vendor's API.</p></section>`;
  }

  const SCOPE_TXT = { 'observations:write': 'Lab results and vitals', 'sessions:write': 'Therapy sessions', 'sleep:write': 'Sleep', 'meals:write': 'Meals', 'fhir:write': 'FHIR', 'hl7:write': 'HL7 lab messages', 'csv:write': 'CSV files' };
  const EVT_TXT = { 'score.updated': 'Myo Score changes', 'marker.out_of_range': 'A marker goes out of range', 'session.logged': 'A light session is logged' };
  const when = (t) => (t ? new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
  function tRemote() {
    if (!apiBase()) return `<section class="card"><div class="card-h"><h2>Connect a system</h2>${pill('muted', 'Needs your Supabase project')}</div><p class="small">Partner systems send data with integration keys you create here. Set up member sign-in (Profile) on the hosted Myo and deploy the API with <code>supabase/deploy.ps1</code>; then keys and webhooks appear here.</p></section>`;
    if (!(OS.auth && OS.auth.user)) return `<section class="card"><div class="card-h"><h2>Connect a system</h2>${pill('muted', 'Sign in first')}</div><p class="small">Sign in on the Profile page to create integration keys and webhooks.</p><button class="btn sm" data-act="go" data-to="profile">Go to Profile</button></section>`;
    if (!R.keys && !R.busy && !R.err) setTimeout(() => loadRemote(false), 0);
    const st = R.state === 'ok' ? pill('good', 'Connected') : R.state === 'down' ? pill('warn', 'Not reachable') : pill('muted', 'Checking…');
    return `<div class="grid g-2">
      <section class="card"><div class="card-h"><h2>Integration keys</h2>${st}</div>
        ${R.err ? `<p class="small ig-flag">${esc(R.err)}</p>` : ''}
        ${R.newKey ? `<div class="ig-secret" role="alert"><b>Copy this key now. It won't be shown again.</b><div class="row"><input readonly value="${esc(R.newKey.key)}" aria-label="New integration key" class="ig-sec-in"><button class="btn sm" data-act="ig-copy" data-v="${esc(R.newKey.key)}">Copy</button></div><span class="fine">${esc(R.newKey.name)} · ${R.newKey.scopes.map((x) => esc(SCOPE_TXT[x] || x)).join(', ')}. Store it in that system's secret store.</span><button class="link small" data-act="ig-hide">Done</button></div>` : ''}
        ${R.keys && R.keys.length ? `<ul class="ig-keys">${R.keys.map((k) => `<li class="${k.revoked_at ? 'off' : ''}"><div><b>${esc(k.name)}</b><code>${esc(k.prefix)}…</code></div><span class="small muted">${k.scopes.map((x) => esc(SCOPE_TXT[x] || x)).join(' · ')}</span><span class="fine">Created ${esc(when(k.created_at))} · last used ${esc(when(k.last_used_at))}${k.revoked_at ? ' · revoked' : ''}</span>${k.revoked_at ? '' : `<button class="link small ${R.confirm === k.id ? 'ig-danger' : ''}" data-act="ig-revoke" data-id="${esc(k.id)}">${R.confirm === k.id ? 'Click again to revoke: it stops working at once' : 'Revoke'}</button>`}</li>`).join('')}</ul>` : R.keys ? '<p class="small muted">No keys yet.</p>' : '<p class="small muted">Loading…</p>'}
        <form data-submit="ig-newkey" class="ig-form"><label class="field"><span>System name</span><input name="name" maxlength="60" placeholder="e.g. Clinic EHR, Withings bridge" required></label>
          <fieldset><legend class="small muted">It may send</legend>${Object.entries(SCOPE_TXT).map(([k, n]) => `<label class="ped-use"><input type="checkbox" name="scope" value="${k}" ${k === 'observations:write' ? 'checked' : ''}> ${n}</label>`).join('')}</fieldset>
          <button class="btn sm" ${R.busy ? 'disabled' : ''}>Create key</button></form></section>
      <section class="card"><div class="card-h"><h2>Webhooks and inbox</h2><button class="btn ghost sm" data-act="ig-pull" ${R.pulling ? 'disabled' : ''}>${R.pulling ? 'Checking…' : 'Check inbox now'}</button></div>
        <p class="small muted">Items from your keys reach this device automatically every few minutes${R.lastPull ? `; last check ${esc(when(R.lastPull.at))}, ${R.lastPull.n} new` : ''}.</p>
        ${R.newHook ? `<div class="ig-secret" role="alert"><b>Signing secret, shown once.</b><div class="row"><input readonly value="${esc(R.newHook.secret)}" aria-label="Webhook signing secret" class="ig-sec-in"><button class="btn sm" data-act="ig-copy" data-v="${esc(R.newHook.secret)}">Copy</button></div><span class="fine">Verify the X-Myo-Signature header with it.</span><button class="link small" data-act="ig-hide">Done</button></div>` : ''}
        ${R.hooks && R.hooks.length ? `<ul class="ig-keys">${R.hooks.map((h) => `<li class="${h.disabled ? 'off' : ''}"><div><b class="ig-url">${esc(h.url)}</b></div><span class="small muted">${h.events.map((e) => esc(EVT_TXT[e] || e)).join(' · ')}</span><span class="fine">${h.disabled ? 'Paused after repeated failures' : h.last_status ? `Last answer ${h.last_status} at ${esc(when(h.last_sent_at))}` : 'Not called yet'}</span><span class="row"><button class="link small" data-act="ig-htest" data-id="${esc(h.id)}">Send test</button><button class="link small" data-act="ig-hdel" data-id="${esc(h.id)}">Delete</button></span></li>`).join('')}</ul>` : ''}
        <form data-submit="ig-newhook" class="ig-form"><label class="field"><span>Your https endpoint</span><input name="url" type="url" placeholder="https://example.com/myo-webhook" required></label>
          <fieldset><legend class="small muted">Send when</legend>${Object.entries(EVT_TXT).map(([k, n]) => `<label class="ped-use"><input type="checkbox" name="event" value="${k}" checked> ${n}</label>`).join('')}</fieldset>
          <button class="btn sm" ${R.busy ? 'disabled' : ''}>Add webhook</button></form></section></div>`;
  }
  function tApi() {
    return `${tRemote()}<div class="grid g-2-1">
      <section class="card"><div class="card-h"><h2>Myo Ingest API v1</h2>${R.state === 'ok' ? pill('good', 'Live') : pill('warn', apiBase() ? 'Deploy pending' : 'Not deployed yet')}</div>
        <p class="small">One API for any system that wants to send data to a member's Myo: device makers, clinics, labs, EHRs and the member's own scripts. Each system gets its own key from the card above. Data lands in the member's inbox and appears in Myo within minutes. The Console accepts the same payloads on this device.</p>
        <div class="ig-base"><span class="small muted">Base URL</span><code>${esc(base())}</code></div>
        <div class="seg" role="group" aria-label="Code language">${[['curl', 'curl'], ['js', 'JavaScript'], ['py', 'Python']].map(([k, n]) => `<button type="button" class="${lang === k ? 'on' : ''}" data-act="ig-lang" data-k="${k}">${n}</button>`).join('')}</div>
        <div class="ig-eps">${EP.map((ep, i) => `<details class="ig-ep" ${i === 0 ? 'open' : ''}><summary><span class="ig-m">${ep[0]}</span><code>${esc(ep[1])}</code><span class="small">${esc(ep[2])}</span></summary>
          <div class="ig-epb"><div><span class="small muted">Body · ${esc(ep[5])} · scope <code>${esc(ep[4])}</code></span><pre class="ig-pre">${esc(exText(ep[3]))}</pre></div>
          <div><span class="small muted">Request</span><pre class="ig-pre">${esc(sample(lang, ep))}</pre><button type="button" class="btn ghost sm" data-act="ig-try" data-k="${ep[3]}">Try it in the Console</button></div></div></details>`).join('')}</div></section>
      <section class="card"><div class="card-h"><h2>Rules</h2></div><ul class="ath-list">
        <li><b>Auth:</b> <code>Authorization: Bearer &lt;key&gt;</code>. Each integration gets its own key, limited to the scopes it needs, and the member can revoke it.</li>
        <li><b>Idempotency:</b> send <code>Idempotency-Key</code>; a repeat within 24 h returns the first answer.</li>
        <li><b>Answer:</b> <code>202 {"accepted": n, "rejected": [{"index", "error"}]}</code>. Errors: 400 bad payload, 401 key, 403 scope, 409 key reused with a different body, 413 over 1 MB or 500 items, 422 unknown code or unit, 429 rate limit (60 a minute) with <code>Retry-After</code>.</li>
        <li><b>Codes:</b> LOINC for labs and vitals, or Myo codes (marker ids such as <code>hdl</code>, <code>vitd</code>; vitals such as <code>rhr</code>, <code>hrv</code>, <code>weight</code>). Units convert to Myo's (mmol/L, nmol/L, pounds, °F).</li>
        <li><b>Privacy:</b> no names or record numbers; HL7 PID segments and FHIR Patient resources are discarded. Health data from clinics needs a BAA and the member's consent.</li>
        <li><b>Webhooks out:</b> <code>POST /v1/webhooks</code> subscribes a URL to <code>score.updated</code>, <code>marker.out_of_range</code>, <code>session.logged</code>. Each call carries <code>X-Myo-Signature: t=&lt;unix&gt;,v1=&lt;HMAC-SHA256 of "t.body"&gt;</code>; reject if older than 5 minutes.</li></ul></section></div>`;
  }

  function tCon(s, M) {
    const rows = parsed ? parsed.map((it) => ({ it, t: target(it, s) })) : null, okN = rows ? rows.filter((r) => r.t.ok).length : 0;
    return `<div class="grid g-2-1">
      <section class="card"><div class="card-h"><h2>Ingest console</h2><span class="muted small">Validated and applied on this device</span></div>
        <div class="row ig-ctl"><label class="field-inline small">Format <select data-change="ig-fmt">${[['auto', 'Detect'], ['json', 'Myo JSON or FHIR'], ['hl7', 'HL7 v2'], ['csv', 'CSV']].map(([k, n]) => `<option value="${k}" ${cFmt === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label class="btn ghost sm file">${icon('upload', 14)} Open file<input type="file" accept=".json,.txt,.hl7,.csv,.xml,application/json,text/plain,text/csv" data-change="ig-file"></label>
          <span class="small muted">Examples:</span>${[['observation', 'Lab JSON'], ['vital', 'Vitals'], ['session', 'Sessions'], ['sleep', 'Sleep'], ['fhir', 'FHIR'], ['hl7', 'HL7'], ['csv', 'CSV']].map(([k, n]) => `<button type="button" class="chip-btn" data-act="ig-try" data-k="${k}">${n}</button>`).join('')}</div>
        <textarea id="ig-text" class="ig-text" spellcheck="false" placeholder="Paste Myo JSON, a FHIR Bundle, an HL7 ORU message or CSV">${esc(cText)}</textarea>
        <div class="row"><button class="btn sm" data-act="ig-check">Validate</button>${rows && okN ? `<button class="btn sm" data-act="ig-apply">Apply ${okN} item${okN > 1 ? 's' : ''}</button>` : ''}${rows ? '<button class="btn ghost sm" data-act="ig-clear">Clear</button>' : ''}</div>
        ${rows ? `<div class="tbl-wrap"><table class="tbl compact ig-prev"><thead><tr><th></th><th>Item</th><th>Value</th><th>Goes to</th></tr></thead><tbody>${rows.map(({ it, t }) => `<tr class="${t.ok ? '' : 'bad'}"><td>${t.ok ? pill('good', 'OK') : pill('bad', 'Skip')}</td><td>${esc(it.kind === 'observation' ? (it.display || it.code) : it.kind === 'session' ? `${it.sk} session` : it.kind === 'sleep' ? `Sleep ${it.d}` : 'Unreadable')}<span class="block fine">${esc(it.d || '')}${it.src ? ' · ' + esc(it.src) : ''}</span></td><td class="num">${it.value != null ? esc(String(it.value)) + ' ' + esc(it.unit || '') : it.min ? it.min + ' min' : it.total ? it.total + ' min' : ''}${t.note ? `<span class="block fine">${esc(t.note)}: ${t.v} ${esc(t.u)}</span>` : ''}</td><td class="small">${esc(t.to)}</td></tr>`).join('')}</tbody></table></div>` : ''}</section>
      <section class="card"><div class="card-h"><h2>Recent imports</h2></div>
        ${M.audit.length ? `<ul class="ig-log">${M.audit.slice(0, 10).map((a) => `<li><span class="num muted small">${esc(new Date(a.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</span><b>${a.n} item${a.n === 1 ? '' : 's'}</b><span class="small">${esc(a.src)} · ${esc(a.kinds.join(', '))}</span></li>`).join('')}</ul>` : '<p class="muted small">Nothing imported yet.</p>'}
        <p class="fine">Names, dates of birth and record numbers in pasted data are ignored and never stored.</p></section></div>`;
  }

  /* ── actions ── */
  OS.act('ig-tab', (el) => { tab = el.dataset.t; try { localStorage.setItem('myo-connect-tab', tab); } catch (e) { /* ok */ } OS.render(); });
  OS.act('ig-cat', (el) => { cat = el.dataset.k; OS.render(); });
  OS.act('ig-lang', (el) => { lang = el.dataset.k; OS.render(); });
  OS.act('ig-open', (el) => { const a = el.dataset.a; if (a.startsWith('tab:')) { tab = a.slice(4); OS.render(); window.scrollTo({ top: 0 }); } else OS.go(a.slice(3)); });
  OS.act('ig-try', (el) => { cText = exText(el.dataset.k); cFmt = 'auto'; parsed = null; tab = 'console'; OS.render(); });
  OS.change('ig-fmt', (el) => { cFmt = el.value; });
  OS.change('ig-file', async (el) => { const f = el.files && el.files[0]; el.value = ''; if (!f) return; if (f.size > 1e6) { OS.toast('Files up to 1 MB.'); return; } cText = await f.text(); parsed = parseInput(cText, cFmt, f.name); OS.render(); });
  OS.act('ig-check', () => { const ta = document.getElementById('ig-text'); if (ta) cText = ta.value; parsed = parseInput(cText, cFmt); OS.render(); });
  OS.act('ig-apply', () => { if (!parsed) return; const n = applyItems(parsed, 'Console'); parsed = null; OS.toast(`Applied ${n} item${n === 1 ? '' : 's'}.`); });
  OS.act('ig-clear', () => { parsed = null; cText = ''; OS.render(); });
  OS.act('ble-go', (el) => bleConnect(el.dataset.k));
  OS.act('ble-stop', (el) => bleStop(el.dataset.k));
  OS.act('ig-use', (el) => { const s = OS.state, r = ensure(s).readings[+el.dataset.i]; if (!r) return; OS.update((st) => { if (r.k === 'hr') { st.vitals.rhr = r.lo || r.v; if (r.hrv) st.vitals.hrv = r.hrv; } if (r.k === 'weight' && st.profile) st.profile.weightKg = r.v; }, { keepSample: true }); OS.toast(r.k === 'hr' ? 'Resting heart rate updated.' : 'Weight updated.'); });
  OS.act('ig-newkey', async (f) => {
    const name = f.elements.name.value.trim(), scopes = [...f.querySelectorAll('input[name=scope]:checked')].map((x) => x.value);
    if (!scopes.length) { OS.toast('Pick at least one kind of data.'); return; }
    R.busy = 'key'; OS.render();
    try { R.newKey = await api('POST', '/v1/keys', { name, scopes }); R.keys = null; } catch (e) { OS.toast(e.message); }
    R.busy = ''; await loadRemote(true);
  });
  OS.act('ig-revoke', async (el) => { if (R.confirm !== el.dataset.id) { R.confirm = el.dataset.id; OS.render(); return; } R.confirm = null; try { await api('DELETE', '/v1/keys/' + el.dataset.id); OS.toast('Key revoked.'); } catch (e) { OS.toast(e.message); } await loadRemote(true); });
  OS.act('ig-newhook', async (f) => {
    const url = f.elements.url.value.trim(), events = [...f.querySelectorAll('input[name=event]:checked')].map((x) => x.value);
    if (!events.length) { OS.toast('Pick at least one event.'); return; }
    R.busy = 'hook'; OS.render();
    try { R.newHook = await api('POST', '/v1/webhooks', { url, events }); } catch (e) { OS.toast(e.message); }
    R.busy = ''; await loadRemote(true);
  });
  OS.act('ig-htest', async (el) => { try { const r = await api('POST', `/v1/webhooks/${el.dataset.id}/test`); OS.toast(r.status ? `Your endpoint answered ${r.status}.` : 'Your endpoint did not answer.'); } catch (e) { OS.toast(e.message); } await loadRemote(true); });
  OS.act('ig-hdel', async (el) => { try { await api('DELETE', '/v1/webhooks/' + el.dataset.id); } catch (e) { OS.toast(e.message); } await loadRemote(true); });
  OS.act('ig-copy', async (el) => { try { await navigator.clipboard.writeText(el.dataset.v); OS.toast('Copied.'); } catch (e) { const i = el.parentElement.querySelector('input'); if (i) { i.select(); OS.toast('Selected: press Ctrl+C or Cmd+C.'); } } });
  OS.act('ig-hide', () => { R.newKey = null; R.newHook = null; OS.render(); });
  OS.act('ig-pull', () => pullInbox(true));
  OS.act('vl-log', (f) => {
    const e = f.elements, dev = e.dev.value, min = +e.min.value, cl = (x) => Math.max(1, Math.min(5, +x || 3));
    if (!(min >= 1 && min <= 120)) { OS.toast('Minutes should be 1–120.'); return; }
    OS.update((s) => { ensure(s).sessions.push({ at: new Date().toISOString(), d: e.d.value || dayKey(), dev, devName: VL_BY[dev][1], mode: e.mode.value, min, before: { focus: cl(e.fb.value), calm: cl(e.cb.value) }, after: { focus: cl(e.fa.value), calm: cl(e.ca.value) }, src: 'Myo' }); }, { keepSample: true });
    OS.toast('Session saved.');
    emitEvent('session.logged', { kind: 'pbm', device: VL_BY[dev][1], minutes: min, date: e.d.value || dayKey() });
  });
  OS.change('vl-dev', (el) => { const m = el.form && el.form.elements.mode, d = VL_BY[el.value]; if (m && d) m.value = d[3] === 'gamma' || d[3] === 'alpha' || d[3] === 'custom' ? d[3] : d[3] === 'choose' ? 'gamma' : ''; });
  OS.change('vl-plan', (el) => OS.update((s) => { ensure(s).plan = Math.max(1, Math.min(14, +el.value || 3)); }, { keepSample: true }));
  OS.act('vl-xray', () => { if (OS.XR && OS.XR.setOverlay) OS.XR.setOverlay('vielight'); OS.go('mirror'); });

  OS.connect = { open(k) { tab = k; try { localStorage.setItem('myo-connect-tab', k); } catch (e) { /* ok */ } if (OS.current === 'connect') OS.render(); else OS.go('connect'); }, parseInput, target, applyItems, sfloat, float32, parseHR, parseBP, parseWeight, parsePLX, parseTemp, rmssd, convert };
})();
