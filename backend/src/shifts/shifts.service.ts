import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ShiftsService {
  constructor(private prisma: PrismaService) {}

  async openShift(outletId: string, cashierUserId: string, openingCash: number, notes?: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.shift.findFirst({
        where: { outletId, cashierUserId, status: 'OPEN' },
      });
      if (existing) {
        throw new BadRequestException('Kasir ini sudah memiliki shift aktif di outlet tersebut');
      }

      return tx.shift.create({
        data: {
          outletId,
          cashierUserId,
          openingCash,
          notes,
          status: 'OPEN',
        },
      });
    });
  }

  async closeShift(shiftId: string, closingCash: number, notes?: string, currentUserId?: string, userRole?: string) {
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
      include: {
        transactions: {
          where: { status: 'PAID' },
          include: { payments: true },
        },
      },
    });

    if (!shift || shift.status !== 'OPEN') {
      throw new NotFoundException('Shift aktif tidak ditemukan');
    }

    if (currentUserId && userRole !== 'ADMIN' && shift.cashierUserId !== currentUserId) {
      throw new BadRequestException('Anda tidak berwenang menutup shift kasir milik staf lain');
    }

    // Rekapitulasi pembayaran selama shift
    let totalCashReceived = 0;
    let totalNonCashReceived = 0;
    const paymentBreakdown: Record<string, number> = {};

    for (const trx of shift.transactions) {
      for (const p of trx.payments) {
        const val = Number(p.amount);
        paymentBreakdown[p.paymentMethod] = (paymentBreakdown[p.paymentMethod] || 0) + val;
        if (p.paymentMethod === 'CASH') {
          totalCashReceived += val;
        } else {
          totalNonCashReceived += val;
        }
      }
    }

    const expectedCash = Number(shift.openingCash) + totalCashReceived;
    const cashDifference = closingCash - expectedCash;

    const closed = await this.prisma.shift.update({
      where: { id: shiftId },
      data: {
        closingCash,
        closedAt: new Date(),
        status: 'CLOSED',
        notes: notes ? `${shift.notes || ''}\n${notes}` : shift.notes,
      },
    });

    return {
      shift: closed,
      summary: {
        openingCash: Number(shift.openingCash),
        totalCashSales: totalCashReceived,
        totalNonCashSales: totalNonCashReceived,
        expectedCashInDrawer: expectedCash,
        actualClosingCash: closingCash,
        cashDifference,
        paymentBreakdown,
        totalTransactions: shift.transactions.length,
      },
    };
  }

  async getActiveShift(outletId: string, cashierUserId: string) {
    return this.prisma.shift.findFirst({
      where: { outletId, cashierUserId, status: 'OPEN' },
    });
  }
}
