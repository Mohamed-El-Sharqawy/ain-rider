import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadProfileImageDto {
  @ApiProperty()
  @IsString()
  fileName: string;

  @ApiProperty()
  @IsString()
  contentType: string;
}
