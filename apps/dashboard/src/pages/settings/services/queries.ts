import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { settingsApi } from './api';
import { transformSetting } from './transformers';

export const settingKeys = {
  all: ['settings'] as const,
  list: (category?: string) => [...settingKeys.all, 'list', { category }] as const,
  detail: (key: string) => [...settingKeys.all, 'detail', key] as const,
};

export const useGetSettings = (category?: string) => {
  return useQuery({
    queryKey: settingKeys.list(category),
    queryFn: () => settingsApi.getAll(category).then((r) => r.data.map(transformSetting)),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
};

export const useGetSettingByKey = (key: string) => {
  return useQuery({
    queryKey: settingKeys.detail(key),
    queryFn: () => settingsApi.getByKey(key).then((r) => transformSetting(r.data)),
    enabled: !!key,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
};
