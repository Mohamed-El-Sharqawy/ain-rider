import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TripStatus } from '@ain-rider/shared-types';

export class UpdateTripStatusDto {
  @ApiProperty({ enum: ['PENDING', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] })
  @IsString()
  @IsEnum(TripStatus)
  status: TripStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  driverId?: string;
}
