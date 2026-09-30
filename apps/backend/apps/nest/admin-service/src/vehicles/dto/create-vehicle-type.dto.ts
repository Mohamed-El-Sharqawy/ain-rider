import { IsString, IsNumber, IsInt, IsOptional, IsBoolean, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVehicleTypeDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  type: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  baseFare: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  perKmRate: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  perMinuteRate: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  minFare: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  maxPassengers: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
