import { Controller, Get, Put, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { AdminGuard } from '../auth/admin.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type CurrentUserPayload } from '../auth/current-user.decorator';
import { UpsertSettingDto } from './dto/upsert-setting.dto';
import { BatchUpsertSettingsDto } from './dto/batch-upsert-settings.dto';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(AdminGuard, RolesGuard)
@Roles('ADMIN')
@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all settings' })
  @ApiQuery({ name: 'category', required: false, type: String })
  findAll(@Query('category') category?: string) {
    return this.settingsService.findAll(category);
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get setting by key' })
  @ApiParam({ name: 'key', type: String })
  findOne(@Param('key') key: string) {
    return this.settingsService.findByKey(key);
  }

  @Put(':key')
  @ApiOperation({ summary: 'Upsert setting by key' })
  @ApiParam({ name: 'key', type: String })
  upsert(@Param('key') key: string, @Body() body: UpsertSettingDto, @CurrentUser() user: CurrentUserPayload) {
    return this.settingsService.upsert(key, body.value, body.type, body.category, body.description, user.sub, body.isPublic);
  }

  @Post('batch')
  @ApiOperation({ summary: 'Batch upsert multiple settings' })
  batchUpsert(@Body() body: BatchUpsertSettingsDto, @CurrentUser() user: CurrentUserPayload) {
    return this.settingsService.batchUpsert(body.settings, user.sub);
  }
}
