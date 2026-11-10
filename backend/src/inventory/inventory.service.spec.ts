import { describe, it, expect, vi } from 'vitest';
import { InventoryService } from './inventory.service.js';
import { MovementType, ReferenceType, OpnameStatus } from '@prisma/client';

describe('InventoryService - Stock Balance, Moving Average & Opname', () => {
  it('harus menghitung penyesuaian selisih fisik opname dan mengupdate stok', async () => {
    const mockPrisma: any = {
      inventoryLocation: {
        findFirst: vi.fn().mockResolvedValue({ id: 'loc-01' }),
      },
      $transaction: vi.fn().mockImplementation(async (cb) => {
        return cb({
          stockOpname: {
            create: vi.fn().mockResolvedValue({
              id: 'opname-123',
              status: OpnameStatus.APPROVED,
              completedAt: new Date(),
            }),
          },
          stockOpnameItem: {
            create: vi.fn().mockImplementation(({ data }) => data),
          },
          stockBalance: {
            findUnique: vi.fn().mockResolvedValue({
              qty: 100, // Stok sistem = 100
              avgCost: 5000,
            }),
            upsert: vi.fn(),
          },
          stockMovement: {
            create: vi.fn(),
          },
        });
      }),
    };

    const service = new InventoryService(mockPrisma);
    // Mock mutateStock agar tidak perlu nested run
    vi.spyOn(service, 'mutateStock').mockResolvedValue({} as any);

    const result = await service.executeStockOpname(
      {
        outletId: 'outlet-01',
        notes: 'Opname Akhir Shift',
        items: [
          {
            productId: 'prod-01',
            countedQty: 95, // Fisik 95 (Selisih -5)
          },
        ],
      },
      'user-spv',
      'company-01',
    );

    expect(result.status).toBe(OpnameStatus.APPROVED);
    expect(result.itemsProcessed).toBe(1);
    expect(result.items[0].systemQty).toBe(100);
    expect(result.items[0].countedQty).toBe(95);
    expect(result.items[0].discrepancy).toBe(-5);
    expect(service.mutateStock).toHaveBeenCalledWith(
      'loc-01',
      'prod-01',
      -5,
      MovementType.ADJUSTMENT,
      ReferenceType.OPNAME,
      'opname-123',
      5000,
      expect.stringContaining('Opname Selisih: -5'),
      undefined,
      undefined,
      expect.anything(),
    );
  });
});
