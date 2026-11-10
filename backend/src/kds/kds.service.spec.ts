import { describe, it, expect, vi } from 'vitest';
import { KdsService } from './kds.service.js';

describe('KdsService Station Dispatching', () => {
  it('harus memisahkan pesanan Bar (minuman) dan Kitchen (makanan) serta menghitung status antrian', async () => {
    const mockPrisma: any = {
      transaction: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'trx-kds-1',
            transactionNumber: 'TRX-KDS-001',
            orderType: 'DINE_IN',
            tableNumber: '12',
            createdAt: new Date(),
            items: [
              {
                id: 'item-1',
                name: 'Kopi Susu Gula Aren',
                qty: 2,
                product: { category: { name: 'Minuman Kopi' } },
              },
              {
                id: 'item-2',
                name: 'Croissant Butter Gurih',
                qty: 1,
                product: { category: { name: 'Pastry' } },
              },
            ],
          },
        ]),
      },
    };

    const service = new KdsService(mockPrisma);

    // Filter BAR: hanya item-1
    const barQueue = await service.getStationQueue('outlet-1', 'BAR');
    expect(barQueue.length).toBe(1);
    expect(barQueue[0].items.length).toBe(1);
    expect(barQueue[0].items[0].name).toBe('Kopi Susu Gula Aren');
    expect(barQueue[0].items[0].station).toBe('BAR');

    // Filter KITCHEN: hanya item-2
    const kitchenQueue = await service.getStationQueue('outlet-1', 'KITCHEN');
    expect(kitchenQueue.length).toBe(1);
    expect(kitchenQueue[0].items.length).toBe(1);
    expect(kitchenQueue[0].items[0].name).toBe('Croissant Butter Gurih');
    expect(kitchenQueue[0].items[0].station).toBe('KITCHEN');

    // Update item status menjadi PREPARING
    service.updateItemStatus('item-1', 'PREPARING');
    const updatedBar = await service.getStationQueue('outlet-1', 'BAR');
    expect(updatedBar[0].items[0].status).toBe('PREPARING');
    expect(updatedBar[0].overallStatus).toBe('PREPARING');
  });
});
