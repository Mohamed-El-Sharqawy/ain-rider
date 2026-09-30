import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { PromosService } from './promos.service';
import { AdminGuard } from '../auth/admin.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type CurrentUserPayload } from '../auth/current-user.decorator';
import { CreatePromoDto } from './dto/create-promo.dto';
import { UpdatePromoDto } from './dto/update-promo.dto';

@ApiTags('Promotions')
@ApiBearerAuth()
@UseGuards(AdminGuard, RolesGuard)
@Controller('promos')
export class PromosController {
  constructor(private promosService: PromosService) {}

  @Get()
  @ApiOperation({ summary: 'Get all promotions' })
  @ApiQuery({ name: 'status', required: false, type: String })
  findAll(@Query('status') status?: string) {
    return this.promosService.findAll(status);
  }

  @Get('validate')
  @ApiOperation({ summary: 'Validate a promotion code' })
  @ApiQuery({ name: 'code', type: String })
  @ApiQuery({ name: 'userId', type: String })
  @ApiQuery({ name: 'amount', type: String })
  validate(@Query('code') code: string, @Query('userId') userId: string, @Query('amount') amount: string) {
    return this.promosService.validate(code, userId, parseFloat(amount));
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get promotion by code' })
  @ApiParam({ name: 'code', type: String })
  findByCode(@Param('code') code: string) {
    return this.promosService.findByCode(code);
  }

  @Roles('ADMIN')
  @Post()
  @ApiOperation({ summary: 'Create a new promotion' })
  create(@Body() body: CreatePromoDto, @CurrentUser() user: CurrentUserPayload) {
    return this.promosService.create({ ...body, createdBy: user.sub });
  }

  @Roles('ADMIN')
  @Patch(':id')
  @ApiOperation({ summary: 'Update a promotion' })
  @ApiParam({ name: 'id', type: String })
  update(@Param('id') id: string, @Body() body: UpdatePromoDto) {
    return this.promosService.update(id, body);
  }
}
