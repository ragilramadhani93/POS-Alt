import { describe, it, expect, vi } from 'vitest';
import { ReceiptService } from './receipt.service.js';

describe('ReceiptService', () => {
  it('harus memformat struk 58mm dengan header, item, pajak, diskon, dan loyalty lengkap', async () => {
    const mockPrisma: any = {
      transaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'trx-123',
          transactionNumber: 'TRX-CKA-001',
          createdAt: new Date('2026-11-10T10:30:00Z'),
          orderType: 'DINE_IN',
          tableNumber: 'Meja 05',
          subtotal: 50000,
          discountAmount: 5000,
          taxAmount: 4950,
          serviceChargeAmount: 0,
          roundingAmount: 0,
          totalAmount: 49950,
          outlet: {
            name: 'St. Tanah Abang',
            address: 'Jl. Jatibaru Raya No. 1',
            phone: '08123456789',
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
              modifiers: [{ name: 'Extra Shot Espresso', priceAdd: 5000 }],
              notes: 'Less ice',
            },
            {
              name: 'Roti Bakar Srikaya',
              qty: 1,
              unitPrice: 10000,
              subtotal: 10000,
            },
          ],
          payments: [
            {
              paymentMethod: 'CASH',
              amount: 50000,
            },
          ],
          appliedPromos: [
            {
              discountAmount: 5000,
              promotion: { name: 'Promo Diskon 10%' },
              voucher: null,
            },
          ],
        }),
      },
    };

    const service = new ReceiptService(mockPrisma);
    const receipt = await service.generateReceipt('trx-123', { paperWidth: '58mm' });

    expect(receipt.columns).toBe(32);
    expect(receipt.rawText).toContain('KOPI KENANGAN');
    expect(receipt.rawText).toContain('St. Tanah Abang');
    expect(receipt.rawText).toContain('TRX-CKA-001');
    expect(receipt.rawText).toContain('Meja 05');
    expect(receipt.rawText).toContain('Es Kopi Kenangan Mantan');
    expect(receipt.rawText).toContain('Extra Shot Espresso');
    expect(receipt.rawText).toContain('Total Diskon');
    expect(receipt.rawText).toContain('PPN 11%');
    expect(receipt.rawText).toContain('TOTAL TAGIHAN');
    expect(receipt.rawText).toContain('Rudi Hartono');
    expect(receipt.rawText).toContain('Gold');
  });
});
