import { Module } from '@nestjs/common';
import { GoodReceiveService } from './good-receive.service.js';
import { GoodReceiveController } from './good-receive.controller.js';
import { InventoryModule } from '../inventory/inventory.module.js';

@Module({
  imports: [InventoryModule],
  providers: [GoodReceiveService],
  controllers: [GoodReceiveController],
  exports: [GoodReceiveService],
})
export class GoodReceiveModule {}
