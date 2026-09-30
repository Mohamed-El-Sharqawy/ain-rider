import { useMutation, useQueryClient } from '@tanstack/react-query';
import { vehiclesApi } from './api';
import { vehicleKeys } from './queries';
import { getApiError } from '@/api/client';
import { toast } from 'sonner';
import type { 
  CreateVehicleDTO, 
  UpdateVehicleDTO, 
  CreateVehicleTypeDTO, 
  UpdateVehicleTypeDTO,
  CreateVehicleMakeDTO,
  UpdateVehicleMakeDTO,
  CreateVehicleModelDTO,
  UpdateVehicleModelDTO
} from './dto';

export const useCreateVehicleType = () => {
// ... existing hooks logic kept same ...
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateVehicleTypeDTO) => vehiclesApi.createType(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vehicleKeys.types });
      toast.success('تم إنشاء نوع المركبة بنجاح');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });
};

export const useUpdateVehicleType = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateVehicleTypeDTO }) => vehiclesApi.updateType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vehicleKeys.types });
      toast.success('تم تحديث نوع المركبة بنجاح');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });
};

export const useCreateVehicle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateVehicleDTO) => vehiclesApi.createVehicle(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vehicleKeys.all });
      toast.success('تمت إضافة المركبة بنجاح');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });
};

export const useUpdateVehicle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateVehicleDTO }) => vehiclesApi.updateVehicle(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vehicleKeys.all });
      toast.success('تم تحديث المركبة بنجاح');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });
};

export const useCreateVehicleMake = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateVehicleMakeDTO) => vehiclesApi.createMake(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vehicleKeys.makes() });
      toast.success('تم إنشاء الماركة بنجاح');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });
};

export const useUpdateVehicleMake = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateVehicleMakeDTO }) => vehiclesApi.updateMake(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vehicleKeys.makes() });
      toast.success('تم تحديث الماركة بنجاح');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });
};

export const useCreateVehicleModel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateVehicleModelDTO) => vehiclesApi.createModel(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vehicleKeys.models() });
      toast.success('تم إنشاء الموديل بنجاح');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });
};

export const useUpdateVehicleModel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateVehicleModelDTO }) => vehiclesApi.updateModel(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vehicleKeys.models() });
      toast.success('تم تحديث الموديل بنجاح');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });
};
