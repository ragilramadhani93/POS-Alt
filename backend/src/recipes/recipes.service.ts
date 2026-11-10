import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { MovementType, ReferenceType } from '@prisma/client';

export interface CreateRecipeDto {
  productId: string;
  yieldQty: number;
  yieldUomId?: string;
  notes?: string;
  items: {
    ingredientProductId: string;
    qty: number;
    uomId?: string;
    wastagePct?: number;
  }[];
}

@Injectable()
export class RecipesService {
  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
  ) {}

  // 1. Buat / Perbarui Resep (BOM)
  async upsertRecipe(dto: CreateRecipeDto, companyId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Pastikan resep sebelumnya di-soft delete atau update
      const existing = await tx.recipe.findUnique({
        where: { productId: dto.productId },
      });

      if (existing) {
        await tx.recipeItem.deleteMany({ where: { recipeId: existing.id } });
        return tx.recipe.update({
          where: { id: existing.id },
          data: {
            yieldQty: dto.yieldQty,
            yieldUomId: dto.yieldUomId || null,
            notes: dto.notes,
            items: {
              create: dto.items.map((i) => ({
                ingredientProductId: i.ingredientProductId,
                qty: i.qty,
                uomId: i.uomId || null,
                wastagePct: i.wastagePct || 0,
              })),
            },
          },
          include: { items: true },
        });
      }

      return tx.recipe.create({
        data: {
          companyId,
          productId: dto.productId,
          yieldQty: dto.yieldQty,
          yieldUomId: dto.yieldUomId || null,
          notes: dto.notes,
          items: {
            create: dto.items.map((i) => ({
              ingredientProductId: i.ingredientProductId,
              qty: i.qty,
              uomId: i.uomId || null,
              wastagePct: i.wastagePct || 0,
            })),
          },
        },
        include: { items: true },
      });
    });
  }

  // 2. Cost Roll-up: Hitung HPP Otomatis dari bahan baku resep
  async calculateRecipeCost(recipeId: string): Promise<number> {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        items: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    if (!recipe) throw new NotFoundException('Resep tidak ditemukan');

    let totalCost = 0;
    for (const item of recipe.items) {
      const ingredientCogs = Number(item.ingredient.cogs || 0);
      const qtyNeeded = Number(item.qty);
      const wastageFactor = 1 + Number(item.wastagePct || 0) / 100;
      totalCost += ingredientCogs * qtyNeeded * wastageFactor;
    }

    const yieldQty = Number(recipe.yieldQty) || 1;
    return totalCost / yieldQty;
  }

  // 3. Modul Crafting / Produksi Semi-Finished Product
  // Bahan baku resep berkurang -> Stok semi-finished bertambah
  async executeProduction(
    outletId: string,
    companyId: string,
    operatorUserId: string,
    productId: string,
    batchesCount: number,
    notes?: string,
  ) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { productId },
      include: {
        product: true,
        items: { include: { ingredient: true } },
      },
    });

    if (!recipe) throw new NotFoundException('Resep tidak ditemukan untuk produk ini');

    const loc = await this.inventoryService.getOrCreateOutletLocation(outletId, companyId);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const batchNumber = `BATCH-${recipe.product.sku}-${dateStr}-${Math.floor(100 + Math.random() * 900)}`;

    const plannedYield = Number(recipe.yieldQty) * batchesCount;
    let totalIngredientCost = 0;

    return this.prisma.$transaction(async (tx) => {
      // 1. Kurangi bahan baku (OUT)
      for (const item of recipe.items) {
        const requiredQty = Number(item.qty) * batchesCount * (1 + Number(item.wastagePct || 0) / 100);
        const costPerUnit = Number(item.ingredient.cogs || 0);
        totalIngredientCost += requiredQty * costPerUnit;

        await this.inventoryService.mutateStock(
          loc.id,
          item.ingredientProductId,
          -requiredQty,
          MovementType.OUT,
          ReferenceType.PRODUCTION,
          batchNumber,
          costPerUnit,
          `Bahan baku produksi ${batchesCount} batch ${recipe.product.name}`,
          undefined,
          undefined,
          tx,
        );
      }

      // 2. Tambah stok barang jadi / semi-finished (IN)
      const unitProductionCost = plannedYield > 0 ? totalIngredientCost / plannedYield : 0;
      await this.inventoryService.mutateStock(
        loc.id,
        productId,
        plannedYield,
        MovementType.IN,
        ReferenceType.PRODUCTION,
        batchNumber,
        unitProductionCost,
        `Hasil produksi ${batchesCount} batch (${batchNumber})`,
        batchNumber,
        undefined,
        tx,
      );

      // 3. Catat Order Produksi
      return tx.productionOrder.create({
        data: {
          companyId,
          outletId,
          productId,
          recipeId: recipe.id,
          plannedQty: plannedYield,
          actualQty: plannedYield,
          batchNumber,
          status: 'COMPLETED',
          operatorUserId,
          notes,
        },
      });
    });
  }
}
