/* ═══ MYOKINETICS OS v4 — ACCOUNT: Supabase member sign-in + cloud sync ═══
   Members sign in with Supabase Auth: a one-time code by email (works everywhere, no redirect),
   or Google / Apple (redirect, hosted app only). The session's access token is a Supabase JWT;
   it is what the wearables proxy verifies (see the proxy spec, section 3).
   Signed in, member state syncs to public.member_state, one row per member (supabase/schema.sql,
   Row Level Security: a member reads and writes only their own row). Photos and scans stay in
   this browser's IndexedDB and are never part of that row.
   Config: window.MYO_CONFIG = { supabaseUrl, supabaseKey } in js/config.js for hosted builds,
   or entered on the Profile page. Only the publishable (anon) key belongs in a browser. */
(function () {
  'use strict';
  const { esc, pill } = OS;
  const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.50.0/dist/umd/supabase.js';
  const CFG_KEY = 'myo-supabase', TABLE = 'member_state';
  const IN_CLAUDE = !!(window.claude && window.claude.use);
  const mem = {};
  const store = {
    getItem(k) { try { return localStorage.getItem(k); } catch { return k in mem ? mem[k] : null; } },
    setItem(k, v) { try { localStorage.setItem(k, v); } catch { mem[k] = v; } },
    removeItem(k) { try { localStorage.removeItem(k); } catch { delete mem[k]; } }
  };
  const A = { sb: null, session: null, user: null, ready: false, step: 'email', email: '', busy: false, msg: '', err: '', syncErr: '', conflict: null, syncedAt: null, editCfg: false, prevMode: null };

  /* ── config ──────────────────────────────────────────────────────── */
  function cfg() {
    const g = window.MYO_CONFIG || {};
    if (g.supabaseUrl && g.supabaseKey) return { url: g.supabaseUrl, key: g.supabaseKey, fixed: true };
    try { const c = JSON.parse(store.getItem(CFG_KEY) || 'null'); if (c && c.url && c.key) return c; } catch { /* none */ }
    return null;
  }
  // Google and Apple show only when the hosted config turns them on (they must be enabled in Supabase first)
  function providers() {
    const g = window.MYO_CONFIG || {};
    const list = Array.isArray(g.oauthProviders) ? g.oauthProviders : g.supabaseUrl ? [] : ['google', 'apple'];
    return list.filter((p) => p === 'google' || p === 'apple');
  }
  function keyRole(k) {
    if (/^sb_secret_/.test(k)) return 'secret';
    if (/^sb_publishable_/.test(k)) return 'publishable';
    const p = k.split('.');
    if (p.length === 3) { try { const j = JSON.parse(atob(p[1].replace(/-/g, '+').replace(/_/g, '/'))); return j.role === 'service_role' ? 'secret' : j.role === 'anon' ? 'publishable' : 'unknown'; } catch { return 'unknown'; } }
    return 'unknown';
  }

  /* ── client ──────────────────────────────────────────────────────── */
  let libP = null;
  function loadLib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve(window.supabase);
    if (!libP) libP = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = LIB; s.async = true;
      s.onload = () => (window.supabase && window.supabase.createClient ? res(window.supabase) : rej(new Error('lib')));
      s.onerror = () => { libP = null; rej(new Error("Couldn't load the sign-in library. Check your connection and reload.")); };
      (document.head || document.documentElement).appendChild(s);
    });
    return libP;
  }
  async function init() {
    A.ready = false; A.err = ''; A.sb = null; A.session = null;
    const c = cfg();
    if (!c) { A.ready = true; refresh(); return; }
    try {
      const lib = await loadLib();
      A.sb = lib.createClient(c.url, c.key, { auth: { storage: store, storageKey: 'myo-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } });
      // never await Supabase calls inside this callback (the client holds a lock while it runs)
      A.sb.auth.onAuthStateChange((ev, session) => { setTimeout(() => onSession(session), 0); });
      const { data } = await A.sb.auth.getSession();
      await onSession(data && data.session);
    } catch (e) { A.err = friendly(e); }
    A.ready = true; refresh();
  }
  async function onSession(session) {
    const prev = A.user && A.user.id;
    A.session = session || null; A.user = session ? session.user : null;
    if (A.user && A.user.id !== prev) { A.step = 'email'; A.msg = ''; A.err = ''; await attach(); if (A.ready && !A.conflict) OS.toast(`Signed in as ${A.user.email || 'member'}`); }
    if (!A.user && prev) detach();
    refresh();
  }

  /* ── cloud sync: one jsonb row per member ────────────────────────── */
  async function attach() {
    A.syncErr = ''; A.conflict = null;
    try {
      const { data, error } = await A.sb.from(TABLE).select('state, updated_at').eq('user_id', A.user.id).maybeSingle();
      if (error) throw error;
      const local = OS.state, pristine = local.sample && !local.sampleEdited;
      if (data && data.state && data.state.v === 4) {
        const remoteAt = Date.parse(data.updated_at) || 0, localAt = local._savedAt || 0;
        if (pristine || localAt <= remoteAt) useRemote(data.state, data.updated_at);
        else { A.conflict = { at: data.updated_at, state: data.state }; OS.toast('Your account already has saved data. Choose which copy to keep on the Profile page.'); return; }
      } else await push(OS.state);
      link();
    } catch (e) { A.syncErr = syncHint(e); }
  }
  async function push(state) {
    const at = new Date(state._savedAt || Date.now()).toISOString();
    const { error } = await A.sb.from(TABLE).upsert({ user_id: A.user.id, state, updated_at: at });
    if (error) throw error;
    A.syncedAt = at;
  }
  function useRemote(state, at) { OS.state = state; A.syncedAt = at; try { localStorage.setItem('myokinetics-os-v4', JSON.stringify(state)); } catch { /* memory only */ } OS.render(); }
  function link() {
    if (OS.Persist.mode !== 'cloud') A.prevMode = OS.Persist.mode;
    OS.Persist.cloud = { save: async (state) => { if (!A.user || A.conflict) return; try { await push(state); A.syncErr = ''; } catch (e) { A.syncErr = syncHint(e); } if (OS.current === 'profile') paintSync(); } };
    OS.Persist.mode = 'cloud'; OS.emit('header');
  }
  function detach() { OS.Persist.cloud = null; if (OS.Persist.mode === 'cloud') OS.Persist.mode = A.prevMode || 'device'; A.conflict = null; A.syncedAt = null; A.syncErr = ''; OS.emit('header'); }

  /* ── messages ────────────────────────────────────────────────────── */
  function friendly(e) {
    const m = String((e && (e.message || e.error_description || e.msg)) || e || '');
    if (/failed to fetch|networkerror|load failed|fetch/i.test(m)) return IN_CLAUDE ? "Claude's viewer blocks connections to Supabase. Open Myo at its own web address to sign in." : "Couldn't reach Supabase. Check your connection and the project URL.";
    if (/rate limit|too many|security purposes/i.test(m)) return 'Too many requests. Wait a minute, then try again.';
    if (/invalid api key|no api key|apikey/i.test(m)) return 'Supabase rejected the publishable key. Copy it again from Project Settings → API Keys.';
    if (/signups? not allowed|otp.*disabled/i.test(m)) return 'New sign-ups are turned off. Enable email sign-ups in Supabase → Authentication → Sign In / Providers.';
    if (/provider is not enabled|unsupported provider/i.test(m)) return 'That sign-in option is not turned on. Enable it in Supabase → Authentication → Sign In / Providers.';
    if (/expired|invalid.*(otp|token)|token.*invalid/i.test(m)) return "That code didn't match or has expired. Use the newest email, or send a new code.";
    return m || 'Sign-in failed. Try again.';
  }
  function syncHint(e) {
    const m = String((e && e.message) || e || '');
    if (/does not exist|schema cache|member_state/i.test(m)) return 'Signed in, but cloud sync is off: run supabase/schema.sql in the Supabase SQL editor to create the member_state table.';
    if (/row-level security|permission denied/i.test(m)) return 'A Row Level Security policy refused the save. Run supabase/schema.sql again to restore the member policies.';
    return friendly(e);
  }

  /* ── view ────────────────────────────────────────────────────────── */
  const nameOf = (u) => (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || (u.email || 'Member').split('@')[0];
  const initials = (u) => nameOf(u).split(/[\s._-]+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'M';
  const when = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
  const WHY = [['Your data on every device', 'Logs, labs, plans and settings sync to your private row.'], ['Wearables, securely', 'The proxy uses your sign-in to find your Oura and WHOOP connections. Tokens never reach this page.'], ['Private by default', 'Row Level Security lets each member read only their own row. Photos and scans stay on this device.'], ['No password to remember', 'A one-time code by email. The same code creates your account.']];

  function card() {
    const c = cfg();
    const status = !c ? pill('muted', 'Not set up') : A.user ? pill('good', 'Signed in') : A.ready ? pill('muted', 'Signed out') : pill('muted', 'Checking');
    const note = IN_CLAUDE ? `<div class="banner" role="note"><strong>You're viewing Myo inside Claude.</strong> Here your data already saves to your Claude account. Supabase sign-in needs Myo's own web address, because Claude's viewer blocks outside connections.</div>` : '';
    let body;
    if (!c || A.editCfg) body = cfgForm(c);
    else if (!A.ready) body = '<p class="muted">Checking your session…</p>';
    else if (A.user) body = signedIn();
    else body = A.step === 'code' ? codeForm() : emailForm();
    return `<section class="card acct" id="acct">
      <div class="card-h"><h2>Myo account</h2><span class="row">${status}<span class="muted small">Sign-in by Supabase</span></span></div>
      ${note}
      <div class="acct-grid"><div class="acct-main">${body}${A.err ? `<p class="acct-err" role="alert">${esc(A.err)}</p>` : ''}</div>
        <ul class="acct-why">${WHY.map(([a, b]) => `<li><b>${a}</b><span>${b}</span></li>`).join('')}</ul></div>
    </section>`;
  }
  function cfgForm(c) {
    return `<form data-submit="acct-cfg" class="stack-sm" autocomplete="off">
      <p class="small">Connect the Supabase project that holds Myo member accounts.</p>
      <label class="field" for="acct-url"><span>Project URL</span><input id="acct-url" name="url" type="url" inputmode="url" spellcheck="false" placeholder="https://your-project.supabase.co" value="${esc(c && !c.fixed ? c.url : '')}"></label>
      <label class="field" for="acct-key"><span>Publishable key (sb_publishable_…, or the legacy anon key)</span><input id="acct-key" name="key" spellcheck="false" placeholder="sb_publishable_…" value=""></label>
      <div class="row"><button class="btn">Connect project</button>${c ? '<button type="button" class="btn ghost" data-act="acct-cfg-cancel">Cancel</button>' : ''}</div>
      <p class="fine">Both are in Supabase → Project Settings → API Keys. Never paste a secret or service_role key: those stay on the server. Then run supabase/schema.sql once so cloud sync has its table.</p>
    </form>`;
  }
  function emailForm() {
    return `<form data-submit="acct-code" class="stack-sm">
      <label class="field" for="acct-email"><span>Email</span><input id="acct-email" name="email" type="email" autocomplete="email" spellcheck="false" placeholder="you@example.com" value="${esc(A.email)}"></label>
      <button class="btn" ${A.busy ? 'disabled' : ''}>${A.busy ? 'Sending…' : 'Email me a sign-in code'}</button>
    </form>
    ${providers().length ? `<div class="acct-or">or</div>
    <div class="acct-providers">${providers().map((p) => `<button type="button" class="btn ghost" data-act="acct-oauth" data-p="${p}">Continue with ${p === 'google' ? 'Google' : 'Apple'}</button>`).join('')}</div>` : ''}
    <p class="fine">New here? The same code creates your account. By signing in you agree to the <a href="terms.html">terms</a> and <a href="privacy.html">privacy policy</a>. ${cfg() && !cfg().fixed ? '<button type="button" class="link small" data-act="acct-cfg-edit">Change Supabase project</button>' : ''}</p>`;
  }
  function codeForm() {
    return `<p class="small">${esc(A.msg)}</p>
    <form data-submit="acct-verify" class="stack-sm">
      <label class="field" for="acct-otp"><span>Sign-in code</span><input id="acct-otp" name="code" class="acct-otp" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="••••••"></label>
      <button class="btn" ${A.busy ? 'disabled' : ''}>${A.busy ? 'Checking…' : 'Sign in'}</button>
    </form>
    <div class="row"><button type="button" class="link small" data-act="acct-resend">Send a new code</button><button type="button" class="link small" data-act="acct-back">Use a different email</button></div>`;
  }
  function signedIn() {
    const u = A.user, prov = (u.app_metadata && u.app_metadata.provider) || 'email';
    const conflict = A.conflict ? `<div class="banner warn" role="alert"><strong>Two copies of your data.</strong> Your account was last saved ${esc(when(A.conflict.at))}; this device has newer changes from ${esc(when(new Date(OS.state._savedAt || Date.now()).toISOString()))}. Sync is paused until you choose.
        <div class="row" style="margin-top:8px"><button class="btn sm" data-act="acct-keep-remote">Use my account's copy</button><button class="btn ghost sm" data-act="acct-keep-local">Keep this device's copy</button></div></div>` : '';
    return `<div class="acct-id"><span class="acct-av" aria-hidden="true">${esc(initials(u))}</span><div><b>${esc(nameOf(u))}</b><span class="muted small block">${esc(u.email || '')} · ${esc(prov === 'email' ? 'email code' : prov[0].toUpperCase() + prov.slice(1))}</span></div></div>
      ${conflict}
      <dl class="dl"><dt>Cloud sync</dt><dd id="acct-sync">${syncText()}</dd><dt>Member ID</dt><dd class="mono small">${esc(u.id.slice(0, 8))}…</dd></dl>
      <div class="row"><button class="btn ghost" data-act="acct-out">Sign out</button></div>`;
  }
  const syncText = () => A.syncErr ? `<span class="acct-err">${esc(A.syncErr)}</span>` : A.conflict ? 'Paused' : A.syncedAt ? `On · last saved ${esc(when(A.syncedAt))}` : 'Starting…';
  function paintSync() { const el = document.getElementById('acct-sync'); if (el) el.innerHTML = syncText(); }
  function refresh() { OS.emit('header'); if (OS.current === 'profile' && OS.state) OS.render(); }
  const focusLater = (id) => setTimeout(() => { const el = document.getElementById(id); if (el) el.focus(); }, 30);
  const here = () => location.origin + location.pathname;

  /* ── actions ─────────────────────────────────────────────────────── */
  OS.act('acct-cfg', (f) => {
    const url = f.elements.url.value.trim().replace(/\/+$/, ''), key = f.elements.key.value.trim();
    if (!/^https:\/\/[^\s/]+$/.test(url)) { A.err = 'Enter the project URL, like https://your-project.supabase.co'; return refresh(); }
    const role = keyRole(key);
    if (role === 'secret') { A.err = "That's a secret key. Use the publishable key here; secret keys must stay on the server."; return refresh(); }
    if (!key || role === 'unknown') { A.err = 'Paste the publishable key (starts with sb_publishable_) or the legacy anon key.'; return refresh(); }
    store.setItem(CFG_KEY, JSON.stringify({ url, key })); A.editCfg = false; A.err = '';
    init();
  });
  OS.act('acct-cfg-edit', () => { A.editCfg = true; A.err = ''; refresh(); focusLater('acct-url'); });
  OS.act('acct-cfg-cancel', () => { A.editCfg = false; A.err = ''; refresh(); });
  async function sendCode(email) {
    A.busy = true; A.err = ''; refresh();
    let error = null;
    try { ({ error } = await A.sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: here() } })); } catch (e) { error = e; }
    A.busy = false;
    if (error) { A.err = friendly(error); return refresh(); }
    A.email = email; A.step = 'code'; A.msg = `We sent a sign-in code to ${email}. Enter it below.`;
    refresh(); focusLater('acct-otp');
  }
  OS.act('acct-code', (f) => {
    const email = f.elements.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { A.err = 'Enter a valid email address.'; A.email = email; refresh(); return focusLater('acct-email'); }
    if (A.sb) sendCode(email);
  });
  OS.act('acct-resend', () => { if (A.sb && A.email) sendCode(A.email); });
  OS.act('acct-back', () => { A.step = 'email'; A.err = ''; refresh(); focusLater('acct-email'); });
  OS.act('acct-verify', async (f) => {
    const token = f.elements.code.value.replace(/\D/g, '');
    if (token.length < 6) { A.err = 'Enter the code from the email (6 digits or more).'; refresh(); return focusLater('acct-otp'); }
    A.busy = true; A.err = ''; refresh();
    let error = null;
    try { ({ error } = await A.sb.auth.verifyOtp({ email: A.email, token, type: 'email' })); } catch (e) { error = e; }
    A.busy = false;
    if (error) { A.err = friendly(error); refresh(); return focusLater('acct-otp'); }
    refresh(); // onAuthStateChange finishes sign-in and sync
  });
  OS.act('acct-oauth', async (el) => {
    if (!A.sb) return;
    if (IN_CLAUDE) { A.err = "Google and Apple sign-in open a new page, which Claude's viewer can't do. Open Myo at its own web address."; return refresh(); }
    let error = null;
    try { ({ error } = await A.sb.auth.signInWithOAuth({ provider: el.dataset.p, options: { redirectTo: here() } })); } catch (e) { error = e; }
    if (error) { A.err = friendly(error); refresh(); }
  });
  OS.act('acct-out', async () => {
    try { await A.sb.auth.signOut(); } catch { /* local session cleared anyway */ }
    OS.toast('Signed out. Your data stays on this device.');
  });
  OS.act('acct-keep-remote', () => { const c = A.conflict; if (!c) return; A.conflict = null; useRemote(c.state, c.at); link(); OS.toast("Loaded your account's copy"); });
  OS.act('acct-keep-local', async () => {
    if (!A.conflict) return;
    A.conflict = null;
    try { await push(OS.state); link(); OS.toast("Saved this device's copy to your account"); } catch (e) { A.syncErr = syncHint(e); }
    refresh();
  });

  OS.auth = {
    get user() { return A.user; },
    get url() { const c = cfg(); return c ? c.url : ''; },   // the Supabase project, for the Ingest API and other functions
    initials: () => (A.user ? initials(A.user) : ''),
    async token() { if (!A.sb || !A.session) return null; try { const { data } = await A.sb.auth.getSession(); return data.session ? data.session.access_token : null; } catch { return null; } },
    // data rights: deletes the member's account; every member table cascades (migration 20261125090000)
    async deleteAccount() {
      if (!A.sb || !A.user) return;
      const { error } = await A.sb.rpc('delete_my_account');
      if (error) throw new Error(/could not find the function|does not exist|schema cache/i.test(error.message || '') ? "Account deletion isn't switched on for this Myo project yet (the delete_my_account migration needs deploying). Nothing was removed." : friendly(error));
      detach();
      try { await A.sb.auth.signOut({ scope: 'local' }); } catch { /* session cleared with the device data */ }
    },
    card
  };
  init();
})();
