import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletTransactionType, WithdrawalStatus } from '../generated/prisma';

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
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { userId },
        create: { userId, balance: 0 },
        update: {},
      });

      const balanceBefore = wallet.balance;

      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amount } },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId,
          type: WalletTransactionType.CREDIT,
          amount,
          balanceBefore,
          balanceAfter: updated.balance,
          description,
          referenceId,
        },
      });

      return updated;
    });
  }

  async debit(userId: string, amount: number, description: string, referenceId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });

      if (wallet.balance < amount) {
        throw new BadRequestException(`Insufficient balance. Current: ${wallet.balance}, Requested: ${amount}`);
      }

      const balanceBefore = wallet.balance;

      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amount } },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId,
          type: WalletTransactionType.DEBIT,
          amount,
          balanceBefore,
          balanceAfter: updated.balance,
          description,
          referenceId,
        },
      });

      return updated;
    });
  }

  findWithdrawals(status?: string) {
    return this.prisma.withdrawal.findMany({
      where: status ? { status: status as WithdrawalStatus } : undefined,
      orderBy: { requestedAt: 'desc' },
    });
  }

  processWithdrawal(id: string, processedBy: string, approve: boolean, rejectionReason?: string) {
    return this.prisma.withdrawal.update({
      where: { id },
      data: {
        status: approve ? WithdrawalStatus.PROCESSED : WithdrawalStatus.REJECTED,
        processedAt: new Date(),
        processedBy,
        rejectionReason: approve ? null : rejectionReason,
        transactionId: approve ? `txn_${Date.now()}` : null,
      },
    });
  }
}
