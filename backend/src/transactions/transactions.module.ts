import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service.js';
import { ReceiptService } from './receipt.service.js';
import { TransactionsController } from './transactions.controller.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { PromotionsModule } from '../promotions/promotions.module.js';
import { MembersModule } from '../members/members.module.js';

@Module({
  imports: [InventoryModule, PromotionsModule, MembersModule],
  providers: [TransactionsService, ReceiptService],
  controllers: [TransactionsController],
  exports: [TransactionsService, ReceiptService],
})
export class TransactionsModule {}
