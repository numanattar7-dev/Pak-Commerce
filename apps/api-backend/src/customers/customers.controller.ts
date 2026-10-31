import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Get()
  async findAll(
    @CurrentUser() user,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    return this.customersService.findAll(user.tenantId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      search: search || undefined,
    });
  }

  @Get(':id')
  async findOne(@CurrentUser() user, @Param('id') id: string) {
    return this.customersService.findOne(user.tenantId, id);
  }

  @Post()
  async create(@CurrentUser() user, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(user.tenantId, dto);
  }

  @Put(':id')
  async update(
    @CurrentUser() user,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  async remove(@CurrentUser() user, @Param('id') id: string) {
    return this.customersService.remove(user.tenantId, id);
  }
}
