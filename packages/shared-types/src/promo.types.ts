export enum PromoType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
  FREE_RIDE = 'FREE_RIDE',
}

export enum PromoStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  EXPIRED = 'EXPIRED',
  USED_UP = 'USED_UP',
}

export interface Promo {
  id: string;
  code: string;
  type: PromoType;
  value: number; // Percentage or fixed amount
  maxDiscount?: number; // Max discount for percentage type
  minTripAmount?: number; // Minimum trip amount to use promo
  maxUsagePerUser: number;
  totalUsageLimit: number;
  currentUsageCount: number;
  status: PromoStatus;
  validFrom: Date;
  validUntil: Date;
  description: string;
  createdBy: string; // Admin user ID
  createdAt: Date;
  updatedAt: Date;
}

export interface PromoUsage {
  id: string;
  promoId: string;
  userId: string;
  tripId: string;
  discountAmount: number;
  usedAt: Date;
}
