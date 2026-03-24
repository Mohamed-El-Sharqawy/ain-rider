import { IsArray, ValidateNested, IsString, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class BatchSettingItem {
  @ApiProperty()
  @IsString()
  key: string;

  @ApiProperty()
  value: unknown;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class BatchUpsertSettingsDto {
  @ApiProperty({ type: [BatchSettingItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchSettingItem)
  settings: BatchSettingItem[];
}
