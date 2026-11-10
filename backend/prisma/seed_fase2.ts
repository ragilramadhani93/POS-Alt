import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Master Data Fase 2 (Inventory, Recipe, Semi-Finished)...');

  const company = await prisma.company.findFirst();
  if (!company) throw new Error('Company not found');

  const outletJkt = await prisma.outlet.findFirst({ where: { code: 'CKA-J021' } });
  if (!outletJkt) throw new Error('Outlet not found');

  // 1. Lokasi Gudang
  const storeLoc = await prisma.inventoryLocation.upsert({
    where: { id: 'loc-jkt-01' },
    update: {},
    create: {
      id: 'loc-jkt-01',
      companyId: company.id,
      outletId: outletJkt.id,
      name: 'Gudang Utama St. Tanah Abang',
      locationType: 'STORE',
    },
  });

  // 2. Satuan UoM Dasar & Turunan
  const uomGram = await prisma.unitOfMeasure.create({
    data: { companyId: company.id, name: 'Gram', abbreviation: 'GR', conversionFactor: 1 },
  });
  const uomMl = await prisma.unitOfMeasure.create({
    data: { companyId: company.id, name: 'Mililiter', abbreviation: 'ML', conversionFactor: 1 },
  });
  const uomPcs = await prisma.unitOfMeasure.create({
    data: { companyId: company.id, name: 'Pieces', abbreviation: 'PCS', conversionFactor: 1 },
  });

  // 3. Bahan Baku Murni (Ingredients)
  const bijiKopi = await prisma.product.create({
    data: {
      companyId: company.id,
      sku: 'ING-KOP-01',
      name: 'Biji Kopi Espresso Blend 100% Arabica/Robusta',
      productType: 'INGREDIENT',
      baseUomId: uomGram.id,
      sellPrice: 0,
      cogs: 220, // Rp 220 per gram (Rp 220.000 / kg)
      isTrackStock: true,
    },
  });

  const freshMilk = await prisma.product.create({
    data: {
      companyId: company.id,
      sku: '00M.STXXX.X0000010XX', // Match kode barang BPSJ
      barcode: '00M.STXXX.X0000010XX',
      name: 'FRESH MILK PLAIN 946ML - DIAMOND',
      productType: 'INGREDIENT',
      baseUomId: uomMl.id,
      sellPrice: 0,
      cogs: 22, // Rp 22 per ml (~Rp 21.000 per kotak)
      isTrackStock: true,
    },
  });

  const gulaArenCair = await prisma.product.create({
    data: {
      companyId: company.id,
      sku: 'ING-AREN-01',
      name: 'Gula Aren Organik Cair Asli',
      productType: 'INGREDIENT',
      baseUomId: uomMl.id,
      sellPrice: 0,
      cogs: 35, // Rp 35 per ml
      isTrackStock: true,
    },
  });

  const cupPet = await prisma.product.create({
    data: {
      companyId: company.id,
      sku: '00M.STXXX.X0000144XX', // Match kode barang BPSJ
      barcode: '00M.STXXX.X0000144XX',
      name: 'CUP PET 12 OZ KACC - STARINDO',
      productType: 'INGREDIENT',
      baseUomId: uomPcs.id,
      sellPrice: 0,
      cogs: 450, // Rp 450 per pcs
      isTrackStock: true,
    },
  });

  // 4. Semi-Finished Product (Base Sirup Aren racikan)
  const baseArenRacik = await prisma.product.create({
    data: {
      companyId: company.id,
      sku: 'SFP-AREN-BASE',
      name: 'Base Sirup Gula Aren Spesial (Batch Racik)',
      productType: 'SEMI_FINISHED',
      baseUomId: uomMl.id,
      sellPrice: 0,
      cogs: 40,
      isTrackStock: true,
      hasRecipe: true,
    },
  });

  // Resep Produksi Semi-Finished: 1000 ml Base Aren = 900 ml Gula Aren + 100 ml Air panas
  await prisma.recipe.create({
    data: {
      companyId: company.id,
      productId: baseArenRacik.id,
      yieldQty: 1000,
      yieldUomId: uomMl.id,
      notes: 'Yield 1 Liter base aren kental',
      items: {
        create: [
          { ingredientProductId: gulaArenCair.id, qty: 900, uomId: uomMl.id, wastagePct: 2 },
        ],
      },
    },
  });

  // 5. Resep Produk Jual (BOM Bertingkat):
  // 1 Cup Es Kopi Susu = 1 Cup PET + 18gr Biji Kopi + 120ml Susu + 25ml Base Aren (Semi-finished)
  const esKopi = await prisma.product.findFirst({ where: { sku: 'KOP-001' } });
  if (esKopi) {
    await prisma.recipe.create({
      data: {
        companyId: company.id,
        productId: esKopi.id,
        yieldQty: 1,
        yieldUomId: uomPcs.id,
        notes: 'Resep standar Es Kopi Susu Mantan',
        items: {
          create: [
            { ingredientProductId: cupPet.id, qty: 1, uomId: uomPcs.id },
            { ingredientProductId: bijiKopi.id, qty: 18, uomId: uomGram.id },
            { ingredientProductId: freshMilk.id, qty: 120, uomId: uomMl.id },
            { ingredientProductId: baseArenRacik.id, qty: 25, uomId: uomMl.id }, // Pakai semi-finished
          ],
        },
      },
    });
  }

  // 6. Inisialisasi Saldo Stok Awal di Gudang Jakarta
  const initialStocks = [
    { prodId: bijiKopi.id, qty: 5000, cost: 220 }, // 5 kg
    { prodId: freshMilk.id, qty: 36000, cost: 22 }, // ~38 kotak
    { prodId: gulaArenCair.id, qty: 10000, cost: 35 },
    { prodId: cupPet.id, qty: 1000, cost: 450 },
    { prodId: baseArenRacik.id, qty: 2000, cost: 40 }, // 2 liter
  ];

  for (const s of initialStocks) {
    await prisma.stockBalance.create({
      data: {
        inventoryLocationId: storeLoc.id,
        productId: s.prodId,
        qty: s.qty,
        avgCost: s.cost,
      },
    });
  }

  console.log('Seeding Fase 2 Sukses: UoM, Resep Bertingkat, Semi-Finished, dan Stok Awal Terpasang!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
