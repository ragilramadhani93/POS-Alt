import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { InventoryService } from './inventory.service.js';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('inventory')
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Get('balances')
  async getBalances(@Request() req: any, @Query('outletId') queryOutletId?: string) {
    const outletId = queryOutletId || req.user.currentOutletId || req.user.assignedOutletIds?.[0];
    const loc = await this.inventoryService.getOrCreateOutletLocation(outletId, req.user.companyId);
    return this.inventoryService.getStockBalances(loc.id);
  }

  @Get('movements')
  async getMovements(
    @Request() req: any,
    @Query('outletId') queryOutletId?: string,
    @Query('productId') productId?: string,
  ) {
    const outletId = queryOutletId || req.user.currentOutletId || req.user.assignedOutletIds?.[0];
    const loc = await this.inventoryService.getOrCreateOutletLocation(outletId, req.user.companyId);
    return this.inventoryService.getStockMovements(loc.id, productId);
  }

  @Post('opname')
  async executeOpname(
    @Body() dto: any,
    @Request() req: any,
  ) {
    const outletId = dto.outletId || req.user.currentOutletId || req.user.assignedOutletIds?.[0];
    return this.inventoryService.executeStockOpname(
      { ...dto, outletId },
      req.user.id,
      req.user.companyId,
    );
  }

  @Get('opname/history')
  async getOpnames(
    @Request() req: any,
    @Query('outletId') queryOutletId?: string,
  ) {
    const outletId = queryOutletId || req.user.currentOutletId || req.user.assignedOutletIds?.[0];
    return this.inventoryService.getStockOpnames(outletId);
  }
}
