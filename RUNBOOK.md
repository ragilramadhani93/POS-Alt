# Runbook & Panduan Pengoperasian POS Alternatif

Panduan komprehensif pengoperasian sistem POS Kasir F&B multi-outlet untuk kasir, staf operasional dapur, dan manajemen Head Office.

---

## 1. Arsitektur Komponen
1. **POS App (Flutter Kasir):**
   - Tablet/Mobile Android atau Web PWA.
   - 5 Menu Baku: 🧾 Kasir, 🗑 Waste / Pemborosan, 🍳 Produksi / Crafting, 📦 Terima Barang (GR BPSJ), 📊 Laporan Outlet.
   - Outbox Offline Engine dengan sinkronisasi idempoten saat terhubung internet.
2. **Kitchen Display System (KDS):**
   - Layar pemantauan antrian dapur real-time.
   - Pemisahan otomatis pesanan stasiun Bar (Minuman) dan Kitchen (Makanan).
3. **Web Dashboard Head Office (Next.js 15):**
   - Konsolidasi multi-outlet, kontrol persediaan moving average, resep bertingkat BOM, transfer stok antar-outlet, membership & promo, pengaturan pajak, serta laporan laba rugi (P&L).
4. **Backend REST API (NestJS + Prisma + PostgreSQL + Redis):**
   - Mesin transaksi atomik, inventory moving average, evaluasi promo deterministik, loyalty point/stamp multiplier.

---

## 2. Cara Menjalankan Sistem

### A. Menggunakan Docker Compose (Rekomendasi Production / Staging)
```bash
# Jalankan seluruh stack (Postgres, Redis, NestJS Backend, Next.js Dashboard)
docker-compose up -d

# Cek status kontainer
docker-compose ps

# Log backend
docker-compose logs -f backend
```

### B. Menjalankan Manual (Development)
```bash
# 1. Backend API (Port 3000)
cd backend
npm install
npx prisma generate
npx prisma db push
npm run seed
npm run start:dev

# 2. Web Dashboard (Port 3001)
cd ../dashboard
npm install
npm run dev

# 3. Flutter POS App
cd ../pos-app
flutter pub get
flutter run -d chrome  # atau emulator Android
```

---

## 3. SOP Pengoperasian Kasir Gerai (POS App)

### 3.1 Buka Shift Kasir
1. Buka aplikasi POS, masukkan PIN Kasir (Baku: `123456`).
2. Input modal kas awal kasir (contoh: Rp 200.000).
3. Sistem membuka shift baru dan mengaktifkan terminal kasir.

### 3.2 Transaksi Penjualan Normal (Maks. 3 Tap)
1. Pilih produk dari menu (contoh: *Es Kopi Kenangan Mantan*).
2. Jika pelanggan member: Masukkan nomor HP (contoh: `081234567890`) untuk mengaitkan member, menerapkan diskon tier, dan perolehan poin.
3. Masukkan kode voucher jika ada (contoh: `HEMAT10` atau `BOGO-AREN`).
4. Centang / uncentang opsi **Pakai Pajak (PPN 11%)** sesuai kebijakan outlet.
5. Tekan tombol **BAYAR**:
   - **Tunai Penuh:** Masukkan uang diterima, sistem hitung kembalian.
   - **QRIS Dinamis:** Tunjukkan QR code simulator ke pelanggan.
   - **Split Payment:** Pilih opsi 50% Tunai + 50% QRIS (atau atur nominal kustom).
6. Tekan **Cetak Struk**: Struk format 58mm otomatis dikirim ke printer thermal Bluetooth.

### 3.3 Penanganan Saat Koneksi Internet Putus (Mode Offline)
1. Sistem otomatis berganti ke status **Mode Offline**.
2. Transaksi tetap dapat dilayani tanpa jeda.
3. Transaksi tersimpan aman di outbox memori lokal tablet.
4. Saat koneksi internet kembali: Tekan tombol **Sinkronkan Sekarang**. Transaksi akan disinkronkan secara idempoten tanpa duplikasi pemotongan stok.

### 3.4 Pencatatan Waste (Pemborosan Bahan)
1. Buka tab **Waste**.
2. Pilih barang yang terbuang/tumpah/kadaluwarsa:
   - Jika memilih **Menu Jual** (misal *Es Kopi Mantan*): Sistem otomatis mengekplode ke bahan baku dasar (Biji Kopi, Susu, Gula Aren).
   - Jika memilih **Semi-Finished**: Sistem mengekplode ke bahan racikan dasarnya.
   - Jika memilih **Raw Material**: Stok bahan tersebut langsung dipotong kartu stok.
3. Masukkan jumlah dan alasan kerusakan, lalu tekan **Catat Waste**.

### 3.5 Penerimaan Barang (Good Receive) dari Gudang BPSJ
1. Buka tab **Terima SJ**.
2. Masukkan nomor Surat Jalan resmi BPSJ (contoh: `SJ/0140/1126/GDG-SBY` atau `SJ/0001/0126/CKA-J021`).
3. Tekan **Ambil Data Surat Jalan**: Sistem otomatis membaca data barang dari Google Sheets `BP`.
4. Periksa fisik barang dan sesuaikan `Qty Diterima` jika ada selisih.
5. Tekan **Konfirmasi Terima Barang**: Stok gudang outlet otomatis bertambah.

---

## 4. SOP Staf Dapur & Barista (Kitchen Display System / KDS)
1. Buka layar KDS pada tablet/monitor dapur.
2. Filter stasiun sesuai tugas:
   - **☕ Bar:** Memantau antrian minuman kopi, teh, dan susu.
   - **🍳 Kitchen:** Memantau antrian makanan berat, roti toast, dan snack.
3. Perhatikan indikator warna dan timer tiket:
   - **Kuning (QUEUED):** Pesanan baru masuk, belum disentuh.
   - **Biru (PREPARING):** Barista/Koki menekan tombol *Mulai Siapkan*.
   - **Hijau (READY):** Pesanan selesai dibuat, siap diantar ke meja atau diambil di konter.
4. Setelah pelanggan menerima pesanan: Tekan *Selesai Disajikan* untuk menghapus tiket dari antrian aktif.

---

## 5. SOP Manajemen & Owner (Web Head Office)
1. **Pemantauan Multi-Outlet:** Buka tab *Ringkasan Operasional* untuk memantau omzet konsolidasi seluruh outlet secara langsung.
2. **Laporan Laba Rugi (P&L):** Buka tab *Laporan Laba Rugi (P&L)* untuk menganalisis Net Sales, HPP/COGS berbasis recipe moving average, biaya bahan waste, dan laba operasional bersih.
3. **Pengaturan Pajak:** Buka tab *Pengaturan Pajak Outlet* untuk mengaktifkan atau menonaktifkan pemungutan PPN/PB1 per outlet.
4. **Resep & Produksi Batch:** Buka tab *Resep / BOM* untuk mengatur formula bahan baku menu baru atau mencatat produksi massal semi-finished product.
