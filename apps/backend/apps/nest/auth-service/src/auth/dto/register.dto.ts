import { IsEmail, IsNotEmpty, IsString, MinLength, IsEnum, Length } from 'class-validator';
import { UserRole } from '@ain-rider/shared-types';

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 15)
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  // Public registration only allows RIDER or DRIVER
  @IsEnum([UserRole.RIDER, UserRole.DRIVER])
  @IsNotEmpty()
  role: UserRole.RIDER | UserRole.DRIVER;
}
