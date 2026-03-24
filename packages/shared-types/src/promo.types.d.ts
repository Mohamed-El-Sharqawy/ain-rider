export declare enum PromoType {
    PERCENTAGE = "PERCENTAGE",
    FIXED_AMOUNT = "FIXED_AMOUNT",
    FREE_RIDE = "FREE_RIDE"
}
export declare enum PromoStatus {
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE",
    EXPIRED = "EXPIRED",
    USED_UP = "USED_UP"
}
export interface Promo {
    id: string;
    code: string;
    type: PromoType;
    value: number;
    maxDiscount?: number;
    minTripAmount?: number;
    maxUsagePerUser: number;
    totalUsageLimit: number;
    currentUsageCount: number;
    status: PromoStatus;
    validFrom: Date;
    validUntil: Date;
    description: string;
    createdBy: string;
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
//# sourceMappingURL=promo.types.d.ts.map