import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateComplaintStatusDto {
  @ApiProperty()
  @IsString()
  @IsEnum(['PENDING', 'IN_PROGRESS', 'RESOLVED'])
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resolution?: string;
}
