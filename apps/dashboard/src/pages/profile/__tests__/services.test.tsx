import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import { toast } from 'sonner'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))
vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  api,
}))

import { profileApi } from '../services/api'
import { useGetProfile, profileKeys } from '../services/queries'
import {
  useUpdateProfile,
  useUploadProfileImage,
  useDeleteProfileImage,
} from '../services/mutations'

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  }
}

function makeFile(type = 'image/png'): File {
  return new File(['x'], 'avatar.png', { type })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })))
})

describe('profileApi', () => {
  it('calls the profile endpoints', () => {
    profileApi.getProfile()
    expect(api.get).toHaveBeenCalledWith('/admin/profile')
    profileApi.updateProfile({ firstName: 'أ' })
    expect(api.patch).toHaveBeenCalledWith('/admin/profile', { firstName: 'أ' })
    profileApi.generateUploadUrl('avatar.png', 'image/png')
    expect(api.post).toHaveBeenCalledWith('/admin/profile/upload-url', {
      fileName: 'avatar.png',
      contentType: 'image/png',
    })
    profileApi.deleteProfileImage()
    expect(api.delete).toHaveBeenCalledWith('/admin/profile/image')
  })

  it('uploads to MinIO with a presigned PUT', async () => {
    const file = makeFile()
    await profileApi.uploadToMinIO('https://minio/signed', file)
    expect(fetch).toHaveBeenCalledWith('https://minio/signed', {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': 'image/png' },
    })
  })
})

describe('useGetProfile', () => {
  it('fetches the profile', async () => {
    api.get.mockResolvedValue({ data: { id: 'p-1', firstName: 'أ' } })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useGetProfile(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.id).toBe('p-1')
    expect(profileKeys.detail()).toEqual(['profile', 'detail'])
  })
})

describe('useUpdateProfile', () => {
  it('invalidates and toasts on success', async () => {
    api.patch.mockResolvedValue({ data: {} })
    const { wrapper, queryClient } = makeWrapper()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useUpdateProfile(), { wrapper })
    act(() => result.current.mutate({ firstName: 'أ' }))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(spy).toHaveBeenCalledWith({ queryKey: profileKeys.all })
    expect(toast.success).toHaveBeenCalledWith('تم تحديث الملف الشخصي بنجاح')
  })

  it('toasts a fixed error message on failure', async () => {
    api.patch.mockRejectedValue(new Error('x'))
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useUpdateProfile(), { wrapper })
    act(() => result.current.mutate({ firstName: 'أ' }))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('فشل تحديث الملف الشخصي')
  })
})

describe('useUploadProfileImage', () => {
  it('generates a url, uploads to MinIO then updates the profile', async () => {
    api.post.mockResolvedValue({
      data: { uploadUrl: 'https://minio/signed', publicUrl: 'https://cdn/a.png' },
    })
    api.patch.mockResolvedValue({ data: {} })
    const { wrapper, queryClient } = makeWrapper()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useUploadProfileImage(), { wrapper })

    act(() => result.current.mutate(makeFile()))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe('https://cdn/a.png')
    expect(api.patch).toHaveBeenCalledWith('/admin/profile', {
      profileImage: 'https://cdn/a.png',
    })
    expect(spy).toHaveBeenCalledWith({ queryKey: profileKeys.all })
    expect(toast.success).toHaveBeenCalledWith('تم رفع الصورة بنجاح')
  })

  it('toasts a fixed error when any step fails', async () => {
    api.post.mockRejectedValue(new Error('x'))
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useUploadProfileImage(), { wrapper })
    act(() => result.current.mutate(makeFile()))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('فشل رفع الصورة')
  })
})

describe('useDeleteProfileImage', () => {
  it('deletes, invalidates and toasts', async () => {
    api.delete.mockResolvedValue({ data: {} })
    const { wrapper, queryClient } = makeWrapper()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useDeleteProfileImage(), { wrapper })
    act(() => result.current.mutate())
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(spy).toHaveBeenCalledWith({ queryKey: profileKeys.all })
    expect(toast.success).toHaveBeenCalledWith('تم حذف الصورة بنجاح')
  })

  it('toasts a fixed error on failure', async () => {
    api.delete.mockRejectedValue(new Error('x'))
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useDeleteProfileImage(), { wrapper })
    act(() => result.current.mutate())
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('فشل حذف الصورة')
  })
})
