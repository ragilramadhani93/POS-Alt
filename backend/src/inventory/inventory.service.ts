import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MovementType, ReferenceType, OpnameStatus, Prisma } from '@prisma/client';

export interface ExecuteOpnameDto {
  outletId: string;
  notes?: string;
  items: Array<{
    productId: string;
    countedQty: number;
    notes?: string;
  }>;
}

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  // 1. Ambil atau buat lokasi gudang untuk outlet
  async getOrCreateOutletLocation(outletId: string, companyId: string, client?: Prisma.TransactionClient) {
    const db = client || this.prisma;
    let loc = await db.inventoryLocation.findFirst({
      where: { outletId, deletedAt: null },
    });

    if (!loc) {
      const outlet = await db.outlet.findUnique({ where: { id: outletId } });
      loc = await db.inventoryLocation.create({
        data: {
          companyId,
          outletId,
          name: `Gudang Utama ${outlet?.name || ''}`,
          locationType: 'STORE',
        },
      });
    }
    return loc;
  }

  // 2. Catat Mutasi Stok Atomic (In/Out/Adjustment) + Update Balance Moving Average
  // Mendukung passing transaction client induk (tx) agar tidak nested transaction terpisah
  async mutateStock(
    locationId: string,
    productId: string,
    qty: number,
    movementType: MovementType,
    refType: ReferenceType,
    refId?: string,
    unitCost: number = 0,
    notes?: string,
    batchNumber?: string,
    expiryDate?: Date,
    client?: Prisma.TransactionClient,
  ) {
    const execute = async (tx: Prisma.TransactionClient) => {
      // 1. Upsert Balance
      const currentBalance = await tx.stockBalance.findUnique({
        where: {
          inventoryLocationId_productId: {
            inventoryLocationId: locationId,
            productId,
          },
        },
      });

      const currentQty = Number(currentBalance?.qty || 0);
      const currentAvgCost = Number(currentBalance?.avgCost || 0);
      const newQty = currentQty + qty;

      // Hitung moving average cost (cegah zero-division)
      let newAvgCost = currentAvgCost;
      if (qty > 0 && unitCost > 0) {
        if (newQty <= 0) {
          newAvgCost = unitCost;
        } else {
          const totalValBefore = Math.max(0, currentQty) * currentAvgCost;
          const incomingVal = qty * unitCost;
          newAvgCost = (totalValBefore + incomingVal) / newQty;
        }
      }

      await tx.stockBalance.upsert({
        where: {
          inventoryLocationId_productId: {
            inventoryLocationId: locationId,
            productId,
          },
        },
        create: {
          inventoryLocationId: locationId,
          productId,
          qty: newQty,
          avgCost: newAvgCost,
        },
        update: {
          qty: { increment: qty },
          avgCost: newAvgCost,
        },
      });

      // 2. Catat riwayat audit ledger di StockMovement
      const movement = await tx.stockMovement.create({
        data: {
          inventoryLocationId: locationId,
          productId,
          movementType,
          referenceType: refType,
          referenceId: refId || null,
          qty,
          unitCost: unitCost || newAvgCost,
          batchNumber,
          expiryDate,
          notes,
        },
      });

      return { balance: newQty, avgCost: newAvgCost, movement };
    };

    if (client) {
      return execute(client);
    }
    return this.prisma.$transaction(async (tx) => execute(tx));
  }

  // 3. List Stok Realtime Per Outlet/Lokasi
  async getStockBalances(locationId: string) {
    const balances = await this.prisma.stockBalance.findMany({
      where: { inventoryLocationId: locationId },
      include: {
        product: {
          include: {
            baseUom: true,
            category: true,
          },
        },
      },
      orderBy: { product: { name: 'asc' } },
    });

    return balances.map((b) => {
      const minAlert = Number(b.product.minStockAlert || 5);
      const currentQty = Number(b.qty);
      return {
        productId: b.productId,
        sku: b.product.sku,
        name: b.product.name,
        category: b.product.category?.name || 'Uncategorized',
        uom: b.product.baseUom?.abbreviation || 'PCS',
        qty: currentQty,
        avgCost: Number(b.avgCost),
        totalValuation: currentQty * Number(b.avgCost),
        minAlert,
        isLowStock: currentQty <= minAlert,
      };
    });
  }

  // 4. Riwayat Mutasi (Kartu Stok)
  async getStockMovements(locationId: string, productId?: string) {
    const where: any = { inventoryLocationId: locationId };
    if (productId) where.productId = productId;

    return this.prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { name: true, sku: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // 5. Eksekusi Stok Opname (Audit Fisik Stok & Auto Adjustment)
  async executeStockOpname(dto: ExecuteOpnameDto, userId: string, companyId: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Item opname fisik tidak boleh kosong');
    }

    const loc = await this.getOrCreateOutletLocation(dto.outletId, companyId);

    return this.prisma.$transaction(async (tx) => {
      // Buat dokumen opname
      const opname = await tx.stockOpname.create({
        data: {
          companyId,
          outletId: dto.outletId,
          inventoryLocationId: loc.id,
          status: OpnameStatus.APPROVED,
          approvedByUserId: userId,
          completedAt: new Date(),
          notes: dto.notes,
        },
      });

      const processedItems = [];

      for (const item of dto.items) {
        // Ambil stok sistem saat ini
        const currentBalance = await tx.stockBalance.findUnique({
          where: {
            inventoryLocationId_productId: {
              inventoryLocationId: loc.id,
              productId: item.productId,
            },
          },
        });

        const systemQty = Number(currentBalance?.qty || 0);
        const countedQty = Number(item.countedQty);
        const discrepancy = countedQty - systemQty;
        const avgCost = Number(currentBalance?.avgCost || 0);

        // Rekam detail opname item
        const opnameItem = await tx.stockOpnameItem.create({
          data: {
            stockOpnameId: opname.id,
            productId: item.productId,
            systemQty,
            countedQty,
            notes: item.notes,
          },
        });

        // Jika ada selisih, lakukan mutasi penyesuaian (Adjustment)
        if (discrepancy !== 0) {
          await this.mutateStock(
            loc.id,
            item.productId,
            discrepancy,
            MovementType.ADJUSTMENT,
            ReferenceType.OPNAME,
            opname.id,
            avgCost,
            `Opname Selisih: ${discrepancy > 0 ? '+' : ''}${discrepancy} (${item.notes || 'Penyesuaian fisik'})`,
            undefined,
            undefined,
            tx,
          );
        }

        processedItems.push({
          productId: item.productId,
          systemQty,
          countedQty,
          discrepancy,
        });
      }

      return {
        opnameId: opname.id,
        outletId: dto.outletId,
        status: opname.status,
        completedAt: opname.completedAt,
        itemsProcessed: processedItems.length,
        items: processedItems,
      };
    });
  }

  async getStockOpnames(outletId: string) {
    return this.prisma.stockOpname.findMany({
      where: { outletId },
      include: {
        items: {
          include: {
            product: { select: { name: true, sku: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}
