export interface VehicleTypeDTO {
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

export interface VehicleDTO {
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
  insuranceExpiry: string;
  status: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
  vehicleType?: VehicleTypeDTO;
}

export interface CreateVehicleTypeDTO {
  name: string;
  type: string;
  baseFare: number;
  perKmRate: number;
  perMinuteRate: number;
  minFare: number;
  maxPassengers: number;
  imageUrl?: string;
  isActive?: boolean;
}

export type UpdateVehicleTypeDTO = Partial<CreateVehicleTypeDTO>;

export interface CreateVehicleDTO {
  driverId: string;
  vehicleTypeId: string;
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate: string;
  registrationNumber: string;
  insuranceNumber: string;
  insuranceExpiry: string;
  imageUrl?: string;
}

export type UpdateVehicleDTO = Partial<CreateVehicleDTO>;
