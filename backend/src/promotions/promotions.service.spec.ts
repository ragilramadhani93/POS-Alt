import { describe, it, expect, vi } from 'vitest';
import { PromotionsService } from './promotions.service.js';
import { PromoType } from '@prisma/client';

describe('PromotionsService Engine & Stacking Rules', () => {
  it('harus menghitung diskon BOGO (Buy 2 Get 1) dan Min Spend secara deterministik', async () => {
    const mockPromos = [
      {
        id: 'promo-bogo',
        name: 'Buy 2 Get 1 Free Es Kopi',
        promoType: PromoType.BUY_X_GET_Y,
        priority: 10,
        isStackable: true,
        rules: {
          buyProductId: 'prod-kopi',
          buyQty: 2,
          getProductId: 'prod-kopi',
          getQty: 1,
          freeDiscountPct: 100,
        },
      },
      {
        id: 'promo-min-spend',
        name: 'Diskon Belanja Rp 10.000',
        promoType: PromoType.MIN_SPEND,
        priority: 5,
        isStackable: true,
        minTransaction: 50000,
        discountAmount: 10000,
      },
    ];

    const mockPrisma: any = {
      promotion: {
        findMany: vi.fn().mockResolvedValue(mockPromos),
      },
      member: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };

    const service = new PromotionsService(mockPrisma);

    // Kasir input 3 Es Kopi (@Rp 20.000) = Subtotal Rp 60.000
    const result = await service.evaluatePromotions({
      outletId: 'outlet-1',
      companyId: 'company-1',
      items: [
        {
          productId: 'prod-kopi',
          qty: 3,
          unitPrice: 20000,
          subtotal: 60000,
        },
      ],
    });

    // 1. BOGO: Beli 2 gratis 1 -> diskon Rp 20.000
    // 2. Min Spend: Subtotal Rp 60.000 >= Rp 50.000 -> diskon Rp 10.000
    // Total diskon yang di-stack = Rp 30.000
    expect(result.rawSubtotal).toBe(60000);
    expect(result.finalDiscount).toBe(30000);
    expect(result.finalSubtotal).toBe(30000);
    expect(result.appliedDiscounts.length).toBe(2);
  });
});
