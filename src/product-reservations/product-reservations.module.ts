import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../products/entities/products.entity';
import { ProductReservation } from './entities/product-reservation.entity';
import { ProductReservationsController } from './product-reservations.controller';
import { ProductReservationsService } from './product-reservations.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProductReservation, Product])],
  controllers: [ProductReservationsController],
  providers: [ProductReservationsService],
  exports: [ProductReservationsService],
})
export class ProductReservationsModule {}
