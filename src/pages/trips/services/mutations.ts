// ─── Trips Mutations ─────────────────────────────────────────────────────────
// TanStack Query mutation hooks for mutating trips data.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { tripsApi } from './api'
import { tripKeys } from './queries'
import { getApiError } from '@/api/client'
import { toast } from 'sonner'

export const useCancelTrip = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, reason, cancelledBy }: { id: string; reason: string; cancelledBy: string }) =>
      tripsApi.cancel(id, { reason, cancelledBy }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.all })
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(id) })
      toast.success('تم إلغاء الرحلة بنجاح')
    },
    onError: (err) => {
      toast.error(getApiError(err))
    },
  })
}
