/* ═══ MYO — BODY ATLAS: the whole body, how every system works, how they connect, from embryo to old age ═══
   How it works  · eleven systems: what each does, its parts, figures, how it develops and ages, what keeps it strong,
                   and the member's own numbers for it
   Connections   · a map of the systems and the links between them (nerves, hormones, blood, immune signals,
                   nutrients), tap a system to follow its links
   Embryo to old age · from one cell to the end of life: the germ layers every organ comes from, the milestones of
                   development, and how key capacities rise and fall across a lifetime, with the member's age marked
   Your stage    · what is changing in each system at the member's age and what moves it
   Education, not medical advice. Life curves are typical averages for untrained people; training changes them. */
(function () {
  'use strict';
  const { esc, icon, pill, clamp } = OS;
  const AT = { tab: 'systems', sys: 'nervous', node: null, stage: null };
  const TABS = [['systems', 'How it works'], ['connect', 'How it connects'], ['life', 'Embryo to old age'], ['you', 'Your stage']];
  // [key, name, germ layer(s), body view, what it does, parts, figures, develops, ages, keeps it strong, twin system]
  const SYS = [
    { k: 'nervous', n: 'Nervous', layer: 'ecto', go: 'body', twin: 'brain', job: 'Senses the world and the body, decides, and coordinates everything else in milliseconds.', parts: 'Brain, spinal cord, nerves, the senses, and the gut\'s own nervous system.',
      facts: ['About 86 billion neurons in the brain', 'The brain is about 2% of body weight and uses about 20% of resting energy', 'Fast nerve signals travel at over 100 m/s'],
      dev: 'The neural tube, which becomes the brain and spinal cord, closes by about day 28. At birth the brain is about a quarter of its adult size, about 80% by age 2 and 90% by age 5; the prefrontal cortex keeps maturing into the mid-20s.', ages: 'Brain volume drifts down slowly from midlife and faster after 60; processing speed slows, while knowledge and vocabulary often keep growing.', keep: ['Aerobic exercise (raises the brain growth factor BDNF)', 'Seven to nine hours of sleep', 'Learning new skills and staying social', 'Blood pressure and blood sugar in range'] },
    { k: 'endocrine', n: 'Endocrine', layer: 'all', go: 'biochem', twin: 'hormones', job: 'Sends slow, body-wide messages in the blood: growth, energy use, stress, sleep timing, reproduction.', parts: 'Hypothalamus, pituitary, thyroid, adrenals, pancreas, ovaries or testes, and hormone-making cells in gut, fat and kidneys.',
      facts: ['More than 50 hormones', 'Most run on feedback loops, like a thermostat', 'The hypothalamus links the nervous and endocrine systems'],
      dev: 'Glands form from all three germ layers between weeks 4 and 12; sex hormones switch on strongly at puberty.', ages: 'Growth hormone and sex hormones fall with age; insulin sensitivity tends to fall unless muscle and activity are kept up; menopause ends ovarian hormone production at an average age of about 51.', keep: ['Strength training and daily movement (insulin sensitivity)', 'Regular sleep and light timing', 'Stress recovery', 'A healthy waist size'] },
    { k: 'cardio', n: 'Heart and blood vessels', layer: 'meso', go: 'heart', twin: 'heart', job: 'Pumps blood that carries oxygen, fuel, hormones and immune cells to every cell, and carries waste away.', parts: 'Heart, arteries, capillaries, veins and blood.',
      facts: ['About 100,000 heartbeats a day', 'About 5 litres a minute pumped at rest, five times that in a hard effort', 'About 100,000 km of blood vessels'],
      dev: 'The first organ to work: the heart tube starts beating at about day 22. At birth the lungs inflate and two fetal shortcuts in the circulation close.', ages: 'Arteries stiffen and blood pressure tends to rise; maximum heart rate falls by roughly one beat a year. Plaque builds over decades, driven by ApoB, blood pressure, smoking and blood sugar.', keep: ['Zone 2 and interval cardio', 'Blood pressure, ApoB and blood sugar in range', 'No smoking', 'Sleep'] },
    { k: 'resp', n: 'Respiratory', layer: 'endo', go: 'body', twin: 'fitness', job: 'Moves air in and out, loads oxygen into the blood and clears carbon dioxide, which also sets the blood\'s acidity.', parts: 'Nose, throat, windpipe, bronchi, lungs and their alveoli, and the diaphragm.',
      facts: ['About 480 million alveoli', 'A gas-exchange surface of about 70 m²', '12 to 20 breaths a minute at rest, set by carbon dioxide levels'],
      dev: 'The lungs bud from the gut tube in week 4 and are among the last organs to mature; surfactant, which keeps alveoli open, is made late in pregnancy.', ages: 'Lung elasticity and breathing-muscle strength decline slowly from about 25; fitness keeps the reserve large.', keep: ['Not smoking or vaping', 'Cardio that makes you breathe hard', 'Clean air'] },
    { k: 'immune', n: 'Immune and lymphatic', layer: 'meso', go: 'biology', twin: 'inflammation', job: 'Tells self from non-self, fights infection, repairs damage, and returns leaked fluid to the blood.', parts: 'White blood cells, bone marrow, thymus, lymph nodes, spleen, tonsils, and immune tissue along the gut and skin.',
      facts: ['Most of the body\'s immune cells line the gut', 'Lymph returns about 3 litres of fluid to the blood each day', 'Two arms: fast innate defence and learned adaptive defence'],
      dev: 'Blood and immune stem cells appear in the embryo\'s yolk sac, then liver, then bone marrow. The thymus trains T cells and is largest in childhood.', ages: 'The thymus shrinks after puberty; responses to new infections and vaccines weaken with age, and low-grade inflammation tends to rise.', keep: ['Sleep', 'Regular moderate exercise', 'Vaccinations your clinician recommends', 'A fibre-rich, varied diet'] },
    { k: 'digestive', n: 'Digestive', layer: 'endo', go: 'kitchen', twin: 'metabolic', job: 'Breaks food into molecules the body can absorb, and filters and processes them in the liver.', parts: 'Mouth, oesophagus, stomach, intestines, liver, gallbladder, pancreas, and the gut microbiome.',
      facts: ['A gut lining of about 30 m²', 'About 38 trillion bacteria, roughly as many as the body\'s own cells', 'The liver handles hundreds of jobs, from storing fuel to clearing drugs'],
      dev: 'The gut tube folds in from the endoderm in week 4; the liver and pancreas bud from it.', ages: 'Stomach acid and some absorption (such as B12) decline; the microbiome changes; the liver copes well unless fat builds up in it.', keep: ['Fibre and fermented foods', 'Enough protein', 'Little alcohol', 'A healthy waist size (liver fat)'] },
    { k: 'urinary', n: 'Kidneys and urinary', layer: 'meso', go: 'biology', twin: 'kidneys', job: 'Filters the blood, balances water, salt and acid, and makes hormones for blood pressure, red cells and bone.', parts: 'Kidneys, ureters, bladder and urethra.',
      facts: ['About 180 litres of blood plasma filtered a day', 'One to two litres of urine made from it', 'Makes EPO (red cells) and activates vitamin D'],
      dev: 'Kidneys form in three waves in the embryo; the final kidney starts working in the first trimester and makes the amniotic fluid.', ages: 'Filtration (eGFR) falls by roughly 1 point a year after about 40, faster with high blood pressure or diabetes.', keep: ['Blood pressure and blood sugar in range', 'Enough water', 'Care with long-term painkiller use (ask your clinician)'] },
    { k: 'muscle', n: 'Muscular', layer: 'meso', go: 'training', twin: 'muscle', job: 'Moves and holds the body, makes heat, and is the main place blood sugar goes after a meal.', parts: 'More than 600 skeletal muscles, plus heart muscle and the smooth muscle in vessels and organs.',
      facts: ['Skeletal muscle is 30 to 40% of body mass', 'It releases signalling molecules (myokines) that act on other organs', 'Strength can rise at any age with training'],
      dev: 'Muscle forms from blocks of mesoderm (somites) beside the neural tube from week 4.', ages: 'Muscle mass falls by roughly 3 to 8% a decade after 30 without training, faster after 60 (sarcopenia); strength falls faster than mass.', keep: ['Strength training two or more times a week', 'Protein spread through the day', 'Daily walking'] },
    { k: 'skeletal', n: 'Skeletal', layer: 'meso', go: 'bodycomp', twin: 'bone', job: 'Holds the body up, protects organs, stores calcium, and makes blood cells in its marrow.', parts: '206 bones in an adult, cartilage, ligaments, joints and bone marrow.',
      facts: ['About 270 bones at birth fuse to 206', 'About 10% of the skeleton is rebuilt each year', 'Marrow makes millions of red cells every second'],
      dev: 'Bones start as cartilage models in the embryo and harden from the inside out; growth plates close after puberty.', ages: 'Bone mass peaks by about 30, then slowly declines, faster for several years after menopause.', keep: ['Impact and strength training', 'Calcium, vitamin D and protein', 'Not smoking, little alcohol'] },
    { k: 'skin', n: 'Skin', layer: 'ecto', go: 'looks', twin: null, job: 'The barrier between you and the world: keeps water in and germs out, senses touch and temperature, cools you, makes vitamin D.', parts: 'Epidermis, dermis, fat layer, hair, nails, sweat and oil glands.',
      facts: ['About 1.8 m² in an adult', 'The outer layer renews every few weeks', 'Sweat can shed more than a litre an hour in hard exercise'],
      dev: 'The outer skin comes from ectoderm, the deeper dermis from mesoderm.', ages: 'Collagen and elasticity fall, skin thins and heals more slowly; sun exposure accounts for most visible skin ageing.', keep: ['Daily sunscreen', 'Not smoking', 'Sleep and protein'] },
    { k: 'repro', n: 'Reproductive', layer: 'meso', go: 'biochem', twin: 'hormones', job: 'Makes eggs or sperm and the sex hormones that also shape muscle, bone, mood and metabolism.', parts: 'Ovaries, uterus and breasts, or testes and prostate, with the hormones that run them.',
      facts: ['A person is born with all the eggs they will have', 'Sperm are made continuously, about 1,000 a second', 'Sex hormones protect bone and muscle'],
      dev: 'Early germ cells migrate into the developing gonads in weeks 4 to 6; puberty starts their adult function.', ages: 'Menopause at an average age of about 51 ends ovarian hormones; testosterone falls gradually, roughly 1% a year from midlife.', keep: ['Strength training', 'Healthy body fat', 'Sleep', 'Screening your clinician recommends'] }
  ];
  const BY = Object.fromEntries(SYS.map((x) => [x.k, x]));
  const SHORT = { cardio: 'Heart and vessels', resp: 'Lungs', immune: 'Immune', urinary: 'Kidneys', muscle: 'Muscle', skeletal: 'Bone' };
  // [a, b, how they talk]
  const LINKS = [
    ['nervous', 'cardio', 'Autonomic nerves set heart rate and vessel tone; HRV reads this balance.'], ['nervous', 'endocrine', 'The hypothalamus runs the pituitary: stress, thyroid, growth and sex-hormone axes.'],
    ['nervous', 'muscle', 'Motor nerves fire muscle; exercise raises BDNF, a growth factor for the brain.'], ['nervous', 'digestive', 'The gut-brain axis: the vagus nerve and the gut\'s own 500 million neurons.'],
    ['nervous', 'resp', 'The brainstem sets breathing by carbon dioxide in the blood.'], ['resp', 'cardio', 'Lungs load oxygen; the heart delivers it. VO2max measures both together.'],
    ['cardio', 'urinary', 'Kidneys set blood volume and pressure through the renin-angiotensin system.'], ['urinary', 'skeletal', 'Kidneys activate vitamin D, which lets the gut absorb calcium for bone.'],
    ['urinary', 'cardio', 'Kidneys make EPO, which tells marrow to make red blood cells.'], ['skeletal', 'immune', 'Bone marrow makes white cells, red cells and platelets.'],
    ['digestive', 'immune', 'Most immune cells line the gut, trained by the microbiome.'], ['digestive', 'endocrine', 'Pancreas makes insulin and glucagon; gut hormones like GLP-1 signal fullness.'],
    ['muscle', 'endocrine', 'Muscle is the main destination for blood sugar after a meal; it sets insulin sensitivity.'], ['muscle', 'skeletal', 'Muscle pull loads bone, which keeps it dense.'],
    ['skin', 'skeletal', 'Sunlight on skin makes vitamin D for calcium and bone.'], ['skin', 'immune', 'Skin is a physical barrier with its own immune cells.'],
    ['endocrine', 'repro', 'Pituitary hormones LH and FSH drive the ovaries and testes.'], ['repro', 'skeletal', 'Oestrogen and testosterone protect bone; their loss speeds bone loss.'],
    ['immune', 'cardio', 'Lymph returns leaked fluid to the veins; inflammation drives plaque in arteries.'], ['digestive', 'cardio', 'The portal vein carries everything absorbed to the liver first.'],
    ['endocrine', 'cardio', 'Adrenaline raises heart rate; aldosterone holds salt and water.'], ['immune', 'nervous', 'Inflammatory signals reach the brain and cause tiredness and low mood when ill.'],
    ['endocrine', 'skin', 'Thyroid and sex hormones shape skin, hair and oil glands.'], ['muscle', 'cardio', 'Working muscles squeeze veins, helping blood back to the heart.']
  ];
  const LAYERS = { ecto: ['Ectoderm', 'Outer layer', 'Skin, hair and nails, the brain, spinal cord and nerves, the eye\'s lens, tooth enamel'], meso: ['Mesoderm', 'Middle layer', 'Muscle, bone and cartilage, the heart, blood and vessels, kidneys, gonads, the dermis and fat'], endo: ['Endoderm', 'Inner layer', 'The lining of the gut and airways, the liver, pancreas, thyroid and bladder lining'] };
  // milestones: [age in years (negative before birth), label, text]
  const STAGES = [
    [-0.75, 'Fertilisation', 'One cell, the zygote, carries a complete genome from both parents.'],
    [-0.735, 'Days 1 to 5', 'The cell divides into a ball, then a hollow blastocyst. Its inner cluster of cells becomes the whole body.'],
    [-0.725, 'Days 6 to 12', 'The blastocyst implants in the uterine wall and the placenta begins.'],
    [-0.71, 'Week 3', 'Gastrulation: three germ layers form. Every organ in the body comes from one of them.'],
    [-0.69, 'Weeks 3 to 4', 'The heart starts beating at about day 22; the neural tube closes by about day 28.'],
    [-0.65, 'Weeks 4 to 8', 'Organs form: limb buds, eyes, gut, kidneys. By week 8 the embryo is about 3 cm long.'],
    [-0.4, 'Weeks 9 to birth', 'The fetal period: organs grow and mature; the brain grows fastest late; the lungs mature last.'],
    [0, 'Birth', 'The lungs inflate with the first breath and the circulation reroutes through them.'],
    [1, 'Infancy', 'The brain grows fastest it ever will; the immune system meets the world; motor skills arrive.'],
    [6, 'Childhood', 'Steady growth, bone building and immune training. The thymus is at its largest.'],
    [12, 'Puberty', 'Sex hormones switch on: a growth spurt, adult reproduction, and big gains in bone and muscle.'],
    [25, 'Young adult', 'Peak fitness. The prefrontal cortex finishes maturing. Bone mass peaks by about 30.'],
    [40, 'Midlife', 'Slow declines start: VO2max, muscle and kidney filtration. Training slows all of them.'],
    [51, 'Menopause (average)', 'Ovarian hormones end; bone loss speeds up for several years; heart risk rises.'],
    [65, 'Later life', 'Muscle loss speeds up, arteries stiffen, immune responses weaken. Strength and fitness matter most now.'],
    [85, 'Old age', 'Reserve shrinks, so illness and injury hit harder. People who stay active keep far more capacity.'],
    [95, 'End of life', 'Dying is usually a gradual process: appetite and thirst fall, sleep lengthens, breathing and circulation slow. Death is the irreversible end of circulation or of all brain function.']
  ];
  // typical capacity curves, % of peak, for untrained people (education only)
  const CURVES = [
    ['VO2max (fitness)', (a) => (a < 20 ? 60 + a * 2 : a < 25 ? 100 : 100 - (a - 25) * 0.95 - Math.max(0, a - 70) * 0.4), 'About 10% lower each decade after 25 without training'],
    ['Muscle mass', (a) => (a < 25 ? 30 + a * 2.8 : a < 30 ? 100 : a < 50 ? 100 - (a - 30) * 0.5 : 90 - (a - 50) * 0.9 - Math.max(0, a - 70) * 0.6), 'Roughly 3 to 8% lower each decade after 30, faster after 60'],
    ['Bone mass', (a) => (a < 30 ? 35 + a * 2.17 : a < 45 ? 100 : 100 - (a - 45) * 0.7), 'Peaks by about 30; falls faster for several years after menopause'],
    ['Kidney filtration', (a) => (a < 2 ? 50 + a * 25 : a < 40 ? 100 : 100 - (a - 40) * 0.9), 'eGFR roughly 1 point lower each year after about 40']
  ];

  /* ── pictures ── */
  function embryoSVG() {
    const g = (x, inner, label) => `<g transform="translate(${x},0)">${inner}<text class="at-lab" x="0" y="96" text-anchor="middle">${label}</text></g>`;
    return `<svg class="at-emb" viewBox="0 0 720 110" role="img" aria-label="From one cell to a fetus: zygote, morula, blastocyst, three germ layers, embryo, fetus">
      ${g(60, '<circle class="at-cell" cx="0" cy="45" r="30"/><circle class="at-nuc" cx="-9" cy="45" r="7"/><circle class="at-nuc" cx="9" cy="45" r="7"/>', 'Zygote · day 0')}
      ${g(180, [[-10, 37], [10, 37], [-10, 55], [10, 55], [0, 46], [-18, 46], [18, 46], [0, 30], [0, 62]].map(([x, y]) => `<circle class="at-cell" cx="${x}" cy="${y}" r="10"/>`).join(''), 'Morula · day 3')}
      ${g(300, '<circle class="at-cell hollow" cx="0" cy="45" r="31"/><path class="at-icm" d="M-18 22 a22 22 0 0 1 36 0 l-6 14 a14 14 0 0 0 -24 0 Z"/>', 'Blastocyst · day 5')}
      ${g(420, '<rect class="at-l ecto" x="-34" y="22" width="68" height="14" rx="6"/><rect class="at-l meso" x="-34" y="38" width="68" height="14" rx="6"/><rect class="at-l endo" x="-34" y="54" width="68" height="14" rx="6"/>', 'Three layers · week 3')}
      ${g(540, '<path class="at-cell" d="M18 18 c-30 -8 -44 18 -36 40 c6 18 30 24 38 10 c-14 4 -24 -4 -24 -16 c0 -14 12 -24 22 -18 Z"/><circle class="at-nuc" cx="10" cy="24" r="6"/><path class="at-bud" d="M-14 44 l-10 6 M-6 60 l-6 9"/>', 'Embryo · week 6')}
      ${g(660, '<circle class="at-cell" cx="2" cy="28" r="15"/><path class="at-cell" d="M-8 40 c-18 8 -20 34 -2 42 c16 6 30 -4 28 -20 c-2 -14 -12 -22 -26 -22 Z"/><path class="at-bud" d="M14 56 l12 4 M4 80 l10 6"/>', 'Fetus · week 12')}</svg>`;
  }
  function network(sel) {
    const n = SYS.length, R = 150, cx = 220, cy = 190, P = Object.fromEntries(SYS.map((x, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; return [x.k, [cx + Math.cos(a) * R, cy + Math.sin(a) * R, a]]; }));
    const edges = LINKS.map(([a, b], i) => { const [x1, y1] = P[a], [x2, y2] = P[b], on = sel && (a === sel || b === sel); return `<path class="at-edge ${on ? 'on' : sel ? 'dim' : ''}" d="M${x1.toFixed(1)} ${y1.toFixed(1)} Q${cx} ${cy} ${x2.toFixed(1)} ${y2.toFixed(1)}"><title>${esc(BY[a].n)} ↔ ${esc(BY[b].n)}: ${esc(LINKS[i][2])}</title></path>`; }).join('');
    const nodes = SYS.map((x) => { const [px, py, a] = P[x.k], deg = LINKS.filter(([p, q]) => p === x.k || q === x.k).length, lx = px + Math.cos(a) * 26, ly = py + Math.sin(a) * 26 + 4;
      return `<g class="at-node ${sel === x.k ? 'on' : ''}" data-act="at-node" data-k="${x.k}" role="button" tabindex="0" aria-label="${esc(x.n)}: ${deg} connections"><circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${9 + deg}"/><text class="at-nl" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${Math.cos(a) > 0.3 ? 'start' : Math.cos(a) < -0.3 ? 'end' : 'middle'}">${esc(SHORT[x.k] || x.n)}</text></g>`; }).join('');
    return `<svg class="at-net" viewBox="-20 0 480 380" role="img" aria-label="Map of the body's systems and the links between them">${edges}${nodes}</svg>`;
  }
  function curveSVG(name, fn, note, age) {
    const W = 300, H = 120, L = 40, R = 10, T = 10, B = 20, X = (a) => L + (a / 100) * (W - L - R), Y = (v) => T + (1 - v / 100) * (H - T - B);
    const pts = []; for (let a = 0; a <= 100; a += 2) pts.push([a, clamp(fn(a), 0, 100)]);
    const you = age != null ? clamp(fn(age), 0, 100) : null;
    return `<figure class="at-curve"><figcaption><b>${esc(name)}</b><span class="muted small">${esc(note)}</span></figcaption>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(name)} across life, as a share of its peak">${[0, 50, 100].map((v) => `<line class="bc-grid" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="bc-ax" x="${L - 4}" y="${Y(v) + 4}" text-anchor="end">${v}%</text>`).join('')}
        ${[0, 25, 50, 75, 100].map((a) => `<text class="bc-ax" x="${X(a)}" y="${H - 4}" text-anchor="middle">${a}</text>`).join('')}
        <path class="bc-ln bc-lean" d="${pts.map(([a, v], i) => `${i ? 'L' : 'M'}${X(a).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ')}"/>
        ${you != null ? `<line class="at-you" x1="${X(age)}" x2="${X(age)}" y1="${T}" y2="${H - B}"/><circle class="bc-mk bc-fat" cx="${X(age).toFixed(1)}" cy="${Y(you).toFixed(1)}" r="4.5"><title>Age ${age}: about ${Math.round(you)}% of peak for an untrained person</title></circle>` : ''}</svg></figure>`;
  }

  /* ── pages ── */
  function sysTab(s) {
    const x = BY[AT.sys] || SYS[0], tw = OS.twin && x.twin ? (() => { try { const B = OS.twin.baseline(s); return OS.twin.systems(s, B).find((y) => y.k === x.twin); } catch { return null; } })() : null;
    return `<div class="at-pick" role="group" aria-label="Body systems">${SYS.map((y) => `<button class="chip-btn ${y.k === x.k ? 'on' : ''}" data-act="at-sys" data-k="${y.k}" aria-pressed="${y.k === x.k}">${esc(y.n)}</button>`).join('')}</div>
      <div class="grid g-2"><section class="card"><div class="card-h"><h2>${esc(x.n)} system</h2>${pill('muted', LAYERS[x.layer] ? LAYERS[x.layer][0] : 'All three layers')}</div>
          <p>${esc(x.job)}</p><p class="small"><b>Parts:</b> ${esc(x.parts)}</p>
          <ul class="at-facts">${x.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
          <div class="st-go"><a class="btn ghost sm" href="#${x.go}">${icon('link', 14)} Explore in Myo</a></div></section>
        <section class="card"><div class="card-h"><h2>Across a life</h2></div>
          <h3 class="bc-h3">How it develops</h3><p class="small">${esc(x.dev)}</p><h3 class="bc-h3">How it ages</h3><p class="small">${esc(x.ages)}</p>
          <h3 class="bc-h3">What keeps it strong</h3><ul class="small bc-ref">${x.keep.map((k) => `<li>${esc(k)}</li>`).join('')}</ul></section></div>
      <div class="grid g-2"><section class="card"><div class="card-h"><h2>Talks to</h2></div><ul class="at-links">${LINKS.filter(([a, b]) => a === x.k || b === x.k).map(([a, b, t]) => { const o = BY[a === x.k ? b : a]; return `<li><button class="link" data-act="at-sys" data-k="${o.k}">${esc(o.n)}</button><span class="small">${esc(t)}</span></li>`; }).join('')}</ul></section>
        <section class="card"><div class="card-h"><h2>Your ${esc(x.n.toLowerCase())}</h2>${tw && tw.score != null ? pill(tw.tone, `${tw.score} / 100`) : ''}</div>
          ${tw && tw.parts.length ? `<ul class="tw-detail-list small">${tw.parts.map((p) => `<li><span>${esc(p.k)}</span><b class="num">${esc(p.lab || '')}</b></li>`).join('')}</ul><p class="fine">From your digital twin.</p><a class="btn ghost sm" href="#twin">Open your twin</a>` : `<p class="small muted">No data of yours feeds this system yet.</p><a class="btn ghost sm" href="#twin">See what your twin needs</a>`}</section></div>`;
  }
  function connectTab() {
    const sel = AT.node, x = sel && BY[sel];
    return `<div class="grid g-2"><section class="card"><div class="card-h"><h2>Everything is connected</h2><span class="muted small">${LINKS.length} links</span></div>${network(sel)}<p class="fine">Tap a system to follow its links. Bigger circles have more connections. Lines are the main routes: nerves, hormones, blood and immune signals.</p></section>
      <section class="card"><div class="card-h"><h2>${x ? esc(x.n) : 'Pick a system'}</h2>${x ? `<button class="btn ghost sm" data-act="at-node" data-k="">Show all</button>` : ''}</div>
        ${x ? `<ul class="at-links">${LINKS.filter(([a, b]) => a === sel || b === sel).map(([a, b, t]) => { const o = BY[a === sel ? b : a]; return `<li><button class="link" data-act="at-node" data-k="${o.k}">${esc(o.n)}</button><span class="small">${esc(t)}</span></li>`; }).join('')}</ul>`
          : `<p class="small">A single habit reaches many systems at once. Strength training, for example, loads bone, builds the muscle that clears blood sugar, raises BDNF in the brain, and lowers resting heart rate. That is why the same few levers keep appearing across Myo.</p>
            <ul class="small bc-ref"><li><b>Nerves</b> are the fast wiring: milliseconds.</li><li><b>Hormones</b> are slow broadcasts: minutes to months.</li><li><b>Blood</b> carries both, plus fuel, oxygen and immune cells.</li><li><b>Immune signals</b> spread alarm and repair everywhere.</li></ul>`}</section></div>`;
  }
  function lifeTab(s) {
    const age = +(s.profile && s.profile.age) || null;
    return `<section class="card"><div class="card-h"><h2>From one cell</h2></div>${embryoSVG()}
        <div class="at-germ">${Object.entries(LAYERS).map(([k, [n, sub, t]]) => `<div class="at-g ${k}"><b>${n}</b><span class="muted small">${sub}</span><p class="small">${esc(t)}</p></div>`).join('')}</div>
        <p class="fine">By week 3 the embryo is three layers of cells. Everything in the adult body traces back to one of them, which is why the systems are so intertwined from the start.</p></section>
      <section class="card"><div class="card-h"><h2>A lifetime, step by step</h2>${age ? `<span class="muted small">You are ${age}</span>` : ''}</div>
        <ol class="at-time">${STAGES.map(([a, l, t]) => { const here = age != null && a <= age && (STAGES.find((x) => x[0] > a) || [999])[0] > age; return `<li class="${a < 0 ? 'pre' : ''} ${here ? 'here' : ''}"><span class="at-age num">${a < 0 ? 'Before birth' : a === 0 ? 'Birth' : `${a}${a >= 95 ? '+' : ''}`}</span><div><b>${esc(l)}</b>${here ? ' ' + pill('good', 'You are here') : ''}<p class="small">${esc(t)}</p></div></li>`; }).join('')}</ol></section>
      <section class="card"><div class="card-h"><h2>Capacities across a life</h2><span class="muted small">Share of peak, typical untrained person</span></div>
        <div class="at-curves">${CURVES.map(([n, fn, note]) => curveSVG(n, fn, note, age)).join('')}</div>
        <p class="fine">Typical averages for people who do not train. Regular strength and cardio training lift these curves and slow their fall at every age${age ? '; the dot marks your age' : ''}.</p></section>`;
  }
  function youTab(s) {
    const age = +(s.profile && s.profile.age) || 35, st = [...STAGES].filter(([a]) => a >= 0 && a <= age).pop() || STAGES[7];
    const now = (fn) => Math.round(clamp(fn(age), 0, 100)), ten = (fn) => Math.round(clamp(fn(age + 10), 0, 100));
    return `<section class="card"><div class="card-h"><h2>${esc(st[1])}</h2>${pill('good', `Age ${age}`)}</div><p>${esc(st[2])}</p>
        <div class="lb-tiles">${CURVES.map(([n, fn]) => `<div><span>${esc(n)}</span><b>${now(fn)}%</b><em>of peak, typical untrained</em><i class="tw-d down">${ten(fn) - now(fn)} points in 10 years without training</i></div>`).join('')}</div></section>
      <div class="grid g-2"><section class="card"><div class="card-h"><h2>What is changing now</h2></div><ul class="at-links">${SYS.map((x) => `<li><button class="link" data-act="at-sys-go" data-k="${x.k}">${esc(x.n)}</button><span class="small">${esc(age < 25 ? x.dev : x.ages)}</span></li>`).join('')}</ul></section>
        <section class="card"><div class="card-h"><h2>Levers that move every system</h2></div><ul class="small bc-ref">
          <li><b>Strength training</b> twice a week or more: muscle, bone, blood sugar, brain.</li><li><b>Cardio</b>, mostly easy plus some hard: heart, lungs, brain, kidneys.</li>
          <li><b>Sleep</b> seven to nine hours: hormones, immunity, brain, appetite.</li><li><b>Protein and fibre</b>: muscle, gut, immunity.</li><li><b>No smoking, little alcohol</b>: every system.</li><li><b>Connection and purpose</b>: brain, stress hormones.</li></ul>
          <div class="st-go"><a class="btn ghost sm" href="#twin">Run them on your twin</a><a class="btn ghost sm" href="#longevity">Longevity plan</a></div></section></div>`;
  }

  OS.register('atlas', {
    title: 'Body atlas', icon: 'atlas',
    render(s) {
      const body = AT.tab === 'connect' ? connectTab() : AT.tab === 'life' ? lifeTab(s) : AT.tab === 'you' ? youTab(s) : sysTab(s);
      return `${OS.ui.head('The whole body · embryo to old age', 'Body atlas', 'How every system works, how they connect, and how the body is built and changes from a single cell to the end of life.')}
        <div class="at"><div class="seg kt-tabs" role="tablist" aria-label="Body atlas">${TABS.map(([k, l]) => `<button role="tab" aria-selected="${AT.tab === k}" data-act="at-tab" data-t="${k}">${l}</button>`).join('')}</div>${body}
        <p class="fine">Education, not medical advice. Figures are typical adult values from textbooks and large studies; individuals vary.</p></div>`;
    },
    mount(root) {
      const keys = (e) => { const g = e.target.closest && e.target.closest('.at-node'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); g.dispatchEvent(new MouseEvent('click', { bubbles: true })); } };
      root.addEventListener('keydown', keys); return () => root.removeEventListener('keydown', keys);
    }
  });
  OS.act('at-tab', (el) => { AT.tab = TABS.some(([k]) => k === el.dataset.t) ? el.dataset.t : 'systems'; OS.render(); });
  OS.act('at-sys', (el) => { AT.sys = el.dataset.k; OS.render(); });
  OS.act('at-sys-go', (el) => { AT.sys = el.dataset.k; AT.tab = 'systems'; OS.render(); });
  OS.act('at-node', (el) => { AT.node = el.dataset.k ? (AT.node === el.dataset.k ? null : el.dataset.k) : null; OS.render(); });
  OS.atlas = { SYS, LINKS, STAGES, CURVES, LAYERS, state: AT };
})();
