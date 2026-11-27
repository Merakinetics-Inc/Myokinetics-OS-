/* ═══ MYO — FOOD SYSTEM: from soil to plate — grow, harvest, store, scan, and watch additives and pesticide residues ═══
   Grow       · a planting calendar from your own frost dates (any hemisphere), plantings with expected harvest dates,
                and the spray log's pre-harvest intervals
   Harvest    · harvests by crop with the calories and grams of food your plot produced; a pantry with storage
                and use-by dates; home-canning safety
   Scan       · barcode (camera or typed) through Open Food Facts with calories, NOVA processing group, Nutri-Score
                and additives; a hand-portion plate builder that works offline; a photo estimate when Myo AI can see images
   Additives  · a reference of common additives with what regulators have done about them, an avoid list, and what
                you actually ate from scanned products over 30 days
   Pesticides · produce with higher and lower residues in USDA testing, a produce log by source, washing advice, and
                the garden spray log (label pre-harvest interval → safe-to-harvest date)
   Only barcodes go to Open Food Facts; photos go only to Myo AI when you ask, and nothing else leaves the device. */
(function () {
  'use strict';
  const { esc, icon, pill, clamp, dayKey, addDays, fmtDate, uid } = OS;
  const TABS = [['grow', 'Grow'], ['harvest', 'Harvest and pantry'], ['scan', 'Scan'], ['add', 'Additives'], ['pest', 'Pesticides']];
  const FD = { tab: 'grow', pick: null, busy: false, err: '', scan: false, grams: 100, plate: [], photo: null, est: null, estBusy: false, check: '' };
  const DAY = 864e5;

  // key, name, indoor start [from, to] weeks vs last spring frost, plant out [from, to], days to harvest from planting, spacing cm, frost-tender, kcal/100 g, note, storage [where, days]
  const CROPS = [
    ['tomato', 'Tomato', [-8, -6], [1, 3], 70, 60, 1, 18, 'Vitamin C, lycopene', ['Counter', 7]],
    ['pepper', 'Bell pepper', [-10, -8], [2, 4], 75, 45, 1, 31, 'Vitamin C', ['Fridge', 10]],
    ['basil', 'Basil', [-6, -4], [1, 3], 30, 25, 1, 23, 'Vitamin K', ['Counter, in water', 5]],
    ['cucumber', 'Cucumber', [-3, -2], [1, 4], 55, 30, 1, 15, 'Water, vitamin K', ['Fridge', 7]],
    ['zucchini', 'Zucchini (courgette)', null, [1, 4], 50, 90, 1, 17, 'Vitamin C, potassium', ['Fridge', 7]],
    ['squash', 'Winter squash', [-3, -2], [2, 4], 100, 120, 1, 45, 'Vitamin A, fibre', ['Cool cellar', 90]],
    ['beans', 'Green beans', null, [1, 6], 55, 10, 1, 31, 'Fibre, vitamin K', ['Fridge', 6]],
    ['corn', 'Sweet corn', null, [1, 4], 80, 25, 1, 86, 'Fibre, B vitamins', ['Fridge', 3]],
    ['sweetpotato', 'Sweet potato', null, [3, 5], 110, 30, 1, 86, 'Vitamin A, fibre', ['Cool pantry', 60]],
    ['potato', 'Potato', null, [-2, 2], 100, 30, 0, 77, 'Potassium, vitamin C', ['Cool, dark cellar', 90]],
    ['lettuce', 'Lettuce', [-6, -4], [-4, 2], 50, 25, 0, 15, 'Vitamin K, folate', ['Fridge', 7]],
    ['spinach', 'Spinach', null, [-6, -2], 40, 15, 0, 23, 'Folate, iron, vitamin K', ['Fridge', 5]],
    ['kale', 'Kale', [-8, -6], [-3, -1], 55, 45, 0, 49, 'Vitamins K, C, A', ['Fridge', 7]],
    ['chard', 'Swiss chard', null, [-2, 2], 55, 25, 0, 19, 'Vitamins K, A', ['Fridge', 5]],
    ['broccoli', 'Broccoli', [-8, -6], [-3, -1], 60, 45, 0, 34, 'Vitamin C, fibre', ['Fridge', 5]],
    ['cabbage', 'Cabbage', [-8, -6], [-3, -1], 70, 45, 0, 25, 'Vitamins C, K', ['Fridge', 30]],
    ['peas', 'Peas', null, [-6, -4], 60, 5, 0, 81, 'Protein, fibre', ['Fridge', 4]],
    ['carrot', 'Carrot', null, [-3, 2], 70, 5, 0, 41, 'Vitamin A', ['Fridge', 30]],
    ['beet', 'Beetroot', null, [-2, 3], 55, 10, 0, 43, 'Folate, nitrate', ['Fridge', 30]],
    ['radish', 'Radish', null, [-4, 4], 25, 5, 0, 16, 'Vitamin C', ['Fridge', 10]],
    ['onion', 'Onion', [-12, -10], [-4, -2], 100, 10, 0, 40, 'Quercetin', ['Cool, dry, airy', 120]],
    ['garlic', 'Garlic (plant in autumn)', null, null, 0, 15, 0, 149, 'Allicin', ['Cool, dry, airy', 150]],
    ['strawberry', 'Strawberry', null, [-4, -2], 365, 30, 0, 32, 'Vitamin C', ['Fridge', 3]],
    ['eggs', 'Eggs (hens)', null, null, 0, 0, 0, 143, 'Protein, choline', ['Fridge', 35]]
  ];
  const crop = (k) => CROPS.find((c) => c[0] === k);
  const EGG_G = 50;

  // common additives: E number, name, what it does, level (info | limit | restrict), what is known or what regulators did
  const ADD = [
    ['e100', 'Curcumin', 'Colour', 'info', 'From turmeric.'], ['e101', 'Riboflavin', 'Colour', 'info', 'Vitamin B2.'],
    ['e102', 'Tartrazine', 'Colour', 'limit', 'One of six colours that need an EU warning about children\'s activity and attention.'],
    ['e104', 'Quinoline yellow', 'Colour', 'limit', 'EU children\'s activity warning colour; not permitted in US foods.'],
    ['e110', 'Sunset yellow', 'Colour', 'limit', 'EU children\'s activity warning colour.'],
    ['e122', 'Carmoisine', 'Colour', 'limit', 'EU children\'s activity warning colour; not permitted in US foods.'],
    ['e124', 'Ponceau 4R', 'Colour', 'limit', 'EU children\'s activity warning colour; not permitted in US foods.'],
    ['e127', 'Erythrosine (Red No. 3)', 'Colour', 'restrict', 'The FDA revoked its use in US foods in 2025, effective 2027.'],
    ['e129', 'Allura red', 'Colour', 'limit', 'EU children\'s activity warning colour (Red No. 40 in the US).'],
    ['e133', 'Brilliant blue', 'Colour', 'info', 'Blue No. 1.'], ['e150d', 'Sulphite ammonia caramel', 'Colour', 'info', 'Common in colas.'],
    ['e160a', 'Carotenes', 'Colour', 'info', 'Includes beta-carotene.'], ['e162', 'Beetroot red', 'Colour', 'info', 'From beetroot.'],
    ['e171', 'Titanium dioxide', 'Colour', 'restrict', 'No longer allowed in EU food since 2022; EFSA could not rule out genotoxicity.'],
    ['e200', 'Sorbic acid', 'Preservative', 'info', ''], ['e202', 'Potassium sorbate', 'Preservative', 'info', ''],
    ['e210', 'Benzoic acid', 'Preservative', 'info', 'Can form benzene with vitamin C in drinks under heat and light.'], ['e211', 'Sodium benzoate', 'Preservative', 'info', 'Can form benzene with vitamin C in drinks under heat and light.'],
    ['e220', 'Sulphur dioxide', 'Preservative', 'limit', 'Must be labelled: can trigger asthma in sensitive people.'], ['e223', 'Sodium metabisulphite', 'Preservative', 'limit', 'Sulphite: must be labelled; asthma trigger in sensitive people.'],
    ['e249', 'Potassium nitrite', 'Preservative', 'limit', 'Cured meats; processed meat is classed by IARC as carcinogenic to humans.'],
    ['e250', 'Sodium nitrite', 'Preservative', 'limit', 'Cured meats; processed meat is classed by IARC as carcinogenic to humans.'],
    ['e251', 'Sodium nitrate', 'Preservative', 'limit', 'Cured meats; converts to nitrite.'], ['e252', 'Potassium nitrate', 'Preservative', 'limit', 'Cured meats; converts to nitrite.'],
    ['e270', 'Lactic acid', 'Acid', 'info', ''], ['e300', 'Ascorbic acid', 'Antioxidant', 'info', 'Vitamin C.'], ['e306', 'Tocopherols', 'Antioxidant', 'info', 'Vitamin E.'],
    ['e319', 'TBHQ', 'Antioxidant', 'limit', 'Permitted in the EU and US within limits; studied for effects on the immune system.'],
    ['e320', 'BHA', 'Antioxidant', 'limit', 'Classed by IARC as possibly carcinogenic (2B).'], ['e321', 'BHT', 'Antioxidant', 'info', 'Under review in some countries.'],
    ['e322', 'Lecithins', 'Emulsifier', 'info', 'Often from soy or sunflower.'], ['e330', 'Citric acid', 'Acid', 'info', ''], ['e331', 'Sodium citrates', 'Acid regulator', 'info', ''],
    ['e338', 'Phosphoric acid', 'Acid', 'info', 'Colas.'], ['e407', 'Carrageenan', 'Thickener', 'info', 'Studied for gut effects; evidence in people is limited.'],
    ['e412', 'Guar gum', 'Thickener', 'info', ''], ['e415', 'Xanthan gum', 'Thickener', 'info', ''], ['e433', 'Polysorbate 80', 'Emulsifier', 'limit', 'Altered gut bacteria and the gut lining in animal and early human studies.'],
    ['e450', 'Diphosphates', 'Raising agent', 'info', ''], ['e466', 'Carboxymethylcellulose', 'Emulsifier', 'limit', 'Altered gut bacteria in a controlled human feeding study.'],
    ['e471', 'Mono- and diglycerides of fatty acids', 'Emulsifier', 'info', 'Linked with cardiovascular risk in one large observational study.'],
    ['e621', 'Monosodium glutamate', 'Flavour enhancer', 'info', 'Safe for most people at normal intakes.'],
    ['e924', 'Potassium bromate', 'Flour treatment', 'restrict', 'Banned in the EU and UK; California bans it from 2027.'],
    ['e950', 'Acesulfame K', 'Sweetener', 'info', ''], ['e951', 'Aspartame', 'Sweetener', 'limit', 'IARC: possibly carcinogenic (2B, 2023); JECFA kept the daily intake limit. Not for people with PKU.'],
    ['e955', 'Sucralose', 'Sweetener', 'info', ''], ['e960', 'Steviol glycosides', 'Sweetener', 'info', 'From stevia.'], ['e967', 'Xylitol', 'Sweetener', 'info', 'Very toxic to dogs.'],
    ['e1422', 'Acetylated distarch adipate', 'Thickener', 'info', 'Modified starch.']
  ];
  const addOf = (k) => ADD.find((a) => a[0] === k);
  const LEVEL = { info: ['muted', 'No concern at normal intake'], limit: ['warn', 'Some concern or a label rule'], restrict: ['bad', 'Banned or being removed somewhere'] };

  // produce with higher and lower residues in USDA Pesticide Data Program testing (order changes each year)
  const HIGHER = ['Strawberries', 'Spinach', 'Kale, collard and mustard greens', 'Grapes', 'Peaches', 'Pears', 'Nectarines', 'Apples', 'Bell and hot peppers', 'Cherries', 'Blueberries', 'Green beans'];
  const LOWER = ['Avocados', 'Sweet corn', 'Pineapple', 'Onions', 'Papaya', 'Frozen sweet peas', 'Asparagus', 'Honeydew melon', 'Kiwi', 'Cabbage', 'Mushrooms', 'Mangoes', 'Sweet potatoes', 'Watermelon', 'Carrots'];
  const SRC = [['conv', 'Conventional'], ['org', 'Organic'], ['home', 'Home-grown'], ['local', 'Local farm']];

  // hand portions for the offline plate builder: [name, grams for one hand unit, unit, kcal, protein, carbs, fat per 100 g]
  const PLATE = [
    ['Chicken, cooked', 100, 'palm', 165, 31, 0, 3.6], ['Beef, lean, cooked', 100, 'palm', 217, 26, 0, 12], ['Salmon, cooked', 100, 'palm', 206, 22, 0, 12], ['White fish, cooked', 100, 'palm', 105, 23, 0, 1],
    ['Eggs', 100, 'two eggs', 143, 13, 1, 10], ['Tofu', 100, 'palm', 144, 17, 3, 9], ['Beans or lentils, cooked', 150, 'cupped hand', 116, 9, 20, 0.4],
    ['Rice, cooked', 150, 'fist', 130, 2.7, 28, 0.3], ['Pasta, cooked', 150, 'fist', 158, 5.8, 31, 0.9], ['Potato, boiled', 150, 'fist', 87, 1.9, 20, 0.1], ['Bread', 40, 'slice', 265, 9, 49, 3.2], ['Oats, cooked', 200, 'fist', 71, 2.5, 12, 1.5],
    ['Vegetables, mixed', 100, 'fist', 35, 2, 7, 0.3], ['Salad leaves', 50, 'two handfuls', 17, 1.4, 3, 0.2], ['Fruit', 120, 'fist', 55, 0.6, 14, 0.2],
    ['Olive oil', 10, 'thumb', 884, 0, 0, 100], ['Butter', 10, 'thumb', 717, 0.9, 0.1, 81], ['Nuts', 15, 'thumb', 607, 20, 21, 54], ['Cheese', 30, 'thumb', 402, 25, 1.3, 33], ['Avocado', 50, 'quarter', 160, 2, 9, 15],
    ['Yogurt, plain', 150, 'cupped hand', 61, 3.5, 4.7, 3.3], ['Milk', 250, 'glass', 50, 3.3, 4.8, 2]
  ];

  /* ── state ── */
  const F = (s) => s.food || {};
  const save = (fn) => OS.update((s) => { s.food = s.food || {}; ['plantings', 'harvests', 'pantry', 'produce', 'sprays'].forEach((k) => { s.food[k] = s.food[k] || []; }); s.food.avoid = s.food.avoid || []; fn(s.food); });
  const doy = (d) => Math.round((new Date(`${d}T12:00:00`) - new Date(`${d.slice(0, 4)}-01-01T12:00:00`)) / DAY);
  function frost(s) { const f = F(s); return { last: f.lastFrost || '04-15', first: f.firstFrost || '10-15', set: !!f.lastFrost }; }
  const dateOf = (md, yr) => new Date(`${yr}-${md}T12:00:00`);
  const fmtW = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  /* ── grow ── */
  function windows(c, fr) {
    const yr = new Date().getFullYear(), lf = dateOf(fr.last, yr), ff0 = dateOf(fr.first, yr), ff = ff0 < lf ? dateOf(fr.first, yr + 1) : ff0, w = (n) => new Date(lf.getTime() + n * 7 * DAY);
    if (c[0] === 'garlic') return { plant: [new Date(ff.getTime() - 42 * DAY), new Date(ff.getTime() - 14 * DAY)], harvest: [w(10), w(14)] };
    if (c[0] === 'eggs') return null;
    const out = { indoor: c[2] ? [w(c[2][0]), w(c[2][1])] : null, plant: [w(c[3][0]), w(c[3][1])] };
    if (c[4] >= 365) out.harvest = [w(52 + 6), w(52 + 10)];
    else { let h1 = new Date(out.plant[1].getTime() + (c[4] + 21) * DAY); if (c[6] && h1 > ff) h1 = ff; out.harvest = [new Date(out.plant[0].getTime() + c[4] * DAY), h1]; }
    return out;
  }
  function calendar(s, W = 720) {
    const fr = frost(s), yr = new Date().getFullYear(), lf = dateOf(fr.last, yr), t0 = new Date(lf.getTime() - 16 * 7 * DAY), span = 365 * DAY;
    const narrow = W < 520, rows = CROPS.filter((c) => c[0] !== 'eggs' && c[4] < 365), L = narrow ? 92 : 128, R = 8, T = 22, rh = 18, H = T + rows.length * rh + 6;
    const X = (d) => L + clamp((d - t0) / span, 0, 1) * (W - L - R), bar = (a, b, cls, y) => (a && b && b > t0 && a < t0.getTime() + span ? `<rect class="fd-${cls}" x="${X(a).toFixed(1)}" y="${y + 3}" width="${Math.max(3, X(b) - X(a)).toFixed(1)}" height="${rh - 7}" rx="3"/>` : '');
    const months = []; for (let i = 0; i < 13; i++) { const d = new Date(t0.getFullYear(), t0.getMonth() + i, 1); if (d >= t0 && d < t0.getTime() + span) months.push(d); }
    const now = new Date();
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Planting calendar for the next 12 months">${months.map((d) => `<line class="bc-grid" x1="${X(d).toFixed(1)}" x2="${X(d).toFixed(1)}" y1="${T - 4}" y2="${H - 4}"/><text class="bc-ax" x="${(X(d) + 2).toFixed(1)}" y="12">${d.toLocaleDateString(undefined, { month: narrow ? 'narrow' : 'short' })}</text>`).join('')}
      ${rows.map((c, i) => { const y = T + i * rh, ws = windows(c, fr); return `<text class="bc-ax fd-crop" x="${L - 8}" y="${y + rh - 6}" text-anchor="end">${esc(c[1].replace(/ \(.*\)/, ''))}</text>${bar(ws.indoor && ws.indoor[0], ws.indoor && ws.indoor[1], 'in', y)}${bar(ws.plant[0], ws.plant[1], 'out', y)}${bar(ws.harvest[0], ws.harvest[1], 'har', y)}`; }).join('')}
      ${now > t0 && now < t0.getTime() + span ? `<line class="fd-now" x1="${X(now).toFixed(1)}" x2="${X(now).toFixed(1)}" y1="${T - 4}" y2="${H - 4}"/>` : ''}
      <line class="fd-frost" x1="${X(lf).toFixed(1)}" x2="${X(lf).toFixed(1)}" y1="${T - 4}" y2="${H - 4}"/></svg>`;
  }
  function phiEnd(f, p) { const sp = (f.sprays || []).filter((x) => x.pid === p.id && x.phi > 0).map((x) => new Date(`${x.d}T12:00:00`).getTime() + x.phi * DAY); return sp.length ? Math.max(...sp) : 0; }
  function growTab(s) {
    const fr = frost(s), f = F(s), ps = (f.plantings || []).slice().sort((a, b) => a.d.localeCompare(b.d)), today = Date.now();
    return `<section class="card"><div class="card-h"><h2>Your frost dates</h2>${fr.set ? '' : pill('warn', 'Using example dates')}</div>
        <form class="lb-grid" data-submit="fd-frost"><label>Last spring frost (month-day)<input name="last" type="text" pattern="\\d{2}-\\d{2}" placeholder="04-15" value="${esc(fr.last)}" required></label>
          <label>First autumn frost (month-day)<input name="first" type="text" pattern="\\d{2}-\\d{2}" placeholder="10-15" value="${esc(fr.first)}" required></label>
          <div class="lb-wide"><button class="btn sm">Save frost dates</button></div></form>
        <p class="fine">Look up the average dates for your area from your national weather or agricultural extension service. In the southern hemisphere your last frost falls around September; the calendar follows whatever you enter.</p></section>
      <section class="card"><div class="card-h"><h2>Planting calendar</h2><span class="muted small">Next 12 months</span></div>
        <div class="fd-cal" data-w="720">${calendar(s)}</div>
        <ul class="bc-leg"><li><i class="bc-sw fd-in"></i>Start indoors</li><li><i class="bc-sw fd-out"></i>Sow or plant out</li><li><i class="bc-sw fd-har"></i>Harvest</li><li><i class="bc-sw fd-sw-frost"></i>Last frost</li><li><i class="bc-sw fd-sw-now"></i>Today</li></ul>
        <p class="fine">Typical windows for temperate gardens. Seed packets and local growers know your conditions best. Strawberries fruit the year after planting; garlic goes in during autumn for next summer.</p></section>
      <section class="card"><div class="card-h"><h2>Add a planting</h2></div>
        <form class="lb-grid" data-submit="fd-plant"><label>Crop<select name="crop">${CROPS.filter((c) => c[0] !== 'eggs').map((c) => `<option value="${c[0]}">${esc(c[1])}</option>`).join('')}</select></label>
          <label>Planted on<input type="date" name="d" value="${dayKey(new Date())}" required></label><label>Bed or area<input name="bed" maxlength="40" placeholder="Bed 1"></label><label>Plants or metres of row<input name="n" type="number" min="0" step="1"></label>
          <div class="lb-wide"><button class="btn sm">${icon('plus', 14)} Add planting</button></div></form></section>
      <section class="card"><div class="card-h"><h2>Growing now</h2><span class="muted small">${ps.length}</span></div>
        ${ps.length ? `<div class="tbl-wrap"><table class="tbl compact"><caption class="sr">Plantings</caption><thead><tr><th scope="col">Crop</th><th scope="col">Bed</th><th scope="col">Planted</th><th scope="col">Expected harvest</th><th scope="col">Safe to harvest</th><th scope="col"><span class="sr">Actions</span></th></tr></thead><tbody>
          ${ps.map((p) => { const c = crop(p.crop) || [p.crop, p.crop, null, null, 60], due = new Date(`${p.d}T12:00:00`).getTime() + (p.crop === 'garlic' ? 260 : c[4]) * DAY, days = Math.round((due - today) / DAY), phi = phiEnd(f, p);
            return `<tr><th scope="row">${esc(c[1])}</th><td class="small">${esc(p.bed || '—')}</td><td class="small">${esc(fmtDate(p.d))}</td><td class="small">${fmtW(new Date(due))} ${days > 0 ? `<span class="muted">in ${days} d</span>` : pill('good', 'Ready')}</td>
              <td class="small">${phi > today ? pill('warn', `From ${fmtW(new Date(phi))}`) : phi ? pill('good', 'Yes') : '<span class="muted">No sprays logged</span>'}</td>
              <td><button class="link small" data-act="fd-goharvest" data-id="${p.id}">Log harvest</button> <button class="lb-del" data-act="fd-del" data-k="plantings" data-id="${p.id}" aria-label="Remove the ${esc(c[1])} planting">${icon('x', 12)}</button></td></tr>`; }).join('')}</tbody></table></div>` : '<p class="small muted">Nothing planted yet.</p>'}</section>`;
  }

  /* ── harvest and pantry ── */
  function harvestTab(s) {
    const f = F(s), yr = String(new Date().getFullYear()), hs = (f.harvests || []).filter((h) => h.d.startsWith(yr)), by = {};
    hs.forEach((h) => { const c = crop(h.crop), g = h.crop === 'eggs' ? (h.n || 0) * EGG_G : h.g || 0; const b = (by[h.crop] = by[h.crop] || { g: 0, kcal: 0, n: 0, name: c ? c[1] : h.crop }); b.g += g; b.kcal += c ? (g * c[7]) / 100 : 0; b.n += h.n || 0; });
    const rows = Object.values(by).sort((a, b) => b.kcal - a.kcal), tot = rows.reduce((a, r) => a + r.kcal, 0), totG = rows.reduce((a, r) => a + r.g, 0), mx = Math.max(1, ...rows.map((r) => r.kcal));
    const pan = (f.pantry || []).slice().sort((a, b) => (a.useBy || '9').localeCompare(b.useBy || '9')), soon = dayKey(addDays(new Date(), 3)), td = dayKey(new Date());
    const pre = FD.harvestFor || '';
    return `<section class="card"><div class="card-h"><h2>Log a harvest</h2></div>
        <form class="lb-grid" data-submit="fd-harvest"><label>Crop<select name="crop" data-change="fd-hcrop">${CROPS.map((c) => `<option value="${c[0]}" ${(pre ? (crop(((f.plantings || []).find((p) => p.id === pre) || {}).crop) || [])[0] : FD.hcrop) === c[0] ? 'selected' : ''}>${esc(c[1])}</option>`).join('')}</select></label>
          <label>Date<input type="date" name="d" value="${td}" max="${td}" required></label>
          <label>${FD.hcrop === 'eggs' ? 'Eggs collected' : 'Weight (g)'}<input name="q" type="number" min="1" step="1" required></label>
          <label class="ped-use tested fd-chk"><input type="checkbox" name="pantry" checked> Add to the pantry</label>
          <input type="hidden" name="pid" value="${esc(pre)}"><div class="lb-wide"><button class="btn sm">${icon('plus', 14)} Save harvest</button></div></form>
        ${FD.phiWarn ? `<div class="banner warn" role="alert">${esc(FD.phiWarn)}</div>` : ''}</section>
      <section class="card"><div class="card-h"><h2>This year's harvest</h2><span class="muted small">${(totG / 1000).toFixed(1)} kg · ${Math.round(tot).toLocaleString()} kcal</span></div>
        ${rows.length ? `<ul class="fl-bars fd-bars" aria-label="Calories harvested by crop">${rows.map((r) => `<li><span>${esc(r.name)}</span><i class="fl-track"><i style="width:${((r.kcal / mx) * 100).toFixed(1)}%"></i></i><b class="num">${Math.round(r.kcal).toLocaleString()}</b></li>`).join('')}</ul>
          <p class="fine">kcal from standard food tables. ${tot ? `That's about ${Math.max(1, Math.round(tot / 2200))} day${Math.round(tot / 2200) > 1 ? 's' : ''} of food for one adult.` : ''}</p>` : '<p class="small muted">No harvests logged this year.</p>'}</section>
      <section class="card"><div class="card-h"><h2>Pantry</h2><span class="muted small">${pan.length} item${pan.length === 1 ? '' : 's'}</span></div>
        <form class="lb-grid" data-submit="fd-pantry"><label>Item<input name="name" maxlength="50" required placeholder="Tomato sauce, 6 jars"></label><label>Stored<select name="where"><option>Fridge</option><option>Freezer</option><option>Pantry</option><option>Cellar</option><option>Canned</option><option>Dried</option></select></label>
          <label>Use by<input type="date" name="use"></label><div class="lb-wide"><button class="btn ghost sm">${icon('plus', 14)} Add to pantry</button></div></form>
        ${pan.length ? `<ul class="fd-pan">${pan.map((x) => `<li><b>${esc(x.name)}</b> <span class="muted small">${esc(x.where)}</span> ${x.useBy ? (x.useBy < td ? pill('bad', `Past ${fmtW(new Date(`${x.useBy}T12:00:00`))}`) : x.useBy <= soon ? pill('warn', `Use by ${fmtW(new Date(`${x.useBy}T12:00:00`))}`) : `<span class="small muted">use by ${esc(fmtDate(x.useBy))}</span>`) : ''}
          <button class="link small" data-act="fd-del" data-k="pantry" data-id="${x.id}">Used</button></li>`).join('')}</ul>` : ''}
        <p class="fine">Home canning: low-acid foods (vegetables, meat, beans) must be pressure-canned using a tested recipe, such as the USDA Complete Guide to Home Canning, because botulism can grow in sealed jars. Throw away bulging, leaking or spurting jars without tasting.</p></section>`;
  }

  /* ── scan ── */
  async function lookup(code) {
    const c = String(code || '').replace(/\D/g, '');
    if (c.length < 8) { FD.err = 'Enter the 8–14 digit number under the barcode.'; OS.render(); return; }
    FD.busy = true; FD.err = ''; FD.pick = null; OS.render();
    try {
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${c}.json?fields=product_name,brands,serving_size,nutriments,nova_group,nutriscore_grade,additives_tags,ingredients_text`);
      const j = await r.json();
      if (!j || j.status !== 1 || !j.product) throw new Error("That barcode isn't in Open Food Facts yet. Use the plate builder or Kitchen's manual entry.");
      const p = j.product, n = p.nutriments || {}, v = (k) => (n[k] == null || n[k] === '' ? null : Number(n[k]));
      FD.pick = { code: c, name: p.product_name || 'Unnamed product', brand: (Array.isArray(p.brands) ? p.brands.join(', ') : p.brands || '').replace(/(^|, )xx:/g, '$1'), serving: p.serving_size || '', kcal: v('energy-kcal_100g'), p: v('proteins_100g'), c: v('carbohydrates_100g'), f: v('fat_100g'), sugar: v('sugars_100g'), salt: v('salt_100g'), fibre: v('fiber_100g'),
        nova: p.nova_group || null, ns: p.nutriscore_grade && /^[a-e]$/.test(p.nutriscore_grade) ? p.nutriscore_grade : null, add: (p.additives_tags || []).map((t) => String(t).replace(/^en:/, '')).filter((t) => /^e\d/.test(t)) };
      FD.grams = 100;
    } catch (e) { FD.err = e.message && !/fetch|JSON/i.test(e.message) ? e.message : "Couldn't reach Open Food Facts. Check your connection."; }
    FD.busy = false; OS.render();
  }
  const NOVA = { 1: ['good', 'NOVA 1: unprocessed or minimally processed'], 2: ['muted', 'NOVA 2: culinary ingredient'], 3: ['muted', 'NOVA 3: processed'], 4: ['warn', 'NOVA 4: ultra-processed'] };
  function addChips(list, avoid) { return list.length ? `<ul class="fd-adds">${list.map((k) => { const a = addOf(k), lv = a ? LEVEL[a[3]][0] : 'muted', av = avoid.includes(k); return `<li class="fd-add st-${av ? 'bad' : lv}"><b>${esc(k.toUpperCase())}</b> ${esc(a ? a[1] : 'Additive')}${av ? ' · on your avoid list' : ''}</li>`; }).join('')}</ul>` : '<p class="small muted">No additives listed.</p>'; }
  function scanTab(s) {
    const P = FD.pick, avoid = F(s).avoid || [], g = FD.grams, m = (v) => (v == null ? '—' : Math.round((v * g) / 10) / 10);
    const pl = FD.plate, tot = pl.reduce((a, x) => { const r = PLATE[x.i], gg = r[1] * x.n; a.g += gg; a.kcal += (r[3] * gg) / 100; a.p += (r[4] * gg) / 100; a.c += (r[5] * gg) / 100; a.f += (r[6] * gg) / 100; return a; }, { g: 0, kcal: 0, p: 0, c: 0, f: 0 });
    const ai = OS.caps && OS.caps.sample;
    return `<section class="card"><div class="card-h"><h2>Scan a barcode</h2></div>
        <form data-submit="fd-code" class="row kt-search"><label class="sr" for="fd-code">Barcode</label><input id="fd-code" name="code" inputmode="numeric" placeholder="Barcode number" autocomplete="off">
          ${'BarcodeDetector' in window ? `<button type="button" class="btn ghost" data-act="fd-cam">${FD.scan ? 'Stop camera' : 'Use camera'}</button>` : ''}<button class="btn">Look up</button></form>
        ${FD.scan ? '<video id="fd-video" class="fd-video" muted playsinline aria-label="Camera view for barcode scanning"></video>' : ''}
        ${FD.busy ? '<p class="small muted">Looking it up…</p>' : ''}${FD.err ? `<p class="small" role="alert">${esc(FD.err)}</p>` : ''}
        ${P ? `<div class="fd-prod"><h3>${esc(P.name)}${P.brand ? ` <span class="muted small">${esc(P.brand)}</span>` : ''}</h3>
          <p>${P.nova ? pill(NOVA[P.nova][0], NOVA[P.nova][1]) : ''} ${P.ns ? pill(P.ns <= 'b' ? 'good' : P.ns === 'c' ? 'muted' : 'warn', `Nutri-Score ${P.ns.toUpperCase()}`) : ''}</p>
          <label class="fd-grams">Amount <input type="number" min="1" max="2000" value="${g}" data-change="fd-grams"> g ${P.serving ? `<span class="muted small">serving: ${esc(P.serving)}</span>` : ''}</label>
          <div class="st-read">${[['Calories', P.kcal == null ? '—' : Math.round((P.kcal * g) / 100), 'kcal'], ['Protein', m(P.p), 'g'], ['Carbs', m(P.c), 'g'], ['Fat', m(P.f), 'g'], ['Sugars', m(P.sugar), 'g'], ['Salt', m(P.salt), 'g']].map(([l, v, u]) => `<div><span>${l}</span><b class="num">${v}</b><em>${u}</em></div>`).join('')}</div>
          <h4>Additives</h4>${addChips(P.add, avoid)}
          <div class="st-go"><button class="btn sm" data-act="fd-log-pick">${icon('plus', 14)} Log to today</button><button class="btn ghost sm" data-act="fd-x">Clear</button></div></div>` : ''}
        <p class="fine">Food data from <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener">Open Food Facts</a>, an open, crowd-sourced database; check the label for anything that matters. Only the barcode is sent.</p></section>
      <section class="card"><div class="card-h"><h2>Photo estimate</h2>${ai ? '' : pill('muted', 'Needs Myo AI with images')}</div>
        ${ai ? `<label class="btn ghost bc-file">${icon('upload', 16)} Take or choose a photo of the meal<input class="sr" type="file" accept="image/*" capture="environment" data-change="fd-photo"></label>
          ${FD.estBusy ? '<p class="small muted">Myo is looking at the photo…</p>' : ''}
          ${FD.est ? `<div class="tbl-wrap"><table class="tbl compact"><caption class="sr">Estimated foods</caption><thead><tr><th scope="col">Food</th><th scope="col">Grams</th><th scope="col">kcal</th></tr></thead><tbody>${FD.est.items.map((x) => `<tr><th scope="row">${esc(x.name)}</th><td class="num">${Math.round(x.grams)}</td><td class="num">${Math.round(x.kcal)}</td></tr>`).join('')}</tbody></table></div>
            <p class="small">Total about <b>${Math.round(FD.est.items.reduce((a, x) => a + x.kcal, 0))} kcal</b>. ${esc(FD.est.note || '')}</p><div class="st-go"><button class="btn sm" data-act="fd-log-est">${icon('plus', 14)} Log to today</button><button class="btn ghost sm" data-act="fd-est-x">Discard</button></div>` : ''}
          <p class="fine">The photo is sent to Myo AI only when you choose one, and isn't kept. Photo estimates are often 20–30% off; weigh food when it matters.</p>`
        : '<p class="small">Photo calorie estimates run when Myo AI can see images. Until then, the plate builder below gives a solid estimate with no photo and no network.</p>'}</section>
      <section class="card"><div class="card-h"><h2>Plate builder</h2><span class="muted small">Hand portions, works offline</span></div>
        <div class="fd-plate">${PLATE.map((r, i) => { const x = pl.find((q) => q.i === i); return `<button class="chip-btn ${x ? 'on' : ''}" data-act="fd-plate" data-i="${i}" title="1 ${esc(r[2])} ≈ ${r[1]} g">${esc(r[0])}${x ? ` × ${x.n}` : ''}</button>`; }).join('')}</div>
        ${pl.length ? `<p class="small">${pl.map((x) => `${esc(PLATE[x.i][0])}: ${x.n} ${esc(PLATE[x.i][2])}${x.n > 1 && !/s$/.test(PLATE[x.i][2]) ? 's' : ''}`).join(' · ')}</p>
          <div class="st-read">${[['Calories', Math.round(tot.kcal), 'kcal'], ['Protein', Math.round(tot.p), 'g'], ['Carbs', Math.round(tot.c), 'g'], ['Fat', Math.round(tot.f), 'g']].map(([l, v, u]) => `<div><span>${l}</span><b class="num">${v}</b><em>${u}</em></div>`).join('')}</div>
          <div class="st-go"><button class="btn sm" data-act="fd-log-plate">${icon('plus', 14)} Log to today</button><button class="btn ghost sm" data-act="fd-plate-x">Clear</button></div>` : ''}
        <p class="fine">Tap a food once for each portion. A palm of protein is about 100 g cooked, a fist of carbs about 150 g, a thumb of fat about 10 g. Hand portions are usually within 10–20% of weighed food.</p></section>`;
  }

  /* ── additives ── */
  function addTab(s) {
    const f = F(s), avoid = f.avoid || [], since = dayKey(addDays(new Date(), -29)), meals = Object.entries((s.nutrition && s.nutrition.meals) || {}).filter(([d]) => d >= since).flatMap(([, ms]) => ms || []);
    const scanned = meals.filter((m) => Array.isArray(m.add)), cnt = {}; scanned.forEach((m) => m.add.forEach((k) => { cnt[k] = (cnt[k] || 0) + 1; }));
    const novaKnown = meals.filter((m) => m.nova), upf = novaKnown.filter((m) => m.nova === 4).length, top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 10), mx = Math.max(1, ...top.map((t) => t[1]));
    const hits = FD.check ? checkText(FD.check) : null;
    return `<section class="card"><div class="card-h"><h2>Your last 30 days</h2><span class="muted small">From scanned foods</span></div>
        <div class="lb-tiles"><div><span>Scanned foods logged</span><b>${scanned.length}</b><em>of ${meals.length} logged items</em></div><div><span>Ultra-processed</span><b>${novaKnown.length ? Math.round((upf / novaKnown.length) * 100) : '—'}</b><em>${novaKnown.length ? `% of ${novaKnown.length} with a NOVA group` : 'Scan foods to see this'}</em></div><div><span>Different additives</span><b>${Object.keys(cnt).length}</b><em>${avoid.length ? `${Object.keys(cnt).filter((k) => avoid.includes(k)).length} on your avoid list` : 'Set an avoid list below'}</em></div></div>
        ${top.length ? `<ul class="fl-bars fd-bars" aria-label="Most frequent additives">${top.map(([k, n]) => { const a = addOf(k); return `<li><span>${esc(k.toUpperCase())} ${esc(a ? a[1] : '')}</span><i class="fl-track"><i style="width:${((n / mx) * 100).toFixed(1)}%"></i></i><b class="num">${n}</b></li>`; }).join('')}</ul>` : '<p class="small muted">Log foods from the Scan tab to track additives.</p>'}
        <p class="fine">Most approved additives are safe at normal intakes. The stronger, more consistent link is with ultra-processed food overall: diets high in it are associated with weight gain and poorer heart and metabolic health.</p></section>
      <section class="card"><div class="card-h"><h2>Check an ingredient list</h2></div>
        <form data-submit="fd-check"><label class="sr" for="fd-ing">Ingredients</label><textarea id="fd-ing" name="t" rows="3" maxlength="3000" placeholder="Paste or type the ingredients from a label">${esc(FD.check)}</textarea><div class="st-go"><button class="btn sm">Check</button></div></form>
        ${hits ? addChips(hits, avoid) : ''}</section>
      <section class="card"><div class="card-h"><h2>Additive reference</h2><span class="muted small">Tick to add to your avoid list</span></div>
        <div class="tbl-wrap"><table class="tbl compact"><caption class="sr">Common food additives</caption><thead><tr><th scope="col">Avoid</th><th scope="col">Code</th><th scope="col">Name</th><th scope="col">Use</th><th scope="col">Status</th><th scope="col">Notes</th></tr></thead><tbody>
          ${ADD.map((a) => `<tr><td><input type="checkbox" data-change="fd-avoid" data-k="${a[0]}" ${avoid.includes(a[0]) ? 'checked' : ''} aria-label="Avoid ${esc(a[1])}"></td><th scope="row" class="num">${esc(a[0].toUpperCase())}</th><td class="small">${esc(a[1])}</td><td class="small">${esc(a[2])}</td><td>${pill(LEVEL[a[3]][0], LEVEL[a[3]][1])}</td><td class="small">${esc(a[4])}</td></tr>`).join('')}</tbody></table></div>
        <p class="fine">Status summarises what EU, UK, US and international agencies (EFSA, FSA, FDA, JECFA, IARC) have said; rules differ by country and change. Allergies and intolerances are personal: check every label.</p></section>`;
  }
  function checkText(t) {
    const s = t.toLowerCase(), out = new Set();
    (s.match(/\be\s?-?\d{3,4}[a-z]?\b/g) || []).forEach((m) => out.add(m.replace(/[\s-]/g, '')));
    ADD.forEach((a) => { const n = a[1].toLowerCase().replace(/\s*\(.*\)/, ''); if (n.length > 4 && s.includes(n)) out.add(a[0]); });
    return [...out];
  }

  /* ── pesticides ── */
  function pestTab(s) {
    const f = F(s), since = dayKey(addDays(new Date(), -29)), log = (f.produce || []).filter((x) => x.d >= since), hi = log.filter((x) => HIGHER.includes(x.item)), hiConv = hi.filter((x) => x.src === 'conv').length;
    const ps = f.plantings || [], sprays = (f.sprays || []).slice().reverse(), today = Date.now();
    return `<div class="grid g-2"><section class="card"><div class="card-h"><h2>Higher residues</h2><span class="muted small">In USDA testing</span></div><ul class="fd-list">${HIGHER.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
          <p class="fine">If you buy some organic, these are where it makes the most difference, or grow them yourself.</p></section>
        <section class="card"><div class="card-h"><h2>Lower residues</h2></div><ul class="fd-list">${LOWER.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section></div>
      <p class="fine">Based on the USDA Pesticide Data Program as summarised in the Environmental Working Group's annual shopper's guide; the order changes each year. Residues found are mostly below legal limits, and the benefits of eating more fruit and vegetables, organic or not, outweigh the risks.</p>
      <section class="card"><div class="card-h"><h2>Log produce</h2></div>
        <form class="lb-grid" data-submit="fd-produce"><label>Item<select name="item">${[...HIGHER, ...LOWER, 'Other'].map((x) => `<option>${esc(x)}</option>`).join('')}</select></label>
          <label>Source<select name="src">${SRC.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label><label>Date<input type="date" name="d" value="${dayKey(new Date())}"></label>
          <label class="ped-use tested fd-chk"><input type="checkbox" name="washed" checked> Washed or peeled</label><div class="lb-wide"><button class="btn ghost sm">${icon('plus', 14)} Add</button></div></form>
        <div class="lb-tiles"><div><span>Higher-residue items, 30 days</span><b>${hi.length}</b><em>${hi.length ? `${hiConv} conventional` : 'none logged'}</em></div><div><span>Washed or peeled</span><b>${log.length ? Math.round((log.filter((x) => x.washed).length / log.length) * 100) : '—'}</b><em>${log.length ? '% of logged produce' : ''}</em></div></div></section>
      <section class="card"><div class="card-h"><h2>Washing produce</h2></div><ul class="small bc-ref">
          <li>Rinse under running water and rub or scrub firm produce, even if you will peel it, so the knife doesn't carry residue inside.</li>
          <li>Skip soap and bleach. In a lab study on apples, a 12–15 minute soak in a weak baking soda solution removed more surface residue than tap water alone.</li>
          <li>Peeling and removing outer leaves lowers residues further, but also removes fibre and nutrients.</li></ul></section>
      <section class="card"><div class="card-h"><h2>Garden spray log</h2><span class="muted small">Including organic sprays</span></div>
        <form class="lb-grid" data-submit="fd-spray"><label>Planting<select name="pid">${ps.length ? ps.map((p) => `<option value="${p.id}">${esc((crop(p.crop) || [0, p.crop])[1])}${p.bed ? ` · ${esc(p.bed)}` : ''}</option>`).join('') : '<option value="">Add a planting in Grow first</option>'}</select></label>
          <label>Product<input name="prod" maxlength="50" required placeholder="Product name"></label><label>Active ingredient<input name="act" maxlength="50" placeholder="From the label"></label>
          <label>Date<input type="date" name="d" value="${dayKey(new Date())}" required></label><label>Pre-harvest interval (days)<input name="phi" type="number" min="0" max="365" required></label><label>Re-entry interval (hours)<input name="rei" type="number" min="0" max="240"></label>
          <div class="lb-wide"><button class="btn ghost sm" ${ps.length ? '' : 'disabled'}>${icon('plus', 14)} Log spray</button></div></form>
        ${sprays.length ? `<ul class="fd-pan">${sprays.slice(0, 12).map((x) => { const p = ps.find((q) => q.id === x.pid), end = new Date(`${x.d}T12:00:00`).getTime() + x.phi * DAY; return `<li><b>${esc(x.prod)}</b>${x.act ? ` <span class="muted small">${esc(x.act)}</span>` : ''} on ${esc(p ? (crop(p.crop) || [0, p.crop])[1] : 'a removed planting')} · ${esc(fmtDate(x.d))} ${end > today ? pill('warn', `Harvest from ${fmtW(new Date(end))}`) : pill('good', 'Interval passed')} <button class="lb-del" data-act="fd-del" data-k="sprays" data-id="${x.id}" aria-label="Delete this spray">${icon('x', 12)}</button></li>`; }).join('')}</ul>` : ''}
        <p class="fine">Use every product exactly as its label says: the label sets the dose, the protective gear, the re-entry interval and the days to wait before harvest. Keep children and pets away until sprays dry or the re-entry interval passes. Myo doesn't recommend products or doses.</p></section>`;
  }

  OS.register('food', {
    title: 'Food system', icon: 'farm',
    render(s) {
      const body = { grow: growTab, harvest: harvestTab, scan: scanTab, add: addTab, pest: pestTab }[FD.tab](s);
      return `${OS.ui.head('Soil to plate · on-device', 'Food system', 'Grow and harvest your own food, keep a pantry, scan what you buy for calories and additives, and keep pesticide residues low.', `<a class="btn ghost" href="#kitchen">${icon('kitchen', 16)} Kitchen</a>`)}
        <div class="fd bc fl"><div class="seg kt-tabs" role="tablist" aria-label="Food system">${TABS.map(([k, l]) => `<button role="tab" aria-selected="${FD.tab === k}" data-act="fd-tab" data-t="${k}">${l}</button>`).join('')}</div>${body}</div>`;
    },
    mount(root) {
      const cal = root.querySelector('.fd-cal'); if (cal) { const w = Math.round(cal.clientWidth); if (w && Math.abs(w - 720) > 8) cal.innerHTML = calendar(OS.state, clamp(w, 300, 1100)); }
      let stream = null, t = null;
      if (FD.scan) {
        const v = root.querySelector('#fd-video');
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then((st) => {
          stream = st; v.srcObject = st; v.play();
          const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
          t = setInterval(async () => { try { const r = await det.detect(v); if (r.length) { FD.scan = false; clearInterval(t); lookup(r[0].rawValue); } } catch { /* keep trying */ } }, 350);
        }).catch(() => { FD.scan = false; FD.err = "The camera couldn't start here. Type the barcode number instead."; OS.render(); });
      }
      return () => { if (t) clearInterval(t); if (stream) stream.getTracks().forEach((x) => x.stop()); };
    }
  });

  const logMeal = (m) => OS.update((s) => { const k = dayKey(new Date()); s.nutrition = s.nutrition || { meals: {} }; s.nutrition.meals = s.nutrition.meals || {}; (s.nutrition.meals[k] = s.nutrition.meals[k] || []).push({ id: uid(), ...m }); });
  const r1 = (v) => Math.round(v * 10) / 10;
  OS.act('fd-tab', (el) => { FD.tab = TABS.some(([k]) => k === el.dataset.t) ? el.dataset.t : 'grow'; FD.scan = false; FD.phiWarn = ''; OS.render(); });
  OS.act('fd-frost', (f) => { const ok = (v) => /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v); const a = f.elements.last.value.trim(), b = f.elements.first.value.trim(); if (!ok(a) || !ok(b)) { OS.toast('Use month-day, like 04-15'); return; } save((F2) => { F2.lastFrost = a; F2.firstFrost = b; }); OS.toast('Frost dates saved'); });
  OS.act('fd-plant', (f) => { const E = f.elements, p = { id: uid(), crop: E.crop.value, d: E.d.value, bed: E.bed.value.trim(), n: +E.n.value || null }; save((F2) => { F2.plantings.push(p); }); OS.logEvent('food', `Planted ${(crop(p.crop) || [0, p.crop])[1]}`, p.bed || '', { go: 'food', src: 'manual' }); });
  OS.act('fd-del', (el) => { const k = el.dataset.k; save((F2) => { F2[k] = F2[k].filter((x) => x.id !== el.dataset.id); }); });
  OS.act('fd-goharvest', (el) => { FD.tab = 'harvest'; FD.harvestFor = el.dataset.id; const p = (F(OS.state).plantings || []).find((x) => x.id === el.dataset.id); FD.hcrop = p ? p.crop : ''; OS.render(); });
  OS.change('fd-hcrop', (el) => { FD.hcrop = el.value; FD.harvestFor = ''; OS.render(); });
  OS.act('fd-harvest', (f) => {
    const E = f.elements, c = E.crop.value, q = +E.q.value, d = E.d.value, pid = E.pid.value; if (!(q > 0)) return;
    const st = F(OS.state), p = (st.plantings || []).find((x) => x.id === pid) || (st.plantings || []).filter((x) => x.crop === c).pop(), phi = p ? phiEnd(st, p) : 0;
    FD.phiWarn = phi && new Date(`${d}T12:00:00`).getTime() < phi ? `This harvest is inside a spray's pre-harvest interval, which ends ${fmtW(new Date(phi))}. Check the product label before eating it.` : '';
    const h = { id: uid(), crop: c, d, pid: p ? p.id : null, ...(c === 'eggs' ? { n: Math.round(q) } : { g: Math.round(q) }) }, C = crop(c), store = C ? C[9] : ['Fridge', 7];
    save((F2) => { F2.harvests.push(h); if (E.pantry.checked) F2.pantry.push({ id: uid(), name: `${C ? C[1].replace(/ \(.*\)/, '') : c}, ${c === 'eggs' ? `${h.n} eggs` : `${h.g} g`}`, where: store[0], useBy: dayKey(addDays(new Date(`${d}T12:00:00`), store[1])), added: d }); });
    FD.harvestFor = ''; OS.logEvent('food', `Harvest · ${C ? C[1] : c}`, c === 'eggs' ? `${h.n} eggs` : `${h.g} g`, { go: 'food', src: 'manual' });
    if (!FD.phiWarn) OS.toast('Harvest saved');
  });
  OS.act('fd-pantry', (f) => { const E = f.elements; save((F2) => { F2.pantry.push({ id: uid(), name: E.name.value.trim(), where: E.where.value, useBy: E.use.value || null, added: dayKey(new Date()) }); }); });
  OS.act('fd-code', (f) => lookup(f.elements.code.value));
  OS.act('fd-cam', () => { FD.scan = !FD.scan; FD.err = ''; OS.render(); });
  OS.act('fd-x', () => { FD.pick = null; OS.render(); });
  OS.change('fd-grams', (el) => { FD.grams = clamp(+el.value || 100, 1, 2000); OS.render(); });
  OS.act('fd-log-pick', () => {
    const P = FD.pick, g = FD.grams, m = (v) => r1(((v || 0) * g) / 100);
    logMeal({ name: `${P.name}${P.brand ? ` (${P.brand})` : ''}, ${g} g`.slice(0, 80), kcal: Math.round(((P.kcal || 0) * g) / 100), p: m(P.p), c: m(P.c), f: m(P.f), src: 'off', add: P.add, nova: P.nova || null, code: P.code });
    const bad = P.add.filter((k) => (F(OS.state).avoid || []).includes(k)); FD.pick = null; OS.toast(bad.length ? `Logged. Contains ${bad.map((k) => k.toUpperCase()).join(', ')} from your avoid list` : 'Logged to today');
  });
  OS.act('fd-plate', (el) => { const i = +el.dataset.i, x = FD.plate.find((q) => q.i === i); if (x) x.n = x.n >= 4 ? 0 : x.n + 1; else FD.plate.push({ i, n: 1 }); FD.plate = FD.plate.filter((q) => q.n > 0); OS.render(); });
  OS.act('fd-plate-x', () => { FD.plate = []; OS.render(); });
  OS.act('fd-log-plate', () => {
    const t = FD.plate.reduce((a, x) => { const r = PLATE[x.i], g = r[1] * x.n; a.kcal += (r[3] * g) / 100; a.p += (r[4] * g) / 100; a.c += (r[5] * g) / 100; a.f += (r[6] * g) / 100; return a; }, { kcal: 0, p: 0, c: 0, f: 0 });
    logMeal({ name: `Plate: ${FD.plate.map((x) => PLATE[x.i][0].split(',')[0]).join(', ')}`.slice(0, 80), kcal: Math.round(t.kcal), p: r1(t.p), c: r1(t.c), f: r1(t.f), src: 'estimate' }); FD.plate = []; OS.toast('Logged to today');
  });
  OS.change('fd-photo', async (el) => {
    const file = el.files && el.files[0]; el.value = ''; const S = OS.caps && OS.caps.sample; if (!file || !S) return;
    FD.estBusy = true; FD.est = null; OS.render();
    try {
      if (S.limits && !(await S.limits()).images) throw new Error('Myo AI here cannot look at images yet.');
      const prompt = 'Estimate the foods on this plate for a calorie log. Reply with JSON only: {"items":[{"name":string,"grams":number,"kcal":number,"p":number,"c":number,"f":number}],"note":string}. Use cooked weights. In "note" say in one sentence what is uncertain. If it is not food, return {"items":[],"note":"No food found."}.';
      const r = S.json ? await S.json(prompt, { images: [file], modelTier: 'default' }) : JSON.parse((await S(prompt, { images: [file] })).text);
      const items = (r && Array.isArray(r.items) ? r.items : []).filter((x) => x && x.name).slice(0, 12).map((x) => ({ name: String(x.name).slice(0, 40), grams: clamp(+x.grams || 0, 0, 2000), kcal: clamp(+x.kcal || 0, 0, 3000), p: clamp(+x.p || 0, 0, 300), c: clamp(+x.c || 0, 0, 500), f: clamp(+x.f || 0, 0, 300) }));
      FD.est = { items, note: String((r && r.note) || '').slice(0, 200) };
      if (!items.length) { FD.err = FD.est.note || 'No food found in that photo.'; FD.est = null; }
    } catch (e) { FD.err = e && e.code === 'not_granted' ? 'Myo AI is turned off for this page.' : (e && e.message) || 'The photo estimate failed.'; }
    FD.estBusy = false; OS.render();
  });
  OS.act('fd-log-est', () => { const it = FD.est.items, sum = (k) => it.reduce((a, x) => a + x[k], 0); logMeal({ name: `Photo: ${it.map((x) => x.name).join(', ')}`.slice(0, 80), kcal: Math.round(sum('kcal')), p: r1(sum('p')), c: r1(sum('c')), f: r1(sum('f')), src: 'estimate' }); FD.est = null; OS.toast('Logged to today'); });
  OS.act('fd-est-x', () => { FD.est = null; OS.render(); });
  OS.change('fd-avoid', (el) => { const k = el.dataset.k, on = el.checked; save((F2) => { F2.avoid = on ? [...new Set([...F2.avoid, k])] : F2.avoid.filter((x) => x !== k); }); });
  OS.act('fd-check', (f) => { FD.check = f.elements.t.value.slice(0, 3000); OS.render(); });
  OS.act('fd-produce', (f) => { const E = f.elements; save((F2) => { F2.produce.push({ id: uid(), item: E.item.value, src: E.src.value, d: E.d.value || dayKey(new Date()), washed: E.washed.checked }); F2.produce = F2.produce.slice(-1000); }); OS.toast('Added'); });
  OS.act('fd-spray', (f) => {
    const E = f.elements; if (!E.pid.value) return;
    const x = { id: uid(), pid: E.pid.value, prod: E.prod.value.trim(), act: E.act.value.trim(), d: E.d.value, phi: clamp(+E.phi.value || 0, 0, 365), rei: E.rei.value ? clamp(+E.rei.value, 0, 240) : null };
    save((F2) => { F2.sprays.push(x); }); OS.logEvent('food', `Garden spray · ${x.prod}`, `pre-harvest interval ${x.phi} days`, { go: 'food', src: 'manual' });
  });
  OS.food = { CROPS, ADD, HIGHER, LOWER, PLATE, windows, checkText, lookup, state: FD,
    status(s) { const f = F(s), ready = (f.plantings || []).filter((p) => { const c = crop(p.crop); return c && Date.now() >= new Date(`${p.d}T12:00:00`).getTime() + (p.crop === 'garlic' ? 260 : c[4]) * DAY; }).length, soon = dayKey(addDays(new Date(), 3)), exp = (f.pantry || []).filter((x) => x.useBy && x.useBy <= soon).length;
      if (exp) return [`${exp} pantry item${exp > 1 ? 's' : ''} to use soon`, 'warn']; if (ready) return [`${ready} planting${ready > 1 ? 's' : ''} ready to harvest`, 'good']; return (f.plantings || []).length ? [`${f.plantings.length} planting${f.plantings.length > 1 ? 's' : ''} growing`, 'muted'] : null; } };
})();
