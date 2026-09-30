export enum ReportType {
  REVENUE = 'REVENUE',
  TRIPS = 'TRIPS',
  USERS = 'USERS',
  DRIVERS = 'DRIVERS',
  COMPLAINTS = 'COMPLAINTS',
  SOS = 'SOS',
  WITHDRAWALS = 'WITHDRAWALS',
  PROMOS = 'PROMOS',
}

export enum ReportPeriod {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
  CUSTOM = 'CUSTOM',
}

export interface ReportFilter {
  type: ReportType;
  period: ReportPeriod;
  startDate: Date;
  endDate: Date;
  additionalFilters?: Record<string, any>;
}

export interface RevenueReport {
  totalRevenue: number;
  totalTrips: number;
  averageFare: number;
  commissionEarned: number;
  refunds: number;
  netRevenue: number;
  breakdown: {
    date: string;
    revenue: number;
    trips: number;
  }[];
}

export interface TripReport {
  totalTrips: number;
  completedTrips: number;
  cancelledTrips: number;
  averageDistance: number;
  averageDuration: number;
  peakHours: {
    hour: number;
    tripCount: number;
  }[];
  statusBreakdown: Record<string, number>;
}

export interface UserReport {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  suspendedUsers: number;
  usersByRole: Record<string, number>;
  topUsers: {
    userId: string;
    name: string;
    tripCount: number;
    totalSpent: number;
  }[];
}

export interface DriverReport {
  totalDrivers: number;
  activeDrivers: number;
  onlineDrivers: number;
  topDrivers: {
    driverId: string;
    name: string;
    tripCount: number;
    totalEarnings: number;
    rating: number;
  }[];
  averageRating: number;
}
