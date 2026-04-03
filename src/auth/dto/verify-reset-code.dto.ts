import { IsString, Length } from 'class-validator';

export class VerifyResetCodeDto {
  @IsString()
  @Length(6, 6)
  code: string;
}
