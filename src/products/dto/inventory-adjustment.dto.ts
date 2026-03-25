import { IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class InventoryAdjustmentDto {
  @IsUUID()
  productId: string;

  @IsIn(['purchase', 'return', 'adjustment'])
  transactionType: string;

  @IsInt()
  @Min(0)
  quantity: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
