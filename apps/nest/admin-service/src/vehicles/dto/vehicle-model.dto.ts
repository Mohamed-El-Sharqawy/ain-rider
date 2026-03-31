import { IsString, IsNotEmpty, IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateVehicleModelDto {
  @ApiProperty({ example: 'make-uuid' })
  @IsUUID()
  @IsNotEmpty()
  makeId: string;

  @ApiProperty({ example: 'Camry' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'type-uuid', required: false })
  @IsUUID()
  @IsOptional()
  vehicleTypeId?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateVehicleModelDto {
  @ApiProperty({ example: 'make-uuid', required: false })
  @IsUUID()
  @IsOptional()
  makeId?: string;

  @ApiProperty({ example: 'Camry', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'type-uuid', required: false })
  @IsUUID()
  @IsOptional()
  vehicleTypeId?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
