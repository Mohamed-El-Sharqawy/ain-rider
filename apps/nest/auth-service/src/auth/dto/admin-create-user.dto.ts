import { IsEmail, IsNotEmpty, IsString, MinLength, IsEnum, IsPhoneNumber } from 'class-validator';
import { UserRole } from '@ain-rider/shared-types';

export class AdminCreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsPhoneNumber(null)
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

  // Admin can create any role
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;
}
