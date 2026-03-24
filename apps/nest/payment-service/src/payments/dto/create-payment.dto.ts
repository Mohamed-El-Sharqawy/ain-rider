import { IsString, IsNumber, IsUUID, IsEnum, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty()
  @IsString()
  @IsUUID()
  tripId: string;

  @ApiProperty()
  @IsString()
  @IsUUID()
  riderId: string;

  @ApiProperty()
  @IsString()
  @IsUUID()
  driverId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ enum: ['CASH'], default: 'CASH', description: 'Currently only CASH is supported' })
  @IsString()
  @IsEnum(['CASH'])
  paymentMethod: string;
}
