/* ═══ MYO — ENVIRONMENT: the air, sun and heat around you, and the best time to train outside ═══
   Live data from Open-Meteo (free, open, no account): weather and UV from api.open-meteo.com, air quality and pollen
   from air-quality-api.open-meteo.com, place search from geocoding-api.open-meteo.com. Only a place name you type,
   or coordinates rounded to about 1 km, are sent.
   Heat index by the US National Weather Service formula (Rothfusz regression with its adjustments); wind chill by the
   NWS formula; air quality on the US EPA AQI scale; UV on the WHO scale. The best outdoor window scores the next
   24 hours on heat, air and UV, in daylight. */
(function () {
  'use strict';
  const { esc, icon, pill, clamp } = OS;
  const EN = { data: null, at: 0, busy: false, err: '', hits: null, q: '' };
  const cToF = (c) => (c * 9) / 5 + 32, fToC = (f) => ((f - 32) * 5) / 9;
  function heatIndexC(tc, rh) {
    const T = cToF(tc); if (T < 80) { const s = 0.5 * (T + 61 + (T - 68) * 1.2 + rh * 0.094); return fToC((s + T) / 2 < 80 ? s : rothfusz(T, rh)); }
    return fToC(rothfusz(T, rh));
  }
  function rothfusz(T, R) {
    let HI = -42.379 + 2.04901523 * T + 10.14333127 * R - 0.22475541 * T * R - 0.00683783 * T * T - 0.05481717 * R * R + 0.00122874 * T * T * R + 0.00085282 * T * R * R - 0.00000199 * T * T * R * R;
    if (R < 13 && T >= 80 && T <= 112) HI -= ((13 - R) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
    else if (R > 85 && T >= 80 && T <= 87) HI += ((R - 85) / 10) * ((87 - T) / 5);
    return HI;
  }
  function windChillC(tc, kmh) { const T = cToF(tc), V = kmh / 1.609344; if (T > 50 || V <= 3) return null; return fToC(35.74 + 0.6215 * T - 35.75 * V ** 0.16 + 0.4275 * T * V ** 0.16); }
  const HEAT = (hiC) => { const F = cToF(hiC); return F >= 125 ? ['bad', 'Extreme danger', 'Heat stroke is highly likely. Stay in a cool place.'] : F >= 103 ? ['bad', 'Danger', 'Heat cramps and exhaustion are likely; heat stroke is possible with exertion. Move hard sessions indoors.'] : F >= 90 ? ['warn', 'Extreme caution', 'Heat exhaustion is possible with long exertion. Shorten sessions, drink regularly, train in the cooler hours.'] : F >= 80 ? ['warn', 'Caution', 'Fatigue is possible with long exertion. Drink and take breaks.'] : null; };
  const AQI = (v) => (v == null ? null : v <= 50 ? ['good', 'Good', 'Air quality is fine for everyone.'] : v <= 100 ? ['muted', 'Moderate', 'Unusually sensitive people may want to cut back long, heavy exertion.'] : v <= 150 ? ['warn', 'Unhealthy for sensitive groups', 'If you have asthma, heart or lung disease, are older, pregnant or a child, cut back long or heavy exertion outdoors.'] : v <= 200 ? ['bad', 'Unhealthy', 'Everyone should cut back long or heavy exertion outdoors; sensitive groups should avoid it.'] : v <= 300 ? ['bad', 'Very unhealthy', 'Avoid long or heavy exertion outdoors; train indoors.'] : ['bad', 'Hazardous', 'Avoid all physical activity outdoors.']);
  const UV = (v) => (v == null ? null : v < 3 ? ['good', 'Low', 'No protection needed for most people.'] : v < 6 ? ['muted', 'Moderate', 'Shade at midday, sunscreen and a hat.'] : v < 8 ? ['warn', 'High', 'Cover up, SPF 30+ sunscreen, shade 10:00–16:00.'] : v < 11 ? ['bad', 'Very high', 'Minimise sun at midday; full protection.'] : ['bad', 'Extreme', 'Avoid the sun at midday; skin burns in minutes.']);
  const WMO = (c) => (c === 0 ? 'Clear' : c <= 3 ? ['Mainly clear', 'Partly cloudy', 'Overcast'][c - 1] : c <= 48 ? 'Fog' : c <= 57 ? 'Drizzle' : c <= 67 ? 'Rain' : c <= 77 ? 'Snow' : c <= 82 ? 'Showers' : c <= 86 ? 'Snow showers' : 'Thunderstorm');
  const POLLEN = [['grass_pollen', 'Grass'], ['birch_pollen', 'Birch'], ['alder_pollen', 'Alder'], ['olive_pollen', 'Olive'], ['mugwort_pollen', 'Mugwort'], ['ragweed_pollen', 'Ragweed']];
  const pollenLv = (v) => (v == null ? null : v < 10 ? 'Low' : v < 50 ? 'Moderate' : v < 200 ? 'High' : 'Very high');

  async function fetchAll(p) {
    const lat = (+p.lat).toFixed(2), lon = (+p.lon).toFixed(2);
    const wx = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,uv_index,is_day,wind_speed_10m&daily=sunrise,sunset,uv_index_max&timezone=auto&forecast_days=2`;
    const aq = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,${POLLEN.map((x) => x[0]).join(',')}&timezone=auto&forecast_days=2`;
    const [w, a] = await Promise.all([fetch(wx).then((r) => { if (!r.ok) throw new Error('weather'); return r.json(); }), fetch(aq).then((r) => (r.ok ? r.json() : null)).catch(() => null)]);
    return { w, a, at: Date.now() };
  }
  async function refresh(force) {
    const p = (OS.state.env || {}).place; if (!p || EN.busy) return;
    if (!force && EN.data && EN.data.key === `${p.lat},${p.lon}` && Date.now() - EN.at < 30 * 60000) return;
    EN.busy = true; EN.err = ''; if (OS.current === 'env') OS.render();
    try { const d = await fetchAll(p); EN.data = { ...d, key: `${p.lat},${p.lon}` }; EN.at = Date.now(); } catch { EN.err = "Couldn't reach Open-Meteo. Check your connection and try again."; }
    EN.busy = false; if (OS.current === 'env') OS.render(); else OS.emit('header');
  }
  // the current hour and the next 24, aligned across the two feeds
  function hours() {
    const D = EN.data; if (!D || !D.w || !D.w.hourly) return null;
    const H = D.w.hourly, nowKey = (D.w.current && D.w.current.time || '').slice(0, 13), i0 = Math.max(0, H.time.findIndex((t) => t.slice(0, 13) === nowKey)), A = D.a && D.a.hourly, out = [];
    for (let i = i0; i < Math.min(H.time.length, i0 + 25); i++) { const ai = A ? A.time.indexOf(H.time[i]) : -1; out.push({ t: H.time[i], temp: H.temperature_2m[i], rh: H.relative_humidity_2m[i], uv: H.uv_index[i], day: H.is_day[i], wind: H.wind_speed_10m[i], aqi: ai >= 0 ? A.us_aqi[ai] : null, pm25: ai >= 0 ? A.pm2_5[ai] : null }); }
    return out;
  }
  function bestWindow(hs) {
    const score = (h) => { const hi = heatIndexC(h.temp, h.rh), F = cToF(hi), wc = windChillC(h.temp, h.wind); let p = 0; if (!h.day) p += 6; p += F >= 103 ? 8 : F >= 90 ? 4 : F >= 80 ? 1.5 : 0; p += h.aqi == null ? 0 : h.aqi > 150 ? 8 : h.aqi > 100 ? 4 : h.aqi > 50 ? 1 : 0; p += h.uv >= 8 ? 3 : h.uv >= 6 ? 1.5 : 0; p += wc != null && wc < -15 ? 4 : wc != null && wc < -5 ? 1 : 0; return p; };
    let best = null; for (let i = 0; i + 1 < hs.length; i++) { const hr = +hs[i].t.slice(11, 13); if (hr < 6 || hr > 20) continue; const sc = score(hs[i]) + score(hs[i + 1]); if (!best || sc < best.sc) best = { i, sc }; }
    return best && { from: hs[best.i].t, to: hs[best.i + 1].t, sc: best.sc, h: hs[best.i] };
  }
  function line(hs, key, label, unit, W = 300) {
    const pts = hs.map((h, i) => [i, h[key]]).filter((p) => p[1] != null); if (pts.length < 2) return '';
    const H = 110, L = 30, R = 6, T = 8, B = 20, v0 = Math.min(0, ...pts.map((p) => p[1])), v1 = Math.max(...pts.map((p) => p[1])) || 1, X = (i) => L + (i / (hs.length - 1)) * (W - L - R), Y = (v) => T + (1 - (v - v0) / (v1 - v0 || 1)) * (H - T - B);
    return `<figure class="env-mini"><figcaption class="small"><b>${esc(label)}</b> <span class="muted">next 24 h${unit ? `, ${esc(unit)}` : ''}</span></figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)} over the next 24 hours">
      <line class="bc-grid" x1="${L}" x2="${W - R}" y1="${Y(v0)}" y2="${Y(v0)}"/><line class="bc-grid" x1="${L}" x2="${W - R}" y1="${Y(v1)}" y2="${Y(v1)}"/>
      <text class="bc-ax" x="${L - 4}" y="${Y(v1) + 4}" text-anchor="end">${Math.round(v1)}</text><text class="bc-ax" x="${L - 4}" y="${Y(v0) + 4}" text-anchor="end">${Math.round(v0)}</text>
      <text class="bc-ax" x="${L}" y="${H - 4}">${esc(hs[0].t.slice(11, 16))}</text><text class="bc-ax" x="${W - R}" y="${H - 4}" text-anchor="end">${esc(hs[hs.length - 1].t.slice(11, 16))}</text>
      <path class="env-ln" d="${pts.map((p, j) => `${j ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join(' ')}"/>${pts.map((p) => `<circle class="env-hit" cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="6"><title>${esc(hs[p[0]].t.slice(11, 16))}: ${Math.round(p[1] * 10) / 10}${unit ? ` ${esc(unit)}` : ''}</title></circle>`).join('')}</svg></figure>`;
  }

  function render(s) {
    const p = (s.env || {}).place, hs = hours(), D = EN.data, cur = D && D.w && D.w.current, h0 = hs && hs[0];
    const placeCard = `<section class="card"><div class="card-h"><h2>Place</h2>${p ? `<span class="muted small">${esc(p.name)}</span>` : ''}</div>
        <form class="row" data-submit="env-search"><label class="sr" for="env-q">Town or city</label><input id="env-q" name="q" maxlength="60" placeholder="Town or city" value="${esc(EN.q)}"><button class="btn ghost">Search</button><button type="button" class="btn ghost" data-act="env-geo">${icon('home', 14)} Use my location</button></form>
        ${EN.hits ? (EN.hits.length ? `<ul class="fd-pan">${EN.hits.map((h, i) => `<li><button class="link" data-act="env-pick" data-i="${i}">${esc([h.name, h.admin1, h.country].filter(Boolean).join(', '))}</button></li>`).join('')}</ul>` : '<p class="small muted">No places found.</p>') : ''}
        <p class="fine">Only the place name you search, or your location rounded to about 1 km, goes to Open-Meteo. Nothing about you is sent.</p></section>`;
    if (!p) return `${head()}${placeCard}`;
    if (!D) return `${head()}${EN.busy ? '<p class="small muted">Loading…</p>' : EN.err ? `<p class="small" role="alert">${esc(EN.err)} <button class="link" data-act="env-refresh">Try again</button></p>` : ''}${placeCard}`;
    const hi = heatIndexC(cur.temperature_2m, cur.relative_humidity_2m), heat = HEAT(hi), wc = windChillC(cur.temperature_2m, cur.wind_speed_10m), aq = AQI(h0 && h0.aqi), uv = UV(h0 && h0.uv), best = hs && bestWindow(hs);
    const A = D.a && D.a.hourly, ai = A && h0 ? A.time.indexOf(h0.t) : -1, pol = ai >= 0 ? POLLEN.map(([k, l]) => [l, A[k] && A[k][ai]]).filter((x) => x[1] != null) : [];
    const tile = (l, v, u, st) => `<div><span>${l}</span><b>${v}</b><em>${u}</em>${st ? pill(st[0], st[1]) : ''}</div>`;
    return `${head()}
      <section class="card"><div class="card-h"><h2>Now</h2><span class="muted small">${esc(WMO(cur.weather_code))} · updated ${new Date(EN.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} <button class="link small" data-act="env-refresh">${EN.busy ? 'Refreshing…' : 'Refresh'}</button></span></div>
        <div class="lb-tiles">${tile('Temperature', `${Math.round(cur.temperature_2m)}°`, `C · ${Math.round(cToF(cur.temperature_2m))}°F · humidity ${Math.round(cur.relative_humidity_2m)}%`)}
          ${tile(wc != null ? 'Wind chill' : 'Heat index', `${Math.round(wc != null ? wc : hi)}°`, `C · ${Math.round(cToF(wc != null ? wc : hi))}°F`, heat ? [heat[0], heat[1]] : null)}
          ${tile('Air quality', h0 && h0.aqi != null ? Math.round(h0.aqi) : '—', h0 && h0.pm25 != null ? `US AQI · PM2.5 ${h0.pm25.toFixed(1)} µg/m³` : 'US AQI', aq ? [aq[0], aq[1]] : null)}
          ${tile('UV index', h0 && h0.uv != null ? h0.uv.toFixed(1) : '—', `today's peak ${D.w.daily && D.w.daily.uv_index_max ? D.w.daily.uv_index_max[0].toFixed(1) : '—'}`, uv ? [uv[0], uv[1]] : null)}</div>
        <ul class="small bc-ref">${[heat && `<b>Heat:</b> ${heat[2]} <a href="#emergency">Heat stroke steps</a>`, aq && `<b>Air:</b> ${aq[2]}`, uv && `<b>Sun:</b> ${uv[2]}`, wc != null && wc < -10 && '<b>Cold:</b> Cover skin; frostbite can start within 30 minutes when wind chill is below about −28 °C. <a href="#emergency">Hypothermia steps</a>'].filter(Boolean).map((x) => `<li>${x}</li>`).join('')}</ul></section>
      ${best ? `<section class="card"><div class="card-h"><h2>Best time to train outside</h2>${pill(best.sc < 2 ? 'good' : best.sc < 6 ? 'muted' : 'warn', best.sc < 2 ? 'Good conditions' : best.sc < 6 ? 'Fair' : 'Consider indoors')}</div>
        <p><b class="env-best">${esc(best.from.slice(11, 16))}–${esc(String(+best.to.slice(11, 13) + 1).padStart(2, '0'))}:00</b> ${best.from.slice(0, 10) !== hs[0].t.slice(0, 10) ? 'tomorrow' : 'today'} · ${Math.round(best.h.temp)} °C${best.h.aqi != null ? `, AQI ${Math.round(best.h.aqi)}` : ''}${best.h.day ? `, UV ${best.h.uv.toFixed(1)}` : ''}</p>
        <p class="fine">Scores the next 24 hours in daylight between 06:00 and 21:00 for heat, air quality, UV and wind chill.</p></section>` : ''}
      ${hs ? `<section class="card"><div class="card-h"><h2>Next 24 hours</h2></div><div class="env-grid">${line(hs, 'temp', 'Temperature', '°C')}${line(hs, 'aqi', 'Air quality', 'US AQI')}${line(hs, 'uv', 'UV index', '')}</div></section>` : ''}
      ${pol.length ? `<section class="card"><div class="card-h"><h2>Pollen</h2><span class="muted small">grains/m³</span></div><div class="lb-tiles">${pol.map(([l, v]) => tile(l, Math.round(v), pollenLv(v))).join('')}</div><p class="fine">Pollen forecasts cover Europe. If pollen triggers your asthma, keep your reliever with you and see <a href="#emergency">asthma steps</a>.</p></section>` : ''}
      ${placeCard}
      <p class="fine">Data from <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a> (CC BY 4.0), using national weather services and the CAMS air-quality model. Forecasts can be wrong: check official warnings in extreme weather.</p>`;
  }
  const head = () => OS.ui.head('Air · sun · heat · pollen', 'Environment', 'Live air quality, UV, heat and cold where you are, and the best time today to train outside.');

  OS.register('env', { title: 'Environment', icon: 'env', render: (s) => `<div class="env bc fl">${render(s)}</div>`, mount() { refresh(false); } });
  OS.act('env-search', async (f) => {
    const q = f.elements.q.value.trim(); EN.q = q; if (q.length < 2) return;
    try { const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`); const j = await r.json(); EN.hits = (j.results || []).map((x) => ({ name: x.name, admin1: x.admin1, country: x.country, lat: x.latitude, lon: x.longitude })); }
    catch { EN.hits = null; EN.err = "Place search is unavailable right now."; }
    OS.render();
  });
  OS.act('env-pick', (el) => { const h = EN.hits && EN.hits[+el.dataset.i]; if (!h) return; EN.hits = null; EN.data = null; OS.update((s) => { s.env = { ...(s.env || {}), place: { name: [h.name, h.country].filter(Boolean).join(', '), lat: +h.lat.toFixed(2), lon: +h.lon.toFixed(2) } }; }, { keepSample: true }); refresh(true); });
  OS.act('env-geo', () => {
    if (!navigator.geolocation) { EN.err = 'This browser cannot share your location.'; OS.render(); return; }
    navigator.geolocation.getCurrentPosition((pos) => { EN.data = null; OS.update((s) => { s.env = { ...(s.env || {}), place: { name: 'My location', lat: +pos.coords.latitude.toFixed(2), lon: +pos.coords.longitude.toFixed(2) } }; }, { keepSample: true }); refresh(true); },
      () => { EN.err = 'Location permission was not given. Search for your town instead.'; OS.render(); }, { timeout: 15000, maximumAge: 600000 });
  });
  OS.act('env-refresh', () => refresh(true));
  OS.env = { heatIndexC, windChillC, AQI, UV, HEAT, bestWindow, hours, refresh, state: EN,
    status(s) { const h = hours(); if (!(s.env && s.env.place)) return null; if (!h) return ['Tap to load conditions', 'muted']; const a = AQI(h[0].aqi), u = UV(h[0].uv); return [`${Math.round(h[0].temp)}°C${h[0].aqi != null ? ` · AQI ${Math.round(h[0].aqi)}` : ''}${h[0].uv != null ? ` · UV ${h[0].uv.toFixed(0)}` : ''}`, a && a[0] === 'bad' ? 'bad' : a && a[0] === 'warn' ? 'warn' : u && u[0] === 'bad' ? 'warn' : 'good']; } };
})();
