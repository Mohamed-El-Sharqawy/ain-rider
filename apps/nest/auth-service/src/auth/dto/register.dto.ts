import { IsEmail, IsNotEmpty, IsString, MinLength, IsEnum, IsPhoneNumber } from 'class-validator';
import { UserRole } from '@ain-rider/shared-types';

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsPhoneNumber('IQ')
  @IsNotEmpty()
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

  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;
}
