/* ═══ MYO — ANATOMY 3D: real human anatomy as an interactive hologram ═══
   Meshes: BodyParts3D, (c) The Database Center for Life Science, CC BY-SA 2.1 Japan (models/anatomy, built by
   tools/build.js): skin, skeleton, muscles, heart and vessels, brain and nerves, airways, digestive organs,
   kidneys and glands, about 520k triangles, loaded per system on demand.
   Two looks: Hologram (fresnel edges, additive light, scan band) and Clinical (medical-illustration colours, studio light).
   Drag to rotate, wheel or pinch to zoom, tap a structure to pop it out with the member's biomarkers for that organ.
   Any rendered element with data-a3d="full|compact" gets a viewer: OS.Anatomy.mountAll(root) → cleanup.
   Body page (route "body"): the full explorer with systems, organ list and the pop-out card. */
(function () {
  'use strict';
  const { esc, icon, pill } = OS;
  const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
  const BASE = 'models/anatomy/';

  const SYS = [
    { id: 'skin', name: 'Skin', holo: '#5fb4ff', real: '#caa18c', a: 0.16 },
    { id: 'skeletal', name: 'Skeleton', holo: '#d9ecff', real: '#e8dcc5', a: 0.55 },
    { id: 'muscular', name: 'Muscles', holo: '#ff6b7a', real: '#a93f37', a: 0.42 },
    { id: 'cardiovascular', name: 'Heart and vessels', holo: '#ff4d5e', real: '#bf2f2f', a: 0.9 },
    { id: 'nervous', name: 'Brain and nerves', holo: '#ffd36b', real: '#eec45a', a: 0.7 },
    { id: 'respiratory', name: 'Airways', holo: '#6fd3ff', real: '#e7c9bd', a: 0.6 },
    { id: 'digestive', name: 'Digestive organs', holo: '#ffad66', real: '#c77b69', a: 0.55 },
    { id: 'urinary', name: 'Kidneys and bladder', holo: '#ffe08a', real: '#93352b', a: 0.7 },
    { id: 'endocrine', name: 'Glands', holo: '#c58bff', real: '#d9a24f', a: 0.85 }
  ];
  const SYS_BY = Object.fromEntries(SYS.map((x) => [x.id, x]));
  const PRESETS = {
    all: ['skin', 'skeletal', 'cardiovascular', 'nervous', 'respiratory', 'digestive', 'urinary', 'endocrine', 'muscular'],
    circulation: ['skin', 'cardiovascular'],
    skeleton: ['skin', 'skeletal'],
    organs: ['skin', 'respiratory', 'digestive', 'urinary', 'endocrine', 'cardiovascular'],
    nerves: ['skin', 'nervous'],
    muscles: ['skin', 'muscular', 'skeletal']
  };
  const PRESET_NAMES = [['all', 'All systems'], ['circulation', 'Circulation'], ['skeleton', 'Skeleton'], ['organs', 'Organs'], ['nerves', 'Nervous'], ['muscles', 'Muscles']];

  // organs that carry the member's data (markers are ids from the health record)
  const ORG = [
    { k: 'brain', sys: 'nervous', re: /brain|cerebr|cerebell|pons|medulla|midbrain|thalam|hippocamp|corpus callosum|gyrus|caudate nucleus|putamen|amygdala|insula|lobe|ventricle|aqueduct|colliculus|habenula|capsule|tuber/i, name: 'Brain', markers: ['b12', 'o3'], about: 'Focus, mood and sleep quality start here. Myo follows it through B12, omega-3 and your Function tests.' },
    { k: 'eyes', sys: 'nervous', re: /iris|sclera|choroid|vitreous|cornea|lens|chamber|rectus|oblique|palpebrae/i, name: 'Eyes', markers: [], about: 'Eyes and the six muscles that aim each one.' },
    { k: 'nerves', sys: 'nervous', re: /./, name: 'Nerves and spinal cord', markers: ['b12'], about: 'The wiring between brain and body. B12 keeps nerve insulation healthy.' },
    { k: 'heart', sys: 'cardiovascular', re: /heart|atrium|atrial|ventricle|ventricular|papillary|valve|cusp|myocard|chordae|trabecul|septum/i, name: 'Heart', markers: ['apob', 'ldl', 'hdl', 'tg', 'lpa'], vitals: true, about: 'Your engine. Lipids show what is building up in the arteries; resting heart rate and HRV show how well it recovers.' },
    { k: 'vessels', sys: 'cardiovascular', re: /./, name: 'Blood vessels', markers: ['crp', 'hcy', 'hgb', 'ferr', 'o3'], about: 'About 100,000 km of arteries and veins. Inflammation and homocysteine show how the lining is doing.' },
    { k: 'lungs', sys: 'respiratory', re: /./, name: 'Lungs and airways', markers: [], lungs: true, about: 'The bronchial tree that carries air to 480 million alveoli. VO2max is the best measure of what it delivers.' },
    { k: 'liver', sys: 'digestive', re: /liver|hepat|biliary|bile|cystic|gallbladder/i, name: 'Liver', markers: ['alt'], about: 'Detox, fat and sugar processing. ALT is the first sign of strain.' },
    { k: 'pancreas', sys: 'digestive', re: /pancrea/i, name: 'Pancreas', markers: ['a1c', 'glu', 'ins'], about: 'Makes insulin. HbA1c, fasting glucose and insulin show how well it keeps blood sugar steady.' },
    { k: 'gut', sys: 'digestive', re: /./, name: 'Gut', markers: ['ferr', 'b12', 'mg'], about: 'Where nutrients get in. Ferritin, B12 and magnesium show what is being absorbed.' },
    { k: 'kidneys', sys: 'urinary', re: /kidney|renal|ureter/i, name: 'Kidneys', markers: ['egfr'], about: 'Filter about 180 litres of blood a day. eGFR is their filtration rate.' },
    { k: 'bladder', sys: 'urinary', re: /./, name: 'Bladder', markers: [], about: 'Stores urine. Hydration habits show up here first.' },
    { k: 'adrenals', sys: 'endocrine', re: /adrenal|suprarenal/i, name: 'Adrenal glands', markers: ['cort'], about: 'Stress hormones. Morning cortisol shows how your stress system is set.' },
    { k: 'pituitary', sys: 'endocrine', re: /pituitary|hypophysis/i, name: 'Pituitary', markers: ['tsh', 'ft3', 'tt', 'ft'], about: 'The master gland that sets thyroid and sex-hormone output.' },
    { k: 'glands', sys: 'endocrine', re: /./, name: 'Glands', markers: [], about: 'Pineal and thymus: sleep timing and immune training.' },
    { k: 'bones', sys: 'skeletal', re: /./, name: 'Skeleton', markers: ['vitd'], about: '206 bones. Vitamin D and loaded training keep them dense; a DEXA scan in Imaging measures it.' },
    { k: 'muscles', sys: 'muscular', re: /./, name: 'Muscles', markers: ['ck', 'mg'], about: 'Creatine kinase shows muscle damage from training; magnesium supports contraction and recovery.' },
    { k: 'skin', sys: 'skin', re: /./, name: 'Skin', markers: ['vitd'], about: 'Your largest organ and where vitamin D is made in sunlight.' }
  ];
  const organOf = (sys, name) => ORG.find((o) => o.sys === sys && o.re.test(name));
  const ORG_BY = Object.fromEntries(ORG.map((o) => [o.k, o]));
  // training muscle groups → BodyParts3D muscle names (for the "muscles worked" glow)
  const MUSCLE_RE = { delts: /deltoid/i, chest: /pectoralis major/i, biceps: /biceps brachii|brachialis$/i, triceps: /triceps/i,
    forearms: /brachioradialis|pronator|supinator|palmaris|(flexor|extensor) (carpi|digitorum superficialis|digitorum profundus|pollicis|indicis)|extensor digitorum$|digiti minimi of (left|right) hand/i,
    core: /rectus abdominis|transversus abdominis|linea alba|psoas/i, obliques: /external oblique|internal oblique/i, quads: /rectus femoris|vastus/i,
    adductors: /adductor (brevis|longus|magnus|minimus)|gracilis|pectineus/i, calves: /gastrocnemius|soleus/i,
    rotator: /supraspinatus|infraspinatus|teres minor|subscapularis/i, glutes: /gluteus|tensor fasciae latae|piriformis/i,
    hamstrings: /biceps femoris|semitendinosus|semimembranosus/i, back: /psoas|iliacus|quadratus lumborum|levatores costarum|erector|multifidus/i,
    neck: /sternocleidomastoid|scalen|splenius|levator scapulae/i, tibialis: /tibialis|fibularis|extensor digitorum longus|extensor hallucis longus/i };
  const HOTSPOTS = ['brain', 'heart', 'lungs', 'liver', 'pancreas', 'kidneys', 'adrenals', 'pituitary'];

  // colours per structure (clinical look and hologram look)
  function partColor(sys, n, look) {
    const H = look === 'holo';
    if (sys === 'cardiovascular') { if (/vein|vena|venous|sinus/i.test(n)) return H ? '#6f8dff' : '#3a5cae'; if (/heart|atri|ventric|valve|papillary|myocard|cusp|chordae|septum/i.test(n)) return H ? '#ff5a6e' : '#a62a28'; return H ? '#ff4d5e' : '#c4302e'; }
    if (sys === 'nervous') { if (/iris/i.test(n)) return H ? '#9fd4ff' : '#4d6f8f'; if (/sclera|cornea|lens|vitreous|chamber|choroid/i.test(n)) return H ? '#cfeaff' : '#efefef'; if (/rectus|oblique|palpebrae/i.test(n)) return H ? '#ff8a96' : '#a8473f'; if (ORG_BY.brain.re.test(n)) return H ? '#ffd9a6' : '#e3b7aa'; return H ? '#ffd36b' : '#efc65a'; }
    if (sys === 'digestive') { if (/liver|hepat/i.test(n)) return H ? '#ff9a5a' : '#86321f'; if (/biliary|bile|cystic|gall/i.test(n)) return H ? '#9bffb0' : '#4f7d3a'; if (/pancrea/i.test(n)) return H ? '#ffd08a' : '#e1ae78'; if (/tooth|teeth/i.test(n)) return H ? '#f2f7ff' : '#f2ede0'; if (/tongue/i.test(n)) return H ? '#ff8a8a' : '#c26a6a'; return H ? '#ffad66' : '#cf8f80'; }
    if (sys === 'urinary') { if (/kidney|renal/i.test(n)) return H ? '#ffcf6a' : '#8f342a'; return H ? '#ffe08a' : '#d6a48f'; }
    if (sys === 'respiratory') { if (/diaphragm/i.test(n)) return H ? '#ff8a96' : '#ad4a40'; return H ? '#6fd3ff' : '#e7c9bd'; }
    return H ? SYS_BY[sys].holo : SYS_BY[sys].real;
  }
  const rgb = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  const lin = (c) => c.map((x) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4))); // lit materials expect linear colour
  const title = (n) => n.charAt(0).toUpperCase() + n.slice(1);

  /* ── data: three.js, meta and system packs, cached across views ── */
  const C = { T: null, meta: null, geo: {}, loading: {} };
  async function three() { if (!C.T) C.T = await import(THREE_URL); return C.T; }
  async function meta() { if (!C.meta) { const r = await fetch(BASE + 'meta.json'); if (!r.ok) throw new Error('Anatomy data is missing (' + r.status + ').'); C.meta = await r.json(); } return C.meta; }
  function loadSystem(id) {
    if (C.geo[id]) return Promise.resolve(C.geo[id]);
    if (!C.loading[id]) C.loading[id] = (async () => {
      const T = await three(), M = await meta(), sm = M.systems[id];
      if (!sm) throw new Error('No ' + id + ' pack');
      const r = await fetch(BASE + id + '.b64.txt'); if (!r.ok) throw new Error('Could not load ' + id + ' (' + r.status + ').');
      const raw = atob((await r.text()).trim()), u8 = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i);
      const buf = u8.buffer, lo = M.box.lo, sp = M.box.span;
      let nv = 0, ni = 0; sm.parts.forEach((p) => { nv += p.v[1]; ni += p.i[1]; });
      const pos = new Float32Array(nv * 3), cr = new Float32Array(nv * 3), ch = new Float32Array(nv * 3), idx = new Uint32Array(ni), ranges = [];
      let vb = 0, ib = 0;
      sm.parts.forEach((p) => {
        const q = new Uint16Array(buf, p.v[0], p.v[1] * 3), ix = new Uint16Array(buf, p.i[0], p.i[1]);
        const a = lin(rgb(partColor(id, p.n, 'real'))), b = rgb(partColor(id, p.n, 'holo'));
        for (let i = 0; i < p.v[1]; i++) for (let k = 0; k < 3; k++) { const o = (vb + i) * 3 + k; pos[o] = lo[k] + (q[i * 3 + k] / 65535) * sp[k]; cr[o] = a[k]; ch[o] = b[k]; }
        for (let i = 0; i < p.i[1]; i++) idx[ib + i] = ix[i] + vb;
        const org = organOf(id, p.n);
        ranges.push({ t0: ib / 3, tn: p.i[1] / 3, name: p.n, id: p.id, org: org ? org.k : null });
        vb += p.v[1]; ib += p.i[1];
      });
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3));
      g.setAttribute('color', new T.BufferAttribute(cr, 3));
      g.setAttribute('cHolo', new T.BufferAttribute(ch, 3));
      g.setIndex(new T.BufferAttribute(idx, 1));
      g.computeVertexNormals(); g.computeBoundingSphere();
      // organ centroids for hotspots
      const cent = {};
      ranges.forEach((rg) => { if (!rg.org) return; const c = cent[rg.org] || (cent[rg.org] = [0, 0, 0, 0]); for (let t = rg.t0; t < rg.t0 + rg.tn; t += 3) { const v = idx[t * 3] * 3; c[0] += pos[v]; c[1] += pos[v + 1]; c[2] += pos[v + 2]; c[3]++; } });
      Object.values(cent).forEach((c) => { c[0] /= c[3]; c[1] /= c[3]; c[2] /= c[3]; });
      return (C.geo[id] = { g, ranges, idx, pos, cent });
    })();
    return C.loading[id];
  }

  /* ── shaders ── */
  const HOLO_V = `attribute vec3 cHolo; varying vec3 vN, vV, vC, vW;
    void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=normalize(normalMatrix*normal); vec4 mv=viewMatrix*w; vV=normalize(-mv.xyz); vC=cHolo; gl_Position=projectionMatrix*mv; }`;
  const HOLO_F = `uniform float uA, uTime, uDim, uHi; uniform vec3 uTint; varying vec3 vN, vV, vC, vW;
    void main(){ float f=1.-abs(dot(normalize(vN),normalize(vV))); float fr=pow(f,2.);
      float band=exp(-pow((vW.y-(fract(uTime*.07)*1.9-.12))*16.,2.));
      float lines=.88+.12*sin(vW.y*900.);
      vec3 c=mix(vC,uTint,uHi)*(.3+1.3*fr)*lines+vC*band*.55;
      float a=uA*uDim*(.16+.84*fr)+band*.08*uA*uDim;
      gl_FragColor=vec4(c,a); }`;

  /* ── viewer ── */
  function viewer(box, opts = {}) {
    const full = opts.mode === 'full';
    const st = { look: opts.look || 'holo', systems: (opts.systems || PRESETS.circulation).slice(), sel: null, alive: true, yaw: 0.35, pitch: 0.06, dist: 3.9, tgt: [0, 0.82, 0], goal: null, raf: 0, auto: true, last: 0 };
    const START = { torso: { yaw: 0.2, pitch: 0.05, dist: 2.1, tgt: [0, 1.08, 0] }, legs: { yaw: 0.35, pitch: 0.02, dist: 2.3, tgt: [0, 0.48, 0] }, head: { yaw: 0.35, pitch: 0.04, dist: 1.1, tgt: [0, 1.45, 0] } };
    if (START[opts.view]) Object.assign(st, JSON.parse(JSON.stringify(START[opts.view])));
    let T, renderer, scene, cam, group, meshes = {}, ring, hi = null, glow = null, clock0 = performance.now(), ro = null;
    box.innerHTML = `<canvas class="a3d-cv" aria-label="3D model of the human body. Drag to rotate, scroll to zoom, tap a structure to inspect it."></canvas>
      <svg class="a3d-lines" aria-hidden="true"></svg><div class="a3d-spots"></div>
      <div class="a3d-load" role="status"><span class="a3d-spin"></span><span class="a3d-load-t">Loading anatomy</span></div>
      <div class="a3d-card" hidden></div>
      <div class="a3d-bar">
        <div class="a3d-presets" role="group" aria-label="Body systems">${PRESET_NAMES.slice(0, full ? 6 : 5).map(([k, l]) => `<button type="button" data-p="${k}">${l}</button>`).join('')}</div>
        <div class="a3d-tools"><div class="a3d-look" role="group" aria-label="Look"><button type="button" data-look="holo">Hologram</button><button type="button" data-look="real">Clinical</button></div>
          <button type="button" class="a3d-ic" data-view="reset" title="Reset view" aria-label="Reset view"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4"/></svg></button></div>
      </div>
      <p class="a3d-credit">Anatomy: BodyParts3D, © DBCLS, CC BY-SA 2.1 JP</p>`;
    const cv = box.querySelector('.a3d-cv'), lines = box.querySelector('.a3d-lines'), spots = box.querySelector('.a3d-spots'), card = box.querySelector('.a3d-card'), load = box.querySelector('.a3d-load'), loadT = box.querySelector('.a3d-load-t');
    const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const calm = () => document.documentElement.getAttribute('data-fx') === 'calm' || reduce;
    const syncBar = () => {
      box.querySelectorAll('[data-look]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.look === st.look)));
      const cur = Object.keys(PRESETS).find((k) => PRESETS[k].length === st.systems.length && PRESETS[k].every((x) => st.systems.includes(x)));
      box.querySelectorAll('[data-p]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.p === cur)));
      box.dataset.look = st.look;
      if (opts.onSystems) opts.onSystems(st.systems.slice());
    };
    syncBar();

    function holoMat(sys) {
      return new T.ShaderMaterial({ vertexShader: HOLO_V, fragmentShader: HOLO_F, transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
        uniforms: { uA: { value: SYS_BY[sys].a }, uTime: { value: 0 }, uDim: { value: 1 }, uHi: { value: 0 }, uTint: { value: new T.Color('#ffffff') } } });
    }
    function realMat(sys) {
      const skin = sys === 'skin';
      return new T.MeshStandardMaterial({ vertexColors: true, roughness: sys === 'skeletal' ? 0.75 : 0.5, metalness: 0.02, transparent: true, opacity: skin ? 0.2 : 1, depthWrite: !skin, side: skin ? T.FrontSide : T.DoubleSide });
    }
    function applyLook() {
      Object.entries(meshes).forEach(([sys, m]) => { if (m.material) m.material.dispose(); m.material = st.look === 'holo' ? holoMat(sys) : realMat(sys); m.renderOrder = sys === 'skin' ? 10 : 0; });
      if (ring) ring.visible = st.look === 'holo';
      if (hi) makeHighlight(hi.org, hi.ids);
      makeGlow();
      dim();
    }
    // light up the muscle groups a session works (opts.hi: training group keys)
    function makeGlow() {
      if (glow) { group.remove(glow); glow.geometry.dispose(); glow.material.dispose(); glow = null; }
      if (!opts.hi || !C.geo.muscular || !meshes.muscular) return;
      const res = opts.hi.map((k) => MUSCLE_RE[k]).filter(Boolean), G = C.geo.muscular;
      const list = G.ranges.filter((r) => res.some((re) => re.test(r.name)));
      if (!list.length) return;
      let n = 0; list.forEach((x) => { n += x.tn; });
      const ix = new Uint32Array(n * 3); let o = 0;
      list.forEach((x) => { ix.set(G.idx.subarray(x.t0 * 3, (x.t0 + x.tn) * 3), o); o += x.tn * 3; });
      const g = new T.BufferGeometry();
      ['position', 'normal', 'color', 'cHolo'].forEach((a) => g.setAttribute(a, G.g.getAttribute(a)));
      g.setIndex(new T.BufferAttribute(ix, 1));
      let mat;
      if (st.look === 'holo') { mat = holoMat('muscular'); mat.uniforms.uA.value = 1; mat.uniforms.uHi.value = 0.85; mat.uniforms.uTint.value = new T.Color('#ff9a3d'); }
      else mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, emissive: new T.Color('#ff6a1a'), emissiveIntensity: 0.5, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
      glow = new T.Mesh(g, mat); glow.renderOrder = 15; glow.visible = st.systems.includes('muscular'); group.add(glow);
    }
    function dim() {
      const d = st.sel ? 0.28 : 1;
      Object.values(meshes).forEach((m) => { if (st.look === 'holo') m.material.uniforms.uDim.value = d; else { const skin = m.userData.sys === 'skin'; m.material.opacity = skin ? 0.2 * d : d < 1 ? 0.3 : 1; m.material.depthWrite = !skin && d === 1; } });
    }
    async function ensure(sys) {
      if (meshes[sys]) { meshes[sys].visible = st.systems.includes(sys); return; }
      const G = await loadSystem(sys); if (!st.alive) return;
      const m = new T.Mesh(G.g, st.look === 'holo' ? holoMat(sys) : realMat(sys));
      m.userData.sys = sys; m.renderOrder = sys === 'skin' ? 10 : 0; m.visible = st.systems.includes(sys);
      meshes[sys] = m; group.add(m); dim();
    }
    async function setSystems(list) {
      st.systems = list.slice(); syncBar();
      Object.entries(meshes).forEach(([k, m]) => { m.visible = st.systems.includes(k); });
      if (st.sel && !st.systems.includes(st.sel.sys)) clear();
      const need = st.systems.filter((k) => !meshes[k]);
      if (need.length) { load.hidden = false; for (const k of need) { loadT.textContent = 'Loading ' + SYS_BY[k].name.toLowerCase(); try { await ensure(k); } catch (e) { loadT.textContent = e.message; return; } } load.hidden = true; }
      if (opts.hi && T && (!glow || need.includes('muscular'))) makeGlow();
      if (glow) glow.visible = st.systems.includes('muscular');
      placeSpots();
    }

    /* camera: custom orbit (yaw, pitch, distance) around a target, damped */
    const VIEWS = { reset: { yaw: 0.35, pitch: 0.06, dist: 3.9, tgt: [0, 0.82, 0] }, head: { yaw: 0.25, pitch: 0.05, dist: 1.05, tgt: [0, 1.5, 0] }, torso: { yaw: 0.3, pitch: 0.04, dist: 1.9, tgt: [0, 1.12, 0] } };
    function goView(v) { st.goal = JSON.parse(JSON.stringify(v)); }
    function placeCam() {
      const cy = Math.cos(st.pitch), x = Math.sin(st.yaw) * cy * st.dist, z = Math.cos(st.yaw) * cy * st.dist, y = Math.sin(st.pitch) * st.dist;
      cam.position.set(st.tgt[0] + x, st.tgt[1] + y, st.tgt[2] + z); cam.lookAt(st.tgt[0], st.tgt[1], st.tgt[2]);
    }
    // pointer: drag rotates, wheel/pinch zooms, a tap picks
    const ptr = new Map(); let down = null, pinch0 = 0;
    const onDown = (e) => { cv.setPointerCapture && cv.setPointerCapture(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]); down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 }; st.auto = false; st.goal = null; if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); } };
    const onMove = (e) => {
      if (!ptr.has(e.pointerId)) return;
      const p = ptr.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1]; ptr.set(e.pointerId, [e.clientX, e.clientY]);
      if (down) down.moved += Math.abs(dx) + Math.abs(dy);
      if (ptr.size === 2) { const [a, b] = [...ptr.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch0) st.dist = Math.min(6, Math.max(0.45, st.dist * (pinch0 / d))); pinch0 = d; return; }
      st.yaw -= dx * 0.008; st.pitch = Math.max(-0.9, Math.min(0.9, st.pitch + dy * 0.006));
    };
    const onUp = (e) => { ptr.delete(e.pointerId); if (ptr.size < 2) pinch0 = 0; if (down && down.moved < 6 && performance.now() - down.t < 500) pick(e); down = null; };
    const onWheel = (e) => { e.preventDefault(); st.goal = null; st.auto = false; st.dist = Math.min(6, Math.max(0.45, st.dist * (1 + Math.sign(e.deltaY) * 0.1))); };
    const onDbl = () => goView(VIEWS.reset);
    cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onUp);
    cv.addEventListener('wheel', onWheel, { passive: false }); cv.addEventListener('dblclick', onDbl);

    /* picking and the pop-out */
    function pick(e) {
      if (!T) return;
      const r = cv.getBoundingClientRect(), ray = new T.Raycaster();
      ray.setFromCamera(new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), cam);
      const targets = Object.values(meshes).filter((m) => m.visible && m.userData.sys !== 'skin');
      const hits = ray.intersectObjects(targets, false);
      const pool = hits.length ? hits : ray.intersectObjects(Object.values(meshes).filter((m) => m.visible), false);
      if (!pool.length) { clear(); return; }
      const h = pool[0], sys = h.object.userData.sys, G = C.geo[sys];
      let lo = 0, hiI = G.ranges.length - 1; while (lo < hiI) { const mid = (lo + hiI + 1) >> 1; if (G.ranges[mid].t0 <= h.faceIndex) lo = mid; else hiI = mid - 1; }
      const rg = G.ranges[lo];
      selectPart(sys, rg);
    }
    function selectPart(sys, rg) {
      const G = C.geo[sys], org = rg.org && ORG_BY[rg.org];
      // organs with health data pop out whole; anything else pops out on its own
      const whole = org && (org.markers.length || org.vitals || org.lungs) && !['vessels', 'bones', 'muscles', 'skin', 'nerves', 'gut'].includes(org.k);
      const list = whole ? G.ranges.filter((x) => x.org === rg.org) : G.ranges.filter((x) => x.id === rg.id);
      st.sel = { sys, org: rg.org, part: rg.name, ids: list, whole: !!whole };
      makeHighlight(rg.org, list); dim(); showCard();
      // fly in: frame the selection, keep the current angle
      st.auto = false; const c = hi.c, gp = group.position;
      st.goal = { yaw: st.yaw, pitch: Math.max(-0.2, Math.min(0.3, st.pitch)), dist: Math.max(0.55, Math.min(1.9, hi.size * 4.2 + 0.35)), tgt: [c[0] + gp.x, c[1], c[2] + gp.z] };
    }
    function selectOrgan(k) {
      const o = ORG_BY[k]; if (!o) return;
      const go = () => { const G = C.geo[o.sys]; const rg = G && G.ranges.find((x) => x.org === k); if (rg) selectPart(o.sys, rg); };
      if (!st.systems.includes(o.sys)) setSystems(st.systems.concat(o.sys)).then(go); else if (!C.geo[o.sys]) ensure(o.sys).then(go); else go();
    }
    function makeHighlight(orgK, list) {
      if (hi && hi.pivot) { group.remove(hi.pivot); hi.mesh.geometry.dispose(); hi.mesh.material.dispose(); }
      const sys = st.sel.sys, G = C.geo[sys];
      let n = 0; list.forEach((x) => { n += x.tn; });
      const ix = new Uint32Array(n * 3); let o = 0, cx = 0, cy = 0, cz = 0, cnt = 0, mn = [9, 9, 9], mx = [-9, -9, -9];
      list.forEach((x) => { ix.set(G.idx.subarray(x.t0 * 3, (x.t0 + x.tn) * 3), o); o += x.tn * 3; });
      for (let i = 0; i < ix.length; i += 3) { const v = ix[i] * 3; cx += G.pos[v]; cy += G.pos[v + 1]; cz += G.pos[v + 2]; cnt++; for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], G.pos[v + k]); mx[k] = Math.max(mx[k], G.pos[v + k]); } }
      const c = [cx / cnt, cy / cnt, cz / cnt], size = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
      const g = new T.BufferGeometry();
      ['position', 'normal', 'color', 'cHolo'].forEach((a) => g.setAttribute(a, G.g.getAttribute(a)));
      g.setIndex(new T.BufferAttribute(ix, 1));
      const mat = st.look === 'holo' ? holoMat(sys) : new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.05, emissive: new T.Color('#1d64f0'), emissiveIntensity: 0.18, side: T.DoubleSide });
      if (st.look === 'holo') { mat.uniforms.uA.value = 1; mat.uniforms.uHi.value = 0.35; mat.uniforms.uTint.value = new T.Color('#eaf6ff'); }
      const mesh = new T.Mesh(g, mat); mesh.position.set(-c[0], -c[1], -c[2]); mesh.renderOrder = 20;
      const pivot = new T.Group(); pivot.position.set(c[0], c[1], c[2]); pivot.add(mesh); group.add(pivot);
      const scale = size < 0.06 ? 1.9 : size < 0.15 ? 1.35 : 1.1;
      hi = { pivot, mesh, org: orgK, ids: list, c, size, scale, t: 0 };
    }
    function clear() {
      if (hi && hi.pivot) { group.remove(hi.pivot); hi.mesh.geometry.dispose(); hi.mesh.material.dispose(); }
      hi = null; st.sel = null; card.hidden = true; lines.innerHTML = ''; dim();
      if (opts.onSelect) opts.onSelect(null);
    }
    function showCard() {
      const s = OS.state, sel = st.sel, o = sel.org && ORG_BY[sel.org], sysName = SYS_BY[sel.sys].name;
      const ms = o ? o.markers.map((id) => s.markers.find((m) => m.id === id)).filter(Boolean) : [];
      const rows = ms.map((m) => { const e = OS.markerEval(m); return `<li><span>${esc(m.name)}</span><b class="num">${esc(String(m.value))}<small> ${esc(m.unit)}</small></b>${pill(e.status, e.label)}</li>`; }).join('');
      const vt = s.vitals || {};
      const vit = o && o.vitals ? `<li><span>Resting heart rate</span><b class="num">${vt.rhr}<small> bpm</small></b>${pill(vt.rhr <= vt.rhrBase ? 'good' : 'warn', vt.rhr <= vt.rhrBase ? 'At or below base' : 'Above base')}</li><li><span>HRV</span><b class="num">${vt.hrv}<small> ms</small></b>${pill(vt.hrv >= vt.hrvBase ? 'good' : 'warn', vt.hrv >= vt.hrvBase ? 'Above base' : 'Below base')}</li>` : '';
      const L = o && o.lungs && OS.longevity ? OS.longevity.summary(s, OS.scores(s)) : null;
      const lung = L && L.vo2 ? `<li><span>VO2max</span><b class="num">${Math.round(L.vo2)}<small> ml/kg/min</small></b>${pill('muted', 'Fitness age ' + Math.round(L.fitnessAge || 0))}</li>` : '';
      const head = o && (ms.length || o.vitals || o.lungs) ? esc(o.name) : esc(title(sel.part));
      card.innerHTML = `<div class="a3d-card-h"><div><span class="a3d-eyebrow">${esc(sysName)}</span><h3>${head}</h3>${!sel.whole && head !== esc(title(sel.part)) ? `<p class="a3d-part">Selected: ${esc(title(sel.part))}</p>` : ''}</div><button type="button" class="a3d-x" data-a3d-close aria-label="Close">×</button></div>
        ${o ? `<p class="a3d-about">${esc(o.about)}</p>` : ''}
        ${rows || vit || lung ? `<ul class="a3d-rows">${vit}${lung}${rows}</ul>` : '<p class="a3d-about">No lab markers are linked to this structure yet.</p>'}
        <div class="a3d-acts">${ms.length ? '<button type="button" class="btn sm" data-a3d-go="biology">Open in Biology</button>' : ''}<button type="button" class="btn ghost sm" data-a3d-ask>Ask Myo about it</button></div>`;
      card.hidden = false;
      if (opts.onSelect) opts.onSelect(sel);
    }
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-a3d-close]')) clear();
      const go = e.target.closest('[data-a3d-go]'); if (go) OS.go(go.dataset.a3dGo);
      if (e.target.closest('[data-a3d-ask]') && st.sel) { const o = st.sel.org && ORG_BY[st.sel.org], what = o ? o.name.toLowerCase() : st.sel.part; OS.go('coach'); setTimeout(() => { if (OS.coachSend) OS.coachSend(`What do my results say about my ${what}, and what should I do this week?`); }, 80); }
    });
    box.querySelector('.a3d-bar').addEventListener('click', (e) => {
      const p = e.target.closest('[data-p]'); if (p) { setSystems(PRESETS[p.dataset.p]); return; }
      const l = e.target.closest('[data-look]'); if (l && l.dataset.look !== st.look) { st.look = l.dataset.look; try { localStorage.setItem('myo-a3d-look', st.look); } catch {} syncBar(); if (T) applyLook(); return; }
      const v = e.target.closest('[data-view]'); if (v) { clear(); goView(VIEWS.reset); st.auto = !calm(); }
    });

    /* hotspots: organs that carry data, coloured by their worst marker */
    function spotStatus(k) {
      const o = ORG_BY[k], s = OS.state;
      const es = o.markers.map((id) => s.markers.find((m) => m.id === id)).filter(Boolean).map((m) => OS.markerEval(m).status);
      return es.includes('bad') ? 'bad' : es.includes('warn') ? 'warn' : es.length ? 'good' : 'muted';
    }
    function placeSpots() {
      spots.innerHTML = HOTSPOTS.filter((k) => st.systems.includes(ORG_BY[k].sys) && C.geo[ORG_BY[k].sys] && C.geo[ORG_BY[k].sys].cent[k])
        .map((k) => `<button type="button" class="a3d-spot st-${spotStatus(k)}" data-spot="${k}" aria-label="${esc(ORG_BY[k].name)}"><i></i><span>${esc(ORG_BY[k].name)}</span></button>`).join('');
    }
    spots.addEventListener('click', (e) => { const b = e.target.closest('[data-spot]'); if (b) selectOrgan(b.dataset.spot); });

    function frame(now) {
      if (!st.alive) return;
      st.raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      if (!full && now - st.last < 33) return;
      const dt = Math.min(0.05, (now - st.last) / 1000 || 0.016); st.last = now;
      const w = box.clientWidth, h = box.clientHeight; if (!w || !h) return;
      const dpr = Math.min(1.75, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
      if (st.auto && !calm() && !st.sel) st.yaw += dt * 0.18;
      if (st.goal) { const g = st.goal, k = 1 - Math.pow(0.002, dt); st.yaw += (g.yaw - st.yaw) * k; st.pitch += (g.pitch - st.pitch) * k; st.dist += (g.dist - st.dist) * k; for (let i = 0; i < 3; i++) st.tgt[i] += (g.tgt[i] - st.tgt[i]) * k; if (Math.abs(g.dist - st.dist) < 0.002 && Math.abs(g.yaw - st.yaw) < 0.002) st.goal = null; }
      placeCam();
      const t = (now - clock0) / 1000;
      Object.values(meshes).forEach((m) => { if (m.material.uniforms) m.material.uniforms.uTime.value = calm() ? 0 : t; });
      if (glow && glow.material.uniforms) { glow.material.uniforms.uTime.value = calm() ? 0 : t; glow.material.uniforms.uHi.value = calm() ? 0.85 : 0.7 + 0.2 * Math.sin(t * 2.4); }
      // pop-out: lift the selection out of the body toward the viewer, then hold it there
      if (hi) {
        hi.t = Math.min(1, hi.t + dt * 2.2); const e = 1 - Math.pow(1 - hi.t, 3);
        const toCam = new T.Vector3().subVectors(cam.position, new T.Vector3(hi.c[0] + group.position.x, hi.c[1], hi.c[2] + group.position.z)).normalize();
        const out = 0.06 + Math.min(0.22, hi.size * 0.6);
        hi.pivot.position.set(hi.c[0] + toCam.x * out * e, hi.c[1] + toCam.y * out * e, hi.c[2] + toCam.z * out * e);
        const sc = 1 + (hi.scale - 1) * e; hi.pivot.scale.setScalar(sc);
        if (!calm()) hi.pivot.rotation.y = Math.sin(t * 0.8) * 0.12 * e;
        if (hi.mesh.material.uniforms) hi.mesh.material.uniforms.uTime.value = calm() ? 0 : t;
      }
      renderer.render(scene, cam);
      // project hotspots and the leader line
      const proj = (x, y, z) => { const v = new T.Vector3(x + group.position.x, y + group.position.y, z + group.position.z).project(cam); return [(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h, v.z]; };
      spots.querySelectorAll('[data-spot]').forEach((b) => { const k = b.dataset.spot, c = C.geo[ORG_BY[k].sys].cent[k]; const [x, y, z] = proj(c[0], c[1], c[2]); b.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`; b.hidden = z > 1 || !!st.sel; });
      if (hi && !card.hidden) {
        const p = hi.pivot.position, [x, y] = proj(p.x, p.y, p.z), cr = card.getBoundingClientRect(), br = box.getBoundingClientRect();
        const ax = cr.left - br.left, ay = cr.top - br.top + 28;
        lines.setAttribute('viewBox', `0 0 ${w} ${h}`);
        lines.innerHTML = cr.width && window.innerWidth > 640 ? `<polyline points="${x.toFixed(1)},${y.toFixed(1)} ${(ax - 24).toFixed(1)},${ay.toFixed(1)} ${ax.toFixed(1)},${ay.toFixed(1)}"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4"/>` : '';
      }
    }

    (async () => {
      try {
        T = await three(); if (!st.alive) return;
        renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = T.SRGBColorSpace;
        scene = new T.Scene(); cam = new T.PerspectiveCamera(28, 1, 0.05, 30);
        scene.add(new T.HemisphereLight(0xdfe8ff, 0x1a2030, 1.1));
        const key = new T.DirectionalLight(0xffffff, 2.2); key.position.set(-1.5, 2.5, 3); scene.add(key);
        const rim = new T.DirectionalLight(0x6aa8ff, 1.6); rim.position.set(2, 1.5, -3); scene.add(rim);
        const fill = new T.DirectionalLight(0xffe6d6, 0.5); fill.position.set(2, 0.5, 2); scene.add(fill);
        const M = await meta(); if (!st.alive) return;
        group = new T.Group(); group.position.set(-(M.box.lo[0] + M.box.span[0] / 2), 0, -(M.box.lo[2] + M.box.span[2] / 2)); scene.add(group);
        // holographic platform under the feet
        ring = new T.Group();
        [0.32, 0.42, 0.5].forEach((r, i) => { const g = new T.RingGeometry(r, r + (i === 1 ? 0.004 : 0.002), 96); const m = new T.MeshBasicMaterial({ color: 0x5fb4ff, transparent: true, opacity: i === 1 ? 0.55 : 0.3, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }); const me = new T.Mesh(g, m); me.rotation.x = -Math.PI / 2; ring.add(me); });
        ring.position.set(0, -0.085, 0); scene.add(ring); ring.visible = st.look === 'holo';
        try { const L = localStorage.getItem('myo-a3d-look'); if (L && !opts.look) { st.look = L; syncBar(); } } catch {}
        st.raf = requestAnimationFrame(frame);
        await setSystems(st.systems);
        applyLook();
        if (opts.focus) selectOrgan(opts.focus);
      } catch (e) { loadT.textContent = "The 3D body couldn't load here: " + (e && e.message ? e.message : 'WebGL is unavailable'); box.classList.add('a3d-fail'); }
    })();
    if (window.ResizeObserver) { ro = new ResizeObserver(() => { st.last = 0; }); ro.observe(box); }
    return {
      select: selectOrgan, setSystems, clear,
      destroy() { st.alive = false; cancelAnimationFrame(st.raf); if (ro) ro.disconnect(); try { if (renderer) { renderer.dispose(); renderer.forceContextLoss(); } } catch {} Object.values(meshes).forEach((m) => m.material && m.material.dispose()); }
    };
  }

  const live = new Set();
  function mountAll(root, extra = {}) {
    const vs = [...root.querySelectorAll('[data-a3d]')].map((el) => { const v = viewer(el, { mode: el.dataset.a3d, systems: el.dataset.systems ? el.dataset.systems.split(',') : undefined, hi: el.dataset.hi ? el.dataset.hi.split(',') : null, view: el.dataset.view, ...extra }); live.add(v); return v; });
    return () => vs.forEach((v) => { v.destroy(); live.delete(v); });
  }

  /* ═══ BODY: the full explorer ═══ */
  let bodyV = null;
  function systemRows(s, sc) {
    const byOrg = ORG.filter((o) => o.markers.length || o.vitals || o.lungs).map((o) => {
      const ms = o.markers.map((id) => s.markers.find((m) => m.id === id)).filter(Boolean).map((m) => ({ m, e: OS.markerEval(m) }));
      const st = ms.some((x) => x.e.status === 'bad') ? 'bad' : ms.some((x) => x.e.status === 'warn') ? 'warn' : ms.length ? 'good' : 'muted';
      const sum = ms.length ? `${ms.filter((x) => x.e.status === 'good').length} of ${ms.length} optimal` : o.vitals ? 'Heart rate and HRV' : 'VO2max';
      return `<li><button type="button" class="org-row" data-act="a3d-organ" data-k="${o.k}"><span class="org-dot st-${st}"></span><span class="org-n"><b>${esc(o.name)}</b><small>${esc(SYS_BY[o.sys].name)}</small></span><span class="org-s">${esc(sum)}</span></button></li>`;
    });
    return byOrg.join('');
  }
  OS.act('a3d-organ', (el) => { if (bodyV) bodyV.select(el.dataset.k); });
  OS.register('body', {
    title: 'Body', icon: 'body',
    render(s, sc) {
      return `${OS.ui.head('Human body · 3D', 'Your body, system by system', 'Real anatomy from BodyParts3D. Rotate it, switch systems, and tap any organ to pull it out with your results.')}
      <div class="body-grid">
        <section class="a3d-stage a3d-full" data-a3d="full" data-systems="${PRESETS.organs.join(',')}" aria-label="3D body explorer"></section>
        <aside class="body-side">
          <section class="card"><div class="card-h"><h2>Organs with your data</h2><span class="muted small">${s.markers.length} biomarkers</span></div>
            <ul class="org-list">${systemRows(s, sc)}</ul></section>
          <section class="card"><div class="card-h"><h2>How to use it</h2></div>
            <ul class="body-how"><li><b>Rotate</b> by dragging; <b>zoom</b> with the wheel or a pinch.</li><li><b>Tap</b> a structure, or an organ on the left, to pop it out with your markers.</li><li><b>Hologram</b> shows depth through every layer; <b>Clinical</b> shows true colours.</li></ul>
            <p class="fine">Anatomy: BodyParts3D, © The Database Center for Life Science, CC BY-SA 2.1 JP. Shapes are a reference body, not a scan of you; your own scans live in Imaging.</p></section>
        </aside>
      </div>`;
    },
    mount(root) {
      const el = root.querySelector('[data-a3d]');
      bodyV = viewer(el, { mode: 'full', systems: PRESETS.organs });
      return () => { if (bodyV) bodyV.destroy(); bodyV = null; };
    }
  });

  OS.Anatomy = { mountAll, viewer, PRESETS, SYSTEMS: SYS, ORGANS: ORG };
})();
