import { PrismaClient, ProductType, PromoType, SchemeType, ShiftStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function seedAll() {
  console.log('--- Memulai Seeding Master Data Lengkap POS Alternatif ---');

  // 1. Company
  const company = await prisma.company.upsert({
    where: { slug: 'kopi-toast-nusantara' },
    update: {},
    create: {
      name: 'Kopi & Toast Nusantara',
      slug: 'kopi-toast-nusantara',
      timezoneDefault: 'Asia/Jakarta',
      currencyCode: 'IDR',
    },
  });
  console.log(`Company: ${company.name}`);

  // 2. Outlets
  const outletJkt = await prisma.outlet.upsert({
    where: { companyId_code: { companyId: company.id, code: 'CKA-J021' } },
    update: { isTaxEnabled: true, taxRate: 0.11, isTaxInclusive: false },
    create: {
      companyId: company.id,
      name: 'Cabang St. Tanah Abang',
      code: 'CKA-J021',
      address: 'Stasiun Tanah Abang Hall Timur, Jakarta Pusat',
      phone: '0812-3456-7890',
      timezone: 'Asia/Jakarta',
      isTaxEnabled: true,
      taxRate: 0.11,
      isTaxInclusive: false,
    },
  });

  const outletSby = await prisma.outlet.upsert({
    where: { companyId_code: { companyId: company.id, code: 'GDG-SBY' } },
    update: { isTaxEnabled: false, taxRate: 0.10, isTaxInclusive: false },
    create: {
      companyId: company.id,
      name: 'Gudang Stall Sepanjang Sidoarjo',
      code: 'GDG-SBY',
      address: 'Jl. Raya Gilang No. 159, Taman Sidoarjo, Surabaya',
      phone: '0813-9876-5432',
      timezone: 'Asia/Jakarta',
      isTaxEnabled: false,
      taxRate: 0.10,
      isTaxInclusive: false,
    },
  });
  console.log(`Outlets: ${outletJkt.name}, ${outletSby.name}`);

  // 3. Inventory Locations
  const locJkt = await prisma.inventoryLocation.upsert({
    where: { id: 'loc-jkt-main' },
    update: {},
    create: {
      id: 'loc-jkt-main',
      companyId: company.id,
      outletId: outletJkt.id,
      name: 'Gudang Kasir St. Tanah Abang',
    },
  });

  const locSby = await prisma.inventoryLocation.upsert({
    where: { id: 'loc-sby-main' },
    update: {},
    create: {
      id: 'loc-sby-main',
      companyId: company.id,
      outletId: outletSby.id,
      name: 'Gudang Logistik Sepanjang',
    },
  });

  // 4. Users (Owner, Supervisor, Kasir)
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
    update: { pinHash },
    create: {
      companyId: company.id,
      name: 'Budi Santoso',
      email: 'kasir1@pos.local',
      pinHash, // PIN 123456
      role: 'CASHIER',
    },
  });

  await prisma.userOutletAssignment.upsert({
    where: { userId_outletId: { userId: cashier.id, outletId: outletJkt.id } },
    update: {},
    create: { userId: cashier.id, outletId: outletJkt.id },
  });

  // 5. Satuan UoM
  const uoms = await Promise.all([
    prisma.unitOfMeasure.upsert({
      where: { companyId_abbreviation: { companyId: company.id, abbreviation: 'GR' } },
      update: {},
      create: { companyId: company.id, name: 'Gram', abbreviation: 'GR', conversionFactor: 1 },
    }),
    prisma.unitOfMeasure.upsert({
      where: { companyId_abbreviation: { companyId: company.id, abbreviation: 'ML' } },
      update: {},
      create: { companyId: company.id, name: 'Mililiter', abbreviation: 'ML', conversionFactor: 1 },
    }),
    prisma.unitOfMeasure.upsert({
      where: { companyId_abbreviation: { companyId: company.id, abbreviation: 'PCS' } },
      update: {},
      create: { companyId: company.id, name: 'Pieces', abbreviation: 'PCS', conversionFactor: 1 },
    }),
  ]);

  const [uomGr, uomMl, uomPcs] = uoms;

  // 6. Kategori Produk
  const catKopi = await prisma.category.upsert({
    where: { id: 'cat-kopi-01' },
    update: {},
    create: { id: 'cat-kopi-01', companyId: company.id, name: 'Minuman Kopi', sortOrder: 1 },
  });
  const catNonKopi = await prisma.category.upsert({
    where: { id: 'cat-nonkopi-01' },
    update: {},
    create: { id: 'cat-nonkopi-01', companyId: company.id, name: 'Minuman Non-Kopi', sortOrder: 2 },
  });
  const catSnack = await prisma.category.upsert({
    where: { id: 'cat-snack-01' },
    update: {},
    create: { id: 'cat-snack-01', companyId: company.id, name: 'Makanan & Snack', sortOrder: 3 },
  });
  const catBahan = await prisma.category.upsert({
    where: { id: 'cat-bahan-01' },
    update: {},
    create: { id: 'cat-bahan-01', companyId: company.id, name: 'Bahan Baku Mentah', sortOrder: 4 },
  });

  // 7. Bahan Baku Raw Materials (Match Sheet BPSJ)
  const bijiKopi = await prisma.product.upsert({
    where: { companyId_sku: { companyId: company.id, sku: 'RAW-KOP-01' } },
    update: {},
    create: {
      companyId: company.id,
      categoryId: catBahan.id,
      sku: 'RAW-KOP-01',
      name: 'Biji Kopi Espresso Blend',
      productType: ProductType.INGREDIENT,
      baseUomId: uomGr.id,
      cogs: 220, // Rp 220/gram
    },
  });

  const freshMilk = await prisma.product.upsert({
    where: { companyId_sku: { companyId: company.id, sku: '00M.STXXX.X0000010XX' } },
    update: {},
    create: {
      companyId: company.id,
      categoryId: catBahan.id,
      sku: '00M.STXXX.X0000010XX',
      barcode: '00M.STXXX.X0000010XX',
      name: 'FRESH MILK PLAIN 946ML - DIAMOND',
      productType: ProductType.INGREDIENT,
      baseUomId: uomMl.id,
      cogs: 22, // Rp 22/ml
    },
  });

  const cupPet = await prisma.product.upsert({
    where: { companyId_sku: { companyId: company.id, sku: '00M.STXXX.X0000144XX' } },
    update: {},
    create: {
      companyId: company.id,
      categoryId: catBahan.id,
      sku: '00M.STXXX.X0000144XX',
      barcode: '00M.STXXX.X0000144XX',
      name: 'CUP PET 12 OZ KACC - STARINDO',
      productType: ProductType.INGREDIENT,
      baseUomId: uomPcs.id,
      cogs: 450,
    },
  });

  // 8. Produk Jadi & Resep
  const esKopiMantan = await prisma.product.upsert({
    where: { companyId_sku: { companyId: company.id, sku: 'MENU-KOP-01' } },
    update: {},
    create: {
      companyId: company.id,
      categoryId: catKopi.id,
      sku: 'MENU-KOP-01',
      name: 'Es Kopi Kenangan Mantan',
      productType: ProductType.SELLABLE,
      baseUomId: uomPcs.id,
      sellPrice: 19000,
      cogs: 7290,
      hasRecipe: true,
    },
  });

  const rotiSrikaya = await prisma.product.upsert({
    where: { companyId_sku: { companyId: company.id, sku: 'MENU-SNK-01' } },
    update: {},
    create: {
      companyId: company.id,
      categoryId: catSnack.id,
      sku: 'MENU-SNK-01',
      name: 'Roti Bakar Srikaya Butter',
      productType: ProductType.SELLABLE,
      baseUomId: uomPcs.id,
      sellPrice: 18000,
      cogs: 6000,
    },
  });

  // Resep Es Kopi Mantan
  const recipe = await prisma.recipe.upsert({
    where: { productId: esKopiMantan.id },
    update: {},
    create: {
      companyId: company.id,
      productId: esKopiMantan.id,
      yieldQty: 1,
      items: {
        create: [
          { ingredientProductId: bijiKopi.id, qty: 18, uomId: uomGr.id }, // 18 gr espresso
          { ingredientProductId: freshMilk.id, qty: 150, uomId: uomMl.id }, // 150 ml susu
          { ingredientProductId: cupPet.id, qty: 1, uomId: uomPcs.id }, // 1 pcs cup
        ],
      },
    },
  });

  // 9. Stok Awal
  await prisma.stockBalance.upsert({
    where: { inventoryLocationId_productId: { inventoryLocationId: locJkt.id, productId: bijiKopi.id } },
    update: { quantity: 15000 },
    create: { inventoryLocationId: locJkt.id, productId: bijiKopi.id, quantity: 15000, averageCost: 220 },
  });

  await prisma.stockBalance.upsert({
    where: { inventoryLocationId_productId: { inventoryLocationId: locJkt.id, productId: freshMilk.id } },
    update: { quantity: 50000 },
    create: { inventoryLocationId: locJkt.id, productId: freshMilk.id, quantity: 50000, averageCost: 22 },
  });

  // 10. Voucher & Promosi
  const promo = await prisma.promotion.upsert({
    where: { id: 'promo-hemat10' },
    update: {},
    create: {
      id: 'promo-hemat10',
      companyId: company.id,
      name: 'Diskon 10% Semua Menu',
      promoType: PromoType.PERCENTAGE,
      value: 10,
      priority: 1,
      isActive: true,
      vouchers: {
        create: {
          companyId: company.id,
          code: 'HEMAT10',
          maxUses: 500,
          usedCount: 12,
          isActive: true,
        },
      },
    },
  });

  // 11. Members
  await prisma.member.upsert({
    where: { companyId_phone: { companyId: company.id, phone: '081234567890' } },
    update: { totalPoints: 15, totalStamps: 4 },
    create: {
      companyId: company.id,
      name: 'Rudi Hartono',
      phone: '081234567890',
      currentTier: 'Gold',
      totalSpend: 3850000,
      totalPoints: 15,
      totalStamps: 4,
    },
  });

  // 12. Shift Buka Awal untuk Kasir Budi Santoso
  const activeShift = await prisma.shift.findFirst({
    where: { outletId: outletJkt.id, status: ShiftStatus.OPEN },
  });

  if (!activeShift) {
    await prisma.shift.create({
      data: {
        outletId: outletJkt.id,
        cashierUserId: cashier.id,
        status: ShiftStatus.OPEN,
        openingCash: 200000,
      },
    });
    console.log('Shift Pagi dibuka otomatis untuk kasir Budi Santoso (Modal Awal: Rp 200.000).');
  }

  console.log('--- Master Data Berhasil Diseding Lengkap! ---');
}

if (import.meta.url.endsWith(process.argv[1])) {
  seedAll()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
