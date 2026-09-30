import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NatsService } from '../shared/nats/nats.service';
import { NATS_SUBJECTS } from '@ain-rider/shared-types';
import { generateTraceId } from '@ain-rider/nats-client';
import { CreateNotificationDto as CreateNotificationBody } from './dto/create-notification.dto';

type CreateNotificationInput = Omit<CreateNotificationBody, 'data'> & {
  data?: Record<string, unknown>;
  createdBy: string;
};

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private nats: NatsService,
  ) {}

  create(data: CreateNotificationInput) {
    return this.prisma.notification.create({ data: data as any });
  }

  findAll(limit = 100) {
    return this.prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { reads: true },
    });
  }

  findByUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { reads: { where: { readerId: userId } } },
    });
  }

  async markRead(id: string, readerId: string) {
    return this.prisma.notificationRead.upsert({
      where: { notificationId_readerId: { notificationId: id, readerId } },
      create: { notificationId: id, readerId },
      update: { readAt: new Date() },
    });
  }

  async markAllAsRead(readerId: string) {
    const unread = await this.prisma.notification.findMany({
      where: {
        reads: { none: { readerId } },
      },
      select: { id: true },
      take: 200,
    });

    if (unread.length === 0) return { count: 0 };

    await this.prisma.notificationRead.createMany({
      data: unread.map((n) => ({ notificationId: n.id, readerId })),
      skipDuplicates: true,
    });

    return { count: unread.length };
  }

  async sendPushNotification(userId: string, title: string, body: string, data?: Record<string, unknown>) {
    console.log(`[Push] To ${userId}: ${title} - ${body}`);
    
    const notification = await this.create({
      userId,
      title,
      body,
      type: 'PUSH',
      data: data || {},
      createdBy: 'system',
    });

    // Publish to NATS JetStream for real-time WebSocket delivery
    const traceId = generateTraceId();
    await this.nats.jsPublisher.publish(
      NATS_SUBJECTS.NOTIFICATION_SENT,
      'notification_sent',
      {
        userId,
        title,
        body,
        notificationId: notification.id,
        data,
      },
      { traceId }
    );

    return notification;
  }

  async sendSms(phoneNumber: string, message: string) {
    // In a real implementation, this would integrate with Twilio/SNS or an SMS microservice
    console.log(`[SMS] To ${phoneNumber}: ${message}`);
    // Might not map directly to a user in the notification table if just a phone number, 
    // but throwing not implemented or returning success for now.
    return { success: true, message: 'SMS sent successfully (mock)' };
  }
}
