import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ProductReservationStatus } from '../entities/product-reservation.entity';

export class UpdateProductReservationStatusDto {
  @IsEnum(ProductReservationStatus)
  status: ProductReservationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}
