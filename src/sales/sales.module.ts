import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { Sale } from './entities/sales.entity';
import { SaleItem } from './entities/sale-item.entity';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [TypeOrmModule.forFeature([Sale, SaleItem]), ProductsModule],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}