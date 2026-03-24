import type { PromoDTO } from './dto';

export interface Promo {
  id: string;
  code: string;
  type: string;
  value: number;
  maxDiscount?: number;
  minTripAmount?: number;
  maxUsagePerUser: number;
  totalUsageLimit: number;
  currentUsageCount: number;
  status: string;
  validFrom: string;
  validUntil: string;
  description: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function transformPromo(dto: PromoDTO): Promo {
  return {
    id: dto.id,
    code: dto.code,
    type: dto.type,
    value: dto.value,
    maxDiscount: dto.maxDiscount,
    minTripAmount: dto.minTripAmount,
    maxUsagePerUser: dto.maxUsagePerUser,
    totalUsageLimit: dto.totalUsageLimit,
    currentUsageCount: dto.currentUsageCount,
    status: dto.status,
    validFrom: dto.validFrom,
    validUntil: dto.validUntil,
    description: dto.description,
    createdBy: dto.createdBy,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}
