import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export type KdsStation = 'BAR' | 'KITCHEN' | 'ALL';
export type KdsStatus = 'QUEUED' | 'PREPARING' | 'READY' | 'SERVED';

export interface KdsItemView {
  id: string;
  name: string;
  qty: number;
  station: 'BAR' | 'KITCHEN';
  modifiers?: any[];
  notes?: string;
  status: KdsStatus;
}

export interface KdsTicketView {
  ticketId: string;
  transactionId: string;
  transactionNumber: string;
  orderType: string;
  tableNumber?: string;
  orderedAt: Date;
  elapsedMinutes: number;
  overallStatus: KdsStatus;
  items: KdsItemView[];
}

@Injectable()
export class KdsService {
  constructor(private prisma: PrismaService) {}

  // In-memory status store per item untuk operational speed tanpa migrasi schema berat
  private itemStatusMap: Map<string, KdsStatus> = new Map();

  private resolveStation(categoryName?: string, productName?: string): 'BAR' | 'KITCHEN' {
    const text = `${categoryName || ''} ${productName || ''}`.toLowerCase();
    if (text.includes('kopi') || text.includes('tea') || text.includes('teh') || text.includes('drink') || text.includes('minum') || text.includes('latte') || text.includes('espresso') || text.includes('susu') || text.includes('coklat')) {
      return 'BAR';
    }
    return 'KITCHEN';
  }

  async getStationQueue(outletId: string, station: KdsStation = 'ALL'): Promise<KdsTicketView[]> {
    const since = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12 jam terakhir

    const transactions = await this.prisma.transaction.findMany({
      where: {
        outletId,
        status: 'PAID',
        createdAt: { gte: since },
      },
      include: {
        items: {
          include: {
            product: { include: { category: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' }, // FIFO (First In First Out)
    });

    const now = Date.now();
    const tickets: KdsTicketView[] = [];

    for (const trx of transactions) {
      const itemsForTicket: KdsItemView[] = [];

      for (const item of trx.items) {
        const itemStation = this.resolveStation(item.product?.category?.name, item.name);

        // Filter berdasarkan stasiun jika bukan 'ALL'
        if (station !== 'ALL' && itemStation !== station) {
          continue;
        }

        let currentStatus = this.itemStatusMap.get(item.id);
        if (!currentStatus) {
          const match = item.notes?.match(/\[KDS_STATUS:([A-Z]+)\]/);
          currentStatus = (match ? match[1] : 'QUEUED') as KdsStatus;
          if (currentStatus !== 'SERVED') {
            this.itemStatusMap.set(item.id, currentStatus);
          }
        }

        // Jangan tampilkan jika sudah selesai disajikan (SERVED)
        if (currentStatus === 'SERVED') {
          continue;
        }

        itemsForTicket.push({
          id: item.id,
          name: item.name,
          qty: Number(item.qty),
          station: itemStation,
          modifiers: Array.isArray(item.modifiers) ? (item.modifiers as any[]) : undefined,
          notes: (item.notes || '').replace(/\[KDS_STATUS:[^\]]+\]/g, '').trim() || undefined,
          status: currentStatus,
        });
      }

      // Jika tiket masih memiliki item yang harus disiapkan
      if (itemsForTicket.length > 0) {
        const elapsedMinutes = Math.floor((now - new Date(trx.createdAt).getTime()) / 60000);

        let overallStatus: KdsStatus = 'QUEUED';
        if (itemsForTicket.every((i) => i.status === 'READY')) {
          overallStatus = 'READY';
        } else if (itemsForTicket.some((i) => i.status === 'PREPARING' || i.status === 'READY')) {
          overallStatus = 'PREPARING';
        }

        tickets.push({
          ticketId: `TICK-${trx.id.slice(0, 8)}`,
          transactionId: trx.id,
          transactionNumber: trx.transactionNumber,
          orderType: trx.orderType,
          tableNumber: trx.tableNumber || undefined,
          orderedAt: trx.createdAt,
          elapsedMinutes,
          overallStatus,
          items: itemsForTicket,
        });
      }
    }

    return tickets;
  }

  async updateItemStatus(itemId: string, status: KdsStatus) {
    if (status === 'SERVED') {
      this.itemStatusMap.delete(itemId);
    } else {
      this.itemStatusMap.set(itemId, status);
    }

    // Persist status ke catatan item agar tahan restart
    const item = await this.prisma.transactionItem?.findUnique?.({ where: { id: itemId } });
    if (item) {
      const cleanNotes = (item.notes || '').replace(/\[KDS_STATUS:[^\]]+\]/g, '').trim();
      const updatedNotes = cleanNotes ? `${cleanNotes} [KDS_STATUS:${status}]` : `[KDS_STATUS:${status}]`;
      await this.prisma.transactionItem.update({
        where: { id: itemId },
        data: { notes: updatedNotes },
      });
    }

    return {
      itemId,
      status,
      updatedAt: new Date(),
    };
  }

  async updateTicketStatus(transactionId: string, status: KdsStatus) {
    const items = await this.prisma.transactionItem.findMany({ where: { transactionId } });
    for (const item of items) {
      await this.updateItemStatus(item.id, status);
    }
    return {
      transactionId,
      status,
      updatedAt: new Date(),
    };
  }
}
