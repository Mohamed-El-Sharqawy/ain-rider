import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ComplaintEventPublisher } from '../events/complaint-event.publisher';
import { generateTraceId } from '@ain-rider/nats-client';

@Injectable()
export class ComplaintsService {
  constructor(
    private prisma: PrismaService,
    private eventPublisher: ComplaintEventPublisher,
  ) {}

  findAll(status?: string) {
    return this.prisma.complaint.findMany({
      where: status ? { status } : undefined,
      include: { comments: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string) {
    return this.prisma.complaint.findUnique({ where: { id }, include: { comments: true } });
  }

  async create(data: any) {
    const complaint = await this.prisma.complaint.create({ data });
    
    // Publish complaint_created event
    const traceId = generateTraceId();
    await this.eventPublisher.publishComplaintCreated(complaint, traceId);
    
    return complaint;
  }

  async updateStatus(id: string, status: string, assignedTo?: string, resolution?: string) {
    const existing = await this.prisma.complaint.findUnique({ where: { id } });
    const previousStatus = existing?.status || 'UNKNOWN';
    
    const complaint = await this.prisma.complaint.update({
      where: { id },
      data: {
        status,
        assignedTo,
        resolution,
        resolvedAt: status === 'RESOLVED' ? new Date() : null,
      },
    });
    
    // Publish complaint_updated event
    const traceId = generateTraceId();
    await this.eventPublisher.publishComplaintUpdated(complaint, previousStatus, traceId);
    
    return complaint;
  }

  addComment(complaintId: string, userId: string, userRole: string, comment: string, isInternal = false) {
    return this.prisma.complaintComment.create({
      data: { complaintId, userId, userRole, comment, isInternal },
    });
  }
}
