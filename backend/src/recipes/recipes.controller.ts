import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { RecipesService } from './recipes.service.js';
import type { CreateRecipeDto } from './recipes.service.js';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('recipes')
export class RecipesController {
  constructor(private recipesService: RecipesService) {}

  @Post()
  async upsert(@Body() dto: CreateRecipeDto, @Request() req: any) {
    return this.recipesService.upsertRecipe(dto, req.user.companyId);
  }

  @Get(':id/cost')
  async getCost(@Param('id') id: string) {
    const cost = await this.recipesService.calculateRecipeCost(id);
    return { recipeId: id, calculatedHpp: cost };
  }

  @Post('produce')
  async produce(
    @Body() body: { productId: string; batchesCount: number; notes?: string; outletId?: string },
    @Request() req: any,
  ) {
    const outletId = body.outletId || req.user.currentOutletId || req.user.assignedOutletIds?.[0];
    return this.recipesService.executeProduction(
      outletId,
      req.user.companyId,
      req.user.id,
      body.productId,
      body.batchesCount,
      body.notes,
    );
  }
}
