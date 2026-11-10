import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { PromotionsService } from '../promotions/promotions.service.js';
import { MembersService } from '../members/members.service.js';
import { OrderType, PaymentMethod, TransactionStatus, MovementType, ReferenceType } from '@prisma/client';

export interface CreateTransactionDto {
  outletId: string;
  shiftId: string;
  orderType: OrderType;
  tableNumber?: string;
  memberId?: string;
  voucherCode?: string;
  pointsToRedeem?: number;
  applyTax?: boolean;
  notes?: string;
  items: {
    productId: string;
    productVariantId?: string;
    qty: number;
    modifiers?: any;
    notes?: string;
  }[];
  payments: {
    paymentMethod: PaymentMethod;
    paymentChannel?: string;
    amount: number;
    referenceNumber?: string;
  }[];
}

@Injectable()
export class TransactionsService {
  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
    private promotionsService: PromotionsService,
    private membersService: MembersService,
  ) {}

  private generateTrxNumber(outletCode: string): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TRX-${outletCode}-${dateStr}-${timeStr}-${randomSuffix}`;
  }

  async processTransaction(dto: CreateTransactionDto, cashierUserId: string, companyId: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Item belanja tidak boleh kosong');
    }

    const outlet = await (this.prisma.outlet.findFirst
      ? this.prisma.outlet.findFirst({ where: { id: dto.outletId, companyId, deletedAt: null } })
      : this.prisma.outlet.findUnique({ where: { id: dto.outletId } }));
    if (!outlet) throw new NotFoundException('Outlet tidak ditemukan atau bukan milik perusahaan Anda');

    // 1. Validasi Shift
    const shift = await (this.prisma.shift.findFirst
      ? this.prisma.shift.findFirst({ where: { id: dto.shiftId, outletId: dto.outletId, status: 'OPEN' } })
      : this.prisma.shift.findUnique({ where: { id: dto.shiftId } }));
    if (!shift || shift.status !== 'OPEN') {
      throw new BadRequestException('Shift kasir belum dibuka atau sudah ditutup');
    }

    // 2. Ambil detail produk untuk perhitungan subtotal & HPP di server (menghindari manipulasi client)
    const productIds = dto.items.map((i) => i.productId);
    const dbProducts = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        variants: true,
        outletConfigs: { where: { outletId: dto.outletId } },
      },
    });

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    let calculatedSubtotal = 0;
    const finalItems: any[] = [];

    for (const item of dto.items) {
      const prod = productMap.get(item.productId);
      if (!prod) throw new NotFoundException(`Produk ID ${item.productId} tidak ditemukan`);

      let unitPrice = Number(prod.sellPrice);
      const outletCfg = prod.outletConfigs[0];
      if (outletCfg?.sellPriceOverride !== null && outletCfg?.sellPriceOverride !== undefined) {
        unitPrice = Number(outletCfg.sellPriceOverride);
      }

      if (item.productVariantId) {
        const variant = prod.variants.find((v) => v.id === item.productVariantId);
        if (variant && variant.sellPriceOverride !== null) {
          unitPrice = Number(variant.sellPriceOverride);
        }
      }

      // Tambahkan harga modifier jika ada
      let modPriceAdd = 0;
      if (item.modifiers && Array.isArray(item.modifiers)) {
        for (const m of item.modifiers) {
          if (m.priceAdd) modPriceAdd += Number(m.priceAdd);
        }
      }

      const effectiveUnitPrice = unitPrice + modPriceAdd;
      const lineSubtotal = effectiveUnitPrice * item.qty;
      calculatedSubtotal += lineSubtotal;

      finalItems.push({
        productId: prod.id,
        productVariantId: item.productVariantId || null,
        name: prod.name,
        qty: item.qty,
        unitPrice: effectiveUnitPrice,
        unitCogs: Number(prod.cogs),
        discountAmount: 0,
        subtotal: lineSubtotal,
        modifiers: item.modifiers || null,
        notes: item.notes || null,
      });
    }

    // 3. Evaluasi Promo & Diskon Otomatis via Promotions Engine
    const promoResult = await this.promotionsService.evaluatePromotions({
      outletId: dto.outletId,
      companyId,
      memberId: dto.memberId,
      voucherCode: dto.voucherCode,
      items: finalItems,
    });

    let totalDiscount = promoResult.finalDiscount;

    // Tambah diskon tukar poin jika ada
    let pointsDiscount = 0;
    if (dto.memberId && dto.pointsToRedeem && dto.pointsToRedeem > 0) {
      pointsDiscount = dto.pointsToRedeem * 1000;
      totalDiscount += pointsDiscount;
    }

    // Subtotal setelah diskon
    const discountedSubtotal = Math.max(0, calculatedSubtotal - totalDiscount);

    // 4. Kalkulasi Pajak & Service Charge
    // Pajak dapat disetting aktif/nonaktif di level Outlet atau di-override per transaksi
    const isTaxActive = (dto.applyTax !== undefined ? dto.applyTax : (outlet.isTaxEnabled ?? true)) && Number(outlet.taxRate || 0) > 0;
    const taxRate = isTaxActive ? Number(outlet.taxRate || 0) : 0;
    const serviceRate = Number(outlet.serviceChargeRate || 0);

    let taxAmount = 0;
    let serviceChargeAmount = 0;
    let totalAmount = discountedSubtotal;

    if (taxRate > 0) {
      if (outlet.isTaxInclusive) {
        taxAmount = discountedSubtotal - (discountedSubtotal / (1 + taxRate));
        totalAmount = discountedSubtotal;
      } else {
        serviceChargeAmount = discountedSubtotal * serviceRate;
        taxAmount = (discountedSubtotal + serviceChargeAmount) * taxRate;
        totalAmount = discountedSubtotal + serviceChargeAmount + taxAmount;
      }
    } else {
      serviceChargeAmount = discountedSubtotal * serviceRate;
      totalAmount = discountedSubtotal + serviceChargeAmount;
    }

    // Pembulatan
    let roundingAmount = 0;
    if (outlet.roundingMode === 'nearest_500') {
      const rounded = Math.round(totalAmount / 500) * 500;
      roundingAmount = rounded - totalAmount;
      totalAmount = rounded;
    }

    // 5. Validasi Pembayaran
    const totalPaid = dto.payments.reduce((acc, p) => acc + Number(p.amount), 0);
    if (totalPaid < totalAmount) {
      throw new BadRequestException(`Nominal pembayaran kurang. Total: ${totalAmount}, Dibayar: ${totalPaid}`);
    }

    const trxNumber = this.generateTrxNumber(outlet.code);

    // 6. Simpan transaksi secara Atomic
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          companyId,
          outletId: dto.outletId,
          shiftId: dto.shiftId,
          cashierUserId,
          memberId: dto.memberId || null,
          transactionNumber: trxNumber,
          orderType: dto.orderType,
          tableNumber: dto.tableNumber || null,
          status: 'PAID',
          subtotal: calculatedSubtotal,
          discountAmount: totalDiscount,
          taxAmount,
          serviceChargeAmount,
          roundingAmount,
          totalAmount,
          notes: dto.notes,
          items: {
            create: finalItems,
          },
          payments: {
            create: dto.payments.map((p) => ({
              paymentMethod: p.paymentMethod,
              paymentChannel: p.paymentChannel || null,
              amount: p.amount,
              referenceNumber: p.referenceNumber || null,
              status: 'PAID',
            })),
          },
          appliedPromos: {
            create: promoResult.appliedDiscounts.map((d) => ({
              promotionId: d.promotionId,
              voucherId: d.voucherId || null,
              discountAmount: d.discountAmount,
            })),
          },
        },
        include: {
          items: true,
          payments: true,
          outlet: true,
          appliedPromos: true,
        },
      });

      // Potong saldo poin member jika tukar poin
      if (dto.memberId && dto.pointsToRedeem && dto.pointsToRedeem > 0) {
        await this.membersService.redeemPoints(dto.memberId, dto.pointsToRedeem, transaction.id, tx);
      }

      // Update kuota voucher jika dipakai
      if (dto.voucherCode) {
        await tx.voucher.updateMany({
          where: { code: dto.voucherCode.trim().toUpperCase() },
          data: { usedCount: { increment: 1 } },
        });
      }

      // Proses loyalty member (Points, Stamps, Tier Upgrade)
      if (dto.memberId) {
        await this.membersService.processLoyaltyAfterPayment(dto.memberId, transaction.id, totalAmount, tx);
      }

      // 6. Mutasi Stok Otomatis saat Penjualan (OUT) di dalam transaksi induk yang sama (tx)
      const loc = await this.inventoryService.getOrCreateOutletLocation(dto.outletId, companyId, tx);
      for (const item of dto.items) {
        const prod = productMap.get(item.productId);
        if (prod && prod.isTrackStock) {
          const recipe = await tx.recipe.findUnique({
            where: { productId: prod.id },
            include: { items: true },
          });

          if (recipe && recipe.items.length > 0) {
            for (const rItem of recipe.items) {
              const deductQty = (Number(rItem.qty) / Number(recipe.yieldQty || 1)) * item.qty;
              await this.inventoryService.mutateStock(
                loc.id,
                rItem.ingredientProductId,
                -deductQty,
                MovementType.OUT,
                ReferenceType.TRANSACTION,
                transaction.transactionNumber,
                0,
                `Pemakaian resep penjualan ${transaction.transactionNumber}`,
                undefined,
                undefined,
                tx,
              );
            }
          } else {
            await this.inventoryService.mutateStock(
              loc.id,
              prod.id,
              -item.qty,
              MovementType.OUT,
              ReferenceType.TRANSACTION,
              transaction.transactionNumber,
              Number(prod.cogs || 0),
              `Penjualan ${transaction.transactionNumber}`,
              undefined,
              undefined,
              tx,
            );
          }
        }
      }

      return transaction;
    });
  }

  async voidTransaction(id: string, reason: string, cashierUserId: string) {
    const trx = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        items: true,
        pointLogs: true,
      },
    });
    if (!trx) throw new NotFoundException('Transaksi tidak ditemukan');
    if (trx.status === 'VOID') throw new BadRequestException('Transaksi sudah dalam status VOID');

    return this.prisma.$transaction(async (tx) => {
      // 1. Kembalikan stok bahan / produk yang terpotong saat transaksi
      const loc = await this.inventoryService.getOrCreateOutletLocation(trx.outletId, trx.companyId, tx);
      for (const item of trx.items) {
        const prod = await tx.product.findUnique({ where: { id: item.productId } });
        if (prod && prod.isTrackStock) {
          const recipe = await tx.recipe.findUnique({
            where: { productId: prod.id },
            include: { items: true },
          });

          if (recipe && recipe.items.length > 0) {
            for (const rItem of recipe.items) {
              const returnQty = (Number(rItem.qty) / Number(recipe.yieldQty || 1)) * Number(item.qty);
              await this.inventoryService.mutateStock(
                loc.id,
                rItem.ingredientProductId,
                returnQty,
                MovementType.IN,
                ReferenceType.ADJUSTMENT,
                trx.transactionNumber,
                0,
                `Pengembalian stok void transaksi ${trx.transactionNumber}`,
                undefined,
                undefined,
                tx,
              );
            }
          } else {
            await this.inventoryService.mutateStock(
              loc.id,
              prod.id,
              Number(item.qty),
              MovementType.IN,
              ReferenceType.ADJUSTMENT,
              trx.transactionNumber,
              Number(prod.cogs || 0),
              `Pengembalian stok void transaksi ${trx.transactionNumber}`,
              undefined,
              undefined,
              tx,
            );
          }
        }
      }

      // 2. Refund poin loyalty member jika ada yang di-redeem
      const redeemedLog = trx.pointLogs?.find((p) => p.type === 'REDEEM');
      if (redeemedLog && trx.memberId) {
        const refundedPoints = Math.abs(Number(redeemedLog.points));
        await tx.memberPoint.create({
          data: {
            memberId: trx.memberId,
            transactionId: trx.id,
            type: 'EARN',
            points: refundedPoints,
            balanceAfter: 0,
            notes: `Pengembalian ${refundedPoints} poin dari void transaksi ${trx.transactionNumber}`,
          },
        });
        await tx.member.update({
          where: { id: trx.memberId },
          data: { totalPoints: { increment: refundedPoints } },
        });
      }

      // 3. Batalkan transaksi
      return tx.transaction.update({
        where: { id },
        data: {
          status: 'VOID',
          voidReason: reason,
          voidedAt: new Date(),
        },
      });
    });
  }

  // 7. Generator QRIS Dinamis & Simulasi Pembayaran Digital
  generateQris(amount: number, outletCode?: string, orderRef?: string) {
    if (amount <= 0) {
      throw new BadRequestException('Nominal QRIS harus lebih besar dari 0');
    }

    const ref = orderRef || `QRIS-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const code = outletCode || 'POS';
    const amountStr = Math.round(amount).toString();
    const lenStr = amountStr.length < 10 ? `0${amountStr.length}` : `${amountStr.length}`;

    // Payload standar EMVCo QRIS Statis/Dinamis Nasional Indonesia
    const qrisPayload = `00020101021226670014ID.LINKAJA.WWW011893600911000000000002150000000000000000303UMI51440014ID.OR.GPN.WWW02150000000000000000303UMI52045812530336054${lenStr}${amountStr}5802ID5914MOKA POS ${code}6007JAKARTA610512340620703POS6304C8F1`;

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // Berlaku 15 menit

    return {
      referenceId: ref,
      amount,
      qrisString: qrisPayload,
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrisPayload)}`,
      expiresAt,
      status: 'PENDING',
    };
  }

  simulateQrisPayment(referenceId: string) {
    if (!referenceId) {
      throw new BadRequestException('ID Referensi QRIS wajib disertakan');
    }
    return {
      referenceId,
      status: 'PAID',
      paidAt: new Date(),
      message: 'Pembayaran QRIS berhasil disimulasikan',
    };
  }

  // 8. Batch Sync Transaksi Kasir Offline (Outbox Synchronization Idempotent)
  async syncOfflineTransactions(
    items: Array<CreateTransactionDto & { clientTransactionId: string; offlineCreatedAt?: string }>,
    cashierUserId: string,
    companyId: string,
  ) {
    if (!items || items.length === 0) {
      return { total: 0, synced: 0, skipped: 0, transactions: [] };
    }

    const results = [];
    let syncedCount = 0;
    let skippedCount = 0;

    for (const item of items) {
      const clientTxId = item.clientTransactionId;

      // Cek Idempotensi: Apakah transaksi offline ini sudah pernah tersinkron?
      const existing = await this.prisma.transaction.findFirst({
        where: {
          companyId,
          outletId: item.outletId,
          notes: { contains: `[OFFLINE_ID:${clientTxId}]` },
        },
      });

      if (existing) {
        skippedCount++;
        results.push({
          clientTransactionId: clientTxId,
          status: 'ALREADY_SYNCED',
          transactionId: existing.id,
          transactionNumber: existing.transactionNumber,
        });
        continue;
      }

      // Tandai catatan dengan OFFLINE_ID agar aman jika terjadi resend
      const enrichedNotes = item.notes
        ? `${item.notes} [OFFLINE_ID:${clientTxId}]`
        : `[OFFLINE_ID:${clientTxId}]`;

      try {
        const created = await this.processTransaction(
          { ...item, notes: enrichedNotes },
          cashierUserId,
          companyId,
        );
        syncedCount++;
        results.push({
          clientTransactionId: clientTxId,
          status: 'SUCCESS',
          transactionId: created.id,
          transactionNumber: created.transactionNumber,
        });
      } catch (err: any) {
        results.push({
          clientTransactionId: clientTxId,
          status: 'FAILED',
          error: err.message,
        });
      }
    }

    return {
      total: items.length,
      synced: syncedCount,
      skipped: skippedCount,
      transactions: results,
    };
  }
}
