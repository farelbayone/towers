/* Server Towers (Node 18+, tanpa dependensi).
   Memverifikasi replay lalu menyimpan skor ke Supabase atau file JSON. */
const http = require('http'), fs = require('fs'), path = require('path');
const M = require('../js/missions.js');

const PORT = process.env.PORT || 8787;
const ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'scores.json');
const SUPA = (process.env.SUPABASE_URL || '').replace(/\/+$/, ''), KEY = process.env.SUPABASE_SERVICE_KEY || '';
const MAX_BODY = 120 * 1024;
const BOARD = /^[a-z0-9-]{3,60}$/;

const readFile = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; return {}; } };
async function supa(pathname, opt = {}) {
  const headers = { apikey: KEY, 'Content-Type': 'application/json' };
  if (KEY.startsWith('eyJ')) headers.Authorization = 'Bearer ' + KEY;
  const r = await fetch(`${SUPA}/rest/v1/${pathname}`, Object.assign({ headers, signal: AbortSignal.timeout(10000) }, opt));
  if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + await r.text());
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}
const top = rows => { const seen = new Set(); return rows.sort((a, b) => b.score - a.score).filter(r => !seen.has(r.name) && seen.add(r.name)).slice(0, 20); };

async function list(board) {
  if (SUPA && KEY) return top(await supa(`scores?board=eq.${board}&verified=is.true&select=name,score,wave,stars,verified&order=score.desc&limit=100`));
  return readFile()[board] || [];
}
async function save(board, row) {
  if (SUPA && KEY) return supa('scores', { method: 'POST', body: JSON.stringify(Object.assign({ board }, row)) });
  const all = readFile();
  all[board] = top([...(all[board] || []), row]);
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE + '.tmp', JSON.stringify(all, null, 1));
  fs.renameSync(FILE + '.tmp', FILE);
}

/* Batas sederhana: 10 kiriman per menit per alamat. */
const hits = new Map();
function limited(ip) {
  const now = Date.now(), recent = (hits.get(ip) || []).filter(t => now - t < 60000);
  recent.push(now); hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 10;
}
function validDaily(spec) {
  if (spec.mode !== 'daily') return true;
  const age = Date.parse(M.today()) - Date.parse(spec.date);
  return age >= 0 && age <= 86400000;
}

const server = http.createServer((req, res) => {
  const send = (code, body) => {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };
  const fail = e => { console.error(e); send(500, { error: 'Kesalahan server' }); };
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch (e) { return send(400, { error: 'URL tidak valid' }); }
  if (req.method === 'OPTIONS') return send(204);
  if (req.method === 'GET' && url.pathname === '/api/health') return send(200, { ok: true, storage: SUPA && KEY ? 'supabase' : 'file' });
  if (url.pathname !== '/api/scores') return send(404, { error: 'Tidak ditemukan' });
  if (req.method === 'GET') {
    const board = url.searchParams.get('board') || '';
    if (!BOARD.test(board)) return send(400, { error: 'Parameter board tidak valid' });
    return list(board).then(rows => send(200, rows), fail);
  }
  if (req.method !== 'POST') return send(405, { error: 'Metode tidak didukung' });
  if (limited(req.socket.remoteAddress)) return send(429, { error: 'Terlalu sering, coba lagi sebentar' });
  let size = 0; const chunks = [];
  req.on('data', c => { size += c.length; if (size > MAX_BODY) { send(413, { error: 'Data terlalu besar' }); req.destroy(); } else chunks.push(c); });
  req.on('end', async () => {
    if (res.writableEnded) return;
    try {
      let body, result;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!validDaily(body.replay.spec)) return send(400, { error: 'Tantangan harian sudah berakhir' });
        result = M.verify(body.replay);
      } catch (e) { return send(400, { error: 'Data tidak valid' }); }
      if (!result.ok) return send(422, { error: result.error });
      const name = String(body.name || '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 20) || 'Anonim';
      await save(result.key, { name, score: result.score, wave: result.wave, stars: result.stars, verified: true });
      send(201, result);
    } catch (e) { fail(e); }
  });
});
if (require.main === module) server.listen(PORT, () => console.log(`Towers API di http://localhost:${PORT}`));
module.exports = server;
