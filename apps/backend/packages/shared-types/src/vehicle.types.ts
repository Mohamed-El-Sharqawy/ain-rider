export enum VehicleType {
  SEDAN = 'SEDAN',
  SUV = 'SUV',
  LUXURY = 'LUXURY',
  ECONOMY = 'ECONOMY',
  VAN = 'VAN',
  MOTORCYCLE = 'MOTORCYCLE',
}

export enum VehicleStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  MAINTENANCE = 'MAINTENANCE',
  SUSPENDED = 'SUSPENDED',
}

export interface VehicleTypeConfig {
  id: string;
  name: string;
  type: VehicleType;
  baseFare: number;
  perKmRate: number;
  perMinuteRate: number;
  minFare: number;
  maxPassengers: number;
  imageUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Vehicle {
  id: string;
  driverId: string;
  vehicleTypeId: string;
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate: string;
  registrationNumber: string;
  insuranceNumber: string;
  insuranceExpiry: Date;
  status: VehicleStatus;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}
