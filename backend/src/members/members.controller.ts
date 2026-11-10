import { Controller, Post, Get, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { MembersService } from './members.service.js';
import type { RegisterMemberDto } from './members.service.js';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('members')
export class MembersController {
  constructor(private membersService: MembersService) {}

  @Post('register')
  async register(@Body() dto: RegisterMemberDto, @Request() req: any) {
    return this.membersService.registerMember(dto, req.user.companyId);
  }

  @Get('lookup')
  async lookup(@Query('phone') phone: string, @Request() req: any) {
    return this.membersService.findByPhone(phone, req.user.companyId);
  }

  @Post(':id/redeem-points')
  async redeemPoints(
    @Param('id') id: string,
    @Body('points') points: number,
  ) {
    return this.membersService.redeemPoints(id, points);
  }
}
