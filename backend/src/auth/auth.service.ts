import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // Login Dashboard (Owner, HQ, Manager) via Email & Password
  async loginDashboard(email: string, pass: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { company: true },
    });

    if (!user || !user.passwordHash || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Email atau kata sandi tidak valid');
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Email atau kata sandi tidak valid');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      companyId: user.companyId,
      role: user.role,
      type: 'dashboard',
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: {
          id: user.company.id,
          name: user.company.name,
          currency: user.company.currencyCode,
        },
      },
    };
  }

  // Login Kasir POS App via Kasir ID (atau Operator ID) & PIN 6-digit
  async loginCashierPin(outletId: string, pin: string, cashierUserId?: string) {
    if (!pin || pin.length < 4) {
      throw new BadRequestException('Format PIN tidak valid');
    }

    const outlet = await this.prisma.outlet.findUnique({
      where: { id: outletId },
      include: { company: true },
    });

    if (!outlet || !outlet.isActive || outlet.deletedAt) {
      throw new UnauthorizedException('Outlet tidak ditemukan atau non-aktif');
    }

    // Jika cashierUserId diberikan, lakukan single lookup tanpa N+1 loop
    let matchedUser = null;
    if (cashierUserId) {
      const assignment = await this.prisma.userOutletAssignment.findUnique({
        where: {
          userId_outletId: { userId: cashierUserId, outletId },
        },
        include: { user: true },
      });

      if (assignment?.user && assignment.user.pinHash && assignment.user.isActive && !assignment.user.deletedAt) {
        const ok = await bcrypt.compare(pin, assignment.user.pinHash);
        if (ok) matchedUser = assignment.user;
      }
    } else {
      // Fallback backward-compatible: periksa kasir yang di-assign ke outlet
      const assignments = await this.prisma.userOutletAssignment.findMany({
        where: { outletId },
        include: { user: true },
        take: 10,
      });

      for (const item of assignments) {
        if (item.user && item.user.pinHash && item.user.isActive && !item.user.deletedAt) {
          const ok = await bcrypt.compare(pin, item.user.pinHash);
          if (ok) {
            matchedUser = item.user;
            break;
          }
        }
      }
    }

    if (!matchedUser) {
      throw new UnauthorizedException('PIN kasir tidak cocok untuk outlet ini');
    }

    // Cek apakah ada shift aktif
    const activeShift = await this.prisma.shift.findFirst({
      where: {
        outletId,
        cashierUserId: matchedUser.id,
        status: 'OPEN',
      },
      orderBy: { openedAt: 'desc' },
    });

    const payload = {
      sub: matchedUser.id,
      companyId: outlet.companyId,
      outletId: outlet.id,
      role: matchedUser.role,
      type: 'cashier',
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: matchedUser.id,
        name: matchedUser.name,
        role: matchedUser.role,
      },
      outlet: {
        id: outlet.id,
        name: outlet.name,
        code: outlet.code,
        taxRate: Number(outlet.taxRate),
        serviceChargeRate: Number(outlet.serviceChargeRate),
        isTaxInclusive: outlet.isTaxInclusive,
        timezone: outlet.timezone,
      },
      activeShift: activeShift
        ? {
            id: activeShift.id,
            openedAt: activeShift.openedAt,
            openingCash: Number(activeShift.openingCash),
          }
        : null,
    };
  }
}
