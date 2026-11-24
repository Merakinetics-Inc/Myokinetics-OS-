/* ═══ MYOKINETICS OS v4 — FACILITY LAYER: Gym floor designer ═══ */
(function () {
  'use strict';
  const { esc, clamp, fmt, pill, icon } = OS;

  const CATALOG = {
    aps:     { name: 'APS Machine 2.0', w: 5, h: 7, zone: 'strength', users: 1, mk: true },
    iso:     { name: 'ISO Flow', w: 6, h: 8, zone: 'strength', users: 1, mk: true },
    rack:    { name: 'MK-Pro Rack', w: 6, h: 8, zone: 'strength', users: 2, mk: true },
    hangers: { name: 'Dumbbell Hangers wall', w: 10, h: 3, zone: 'strength', users: 4, mk: true },
    bench:   { name: 'Adjustable bench', w: 2, h: 5, zone: 'strength', users: 1, mk: true },
    tread:   { name: 'Treadmill', w: 3, h: 7, zone: 'cardio', users: 1 },
    bike:    { name: 'Bike (FTMS)', w: 2, h: 5, zone: 'cardio', users: 1 },
    rower:   { name: 'Rower (FTMS)', w: 2, h: 8, zone: 'cardio', users: 1 },
    turf:    { name: 'Turf lane', w: 6, h: 24, zone: 'functional', users: 4, noClear: true },
    mat:     { name: 'Recovery mats', w: 8, h: 8, zone: 'recovery', users: 3, noClear: true },
    plunge:  { name: 'Cold plunge', w: 4, h: 7, zone: 'recovery', users: 1 },
    arv:     { name: 'AR-Vision station', w: 3, h: 3, zone: 'tech', users: 0, noClear: true, mk: true }
  };
  const ZONES = { strength: 'Strength', cardio: 'Cardio', functional: 'Functional', recovery: 'Recovery', tech: 'AR / tech' };
  let sel = null;

  const dims = (it) => { const c = CATALOG[it.type]; return it.rot ? { w: c.h, h: c.w } : { w: c.w, h: c.h }; };
  const rect = (it, pad = 0) => { const d = dims(it); return { x: it.x - pad, y: it.y - pad, w: d.w + pad * 2, h: d.h + pad * 2 }; };
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  function analyze(g) {
    const items = g.items, issues = new Map(), conflicts = [];
    const flag = (id, kind) => { if (issues.get(id) !== 'hard') issues.set(id, kind); };
    items.forEach((a) => {
      const ra = rect(a);
      if (ra.x < 0 || ra.y < 0 || ra.x + ra.w > g.w || ra.y + ra.h > g.l) { flag(a.id, 'hard'); conflicts.push({ kind: 'hard', text: `${CATALOG[a.type].name} sits outside the room` }); }
    });
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (hit(rect(a), rect(b))) { flag(a.id, 'hard'); flag(b.id, 'hard'); conflicts.push({ kind: 'hard', text: `${CATALOG[a.type].name} overlaps ${CATALOG[b.type].name}` }); continue; }
      const ca = CATALOG[a.type].noClear ? 0 : g.clear, cb = CATALOG[b.type].noClear ? 0 : g.clear;
      if ((ca && hit(rect(a, ca), rect(b))) || (cb && hit(rect(b, cb), rect(a)))) { flag(a.id, 'soft'); flag(b.id, 'soft'); conflicts.push({ kind: 'soft', text: `${CATALOG[a.type].name} and ${CATALOG[b.type].name} are inside each other's ${g.clear} ft clearance` }); }
    }
    // reachability from the door through free floor (1 ft grid)
    const W = Math.floor(g.w), L = Math.floor(g.l), blocked = new Uint8Array(W * L);
    items.forEach((it) => { const r = rect(it); for (let y = Math.max(0, Math.floor(r.y)); y < Math.min(L, Math.ceil(r.y + r.h)); y++) for (let x = Math.max(0, Math.floor(r.x)); x < Math.min(W, Math.ceil(r.x + r.w)); x++) blocked[y * W + x] = 1; });
    const seen = new Uint8Array(W * L), door = [Math.floor(W / 2), L - 1], q = [];
    if (!blocked[door[1] * W + door[0]]) { q.push(door); seen[door[1] * W + door[0]] = 1; }
    while (q.length) { const [x, y] = q.pop(); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= L) return; const k = ny * W + nx; if (seen[k] || blocked[k]) return; seen[k] = 1; q.push([nx, ny]); }); }
    const reachable = items.filter((it) => { const r = rect(it); for (let x = Math.floor(r.x) - 1; x <= Math.ceil(r.x + r.w); x++) for (let y = Math.floor(r.y) - 1; y <= Math.ceil(r.y + r.h); y++) { if (x < 0 || y < 0 || x >= W || y >= L) continue; if (seen[y * W + x]) return true; } return false; });
    reachable.forEach(() => {}); items.forEach((it) => { if (!reachable.includes(it)) { flag(it.id, 'hard'); conflicts.push({ kind: 'hard', text: `${CATALOG[it.type].name} can't be reached from the entrance` }); } });
    const footprint = items.reduce((a, it) => { const d = dims(it); return a + d.w * d.h; }, 0);
    const util = footprint / (g.w * g.l);
    const utilScore = util < 0.25 ? util / 0.25 : util <= 0.5 ? 1 : clamp(1 - (util - 0.5) / 0.3, 0, 1);
    const hard = conflicts.filter((c) => c.kind === 'hard').length, soft = conflicts.length - hard;
    const reach = items.length ? reachable.length / items.length : 1;
    const flow = Math.round(clamp(100 * (0.55 * reach + 0.25 * (1 - Math.min(1, soft / Math.max(1, items.length))) + 0.2 * utilScore) - hard * 6, 0, 100));
    const concurrent = items.reduce((a, it) => a + CATALOG[it.type].users, 0);
    const zones = {}; items.forEach((it) => { const z = CATALOG[it.type].zone, d = dims(it); zones[z] = (zones[z] || 0) + d.w * d.h; });
    return { issues, conflicts, util, flow, concurrent, perHour: Math.round(concurrent * 60 / 45), zones, footprint, reach, hard, soft };
  }

  function place(g, type) {
    const c = CATALOG[type], pad = c.noClear ? 0 : g.clear;
    for (const rot of [0, 1]) for (let y = 1; y < g.l; y++) for (let x = 1; x < g.w; x++) {
      const it = { id: OS.uid(), type, x, y, rot }; const r = rect(it, pad);
      if (r.x < 0 || r.y < 0 || r.x + r.w > g.w || r.y + r.h > g.l - 3) continue;
      if (g.items.some((o) => hit(r, rect(o)) || hit(rect(it), rect(o, CATALOG[o.type].noClear ? 0 : g.clear)))) continue;
      return it;
    }
    return null;
  }

  const TEMPLATES = {
    home: { name: 'Home garage', w: 24, l: 20, list: ['rack', 'bench', 'hangers', 'aps', 'mat', 'arv'] },
    studio: { name: 'Boutique studio', w: 50, l: 35, list: ['aps', 'aps', 'iso', 'iso', 'rack', 'hangers', 'bench', 'bench', 'turf', 'tread', 'tread', 'arv', 'mat'] },
    commercial: { name: 'Commercial floor', w: 90, l: 60, list: ['aps', 'aps', 'aps', 'aps', 'iso', 'iso', 'iso', 'iso', 'rack', 'rack', 'rack', 'rack', 'hangers', 'hangers', 'bench', 'bench', 'bench', 'bench', 'bench', 'bench', 'turf', 'turf', 'tread', 'tread', 'tread', 'tread', 'tread', 'tread', 'bike', 'bike', 'bike', 'bike', 'rower', 'rower', 'rower', 'mat', 'mat', 'plunge', 'plunge', 'arv', 'arv', 'arv'] }
  };

  OS.register('gym', {
    title: 'Gym Designer', icon: 'gym',
    render(s) {
      const g = s.gym, a = analyze(g);
      const selIt = g.items.find((i) => i.id === sel);
      const counts = {}; g.items.forEach((i) => { counts[i.type] = (counts[i.type] || 0) + 1; });
      const grid = [];
      for (let x = 0; x <= g.w; x++) grid.push(`<line x1="${x}" y1="0" x2="${x}" y2="${g.l}" class="${x % 5 ? 'g1' : 'g5'}"/>`);
      for (let y = 0; y <= g.l; y++) grid.push(`<line x1="0" y1="${y}" x2="${g.w}" y2="${y}" class="${y % 5 ? 'g1' : 'g5'}"/>`);
      const labels = []; for (let x = 0; x <= g.w; x += 10) labels.push(`<text x="${x}" y="-0.6" class="gl">${x}′</text>`); for (let y = 10; y <= g.l; y += 10) labels.push(`<text x="-0.6" y="${y + 0.3}" class="gl" text-anchor="end">${y}′</text>`);
      const items = g.items.map((it) => {
        const c = CATALOG[it.type], d = dims(it), pad = c.noClear ? 0 : g.clear, st = a.issues.get(it.id) || 'ok';
        const fs = Math.min(0.9, d.w / (c.name.length * 0.42), d.h / 3);
        return `<g class="gi z-${c.zone} st-${st} ${sel === it.id ? 'sel' : ''}" data-id="${it.id}" transform="translate(${it.x} ${it.y})" tabindex="0" role="button" aria-label="${esc(c.name)} at ${it.x}, ${it.y} feet">
          ${pad ? `<rect class="clr" x="${-pad}" y="${-pad}" width="${d.w + pad * 2}" height="${d.h + pad * 2}" rx="0.4"/>` : ''}
          <rect class="fp" width="${d.w}" height="${d.h}" rx="0.3"/>
          <text x="${d.w / 2}" y="${d.h / 2}" class="gt" style="font-size:${fs.toFixed(2)}px">${esc(d.w >= d.h || d.w > 4 ? c.name : c.name.split(' ')[0])}</text></g>`;
      }).join('');
      const zoneBar = Object.keys(ZONES).map((z) => ({ z, v: (a.zones[z] || 0) / Math.max(1, a.footprint) })).filter((x) => x.v > 0);
      return `${OS.ui.head('Facility layer · B2B', 'Gym Designer', `${esc(g.name)} · ${g.w} × ${g.l} ft · ${fmt(g.w * g.l)} sq ft · drag to move, select to rotate`,
        `<div class="hstat"><span>Flow score</span><b class="num">${a.flow}</b></div><div class="hstat"><span>Floor used</span><b class="num">${Math.round(a.util * 100)}%</b></div><div class="hstat"><span>Capacity</span><b class="num">${a.concurrent}</b></div>`)}
      <div class="grid g-gym">
        <section class="card flush plan-card">
          <div class="plan-tools">
            <div class="row">${selIt ? `<b>${esc(CATALOG[selIt.type].name)}</b><span class="muted small num">${selIt.x}′, ${selIt.y}′ · ${dims(selIt).w}×${dims(selIt).h} ft</span><button class="btn ghost sm" data-act="g-rot">${icon('rotate', 14)} Rotate</button><button class="btn ghost sm" data-act="g-dup">Duplicate</button><button class="btn ghost sm danger" data-act="g-del">${icon('x', 14)} Remove</button>` : `<span class="muted small">Select a piece to rotate or remove it. Arrow keys nudge the selected piece.</span>`}</div>
          </div>
          <div class="plan-wrap"><svg id="plan" viewBox="-3 -2.5 ${g.w + 5} ${g.l + 5}" role="application" aria-label="Floor plan">
            <rect x="0" y="0" width="${g.w}" height="${g.l}" class="room"/>${grid.join('')}${labels.join('')}
            <rect x="${g.w / 2 - 3}" y="${g.l - 0.4}" width="6" height="0.8" class="door"/><text x="${g.w / 2}" y="${g.l + 1.6}" class="gl" text-anchor="middle">ENTRANCE</text>
            ${items}</svg></div>
        </section>
        <div class="stack">
          <section class="card">
            <div class="card-h"><h2>Add equipment</h2><span class="muted small">MK = Merakinetics</span></div>
            <div class="palette">${Object.entries(CATALOG).map(([k, c]) => `<button class="pal z-${c.zone}" data-act="g-add" data-type="${k}"><span class="pal-sw"></span><span><b>${esc(c.name)}</b><span class="muted small block num">${c.w}×${c.h} ft${c.mk ? ' · MK' : ''}</span></span></button>`).join('')}</div>
          </section>
          <section class="card">
            <div class="card-h"><h2>Layout check</h2>${a.hard ? pill('bad', a.hard + ' blocking') : a.soft ? pill('warn', a.soft + ' clearance') : pill('good', 'Clear')}</div>
            <ul class="issues">${a.conflicts.slice(0, 6).map((c) => `<li class="iss-${c.kind}">${esc(c.text)}</li>`).join('') || `<li class="iss-ok">Every piece is reachable from the entrance with ${g.clear} ft clearance.</li>`}</ul>
            <div class="zonebar" aria-label="Zone mix">${zoneBar.map((x) => `<span class="z-${x.z}" style="width:${(x.v * 100).toFixed(1)}%" title="${ZONES[x.z]} ${Math.round(x.v * 100)}%"></span>`).join('')}</div>
            <div class="zone-legend">${zoneBar.map((x) => `<span><i class="z-${x.z}"></i>${ZONES[x.z]} ${Math.round(x.v * 100)}%</span>`).join('')}</div>
            <p class="muted small">${a.concurrent} people training at once · about ${a.perHour} members an hour at 45-minute sessions.</p>
          </section>
          <section class="card">
            <div class="card-h"><h2>Room</h2></div>
            <form data-submit="g-room" class="form-grid three">
              <label class="field" for="g-name"><span>Name</span><input id="g-name" name="n" value="${esc(g.name)}"></label>
              <label class="field" for="g-w"><span>Width ft</span><input id="g-w" name="w" type="number" min="10" max="200" value="${g.w}"></label>
              <label class="field" for="g-l"><span>Length ft</span><input id="g-l" name="l" type="number" min="10" max="200" value="${g.l}"></label>
              <label class="field" for="g-c"><span>Clearance ft</span><input id="g-c" name="c" type="number" min="0" max="6" step="0.5" value="${g.clear}"></label>
              <div class="form-end"><button class="btn sm">Apply</button></div>
            </form>
            <div class="row"><span class="muted small">Start from</span>${Object.entries(TEMPLATES).map(([k, t]) => `<button class="chip-btn" data-act="g-tpl" data-t="${k}">${t.name} ${t.w}×${t.l}</button>`).join('')}</div>
          </section>
          <section class="card">
            <div class="card-h"><h2>Equipment schedule</h2><span class="muted small">${g.items.length} pieces</span></div>
            <div class="tbl-wrap"><table class="tbl compact"><tbody>${Object.entries(counts).map(([k, n]) => `<tr><td>${esc(CATALOG[k].name)}</td><td class="r num">×${n}</td><td class="muted small">${ZONES[CATALOG[k].zone]}</td></tr>`).join('')}</tbody></table></div>
            <div class="row"><button class="btn ghost sm" data-act="g-export" data-f="json">${icon('download', 14)} Blueprint JSON</button><button class="btn ghost sm" data-act="g-export" data-f="csv">${icon('download', 14)} Schedule CSV</button></div>
          </section>
        </div>
      </div>`;
    },
    mount(root) {
      const svg = root.querySelector('#plan'); if (!svg) return;
      let drag = null;
      const pt = (e) => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); };
      const down = (e) => {
        const gEl = e.target.closest('.gi'); if (!gEl) { if (sel) { sel = null; OS.render(); } return; }
        const it = OS.state.gym.items.find((i) => i.id === gEl.dataset.id); const p = pt(e);
        drag = { it, el: gEl, dx: p.x - it.x, dy: p.y - it.y, x: it.x, y: it.y, moved: false };
        gEl.setPointerCapture(e.pointerId); e.preventDefault();
      };
      const move = (e) => { if (!drag) return; const p = pt(e); const nx = Math.round(p.x - drag.dx), ny = Math.round(p.y - drag.dy); if (nx !== drag.x || ny !== drag.y) { drag.x = nx; drag.y = ny; drag.moved = true; drag.el.setAttribute('transform', `translate(${nx} ${ny})`); } };
      const up = () => { if (!drag) return; const d = drag; drag = null; sel = d.it.id; if (d.moved) OS.update((s) => { const it = s.gym.items.find((i) => i.id === d.it.id); it.x = d.x; it.y = d.y; }); else OS.render(); };
      const key = (e) => {
        const gEl = e.target.closest && e.target.closest('.gi'); if (!gEl) return;
        const id = gEl.dataset.id, mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (e.key === 'Enter' || e.key === ' ') { sel = id; OS.render(); refocus(id); e.preventDefault(); }
        else if (mv) { sel = id; OS.update((s) => { const it = s.gym.items.find((i) => i.id === id); it.x += mv[0]; it.y += mv[1]; }); refocus(id); e.preventDefault(); }
        else if (e.key === 'r' || e.key === 'R') { sel = id; OS.acts['g-rot'](); refocus(id); }
        else if (e.key === 'Delete' || e.key === 'Backspace') { sel = id; OS.acts['g-del'](); e.preventDefault(); }
      };
      const refocus = (id) => { const el = document.querySelector(`.gi[data-id="${id}"]`); if (el) el.focus(); };
      svg.addEventListener('pointerdown', down); svg.addEventListener('pointermove', move); svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up); svg.addEventListener('keydown', key);
      return () => { svg.removeEventListener('pointerdown', down); svg.removeEventListener('pointermove', move); svg.removeEventListener('pointerup', up); svg.removeEventListener('keydown', key); };
    }
  });

  OS.act('g-add', (el) => {
    const it = place(OS.state.gym, el.dataset.type);
    if (!it) { OS.toast(`No free floor with ${OS.state.gym.clear} ft clearance for ${CATALOG[el.dataset.type].name}. Enlarge the room or move pieces.`); return; }
    sel = it.id; OS.update((s) => { s.gym.items.push(it); });
  });
  OS.act('g-rot', () => OS.update((s) => { const it = s.gym.items.find((i) => i.id === sel); if (it) it.rot = it.rot ? 0 : 1; }));
  OS.act('g-del', () => { OS.update((s) => { s.gym.items = s.gym.items.filter((i) => i.id !== sel); }); sel = null; OS.render(); });
  OS.act('g-dup', () => {
    const it = OS.state.gym.items.find((i) => i.id === sel); if (!it) return;
    const n = place(OS.state.gym, it.type);
    if (!n) { OS.toast('No free floor left for a copy.'); return; }
    sel = n.id; OS.update((s) => { s.gym.items.push(n); });
  });
  OS.act('g-room', (f) => OS.update((s) => { const e = f.elements; s.gym.name = e.n.value.trim() || s.gym.name; s.gym.w = clamp(+e.w.value || s.gym.w, 10, 200); s.gym.l = clamp(+e.l.value || s.gym.l, 10, 200); s.gym.clear = clamp(+e.c.value, 0, 6); }));
  OS.act('g-tpl', (el) => {
    const t = TEMPLATES[el.dataset.t]; let skipped = 0; sel = null;
    OS.update((s) => { s.gym = { name: t.name, w: t.w, l: t.l, clear: s.gym.clear, items: [] }; t.list.forEach((ty) => { const it = place(s.gym, ty); if (it) s.gym.items.push(it); else skipped++; }); });
    OS.toast(`${t.name} template loaded${skipped ? `. ${skipped} pieces didn't fit` : ''}`);
  });
  OS.act('g-export', async (el) => {
    const g = OS.state.gym, a = analyze(g), f = el.dataset.f;
    const slug = g.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'layout';
    const data = f === 'json'
      ? JSON.stringify({ format: 'merakinetics.facility.v1', name: g.name, units: 'ft', room: { width: g.w, length: g.l, clearance: g.clear, entrance: { x: g.w / 2, y: g.l } }, metrics: { flowScore: a.flow, floorUsed: +a.util.toFixed(3), concurrentUsers: a.concurrent, membersPerHour: a.perHour, issues: a.conflicts.map((c) => c.text) }, items: g.items.map((it) => ({ type: it.type, name: CATALOG[it.type].name, x: it.x, y: it.y, ...dims(it), rotated: !!it.rot, zone: CATALOG[it.type].zone })) }, null, 2)
      : 'item,name,zone,x_ft,y_ft,width_ft,length_ft,rotated\n' + g.items.map((it) => { const d = dims(it); return [it.type, CATALOG[it.type].name, CATALOG[it.type].zone, it.x, it.y, d.w, d.h, it.rot ? 'yes' : 'no'].join(','); }).join('\n');
    const filename = `${slug}.${f}`;
    const dl = OS.caps && OS.caps.downloads;
    if (dl) { try { await dl.save({ filename, data }); return; } catch (e) { if (e && e.code === 'declined') return; } }
    try { await navigator.clipboard.writeText(data); OS.toast(`${f.toUpperCase()} copied to clipboard`); } catch { OS.toast('Saving files isn\'t available in this view.'); }
  });
  OS.gymAnalyze = analyze;
})();
