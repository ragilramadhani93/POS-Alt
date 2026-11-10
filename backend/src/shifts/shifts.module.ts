import { Module } from '@nestjs/common';
import { ShiftsService } from './shifts.service.js';
import { ShiftsController } from './shifts.controller.js';

@Module({
  providers: [ShiftsService],
  controllers: [ShiftsController],
  exports: [ShiftsService],
})
export class ShiftsModule {}
