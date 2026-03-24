import { api } from '@/api/client';
import type { 
  VehicleDTO, 
  VehicleTypeDTO, 
  CreateVehicleDTO, 
  UpdateVehicleDTO, 
  CreateVehicleTypeDTO, 
  UpdateVehicleTypeDTO 
} from './dto';

export const vehiclesApi = {
  // Vehicle Types
  getAllTypes: () =>
    api.get<VehicleTypeDTO[]>('/admin/vehicle-types'),

  createType: (data: CreateVehicleTypeDTO) =>
    api.post<VehicleTypeDTO>('/admin/vehicle-types', data),

  updateType: (id: string, data: UpdateVehicleTypeDTO) =>
    api.patch<VehicleTypeDTO>(`/admin/vehicle-types/${id}`, data),

  // Vehicles
  getAllVehicles: (driverId?: string) =>
    api.get<VehicleDTO[]>('/admin/vehicles', { params: { driverId } }),

  createVehicle: (data: CreateVehicleDTO) =>
    api.post<VehicleDTO>('/admin/vehicles', data),

  updateVehicle: (id: string, data: UpdateVehicleDTO) =>
    api.patch<VehicleDTO>(`/admin/vehicles/${id}`, data),
};
