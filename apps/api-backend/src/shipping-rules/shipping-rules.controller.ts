import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ShippingRulesService } from './shipping-rules.service';
import { CreateShippingRuleDto, UpdateShippingRuleDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('shipping-rules')
export class ShippingRulesController {
  constructor(private shippingRulesService: ShippingRulesService) {}

  @Get()
  list(@CurrentUser() user) {
    return this.shippingRulesService.list(user.tenantId);
  }

  @Post()
  create(@CurrentUser() user, @Body() dto: CreateShippingRuleDto) {
    return this.shippingRulesService.create(user.tenantId, dto);
  }

  @Put(':id')
  update(@CurrentUser() user, @Param('id') id: string, @Body() dto: UpdateShippingRuleDto) {
    return this.shippingRulesService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user, @Param('id') id: string) {
    return this.shippingRulesService.remove(user.tenantId, id);
  }
}
