import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ComplaintEventPublisher } from '../events/complaint-event.publisher';
import { generateTraceId } from '@ain-rider/nats-client';

import { CreateComplaintDto as CreateComplaintBody } from './dto/create-complaint.dto';

type CreateComplaintInput = CreateComplaintBody;

@Injectable()
export class ComplaintsService {
  constructor(
    private prisma: PrismaService,
    private eventPublisher: ComplaintEventPublisher,
  ) {}

  async findAll(status?: string, page = 1, limit = 10) {
    const where = status && status !== 'all' ? { status: status as any } : {};
    const [data, total] = await Promise.all([
      this.prisma.complaint.findMany({
        where,
        include: { comments: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.complaint.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  findById(id: string) {
    return this.prisma.complaint.findUnique({ where: { id }, include: { comments: true } });
  }

  async create(data: CreateComplaintInput) {
    const complaint = await this.prisma.complaint.create({ data: data as any });
    
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
        status: status as any,
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

  findByComplainantId(complainantId: string) {
    return this.prisma.complaint.findMany({
      where: { complainantId },
      include: {
        comments: {
          where: { isInternal: false },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByIdPublic(id: string, complainantId: string) {
    return this.prisma.complaint.findFirst({
      where: { id, complainantId },
      include: {
        comments: {
          where: { isInternal: false },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  addComment(complaintId: string, userId: string, userRole: string, comment: string, isInternal = false) {
    return this.prisma.complaintComment.create({
      data: { complaintId, userId, userRole, comment, isInternal },
    });
  }
}
