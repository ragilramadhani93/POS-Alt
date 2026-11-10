import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PointChangeType, StampChangeType, Prisma } from '@prisma/client';

export interface RegisterMemberDto {
  name: string;
  phone: string;
  email?: string;
  birthDate?: string;
  referralCodeUsed?: string;
}

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {}

  // 1. Pendaftaran Member Cepat (Kasir: Cukup Nama & No. HP)
  async registerMember(dto: RegisterMemberDto, companyId: string) {
    const cleanPhone = dto.phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 9) {
      throw new BadRequestException('Nomor handphone tidak valid');
    }

    const existing = await this.prisma.member.findUnique({
      where: { companyId_phone: { companyId, phone: cleanPhone } },
    });
    if (existing) {
      throw new BadRequestException('Nomor handphone ini sudah terdaftar sebagai member');
    }

    // Generate kode referral unik untuk member baru
    const randCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    const myReferralCode = `MBR-${cleanPhone.slice(-4)}-${randCode}`;

    // Cek referral jika ada yang mengajak
    let referrer = null;
    if (dto.referralCodeUsed) {
      referrer = await this.prisma.member.findUnique({
        where: { referralCode: dto.referralCodeUsed.trim().toUpperCase() },
      });
    }

    return this.prisma.member.create({
      data: {
        companyId,
        name: dto.name,
        phone: cleanPhone,
        email: dto.email,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        referralCode: myReferralCode,
        referredByMemberId: referrer?.id || null,
        currentTier: 'Silver',
      },
    });
  }

  // 2. Cari Member Berdasarkan No. HP (Untuk Kasir)
  async findByPhone(phone: string, companyId: string) {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const member = await this.prisma.member.findFirst({
      where: {
        companyId,
        phone: { contains: cleanPhone },
        deletedAt: null,
      },
      include: {
        pointsHistory: { take: 5, orderBy: { createdAt: 'desc' } },
        stampsHistory: { take: 5, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!member) {
      throw new NotFoundException('Member tidak ditemukan');
    }

    return member;
  }

  // 3. Mesin Akumulasi Loyalty (Earn Points, Stamps, Tier Upgrade)
  // Dipanggil otomatis saat transaksi status 'PAID'
  async processLoyaltyAfterPayment(memberId: string, transactionId: string, totalAmount: number, client?: Prisma.TransactionClient) {
    const db = client || this.prisma;
    const member = await db.member.findUnique({ where: { id: memberId } });
    if (!member) return;

    const op = async (tx: Prisma.TransactionClient) => {
      // 1. POIN ENGINE: Rp 10.000 = 1 Poin (Multiplier per tier: Silver 1x, Gold 1.5x, Platinum 2x)
      let multiplier = 1.0;
      if (member.currentTier === 'Gold') multiplier = 1.5;
      if (member.currentTier === 'Platinum') multiplier = 2.0;

      const earnedPoints = Math.floor(totalAmount / 10000) * multiplier;
      const newPointsBalance = Number(member.totalPoints) + earnedPoints;

      if (earnedPoints > 0) {
        await tx.memberPoint.create({
          data: {
            memberId: member.id,
            transactionId,
            type: PointChangeType.EARN,
            points: earnedPoints,
            balanceAfter: newPointsBalance,
            notes: `Earned dari transaksi Rp ${totalAmount.toLocaleString('id-ID')} (Tier: ${member.currentTier} ${multiplier}x)`,
          },
        });
      }

      // 2. STAMP ENGINE: Tiap transaksi belanja >= Rp 30.000 dapat 1 stamp (Kumpulkan 10 stamp gratis 1)
      let earnedStamps = 0;
      if (totalAmount >= 30000) {
        earnedStamps = 1;
      }
      const newStampsBalance = member.totalStamps + earnedStamps;

      if (earnedStamps > 0) {
        await tx.memberStamp.create({
          data: {
            memberId: member.id,
            transactionId,
            type: StampChangeType.EARN,
            stamps: earnedStamps,
            balanceAfter: newStampsBalance,
            notes: `Earned 1 Stamp dari transaksi`,
          },
        });
      }

      // 3. TIER ENGINE (Evaluasi Kenaikan Level Member)
      // Silver: Total Spend < Rp 1.000.000
      // Gold: Rp 1.000.000 - Rp 3.000.000
      // Platinum: > Rp 3.000.000
      const updatedTotalSpend = Number(member.totalSpend) + totalAmount;
      let targetTier = 'Silver';
      if (updatedTotalSpend >= 3000000) {
        targetTier = 'Platinum';
      } else if (updatedTotalSpend >= 1000000) {
        targetTier = 'Gold';
      }

      const tierChanged = targetTier !== member.currentTier;
      if (tierChanged) {
        await tx.memberTierHistory.create({
          data: {
            memberId: member.id,
            tierName: targetTier,
            reason: `Kenaikan tier otomatis: Total belanja akumulasi Rp ${updatedTotalSpend.toLocaleString('id-ID')}`,
          },
        });
      }

      // 4. Update Saldo & Tier Member
      return tx.member.update({
        where: { id: member.id },
        data: {
          totalPoints: newPointsBalance,
          totalStamps: newStampsBalance,
          totalSpend: updatedTotalSpend,
          currentTier: targetTier,
        },
      });
    };

    if (client) {
      return op(client);
    }
    return this.prisma.$transaction(async (tx) => op(tx));
  }

  // 4. Tukar Poin Jadi Diskon Belanja (Redeem)
  // Aturan: 1 Poin = Rp 1.000 diskon belanja
  async redeemPoints(memberId: string, pointsToRedeem: number, transactionId?: string, client?: Prisma.TransactionClient) {
    const db = client || this.prisma;
    const member = await db.member.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Member tidak ditemukan');

    if (Number(member.totalPoints) < pointsToRedeem) {
      throw new BadRequestException(`Saldo poin tidak mencukupi. Saldo: ${member.totalPoints}, Dibutuhkan: ${pointsToRedeem}`);
    }

    const discountValue = pointsToRedeem * 1000;
    const balanceAfter = Number(member.totalPoints) - pointsToRedeem;

    const op = async (tx: Prisma.TransactionClient) => {
      await tx.memberPoint.create({
        data: {
          memberId: member.id,
          transactionId: transactionId || null,
          type: PointChangeType.REDEEM,
          points: -pointsToRedeem,
          balanceAfter,
          notes: `Tukar ${pointsToRedeem} Poin menjadi diskon belanja Rp ${discountValue.toLocaleString('id-ID')}`,
        },
      });

      await tx.member.update({
        where: { id: member.id },
        data: { totalPoints: balanceAfter },
      });
    };

    if (client) {
      await op(client);
    } else {
      await this.prisma.$transaction(async (tx) => op(tx));
    }

    return {
      redeemedPoints: pointsToRedeem,
      discountValue,
      remainingPoints: balanceAfter,
    };
  }
}
