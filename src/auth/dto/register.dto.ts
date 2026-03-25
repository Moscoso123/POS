import { IsEmail, IsString, MinLength, IsEnum, IsPhoneNumber, IsOptional } from 'class-validator';

export enum UserType {
  ADMIN = 'admin',
  STAFF = 'staff'
}

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsPhoneNumber()
  phoneNumber: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  businessName: string;

  @IsString()
  name: string;

  @IsEnum(UserType)
  userType: UserType;

  @IsOptional()
  @IsString()
  profilePic?: string;
}