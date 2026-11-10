import { Controller, Post, Get, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { StockTransferService } from './stock-transfer.service.js';
import type { CreateTransferDto } from './stock-transfer.service.js';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('transfers')
export class StockTransferController {
  constructor(private transferService: StockTransferService) {}

  @Post()
  async createTransfer(@Body() dto: CreateTransferDto, @Request() req: any) {
    return this.transferService.createTransferRequest(dto, req.user.id, req.user.companyId);
  }

  @Post(':id/ship')
  async shipTransfer(
    @Param('id') id: string,
    @Body('items') items: { itemId: string; sentQty: number }[],
    @Request() req: any,
  ) {
    return this.transferService.shipTransfer(id, req.user.id, items);
  }

  @Post(':id/receive')
  async receiveTransfer(
    @Param('id') id: string,
    @Body('items') items: { itemId: string; receivedQty: number; notes?: string }[],
  ) {
    return this.transferService.receiveTransfer(id, items);
  }

  @Get()
  async getTransfers(@Query('outletId') outletId: string) {
    return this.transferService.getTransfers(outletId);
  }
}
