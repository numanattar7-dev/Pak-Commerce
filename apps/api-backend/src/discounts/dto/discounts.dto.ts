import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Matches,
} from 'class-validator';

export class CreateDiscountDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{2,24}$/, {
    message: 'Code must be 2-24 chars (letters, numbers, dash, underscore)',
  })
  code: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['PERCENTAGE', 'FIXED', 'FREE_SHIPPING'])
  type: 'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING';

  @IsNumber()
  @Min(0)
  value: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  minSubtotal?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  maxUses?: number;

  @IsBoolean()
  @IsOptional()
  firstOnly?: boolean;

  @IsDateString()
  @IsOptional()
  startsAt?: string;

  @IsDateString()
  @IsOptional()
  endsAt?: string;
}

export class UpdateDiscountDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  value?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  minSubtotal?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  maxUses?: number;

  @IsBoolean()
  @IsOptional()
  firstOnly?: boolean;

  @IsDateString()
  @IsOptional()
  startsAt?: string;

  @IsDateString()
  @IsOptional()
  endsAt?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

/** Public: checkout pre-check by storefront */
export class ValidateDiscountDto {
  @IsString()
  subdomain: string;

  @IsString()
  code: string;

  @IsNumber()
  @Min(0)
  subtotal: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  shippingFee?: number;

  @IsString()
  @IsOptional()
  phone?: string; // for firstOnly preview (11-digit)
}
