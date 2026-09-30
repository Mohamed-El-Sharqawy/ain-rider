import { useQuery } from '@tanstack/react-query'
import { profileApi } from './api'
import type { ProfileDTO } from './dto'

export const profileKeys = {
  all: ['profile'] as const,
  detail: () => [...profileKeys.all, 'detail'] as const,
}

export const useGetProfile = () => {
  return useQuery<ProfileDTO>({
    queryKey: profileKeys.detail(),
    queryFn: () => profileApi.getProfile().then((r) => r.data),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  })
}
