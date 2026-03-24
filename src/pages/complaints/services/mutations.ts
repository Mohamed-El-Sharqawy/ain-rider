import { useMutation, useQueryClient } from '@tanstack/react-query';
import { complaintsApi } from './api';
import { complaintKeys } from './queries';
import { getApiError } from '@/api/client';
import { toast } from 'sonner';
import type { CreateComplaintDTO, AddComplaintCommentDTO } from './dto';

export const useCreateComplaint = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateComplaintDTO) => complaintsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complaintKeys.all });
      toast.success('تم إنشاء الشكوى بنجاح');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });
};

export const useUpdateComplaintStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status: string; assignedTo?: string; resolution?: string } }) =>
      complaintsApi.updateStatus(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: complaintKeys.all });
      queryClient.invalidateQueries({ queryKey: complaintKeys.detail(id) });
      toast.success('تم تحديث حالة الشكوى بنجاح');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });
};

export const useAddComplaintComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AddComplaintCommentDTO }) =>
      complaintsApi.addComment(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: complaintKeys.detail(id) });
      toast.success('تم إضافة التعليق بنجاح');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });
};
