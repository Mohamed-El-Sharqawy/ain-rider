import { Location } from "./location.types";

export enum UserRole {
  RIDER = 'RIDER',
  DRIVER = 'DRIVER',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  BANNED = 'BANNED',
}

export interface User {
  id: string;
  email: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Driver extends User {
  role: UserRole.DRIVER;
  vehicleId?: string;
  licenseNumber: string;
  rating: number;
  totalTrips: number;
  isOnline: boolean;
  currentLocation?: Location;
}

export interface Rider extends User {
  role: UserRole.RIDER;
  rating: number;
  totalTrips: number;
}
