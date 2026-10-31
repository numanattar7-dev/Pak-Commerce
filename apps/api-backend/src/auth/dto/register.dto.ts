import { IsEmail, IsString, MinLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @Matches(/^03\d{9}$/, { message: 'Phone number must be 11 digits starting with 03' })
  phone: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(2)
  storeName: string;

  @IsString()
  @MinLength(3)
  @Matches(/^[a-z0-9-]+$/, { message: 'Subdomain can only contain lowercase letters, numbers, and hyphens' })
  storeSubdomain: string;
}
