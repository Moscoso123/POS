import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';
import { Sale } from '../sales/entities/sales.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { Product } from '../products/entities/products.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Sale, SaleItem, Product])],
  controllers: [StatisticsController],
  providers: [StatisticsService],
})
export class StatisticsModule {}
