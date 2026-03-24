import { IsString, IsNumber, IsOptional, IsUUID, IsEnum, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTripDto {
  @ApiProperty()
  @IsString()
  @IsUUID()
  riderId: string;

  @ApiProperty()
  @IsNumber()
  @Min(-90)
  @Max(90)
  pickupLat: number;

  @ApiProperty()
  @IsNumber()
  @Min(-180)
  @Max(180)
  pickupLng: number;

  @ApiProperty()
  @IsString()
  pickupAddress: string;

  @ApiProperty()
  @IsNumber()
  @Min(-90)
  @Max(90)
  dropoffLat: number;

  @ApiProperty()
  @IsNumber()
  @Min(-180)
  @Max(180)
  dropoffLng: number;

  @ApiProperty()
  @IsString()
  dropoffAddress: string;

  @ApiPropertyOptional({ enum: ['CASH'], default: 'CASH', description: 'Currently only CASH is supported' })
  @IsOptional()
  @IsString()
  @IsEnum(['CASH'])
  paymentMethod?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  estimatedFare: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  promoCode?: string;
}
