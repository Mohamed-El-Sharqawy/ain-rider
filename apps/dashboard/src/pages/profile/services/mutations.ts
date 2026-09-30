import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { profileApi } from './api'
import { profileKeys } from './queries'
import type { UpdateProfileDTO } from './dto'

export const useUpdateProfile = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateProfileDTO) => profileApi.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.all })
      toast.success('تم تحديث الملف الشخصي بنجاح')
    },
    onError: () => {
      toast.error('فشل تحديث الملف الشخصي')
    },
  })
}

export const useUploadProfileImage = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (file: File) => {
      const { data: uploadData } = await profileApi.generateUploadUrl(
        file.name,
        file.type
      )

      await profileApi.uploadToMinIO(uploadData.uploadUrl, file)

      await profileApi.updateProfile({ profileImage: uploadData.publicUrl })

      return uploadData.publicUrl
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.all })
      toast.success('تم رفع الصورة بنجاح')
    },
    onError: () => {
      toast.error('فشل رفع الصورة')
    },
  })
}

export const useDeleteProfileImage = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => profileApi.deleteProfileImage(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.all })
      toast.success('تم حذف الصورة بنجاح')
    },
    onError: () => {
      toast.error('فشل حذف الصورة')
    },
  })
}
