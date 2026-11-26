/* Penggambaran canvas: peta, jalur, menara, musuh, dan efek. */
(function () {
  const D = KData, C = KCore, P = KPath, TAU = Math.PI * 2;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cv, ctx, bg, S = 40, dpr = 1;
  const fx = { parts: [], texts: [], zaps: [], rings: [], meteors: [], shake: 0, flash: 0 };

  function init(canvas) { cv = canvas; ctx = cv.getContext('2d'); }
  function resize(g) {
    const w = cv.clientWidth || 750;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    S = w / C.W;
    cv.width = Math.round(w * dpr); cv.height = Math.round(S * C.H * dpr);
    if (g) paintBg(g);
  }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); }
  function circle(c, x, y, r, fill) { c.beginPath(); c.arc(x, y, r, 0, TAU); if (fill) { c.fillStyle = fill; c.fill(); } }

  function paintBg(g) {
    bg = document.createElement('canvas'); bg.width = cv.width; bg.height = cv.height;
    const c = bg.getContext('2d'); c.scale(dpr, dpr);
    const pal = [['#1d4d45', '#1b4740'], ['#5c3d3a', '#553836'], ['#26466b', '#234062'], ['#41376b', '#3c3363'], ['#3d4a55', '#384450'], ['#1f5260', '#1d4b58']][g.mapIndex];
    for (let y = 0; y < C.H; y++) for (let x = 0; x < C.W; x++) {
      c.fillStyle = pal[(x + y) % 2]; c.fillRect(x * S, y * S, S + 1, S + 1);
      const r = Math.abs(Math.sin(x * 127.1 + y * 311.7) * 43758.5) % 1;
      if (r > .55) { c.fillStyle = '#ffffff14'; circle(c, (x + r) % 1 * S + x * S, (y + (r * 7) % 1) * S, S * .04); c.fill(); }
    }
    for (const k of g.rocks) {
      const x = (k % C.W + .5) * S, y = (((k / C.W) | 0) + .5) * S;
      circle(c, x + S * .05, y + S * .1, S * .4, '#0004');
      c.fillStyle = '#7d8397'; c.beginPath();
      [[-.4, .15], [-.28, -.28], [.08, -.4], [.38, -.12], [.34, .3], [-.08, .38]].forEach(([a, b], i) => c[i ? 'lineTo' : 'moveTo'](x + a * S, y + b * S));
      c.fill(); circle(c, x - S * .08, y - S * .13, S * .13, '#a4abc0');
    }
  }

  function burst(x, y, color, n, force) {
    for (let i = 0; i < n && fx.parts.length < 350; i++) {
      const a = Math.random() * TAU, v = (0.4 + Math.random()) * force;
      fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .35 + Math.random() * .35, t: 0, color, r: .04 + Math.random() * .06 });
    }
  }
  const text = (x, y, s, color) => fx.texts.push({ x, y, s, color, t: 0 });
  const ring = (x, y, r, color) => fx.rings.push({ x, y, r, color, t: 0 });

  function event(g, e) {
    if (e.k === 'kill') { burst(e.x, e.y, e.color, e.boss ? 60 : 12, e.boss ? 4 : 2); text(e.x, e.y, '+' + e.v, '#ffd166'); if (e.boss) fx.shake = .6; }
    if (e.k === 'build' || e.k === 'upgrade') { burst(e.x, e.y, e.color, 18, 2); ring(e.x, e.y, .9, e.color); if (e.k === 'upgrade') text(e.x, e.y, 'NAIK LEVEL!', '#fff'); }
    if (e.k === 'sell') { burst(e.x, e.y, '#ffd166', 14, 1.6); text(e.x, e.y, '+' + e.v, '#ffd166'); }
    if (e.k === 'boom') { ring(e.x, e.y, e.r, '#ffb347'); burst(e.x, e.y, '#ff8a3d', 14, 2.4); fx.shake = Math.max(fx.shake, .08); }
    if (e.k === 'spark') burst(e.x, e.y, e.color, 4, 1.2);
    if (e.k === 'zap') fx.zaps.push({ pts: e.pts, t: 0 });
    if (e.k === 'leak') { fx.flash = .4; fx.shake = .35; text(g.goal.x - .3, g.goal.y, '-' + e.v + ' ❤', '#ff6b6b'); }
    if (e.k === 'meteor') fx.meteors.push({ x: e.x, y: e.y, r: e.r, t: 0 });
    if (e.k === 'freeze') for (const en of g.enemies) ring(en.x, en.y, .7, '#9be8ff');
    if (e.k === 'crate') { ring(e.x, e.y, 1.4, '#ffd166'); text(e.x, e.y, 'PETI!', '#ffd166'); }
    if (e.k === 'loot') { burst(e.x, e.y, '#ffd166', 28, 3); text(e.x, e.y, '+' + e.v + ' koin', '#ffd166'); }
    if (e.k === 'bonus') text(C.W / 2 - .5, 1, e.text + ' +' + e.v + ' koin', '#ffd166');
  }

  function pathLine(g, dist, color, width, time) {
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = width * S; ctx.lineJoin = ctx.lineCap = 'round';
    ctx.setLineDash([S * .14, S * .28]); ctx.lineDashOffset = -time * S * .8;
    for (const s of g.spawns) {
      const p = P.trace(dist, C.W, C.H, s);
      ctx.beginPath(); p.forEach((q, i) => ctx[i ? 'lineTo' : 'moveTo']((q.x + .5) * S, (q.y + .5) * S)); ctx.stroke();
    }
    ctx.restore();
  }

  function flowOverlay(g) {
    const max = Math.max(...g.dist);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let y = 0; y < C.H; y++) for (let x = 0; x < C.W; x++) {
      const d = g.dist[y * C.W + x];
      if (d < 0) continue;
      ctx.fillStyle = `hsla(${180 + 140 * d / max},90%,45%,.55)`; ctx.fillRect(x * S + 1, y * S + 1, S - 2, S - 2);
      ctx.fillStyle = '#fff'; ctx.font = `700 ${S * .24}px system-ui`; ctx.fillText(d, (x + .5) * S, (y + .74) * S);
      const n = d > 0 && P.nextCell(g.dist, C.W, C.H, x, y, null);
      if (n) {
        ctx.save(); ctx.translate((x + .5) * S, (y + .38) * S); ctx.rotate(Math.atan2(n.dy, n.dx));
        ctx.beginPath(); ctx.moveTo(S * .2, 0); ctx.lineTo(-S * .1, -S * .14); ctx.lineTo(-S * .1, S * .14); ctx.fill(); ctx.restore();
      }
    }
  }

  function tower(g, t, time) {
    const def = D.TOWERS[t.type], x = (t.x + .5) * S, y = (t.y + .5) * S;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#0005'; rr(ctx, -S * .4, -S * .34, S * .84, S * .82, S * .22); ctx.fill();
    ctx.fillStyle = '#26314f'; rr(ctx, -S * .43, -S * .43, S * .86, S * .86, S * .22); ctx.fill();
    ctx.strokeStyle = def.color; ctx.lineWidth = S * .05 * (1 + t.level * .35); ctx.stroke();
    ctx.rotate(t.angle);
    const k = -t.recoil * S * .08;
    ctx.fillStyle = def.color; ctx.strokeStyle = def.color;
    if (t.type === 'arrow') { circle(ctx, k, 0, S * .17, def.color); ctx.fillRect(k, -S * .05, S * .38, S * .1); }
    if (t.type === 'cannon') { ctx.fillRect(k, -S * .13, S * .4, S * .26); circle(ctx, k, 0, S * .22, def.color); circle(ctx, k, 0, S * .09, '#26314f'); }
    if (t.type === 'frost') { ctx.rotate(time - t.angle); ctx.lineWidth = S * .08; for (let i = 0; i < 3; i++) { ctx.rotate(TAU / 6); ctx.beginPath(); ctx.moveTo(-S * .27, 0); ctx.lineTo(S * .27, 0); ctx.stroke(); } circle(ctx, 0, 0, S * .1, '#fff'); }
    if (t.type === 'tesla') { circle(ctx, 0, 0, S * .2, def.color); circle(ctx, 0, 0, S * (.08 + .025 * Math.sin(time * 9 + t.id)), '#fff'); ctx.lineWidth = S * .04; ctx.beginPath(); ctx.arc(0, 0, S * .3, time * 2, time * 2 + 4); ctx.stroke(); }
    ctx.restore();
    for (let i = 0; i <= t.level; i++) circle(ctx, x + (i - t.level / 2) * S * .16, y + S * .33, S * .05, '#ffd166');
  }

  function enemy(g, e, time, selected) {
    const def = D.ENEMIES[e.type], r = def.size * S;
    const bob = e.fly ? Math.sin(time * 6 + e.id) * S * .08 - S * .18 : Math.abs(Math.sin(time * 8 + e.id)) * -S * .06;
    const x = (e.x + .5) * S, y = (e.y + .5) * S + bob;
    circle(ctx, x, (e.y + .5) * S + r * .8, r * .7, '#0004');
    if (def.heal) { ctx.strokeStyle = '#4dffd266'; ctx.lineWidth = 1.5; circle(ctx, x, y, S * (1.5 * ((time * .8) % 1))); ctx.stroke(); }
    if (e.fly) { ctx.fillStyle = '#b84d82'; const f = Math.sin(time * 18 + e.id) * r * .6; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s * r * 2, y - r * .5 + f); ctx.lineTo(x + s * r * 1.2, y + r * .6); ctx.fill(); } }
    const color = e.hit > 0 ? '#fff' : def.color;
    if (e.type === 'tank') { ctx.fillStyle = color; rr(ctx, x - r, y - r, r * 2, r * 2, r * .4); ctx.fill(); ctx.strokeStyle = '#5c564e'; ctx.lineWidth = S * .05; ctx.stroke(); }
    else circle(ctx, x, y, r, color);
    if (def.boss) { ctx.fillStyle = '#ffd166'; ctx.beginPath(); [[-.7, -.7], [-.7, -1.45], [-.3, -1.05], [0, -1.6], [.3, -1.05], [.7, -1.45], [.7, -.7]].forEach(([a, b], i) => ctx[i ? 'lineTo' : 'moveTo'](x + a * r, y + b * r)); ctx.fill(); }
    if (def.heal) { ctx.fillStyle = '#075e47'; ctx.fillRect(x - r * .12, y - r * .95, r * .24, r * .6); ctx.fillRect(x - r * .3, y - r * .77, r * .6, r * .24); }
    for (const s of [-.38, .38]) { circle(ctx, x + s * r, y - r * .05, r * .24, '#fff'); circle(ctx, x + s * r + r * .07, y - r * .03, r * .12, '#111'); }
    if (e.slowT > 0 || g.freezeT > 0) { circle(ctx, x, y, r * 1.1, '#8fe3ff66'); }
    if (selected) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; circle(ctx, x, y, r * 1.6); ctx.stroke(); }
    if (e.hp < e.max || selected) {
      const w = Math.max(S * .55, r * 2.2), f = Math.max(0, e.hp / e.max), by = y - r - S * (def.boss ? .42 : .17);
      ctx.fillStyle = '#000a'; ctx.fillRect(x - w / 2, by, w, S * .09);
      ctx.fillStyle = f > .5 ? '#7ee081' : f > .25 ? '#ffd166' : '#ff6b6b'; ctx.fillRect(x - w / 2, by, w * f, S * .09);
    }
  }

  function range(x, y, r, color) {
    ctx.beginPath(); ctx.arc((x + .5) * S, (y + .5) * S, r * S, 0, TAU);
    ctx.fillStyle = color + '22'; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
  }

  function draw(g, view, dt, time) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bg, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fx.shake = Math.max(0, fx.shake - dt);
    if (fx.shake && !reduce) ctx.translate((Math.random() - .5) * fx.shake * 14, (Math.random() - .5) * fx.shake * 14);

    if (view.showFlow) flowOverlay(g);
    pathLine(g, g.dist, '#ffffff88', .09, time);

    const next = g.wave < g.waves ? C.waveDef(g.wave + 1) : [];
    if ((!C.waveActive(g) && next.some(w => D.ENEMIES[w[0]].fly)) || g.enemies.some(e => e.fly)) {
      ctx.save(); ctx.setLineDash([4, 8]); ctx.lineDashOffset = -time * 30; ctx.strokeStyle = '#ff7ab6aa'; ctx.lineWidth = 2;
      for (const s of g.spawns) { ctx.beginPath(); ctx.moveTo((s.x + .5) * S, (s.y + .5) * S); ctx.lineTo((g.goal.x + .5) * S, (g.goal.y + .5) * S); ctx.stroke(); }
      ctx.restore();
    }

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const s of g.spawns) { const x = (s.x + .5) * S, y = (s.y + .5) * S; for (let i = 0; i < 3; i++) { circle(ctx, x, y, S * (.46 - i * .13) * (1 + .06 * Math.sin(time * 4 + i)), ['#5b2a86aa', '#8e44ad', '#220b38'][i]); } }
    const gx = (g.goal.x + .5) * S, gy = (g.goal.y + .5) * S;
    circle(ctx, gx, gy, S * (.52 + .03 * Math.sin(time * 3)), '#5eead455');
    ctx.font = `${S * .72}px system-ui`; ctx.fillStyle = '#fff'; ctx.fillText('🏰', gx, gy);

    if (view.tutorialCell) { const c = view.tutorialCell; ctx.strokeStyle = '#5eead4'; ctx.lineWidth = 3 + Math.sin(time * 8) * 2; rr(ctx, c.x * S + 3, c.y * S + 3, S - 6, S - 6, 8); ctx.stroke(); }

    const sel = view.selected;
    if (sel) range(sel.x, sel.y, C.statsOf(g, sel).range, D.TOWERS[sel.type].color);
    for (const t of g.towers) tower(g, t, time);
    for (const c of g.crates) {
      const x = (c.x + .5) * S, y = (c.y + .5) * S + Math.sin(time * 5) * S * .07, a = c.t < 4 && Math.sin(time * 16) < 0 ? .45 : 1;
      ctx.globalAlpha = a; circle(ctx, x, y, S * .48, '#ffd16633');
      ctx.fillStyle = '#b97a2b'; rr(ctx, x - S * .3, y - S * .24, S * .6, S * .5, S * .08); ctx.fill();
      ctx.fillStyle = '#ffd166'; ctx.fillRect(x - S * .3, y - S * .06, S * .6, S * .09); ctx.fillRect(x - S * .06, y - S * .24, S * .12, S * .5); ctx.globalAlpha = 1;
    }
    [...g.enemies].sort((a, b) => (a.fly - b.fly) || (a.y - b.y)).forEach(e => enemy(g, e, time, view.enemy === e));

    for (const s of g.shots) {
      const x = (s.x + .5) * S, y = (s.y + .5) * S;
      if (s.type === 'cannon') {
        const total = Math.hypot(s.tx - s.sx, s.ty - s.sy) || 1, f = Math.min(1, Math.hypot(s.x - s.sx, s.y - s.sy) / total);
        circle(ctx, x, y - Math.sin(f * Math.PI) * S * .5, S * .13, '#222'); circle(ctx, x, y - Math.sin(f * Math.PI) * S * .5, S * .06, '#ffb347');
      } else {
        const a = Math.atan2(s.ty - s.y, s.tx - s.x), col = D.TOWERS[s.type].color;
        ctx.strokeStyle = col; ctx.lineWidth = S * .07; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(a) * S * .25, y - Math.sin(a) * S * .25); ctx.stroke();
        if (s.type === 'frost') circle(ctx, x, y, S * .09, '#dff7ff');
      }
    }

    fx.zaps = fx.zaps.filter(z => (z.t += dt) < .14);
    for (const z of fx.zaps) {
      ctx.strokeStyle = '#e4d1ff'; ctx.lineWidth = 3; ctx.shadowColor = '#a066ff'; ctx.shadowBlur = 12; ctx.beginPath();
      z.pts.forEach((p, i) => {
        if (!i) return ctx.moveTo((p.x + .5) * S, (p.y + .5) * S);
        const q = z.pts[i - 1];
        for (let k = 1; k <= 4; k++) { const j = k < 4 ? (Math.random() - .5) * .3 : 0; ctx.lineTo((q.x + (p.x - q.x) * k / 4 + .5 + j) * S, (q.y + (p.y - q.y) * k / 4 + .5 - j) * S); }
      });
      ctx.stroke(); ctx.shadowBlur = 0;
    }
    fx.rings = fx.rings.filter(r => (r.t += dt) < .4);
    for (const r of fx.rings) { ctx.globalAlpha = 1 - r.t / .4; ctx.strokeStyle = r.color; ctx.lineWidth = 3; circle(ctx, (r.x + .5) * S, (r.y + .5) * S, r.r * S * (r.t / .4)); ctx.stroke(); }
    fx.meteors = fx.meteors.filter(m => (m.t += dt) < .6);
    for (const m of fx.meteors) { const f = m.t / .6; ctx.globalAlpha = 1 - f; circle(ctx, (m.x + .5) * S, (m.y + .5) * S, m.r * S * (.4 + .6 * f), '#ff6a2b'); circle(ctx, (m.x + .5) * S, (m.y + .5) * S, m.r * S * .4 * (1 - f), '#fff3b0'); if (m.t < .05) { burst(m.x, m.y, '#ffb347', 20, 4); fx.shake = .4; } }
    fx.parts = fx.parts.filter(p => (p.t += dt) < p.life);
    for (const p of fx.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .93; p.vy *= .93; ctx.globalAlpha = 1 - p.t / p.life; circle(ctx, (p.x + .5) * S, (p.y + .5) * S, p.r * S, p.color); }
    ctx.globalAlpha = 1;

    const h = view.hover;
    if (h && view.build) {
      const def = D.TOWERS[view.build], c = view.check;
      const ok = c.ok && g.gold >= def.cost;
      if (c.ok) pathLine(g, c.dist, '#ffd166', .13, time);
      range(h.x, h.y, def.levels[0].range * g.mod.reach, ok ? def.color : '#ff6b6b');
      ctx.fillStyle = ok ? def.color + '99' : '#ff6b6b99'; rr(ctx, h.x * S + 4, h.y * S + 4, S - 8, S - 8, 10); ctx.fill();
      ctx.font = `${S * .5}px system-ui`; ctx.fillStyle = '#fff'; ctx.fillText(ok ? def.icon : '✖', (h.x + .5) * S, (h.y + .5) * S);
    } else if (h && view.skill === 'meteor') range(view.point.x, view.point.y, D.SKILLS.meteor.radius, '#ff8a3d');
    else if (h) { ctx.strokeStyle = '#fff8'; ctx.lineWidth = 2; rr(ctx, h.x * S + 2, h.y * S + 2, S - 4, S - 4, 8); ctx.stroke(); }

    ctx.font = `900 ${Math.max(12, S * .28)}px system-ui`;
    fx.texts = fx.texts.filter(t => (t.t += dt) < 1);
    for (const t of fx.texts) { ctx.globalAlpha = 1 - t.t * t.t; ctx.lineWidth = 4; ctx.strokeStyle = '#000b'; const x = (t.x + .5) * S, y = (t.y + .2 - t.t * .6) * S; ctx.strokeText(t.s, x, y); ctx.fillStyle = t.color; ctx.fillText(t.s, x, y); }
    ctx.globalAlpha = 1;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (g.freezeT > 0) { ctx.fillStyle = '#7fdcff22'; ctx.fillRect(0, 0, C.W * S, C.H * S); }
    fx.flash = Math.max(0, fx.flash - dt);
    if (fx.flash) { ctx.fillStyle = `rgba(255,40,60,${fx.flash * .6})`; ctx.fillRect(0, 0, C.W * S, C.H * S); }
  }

  function reset() { fx.parts = []; fx.texts = []; fx.zaps = []; fx.rings = []; fx.meteors = []; fx.shake = fx.flash = 0; }
  window.KRender = { init, resize, draw, event, reset };
})();
