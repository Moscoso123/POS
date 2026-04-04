import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto/create-product.dto';
import { InventoryAdjustmentDto } from './dto/inventory-adjustment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  create(@Body() createProductDto: CreateProductDto, @Request() req) {
    return this.productsService.create(createProductDto, req.user.userId);
  }

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get('low-stock')
  findLowStock() {
    return this.productsService.findAllWithLowStock();
  }

  @Get('stats')
  getStats() {
    return this.productsService.getDashboardStats();
  }

  @Get('inventory/transactions')
  getInventoryTransactions() {
    return this.productsService.getRecentInventoryTransactions();
  }

  @Get('inventory/chart')
  getInventoryChartData(@Query('days') days?: string) {
    const numDays = days ? parseInt(days, 10) : 30;
    return this.productsService.getInventoryChartData(numDays);
  }

  @Post('inventory/adjust')
  @UseGuards(RolesGuard)
  @Roles('admin')
  adjustInventory(@Body() dto: InventoryAdjustmentDto, @Request() req) {
    return this.productsService.adjustInventory(dto, req.user.userId);
  }

  @Get(':id/history')
  getProductHistory(@Param('id') id: string) {
    return this.productsService.getProductHistory(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}