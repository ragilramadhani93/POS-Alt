import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportsService } from './reports.service.js';

describe('ReportsService - Profit & Loss', () => {
  let service: ReportsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      transaction: {
        aggregate: vi.fn(),
      },
      transactionItem: {
        findMany: vi.fn(),
      },
      wasteRecord: {
        findMany: vi.fn(),
      },
    };
    service = new ReportsService(mockPrisma);
  });

  it('should calculate gross profit, operating profit, and margins correctly', async () => {
    mockPrisma.transaction.aggregate.mockResolvedValue({
      _sum: {
        subtotal: 500000,
        discountAmount: 50000,
        taxAmount: 49500,
        serviceChargeAmount: 22500,
        totalAmount: 522000,
      },
      _count: { id: 10 },
    });

    mockPrisma.transactionItem.findMany.mockResolvedValue([
      {
        qty: 10,
        unitCogs: 15000,
        subtotal: 300000,
        product: { category: { name: 'Makanan' } },
      },
      {
        qty: 10,
        unitCogs: 5000,
        subtotal: 200000,
        product: { category: { name: 'Minuman' } },
      },
    ]);

    mockPrisma.wasteRecord.findMany.mockResolvedValue([
      { qty: 2, unitCost: 15000 }, // Rp 30.000 waste
    ]);

    const pl = await service.getProfitAndLoss('outlet-1', '2026-03-01', '2026-03-31');

    // Net Sales = 500.000 - 50.000 = 450.000
    expect(pl.revenue.netSales).toBe(450000);
    // COGS = (10 * 15.000) + (10 * 5.000) = 200.000
    expect(pl.cogs.totalCogs).toBe(200000);
    // Gross Profit = 450.000 - 200.000 = 250.000
    expect(pl.grossProfit).toBe(250000);
    // Gross Margin = (250.000 / 450.000) * 100 = 55.56%
    expect(pl.grossProfitMargin).toBe(55.56);
    // Total Waste Cost = 30.000
    expect(pl.expenses.totalWasteCost).toBe(30000);
    // Operating Profit = 250.000 - 30.000 = 220.000
    expect(pl.operatingProfit).toBe(220000);
  });
});
