import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendSmsDto {
  @ApiProperty({ example: '+201001234567' })
  @IsString()
  @Matches(/^\+20(1[0125]\d{8})$/, {
    message: 'phoneNumber must be an Egyptian mobile number in +20 format, e.g. +201001234567',
  })
  phoneNumber: string;

  @ApiProperty()
  @IsString()
  message: string;
}
