import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { AdminGuard } from '../auth/admin.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type CurrentUserPayload } from '../auth/current-user.decorator';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { SendPushDto } from './dto/send-push.dto';
import { SendSmsDto } from './dto/send-sms.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(AdminGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all notifications' })
  findAll() {
    return this.notificationsService.findAll();
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user notifications' })
  findMyNotifications(@CurrentUser() user: CurrentUserPayload) {
    return this.notificationsService.findByUser(user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Create a notification' })
  create(@Body() body: CreateNotificationDto, @CurrentUser() user: CurrentUserPayload) {
    return this.notificationsService.create({ ...body, data: body.data as Record<string, unknown> | undefined, createdBy: user.sub });
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Find notifications by user' })
  @ApiParam({ name: 'userId', type: String })
  findByUser(@Param('userId') userId: string) {
    return this.notificationsService.findByUser(userId);
  }

  @Roles('ADMIN')
  @Post('push')
  @ApiOperation({ summary: 'Send a push notification' })
  sendPushNotification(@Body() body: SendPushDto) {
    return this.notificationsService.sendPushNotification(body.userId, body.title, body.body, body.data as Record<string, unknown> | undefined);
  }

  @Roles('ADMIN')
  @Post('sms')
  @ApiOperation({ summary: 'Send an SMS notification' })
  sendSms(@Body() body: SendSmsDto) {
    return this.notificationsService.sendSms(body.phoneNumber, body.message);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read for current user' })
  markAllAsRead(@CurrentUser() user: CurrentUserPayload, @Body() _body?: unknown) {
    return this.notificationsService.markAllAsRead(user.sub);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiParam({ name: 'id', type: String })
  markRead(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload, @Body() _body?: unknown) {
    return this.notificationsService.markRead(id, user.sub);
  }
}
