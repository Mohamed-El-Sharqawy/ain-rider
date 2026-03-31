import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from './api';
import { userKeys } from './queries';
import { getApiError } from '@/api/client';
import { toast } from 'sonner';
import type { UpdateUserStatusDTO, CreateUserDTO } from './dto';

export const useUpdateUserStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserStatusDTO }) =>
      usersApi.updateStatus(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      queryClient.invalidateQueries({ queryKey: userKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: userKeys.stats() });
      toast.success('تم تحديث حالة المستخدم بنجاح');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserDTO) => usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      queryClient.invalidateQueries({ queryKey: userKeys.stats() });
      toast.success('تم إنشاء المستخدم بنجاح');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });
};

export const useApproveDriver = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.approveDriver(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      queryClient.invalidateQueries({ queryKey: userKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: userKeys.onboarding(id) });
      toast.success('تم قبول السائق بنجاح');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });
};

export const useRejectDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage, reason }: { id: string; stage: string; reason: string }) =>
      usersApi.rejectDocument(id, stage, reason),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      queryClient.invalidateQueries({ queryKey: userKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: userKeys.onboarding(id) });
      toast.success('تم رفض الوثيقة مع إرسال السبب');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });
};

export const useResetUploadAttempts = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.resetUploadAttempts(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      queryClient.invalidateQueries({ queryKey: userKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: userKeys.onboarding(id) });
      toast.success('تم إعادة تعيين محاولات الرفع بنجاح');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });
};
