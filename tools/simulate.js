/* Bot memainkan semua misi tanpa tampilan untuk memastikan bisa dimenangkan.
   Jalankan: node tools/simulate.js */
const D = require('../js/data.js'), P = require('../js/path.js'), C = require('../js/core.js'), M = require('../js/missions.js');

function bestCell(g, type, maze) {
  const range = D.TOWERS[type].levels[0].range;
  let best = null, score = -Infinity;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const c = C.canBuild(g, x, y);
    if (!c.ok) continue;
    let len = 0, cover = 0;
    for (const s of g.spawns) {
      const path = P.trace(c.dist, g.w, g.h, s);
      len += path.length;
      cover += path.filter(p => (p.x - x) ** 2 + (p.y - y) ** 2 <= range * range).length;
    }
    const v = cover + len * maze;
    if (cover > 0 && v > score) { score = v; best = { x, y }; }
  }
  return best;
}

const PLANS = [];
for (const order of [
  ['arrow', 'arrow', 'arrow', 'frost', 'cannon', 'tesla', 'tesla', 'cannon'],
  ['arrow', 'cannon', 'arrow', 'frost', 'arrow', 'tesla', 'cannon', 'arrow'],
  ['arrow', 'arrow', 'cannon', 'tesla', 'frost']])
  for (const max of [10, 12, 16, 22]) for (const maze of [0, 0.6, 1.5]) for (const early of [true, false]) PLANS.push({ order, max, maze, early });

function play(spec, plan) {
  const g = M.newGame(spec);
  const order = plan.order.filter(t => g.allow.includes(t));
  const max = Math.min(plan.max, g.rules.maxTowers || 99);
  let n = 0;
  const think = () => {
    for (let guard = 0; guard < 40; guard++) {
      const type = order[n % order.length];
      const up = g.towers.filter(t => C.upgradeCost(t) !== undefined).sort((a, b) => C.upgradeCost(a) - C.upgradeCost(b))[0];
      if (up && g.towers.length >= 4 && (g.towers.length >= max || n % 2 === 1)) {
        if (C.act(g, ['u', up.x, up.y])) { n++; continue; }
        return;
      }
      if (g.towers.length >= max || g.gold < D.TOWERS[type].cost) return;
      const c = bestCell(g, type, plan.maze);
      if (!c || !C.act(g, ['b', c.x, c.y, type])) return;
      n++;
    }
  };
  think(); C.act(g, ['w']);
  while (!g.over && g.tick < 60 * 3600) {
    if (g.offer) { const pref = ['power', 'haste', 'reach', 'repair', 'bank']; const i = g.offer.findIndex(p => pref.includes(p)); C.act(g, ['p', Math.max(0, i)]); }
    C.step(g); g.events.length = 0;
    if (g.tick % 60 === 0) {
      think();
      for (const c of [...g.crates]) C.act(g, ['c', c.id]);
      if (plan.early && g.countdown > 0 && g.countdown < 16) C.act(g, ['w']);
      if (g.enemies.length > 6) { const e = g.enemies.reduce((a, b) => b.remain < a.remain ? b : a); C.act(g, ['M', e.x, e.y]); C.act(g, ['F']); }
    }
  }
  return g;
}

module.exports = { play, PLANS };
if (require.main === module) {
  let failed = 0;
  console.log('| # | Mission | Bot wins | Best stars |\n|---|---|---|---|');
  for (const m of M.MISSIONS) {
    let wins = 0, tried = 0, stars = 0;
    for (const plan of PLANS) {
      const g = play({ mode: 'mission', id: m.id }, plan); tried++;
      if (g.over === 'win') { wins++; stars = Math.max(stars, M.starsOf(g)); }
      if (stars === 3 && wins >= 2) break;
    }
    if (!wins) failed++;
    console.log(`| ${m.id + 1} | ${m.name} | ${wins}/${tried} | ${stars}/3 |`);
  }
  if (failed) { console.log(failed + ' mission(s) not beaten'); process.exit(1); }
}
