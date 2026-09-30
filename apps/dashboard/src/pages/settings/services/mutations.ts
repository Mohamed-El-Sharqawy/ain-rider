import { useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from './api';
import { settingKeys } from './queries';
import { getApiError } from '@/api/client';
import { toast } from 'sonner';
import type { UpsertSettingDTO } from './dto';

export const useUpsertSetting = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ key, data }: { key: string; data: UpsertSettingDTO }) => settingsApi.upsert(key, data),
    onSuccess: (_, { key }) => {
      queryClient.invalidateQueries({ queryKey: settingKeys.all });
      queryClient.invalidateQueries({ queryKey: settingKeys.detail(key) });
      toast.success('تم تحديث الإعداد بنجاح');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });
};

export const useBatchUpsertSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: Array<{ key: string; value: unknown; type?: string; category?: string; description?: string; isPublic?: boolean }>) => 
      settingsApi.batchUpsert(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingKeys.all });
      toast.success('تم تحديث الإعدادات بنجاح');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });
};
