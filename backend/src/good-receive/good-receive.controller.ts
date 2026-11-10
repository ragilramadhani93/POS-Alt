import { Controller, Post, Get, Body, Query, UseGuards, Request } from '@nestjs/common';
import { GoodReceiveService } from './good-receive.service.js';
import type { SubmitGrDto } from './good-receive.service.js';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('gr')
export class GoodReceiveController {
  constructor(private grService: GoodReceiveService) {}

  @Get('fetch-sj')
  async fetchSj(@Query('noSj') noSj: string, @Request() req: any) {
    return this.grService.fetchSjFromSheet(noSj, req.user.companyId);
  }

  @Post()
  async submitGr(@Body() dto: SubmitGrDto, @Request() req: any) {
    return this.grService.submitGoodReceive(dto, req.user.companyId);
  }

  @Get()
  async getGrList(@Query('outletId') queryOutletId: string, @Request() req: any) {
    const outletId = queryOutletId || req.user.currentOutletId || req.user.assignedOutletIds?.[0];
    return this.grService.getGoodReceives(outletId);
  }
}
