import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletsService {
  constructor(private prisma: PrismaService) {}

  findByUser(userId: string) {
    return this.prisma.wallet.findUnique({
      where: { userId },
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
  }

  async credit(userId: string, amount: number, description: string, referenceId?: string) {
    const wallet = await this.prisma.wallet.upsert({
      where: { userId },
      create: { userId, balance: 0 },
      update: {},
    });

    const updated = await this.prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amount } },
    });

    await this.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        userId,
        type: 'CREDIT',
        amount,
        balanceBefore: wallet.balance,
        balanceAfter: updated.balance,
        description,
        referenceId,
      },
    });

    return updated;
  }

  async debit(userId: string, amount: number, description: string, referenceId?: string) {
    const wallet = await this.prisma.wallet.findUniqueOrThrow({ where: { userId } });

    const updated = await this.prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: amount } },
    });

    await this.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        userId,
        type: 'DEBIT',
        amount,
        balanceBefore: wallet.balance,
        balanceAfter: updated.balance,
        description,
        referenceId,
      },
    });

    return updated;
  }

  findWithdrawals(status?: string) {
    return this.prisma.withdrawal.findMany({
      where: status ? { status } : undefined,
      orderBy: { requestedAt: 'desc' },
    });
  }

  processWithdrawal(id: string, processedBy: string, approve: boolean, rejectionReason?: string) {
    return this.prisma.withdrawal.update({
      where: { id },
      data: {
        status: approve ? 'COMPLETED' : 'REJECTED',
        processedAt: new Date(),
        processedBy,
        rejectionReason: approve ? null : rejectionReason,
        transactionId: approve ? `txn_${Date.now()}` : null,
      },
    });
  }
}
