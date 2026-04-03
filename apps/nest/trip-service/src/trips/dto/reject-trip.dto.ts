import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectTripDto {
  @ApiProperty({ description: 'Reason for rejection', required: false })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiProperty({ description: 'Optional trace ID for distributed tracing', required: false })
  @IsString()
  @IsOptional()
  traceId?: string;
}
