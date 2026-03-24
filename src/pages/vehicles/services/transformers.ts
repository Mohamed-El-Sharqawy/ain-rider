import type { VehicleDTO, VehicleTypeDTO } from './dto';

export interface VehicleType {
  id: string;
  name: string;
  type: string;
  baseFare: number;
  perKmRate: number;
  perMinuteRate: number;
  minFare: number;
  maxPassengers: number;
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Vehicle {
  id: string;
  driverId: string;
  vehicleTypeId: string;
  vehicleTypeName: string;
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate: string;
  registrationNumber: string;
  insuranceNumber: string;
  insuranceExpiry: string;
  status: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export function transformVehicleType(dto: VehicleTypeDTO): VehicleType {
  return {
    id: dto.id,
    name: dto.name,
    type: dto.type,
    baseFare: dto.baseFare,
    perKmRate: dto.perKmRate,
    perMinuteRate: dto.perMinuteRate,
    minFare: dto.minFare,
    maxPassengers: dto.maxPassengers,
    imageUrl: dto.imageUrl,
    isActive: dto.isActive,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export function transformVehicle(dto: VehicleDTO): Vehicle {
  return {
    id: dto.id,
    driverId: dto.driverId,
    vehicleTypeId: dto.vehicleTypeId,
    vehicleTypeName: dto.vehicleType?.name ?? 'غير محدد',
    make: dto.make,
    model: dto.model,
    year: dto.year,
    color: dto.color,
    licensePlate: dto.licensePlate,
    registrationNumber: dto.registrationNumber,
    insuranceNumber: dto.insuranceNumber,
    insuranceExpiry: dto.insuranceExpiry,
    status: dto.status,
    imageUrl: dto.imageUrl,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}
