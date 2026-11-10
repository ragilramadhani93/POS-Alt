import { Controller, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { OutletsService } from './outlets.service.js';
import { AuthGuard } from '@nestjs/passport';

@Controller('outlets')
export class OutletsController {
  constructor(private outletsService: OutletsService) {}

  // List outlet untuk inisialisasi awal POS App sebelum login PIN
  @Get('public-list/:companySlug')
  async getPublicOutlets(@Param('companySlug') companySlug: string) {
    const company = await this.outletsService.findCompanyBySlug(companySlug);
    if (!company) return [];
    return this.outletsService.findAll(company.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async getMyOutlets(@Request() req: any) {
    return this.outletsService.findAll(req.user.companyId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  async getOutletDetail(@Param('id') id: string) {
    return this.outletsService.findOne(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/tax-settings')
  async updateTaxSettings(
    @Param('id') id: string,
    @Body() dto: { isTaxEnabled?: boolean; taxRate?: number; isTaxInclusive?: boolean },
  ) {
    return this.outletsService.updateTaxSettings(id, dto);
  }
}
