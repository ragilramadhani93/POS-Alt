import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial master data POS Alternatif...');

  // 1. Company
  const company = await prisma.company.upsert({
    where: { slug: 'kopi-kenangan-jiwa' },
    update: {},
    create: {
      name: 'Kopi & Toast Nusantara',
      slug: 'kopi-kenangan-jiwa',
      timezoneDefault: 'Asia/Jakarta',
      currencyCode: 'IDR',
    },
  });

  // 2. Outlets (2 Outlet: Jakarta & Surabaya)
  const outletJkt = await prisma.outlet.upsert({
    where: { companyId_code: { companyId: company.id, code: 'CKA-J021' } },
    update: {},
    create: {
      companyId: company.id,
      name: 'Cabang Stasiun Tanah Abang',
      code: 'CKA-J021',
      address: 'Stasiun Tanah Abang, Jakarta Pusat',
      timezone: 'Asia/Jakarta',
      taxRate: 0.1100, // 11% PPN
      serviceChargeRate: 0.0000,
      isTaxInclusive: true, // Harga menu sudah nett/termasuk pajak
      roundingMode: 'none',
    },
  });

  const outletSby = await prisma.outlet.upsert({
    where: { companyId_code: { companyId: company.id, code: 'GDG-SBY' } },
    update: {},
    create: {
      companyId: company.id,
      name: 'Gudang Stall Sepanjang Sidoarjo',
      code: 'GDG-SBY',
      address: 'Jl. Raya Gilang 159, Sidoarjo Surabaya',
      timezone: 'Asia/Jakarta',
      taxRate: 0.1100,
      serviceChargeRate: 0.0000,
      isTaxInclusive: true,
      roundingMode: 'none',
    },
  });

  // 3. Users (Owner & Kasir)
  const passwordHash = await bcrypt.hash('admin123', 10);
  const pinHash = await bcrypt.hash('123456', 10);

  const owner = await prisma.user.upsert({
    where: { email: 'owner@pos.local' },
    update: {},
    create: {
      companyId: company.id,
      name: 'Bapak Hendra (Owner)',
      email: 'owner@pos.local',
      passwordHash,
      role: 'OWNER',
    },
  });

  const cashier = await prisma.user.upsert({
    where: { email: 'kasir1@pos.local' },
    update: {},
    create: {
      companyId: company.id,
      name: 'Budi Santoso',
      email: 'kasir1@pos.local',
      pinHash, // PIN 123456
      role: 'CASHIER',
    },
  });

  // Assign kasir ke outlet Jakarta
  await prisma.userOutletAssignment.upsert({
    where: { userId_outletId: { userId: cashier.id, outletId: outletJkt.id } },
    update: {},
    create: {
      userId: cashier.id,
      outletId: outletJkt.id,
    },
  });

  // 4. Kategori Produk
  const catKopi = await prisma.category.create({
    data: { companyId: company.id, name: 'Kopi Susu & Espresso', sortOrder: 1 },
  });

  const catNonKopi = await prisma.category.create({
    data: { companyId: company.id, name: 'Non-Kopi & Teh', sortOrder: 2 },
  });

  const catMakanan = await prisma.category.create({
    data: { companyId: company.id, name: 'Roti & Snack', sortOrder: 3 },
  });

  // 5. Modifier (Level Gula & Topping)
  const modGula = await prisma.modifier.create({
    data: {
      companyId: company.id,
      name: 'Tingkat Kemanisan',
      isRequired: true,
      minSelect: 1,
      maxSelect: 1,
      options: {
        create: [
          { name: 'Normal Sugar (100%)', priceAdd: 0 },
          { name: 'Less Sugar (50%)', priceAdd: 0 },
          { name: 'No Sugar (0%)', priceAdd: 0 },
        ],
      },
    },
    include: { options: true },
  });

  const modTopping = await prisma.modifier.create({
    data: {
      companyId: company.id,
      name: 'Ekstra Topping',
      isRequired: false,
      minSelect: 0,
      maxSelect: 2,
      options: {
        create: [
          { name: 'Grass Jelly', priceAdd: 4000 },
          { name: 'Coffee Jelly', priceAdd: 5000 },
          { name: 'Puding Coklat', priceAdd: 4000 },
        ],
      },
    },
    include: { options: true },
  });

  // 6. Master 20+ Produk Sellable
  const sampleProducts = [
    { sku: 'KOP-001', name: 'Es Kopi Kenangan Mantan', categoryId: catKopi.id, price: 19000, cogs: 6500 },
    { sku: 'KOP-002', name: 'Kopi Susu Gula Aren Spesial', categoryId: catKopi.id, price: 22000, cogs: 7200 },
    { sku: 'KOP-003', name: 'Americano Dingin / Panas', categoryId: catKopi.id, price: 15000, cogs: 4000 },
    { sku: 'KOP-004', name: 'Caramel Macchiato Cream', categoryId: catKopi.id, price: 26000, cogs: 9500 },
    { sku: 'KOP-005', name: 'Cafe Latte Double Shot', categoryId: catKopi.id, price: 24000, cogs: 8000 },
    { sku: 'KOP-006', name: 'Cappuccino Foam Tebal', categoryId: catKopi.id, price: 24000, cogs: 8000 },
    { sku: 'KOP-007', name: 'Avocado Coffee Bliss', categoryId: catKopi.id, price: 28000, cogs: 11000 },
    { sku: 'TEA-001', name: 'Matcha Green Tea Latte', categoryId: catNonKopi.id, price: 25000, cogs: 8500 },
    { sku: 'TEA-002', name: 'Susu Coklat Klasik Dingin', categoryId: catNonKopi.id, price: 20000, cogs: 7000 },
    { sku: 'TEA-003', name: 'Earl Grey Milk Tea', categoryId: catNonKopi.id, price: 22000, cogs: 6800 },
    { sku: 'TEA-004', name: 'Lemon Tea Segar Segar', categoryId: catNonKopi.id, price: 15000, cogs: 3500 },
    { sku: 'TEA-005', name: 'Lychee Iced Tea', categoryId: catNonKopi.id, price: 18000, cogs: 4500 },
    { sku: 'TEA-006', name: 'Taro Velvet Latte', categoryId: catNonKopi.id, price: 23000, cogs: 7500 },
    { sku: 'TEA-007', name: 'Red Velvet Cheesy Cream', categoryId: catNonKopi.id, price: 27000, cogs: 9500 },
    { sku: 'SNK-001', name: 'Roti Bakar Srikaya Butter', categoryId: catMakanan.id, price: 18000, cogs: 6000 },
    { sku: 'SNK-002', name: 'Roti Coklat Keju Panggang', categoryId: catMakanan.id, price: 20000, cogs: 7500 },
    { sku: 'SNK-003', name: 'Croissant Butter Gurih', categoryId: catMakanan.id, price: 22000, cogs: 9000 },
    { sku: 'SNK-004', name: 'Pain Au Chocolat', categoryId: catMakanan.id, price: 25000, cogs: 10500 },
    { sku: 'SNK-005', name: 'Singkong Goreng Sambal Roa', categoryId: catMakanan.id, price: 17000, cogs: 5000 },
    { sku: 'SNK-006', name: 'Pisang Goreng Madu Krispi', categoryId: catMakanan.id, price: 18000, cogs: 5500 },
    { sku: 'SNK-007', name: 'Donat Kampung Gula Halus', categoryId: catMakanan.id, price: 12000, cogs: 3000 },
  ];

  for (const item of sampleProducts) {
    const prod = await prisma.product.create({
      data: {
        companyId: company.id,
        categoryId: item.categoryId,
        sku: item.sku,
        name: item.name,
        sellPrice: item.price,
        cogs: item.cogs,
        productType: 'SELLABLE',
      },
    });

    // Pasang modifier ke menu minuman
    if (item.categoryId === catKopi.id || item.categoryId === catNonKopi.id) {
      await prisma.productModifier.create({
        data: { productId: prod.id, modifierId: modGula.id, sortOrder: 1 },
      });
      await prisma.productModifier.create({
        data: { productId: prod.id, modifierId: modTopping.id, sortOrder: 2 },
      });
    }
  }

  // 7. Member Contoh
  await prisma.member.create({
    data: {
      companyId: company.id,
      name: 'Rudi Hartono (Member Setia)',
      phone: '081234567890',
      email: 'rudi@pelanggan.id',
      totalPoints: 25,
      totalSpend: 250000,
    },
  });

  console.log('Seeding selesai dengan sukses! 2 Outlet, 2 User, 21 Produk, Modifier & 1 Member.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
