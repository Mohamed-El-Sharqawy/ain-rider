export interface PromoDTO {
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

export interface CreatePromoDTO {
  code: string;
  type: string;
  value: number;
  maxDiscount?: number;
  minTripAmount?: number;
  maxUsagePerUser?: number;
  totalUsageLimit: number;
  validFrom?: string;
  validUntil?: string;
  description?: string;
}

export interface UpdatePromoDTO {
  status?: string;
  totalUsageLimit?: number;
  validUntil?: string;
}
