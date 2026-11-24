/* ═══ MYOKINETICS OS v4 — ANATOMY: original holographic body art drawn as SVG ═══
   bodyMap()  → front-facing x-ray body with clickable biomarker-system markers
   muscleMap() → same body with muscle groups lit by training load */
(function () {
  'use strict';
  const { esc } = OS;
  let n = 0;

  // skeleton of the figure, viewBox 0 0 200 440, figure faces the viewer (its right = screen left)
  const J = {
    head: [100, 40], neckTop: [100, 60], neckBot: [100, 76],
    shR: [70, 88], shL: [130, 88], elR: [57, 152], elL: [143, 152], wrR: [50, 210], wrL: [150, 210], haR: [47, 230], haL: [153, 230],
    hipR: [86, 214], hipL: [114, 214], knR: [83, 312], knL: [117, 312], anR: [82, 402], anL: [118, 402], ftR: [75, 420], ftL: [125, 420]
  };
  const P = (a) => a.join(' ');
  const line = (a, b, w, extra = '') => `<path d="M${P(a)} L${P(b)}" stroke-width="${w}" ${extra}/>`;
  const TORSO = `M70 82 C84 77 116 77 130 82 C137 96 134 122 128 142 C123 162 118 178 117 192 C121 202 123 210 121 220 L79 220 C77 210 79 202 83 192 C82 178 77 162 72 142 C66 122 63 96 70 82 Z`;

  function figure(id, opts = {}) {
    const limbs = [
      [J.shR, J.elR, 17], [J.elR, J.wrR, 13], [J.wrR, J.haR, 11], [J.shL, J.elL, 17], [J.elL, J.wrL, 13], [J.wrL, J.haL, 11],
      [J.hipR, J.knR, 27], [J.knR, J.anR, 18], [J.anR, J.ftR, 10], [J.hipL, J.knL, 27], [J.knL, J.anL, 18], [J.anL, J.ftL, 10], [J.neckTop, J.neckBot, 15]
    ];
    const body = `<path d="${TORSO}"/>${limbs.map(([a, b, w]) => line(a, b, w)).join('')}<ellipse cx="100" cy="38" rx="17" ry="21"/>`;
    const glowBody = `<path d="${TORSO}" stroke-width="10"/>${limbs.map(([a, b, w]) => line(a, b, w + 10)).join('')}<ellipse cx="100" cy="38" rx="19" ry="23" stroke-width="10"/>`;
    // x-ray structure: skull, spine, ribs, pelvis, long bones, vessel lines
    const ribs = Array.from({ length: 6 }, (_, i) => { const y = 96 + i * 11, w = 24 - Math.abs(i - 2) * 1.5; return `<path d="M100 ${y} C${100 - w} ${y - 4} ${100 - w - 4} ${y + 6} ${100 - w + 2} ${y + 9}"/><path d="M100 ${y} C${100 + w} ${y - 4} ${100 + w + 4} ${y + 6} ${100 + w - 2} ${y + 9}"/>`; }).join('');
    const bones = [[J.shR, J.elR], [J.elR, J.wrR], [J.shL, J.elL], [J.elL, J.wrL], [J.hipR, J.knR], [J.knR, J.anR], [J.hipL, J.knL], [J.knL, J.anL]].map(([a, b]) => line(a, b, 1.6)).join('');
    const xray = `<g class="an-bone" fill="none">
        <ellipse cx="100" cy="36" rx="11" ry="14"/><path d="M92 46 Q100 54 108 46"/>
        <path d="M100 62 L100 206" stroke-dasharray="2.2 1.6" stroke-width="2"/>${ribs}
        <path d="M76 88 L124 88"/><path d="M84 200 C90 216 110 216 116 200"/><path d="M80 204 C82 194 92 192 100 198 C108 192 118 194 120 204"/>${bones}
        ${[J.elR, J.elL, J.knR, J.knL, J.shR, J.shL].map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="2.6"/>`).join('')}
      </g>
      <g class="an-vessel" fill="none">
        <path d="M104 96 C112 104 112 118 106 128 C98 140 96 170 98 200 C96 240 92 280 86 312"/>
        <path d="M98 200 C102 240 108 280 114 312"/><path d="M100 82 C88 84 76 100 66 120 C60 140 56 180 52 210"/><path d="M100 82 C112 84 124 100 134 120 C140 140 144 180 148 210"/>
        <path d="M100 76 L100 58 M96 70 C92 60 92 50 94 42 M104 70 C108 60 108 50 106 42"/>
      </g>`;
    return `<defs>
        <linearGradient id="${id}-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--holo-1)"/><stop offset=".55" stop-color="var(--holo-2)"/><stop offset="1" stop-color="var(--holo-1)"/></linearGradient>
        <radialGradient id="${id}-r" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="var(--holo-2)" stop-opacity=".45"/><stop offset="1" stop-color="var(--holo-2)" stop-opacity="0"/></radialGradient>
        <filter id="${id}-b" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7"/></filter>
        <pattern id="${id}-p" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="var(--holo-2)" opacity=".35"/></pattern>
      </defs>
      <rect x="-40" y="-20" width="280" height="480" fill="url(#${id}-p)" opacity="${opts.dots === false ? 0 : 0.5}"/>
      <ellipse cx="100" cy="190" rx="110" ry="220" fill="url(#${id}-r)"/>
      <g class="an-glow" fill="var(--holo-2)" stroke="var(--holo-2)" stroke-linecap="round" stroke-linejoin="round" filter="url(#${id}-b)" opacity=".55">${glowBody}</g>
      <g class="an-body" fill="url(#${id}-g)" stroke="url(#${id}-g)" stroke-linecap="round" stroke-linejoin="round" opacity=".9">${body}</g>
      <g class="an-skin" fill="none" stroke="var(--holo-3)" stroke-width=".8" opacity=".55"><path d="${TORSO}"/><ellipse cx="100" cy="38" rx="17" ry="21"/></g>
      ${xray}
      <ellipse cx="100" cy="428" rx="46" ry="6" fill="var(--holo-2)" opacity=".25"/>`;
  }

  // where each biomarker system lives on the body
  const SYS_POS = {
    'Thyroid': [100, 70], 'Cardiometabolic': [111, 106], 'Liver & kidney': [87, 130], 'Metabolic': [104, 146], 'Nutrients': [96, 166],
    'Hormonal': [100, 190], 'Blood': [58, 158], 'Muscle': [115, 262], 'Inflammation': [83, 312]
  };

  // systems: [{ sy, score, status }] · selected: name · act: data-act for clicks
  function bodyMap(systems, selected, act = 'sys') {
    const id = 'bm' + (++n);
    const marks = systems.filter((s) => SYS_POS[s.sy]).map((s) => {
      const [x, y] = SYS_POS[s.sy], on = s.sy === selected;
      return `<g class="an-mark st-${s.status} ${on ? 'on' : ''}" data-act="${act}" data-sys="${esc(s.sy)}" tabindex="0" role="button" aria-label="${esc(s.sy)}, score ${Math.round(s.score)}">
        <circle class="an-pulse" cx="${x}" cy="${y}" r="9"/><circle class="an-dot" cx="${x}" cy="${y}" r="${on ? 8 : 6.2}"/>
        <text x="${x}" y="${y + 2.6}" text-anchor="middle">${s.status === 'good' ? 'A' : s.status === 'warn' ? 'B' : 'C'}</text>
        ${on ? `<path d="M${x + 9} ${y} L${x < 100 ? x - 36 : x + 30} ${y - 18}" class="an-lead"/><text class="an-label" x="${x < 100 ? x - 38 : x + 32}" y="${y - 21}" text-anchor="${x < 100 ? 'end' : 'start'}">${esc(s.sy)} ${Math.round(s.score)}</text>` : ''}
        <title>${esc(s.sy)} · ${Math.round(s.score)}</title></g>`;
    }).join('');
    return `<svg class="anatomy" viewBox="-30 -8 260 448" role="img" aria-label="Body map of biomarker systems">${figure(id)}${marks}</svg>`;
  }

  // muscle groups (front view) as soft ellipses over the figure
  const MUSCLES = {
    delts: [[70, 92, 10, 13], [130, 92, 10, 13]], chest: [[88, 106, 14, 11], [112, 106, 14, 11]], biceps: [[62, 122, 7, 17], [138, 122, 7, 17]],
    triceps: [[58, 128, 6, 18], [142, 128, 6, 18]], forearms: [[54, 182, 6, 20], [146, 182, 6, 20]], core: [[100, 158, 13, 30]], obliques: [[82, 160, 6, 20], [118, 160, 6, 20]],
    quads: [[86, 262, 12, 38], [114, 262, 12, 38]], adductors: [[95, 250, 4, 24], [105, 250, 4, 24]], calves: [[82, 352, 8, 24], [118, 352, 8, 24]]
  };
  const MUSCLE_NAMES = { delts: 'Deltoids', chest: 'Chest', biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms', core: 'Core', obliques: 'Obliques', quads: 'Quads', adductors: 'Adductors', calves: 'Calves' };
  function muscleMap(load) {
    const id = 'mm' + (++n);
    const regions = Object.entries(MUSCLES).map(([m, els]) => {
      const v = Math.max(0, Math.min(1, load[m] || 0));
      if (v < 0.05) return '';
      return els.map(([cx, cy, rx, ry]) => `<ellipse class="an-musc" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" style="opacity:${(0.25 + v * 0.75).toFixed(2)}"><title>${MUSCLE_NAMES[m]} ${Math.round(v * 100)}%</title></ellipse>`).join('');
    }).join('');
    return `<svg class="anatomy" viewBox="-30 -8 260 448" role="img" aria-label="Muscle activation map">${figure(id, { dots: false })}<g filter="url(#${id}-b)" opacity=".7">${regions}</g><g>${regions}</g></svg>`;
  }

  OS.anatomy = { bodyMap, muscleMap, MUSCLE_NAMES };
})();
