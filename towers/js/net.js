/* Lapisan online: server Node, Supabase, dan leaderboard GitHub. Semuanya opsional. */
(function () {
  const cfg = window.TOWERS_CONFIG || {};
  const trim = s => String(s || '').replace(/\/+$/, '');
  const api = trim(cfg.apiUrl), supa = trim(cfg.supabaseUrl), key = cfg.supabaseKey || '';
  let repo = cfg.githubRepo || '';
  if (!repo && location.hostname.endsWith('.github.io')) {
    const owner = location.hostname.split('.')[0], name = location.pathname.split('/')[1];
    repo = owner + '/' + (name || location.hostname);
  }
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem('towers.' + k)) ?? d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('towers.' + k, JSON.stringify(v)); } catch (e) { /* penyimpanan diblokir */ } }
  };
  let session = store.get('session', null);
  const hasSupa = !!(supa && key);

  async function request(url, opt) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 12000);
    try {
      const r = await fetch(url, Object.assign({ signal: ctl.signal }, opt));
      const text = await r.text();
      let body = null; try { body = text ? JSON.parse(text) : null; } catch (e) { /* bukan JSON */ }
      if (!r.ok) throw new Error((body && (body.error_description || body.msg || body.message || body.error)) || 'HTTP ' + r.status);
      return body;
    } finally { clearTimeout(timer); }
  }

  function saveSession(s) {
    session = s && s.access_token ? { token: s.access_token, refresh: s.refresh_token, expires: Date.now() + (s.expires_in || 3600) * 1000, id: s.user.id, email: s.user.email } : null;
    store.set('session', session);
    return session;
  }
  const auth = (path, body) => request(`${supa}/auth/v1/${path}`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  async function token() {
    if (!session) return null;
    if (Date.now() > session.expires - 60000) {
      try { saveSession(await auth('token?grant_type=refresh_token', { refresh_token: session.refresh })); }
      catch (e) { saveSession(null); }
    }
    return session && session.token;
  }
  async function rest(path, opt = {}) {
    const t = await token(), headers = Object.assign({ apikey: key, 'Content-Type': 'application/json' }, opt.headers);
    if (t) headers.Authorization = 'Bearer ' + t;
    else if (key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key;
    return request(`${supa}/rest/v1/${path}`, Object.assign({}, opt, { headers }));
  }

  function best(rows) {
    const seen = new Set();
    return rows.sort((a, b) => b.score - a.score).filter(r => !seen.has(r.name) && seen.add(r.name)).slice(0, 20);
  }

  const encode = rep => 'TOWERS1:' + btoa(JSON.stringify(rep));

  window.KNet = {
    store, repo, hasServer: !!api, hasSupa, encode,
    get user() { return session; },
    async signUp(email, password) { const r = await auth('signup', { email, password }); return !!saveSession(r); },
    async signIn(email, password) { saveSession(await auth('token?grant_type=password', { email, password })); },
    signOut() { saveSession(null); },
    async loadCloud() { if (!await token()) return null; const r = await rest(`saves?user_id=eq.${session.id}&select=data`); return r && r[0] ? r[0].data : null; },
    async saveCloud(data) {
      if (!await token()) return;
      await rest('saves?on_conflict=user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ user_id: session.id, data, updated_at: new Date().toISOString() }) });
    },
    addLocal(board, row) { const all = store.get('scores', {}); all[board] = [...(all[board] || []), row].sort((a, b) => b.score - a.score).slice(0, 20); store.set('scores', all); },
    local(board) { return store.get('scores', {})[board] || []; },
    async github(board) { const all = await request('data/leaderboard.json?t=' + Date.now()); return (all && all[board]) || []; },
    async online(board) {
      if (api) return request(`${api}/api/scores?board=${encodeURIComponent(board)}`);
      if (hasSupa) return best(await rest(`scores?board=eq.${encodeURIComponent(board)}&select=name,score,wave,stars,verified&order=score.desc&limit=100`));
      throw new Error('Leaderboard online belum diaktifkan. Lihat README bagian "Online features".');
    },
    /* Server memverifikasi replay. Tanpa server, Supabase menerima skor "belum terverifikasi". */
    async submit(name, replay, result, board) {
      if (api) return request(api + '/api/scores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, replay }) });
      if (hasSupa) {
        if (!await token()) throw new Error('Masuk ke akun dulu untuk mengirim skor');
        await rest('scores', { method: 'POST', body: JSON.stringify({ user_id: session.id, name, board, score: result.score, wave: result.wave, stars: result.stars, verified: false }) });
        return { ok: true };
      }
      throw new Error('Pengiriman online belum diaktifkan');
    },
    /* Membuka form Issue; GitHub Actions memverifikasi replay lalu memperbarui leaderboard. */
    issue(board, replay) {
      const code = encode(replay), base = `https://github.com/${repo}/issues/new?title=${encodeURIComponent('[score] ' + board)}&body=`;
      const full = base + encodeURIComponent('Kirim skor Towers. Jangan ubah kode di bawah.\n\n' + code);
      if (full.length < 7000) return { url: full, code, paste: false };
      return { url: base + encodeURIComponent('Tempel kode skor di sini (sudah disalin):\n\n'), code, paste: true };
    }
  };
})();
