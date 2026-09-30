import { IsString, IsInt, Min, Max } from "class-validator";

export class RegisterVehicleDto {
  @IsString()
  make: string;

  @IsString()
  model: string;

  @IsInt()
  @Min(new Date().getFullYear() - 20)
  @Max(new Date().getFullYear() + 1)
  year: number;

  @IsString()
  color: string;

  @IsString()
  plateNumber: string;
}
