import { Module } from '@nestjs/common';
import { PromotionsService } from './promotions.service.js';
import { PromotionsController } from './promotions.controller.js';

@Module({
  providers: [PromotionsService],
  controllers: [PromotionsController],
  exports: [PromotionsService],
})
export class PromotionsModule {}
