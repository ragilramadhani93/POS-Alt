import { Module } from '@nestjs/common';
import { OutletsService } from './outlets.service.js';
import { OutletsController } from './outlets.controller.js';

@Module({
  providers: [OutletsService],
  controllers: [OutletsController],
  exports: [OutletsService],
})
export class OutletsModule {}
