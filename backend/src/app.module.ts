import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { OutletsModule } from './outlets/outlets.module.js';
import { ProductsModule } from './products/products.module.js';
import { ShiftsModule } from './shifts/shifts.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { RecipesModule } from './recipes/recipes.module.js';
import { WasteModule } from './waste/waste.module.js';
import { GoodReceiveModule } from './good-receive/good-receive.module.js';
import { StockTransferModule } from './stock-transfer/stock-transfer.module.js';
import { PromotionsModule } from './promotions/promotions.module.js';
import { MembersModule } from './members/members.module.js';
import { KdsModule } from './kds/kds.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    OutletsModule,
    ProductsModule,
    ShiftsModule,
    TransactionsModule,
    ReportsModule,
    InventoryModule,
    RecipesModule,
    WasteModule,
    GoodReceiveModule,
    StockTransferModule,
    PromotionsModule,
    MembersModule,
    KdsModule,
  ],
})
export class AppModule {}
