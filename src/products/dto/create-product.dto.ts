import { IsString, IsNumber, IsOptional, IsBoolean, Min, MaxLength, IsDateString } from 'class-validator';

export class CreateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sku?: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost_price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stock_quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  min_stock_level?: number;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsDateString()
  expiration_date?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
export class UpdateProductDto {
  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost_price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stock_quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  min_stock_level?: number;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsDateString()
  expiration_date?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}