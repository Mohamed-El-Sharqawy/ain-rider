import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestOtpDto {
  @ApiProperty({ example: '+201001234567', description: 'Egyptian phone number in +20 format' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+20(1[0125]\d{8})$/, {
    message: 'phone must be an Egyptian mobile number in +20 format, e.g. +201001234567',
  })
  phone: string;
}
