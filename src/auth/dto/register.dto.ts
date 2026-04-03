import { IsEmail, IsString, MinLength, IsEnum, IsPhoneNumber, IsOptional, Matches, MaxLength } from 'class-validator';

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
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
  })
  password: string;

  @IsString()
  @MaxLength(255)
  businessName: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsEnum(UserType)
  userType: UserType;

  @IsOptional()
  @IsString()
  profilePic?: string;
}