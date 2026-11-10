import { Module } from '@nestjs/common';
import { WasteService } from './waste.service.js';
import { WasteController } from './waste.controller.js';
import { InventoryModule } from '../inventory/inventory.module.js';

@Module({
  imports: [InventoryModule],
  providers: [WasteService],
  controllers: [WasteController],
  exports: [WasteService],
})
export class WasteModule {}
