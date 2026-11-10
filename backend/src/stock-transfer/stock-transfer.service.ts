import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { TransferStatus, MovementType, ReferenceType } from '@prisma/client';

export interface CreateTransferDto {
  fromOutletId: string;
  toOutletId: string;
  notes?: string;
  items: {
    productId: string;
    requestedQty: number;
    notes?: string;
  }[];
}

@Injectable()
export class StockTransferService {
  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
  ) {}

  // 1. Buat Request Transfer Stok Antar Outlet Saja
  async createTransferRequest(dto: CreateTransferDto, userId: string, companyId: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Item transfer tidak boleh kosong');
    }
    if (dto.fromOutletId === dto.toOutletId) {
      throw new BadRequestException('Outlet asal dan tujuan tidak boleh sama');
    }

    // Validasi ketat: transfer HANYA antar outlet terdaftar (bukan gudang antah berantah)
    const [fromOutlet, toOutlet] = await Promise.all([
      this.prisma.outlet.findFirst({ where: { id: dto.fromOutletId, companyId, deletedAt: null } }),
      this.prisma.outlet.findFirst({ where: { id: dto.toOutletId, companyId, deletedAt: null } }),
    ]);

    if (!fromOutlet) {
      throw new NotFoundException('Outlet pengirim tidak ditemukan atau bukan outlet aktif');
    }
    if (!toOutlet) {
      throw new NotFoundException('Outlet tujuan penerima tidak ditemukan atau bukan outlet aktif');
    }

    const fromLoc = await this.inventoryService.getOrCreateOutletLocation(dto.fromOutletId, companyId);
    const toLoc = await this.inventoryService.getOrCreateOutletLocation(dto.toOutletId, companyId);

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const transferNumber = `TRF-${dateStr}-${randSuffix}`;

    return this.prisma.stockTransfer.create({
      data: {
        companyId,
        fromLocationId: fromLoc.id,
        toLocationId: toLoc.id,
        transferNumber,
        status: TransferStatus.REQUESTED,
        notes: dto.notes,
        requestedByUserId: userId,
        items: {
          create: dto.items.map((i) => ({
            productId: i.productId,
            requestedQty: i.requestedQty,
            notes: i.notes,
          })),
        },
      },
      include: {
        items: { include: { product: { select: { name: true, sku: true } } } },
        fromLocation: true,
        toLocation: true,
      },
    });
  }

  // 2. Pengiriman Barang (Kirim / Shipped)
  // Stok di gudang asal otomatis terpotong (OUT)
  async shipTransfer(
    transferId: string,
    userId: string,
    shippedItems?: { itemId: string; sentQty: number }[],
  ) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id: transferId },
      include: { items: { include: { product: true } } },
    });

    if (!transfer) throw new NotFoundException('Transfer tidak ditemukan');
    if (transfer.status !== TransferStatus.REQUESTED && transfer.status !== TransferStatus.APPROVED) {
      throw new BadRequestException(`Status transfer ${transfer.status} tidak dapat dikirim`);
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        // Ambil qty kirim aktual jika dispesifikasikan
        const override = shippedItems?.find((s) => s.itemId === item.id);
        const actualSentQty = override ? override.sentQty : Number(item.requestedQty);

        await tx.stockTransferItem.update({
          where: { id: item.id },
          data: { sentQty: actualSentQty },
        });

        // Potong stok di lokasi asal (OUT)
        await this.inventoryService.mutateStock(
          transfer.fromLocationId,
          item.productId,
          -actualSentQty,
          MovementType.OUT,
          ReferenceType.TRANSFER,
          transfer.transferNumber,
          Number(item.product.cogs || 0),
          `Kirim transfer stok ke gudang tujuan (${transfer.transferNumber})`,
          undefined,
          undefined,
          tx,
        );
      }

      return tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: TransferStatus.SHIPPED,
          approvedByUserId: userId,
        },
        include: { items: true },
      });
    });
  }

  // 3. Penerimaan Barang di Outlet Tujuan (Receive & Complete)
  // Mendukung pencatatan selisih barang (sentQty vs receivedQty) & stok masuk (IN)
  async receiveTransfer(
    transferId: string,
    receivedItems: { itemId: string; receivedQty: number; notes?: string }[],
  ) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id: transferId },
      include: { items: { include: { product: true } } },
    });

    if (!transfer) throw new NotFoundException('Transfer tidak ditemukan');
    if (transfer.status !== TransferStatus.SHIPPED) {
      throw new BadRequestException('Hanya transfer dengan status SHIPPED yang dapat diterima');
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        const input = receivedItems.find((r) => r.itemId === item.id);
        const actualReceivedQty = input ? input.receivedQty : Number(item.sentQty || item.requestedQty);
        const diffNotes = input?.notes;

        await tx.stockTransferItem.update({
          where: { id: item.id },
          data: {
            receivedQty: actualReceivedQty,
            notes: diffNotes ? `${item.notes || ''} | Selisih/Catatan: ${diffNotes}` : item.notes,
          },
        });

        // Tambah stok di lokasi penerima (IN)
        if (actualReceivedQty > 0) {
          await this.inventoryService.mutateStock(
            transfer.toLocationId,
            item.productId,
            actualReceivedQty,
            MovementType.IN,
            ReferenceType.TRANSFER,
            transfer.transferNumber,
            Number(item.product.cogs || 0),
            `Terima transfer barang dari ${transfer.transferNumber}`,
            undefined,
            undefined,
            tx,
          );
        }

        // Catat audit selisih in-transit jika barang berkurang/rusak saat pengiriman
        const sent = Number(item.sentQty || item.requestedQty);
        const diffTransit = sent - actualReceivedQty;
        if (diffTransit > 0) {
          await this.inventoryService.mutateStock(
            transfer.fromLocationId,
            item.productId,
            -diffTransit,
            MovementType.ADJUSTMENT,
            ReferenceType.TRANSFER,
            transfer.transferNumber,
            Number(item.product.cogs || 0),
            `Susut/rusak dalam perjalanan transfer ${transfer.transferNumber} (-${diffTransit})`,
            undefined,
            undefined,
            tx,
          );
        }
      }

      return tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: TransferStatus.COMPLETED,
        },
        include: { items: true },
      });
    });
  }

  // 4. List Riwayat Transfer
  async getTransfers(outletId?: string) {
    const where: any = {};
    if (outletId) {
      where.OR = [
        { fromLocation: { outletId } },
        { toLocation: { outletId } },
      ];
    }

    return this.prisma.stockTransfer.findMany({
      where,
      include: {
        fromLocation: { select: { name: true, locationType: true } },
        toLocation: { select: { name: true, locationType: true } },
        items: {
          include: { product: { select: { name: true, sku: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
