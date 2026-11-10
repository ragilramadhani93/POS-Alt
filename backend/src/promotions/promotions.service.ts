import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PromoType, PromoScope } from '@prisma/client';

export interface EvaluatePromoItem {
  productId: string;
  categoryId?: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
}

export interface EvaluatePromoContext {
  outletId: string;
  companyId: string;
  memberId?: string;
  voucherCode?: string;
  items: EvaluatePromoItem[];
}

export interface AppliedDiscount {
  promotionId: string;
  promoName: string;
  voucherId?: string;
  discountAmount: number;
  type: string;
}

@Injectable()
export class PromotionsService {
  constructor(private prisma: PrismaService) {}

  // 1. Evaluasi Promo & Voucher Otomatis (Deterministic Stacking Engine)
  async evaluatePromotions(ctx: EvaluatePromoContext) {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Minggu
    const currentTimeStr = now.toTimeString().slice(0, 5); // "HH:MM"

    // Hitung subtotal awal
    const rawSubtotal = ctx.items.reduce((acc, i) => acc + i.subtotal, 0);

    // Ambil data member jika ada (untuk cek tiering)
    let member = null;
    if (ctx.memberId) {
      member = await this.prisma.member.findUnique({ where: { id: ctx.memberId } });
    }

    // Ambil voucher jika diinput kasir
    let voucher = null;
    if (ctx.voucherCode) {
      voucher = await this.prisma.voucher.findUnique({
        where: { code: ctx.voucherCode.trim().toUpperCase() },
        include: { promotion: true },
      });

      if (!voucher || !voucher.isActive || voucher.deletedAt) {
        throw new BadRequestException('Kode voucher tidak ditemukan atau sudah tidak aktif');
      }
      if (voucher.validUntil && voucher.validUntil < now) {
        throw new BadRequestException('Voucher telah kadaluwarsa');
      }
      if (voucher.maxUses && voucher.usedCount >= voucher.maxUses) {
        throw new BadRequestException('Kuota penggunaan voucher telah habis');
      }
      if (voucher.memberTierRequirement && member?.currentTier !== voucher.memberTierRequirement) {
        throw new BadRequestException(`Voucher ini khusus untuk member tier ${voucher.memberTierRequirement}`);
      }
    }

    // Ambil semua promo aktif yang relevan untuk outlet ini
    const activePromos = await this.prisma.promotion.findMany({
      where: {
        companyId: ctx.companyId,
        isActive: true,
        deletedAt: null,
        OR: [
          { outlets: { none: {} } }, // Berlaku semua outlet
          { outlets: { some: { outletId: ctx.outletId } } }, // Khusus outlet ini
        ],
      },
      orderBy: { priority: 'desc' }, // Prioritas tertinggi dihitung duluan
    });

    const appliedDiscounts: AppliedDiscount[] = [];
    let currentTotalDiscount = 0;
    let stackAllowed = true;

    // Evaluasi Voucher lebih dulu jika ada
    if (voucher?.promotion) {
      const p = voucher.promotion;
      const vDisc = this.calculateSingleDiscount(p, rawSubtotal, ctx.items);
      if (vDisc > 0) {
        appliedDiscounts.push({
          promotionId: p.id,
          promoName: `Voucher: ${voucher.code} (${p.name})`,
          voucherId: voucher.id,
          discountAmount: vDisc,
          type: 'VOUCHER',
        });
        currentTotalDiscount += vDisc;
        if (!p.isStackable) stackAllowed = false;
      }
    }

    // Evaluasi Promo Otomatis (Min Spend, Happy Hour, BOGO, Percentage)
    for (const promo of activePromos) {
      if (!stackAllowed && appliedDiscounts.length > 0) break;

      // Cek Hari & Jam (Happy Hour)
      if (promo.applicableDays && !promo.applicableDays.includes(currentDay)) continue;
      if (promo.applicableHours) {
        const hours: any = promo.applicableHours;
        if (hours.from && hours.to && (currentTimeStr < hours.from || currentTimeStr > hours.to)) {
          continue;
        }
      }

      // Cek Tanggal Berlaku
      if (promo.validFrom && promo.validFrom > now) continue;
      if (promo.validUntil && promo.validUntil < now) continue;

      // Cek Min Belanja
      if (promo.minTransaction && rawSubtotal < Number(promo.minTransaction)) continue;

      // Cek Kuota
      if (promo.quota && promo.usedCount >= promo.quota) continue;

      const discount = this.calculateSingleDiscount(promo, rawSubtotal, ctx.items);
      if (discount > 0) {
        appliedDiscounts.push({
          promotionId: promo.id,
          promoName: promo.name,
          discountAmount: discount,
          type: promo.promoType,
        });
        currentTotalDiscount += discount;

        // Jika promo tidak bisa di-stack, hentikan evaluasi promo lain
        if (!promo.isStackable) {
          break;
        }
      }
    }

    // Diskon tidak boleh melebihi subtotal
    const finalDiscount = Math.min(rawSubtotal, currentTotalDiscount);
    const finalSubtotal = rawSubtotal - finalDiscount;

    return {
      rawSubtotal,
      finalDiscount,
      finalSubtotal,
      appliedDiscounts,
    };
  }

  private calculateSingleDiscount(promo: any, subtotal: number, items: EvaluatePromoItem[]): number {
    let discount = 0;

    switch (promo.promoType) {
      case PromoType.PERCENTAGE: {
        const pct = Number(promo.discountPct || 0);
        discount = (subtotal * pct) / 100;
        if (promo.maxDiscount) {
          discount = Math.min(discount, Number(promo.maxDiscount));
        }
        break;
      }

      case PromoType.FIXED_AMOUNT: {
        discount = Number(promo.discountAmount || 0);
        break;
      }

      case PromoType.BUY_X_GET_Y: {
        // BOGO / Buy X Get Y rules: { buyProductId, buyQty, getProductId, getQty, freeDiscountPct }
        const rules: any = promo.rules;
        if (rules?.buyProductId && rules?.buyQty) {
          const targetItem = items.find((i) => i.productId === rules.buyProductId);
          if (targetItem && targetItem.qty >= rules.buyQty) {
            const multiplier = Math.floor(targetItem.qty / rules.buyQty);
            const freeQty = multiplier * (rules.getQty || 1);
            const freeItem = items.find((i) => i.productId === (rules.getProductId || rules.buyProductId));
            if (freeItem) {
              const freePct = Number(rules.freeDiscountPct || 100);
              const eligibleFreeQty = Math.min(freeQty, freeItem.qty);
              discount = (eligibleFreeQty * freeItem.unitPrice * freePct) / 100;
            }
          }
        }
        break;
      }

      case PromoType.HAPPY_HOUR: {
        // Happy hour diskon persentase
        const pct = Number(promo.discountPct || 0);
        discount = (subtotal * pct) / 100;
        break;
      }

      case PromoType.MIN_SPEND: {
        if (subtotal >= Number(promo.minTransaction || 0)) {
          discount = Number(promo.discountAmount || (subtotal * Number(promo.discountPct || 0)) / 100);
        }
        break;
      }

      default:
        discount = 0;
    }

    return discount;
  }

  // 2. Buat Promo Baru
  async createPromotion(data: any, companyId: string) {
    return this.prisma.promotion.create({
      data: {
        ...data,
        companyId,
      },
    });
  }

  // 3. Buat Voucher
  async createVoucher(data: { promotionId: string; code: string; maxUses?: number; memberTierRequirement?: string }, companyId: string) {
    return this.prisma.voucher.create({
      data: {
        companyId,
        promotionId: data.promotionId,
        code: data.code.trim().toUpperCase(),
        maxUses: data.maxUses,
        memberTierRequirement: data.memberTierRequirement,
      },
    });
  }
}
