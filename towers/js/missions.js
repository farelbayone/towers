/* Mode permainan, 24 misi kampanye, tantangan harian, dan replay. */
(function (root) {
  const D = root.KData || require('./data.js');
  const C = root.KCore || require('./core.js');
  const N = typeof module !== 'undefined';

  /* Sasaran bintang tambahan. Bintang pertama selalu "menang". */
  const GOALS = {
    lives:   v => ({ text: `Sisakan minimal ${v} nyawa`, test: g => g.lives >= v }),
    towers:  v => ({ text: `Pakai paling banyak ${v} menara`, test: g => g.stats.maxTowers <= v }),
    maze:    v => ({ text: `Buat jalur sepanjang ${v} langkah`, test: g => g.stats.maze >= v }),
    nosell:  () => ({ text: 'Tanpa menjual menara', test: g => g.stats.sold === 0 }),
    noskill: () => ({ text: 'Tanpa memakai skill', test: g => g.stats.skills === 0 }),
    early:   v => ({ text: `Panggil gelombang lebih awal ${v} kali`, test: g => g.stats.early >= v }),
    crates:  v => ({ text: `Ambil ${v} peti harta`, test: g => g.stats.crates >= v }),
    combo:   v => ({ text: `Raih combo ${v}`, test: g => g.stats.maxCombo >= v }),
    level:   () => ({ text: 'Naikkan satu menara ke level 3', test: g => g.stats.maxLevel >= 3 }),
    meteor:  v => ({ text: `Kalahkan ${v} musuh dengan Meteor`, test: g => g.stats.meteorKills >= v })
  };

  const CHAPTERS = ['Perekrutan', 'Garis Depan', 'Medan Sulit', 'Legenda'];
  /* [nama, cerita, peta, kesulitan, jumlah gelombang, sasaran 2, sasaran 3, aturan] */
  const RAW = [
    ['Pos Pertama', 'Slime pertama mendekat. Hentikan mereka.', 0, 'easy', 5, ['lives', 20], ['nosell'], { allow: ['arrow'] }],
    ['Tembok Hidup', 'Menaramu adalah tembok. Perpanjang jalur.', 0, 'easy', 6, ['maze', 18], ['lives', 20], { allow: ['arrow', 'frost'] }],
    ['Dentuman', 'Meriam datang untuk gerombolan.', 1, 'easy', 7, ['combo', 4], ['lives', 20], { allow: ['arrow', 'cannon'] }],
    ['Dingin Menggigit', 'Perlambat para pelari.', 3, 'easy', 7, ['early', 2], ['lives', 20], {}],
    ['Sayap Malam', 'Kelelawar mengabaikan labirinmu.', 0, 'easy', 9, ['level'], ['lives', 20], {}],
    ['Raja Pertama', 'Raja Slime turun tangan.', 1, 'easy', 10, ['meteor', 3], ['lives', 20], {}],

    ['Dua Arah', 'Musuh datang dari dua gerbang.', 2, 'normal', 8, ['early', 3], ['lives', 16], {}],
    ['Hemat Pasukan', 'Menaramu dibatasi.', 0, 'normal', 8, ['level'], ['lives', 16], { maxTowers: 10 }],
    ['Tanpa Es', 'Persediaan es habis.', 3, 'normal', 9, ['crates', 1], ['lives', 15], { allow: ['arrow', 'cannon', 'tesla'] }],
    ['Reruntuhan', 'Gunakan tembok kuno.', 4, 'normal', 10, ['maze', 34], ['lives', 15], {}],
    ['Modal Tipis', 'Mulai dengan koin sedikit.', 1, 'normal', 10, ['nosell'], ['lives', 14], { gold: 180 }],
    ['Dua Mahkota', 'Bos menunggu di gelombang sepuluh.', 5, 'normal', 10, ['early', 4], ['lives', 15], {}],

    ['Sunyi Sihir', 'Skill tidak berfungsi di sini.', 0, 'normal', 12, ['maze', 28], ['lives', 14], { noSkills: true }],
    ['Sekali Pasang', 'Menara tidak bisa dijual.', 2, 'normal', 12, ['crates', 2], ['lives', 14], { noSell: true }],
    ['Kulit Tebal', 'Musuh lebih tebal dari biasanya.', 3, 'normal', 12, ['level'], ['lives', 12], { hp: 1.12 }],
    ['Gugusan Batu', 'Ruang bangun sempit.', 5, 'normal', 13, ['towers', 18], ['lives', 12], {}],
    ['Artileri', 'Hanya Meriam, Panah, dan Es.', 1, 'normal', 13, ['combo', 6], ['lives', 12], { allow: ['arrow', 'cannon', 'frost'] }],
    ['Serbuan Besar', 'Bertahanlah sampai gelombang 15.', 0, 'normal', 15, ['early', 5], ['lives', 14], {}],

    ['Veteran', 'Tingkat Sulit dimulai.', 1, 'hard', 10, ['nosell'], ['lives', 10], {}],
    ['Pasukan Elit', 'Maksimal dua belas menara.', 0, 'hard', 12, ['level'], ['lives', 9], { maxTowers: 12 }],
    ['Labirin Maut', 'Panjang jalur menentukan.', 4, 'hard', 12, ['maze', 36], ['lives', 9], {}],
    ['Badai Sayap', 'Gerbang atas terbuka.', 3, 'hard', 13, ['meteor', 8], ['lives', 8], {}],
    ['Kepungan', 'Dua gerbang, tingkat Sulit.', 2, 'hard', 12, ['crates', 2], ['lives', 8], {}],
    ['Menara Terakhir', 'Pertempuran penentuan.', 0, 'hard', 15, ['early', 5], ['lives', 10], {}]
  ];
  const MISSIONS = RAW.map(([name, story, map, diff, waves, g2, g3, rules], i) => ({
    id: i, chapter: (i / 6) | 0, name, story, map, diff, waves, rules,
    goals: [{ text: `Tahan ${waves} gelombang`, test: () => true }, GOALS[g2[0]](g2[1]), GOALS[g3[0]](g3[1])]
  }));

  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
  const today = () => new Date().toISOString().slice(0, 10); // UTC, sama untuk semua pemain

  function daily(date) {
    const h = hash('towers-' + date), types = Object.keys(D.TOWERS);
    const twist = [
      { text: 'Tanpa ' + D.TOWERS[types[1 + (h >>> 8) % 3]].name, rules: { allow: types.filter(t => t !== types[1 + (h >>> 8) % 3]) } },
      { text: 'Musuh +10% HP, koin awal 300', rules: { hp: 1.1, gold: 300 } },
      { text: 'Tanpa skill, koin awal 280', rules: { noSkills: true, gold: 280 } },
      { text: 'Maksimal 16 menara', rules: { maxTowers: 16 } }
    ][(h >>> 4) % 4];
    return { date, map: h % D.MAPS.length, diff: 'normal', twist: twist.text, rules: twist.rules };
  }

  /* Satu spesifikasi ringkas -> aturan lengkap. Server hanya percaya spesifikasi ini. */
  function resolve(spec) {
    const int = (v, n) => Number.isInteger(v) && v >= 0 && v < n;
    if (!spec) return null;
    if (spec.mode === 'mission' && int(spec.id, MISSIONS.length)) {
      const m = MISSIONS[spec.id];
      return { key: 'mission-' + m.id, map: m.map, diff: m.diff, title: `Misi ${m.id + 1}: ${m.name}`, rules: Object.assign({ waves: m.waves, seed: hash('mission' + m.id) }, m.rules), mission: m };
    }
    if ((spec.mode === 'free' || spec.mode === 'endless') && int(spec.map, D.MAPS.length) && Object.prototype.hasOwnProperty.call(D.DIFFS, spec.diff)) {
      const key = `${spec.mode}-${D.MAPS[spec.map].id}-${spec.diff}`;
      return { key, map: spec.map, diff: spec.diff, title: `${spec.mode === 'free' ? 'Bebas' : 'Tanpa Akhir'}: ${D.MAPS[spec.map].name}`, rules: { endless: spec.mode === 'endless', seed: hash(key) } };
    }
    if (spec.mode === 'daily' && /^\d{4}-\d\d-\d\d$/.test(spec.date)) {
      const d = daily(spec.date);
      return { key: 'daily-' + d.date, map: d.map, diff: d.diff, title: 'Harian ' + d.date, rules: Object.assign({ waves: 12, seed: hash(d.date) }, d.rules), twist: d.twist };
    }
    return null;
  }
  function newGame(spec) {
    const r = resolve(spec);
    if (!r) return null;
    const g = C.createGame(r.map, r.diff, r.rules);
    g.spec = spec; g.info = r;
    return g;
  }
  const goalsMet = g => !g.info.mission ? [] : g.info.mission.goals.map(o => g.over === 'win' && o.test(g));
  const starsOf = g => g.info.mission ? goalsMet(g).filter(Boolean).length : C.stars(g);

  const VERSION = 1, MAX_TICKS = 60 * 60 * 90, MAX_ACTIONS = 4000;
  const toReplay = g => ({ v: VERSION, spec: g.spec, ticks: g.tick, actions: g.actions });

  /* Mainkan ulang aksi pemain; skor dihitung ulang, bukan dipercaya. */
  function verify(rep) {
    const bad = error => ({ ok: false, error });
    if (!rep || rep.v !== VERSION || !Array.isArray(rep.actions)) return bad('Format replay tidak dikenal');
    if (rep.actions.length > MAX_ACTIONS || !Number.isInteger(rep.ticks) || rep.ticks < 1 || rep.ticks > MAX_TICKS) return bad('Replay terlalu besar');
    const g = newGame(rep.spec);
    if (!g) return bad('Mode tidak valid');
    let i = 0;
    while (!g.over) {
      while (i < rep.actions.length && Array.isArray(rep.actions[i]) && rep.actions[i][0] === g.tick) {
        if (!C.act(g, rep.actions[i].slice(1))) return bad('Aksi tidak sah pada tick ' + g.tick);
        i++;
      }
      if (g.over) break;
      if (g.offer || g.tick >= rep.ticks) return bad('Replay tidak lengkap');
      C.step(g); g.events.length = 0;
    }
    if (i !== rep.actions.length || g.tick !== rep.ticks) return bad('Replay tidak cocok');
    return { ok: true, key: g.info.key, score: g.score, wave: g.wave, result: g.over, stars: starsOf(g), lives: g.lives };
  }

  root.KModes = { CHAPTERS, MISSIONS, daily, today, resolve, newGame, goalsMet, starsOf, toReplay, verify };
  if (N) module.exports = root.KModes;
})(typeof window !== 'undefined' ? window : globalThis);
