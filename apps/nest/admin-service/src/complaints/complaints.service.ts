import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ComplaintsService {
  constructor(private prisma: PrismaService) {}

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

  create(data: any) {
    return this.prisma.complaint.create({ data });
  }

  updateStatus(id: string, status: string, assignedTo?: string, resolution?: string) {
    return this.prisma.complaint.update({
      where: { id },
      data: {
        status,
        assignedTo,
        resolution,
        resolvedAt: status === 'RESOLVED' ? new Date() : null,
      },
    });
  }

  addComment(complaintId: string, userId: string, userRole: string, comment: string, isInternal = false) {
    return this.prisma.complaintComment.create({
      data: { complaintId, userId, userRole, comment, isInternal },
    });
  }
}
