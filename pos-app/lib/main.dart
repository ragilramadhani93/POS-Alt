import 'package:flutter/material.dart';
import 'package:dio/dio.dart';

void main() {
  runApp(const PosAlternatifApp());
}

class PosAlternatifApp extends StatelessWidget {
  const PosAlternatifApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'POS Kasir F&B',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFF7F5F2),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFFE8460A),
          primary: const Color(0xFFE8460A),
        ),
      ),
      home: const MainPosScreen(),
    );
  }
}

class MainPosScreen extends StatefulWidget {
  const MainPosScreen({super.key});

  @override
  State<MainPosScreen> createState() => _MainPosScreenState();
}

class _MainPosScreenState extends State<MainPosScreen> {
  int _currentTabIndex = 0;

  // Kasir Belanja
  final List<CartItem> _cart = [];
  String _selectedCategory = 'Semua';

  // State Form GR Barang
  final TextEditingController _sjController = TextEditingController(text: 'SJ/0140/1126/GDG-SBY');
  bool _isFetchingSj = false;
  List<GrItemPreview> _grItems = [];
  String _grPic = '';
  String _grDate = '';

  // State Form Waste
  String _selectedWasteProduct = 'Biji Kopi Espresso Blend (Raw Material)';
  final TextEditingController _wasteQtyController = TextEditingController(text: '100');
  final TextEditingController _wasteReasonController = TextEditingController(text: 'Tumpah saat kalibrasi grinder');

  // State Form Produksi
  int _productionBatches = 1;

  // State Promo & Membership Kasir (Fase 3)
  String _memberPhoneInput = '';
  MemberProfile? _selectedMember;
  final TextEditingController _voucherController = TextEditingController();
  String _appliedVoucher = '';
  int _voucherDiscount = 0;
  bool _usePoints = false;

  // State Offline Outbox & Digital Payment (Fase 4)
  bool _isOnline = true;
  final List<Map<String, dynamic>> _offlineOutbox = [];
  bool _isSyncing = false;

  // State Pengaturan Pajak (Pakai / Tidak Pajak)
  bool _isTaxEnabled = true;
  double _taxRate = 0.11; // 11% PPN
  bool _isTaxInclusive = false;

  final List<ProductItem> _products = [
    ProductItem(id: '1', sku: 'KOP-001', name: 'Es Kopi Kenangan Mantan', category: 'Kopi', price: 19000),
    ProductItem(id: '2', sku: 'KOP-002', name: 'Kopi Susu Gula Aren', category: 'Kopi', price: 22000),
    ProductItem(id: '3', sku: 'KOP-003', name: 'Americano Dingin', category: 'Kopi', price: 15000),
    ProductItem(id: '4', sku: 'TEA-001', name: 'Matcha Green Tea Latte', category: 'Non-Kopi', price: 25000),
    ProductItem(id: '5', sku: 'TEA-002', name: 'Susu Coklat Klasik', category: 'Non-Kopi', price: 20000),
    ProductItem(id: '6', sku: 'SNK-001', name: 'Roti Bakar Srikaya Butter', category: 'Snack', price: 18000),
    ProductItem(id: '7', sku: 'SNK-002', name: 'Croissant Butter Gurih', category: 'Snack', price: 22000),
  ];

  void _addToCart(ProductItem product) {
    setState(() {
      final index = _cart.indexWhere((item) => item.product.id == product.id);
      if (index >= 0) {
        _cart[index].qty++;
      } else {
        _cart.add(CartItem(product: product, qty: 1));
      }
    });
  }

  int get _subtotal => _cart.fold(0, (sum, item) => sum + (item.product.price * item.qty));

  int get _memberPointsDiscount => (_usePoints && _selectedMember != null) ? (_selectedMember!.points * 1000) : 0;
  int get _discountedSubtotal => (_subtotal - _voucherDiscount - _memberPointsDiscount).clamp(0, 999999999);
  int get _taxAmount {
    if (!_isTaxEnabled) return 0;
    if (_isTaxInclusive) {
      return (_discountedSubtotal - (_discountedSubtotal / (1 + _taxRate))).round();
    }
    return (_discountedSubtotal * _taxRate).round();
  }
  int get _finalTotal {
    if (!_isTaxEnabled) return _discountedSubtotal;
    if (_isTaxInclusive) return _discountedSubtotal;
    return _discountedSubtotal + _taxAmount;
  }

  void _lookupMember(String phone) {
    if (phone.contains('0812')) {
      setState(() {
        _selectedMember = MemberProfile(
          name: 'Rudi Hartono',
          phone: '081234567890',
          tier: 'Gold (1.5x Point)',
          points: 15,
          stamps: 4,
        );
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Member Rudi Hartono (Gold) Terhubung!')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Member tidak ditemukan. Input nama untuk daftar baru.')),
      );
    }
  }

  void _applyVoucher(String code) {
    if (code.toUpperCase() == 'HEMAT10') {
      setState(() {
        _appliedVoucher = 'HEMAT10';
        _voucherDiscount = 10000;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Voucher HEMAT10 Berhasil Digunakan! Potongan Rp 10.000')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Kode voucher tidak valid atau kuota habis')),
      );
    }
  }

  // Simulasi fetch Google Sheets BPSJ
  void _searchSuratJalan() {
    setState(() => _isFetchingSj = true);
    Future.delayed(const Duration(milliseconds: 600), () {
      setState(() {
        _isFetchingSj = false;
        _grPic = 'YUDI';
        _grDate = '10/11/2026';
        _grItems = [
          GrItemPreview(
            kode: '00M.STXXX.X0000199XX',
            nama: 'PAPERBAG KACC BESAR - PGU',
            satuan: 'PCS',
            qtyKirim: 400,
            qtyDiterima: 400,
          ),
          GrItemPreview(
            kode: '00M.STXXX.X0000094XX',
            nama: 'PET STRAWLESS FLAT LID KA COFFEE',
            satuan: 'PCS',
            qtyKirim: 800,
            qtyDiterima: 800,
          ),
        ];
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 1,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFE8460A),
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Text('POS', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
            ),
            const SizedBox(width: 8),
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('St. Tanah Abang (CKA-J021)', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF1A1714))),
                Text('Kasir: Budi Santoso | Shift Pagi', style: TextStyle(fontSize: 11, color: Color(0xFF6B6460))),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Tutup Shift Kasir',
            icon: const Icon(Icons.lock_clock_outlined, color: Colors.blueGrey, size: 20),
            onPressed: _showCloseShiftDialog,
          ),
          IconButton(
            tooltip: 'Pengaturan Pajak Outlet',
            icon: Icon(
              _isTaxEnabled ? Icons.receipt_long : Icons.receipt_long_outlined,
              color: _isTaxEnabled ? const Color(0xFFE8460A) : Colors.grey,
              size: 20,
            ),
            onPressed: _showTaxSettingDialog,
          ),
          InkWell(
            onTap: () {
              setState(() {
                _isOnline = !_isOnline;
              });
            },
            borderRadius: BorderRadius.circular(12),
            child: Container(
              margin: const EdgeInsets.only(right: 16),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: _isOnline ? Colors.green.withOpacity(0.12) : Colors.orange.withOpacity(0.15),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: _isOnline ? Colors.green : Colors.orange.shade800),
              ),
              child: Row(
                children: [
                  Icon(_isOnline ? Icons.wifi : Icons.wifi_off, size: 14, color: _isOnline ? Colors.green : Colors.orange.shade800),
                  const SizedBox(width: 4),
                  Text(
                    _isOnline ? 'Online' : 'Mode Offline',
                    style: TextStyle(
                      fontSize: 11,
                      color: _isOnline ? Colors.green.shade800 : Colors.orange.shade900,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          if (!_isOnline || _offlineOutbox.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: _isOnline ? Colors.amber.shade50 : Colors.red.shade50,
              child: Row(
                children: [
                  Icon(_isOnline ? Icons.cloud_upload_outlined : Icons.offline_pin, size: 18, color: _isOnline ? Colors.amber.shade800 : Colors.red.shade800),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      !_isOnline
                          ? 'Perangkat sedang Offline. Transaksi kasir disimpan di storage lokal tablet (${_offlineOutbox.length} pending).'
                          : 'Tersambung online. Ada ${_offlineOutbox.length} transaksi di outbox lokal siap disinkronkan.',
                      style: TextStyle(fontSize: 11, color: _isOnline ? Colors.amber.shade900 : Colors.red.shade900, fontWeight: FontWeight.w600),
                    ),
                  ),
                  if (_isOnline && _offlineOutbox.isNotEmpty)
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFE8460A),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      ),
                      onPressed: _isSyncing ? null : _syncOfflineOutbox,
                      icon: _isSyncing
                          ? const SizedBox(width: 12, height: 12, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : const Icon(Icons.sync, size: 14),
                      label: Text(_isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang', style: const TextStyle(fontSize: 11)),
                    ),
                ],
              ),
            ),
          Expanded(
            child: IndexedStack(
              index: _currentTabIndex,
              children: [
                // TAB 0: KASIR
                _buildCashierTab(),

                // TAB 1: WASTE / SPOILAGE
                _buildWasteTab(),

                // TAB 2: PRODUKSI / CRAFTING
                _buildProductionTab(),

                // TAB 3: GOOD RECEIVE (GOOGLE SHEETS BPSJ)
                _buildGrTab(),

                // TAB 4: LAPORAN
                _buildReportingTab(),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentTabIndex,
        onDestinationSelected: (index) => setState(() => _currentTabIndex = index),
        backgroundColor: Colors.white,
        elevation: 2,
        indicatorColor: const Color(0xFFE8460A).withOpacity(0.15),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.point_of_sale), label: 'Kasir'),
          NavigationDestination(icon: Icon(Icons.delete_outline), label: 'Waste'),
          NavigationDestination(icon: Icon(Icons.soup_kitchen_outlined), label: 'Produksi'),
          NavigationDestination(icon: Icon(Icons.local_shipping_outlined), label: 'Terima SJ'),
          NavigationDestination(icon: Icon(Icons.bar_chart), label: 'Laporan'),
        ],
      ),
    );
  }

  // TAB 0: Kasir
  Widget _buildCashierTab() {
    final filtered = _selectedCategory == 'Semua'
        ? _products
        : _products.where((p) => p.category == _selectedCategory).toList();

    return Row(
      children: [
        Expanded(
          flex: 6,
          child: Column(
            children: [
              Container(
                height: 52,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                color: Colors.white,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: ['Semua', 'Kopi', 'Non-Kopi', 'Snack'].map((cat) {
                    final isSel = _selectedCategory == cat;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        selected: isSel,
                        label: Text(cat),
                        selectedColor: const Color(0xFFE8460A),
                        labelStyle: TextStyle(
                          color: isSel ? Colors.white : const Color(0xFF1A1714),
                          fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                          fontSize: 12,
                        ),
                        onSelected: (_) => setState(() => _selectedCategory = cat),
                      ),
                    );
                  }).toList(),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: GridView.builder(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
                      childAspectRatio: 1.1,
                    ),
                    itemCount: filtered.length,
                    itemBuilder: (context, i) {
                      final item = filtered[i];
                      return InkWell(
                        onTap: () => _addToCart(item),
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFFE2DDD8)),
                          ),
                          padding: const EdgeInsets.all(10),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(item.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                              Text('Rp ${item.price.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]}.')}', style: const TextStyle(color: Color(0xFFE8460A), fontWeight: FontWeight.bold, fontSize: 13)),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
            ],
          ),
        ),
        Container(
          width: 320,
          color: Colors.white,
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: Color(0xFFE2DDD8))),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Pesanan Baru', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                        Text('BOM: Potong Bahan Otomatis', style: TextStyle(fontSize: 10, color: Colors.green, fontWeight: FontWeight.bold)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    // Quick Member Input di Kasir
                    _selectedMember == null
                        ? Row(
                            children: [
                              Expanded(
                                child: SizedBox(
                                  height: 36,
                                  child: TextField(
                                    decoration: const InputDecoration(
                                      hintText: 'Cari No. HP Member...',
                                      contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 0),
                                      border: OutlineInputBorder(),
                                      prefixIcon: Icon(Icons.person_search, size: 16),
                                    ),
                                    style: const TextStyle(fontSize: 11),
                                    onSubmitted: _lookupMember,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 4),
                              ElevatedButton(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFFE8460A),
                                  foregroundColor: Colors.white,
                                  padding: const EdgeInsets.symmetric(horizontal: 8),
                                ),
                                onPressed: () => _lookupMember('0812'),
                                child: const Text('CARI', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                              ),
                            ],
                          )
                        : Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(color: Colors.amber.withOpacity(0.12), borderRadius: BorderRadius.circular(4), border: Border.all(color: Colors.amber.shade700)),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('👤 ${_selectedMember!.name} (${_selectedMember!.tier})', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11)),
                                    Text('Poin: ${_selectedMember!.points} | Stamps: ${_selectedMember!.stamps}/10', style: const TextStyle(fontSize: 10, color: Color(0xFF6B6460))),
                                  ],
                                ),
                                IconButton(
                                  icon: const Icon(Icons.close, size: 14),
                                  onPressed: () => setState(() {
                                    _selectedMember = null;
                                    _usePoints = false;
                                  }),
                                ),
                              ],
                            ),
                          ),
                  ],
                ),
              ),
              Expanded(
                child: _cart.isEmpty
                    ? const Center(child: Text('Keranjang masih kosong', style: TextStyle(color: Color(0xFF6B6460), fontSize: 12)))
                    : ListView.builder(
                        itemCount: _cart.length,
                        itemBuilder: (context, i) {
                          final item = _cart[i];
                          return ListTile(
                            dense: true,
                            title: Text(item.product.name, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 12)),
                            subtitle: Text('Rp ${item.product.price} x ${item.qty}', style: const TextStyle(fontSize: 11)),
                            trailing: Text('Rp ${item.product.price * item.qty}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                          );
                        },
                      ),
              ),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: const BoxDecoration(
                  color: Color(0xFFF7F5F2),
                  border: Border(top: BorderSide(color: Color(0xFFE2DDD8))),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Subtotal', style: TextStyle(fontSize: 12, color: Color(0xFF6B6460))),
                        Text('Rp ${_subtotal.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]}.')}', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12)),
                      ],
                    ),
                    if (_voucherDiscount > 0)
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Voucher ($_appliedVoucher)', style: const TextStyle(fontSize: 12, color: Colors.green)),
                          Text('- Rp ${_voucherDiscount.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]}.')}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.green)),
                        ],
                      ),
                    if (_selectedMember != null && _selectedMember!.points > 0)
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Checkbox(
                                value: _usePoints,
                                onChanged: (val) => setState(() => _usePoints = val ?? false),
                                visualDensity: VisualDensity.compact,
                              ),
                              Text('Tukar ${_selectedMember!.points} Poin', style: const TextStyle(fontSize: 11)),
                            ],
                          ),
                          if (_usePoints)
                            Text('- Rp ${_memberPointsDiscount.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]}.')}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.green)),
                        ],
                      ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Checkbox(
                              value: _isTaxEnabled,
                              onChanged: (val) => setState(() => _isTaxEnabled = val ?? false),
                              visualDensity: VisualDensity.compact,
                            ),
                            Text(
                              _isTaxEnabled
                                  ? 'Pajak PPN (${(_taxRate * 100).round()}%${_isTaxInclusive ? " Inklusif" : ""})'
                                  : 'Tanpa Pajak (0%)',
                              style: const TextStyle(fontSize: 11),
                            ),
                          ],
                        ),
                        Text(
                          _isTaxEnabled
                              ? (_isTaxInclusive
                                  ? '(Termasuk Rp ${_taxAmount.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]}.')})'
                                  : '+ Rp ${_taxAmount.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]}.')}')
                              : 'Rp 0',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 11,
                            color: _isTaxEnabled ? const Color(0xFF1A1714) : const Color(0xFF6B6460),
                          ),
                        ),
                      ],
                    ),
                    const Divider(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Total Pembayaran', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                        Text('Rp ${_finalTotal.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]}.')}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFFE8460A))),
                      ],
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFE8460A),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        onPressed: _cart.isEmpty ? null : () => _showPaymentDialog(),
                        child: const Text('BAYAR (POTONG RESEP)', style: TextStyle(fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // TAB 1: Waste
  Widget _buildWasteTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Center(
        child: Container(
          constraints: const BoxConstraints(maxWidth: 600),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFFE2DDD8)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Catat Waste / Pemborosan Barang', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 6),
              const Text('Stok persediaan akan berkurang secara otomatis dan dicatat dalam audit kartu stok.', style: TextStyle(fontSize: 12, color: Color(0xFF6B6460))),
              const Divider(height: 24),
              const Text('Pilih Produk, Menu Jual, atau Semi-Finished:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
              const SizedBox(height: 6),
              DropdownButtonFormField<String>(
                value: _selectedWasteProduct,
                decoration: const InputDecoration(border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8)),
                items: [
                  'Es Kopi Kenangan Mantan (Menu Jual -> Auto Breakdown Bahan)',
                  'Base Sirup Gula Aren Spesial (Semi-Finished -> Auto Breakdown Gula Aren Cair)',
                  'FRESH MILK PLAIN 946ML - DIAMOND (Raw Material)',
                  'Biji Kopi Espresso Blend (Raw Material)',
                ].map((s) => DropdownMenuItem(value: s, child: Text(s, style: const TextStyle(fontSize: 11)))).toList(),
                onChanged: (v) => setState(() => _selectedWasteProduct = v!),
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: Colors.blue.withOpacity(0.08), borderRadius: BorderRadius.circular(6)),
                child: const Row(
                  children: [
                    Icon(Icons.info_outline, size: 16, color: Colors.blue),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Jika memilih Menu Jual atau Semi-Finished, sistem otomatis memecah & memotong stok bahan baku (raw materials) sesuai resep/crafting bertingkat.',
                        style: TextStyle(fontSize: 10, color: Colors.blue),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              const Text('Jumlah Qty Rusak / Dibuang:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
              const SizedBox(height: 6),
              TextField(
                controller: _wasteQtyController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8), hintText: 'Contoh: 100'),
              ),
              const SizedBox(height: 14),
              const Text('Alasan Waste:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
              const SizedBox(height: 6),
              TextField(
                controller: _wasteReasonController,
                decoration: const InputDecoration(border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8)),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 44,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.red.shade700, foregroundColor: Colors.white),
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Waste $_selectedWasteProduct sebesar ${_wasteQtyController.text} berhasil dipotong dari stok!')),
                    );
                  },
                  icon: const Icon(Icons.delete_outline),
                  label: const Text('SIMPAN WASTE & POTONG STOK', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // TAB 2: Produksi
  Widget _buildProductionTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Center(
        child: Container(
          constraints: const BoxConstraints(maxWidth: 600),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFFE2DDD8)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Crafting / Produksi Semi-Finished', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 6),
              const Text('Pilih produk setengah jadi yang dimasak/diracik oleh crew outlet.', style: TextStyle(fontSize: 12, color: Color(0xFF6B6460))),
              const Divider(height: 24),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: const Color(0xFFF7F5F2), borderRadius: BorderRadius.circular(8)),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Target Produk: Base Sirup Gula Aren Spesial', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    SizedBox(height: 4),
                    Text('Standar Resep per Batch: 1.000 ML', style: TextStyle(fontSize: 11, color: Color(0xFF6B6460))),
                    Text('Bahan diperlukan: 900 ML Gula Aren Cair Murni', style: TextStyle(fontSize: 11, color: Colors.blueGrey)),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              const Text('Jumlah Batch Produksi:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
              const SizedBox(height: 6),
              Row(
                children: [
                  IconButton.outlined(
                    onPressed: _productionBatches > 1 ? () => setState(() => _productionBatches--) : null,
                    icon: const Icon(Icons.remove),
                  ),
                  const SizedBox(width: 16),
                  Text('$_productionBatches Batch (${_productionBatches * 1000} ML)', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFFE8460A))),
                  const SizedBox(width: 16),
                  IconButton.outlined(
                    onPressed: () => setState(() => _productionBatches++),
                    icon: const Icon(Icons.add),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 44,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFE8460A), foregroundColor: Colors.white),
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Produksi $_productionBatches Batch berhasil! Bahan baku terpotong dan stok Base Aren bertambah ${_productionBatches * 1000} ML.')),
                    );
                  },
                  icon: const Icon(Icons.check_circle_outline),
                  label: const Text('SELESAIKAN PRODUKSI (MASUK STOK)', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // TAB 3: Terima Barang (GR Google Sheets)
  Widget _buildGrTab() {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _sjController,
                  decoration: const InputDecoration(
                    labelText: 'Nomor Surat Jalan BPSJ',
                    hintText: 'Contoh: SJ/0140/1126/GDG-SBY',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.qr_code_scanner),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              SizedBox(
                height: 52,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFE8460A), foregroundColor: Colors.white),
                  onPressed: _isFetchingSj ? null : _searchSuratJalan,
                  icon: _isFetchingSj ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : const Icon(Icons.search),
                  label: const Text('TARIK DARI SHEET', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (_grItems.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(color: Colors.green.withOpacity(0.1), borderRadius: BorderRadius.circular(6), border: Border.all(color: Colors.green)),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('SJ: ${_sjController.text} (PIC: $_grPic | Tgl: $_grDate)', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.green, fontSize: 12)),
                  const Text('Sinkron Google Sheets: BP Tab', style: TextStyle(fontSize: 11, color: Colors.green)),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Expanded(
              child: ListView.builder(
                itemCount: _grItems.length,
                itemBuilder: (ctx, i) {
                  final item = _grItems[i];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(item.nama, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                Text('Kode: ${item.kode} | Satuan: ${item.satuan}', style: const TextStyle(fontSize: 11, color: Color(0xFF6B6460))),
                                Text('Qty Dikirim: ${item.qtyKirim}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
                              ],
                            ),
                          ),
                          SizedBox(
                            width: 140,
                            child: TextField(
                              decoration: const InputDecoration(labelText: 'Diterima Fisik', border: OutlineInputBorder()),
                              keyboardType: TextInputType.number,
                              controller: TextEditingController(text: item.qtyDiterima.toString()),
                              onChanged: (val) {
                                item.qtyDiterima = double.tryParse(val) ?? item.qtyDiterima;
                              },
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(backgroundColor: Colors.green.shade700, foregroundColor: Colors.white),
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('GR ${_sjController.text} berhasil diterima! Stok otomatis bertambah.')),
                  );
                  setState(() => _grItems.clear());
                },
                icon: const Icon(Icons.check),
                label: const Text('KONFIRMASI TERIMA BARANG (MASUK STOK)', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          ] else if (!_isFetchingSj) ...[
            const Expanded(
              child: Center(
                child: Text('Masukkan nomor surat jalan untuk memuat data pengiriman dari Google Sheets BPSJ.', style: TextStyle(color: Color(0xFF6B6460))),
              ),
            ),
          ],
        ],
      ),
    );
  }

  // TAB 4: Laporan
  Widget _buildReportingTab() {
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Laporan Outlet Hari Ini', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
          automaticallyImplyLeading: false,
          bottom: const TabBar(
            isScrollable: true,
            indicatorColor: Color(0xFFE8460A),
            labelColor: Color(0xFFE8460A),
            tabs: [
              Tab(text: 'Ringkasan Sales'),
              Tab(text: 'Per Menu'),
              Tab(text: 'Metode Bayar'),
              Tab(text: 'Laba Rugi (P&L)'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            ListView(
              padding: const EdgeInsets.all(16),
              children: const [
                ListTile(title: Text('Total Omzet'), trailing: Text('Rp 4.250.000', style: TextStyle(fontWeight: FontWeight.bold))),
                ListTile(title: Text('Jumlah Transaksi'), trailing: Text('87 Trx')),
                ListTile(title: Text('Rata-rata Transaksi'), trailing: Text('Rp 48.850')),
                ListTile(title: Text('Total Item Terjual'), trailing: Text('214 Cup/Pcs')),
              ],
            ),
            ListView(
              padding: const EdgeInsets.all(16),
              children: const [
                ListTile(title: Text('1. Es Kopi Mantan'), subtitle: Text('45 Cup terjual'), trailing: Text('Rp 855.000')),
                ListTile(title: Text('2. Matcha Green Tea'), subtitle: Text('32 Cup terjual'), trailing: Text('Rp 800.000')),
                ListTile(title: Text('3. Roti Bakar Srikaya'), subtitle: Text('28 Pcs terjual'), trailing: Text('Rp 504.000')),
              ],
            ),
            ListView(
              padding: const EdgeInsets.all(16),
              children: const [
                ListTile(title: Text('💵 Tunai (Cash)'), subtitle: Text('42% kontribusi'), trailing: Text('Rp 1.800.000')),
                ListTile(title: Text('📱 QRIS Dinamis'), subtitle: Text('35% kontribusi'), trailing: Text('Rp 1.500.000')),
                ListTile(title: Text('💳 EDC Debit / Kredit'), subtitle: Text('23% kontribusi'), trailing: Text('Rp 950.000')),
              ],
            ),
            ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  elevation: 0,
                  color: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8), side: const BorderSide(color: Color(0xFFE2DDD8))),
                  child: const Padding(
                    padding: EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Laporan Laba Rugi Operasional Outlet', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                        SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Penjualan Bersih (Net Sales):', style: TextStyle(fontSize: 12)),
                            Text('Rp 4.250.000', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                          ],
                        ),
                        SizedBox(height: 6),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('HPP / COGS Resep Terpakai (42%):', style: TextStyle(fontSize: 12, color: Colors.blueGrey)),
                            Text('- Rp 1.785.000', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: Colors.blueGrey)),
                          ],
                        ),
                        Divider(height: 16),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Laba Kotor (Gross Profit):', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.green)),
                            Text('Rp 2.465.000 (58%)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.green)),
                          ],
                        ),
                        SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Biaya Kerusakan / Waste Bahan:', style: TextStyle(fontSize: 12, color: Colors.red)),
                            Text('- Rp 120.000', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: Colors.red)),
                          ],
                        ),
                        Divider(height: 16),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Laba Operasional Bersih:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFFE8460A))),
                            Text('Rp 2.345.000 (55.2%)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFFE8460A))),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showPaymentDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Pilih Metode Pembayaran'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Total Tagihan: Rp ${_finalTotal.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]}.')}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFFE8460A))),
            const SizedBox(height: 6),
            const Text('Bahan baku resep otomatis dipotong secara real-time.', style: TextStyle(fontSize: 11, color: Colors.green)),
            const Divider(height: 20),
            ListTile(
              dense: true,
              leading: const Icon(Icons.money, color: Colors.green),
              title: const Text('💵 Tunai Penuh (Cash)', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              trailing: const Icon(Icons.chevron_right, size: 18),
              onTap: () {
                Navigator.pop(ctx);
                _completePayment([{'method': 'CASH', 'amount': _finalTotal}]);
              },
            ),
            ListTile(
              dense: true,
              leading: const Icon(Icons.qr_code_scanner, color: Color(0xFFE8460A)),
              title: const Text('📱 QRIS Dinamis Otomatis', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              trailing: const Icon(Icons.chevron_right, size: 18),
              onTap: () {
                Navigator.pop(ctx);
                _showQrisSimulatorDialog(_finalTotal);
              },
            ),
            ListTile(
              dense: true,
              leading: const Icon(Icons.call_split, color: Colors.blue),
              title: const Text('🔀 Split Payment (Tunai + QRIS)', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              trailing: const Icon(Icons.chevron_right, size: 18),
              onTap: () {
                Navigator.pop(ctx);
                _showSplitPaymentDialog();
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showQrisSimulatorDialog(int amount) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('QRIS Dinamis Nasional (NMID)'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 180,
              height: 180,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.black26),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.qr_code_2, size: 120, color: Colors.black87),
                  Text('Rp ${amount.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]}.')}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                ],
              ),
            ),
            const SizedBox(height: 12),
            const Text('Tunjukkan QR ini ke pelanggan.\nMenunggu konfirmasi bank (15 menit)...', textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: Color(0xFF6B6460))),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Batal')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.green, foregroundColor: Colors.white),
            onPressed: () {
              Navigator.pop(ctx);
              _completePayment([{'method': 'QRIS', 'amount': amount, 'ref': 'QRIS-SIM-${DateTime.now().millisecondsSinceEpoch}'}]);
            },
            child: const Text('Simulasi Pelanggan Sukses Bayar'),
          ),
        ],
      ),
    );
  }

  void _showSplitPaymentDialog() {
    final cashAmount = (_finalTotal / 2).round();
    final qrisAmount = _finalTotal - cashAmount;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Split Pembayaran'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Total: Rp ${_finalTotal.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]}.')}', style: const TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(6)),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('1. Tunai (50%):', style: TextStyle(fontSize: 12)),
                      Text('Rp ${cashAmount.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]}.')}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('2. QRIS (50%):', style: TextStyle(fontSize: 12)),
                      Text('Rp ${qrisAmount.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]}.')}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Batal')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFE8460A), foregroundColor: Colors.white),
            onPressed: () {
              Navigator.pop(ctx);
              _completePayment([
                {'method': 'CASH', 'amount': cashAmount},
                {'method': 'QRIS', 'amount': qrisAmount, 'ref': 'QRIS-SPLIT-${DateTime.now().millisecondsSinceEpoch}'},
              ]);
            },
            child: const Text('Konfirmasi Split Payment'),
          ),
        ],
      ),
    );
  }

  void _completePayment(List<Map<String, dynamic>> payments) {
    final clientTxId = 'OFF-${DateTime.now().millisecondsSinceEpoch}';
    final summaryMethods = payments.map((p) => '${p['method']} (Rp ${p['amount']})').join(' + ');
    final itemsSnapshot = List<CartItem>.from(_cart);
    final finalSubtotal = _subtotal;
    final finalTax = _taxAmount;
    final totalAmount = _finalTotal;

    if (!_isOnline) {
      // Simpan ke Outbox Lokal
      setState(() {
        _offlineOutbox.add({
          'clientTransactionId': clientTxId,
          'cart': List.from(_cart),
          'total': _finalTotal,
          'payments': payments,
          'createdAt': DateTime.now().toIso8601String(),
        });
        _cart.clear();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: Colors.amber.shade900,
          content: Text('⚠️ Mode Offline: Transaksi disimpan di antrian lokal tablet ($summaryMethods).'),
        ),
      );
      _showReceiptDialog(itemsSnapshot, finalSubtotal, finalTax, totalAmount, payments, isOffline: true);
      return;
    }

    // Mode Online Langsung
    setState(() {
      _cart.clear();
    });
    _showReceiptDialog(itemsSnapshot, finalSubtotal, finalTax, totalAmount, payments, isOffline: false);
  }

  void _showReceiptDialog(
    List<CartItem> items,
    int subtotal,
    int tax,
    int total,
    List<Map<String, dynamic>> payments, {
    bool isOffline = false,
  }) {
    final nowStr = '${DateTime.now().day}/${DateTime.now().month}/${DateTime.now().year} ${DateTime.now().hour.toString().padLeft(2, '0')}:${DateTime.now().minute.toString().padLeft(2, '0')}';

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(
          children: [
            const Icon(Icons.check_circle, color: Colors.green, size: 22),
            const SizedBox(width: 8),
            Text(isOffline ? 'Tersimpan Offline' : 'Transaksi Berhasil!', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
          ],
        ),
        content: SizedBox(
          width: 320,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Simulasi Kertas Struk Thermal 58mm
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: Colors.black26),
                    boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 2))],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text('POS ALTERNATIF', textAlign: TextAlign.center, style: TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.bold, fontSize: 13)),
                      const Text('St. Tanah Abang (CKA-J021)', textAlign: TextAlign.center, style: TextStyle(fontFamily: 'monospace', fontSize: 10)),
                      const Text('Telp: 0812-3456-7890', textAlign: TextAlign.center, style: TextStyle(fontFamily: 'monospace', fontSize: 9, color: Color(0xFF6B6460))),
                      const Divider(thickness: 1, height: 16),
                      Text('Waktu: $nowStr', style: const TextStyle(fontFamily: 'monospace', fontSize: 9)),
                      const Text('Kasir: Budi Santoso | DINE IN', style: const TextStyle(fontFamily: 'monospace', fontSize: 9)),
                      const Divider(thickness: 1, height: 12),
                      ...items.map((it) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 2),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('${it.qty}x ${it.product.name.length > 16 ? it.product.name.substring(0, 16) : it.product.name}', style: const TextStyle(fontFamily: 'monospace', fontSize: 10)),
                            Text('Rp ${it.product.price * it.qty}', style: const TextStyle(fontFamily: 'monospace', fontSize: 10)),
                          ],
                        ),
                      )),
                      const Divider(thickness: 1, height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Subtotal:', style: TextStyle(fontFamily: 'monospace', fontSize: 10)),
                          Text('Rp $subtotal', style: const TextStyle(fontFamily: 'monospace', fontSize: 10)),
                        ],
                      ),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(_isTaxEnabled ? 'Pajak (PPN 11%):' : 'Pajak (0%):', style: const TextStyle(fontFamily: 'monospace', fontSize: 10)),
                          Text('Rp $tax', style: const TextStyle(fontFamily: 'monospace', fontSize: 10)),
                        ],
                      ),
                      const Divider(thickness: 1.5, height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('TOTAL:', style: TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.bold, fontSize: 12)),
                          Text('Rp $total', style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.bold, fontSize: 12)),
                        ],
                      ),
                      const Divider(thickness: 1, height: 12),
                      ...payments.map((p) => Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Bayar ${p['method']}:', style: const TextStyle(fontFamily: 'monospace', fontSize: 9)),
                          Text('Rp ${p['amount']}', style: const TextStyle(fontFamily: 'monospace', fontSize: 9)),
                        ],
                      )),
                      const SizedBox(height: 8),
                      const Text('Terima Kasih Atas Kunjungan Anda', textAlign: TextAlign.center, style: TextStyle(fontFamily: 'monospace', fontSize: 9)),
                      const Text('Wi-Fi: POS-FREE (kopienak)', textAlign: TextAlign.center, style: TextStyle(fontFamily: 'monospace', fontSize: 8, color: Color(0xFF6B6460))),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        actions: [
          OutlinedButton.icon(
            onPressed: () {
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('🖨️ Mengirim data cetak ESC/POS ke printer thermal Bluetooth (58mm)... Selesai!')),
              );
            },
            icon: const Icon(Icons.print, size: 16),
            label: const Text('Cetak Struk', style: TextStyle(fontSize: 11)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFE8460A), foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Transaksi Baru', style: TextStyle(fontSize: 11)),
          ),
        ],
      ),
    );
  }

  void _syncOfflineOutbox() async {
    if (_offlineOutbox.isEmpty) return;
    setState(() => _isSyncing = true);

    final count = _offlineOutbox.length;
    try {
      final payload = _offlineOutbox.map((tx) {
        return {
          'clientTransactionId': tx['clientTransactionId'],
          'outletId': 'CKA-J021',
          'shiftId': 'shift-morning-01',
          'orderType': 'DINE_IN',
          'items': (tx['cart'] as List).map((c) => {
            'productId': (c as CartItem).product.id,
            'qty': c.qty,
          }).toList(),
          'payments': (tx['payments'] as List).map((p) => {
            'paymentMethod': p['method'],
            'amount': p['amount'],
            'referenceNumber': p['ref'],
          }).toList(),
          'notes': 'Offline Outbox Sync',
        };
      }).toList();

      final dio = Dio(BaseOptions(
        baseUrl: 'http://localhost:3000',
        connectTimeout: const Duration(seconds: 4),
        receiveTimeout: const Duration(seconds: 4),
      ));

      await dio.post('/transactions/sync', data: {'transactions': payload});

      setState(() {
        _offlineOutbox.clear();
        _isSyncing = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: Colors.green.shade800,
            content: Text('✅ Berhasil menyinkronkan $count transaksi offline ke NestJS API (Idempoten).'),
          ),
        );
      }
    } catch (_) {
      // Jika jaringan belum stabil atau server offline, pertahankan antrian di outbox lokal
      setState(() => _isSyncing = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: Colors.amber.shade900,
            content: Text('⚠️ Server belum terjangkau: $count transaksi tetap tersimpan aman di outbox lokal.'),
          ),
        );
      }
    }
  }

  void _showTaxSettingDialog() {
    bool tempEnabled = _isTaxEnabled;
    double tempRate = _taxRate;
    bool tempInclusive = _isTaxInclusive;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Pengaturan Pajak Outlet'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Aktifkan Pajak (PPN/PB1)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                subtitle: Text(tempEnabled ? 'Pajak akan dikenakan pada transaksi' : 'Transaksi bebas pajak (0%)', style: const TextStyle(fontSize: 11)),
                value: tempEnabled,
                activeColor: const Color(0xFFE8460A),
                onChanged: (val) => setDialogState(() => tempEnabled = val),
              ),
              if (tempEnabled) ...[
                const SizedBox(height: 8),
                const Text('Tarif Pajak:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                Row(
                  children: [
                    ChoiceChip(
                      label: const Text('11% (PPN)'),
                      selected: tempRate == 0.11,
                      onSelected: (sel) {
                        if (sel) setDialogState(() => tempRate = 0.11);
                      },
                    ),
                    const SizedBox(width: 8),
                    ChoiceChip(
                      label: const Text('10% (PB1)'),
                      selected: tempRate == 0.10,
                      onSelected: (sel) {
                        if (sel) setDialogState(() => tempRate = 0.10);
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Harga Sudah Termasuk Pajak (Inklusif)', style: TextStyle(fontSize: 12)),
                  subtitle: const Text('Jika dicentang, pajak diekstrak dari harga menu', style: TextStyle(fontSize: 10, color: Color(0xFF6B6460))),
                  value: tempInclusive,
                  onChanged: (val) => setDialogState(() => tempInclusive = val ?? false),
                ),
              ],
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Batal')),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFE8460A), foregroundColor: Colors.white),
              onPressed: () {
                setState(() {
                  _isTaxEnabled = tempEnabled;
                  _taxRate = tempRate;
                  _isTaxInclusive = tempInclusive;
                });
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      _isTaxEnabled
                          ? 'Pajak diaktifkan (${(tempRate * 100).round()}% ${tempInclusive ? "Inklusif" : "Eksklusif"})'
                          : 'Pajak dinonaktifkan (Tanpa Pajak)',
                    ),
                  ),
                );
              },
              child: const Text('Simpan Pengaturan'),
            ),
          ],
        ),
      ),
    );
  }

  void _showCloseShiftDialog() {
    final TextEditingController actualCashCtrl = TextEditingController(text: '2000000');
    int expectedCash = 2000000; // Modal awal 200k + Penjualan tunai 1.8jt

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setShiftState) {
          final actualCash = int.tryParse(actualCashCtrl.text) ?? 0;
          final diff = actualCash - expectedCash;

          return AlertDialog(
            title: const Row(
              children: [
                Icon(Icons.point_of_sale, color: Color(0xFFE8460A), size: 22),
                SizedBox(width: 8),
                Text('Tutup Shift Kasir', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              ],
            ),
            content: SizedBox(
              width: 340,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Ringkasan Rekonsiliasi Kasir (Shift Pagi):', style: TextStyle(fontSize: 11, color: Color(0xFF6B6460))),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: const Color(0xFFF7F5F2), borderRadius: BorderRadius.circular(6)),
                    child: const Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Modal Kas Awal:', style: TextStyle(fontSize: 11)),
                            Text('Rp 200.000', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                          ],
                        ),
                        SizedBox(height: 4),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Penjualan Tunai (Cash):', style: TextStyle(fontSize: 11)),
                            Text('Rp 1.800.000', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                          ],
                        ),
                        SizedBox(height: 4),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Penjualan Non-Tunai (QRIS/EDC):', style: TextStyle(fontSize: 11, color: Colors.blueGrey)),
                            Text('Rp 2.450.000', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.blueGrey)),
                          ],
                        ),
                        Divider(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Total Fisik Uang Seharusnya:', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                            Text('Rp 2.000.000', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFFE8460A))),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text('Input Uang Fisik Aktual di Laci (Rp):', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                  const SizedBox(height: 4),
                  TextField(
                    controller: actualCashCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8)),
                    onChanged: (v) => setShiftState(() {}),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Status Selisih:', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                      Text(
                        diff == 0
                            ? 'Cocok (Rp 0)'
                            : diff > 0
                                ? 'Lebih +Rp $diff'
                                : 'Kurang -Rp ${diff.abs()}',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: diff == 0 ? Colors.green : (diff > 0 ? Colors.blue : Colors.red),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Batal')),
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFE8460A), foregroundColor: Colors.white),
                onPressed: () {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Shift Pagi Berhasil Ditutup! Laporan kasir dicetak ke printer.')),
                  );
                },
                child: const Text('Tutup Shift Sekarang'),
              ),
            ],
          );
        },
      ),
    );
  }
}

class MemberProfile {
  final String name;
  final String phone;
  final String tier;
  final int points;
  final int stamps;

  MemberProfile({required this.name, required this.phone, required this.tier, required this.points, required this.stamps});
}

class ProductItem {
  final String id;
  final String sku;
  final String name;
  final String category;
  final int price;

  ProductItem({required this.id, required this.sku, required this.name, required this.category, required this.price});
}

class CartItem {
  final ProductItem product;
  int qty;

  CartItem({required this.product, required this.qty});
}

class GrItemPreview {
  final String kode;
  final String nama;
  final String satuan;
  final double qtyKirim;
  double qtyDiterima;

  GrItemPreview({required this.kode, required this.nama, required this.satuan, required this.qtyKirim, required this.qtyDiterima});
}
