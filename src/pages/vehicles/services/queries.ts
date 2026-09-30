import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { vehiclesApi } from './api';
import { transformVehicle, transformVehicleType } from './transformers';

export const vehicleKeys = {
  all: ['vehicles'] as const,
  list: (driverId?: string) => [...vehicleKeys.all, 'list', { driverId }] as const,
  types: [...['vehicles'], 'types'] as const,
  makes: (activeOnly?: boolean) => [...vehicleKeys.all, 'makes', { activeOnly }] as const,
  models: (makeId?: string) => [...vehicleKeys.all, 'models', { makeId }] as const,
};

export const useGetVehicles = (driverId?: string) => {
  return useQuery({
    queryKey: vehicleKeys.list(driverId),
    queryFn: () => vehiclesApi.getAllVehicles(driverId).then((r) => r.data.map(transformVehicle)),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
};

export const useGetVehicleTypes = () => {
  return useQuery({
    queryKey: vehicleKeys.types,
    queryFn: () => vehiclesApi.getAllTypes().then((r) => r.data.map(transformVehicleType)),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
};

export const useGetVehicleMakes = (activeOnly?: boolean) => {
  return useQuery({
    queryKey: vehicleKeys.makes(activeOnly),
    queryFn: () => vehiclesApi.getAllMakes(activeOnly).then((r) => r.data),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
};

export const useGetVehicleModels = (makeId?: string) => {
  return useQuery({
    queryKey: vehicleKeys.models(makeId),
    queryFn: () => vehiclesApi.getAllModels(makeId).then((r) => r.data),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
};
