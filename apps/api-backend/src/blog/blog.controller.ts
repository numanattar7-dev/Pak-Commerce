import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BlogService } from './blog.service';
import {
  CreateBlogPostDto,
  UpdateBlogPostDto,
  ListBlogPostsDto,
  PublicListDto,
} from './dto';

@ApiTags('blog')
@Controller('blog-posts')
export class BlogController {
  constructor(private readonly service: BlogService) {}

  // ---------------- public (storefront) ----------------
  @Get('public/:subdomain')
  listPublic(@Param('subdomain') subdomain: string, @Query() q: PublicListDto) {
    return this.service.listPublic(subdomain, Number(q.page ?? 1), Number(q.limit ?? 12));
  }

  @Get('public/:subdomain/:handle')
  getPublic(@Param('subdomain') subdomain: string, @Param('handle') handle: string) {
    return this.service.getPublic(subdomain, handle);
  }

  // ---------------- admin (JWT) ----------------
  @UseGuards(JwtAuthGuard)
  @Get()
  list(@CurrentUser() user: any, @Query() q: ListBlogPostsDto) {
    return this.service.list(
      user.tenantId,
      q.q ?? '',
      q.status ?? 'all',
      Number(q.page ?? 1),
      Number(q.limit ?? 20),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.getOne(user.tenantId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateBlogPostDto) {
    return this.service.create(user.tenantId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateBlogPostDto) {
    return this.service.update(user.tenantId, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/duplicate')
  duplicate(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.duplicate(user.tenantId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.remove(user.tenantId, id);
  }
}
