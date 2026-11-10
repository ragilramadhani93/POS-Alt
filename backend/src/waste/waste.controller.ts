import { Controller, Post, Get, Body, Query, UseGuards, Request } from '@nestjs/common';
import { WasteService } from './waste.service.js';
import { AuthGuard } from '@nestjs/passport';
import { WasteType } from '@prisma/client';

@UseGuards(AuthGuard('jwt'))
@Controller('waste')
export class WasteController {
  constructor(private wasteService: WasteService) {}

  @Post()
  async recordWaste(
    @Body()
    body: {
      productId: string;
      qty: number;
      reason: string;
      wasteType?: WasteType;
      photoUrl?: string;
      outletId?: string;
    },
    @Request() req: any,
  ) {
    const outletId = body.outletId || req.user.currentOutletId || req.user.assignedOutletIds?.[0];
    return this.wasteService.recordWaste(
      outletId,
      req.user.companyId,
      req.user.id,
      body.productId,
      body.qty,
      body.reason,
      body.wasteType,
      body.photoUrl,
    );
  }

  @Get()
  async getWasteList(
    @Request() req: any,
    @Query('outletId') queryOutletId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const outletId = queryOutletId || req.user.currentOutletId || req.user.assignedOutletIds?.[0];
    return this.wasteService.getWasteRecords(outletId, dateFrom, dateTo);
  }
}
