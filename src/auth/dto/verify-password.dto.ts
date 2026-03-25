import { IsString, MinLength } from 'class-validator';

export class VerifyPasswordDto {
  @IsString()
  @MinLength(6)
  password: string;
}
