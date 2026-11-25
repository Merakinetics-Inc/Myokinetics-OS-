/* ═══ MYO — KITCHEN: track food, cook, plan the week, log supplements, connect meal-prep partners ═══
   Food data: Open Food Facts (open database, crowd-sourced; search at search.openfoodfacts.org, nutrients per 100 g from
   world.openfoodfacts.org/api/v2/product). Only the search words or the barcode are sent; nothing about the member.
   Recipes are Myo's own, with macros per serving worked out from standard food tables (approximate).
   Meal-prep companies post meals to the Ingest API (POST /v1/meals, scope meals:write); they land in Fuel like any meal. */
(function () {
  'use strict';
  const { esc, icon, dayKey, addDays, targets, pill, uid, clamp } = OS;
  const TABS = [['track', 'Track'], ['recipes', 'Recipes'], ['plan', 'Week plan'], ['supps', 'Supplements'], ['partners', 'Meal-prep partners'], ['guide', 'How to track']];
  const SLOTS = [['b', 'Breakfast'], ['l', 'Lunch'], ['d', 'Dinner'], ['s', 'Snack']];
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const K = { tab: 'track', q: '', hits: null, busy: false, err: '', pick: null, grams: 100, cook: null, step: 0, timer: null, scan: null };

  // ingredient: [name, qty, unit, aisle]; step: [text, timer seconds or 0]
  const RECIPES = [
    { id: 'oats', name: 'Overnight protein oats', serves: 1, min: 5, tags: ['Breakfast', 'Make ahead'], kcal: 550, p: 52, c: 61, f: 11,
      ing: [['Rolled oats', 50, 'g', 'Pantry'], ['Greek yogurt, 0%', 150, 'g', 'Dairy'], ['Whey protein', 30, 'g', 'Pantry'], ['Milk, 2%', 120, 'ml', 'Dairy'], ['Mixed berries', 80, 'g', 'Produce'], ['Chia seeds', 10, 'g', 'Pantry']],
      steps: [['Stir the oats, whey, chia and milk together in a jar until no powder is left.', 0], ['Fold in the yogurt, cover and refrigerate overnight, or at least 4 hours.', 0], ['Top with the berries in the morning. Eat cold.', 0]] },
    { id: 'sheetpan', name: 'Sheet-pan chicken, sweet potato and broccoli', serves: 2, min: 40, tags: ['Dinner', 'High protein'], kcal: 613, p: 69, c: 50, f: 14,
      ing: [['Chicken breast', 400, 'g', 'Protein'], ['Sweet potato', 400, 'g', 'Produce'], ['Broccoli', 300, 'g', 'Produce'], ['Olive oil', 15, 'ml', 'Pantry'], ['Paprika, garlic powder, salt', 1, 'pinch', 'Pantry']],
      steps: [['Heat the oven to 220 °C (425 °F).', 600], ['Cut the sweet potato into 2 cm cubes and the chicken into chunks. Toss with the oil and spices on a lined tray.', 0], ['Roast for 15 minutes.', 900], ['Add the broccoli, turn everything and roast 10 more minutes, until the chicken reaches 74 °C (165 °F) inside.', 600], ['Rest 3 minutes, then split into two portions.', 180]] },
    { id: 'salmon', name: 'Salmon, rice and greens bowl', serves: 1, min: 25, tags: ['Lunch', 'Omega-3'], kcal: 590, p: 36, c: 55, f: 21,
      ing: [['Salmon fillet', 150, 'g', 'Protein'], ['Rice, uncooked', 60, 'g', 'Pantry'], ['Baby spinach', 60, 'g', 'Produce'], ['Cucumber', 80, 'g', 'Produce'], ['Soy sauce, ginger, lime', 1, 'splash', 'Pantry']],
      steps: [['Rinse the rice and simmer it in 120 ml water, covered.', 900], ['Meanwhile bake the salmon at 200 °C (400 °F).', 720], ['Slice the cucumber and mix soy sauce, grated ginger and lime for the dressing.', 0], ['Build the bowl: rice, spinach, cucumber, salmon, dressing.', 0]] },
    { id: 'chili', name: 'Turkey and bean chili', serves: 4, min: 45, tags: ['Dinner', 'Batch cook'], kcal: 450, p: 38, c: 45, f: 13,
      ing: [['Lean ground turkey', 500, 'g', 'Protein'], ['Kidney beans, drained', 480, 'g', 'Pantry'], ['Crushed tomatoes', 800, 'g', 'Pantry'], ['Onion', 150, 'g', 'Produce'], ['Bell peppers', 200, 'g', 'Produce'], ['Olive oil', 10, 'ml', 'Pantry'], ['Chili powder, cumin, salt', 1, 'pinch', 'Pantry']],
      steps: [['Brown the turkey in the oil over medium-high heat, breaking it up.', 480], ['Add the chopped onion, peppers and spices; cook until soft.', 300], ['Add the tomatoes and beans, bring to a simmer and cook, stirring now and then.', 1500], ['Portion into four containers. Keeps 4 days in the fridge or 3 months frozen.', 0]] },
    { id: 'scramble', name: 'Egg and vegetable scramble with toast', serves: 1, min: 12, tags: ['Breakfast', 'Quick'], kcal: 480, p: 38, c: 42, f: 18,
      ing: [['Eggs', 3, '', 'Dairy'], ['Egg whites', 100, 'g', 'Dairy'], ['Spinach', 50, 'g', 'Produce'], ['Bell pepper', 50, 'g', 'Produce'], ['Wholegrain bread', 2, 'slices', 'Pantry']],
      steps: [['Soften the pepper and spinach in a non-stick pan for 2 minutes.', 120], ['Whisk the eggs and whites, pour in and stir gently until just set.', 180], ['Serve with the toast.', 0]] },
    { id: 'yogurt', name: 'Greek yogurt power bowl', serves: 1, min: 3, tags: ['Snack', 'No cook'], kcal: 565, p: 31, c: 72, f: 19,
      ing: [['Greek yogurt, 2%', 250, 'g', 'Dairy'], ['Granola', 40, 'g', 'Pantry'], ['Banana', 1, '', 'Produce'], ['Honey', 10, 'g', 'Pantry'], ['Walnuts', 10, 'g', 'Pantry']],
      steps: [['Spoon the yogurt into a bowl.', 0], ['Top with sliced banana, granola, walnuts and a drizzle of honey.', 0]] },
    { id: 'lentil', name: 'Lentil and quinoa salad with feta', serves: 2, min: 25, tags: ['Lunch', 'Vegetarian'], kcal: 540, p: 24, c: 63, f: 19,
      ing: [['Lentils, uncooked', 100, 'g', 'Pantry'], ['Quinoa, uncooked', 100, 'g', 'Pantry'], ['Feta', 60, 'g', 'Dairy'], ['Tomatoes and cucumber', 300, 'g', 'Produce'], ['Olive oil', 20, 'ml', 'Pantry'], ['Lemon', 1, '', 'Produce']],
      steps: [['Simmer the lentils in plenty of water until tender.', 1200], ['Cook the quinoa in 200 ml water, covered, then let it steam off the heat.', 900], ['Chop the vegetables; whisk the oil with lemon juice and salt.', 0], ['Toss everything with the feta. Split into two portions.', 0]] },
    { id: 'shake', name: 'Post-training recovery shake', serves: 1, min: 3, tags: ['Snack', 'After training'], kcal: 620, p: 50, c: 68, f: 18,
      ing: [['Whey protein', 40, 'g', 'Pantry'], ['Banana', 1, '', 'Produce'], ['Rolled oats', 30, 'g', 'Pantry'], ['Milk, 2%', 300, 'ml', 'Dairy'], ['Peanut butter', 15, 'g', 'Pantry']],
      steps: [['Blend everything for 30 seconds.', 30], ['Drink within an hour after training.', 0]] }
  ];
  const R_BY = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

  function ensure(s) {
    if (!s.kitchen) s.kitchen = { plan: {}, supps: [], suppLog: {} };
    const k = s.kitchen; k.plan = k.plan || {}; k.supps = k.supps || []; k.suppLog = k.suppLog || {};
    return k;
  }
  const today = () => dayKey();
  const sum = (ms) => ms.reduce((a, m) => ({ kcal: a.kcal + (+m.kcal || 0), p: a.p + (+m.p || 0), c: a.c + (+m.c || 0), f: a.f + (+m.f || 0) }), { kcal: 0, p: 0, c: 0, f: 0 });
  const r1 = (v) => Math.round(v * 10) / 10;
  const bar = (label, v, t, unit) => { const pct = t ? clamp((v / t) * 100, 0, 130) : 0; return `<div class="kt-bar"><div class="kt-bar-h"><span>${label}</span><b class="num">${Math.round(v)} / ${t} ${unit}</b></div><span class="sbar-track"><span style="width:${Math.min(100, pct).toFixed(0)}%" class="${pct > 110 ? 'over' : ''}"></span></span></div>`; };
  const logMeal = (m) => OS.update((s) => { const k = today(); (s.nutrition.meals[k] = s.nutrition.meals[k] || []).push({ id: uid(), ...m }); });

  /* ── tabs ── */
  function track(s) {
    const ms = s.nutrition.meals[today()] || [], tot = sum(ms), tg = targets(s.profile);
    const hits = K.hits == null ? '' : K.hits.length ? `<ul class="kt-hits">${K.hits.map((h, i) => `<li><button class="kt-hit" data-act="kit-pick" data-i="${i}"><b>${esc(h.name)}</b><span class="muted small">${esc(h.brand || '')}</span></button></li>`).join('')}</ul>` : '<p class="muted small">Nothing found. Try fewer words, or the barcode.</p>';
    const pick = K.pick ? (() => { const p = K.pick, g = K.grams || 100, m = (v) => (v == null ? null : r1(v * g / 100)); return `<div class="kt-pick"><div><b>${esc(p.name)}</b><span class="muted small block">${esc(p.brand || '')}${p.serving ? ` · serving ${esc(p.serving)}` : ''} · Open Food Facts</span></div>
        <label class="field" for="kt-g"><span>Amount (g or ml)</span><input id="kt-g" type="number" min="1" max="2000" value="${g}" data-change="kit-grams"></label>
        ${p.kcal == null ? '<p class="acct-err small">This product has no calorie data in Open Food Facts. Enter it by hand below.</p>' : `<p class="num small">${m(p.kcal)} kcal · ${m(p.p) ?? '—'} g protein · ${m(p.c) ?? '—'} g carbs · ${m(p.f) ?? '—'} g fat</p>`}
        <div class="row"><button class="btn sm" data-act="kit-add-pick" ${p.kcal == null ? 'disabled' : ''}>${icon('plus', 14)} Add to today</button><button class="btn ghost sm" data-act="kit-pick-x">Cancel</button></div></div>`; })() : '';
    return `<div class="grid g-2">
      <section class="card"><div class="card-h"><h2>Today</h2><span class="muted small">${ms.length} item${ms.length === 1 ? '' : 's'} logged</span></div>
        ${bar('Calories', tot.kcal, tg.kcal, 'kcal')}${bar('Protein', tot.p, tg.p, 'g')}${bar('Carbs', tot.c, tg.c, 'g')}${bar('Fat', tot.f, tg.f, 'g')}
        ${ms.length ? `<ul class="kt-log">${ms.map((m) => `<li><span><b>${esc(m.name)}</b><span class="muted small block num">${Math.round(m.kcal)} kcal · ${r1(m.p)} P · ${r1(m.c)} C · ${r1(m.f)} F${m.src && !['manual', 'off', 'recipe'].includes(m.src) ? ` · ${esc(m.src)}` : ''}</span></span><button class="icon-btn" data-act="kit-del" data-id="${esc(m.id)}" aria-label="Remove ${esc(m.name)}">${icon('x', 14)}</button></li>`).join('')}</ul>` : '<p class="muted small">Nothing logged yet today.</p>'}
      </section>
      <section class="card"><div class="card-h"><h2>Add food</h2><span class="muted small">Search, barcode or by hand</span></div>
        <form data-submit="kit-search" class="row kt-search"><label class="sr" for="kt-q">Search foods</label><input id="kt-q" name="q" type="search" placeholder="Search foods, e.g. Greek yogurt" value="${esc(K.q)}" autocomplete="off"><button class="btn" ${K.busy ? 'disabled' : ''}>${K.busy ? 'Searching…' : 'Search'}</button></form>
        <form data-submit="kit-code" class="row kt-search"><label class="sr" for="kt-code">Barcode</label><input id="kt-code" name="code" inputmode="numeric" placeholder="Barcode number" autocomplete="off">${'BarcodeDetector' in window ? `<button type="button" class="btn ghost" data-act="kit-scan">${K.scan ? 'Stop camera' : 'Scan'}</button>` : ''}<button class="btn ghost">Look up</button></form>
        ${K.scan ? '<video id="kt-video" class="kt-video" playsinline muted aria-label="Camera view for barcode scanning"></video>' : ''}
        ${K.err ? `<p class="acct-err small" role="alert">${esc(K.err)}</p>` : ''}${pick}${hits}
        <details class="kt-manual"><summary>Add by hand</summary>
          <form data-submit="kit-manual" class="form-grid">
            <label class="field" for="km-n"><span>Food</span><input id="km-n" name="n" required maxlength="80"></label>
            <label class="field" for="km-k"><span>Calories</span><input id="km-k" name="k" type="number" min="0" max="5000" required></label>
            <label class="field" for="km-p"><span>Protein (g)</span><input id="km-p" name="p" type="number" min="0" max="500" step="0.1"></label>
            <label class="field" for="km-c"><span>Carbs (g)</span><input id="km-c" name="c" type="number" min="0" max="500" step="0.1"></label>
            <label class="field" for="km-f"><span>Fat (g)</span><input id="km-f" name="f" type="number" min="0" max="500" step="0.1"></label>
            <div class="form-end"><button class="btn sm">Add</button></div></form></details>
        <p class="fine">Food data from <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener">Open Food Facts</a>, an open, crowd-sourced database: check labels for anything that matters. Only your search words or barcode are sent.</p>
      </section></div>`;
  }

  function recipes() {
    if (K.cook) {
      const r = R_BY[K.cook], st = r.steps[K.step], last = K.step >= r.steps.length - 1;
      return `<section class="card kt-cook" aria-label="Cook mode: ${esc(r.name)}"><div class="card-h"><h2>${esc(r.name)}</h2><span class="muted small">Step ${K.step + 1} of ${r.steps.length}</span></div>
        <ol class="kt-steps-mini">${r.steps.map((_, i) => `<li class="${i < K.step ? 'done' : i === K.step ? 'on' : ''}"></li>`).join('')}</ol>
        <p class="kt-step" aria-live="polite">${esc(st[0])}</p>
        ${st[1] ? `<div class="kt-timer"><b class="num" id="kt-clock">${K.timer && K.timer.step === K.step ? fmtT(K.timer.left) : fmtT(st[1])}</b><button class="btn ${K.timer && K.timer.step === K.step && K.timer.on ? 'ghost' : ''}" data-act="kit-timer">${K.timer && K.timer.step === K.step && K.timer.on ? 'Pause timer' : 'Start timer'}</button></div>` : ''}
        <div class="row"><button class="btn ghost" data-act="kit-step" data-d="-1" ${K.step === 0 ? 'disabled' : ''}>Back</button>${last ? `<button class="btn" data-act="kit-cooked" data-id="${r.id}">Done: log one serving</button>` : '<button class="btn" data-act="kit-step" data-d="1">Next step</button>'}<button class="btn ghost" data-act="kit-cook-x">Close</button></div>
        <details><summary class="small">Ingredients (${r.serves} serving${r.serves > 1 ? 's' : ''})</summary><ul class="kt-ing">${r.ing.map(([n, q, u]) => `<li><span class="num">${q} ${esc(u)}</span> ${esc(n)}</li>`).join('')}</ul></details>
      </section>`;
    }
    return `<div class="kt-recipes">${RECIPES.map((r) => `<article class="card kt-recipe"><div class="kt-rh"><h3>${esc(r.name)}</h3><span class="muted small">${r.min} min · serves ${r.serves}</span></div>
        <div class="chips">${r.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>
        <p class="num small kt-macro"><b>${r.kcal}</b> kcal · <b>${r.p}</b> g protein · ${r.c} g carbs · ${r.f} g fat <span class="muted">per serving</span></p>
        <details><summary class="small">Ingredients</summary><ul class="kt-ing">${r.ing.map(([n, q, u]) => `<li><span class="num">${q} ${esc(u)}</span> ${esc(n)}</li>`).join('')}</ul></details>
        <div class="row"><button class="btn sm" data-act="kit-cook" data-id="${r.id}">${icon('play', 14)} Cook step by step</button><button class="btn ghost sm" data-act="kit-log-recipe" data-id="${r.id}">Log a serving</button></div></article>`).join('')}</div>
      <p class="fine">Macros per serving are worked out from standard food tables and will vary with brands and portions.</p>`;
  }
  const fmtT = (sec) => `${Math.floor(sec / 60)}:${String(Math.max(0, sec % 60)).padStart(2, '0')}`;

  function plan(s) {
    const k = ensure(s), tg = targets(s.profile);
    const opts = (sel) => `<option value="">—</option>${RECIPES.map((r) => `<option value="${r.id}" ${sel === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}`;
    const dayTot = (d) => sum(SLOTS.map(([sl]) => R_BY[(k.plan[d] || {})[sl]]).filter(Boolean));
    // shopping list: every planned serving's share of its recipe, merged by ingredient and unit
    const need = {};
    DAYS.forEach((d) => SLOTS.forEach(([sl]) => { const r = R_BY[(k.plan[d] || {})[sl]]; if (!r) return; r.ing.forEach(([n, q, u, a]) => { const key = `${n}|${u}`; need[key] = need[key] || { n, u, a, q: 0 }; need[key].q += q / r.serves; }); }));
    const aisles = {}; Object.values(need).forEach((x) => { (aisles[x.a] = aisles[x.a] || []).push(x); });
    return `<section class="card"><div class="card-h"><h2>Week plan</h2><span class="muted small">Target ${tg.kcal} kcal and ${tg.p} g protein a day</span></div>
        <div class="tbl-wrap"><table class="tbl compact kt-plan"><thead><tr><th scope="col">Day</th>${SLOTS.map(([, l]) => `<th scope="col">${l}</th>`).join('')}<th scope="col">Total</th></tr></thead><tbody>
        ${DAYS.map((d) => { const t = dayTot(d); return `<tr><th scope="row">${d}</th>${SLOTS.map(([sl, l]) => `<td><label class="sr" for="kp-${d}-${sl}">${d} ${l}</label><select id="kp-${d}-${sl}" data-change="kit-plan" data-d="${d}" data-s="${sl}">${opts((k.plan[d] || {})[sl])}</select></td>`).join('')}<td class="num small">${t.kcal ? `${t.kcal} kcal · ${t.p} g P` : '—'}</td></tr>`; }).join('')}
        </tbody></table></div>
        <div class="row"><button class="btn ghost sm" data-act="kit-plan-fill">Fill the week for my targets</button><button class="btn ghost sm" data-act="kit-plan-clear">Clear</button></div></section>
      <section class="card"><div class="card-h"><h2>Shopping list</h2><span class="muted small">From the plan above</span></div>
        ${Object.keys(aisles).length ? `<div class="kt-shop">${Object.entries(aisles).map(([a, xs]) => `<div><h3>${esc(a)}</h3><ul>${xs.map((x) => `<li><span class="num">${x.u === 'pinch' || x.u === 'splash' ? '' : Math.ceil(x.q) + ' ' + esc(x.u)}</span> ${esc(x.n)}</li>`).join('')}</ul></div>`).join('')}</div>` : '<p class="muted small">Plan some meals and the list builds itself.</p>'}</section>`;
  }

  function supps(s) {
    const k = ensure(s), sc = OS.scores(s);
    const fromProtocol = OS.protocol(s, sc).filter((i) => i.cat === 'supplement').map((i) => ({ id: i.id, name: i.title, time: i.time, proto: true }));
    const list = fromProtocol.concat(k.supps), days = Array.from({ length: 14 }, (_, i) => dayKey(addDays(new Date(), i - 13)));
    return `<section class="card"><div class="card-h"><h2>Supplement log</h2><span class="muted small">Tick what you took; the last 14 days show adherence</span></div>
        ${list.length ? `<ul class="kt-supps">${list.map((x) => { const log = (d) => !!(k.suppLog[d] || {})[x.id]; const on = log(today()), n = days.filter(log).length; return `<li><button class="kt-chk ${on ? 'on' : ''}" data-act="kit-supp" data-id="${esc(x.id)}" aria-pressed="${on}" aria-label="Took ${esc(x.name)} today">${on ? icon('check', 14) : ''}</button>
          <span class="kt-sn"><b>${esc(x.name)}</b><span class="muted small block">${esc(x.time || '')}${x.dose ? ` · ${esc(x.dose)}` : ''}${x.proto ? ' · from your protocol' : ''}</span></span>
          <span class="kt-dots" aria-label="Taken ${n} of the last 14 days">${days.map((d) => `<i class="${log(d) ? 'on' : ''}"></i>`).join('')}</span>
          ${x.proto ? '' : `<button class="icon-btn" data-act="kit-supp-del" data-id="${esc(x.id)}" aria-label="Remove ${esc(x.name)}">${icon('x', 14)}</button>`}</li>`; }).join('')}</ul>` : '<p class="muted small">No supplements yet. Your protocol adds any it recommends; add your own below.</p>'}
        <form data-submit="kit-supp-add" class="form-grid"><label class="field" for="ks-n"><span>Supplement</span><input id="ks-n" name="n" required maxlength="60" placeholder="e.g. Creatine monohydrate"></label>
          <label class="field" for="ks-d"><span>Dose on the label</span><input id="ks-d" name="d" maxlength="40" placeholder="e.g. 5 g"></label>
          <label class="field" for="ks-t"><span>When</span><input id="ks-t" name="t" maxlength="20" placeholder="e.g. Breakfast"></label><div class="form-end"><button class="btn sm">Add</button></div></form>
        <p class="fine">Myo tracks supplements; it doesn't dose prescription medicines or hormones. Check new supplements with your clinician if you take medicines or are pregnant. Evidence grades are on <a href="#enhance">Stack</a>.</p></section>`;
  }

  function partners(s) {
    const recent = Object.entries(s.nutrition.meals).flatMap(([d, ms]) => ms.filter((m) => m.src && !['manual', 'off', 'recipe'].includes(m.src)).map((m) => ({ ...m, d }))).sort((a, b) => b.d.localeCompare(a.d)).slice(0, 8);
    const ex = JSON.stringify({ type: 'meal', name: 'Chicken, rice and greens', at: '2026-11-24T12:30:00-05:00', servings: 1, kcal: 640, protein_g: 52, carbs_g: 68, fat_g: 16, recipe_url: 'https://example.com/recipes/chicken-rice', source: { vendor: 'Example meal-prep kitchen' } }, null, 2);
    return `<div class="grid g-2"><section class="card"><div class="card-h"><h2>Connect a meal-prep company</h2><span class="muted small">Through the Myo Ingest API</span></div>
        <ol class="kt-howto"><li>Create an integration key with the <b>Meals</b> scope on Integrations › API.</li><li>Give the key to the company, or paste it into their app.</li><li>They post each meal you receive to <code>POST /v1/meals</code>; it appears in Fuel with its calories and macros.</li></ol>
        <div class="row"><button class="btn sm" data-act="kit-api">Open Integrations › API</button></div>
        <pre class="code small" aria-label="Example meal">${esc(ex)}</pre>
        <p class="fine">Myo has no meal-prep partnerships yet; any company or food app can connect this way today. You can revoke a key at any time.</p></section>
      <section class="card"><div class="card-h"><h2>Meals from partners</h2><span class="muted small">${recent.length ? 'Most recent first' : 'None yet'}</span></div>
        ${recent.length ? `<ul class="kt-log">${recent.map((m) => `<li><span><b>${esc(m.name)}</b><span class="muted small block num">${OS.fmtDate(m.d)} · ${Math.round(m.kcal)} kcal · ${r1(m.p)} g protein · ${esc(m.src)}</span></span>${m.url ? `<a class="btn ghost sm" href="${esc(m.url)}" target="_blank" rel="noopener">Recipe</a>` : ''}</li>`).join('')}</ul>` : '<p class="muted small">Meals a partner sends show here and in Fuel.</p>'}</section></div>`;
  }

  function guide(s) {
    const tg = targets(s.profile);
    return `<section class="card kt-guide"><div class="card-h"><h2>How to track calories without obsessing</h2><span class="muted small">Your targets: ${tg.kcal} kcal · ${tg.p} g protein · ${tg.c} g carbs · ${tg.f} g fat</span></div>
      <ol>
        <li><b>Know where your targets come from.</b> Myo estimates your resting burn (Mifflin-St Jeor) from your age, sex, height and weight, multiplies it by your activity level, then adds or subtracts for your goal. Update your profile when your weight changes.</li>
        <li><b>Protein first.</b> Hit ${tg.p} g a day, about ${Math.round(tg.p / 4)} g at each of four meals. It protects muscle and keeps you full.</li>
        <li><b>Weigh for two weeks, then estimate.</b> A kitchen scale for the first two weeks teaches you what portions really are. After that, logging your usual meals is quick.</li>
        <li><b>Log as you go, not at night.</b> Memory under-counts. Use search, a barcode, a saved recipe or a partner meal.</li>
        <li><b>Count the extras.</b> Oils, sauces, drinks and bites add up fastest: a tablespoon of oil is about 120 kcal.</li>
        <li><b>Judge by the trend.</b> Weigh in on the same three mornings a week. If the 2-week average moves the wrong way, adjust by 100–200 kcal a day, not more.</li>
        <li><b>80% is enough.</b> Hitting your targets most days beats perfect days followed by giving up.</li>
      </ol>
      <p class="fine">If tracking food makes you anxious or you have had an eating disorder, skip calorie counts and talk to a clinician or registered dietitian. Myo's Mind page lists support.</p></section>`;
  }

  OS.register('kitchen', {
    title: 'Kitchen', icon: 'kitchen',
    render(s) {
      const body = { track, recipes, plan, supps, partners, guide }[K.tab](s);
      return `${OS.ui.head('Nutrition', 'Kitchen', 'Track food, cook from Myo recipes, plan the week, log supplements and connect meal-prep partners.', `<a class="btn ghost" href="#fuel">${icon('fuel', 16)} Open Fuel</a>`)}
        <div class="seg kt-tabs" role="tablist" aria-label="Kitchen">${TABS.map(([k, l]) => `<button role="tab" aria-selected="${K.tab === k}" data-act="kit-tab" data-t="${k}">${l}</button>`).join('')}</div>
        ${body}`;
    },
    mount(root) {
      let stream = null, t = null;
      if (K.scan) {
        const v = root.querySelector('#kt-video');
        navigator.mediaDevices && navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then((st) => {
          stream = st; v.srcObject = st; v.play();
          const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
          t = setInterval(async () => { try { const r = await det.detect(v); if (r.length) { K.scan = null; lookup(r[0].rawValue); } } catch { /* keep trying */ } }, 350);
        }).catch(() => { K.scan = null; K.err = "The camera couldn't start here. Type the barcode number instead."; OS.render(); });
      }
      return () => { if (t) clearInterval(t); if (stream) stream.getTracks().forEach((x) => x.stop()); };
    }
  });

  /* ── food data ── */
  async function lookup(code) {
    const c = String(code || '').replace(/\D/g, '');
    if (c.length < 8) { K.err = 'Enter the 8–14 digit number under the barcode.'; return OS.render(); }
    K.busy = true; K.err = ''; OS.render();
    try {
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${c}.json?fields=product_name,brands,serving_size,nutriments`);
      const j = await r.json();
      if (!j || j.status !== 1 || !j.product) throw new Error("That barcode isn't in Open Food Facts yet. Add the food by hand.");
      K.pick = toPick(j.product); K.grams = 100; K.hits = null;
    } catch (e) { K.err = e.message && !/fetch/i.test(e.message) ? e.message : "Couldn't reach Open Food Facts. Check your connection."; }
    K.busy = false; OS.render();
  }
  const toPick = (p) => { const n = p.nutriments || {}, v = (k) => (n[k] == null || n[k] === '' ? null : Number(n[k])); return { name: p.product_name || 'Unnamed product', brand: Array.isArray(p.brands) ? p.brands.join(', ').replace(/^xx:/, '') : p.brands || '', serving: p.serving_size || '', kcal: v('energy-kcal_100g'), p: v('proteins_100g'), c: v('carbohydrates_100g'), f: v('fat_100g') }; };

  OS.act('kit-tab', (el) => { K.tab = el.dataset.t; K.cook = null; OS.render(); });
  OS.act('kit-search', async (f) => {
    const q = f.elements.q.value.trim(); K.q = q; if (q.length < 2) return;
    K.busy = true; K.err = ''; K.pick = null; OS.render();
    try {
      const r = await fetch(`https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=12&fields=code,product_name,brands`);
      if (!r.ok) throw new Error();
      const j = await r.json();
      K.hits = (j.hits || []).filter((h) => h.code && h.product_name).map((h) => ({ code: h.code, name: h.product_name, brand: (Array.isArray(h.brands) ? h.brands.join(', ') : h.brands || '').replace(/(^|, )xx:/g, '$1') }));
    } catch { K.err = 'Food search is unavailable right now. Try a barcode, or add the food by hand.'; K.hits = null; }
    K.busy = false; OS.render();
  });
  OS.act('kit-pick', (el) => { const h = K.hits && K.hits[+el.dataset.i]; if (h) lookup(h.code); });
  OS.act('kit-code', (f) => lookup(f.elements.code.value));
  OS.act('kit-scan', () => { K.scan = K.scan ? null : true; K.err = ''; OS.render(); });
  OS.act('kit-pick-x', () => { K.pick = null; OS.render(); });
  OS.change('kit-grams', (el) => { K.grams = clamp(+el.value || 100, 1, 2000); OS.render(); });
  OS.act('kit-add-pick', () => {
    const p = K.pick, g = K.grams || 100, m = (v) => r1((v || 0) * g / 100);
    logMeal({ name: `${p.name}${p.brand ? ` (${p.brand})` : ''}, ${g} g`.slice(0, 80), kcal: Math.round((p.kcal || 0) * g / 100), p: m(p.p), c: m(p.c), f: m(p.f), src: 'off' });
    K.pick = null; K.hits = null; OS.toast('Added to today');
  });
  OS.act('kit-manual', (f) => { const e = f.elements; logMeal({ name: e.n.value.trim().slice(0, 80), kcal: clamp(+e.k.value || 0, 0, 5000), p: clamp(+e.p.value || 0, 0, 500), c: clamp(+e.c.value || 0, 0, 500), f: clamp(+e.f.value || 0, 0, 500), src: 'manual' }); OS.toast('Added to today'); });
  OS.act('kit-del', (el) => OS.update((s) => { const k = today(); s.nutrition.meals[k] = (s.nutrition.meals[k] || []).filter((m) => m.id !== el.dataset.id); }));
  OS.act('kit-log-recipe', (el) => { const r = R_BY[el.dataset.id]; logMeal({ name: r.name, kcal: r.kcal, p: r.p, c: r.c, f: r.f, src: 'recipe' }); OS.toast(`Logged one serving of ${r.name}`); });
  OS.act('kit-cook', (el) => { K.cook = el.dataset.id; K.step = 0; stopTimer(); OS.render(); });
  OS.act('kit-cook-x', () => { K.cook = null; stopTimer(); OS.render(); });
  OS.act('kit-step', (el) => { const r = R_BY[K.cook]; K.step = clamp(K.step + +el.dataset.d, 0, r.steps.length - 1); stopTimer(); OS.render(); });
  OS.act('kit-cooked', (el) => { const r = R_BY[el.dataset.id]; K.cook = null; stopTimer(); logMeal({ name: r.name, kcal: r.kcal, p: r.p, c: r.c, f: r.f, src: 'recipe' }); OS.toast('Nice cooking. One serving is logged.'); });
  function stopTimer() { if (K.timer && K.timer.t) clearInterval(K.timer.t); K.timer = null; }
  OS.act('kit-timer', () => {
    const r = R_BY[K.cook], secs = r.steps[K.step][1];
    if (K.timer && K.timer.step === K.step) { K.timer.on = !K.timer.on; OS.render(); return; }
    stopTimer();
    K.timer = { step: K.step, left: secs, on: true, t: setInterval(() => {
      if (!K.timer || !K.timer.on) return;
      K.timer.left -= 1; const el = document.getElementById('kt-clock'); if (el) el.textContent = fmtT(K.timer.left);
      if (K.timer.left <= 0) { stopTimer(); OS.toast('Timer done'); try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch { /* not supported */ } OS.render(); }
    }, 1000) };
    OS.render();
  });
  OS.change('kit-plan', (el) => OS.update((s) => { const k = ensure(s); (k.plan[el.dataset.d] = k.plan[el.dataset.d] || {})[el.dataset.s] = el.value || undefined; }, { keepSample: true }));
  OS.act('kit-plan-clear', () => OS.update((s) => { ensure(s).plan = {}; }, { keepSample: true }));
  // fill: rotate the recipes so each day lands near the calorie target with protein first
  OS.act('kit-plan-fill', () => OS.update((s) => {
    const k = ensure(s), tg = targets(s.profile);
    const by = { b: ['oats', 'scramble', 'yogurt'], l: ['salmon', 'lentil', 'chili'], d: ['sheetpan', 'chili', 'salmon'], s: ['shake', 'yogurt'] };
    DAYS.forEach((d, i) => {
      const day = { b: by.b[i % 3], l: by.l[i % 3], d: by.d[(i + 1) % 3] };
      const kc = ['b', 'l', 'd'].reduce((a, sl) => a + R_BY[day[sl]].kcal, 0);
      if (kc < tg.kcal - 300) day.s = by.s[i % 2];
      k.plan[d] = day;
    });
  }, { keepSample: true }));
  OS.act('kit-supp', (el) => OS.update((s) => { const k = ensure(s), d = today(); k.suppLog[d] = k.suppLog[d] || {}; k.suppLog[d][el.dataset.id] = !k.suppLog[d][el.dataset.id]; if (!k.suppLog[d][el.dataset.id]) delete k.suppLog[d][el.dataset.id]; }));
  OS.act('kit-supp-add', (f) => OS.update((s) => { const e = f.elements; ensure(s).supps.push({ id: 'u-' + uid(), name: e.n.value.trim().slice(0, 60), dose: e.d.value.trim().slice(0, 40), time: e.t.value.trim().slice(0, 20) }); }));
  OS.act('kit-supp-del', (el) => OS.update((s) => { const k = ensure(s); k.supps = k.supps.filter((x) => x.id !== el.dataset.id); }));
  OS.act('kit-api', () => { if (OS.connect && OS.connect.open) OS.connect.open('api'); else OS.go('connect'); });
  OS.kitchen = { RECIPES, sum };
})();
