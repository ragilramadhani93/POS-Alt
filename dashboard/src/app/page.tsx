'use client';

import React, { useState } from 'react';

export default function DashboardPage() {
  const [selectedOutlet, setSelectedOutlet] = useState('all');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'production' | 'gr' | 'transfer' | 'opname' | 'pl' | 'loyalty' | 'kds' | 'settings'>('dashboard');

  // State Pengaturan Pajak Outlet (Head Office)
  const [outletTaxes, setOutletTaxes] = useState<Record<string, { enabled: boolean; rate: number; inclusive: boolean }>>({
    'CKA-J021': { enabled: true, rate: 0.11, inclusive: false },
    'GDG-SBY': { enabled: false, rate: 0.10, inclusive: false },
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  // State Transfer Stok Antar Outlet
  const [transferSource, setTransferSource] = useState('CKA-J021');
  const [transferDestination, setTransferDestination] = useState('GDG-SBY');
  const [transferProduct, setTransferProduct] = useState('Biji Kopi Espresso Blend');
  const [transferQty, setTransferQty] = useState('2000');
  const [transferSuccess, setTransferSuccess] = useState(false);

  // State Stok Opname Fisik
  const [opnameItems, setOpnameItems] = useState([
    { id: '1', sku: 'RAW-KOP-01', name: 'Biji Kopi Espresso Blend', uom: 'GR', systemQty: 15000, countedQty: 14850 },
    { id: '2', sku: '00M.STXXX.X0000010XX', name: 'FRESH MILK PLAIN 946ML - DIAMOND', uom: 'ML', systemQty: 50000, countedQty: 50000 },
    { id: '3', sku: '00M.STXXX.X0000144XX', name: 'CUP PET 12 OZ KACC - STARINDO', uom: 'PCS', systemQty: 1200, countedQty: 1180 },
  ]);
  const [opnameSuccess, setOpnameSuccess] = useState(false);

  // State Kitchen Display System (KDS)
  const [kdsStation, setKdsStation] = useState<'ALL' | 'BAR' | 'KITCHEN'>('ALL');
  const [kdsTickets, setKdsTickets] = useState([
    {
      id: 'TICK-101',
      trxNumber: 'TRX-CKA-20261110-0012',
      orderType: 'DINE_IN',
      table: 'Meja 04',
      elapsed: '3 mnt',
      status: 'QUEUED',
      items: [
        { id: '1', name: 'Es Kopi Kenangan Mantan', qty: 2, station: 'BAR', notes: 'Less ice, normal sugar', status: 'QUEUED' },
        { id: '2', name: 'Roti Bakar Srikaya Butter', qty: 1, station: 'KITCHEN', notes: 'Garing dipisah', status: 'QUEUED' },
      ],
    },
    {
      id: 'TICK-102',
      trxNumber: 'TRX-CKA-20261110-0013',
      orderType: 'TAKE_AWAY',
      table: 'Takeaway',
      elapsed: '7 mnt',
      status: 'PREPARING',
      items: [
        { id: '3', name: 'Matcha Green Tea Latte', qty: 1, station: 'BAR', notes: 'Oatmilk substitute', status: 'PREPARING' },
      ],
    },
    {
      id: 'TICK-103',
      trxNumber: 'TRX-CKA-20261110-0014',
      orderType: 'DINE_IN',
      table: 'Meja 08',
      elapsed: '1 mnt',
      status: 'QUEUED',
      items: [
        { id: '4', name: 'Americano Dingin', qty: 2, station: 'BAR', notes: '', status: 'QUEUED' },
        { id: '5', name: 'Croissant Butter Gurih', qty: 2, station: 'KITCHEN', notes: 'Hangatkan 1 menit', status: 'QUEUED' },
      ],
    },
  ]);

  return (
    <div className="flex h-screen w-full bg-[#F7F5F2] text-[#1A1714]">
      {/* Sidebar Head Office */}
      <aside className="w-64 border-r border-[#E2DDD8] bg-white flex flex-col justify-between p-4">
        <div>
          <div className="flex items-center gap-2 mb-6">
            <div className="h-8 w-8 rounded bg-[#E8460A] text-white flex items-center justify-center font-bold text-lg">
              P
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight">POS ALTERNATIF</h1>
              <p className="text-xs text-[#6B6460]">Head Office Portal</p>
            </div>
          </div>

          <div className="mb-4">
            <label className="text-xs font-semibold text-[#6B6460] block mb-1">Pilih Outlet</label>
            <select
              value={selectedOutlet}
              onChange={(e) => setSelectedOutlet(e.target.value)}
              className="w-full border border-[#E2DDD8] rounded-md p-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#E8460A]"
            >
              <option value="all">Semua Outlet (Konsolidasi)</option>
              <option value="CKA-J021">St. Tanah Abang (Jakarta)</option>
              <option value="GDG-SBY">Gudang Stall Sepanjang (Sby)</option>
            </select>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold ${
                activeTab === 'dashboard' ? 'bg-[#F7F5F2] text-[#E8460A]' : 'hover:bg-neutral-50 text-[#6B6460]'
              }`}
            >
              📊 Ringkasan Operasional
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold ${
                activeTab === 'inventory' ? 'bg-[#F7F5F2] text-[#E8460A]' : 'hover:bg-neutral-50 text-[#6B6460]'
              }`}
            >
              📦 Inventori & Mutasi Stok
            </button>
            <button
              onClick={() => setActiveTab('production')}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold ${
                activeTab === 'production' ? 'bg-[#F7F5F2] text-[#E8460A]' : 'hover:bg-neutral-50 text-[#6B6460]'
              }`}
            >
              🍳 Resep / BOM & Produksi
            </button>
            <button
              onClick={() => setActiveTab('gr')}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold ${
                activeTab === 'gr' ? 'bg-[#F7F5F2] text-[#E8460A]' : 'hover:bg-neutral-50 text-[#6B6460]'
              }`}
            >
              🚚 Terima Barang (BPSJ Google Sheets)
            </button>
            <button
              onClick={() => setActiveTab('transfer')}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold ${
                activeTab === 'transfer' ? 'bg-[#F7F5F2] text-[#E8460A]' : 'hover:bg-neutral-50 text-[#6B6460]'
              }`}
            >
              🔄 Transfer Antar Outlet
            </button>
            <button
              onClick={() => setActiveTab('opname')}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold ${
                activeTab === 'opname' ? 'bg-[#F7F5F2] text-[#E8460A]' : 'hover:bg-neutral-50 text-[#6B6460]'
              }`}
            >
              📋 Stok Opname (Audit Fisik)
            </button>
            <button
              onClick={() => setActiveTab('pl')}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold ${
                activeTab === 'pl' ? 'bg-[#F7F5F2] text-[#E8460A]' : 'hover:bg-neutral-50 text-[#6B6460]'
              }`}
            >
              📈 Laporan Laba Rugi (P&L)
            </button>
            <button
              onClick={() => setActiveTab('loyalty')}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold ${
                activeTab === 'loyalty' ? 'bg-[#F7F5F2] text-[#E8460A]' : 'hover:bg-neutral-50 text-[#6B6460]'
              }`}
            >
              🎁 Promo & Loyalty Member
            </button>
            <button
              onClick={() => setActiveTab('kds')}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold ${
                activeTab === 'kds' ? 'bg-[#F7F5F2] text-[#E8460A]' : 'hover:bg-neutral-50 text-[#6B6460]'
              }`}
            >
              🍳 Kitchen Display (KDS)
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold ${
                activeTab === 'settings' ? 'bg-[#F7F5F2] text-[#E8460A]' : 'hover:bg-neutral-50 text-[#6B6460]'
              }`}
            >
              ⚙️ Pengaturan Pajak Outlet
            </button>
          </nav>
        </div>

        <div className="border-t border-[#E2DDD8] pt-3">
          <p className="text-xs font-medium">Bapak Hendra (Owner)</p>
          <p className="text-[10px] text-[#6B6460]">owner@pos.local</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6">
        <header className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold">
              {activeTab === 'dashboard' && 'Ringkasan Operasional Multi-Outlet'}
              {activeTab === 'inventory' && 'Manajemen Stok & Kartu Mutasi'}
              {activeTab === 'production' && 'Resep Bertingkat & Crafting Semi-Finished'}
              {activeTab === 'gr' && 'Penerimaan Surat Jalan BPSJ 2026'}
              {activeTab === 'transfer' && 'Transfer Stok Barang Antar-Outlet Aktif'}
              {activeTab === 'opname' && 'Stok Opname & Penyesuaian Fisik Persediaan'}
              {activeTab === 'pl' && 'Laporan Laba Rugi Operasional (P&L)'}
              {activeTab === 'loyalty' && 'Manajemen Promosi & Loyalty Membership'}
              {activeTab === 'kds' && 'Kitchen Display System (KDS) — Antrian Dapur & Bar'}
              {activeTab === 'settings' && 'Pengaturan Pajak & Ketentuan Kasir Outlet'}
            </h2>
            <p className="text-xs text-[#6B6460]">Terhubung langsung ke NestJS API & Google Sheets BPSJ</p>
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            ● Fase 5 Live
          </span>
        </header>

        {activeTab === 'dashboard' && (
          <div>
            <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg border border-[#E2DDD8]">
                <p className="text-xs text-[#6B6460]">Total Penjualan Hari Ini</p>
                <p className="text-2xl font-bold mt-1 text-[#E8460A]">Rp 4.250.000</p>
                <p className="text-[11px] text-emerald-600 mt-1">↑ +14.2% dari kemarin</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-[#E2DDD8]">
                <p className="text-xs text-[#6B6460]">Nilai Aset Persediaan</p>
                <p className="text-2xl font-bold mt-1">Rp 18.420.000</p>
                <p className="text-[11px] text-[#6B6460] mt-1">Moving Average Valuation</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-[#E2DDD8]">
                <p className="text-xs text-[#6B6460]">Batch Produksi Selesai</p>
                <p className="text-2xl font-bold mt-1">3 Batch</p>
                <p className="text-[11px] text-[#6B6460] mt-1">Base Gula Aren & Cold Brew</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-[#E2DDD8]">
                <p className="text-xs text-[#6B6460]">Surat Jalan Diterima</p>
                <p className="text-2xl font-bold mt-1 text-emerald-600">4 Dokumen</p>
                <p className="text-[11px] text-emerald-600 mt-1">100% Selaras BPSJ Sheet</p>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'inventory' && (
          <section className="bg-white rounded-lg border border-[#E2DDD8] overflow-hidden">
            <div className="p-4 border-b border-[#E2DDD8] flex justify-between items-center">
              <h3 className="font-bold text-sm">Status Stok Bahan Baku & Semi-Finished</h3>
              <span className="text-xs text-amber-600 font-medium">⚠️ 1 Item Mendekati Batas Minimum</span>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F5F2] border-b border-[#E2DDD8] text-[#6B6460]">
                <tr>
                  <th className="p-3">Kode SKU</th>
                  <th className="p-3">Nama Item</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3">Stok Fisik</th>
                  <th className="p-3">HPP / Unit</th>
                  <th className="p-3">Total Valuasi</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2DDD8]">
                <tr>
                  <td className="p-3 font-mono font-medium">ING-KOP-01</td>
                  <td className="p-3 font-semibold">Biji Kopi Espresso Blend</td>
                  <td className="p-3">Ingredient</td>
                  <td className="p-3">4.820 GR (4.8 Kg)</td>
                  <td className="p-3">Rp 220 / gr</td>
                  <td className="p-3 font-semibold">Rp 1.060.400</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold text-[10px]">AMAN</span></td>
                </tr>
                <tr>
                  <td className="p-3 font-mono font-medium">00M.STXXX.X0000010XX</td>
                  <td className="p-3 font-semibold">FRESH MILK PLAIN 946ML - DIAMOND</td>
                  <td className="p-3">Ingredient (BPSJ)</td>
                  <td className="p-3 text-red-600 font-bold">3.200 ML (~3 Kotak)</td>
                  <td className="p-3">Rp 22 / ml</td>
                  <td className="p-3 font-semibold">Rp 70.400</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-semibold text-[10px]">REORDER</span></td>
                </tr>
                <tr>
                  <td className="p-3 font-mono font-medium">SFP-AREN-BASE</td>
                  <td className="p-3 font-semibold">Base Sirup Gula Aren Racikan</td>
                  <td className="p-3">Semi-Finished</td>
                  <td className="p-3">1.850 ML</td>
                  <td className="p-3">Rp 40 / ml</td>
                  <td className="p-3 font-semibold">Rp 74.000</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold text-[10px]">HASIL CRAFTING</span></td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {activeTab === 'production' && (
          <section className="bg-white rounded-lg border border-[#E2DDD8] p-5">
            <h3 className="font-bold text-sm mb-2">Simulasi & Eksekusi Crafting Batch</h3>
            <p className="text-xs text-[#6B6460] mb-4">
              Konversi bahan baku resep menjadi produk setengah jadi secara otomatis.
            </p>
            <div className="border border-[#E2DDD8] rounded-md p-4 bg-[#F7F5F2] max-w-xl">
              <div className="mb-3">
                <label className="text-xs font-semibold block mb-1">Pilih Produk Semi-Finished:</label>
                <input
                  disabled
                  value="Base Sirup Gula Aren Spesial (Yield: 1.000 ML)"
                  className="w-full bg-white border border-[#E2DDD8] rounded p-2 text-xs font-medium"
                />
              </div>
              <div className="mb-4">
                <label className="text-xs font-semibold block mb-1">Jumlah Batch yang Dimasak:</label>
                <input
                  type="number"
                  defaultValue={2}
                  className="w-24 bg-white border border-[#E2DDD8] rounded p-2 text-xs font-bold"
                />
                <span className="text-xs text-[#6B6460] ml-2">x 1.000 ML = 2.000 ML Output Target</span>
              </div>
              <div className="bg-white p-3 rounded border border-[#E2DDD8] text-xs space-y-1 mb-4">
                <p className="font-bold text-gray-700">Kebutuhan Bahan Baku yang Akan Dipotong:</p>
                <p>• Gula Aren Organik Cair: 1.800 ML (Rp 63.000)</p>
                <p>• Estimasi HPP Hasil Jadi: <strong>Rp 35 - 40 / ML</strong></p>
              </div>
              <button className="bg-[#E8460A] text-white px-4 py-2 rounded text-xs font-bold hover:bg-[#C43808]">
                KONFIRMASI CRAFTING (POTONG STOK & SIMPAN BATCH)
              </button>
            </div>
          </section>
        )}

        {activeTab === 'gr' && (
          <section className="bg-white rounded-lg border border-[#E2DDD8] p-5">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-bold text-sm">Integrasi Penerimaan Google Sheets (BPSJ 2026)</h3>
                <p className="text-xs text-[#6B6460]">Data tersinkronisasi otomatis dari sheet BP dan Cetak SJ</p>
              </div>
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded">
                Sheet: BPSJ GUDANG 2026.xlsx
              </span>
            </div>
            <div className="border border-[#E2DDD8] rounded-md overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F5F2] border-b border-[#E2DDD8] text-[#6B6460]">
                  <tr>
                    <th className="p-3">No. Surat Jalan</th>
                    <th className="p-3">No. BP</th>
                    <th className="p-3">Tujuan Stall</th>
                    <th className="p-3">PIC Gudang</th>
                    <th className="p-3">Total Qty Dikirim</th>
                    <th className="p-3">Status Sinkronisasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2DDD8]">
                  <tr>
                    <td className="p-3 font-mono font-bold text-[#E8460A]">SJ/0001/0126/CKA-J021</td>
                    <td className="p-3">BP/0001/0126/KA</td>
                    <td className="p-3 font-medium">ST. TANAH ABANG (CKA-J021)</td>
                    <td className="p-3">TAUFIK</td>
                    <td className="p-3 font-semibold">1.963 Pcs/Pak</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">DITERIMA KASIR</span></td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono font-bold text-[#E8460A]">SJ/0140/1126/GDG-SBY</td>
                    <td className="p-3">BP/0137/1126/KA</td>
                    <td className="p-3 font-medium">GUDANG SEPANJANG (GDG-SBY)</td>
                    <td className="p-3">YUDI</td>
                    <td className="p-3 font-semibold">400 Pcs</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">DALAM PERJALANAN</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'transfer' && (
          <section className="space-y-6">
            {transferSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs font-semibold flex items-center justify-between">
                <span>✅ Permintaan transfer stok antar-outlet berhasil dibuat! Nomor Dokumen: TRF-20261110-001.</span>
                <button onClick={() => setTransferSuccess(false)} className="text-emerald-900 font-bold ml-2">×</button>
              </div>
            )}

            <div className="bg-white rounded-lg border border-[#E2DDD8] p-5">
              <h3 className="font-bold text-sm mb-1">Kirim Permintaan Transfer Stok Antar Outlet</h3>
              <p className="text-xs text-[#6B6460] mb-4">
                Khusus pemindahan stok antar sesama cabang/gerai aktif (St. Tanah Abang ↔ Gudang Sepanjang).
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl bg-[#F7F5F2] p-4 rounded-md border border-[#E2DDD8] mb-4 text-xs">
                <div>
                  <label className="font-semibold block mb-1">Outlet Asal (Pengirim):</label>
                  <select
                    value={transferSource}
                    onChange={(e) => setTransferSource(e.target.value)}
                    className="w-full border border-[#E2DDD8] rounded p-2 bg-white"
                  >
                    <option value="CKA-J021">St. Tanah Abang (CKA-J021)</option>
                    <option value="GDG-SBY">Gudang Stall Sepanjang (GDG-SBY)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Outlet Tujuan (Penerima):</label>
                  <select
                    value={transferDestination}
                    onChange={(e) => setTransferDestination(e.target.value)}
                    className="w-full border border-[#E2DDD8] rounded p-2 bg-white"
                  >
                    <option value="GDG-SBY">Gudang Stall Sepanjang (GDG-SBY)</option>
                    <option value="CKA-J021">St. Tanah Abang (CKA-J021)</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="font-semibold block mb-1">Pilih Produk / Bahan Baku:</label>
                  <select
                    value={transferProduct}
                    onChange={(e) => setTransferProduct(e.target.value)}
                    className="w-full border border-[#E2DDD8] rounded p-2 bg-white"
                  >
                    <option value="Biji Kopi Espresso Blend">Biji Kopi Espresso Blend (Stok Asal: 15.000 GR)</option>
                    <option value="FRESH MILK PLAIN 946ML - DIAMOND">FRESH MILK PLAIN 946ML - DIAMOND (Stok Asal: 50.000 ML)</option>
                    <option value="CUP PET 12 OZ KACC - STARINDO">CUP PET 12 OZ KACC - STARINDO (Stok Asal: 1.200 PCS)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Jumlah yang Ditransfer:</label>
                  <input
                    type="number"
                    value={transferQty}
                    onChange={(e) => setTransferQty(e.target.value)}
                    className="w-full border border-[#E2DDD8] rounded p-2 bg-white font-bold"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    disabled={transferSource === transferDestination}
                    onClick={() => setTransferSuccess(true)}
                    className={`w-full py-2 rounded text-xs font-bold text-white transition ${
                      transferSource === transferDestination
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-[#E8460A] hover:bg-[#d43f09]'
                    }`}
                  >
                    {transferSource === transferDestination ? 'Pilih Outlet Berbeda' : 'Eksekusi Transfer Stok'}
                  </button>
                </div>
              </div>

              {transferSource === transferDestination && (
                <p className="text-xs text-red-600 font-semibold mb-3">
                  ⚠️ Outlet asal dan tujuan tidak boleh sama. Transfer barang hanya antar sesama outlet berbeda.
                </p>
              )}
            </div>

            <div className="bg-white rounded-lg border border-[#E2DDD8] overflow-hidden">
              <div className="p-4 border-b border-[#E2DDD8]">
                <h3 className="font-bold text-sm">Riwayat Transfer Stok Antar-Outlet</h3>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F5F2] text-[#6B6460] font-semibold border-b border-[#E2DDD8]">
                  <tr>
                    <th className="p-3">No. Transfer</th>
                    <th className="p-3">Dari Outlet</th>
                    <th className="p-3">Ke Outlet</th>
                    <th className="p-3">Item & Qty</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2DDD8]">
                  <tr>
                    <td className="p-3 font-mono font-bold text-[#E8460A]">TRF-20261109-0004</td>
                    <td className="p-3">ST. TANAH ABANG (CKA-J021)</td>
                    <td className="p-3 font-medium">GUDANG SEPANJANG (GDG-SBY)</td>
                    <td className="p-3 font-semibold">Biji Kopi Blend (2.000 GR)</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">SELESAI DITERIMA</span></td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono font-bold text-[#E8460A]">TRF-20261110-0001</td>
                    <td className="p-3">GUDANG SEPANJANG (GDG-SBY)</td>
                    <td className="p-3 font-medium">ST. TANAH ABANG (CKA-J021)</td>
                    <td className="p-3 font-semibold">Cup PET 12oz (500 PCS)</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">DALAM PENGIRIMAN</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'opname' && (
          <section className="space-y-6">
            {opnameSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-4 rounded-md flex items-center justify-between">
                <div>
                  <span className="font-bold">✓ Stok Opname Berhasil Disimpan & Disetujui!</span>
                  <p className="mt-0.5">Penyesuaian kartu mutasi stok (ADJUSTMENT) otomatis dibuat ke database NestJS & PostgreSQL.</p>
                </div>
                <button
                  onClick={() => setOpnameSuccess(false)}
                  className="font-bold text-xs underline text-emerald-800"
                >
                  Tutup
                </button>
              </div>
            )}

            <div className="bg-white rounded-lg border border-[#E2DDD8] p-5">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-bold text-sm">Formulir Rekonsiliasi Audit Fisik (Stok Opname)</h3>
                  <p className="text-xs text-[#6B6460]">
                    Bandingkan hitungan fisik di rak outlet vs catatan saldo sistem. Selisih negatif dicatat sebagai waste/shrinkage.
                  </p>
                </div>
                <button
                  onClick={() => setOpnameSuccess(true)}
                  className="bg-[#E8460A] text-white px-4 py-2 rounded text-xs font-bold hover:bg-[#d43f09] transition"
                >
                  Setujui & Buat Jurnal Penyesuaian
                </button>
              </div>

              <div className="overflow-hidden border border-[#E2DDD8] rounded-md">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F5F2] text-[#6B6460] font-semibold border-b border-[#E2DDD8]">
                    <tr>
                      <th className="p-3">Kode SKU</th>
                      <th className="p-3">Nama Bahan Baku</th>
                      <th className="p-3 text-right">Saldo Sistem</th>
                      <th className="p-3 text-right">Hitungan Fisik Aktual</th>
                      <th className="p-3 text-right">Selisih (Variance)</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2DDD8]">
                    {opnameItems.map((item, idx) => {
                      const diff = item.countedQty - item.systemQty;
                      return (
                        <tr key={item.id} className="hover:bg-neutral-50">
                          <td className="p-3 font-mono font-medium text-[#6B6460]">{item.sku}</td>
                          <td className="p-3 font-semibold">{item.name}</td>
                          <td className="p-3 text-right font-mono">
                            {item.systemQty.toLocaleString('id-ID')} {item.uom}
                          </td>
                          <td className="p-3 text-right">
                            <input
                              type="number"
                              value={item.countedQty}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                setOpnameItems((prev) =>
                                  prev.map((p, i) => (i === idx ? { ...p, countedQty: val } : p))
                                );
                              }}
                              className="w-28 text-right font-bold border border-[#E2DDD8] rounded px-2 py-1 bg-white"
                            />{' '}
                            <span className="text-[#6B6460]">{item.uom}</span>
                          </td>
                          <td className={`p-3 text-right font-mono font-bold ${
                            diff === 0 ? 'text-neutral-600' : diff < 0 ? 'text-red-600' : 'text-emerald-600'
                          }`}>
                            {diff > 0 ? `+${diff.toLocaleString('id-ID')}` : diff.toLocaleString('id-ID')} {item.uom}
                          </td>
                          <td className="p-3 text-center">
                            {diff === 0 ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">MATCH</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">SELISIH</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'pl' && (
          <section className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg border border-[#E2DDD8]">
                <p className="text-xs text-[#6B6460]">Penjualan Bersih (Net Sales)</p>
                <h3 className="text-xl font-bold mt-1 text-[#1A1714]">Rp 4.250.000</h3>
                <p className="text-[10px] text-[#6B6460] mt-1">Diskon Promo: -Rp 150.000</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-[#E2DDD8]">
                <p className="text-xs text-[#6B6460]">Total HPP / COGS Resep</p>
                <h3 className="text-xl font-bold mt-1 text-blue-600">Rp 1.785.000</h3>
                <p className="text-[10px] text-blue-600 mt-1">42.0% dari Net Sales</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-[#E2DDD8]">
                <p className="text-xs text-[#6B6460]">Biaya Kerusakan / Waste</p>
                <h3 className="text-xl font-bold mt-1 text-red-600">Rp 120.000</h3>
                <p className="text-[10px] text-red-600 mt-1">2.8% dari Net Sales</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-[#E2DDD8]">
                <p className="text-xs text-[#6B6460]">Laba Operasional Bersih</p>
                <h3 className="text-xl font-bold mt-1 text-[#E8460A]">Rp 2.345.000</h3>
                <p className="text-[10px] font-bold text-emerald-600 mt-1">Margin Bersih 55.2%</p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-[#E2DDD8] overflow-hidden">
              <div className="p-4 border-b border-[#E2DDD8] flex justify-between items-center">
                <h3 className="font-bold text-sm">Rincian Laba Rugi per Kategori Produk</h3>
                <span className="text-xs text-[#6B6460]">Moving Average Costing</span>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F5F2] text-[#6B6460] font-semibold border-b border-[#E2DDD8]">
                  <tr>
                    <th className="p-3">Kategori Produk</th>
                    <th className="p-3">Penjualan Bersih</th>
                    <th className="p-3">HPP / COGS</th>
                    <th className="p-3">Laba Kotor</th>
                    <th className="p-3">Gross Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2DDD8]">
                  <tr>
                    <td className="p-3 font-semibold">Minuman Kopi (Espresso Base)</td>
                    <td className="p-3">Rp 2.450.000</td>
                    <td className="p-3 text-blue-600">Rp 980.000</td>
                    <td className="p-3 font-semibold text-emerald-700">Rp 1.470.000</td>
                    <td className="p-3 font-bold text-emerald-700">60.0%</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold">Minuman Non-Kopi (Tea & Chocolate)</td>
                    <td className="p-3">Rp 1.050.000</td>
                    <td className="p-3 text-blue-600">Rp 420.000</td>
                    <td className="p-3 font-semibold text-emerald-700">Rp 630.000</td>
                    <td className="p-3 font-bold text-emerald-700">60.0%</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold">Pastry & Roti Toast</td>
                    <td className="p-3">Rp 750.000</td>
                    <td className="p-3 text-blue-600">Rp 385.000</td>
                    <td className="p-3 font-semibold text-emerald-700">Rp 365.000</td>
                    <td className="p-3 font-bold text-emerald-700">48.7%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'loyalty' && (
          <section className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg border border-[#E2DDD8]">
                <p className="text-xs text-[#6B6460]">Total Member Terdaftar</p>
                <h3 className="text-xl font-bold mt-1 text-[#1A1714]">1.420 Member</h3>
                <p className="text-[10px] text-emerald-600 mt-1">+38 member minggu ini</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-[#E2DDD8]">
                <p className="text-xs text-[#6B6460]">Saldo Poin Beredar</p>
                <h3 className="text-xl font-bold mt-1 text-[#E8460A]">24.850 Poin</h3>
                <p className="text-[10px] text-[#6B6460] mt-1">Setara Rp 24.850.000 potensi redeem</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-[#E2DDD8]">
                <p className="text-xs text-[#6B6460]">Voucher Aktif</p>
                <h3 className="text-xl font-bold mt-1 text-blue-600">3 Kampanye</h3>
                <p className="text-[10px] text-[#6B6460] mt-1">HEMAT10, JUMATBERKAH, BOGO-AREN</p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-[#E2DDD8] overflow-hidden">
              <div className="p-4 border-b border-[#E2DDD8] flex justify-between items-center">
                <h3 className="font-bold text-sm">Daftar Member & Tiering Aktif</h3>
                <span className="text-xs text-[#6B6460]">Poin & Stamp Loyalty</span>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F5F2] text-[#6B6460] font-semibold border-b border-[#E2DDD8]">
                  <tr>
                    <th className="p-3">Nama Member</th>
                    <th className="p-3">No Handphone</th>
                    <th className="p-3">Tier</th>
                    <th className="p-3">Saldo Poin</th>
                    <th className="p-3">Stamps</th>
                    <th className="p-3">Total Belanja</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2DDD8]">
                  <tr>
                    <td className="p-3 font-semibold">Rudi Hartono</td>
                    <td className="p-3 font-mono">081234567890</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">GOLD (1.5x)</span></td>
                    <td className="p-3 font-bold text-[#E8460A]">15 Poin</td>
                    <td className="p-3 font-semibold">4 / 10</td>
                    <td className="p-3 font-semibold">Rp 3.850.000</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold">Siti Aminah</td>
                    <td className="p-3 font-mono">085698712345</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[10px]">PLATINUM (2x)</span></td>
                    <td className="p-3 font-bold text-[#E8460A]">42 Poin</td>
                    <td className="p-3 font-semibold">8 / 10</td>
                    <td className="p-3 font-semibold">Rp 11.200.000</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold">Ahmad Fauzi</td>
                    <td className="p-3 font-mono">081900112233</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-[10px]">SILVER (1x)</span></td>
                    <td className="p-3 font-bold text-[#E8460A]">5 Poin</td>
                    <td className="p-3 font-semibold">1 / 10</td>
                    <td className="p-3 font-semibold">Rp 450.000</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'kds' && (
          <section className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-lg border border-[#E2DDD8]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#6B6460]">Filter Stasiun KDS:</span>
                <button
                  onClick={() => setKdsStation('ALL')}
                  className={`px-3 py-1.5 rounded text-xs font-semibold ${
                    kdsStation === 'ALL' ? 'bg-[#E8460A] text-white' : 'bg-[#F7F5F2] text-[#6B6460] hover:bg-neutral-100'
                  }`}
                >
                  Semua Stasiun ({kdsTickets.length})
                </button>
                <button
                  onClick={() => setKdsStation('BAR')}
                  className={`px-3 py-1.5 rounded text-xs font-semibold ${
                    kdsStation === 'BAR' ? 'bg-[#E8460A] text-white' : 'bg-[#F7F5F2] text-[#6B6460] hover:bg-neutral-100'
                  }`}
                >
                  ☕ Bar (Minuman)
                </button>
                <button
                  onClick={() => setKdsStation('KITCHEN')}
                  className={`px-3 py-1.5 rounded text-xs font-semibold ${
                    kdsStation === 'KITCHEN' ? 'bg-[#E8460A] text-white' : 'bg-[#F7F5F2] text-[#6B6460] hover:bg-neutral-100'
                  }`}
                >
                  🍳 Kitchen (Makanan & Snack)
                </button>
              </div>

              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400"></span> Menunggu (QUEUED)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500"></span> Disiapkan (PREPARING)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span> Siap Saji (READY)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {kdsTickets.map((t) => {
                const filteredItems = t.items.filter((i) => kdsStation === 'ALL' || i.station === kdsStation);
                if (filteredItems.length === 0) return null;

                const isPreparing = t.status === 'PREPARING';
                const isReady = t.status === 'READY';

                return (
                  <div
                    key={t.id}
                    className={`bg-white rounded-lg border-2 shadow-sm flex flex-col justify-between overflow-hidden ${
                      isReady ? 'border-emerald-500' : isPreparing ? 'border-blue-500' : 'border-amber-400'
                    }`}
                  >
                    <div>
                      {/* Ticket Header */}
                      <div
                        className={`p-3 border-b flex items-center justify-between ${
                          isReady ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : isPreparing ? 'bg-blue-50 text-blue-900 border-blue-200' : 'bg-amber-50 text-amber-900 border-amber-200'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">{t.table}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/70 font-semibold uppercase">{t.orderType}</span>
                          </div>
                          <p className="text-[10px] font-mono mt-0.5 opacity-80">{t.trxNumber}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-xs">⏱ {t.elapsed}</span>
                          <span className="block text-[10px] font-semibold mt-0.5 uppercase">{t.status}</span>
                        </div>
                      </div>

                      {/* Ticket Items */}
                      <div className="p-3 divide-y divide-[#E2DDD8] space-y-2">
                        {filteredItems.map((item) => (
                          <div key={item.id} className="pt-2 first:pt-0">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-2">
                                <span className="font-bold text-sm bg-neutral-100 px-1.5 py-0.5 rounded text-[#1A1714]">
                                  {item.qty}x
                                </span>
                                <div>
                                  <p className="font-semibold text-xs text-[#1A1714]">{item.name}</p>
                                  {item.notes && (
                                    <p className="text-[11px] text-[#E8460A] font-medium mt-0.5">
                                      * {item.notes}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase bg-neutral-100 text-[#6B6460]">
                                {item.station}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="p-3 border-t border-[#E2DDD8] bg-neutral-50 flex gap-2">
                      {!isPreparing && !isReady && (
                        <button
                          onClick={() => {
                            setKdsTickets(prev => prev.map(tick => tick.id === t.id ? { ...tick, status: 'PREPARING' } : tick));
                          }}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded text-xs transition"
                        >
                          Mulai Siapkan
                        </button>
                      )}
                      {isPreparing && (
                        <button
                          onClick={() => {
                            setKdsTickets(prev => prev.map(tick => tick.id === t.id ? { ...tick, status: 'READY' } : tick));
                          }}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded text-xs transition"
                        >
                          Siap Saji
                        </button>
                      )}
                      {isReady && (
                        <button
                          onClick={() => {
                            setKdsTickets(prev => prev.filter(tick => tick.id !== t.id));
                          }}
                          className="w-full bg-neutral-700 hover:bg-neutral-800 text-white font-bold py-2 rounded text-xs transition"
                        >
                          Selesai Disajikan (Done)
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === 'settings' && (
          <section className="space-y-6 max-w-4xl">
            {saveSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs font-semibold flex items-center justify-between">
                <span>Pengaturan konfigurasi pajak outlet berhasil disimpan dan disinkronkan ke seluruh terminal kasir.</span>
                <button onClick={() => setSaveSuccess(false)} className="text-emerald-900 font-bold ml-2">×</button>
              </div>
            )}

            <div className="bg-white rounded-lg border border-[#E2DDD8] p-6 space-y-6">
              <div>
                <h3 className="font-bold text-sm text-[#1A1714]">Pengaturan Pajak per Outlet (PPN / PB1)</h3>
                <p className="text-xs text-[#6B6460] mt-1">
                  Pilih apakah outlet mengenakan pajak pada transaksi kasir atau berstatus non-PKP / bebas pajak.
                </p>
              </div>

              <div className="space-y-6 divide-y divide-[#E2DDD8]">
                {/* Outlet 1 */}
                <div className="pt-4 first:pt-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-xs text-[#1A1714]">St. Tanah Abang (CKA-J021)</h4>
                      <p className="text-[11px] text-[#6B6460]">Jakarta Pusat - Outlet Reguler</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={outletTaxes['CKA-J021']?.enabled}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setOutletTaxes(prev => ({ ...prev, 'CKA-J021': { ...prev['CKA-J021'], enabled: val } }));
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#E8460A]"></div>
                      <span className="ml-3 text-xs font-medium text-[#1A1714]">
                        {outletTaxes['CKA-J021']?.enabled ? 'Pajak Aktif' : 'Tanpa Pajak (0%)'}
                      </span>
                    </label>
                  </div>

                  {outletTaxes['CKA-J021']?.enabled && (
                    <div className="mt-4 p-4 bg-[#F7F5F2] rounded-md grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="font-semibold block mb-1">Tarif Pajak</label>
                        <select
                          value={outletTaxes['CKA-J021']?.rate}
                          onChange={(e) => {
                            const rate = parseFloat(e.target.value);
                            setOutletTaxes(prev => ({ ...prev, 'CKA-J021': { ...prev['CKA-J021'], rate } }));
                          }}
                          className="w-full border border-[#E2DDD8] rounded p-2 bg-white"
                        >
                          <option value={0.11}>11% (PPN Nasional)</option>
                          <option value={0.10}>10% (PB1 Resto Daerah)</option>
                        </select>
                      </div>
                      <div>
                        <label className="font-semibold block mb-1">Sifat Pajak</label>
                        <select
                          value={outletTaxes['CKA-J021']?.inclusive ? 'inclusive' : 'exclusive'}
                          onChange={(e) => {
                            const inclusive = e.target.value === 'inclusive';
                            setOutletTaxes(prev => ({ ...prev, 'CKA-J021': { ...prev['CKA-J021'], inclusive } }));
                          }}
                          className="w-full border border-[#E2DDD8] rounded p-2 bg-white"
                        >
                          <option value="exclusive">Eksklusif (Ditambahkan pada Total Akhir)</option>
                          <option value="inclusive">Inklusif (Sudah Termasuk dalam Harga Menu)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Outlet 2 */}
                <div className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-xs text-[#1A1714]">Gudang Stall Sepanjang (GDG-SBY)</h4>
                      <p className="text-[11px] text-[#6B6460]">Jawa Timur - Gudang Logistik / Hub</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={outletTaxes['GDG-SBY']?.enabled}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setOutletTaxes(prev => ({ ...prev, 'GDG-SBY': { ...prev['GDG-SBY'], enabled: val } }));
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#E8460A]"></div>
                      <span className="ml-3 text-xs font-medium text-[#1A1714]">
                        {outletTaxes['GDG-SBY']?.enabled ? 'Pajak Aktif' : 'Tanpa Pajak (0%)'}
                      </span>
                    </label>
                  </div>

                  {outletTaxes['GDG-SBY']?.enabled && (
                    <div className="mt-4 p-4 bg-[#F7F5F2] rounded-md grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="font-semibold block mb-1">Tarif Pajak</label>
                        <select
                          value={outletTaxes['GDG-SBY']?.rate}
                          onChange={(e) => {
                            const rate = parseFloat(e.target.value);
                            setOutletTaxes(prev => ({ ...prev, 'GDG-SBY': { ...prev['GDG-SBY'], rate } }));
                          }}
                          className="w-full border border-[#E2DDD8] rounded p-2 bg-white"
                        >
                          <option value={0.11}>11% (PPN Nasional)</option>
                          <option value={0.10}>10% (PB1 Resto Daerah)</option>
                        </select>
                      </div>
                      <div>
                        <label className="font-semibold block mb-1">Sifat Pajak</label>
                        <select
                          value={outletTaxes['GDG-SBY']?.inclusive ? 'inclusive' : 'exclusive'}
                          onChange={(e) => {
                            const inclusive = e.target.value === 'inclusive';
                            setOutletTaxes(prev => ({ ...prev, 'GDG-SBY': { ...prev['GDG-SBY'], inclusive } }));
                          }}
                          className="w-full border border-[#E2DDD8] rounded p-2 bg-white"
                        >
                          <option value="exclusive">Eksklusif (Ditambahkan pada Total Akhir)</option>
                          <option value="inclusive">Inklusif (Sudah Termasuk dalam Harga Menu)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-[#E2DDD8] flex justify-end">
                <button
                  onClick={() => setSaveSuccess(true)}
                  className="bg-[#E8460A] text-white px-4 py-2 rounded-md text-xs font-bold hover:bg-[#d43f09] transition"
                >
                  Simpan Konfigurasi Pajak
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
