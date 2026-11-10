import { Module } from '@nestjs/common';
import { KdsService } from './kds.service.js';
import { KdsController } from './kds.controller.js';

@Module({
  providers: [KdsService],
  controllers: [KdsController],
  exports: [KdsService],
})
export class KdsModule {}
