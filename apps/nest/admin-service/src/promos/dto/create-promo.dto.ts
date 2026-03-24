import { IsString, IsNumber, IsOptional, IsEnum, IsDateString, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePromoDto {
  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty({ enum: ['PERCENTAGE', 'FIXED'] })
  @IsString()
  @IsEnum(['PERCENTAGE', 'FIXED'])
  type: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  value: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  minTripAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsagePerUser?: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  totalUsageLimit: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiProperty()
  @IsString()
  description: string;
}
