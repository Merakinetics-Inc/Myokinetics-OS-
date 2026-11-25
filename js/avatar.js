/* ═══ MYO — AVATAR: Myo, the app's AI brain, drawn as a living cell ═══
   A procedural cell on canvas (original art): membrane bilayer with surface proteins, mitochondria, vesicles,
   endoplasmic reticulum, and a nucleus whose neural network and glowing nucleolus are Myo's mind.
   States: idle · listening (dictation) · thinking (waiting on the model) · speaking (streaming or TTS).
   Voice: dictation (speak to Myo) and tts (Myo speaks) light up when the viewer grants them. */
(function () {
  'use strict';
  const A = OS.Avatar = { state: 'idle', subs: new Set(), voice: false };
  try { A.voice = localStorage.getItem('myo-voice') === '1'; } catch {}
  A.set = (st) => { if (A.state === st) return; A.state = st; A.subs.forEach((f) => { try { f(st); } catch {} }); };
  A.on = (f) => { A.subs.add(f); return () => A.subs.delete(f); };
  const LABEL = { idle: 'Online', listening: 'Listening', thinking: 'Thinking', speaking: 'Speaking' };
  A.label = (st) => LABEL[st || A.state];
  // a burst of neural pulses in every mounted cell (the hub fires one when a connection lights up)
  A.bursts = 0;
  A.burst = () => { A.bursts++; A.subs.forEach((f) => { try { f(A.state); } catch {} }); };

  /* ── cell geometry (unit radius, seeded so it never changes between frames) ── */
  function cellGeo(small) {
    let seed = small ? 7 : 19; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const mito = Array.from({ length: small ? 3 : 7 }, () => ({ a: r() * 6.283, d: 0.6 + r() * 0.17, len: 0.15 + r() * 0.08, rot: r() * 6.283, sp: (r() - 0.5) * 0.12 }));
    const ves = Array.from({ length: small ? 0 : 16 }, () => ({ a: r() * 6.283, d: 0.5 + r() * 0.36, s: 0.018 + r() * 0.03, sp: (r() - 0.5) * 0.2 }));
    const nodes = []; while (nodes.length < (small ? 6 : 26)) { const x = r() * 2 - 1, y = r() * 2 - 1; if (x * x + y * y < 0.78) nodes.push([x * 0.3, y * 0.3]); }
    const edges = []; nodes.forEach((a, i) => nodes.map((b, j) => [j, (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2]).filter(([j]) => j !== i).sort((p, q) => p[1] - q[1]).slice(0, 2).forEach(([j]) => { if (!edges.some(([p, q]) => p === j && q === i)) edges.push([i, j]); }));
    return { mito, ves, nodes, edges, pores: small ? 8 : 22 };
  }
  const GEO = { lg: cellGeo(false), sm: cellGeo(true) };
  const COL = { idle: [86, 196, 255], listening: [64, 236, 200], thinking: [168, 132, 255], speaking: [120, 214, 255] };

  /* ── renderer: a living cell whose nucleus holds Myo's neural network ── */
  A.mount = function (cv, opts = {}) {
    if (!cv) return () => {};
    const small = !!opts.small, G = small ? GEO.sm : GEO.lg;
    const ctx = cv.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0, alive = true, last = 0, level = 0, col = COL[A.state].slice(), seen = A.bursts;
    const pulses = [];
    const size = () => { const w = cv.clientWidth || (small ? 34 : 280), h = cv.clientHeight || w; if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); } return [w, h]; };
    function frame(now) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      if (now - last < (small ? 66 : 30)) return;
      const dt = Math.min(0.1, (now - last) / 1000 || 0.016); last = now;
      const [W, H] = size(), t = reduce ? 2 : now / 1000, st = A.state, tc = COL[st];
      for (let i = 0; i < 3; i++) col[i] += (tc[i] - col[i]) * 0.08;
      const target = st === 'speaking' ? 0.45 + 0.55 * Math.abs(Math.sin(t * 11) * Math.sin(t * 4.3 + 1)) : 0;
      level += (target - level) * 0.35;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H * (small ? 0.5 : 0.47), R = Math.min(W, H) * (small ? 0.4 : 0.32);
      const rgb = (a) => `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${a})`;
      const memR = (th) => 1 + 0.035 * Math.sin(3 * th + t * 0.9) + 0.022 * Math.sin(5 * th - t * 1.3 + 1) + level * 0.05 * Math.sin(9 * th + t * 14) + (st === 'listening' ? 0.02 * Math.sin(6 * th - t * 5) : 0);
      const memb = (rr) => { ctx.beginPath(); const N = small ? 40 : 96; for (let i = 0; i <= N; i++) { const th = (i / N) * Math.PI * 2, m = memR(th); const x = cx + Math.cos(th) * rr * m, y = cy + Math.sin(th) * rr * m; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.closePath(); };
      // halo and listening ripples
      const hg = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.75); hg.addColorStop(0, rgb(st === 'thinking' ? 0.26 : 0.16)); hg.addColorStop(1, rgb(0)); ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);
      if (st === 'listening' && !reduce) for (let i = 0; i < 3; i++) { const ph = (t * 0.8 + i / 3) % 1; ctx.strokeStyle = rgb(0.45 * (1 - ph)); ctx.lineWidth = small ? 1 : 1.6; ctx.beginPath(); ctx.arc(cx, cy, R * (1.05 + ph * 0.6), 0, Math.PI * 2); ctx.stroke(); }
      // cytoplasm: glassy sphere lit from the upper left
      memb(R);
      const fg = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.05, cx, cy, R * 1.05);
      fg.addColorStop(0, 'rgba(255,255,255,.26)'); fg.addColorStop(0.35, rgb(0.13)); fg.addColorStop(0.85, rgb(0.24)); fg.addColorStop(1, rgb(0.42));
      ctx.fillStyle = fg; ctx.fill();
      ctx.save(); memb(R * 0.985); ctx.clip();
      // endoplasmic reticulum: folded ribbons around the nucleus
      if (!small) { ctx.lineWidth = 1; for (let k = 0; k < 3; k++) { ctx.strokeStyle = rgb(0.2 - k * 0.04); ctx.beginPath(); for (let i = 0; i <= 70; i++) { const th = -0.6 + k * 0.5 + (i / 70) * 3.6, rr = R * (0.47 + k * 0.06 + 0.02 * Math.sin(th * 9 + t * 0.6 + k)); const x = cx + Math.cos(th) * rr, y = cy + Math.sin(th) * rr; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke(); } }
      // vesicles
      G.ves.forEach((v) => { const a = v.a + t * v.sp, x = cx + Math.cos(a) * v.d * R, y = cy + Math.sin(a) * v.d * R; ctx.beginPath(); ctx.arc(x, y, v.s * R, 0, Math.PI * 2); ctx.fillStyle = rgb(0.22); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 0.7; ctx.stroke(); });
      // mitochondria: the cell's power plants, with folded cristae
      G.mito.forEach((m) => {
        const a = m.a + t * m.sp, x = cx + Math.cos(a) * m.d * R, y = cy + Math.sin(a) * m.d * R, L = m.len * R, Wd = R * (small ? 0.12 : 0.075);
        ctx.save(); ctx.translate(x, y); ctx.rotate(m.rot + t * m.sp * 2);
        ctx.beginPath(); ctx.moveTo(-L / 2 + Wd / 2, -Wd / 2); ctx.lineTo(L / 2 - Wd / 2, -Wd / 2); ctx.arc(L / 2 - Wd / 2, 0, Wd / 2, -Math.PI / 2, Math.PI / 2); ctx.lineTo(-L / 2 + Wd / 2, Wd / 2); ctx.arc(-L / 2 + Wd / 2, 0, Wd / 2, Math.PI / 2, -Math.PI / 2); ctx.closePath();
        ctx.fillStyle = 'rgba(255,128,160,.38)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,190,210,.75)'; ctx.lineWidth = small ? 0.6 : 1; ctx.stroke();
        if (!small) { ctx.beginPath(); for (let i = 0; i <= 8; i++) { const xx = -L / 2 + Wd / 2 + (i / 8) * (L - Wd); ctx.lineTo(xx, (i % 2 ? 1 : -1) * Wd * 0.3); } ctx.strokeStyle = 'rgba(255,210,225,.6)'; ctx.lineWidth = 0.7; ctx.stroke(); }
        ctx.restore();
      });
      // nucleus: double membrane with pores, holding the neural network (Myo's mind)
      const nx = cx + R * 0.03, ny = cy - R * 0.02, NR = R * 0.37;
      const ng = ctx.createRadialGradient(nx - NR * 0.3, ny - NR * 0.3, NR * 0.1, nx, ny, NR); ng.addColorStop(0, rgb(0.34)); ng.addColorStop(1, rgb(0.18));
      ctx.beginPath(); ctx.arc(nx, ny, NR, 0, Math.PI * 2); ctx.fillStyle = ng; ctx.fill();
      ctx.lineWidth = small ? 0.8 : 1.3; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.stroke();
      ctx.beginPath(); ctx.arc(nx, ny, NR * 0.93, 0, Math.PI * 2); ctx.strokeStyle = rgb(0.55); ctx.lineWidth = 0.7; ctx.stroke();
      for (let i = 0; i < G.pores; i++) { const a = (i / G.pores) * Math.PI * 2 + t * 0.05; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(nx + Math.cos(a) * NR * 0.965, ny + Math.sin(a) * NR * 0.965, small ? 0.6 : 1.2, 0, Math.PI * 2); ctx.fill(); }
      const rot = t * (st === 'thinking' ? 0.5 : 0.12), cr = Math.cos(rot), sr = Math.sin(rot);
      const pts = G.nodes.map(([x, y]) => [nx + (x * cr - y * sr) * R * 1.05, ny + (x * sr + y * cr) * R * 1.05]);
      if (!small) { ctx.lineWidth = 0.8; G.edges.forEach(([i, j]) => { ctx.strokeStyle = rgb(0.4); ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[j][0], pts[j][1]); ctx.stroke(); }); }
      const rate = { idle: 2, listening: 6, thinking: 30, speaking: 12 }[st] * (small ? 0.4 : 1);
      if (!reduce && G.edges.length) { let n = rate * dt; while (n > 0) { if (Math.random() < n) pulses.push({ e: (Math.random() * G.edges.length) | 0, u: 0, v: 0.8 + Math.random() * 1.6 }); n -= 1; } }
      if (!reduce && seen !== A.bursts && G.edges.length) { seen = A.bursts; for (let i = 0; i < (small ? 3 : 9); i++) pulses.push({ e: (Math.random() * G.edges.length) | 0, u: Math.random() * 0.3, v: 1.4 + Math.random() * 1.4 }); }
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i]; p.u += p.v * dt * (st === 'thinking' ? 1.8 : 1); if (p.u >= 1) { pulses.splice(i, 1); continue; }
        const [a, b] = G.edges[p.e], x = pts[a][0] + (pts[b][0] - pts[a][0]) * p.u, y = pts[a][1] + (pts[b][1] - pts[a][1]) * p.u, r = small ? 1.4 : 3;
        const gg = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4); gg.addColorStop(0, 'rgba(255,255,255,.95)'); gg.addColorStop(0.4, rgb(0.6)); gg.addColorStop(1, rgb(0)); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, Math.PI * 2); ctx.fill();
      }
      pts.forEach(([x, y]) => { ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(x, y, small ? 0.7 : 1.5, 0, Math.PI * 2); ctx.fill(); });
      // nucleolus: the glowing core that pulses with thought and speech
      const pulse = 1 + (st === 'thinking' ? 0.18 * Math.sin(t * 7) : 0.06 * Math.sin(t * 2)) + level * 0.25, cR = NR * 0.3 * pulse;
      const cg = ctx.createRadialGradient(nx, ny, 0, nx, ny, cR * 1.8); cg.addColorStop(0, 'rgba(255,255,255,.95)'); cg.addColorStop(0.35, rgb(0.8)); cg.addColorStop(1, rgb(0));
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(nx, ny, cR * 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // membrane: lipid bilayer and surface proteins
      memb(R); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = small ? 1 : 1.6; ctx.stroke();
      memb(R * 0.955); ctx.strokeStyle = rgb(0.6); ctx.lineWidth = small ? 0.6 : 0.9; ctx.stroke();
      if (!small) for (let i = 0; i < 36; i++) { const th = (i / 36) * Math.PI * 2 + t * 0.03, m = memR(th); ctx.fillStyle = i % 3 ? rgb(0.8) : 'rgba(255,170,200,.85)'; ctx.beginPath(); ctx.arc(cx + Math.cos(th) * R * m, cy + Math.sin(th) * R * m, i % 3 ? 1.6 : 2.4, 0, Math.PI * 2); ctx.fill(); }
      // specular highlight
      ctx.beginPath(); ctx.ellipse(cx - R * 0.42, cy - R * 0.5, R * 0.22, R * 0.1, -0.6, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fill();
      if (!small && st === 'speaking') { ctx.beginPath(); for (let i = 0; i <= 64; i++) { const u = i / 64, x = cx - R + u * 2 * R, y = cy + R * 1.32 + Math.sin(u * 22 + t * 18) * level * R * 0.1 * Math.sin(u * Math.PI); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      if (reduce) { cancelAnimationFrame(raf); raf = 0; }
    }
    raf = requestAnimationFrame(frame);
    const unsub = A.on(() => { if (!raf && alive) raf = requestAnimationFrame(frame); });
    return () => { alive = false; cancelAnimationFrame(raf); unsub(); };
  };

  /* ── voice: tts (Myo speaks) and dictation (speak to Myo) ────────── */
  const plain = (t) => String(t || '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/^\s*[-•]\s+/gm, '').replace(/✓/g, '').replace(/\n{2,}/g, '\n').trim();
  A.speak = async (text) => {
    const tts = OS.caps && OS.caps.tts; if (!tts || !A.voice) return;
    let s = plain(text); if (s.length > 1900) { const cut = s.lastIndexOf('.', 1900); s = s.slice(0, cut > 400 ? cut + 1 : 1900); }
    try { A.set('speaking'); await tts.speak(s); }
    catch (e) { if (e && e.code === 'not_granted') { OS.caps.tts = null; A.voice = false; OS.toast('Voice is off for this page.'); } }
    finally { if (A.state === 'speaking') A.set('idle'); }
  };
  A.stopSpeaking = () => { const tts = OS.caps && OS.caps.tts; if (tts) try { tts.stop(); } catch {} };
  A.toggleVoice = () => { A.voice = !A.voice; try { localStorage.setItem('myo-voice', A.voice ? '1' : '0'); } catch {} if (!A.voice) A.stopSpeaking(); };

  let dict = null, dBase = '', listening = false;
  A.wireDictation = (d) => {
    dict = d;
    d.onPartial(({ text }) => { const ta = document.getElementById('chat-in'); if (ta) ta.value = (dBase + ' ' + text).trim(); });
    d.onFinal(({ text }) => { dBase = (dBase + ' ' + text).trim(); const ta = document.getElementById('chat-in'); if (ta) ta.value = dBase; });
    d.onState(({ state }) => {
      listening = state === 'listening';
      if (listening) A.set('listening'); else if (A.state === 'listening') A.set('idle');
      document.querySelectorAll('[data-act="myo-mic"]').forEach((b) => { b.classList.toggle('on', listening); b.setAttribute('aria-pressed', listening); b.lastChild.textContent = listening ? ' Stop and send' : ' Talk to Myo'; });
    });
  };
  // must start straight from the click: nothing awaited before d.start()
  OS.act('myo-mic', () => {
    if (!dict) return;
    if (!listening) {
      A.stopSpeaking(); const ta = document.getElementById('chat-in'); dBase = ta ? ta.value.trim() : '';
      dict.start().catch((e) => { if (e && e.code === 'not_granted') { OS.caps.dictation = null; OS.toast('Microphone access was declined. You can still type.'); OS.render(); } });
    } else {
      dict.stop().then(() => { const ta = document.getElementById('chat-in'); const v = ta ? ta.value.trim() : dBase; if (ta) ta.value = ''; dBase = ''; if (v && OS.coachSend) OS.coachSend(v); }).catch(() => {});
    }
  });
  OS.act('myo-voice', (el) => { A.toggleVoice(); el.setAttribute('aria-pressed', A.voice); el.classList.toggle('on', A.voice); el.lastChild.textContent = A.voice ? ' Voice on' : ' Voice off'; });
})();
