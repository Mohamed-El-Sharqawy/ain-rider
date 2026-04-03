import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@Controller('settings/public')
export class PublicSettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all public settings' })
  @ApiQuery({ name: 'category', required: false, type: String })
  findAll(@Query('category') category?: string) {
    return this.settingsService.findPublic(category);
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get public setting by key' })
  @ApiParam({ name: 'key', type: String })
  findOne(@Param('key') key: string) {
    return this.settingsService.findPublicByKey(key);
  }
}
