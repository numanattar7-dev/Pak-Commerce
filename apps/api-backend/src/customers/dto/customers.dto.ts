import {
  IsString,
  IsOptional,
  IsArray,
  IsEmail,
  Matches,
} from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  name: string;

  @Matches(/^03\d{9}$/, { message: 'Phone must be 11 digits starting with 03' })
  phone: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateCustomerDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  notes?: string;
}
