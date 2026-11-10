import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async getCatalogForOutlet(outletId: string, companyId: string) {
    const categories = await this.prisma.category.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });

    const products = await this.prisma.product.findMany({
      where: {
        companyId,
        productType: 'SELLABLE',
        deletedAt: null,
      },
      include: {
        variants: { where: { deletedAt: null } },
        modifiers: {
          include: {
            modifier: {
              include: {
                options: { where: { deletedAt: null } },
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        outletConfigs: {
          where: { outletId },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Sesuaikan harga override per outlet & status ketersediaan
    const formattedProducts = products.map((prod) => {
      const config = prod.outletConfigs[0];
      const finalPrice = config?.sellPriceOverride !== null && config?.sellPriceOverride !== undefined
        ? Number(config.sellPriceOverride)
        : Number(prod.sellPrice);
      const isAvailable = config ? config.isAvailable : true;

      return {
        id: prod.id,
        sku: prod.sku,
        name: prod.name,
        description: prod.description,
        categoryId: prod.categoryId,
        price: finalPrice,
        cogs: Number(prod.cogs),
        isAvailable,
        imageUrl: prod.imageUrl,
        barcode: prod.barcode,
        variants: prod.variants.map((v) => ({
          id: v.id,
          name: v.name,
          skuSuffix: v.skuSuffix,
          price: v.sellPriceOverride !== null ? Number(v.sellPriceOverride) : finalPrice,
          barcode: v.barcode,
        })),
        modifiers: prod.modifiers.map((pm) => ({
          id: pm.modifier.id,
          name: pm.modifier.name,
          isRequired: pm.modifier.isRequired,
          minSelect: pm.modifier.minSelect,
          maxSelect: pm.modifier.maxSelect,
          options: pm.modifier.options.map((opt) => ({
            id: opt.id,
            name: opt.name,
            priceAdd: Number(opt.priceAdd),
          })),
        })),
      };
    });

    return {
      categories,
      products: formattedProducts,
    };
  }
}
