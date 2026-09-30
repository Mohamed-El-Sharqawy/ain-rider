import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED', 'UNDER_REVIEW', 'PENDING_DOCUMENTS'] })
  @IsString()
  @IsEnum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED', 'UNDER_REVIEW', 'PENDING_DOCUMENTS'])
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
