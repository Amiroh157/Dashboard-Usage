# Sistem desain: Buku pemakaian

## Brief
Dashboard operasional lokal berbahasa Indonesia untuk membaca biaya dan jumlah pemakaian alat oleh tukang dan divisi. Sumber data adalah Excel yang dapat diperbarui berkali-kali; bukan landing page promosi. Prioritas: angka benar, alur drill-down jelas, informasi cepat ditemukan.

## Pilihan konsep
1. **Buku pemakaian** (dipilih): setiap angka ringkasan bisa ditelusuri ke baris usage aslinya. Anchor: kode `usagews # KBP/...` dan catatan per alat nyata. Orisinalitas 4, kecocokan 5, kelayakan 5, portabilitas 2.
2. Peta bengkel: divisi menjadi stasiun yang terhubung. Anchor: pembagian divisi tukang. 3/4/3/3.
3. Kalender pengeluaran: transaksi disusun menjadi ritme harian. Anchor: tanggal input dan pembelian bulanan. 3/4/5/4.

Idea: satu pandangan dari angka besar sampai satu alat pada satu nota usage.
Metaphor: buku catatan operasional yang rapi, bukan presentasi.
Signature: memilih tukang/divisi langsung menyaring semua angka, grafik, dan jejak transaksi; tab detail mengungkap asal angka.
Emotion: percaya, cepat, tenang.
Motion verb: masuk dan mengunci posisi, seperti baris pada buku.
Screenshot: judul bulan, angka cost besar, rangking tukang dan grafik divisi dalam satu bingkai.

## Sistem
- Palette: kertas #F6F7F5, panel #FFFFFF, tinta #1D2A30, muted #617079, garis #E5EAE9, biru #3557D7, sidebar #17252D, jingga #E8A263.
- Type: DM Sans untuk isi/display, IBM Plex Mono untuk kode dan angka kecil. Fallback system tersedia saat offline.
- Grid: sidebar tetap 240px, konten maksimal 1480px; gutter 28px, mobile 18px. Ringkasan 4 kolom lalu komposisi grafik 7:5, tabel penuh.
- Bentuk: panel radius 14px, kontrol 9px; tidak ada bayangan dekoratif. Motion 180-240ms ease-out pada hover, tab, dan filter; preferensi reduced-motion dihormati.
- Komposisi: navigasi vertikal | header/filter | hero metrik | tren + komposisi divisi | tabel tukang/divisi | transaksi | sumber data.
- Genericness test: bukan kartu SaaS generik; satu alur audit menghubungkan metrik dengan baris Excel, unit dan kode usage tetap terlihat, data kosong ditangani eksplisit.
- Tidak ada loader atau WebGL: dashboard operasional harus segera dapat digunakan. Tampilan diam saat idle adalah keputusan yang disengaja.

## Asumsi data
- Cost = Qty Keluar × Last BuyPrice pada katalog alat paling baru yang diunggah.
- Setiap baris sheet pemakaian adalah satu pemakaian alat. File yang isinya sama diabaikan; baris yang tumpang tindih antarfile digabung, sementara pengulangan identik di dalam satu file tetap dipertahankan.
- Pencocokan kode alat dan nama tukang tidak peka huruf besar/kecil dan spasi tepi.
- Baris tanpa harga tetap menghitung qty, tetapi biaya tercatat 0 dan diberi peringatan. Baris tanpa divisi menjadi "Belum terdaftar".
