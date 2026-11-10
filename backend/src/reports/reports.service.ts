import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private parseDateRange(dateFrom?: string, dateTo?: string) {
    if (!dateFrom || !dateTo) return undefined;
    return {
      gte: new Date(`${dateFrom}T00:00:00+07:00`),
      lte: new Date(`${dateTo}T23:59:59.999+07:00`),
    };
  }

  // 1. Ringkasan penjualan berbasis agregasi database langsung
  async getSalesSummary(outletId: string, dateFrom?: string, dateTo?: string) {
    const dateRange = this.parseDateRange(dateFrom, dateTo);
    const where: any = {
      outletId,
      status: 'PAID',
      ...(dateRange ? { createdAt: dateRange } : {}),
    };

    const [trxAgg, itemAgg] = await Promise.all([
      this.prisma.transaction.aggregate({
        where,
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      this.prisma.transactionItem.aggregate({
        where: { transaction: where },
        _sum: { qty: true },
      }),
    ]);

    const totalSales = Number(trxAgg._sum.totalAmount || 0);
    const totalTransactions = trxAgg._count.id;
    const avgTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;
    const totalItemsSold = Number(itemAgg._sum.qty || 0);

    return {
      totalSales,
      totalTransactions,
      avgTransaction,
      totalItemsSold,
    };
  }

  // 2. Ranking menu terjual (Agregasi database groupBy)
  async getSalesByProduct(outletId: string, dateFrom?: string, dateTo?: string, limit: number = 50) {
    const dateRange = this.parseDateRange(dateFrom, dateTo);
    const where: any = {
      transaction: {
        outletId,
        status: 'PAID',
        ...(dateRange ? { createdAt: dateRange } : {}),
      },
    };

    const grouped = await this.prisma.transactionItem.groupBy({
      by: ['name'],
      where,
      _sum: {
        qty: true,
        subtotal: true,
      },
      orderBy: {
        _sum: {
          qty: 'desc',
        },
      },
      take: limit,
    });

    return grouped.map((g) => ({
      name: g.name,
      qty: Number(g._sum.qty || 0),
      total: Number(g._sum.subtotal || 0),
    }));
  }

  // 3. Breakdown metode bayar (Agregasi database groupBy)
  async getSalesByPayment(outletId: string, dateFrom?: string, dateTo?: string) {
    const dateRange = this.parseDateRange(dateFrom, dateTo);
    const where: any = {
      transaction: {
        outletId,
        status: 'PAID',
        ...(dateRange ? { createdAt: dateRange } : {}),
      },
      status: 'PAID',
    };

    const grouped = await this.prisma.transactionPayment.groupBy({
      by: ['paymentMethod'],
      where,
      _sum: {
        amount: true,
      },
    });

    const grandTotal = grouped.reduce((acc, g) => acc + Number(g._sum.amount || 0), 0);

    return grouped.map((g) => {
      const total = Number(g._sum.amount || 0);
      return {
        paymentMethod: g.paymentMethod,
        total,
        percentage: grandTotal > 0 ? Number(((total / grandTotal) * 100).toFixed(1)) : 0,
      };
    });
  }

  // 4. Laporan Laba Rugi Sederhana (Profit & Loss / P&L)
  async getProfitAndLoss(outletId: string, dateFrom?: string, dateTo?: string) {
    const trxWhere: any = {
      outletId,
      status: 'PAID',
    };
    const wasteWhere: any = {
      outletId,
    };

    const dateRange = this.parseDateRange(dateFrom, dateTo);
    if (dateRange) {
      trxWhere.createdAt = dateRange;
      wasteWhere.createdAt = dateRange;
    }

    const [trxAgg, txItems, wasteRecords] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: trxWhere,
        _sum: {
          subtotal: true,
          discountAmount: true,
          taxAmount: true,
          serviceChargeAmount: true,
          totalAmount: true,
        },
        _count: { id: true },
      }),
      this.prisma.transactionItem.findMany({
        where: { transaction: trxWhere },
        select: {
          qty: true,
          unitCogs: true,
          subtotal: true,
          product: {
            select: {
              category: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.wasteRecord.findMany({
        where: wasteWhere,
        select: {
          qty: true,
          unitCost: true,
        },
      }),
    ]);

    const grossSales = Number(trxAgg._sum.subtotal || 0);
    const totalDiscounts = Number(trxAgg._sum.discountAmount || 0);
    const netSales = Math.max(0, grossSales - totalDiscounts);
    const taxCollected = Number(trxAgg._sum.taxAmount || 0);
    const serviceChargeCollected = Number(trxAgg._sum.serviceChargeAmount || 0);

    let totalCogs = 0;
    const categoryBreakdown: Record<string, { category: string; sales: number; cogs: number; profit: number }> = {};

    for (const item of txItems) {
      const lineCogs = Number(item.qty) * Number(item.unitCogs || 0);
      const lineSales = Number(item.subtotal || 0);
      totalCogs += lineCogs;

      const catName = item.product?.category?.name || 'Umum';
      if (!categoryBreakdown[catName]) {
        categoryBreakdown[catName] = { category: catName, sales: 0, cogs: 0, profit: 0 };
      }
      categoryBreakdown[catName].sales += lineSales;
      categoryBreakdown[catName].cogs += lineCogs;
      categoryBreakdown[catName].profit += (lineSales - lineCogs);
    }

    const grossProfit = netSales - totalCogs;
    const grossProfitMargin = netSales > 0 ? Number(((grossProfit / netSales) * 100).toFixed(2)) : 0;

    const totalWasteCost = wasteRecords.reduce((acc, w) => acc + (Number(w.qty) * Number(w.unitCost || 0)), 0);
    const operatingProfit = grossProfit - totalWasteCost;
    const operatingProfitMargin = netSales > 0 ? Number(((operatingProfit / netSales) * 100).toFixed(2)) : 0;

    return {
      period: {
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      },
      revenue: {
        grossSales,
        totalDiscounts,
        netSales,
        taxCollected,
        serviceChargeCollected,
        totalTransactions: trxAgg._count.id,
      },
      cogs: {
        totalCogs,
        cogsPercentage: netSales > 0 ? Number(((totalCogs / netSales) * 100).toFixed(2)) : 0,
      },
      grossProfit,
      grossProfitMargin,
      expenses: {
        totalWasteCost,
      },
      operatingProfit,
      operatingProfitMargin,
      categories: Object.values(categoryBreakdown).sort((a, b) => b.sales - a.sales),
    };
  }
}
