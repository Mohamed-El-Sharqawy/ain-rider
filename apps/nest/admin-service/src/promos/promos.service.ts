import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePromoDto as CreatePromoBody } from './dto/create-promo.dto';
import { UpdatePromoDto as UpdatePromoBody } from './dto/update-promo.dto';

type CreatePromoInput = Omit<CreatePromoBody, 'validFrom' | 'validUntil'> & {
  validFrom?: string;
  validUntil?: string;
  createdBy: string;
};

type UpdatePromoInput = UpdatePromoBody;

@Injectable()
export class PromosService {
  constructor(private prisma: PrismaService) {}

  findAll(status?: string) {
    return this.prisma.promo.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  findByCode(code: string) {
    return this.prisma.promo.findUnique({ where: { code } });
  }

  create(data: CreatePromoInput) {
    return this.prisma.promo.create({ data: data as any });
  }

  update(id: string, data: UpdatePromoInput) {
    return this.prisma.promo.update({ where: { id }, data: data as any });
  }

  async validate(code: string, userId: string, tripAmount: number) {
    const promo = await this.findByCode(code);
    if (!promo) return { valid: false, reason: 'Promo not found' };
    if (promo.status !== 'ACTIVE') return { valid: false, reason: 'Promo inactive' };

    const now = new Date();
    if (now < promo.validFrom || now > promo.validUntil) return { valid: false, reason: 'Promo expired' };
    if (promo.currentUsageCount >= promo.totalUsageLimit) return { valid: false, reason: 'Promo limit reached' };
    if (promo.minTripAmount && tripAmount < promo.minTripAmount) return { valid: false, reason: 'Trip amount too low' };

    const userUsage = await this.prisma.promoUsage.count({ where: { promoId: promo.id, userId } });
    if (userUsage >= promo.maxUsagePerUser) return { valid: false, reason: 'Usage limit per user reached' };

    const result = await this.prisma.promo.updateMany({
      where: { id: promo.id, currentUsageCount: { lt: promo.totalUsageLimit } },
      data: { currentUsageCount: { increment: 1 } },
    });

    if (result.count === 0) return { valid: false, reason: 'Promo limit reached' };

    const discount = promo.type === 'PERCENTAGE'
      ? Math.min((tripAmount * promo.value) / 100, promo.maxDiscount ?? Infinity)
      : promo.value;

    return { valid: true, discount, promo };
  }
}
