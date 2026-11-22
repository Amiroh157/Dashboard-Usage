# BukuPakai

Dashboard website lokal untuk menganalisis jumlah dan biaya pemakaian alat berdasarkan tukang, divisi, tanggal, dan kode usage.

## Menjalankan di Windows

1. Pastikan [Node.js](https://nodejs.org/) tersedia.
2. Buka terminal di folder ini.
3. Jalankan `npm.cmd install` (cukup sekali).
4. Jalankan `npm.cmd run dev`.
5. Buka **http://127.0.0.1:3000** di browser.

Untuk menjalankan versi produksi: `npm.cmd run build`, lalu `npm.cmd run start`. Program hanya mendengarkan koneksi dari komputer ini (`127.0.0.1`).

## Memasukkan data

Saat pertama dibuka, aplikasi membaca file `.xlsx` dalam folder `Data`. Berikutnya gunakan menu **Sumber Excel → Tambah data baru** untuk memilih atau menarik banyak file `.xlsx` sekaligus. File boleh berisi satu atau beberapa sheet berikut:

| Jenis data | Kolom yang dikenali |
| --- | --- |
| Katalog alat | `Code`, `Name`, `Last BuyPrice`, `Unit` |
| Pemakaian | `Code`, `Name`, `Unit`, `Qty Keluar`, `Note`, `Create Date`, `Pengrajin`, `Admin` |
| Divisi | `Nama karyawan`, `Divisi` |

Nama file dan urutan sheet tidak harus sama dengan contoh. Data yang sudah diunggah tersimpan di `storage/data.json` dan tetap ada setelah aplikasi dimatikan. Jangan hapus folder `storage` jika ingin menyimpan hasil upload. Data asli dalam `Data` tidak diubah.

**Cara hitung:** total harga = quantity × `Last BuyPrice` untuk kode alat yang sama. Jika ada beberapa katalog, harga dari file terakhir yang diunggah digunakan untuk seluruh periode; perubahan katalog juga menghitung ulang bulan-bulan lama. Kode alat dan nama tukang dicocokkan tanpa memperhatikan kapitalisasi/spasi tepi. Alat yang tidak ada di katalog tetap dihitung quantity-nya, dengan biaya Rp 0 dan peringatan. Tukang yang tidak ada dalam daftar divisi ditandai `Belum terdaftar`.

File identik tidak diimpor ulang. Bila data transaksi antarfile tumpang tindih, baris yang sama tidak dihitung dua kali, tetapi baris identik yang berulang dalam **satu file** tetap dipertahankan. File yang sudah diimpor bisa dihapus melalui daftar sumber data.

Filter bulan, tukang, divisi, rentang tanggal, dan pencarian transaksi tersedia di dashboard. Detail transaksi yang ditampilkan dapat diekspor sebagai CSV (pemisah `;`, cocok untuk Excel berlokal Indonesia).

## Versi online (GitHub Pages)

Link setelah GitHub Pages aktif: **https://amiroh157.github.io/Dashboard-Usage/**

Versi online memakai komponen dashboard dan tampilan yang sama, tetapi membaca JSON statis hasil file Excel dalam folder `Data`. Upload dan hapus file melalui website **hanya tersedia pada versi lokal**, bukan GitHub Pages. Filter, tabel, grafik, dan ekspor CSV tetap berfungsi di kedua versi.

Setiap push ke branch `main` otomatis menjalankan `.github/workflows/pages.yml`: membaca seluruh `.xlsx` dalam `Data`, mengonversi menjadi JSON, membuat website statis, lalu menerbitkannya. Untuk memperbarui data online, ganti/tambah file Excel di `Data` lalu push ke `main`. Untuk menguji build online di komputer sendiri, jalankan `npm.cmd run build:pages`; hasilnya ada di `dist-pages`.

**Perhatian:** repo ini publik. File Excel dan data JSON yang diterbitkan dapat dilihat siapa saja, termasuk nama tukang, divisi, dan admin. Jangan push data yang tidak boleh dipublikasikan. Folder `storage` lokal tidak diikutkan ke GitHub.
