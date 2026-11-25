/* ═══ MYO — EVIDENCE: keeps Myo's guidance current with new studies, with a person in the loop ═══
   Watches PubMed (NCBI E-utilities, public, no key) for new randomised trials and meta-analyses on the topics that matter
   to this member: flagged markers, the protocol's levers and topics they add. New papers raise a review flag on the
   protocol rules they touch. Rules change only after a person reviews the evidence: Myo never rewrites health
   guidance from an abstract. Only the search terms are sent to PubMed. */
(function () {
  'use strict';
  const { esc, icon, pill, dayKey } = OS;
  const EU = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  const DESIGN = '(randomized controlled trial[pt] OR meta-analysis[pt] OR systematic review[pt])';
  // topic: [key, label, PubMed terms, protocol rule ids it informs]
  const BASE = [
    ['apob', 'ApoB and LDL', '("apolipoprotein B" OR "LDL cholesterol") AND (diet OR fiber OR exercise)', ['p-fiber', 'p-z2']],
    ['vitd', 'Vitamin D', '("vitamin D" OR cholecalciferol) AND supplementation', ['p-vitd']],
    ['omega3', 'Omega-3', '("omega-3" OR EPA OR DHA) AND (triglycerides OR inflammation)', ['p-o3', 'p-crp']],
    ['insulin', 'Insulin sensitivity', '("insulin sensitivity" OR "insulin resistance") AND (exercise OR "time-restricted eating" OR fiber)', ['p-z2']],
    ['sleep', 'Sleep and recovery', '(sleep) AND (athletes OR "resistance training" OR recovery)', ['p-cort', 'p-light']],
    ['magnesium', 'Magnesium and sleep', '(magnesium) AND (sleep OR insomnia)', ['p-mg']],
    ['homocysteine', 'Homocysteine and B vitamins', '(homocysteine) AND (folate OR "vitamin B12" OR "B vitamins")', ['p-hcy']],
    ['breath', 'Breathwork and stress', '(breathing OR breathwork) AND (stress OR anxiety OR "heart rate variability")', ['p-breath']],
    ['creatine', 'Creatine', '(creatine supplementation) AND (strength OR muscle OR cognition)', []],
    ['protein', 'Protein and muscle', '(protein intake) AND ("resistance training" OR "muscle mass")', ['p-prot']]
  ];
  const MARKER_TOPIC = { apob: 'apob', ldl: 'apob', tg: 'omega3', vitd: 'vitd', o3: 'omega3', crp: 'omega3', ins: 'insulin', glu: 'insulin', a1c: 'insulin', mg: 'magnesium', hcy: 'homocysteine', cort: 'sleep', ft: 'sleep' };
  // Myo's protocol rules with the grade of evidence behind them and when a person last reviewed them
  const RULES = {
    'p-vitd': ['Vitamin D3 + K2 when 25-OH D is under 40', 'A', '2026-11-22'], 'p-o3': ['Omega-3 2 g EPA + DHA when the index is under 8%', 'A', '2026-11-22'],
    'p-mg': ['Magnesium glycinate at bedtime', 'B', '2026-11-22'], 'p-z2': ['Zone 2 cardio for ApoB or insulin', 'A', '2026-11-22'], 'p-fiber': ['Fibre 35 g with 10 g soluble', 'A', '2026-11-22'],
    'p-crp': ['Oily fish and greens while hs-CRP is above 1', 'B', '2026-11-22'], 'p-hcy': ['Methylated B-complex for homocysteine', 'B', '2026-11-22'],
    'p-cort': ['Fixed 8-hour sleep window', 'A', '2026-11-22'], 'p-light': ['Morning light, 10 minutes', 'B', '2026-11-22'], 'p-breath': ['Box breathing before sleep', 'B', '2026-11-22'], 'p-prot': ['Protein 2.0 g/kg across four meals', 'A', '2026-11-22']
  };
  const E = { busy: false, err: '', feed: {}, open: null };
  const ensure = (s) => { if (!s.evidence) s.evidence = { topics: [], seen: {}, last: null, reviews: {} }; const v = s.evidence; v.topics = v.topics || []; v.seen = v.seen || {}; v.reviews = v.reviews || {}; return v; };
  function topics(s) {
    const v = ensure(s), sc = OS.scores(s);
    const fromMarkers = [...new Set(sc.flagged.map((x) => MARKER_TOPIC[x.m.id]).filter(Boolean))];
    const keys = [...new Set(fromMarkers.concat(['sleep', 'protein', 'creatine']))].slice(0, 6);
    return keys.map((k) => BASE.find((b) => b[0] === k)).filter(Boolean).concat(v.topics.map((t) => [t.k, t.label, `(${t.q})`, []]));
  }
  const level = (types) => { const t = types.map((x) => x.toLowerCase()); return t.some((x) => x.includes('meta-analysis') || x.includes('systematic review')) ? ['good', 'Meta-analysis'] : t.some((x) => x.includes('randomized controlled trial')) ? ['good', 'Randomised trial'] : ['muted', 'Other']; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function fetchTopic(term) {
    const q = `${term} AND ${DESIGN} AND ("2024"[dp] : "3000"[dp])`;
    const r = await fetch(`${EU}/esearch.fcgi?db=pubmed&retmode=json&retmax=8&sort=pub_date&tool=myo&term=${encodeURIComponent(q)}`);
    if (!r.ok) throw new Error('PubMed search failed');
    const ids = ((await r.json()).esearchresult || {}).idlist || [];
    if (!ids.length) return [];
    await sleep(350);   // NCBI allows three requests a second without a key
    const r2 = await fetch(`${EU}/esummary.fcgi?db=pubmed&retmode=json&tool=myo&id=${ids.join(',')}`);
    if (!r2.ok) throw new Error('PubMed summary failed');
    const res = (await r2.json()).result || {};
    return (res.uids || []).map((id) => { const x = res[id] || {}; return { id, title: String(x.title || '').replace(/<[^>]+>/g, ''), journal: x.fulljournalname || x.source || '', date: x.pubdate || '', types: x.pubtype || [] }; });
  }
  async function refresh(s) {
    if (E.busy) return; E.busy = true; E.err = ''; OS.render();
    const list = topics(s);
    try {
      for (const [k, , term] of list) { E.feed[k] = await fetchTopic(term); await sleep(350); }
      OS.update((st) => { ensure(st).last = new Date().toISOString(); }, { keepSample: true, render: false });
    } catch { E.err = "PubMed couldn't be reached. Try again in a minute."; }
    E.busy = false; OS.render();
  }

  OS.register('evidence', {
    title: 'Evidence', icon: 'evidence',
    render(s) {
      const v = ensure(s), list = topics(s), sc = OS.scores(s), active = OS.protocol(s, sc).map((i) => i.id).filter((id) => RULES[id]);
      const newFor = (k) => (E.feed[k] || []).filter((p) => !(v.seen[k] || []).includes(p.id));
      const flags = {}; list.forEach(([k, , , rules]) => { const n = newFor(k).length; rules.forEach((r) => { flags[r] = (flags[r] || 0) + n; }); });
      return `${OS.ui.head('Learning', 'Evidence', 'New trials and meta-analyses on the topics that matter to you, and a review step before any of Myo\'s rules change.', `<button class="btn" data-act="ev-refresh" ${E.busy ? 'disabled' : ''}>${icon('rotate', 16)} ${E.busy ? 'Checking PubMed…' : 'Check for new studies'}</button>`)}
        ${E.err ? `<div class="banner warn" role="alert">${esc(E.err)}</div>` : ''}
        <p class="small muted">${v.last ? `Last checked ${new Date(v.last).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.` : 'Not checked yet.'} Topics follow your flagged markers; add your own below.</p>
        <div class="grid g-2">
          <section class="card"><div class="card-h"><h2>New studies</h2><span class="muted small">Randomised trials and meta-analyses since 2024</span></div>
            ${list.map(([k, label]) => { const papers = E.feed[k], n = newFor(k).length; return `<details class="ev-topic" ${E.open === k ? 'open' : ''}><summary data-act="ev-open" data-k="${esc(k)}"><b>${esc(label)}</b>${papers ? (n ? pill('warn', `${n} new`) : pill('muted', 'Up to date')) : pill('muted', 'Not checked')}</summary>
              ${papers ? (papers.length ? `<ul class="ev-papers">${papers.map((p) => { const [st, lv] = level(p.types); return `<li class="${(v.seen[k] || []).includes(p.id) ? 'seen' : ''}"><a href="https://pubmed.ncbi.nlm.nih.gov/${esc(p.id)}/" target="_blank" rel="noopener">${esc(p.title)}</a><span class="muted small block">${esc(p.journal)} · ${esc(p.date)} ${pill(st, lv)}</span></li>`; }).join('')}</ul>
                <div class="row"><button class="btn ghost sm" data-act="ev-seen" data-k="${esc(k)}">Mark as read</button><button class="btn ghost sm" data-act="ev-ask" data-k="${esc(k)}">${icon('coach', 14)} Ask Myo what this means for me</button></div>` : '<p class="muted small">No new trials or meta-analyses since 2024.</p>') : '<p class="muted small">Check for new studies to load this topic.</p>'}</details>`; }).join('')}
            <form data-submit="ev-add" class="row ev-add"><label class="sr" for="ev-q">Add a topic</label><input id="ev-q" name="q" maxlength="80" placeholder="Add a topic, e.g. cold water immersion"><button class="btn ghost sm">Add</button></form>
            <p class="fine">Searches PubMed at the US National Library of Medicine. Only the topic words are sent.</p></section>
          <section class="card"><div class="card-h"><h2>Review queue</h2><span class="muted small">Rules in your protocol, their evidence and review date</span></div>
            <div class="tbl-wrap"><table class="tbl compact ev-rules"><thead><tr><th scope="col">Rule</th><th scope="col">Grade</th><th scope="col">Reviewed</th><th scope="col">New studies</th><th scope="col"><span class="sr">Action</span></th></tr></thead><tbody>
            ${Object.entries(RULES).map(([id, [t, g, d]]) => { const rv = v.reviews[id], n = flags[id] || 0, on = active.includes(id); return `<tr class="${on ? '' : 'muted'}"><td>${esc(t)}${on ? '' : ' <span class="small">(not in your plan)</span>'}</td><td><span class="bc-grade g-${g}">${g}</span></td><td class="small">${esc(OS.fmtDate(rv ? rv.at : d))}</td><td>${n ? pill('warn', `${n} to review`) : pill('good', 'None')}</td><td>${n ? `<button class="btn ghost sm" data-act="ev-review" data-id="${id}">Mark reviewed</button>` : ''}</td></tr>`; }).join('')}
            </tbody></table></div>
            <p class="fine">How Myo learns: new studies flag the rules they touch; a reviewer (you, your clinician, or Merakinetics' clinical review for app-wide rules) reads them and either confirms the rule or changes it in a new app version. Nothing changes automatically.</p></section>
        </div>`;
    },
    mount(root, s) { const v = ensure(s); if (!E.busy && (!v.last || Date.now() - Date.parse(v.last) > 7 * 864e5) && !Object.keys(E.feed).length && navigator.onLine) refresh(s); }
  });
  OS.act('ev-refresh', () => refresh(OS.state));
  OS.act('ev-open', (el) => { E.open = E.open === el.dataset.k ? null : el.dataset.k; OS.render(); });
  OS.act('ev-seen', (el) => OS.update((s) => { const v = ensure(s), k = el.dataset.k; v.seen[k] = [...new Set((v.seen[k] || []).concat((E.feed[k] || []).map((p) => p.id)))].slice(-200); }, { keepSample: true }));
  OS.act('ev-review', (el) => OS.update((s) => { ensure(s).reviews[el.dataset.id] = { at: dayKey(), by: 'member' }; }, { keepSample: true }));
  OS.act('ev-add', (f) => { const q = f.elements.q.value.trim().replace(/[^\w\s\-+'"]/g, ' ').slice(0, 80); if (q.length < 3) return; OS.update((s) => { const v = ensure(s); v.topics.push({ k: 'u-' + OS.uid(), label: q, q }); v.topics = v.topics.slice(-6); }, { keepSample: true }); refresh(OS.state); });
  OS.act('ev-ask', (el) => {
    const k = el.dataset.k, t = topics(OS.state).find((x) => x[0] === k), papers = (E.feed[k] || []).slice(0, 5);
    const q = `New studies on ${t ? t[1] : k}: ${papers.map((p) => `"${p.title}" (${p.journal}, ${p.date})`).join('; ')}. Based on titles only, what might these mean for my protocol, and what should I ask my clinician?`;
    OS.go('coach'); setTimeout(() => { if (OS.coachSend) OS.coachSend(q.slice(0, 1800)); }, 120);
  });
  OS.evidence = { RULES, topics };
})();
