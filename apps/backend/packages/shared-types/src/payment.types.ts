export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export interface Payment {
  id: string;
  tripId: string;
  riderId: string;
  driverId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: string;
  transactionId?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface Fare {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  surgePricing: number;
  total: number;
  currency: string;
}
