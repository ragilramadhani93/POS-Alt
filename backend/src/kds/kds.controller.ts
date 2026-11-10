import { Controller, Get, Patch, Param, Body, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { KdsService } from './kds.service.js';
import type { KdsStation, KdsStatus } from './kds.service.js';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('kds')
export class KdsController {
  constructor(private kdsService: KdsService) {}

  private resolveOutletId(req: any, queryOutletId?: string): string {
    const outletId = queryOutletId || req.user.currentOutletId || req.user.assignedOutletIds?.[0];
    if (!outletId) throw new BadRequestException('ID Outlet wajib disertakan');
    return outletId;
  }

  @Get('queue')
  async getQueue(
    @Query('outletId') queryOutletId: string,
    @Query('station') station: KdsStation,
    @Request() req: any,
  ) {
    const outletId = this.resolveOutletId(req, queryOutletId);
    return this.kdsService.getStationQueue(outletId, station || 'ALL');
  }

  @Patch('items/:id/status')
  async updateItemStatus(
    @Param('id') id: string,
    @Body('status') status: KdsStatus,
  ) {
    if (!status) throw new BadRequestException('Status pesanan wajib disertakan');
    return this.kdsService.updateItemStatus(id, status);
  }

  @Patch('tickets/:transactionId/status')
  async updateTicketStatus(
    @Param('transactionId') transactionId: string,
    @Body('status') status: KdsStatus,
  ) {
    if (!status) throw new BadRequestException('Status tiket wajib disertakan');
    return this.kdsService.updateTicketStatus(transactionId, status);
  }
}
