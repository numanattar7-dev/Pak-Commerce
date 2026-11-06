import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateBlogPostDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]{2,80}$/, { message: 'handle must be lowercase letters, numbers and dashes only' })
  handle?: string;

  @IsString()
  @MaxLength(500)
  excerpt: string;

  @IsString()
  @MaxLength(40000)
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  author?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  seoDescription?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateBlogPostDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]{2,80}$/)
  handle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40000)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  author?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  seoDescription?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class ListBlogPostsDto {
  @IsOptional() @IsString() @MaxLength(120)
  q?: string;

  @IsOptional() @IsIn(['all', 'published', 'draft'])
  status?: 'all' | 'published' | 'draft';

  @IsOptional() @IsString() @Matches(/^\d{1,3}$/)
  page?: string;

  @IsOptional() @IsString() @Matches(/^\d{1,3}$/)
  limit?: string;
}

export class PublicListDto {
  @IsOptional() @IsString() @Matches(/^\d{1,3}$/)
  page?: string;

  @IsOptional() @IsString() @Matches(/^\d{1,3}$/)
  limit?: string;
}
