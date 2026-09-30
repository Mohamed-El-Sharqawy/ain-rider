import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({ example: '+201001234567', description: 'Egyptian phone number in +20 format' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+20(1[0125]\d{8})$/, {
    message: 'phone must be an Egyptian mobile number in +20 format, e.g. +201001234567',
  })
  phone: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP code' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'code must be exactly 6 digits' })
  code: string;
}
