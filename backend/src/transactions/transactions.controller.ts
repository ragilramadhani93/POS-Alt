import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { TransactionsService } from './transactions.service.js';
import { ReceiptService } from './receipt.service.js';
import type { CreateTransactionDto } from './transactions.service.js';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('transactions')
export class TransactionsController {
  constructor(
    private transactionsService: TransactionsService,
    private receiptService: ReceiptService,
  ) {}

  @Post()
  async createTransaction(@Body() dto: CreateTransactionDto, @Request() req: any) {
    return this.transactionsService.processTransaction(dto, req.user.id, req.user.companyId);
  }

  @Get(':id/receipt')
  async getReceipt(
    @Param('id') id: string,
    @Query('width') width?: '58mm' | '80mm',
  ) {
    return this.receiptService.generateReceipt(id, { paperWidth: width || '58mm' });
  }

  @Post(':id/void')
  async voidTransaction(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    return this.transactionsService.voidTransaction(id, reason, req.user.id);
  }

  @Post('qris/generate')
  async generateQris(
    @Body('amount') amount: number,
    @Body('outletCode') outletCode?: string,
    @Body('orderRef') orderRef?: string,
  ) {
    return this.transactionsService.generateQris(amount, outletCode, orderRef);
  }

  @Post('qris/simulate-pay')
  async simulateQrisPay(@Body('referenceId') referenceId: string) {
    return this.transactionsService.simulateQrisPayment(referenceId);
  }

  @Post('sync')
  async syncTransactions(
    @Body('transactions') transactions: Array<CreateTransactionDto & { clientTransactionId: string; offlineCreatedAt?: string }>,
    @Request() req: any,
  ) {
    return this.transactionsService.syncOfflineTransactions(transactions, req.user.id, req.user.companyId);
  }
}
