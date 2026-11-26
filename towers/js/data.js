/* Towers: semua angka balancing ada di file ini. */
(function (root) {
  const TOWERS = {
    arrow:  { name: 'Panah',  icon: '🏹', color: '#7ee081', cost: 50,  desc: 'Murah dan cepat. Andalan awal, bisa menembak udara.', air: true,
      levels: [ { dmg: 12, rate: 1.5, range: 2.6 }, { dmg: 22, rate: 1.7, range: 2.9 }, { dmg: 40, rate: 2.0, range: 3.2 } ], up: [55, 100] },
    cannon: { name: 'Meriam', icon: '💣', color: '#ffb347', cost: 90,  desc: 'Ledakan area. Hebat untuk gerombolan, TIDAK bisa menembak udara.', air: false,
      levels: [ { dmg: 28, rate: 0.7, range: 2.4, splash: 1.0 }, { dmg: 55, rate: 0.75, range: 2.6, splash: 1.15 }, { dmg: 105, rate: 0.8, range: 2.8, splash: 1.35 } ], up: [90, 160] },
    frost:  { name: 'Es',     icon: '❄️', color: '#6fd3ff', cost: 70,  desc: 'Memperlambat musuh. Damage kecil, efek besar bila dipadukan.', air: true,
      levels: [ { dmg: 5, rate: 1.0, range: 2.2, slow: 0.35, dur: 1.4 }, { dmg: 10, rate: 1.1, range: 2.5, slow: 0.45, dur: 1.6 }, { dmg: 18, rate: 1.2, range: 2.8, slow: 0.55, dur: 1.9 } ], up: [60, 110] },
    tesla:  { name: 'Petir',  icon: '⚡', color: '#c59bff', cost: 130, desc: 'Listrik melompat ke beberapa musuh dan menembus armor.', air: true,
      levels: [ { dmg: 22, rate: 0.9, range: 2.4, chain: 3, pierce: true }, { dmg: 40, rate: 1.0, range: 2.6, chain: 4, pierce: true }, { dmg: 72, rate: 1.1, range: 2.9, chain: 5, pierce: true } ], up: [120, 210] }
  };

  const ENEMIES = {
    grunt:  { name: 'Slime',   color: '#8be36b', hp: 55,  speed: 1.25, armor: 0, gold: 6,  lives: 1,  size: 0.30, tip: 'Musuh standar.' },
    runner: { name: 'Pelari',  color: '#ffd84d', hp: 36,  speed: 2.30, armor: 0, gold: 6,  lives: 1,  size: 0.24, tip: 'Cepat tapi rapuh. Perlambat dengan Es.' },
    tank:   { name: 'Golem',   color: '#b0a89c', hp: 170, speed: 0.80, armor: 6, gold: 14, lives: 2,  size: 0.38, tip: 'Armor mengurangi damage per tembakan. Pakai Petir atau Meriam.' },
    flyer:  { name: 'Kelelawar', color: '#ff7ab6', hp: 48, speed: 1.45, armor: 0, gold: 9, lives: 1,  size: 0.26, fly: true, tip: 'Terbang lurus melewati labirin. Meriam tidak bisa mengenainya.' },
    healer: { name: 'Dukun',   color: '#4dffd2', hp: 100, speed: 1.05, armor: 1, gold: 15, lives: 1,  size: 0.30, heal: 0.05, tip: 'Menyembuhkan teman di sekitarnya. Bunuh lebih dulu.' },
    boss:   { name: 'Raja Slime', color: '#ff5f5f', hp: 950, speed: 0.70, armor: 5, gold: 120, lives: 8, size: 0.48, boss: true, tip: 'Sangat kuat. Pakai Meteor dan upgrade menara.' }
  };

  /* Peta 15 x 9. S = muncul, G = markas, # = batu */
  const MAPS = [
    { id: 'meadow', name: 'Padang Rumput', note: 'Lapang. Cocok untuk belajar membuat labirin.', rows: [
      '...............', '...#.......#...', '...............', '.......#.......', 'S.............G', '.......#.......', '...............', '...#.......#...', '...............' ] },
    { id: 'canyon', name: 'Ngarai', note: 'Dinding batu memaksa jalur berkelok.', rows: [
      '....#..........', '....#.....#....', '....#.....#....', '....#.....#....', 'S...#.....#...G', '..........#....', '....#.....#....', '....#..........', '....#.....#....' ] },
    { id: 'twin', name: 'Dua Gerbang', note: 'Musuh datang dari dua arah sekaligus.', rows: [
      '...............', 'S....#.........', '.....#.....#...', '...........#...', '.......##.....G', '...........#...', '.....#.....#...', 'S....#.........', '...............' ] }
  ,
    { id: 'cross', name: 'Persimpangan', note: 'Dua gerbang, atas dan kiri.', rows: [
      '.......S.......', '...............', '..##.......##..', '...............', 'S.....###.....G', '...............', '..##.......##..', '...............', '...............' ] },
    { id: 'maze', name: 'Reruntuhan', note: 'Sisa tembok kuno. Lengkapi labirinnya.', rows: [
      'S....#.........', '####.#.#######.', '.....#.......#.', '.#####.#####.#.', '.......#...#...', '.###.###.#.###.', '...#.....#.....', '##.#######.###.', '.........#....G' ] },
    { id: 'islands', name: 'Gugusan Batu', note: 'Banyak batu, ruang bangun sempit.', rows: [
      '..#....#....#..', '.....#....#....', '.#.....#.....#.', '....#.....#....', 'S.#....#....#.G', '....#.....#....', '.#.....#.....#.', '.....#....#....', '..#....#....#..' ] }
  ];

  const DIFFS = {
    easy:   { name: 'Mudah',  hp: 0.75, gold: 260, lives: 25, reward: 1.1 },
    normal: { name: 'Normal', hp: 1.00, gold: 220, lives: 20, reward: 1.0 },
    hard:   { name: 'Sulit',  hp: 1.18, gold: 230, lives: 15, reward: 0.95 }
  };

  const SKILLS = {
    meteor: { name: 'Meteor', icon: '☄️', cd: 35, radius: 1.6, desc: 'Klik area: damage besar, menembus armor.' },
    freeze: { name: 'Beku',   icon: '🧊', cd: 50, dur: 3.5, desc: 'Semua musuh melambat drastis beberapa detik.' }
  };

  /* Komposisi gelombang: [jenis, jumlah, jeda antar musuh (detik)] */
  const WAVES = [
    [['grunt', 8, 0.9]],
    [['grunt', 12, 0.8]],
    [['grunt', 8, 0.8], ['runner', 6, 0.5]],
    [['runner', 14, 0.45], ['grunt', 6, 0.7]],
    [['tank', 4, 1.6], ['grunt', 10, 0.6]],
    [['flyer', 8, 0.8], ['grunt', 8, 0.7]],
    [['tank', 5, 1.3], ['runner', 12, 0.4]],
    [['healer', 3, 2.0], ['grunt', 16, 0.5]],
    [['flyer', 12, 0.6], ['tank', 4, 1.4]],
    [['boss', 1, 1], ['grunt', 12, 0.6]],
    [['runner', 24, 0.3], ['healer', 3, 1.5]],
    [['tank', 10, 0.9], ['healer', 4, 1.2]],
    [['flyer', 20, 0.45], ['runner', 10, 0.4]],
    [['tank', 8, 0.8], ['grunt', 20, 0.35], ['healer', 4, 1.0], ['flyer', 8, 0.5]],
    [['boss', 2, 5], ['tank', 6, 1.0], ['flyer', 10, 0.5], ['healer', 3, 1.0]]
  ];

  const BALANCE = {
    hpScale: w => { let m = 1; for (let i = 1; i < w; i++) m *= 1.05; return (1 + 0.12 * (w - 1)) * m; },
    bountyScale: w => 1 + 0.05 * (w - 1),
    waveBonus: w => 25 + 4 * w,
    earlyBonusPerSec: 1.5,
    breakTime: 18,
    sellRatio: 0.7
  };

  const PERKS = {
    power:  { name: 'Amunisi Tajam', desc: 'Damage semua menara +12%.' },
    reach:  { name: 'Lensa Pengintai', desc: 'Jangkauan semua menara +8%.' },
    haste:  { name: 'Roda Gigi Cepat', desc: 'Kecepatan tembak +10%.' },
    bounty: { name: 'Pemburu Harta', desc: 'Koin dari musuh +15%.' },
    mana:   { name: 'Kristal Mana', desc: 'Isi ulang skill 20% lebih cepat.' },
    repair: { name: 'Tukang Bangunan', desc: '+5 nyawa markas.' },
    chill:  { name: 'Badai Dingin', desc: 'Semua musuh 6% lebih lambat.' },
    bank:   { name: 'Peti Perang', desc: 'Langsung dapat 150 koin.' }
  };

  root.KData = { PERKS, TOWERS, ENEMIES, MAPS, DIFFS, SKILLS, WAVES, BALANCE };
  if (typeof module !== 'undefined') module.exports = root.KData;
})(typeof window !== 'undefined' ? window : globalThis);
