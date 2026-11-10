import { describe, it, expect, vi } from 'vitest';
import { RecipesService } from './recipes.service.js';

describe('RecipesService & Cost Roll-up (BOM Calculation)', () => {
  it('harus menghitung HPP (COGS) produk secara tepat dari komponen bahan baku', async () => {
    // 1 Cup Es Kopi:
    // - 1 Cup Pet @Rp 450
    // - 18 gr Biji Kopi @Rp 220 = Rp 3.960
    // - 120 ml Susu @Rp 22 = Rp 2.640
    // - 25 ml Base Aren @Rp 40 = Rp 1.000
    // Total teoritis = 450 + 3960 + 2640 + 1000 = Rp 8.050 / cup

    const mockPrisma: any = {
      recipe: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'recipe-kopi-01',
          yieldQty: 1,
          items: [
            { ingredient: { cogs: 450 }, qty: 1, wastagePct: 0 },
            { ingredient: { cogs: 220 }, qty: 18, wastagePct: 0 },
            { ingredient: { cogs: 22 }, qty: 120, wastagePct: 0 },
            { ingredient: { cogs: 40 }, qty: 25, wastagePct: 0 },
          ],
        }),
      },
    };

    const mockInventoryService: any = {};
    const service = new RecipesService(mockPrisma, mockInventoryService);

    const calculatedHpp = await service.calculateRecipeCost('recipe-kopi-01');
    expect(calculatedHpp).toBe(8050);
  });
});
