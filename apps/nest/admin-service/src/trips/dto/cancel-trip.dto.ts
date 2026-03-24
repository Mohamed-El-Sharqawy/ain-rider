// ─── Cancel Trip DTO ─────────────────────────────────────────────────────────

import { IsString, IsNotEmpty } from 'class-validator';

export class CancelTripDto {
  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsNotEmpty()
  cancelledBy: string;
}
