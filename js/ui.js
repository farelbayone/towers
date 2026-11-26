/* Antarmuka: layar, input, HUD, modal, progres, tutorial, dan game loop. */
(function () {
  const D = KData, C = KCore, M = KModes, R = KRender, A = KAudio, N = KNet, icon = KIcon;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
  const TYPES = Object.keys(D.TOWERS);
  const MODES = { first: 'Terdepan', strong: 'Terkuat', weak: 'Terlemah', close: 'Terdekat' };
  const AWARDS = { first: 'Kemenangan pertama', builder: 'Arsitek: 10 menara', maze: 'Raja Labirin: jalur 30', max: 'Menara level 3', combo: 'Combo 10', boss: 'Penakluk Raja', loot: 'Pemburu peti', daily: 'Juara harian', endless: 'Tanpa Akhir: gelombang 20', stars: '36 bintang', all: 'Kampanye tamat' };
  const store = N.store;
  const blank = { name: '', missions: {}, best: {}, awards: [], tutorial: false };
  let prog = Object.assign({}, blank, store.get('progress', {}));
  const totalStars = () => Object.values(prog.missions).reduce((a, b) => a + b, 0);
  const unlocked = i => i === 0 || prog.missions[i - 1] > 0;
  const starText = n => '★'.repeat(n) + '☆'.repeat(3 - n);

  /* Gabungkan dua progres: selalu ambil hasil terbaik. */
  function merge(a, b) {
    const out = Object.assign({}, blank, a);
    if (!b) return out;
    out.name = a.name || b.name || '';
    out.tutorial = !!(a.tutorial || b.tutorial);
    out.awards = [...new Set([...(a.awards || []), ...(b.awards || [])])];
    out.missions = Object.assign({}, a.missions);
    for (const k in b.missions || {}) out.missions[k] = Math.max(out.missions[k] || 0, b.missions[k]);
    out.best = Object.assign({}, a.best);
    for (const k in b.best || {}) if (!out.best[k] || b.best[k].score > out.best[k].score) out.best[k] = b.best[k];
    return out;
  }
  function save() { store.set('progress', prog); N.saveCloud(prog).catch(() => toast('Progres cloud belum tersimpan')); }
  async function syncCloud() { const remote = await N.loadCloud(); prog = merge(prog, remote); save(); renderHome(); }

  const canvas = $('board');
  let g = M.newGame({ mode: 'free', map: 0, diff: 'normal' });
  const view = { hover: null, point: null, build: null, check: null, selected: null, enemy: null, skill: null, showFlow: false, tutorialCell: null };
  let running = false, paused = false, speed = 1, touchArm = null, infoKey = '', previewKey = '', goalKey = '', tut = -1, hintT = 0, modal = null, screen = 'home';
  const cache = {};

  document.querySelectorAll('i[data-icon]').forEach(e => { e.innerHTML = icon(e.dataset.icon); });
  const setPauseIcon = () => { $('bPause').innerHTML = icon(paused ? 'play' : 'pause'); $('bPause').classList.toggle('on', paused); };
  $('bSound').innerHTML = icon('sound'); setPauseIcon();
  function setText(id, v, anim) {
    if (cache[id] === v) return;
    const el = $(id);
    if (cache[id] !== undefined && anim) { const p = el.parentElement; p.classList.remove(anim); void p.offsetWidth; p.classList.add(anim); }
    cache[id] = v; el.textContent = v;
  }
  function hint(msg, bad) { $('hint').textContent = msg; $('hint').className = bad ? 'bad' : ''; hintT = bad ? 2.2 : 0; }
  function defaultHint() {
    if (view.skill) return 'Klik area peta untuk menjatuhkan Meteor. Esc untuk batal.';
    if (view.build) {
      if (view.hover && view.check) {
        if (!view.check.ok) return '⛔ ' + view.check.reason;
        const len = d => g.spawns.reduce((s, p) => s + d[p.y * C.W + p.x], 0);
        const diff = len(view.check.dist) - len(g.dist);
        return diff > 0 ? `🧭 Jalur musuh bertambah +${diff} langkah (garis kuning)` : 'Jalur tidak memanjang. Taruh menara memotong garis putih!';
      }
      return 'Klik petak untuk membangun. Esc atau klik kanan untuk batal.';
    }
    return 'Pilih menara, lalu bentuk labirin agar musuh berjalan lebih jauh.';
  }
  function banner(s) { const b = $('banner'); b.textContent = s; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
  function toast(s) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = s; $('toasts').appendChild(t); setTimeout(() => t.remove(), 3100); }
  function award(id) { if (prog.awards.includes(id)) return; prog.awards.push(id); save(); toast('🏆 Pencapaian: ' + AWARDS[id]); }

  /* ---------- Toko, skill, panel info ---------- */
  TYPES.forEach((id, i) => {
    const d = D.TOWERS[id], b = document.createElement('button');
    b.className = 'tw'; b.id = 'tw-' + id; b.title = d.desc;
    b.innerHTML = `<kbd>${i + 1}</kbd><span class="ic" style="color:${d.color}">${icon(id)}</span><b>${d.name}</b><em>${d.cost}</em>`;
    b.addEventListener('click', () => chooseBuild(view.build === id && !drag ? null : id));
    b.addEventListener('pointerdown', e => { drag = { id, x: e.clientX, y: e.clientY, moved: false }; });
    $('shop').appendChild(b);
  });
  let drag = null;
  addEventListener('pointermove', e => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 10) return;
    if (!drag.moved) { drag.moved = true; chooseBuild(drag.id); $('ghost').innerHTML = icon(drag.id); }
    $('ghost').hidden = false; $('ghost').style.left = e.clientX + 'px'; $('ghost').style.top = e.clientY + 'px';
    setHover(pointOn(e));
  });
  addEventListener('pointerup', e => {
    if (!drag) return;
    const d = drag; drag = null; $('ghost').hidden = true;
    if (d.moved) { const p = pointOn(e); if (p) tryBuild(p.cell); chooseBuild(null); }
  });
  addEventListener('pointercancel', () => { drag = null; $('ghost').hidden = true; });

  Object.entries(D.SKILLS).forEach(([id, s]) => {
    const b = document.createElement('button'); b.className = 'skill'; b.id = 'sk-' + id; b.title = s.desc;
    b.innerHTML = `<div class="cool"></div><span>${icon(id)} ${s.name} <kbd>${id === 'meteor' ? 'Q' : 'W'}</kbd></span>`;
    b.onclick = () => skill(id); $('skills').appendChild(b);
  });
  function skill(id) {
    if (!running) return;
    if (g.rules.noSkills) return fail('Skill dinonaktifkan di misi ini');
    if (!C.waveActive(g)) return fail('Skill hanya bisa dipakai saat ada musuh');
    if (g.cd[id] > 0) return fail('Skill masih diisi ulang');
    if (id === 'freeze') { C.act(g, ['F']); return; }
    view.skill = view.skill ? null : id; view.build = view.selected = view.enemy = null; hint(defaultHint());
  }
  function fail(msg) { hint('⛔ ' + msg, true); A.play('error'); }

  function chooseBuild(id) {
    if (id && !g.allow.includes(id)) return fail('Menara ini dilarang di sini');
    view.build = id; view.skill = null; view.selected = view.enemy = null; touchArm = null;
    if (view.hover && id) view.check = C.canBuild(g, view.hover.x, view.hover.y);
    hint(defaultHint());
    if (id) tutEvent('choose');
  }
  function tryBuild(cell) {
    if (!view.build) return;
    const check = C.canBuild(g, cell.x, cell.y);
    if (!C.act(g, ['b', cell.x, cell.y, view.build])) {
      if (!check.ok) return fail(check.reason);
      return fail(g.rules.maxTowers && g.towers.length >= g.rules.maxTowers ? 'Batas menara tercapai' : 'Koin kurang');
    }
    view.check = C.canBuild(g, cell.x, cell.y); touchArm = null;
    tutEvent('build');
    if (g.towers.length >= 10) award('builder');
    if (Math.max(...g.spawns.map(s => g.dist[s.y * C.W + s.x])) >= 30) award('maze');
  }

  function pointOn(e) {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * C.W, y = (e.clientY - r.top) / r.height * C.H;
    if (x < 0 || y < 0 || x >= C.W || y >= C.H) return null;
    return { cell: { x: x | 0, y: y | 0 }, point: { x: x - .5, y: y - .5 } };
  }
  function setHover(p) {
    view.hover = p && p.cell; view.point = p && p.point;
    if (view.hover && view.build) view.check = C.canBuild(g, view.hover.x, view.hover.y);
    if (!hintT) hint(defaultHint());
  }
  canvas.addEventListener('pointermove', e => { if (!drag) setHover(pointOn(e)); });
  canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !drag) setHover(null); });
  canvas.addEventListener('contextmenu', e => { e.preventDefault(); chooseBuild(null); });
  canvas.addEventListener('pointerdown', e => {
    if (e.button > 0 || !running || modal) return;
    const p = pointOn(e); if (!p) return;
    setHover(p);
    const round = v => Math.round(v * 100) / 100;
    if (view.skill) { if (C.act(g, ['M', round(p.point.x), round(p.point.y)])) view.skill = null; return; }
    const crate = g.crates.find(c => c.x === p.cell.x && c.y === p.cell.y);
    if (crate) { C.act(g, ['c', crate.id]); return; }
    const t = C.towerAt(g, p.cell.x, p.cell.y);
    if (t) { view.build = null; view.selected = t; view.enemy = null; tutEvent('select'); return; }
    if (view.build) {
      const key = p.cell.x + ',' + p.cell.y;
      if (e.pointerType === 'touch' && touchArm !== key) { touchArm = key; hint(view.check.ok ? 'Ketuk sekali lagi untuk membangun' : '⛔ ' + view.check.reason, !view.check.ok); return; }
      return tryBuild(p.cell);
    }
    view.selected = null;
    view.enemy = g.enemies.find(en => Math.hypot(en.x - p.point.x, en.y - p.point.y) < .6) || null;
  });

  function renderInfo() {
    const t = view.selected, e = view.enemy && !view.enemy.dead ? view.enemy : null;
    const key = t ? ['t', t.id, t.level, t.mode, g.gold >= C.upgradeCost(t), g.wave === 0].join()
      : e ? ['e', e.id, Math.ceil(e.hp)].join() : view.build ? 'b' + view.build : 'none';
    const tally = () => `${t.kills} kill · ${Math.round(t.damage)} damage`;
    if (key === infoKey) { if (t) setText('tally', tally()); return; }
    delete cache.tally;
    infoKey = key;
    const box = $('info');
    const row = (k, a, b) => `<span>${k}</span><b>${a}${b !== undefined && b !== a ? ` <u>→ ${b}</u>` : ''}</b>`;
    const stats = (s, n) => row('Damage', s.dmg, n && n.dmg) + row('Tembakan/detik', s.rate, n && n.rate) + row('Jangkauan', s.range, n && n.range) +
      (s.splash ? row('Radius ledakan', s.splash, n && n.splash) : '') + (s.slow ? row('Perlambatan', Math.round(s.slow * 100) + '%', n && Math.round(n.slow * 100) + '%') : '') + (s.chain ? row('Target berantai', s.chain, n && n.chain) : '');
    if (t) {
      const d = D.TOWERS[t.type], cost = C.upgradeCost(t);
      const round = s => s && Object.assign({}, s, { dmg: Math.round(s.dmg), rate: +s.rate.toFixed(2), range: +s.range.toFixed(2) });
      const next = cost === undefined ? null : C.statsOf(g, Object.assign({}, t, { level: t.level + 1 }));
      box.innerHTML = `<h3>${icon(t.type)} ${d.name} Lv.${t.level + 1} <small id="tally">${tally()}</small></h3>
        <div class="kv">${stats(round(C.statsOf(g, t)), round(next))}</div><small>Prioritas target (T)</small>
        <div class="modes">${Object.entries(MODES).map(([m, n]) => `<button data-mode="${m}" class="${t.mode === m ? 'on' : ''}">${n}</button>`).join('')}</div>
        <div class="row"><button id="bUp" class="primary" ${cost === undefined || g.gold < cost ? 'disabled' : ''}>${cost === undefined ? 'Level maksimal' : `Upgrade ${cost} (U)`}</button><button id="bSell" ${g.rules.noSell ? 'disabled' : ''}>${g.rules.noSell ? 'Tidak bisa dijual' : `Jual +${C.sellValue(g, t)} (X)`}</button></div>`;
    } else if (e) {
      const d = D.ENEMIES[e.type];
      box.innerHTML = `<h3><span><i class="dot" style="background:${d.color}"></i> ${d.name}</span></h3><p>${d.tip}</p><div class="kv">${row('HP', Math.ceil(e.hp) + ' / ' + e.max)}${row('Kecepatan', d.speed)}${row('Armor', d.armor)}${row('Nyawa yang dicuri', d.lives)}</div>`;
    } else if (view.build) {
      const d = D.TOWERS[view.build];
      box.innerHTML = `<h3>${icon(view.build)} ${d.name} <small>${d.cost} koin</small></h3><p>${d.desc}</p><div class="kv">${stats(d.levels[0])}</div>`;
    } else box.innerHTML = '<h3>Info</h3><p>Klik menara untuk upgrade atau jual. Klik musuh untuk melihat kelemahannya.</p><p>Tekan J untuk melihat cara musuh mencari jalan.</p>';
  }
  $('info').addEventListener('click', e => {
    const b = e.target.closest('button'), t = view.selected;
    if (!b || !t) return;
    if (b.dataset.mode) C.act(g, ['m', t.x, t.y, b.dataset.mode]);
    if (b.id === 'bUp') doUpgrade();
    if (b.id === 'bSell') doSell();
    infoKey = '';
  });
  function doUpgrade() { const t = view.selected; if (!t) return; if (!C.act(g, ['u', t.x, t.y])) return fail(C.upgradeCost(t) === undefined ? 'Sudah level maksimal' : 'Koin kurang'); if (t.level === 2) award('max'); infoKey = ''; }
  function doSell() { const t = view.selected; if (t && C.act(g, ['s', t.x, t.y])) view.selected = null; else if (t && g.rules.noSell) fail('Menara tidak bisa dijual di misi ini'); }

  const chips = wave => {
    const sum = {};
    for (const [t, n] of wave) sum[t] = (sum[t] || 0) + n;
    return Object.entries(sum).map(([t, n]) => `<span class="chip" title="${D.ENEMIES[t].tip}"><i class="dot" style="background:${D.ENEMIES[t].color}"></i>${D.ENEMIES[t].name} ×${n}</span>`).join('');
  };
  function updateHud() {
    setText('lives', g.lives, 'hurt'); setText('gold', g.gold, 'bump'); setText('wave', g.wave + '/' + (g.rules.endless ? '∞' : g.waves), 'bump'); setText('score', g.score);
    for (const id of TYPES) { const b = $('tw-' + id), ok = g.allow.includes(id); b.disabled = !ok; b.classList.toggle('poor', ok && g.gold < D.TOWERS[id].cost); b.classList.toggle('on', view.build === id); }
    for (const [id, s] of Object.entries(D.SKILLS)) { const b = $('sk-' + id); b.firstChild.style.width = Math.min(100, g.cd[id] / (s.cd / g.mod.mana) * 100) + '%'; b.classList.toggle('on', view.skill === id); b.disabled = g.rules.noSkills || !C.waveActive(g) || g.cd[id] > 0; }
    const next = g.wave < g.waves ? C.waveDef(g.wave + 1) : null;
    if (previewKey !== String(g.wave)) {
      previewKey = String(g.wave);
      $('preview').innerHTML = next ? `<h3>Gelombang ${g.wave + 1} berikutnya</h3><div class="chips">${chips(next)}</div>` : '<h3>Gelombang terakhir!</h3>';
    }
    const b = $('bWave');
    let label = '▶ Mulai gelombang 1 (Spasi)';
    if (g.queue.length) label = `Gelombang ${g.wave} datang… (${g.queue.length})`;
    else if (!next) label = 'Bertahanlah!';
    else if (g.countdown !== null) label = `Panggil sekarang +${Math.floor(g.countdown * D.BALANCE.earlyBonusPerSec)} koin · ${Math.ceil(g.countdown)}s`;
    else if (g.wave) label = 'Panggil gelombang berikutnya';
    if (b.textContent !== label) b.textContent = label;
    b.disabled = !running || !!g.queue.length || !next;
    b.classList.toggle('pulse', !b.disabled && !g.enemies.length);
    if (g.info.mission) {
      const list = g.info.mission.goals.map((o, i) => ({ text: o.text, ok: i > 0 && o.test(g) }));
      const key = list.map(o => +o.ok).join('') + g.info.key;
      if (key !== goalKey) { goalKey = key; $('goals').innerHTML = '<h3>Sasaran bintang <small>' + esc(g.info.mission.story) + '</small></h3>' + list.map(o => `<div class="goal ${o.ok ? 'ok' : ''}"><span>${o.ok ? '★' : '☆'}</span>${o.text}</div>`).join(''); }
    }
    if (cache.perks !== g.perks.length) { cache.perks = g.perks.length; $('perks').innerHTML = g.perks.map(p => `<span class="chip" title="${D.PERKS[p].desc}">${D.PERKS[p].name}</span>`).join(''); }
    renderInfo();
  }

  function callWave() { if (running && C.act(g, ['w'])) tutEvent('wave'); }
  $('bWave').onclick = callWave;

  /* ---------- Modal ---------- */
  function openModal(type, html, closable) {
    if (!modal && running) { modalWasPaused = paused; setPause(true); }
    modal = type; $('mBody').innerHTML = html; $('mClose').hidden = !closable; $('modal').hidden = false;
  }
  let modalWasPaused = false;
  function closeModal() {
    if (!modal) return;
    modal = null; $('modal').hidden = true;
    if (running) setPause(modalWasPaused);
    if (screen === 'game' && running && g.offer) showPerks();
  }
  $('mClose').onclick = closeModal;
  const msg = (text, bad) => { const el = $('msg'); if (el) { el.textContent = text; el.className = 'msg' + (bad ? ' bad' : ''); } };

  function showGuide(tab = 'Alur') {
    if (modal === 'perk' || modal === 'result') return;
    openModal('guide', `<h2>Panduan</h2><div class="seg">${Object.keys(KGuide).map(n => `<button data-tab="${n}" class="${n === tab ? 'on' : ''}">${n}</button>`).join('')}</div><div id="gbody">${KGuide[tab]()}</div>`, true);
    $('mBody').querySelectorAll('[data-tab]').forEach(b => b.onclick = () => showGuide(b.dataset.tab));
  }

  function showPerks() {
    openModal('perk', `<div class="center"><h2>Pilih kartu bonus</h2><p>Gelombang ${g.wave} bersih. Bonus berlaku sampai permainan selesai.</p><div class="perkgrid">${g.offer.map((id, i) => `<button class="perk" data-perk="${i}"><b>${D.PERKS[id].name}</b><span>${D.PERKS[id].desc}</span></button>`).join('')}</div></div>`, false);
    $('mBody').querySelectorAll('[data-perk]').forEach(b => b.onclick = () => { if (C.act(g, ['p', +b.dataset.perk])) { A.play('upgrade'); closeModal(); } });
  }

  function boardList() {
    const out = [['daily-' + M.today(), 'Tantangan hari ini']];
    D.MAPS.forEach(m => { for (const mode of ['free', 'endless']) for (const [d, v] of Object.entries(D.DIFFS)) out.push([`${mode}-${m.id}-${d}`, `${mode === 'free' ? 'Bebas' : 'Tanpa Akhir'} · ${m.name} · ${v.name}`]); });
    M.MISSIONS.forEach(m => out.push(['mission-' + m.id, `Misi ${m.id + 1}: ${m.name}`]));
    return out;
  }
  function showBoard(board, source = 'local') {
    if (modal === 'perk' || modal === 'result') return;
    board = board || (running ? g.info.key : 'daily-' + M.today());
    openModal('board', `<h2>Leaderboard</h2><select id="bSel" aria-label="Pilih papan">${boardList().map(([k, n]) => `<option value="${k}" ${k === board ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <div class="seg">${[['local', 'Perangkat ini'], ['github', 'GitHub'], ['online', 'Online']].map(([k, n]) => `<button data-src="${k}" class="${k === source ? 'on' : ''}">${n}</button>`).join('')}</div><div id="rows">Memuat…</div>`, true);
    $('bSel').onchange = e => showBoard(e.target.value, source);
    $('mBody').querySelectorAll('[data-src]').forEach(b => b.onclick = () => showBoard(board, b.dataset.src));
    const el = $('rows');
    const draw = rows => { el.innerHTML = rows.length ? `<div class="scroll"><table><tr><th>#</th><th>Nama</th><th>Skor</th><th>Gelombang</th><th>Status</th></tr>${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td>${Number(r.score) || 0}</td><td>${Number(r.wave) || 0}</td><td>${source === 'local' ? 'lokal' : r.verified ? '✔ terverifikasi' : 'belum diverifikasi'}</td></tr>`).join('')}</table></div>` : '<p>Belum ada skor. Jadilah yang pertama!</p>'; };
    if (source === 'local') return draw(N.local(board));
    N[source](board).then(rows => { if (el.isConnected) draw(rows); }).catch(e => { if (el.isConnected) el.textContent = source === 'github' ? 'Leaderboard GitHub tersedia setelah game dibuka dari web (GitHub Pages).' : e.message; });
  }

  function showAccount() {
    const u = N.user;
    openModal('account', `<h2>Profil</h2><div class="form"><label>Nama pemain<input id="pName" maxlength="20" value="${esc(prog.name)}" placeholder="Namamu"></label><button id="pSave" class="primary">Simpan nama</button></div>
      <p>${totalStars()}/72 bintang · ${prog.awards.length}/${Object.keys(AWARDS).length} pencapaian</p>
      <h3>Akun cloud</h3>${!N.hasSupa ? '<p><small>Belum aktif. Pemilik game perlu memasang Supabase (lihat README).</small></p>' : u ? `<p>Masuk sebagai <b>${esc(u.email)}</b></p><div class="row"><button id="pSync">Sinkronkan</button><button id="pOut">Keluar</button></div>` : '<div class="form"><input id="pMail" type="email" placeholder="Email" autocomplete="email"><input id="pPass" type="password" placeholder="Kata sandi (min. 6)" autocomplete="current-password"><div class="row"><button id="pIn" class="primary">Masuk</button><button id="pUp">Daftar</button></div></div>'}<div id="msg" class="msg"></div>`, true);
    $('pSave').onclick = () => { prog.name = $('pName').value.trim(); save(); renderHome(); msg('Nama disimpan'); };
    const run = (fn, ok) => async () => { msg('Memproses…'); try { const r = await fn(); if (r === false) return msg('Cek email untuk konfirmasi, lalu masuk.'); await syncCloud(); showAccount(); msg(ok); } catch (e) { msg(e.message, true); } };
    if ($('pIn')) { $('pIn').onclick = run(() => N.signIn($('pMail').value, $('pPass').value), 'Berhasil masuk'); $('pUp').onclick = run(() => N.signUp($('pMail').value, $('pPass').value), 'Akun dibuat'); }
    if ($('pOut')) { $('pOut').onclick = () => { N.signOut(); showAccount(); }; $('pSync').onclick = run(async () => true, 'Tersinkron'); }
  }

  /* ---------- Layar ---------- */
  function show(name) {
    screen = name;
    for (const id of ['home', 'select', 'game']) $(id).hidden = id !== name;
    scrollTo(0, 0);
  }
  function miniMap(m) {
    const c = document.createElement('canvas'); c.width = 150; c.height = 90; const x = c.getContext('2d');
    x.fillStyle = '#1b2748'; x.fillRect(0, 0, 150, 90);
    m.rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') { x.fillStyle = ch === '#' ? '#7c86b0' : ch === 'S' ? '#c084fc' : '#5eead4'; x.fillRect(i * 10 + 1, j * 10 + 1, 8, 8); } }));
    return c;
  }
  const nextMission = () => { const i = M.MISSIONS.findIndex(m => !prog.missions[m.id]); return i < 0 ? M.MISSIONS.length - 1 : i; };
  function renderHome() {
    const lvl = 1 + Math.floor(totalStars() / 6);
    $('profileBtn').innerHTML = `${icon('user')} ${esc(prog.name || 'Pemain')} · Lv.${lvl}`;
    const n = nextMission(), d = M.daily(M.today()), db = prog.best['daily-' + d.date];
    $('continueBtn').innerHTML = `▶ ${totalStars() ? 'Lanjutkan' : 'Mulai'}: Misi ${n + 1}`;
    $('mCampaign').textContent = `★ ${totalStars()} / 72`;
    $('mDaily').textContent = `${D.MAPS[d.map].name}. ${d.twist}`;
    $('mDailyBest').textContent = db ? 'Terbaikmu: ' + db.score : 'Belum dimainkan';
    $('awardList').innerHTML = Object.entries(AWARDS).map(([id, t]) => `<span class="badge ${prog.awards.includes(id) ? 'got' : ''}">${prog.awards.includes(id) ? '★' : '☆'} ${t}</span>`).join('');
  }
  let freeDiff = 'normal';
  function showSelect(mode) {
    show('select');
    const body = $('selectBody'); body.innerHTML = '';
    const tile = (grid, html, map, disabled, onclick) => { const b = document.createElement('button'); b.className = 'tile'; b.disabled = disabled; b.appendChild(miniMap(D.MAPS[map])); b.insertAdjacentHTML('beforeend', html); b.onclick = onclick; grid.appendChild(b); };
    if (mode === 'campaign') {
      $('selectTitle').textContent = `Kampanye · ★ ${totalStars()}/72`;
      M.CHAPTERS.forEach((name, c) => {
        const ms = M.MISSIONS.filter(m => m.chapter === c);
        body.insertAdjacentHTML('beforeend', `<div class="chapter"><b>Bab ${c + 1}: ${name}</b><small>★ ${ms.reduce((s, m) => s + (prog.missions[m.id] || 0), 0)}/${ms.length * 3}</small></div>`);
        const grid = document.createElement('div'); grid.className = 'grid'; body.appendChild(grid);
        ms.forEach(m => tile(grid, `<b>${unlocked(m.id) ? '' : icon('lock')} ${m.id + 1}. ${m.name}</b><small>${D.DIFFS[m.diff].name} · ${m.waves} gelombang</small><span class="stars">${starText(prog.missions[m.id] || 0)}</span>`, m.map, !unlocked(m.id), () => showBrief(m.id)));
      });
    } else {
      $('selectTitle').textContent = mode === 'free' ? 'Main Bebas' : 'Tanpa Akhir';
      body.innerHTML = `<div class="seg">${Object.entries(D.DIFFS).map(([id, d]) => `<button data-diff="${id}" class="${id === freeDiff ? 'on' : ''}">${d.name} <small>${d.lives} nyawa · ${d.gold} koin</small></button>`).join('')}</div><div class="grid"></div>`;
      body.querySelectorAll('[data-diff]').forEach(b => b.onclick = () => { freeDiff = b.dataset.diff; showSelect(mode); });
      D.MAPS.forEach((m, i) => { const rec = prog.best[`${mode}-${m.id}-${freeDiff}`]; tile(body.lastChild, `<b>${m.name}</b><small>${m.note}</small><small>${rec ? `Terbaik ${rec.score} · gel. ${rec.wave}` : 'Belum dimainkan'}</small>`, i, false, () => start({ mode, map: i, diff: freeDiff })); });
    }
  }
  function showBrief(id) {
    const m = M.MISSIONS[id];
    openModal('brief', `<h2>Misi ${id + 1}: ${m.name}</h2><p>${m.story}</p><p><small>${D.MAPS[m.map].name} · ${D.DIFFS[m.diff].name} · menara: ${(m.rules.allow || TYPES).map(t => D.TOWERS[t].name).join(', ')}${m.rules.maxTowers ? ' · maks ' + m.rules.maxTowers : ''}${m.rules.noSell ? ' · tanpa jual' : ''}${m.rules.noSkills ? ' · tanpa skill' : ''}</small></p>
      <h3>Sasaran bintang</h3>${m.goals.map(o => `<div class="goal"><span>☆</span>${o.text}</div>`).join('')}<br><label><input type="checkbox" id="tutToggle" style="width:auto" ${prog.tutorial ? '' : 'checked'}> Tampilkan tutorial interaktif</label><br><br><button id="goBtn" class="primary big">▶ Mulai misi</button>`, true);
    $('goBtn').onclick = () => { const t = $('tutToggle').checked; closeModal(); start({ mode: 'mission', id }, t); };
  }

  function load(spec) {
    g = M.newGame(spec);
    Object.assign(view, { hover: null, build: null, selected: null, enemy: null, skill: null, tutorialCell: null });
    combo = 0; infoKey = previewKey = goalKey = ''; acc = 0;
    for (const k in cache) delete cache[k];
    $('goals').hidden = !g.info.mission;
    $('gTitle').textContent = g.info.title;
    $('gSub').textContent = g.info.twist || `${D.MAPS[g.mapIndex].name} · ${g.diff.name}`;
    R.reset(); R.resize(g);
  }
  function start(spec, tutorial) {
    A.unlock(); modal = null; $('modal').hidden = true; show('game'); load(spec); running = true; setPause(false); hint(defaultHint());
    banner(D.MAPS[g.mapIndex].name);
    if (tutorial) { tut = 0; showTut(); } else endTut();
  }
  function setPause(p) { paused = p; setPauseIcon(); }
  function goHome() { running = false; modal = null; $('modal').hidden = true; endTut(); renderHome(); show('home'); }
  function showMenu() {
    if (modal === 'perk') return;
    if (!running) return goHome();
    openModal('pause', `<div class="center"><h2>Jeda</h2><p>Tutup layar ini untuk lanjut. Untuk membangun saat jeda, pakai tombol jeda di atas.</p><button id="pGo" class="primary big">Lanjut</button><div class="row"><button id="pRe">Ulangi</button><button id="pHome">Keluar ke Beranda</button></div></div>`, true);
    $('pGo').onclick = closeModal; $('pRe').onclick = () => start(g.spec, false); $('pHome').onclick = goHome;
  }
  $('bMenu').onclick = showMenu;
  $('bPause').onclick = () => setPause(!paused);
  $('bSpeed').onclick = () => { speed = speed % 3 + 1; $('bSpeed').textContent = speed + '×'; $('bSpeed').classList.toggle('on', speed > 1); };
  $('bSound').onclick = () => { $('bSound').innerHTML = icon(A.toggle() ? 'mute' : 'sound'); };
  $('bPath').onclick = () => { view.showFlow = !view.showFlow; $('bPath').classList.toggle('on', view.showFlow); if (view.showFlow) { hint('Angka = jarak ke istana (BFS). Panah = arah yang dipilih musuh.'); hintT = 4; tutEvent('flow'); } };
  $('profileBtn').onclick = showAccount;
  $('continueBtn').onclick = () => showBrief(nextMission());
  document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => b.dataset.open === 'guide' ? showGuide() : showBoard());
  document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
    const to = b.dataset.go;
    if (to === 'home') goHome();
    else if (to === 'daily') start({ mode: 'daily', date: M.today() });
    else showSelect(to);
  });

  /* ---------- Hasil ---------- */
  function finish(win) {
    running = false; endTut();
    const cur = g, key = g.info.key, stars = M.starsOf(g), old = prog.best[key], record = !old || g.score > old.score;
    if (record) prog.best[key] = { score: g.score, wave: g.wave, stars };
    if (g.info.mission) prog.missions[g.info.mission.id] = Math.max(prog.missions[g.info.mission.id] || 0, stars);
    const name = prog.name || 'Pemain';
    N.addLocal(key, { name, score: g.score, wave: g.wave, stars });
    save();
    if (win) award('first');
    if (win && g.spec.mode === 'daily') award('daily');
    if (totalStars() >= 36) award('stars');
    if (M.MISSIONS.every(m => prog.missions[m.id])) award('all');
    const replay = M.toReplay(g), mvp = [...g.towers].sort((a, b) => b.damage - a.damage)[0];
    setTimeout(() => {
      if (cur !== g || screen !== 'game') return;
      const mi = g.info.mission, next = mi && win && M.MISSIONS[mi.id + 1];
      const met = M.goalsMet(g);
      openModal('result', `<div class="center"><h2>${win ? 'Kemenangan!' : g.rules.endless ? 'Pertahanan selesai' : 'Istana jatuh'}</h2><div class="stars">${starText(stars)}</div>
        <p>Skor <b>${g.score}</b>${record ? ' · rekor baru!' : ''}<br>Gelombang ${g.wave} · ${g.kills} musuh · jalur terpanjang ${g.stats.maze}</p>
        ${mi ? mi.goals.map((o, i) => `<div class="goal ${met[i] ? 'ok' : ''}" style="justify-content:center"><span>${met[i] ? '★' : '☆'}</span>${o.text}</div>`).join('') : ''}
        ${mvp ? `<p><small>Menara terbaik: ${D.TOWERS[mvp.type].name} Lv.${mvp.level + 1} (${Math.round(mvp.damage)} damage)</small></p>` : ''}
        ${win ? '' : '<p><small>Tips: panjangkan jalur, campur jenis menara, dan upgrade menara di tikungan.</small></p>'}
        <div class="row">${next ? '<button id="rNext" class="primary">Misi berikutnya</button>' : ''}<button id="rAgain" class="${next ? '' : 'primary'}">Main lagi</button><button id="rHome">Beranda</button></div>
        <div class="row">${N.hasServer || N.hasSupa ? '<button id="rSend">Kirim skor online</button>' : ''}<button id="rIssue">Kirim lewat GitHub</button></div><div id="msg" class="msg"></div></div>`, false);
      if (next) $('rNext').onclick = () => { goHome(); showSelect('campaign'); showBrief(next.id); };
      $('rAgain').onclick = () => start(cur.spec, false);
      $('rHome').onclick = goHome;
      if ($('rSend')) $('rSend').onclick = async e => {
        const b = e.currentTarget; b.disabled = true; msg('Mengirim…');
        try { await N.submit(name, replay, { score: cur.score, wave: cur.wave, stars }, key); msg('Skor terkirim!'); }
        catch (err) { msg(err.message, true); b.disabled = false; }
      };
      $('rIssue').onclick = () => {
        if (!N.repo) return msg('Aktif setelah game di-deploy ke GitHub Pages (atau isi githubRepo di config.js).', true);
        const s = N.issue(key, replay);
        const open = () => { window.open(s.url, '_blank', 'noopener'); msg('Di tab GitHub, tekan "Create" untuk mengirim.' + (s.paste ? ' Tempel dulu kodenya.' : '')); };
        if (!s.paste) return open();
        const manual = () => { $('msg').innerHTML = `Salin kode ini, lalu <a href="${esc(s.url)}" target="_blank" rel="noopener" style="color:inherit">buka form GitHub</a>:<textarea readonly rows="3" style="width:100%">${s.code}</textarea>`; };
        navigator.clipboard ? navigator.clipboard.writeText(s.code).then(open, manual) : manual();
      };
    }, 1100);
  }
  /* ---------- Tutorial interaktif ---------- */
  const STEPS = [
    { t: 'Selamat datang! Musuh keluar dari portal ungu dan berjalan mengikuti garis putih menuju istanamu. Kalau sampai, nyawamu berkurang.' },
    { t: 'Pilih menara Panah di panel Menara (atau tekan 1).', on: 'choose', glow: 'tw-arrow' },
    { t: 'Taruh di petak yang berkedip (di HP: ketuk 2×). Garis kuning memperlihatkan jalur baru musuh.', on: 'build', cell: true },
    { t: 'Tekan tombol jalur (atau J) untuk melihat pathfinding: angka adalah jarak ke istana, panah adalah arah jalan musuh. Tekan lagi untuk menutupnya.', on: 'flow', glow: 'bPath' },
    { t: 'Klik menara yang sudah dibangun untuk melihat upgrade, prioritas target, dan tombol jual.', on: 'select' },
    { t: 'Bangun beberapa menara lagi untuk membentuk labirin, lalu mulai gelombang pertama. Sebelum gelombang 1, menjual mengembalikan 100% koin.', on: 'wave', glow: 'bWave' },
    { t: 'Hebat! Saat genting, pakai Meteor (Q) atau Beku (W). Panggil gelombang lebih awal untuk bonus koin. Selamat bertahan!', glow: 'skills' }
  ];
  function showTut() {
    document.querySelectorAll('.glow').forEach(e => e.classList.remove('glow'));
    view.tutorialCell = null;
    const s = STEPS[tut];
    if (!s) { prog.tutorial = true; save(); return endTut(); }
    $('coach').hidden = false;
    $('cstep').textContent = `LANGKAH ${tut + 1} / ${STEPS.length}`;
    $('ctext').textContent = s.t;
    $('cnext').textContent = tut === STEPS.length - 1 ? 'Selesai' : s.on ? 'Lewati langkah' : 'Lanjut';
    if (s.glow) $(s.glow).classList.add('glow');
    if (s.cell) view.tutorialCell = [{ x: 3, y: 4 }, { x: 2, y: 4 }, { x: 2, y: 3 }, { x: 6, y: 4 }].find(c => C.canBuild(g, c.x, c.y).ok) || null;
  }
  function tutEvent(name) { if (tut >= 0 && STEPS[tut] && STEPS[tut].on === name) { tut++; showTut(); } }
  function endTut() { tut = -1; view.tutorialCell = null; $('coach').hidden = true; document.querySelectorAll('.glow').forEach(e => e.classList.remove('glow')); }
  $('cnext').onclick = () => { tut++; showTut(); };
  $('cskip').onclick = () => { prog.tutorial = true; save(); endTut(); };


  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (modal) { if ((k === 'escape' || (k === 'p' && modal === 'pause') || (k === 'h' && modal === 'guide')) && !$('mClose').hidden) closeModal(); return; }
    if (k === 'h') return showGuide();
    if (screen !== 'game' || !running) return;
    if (k === ' ') { e.preventDefault(); if (!e.repeat) callWave(); }
    else if (TYPES[+k - 1]) chooseBuild(TYPES[+k - 1]);
    else if (k === 'escape') { if (view.build || view.skill || view.selected) { view.selected = null; chooseBuild(null); } else showMenu(); }
    else if (k === 'u') doUpgrade();
    else if (k === 'x') doSell();
    else if (k === 't' && view.selected) { const m = Object.keys(MODES), t = view.selected; C.act(g, ['m', t.x, t.y, m[(m.indexOf(t.mode) + 1) % m.length]]); }
    else if (k === 'q') skill('meteor');
    else if (k === 'w') skill('freeze');
    else { const id = { p: 'bPause', f: 'bSpeed', m: 'bSound', j: 'bPath' }[k]; if (id) $(id).click(); }
  });
  addEventListener('keyup', e => { if (e.key === ' ' && screen === 'game' && !modal) e.preventDefault(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && running && !modal) setPause(true); });

  /* ---------- Loop ---------- */
  function handle(e) {
    R.event(g, e);
    A.play({ shoot: e.type, crate: 'frost', loot: 'upgrade', offer: 'win', perk: 'upgrade' }[e.k] || e.k);
    if (e.k === 'wave') { const w = C.waveDef(e.v); banner(w.some(x => x[0] === 'boss') ? '👑 BOS DATANG!' : w.some(x => x[0] === 'flyer') ? `Gelombang ${e.v} · Awas udara!` : `Gelombang ${e.v}`); if (g.rules.endless && e.v >= 20) award('endless'); }
    if (e.k === 'kill') { if (g.combo >= 3) { combo = g.combo; $('combo').textContent = `COMBO ×${g.combo}`; $('combo').classList.add('show'); } if (g.combo >= 10) award('combo'); if (e.boss) award('boss'); }
    if (e.k === 'loot' && g.stats.crates >= 3) award('loot');
    if (e.k === 'offer' && g.offer) showPerks();
    if (e.k === 'win') { banner('MENANG!'); finish(true); }
    if (e.k === 'lose') { banner(g.rules.endless ? 'SELESAI' : 'KALAH'); finish(false); }
  }
  let lastT = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.min(.1, (now - lastT) / 1000); lastT = now;
    if (screen === 'game') {
      if (running && !paused && !g.offer) {
        acc += dt * speed;
        while (acc >= C.TICK) { C.step(g); acc -= C.TICK; if (g.offer || g.over) { acc = 0; break; } }
      }
      while (g.events.length) handle(g.events.shift());
      if (combo && g.combo < 3) { combo = 0; $('combo').classList.remove('show'); }
      if (view.selected && !g.towers.includes(view.selected)) view.selected = null;
      if (view.skill && !C.waveActive(g)) view.skill = null;
      if (view.build && view.hover) view.check = C.canBuild(g, view.hover.x, view.hover.y);
      if (hintT && (hintT -= dt) <= 0) { hintT = 0; hint(defaultHint()); }
      updateHud();
      R.draw(g, view, dt, now / 1000);
    }
    requestAnimationFrame(frame);
  }

  let combo = 0;
  R.init(canvas); renderHome(); show('home');
  new ResizeObserver(() => { if (screen === 'game') R.resize(g); }).observe($('stage'));
  if (N.user) syncCloud().catch(() => toast('Gagal memuat progres cloud'));
  window.__towers = { get game() { return g; }, view, start };
  requestAnimationFrame(frame);
})();
