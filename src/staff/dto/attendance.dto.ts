import { IsString, IsOptional, IsEnum } from 'class-validator';

export class CreateAttendanceDto {
  @IsOptional()
  @IsString()
  checkIn?: string;

  @IsOptional()
  @IsEnum(['present', 'absent', 'late', 'half_day'])
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateAttendanceDto {
  @IsOptional()
  @IsString()
  checkOut?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}