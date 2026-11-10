import { describe, it, expect, vi } from 'vitest';
import { TransactionsService } from './transactions/transactions.service.js';
import { ReceiptService } from './transactions/receipt.service.js';
import { KdsService } from './kds/kds.service.js';
import { ReportsService } from './reports/reports.service.js';

describe('End-to-End System Smoke Test', () => {
  it('harus memvalidasi siklus penuh transaksi, stok resep, tiket KDS, struk 58mm, dan laporan P&L', async () => {
    // 1. Mock DB Setup
    const mockPrisma: any = {
      outlet: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'outlet-jkt',
          code: 'CKA-J021',
          name: 'St. Tanah Abang',
          address: 'Jl. Jatibaru Raya No. 1',
          phone: '0812-3456-7890',
          taxRate: 0.11,
          isTaxEnabled: true,
          isTaxInclusive: false,
          serviceChargeRate: 0,
          company: { name: 'Kopi Kenangan' },
        }),
      },
      shift: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'shift-101',
          status: 'OPEN',
        }),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'prod-kopi',
            name: 'Es Kopi Kenangan Mantan',
            sellPrice: 20000,
            cogs: 6500,
            hasRecipe: true,
            category: { name: 'Minuman Kopi' },
            variants: [],
            outletConfigs: [],
          },
          {
            id: 'prod-roti',
            name: 'Roti Bakar Srikaya',
            sellPrice: 18000,
            cogs: 7000,
            hasRecipe: false,
            category: { name: 'Makanan' },
            variants: [],
            outletConfigs: [],
          },
        ]),
      },
      $transaction: vi.fn().mockImplementation(async (cb) => {
        return cb({
          transaction: {
            create: vi.fn().mockImplementation(({ data }) => ({
              id: 'trx-smoke-1',
              ...data,
              items: [
                {
                  id: 'item-smoke-1',
                  name: 'Es Kopi Kenangan Mantan',
                  qty: 2,
                  unitPrice: 20000,
                  unitCogs: 6500,
                  subtotal: 40000,
                  product: { category: { name: 'Minuman Kopi' } },
                },
                {
                  id: 'item-smoke-2',
                  name: 'Roti Bakar Srikaya',
                  qty: 1,
                  unitPrice: 18000,
                  unitCogs: 7000,
                  subtotal: 18000,
                  product: { category: { name: 'Makanan' } },
                },
              ],
              payments: [
                { paymentMethod: 'CASH', amount: 30000 },
                { paymentMethod: 'QRIS', amount: 34380, referenceNumber: 'QRIS-REF-99' },
              ],
              outlet: {
                name: 'St. Tanah Abang',
                address: 'Jl. Jatibaru Raya No. 1',
                phone: '0812-3456-7890',
                isTaxInclusive: false,
                company: { name: 'Kopi Kenangan' },
              },
              cashier: { name: 'Budi Santoso' },
              member: {
                name: 'Rudi Hartono',
                currentTier: 'Gold',
                totalPoints: 15,
                totalStamps: 4,
              },
              appliedPromos: [],
            })),
          },
          voucher: { updateMany: vi.fn() },
          member: { update: vi.fn() },
          recipe: { findUnique: vi.fn().mockResolvedValue(null) },
        });
      }),
      transaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'trx-smoke-1',
          transactionNumber: 'TRX-CKA-SMOKE-01',
          createdAt: new Date(),
          orderType: 'DINE_IN',
          tableNumber: 'Meja 02',
          subtotal: 58000,
          discountAmount: 0,
          taxAmount: 6380,
          serviceChargeAmount: 0,
          roundingAmount: 0,
          totalAmount: 64380,
          outlet: {
            name: 'St. Tanah Abang',
            address: 'Jl. Jatibaru Raya No. 1',
            phone: '0812-3456-7890',
            isTaxInclusive: false,
            company: { name: 'Kopi Kenangan' },
          },
          cashier: { name: 'Budi Santoso' },
          member: {
            name: 'Rudi Hartono',
            currentTier: 'Gold',
            totalPoints: 15,
            totalStamps: 4,
          },
          items: [
            {
              name: 'Es Kopi Kenangan Mantan',
              qty: 2,
              unitPrice: 20000,
              subtotal: 40000,
            },
            {
              name: 'Roti Bakar Srikaya',
              qty: 1,
              unitPrice: 18000,
              subtotal: 18000,
            },
          ],
          payments: [
            { paymentMethod: 'CASH', amount: 30000 },
            { paymentMethod: 'QRIS', amount: 34380 },
          ],
          appliedPromos: [],
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'trx-smoke-1',
            transactionNumber: 'TRX-CKA-SMOKE-01',
            orderType: 'DINE_IN',
            tableNumber: '02',
            createdAt: new Date(),
            items: [
              {
                id: 'item-smoke-1',
                name: 'Es Kopi Kenangan Mantan',
                qty: 2,
                product: { category: { name: 'Minuman Kopi' } },
              },
              {
                id: 'item-smoke-2',
                name: 'Roti Bakar Srikaya',
                qty: 1,
                product: { category: { name: 'Makanan' } },
              },
            ],
          },
        ]),
        aggregate: vi.fn().mockResolvedValue({
          _sum: {
            subtotal: 58000,
            discountAmount: 0,
            taxAmount: 6380,
            serviceChargeAmount: 0,
            totalAmount: 64380,
          },
          _count: { id: 1 },
        }),
      },
      transactionItem: {
        findMany: vi.fn().mockResolvedValue([
          {
            qty: 2,
            unitCogs: 6500,
            subtotal: 40000,
            product: { category: { name: 'Minuman Kopi' } },
          },
          {
            qty: 1,
            unitCogs: 7000,
            subtotal: 18000,
            product: { category: { name: 'Makanan' } },
          },
        ]),
      },
      wasteRecord: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const mockInventoryService: any = {
      getOrCreateOutletLocation: vi.fn().mockResolvedValue({ id: 'loc-1' }),
      mutateStock: vi.fn().mockResolvedValue({}),
    };

    const mockPromotionsService: any = {
      evaluatePromotions: vi.fn().mockResolvedValue({
        rawSubtotal: 58000,
        finalDiscount: 0,
        finalSubtotal: 58000,
        appliedDiscounts: [],
      }),
    };

    const mockMembersService: any = {
      redeemPoints: vi.fn().mockResolvedValue({}),
      processLoyaltyAfterPayment: vi.fn().mockResolvedValue({ pointsEarned: 5, stampsEarned: 1 }),
    };

    // 2. Transaksi Kasir (Split Payment Tunai + QRIS)
    const txService = new TransactionsService(mockPrisma, mockInventoryService, mockPromotionsService, mockMembersService);
    const createdTx = await txService.processTransaction(
      {
        outletId: 'outlet-jkt',
        shiftId: 'shift-101',
        orderType: 'DINE_IN',
        tableNumber: '02',
        memberId: 'member-rudi',
        items: [
          { productId: 'prod-kopi', qty: 2 },
          { productId: 'prod-roti', qty: 1 },
        ],
        payments: [
          { paymentMethod: 'CASH', amount: 30000 },
          { paymentMethod: 'QRIS', amount: 34380 },
        ],
      },
      'cashier-1',
      'company-1',
    );

    // Total: 58.000 + 11% PPN (6.380) = 64.380
    expect(createdTx.subtotal).toBe(58000);
    expect(createdTx.taxAmount).toBe(6380);
    expect(createdTx.totalAmount).toBe(64380);

    // 3. Verifikasi Tiket KDS (Pemisahan Bar vs Kitchen)
    const kdsService = new KdsService(mockPrisma);
    const barQueue = await kdsService.getStationQueue('outlet-jkt', 'BAR');
    const kitchenQueue = await kdsService.getStationQueue('outlet-jkt', 'KITCHEN');

    expect(barQueue.length).toBe(1);
    expect(barQueue[0].items[0].name).toBe('Es Kopi Kenangan Mantan');
    expect(kitchenQueue.length).toBe(1);
    expect(kitchenQueue[0].items[0].name).toBe('Roti Bakar Srikaya');

    // 4. Verifikasi Struk 58mm
    const receiptService = new ReceiptService(mockPrisma);
    const receipt = await receiptService.generateReceipt('trx-smoke-1', { paperWidth: '58mm' });

    expect(receipt.rawText).toContain('St. Tanah Abang');
    expect(receipt.rawText).toContain('Es Kopi Kenangan Mantan');
    expect(receipt.rawText).toContain('PPN 11%');
    expect(receipt.rawText).toContain('Bayar CASH');
    expect(receipt.rawText).toContain('Bayar QRIS');
    expect(receipt.rawText).toContain('Rudi Hartono');

    // 5. Verifikasi Laporan Laba Rugi (P&L)
    const reportsService = new ReportsService(mockPrisma);
    const pl = await reportsService.getProfitAndLoss('outlet-jkt');

    // Net Sales = 58.000
    // COGS = (2 * 6.500) + (1 * 7.000) = 20.000
    // Laba Kotor = 58.000 - 20.000 = 38.000
    expect(pl.revenue.netSales).toBe(58000);
    expect(pl.cogs.totalCogs).toBe(20000);
    expect(pl.grossProfit).toBe(38000);
    expect(pl.grossProfitMargin).toBe(65.52);
  });
});
