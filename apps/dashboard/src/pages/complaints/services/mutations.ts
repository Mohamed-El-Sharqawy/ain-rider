import { useMutation, useQueryClient } from '@tanstack/react-query';
import { complaintsApi } from './api';
import { complaintKeys, type PaginatedComplaints } from './queries';
import { getApiError } from '@/api/client';
import { toast } from 'sonner';
import type { CreateComplaintDTO, AddComplaintCommentDTO } from './dto';
import type { Complaint } from './transformers';

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
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: complaintKeys.detail(id) });

      const previousDetail = queryClient.getQueryData<Complaint>(complaintKeys.detail(id));

      if (previousDetail) {
        const optimisticallyUpdated: Complaint = {
          ...previousDetail,
          status: data.status,
          assignedTo: data.assignedTo,
          resolution: data.status === 'RESOLVED' ? data.resolution : previousDetail.resolution,
          updatedAt: new Date().toISOString(),
        };
        queryClient.setQueryData(complaintKeys.detail(id), optimisticallyUpdated);
      }

      // Update every cached LIST (prefix match on ['complaints', 'list']);
      // a bare complaintKeys.all match would also hit detail queries, whose
      // shape is a single Complaint, and crash the optimistic updater.
      queryClient.setQueriesData<PaginatedComplaints>(
        { queryKey: [...complaintKeys.all, 'list'] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((c) =>
              c.id === id
                ? { ...c, status: data.status, assignedTo: data.assignedTo, updatedAt: new Date().toISOString() }
                : c
            ),
          };
        },
      );

      return { previousDetail };
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: complaintKeys.all });
      queryClient.invalidateQueries({ queryKey: complaintKeys.detail(id) });
      toast.success('تم تحديث حالة الشكوى بنجاح');
    },
    onError: (err, { id }, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(complaintKeys.detail(id), context.previousDetail);
      }
      queryClient.invalidateQueries({ queryKey: complaintKeys.all });
      toast.error(getApiError(err));
    },
  });
};

export const useAddComplaintComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AddComplaintCommentDTO }) =>
      complaintsApi.addComment(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: complaintKeys.detail(id) });

      const previousDetail = queryClient.getQueryData<Complaint>(complaintKeys.detail(id));

      if (previousDetail) {
        const optimisticComment = {
          id: `temp-${Date.now()}`,
          complaintId: id,
          userId: '',
          userRole: 'admin',
          comment: data.comment,
          isInternal: data.isInternal ?? false,
          createdAt: new Date().toISOString(),
        };
        const optimisticallyUpdated: Complaint = {
          ...previousDetail,
          comments: [...previousDetail.comments, optimisticComment],
        };
        queryClient.setQueryData(complaintKeys.detail(id), optimisticallyUpdated);
      }

      return { previousDetail };
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: complaintKeys.detail(id) });
      toast.success('تم إضافة التعليق بنجاح');
    },
    onError: (err, { id }, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(complaintKeys.detail(id), context.previousDetail);
      }
      toast.error(getApiError(err));
    },
  });
};
