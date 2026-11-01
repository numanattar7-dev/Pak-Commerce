import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateShippingRuleDto {
  // "Karachi", "Lahore", ... or "All Pakistan" fallback
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  city: string;

  @IsNumber()
  @Min(0)
  rate: number;

  // Free delivery threshold (null/omitted = no free shipping)
  @IsNumber()
  @IsOptional()
  @Min(0)
  isFreeAbove?: number;
}

export class UpdateShippingRuleDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(60)
  city?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  rate?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  isFreeAbove?: number;
}
