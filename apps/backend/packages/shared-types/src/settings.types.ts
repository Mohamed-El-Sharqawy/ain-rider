export enum SettingCategory {
  GENERAL = 'GENERAL',
  PAYMENT = 'PAYMENT',
  NOTIFICATION = 'NOTIFICATION',
  PRICING = 'PRICING',
  SECURITY = 'SECURITY',
  FEATURES = 'FEATURES',
}

export enum SettingType {
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  JSON = 'JSON',
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  type: SettingType;
  category: SettingCategory;
  description: string;
  isPublic: boolean; // Can be accessed by mobile apps
  updatedBy: string; // Admin user ID
  updatedAt: Date;
}

export interface PaymentSettings {
  // Cash is the only payment method currently supported
  cashEnabled: boolean;
  // Future payment methods (not yet implemented)
  cardEnabled: boolean;
  walletEnabled: boolean;
  // Driver earnings
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
  waitingTimeRate: number; // Per minute
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
