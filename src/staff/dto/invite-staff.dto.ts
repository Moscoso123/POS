import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class InviteStaffDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  phoneNumber: string;

  @IsOptional()
  @IsString()
  businessName?: string;
}
