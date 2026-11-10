import { Controller, Post, Get, Body, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { ShiftsService } from './shifts.service.js';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('shifts')
export class ShiftsController {
  constructor(private shiftsService: ShiftsService) {}

  @Get('active')
  async getActive(@Request() req: any) {
    const outletId = req.user.currentOutletId || req.user.assignedOutletIds?.[0];
    return this.shiftsService.getActiveShift(outletId, req.user.id);
  }

  @Post('open')
  async openShift(@Body() body: { openingCash: number; notes?: string }, @Request() req: any) {
    const outletId = req.user.currentOutletId || req.user.assignedOutletIds?.[0];
    if (!outletId) {
      throw new BadRequestException('ID Outlet belum ditentukan');
    }
    return this.shiftsService.openShift(outletId, req.user.id, body.openingCash, body.notes);
  }

  @Post(':id/close')
  async closeShift(
    @Param('id') id: string,
    @Body() body: { closingCash: number; notes?: string },
    @Request() req: any,
  ) {
    return this.shiftsService.closeShift(id, body.closingCash, body.notes, req.user.id, req.user.role);
  }
}
