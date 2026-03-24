import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateComplaintDto {
  @ApiProperty()
  @IsString()
  @IsUUID()
  complainantId: string;

  @ApiProperty()
  @IsString()
  @IsEnum(['RIDER', 'DRIVER', 'ADMIN'])
  complainantRole: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  againstUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  tripId?: string;

  @ApiProperty()
  @IsString()
  type: string;

  @ApiProperty()
  @IsString()
  subject: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  evidence?: unknown;
}
