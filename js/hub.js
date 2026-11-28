/* ═══ MYO — HUB: Myo's living cell at the centre, wired to every function of the app ═══
   The cell is the real avatar (js/avatar.js). The ring around it shows the five Myo Score systems.
   Circuit traces run from the membrane to six panels, and every node is a link to a page with a live
   status line from the member's data. Wide screens put three panels either side of the cell; narrow
   screens stack them under it on a bus trace. Traces are drawn from the panels' real positions, so they
   follow any text size or window width. Original art: no third-party HUD designs are copied. */
(function () {
  'use strict';
  const { esc, icon, dayKey, targets, protocol } = OS;

  const CLUSTERS = [
    { k: 'body', side: 'l', code: 'BIO·01', label: 'Body and biology', items: ['twin', 'body', 'atlas', 'heart', 'flow', 'bodycomp', 'biology', 'biochem', 'longevity', 'imaging', 'ultrasound', 'mirror'] },
    { k: 'restore', side: 'l', code: 'REC·02', label: 'Sleep and recovery', items: ['sleep', 'recovery', 'wave', 'pt', 'surgery', 'function', 'mind', 'logbook'] },
    { k: 'data', side: 'l', code: 'NET·03', label: 'Data and devices', items: ['wearables', 'stream', 'face', 'bci', 'chip', 'cases', 'academy', 'connect', 'evidence', 'profile', 'system'] },
    { k: 'day', side: 'r', code: 'DAY·04', label: 'Your day', items: ['welcome', 'today', 'care', 'insights', 'emergency', 'mode', 'score', 'coach', 'report'] },
    { k: 'train', side: 'r', code: 'TRN·05', label: 'Training', items: ['training', 'motion', 'athlete', 'ar', 'machines', 'gym'] },
    { k: 'life', side: 'r', code: 'LIF·06', label: 'Fuel, life and looks', items: ['fuel', 'kitchen', 'food', 'env', 'life', 'cycle', 'pregnancy', 'enhance', 'looks', 'augment'] }
  ];
  // the five Myo Score systems; colours match the flyer and stay the same in every scheme
  const PARTS = [['biology', 'Biology', '#38bdf8'], ['recovery', 'Recovery', '#a78bfa'], ['training', 'Training', '#fb8a4a'], ['nutrition', 'Fuel', '#a3d65c'], ['life', 'Life', '#6b97ff']];
  const title = (n) => (OS.views[n] ? OS.views[n].title : n);
  const desc = (n) => (OS.navDesc && OS.navDesc[n]) || '';
  OS.hubClusters = CLUSTERS;

  /* ── one status line per page, from the member's own data ── */
  function status(n, s, sc) {
    const k = dayKey(), vt = s.vitals || {};
    switch (n) {
      case 'welcome': return s.welcomed ? ['Setup and your first week', 'good'] : ['Start here: six steps', 'warn'];
      case 'today': { const items = protocol(s, sc), d = s.protocolDone[k] || {}, done = items.filter((i) => d[i.id]).length; return [`${done} of ${items.length} done today`, items.length && done >= items.length ? 'good' : 'muted']; }
      case 'coach': return sc.redFlags.length ? [`${sc.redFlags.length} red flag${sc.redFlags.length > 1 ? 's' : ''}: ask Myo`, 'bad'] : ['Ask by voice or text', 'good'];
      case 'report': return ['Print or save a summary', 'muted'];
      case 'score': { const n = (s.scoreLog || []).length; return sc.mk == null ? ['Not scored yet', 'muted'] : [`${sc.mk} · ${sc.mk >= 90 ? 'Peak' : sc.mk >= 80 ? 'Optimal' : sc.mk >= 60 ? 'Strong' : 'Building'}${n > 1 ? ` · ${n} days` : ''}`, sc.mk >= 80 ? 'good' : 'warn']; }
      case 'mode': return [sc.redFlags.length ? `${sc.redFlags.length} red flag · run a full scan` : 'Run a full system scan', sc.redFlags.length ? 'bad' : 'muted'];
      case 'kitchen': { const k = s.kitchen, n = k && k.plan ? Object.keys(k.plan).length : 0; return [n ? `${n} days planned` : 'Recipes, plan, supplements', 'muted']; }
      case 'mind': { const L = OS.mind && OS.mind.latest(); return L ? [`${L.label}: ${L.band}`, L.status] : ['Check in or take a self-check', 'muted']; }
      case 'motion': { const m = s.motion && s.motion.log && s.motion.log.at(-1); return m ? [m.text, 'muted'] : ['Jump and movement screens', 'muted']; }
      case 'biochem': { if (!OS.biochem) return [desc(n), 'muted']; const xs = OS.biochem.PATHS.map((p) => [p.name, OS.biochem.pathScore(s, p)]).filter((x) => x[1] != null).sort((a, b) => a[1] - b[1]); return xs.length ? [`Lowest: ${xs[0][0]} ${xs[0][1]}`, xs[0][1] >= 88 ? 'good' : 'warn'] : ['Add labs to map your pathways', 'muted']; }
      case 'evidence': { const v = s.evidence; return v && v.last ? [`Checked ${OS.fmtDate(v.last.slice(0, 10))}`, 'muted'] : ['Check for new studies', 'muted']; }
      case 'body': return ['Nine systems in real 3D', 'muted'];
      case 'biology': {
        const n1 = sc.markers.filter((x) => x.e.score != null).length;
        if (!n1) return ['No labs yet: import a PDF', 'warn'];
        if (sc.redFlags.length) return [`${n1} markers · ${sc.redFlags.length} red flag${sc.redFlags.length > 1 ? 's' : ''}`, 'bad'];
        return [`${n1} markers · ${sc.flagged.length} to improve`, sc.flagged.length ? 'warn' : 'good'];
      }
      case 'longevity': { try { const L = OS.longevity.summary(s, sc); return L.myoAge == null || !Number.isFinite(L.myoAge) ? ['Add labs for your Myo age', 'muted'] : [`Myo age ${L.myoAge.toFixed(1)}`, L.myoAge <= s.profile.age ? 'good' : 'warn']; } catch { return [desc(n), 'muted']; } }
      case 'sleep': return vt.sleepH != null ? [`Last night ${vt.sleepH} h`, vt.sleepH >= 7 ? 'good' : 'warn'] : ['Start a 14-night study', 'muted'];
      case 'recovery': return sc.readiness != null ? [`Readiness ${sc.readiness} · ${sc.readiness >= 60 ? 'train' : 'recover'}`, sc.readiness >= 60 ? 'good' : 'warn'] : ['Heat, cold, light and sound', 'muted'];
      case 'heart': return vt.rhr ? [`Resting ${vt.rhr} bpm${vt.hrv ? ` · HRV ${vt.hrv} ms` : ''}`, vt.rhrBase && vt.rhr > vt.rhrBase ? 'warn' : 'good'] : ['Anatomy, rhythm, coronaries', 'muted'];
      case 'stream': { const L = s.sensors && s.sensors.log && s.sensors.log[s.sensors.log.length - 1]; return L ? [`Last: ${L.hr ? L.hr + ' bpm' : L.br + ' breaths/min'} · quality ${L.q}`, L.q >= 60 ? 'good' : 'warn'] : ['Pulse, heart sounds, breathing', 'muted']; }
      case 'twin': { if (!OS.twin) return ['A 3D model of you', 'muted']; const C = OS.twin.completeness(s, OS.twin.baseline(s)); return [`Twin ${C.pct}% built${C.live ? ' · live' : ''}`, C.pct >= 60 ? 'good' : 'warn']; }
      case 'surgery': { const P = s.procedure || {}; if (!P.date) return ['Prepare, day-of updates, recovery', 'muted']; const d = Math.round((Date.parse(P.date + 'T12:00:00') - Date.parse(dayKey() + 'T12:00:00')) / 864e5); return [d > 0 ? `${P.name || 'Surgery'} in ${d} day${d === 1 ? '' : 's'}` : d === 0 ? 'Surgery today' : `Day ${-d} of recovery`, d > 0 ? 'warn' : 'good']; }
      case 'atlas': return ['Every system, embryo to old age', 'muted'];
      case 'flow': { const L = ((s.flow && s.flow.log) || []).slice(-1)[0]; return L && L.psv != null ? [`Last Doppler: peak ${L.psv} cm/s`, 'good'] : ['Doppler, perfusion, circulation', 'muted']; }
      case 'ultrasound': return ['Any scanner with a video output', 'muted'];
      case 'food': { const st = OS.food && OS.food.status(s); return st || ['Grow, scan, additives, pesticides', 'muted']; }
      case 'chip': return ['Implant concept and protocol simulator', 'muted'];
      case 'face': { const st = OS.face && OS.face.status(s); return st || ['Silent commands and face scan', 'muted']; }
      case 'cases': { try { return OS.cases.status(s); } catch { return ['Provider assessment process', 'muted']; } }
      case 'academy': { const st = OS.academy && OS.academy.status(); return st || ['Lessons and practice cases', 'muted']; }
      case 'insights': { const st = OS.insights && OS.insights.status(s); return st || ['Patterns and experiments', 'muted']; }
      case 'cycle': { const st = OS.cycle && OS.cycle.status(s); return st || ['Periods, phases, menopause', 'muted']; }
      case 'env': { const st = OS.env && OS.env.status(s); return st || ['Set your place for air and UV', 'muted']; }
      case 'care': { const st = OS.care && OS.care.status(s); return st || ['Team, visits, routines', 'muted']; }
      case 'emergency': { const I = s.emergency && s.emergency.id; return I && (I.allergies || I.conditions || I.blood) ? ['Medical ID ready · first aid offline', 'good'] : ['Add your medical ID', 'warn']; }
      case 'pregnancy': { const w = OS.pregnancy && OS.pregnancy.status(s); return w ? [`${w} pregnant`, 'good'] : ['Dates, scans and growth', 'muted']; }
      case 'wave': { const n = OS.wave && OS.wave.status(s); return n ? [n, 'good'] : ['StemWave and shockwave log', 'muted']; }
      case 'bodycomp': { if (OS.bodycomp && OS.bodycomp.ensure) OS.bodycomp.ensure(s); const xs =((s.bodycomp && s.bodycomp.scans) || []).slice().sort((a, b) => a.d.localeCompare(b.d)), L = xs[xs.length - 1]; return L ? [`${L.bf != null ? `Body fat ${L.bf}%` : `${L.w} kg`} · ${L.kind === 'dexa' ? 'DEXA' : 'scale'} ${OS.fmtDate(L.d)}`, 'good'] : ['Smart scale and DEXA', 'muted']; }
      case 'bci': { const n = ((s.neuro && s.neuro.log) || []).length; return n ? [`${n} EEG session${n > 1 ? 's' : ''} saved`, 'good'] : ['EEG, decoders, implant design', 'muted']; }
      case 'logbook': { const wk = dayKey(OS.addDays(new Date(), -6)), n = (s.symptoms || []).filter((r) => r.at.slice(0, 10) >= wk).length; return n ? [`${n} symptom${n > 1 ? 's' : ''} this week`, 'warn'] : ['Every input on one timeline', 'muted']; }
      case 'wearables': { const on = ['oura', 'whoop'].filter((x) => s.wearables && s.wearables[x]); return on.length ? [`${on.map((x) => (x === 'oura' ? 'Oura' : 'WHOOP')).join(' and ')} connected`, 'good'] : ['Connect Oura or WHOOP', 'warn']; }
      case 'profile': return OS.auth && OS.auth.user ? ['Signed in · synced', 'good'] : ['Sign in to sync your devices', 'muted'];
      case 'system': return [`Myo ${OS.VERSION} · build ${OS.BUILD}`, 'muted'];
      case 'training': {
        const ex = s.training.session.exercises || [];
        if (!ex.length) return ['Pick a program', 'warn'];
        const sets = ex.flatMap((e) => e.sets), d = sets.filter((x) => x.done).length;
        return [`${s.training.session.name} · ${d} of ${sets.length} sets`, d >= sets.length ? 'good' : 'muted'];
      }
      case 'machines': return ['APS and ISO Flow · sample feed', 'muted'];
      case 'gym': return [`${(s.gym.items || []).length} pieces on ${s.gym.name}`, 'muted'];
      case 'fuel': { const tg = targets(s.profile), p = (s.nutrition.meals[k] || []).reduce((a, m) => a + (Number(m.p) || 0), 0); return [`${Math.round(p)} of ${tg.p} g protein today`, p >= tg.p ? 'good' : 'muted']; }
      case 'life': { const h = s.life.habits || []; if (!h.length) return ['Add habits and goals', 'muted']; const d = h.filter((x) => x.log && x.log[k]).length; return [`${d} of ${h.length} habits today`, d >= h.length ? 'good' : 'muted']; }
      case 'augment': { try { return [`Tier: ${OS.augment.tier(s).name}`, 'muted']; } catch { return [desc(n), 'muted']; } }
      default: return [desc(n), 'muted'];
    }
  }

  /* ── the ring: outer ticks, five system arcs filled to their score, an inner dashed ring ── */
  function rings(sc) {
    const C = 2 * Math.PI * 160, seg = (C * 68) / 360;
    const arcs = PARTS.map(([k, , c], i) => {
      const v = sc.parts[k], rot = -90 + 2 + i * 72, len = v == null ? 0 : (seg * Math.max(0, Math.min(100, v))) / 100;
      return `<circle class="hub-track" cx="200" cy="200" r="160" stroke-dasharray="${seg.toFixed(1)} ${(C - seg).toFixed(1)}" transform="rotate(${rot} 200 200)"/>`
        + (len ? `<circle cx="200" cy="200" r="160" fill="none" stroke="${c}" stroke-width="9" stroke-dasharray="${len.toFixed(1)} ${(C - len).toFixed(1)}" transform="rotate(${rot} 200 200)"/>` : '');
    }).join('');
    return `<svg class="hub-rings" viewBox="0 0 400 400" aria-hidden="true">
      <circle cx="200" cy="200" r="193" class="hub-r0"/>
      <g class="hub-spin"><circle cx="200" cy="200" r="182" class="hub-ticks"/></g>
      ${arcs}
      <g class="hub-spin-r"><circle cx="200" cy="200" r="141" class="hub-dash"/></g>
    </svg>`;
  }

  function render(s, sc) {
    const groups = CLUSTERS.map((c) => ({ ...c, items: c.items.filter((n) => OS.views[n]) })).filter((c) => c.items.length);
    const total = groups.reduce((a, c) => a + c.items.length, 0);
    const scored = PARTS.filter(([k]) => sc.parts[k] != null).length;
    const panel = (c) => `<section class="hub-c" data-k="${c.k}" aria-labelledby="hub-h-${c.k}">
        <header class="hub-ch"><span class="hub-code">${c.code}</span><h2 id="hub-h-${c.k}">${esc(c.label)}</h2><span class="hub-cnt num" aria-label="${c.items.length} functions">${c.items.length}</span></header>
        <ul class="hub-ns">${c.items.map((n) => {
          const [txt, st] = status(n, s, sc);
          return `<li><a class="hub-n" href="#${n}" data-route="${n}" title="${esc(desc(n))}"><span class="hub-ic">${icon(OS.views[n].icon, 17)}</span><span class="hub-t"><b>${esc(title(n))}</b><small>${esc(txt)}</small></span><i class="hub-dot st-${st}" aria-hidden="true"></i></a></li>`;
        }).join('')}</ul>
      </section>`;
    return `${OS.ui.head('Myo hub', 'Every function, one living cell', 'Myo is the intelligence at the centre. Each connection opens a part of the app, and the ring shows your five systems.',
        `<div class="hstat"><span>Functions linked</span><b class="num">${total}</b></div><div class="hstat"><span>Systems scored</span><b class="num">${scored}/5</b></div>`)}
      ${OS.sampleBanner ? OS.sampleBanner(s) : ''}
      <div class="hub-wrap"><section class="hub-stage" aria-label="Myo hub: every function of the app">
        <svg class="hub-wires" aria-hidden="true"></svg>
        <div class="hub-q">${icon('search', 16)}<label class="sr" for="hub-q">Find a function</label><input id="hub-q" type="search" placeholder="Find any function" autocomplete="off" spellcheck="false" enterkeyhint="go"><kbd class="hub-kbd" aria-hidden="true">Ctrl K</kbd></div>
        <nav class="hub-col hub-l" aria-label="Body, recovery and data">${groups.filter((c) => c.side === 'l').map(panel).join('')}</nav>
        <div class="hub-core">
          <div class="hub-ringbox">${rings(sc)}<a class="hub-cell" href="#coach" aria-label="Talk to Myo"><canvas id="hub-av" aria-hidden="true"></canvas></a></div>
          <div class="hub-meta"><b>MYO</b><span class="hub-st" data-st="${OS.Avatar ? OS.Avatar.state : 'idle'}"><i></i>${OS.Avatar ? OS.Avatar.label() : 'Online'}</span></div>
          <ul class="hub-parts" aria-label="Your five systems">${PARTS.map(([k, l, c]) => `<li><i style="background:${c}"></i>${l} <b>${OS.dash(sc.parts[k] == null ? null : Math.round(sc.parts[k]))}</b></li>`).join('')}</ul>
          <div class="hub-mk"><span>Myo Score</span><b class="num">${OS.dash(sc.mk)}</b><span>Readiness</span><b class="num">${OS.dash(sc.readiness)}</b></div>
          <a class="btn hub-talk" href="#coach">${icon('coach', 16)}<span>Talk to Myo</span></a>
        </div>
        <nav class="hub-col hub-r" aria-label="Your day, training and life">${groups.filter((c) => c.side === 'r').map(panel).join('')}</nav>
      </section></div>
      <p class="fine">Status lines come from your data on this device${s.sample ? ', which is the sample member until you start with your own' : ''}. Machine feeds stay samples until Merakinetics hardware pairs.</p>`;
  }

  /* ── traces: from the ring to each panel, with 45° bends, vias, a terminal pad and a short branch ── */
  const f1 = (n) => n.toFixed(1);
  function stub(p, i, stacked) {
    const len = 9 + (i % 3) * 6, dir = i % 2 ? -1 : 1;
    const x2 = p[0] + (stacked ? len : 0), y2 = p[1] + (stacked ? 0 : dir * len);
    return `<path class="hub-stub" d="M${f1(p[0])} ${f1(p[1])}L${f1(x2)} ${f1(y2)}"/><circle class="hub-term" cx="${f1(x2)}" cy="${f1(y2)}" r="2"/>`;
  }
  function wires(st, svg, motion) {
    const R = st.getBoundingClientRect();
    if (!R.width) return;
    const box = st.querySelector('.hub-ringbox').getBoundingClientRect();
    const cx = box.left - R.left + box.width / 2, cy = box.top - R.top + box.height / 2, rr = box.width * 0.4825;
    const stacked = getComputedStyle(st).getPropertyValue('--hub-stacked').trim() === '1';
    svg.setAttribute('viewBox', `0 0 ${Math.round(R.width)} ${Math.round(R.height)}`);
    let out = '';
    st.querySelectorAll('.hub-c').forEach((c, i) => {
      const b = c.getBoundingClientRect(), k = c.dataset.k, ay = b.top - R.top + 22;
      let pts;
      if (stacked) {
        // left out of the ring to the bus in the gutter, down the bus, then into the panel
        const bx = 14, ax = b.left - R.left, sx = cx - rr;
        pts = [[sx, cy], [bx + 10, cy], [bx, cy + 10], [bx, ay - 10], [bx + 10, ay], [ax, ay]];
      } else {
        const left = b.left + b.width / 2 < R.left + cx, ax = left ? b.right - R.left : b.left - R.left, sg = left ? 1 : -1;
        const ang = Math.atan2(ay - cy, ax - cx), sx = cx + Math.cos(ang) * rr, sy = cy + Math.sin(ang) * rr;
        const s1x = sx + Math.cos(ang) * 14, s1y = sy + Math.sin(ang) * 14, dy = ay - s1y, run = Math.abs(s1x - ax);
        if (run > Math.abs(dy) + 30) { const x1 = ax + sg * (Math.abs(dy) + 16); pts = [[sx, sy], [s1x, s1y], [x1, s1y], [x1 - sg * Math.abs(dy), ay], [ax, ay]]; }
        else { const mx = (s1x + ax) / 2; pts = [[sx, sy], [s1x, s1y], [mx, s1y], [mx, ay], [ax, ay]]; }
      }
      const d = 'M' + pts.map((p) => f1(p[0]) + ' ' + f1(p[1])).join('L'), end = pts[pts.length - 1], knee = pts[2];
      out += `<g data-k="${k}"><path class="hub-wg" d="${d}"/><path class="hub-w" d="${d}"/>
        <circle class="hub-via" cx="${f1(pts[1][0])}" cy="${f1(pts[1][1])}" r="2.6"/><circle class="hub-via" cx="${f1(knee[0])}" cy="${f1(knee[1])}" r="2.2"/>
        <rect class="hub-pad" x="${f1(end[0] - 3)}" y="${f1(end[1] - 3)}" width="6" height="6"/>${stub(knee, i, stacked)}
        ${motion ? `<circle class="hub-pulse" r="2.4"><animateMotion dur="${(2.8 + (i % 3) * 0.7).toFixed(1)}s" begin="${(i * 0.45).toFixed(2)}s" repeatCount="indefinite" path="${d}"/></circle>` : ''}</g>`;
    });
    svg.innerHTML = out;
  }

  function mount(root) {
    const st = root.querySelector('.hub-stage');
    if (!st) return;
    const svg = st.querySelector('.hub-wires'), q = st.querySelector('#hub-q');
    const motion = !((window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || document.documentElement.getAttribute('data-fx') === 'calm');
    const stopAv = OS.Avatar ? OS.Avatar.mount(st.querySelector('#hub-av')) : () => {};
    const unsub = OS.Avatar ? OS.Avatar.on((x) => { const el = st.querySelector('.hub-st'); if (el) { el.dataset.st = x; el.lastChild.textContent = OS.Avatar.label(x); } }) : () => {};
    let raf = 0;
    const queue = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; wires(st, svg, motion); }); };
    const ro = window.ResizeObserver ? new ResizeObserver(queue) : null;
    if (ro) ro.observe(st); else window.addEventListener('resize', queue);
    wires(st, svg, motion);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(queue).catch(() => {});

    // light the connection under the pointer or keyboard focus, and send a burst through the cell
    let lit = null;
    const light = (k) => {
      if (k === lit) return; lit = k;
      st.querySelectorAll('.hub-c').forEach((c) => c.classList.toggle('on', c.dataset.k === k));
      svg.querySelectorAll('g[data-k]').forEach((g) => g.classList.toggle('on', g.dataset.k === k));
      if (k && OS.Avatar && OS.Avatar.burst) OS.Avatar.burst();
    };
    const over = (e) => { const c = e.target.closest && e.target.closest('.hub-c'); light(c ? c.dataset.k : null); };
    st.addEventListener('pointerover', over);
    st.addEventListener('focusin', over);
    st.addEventListener('pointerleave', () => light(null));

    // find: dim what doesn't match; Enter opens the first match
    const filter = () => {
      const v = q.value.trim().toLowerCase(); let first = null;
      st.classList.toggle('filtering', !!v);
      st.querySelectorAll('.hub-n').forEach((a) => {
        const hit = !v || a.textContent.toLowerCase().includes(v) || desc(a.dataset.route).toLowerCase().includes(v);
        a.classList.toggle('hit', !!v && hit); a.classList.toggle('miss', !!v && !hit);
        if (v && hit && !first) first = a;
      });
      st.querySelectorAll('.hub-c').forEach((c) => c.classList.toggle('miss', !!v && !c.querySelector('.hub-n.hit')));
      svg.querySelectorAll('g[data-k]').forEach((g) => { const c = st.querySelector(`.hub-c[data-k="${g.dataset.k}"]`); g.classList.toggle('miss', !!(c && c.classList.contains('miss'))); });
      return first;
    };
    q.addEventListener('input', filter);
    q.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const a = filter(); if (a) { e.preventDefault(); location.hash = a.dataset.route; } }
      else if (e.key === 'Escape' && q.value) { e.stopPropagation(); q.value = ''; filter(); }
    });
    return () => { stopAv(); unsub(); if (ro) ro.disconnect(); else window.removeEventListener('resize', queue); if (raf) cancelAnimationFrame(raf); };
  }

  OS.register('myo', { title: 'Myo hub', icon: 'myo', render, mount });
})();
