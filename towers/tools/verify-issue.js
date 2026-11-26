/* Dipanggil GitHub Actions. Isi issue adalah data tak tepercaya: hanya di-parse, tidak dieksekusi. */
const fs = require('fs'), path = require('path');
const M = require('../js/missions.js');
const FILE = process.env.LEADERBOARD || path.join(__dirname, '..', 'data', 'leaderboard.json');
const REPORT = process.env.REPORT || 'score-report.md';

function run(event) {
  const issue = event.issue, m = /TOWERS1:([A-Za-z0-9+/=]+)/.exec(String(issue.body || '').slice(0, 70000));
  if (!m) return { ok: false, error: 'Kode skor TOWERS1 tidak ditemukan.' };
  let rep, res;
  try {
    rep = JSON.parse(Buffer.from(m[1], 'base64').toString('utf8'));
    if (rep.spec.mode === 'daily') {
      const age = Date.parse(issue.created_at.slice(0, 10)) - Date.parse(rep.spec.date);
      if (!(age >= 0 && age <= 86400000)) return { ok: false, error: 'Tantangan harian sudah berakhir.' };
    }
    res = M.verify(rep);
  } catch (e) { return { ok: false, error: 'Kode skor rusak.' }; }
  if (!res.ok) return res;
  const name = String(issue.user.login).replace(/[^A-Za-z0-9[\]-]/g, '').slice(0, 39);
  const all = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const rows = all[res.key] || [], old = rows.find(r => r.name === name);
  if (!old || res.score > old.score) {
    all[res.key] = [...rows.filter(r => r.name !== name), { name, score: res.score, wave: res.wave, stars: res.stars, verified: true }]
      .sort((a, b) => b.score - a.score).slice(0, 20);
    fs.writeFileSync(FILE, JSON.stringify(all, null, 1) + '\n');
  }
  return res;
}

if (require.main === module) {
  const res = run(JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')));
  fs.writeFileSync(REPORT, res.ok
    ? `✅ Skor terverifikasi: **${res.score}** pada \`${res.key}\` (gelombang ${res.wave}).\n`
    : `❌ Skor ditolak: ${res.error}\n`);
}
module.exports = run;
