import { IsBoolean, IsOptional, IsString, IsObject, Matches, MaxLength, MinLength } from 'class-validator';

export class UpsertStoreSettingsDto {
  /** Full customization config object (branding, theme, hero, footer, payments, seo). */
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class CreateStorePageDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  title: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]{2,60}$/, {
    message: 'slug must be lowercase letters, numbers and dashes only',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateStorePageDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]{2,60}$/, {
    message: 'slug must be lowercase letters, numbers and dashes only',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
