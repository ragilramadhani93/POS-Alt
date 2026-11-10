import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { SheetsAdapter } from './sheets.adapter.js';
import { MovementType, ReferenceType } from '@prisma/client';

export interface SubmitGrDto {
  outletId: string;
  noSj: string;
  kodeSj?: string;
  noBp?: string;
  tglSj?: string;
  picName?: string;
  dikirimkanKe?: string;
  notes?: string;
  items: {
    productId?: string;
    kodeBarang: string;
    namaBarang: string;
    brand?: string;
    satuanSj: string;
    qtySj: number;
    qtyDiterima: number;
    condition?: string;
    notes?: string;
  }[];
}

@Injectable()
export class GoodReceiveService {
  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
  ) {}

  // 1. Fetch data SJ dari Google Sheets BPSJ (atau cache)
  async fetchSjFromSheet(noSj: string, companyId: string) {
    // 1. Cek local cache dulu
    const cached = await this.prisma.sheetsSjCache.findUnique({
      where: {
        companyId_noSj: { companyId, noSj },
      },
    });

    if (cached) {
      return {
        source: 'cache',
        data: cached.rawData,
        fetchedAt: cached.fetchedAt,
      };
    }

    // 2. Fetch data dari BPSJ Sheet via Adapter
    const sheetData = await SheetsAdapter.fetchBpsjSheet(noSj);

    // Optimasi Single Batch Query (Cegah N+1 Query per item)
    const barcodesOrSkus = sheetData.items.map((i) => i.kodeBarang);
    const matchedProducts = await this.prisma.product.findMany({
      where: {
        companyId,
        OR: [
          { barcode: { in: barcodesOrSkus } },
          { sku: { in: barcodesOrSkus } },
        ],
      },
    });

    const productMap = new Map<string, any>();
    for (const p of matchedProducts) {
      if (p.barcode) productMap.set(p.barcode, p);
      if (p.sku) productMap.set(p.sku, p);
    }

    const items = sheetData.items.map((item) => {
      const prod = productMap.get(item.kodeBarang);
      return {
        ...item,
        productId: prod?.id || null,
        matchedProductName: prod?.name || null,
      };
    });

    const fullResult = {
      ...sheetData,
      items,
    };

    // Simpan ke cache
    await this.prisma.sheetsSjCache.upsert({
      where: {
        companyId_noSj: { companyId, noSj },
      },
      create: {
        companyId,
        noSj,
        rawData: fullResult as any,
        spreadsheetId: '1j7JodV2kXwfuNdYboFxJBWu0Yh2x8U15',
      },
      update: {
        rawData: fullResult as any,
        fetchedAt: new Date(),
      },
    });

    return {
      source: 'sheets_live',
      data: fullResult,
    };
  }

  // 2. Submit & Konfirmasi Penerimaan Barang (GR)
  // Stok bertambah otomatis (IN) untuk barang yang sudah ter-mapping
  async submitGoodReceive(dto: SubmitGrDto, companyId: string) {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const grNumber = `GR-${dateStr}-${randSuffix}`;

    return this.prisma.$transaction(async (tx) => {
      const loc = await this.inventoryService.getOrCreateOutletLocation(dto.outletId, companyId, tx);

      // 1. Simpan Header GR
      const gr = await tx.goodReceive.create({
        data: {
          companyId,
          outletId: dto.outletId,
          grNumber,
          noSj: dto.noSj,
          kodeSj: dto.kodeSj || dto.noSj,
          noBp: dto.noBp || null,
          picName: dto.picName || null,
          dikirimkanKe: dto.dikirimkanKe || null,
          status: 'APPROVED',
          notes: dto.notes,
          items: {
            create: dto.items.map((i) => ({
              productId: i.productId || null,
              kodeBarang: i.kodeBarang,
              namaBarang: i.namaBarang,
              brand: i.brand || null,
              satuanSj: i.satuanSj,
              qtySj: i.qtySj,
              qtyDiterima: i.qtyDiterima,
              condition: i.condition || 'good',
              notes: i.notes || null,
            })),
          },
        },
        include: { items: true },
      });

      // 2. Update Stok Masuk (IN) untuk setiap item yang memiliki productId
      for (const item of dto.items) {
        if (item.productId && item.qtyDiterima > 0) {
          const prod = await tx.product.findUnique({ where: { id: item.productId } });
          const unitCost = Number(prod?.cogs || 0);

          await this.inventoryService.mutateStock(
            loc.id,
            item.productId,
            item.qtyDiterima,
            MovementType.IN,
            ReferenceType.GR,
            gr.grNumber,
            unitCost,
            `Penerimaan Surat Jalan ${dto.noSj}`,
            undefined,
            undefined,
            tx,
          );
        }
      }

      return gr;
    });
  }

  // 3. Riwayat GR per Outlet
  async getGoodReceives(outletId: string) {
    return this.prisma.goodReceive.findMany({
      where: { outletId },
      include: {
        items: {
          include: { product: { select: { name: true, sku: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
