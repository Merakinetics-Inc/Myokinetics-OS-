/* ═══ MYO — YOUR DATA RIGHTS: download a copy, restore from a copy, delete everything ═══
   Download: a JSON file of everything Myo stores for the member (photos and scans stay in IndexedDB and
   are not in it). Restore: accepts that file, or a raw state, after a check and a confirmation.
   Delete: this device (state, settings, photos, scans) and, when signed in, the Myo account through the
   delete_my_account() database function, which cascades to every member table. Two steps, no undo. */
(function () {
  'use strict';
  const { esc, icon } = OS;
  let step = null, pending = null, msg = '', busy = false;
  const LS_PREFIX = /^(myo|myokinetics)/, KEEP = new Set(['myo-look']);
  const IDB = ['mk-imaging', 'mk-scan'];

  function exportJSON() {
    const u = OS.auth && OS.auth.user;
    return JSON.stringify({
      app: 'Myo', format: 'myo-export', formatVersion: 1, version: OS.VERSION, exportedAt: new Date().toISOString(),
      account: u ? { id: u.id, email: u.email || null } : null,
      note: 'Everything Myo stores for you. Progress photos and imaging scans stay in your browser and are not in this file.',
      state: OS.state,
      mind: OS.mind ? OS.mind.read() : null
    }, null, 2);
  }
  async function download() {
    const json = exportJSON(), name = `myo-data-${OS.dayKey()}.json`, dl = OS.caps && OS.caps.downloads;
    if (dl) { try { await dl.save({ filename: name, data: json }); OS.toast('Saved your data file'); } catch { /* declined */ } return; }
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    OS.toast('Downloaded your data file');
  }
  // a file is accepted only if it looks like Myo state
  function parse(text) {
    let j; try { j = JSON.parse(text); } catch { throw new Error("That file isn't valid JSON."); }
    const st = j && j.format === 'myo-export' ? j.state : j;
    const ok = st && st.v === 4 && Array.isArray(st.markers) && st.profile && st.training && st.nutrition && st.life;
    if (!ok) throw new Error("That file isn't a Myo data file.");
    return { state: st, at: j.exportedAt || st._savedAt || null, mind: j && j.format === 'myo-export' && j.mind && typeof j.mind === 'object' ? j.mind : null };
  }

  function card(s) {
    const signed = !!(OS.auth && OS.auth.user);
    let confirm = '';
    if (step === 'restore' && pending) {
      const n = pending.state.markers.filter(OS.hasValue).length;
      confirm = `<div class="confirm" role="group" aria-label="Restore from file"><p><b>Replace your data with this file?</b> It holds ${n} lab result${n === 1 ? '' : 's'}${pending.at ? `, saved ${esc(new Date(pending.at).toLocaleDateString())}` : ''}. Everything Myo stores now is replaced${signed ? ', here and in your Myo account' : ''}.</p>
        <div class="row"><button class="btn" data-act="rights-restore-go">Replace with the file</button><button class="btn ghost" data-act="rights-cancel">Cancel</button></div></div>`;
    } else if (step === 'delete') {
      confirm = `<div class="confirm danger-zone" role="group" aria-label="Delete everything"><p><b>Delete everything?</b> This removes your data, settings, progress photos and scans from this browser${signed ? ', and deletes your Myo account with its cloud copy, wearable connections and Ingest API keys' : ''}. You can't undo it. Download a copy first if you might want it.</p>
        <div class="row"><button class="btn danger" data-act="rights-delete-go" ${busy ? 'disabled' : ''}>${busy ? 'Deleting…' : signed ? 'Delete my account and data' : 'Delete my data'}</button><button class="btn ghost" data-act="rights-cancel">Keep everything</button></div></div>`;
    }
    return `<section class="card rights" id="rights">
      <div class="card-h"><h2>Your data rights</h2><span class="muted small">Download, restore or delete, any time</span></div>
      <p class="small">Myo keeps your data on this device${signed ? ' and in your private Myo account row' : ''}. Photos and scans never leave this browser. Read the <a href="privacy.html">privacy policy</a> and <a href="terms.html">terms</a>.</p>
      <div class="row">
        <button class="btn ghost" data-act="data-export">${icon('download', 16)} Download my data</button>
        <label class="btn ghost rights-file">${icon('upload', 16)} Restore from a file<input type="file" accept="application/json,.json" data-change="rights-file" class="sr"></label>
        <button class="btn ghost danger-t" data-act="rights-delete">${signed ? 'Delete my account' : 'Delete my data'}</button>
      </div>
      ${confirm}
      ${msg ? `<p class="acct-err" role="alert">${esc(msg)}</p>` : ''}
    </section>`;
  }

  async function wipeDevice() {
    try { Object.keys(localStorage).filter((k) => LS_PREFIX.test(k) && !KEEP.has(k)).forEach((k) => localStorage.removeItem(k)); } catch { /* none */ }
    try { Object.keys(sessionStorage).filter((k) => LS_PREFIX.test(k)).forEach((k) => sessionStorage.removeItem(k)); } catch { /* none */ }
    await Promise.all(IDB.map((n) => new Promise((r) => { try { const q = indexedDB.deleteDatabase(n); q.onsuccess = q.onerror = q.onblocked = () => r(); } catch { r(); } })));
    if (OS.Persist.ref) { try { await OS.Persist.ref.delete(); } catch { /* Claude account copy */ } }
  }

  OS.act('data-export', () => download());
  OS.act('rights-cancel', () => { step = null; pending = null; msg = ''; OS.render(); });
  OS.act('rights-delete', () => { step = 'delete'; msg = ''; OS.render(); const b = document.querySelector('[data-act="rights-delete-go"]'); if (b) b.focus(); });
  OS.change('rights-file', (el) => {
    const f = el.files && el.files[0]; el.value = '';
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) { msg = 'That file is too large to be a Myo data file.'; return OS.render(); }
    f.text().then((t) => { pending = parse(t); step = 'restore'; msg = ''; OS.render(); }).catch((e) => { msg = e.message; step = null; OS.render(); });
  });
  OS.act('rights-restore-go', () => {
    if (!pending) return;
    const st = pending.state; st._savedAt = Date.now();
    if (pending.mind) { try { localStorage.setItem('myo-mind', JSON.stringify(pending.mind)); } catch { /* private mode */ } }
    OS.state = st; step = null; pending = null;
    OS.Persist.save(OS.state); OS.go('today'); OS.toast('Restored your data from the file');
  });
  OS.act('rights-delete-go', async () => {
    if (busy) return;
    busy = true; msg = ''; OS.render();
    try {
      if (OS.auth && OS.auth.user && OS.auth.deleteAccount) await OS.auth.deleteAccount();
    } catch (e) { busy = false; msg = (e && e.message) || "Your account couldn't be deleted. Nothing was removed; try again."; return OS.render(); }
    OS.Persist.cloud = null; clearTimeout(OS.Persist.timer);
    await wipeDevice();
    location.hash = 'welcome';
    location.reload();
  });

  OS.on('route', (n) => { if (n !== 'profile' && !busy) { step = null; pending = null; msg = ''; } });
  OS.rights = { card, exportJSON, parse };
})();
