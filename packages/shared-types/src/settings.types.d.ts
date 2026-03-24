export declare enum SettingCategory {
    GENERAL = "GENERAL",
    PAYMENT = "PAYMENT",
    NOTIFICATION = "NOTIFICATION",
    PRICING = "PRICING",
    SECURITY = "SECURITY",
    FEATURES = "FEATURES"
}
export declare enum SettingType {
    STRING = "STRING",
    NUMBER = "NUMBER",
    BOOLEAN = "BOOLEAN",
    JSON = "JSON"
}
export interface Setting {
    id: string;
    key: string;
    value: string;
    type: SettingType;
    category: SettingCategory;
    description: string;
    isPublic: boolean;
    updatedBy: string;
    updatedAt: Date;
}
export interface PaymentSettings {
    stripePublishableKey?: string;
    stripeSecretKey?: string;
    paypalClientId?: string;
    paypalSecretKey?: string;
    cashEnabled: boolean;
    cardEnabled: boolean;
    walletEnabled: boolean;
    minimumWalletBalance: number;
    commissionPercentage: number;
    driverPayoutSchedule: 'DAILY' | 'WEEKLY' | 'MONTHLY';
}
export interface PricingSettings {
    baseFare: number;
    perKmRate: number;
    perMinuteRate: number;
    minimumFare: number;
    cancellationFee: number;
    surgeMultiplierMax: number;
    waitingTimeRate: number;
    currency: string;
}
export interface AppSettings {
    appName: string;
    supportEmail: string;
    supportPhone: string;
    termsUrl: string;
    privacyPolicyUrl: string;
    maintenanceMode: boolean;
    maintenanceMessage?: string;
    minAppVersion: string;
    forceUpdate: boolean;
}
//# sourceMappingURL=settings.types.d.ts.map