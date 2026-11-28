/* ═══ MYO — CASE ASSESSMENT: the standard process a Myo provider or coach follows to assess a member ═══
   Assess   · six steps: safety screen → data check → findings, each linked to the record it came from → priorities
              (impact, confidence, modifiable) → plan and referral → sign-off into a case record
   Agent    · Myo AI can draft the assessment, inside limits it can't override (the model QAI Cloud uses for agents):
              read-only typed tools, a cap on tool calls and time, a sealed copy of this one member's data, and a
              decision record of every step. Findings that cite no record are rejected; diagnosis or dosing language
              is flagged. A person always signs off.
   Evidence · PubMed (NCBI) and openFDA medicine labels and adverse-event reports, every figure linked to its record and
              a source that fails shown as a failure (as QAI Health does). Dosing sections are never shown.
   Records  · saved case records with their decision logs, printable
   Wellness assessment for coaching, not diagnosis. Safety items stop the process and send the member to care. */
(function () {
  'use strict';
  const { esc, icon, pill, clamp, dayKey, addDays, fmtDate, uid } = OS;
  const TABS = [['assess', 'Assess'], ['agent', 'Myo AI draft'], ['evidence', 'Evidence'], ['records', 'Case records']];
  const CS = { tab: 'assess', step: 0, pick: null, notes: '', by: '', role: 'Coach', agent: null, ev: { q: '', pub: null, med: null, busy: false } };
  const STEPS = ['Safety', 'Data', 'Findings', 'Priorities', 'Plan', 'Sign-off'];
  const RED = { 'Chest pain or pressure': 'chest', 'Shortness of breath': 'breath', 'Fainting or near-fainting': 'faint', 'Face drooping, arm weakness or speech trouble': 'stroke', 'Thoughts of harming yourself': 'harm' };
  const GROUP = { apob: 'lipids', ldl: 'lipids', hdl: 'lipids', tg: 'lipids', lpa: 'lipids', a1c: 'glucose', glu: 'glucose', ins: 'glucose', crp: 'inflammation', hcy: 'inflammation', tt: 'hormones', ft: 'hormones', cort: 'hormones', tsh: 'thyroid', ft3: 'thyroid', vitd: 'vitd', ferr: 'iron', b12: 'nutrients', mg: 'nutrients', o3: 'nutrients', alt: 'organ', egfr: 'organ', hgb: 'blood', ck: 'muscle' };
  const MODS = { bp: ['heart', 'flow', 'care'], lipids: ['biology', 'longevity', 'fuel'], glucose: ['biology', 'fuel', 'training'], inflammation: ['biology', 'recovery', 'sleep'], hormones: ['biology', 'sleep', 'training'], thyroid: ['biology', 'care'], vitd: ['biology', 'env'], iron: ['biology', 'fuel', 'cycle'], nutrients: ['biology', 'kitchen'], organ: ['biology', 'care'], blood: ['biology', 'care'], muscle: ['biology', 'recovery'],
    sleep: ['sleep', 'recovery'], recovery: ['recovery', 'training', 'sleep'], activity: ['training', 'motion', 'env'], protein: ['fuel', 'kitchen', 'food'], mood: ['mind', 'life', 'care'], stress: ['mind', 'recovery', 'life'], body: ['bodycomp', 'training', 'fuel'], cycle: ['cycle', 'care'], symptom: ['logbook', 'care'], longevity: ['longevity', 'insights'] };
  const LABEL = { bp: 'Blood pressure', lipids: 'Blood fats (lipids)', glucose: 'Blood sugar', inflammation: 'Inflammation', hormones: 'Hormones', thyroid: 'Thyroid', vitd: 'Vitamin D', iron: 'Iron stores', nutrients: 'Nutrients', organ: 'Liver and kidney', blood: 'Blood count', muscle: 'Muscle', sleep: 'Sleep', recovery: 'Recovery', activity: 'Daily activity', protein: 'Protein intake', mood: 'Mood', stress: 'Stress', body: 'Body composition', cycle: 'Menstrual cycle', symptom: 'Recurring symptom', longevity: 'Biological age', safety: 'Safety' };

  /* ── the rule engine: the same rules for every member, every finding linked to its record ── */
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const daysAgo = (d) => (d ? Math.round((Date.now() - new Date(`${String(d).slice(0, 10)}T12:00:00`).getTime()) / 864e5) : null);
  function assess(s) {
    const sc = OS.scores(s), A = { safety: [], inventory: [], findings: [], records: {}, sample: !!s.sample };
    const rec = (id, area, page, label, value, date) => { A.records[id] = { id, area, page, label, value: String(value), date: date || null }; return id; };
    const since = (n) => dayKey(addDays(new Date(), -n));
    // 1 · safety
    (sc.redFlags || []).forEach((f) => A.safety.push({ area: f.id === 'bp' ? 'bp-crisis' : `lab:${f.id}`, level: 'now', text: `${f.name} ${f.value} ${f.unit || ''}`.trim(), why: f.why, src: [rec(`flag:${f.id}`, 'safety', f.id === 'bp' || f.id === 'rhr' ? 'heart' : 'biology', f.name, `${f.value} ${f.unit || ''}`.trim(), s.labsDate)] }));
    (s.symptoms || []).filter((r) => r.at.slice(0, 10) >= since(14)).forEach((r) => {
      const red = RED[r.sym];
      if (red || r.sev >= 8) A.safety.push({ area: red || 'symptom', level: red ? 'now' : 'soon', text: `${r.sym} (${r.sev}/10) on ${fmtDate(r.at.slice(0, 10))}`, why: red ? 'A red-flag symptom: urgent care comes before any coaching' : 'A severe symptom needs a clinician to look at it', src: [rec(`sym:${r.at}`, 'safety', 'logbook', r.sym, `${r.sev}/10`, r.at.slice(0, 10))] });
    });
    ((s.emergency && s.emergency.log) || []).filter((r) => r.kind === 'seizure' && r.at.slice(0, 10) >= since(30)).forEach((r) => A.safety.push({ area: 'seizure', level: 'soon', text: `Seizure lasting ${Math.round(r.dur / 60 * 10) / 10} min on ${fmtDate(r.at.slice(0, 10))}`, why: 'Recent seizures need medical follow-up', src: [rec(`sz:${r.at}`, 'safety', 'emergency', 'Seizure', `${r.dur} s`, r.at.slice(0, 10))] }));
    if (s.pregnancy && s.pregnancy.moves && s.pregnancy.moves[dayKey(new Date())] === 'less') A.safety.push({ area: 'movement', level: 'now', text: 'Baby moving less than usual today', why: 'The maternity unit must be contacted now', src: [rec('preg:moves', 'safety', 'pregnancy', 'Movements', 'less than usual', dayKey(new Date()))] });
    // 2 · data inventory
    const mk = s.markers.filter((m) => OS.hasValue(m)), labAge = daysAgo(s.labsDate), W = s.wear || {}, wdays = ['oura', 'whoop'].reduce((a, p) => a + ((W[p] && W[p].days) || []).length, 0);
    const diary = ((s.sleep && s.sleep.diary) || []).filter((r) => r.d >= since(14)), moods = Object.entries((s.life && s.life.mood) || {}).filter(([d]) => d >= since(14)), meals = Object.entries((s.nutrition && s.nutrition.meals) || {}).filter(([d, ms]) => d >= since(7) && (ms || []).length);
    const train = ((s.training && s.training.log) || []).filter((r) => r.date >= since(14)), bc = ((s.bodycomp && s.bodycomp.scans) || []).filter((x) => !x.sample || s.sample), L = (s.enhance && s.enhance.labs) || {};
    A.inventory = [
      ['Labs', mk.length > 0, mk.length ? `${mk.length} markers · ${labAge != null ? `${labAge} days old` : 'date unknown'}${labAge > 365 ? ' · older than a year' : ''}` : 'None', 'biology'],
      ['Wearable days', wdays > 0 || !!(s.vitals && s.vitals.hrv), wdays ? `${wdays} days` : s.vitals && s.vitals.hrv ? 'Current vitals only' : 'None', 'wearables'],
      ['Blood pressure', !!(L.sbp && L.dbp), L.sbp && L.dbp ? `${L.sbp}/${L.dbp} mmHg` : 'None', 'heart'],
      ['Sleep diary, 14 days', diary.length > 0, `${diary.length} nights`, 'sleep'], ['Check-ins, 14 days', moods.length > 0, `${moods.length} days`, 'life'],
      ['Food log, 7 days', meals.length > 0, `${meals.length} days`, 'fuel'], ['Training, 14 days', train.length > 0, `${train.length} sessions`, 'training'],
      ['Body composition', bc.length > 0, bc.length ? `${bc.length} scans` : 'None', 'bodycomp'], ['Symptoms, 30 days', true, `${(s.symptoms || []).filter((r) => r.at.slice(0, 10) >= since(30)).length} logged`, 'logbook']
    ].map(([area, have, detail, page]) => ({ area, have, detail, page }));
    if ((sc.suspect || []).length) A.inventory.push({ area: 'Values set aside', have: false, detail: `${sc.suspect.length} impossible value${sc.suspect.length > 1 ? 's' : ''} to correct`, page: 'biology' });
    const conf = labAge == null ? 0.6 : labAge > 365 ? 0.5 : labAge > 180 ? 0.8 : 1;
    const F = (area, title, detail, sev, src, o = {}) => A.findings.push({ id: `${area}:${A.findings.length}`, area, title, detail, sev, src, refer: !!o.refer, mod: o.mod !== false, conf: o.conf || 1, modules: MODS[area] || [] });
    // 3 · findings
    const warnByGroup = {};
    (sc.flagged || []).forEach(({ m, e }) => {
      if (!OS.hasValue(m)) return; const g = GROUP[m.id] || 'labs', last = (m.history && m.history.length && m.history[m.history.length - 1][0]) || s.labsDate;
      const id = rec(`lab:${m.id}`, g, 'biology', m.name, `${m.value} ${m.unit}`, last);
      if (e.status === 'bad') F(g, `${m.name} outside its reference range`, `${m.name} ${m.value} ${m.unit}; reference ${fmtRange(m.normal)} ${m.unit}`, 3, [id], { refer: true, conf });
      else if (e.status === 'warn') (warnByGroup[g] = warnByGroup[g] || []).push([m, id]);
    });
    Object.entries(warnByGroup).forEach(([g, xs]) => F(g, `${LABEL[g] || g}: in range, not yet optimal`, xs.map(([m]) => `${m.name} ${m.value} ${m.unit}`).join(' · '), 1, xs.map((x) => x[1]), { conf }));
    if (L.sbp && L.dbp && !(L.sbp >= 180 || L.dbp >= 120)) { const id = rec('vital:bp', 'bp', 'heart', 'Blood pressure', `${L.sbp}/${L.dbp} mmHg`, null);
      if (L.sbp >= 140 || L.dbp >= 90) F('bp', 'Blood pressure in a high range', `${L.sbp}/${L.dbp} mmHg (140/90 or above)`, 3, [id], { refer: true });
      else if (L.sbp >= 130 || L.dbp >= 80) F('bp', 'Blood pressure above the healthy range', `${L.sbp}/${L.dbp} mmHg (130/80 to 139/89)`, 2, [id]); }
    const wd = ['oura', 'whoop'].flatMap((p) => ((W[p] && W[p].days) || [])).filter((x) => x.d >= since(7)), sl = wd.map((x) => x.sleepH).filter((v) => v != null).concat(diary.filter((r) => r.d >= since(7) && r.tst).map((r) => r.tst / 60));
    const sleepH = sl.length ? avg(sl) : s.vitals && s.vitals.sleepH;
    if (sleepH != null) { const id = rec('vital:sleep', 'sleep', 'sleep', 'Sleep, 7-day average', `${sleepH.toFixed(1)} h`, null); if (sleepH < 6) F('sleep', 'Short sleep', `${sleepH.toFixed(1)} h a night on average; adults need 7 or more`, 3, [id]); else if (sleepH < 7) F('sleep', 'Sleep below 7 hours', `${sleepH.toFixed(1)} h a night on average`, 2, [id]); }
    const V = s.vitals || {};
    if (V.hrv && V.hrvBase && V.hrv < V.hrvBase * 0.85) F('recovery', 'HRV below personal baseline', `HRV ${V.hrv} ms against a baseline of ${V.hrvBase} ms (${Math.round((1 - V.hrv / V.hrvBase) * 100)}% lower)`, 2, [rec('vital:hrv', 'recovery', 'wearables', 'HRV', `${V.hrv} ms (baseline ${V.hrvBase})`, null)]);
    if (V.rhr && V.rhrBase && V.rhr >= V.rhrBase + 5) F('recovery', 'Resting heart rate above baseline', `${V.rhr} bpm against ${V.rhrBase} bpm`, 2, [rec('vital:rhr', 'recovery', 'wearables', 'Resting heart rate', `${V.rhr} bpm (baseline ${V.rhrBase})`, null)]);
    if (V.steps != null) { const id = rec('vital:steps', 'activity', 'today', 'Steps', `${V.steps}/day`, null); if (V.steps < 5000) F('activity', 'Low daily activity', `${V.steps} steps a day`, 2, [id]); else if (V.steps < 7000) F('activity', 'Daily steps below 7,000', `${V.steps} steps a day`, 1, [id]); }
    if (meals.length >= 3) { const p = avg(meals.map(([, ms]) => ms.reduce((a, m) => a + (+m.p || 0), 0))), tg = OS.targets(s.profile).p, id = rec('food:protein', 'protein', 'fuel', 'Protein, 7-day average', `${Math.round(p)} g (target ${tg} g)`, null); if (p < tg * 0.8) F('protein', 'Protein below target', `${Math.round(p)} g a day against a ${tg} g target`, 2, [id]); }
    if (moods.length >= 5) { const md = avg(moods.map(([, m]) => m.mood).filter((v) => v != null)), st = avg(moods.map(([, m]) => m.stress).filter((v) => v != null));
      if (md != null && md <= 2.2) F('mood', 'Persistently low mood', `Mood ${md.toFixed(1)}/5 on average over ${moods.length} days`, 3, [rec('mind:mood', 'mood', 'life', 'Mood, 14-day average', `${md.toFixed(1)}/5`, null)], { refer: true });
      if (st != null && st >= 4) F('stress', 'High stress', `Stress ${st.toFixed(1)}/5 on average over ${moods.length} days`, 2, [rec('mind:stress', 'stress', 'life', 'Stress, 14-day average', `${st.toFixed(1)}/5`, null)]); }
    const lbc = bc.filter((x) => x.bf != null).sort((a, b) => a.d.localeCompare(b.d)).pop();
    if (lbc) { const hi = s.profile.sex === 'F' ? 32 : 25; if (lbc.bf > hi) F('body', 'Body fat above the healthy range', `${lbc.bf}% (above ${hi}%)`, 2, [rec('body:bf', 'body', 'bodycomp', 'Body fat', `${lbc.bf}%`, lbc.d)]); }
    if (s.cycle && OS.cycle) { const M = OS.cycle.model(s.cycle), heavy = Object.entries(s.cycle.days || {}).filter(([d, r]) => d >= since(60) && r.flow === 4).length;
      if (heavy >= 3) F('cycle', 'Heavy menstrual flow', `${heavy} heavy-flow days in the last 60 days`, 2, [rec('cycle:heavy', 'cycle', 'cycle', 'Heavy-flow days', heavy, null)]);
      if (M.known >= 3 && M.sdv > 7) F('cycle', 'Irregular cycles', `Cycle length varies by ±${Math.round(M.sdv)} days`, 2, [rec('cycle:sd', 'cycle', 'cycle', 'Cycle length spread', `±${Math.round(M.sdv)} d`, null)], { refer: true }); }
    const symc = {}; (s.symptoms || []).filter((r) => r.at.slice(0, 10) >= since(30) && !RED[r.sym]).forEach((r) => { (symc[r.sym] = symc[r.sym] || []).push(r); });
    Object.entries(symc).filter(([, xs]) => xs.length >= 3).forEach(([k, xs]) => F('symptom', `${k} keeps coming back`, `${xs.length} times in 30 days`, 2, [rec(`symr:${k}`, 'symptom', 'logbook', k, `${xs.length} times`, xs[xs.length - 1].at.slice(0, 10))], { refer: true }));
    try { const Lg = OS.longevity && OS.longevity.summary(s, sc); if (Lg && Number.isFinite(Lg.myoAge) && Lg.myoAge - s.profile.age >= 3) F('longevity', 'Biological age above calendar age', `Myo age ${Lg.myoAge.toFixed(1)} against ${s.profile.age}`, 1, [rec('lon:myoage', 'longevity', 'longevity', 'Myo age', Lg.myoAge.toFixed(1), null)]); } catch { /* not enough labs */ }
    // 4 · priorities: safety first, then impact × confidence × whether coaching can change it
    A.findings.forEach((f) => { f.score = f.sev * 2 + (f.refer ? 2 : 0) + f.conf + (f.mod ? 1 : 0); });
    A.findings.sort((a, b) => b.score - a.score);
    A.priorities = A.findings.slice(0, 3);
    A.top = A.safety.length ? 'safety' : A.priorities[0] ? A.priorities[0].area : null;
    A.refer = A.safety.length > 0 || A.findings.some((f) => f.refer);
    return A;
  }
  const fmtRange = (r) => (!r ? '—' : r[0] == null ? `below ${r[1]}` : r[1] == null ? `above ${r[0]}` : `${r[0]}–${r[1]}`);
  const srcList = (A, ids) => ids.map((id) => A.records[id]).filter(Boolean).map((r) => `<a class="cs-src" href="#${r.page}" title="Open ${esc(r.page)}">${esc(r.label)}: ${esc(r.value)}${r.date ? ` · ${esc(fmtDate(r.date))}` : ''}</a>`).join(' ');

  /* ── the agent: Myo AI drafts inside limits it can't override ── */
  const LIMITS = { calls: 8, seconds: 90 };
  async function runAgent(s, opt = {}) {
    const S = OS.caps && OS.caps.sample; if (!S) throw new Error('Myo AI with tools is not available here. The rule-engine assessment above is complete without it.');
    const sealed = assess(JSON.parse(JSON.stringify(s))), seen = new Set(), log = [], t0 = Date.now(); let calls = 0;
    const entry = (kind, name, detail) => log.push({ at: ((Date.now() - t0) / 1000).toFixed(1), kind, name, detail });
    const guard = (name, fn) => async (input) => {
      if (++calls > LIMITS.calls) { entry('limit', name, `Refused: the ${LIMITS.calls}-call cap is reached`); throw new Error(`Tool budget of ${LIMITS.calls} calls reached. Write your answer now.`); }
      if (Date.now() - t0 > LIMITS.seconds * 1000) { entry('limit', name, 'Refused: time limit reached'); throw new Error('Time limit reached. Write your answer now.'); }
      const r = await fn(input || {}); entry('tool', name, `${JSON.stringify(input || {})} → ${Array.isArray(r) ? `${r.length} items` : 'ok'}`); return r;
    };
    const areas = [...new Set(Object.values(sealed.records).map((r) => r.area))];
    const tools = [
      { name: 'list_sources', description: 'What data this member has, how much and how recent. Read-only.', inputSchema: { type: 'object', properties: {} }, execute: guard('list_sources', () => sealed.inventory) },
      { name: 'get_safety', description: 'Safety items (red flags) that must be handled before anything else. Read-only.', inputSchema: { type: 'object', properties: {} }, execute: guard('get_safety', () => sealed.safety.map((x) => { x.src.forEach((i) => seen.add(i)); return { text: x.text, level: x.level, why: x.why, record_ids: x.src }; })) },
      { name: 'get_records', description: 'Records for one area, each with an id you must cite. Read-only.', inputSchema: { type: 'object', properties: { area: { type: 'string', enum: areas } }, required: ['area'] }, execute: guard('get_records', ({ area }) => Object.values(sealed.records).filter((r) => r.area === area).map((r) => { seen.add(r.id); return r; })) },
      { name: 'get_rule_findings', description: "Myo's rule-engine findings with their record ids. Read-only.", inputSchema: { type: 'object', properties: {} }, execute: guard('get_rule_findings', () => sealed.findings.map((f) => { f.src.forEach((i) => seen.add(i)); return { area: f.area, title: f.title, detail: f.detail, severity: f.sev, refer: f.refer, record_ids: f.src }; })) }
    ];
    const prompt = `You are Myo's case assessment agent, drafting for a wellness coach who will review and sign off. Use the tools to review this member's data, then reply with JSON only, no prose:
{"summary": string (2-3 sentences), "findings": [{"title": string, "detail": string, "area": string, "cites": [record ids]}], "priorities": [up to 3 finding titles, most important first], "referral": {"needed": boolean, "reasons": [string]}}
Rules: start with get_safety; if there are safety items, the first priority is safety and referral is needed. Every finding must cite record ids returned by the tools; anything without a source will be removed. Wellness coaching language only: never diagnose, never name a disease the member "has", never suggest medicines or doses. You have at most ${LIMITS.calls} tool calls.`;
    entry('model', 'start', `Sealed case: ${Object.keys(sealed.records).length} records, ${sealed.findings.length} rule findings, ${sealed.safety.length} safety items`);
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), (LIMITS.seconds + 30) * 1000);
    let res; try { res = await S(prompt, { tools, signal: ctl.signal, modelTier: 'default', cache: false }); } finally { clearTimeout(timer); }
    entry('model', 'answer', `${(res.text || '').length} characters`);
    let j; try { j = JSON.parse(String(res.text).replace(/^```(json)?|```$/gm, '').trim()); } catch { throw new Error('Myo AI did not return a readable draft. Try again.'); }
    const BAD = /\b(diagnos(is|ed|e)|you have (a |an )?[a-z]+ (disease|disorder|syndrome)|prescri(be|ption)|\d+\s?(mg|mcg|µg|iu)\b)/i, kept = [], dropped = [];
    (j.findings || []).forEach((f) => { const cites = (f.cites || []).filter((c) => sealed.records[c] && seen.has(c)); if (!cites.length) { dropped.push(f.title); entry('check', 'rejected', `"${f.title}": no valid source`); return; } if (BAD.test(`${f.title} ${f.detail}`)) { f.flag = 'Language to review: diagnosis or dosing'; entry('check', 'flagged', `"${f.title}": diagnosis or dosing language`); } kept.push({ ...f, cites }); });
    entry('check', 'evaluation', `${kept.length} findings kept, ${dropped.length} rejected for missing sources; referral ${j.referral && j.referral.needed ? 'needed' : 'not needed'} (rules say ${sealed.refer ? 'needed' : 'not needed'})`);
    return { sealed, draft: { summary: String(j.summary || ''), findings: kept, priorities: (j.priorities || []).slice(0, 3), referral: j.referral || { needed: false, reasons: [] } }, dropped, log, calls };
  }

  /* ── evidence: PubMed and openFDA, every figure linked to its record, failures shown as failures ── */
  async function timed(name, url, fn) { const t = performance.now(); try { const r = await fetch(url); if (r.status === 404) throw new Error('No records found'); if (!r.ok) throw new Error(`HTTP ${r.status}`); const v = await fn(r); return { ok: true, name, ms: Math.round(performance.now() - t), url, v }; } catch (e) { return { ok: false, name, ms: Math.round(performance.now() - t), url, err: e.message || String(e) }; } }
  async function pubmed(q) {
    const EU = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils', term = `${q} AND (randomized controlled trial[pt] OR meta-analysis[pt] OR systematic review[pt])`;
    const a = await timed('PubMed search', `${EU}/esearch.fcgi?db=pubmed&retmode=json&retmax=6&sort=relevance&tool=myo&term=${encodeURIComponent(term)}`, (r) => r.json());
    if (!a.ok) return a; const ids = ((a.v.esearchresult || {}).idlist) || []; if (!ids.length) return { ...a, v: [] };
    const b = await timed('PubMed records', `${EU}/esummary.fcgi?db=pubmed&retmode=json&tool=myo&id=${ids.join(',')}`, (r) => r.json());
    if (!b.ok) return b; return { ...b, ms: a.ms + b.ms, v: ids.map((id) => b.v.result[id]).filter(Boolean).map((x) => ({ id: x.uid, title: x.title, journal: x.fulljournalname || x.source, year: (x.pubdate || '').slice(0, 4), types: (x.pubtype || []).filter((t) => /trial|meta|review/i.test(t)).join(', ') })) };
  }
  async function medicine(name) {
    const n = name.trim().toLowerCase().replace(/[^a-z0-9 -]/g, ''), q = `openfda.generic_name:"${n}"+openfda.brand_name:"${n}"`;
    const [lab, ev] = await Promise.all([
      timed('openFDA label', `https://api.fda.gov/drug/label.json?search=${encodeURIComponent(q).replace(/%2B/g, '+')}&limit=10`, async (r) => { const j = await r.json(), xs = j.results || []; if (!xs.length) throw new Error('No label found');
        // prefer the single-ingredient label whose generic name is closest to what was typed
        const rank = (x) => { const g = ((x.openfda || {}).generic_name || [''])[0].toLowerCase(); return (g.includes(' and ') ? 100 : 0) + (g.startsWith(n) ? 0 : 10) + g.length / 100; };
        return xs.slice().sort((a, b) => rank(a) - rank(b))[0]; }),
      timed('openFDA adverse-event reports', `https://api.fda.gov/drug/event.json?search=${encodeURIComponent(`patient.drug.openfda.generic_name:"${n}"`)}&count=patient.reaction.reactionmeddrapt.exact&limit=8`, async (r) => (await r.json()).results || [])
    ]);
    return { lab, ev };
  }
  const clip = (a, n) => { const t = Array.isArray(a) ? a.join(' ') : String(a || ''); return t.length > n ? `${t.slice(0, n).replace(/\s+\S*$/, '')}…` : t; };

  /* ── views ── */
  function assessTab(s) {
    const A = assess(s), st = CS.step, picks = CS.pick || A.priorities.map((f) => f.id);
    const head = `<ol class="cs-steps">${STEPS.map((l, i) => `<li><button class="${i === st ? 'on' : i < st ? 'done' : ''}" data-act="cs-step" data-i="${i}" aria-current="${i === st ? 'step' : 'false'}"><b>${i + 1}</b> ${l}</button></li>`).join('')}</ol>`;
    let body = '';
    if (st === 0) body = `<section class="card"><div class="card-h"><h2>1 · Safety screen</h2>${A.safety.length ? pill('bad', `${A.safety.length} to act on`) : pill('good', 'Clear')}</div>
      ${A.safety.length ? `<div class="banner bad" role="alert"><b>Stop and act before coaching.</b> ${A.safety.some((x) => x.level === 'now') ? 'At least one item needs emergency or same-day care: tell the member now and help them get it.' : 'These need a clinician to look at them soon.'} <a href="#emergency">Emergency steps</a></div>
        <ul class="cs-list">${A.safety.map((x) => `<li>${pill(x.level === 'now' ? 'bad' : 'warn', x.level === 'now' ? 'Now' : 'Soon')} <b>${esc(x.text)}</b><span class="small muted">${esc(x.why)}</span>${srcList(A, x.src)}</li>`).join('')}</ul>`
        : '<p class="small">No red-flag lab values, blood pressure crisis, red-flag symptoms, recent seizures or pregnancy warnings in this member\'s data.</p>'}
      <p class="fine">Always ask too: any chest pain, fainting, severe breathlessness, new weakness or thoughts of self-harm since the data was logged?</p></section>`;
    if (st === 1) body = `<section class="card"><div class="card-h"><h2>2 · Data check</h2>${A.sample ? pill('warn', 'Sample member: practice only') : ''}</div>
      <div class="tbl-wrap"><table class="tbl compact"><caption class="sr">Data available</caption><thead><tr><th scope="col">Source</th><th scope="col">Status</th><th scope="col">Detail</th></tr></thead><tbody>${A.inventory.map((x) => `<tr><th scope="row"><a href="#${x.page}">${esc(x.area)}</a></th><td>${pill(x.have ? 'good' : 'muted', x.have ? 'Have' : 'Missing')}</td><td class="small">${esc(x.detail)}</td></tr>`).join('')}</tbody></table></div>
      <p class="fine">Findings from labs older than a year count for less. Ask for what's missing rather than guessing.</p></section>`;
    if (st === 2) body = `<section class="card"><div class="card-h"><h2>3 · Findings</h2><span class="muted small">${A.findings.length}, each with its source</span></div>
      ${A.findings.length ? `<ul class="cs-list">${A.findings.map((f) => `<li>${pill(f.sev >= 3 ? 'bad' : f.sev === 2 ? 'warn' : 'muted', ['', 'Low', 'Medium', 'High'][f.sev])} <b>${esc(f.title)}</b>${f.refer ? ` ${pill('warn', 'Refer')}` : ''}<span class="small">${esc(f.detail)}</span>${srcList(A, f.src)}</li>`).join('')}</ul>` : '<p class="small muted">No findings from the available data.</p>'}
      <p class="fine">Observation, not diagnosis: say what the record shows and what range it sits in. Anything outside a reference range goes to a clinician.</p></section>`;
    if (st === 3) body = `<section class="card"><div class="card-h"><h2>4 · Priorities</h2><span class="muted small">Up to 3</span></div>
      ${A.safety.length ? '<p class="small"><b>Safety comes first.</b> Coaching priorities wait until the safety items are handled.</p>' : ''}
      <ul class="cs-list">${A.findings.map((f) => `<li><label class="cs-pick"><input type="checkbox" data-change="cs-pick" data-id="${f.id}" ${picks.includes(f.id) ? 'checked' : ''}> <b>${esc(f.title)}</b> <span class="small muted">score ${f.score.toFixed(1)}</span></label></li>`).join('') || '<li class="small muted">No findings to prioritise.</li>'}</ul>
      <p class="fine">Score = severity × 2 + 2 if it needs a clinician + data confidence + 1 if coaching can change it. Basics (sleep, activity, protein) before fine-tuning.</p></section>`;
    if (st === 4) { const P = A.findings.filter((f) => picks.includes(f.id)).slice(0, 3);
      body = `<section class="card"><div class="card-h"><h2>5 · Plan and referral</h2>${A.refer ? pill('warn', 'Refer to a clinician') : pill('good', 'No referral needed')}</div>
      ${P.map((f, i) => `<div class="cs-plan"><h3>${i + 1}. ${esc(f.title)}</h3><p class="small">Goal: ${esc(goal(f))}. Review in ${f.sev >= 3 ? 2 : 4} weeks.</p><p class="small">Use: ${f.modules.map((m) => `<a href="#${m}">${esc((OS.views[m] && OS.views[m].title) || m)}</a>`).join(' · ')}</p></div>`).join('') || '<p class="small muted">Pick priorities in step 4.</p>'}
      ${A.refer ? `<p class="small"><b>Referral reasons:</b> ${esc([...A.safety.map((x) => x.text), ...A.findings.filter((f) => f.refer).map((f) => f.title)].join('; '))}. Book it with the member in <a href="#care">Care and calendar</a>.</p>` : ''}
      <p class="fine">Myo plans cover lifestyle, training, food, sleep and recovery. Medicines and doses are for the member's prescriber.</p></section>`; }
    if (st === 5) body = `<section class="card"><div class="card-h"><h2>6 · Sign-off</h2></div>
      <form class="lb-grid" data-submit="cs-save"><label>Assessed by<input name="by" maxlength="60" required value="${esc(CS.by)}"></label><label>Role<select name="role">${['Coach', 'Physiologist', 'Dietitian', 'Nurse', 'Physician', 'Other'].map((r) => `<option ${CS.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
        <label class="lb-wide">Notes<textarea name="notes" rows="3" maxlength="2000" placeholder="What you discussed and agreed with the member">${esc(CS.notes)}</textarea></label>
        <label class="ped-use tested lb-wide"><input type="checkbox" name="consent" required> The member agreed to this assessment and to saving it</label>
        <div class="lb-wide"><button class="btn sm">Save case record</button></div></form>${A.sample ? '<p class="small muted">This is the sample member: save it as practice.</p>' : ''}</section>`;
    return `${head}${body}<div class="st-go"><button class="btn ghost sm" data-act="cs-step" data-i="${Math.max(0, st - 1)}" ${st === 0 ? 'disabled' : ''}>Back</button><button class="btn sm" data-act="cs-step" data-i="${Math.min(5, st + 1)}" ${st === 5 ? 'disabled' : ''}>Next</button></div>`;
  }
  function goal(f) {
    return { bp: 'Home readings below 130/80 and a clinician review', lipids: 'ApoB toward the optimal range at the next lab', glucose: 'HbA1c and fasting glucose into the optimal range', iron: 'Ferritin into range after clinician review', vitd: 'Vitamin D into the optimal range', sleep: '7 hours or more on 5 nights a week', recovery: 'HRV back to baseline; lighter training until then', activity: '7,000+ steps a day', protein: 'Daily protein within 10% of target', mood: 'Talk to a clinician or therapist; daily check-ins', stress: 'Two stress-reduction sessions a day; stress 3/5 or lower', body: 'Body fat trending down 0.5–1% a month', cycle: 'Clinician review; track flow and symptoms', symptom: 'Clinician review of the recurring symptom', longevity: 'Myo age at or below calendar age' }[f.area] || 'Move this measure toward its optimal range';
  }
  function agentTab(s) {
    const G = CS.agent, ok = !!(OS.caps && OS.caps.sample);
    return `<section class="card"><div class="card-h"><h2>Let Myo AI draft the assessment</h2>${ok ? '' : pill('muted', 'Needs Myo AI with tools')}</div>
        <ul class="small bc-ref"><li><b>Read-only tools:</b> list sources, safety items, records by area, rule findings. No writes, no network.</li><li><b>Limits it can't override:</b> ${LIMITS.calls} tool calls and ${LIMITS.seconds} seconds per case; past that, every call is refused.</li>
          <li><b>Sealed case:</b> the agent sees a frozen copy of this one member's data, nothing else.</li><li><b>Checked output:</b> findings without a valid source are removed; diagnosis or dosing language is flagged. A person signs off.</li></ul>
        <div class="st-go"><button class="btn" data-act="cs-agent" ${ok && !(G && G.busy) ? '' : 'disabled'}>${G && G.busy ? 'Drafting…' : 'Draft with Myo AI'}</button></div>
        ${ok ? '' : '<p class="small">Myo AI drafting runs inside Claude. The rule-engine assessment on the Assess tab is complete without it.</p>'}${G && G.err ? `<p class="small" role="alert">${esc(G.err)}</p>` : ''}</section>
      ${G && G.r ? `<section class="card"><div class="card-h"><h2>Draft</h2>${pill(G.r.draft.referral.needed ? 'warn' : 'good', G.r.draft.referral.needed ? 'Refer' : 'No referral')}</div><p class="small">${esc(G.r.draft.summary)}</p>
          <ul class="cs-list">${G.r.draft.findings.map((f) => `<li><b>${esc(f.title)}</b>${f.flag ? ` ${pill('warn', f.flag)}` : ''}<span class="small">${esc(f.detail || '')}</span>${srcList(G.r.sealed, f.cites)}</li>`).join('')}</ul>
          ${G.r.dropped.length ? `<p class="small muted">Removed for having no source: ${esc(G.r.dropped.join('; '))}</p>` : ''}</section>
        <section class="card"><div class="card-h"><h2>Decision record</h2><span class="muted small">${G.r.calls} tool call${G.r.calls === 1 ? '' : 's'}</span></div><ol class="ch-log cs-log">${G.r.log.map((e) => `<li class="st-${e.kind === 'limit' || e.name === 'rejected' ? 'bad' : e.kind === 'check' ? 'good' : 'muted'}"><time>${e.at} s</time> <b>${esc(e.kind)} · ${esc(e.name)}</b> ${esc(e.detail)}</li>`).join('')}</ol></section>` : ''}`;
  }
  function evidenceTab(s) {
    const E = CS.ev, meds = ((s.emergency && s.emergency.id && s.emergency.id.meds) || '').split(/[,;]/).map((x) => x.trim()).filter((x) => x && x.length < 40).slice(0, 4);
    const status = (r) => (r.ok ? pill('good', `${r.name} · ${r.ms} ms`) : pill('bad', `${r.name} failed: ${r.err}`));
    const pub = E.pub, med = E.med;
    return `<section class="card"><div class="card-h"><h2>Research evidence</h2><span class="muted small">PubMed · trials and reviews</span></div>
        <form class="row" data-submit="cs-pub"><label class="sr" for="cs-q">Question</label><input id="cs-q" name="q" maxlength="120" placeholder="e.g. resistance training blood pressure" value="${esc(E.q)}"><button class="btn ghost">Search</button></form>
        ${E.busy === 'pub' ? '<p class="small muted">Searching…</p>' : ''}${pub ? `<p>${status(pub)} <a class="small" href="${esc(pub.url)}" target="_blank" rel="noopener">query</a></p>${pub.ok ? (pub.v.length ? `<ol class="cs-pubs">${pub.v.map((p) => `<li><a href="https://pubmed.ncbi.nlm.nih.gov/${esc(p.id)}/" target="_blank" rel="noopener">${esc(p.title)}</a> <span class="small muted">${esc(p.journal)} · ${esc(p.year)}${p.types ? ` · ${esc(p.types)}` : ''} · PMID ${esc(p.id)}</span></li>`).join('')}</ol>` : '<p class="small muted">No trials or reviews matched.</p>') : ''}` : ''}</section>
      <section class="card"><div class="card-h"><h2>Medicines</h2><span class="muted small">openFDA · FDA label and reports</span></div>
        <form class="row" data-submit="cs-med"><label class="sr" for="cs-m">Medicine name</label><input id="cs-m" name="m" maxlength="40" placeholder="Generic or brand name"><button class="btn ghost">Look up</button></form>
        ${meds.length ? `<p class="small">From the medical ID: ${meds.map((m) => `<button class="chip-btn" data-act="cs-medpick" data-m="${esc(m)}">${esc(m)}</button>`).join(' ')}</p>` : ''}
        ${E.busy === 'med' ? '<p class="small muted">Looking up…</p>' : ''}
        ${med ? `<p>${status(med.lab)} ${status(med.ev)}</p>${med.lab.ok ? (() => { const x = med.lab.v, o = x.openfda || {}, sid = x.set_id; return `<h3>${esc((o.brand_name || [])[0] || (o.generic_name || [])[0] || 'Medicine')}</h3><p class="small muted">${esc((o.generic_name || []).join(', '))}${o.manufacturer_name ? ` · ${esc(o.manufacturer_name[0])}` : ''}${sid ? ` · <a href="https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=${esc(sid)}" target="_blank" rel="noopener">label record</a>` : ''}</p>
            ${x.boxed_warning ? `<div class="banner bad" role="note"><b>Boxed warning:</b> ${esc(clip(x.boxed_warning, 600))}</div>` : ''}
            ${x.indications_and_usage ? `<p class="small"><b>What it's for:</b> ${esc(clip(x.indications_and_usage, 500))}</p>` : ''}
            ${x.warnings_and_cautions || x.warnings ? `<p class="small"><b>Warnings:</b> ${esc(clip(x.warnings_and_cautions || x.warnings, 700))}</p>` : ''}
            <p class="fine">Dosing sections of the label are not shown: doses come from the member's prescriber and pharmacist.</p>`; })() : ''}
          ${med.ev.ok && med.ev.v.length ? (() => { const mx = Math.max(...med.ev.v.map((r) => r.count)); return `<h4>Most-reported reactions <a class="small" href="${esc(med.ev.url)}" target="_blank" rel="noopener">query</a></h4><ul class="fl-bars">${med.ev.v.map((r) => `<li><span>${esc(r.term.toLowerCase())}</span><i class="fl-track"><i style="width:${((r.count / mx) * 100).toFixed(1)}%"></i></i><b class="num">${r.count.toLocaleString()}</b></li>`).join('')}</ul><p class="fine">Counts of voluntary FAERS reports. A report doesn't prove the medicine caused the reaction, and counts depend on how widely a medicine is used.</p>`; })() : ''}` : ''}</section>
      <p class="fine">Like QAI Health: every figure links to the record it came from, and a source that fails says so. Only the search words or medicine name are sent. Evidence informs coaching; it is not medical advice.</p>`;
  }
  function recordsTab(s) {
    const R = ((s.cases && s.cases.records) || []).slice().reverse();
    return `<section class="card"><div class="card-h"><h2>Case records</h2><span class="muted small">${R.length}</span></div>
      ${R.length ? `<ul class="ca-list">${R.map((r) => `<li class="ca-appt"><div><b>${esc(fmtDate(r.d || r.at.slice(0, 10)))}</b> · ${esc(r.by)} <span class="muted small">${esc(r.role)}</span> ${r.refer ? pill('warn', 'Referred') : ''} ${r.sample ? pill('muted', 'Practice') : ''}</div>
        <p class="small">${r.safety.length ? `<b>Safety:</b> ${esc(r.safety.join('; '))}. ` : ''}<b>Priorities:</b> ${esc(r.priorities.join('; ') || 'none')}.${r.notes ? ` ${esc(r.notes)}` : ''}</p>
        <div class="st-go"><button class="btn ghost sm" data-act="cs-print" data-id="${r.id}">Print</button></div><button class="lb-del" data-act="cs-del" data-id="${r.id}" aria-label="Delete this record">${icon('x', 12)}</button></li>`).join('')}</ul>` : '<p class="small muted">No case records yet. Finish an assessment and sign it off.</p>'}</section>`;
  }

  OS.register('cases', {
    title: 'Case assessment', icon: 'cases',
    render(s) {
      const body = { assess: assessTab, agent: agentTab, evidence: evidenceTab, records: recordsTab }[CS.tab](s);
      return `${OS.ui.head('For Myo providers and coaches', 'Case assessment', 'The standard way to assess a member: safety first, then the data, sourced findings, priorities, a plan and a signed record. Myo AI can draft it inside strict limits; a person always signs off.', `<a class="btn ghost" href="#academy">${icon('academy', 16)} Academy</a>`)}
        <div class="cs bc fl"><div class="seg kt-tabs" role="tablist" aria-label="Case assessment">${TABS.map(([k, l]) => `<button role="tab" aria-selected="${CS.tab === k}" data-act="cs-tab" data-t="${k}">${l}</button>`).join('')}</div>${body}</div>`;
    }
  });
  OS.act('cs-tab', (el) => { CS.tab = TABS.some(([k]) => k === el.dataset.t) ? el.dataset.t : 'assess'; OS.render(); });
  OS.act('cs-step', (el) => { CS.step = clamp(+el.dataset.i, 0, 5); OS.render(); const m = document.getElementById('main'); if (m) m.scrollTop = 0; });
  OS.change('cs-pick', (el) => { const A = assess(OS.state), cur = CS.pick || A.priorities.map((f) => f.id), id = el.dataset.id; CS.pick = el.checked ? [...new Set([...cur, id])].slice(0, 3) : cur.filter((x) => x !== id); OS.render(); });
  OS.act('cs-save', (f) => {
    const A = assess(OS.state), picks = CS.pick || A.priorities.map((x) => x.id), P = A.findings.filter((x) => picks.includes(x.id)).slice(0, 3);
    CS.by = f.elements.by.value.trim(); CS.role = f.elements.role.value; CS.notes = f.elements.notes.value.trim();
    const r = { id: uid(), at: new Date().toISOString(), d: dayKey(new Date()), by: CS.by, role: CS.role, notes: CS.notes, sample: A.sample, refer: A.refer, safety: A.safety.map((x) => x.text), priorities: P.map((x) => x.title),
      findings: A.findings.map((x) => ({ title: x.title, detail: x.detail, sev: x.sev, sources: x.src.map((i) => A.records[i]).filter(Boolean).map((rr) => `${rr.label}: ${rr.value}${rr.date ? ` (${rr.date})` : ''}`) })), ai: CS.agent && CS.agent.r ? { log: CS.agent.r.log, dropped: CS.agent.r.dropped } : null };
    OS.update((s) => { s.cases = s.cases || {}; s.cases.records = (s.cases.records || []).concat([r]).slice(-100); });
    OS.logEvent('note', 'Case assessment signed off', `${r.by} (${r.role})${r.refer ? ' · referral advised' : ''}`, { go: 'cases', src: 'manual' });
    CS.tab = 'records'; CS.step = 0; CS.pick = null; CS.notes = ''; OS.render(); OS.toast('Case record saved');
  });
  OS.act('cs-del', (el) => { if (!confirm('Delete this case record?')) return; OS.update((s) => { s.cases.records = (s.cases.records || []).filter((r) => r.id !== el.dataset.id); }); });
  OS.act('cs-print', (el) => {
    const r = ((OS.state.cases && OS.state.cases.records) || []).find((x) => x.id === el.dataset.id); if (!r) return; const w = window.open('', '_blank', 'width=720,height=820'); if (!w) { OS.toast('Allow pop-ups to print'); return; }
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Case record</title><style>body{font:13px/1.45 system-ui,sans-serif;margin:24px;max-width:700px}h1{font-size:18px;margin:0}h2{font-size:14px;margin:16px 0 6px}li{margin:3px 0}.m{color:#666}</style>
      <h1>Myo case assessment</h1><p class="m">${esc(new Date(r.at).toLocaleString())} · ${esc(r.by)} (${esc(r.role)})${r.sample ? ' · practice on the sample member' : ''}</p>
      <h2>Safety</h2><ul>${r.safety.map((x) => `<li>${esc(x)}</li>`).join('') || '<li>Clear</li>'}</ul><h2>Findings and sources</h2><ul>${r.findings.map((x) => `<li><b>${esc(x.title)}</b> — ${esc(x.detail)}<br><span class="m">${esc(x.sources.join('; '))}</span></li>`).join('')}</ul>
      <h2>Priorities</h2><ol>${r.priorities.map((x) => `<li>${esc(x)}</li>`).join('')}</ol><h2>Referral</h2><p>${r.refer ? 'Advised' : 'Not needed'}</p>${r.notes ? `<h2>Notes</h2><p>${esc(r.notes)}</p>` : ''}
      ${r.ai ? `<h2>Myo AI decision record</h2><ol>${r.ai.log.map((e) => `<li>${esc(e.at)} s · ${esc(e.kind)} · ${esc(e.name)}: ${esc(e.detail)}</li>`).join('')}</ol>` : ''}<p class="m">Wellness assessment for coaching, not a diagnosis.</p>`);
    w.document.close(); w.focus(); setTimeout(() => { try { w.print(); } catch { /* */ } }, 300);
  });
  OS.act('cs-agent', async () => { CS.agent = { busy: true }; OS.render(); try { CS.agent = { r: await runAgent(OS.state) }; } catch (e) { CS.agent = { err: e && e.code === 'not_granted' ? 'Myo AI is turned off for this page.' : (e.message || String(e)) }; } OS.render(); });
  OS.act('cs-pub', async (f) => { CS.ev.q = f.elements.q.value.trim(); if (CS.ev.q.length < 3) return; CS.ev.busy = 'pub'; OS.render(); CS.ev.pub = await pubmed(CS.ev.q); CS.ev.busy = false; OS.render(); });
  const med = async (m) => { if (!m || m.length < 3) return; CS.ev.busy = 'med'; OS.render(); CS.ev.med = await medicine(m); CS.ev.busy = false; OS.render(); };
  OS.act('cs-med', (f) => med(f.elements.m.value));
  OS.act('cs-medpick', (el) => med(el.dataset.m));
  OS.cases = { assess, runAgent, pubmed, medicine, LIMITS, LABEL, state: CS,
    status(s) { const A = assess(s); return A.safety.length ? [`${A.safety.length} safety item${A.safety.length > 1 ? 's' : ''} to act on`, 'bad'] : [`${A.findings.length} finding${A.findings.length === 1 ? '' : 's'} · top: ${(LABEL[A.top] || 'none').toLowerCase()}`, 'muted']; } };
})();
