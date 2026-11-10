import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { ProductsService } from './products.service.js';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get('catalog')
  async getCatalog(@Request() req: any) {
    const outletId = req.user.currentOutletId || req.user.assignedOutletIds?.[0];
    return this.productsService.getCatalogForOutlet(outletId, req.user.companyId);
  }

  @Get('catalog/:outletId')
  async getCatalogByOutlet(@Param('outletId') outletId: string, @Request() req: any) {
    return this.productsService.getCatalogForOutlet(outletId, req.user.companyId);
  }
}
