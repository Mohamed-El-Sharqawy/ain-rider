import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { vehiclesApi } from './api';
import { transformVehicle, transformVehicleType } from './transformers';

export const vehicleKeys = {
  all: ['vehicles'] as const,
  list: (driverId?: string) => ['vehicles', 'list', { driverId }] as const,
  types: ['vehicle-types'] as const,
};

export const useGetVehicles = (driverId?: string) => {
  return useQuery({
    queryKey: vehicleKeys.list(driverId),
    queryFn: () => vehiclesApi.getAllVehicles(driverId).then((r) => r.data.map(transformVehicle)),
    placeholderData: keepPreviousData,
  });
};

export const useGetVehicleTypes = () => {
  return useQuery({
    queryKey: vehicleKeys.types,
    queryFn: () => vehiclesApi.getAllTypes().then((r) => r.data.map(transformVehicleType)),
    placeholderData: keepPreviousData,
  });
};
