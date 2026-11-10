import { Controller, Get, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { ReportsService } from './reports.service.js';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  private resolveOutletId(req: any, queryOutletId?: string): string {
    const outletId = queryOutletId || req.user.currentOutletId || req.user.assignedOutletIds?.[0];
    if (!outletId) throw new BadRequestException('ID Outlet wajib disertakan');
    return outletId;
  }

  @Get('sales/summary')
  async getSummary(
    @Query('outletId') queryOutletId: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Request() req: any,
  ) {
    const outletId = this.resolveOutletId(req, queryOutletId);
    return this.reportsService.getSalesSummary(outletId, dateFrom, dateTo);
  }

  @Get('sales/by-product')
  async getByProduct(
    @Query('outletId') queryOutletId: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('limit') limit: string,
    @Request() req: any,
  ) {
    const outletId = this.resolveOutletId(req, queryOutletId);
    return this.reportsService.getSalesByProduct(outletId, dateFrom, dateTo, limit ? parseInt(limit, 10) : 50);
  }

  @Get('sales/by-payment')
  async getByPayment(
    @Query('outletId') queryOutletId: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Request() req: any,
  ) {
    const outletId = this.resolveOutletId(req, queryOutletId);
    return this.reportsService.getSalesByPayment(outletId, dateFrom, dateTo);
  }

  @Get('pl')
  async getProfitAndLoss(
    @Query('outletId') queryOutletId: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Request() req: any,
  ) {
    const outletId = this.resolveOutletId(req, queryOutletId);
    return this.reportsService.getProfitAndLoss(outletId, dateFrom, dateTo);
  }
}
