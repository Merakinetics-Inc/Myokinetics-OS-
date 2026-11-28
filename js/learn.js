/* ═══ MYO — LEARN BIOLOGY: from molecules to the whole body, in twelve short units ═══
   Units     · cells; DNA, genes and proteins; energy and metabolism; tissues; body systems; immunity; hormones;
               muscle; brain and nerves; aging; cancer biology; and "your labs explained", written from the member's
               own markers. Each unit ends in a short quiz and links to where the topic lives in Myo.
   Review    · every missed question comes back on a spaced schedule (1, 3, 7, then 21 days) until it sticks
   Lesson attention (admins only) · tests Myo's own lesson videos with Sapient's neural response prediction through
               the content-scan server function, to find where a lesson loses people. Never used on members, their
               faces or their video, and purchase-intent signals are dropped. Myo is not affiliated with Sapient.
   Progress is part of the member's Myo data (s.learn). Lesson test results stay on the admin's device. */
(function () {
  'use strict';
  const { esc, icon, pill, dayKey, addDays, fmtDate } = OS;

  // [id, title, icon, summary, points [heading, text], Myo pages, questions [q, options, answer, why]]
  const UNITS = [
    ['cells', 'Cells', 'myo', 'The unit of life, and the parts inside it', [
      ['About 30 trillion of them', 'Your body holds roughly 30 trillion human cells, and about as many bacteria, mostly in the gut.'],
      ['A membrane that decides', 'A double layer of fat molecules wraps each cell. Channels and pumps in it choose what gets in and out.'],
      ['Parts with jobs', 'The nucleus keeps your DNA. Mitochondria make most of the cell\'s energy. Ribosomes build proteins, the ER and Golgi fold and ship them, and lysosomes recycle worn-out parts (autophagy).'],
      ['Same DNA, different cells', 'A neuron and a muscle cell carry the same genome. They differ because each switches on a different set of genes.']
    ], ['myo', 'atlas'], [
      ['Which part of the cell makes most of its energy (ATP)?', ['Nucleus', 'Mitochondria', 'Golgi', 'Lysosome'], 1, 'Mitochondria use oxygen to make most of a cell\'s ATP.'],
      ['A neuron and a muscle cell share the same DNA. Why are they so different?', ['They switch on different genes', 'They have different DNA', 'They have different numbers of chromosomes', 'Muscle cells have no nucleus'], 0, 'Specialisation comes from which genes are used, not from different DNA.'],
      ['What does autophagy do?', ['Recycles worn-out parts of the cell', 'Copies DNA', 'Makes hormones', 'Carries oxygen'], 0, 'Autophagy ("self-eating") breaks down and reuses damaged parts.']
    ]],
    ['dna', 'DNA, genes and proteins', 'biology', 'How a four-letter code builds you', [
      ['Four letters', 'DNA is written in four bases (A, T, C, G). One copy of your genome is about 3 billion letters, with about 20,000 genes that code for proteins.'],
      ['DNA to RNA to protein', 'A gene is copied into RNA (transcription), then read three letters at a time to chain amino acids into a protein (translation).'],
      ['Epigenetics', 'Chemical tags on DNA and its packaging turn genes up or down. Age, sleep, diet and smoking change them; epigenetic clocks read them to estimate biological age.'],
      ['Mutations', 'Most changes in DNA are harmless. Some, in genes that control growth or repair, raise disease risk. They can be inherited or picked up during life.']
    ], ['biology', 'longevity'], [
      ['How many DNA letters code for one amino acid?', ['One', 'Two', 'Three', 'Four'], 2, 'Each three-letter codon stands for one amino acid (or a stop signal).'],
      ['What does an epigenetic mark change?', ['Which genes are used', 'The DNA letters themselves', 'How many genes you have', 'Your blood type'], 0, 'Epigenetic marks change gene activity without changing the sequence.'],
      ['Roughly how many protein-coding genes do people have?', ['2,000', '20,000', '200,000', '2 million'], 1, 'About 20,000: fewer than many expected when the genome was first read.']
    ]],
    ['metabolism', 'Energy and metabolism', 'pathway', 'Turning food into ATP, and storing the rest', [
      ['ATP is the currency', 'Cells burn glucose, fat and some protein to make ATP. With oxygen, mitochondria get about 30 ATP from one glucose; without it, only 2.'],
      ['Insulin and glucagon', 'After a meal, insulin from the pancreas moves glucose into muscle, liver and fat. Between meals, glucagon tells the liver to release it.'],
      ['Blood sugar over months', 'HbA1c measures glucose stuck to hemoglobin. Red blood cells live about 120 days, so it reflects roughly the last 3 months.'],
      ['Carrying fat', 'Fats travel in lipoproteins. Each LDL, VLDL or Lp(a) particle carries one ApoB protein, so ApoB counts the particles that can lodge in artery walls.']
    ], ['biochem', 'biology', 'fuel'], [
      ['Why does HbA1c reflect about 3 months of blood sugar?', ['Red blood cells live about 120 days', 'The liver stores sugar for 3 months', 'Insulin lasts 3 months', 'Labs average 90 tests'], 0, 'Glucose sticks to hemoglobin for the life of the red cell, about 120 days.'],
      ['How many ApoB proteins does each LDL particle carry?', ['None', 'One', 'Ten', 'It depends on diet'], 1, 'One per particle, which is why ApoB is a particle count.'],
      ['Which hormone lowers blood glucose?', ['Glucagon', 'Cortisol', 'Insulin', 'Adrenaline'], 2, 'Insulin lowers glucose; the others raise it.']
    ]],
    ['tissues', 'Tissues and organs', 'body', 'Four tissue types build every organ', [
      ['Four types', 'Epithelial tissue lines surfaces. Connective tissue (bone, blood, fat, tendon) supports. Muscle moves. Nervous tissue signals.'],
      ['Constant renewal', 'Stem cells replace the gut lining in under a week and the skin in about a month or two. Most heart muscle cells and brain neurons last a lifetime.'],
      ['The scaffold', 'Outside cells, collagen gives strength and elastin gives stretch. Together they are the extracellular matrix.'],
      ['Organs mix them', 'The stomach uses all four: a lining, connective layers, smooth muscle and nerves.']
    ], ['body', 'atlas'], [
      ['Which of these is not one of the four tissue types?', ['Epithelial', 'Connective', 'Muscle', 'Hormonal'], 3, 'Hormones are signals, not a tissue type.'],
      ['Blood is which type of tissue?', ['Epithelial', 'Connective', 'Nervous', 'Muscle'], 1, 'Blood is a connective tissue: cells in a liquid matrix, plasma.'],
      ['Which renews fastest?', ['Gut lining', 'Heart muscle', 'Neurons in the cortex', 'The lens of the eye'], 0, 'The gut lining turns over in days.']
    ]],
    ['systems', 'Body systems', 'atlas', 'Eleven systems, one balance', [
      ['Eleven systems', 'Nervous, endocrine, cardiovascular, respiratory, digestive, urinary, immune and lymphatic, muscular, skeletal, skin, and reproductive. The Body atlas shows how they connect.'],
      ['Homeostasis', 'Feedback loops hold body temperature near 37 °C, blood pH between 7.35 and 7.45, and glucose in range.'],
      ['Teamwork in exercise', 'Nerves raise your heart rate, lungs move more air, muscles burn fuel, and skin sheds heat as sweat.'],
      ['Three ways to talk', 'Nerves are fast (milliseconds), hormones slower (minutes to days), and immune signals (cytokines) coordinate defence and repair.']
    ], ['atlas', 'body', 'heart'], [
      ['What is the normal range for blood pH?', ['6.8 to 7.0', '7.35 to 7.45', '7.8 to 8.0', '5.5 to 6.0'], 1, 'Blood stays slightly alkaline, 7.35 to 7.45.'],
      ['What does negative feedback do?', ['Pushes a value back toward its set point', 'Amplifies a change', 'Stops all hormones', 'Works only during sleep'], 0, 'Negative feedback corrects drift, like a thermostat.'],
      ['Which signals travel fastest?', ['Nerve impulses', 'Hormones', 'Cytokines', 'Cell division'], 0, 'Nerve impulses travel in milliseconds.']
    ]],
    ['immunity', 'Immunity', 'shield', 'Fast defence, and a memory', [
      ['Innate: fast', 'Skin, mucus, neutrophils, macrophages and natural killer cells respond within hours to anything that looks foreign or damaged.'],
      ['Adaptive: precise', 'B cells make antibodies. Helper T cells coordinate; killer T cells destroy infected or abnormal cells. Memory cells remember, which is why vaccines work.'],
      ['Inflammation', 'Short-term inflammation heals. When the immune signal IL-6 rises, the liver makes CRP. Low-grade inflammation that lasts is linked to heart disease.'],
      ['Watching for cancer', 'T cells and NK cells find and remove many abnormal cells. Some cancers hide by pressing immune brakes; immunotherapy releases them.']
    ], ['biology', 'cancer'], [
      ['Which cells make antibodies?', ['B cells', 'Red blood cells', 'Platelets', 'Neurons'], 0, 'B cells, once activated, become antibody-making plasma cells.'],
      ['Where is CRP made?', ['Liver', 'Bone marrow', 'Thyroid', 'Kidney'], 0, 'The liver makes CRP when IL-6 rises.'],
      ['Why do vaccines work?', ['Memory cells remember an antigen', 'They kill all bacteria', 'They replace white blood cells', 'They raise body temperature'], 0, 'A vaccine trains memory B and T cells without the illness.']
    ]],
    ['hormones', 'Hormones', 'stream', 'Chemical messages and the loops that steer them', [
      ['The glands', 'The hypothalamus and pituitary steer the thyroid (metabolic rate), adrenals (cortisol, adrenaline), pancreas (insulin) and gonads (testosterone, estrogen, progesterone).'],
      ['Feedback axes', 'When thyroid hormone runs low, the pituitary sends more TSH. That is why a high TSH usually means an underactive thyroid.'],
      ['Daily rhythm', 'Cortisol peaks soon after waking and falls through the day. The time of a blood draw changes the result.'],
      ['How they act', 'Steroid hormones enter cells and change which genes are used. Protein hormones like insulin bind receptors on the cell surface.']
    ], ['biology', 'cycle'], [
      ['A high TSH usually means…', ['The thyroid is underactive', 'The thyroid is overactive', 'The pituitary is missing', 'Nothing at all'], 0, 'The pituitary pushes harder when thyroid output is low.'],
      ['When is cortisol normally highest?', ['Soon after waking', 'Midnight', 'After dinner', 'It stays constant'], 0, 'The cortisol awakening response peaks within an hour of waking.'],
      ['Steroid hormones like testosterone mainly act by…', ['Changing gene use inside cells', 'Blocking nerves', 'Carrying oxygen', 'Digesting fat'], 0, 'They bind receptors inside the cell that act on DNA.']
    ]],
    ['muscle', 'Muscle and movement', 'training', 'How muscle contracts, grows and protects your health', [
      ['Sliding filaments', 'A nerve signal releases calcium inside the fibre; myosin pulls on actin, powered by ATP.'],
      ['Fibre types', 'Type I fibres are slow and tireless; type II fibres are fast and powerful. Training shifts how they behave.'],
      ['Growth', 'Hard sets create tension; protein (leucine especially) switches on muscle protein synthesis; satellite cells add nuclei as fibres grow.'],
      ['An organ for health', 'Muscle takes up most of the glucose cleared after a meal, sends signals (myokines) to other organs, and grip strength predicts longevity. After hard training, the enzyme CK leaks into blood.']
    ], ['training', 'function', 'biology'], [
      ['What triggers contraction inside a muscle fibre?', ['Calcium release', 'Sodium leaving', 'Insulin', 'Vitamin D'], 0, 'Calcium uncovers the binding sites so myosin can pull.'],
      ['Which fibres resist fatigue best?', ['Type I', 'Type IIx', 'Type IIa', 'All are equal'], 0, 'Type I fibres are rich in mitochondria.'],
      ['Why can CK be high after training?', ['It leaks from stressed muscle fibres', 'The kidneys make more', 'It signals an infection', 'It means liver damage'], 0, 'A rise after hard training is expected and settles in days.']
    ]],
    ['brain', 'Brain and nerves', 'bci', 'Signals, sleep and learning', [
      ['86 billion neurons', 'Neurons pass signals across synapses with neurotransmitters: glutamate excites, GABA calms, dopamine and serotonin tune.'],
      ['The spike', 'Sodium rushes in, potassium flows out: an action potential. Myelin insulation makes it travel up to 100 times faster.'],
      ['Sleep cleans and files', 'In deep sleep the brain clears waste and moves the day\'s learning into long-term memory.'],
      ['Plasticity', 'Practice strengthens synapses. Exercise raises BDNF, a growth signal for neurons.']
    ], ['bci', 'sleep', 'mind'], [
      ['What is the main excitatory neurotransmitter?', ['Glutamate', 'GABA', 'Insulin', 'Cortisol'], 0, 'Glutamate drives most fast excitation in the brain.'],
      ['What does myelin do?', ['Speeds up nerve signals', 'Stores memories', 'Makes dopamine', 'Carries oxygen'], 0, 'Signals jump between gaps in the myelin.'],
      ['Which helps the brain clear waste?', ['Sleep', 'Caffeine', 'Fasting alone', 'Cold showers'], 0, 'Waste clearance is greatest in deep sleep.']
    ]],
    ['aging', 'Aging', 'longevity', 'Why bodies age, and what slows it', [
      ['Hallmarks of aging', 'Scientists list twelve, including DNA damage, shortening telomeres, epigenetic drift, failing protein quality control, tired mitochondria, senescent cells, stem cell exhaustion and chronic inflammation.'],
      ['Senescent cells', 'Damaged cells that stop dividing but stay, releasing inflammatory signals that age the tissue around them.'],
      ['Biological age', 'PhenoAge estimates biological age from routine blood markers; epigenetic clocks read DNA marks. Both are estimates.'],
      ['What works', 'The strongest evidence is for regular exercise (fitness and strength), good sleep, not smoking, a mostly whole-food diet and social connection.']
    ], ['longevity', 'twin'], [
      ['What do senescent cells do?', ['Stop dividing and release inflammatory signals', 'Divide faster', 'Turn into stem cells', 'Make antibodies'], 0, 'Their signals (the SASP) spread inflammation.'],
      ['PhenoAge estimates biological age from…', ['Routine blood markers', 'A photo of your face', 'Your height', 'Your shoe size'], 0, 'It combines nine blood markers with age.'],
      ['Which has the strongest evidence for healthier aging?', ['Regular exercise', 'High-dose vitamins', 'Detox teas', 'Cold showers alone'], 0, 'Fitness and strength predict lifespan more than almost anything else.']
    ]],
    ['cancer', 'Cancer biology', 'cancer', 'How a cell breaks its own rules, and why early matters', [
      ['Growth out of control', 'Cancer starts when DNA changes pile up in genes that control growth: oncogenes are stuck accelerators (like KRAS), tumour suppressors are broken brakes (like TP53 or BRCA1).'],
      ['The hallmarks', 'Cancer cells keep signalling to grow, ignore stop signals, resist death, divide without limit, grow their own blood supply, invade, rewire their metabolism and hide from the immune system.'],
      ['Causes', 'Age, tobacco, alcohol, UV light, some viruses (HPV, hepatitis B and C), excess body fat, and inherited gene variants, which explain about 5 to 10% of cancers.'],
      ['Benign or malignant', 'A benign tumour stays put. A malignant one can invade nearby tissue and spread (metastasis).'],
      ['Why early matters', 'Many cancers are far more treatable when small. Screening can find some before symptoms, but can also find cancers that would never have caused harm (overdiagnosis).']
    ], ['cancer'], [
      ['A tumour suppressor gene works like…', ['A brake on cell growth', 'An accelerator', 'A vitamin', 'A hormone'], 0, 'When both copies break, the brake is off.'],
      ['What makes a tumour malignant rather than benign?', ['It can invade and spread', 'Its size', 'Its colour', 'Whether it hurts'], 0, 'Invasion and spread define malignancy.'],
      ['About what share of cancers come mainly from inherited gene variants?', ['5 to 10%', 'About 50%', 'About 90%', 'None'], 0, 'Most cancer-causing changes are acquired during life.'],
      ['What is overdiagnosis?', ['Finding a cancer that would never have caused harm', 'Missing a cancer', 'A lab mix-up', 'Seeing too many doctors'], 0, 'It is a real cost of screening, and why screening ages are chosen carefully.']
    ]]
  ];
  // the "your labs" unit: what each marker is, where it comes from, and what moves it
  const LABS = {
    apob: ['One ApoB protein sits on every LDL, VLDL and Lp(a) particle, so it counts the particles that can lodge in arteries.', 'Liver', 'Genes, saturated fat, weight and thyroid function.'],
    ldl: ['The cholesterol carried inside LDL particles.', 'Liver', 'Genes, saturated fat and weight; the liver clears it through LDL receptors.'],
    hdl: ['Cholesterol in particles that carry it back to the liver.', 'Liver and gut', 'Exercise, not smoking and lower triglycerides.'],
    tg: ['Fat in the blood, from food and from the liver.', 'Gut and liver', 'Refined carbohydrates, alcohol and insulin resistance; activity lowers it.'],
    lpa: ['An LDL-like particle with an extra protein; set mostly by your genes, so once is often enough.', 'Liver', 'Mainly genes.'],
    a1c: ['The share of hemoglobin with glucose stuck to it: about a 3-month average.', 'Red blood cells', 'Blood sugar; anemia and red-cell lifespan also shift it.'],
    glu: ['Blood sugar after 8 or more hours without food.', 'Liver (overnight release)', 'Sleep, stress, illness and insulin resistance.'],
    ins: ['The hormone that moves glucose into cells; high fasting insulin can be an early sign of insulin resistance.', 'Pancreas (beta cells)', 'Body fat, activity and diet.'],
    crp: ['A marker of inflammation.', 'Liver, in response to IL-6', 'Infection, injury, hard training, excess body fat and smoking.'],
    hcy: ['An amino acid made when your body processes methionine.', 'Every cell; cleared with folate, B12 and B6', 'B vitamins, kidney function and genes.'],
    tt: ['The main male sex hormone, mostly bound to carrier proteins in blood.', 'Testes (and ovaries and adrenals)', 'Time of day, sleep, body fat and age.'],
    ft: ['The unbound share of testosterone that can enter cells, about 2%.', 'Calculated or measured from total', 'Carrier protein (SHBG) levels.'],
    cort: ['The main stress hormone.', 'Adrenal glands', 'Time of draw, stress, sleep loss and illness.'],
    tsh: ['The pituitary\'s signal to the thyroid; it rises when thyroid hormone runs low.', 'Pituitary gland', 'Thyroid output.'],
    ft3: ['The active thyroid hormone.', 'Thyroid, and from T4 in your tissues', 'Illness and very low calorie intake lower it.'],
    vitd: ['The storage form of vitamin D.', 'Skin (from sunlight), food, then the liver', 'Sun exposure, skin tone, season and intake.'],
    ferr: ['The protein that stores iron; low means low iron stores. It also rises with inflammation.', 'Liver and immune cells', 'Iron intake, blood loss and inflammation.'],
    b12: ['A vitamin needed to make DNA and keep nerves healthy.', 'Food, absorbed in the gut with intrinsic factor', 'Vegan diets, some medicines and gut absorption.'],
    mg: ['Magnesium inside red cells; a helper for over 300 enzymes, including ATP reactions.', 'Food; kidneys balance it', 'Intake, sweat losses and some medicines.'],
    o3: ['EPA and DHA as a share of red-cell membrane fat: about 3 months of intake.', 'Food (fish, algae)', 'How much omega-3 you eat.'],
    alt: ['An enzyme that leaks when liver cells are stressed.', 'Liver (some in muscle)', 'Fatty liver, alcohol, some medicines and hard training.'],
    egfr: ['An estimate of how much blood your kidneys filter each minute.', 'Calculated from creatinine, age and sex', 'Hydration and muscle mass; very muscular people can read lower.'],
    hgb: ['The oxygen-carrying protein in red blood cells.', 'Bone marrow, with iron, B12 and folate', 'Iron, blood loss, altitude and kidney signals (EPO).'],
    ck: ['A muscle enzyme that leaks after hard or new training. Very high levels with dark urine and weakness need urgent care.', 'Muscle', 'Training, injury and some medicines.']
  };
  const STEPS = [0, 1, 3, 7, 21];   // days until the next review for boxes 1 to 4; a right answer in box 4 retires it
  const PASS = 0.66;
  const LE = { tab: 'units', open: null, res: null, rev: null, scan: { st: 'idle', msg: '', pct: 0, result: null, unit: 'cells', url: '' } };
  const L = (s) => { if (!s.learn) s.learn = { units: {}, cards: {} }; s.learn.units = s.learn.units || {}; s.learn.cards = s.learn.cards || {}; return s.learn; };
  const unit = (id) => UNITS.find((u) => u[0] === id);

  // the labs unit is written from the member's own markers
  function labsUnit(s) {
    const have = s.markers.filter((m) => LABS[m.id] && OS.hasValue(m));
    const ev = (m) => { try { return OS.markerEval(m).status; } catch { return 'muted'; } };
    // three markers to quiz on: anything flagged first, then one per body system for variety
    const rank = (m) => ({ bad: 0, warn: 1 }[ev(m)] ?? 2), seen = new Set(), pick = [];
    have.slice().sort((a, b) => rank(a) - rank(b)).forEach((m) => { if (pick.length < 3 && !seen.has(m.system)) { seen.add(m.system); pick.push(m); } });
    const first = (id) => LABS[id][0].split(/(?<=\.)\s/)[0];
    const qs = pick.map((m) => {
      const seed = [...m.id].reduce((a, c) => a + c.charCodeAt(0), 0), pool = Object.keys(LABS).filter((k) => k !== m.id && !pick.some((p) => p.id === k));
      const opts = [first(m.id)]; for (let i = 0; opts.length < 4 && i < pool.length * 2; i++) { const o = first(pool[(seed * (i + 3)) % pool.length]); if (!opts.includes(o)) opts.push(o); }
      const rot = seed % opts.length, o = opts.slice(rot).concat(opts.slice(0, rot));
      return [`What does your ${m.name} measure?`, o, o.indexOf(first(m.id)), `${m.name}: ${LABS[m.id][0]} Made or set by: ${LABS[m.id][1]}.`, `labs:${m.id}`];
    });
    return ['labs', 'Your labs explained', 'report', have.length ? `Written from your ${have.length} markers` : 'Add labs to personalise this unit',
      have.length ? have.map((m) => [`${m.name}: ${m.value} ${m.unit}`, `${LABS[m.id][0]} From: ${LABS[m.id][1]}. Moved by: ${LABS[m.id][2]}`, ev(m)]) : [['No lab values yet', 'Import or type your labs on the Biology page, and this unit explains each one.']],
      ['biology', 'biochem'], qs];
  }
  const allUnits = (s) => UNITS.concat([labsUnit(s)]);
  const qid = (u, i, q) => (q && q[4]) || `${u[0]}:${i}`;
  function question(s, id) {
    if (id.startsWith('labs:')) { const lu = labsUnit(s); return lu[6].find((q) => q[4] === id) || null; }
    const [u, i] = id.split(':'), x = unit(u); return x ? x[6][+i] || null : null;
  }
  const dueCards = (s) => { const t = dayKey(new Date()), C = L(s).cards; return Object.keys(C).filter((k) => C[k].due <= t && question(s, k)); };

  /* ── view: units ── */
  function unitsTab(s) {
    const P = L(s).units, U = allUnits(s), done = U.filter((u) => P[u[0]] && P[u[0]].best >= PASS).length, due = dueCards(s).length;
    return `<section class="card le-sum"><div class="le-prog"><b class="num">${done}<small>/${U.length}</small></b><span>units complete</span></div>
        <div class="le-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${U.length}" aria-valuenow="${done}" aria-label="Units complete"><i style="width:${Math.round((done / U.length) * 100)}%"></i></div>
        <p class="small">${due ? `${due} question${due === 1 ? '' : 's'} to review today. <button class="link" data-act="le-tab" data-t="review">Review now</button>` : 'Missed questions come back here on a schedule: tomorrow, then 3, 7 and 21 days later.'}</p></section>
      <div class="le-grid">${U.map((u, i) => { const p = P[u[0]], st = p ? (p.best >= PASS ? ['good', `Done · ${Math.round(p.best * 100)}%`] : ['warn', `Best ${Math.round(p.best * 100)}%`]) : ['muted', 'New']; return `<button class="le-unit" data-act="le-open" data-u="${u[0]}"><span class="le-n num">${String(i + 1).padStart(2, '0')}</span><span class="le-ic">${icon(u[2], 20)}</span><b>${esc(u[1])}</b><span class="muted small">${esc(u[3])}</span>${pill(...st)}</button>`; }).join('')}</div>`;
  }
  function unitView(s, id) {
    const U = id === 'labs' ? labsUnit(s) : unit(id); if (!U) return unitsTab(s);
    const [, t, ic, sum, pts, go, qs] = U, R = LE.res && LE.res.u === id ? LE.res : null;
    const links = go.filter((n) => OS.views[n] && (!OS.canSee || OS.canSee(n)));
    return `<button class="link small le-back" data-act="le-back">← All units</button>
      <section class="card le-lesson"><div class="card-h"><h2>${icon(ic, 20)} ${esc(t)}</h2><span class="muted small">${esc(sum)}</span></div>
        <ol class="le-pts">${pts.map(([h, x, st]) => `<li${st ? ` class="st-${esc(st)}"` : ''}><b>${esc(h)}</b><p class="small">${esc(x)}</p></li>`).join('')}</ol>
        ${links.length ? `<p class="small">See it in Myo: ${links.map((n) => `<a href="#${n}">${esc(OS.views[n].title)}</a>`).join(' · ')}</p>` : ''}</section>
      ${qs.length ? `<section class="card le-quiz"><div class="card-h"><h2>Check yourself</h2><span class="muted small">${qs.length} questions${R ? ` · ${R.right} of ${qs.length} right` : ''}</span></div>
        <form data-submit="le-quiz" data-u="${id}">${qs.map((q, i) => { const pick = R ? R.picks[i] : null; return `<fieldset class="le-q ${R ? (pick === q[2] ? 'ok' : 'no') : ''}"><legend>${i + 1}. ${esc(q[0])}</legend>${q[1].map((o, j) => `<label class="le-o ${R && j === q[2] ? 'right' : ''}"><input type="radio" name="q${i}" value="${j}" ${pick === j ? 'checked' : ''} ${R ? 'disabled' : ''} required> ${esc(o)}</label>`).join('')}${R ? `<p class="small le-why">${pick === q[2] ? '✓' : '✗'} ${esc(q[3])}</p>` : ''}</fieldset>`; }).join('')}
          <div class="row">${R ? `<button type="button" class="btn ghost" data-act="le-retry" data-u="${id}">Try again</button>${R.right < qs.length ? `<span class="small muted">Missed questions are in Review from tomorrow.</span>` : ''}` : '<button class="btn">Check answers</button>'}</div></form></section>` : ''}`;
  }
  /* ── view: review ── */
  function reviewTab(s) {
    const due = dueCards(s), C = L(s).cards, waiting = Object.keys(C).length - due.length;
    if (LE.rev) {
      const q = question(s, LE.rev.id); if (!q) { LE.rev = null; return reviewTab(s); }
      const ok = LE.rev.pick === q[2];
      return `<section class="card le-quiz"><div class="card-h"><h2>Review</h2><span class="muted small">${ok ? 'Moves to a longer gap' : 'Comes back tomorrow'}</span></div>
        <fieldset class="le-q ${ok ? 'ok' : 'no'}"><legend>${esc(q[0])}</legend>${q[1].map((o, j) => `<div class="le-o ${j === q[2] ? 'right' : ''} ${j === LE.rev.pick && !ok ? 'wrong' : ''}">${esc(o)}</div>`).join('')}<p class="small le-why">${ok ? '✓' : '✗'} ${esc(q[3])}</p></fieldset>
        <div class="row"><button class="btn" data-act="le-next">Next</button></div></section>`;
    }
    if (!due.length) return `<section class="card"><div class="card-h"><h2>Review</h2></div><p class="small">${waiting ? `Nothing due today. ${waiting} question${waiting === 1 ? '' : 's'} waiting for a later day.` : 'Nothing to review. Questions you miss in a unit come back here.'}</p></section>`;
    const id = due[0], q = question(s, id), box = C[id].box;
    return `<section class="card le-quiz"><div class="card-h"><h2>Review</h2><span class="muted small">${due.length} due · box ${box} of 4</span></div>
      <fieldset class="le-q"><legend>${esc(q[0])}</legend><div class="le-opts">${q[1].map((o, j) => `<button class="le-o le-ob" data-act="le-rev" data-id="${esc(id)}" data-i="${j}">${esc(o)}</button>`).join('')}</div></fieldset></section>`;
  }

  /* ── view: lesson attention (admins) ── */
  const SCAN_KEY = 'myo-lesson-scans';
  const loadScans = () => { try { return JSON.parse(localStorage.getItem(SCAN_KEY) || '[]'); } catch { return []; } };
  const saveScan = (x) => { try { localStorage.setItem(SCAN_KEY, JSON.stringify([x].concat(loadScans()).slice(0, 10))); } catch { /* memory only */ } };
  // an example readout for a 90-second lesson, so the tab explains itself before the server is set up
  function example() {
    const n = 90, A = [], M = [], E = [];
    for (let t = 0; t < n; t++) {
      const dip1 = Math.exp(-((t - 16) ** 2) / 8) * 0.32, dip2 = Math.exp(-((t - 64) ** 2) / 14) * 0.27, lift = Math.exp(-((t - 41) ** 2) / 10) * 0.12;
      A.push(+(0.84 - t * 0.0018 - dip1 - dip2 + lift + 0.025 * Math.sin(t * 1.7)).toFixed(3));
      M.push(+(0.42 + Math.exp(-((t - 41) ** 2) / 6) * 0.38 + Math.exp(-((t - 82) ** 2) / 8) * 0.3 + 0.02 * Math.cos(t)).toFixed(3));
      E.push(+(0.35 + Math.exp(-((t - 55) ** 2) / 30) * 0.45 + 0.02 * Math.sin(t * 0.9)).toFixed(3));
    }
    return { score: 68, grade: 'B-', attention: A, memory: M, effort: E };
  }
  function analyse(r) {
    const A = r.attention || [], n = A.length; if (!n) return { dips: [], dense: [], peaks: [] };
    const sm = (X) => X.map((_, i) => { const w = X.slice(Math.max(0, i - 1), i + 2); return w.reduce((a, b) => a + b, 0) / w.length; });
    const a = sm(A), mean = a.reduce((x, y) => x + y, 0) / n, sd = Math.sqrt(a.reduce((x, y) => x + (y - mean) ** 2, 0) / n), cut = Math.min(0.6, mean - 0.75 * sd);
    const runs = (X, test, min) => { const out = []; let st = -1; X.forEach((v, i) => { if (test(v) && st < 0) st = i; if ((!test(v) || i === X.length - 1) && st >= 0) { const end = test(v) ? i : i - 1; if (end - st + 1 >= min) out.push([st, end, Math.min(...X.slice(st, end + 1))]); st = -1; } }); return out; };
    const dips = runs(a, (v) => v < cut, 3);
    const dense = r.effort ? runs(sm(r.effort), (v) => v > 0.7, 4) : [];
    const M = r.memory || [], peaks = M.map((v, i) => [i, v]).filter(([i, v]) => v >= (M[i - 1] ?? -1) && v >= (M[i + 1] ?? -1) && v > 0.6).sort((x, y) => y[1] - x[1]).slice(0, 3).sort((x, y) => x[0] - y[0]);
    return { dips, dense, peaks, mean, cut };
  }
  const mmss = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  const SER = [['attention', 'Attention', 'bc-l1'], ['memory', 'Memory', 'bc-l2'], ['effort', 'Effort', 'bc-l3']];
  function chart(r, an) {
    const n = (r.attention || []).length; if (n < 2) return '';
    const W = 640, H = 200, P = { l: 34, r: 10, t: 10, b: 24 }, x = (i) => P.l + (i / (n - 1)) * (W - P.l - P.r), y = (v) => P.t + (1 - Math.max(0, Math.min(1, v))) * (H - P.t - P.b);
    const line = (X) => X.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
    const ticks = []; for (let t = 0; t < n; t += n > 120 ? 30 : 15) ticks.push(t);
    return `<figure class="le-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Predicted attention, memory and effort over ${n} seconds" data-n="${n}">
        ${an.dips.map(([a, b]) => `<rect class="le-dip" x="${x(a)}" y="${P.t}" width="${Math.max(2, x(b) - x(a))}" height="${H - P.t - P.b}"/>`).join('')}
        ${[0, 0.25, 0.5, 0.75, 1].map((v) => `<line class="le-gl" x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}"/><text class="le-ax" x="${P.l - 6}" y="${y(v) + 3}" text-anchor="end">${v}</text>`).join('')}
        ${ticks.map((t) => `<text class="le-ax" x="${x(t)}" y="${H - 6}" text-anchor="middle">${mmss(t)}</text>`).join('')}
        ${SER.filter(([k]) => r[k] && r[k].length).map(([k, , c]) => `<path class="le-ln ${c}" d="${line(r[k])}"/>`).join('')}
        <line class="le-x" x1="0" x2="0" y1="${P.t}" y2="${H - P.b}" hidden/><rect class="le-hit" x="${P.l}" y="0" width="${W - P.l - P.r}" height="${H}"/></svg>
      <div class="le-tip" hidden></div>
      <figcaption class="le-key">${SER.filter(([k]) => r[k] && r[k].length).map(([, l, c]) => `<span><i class="${c}"></i>${l}</span>`).join('')}<span><i class="le-dipkey"></i>Attention dip</span></figcaption></figure>`;
  }
  function readout(r, label) {
    const an = analyse(r);
    return `<section class="card"><div class="card-h"><h2>${esc(label)}</h2><span class="row">${r.grade ? pill('muted', `Grade ${esc(r.grade)}`) : ''}${r.score != null ? `<span class="hstat"><span>Score</span><b class="num">${esc(r.score)}</b></span>` : ''}</span></div>
      ${chart(r, an)}
      <div class="grid g-3 le-find">
        <div><h3>Where it loses people</h3>${an.dips.length ? `<ul class="small">${an.dips.map(([a, b, m]) => `<li><b>${mmss(a)}–${mmss(b + 1)}</b>: attention falls to ${Math.round(m * 100)}%. Tighten it, add a visual, or move the point.</li>`).join('')}</ul>` : '<p class="small">No sustained dips.</p>'}</div>
        <div><h3>Dense stretches</h3>${an.dense.length ? `<ul class="small">${an.dense.map(([a, b]) => `<li><b>${mmss(a)}–${mmss(b + 1)}</b>: high effort. Slow down or split it in two.</li>`).join('')}</ul>` : '<p class="small">Effort stays manageable.</p>'}</div>
        <div><h3>Most memorable moments</h3>${an.peaks.length ? `<ul class="small">${an.peaks.map(([t]) => `<li><b>${mmss(t)}</b>: put the unit's key point here.</li>`).join('')}</ul>` : '<p class="small">No clear peaks.</p>'}</div>
      </div>
      <p class="fine">Predicted responses for an average viewer, from a model trained on brain scans (fMRI). They guide edits; they are not measurements of anyone watching.</p></section>`;
  }
  function attnTab() {
    const S = LE.scan, saved = loadScans(), base = scanBase(), live = !!(base && OS.auth && OS.auth.user && OS.roles && OS.roles.source === 'account');
    const why = !base ? 'The content-scan function is not set up for this project.' : !(OS.auth && OS.auth.user) ? 'Sign in with your admin account on Myo\'s web address.' : OS.roles.source !== 'account' ? 'Your admin role here comes from this device or from Claude; the server needs your account\'s admin role.' : '';
    return `<section class="card"><div class="card-h"><h2>Lesson attention test</h2><span class="row">${pill('muted', 'Admins only')}${live ? pill('good', 'Live') : pill('muted', 'Example')}</span></div>
        <p class="small">Tests Myo's own lesson videos with Sapient's neural response prediction: second by second, how strongly a typical viewer is predicted to pay attention, remember, and work to follow. Use it to find where a lesson loses people before members watch it.</p>
        <form data-submit="le-scan" class="form-grid" autocomplete="off">
          <label class="field" for="le-unit"><span>Lesson</span><select id="le-unit" name="unit">${UNITS.map((u) => `<option value="${u[0]}" ${S.unit === u[0] ? 'selected' : ''}>${esc(u[1])}</option>`).join('')}</select></label>
          <label class="field" for="le-url"><span>Public video address (https)</span><input id="le-url" name="url" type="url" inputmode="url" spellcheck="false" placeholder="https://lessons.your-domain.example/cells.mp4" value="${esc(S.url)}"></label>
          <div class="form-end"><button class="btn" ${S.st === 'busy' ? 'disabled' : ''}>${S.st === 'busy' ? `Scanning ${S.pct ? `${S.pct}%` : '…'}` : live ? 'Run the test' : 'Show the example'}</button></div></form>
        ${S.msg ? `<p class="small ${S.st === 'error' ? 'acct-err' : 'muted'}" role="status">${esc(S.msg)}</p>` : ''}
        ${live ? '' : `<p class="fine">${esc(why)} Until then this tab shows an example readout. Set-up: deploy supabase/functions/content-scan with your SAPIENT_API_KEY and CONTENT_SCAN_HOSTS (supabase/CONTENT_SCAN.md).</p>`}
        <div class="banner" role="note"><strong>What Myo doesn't use.</strong> No face or beauty ratings. Never members' photos, faces, voices or video. No purchase-intent ("buy moment") or persuasion scoring: the server drops those fields and keeps attention, memory and effort only. Myo is not affiliated with Sapient.</div></section>
      ${readout(S.result || example(), S.result ? `${(unit(S.unit) || [, 'Lesson'])[1]}: your result` : 'Example readout: a 90-second lesson')}
      ${saved.length ? `<section class="card"><div class="card-h"><h2>Earlier tests on this device</h2></div><ul class="cx-log">${saved.map((x, i) => `<li><div><b>${esc((unit(x.unit) || [, x.unit])[1])}</b><span class="muted small block">${esc(fmtDate(x.at.slice(0, 10)))} · ${esc(new URL(x.url).hostname)}</span></div><span class="row">${x.result.grade ? pill('muted', esc(x.result.grade)) : ''}<button class="link small" data-act="le-show" data-i="${i}">Show</button></span></li>`).join('')}</ul></section>` : ''}`;
  }
  const scanBase = () => { const c = window.MYO_CONFIG || {}; return (c.contentScan || (OS.auth && OS.auth.url ? `${OS.auth.url}/functions/v1/content-scan` : '')).replace(/\/$/, ''); };
  const isAdmin = () => !!(OS.roles && OS.roles.can('lesson-attention') && OS.roles.status === 'ready');

  OS.register('learn', {
    title: 'Learn biology', icon: 'learn',
    render(s) {
      if (LE.tab === 'attn' && !isAdmin()) LE.tab = 'units';
      const due = dueCards(s).length;
      const TABS = [['units', 'Units'], ['review', `Review${due ? ` (${due})` : ''}`]].concat(isAdmin() ? [['attn', 'Lesson attention']] : []);
      const body = LE.tab === 'review' ? reviewTab(s) : LE.tab === 'attn' ? attnTab() : LE.open ? unitView(s, LE.open) : unitsTab(s);
      return `${OS.ui.head('Molecules to the whole body', 'Learn biology', 'Twelve short units on how your body works, each with a quick check. The last one explains your own labs.')}
        <div class="le bc fl"><div class="seg kt-tabs" role="tablist" aria-label="Learn biology">${TABS.map(([k, l]) => `<button role="tab" aria-selected="${LE.tab === k}" data-act="le-tab" data-t="${k}">${l}</button>`).join('')}</div>${body}</div>`;
    },
    mount(root) {
      const svg = root.querySelector('.le-chart svg'); if (!svg) return;
      const fig = svg.closest('figure'), tip = fig.querySelector('.le-tip'), xl = svg.querySelector('.le-x'), hit = svg.querySelector('.le-hit'), n = +svg.dataset.n;
      const r = LE.scan.result || example();
      const move = (e) => {
        const b = svg.getBoundingClientRect(), vx = ((e.clientX - b.left) / b.width) * 640, i = Math.round(((vx - 34) / (640 - 44)) * (n - 1));
        if (i < 0 || i >= n) return leave();
        const px = 34 + (i / (n - 1)) * (640 - 44); xl.setAttribute('x1', px); xl.setAttribute('x2', px); xl.hidden = false;
        tip.innerHTML = `<b>${mmss(i)}</b>${SER.filter(([k]) => r[k] && r[k][i] != null).map(([k, l, c]) => `<span><i class="${c}"></i>${l} ${Math.round(r[k][i] * 100)}%</span>`).join('')}`;
        tip.hidden = false; const fx = (px / 640) * b.width; tip.style.left = `${Math.min(b.width - 140, Math.max(0, fx + 10))}px`;
      };
      const leave = () => { tip.hidden = true; xl.hidden = true; };
      hit.addEventListener('pointermove', move); hit.addEventListener('pointerleave', leave);
    }
  });

  OS.act('le-tab', (el) => { LE.tab = el.dataset.t; LE.rev = null; if (LE.tab === 'units') LE.open = null; OS.render(); });
  OS.act('le-open', (el) => { LE.open = el.dataset.u; LE.res = null; OS.render(); document.getElementById('main').scrollTop = 0; });
  OS.act('le-back', () => { LE.open = null; LE.res = null; OS.render(); });
  OS.act('le-retry', () => { LE.res = null; OS.render(); });
  OS.act('le-quiz', (f) => {
    const id = f.dataset.u, U = id === 'labs' ? labsUnit(OS.state) : unit(id); if (!U) return;
    const qs = U[6], picks = qs.map((_, i) => { const el = f.querySelector(`input[name="q${i}"]:checked`); return el ? +el.value : -1; });
    if (picks.some((p) => p < 0)) { OS.toast('Answer every question first'); return; }
    const right = picks.filter((p, i) => p === qs[i][2]).length, score = right / qs.length, tomorrow = dayKey(addDays(new Date(), 1));
    LE.res = { u: id, picks, right };
    OS.update((s) => {
      const P = L(s), was = P.units[id];
      P.units[id] = { best: Math.max(score, was ? was.best : 0), last: score, at: dayKey(new Date()), n: (was ? was.n : 0) + 1 };
      qs.forEach((q, i) => { const k = qid(U, i, q); if (picks[i] !== q[2]) P.cards[k] = { box: 1, due: tomorrow }; });
    }, { keepSample: true });
    if (score >= PASS && !(OS.state.learn.units[id].n > 1)) OS.logEvent('note', `Learned: ${U[1]}`, `${right} of ${qs.length} right`, { route: 'learn' });
  });
  OS.act('le-rev', (el) => {
    const id = el.dataset.id, q = question(OS.state, id); if (!q) return;
    const pick = +el.dataset.i, ok = pick === q[2];
    OS.update((s) => { const C = L(s).cards, c = C[id] || { box: 1 }; if (ok) { if (c.box >= 4) delete C[id]; else C[id] = { box: c.box + 1, due: dayKey(addDays(new Date(), STEPS[c.box + 1])) }; } else C[id] = { box: 1, due: dayKey(addDays(new Date(), 1)) }; }, { keepSample: true, render: false });
    LE.rev = { id, pick }; OS.render();
  });
  OS.act('le-next', () => { LE.rev = null; OS.render(); });
  OS.act('le-show', (el) => { const x = loadScans()[+el.dataset.i]; if (x) { LE.scan = { ...LE.scan, unit: x.unit, url: x.url, result: x.result, st: 'idle', msg: `Saved result from ${fmtDate(x.at.slice(0, 10))}` }; OS.render(); } });

  // the live test: start a scan through content-scan, then poll until it finishes (up to 5 minutes)
  OS.act('le-scan', async (f) => {
    if (!isAdmin()) return;
    const S = LE.scan, url = f.elements.url.value.trim(), u = f.elements.unit.value, base = scanBase();
    S.unit = u; S.url = url;
    const live = !!(base && OS.auth && OS.auth.user && OS.roles.source === 'account');
    if (!live) { S.result = null; S.st = 'idle'; S.msg = 'Showing the example readout. The live test needs the content-scan function and an admin account sign-in.'; OS.render(); return; }
    if (!/^https:\/\/[^\s]+$/.test(url)) { S.st = 'error'; S.msg = 'Enter the https address of the lesson video.'; OS.render(); return; }
    const call = async (method, path, body) => {
      const token = await OS.auth.token(); if (!token) throw new Error('Your session has expired. Sign in again.');
      let res; try { res = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); }
      catch { throw new Error("Couldn't reach the lesson attention test. It may not be deployed yet."); }
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j.error && j.error.message) || `The test answered ${res.status}.`);
      return j;
    };
    S.st = 'busy'; S.pct = 0; S.msg = 'Sending the video address…'; S.result = null; OS.render();
    try {
      const { id } = await call('POST', '/v1/scans', { video_url: url });
      for (let i = 0; i < 100; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const j = await call('GET', `/v1/scans/${encodeURIComponent(id)}`);
        S.pct = j.pct || S.pct; S.msg = `Scanning (${j.status})…`;
        if (j.result) { S.result = j.result; S.st = 'idle'; S.msg = 'Done.'; saveScan({ at: new Date().toISOString(), unit: u, url, result: j.result }); break; }
        if (/fail|error/i.test(j.status)) throw new Error('Sapient could not scan that video.');
        if (OS.current === 'learn') OS.render();
      }
      if (S.st === 'busy') { S.st = 'error'; S.msg = 'The scan is taking longer than 5 minutes. Try again later.'; }
    } catch (e) { S.st = 'error'; S.msg = e.message; }
    if (OS.current === 'learn') OS.render();
  });

  OS.learn = {
    UNITS, LABS, labsUnit, analyse, example, dueCards,
    status(s) { const P = L(s).units, d = UNITS.concat([labsUnit(s)]).filter((u) => P[u[0]] && P[u[0]].best >= PASS).length, r = dueCards(s).length; return r ? [`${r} to review today`, 'warn'] : d ? [`${d} of ${UNITS.length + 1} units done`, 'good'] : ['Twelve units, molecules to body', 'muted']; }
  };
})();
