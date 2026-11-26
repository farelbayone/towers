/* Isi untuk mengaktifkan fitur online. Kosong = game tetap jalan (skor lokal).
   Saat deploy lewat GitHub Actions, file ini dibuat dari Repository Variables. */
window.TOWERS_CONFIG = {
  apiUrl: '',       // server Node.js, contoh: https://towers-api.example.com
  supabaseUrl: '',  // contoh: https://abcd.supabase.co
  supabaseKey: '',  // publishable / anon key. JANGAN isi service_role / secret key
  githubRepo: ''    // "username/repo" (otomatis terdeteksi di github.io)
};
