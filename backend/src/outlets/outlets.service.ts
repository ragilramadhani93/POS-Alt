import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class OutletsService {
  constructor(private prisma: PrismaService) {}

  async findCompanyBySlug(slug: string) {
    return this.prisma.company.findUnique({
      where: { slug },
    });
  }

  async findAll(companyId: string) {
    return this.prisma.outlet.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const outlet = await this.prisma.outlet.findUnique({
      where: { id },
    });
    if (!outlet || outlet.deletedAt) {
      throw new NotFoundException('Outlet tidak ditemukan');
    }
    return outlet;
  }

  async updateTaxSettings(
    id: string,
    dto: { isTaxEnabled?: boolean; taxRate?: number; isTaxInclusive?: boolean },
  ) {
    await this.findOne(id);
    return this.prisma.outlet.update({
      where: { id },
      data: {
        ...(dto.isTaxEnabled !== undefined && { isTaxEnabled: dto.isTaxEnabled }),
        ...(dto.taxRate !== undefined && { taxRate: dto.taxRate }),
        ...(dto.isTaxInclusive !== undefined && { isTaxInclusive: dto.isTaxInclusive }),
      },
    });
  }
}
