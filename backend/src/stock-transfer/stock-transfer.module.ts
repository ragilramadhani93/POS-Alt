import { Module } from '@nestjs/common';
import { StockTransferService } from './stock-transfer.service.js';
import { StockTransferController } from './stock-transfer.controller.js';
import { InventoryModule } from '../inventory/inventory.module.js';

@Module({
  imports: [InventoryModule],
  providers: [StockTransferService],
  controllers: [StockTransferController],
  exports: [StockTransferService],
})
export class StockTransferModule {}
