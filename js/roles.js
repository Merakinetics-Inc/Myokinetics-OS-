/* ═══ MYOKINETICS OS v4 — STAFF ROLES: who may open provider tools and admin features ═══
   Roles, lowest to highest: member, coach, clinician, admin. Members have no row; staff roles live in
   public.staff_roles (migration 20261128090000), readable only by their holder and changed only by an admin
   through set_staff_role(). Where the role comes from:
     · Inside Claude: the artifact's owner is admin; everyone else viewing it is a member.
     · Local development (localhost): admin, with a "preview as" switch to test the other roles.
     · Hosted with a Myo account: the role from my_staff_role(); signed out, or no row, is member.
   The lock here hides and locks pages in the app. The pages run on this device's data, so the hard
   boundary is on the server: functions such as content-scan check the role themselves. */
(function () {
  'use strict';
  const { esc, pill, icon } = OS;
  const ORDER = ['member', 'coach', 'clinician', 'admin'];
  const RANK = { member: 0, coach: 1, clinician: 2, admin: 3 };
  const LABEL = { member: 'Member', coach: 'Coach', clinician: 'Clinician', admin: 'Admin' };
  const ABOUT = {
    member: 'Everything for your own health and training.',
    coach: 'Adds case assessment and Myo Academy for the members you coach.',
    clinician: 'A coach, plus clinical sign-off on case assessments.',
    admin: 'Everything, plus staff roles and the lesson attention test.'
  };
  // route → lowest role that may open it
  const NEED = { cases: 'coach', academy: 'coach' };
  // feature → lowest role
  const PERM = { 'case-assess': 'coach', 'academy': 'coach', 'case-signoff': 'clinician', 'lesson-attention': 'admin', 'staff-manage': 'admin' };
  const PREVIEW_KEY = 'myo-role-preview';
  const LOCAL = typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const IN_CLAUDE = !!(window.claude && window.claude.use);

  const R = { role: 'member', source: 'signed-out', status: 'checking', uid: null, err: '', staff: null, staffErr: '', busy: false, ownerChecked: false };

  const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const write = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* memory only */ } };
  const at = (role, need) => (RANK[role] || 0) >= (RANK[need] || 0);

  function set(role, source, status = 'ready') {
    const was = `${R.role}|${R.status}`;
    R.role = RANK[role] != null ? role : 'member'; R.source = source; R.status = status;
    if (`${R.role}|${R.status}` !== was) changed();
  }
  function changed() {
    OS.emit('nav');
    const cur = OS.current;
    if (cur && (NEED[cur] || cur === 'myo' || cur === 'profile' || cur === 'system' || cur === 'learn')) OS.render();
  }

  /* ── resolving the role ──────────────────────────────────────────── */
  async function resolve() {
    if (LOCAL) {
      const p = read(PREVIEW_KEY);
      return set(RANK[p] != null ? p : 'admin', RANK[p] != null && p !== 'admin' ? 'preview' : 'local');
    }
    if (IN_CLAUDE) {
      if (R.ownerChecked) return;
      R.ownerChecked = true;
      try {
        const u = await window.claude.use('user');
        const owner = u ? await u.isOwner() : false;
        return set(owner ? 'admin' : 'member', owner ? 'owner' : 'viewer');
      } catch { return set('member', 'viewer'); }
    }
    const a = OS.auth;
    if (!a || !a.staffRole) return set('member', 'signed-out');   // no account module (or an older one): member
    if (!a.ready) { setTimeout(() => { if (R.status === 'checking' && !OS.auth.ready) set('member', 'signed-out'); }, 10000); return set('member', 'signed-out', 'checking'); }
    const u = a.user;
    if (!u) { R.uid = null; R.err = ''; return set('member', 'signed-out'); }
    if (R.uid === u.id) return;   // already looked up (or looking up) for this account
    R.uid = u.id; set(R.role, R.source, 'checking');
    // never leave a page on "Checking" when the database is slow: settle as member after 10 seconds
    const { role, error } = await Promise.race([a.staffRole(), new Promise((r) => setTimeout(() => r({ role: null, error: "Couldn't check your staff role just now. Reload to try again." }), 10000))]);
    if (R.uid !== u.id) return;   // signed out or switched account meanwhile
    R.err = error || '';
    set(role || 'member', 'account');
  }

  /* ── locking pages ───────────────────────────────────────────────── */
  const canSee = (route) => !NEED[route] || at(R.role, NEED[route]);
  const can = (perm) => !PERM[perm] || at(R.role, PERM[perm]);
  function locked(route) {
    const v = OS.views[route], need = NEED[route];
    if (R.status === 'checking') return `${OS.ui.head('Staff', v.title, '')}<section class="card"><p class="muted">Checking your access…</p></section>`;
    const how = IN_CLAUDE ? 'Inside Claude, only the owner of this Myo copy has staff access.'
      : R.source === 'signed-out' ? 'Sign in with your staff account on the Profile page. If your role was granted, the page opens.'
      : 'Your account is a member account. A Myo admin can grant you a staff role.';
    return `${OS.ui.head('Staff', v.title, '')}
      <section class="card role-lock" role="note">
        <span class="role-lock-ic" aria-hidden="true">${icon('lock', 22)}</span>
        <div><h2>This page is for Myo staff</h2>
          <p>${esc(v.title)} needs the ${esc(LABEL[need])} role or higher. You're using Myo as ${esc(article(LABEL[R.role]))} ${esc(LABEL[R.role].toLowerCase())}.</p>
          <p class="small muted">${esc(how)}</p>
          <div class="row"><a class="btn ghost" href="#profile">Your access</a><a class="btn ghost" href="#today">Back to Today</a></div></div>
      </section>`;
  }
  const article = (w) => (/^[aeiou]/i.test(w) ? 'an' : 'a');
  function guard() {
    Object.keys(NEED).forEach((n) => {
      const v = OS.views[n]; if (!v || v._guarded) return;
      const render = v.render, mount = v.mount;
      v.render = function (s, sc) { return canSee(n) && R.status !== 'checking' ? render.call(this, s, sc) : locked(n); };
      v.mount = function (root, s, sc) { return canSee(n) && R.status !== 'checking' && mount ? mount.call(this, root, s, sc) : undefined; };
      v._guarded = true;
    });
  }

  /* ── the access card on Profile ──────────────────────────────────── */
  const SOURCE = {
    local: 'Local development: every role is open here. Use Preview to test the others.',
    preview: 'Local development, previewing a lower role.',
    owner: 'You own this copy of Myo inside Claude.',
    viewer: 'Someone shared this copy of Myo with you inside Claude.',
    account: 'From your Myo account.',
    'signed-out': 'Signed out. Sign in to use a staff role.'
  };
  function card() {
    const r = R.role;
    const preview = LOCAL ? `<label class="field role-prev" for="role-prev"><span>Preview as</span><select id="role-prev" data-change="role-preview">${ORDER.map((x) => `<option value="${x}" ${x === r ? 'selected' : ''}>${LABEL[x]}</option>`).join('')}</select></label>` : '';
    const staff = r === 'admin' && R.source === 'account' ? staffPanel() : r === 'admin' ? `<p class="fine">Staff roles for the hosted app are granted in your Myo account's admin panel, which appears here when an admin signs in on Myo's own web address. See supabase/STAFF_ROLES.md.</p>` : '';
    return `<section class="card role-card" id="access">
      <div class="card-h"><h2>Your access</h2><span class="row">${R.status === 'checking' ? pill('muted', 'Checking') : pill(r === 'member' ? 'muted' : 'good', LABEL[r])}</span></div>
      <p class="small">${esc(ABOUT[r])}</p>
      <p class="fine">${esc(SOURCE[R.source] || '')}${R.err ? ` ${esc(R.err)}` : ''}</p>
      <ul class="role-ladder">${ORDER.map((x) => `<li class="${at(r, x) ? 'on' : ''}"><b>${LABEL[x]}</b><span class="muted small">${esc(ABOUT[x])}</span></li>`).join('')}</ul>
      ${preview}${staff}
    </section>`;
  }
  function staffPanel() {
    const list = R.staff;
    const rows = !list ? '<p class="muted small">Loading staff…</p>' : list.length ? `<table class="tbl"><thead><tr><th>Account</th><th>Role</th><th>Since</th></tr></thead><tbody>${list.map((x) => `<tr><td>${esc(x.email)}</td><td>${esc(LABEL[x.role] || x.role)}</td><td>${esc(OS.fmtDate(String(x.granted_at).slice(0, 10)))}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small">No staff yet.</p>';
    return `<div class="role-staff"><h3>Staff</h3>${R.staffErr ? `<p class="acct-err" role="alert">${esc(R.staffErr)}</p>` : rows}
      <form data-submit="role-grant" class="form-grid" autocomplete="off">
        <label class="field" for="rg-email"><span>Account email</span><input id="rg-email" name="email" type="email" spellcheck="false" placeholder="colleague@example.com"></label>
        <label class="field" for="rg-role"><span>Role</span><select id="rg-role" name="role">${ORDER.map((x) => `<option value="${x}">${x === 'member' ? 'Member (remove role)' : LABEL[x]}</option>`).join('')}</select></label>
        <div class="form-end"><button class="btn" ${R.busy ? 'disabled' : ''}>${R.busy ? 'Saving…' : 'Save role'}</button></div>
      </form>
      <p class="fine">The person needs a Myo account first (they sign in once). Changes take effect on their next page load. Every change records who made it.</p></div>`;
  }
  async function loadStaff() {
    if (!(R.role === 'admin' && R.source === 'account') || !OS.auth || !OS.auth.rpc) return;
    const { data, error } = await OS.auth.rpc('list_staff');
    R.staff = error ? [] : data || []; R.staffErr = error || '';
    if (OS.current === 'profile') OS.render();
  }

  OS.change('role-preview', (el) => { write(PREVIEW_KEY, el.value === 'admin' ? null : el.value); resolve(); OS.toast(`Previewing as ${LABEL[el.value]}`); });
  OS.act('role-grant', async (f) => {
    const email = f.elements.email.value.trim(), role = f.elements.role.value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { OS.toast('Enter the account email'); return; }
    R.busy = true; OS.render();
    const { data, error } = await OS.auth.rpc('set_staff_role', { target_email: email, new_role: role });
    R.busy = false;
    if (error) { R.staffErr = error; OS.render(); return; }
    R.staffErr = ''; OS.toast(`${email} is now ${article(LABEL[data] || data)} ${(LABEL[data] || data).toLowerCase()}`);
    R.staff = null; OS.render(); loadStaff();
  });

  OS.roles = {
    get role() { return R.role; }, get source() { return R.source; }, get status() { return R.status; },
    LABEL, NEED, PERM, RANK, can, canSee, card, refresh: () => { R.uid = null; return resolve(); }
  };
  OS.canSee = canSee;
  guard();
  OS.on('auth', () => { resolve().then(() => { if (R.role === 'admin' && R.source === 'account' && R.staff == null) loadStaff(); }); });
  OS.on('route', (n) => { if (n === 'profile' && R.role === 'admin' && R.source === 'account' && R.staff == null) loadStaff(); });
  resolve();
})();
