import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum CancelledBy {
  RIDER = 'RIDER',
  DRIVER = 'DRIVER',
  SYSTEM = 'SYSTEM',
}

export class CancelTripDto {
  @ApiProperty({ 
    description: 'Reason for cancellation',
    example: 'Change of plans'
  })
  @IsString()
  reason: string;

  @ApiProperty({ 
    description: 'Who initiated the cancellation',
    enum: CancelledBy,
    example: CancelledBy.RIDER
  })
  @IsEnum(CancelledBy)
  cancelledBy: CancelledBy;

  @ApiProperty({ 
    description: 'Optional trace ID for tracking',
    required: false
  })
  @IsString()
  @IsOptional()
  traceId?: string;
}
