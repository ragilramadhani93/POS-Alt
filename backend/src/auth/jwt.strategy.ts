import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';

export interface JwtPayload {
  sub: string;
  email?: string;
  companyId: string;
  role: string;
  type: 'dashboard' | 'cashier';
  outletId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'default-pos-secret-key-32chars-min!'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        outletAssignments: true,
      },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Pengguna tidak aktif atau tidak ditemukan');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      companyId: user.companyId,
      role: user.role,
      assignedOutletIds: user.outletAssignments.map((a) => a.outletId),
      authType: payload.type,
      currentOutletId: payload.outletId,
    };
  }
}
