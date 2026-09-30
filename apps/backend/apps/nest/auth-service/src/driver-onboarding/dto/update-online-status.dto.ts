import { IsBoolean } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateOnlineStatusDto {
  @ApiProperty({
    description: "Whether the driver is online and searching for trips",
    example: true,
  })
  @IsBoolean()
  isOnline: boolean;
}
