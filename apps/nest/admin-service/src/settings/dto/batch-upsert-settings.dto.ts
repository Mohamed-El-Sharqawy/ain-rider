import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class BatchSettingItem {
  @ApiProperty()
  key: string;

  @ApiProperty()
  value: unknown;

  @ApiProperty({ required: false })
  type?: string;

  @ApiProperty({ required: false })
  category?: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false })
  isPublic?: boolean;
}

export class BatchUpsertSettingsDto {
  @ApiProperty({ type: [BatchSettingItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchSettingItem)
  settings: BatchSettingItem[];
}
