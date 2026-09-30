import { IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestOtpDto {
  @ApiProperty({ example: '+9647501234567', description: 'Phone number' })
  @IsString()
  @IsNotEmpty()
  @Length(8, 15)
  phone: string;
}
