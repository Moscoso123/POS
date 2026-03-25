import { IsEmail, IsString, MinLength, IsOptional, IsPhoneNumber } from 'class-validator';

export class LoginDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsPhoneNumber('PH')
  phoneNumber?: string;

  @IsString()
  @MinLength(6)
  password: string;
}