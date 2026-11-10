import { Controller, Post, Get, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { PromotionsService } from './promotions.service.js';
import type { EvaluatePromoContext } from './promotions.service.js';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('promotions')
export class PromotionsController {
  constructor(private promotionsService: PromotionsService) {}

  @Post('calculate')
  async calculate(@Body() ctx: EvaluatePromoContext, @Request() req: any) {
    return this.promotionsService.evaluatePromotions({
      ...ctx,
      companyId: req.user.companyId,
    });
  }

  @Post()
  async createPromo(@Body() data: any, @Request() req: any) {
    return this.promotionsService.createPromotion(data, req.user.companyId);
  }

  @Post('vouchers')
  async createVoucher(@Body() data: any, @Request() req: any) {
    return this.promotionsService.createVoucher(data, req.user.companyId);
  }
}
