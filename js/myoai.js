/* ═══ MYO — HOSTED AI: Myo AI on Myo's own web address, through the myo-ai function ═══
   Same shape as Claude's sample(): sample(messages, { tools, signal, onText }) → { text, truncated }.
   The server owns the system prompt and the tool definitions; this client streams one model turn per request,
   runs any tool calls here in the browser (they change only this member's data), and posts the results back,
   keeping each turn's content unchanged so the model's reasoning carries through the tool loop.
   Only signed-in members can use it. Inside Claude, Claude's own sample capability is used instead. */
(function () {
  'use strict';
  const IN_CLAUDE = !!(window.claude && window.claude.use);
  const endpoint = () => {
    const g = window.MYO_CONFIG || {};
    if (g.myoAi) return g.myoAi.replace(/\/+$/, '') + '/v1/chat';
    return OS.auth && OS.auth.url ? OS.auth.url.replace(/\/+$/, '') + '/functions/v1/myo-ai/v1/chat' : '';
  };
  const fail = (code, message) => Object.assign(new Error(message), { code });

  // the tool input must match the tool's schema before it runs (inputs stream in, so the server doesn't check them)
  function check(input, schema) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Tool input must be an object.');
    const props = (schema && schema.properties) || {};
    (schema && schema.required || []).forEach((k) => { if (input[k] == null || input[k] === '') throw new Error(`Missing ${k}.`); });
    Object.entries(input).forEach(([k, v]) => {
      const p = props[k]; if (!p) return;
      if (p.type === 'string' && typeof v !== 'string') throw new Error(`${k} must be text.`);
      if (p.type === 'number' && !Number.isFinite(Number(v))) throw new Error(`${k} must be a number.`);
      if (p.enum && !p.enum.includes(v)) throw new Error(`${k} must be one of ${p.enum.join(', ')}.`);
    });
  }

  // Server-Sent Events from the function: "text" deltas, then "done" with the final message, or "error"
  async function read(res, onDelta) {
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = '', done = null;
    for (;;) {
      const { value, done: end } = await reader.read();
      if (value) buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
        const ev = (/^event: (.*)$/m.exec(chunk) || [])[1], line = (/^data: (.*)$/m.exec(chunk) || [])[1];
        if (!ev || line == null) continue;
        let data; try { data = JSON.parse(line); } catch { continue; }
        if (ev === 'text') onDelta(data.t || '');
        else if (ev === 'done') done = data.message;
        else if (ev === 'error') throw fail(data.code || 'error', data.message || 'Myo AI failed.');
      }
      if (end) break;
    }
    if (!done) throw fail('unavailable', 'The answer was cut off. Try again.');
    return done;
  }

  async function sample(messages, { tools = [], signal, onText } = {}) {
    const url = endpoint();
    if (!url) throw fail('unavailable', "Myo AI isn't set up for this site.");
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
    const convo = messages.map((m) => ({ role: m.role, content: m.content }));
    let text = '';
    for (let round = 0; round < 6; round++) {
      const token = OS.auth && (await OS.auth.token());
      if (!token) throw fail('not_signed_in', 'Sign in on Profile to talk to Myo AI.');
      let res;
      try { res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: convo }), signal }); }
      catch (e) { if (signal && signal.aborted) throw fail('cancelled', 'Stopped.'); throw fail('unavailable', "Myo AI can't be reached from here right now."); }
      if (!res.ok) {
        let j = {}; try { j = await res.json(); } catch { /* not JSON */ }
        throw fail(j.code || (res.status === 429 ? 'rate_limited' : res.status === 401 ? 'not_signed_in' : 'unavailable'), j.message || `Myo AI answered ${res.status}.`);
      }
      const sep = text && !/\n\s*$/.test(text) ? '\n\n' : '';
      let first = true;
      const msg = await read(res, (d) => { text += (first ? sep : '') + d; first = false; if (onText) onText({ text, delta: d }); });
      const uses = (msg.content || []).filter((b) => b.type === 'tool_use');
      if (msg.stop_reason === 'refusal') return { text: text || "Myo can't help with that one. Ask about your training, labs, sleep, food or recovery.", truncated: false };
      if (msg.stop_reason !== 'tool_use' || !uses.length) return { text, truncated: msg.stop_reason === 'max_tokens' };
      convo.push({ role: 'assistant', content: msg.content });
      const results = await Promise.all(uses.map(async (u) => {
        try {
          const t = byName[u.name];
          if (!t) throw new Error(`Unknown tool ${u.name}.`);
          check(u.input, t.inputSchema);
          const out = await t.execute(u.input);
          return { type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(out == null ? { ok: true } : out) };
        } catch (e) { return { type: 'tool_result', tool_use_id: u.id, content: String((e && e.message) || e), is_error: true }; }
      }));
      convo.push({ role: 'user', content: results });
    }
    return { text, truncated: true };
  }
  sample.hosted = true;

  OS.myoAi = {
    // usable on a hosted copy for a signed-in member, with a project to call
    ready: () => !IN_CLAUDE && !!(OS.auth && OS.auth.user) && !!endpoint(),
    configured: () => !IN_CLAUDE && !!endpoint(),
    sample
  };
})();
