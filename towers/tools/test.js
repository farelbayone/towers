/* Tes aturan inti, replay, server, dan verifikasi issue. Jalankan: node tools/test.js */
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'towers-'));
process.env.DATA_FILE = path.join(tmp, 'scores.json');
process.env.LEADERBOARD = path.join(tmp, 'board.json');
delete process.env.SUPABASE_URL;
fs.writeFileSync(process.env.LEADERBOARD, '{}');
const D = require('../js/data.js'), P = require('../js/path.js'), C = require('../js/core.js'), M = require('../js/missions.js');
const { play, PLANS } = require('./simulate.js');
const server = require('../server/server.js'), verifyIssue = require('./verify-issue.js');

(async () => {
  D.MAPS.forEach((m, i) => {
    assert(m.rows.length === C.H && m.rows.every(r => r.length === C.W), m.id + ': size');
    const g = C.createGame(i, 'normal');
    g.spawns.forEach(s => assert(g.dist[s.y * C.W + s.x] > 0, m.id + ': path'));
  });

  const g = C.createGame(0, 'normal');
  g.gold = 9999;
  for (let y = 0; y < C.H; y++) C.build(g, 5, y, 'arrow');
  assert(g.towers.length === C.H - 1, 'the last gap in a wall must be refused');
  g.spawns.forEach(s => assert(P.trace(g.dist, C.W, C.H, s).pop().x === g.goal.x));
  assert(!C.act(M.newGame({ mode: 'mission', id: 0 }), ['b', 3, 3, 'tesla']), 'mission restrictions apply');

  const specs = [{ mode: 'mission', id: 5 }, { mode: 'free', map: 2, diff: 'normal' }, { mode: 'endless', map: 0, diff: 'normal' }, { mode: 'daily', date: M.today() }];
  let replay;
  for (const spec of specs) {
    const done = play(spec, PLANS[2]);
    assert(done.over, spec.mode + ' finishes');
    const rep = JSON.parse(JSON.stringify(M.toReplay(done))), res = M.verify(rep);
    assert(res.ok && res.score === done.score && res.wave === done.wave, spec.mode + ' replay: ' + res.error);
    if (spec.mode === 'free') replay = rep;
  }
  assert(!M.verify({ ...replay, actions: replay.actions.slice(1) }).ok || M.verify({ ...replay, actions: replay.actions.slice(1) }).score !== M.verify(replay).score, 'edited replay differs');
  assert(!M.verify({ ...replay, ticks: 10 }).ok, 'truncated replay rejected');
  assert(!M.verify({ ...replay, actions: [[0, 'b', 3, 3, '__proto__'], ...replay.actions] }).ok, 'bad action rejected');
  assert(!M.verify({ ...replay, spec: { mode: 'free', map: 99, diff: 'normal' } }).ok);

  await new Promise(r => server.listen(0, r));
  const url = `http://localhost:${server.address().port}/api/scores`;
  const post = body => fetch(url, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
  const good = await post({ name: '<b>Ani</b>', replay, score: 999999 });
  assert(good.status === 201);
  const rows = await (await fetch(url + '?board=free-twin-normal')).json();
  assert(rows.length === 1 && rows[0].name === 'bAnib' && rows[0].score === M.verify(replay).score, 'server computes score itself');
  assert((await post({ name: 'x', replay: { ...replay, ticks: 5 } })).status === 422);
  assert((await post('not json')).status === 400);
  assert((await post('null')).status === 400);
  assert((await fetch(url + '?board=../x')).status === 400);
  server.close();

  const event = body => ({ issue: { body, created_at: new Date().toISOString(), user: { login: 'tester' } } });
  assert(verifyIssue(event('TOWERS1:' + Buffer.from(JSON.stringify(replay)).toString('base64'))).ok);
  assert(JSON.parse(fs.readFileSync(process.env.LEADERBOARD))['free-twin-normal'][0].name === 'tester');
  assert(!verifyIssue(event('hello')).ok && !verifyIssue(event('TOWERS1:AAAA')).ok);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('All tests passed');
})().catch(e => { console.error(e); process.exit(1); });
