import { IsString, IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UserFiltersDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['RIDER', 'DRIVER', 'ADMIN', 'SUPPORT'] })
  @IsOptional()
  @IsString()
  @IsEnum(['RIDER', 'DRIVER', 'ADMIN', 'SUPPORT'])
  role?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED'] })
  @IsOptional()
  @IsString()
  @IsEnum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED'])
  status?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
