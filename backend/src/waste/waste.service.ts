import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { MovementType, ReferenceType, WasteType } from '@prisma/client';

@Injectable()
export class WasteService {
  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
  ) {}

  // Catat barang rusak / expired / tumpah
  // MENDUKUNG AUTO-EXPLODE RESEP: Jika yang di-waste adalah Menu Jual atau Semi-Finished,
  // maka stok yang dipotong adalah bahan baku (raw materials) di bawahnya secara rekursif/bertingkat.
  async recordWaste(
    outletId: string,
    companyId: string,
    userId: string,
    productId: string,
    qty: number,
    reason: string,
    wasteType: WasteType = WasteType.SPOILAGE,
    photoUrl?: string,
  ) {
    if (qty <= 0) throw new BadRequestException('Jumlah waste harus lebih dari 0');

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        asRecipe: {
          include: {
            items: {
              include: {
                ingredient: {
                  include: {
                    asRecipe: {
                      include: {
                        items: {
                          include: { ingredient: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!product) throw new NotFoundException('Produk tidak ditemukan');

    const loc = await this.inventoryService.getOrCreateOutletLocation(outletId, companyId);
    const unitCost = Number(product.cogs || 0);

    return this.prisma.$transaction(async (tx) => {
      // Periksa apakah produk ini memiliki resep (Menu Jual atau Semi-Finished yang di-explode)
      if (product.asRecipe && product.asRecipe.items.length > 0) {
        const recipe = product.asRecipe;
        const yieldQty = Number(recipe.yieldQty || 1);

        // Breakdown bahan baku tingkat 1
        for (const item of recipe.items) {
          const ingredient = item.ingredient;
          const neededQty = (Number(item.qty) / yieldQty) * qty;

          // Cek apakah ingredient ini semi-finished yang punya resep lagi (bertingkat)?
          if (ingredient.asRecipe && ingredient.asRecipe.items.length > 0) {
            const subRecipe = ingredient.asRecipe;
            const subYield = Number(subRecipe.yieldQty || 1);
            for (const subItem of subRecipe.items) {
              const subNeeded = (Number(subItem.qty) / subYield) * neededQty;
              await this.inventoryService.mutateStock(
                loc.id,
                subItem.ingredientProductId,
                -subNeeded,
                MovementType.OUT,
                ReferenceType.WASTE,
                undefined,
                Number(subItem.ingredient?.cogs || 0),
                `Waste breakdown menu ${product.name} -> ${ingredient.name} (${reason})`,
                undefined,
                undefined,
                tx,
              );
            }
          } else {
            // Potong raw material langsung
            await this.inventoryService.mutateStock(
              loc.id,
              item.ingredientProductId,
              -neededQty,
              MovementType.OUT,
              ReferenceType.WASTE,
              undefined,
              Number(ingredient.cogs || 0),
              `Waste breakdown menu ${product.name} (${reason})`,
              undefined,
              undefined,
              tx,
            );
          }
        }
      } else {
        // Jika bahan baku mentah langsung (tanpa resep), potong produk itu sendiri
        await this.inventoryService.mutateStock(
          loc.id,
          productId,
          -qty,
          MovementType.OUT,
          ReferenceType.WASTE,
          undefined,
          unitCost,
          `Waste: ${reason} (${wasteType})`,
          undefined,
          undefined,
          tx,
        );
      }

      // Simpan record audit waste induk
      return tx.wasteRecord.create({
        data: {
          companyId,
          outletId,
          inventoryLocationId: loc.id,
          productId,
          qty,
          uomId: product.baseUomId,
          reason,
          wasteType,
          photoUrl,
          unitCost,
          userId,
        },
        include: {
          product: { select: { name: true, sku: true } },
          user: { select: { name: true } },
        },
      });
    });
  }

  // Riwayat Waste per Outlet
  async getWasteRecords(outletId: string, dateFrom?: string, dateTo?: string) {
    const where: any = { outletId };
    if (dateFrom && dateTo) {
      where.createdAt = {
        gte: new Date(`${dateFrom}T00:00:00.000Z`),
        lte: new Date(`${dateTo}T23:59:59.999Z`),
      };
    }

    return this.prisma.wasteRecord.findMany({
      where,
      include: {
        product: { select: { name: true, sku: true } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
