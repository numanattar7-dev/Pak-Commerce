import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ArrayNotEmpty,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCollectionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title: string;

  // URL slug — auto-generated from title when omitted
  @IsString()
  @IsOptional()
  @MaxLength(120)
  handle?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  // Initial products (must belong to this tenant)
  @IsArray()
  @IsOptional()
  productIds?: string[];
}

export class UpdateCollectionDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(120)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  handle?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  // Full replacement of the collection's product set
  @IsArray()
  @IsOptional()
  productIds?: string[];
}

export class CollectionProductsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  productIds: string[];
}
