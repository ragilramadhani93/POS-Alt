import { describe, it, expect, vi } from 'vitest';
import { WasteService } from './waste.service.js';
import { MovementType, ReferenceType, WasteType } from '@prisma/client';

describe('WasteService Auto-Explode Recipe Breakdown', () => {
  it('harus memecah waste 1 Cup Es Kopi menjadi pengurangan stok bahan baku (Raw Material & Sub-recipe)', async () => {
    // 1 Cup Es Kopi Susu terdiri dari:
    // - 1 Cup Pet (Raw Material)
    // - 18 gr Biji Kopi (Raw Material)
    // - 25 ml Base Aren (Semi-Finished yang punya resep: 900ml Gula Aren / 1000ml yield)
    // Saat waste 2 Cup Es Kopi diinput:
    // - Cup Pet terpotong 2 Pcs
    // - Biji Kopi terpotong 36 gr
    // - Gula Aren Cair terpotong (900/1000) * 25 * 2 = 45 ml

    const mockProductWithRecipe: any = {
      id: 'prod-kopi',
      name: 'Es Kopi Kenangan Mantan',
      cogs: 8050,
      baseUomId: 'uom-pcs',
      asRecipe: {
        yieldQty: 1,
        items: [
          {
            ingredientProductId: 'ing-cup',
            qty: 1,
            ingredient: { name: 'Cup PET', cogs: 450, asRecipe: null },
          },
          {
            ingredientProductId: 'ing-biji',
            qty: 18,
            ingredient: { name: 'Biji Kopi', cogs: 220, asRecipe: null },
          },
          {
            ingredientProductId: 'sfp-aren',
            qty: 25,
            ingredient: {
              name: 'Base Aren',
              cogs: 40,
              asRecipe: {
                yieldQty: 1000,
                items: [
                  {
                    ingredientProductId: 'ing-aren-raw',
                    qty: 900,
                  },
                ],
              },
            },
          },
        ],
      },
    };

    const mockPrisma: any = {
      product: {
        findUnique: vi.fn().mockResolvedValue(mockProductWithRecipe),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => {
        return callback({
          wasteRecord: {
            create: vi.fn().mockImplementation(({ data }) => data),
          },
        });
      }),
    };

    const mockMutateStock = vi.fn().mockResolvedValue({});
    const mockInventoryService: any = {
      getOrCreateOutletLocation: vi.fn().mockResolvedValue({ id: 'loc-1' }),
      mutateStock: mockMutateStock,
    };

    const service = new WasteService(mockPrisma, mockInventoryService);
    const result = await service.recordWaste(
      'outlet-1',
      'company-1',
      'user-1',
      'prod-kopi',
      2, // 2 Cup terbuang / tumpah
      'Tumpah tersenggol pelanggan',
      WasteType.SPOILAGE,
    );

    // Verifikasi pemotongan stok bahan baku
    expect(mockMutateStock).toHaveBeenCalledTimes(3);

    // 1. Cup PET (-2 pcs)
    expect(mockMutateStock).toHaveBeenCalledWith(
      'loc-1',
      'ing-cup',
      -2,
      MovementType.OUT,
      ReferenceType.WASTE,
      undefined,
      450,
      expect.stringContaining('Es Kopi Kenangan Mantan'),
      undefined,
      undefined,
      expect.anything(),
    );

    // 2. Biji Kopi (-36 gr)
    expect(mockMutateStock).toHaveBeenCalledWith(
      'loc-1',
      'ing-biji',
      -36,
      MovementType.OUT,
      ReferenceType.WASTE,
      undefined,
      220,
      expect.stringContaining('Es Kopi Kenangan Mantan'),
      undefined,
      undefined,
      expect.anything(),
    );

    // 3. Raw Material dari Sub-Recipe Base Aren: (900/1000) * 25 * 2 = -45 ml
    expect(mockMutateStock).toHaveBeenCalledWith(
      'loc-1',
      'ing-aren-raw',
      -45,
      MovementType.OUT,
      ReferenceType.WASTE,
      undefined,
      0,
      expect.stringContaining('Base Aren'),
      undefined,
      undefined,
      expect.anything(),
    );

    expect(result.qty).toBe(2);
  });
});
