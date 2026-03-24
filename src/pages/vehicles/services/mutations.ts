import { useMutation, useQueryClient } from '@tanstack/react-query';
import { vehiclesApi } from './api';
import { vehicleKeys } from './queries';
import { getApiError } from '@/api/client';
import { toast } from 'sonner';
import type { CreateVehicleDTO, UpdateVehicleDTO, CreateVehicleTypeDTO, UpdateVehicleTypeDTO } from './dto';

export const useCreateVehicleType = () => {
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
