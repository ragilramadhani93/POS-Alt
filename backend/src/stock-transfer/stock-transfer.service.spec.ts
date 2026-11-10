import { describe, it, expect, vi } from 'vitest';
import { StockTransferService } from './stock-transfer.service.js';
import { TransferStatus, MovementType, ReferenceType } from '@prisma/client';

describe('StockTransferService End-to-End Flow', () => {
  it('harus memotong stok asal saat ship dan menambah stok tujuan saat receive dengan selisih', async () => {
    const mockTransfer = {
      id: 'trf-1',
      transferNumber: 'TRF-20261110-ABCD',
      fromLocationId: 'loc-origin',
      toLocationId: 'loc-dest',
      status: TransferStatus.REQUESTED,
      items: [
        {
          id: 'item-1',
          productId: 'prod-kopi',
          requestedQty: 10,
          product: { cogs: 220 },
        },
      ],
    };

    const mockPrisma: any = {
      stockTransfer: {
        findUnique: vi.fn().mockResolvedValue(mockTransfer),
        update: vi.fn().mockImplementation(({ data }) => ({ ...mockTransfer, ...data })),
      },
      stockTransferItem: {
        update: vi.fn().mockResolvedValue({}),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => callback(mockPrisma)),
    };

    const mockMutateStock = vi.fn().mockResolvedValue({});
    const mockInventoryService: any = {
      mutateStock: mockMutateStock,
    };

    const service = new StockTransferService(mockPrisma, mockInventoryService);

    // 1. Kirim Transfer (Ship)
    await service.shipTransfer('trf-1', 'user-supervisor', [{ itemId: 'item-1', sentQty: 10 }]);

    // Verifikasi stok asal terpotong -10 (OUT)
    expect(mockMutateStock).toHaveBeenCalledWith(
      'loc-origin',
      'prod-kopi',
      -10,
      MovementType.OUT,
      ReferenceType.TRANSFER,
      'TRF-20261110-ABCD',
      220,
      expect.stringContaining('Kirim transfer'),
      undefined,
      undefined,
      expect.anything(),
    );

    // 2. Terima Transfer (Receive) dengan selisih (hanya terima 9 pcs karena 1 pecah)
    mockTransfer.status = TransferStatus.SHIPPED;
    await service.receiveTransfer('trf-1', [
      { itemId: 'item-1', receivedQty: 9, notes: '1 pcs pecah dalam perjalanan' },
    ]);

    // Verifikasi stok tujuan hanya bertambah +9 (IN)
    expect(mockMutateStock).toHaveBeenCalledWith(
      'loc-dest',
      'prod-kopi',
      9,
      MovementType.IN,
      ReferenceType.TRANSFER,
      'TRF-20261110-ABCD',
      220,
      expect.stringContaining('Terima transfer'),
      undefined,
      undefined,
      expect.anything(),
    );
  });
});
