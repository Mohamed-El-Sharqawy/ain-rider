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
