import { IsString, IsNumber, IsEnum, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RateTripDto {
  @ApiProperty({ enum: ['rider', 'driver'] })
  @IsString()
  @IsEnum(['rider', 'driver'])
  ratedBy: 'rider' | 'driver';

  @ApiProperty()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;
}
