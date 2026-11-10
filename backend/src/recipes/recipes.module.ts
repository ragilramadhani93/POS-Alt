import { Module } from '@nestjs/common';
import { RecipesService } from './recipes.service.js';
import { RecipesController } from './recipes.controller.js';
import { InventoryModule } from '../inventory/inventory.module.js';

@Module({
  imports: [InventoryModule],
  providers: [RecipesService],
  controllers: [RecipesController],
  exports: [RecipesService],
})
export class RecipesModule {}
