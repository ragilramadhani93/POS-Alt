import { describe, it, expect, vi } from 'vitest';
import { TransactionsService } from './transactions.service.js';

describe('TransactionsService Financial Calculation', () => {
  it('harus menghitung pajak 11% inklusif dan total belanja dengan tepat', async () => {
    const mockPrisma: any = {
      outlet: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'outlet-1',
          code: 'OUT-01',
          taxRate: 0.11,
          serviceChargeRate: 0,
          isTaxInclusive: true,
          roundingMode: 'none',
        }),
      },
      shift: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'shift-1',
          status: 'OPEN',
        }),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'prod-1',
            name: 'Es Kopi Susu',
            sellPrice: 20000,
            cogs: 8000,
            variants: [],
            outletConfigs: [],
          },
        ]),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => {
        return callback({
          transaction: {
            create: vi.fn().mockImplementation(({ data }) => data),
          },
          member: {
            update: vi.fn(),
          },
          recipe: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
        });
      }),
    };

    const mockInventoryService: any = {
      getOrCreateOutletLocation: vi.fn().mockResolvedValue({ id: 'loc-1' }),
      mutateStock: vi.fn().mockResolvedValue({}),
    };

    const mockPromotionsService: any = {
      evaluatePromotions: vi.fn().mockResolvedValue({
        rawSubtotal: 40000,
        finalDiscount: 0,
        finalSubtotal: 40000,
        appliedDiscounts: [],
      }),
    };

    const mockMembersService: any = {
      redeemPoints: vi.fn().mockResolvedValue({}),
      processLoyaltyAfterPayment: vi.fn().mockResolvedValue({}),
    };

    const service = new TransactionsService(mockPrisma, mockInventoryService, mockPromotionsService, mockMembersService);
    const result = await service.processTransaction(
      {
        outletId: 'outlet-1',
        shiftId: 'shift-1',
        orderType: 'DINE_IN',
        items: [
          {
            productId: 'prod-1',
            qty: 2,
          },
        ],
        payments: [
          {
            paymentMethod: 'CASH',
            amount: 40000,
          },
        ],
      },
      'cashier-1',
      'company-1',
    );

    expect(result.subtotal).toBe(40000);
    expect(result.totalAmount).toBe(40000);
    // Pajak inklusif 11%: 40.000 - (40.000 / 1.11) ~= 3963.96
    expect(Math.round(result.taxAmount)).toBe(3964);
  });

  it('harus mengabaikan pajak (taxAmount = 0) jika pajak disetting tidak aktif', async () => {
    const mockPrisma: any = {
      outlet: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'outlet-1',
          code: 'OUT-01',
          taxRate: 0.11,
          serviceChargeRate: 0,
          isTaxEnabled: false, // Pajak dinonaktifkan
          isTaxInclusive: false,
          roundingMode: 'none',
        }),
      },
      shift: {
        findUnique: vi.fn().mockResolvedValue({ id: 'shift-1', status: 'OPEN' }),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'prod-1', name: 'Item', sellPrice: 20000, cogs: 8000, variants: [], outletConfigs: [] },
        ]),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => {
        return callback({
          transaction: { create: vi.fn().mockImplementation(({ data }) => data) },
          member: { update: vi.fn() },
          recipe: { findUnique: vi.fn().mockResolvedValue(null) },
        });
      }),
    };

    const mockInventoryService: any = {
      getOrCreateOutletLocation: vi.fn().mockResolvedValue({ id: 'loc-1' }),
      mutateStock: vi.fn().mockResolvedValue({}),
    };

    const mockPromotionsService: any = {
      evaluatePromotions: vi.fn().mockResolvedValue({
        rawSubtotal: 20000,
        finalDiscount: 0,
        finalSubtotal: 20000,
        appliedDiscounts: [],
      }),
    };

    const mockMembersService: any = {
      redeemPoints: vi.fn().mockResolvedValue({}),
      processLoyaltyAfterPayment: vi.fn().mockResolvedValue({}),
    };

    const service = new TransactionsService(mockPrisma, mockInventoryService, mockPromotionsService, mockMembersService);
    const result = await service.processTransaction(
      {
        outletId: 'outlet-1',
        shiftId: 'shift-1',
        orderType: 'DINE_IN',
        items: [{ productId: 'prod-1', qty: 1 }],
        payments: [{ paymentMethod: 'CASH', amount: 20000 }],
      },
      'cashier-1',
      'company-1',
    );

    expect(result.subtotal).toBe(20000);
    expect(result.taxAmount).toBe(0);
    expect(result.totalAmount).toBe(20000);
  });

  it('harus memvalidasi pembayaran kurang dan melempar error', async () => {
    const mockPrisma: any = {
      outlet: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'outlet-1',
          code: 'OUT-01',
          taxRate: 0,
          serviceChargeRate: 0,
          isTaxInclusive: false,
          roundingMode: 'none',
        }),
      },
      shift: {
        findUnique: vi.fn().mockResolvedValue({ id: 'shift-1', status: 'OPEN' }),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'prod-1', name: 'Item', sellPrice: 25000, cogs: 10000, variants: [], outletConfigs: [] },
        ]),
      },
    };

    const mockInventoryService: any = {
      getOrCreateOutletLocation: vi.fn().mockResolvedValue({ id: 'loc-1' }),
      mutateStock: vi.fn().mockResolvedValue({}),
    };

    const mockPromotionsService: any = {
      evaluatePromotions: vi.fn().mockResolvedValue({
        rawSubtotal: 40000,
        finalDiscount: 0,
        finalSubtotal: 40000,
        appliedDiscounts: [],
      }),
    };

    const mockMembersService: any = {
      redeemPoints: vi.fn().mockResolvedValue({}),
      processLoyaltyAfterPayment: vi.fn().mockResolvedValue({}),
    };

    const service = new TransactionsService(mockPrisma, mockInventoryService, mockPromotionsService, mockMembersService);
    await expect(
      service.processTransaction(
        {
          outletId: 'outlet-1',
          shiftId: 'shift-1',
          orderType: 'DINE_IN',
          items: [{ productId: 'prod-1', qty: 1 }],
          payments: [{ paymentMethod: 'CASH', amount: 20000 }], // Kurang Rp 5.000
        },
        'cashier-1',
        'company-1',
      ),
    ).rejects.toThrow('Nominal pembayaran kurang');
  });

  it('harus menghasilkan string payload QRIS standar dengan masa berlaku 15 menit', () => {
    const service = new TransactionsService({} as any, {} as any, {} as any, {} as any);
    const qris = service.generateQris(75000, 'CKA-J021');

    expect(qris.amount).toBe(75000);
    expect(qris.qrisString).toContain('000201');
    expect(qris.qrisString).toContain('75000');
    expect(qris.status).toBe('PENDING');
    expect(qris.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('harus sync transaksi offline secara idempoten jika transaksi sudah pernah disimpan', async () => {
    const mockPrisma: any = {
      transaction: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'trx-exist-1',
          transactionNumber: 'TRX-EXIST',
        }),
      },
    };
    const service = new TransactionsService(mockPrisma, {} as any, {} as any, {} as any);

    const result = await service.syncOfflineTransactions(
      [
        {
          clientTransactionId: 'offline-uuid-999',
          outletId: 'outlet-1',
          shiftId: 'shift-1',
          orderType: 'DINE_IN',
          items: [],
          payments: [],
        },
      ],
      'cashier-1',
      'company-1',
    );

    expect(result.total).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.transactions[0].status).toBe('ALREADY_SYNCED');
  });
});
