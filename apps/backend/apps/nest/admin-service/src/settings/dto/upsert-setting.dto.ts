import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertSettingDto {
  @ApiProperty()
  @IsOptional()
  value: unknown;

  @ApiPropertyOptional({ enum: ['STRING', 'NUMBER', 'BOOLEAN', 'JSON'] })
  @IsOptional()
  @IsString()
  @IsEnum(['STRING', 'NUMBER', 'BOOLEAN', 'JSON'])
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
