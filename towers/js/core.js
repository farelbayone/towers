/* Logika game murni (tanpa DOM), dipakai browser dan simulator balancing. */
(function (root) {
  const D = root.KData || require('./data.js');
  const P = root.KPath || require('./path.js');
  const W = 15, H = 9;
  const TICK = 1 / 60;
  const dist2 = (dx, dy) => Math.sqrt(dx * dx + dy * dy);
  /* PRNG deterministik (mulberry32) agar replay selalu sama. */
  function rand(g) {
    let t = (g.seed = (g.seed + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function createGame(mapIndex, diffId, rules) {
    rules = rules || {};
    const map = D.MAPS[mapIndex], base = D.DIFFS[diffId];
    const diff = Object.assign({}, base, { hp: base.hp * (rules.hp || 1), gold: rules.gold || base.gold, lives: rules.lives || base.lives });
    const g = {
      w: W, h: H, mapIndex, diffId, map, diff, rules,
      waves: rules.endless ? Infinity : rules.waves || D.WAVES.length,
      allow: rules.allow || Object.keys(D.TOWERS),
      seed: (rules.seed || 1) >>> 0, tick: 0, actions: [], offer: null, perks: [], crates: [], combo: 0, comboT: 0,
      mod: { power: 1, reach: 1, haste: 1, bounty: 1, mana: 1, chill: 1 },
      stats: { built: 0, sold: 0, upgrades: 0, skills: 0, early: 0, crates: 0, maxTowers: 0, maze: 0, meteorKills: 0, maxCombo: 0, leaked: 0, maxLevel: 0 },
      rocks: new Set(), spawns: [], goal: null,
      towers: [], enemies: [], shots: [], queue: [], events: [],
      gold: diff.gold, lives: diff.lives, wave: 0, time: 0, countdown: null,
      kills: 0, score: 0, over: null, nextId: 1, freezeT: 0,
      cd: { meteor: 0, freeze: 0 }, dist: null
    };
    map.rows.forEach((row, y) => [...row].forEach((c, x) => {
      if (c === '#') g.rocks.add(y * W + x);
      if (c === 'S') g.spawns.push({ x, y });
      if (c === 'G') g.goal = { x, y };
    }));
    recompute(g);
    return g;
  }

  const towerAt = (g, x, y) => g.towers.find(t => t.x === x && t.y === y);
  const isBlocked = (g, x, y) => g.rocks.has(y * W + x) || !!towerAt(g, x, y);
  function recompute(g, extra) {
    const f = P.flowField(W, H, (x, y) => isBlocked(g, x, y) || (extra && extra.x === x && extra.y === y), g.goal);
    if (!extra) {
      g.dist = f;
      if (g.spawns) g.stats.maze = Math.max(g.stats.maze, ...g.spawns.map(s => f[s.y * W + s.x]));
    }
    return f;
  }

  /* Boleh membangun? Tidak boleh menutup jalur sepenuhnya. */
  function canBuild(g, x, y) {
    const no = reason => ({ ok: false, reason });
    if (x < 0 || y < 0 || x >= W || y >= H) return no('Di luar peta');
    if (isBlocked(g, x, y)) return no('Petak sudah terisi');
    if ((g.goal.x === x && g.goal.y === y) || g.spawns.some(s => s.x === x && s.y === y)) return no('Gerbang tidak boleh ditutup');
    const walkers = g.enemies.filter(e => !e.fly);
    if (walkers.some(e => (Math.round(e.x) === x && Math.round(e.y) === y) || (e.tx === x && e.ty === y))) return no('Ada musuh di petak ini');
    const f = recompute(g, { x, y });
    if (g.spawns.some(s => f[s.y * W + s.x] < 0) || walkers.some(e => f[e.ty * W + e.tx] < 0)) return no('Jalur musuh akan tertutup total');
    return { ok: true, dist: f };
  }

  function build(g, x, y, type) {
    const def = D.TOWERS[type];
    if (g.over) return { ok: false, reason: 'Permainan selesai' };
    if (!def || !g.allow.includes(type)) return { ok: false, reason: 'Menara ini dilarang di misi ini' };
    if (g.rules.maxTowers && g.towers.length >= g.rules.maxTowers) return { ok: false, reason: 'Batas ' + g.rules.maxTowers + ' menara tercapai' };
    const c = canBuild(g, x, y);
    if (!c.ok) return c;
    if (g.gold < def.cost) return { ok: false, reason: 'Koin kurang' };
    g.gold -= def.cost;
    const t = { id: g.nextId++, type, x, y, level: 0, cool: 0, angle: -Math.PI / 2, mode: 'first', spent: def.cost, kills: 0, damage: 0, born: g.time, recoil: 0 };
    g.towers.push(t);
    recompute(g);
    g.stats.built++; g.stats.maxTowers = Math.max(g.stats.maxTowers, g.towers.length); g.stats.maxLevel = Math.max(g.stats.maxLevel, 1);
    g.events.push({ k: 'build', x, y, color: def.color });
    return { ok: true, tower: t };
  }

  const upgradeCost = t => D.TOWERS[t.type].up[t.level];
  function upgrade(g, t) {
    const cost = upgradeCost(t);
    if (g.over || cost === undefined || g.gold < cost) return false;
    g.gold -= cost; t.spent += cost; t.level++; g.stats.upgrades++; g.stats.maxLevel = Math.max(g.stats.maxLevel, t.level + 1);
    g.events.push({ k: 'upgrade', x: t.x, y: t.y, color: D.TOWERS[t.type].color });
    return true;
  }
  const sellValue = (g, t) => Math.floor(t.spent * (g.wave === 0 ? 1 : D.BALANCE.sellRatio));
  function sell(g, t) {
    const i = g.towers.indexOf(t);
    if (g.over || i < 0 || g.rules.noSell) return false;
    g.stats.sold++;
    const v = sellValue(g, t);
    g.gold += v; g.towers.splice(i, 1); recompute(g);
    g.events.push({ k: 'sell', x: t.x, y: t.y, v });
    return true;
  }

  const waveActive = g => g.queue.length > 0 || g.enemies.length > 0;

  /* Memanggil gelombang berikutnya; memanggil lebih awal memberi bonus. */
  function startWave(g) {
    if (g.over || g.offer || g.wave >= g.waves || g.queue.length) return false;
    if (g.countdown > 0) {
      const bonus = Math.floor(g.countdown * D.BALANCE.earlyBonusPerSec);
      g.gold += bonus;
      if (bonus) g.stats.early++;
      if (bonus) g.events.push({ k: 'bonus', v: bonus, text: 'Bonus cepat' });
    }
    g.countdown = null;
    g.wave++;
    let at = 0, n = 0;
    for (const [type, count, gap] of waveDef(g.wave)) {
      for (let i = 0; i < count; i++) {
        g.queue.push({ at: g.time + at, type, spawn: g.spawns[n++ % g.spawns.length], wave: g.wave });
        at += gap;
      }
      at += 1;
    }
    if (g.wave > 1 && rand(g) < 0.45) dropCrate(g);
    g.events.push({ k: 'wave', v: g.wave });
    return true;
  }

  /* Setelah gelombang 15 (mode Tanpa Akhir) pola 6..15 berulang. */
  const waveDef = w => w <= D.WAVES.length ? D.WAVES[w - 1] : D.WAVES[5 + (w - 16) % 10];

  function dropCrate(g) {
    const free = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if (!isBlocked(g, x, y) && x !== g.goal.x && !g.spawns.some(s => s.x === x && s.y === y)) free.push({ x, y });
    if (!free.length) return;
    const c = free[(rand(g) * free.length) | 0];
    g.crates.push({ id: g.nextId++, x: c.x, y: c.y, t: 12, gold: 20 + g.wave * 4 });
    g.events.push({ k: 'crate', x: c.x, y: c.y });
  }
  function collect(g, id) {
    const i = g.crates.findIndex(c => c.id === id);
    if (g.over || i < 0) return false;
    const c = g.crates[i];
    g.crates.splice(i, 1); g.gold += c.gold; g.score += c.gold * 5; g.stats.crates++;
    g.events.push({ k: 'loot', x: c.x, y: c.y, v: c.gold });
    return true;
  }

  function makeOffer(g) {
    const pool = Object.keys(D.PERKS), out = [];
    while (out.length < 3) out.push(pool.splice((rand(g) * pool.length) | 0, 1)[0]);
    g.offer = out;
    g.events.push({ k: 'offer' });
  }
  function choosePerk(g, i) {
    if (!g.offer || !g.offer[i]) return false;
    const id = g.offer[i];
    if (id === 'power') g.mod.power += 0.12;
    if (id === 'reach') g.mod.reach += 0.08;
    if (id === 'haste') g.mod.haste += 0.10;
    if (id === 'bounty') g.mod.bounty += 0.15;
    if (id === 'mana') g.mod.mana += 0.2;
    if (id === 'chill') g.mod.chill *= 0.94;
    if (id === 'repair') g.lives += 5;
    if (id === 'bank') g.gold += 150;
    g.perks.push(id); g.offer = null;
    g.events.push({ k: 'perk', id });
    return true;
  }

  const statsOf = (g, t) => {
    const s = D.TOWERS[t.type].levels[t.level];
    return Object.assign({}, s, { dmg: s.dmg * g.mod.power, range: s.range * g.mod.reach, rate: s.rate * g.mod.haste });
  };
  function setMode(g, t, mode) {
    if (g.over || !['first', 'strong', 'weak', 'close'].includes(mode)) return false;
    t.mode = mode; return true;
  }

  /* Satu-satunya pintu aksi pemain. Aksi yang berhasil direkam untuk replay. */
  function act(g, a) {
    if (!Array.isArray(a) || g.over) return false;
    const [k, p, q] = a;
    let ok = false;
    const t = Number.isInteger(p) && Number.isInteger(q) ? towerAt(g, p, q) : null;
    if (k === 'b') ok = Number.isInteger(p) && Number.isInteger(q) && Object.prototype.hasOwnProperty.call(D.TOWERS, a[3]) && build(g, p, q, a[3]).ok;
    else if (k === 'u') ok = !!t && upgrade(g, t);
    else if (k === 's') ok = !!t && sell(g, t);
    else if (k === 'm') ok = !!t && setMode(g, t, a[3]);
    else if (k === 'w') ok = startWave(g);
    else if (k === 'M') ok = Number.isFinite(p) && Number.isFinite(q) && useSkill(g, 'meteor', p, q);
    else if (k === 'F') ok = useSkill(g, 'freeze');
    else if (k === 'c') ok = collect(g, p);
    else if (k === 'p') ok = choosePerk(g, p);
    if (ok) g.actions.push([g.tick, ...a]);
    return ok;
  }

  function spawnEnemy(g, q) {
    const def = D.ENEMIES[q.type];
    const hp = Math.round(def.hp * D.BALANCE.hpScale(q.wave) * g.diff.hp);
    g.enemies.push({
      id: g.nextId++, type: q.type, x: q.spawn.x, y: q.spawn.y, sx: q.spawn.x, sy: q.spawn.y,
      tx: q.spawn.x, ty: q.spawn.y, dir: null, hp, max: hp, fly: !!def.fly,
      slow: 0, slowT: 0, hit: 0, progress: 0, remain: 99, dead: false, wave: q.wave
    });
  }

  function damage(g, e, amount, tower, pierce) {
    if (e.dead) return;
    const def = D.ENEMIES[e.type];
    const dealt = pierce ? amount : Math.max(amount * 0.2, amount - def.armor);
    if (tower) tower.damage += Math.min(dealt, e.hp);
    e.hp -= dealt; e.hit = 0.12;
    if (e.hp <= 0) {
      e.dead = true; g.kills++;
      const gold = Math.round(def.gold * D.BALANCE.bountyScale(e.wave) * g.diff.reward * g.mod.bounty);
      g.combo++; g.comboT = 1.5; g.stats.maxCombo = Math.max(g.stats.maxCombo, g.combo);
      if (g.combo >= 3) g.score += g.combo;
      g.gold += gold; g.score += gold * 10;
      if (tower) tower.kills++;
      g.events.push({ k: 'kill', x: e.x, y: e.y, color: def.color, v: gold, boss: !!def.boss });
    }
  }

  function moveEnemy(g, e, dt) {
    const def = D.ENEMIES[e.type];
    let speed = def.speed * g.mod.chill;
    if (e.slowT > 0) speed *= 1 - e.slow * (def.boss ? 0.5 : 1);
    if (g.freezeT > 0) speed *= def.boss ? 0.6 : 0.2;
    let step = speed * dt;
    e.progress += step;
    if (e.fly) {
      const dx = g.goal.x - e.x, dy = g.goal.y - e.y, d = dist2(dx, dy);
      e.remain = d;
      if (d <= step) return true;
      e.x += dx / d * step; e.y += dy / d * step;
      return false;
    }
    while (step > 0) {
      const dx = e.tx - e.x, dy = e.ty - e.y, d = dist2(dx, dy);
      if (d > step) { e.x += dx / d * step; e.y += dy / d * step; break; }
      e.x = e.tx; e.y = e.ty; step -= d;
      if (e.tx === g.goal.x && e.ty === g.goal.y) return true;
      const n = P.nextCell(g.dist, W, H, e.tx, e.ty, e.dir);
      if (!n) break;
      e.tx = n.x; e.ty = n.y; e.dir = { x: n.dx, y: n.dy };
    }
    e.remain = g.dist[e.ty * W + e.tx] + dist2(e.tx - e.x, e.ty - e.y);
    return false;
  }

  function pickTarget(g, t, st) {
    const def = D.TOWERS[t.type];
    let best = null, score = -Infinity;
    for (const e of g.enemies) {
      if (e.dead || (e.fly && !def.air)) continue;
      const d = dist2(e.x - t.x, e.y - t.y);
      if (d > st.range) continue;
      const s = t.mode === 'strong' ? e.hp : t.mode === 'close' ? -d : t.mode === 'weak' ? -e.hp : -e.remain;
      if (s > score) { score = s; best = e; }
    }
    return best;
  }

  function fire(g, t, target, st) {
    t.angle = Math.atan2(target.y - t.y, target.x - t.x);
    t.recoil = 1;
    if (t.type === 'tesla') {
      const hit = [target]; let from = target, dmg = st.dmg;
      damage(g, target, dmg, t, true);
      while (hit.length < st.chain) {
        let next = null, nd = 1.8;
        for (const e of g.enemies) {
          if (e.dead || hit.includes(e)) continue;
          const d = dist2(e.x - from.x, e.y - from.y);
          if (d < nd) { nd = d; next = e; }
        }
        if (!next) break;
        dmg *= 0.8; damage(g, next, dmg, t, true); hit.push(next); from = next;
      }
      g.events.push({ k: 'zap', pts: [{ x: t.x, y: t.y }, ...hit.map(e => ({ x: e.x, y: e.y }))] });
    } else {
      g.shots.push({ type: t.type, x: t.x, y: t.y, sx: t.x, sy: t.y, target, tx: target.x, ty: target.y, tower: t, st, speed: t.type === 'cannon' ? 6 : 11 });
      g.events.push({ k: 'shoot', type: t.type });
    }
  }

  function impact(g, s) {
    const st = s.st;
    if (s.type === 'cannon') {
      for (const e of g.enemies) {
        if (e.fly) continue;
        const d = dist2(e.x - s.tx, e.y - s.ty);
        if (d <= st.splash) damage(g, e, st.dmg * (1 - 0.4 * d / st.splash), s.tower);
      }
      g.events.push({ k: 'boom', x: s.tx, y: s.ty, r: st.splash });
    } else if (!s.target.dead && !s.target.gone) {
      if (s.type === 'frost') {
        s.target.slow = s.target.slowT > 0 ? Math.max(s.target.slow, st.slow) : st.slow;
        s.target.slowT = st.dur;
      }
      damage(g, s.target, st.dmg, s.tower);
      g.events.push({ k: 'spark', x: s.tx, y: s.ty, color: D.TOWERS[s.type].color });
    }
  }

  const meteorDamage = g => 140 * D.BALANCE.hpScale(Math.max(1, g.wave));
  function useSkill(g, id, x, y) {
    if (g.over || g.offer || g.rules.noSkills || g.cd[id] > 0 || !waveActive(g)) return false;
    g.cd[id] = D.SKILLS[id].cd / g.mod.mana; g.stats.skills++;
    if (id === 'meteor') {
      const before = g.kills;
      for (const e of g.enemies) if (dist2(e.x - x, e.y - y) <= D.SKILLS.meteor.radius) damage(g, e, meteorDamage(g), null, true);
      g.stats.meteorKills += g.kills - before;
      g.events.push({ k: 'meteor', x, y, r: D.SKILLS.meteor.radius });
    } else {
      g.freezeT = D.SKILLS.freeze.dur;
      g.events.push({ k: 'freeze' });
    }
    g.enemies = g.enemies.filter(e => !e.dead);
    return true;
  }

  function step(g, dt) {
    if (g.over || g.offer) return;
    dt = TICK; g.tick++;
    g.time += dt;
    if (g.comboT > 0 && (g.comboT -= dt) <= 0) g.combo = 0;
    for (const c of g.crates) c.t -= dt;
    g.crates = g.crates.filter(c => c.t > 0);
    for (const k in g.cd) if (waveActive(g)) g.cd[k] = Math.max(0, g.cd[k] - dt);
    g.freezeT = Math.max(0, g.freezeT - dt);
    while (g.queue.length && g.queue[0].at <= g.time) spawnEnemy(g, g.queue.shift());

    for (const e of g.enemies) {
      e.hit = Math.max(0, e.hit - dt);
      e.slowT = Math.max(0, e.slowT - dt);
      const def = D.ENEMIES[e.type];
      if (def.heal) for (const o of g.enemies) {
        if (o !== e && !o.dead && dist2(o.x - e.x, o.y - e.y) < 1.5) o.hp = Math.min(o.max, o.hp + o.max * def.heal * dt * (def.boss ? 0 : 1));
      }
      if (moveEnemy(g, e, dt)) {
        e.dead = true; e.gone = true;
        g.lives = Math.max(0, g.lives - def.lives); g.stats.leaked++;
        g.events.push({ k: 'leak', v: def.lives });
      }
    }
    g.enemies = g.enemies.filter(e => !e.dead);

    for (const t of g.towers) {
      t.cool -= dt; t.recoil = Math.max(0, t.recoil - dt * 6);
      const st = statsOf(g, t);
      const target = pickTarget(g, t, st);
      if (target) {
        t.angle = Math.atan2(target.y - t.y, target.x - t.x);
        if (t.cool <= 0) { fire(g, t, target, st); t.cool = 1 / st.rate; }
      }
    }

    for (const s of g.shots) {
      if (!s.target.dead) { s.tx = s.target.x; s.ty = s.target.y; }
      const dx = s.tx - s.x, dy = s.ty - s.y, d = dist2(dx, dy), m = s.speed * dt;
      if (d <= m) { s.done = true; impact(g, s); }
      else { s.x += dx / d * m; s.y += dy / d * m; }
    }
    g.shots = g.shots.filter(s => !s.done);
    g.enemies = g.enemies.filter(e => !e.dead);

    if (g.lives <= 0) { g.over = 'lose'; g.events.push({ k: 'lose' }); return; }
    if (g.wave > 0 && !waveActive(g) && g.countdown === null) {
      const bonus = D.BALANCE.waveBonus(g.wave);
      g.gold += bonus; g.score += g.wave * 100;
      g.events.push({ k: 'bonus', v: bonus, text: 'Gelombang bersih' });
      if (g.wave >= g.waves) {
        g.over = 'win'; g.score += g.lives * 200; g.events.push({ k: 'win' });
      } else { g.countdown = D.BALANCE.breakTime; if (g.wave % 5 === 0) makeOffer(g); }
    }
    if (g.countdown !== null && !g.offer) {
      g.countdown -= dt;
      if (g.countdown <= 0) { g.countdown = 0; startWave(g); }
    }
  }

  const stars = g => g.over !== 'win' ? 0 : g.lives >= g.diff.lives * 0.9 ? 3 : g.lives >= g.diff.lives * 0.5 ? 2 : 1;

  root.KCore = { W, H, TICK, act, waveDef, statsOf, createGame, step, canBuild, build, upgrade, upgradeCost, sell, sellValue, startWave, useSkill, towerAt, waveActive, stars, meteorDamage };
  if (typeof module !== 'undefined') module.exports = root.KCore;
})(typeof window !== 'undefined' ? window : globalThis);
