import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseInterceptors,
  UseGuards,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ThemesService } from './themes.service';

class DuplicateDto {
  @IsString()
  declare id: string;
}

class RenameDto {
  @IsString()
  declare id: string;

  @IsString()
  @Length(2, 80)
  declare name: string;
}

class IdDto {
  @IsString()
  declare id: string;
}

class SnapshotDto {
  @IsString()
  @IsOptional()
  @Length(0, 120)
  declare label?: string;
}

class RestoreDto {
  @IsBoolean()
  @IsOptional()
  declare publish?: boolean;
}

@ApiTags('themes')
@Controller('themes')
export class ThemesController {
  constructor(private readonly service: ThemesService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@CurrentUser() user: any) {
    return this.service.list(user.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.getOne(user.tenantId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/versions')
  versions(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.listVersions(user.tenantId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('duplicate')
  duplicate(@CurrentUser() user: any, @Body() dto: DuplicateDto) {
    return this.service.duplicate(user.tenantId, dto.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('rename')
  rename(@CurrentUser() user: any, @Body() dto: RenameDto) {
    return this.service.rename(user.tenantId, dto.id, dto.name);
  }

  @UseGuards(JwtAuthGuard)
  @Post('publish')
  publish(@CurrentUser() user: any, @Body() dto: IdDto) {
    return this.service.publish(user.tenantId, dto.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('unpublish')
  unpublish(@CurrentUser() user: any, @Body() dto: IdDto) {
    return this.service.unpublish(user.tenantId, dto.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/versions')
  snapshot(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: SnapshotDto) {
    return this.service.snapshot(user.tenantId, id, dto?.label);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/versions/:versionNumber/restore')
  restore(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('versionNumber') versionNumber: string,
    @Body() dto: RestoreDto,
  ) {
    const n = Number(versionNumber);
    if (!Number.isInteger(n) || n < 1) throw new BadRequestException('Invalid version number');
    return this.service.restoreVersion(user.tenantId, id, n, dto?.publish === true);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.remove(user.tenantId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  importTheme(@CurrentUser() user: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Attach a theme ZIP as form field "file"');
    if (file.mimetype !== 'application/zip' && file.mimetype !== 'application/x-zip-compressed' && !file.originalname?.toLowerCase().endsWith('.zip')) {
      throw new BadRequestException('Only .zip files are accepted');
    }
    return this.service.importTheme(user.tenantId, file.buffer);
  }
}
