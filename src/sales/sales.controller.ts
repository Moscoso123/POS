import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('sales')
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  create(@Body() createSaleDto: CreateSaleDto, @Request() req) {
    return this.salesService.create(createSaleDto, req.user.userId);
  }

  @Get()
  findAll(@Query('page') page = 1, @Query('limit') limit = 10) {
    return this.salesService.findAll(+page, +limit);
  }

  @Get('stats')
  getStats(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.salesService.getSalesStats(start, end);
  }

  @Get('top-staff')
  getTopStaff(@Query('limit') limit = 5, @Query('startDate') startDate?: string) {
    const start = startDate ? new Date(startDate) : undefined;
    return this.salesService.getTopStaff(+limit, start);
  }

  @Get('daily-revenue')
  getDailyRevenue(@Query('days') days = 14) {
    return this.salesService.getDailyRevenue(+days);
  }

  @Get('by-category')
  getSalesByCategory(@Query('startDate') startDate?: string) {
    const start = startDate ? new Date(startDate) : undefined;
    return this.salesService.getSalesByCategory(start);
  }

  @Get('inventory-by-category')
  getInventoryByCategory() {
    return this.salesService.getInventoryByCategory();
  }

  @Get('top-products')
  getTopProducts(@Query('limit') limit = 5) {
    return this.salesService.getTopProducts(+limit);
  }

  @Get('top-categories')
  getTopCategories(@Query('limit') limit = 5) {
    return this.salesService.getTopCategories(+limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.salesService.findOne(id);
  }

  @Post('reset-all')
  @UseGuards(RolesGuard)
  @Roles('admin')
  resetAll() {
    return this.salesService.resetAll();
  }
}