import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { email: string; pass: string }) {
    return this.authService.loginDashboard(body.email, body.pass);
  }

  @Post('login-pin')
  async loginPin(@Body() body: { outletId: string; pin: string; cashierUserId?: string }) {
    return this.authService.loginCashierPin(body.outletId, body.pin, body.cashierUserId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getProfile(@Request() req: any) {
    return { data: req.user };
  }
}
