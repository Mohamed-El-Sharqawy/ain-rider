import { api } from '@/api/client';
import type { 
  VehicleDTO, 
  VehicleTypeDTO, 
  CreateVehicleDTO, 
  UpdateVehicleDTO, 
  CreateVehicleTypeDTO, 
  UpdateVehicleTypeDTO,
  VehicleMakeDTO,
  VehicleModelDTO,
  CreateVehicleMakeDTO,
  UpdateVehicleMakeDTO,
  CreateVehicleModelDTO,
  UpdateVehicleModelDTO
} from './dto';

export const vehiclesApi = {
  // Vehicle Types
  getAllTypes: () =>
    api.get<VehicleTypeDTO[]>('/admin/vehicle-types'),

  createType: (data: CreateVehicleTypeDTO) =>
    api.post<VehicleTypeDTO>('/admin/vehicle-types', data),

  updateType: (id: string, data: UpdateVehicleTypeDTO) =>
    api.patch<VehicleTypeDTO>(`/admin/vehicle-types/${id}`, data),

  // --- Vehicle Makes ---
  getAllMakes: (activeOnly?: boolean) =>
    api.get<VehicleMakeDTO[]>('/admin/vehicle-makes', { params: { activeOnly } }),

  createMake: (data: CreateVehicleMakeDTO) =>
    api.post<VehicleMakeDTO>('/admin/vehicle-makes', data),

  updateMake: (id: string, data: UpdateVehicleMakeDTO) =>
    api.patch<VehicleMakeDTO>(`/admin/vehicle-makes/${id}`, data),

  // --- Vehicle Models ---
  getAllModels: (makeId?: string) =>
    api.get<VehicleModelDTO[]>('/admin/vehicle-models', { params: { makeId } }),

  createModel: (data: CreateVehicleModelDTO) =>
    api.post<VehicleModelDTO>('/admin/vehicle-models', data),

  updateModel: (id: string, data: UpdateVehicleModelDTO) =>
    api.patch<VehicleModelDTO>(`/admin/vehicle-models/${id}`, data),

  // Vehicles
  getAllVehicles: (driverId?: string) =>
    api.get<VehicleDTO[]>('/admin/vehicles', { params: { driverId } }),

  createVehicle: (data: CreateVehicleDTO) =>
    api.post<VehicleDTO>('/admin/vehicles', data),

  updateVehicle: (id: string, data: UpdateVehicleDTO) =>
    api.patch<VehicleDTO>(`/admin/vehicles/${id}`, data),
};
