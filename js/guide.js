/* Isi panduan dalam game. */
(function () {
  const D = KData, M = KModes;
  const table = (head, rows) => `<div class="scroll"><table><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</table></div>`;
  const towers = Object.entries(D.TOWERS);
  window.KGuide = {
    'Alur': () => `<h3>Tujuan</h3><p>Cegah musuh sampai ke istana. Permainan berakhir bila nyawa habis.</p><ol>
      <li><b>Pilih mode</b> di Beranda.</li><li><b>Persiapan:</b> bangun menara dengan koin awal. Menara juga menjadi tembok.</li>
      <li><b>Mulai gelombang</b> (tombol besar atau Spasi). Menara menembak otomatis.</li><li><b>Kumpulkan koin</b> dari musuh, bonus gelombang, dan peti harta.</li>
      <li><b>Bangun, upgrade, jual</b> kapan saja, juga saat jeda.</li><li><b>Setiap 5 gelombang</b> pilih 1 dari 3 kartu bonus.</li>
      <li><b>Menang</b> setelah gelombang terakhir. Di Tanpa Akhir, bertahanlah selama mungkin.</li></ol>`,
    'Mode & Misi': () => `<ul><li><b>Kampanye:</b> ${M.MISSIONS.length} misi. Menangkan satu misi untuk membuka berikutnya. Tiap misi punya 3 sasaran bintang; ulangi untuk melengkapinya. Bintang dihitung dari hasil terbaik dalam satu permainan.</li>
      <li><b>Tantangan Harian:</b> peta dan aturan sama untuk semua pemain, berganti pukul 07.00 WIB (00.00 UTC).</li>
      <li><b>Main Bebas:</b> pilih peta dan kesulitan, 15 gelombang.</li><li><b>Tanpa Akhir:</b> gelombang terus datang dan makin kuat.</li></ul>
      <h3>Peti harta</h3><p>Kadang muncul saat gelombang baru. Klik sebelum hilang (12 detik) untuk koin.</p>
      <h3>Kartu bonus</h3><ul>${Object.values(D.PERKS).map(p => `<li><b>${p.name}:</b> ${p.desc}</li>`).join('')}</ul>`,
    'Menara': () => table(['Menara', 'Harga', 'Upgrade', 'Kegunaan'], towers.map(([id, d]) => [KIcon(id) + ' ' + d.name, d.cost, d.up.join(' / '), d.desc])) +
      `<h3>Prioritas target</h3><p>Terdepan, Terkuat, Terlemah, atau Terdekat.</p><h3>Skill</h3><ul>${Object.values(D.SKILLS).map(s => `<li><b>${s.name}</b>: ${s.desc} Isi ulang ${s.cd} detik.</li>`).join('')}</ul>`,
    'Musuh': () => table(['Musuh', 'HP dasar', 'Speed', 'Armor', 'Tips'], Object.values(D.ENEMIES).map(e => [`<i class="dot" style="background:${e.color}"></i> ${e.name}`, e.hp, e.speed, e.armor, e.tip])),
    'Jalur': () => `<p>Game memakai <b>BFS flow field</b>: pencarian dimulai dari istana dan menyebar ke semua petak. Musuh pindah ke tetangga dengan jarak lebih kecil.</p>
      <ul><li>Jalur dihitung ulang setiap kamu membangun atau menjual.</li><li>Menutup jalur sepenuhnya ditolak.</li><li>Garis kuning = pratinjau jalur baru.</li><li>Kelelawar terbang lurus.</li><li>Tombol jalur (J) menampilkan angka jarak dan arah.</li></ul>
      <h3>Trik labirin</h3><p>Buat tembok berselang-seling dari atas dan bawah agar musuh berzig-zag.</p>`,
    'Balancing': () => {
      const hp = D.WAVES.map((w, i) => w.reduce((s, [t, n]) => s + D.ENEMIES[t].hp * n, 0) * D.BALANCE.hpScale(i + 1)), max = Math.max(...hp);
      return table(['Menara', 'DPS Lv1', 'DPS Lv3', 'DPS/100 koin Lv1', 'Lv3'], towers.map(([, d]) => { const a = d.levels[0], c = d.levels[2], da = a.dmg * a.rate, dc = c.dmg * c.rate; return [d.name, da.toFixed(1), dc.toFixed(1), (da / d.cost * 100).toFixed(1), (dc / (d.cost + d.up[0] + d.up[1]) * 100).toFixed(1)]; })) +
        `<p>Angka untuk satu target. Meriam dan Petir mengenai banyak musuh.</p><h3>Total HP musuh per gelombang (Normal)</h3><div class="bars">${hp.map((v, i) => `<div style="height:${v / max * 100}%" title="${Math.round(v)} HP"><span>${i + 1}</span></div>`).join('')}</div><br><p>Pengali HP: (1 + 0,12 × (g−1)) × 1,05^(g−1).</p>`;
    },
    'Online': () => `<p>Game bisa dimainkan tanpa akun. Skor tersimpan di perangkat ini.</p><ul><li><b>Leaderboard GitHub:</b> tekan "Kirim lewat GitHub" setelah bermain. Butuh akun GitHub; skor dihitung ulang otomatis dari rekaman permainan.</li><li><b>Leaderboard online:</b> aktif bila pemilik game memasang server atau Supabase.</li><li><b>Akun:</b> menyimpan progres di cloud (memerlukan Supabase).</li></ul>`,
    'Kontrol': () => table(['Aksi', 'Tombol'], [['Pilih menara', '1 – 4 / klik / seret'], ['Mulai atau panggil gelombang', 'Spasi'], ['Upgrade / Jual / Ganti target', 'U / X / T'], ['Meteor / Beku', 'Q / W'], ['Pathfinding', 'J'], ['Jeda / Kecepatan', 'P / F'], ['Suara / Panduan', 'M / H'], ['Batal', 'Esc / klik kanan'], ['Ambil peti', 'Klik / ketuk']])
  };
})();
