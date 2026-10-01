import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, waitFor, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { ProfilePage } from '../ProfilePage'

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

const profile = {
  id: 'p-1',
  email: 'admin@ainrider.com',
  phoneNumber: '01001234567',
  firstName: 'عامر',
  lastName: 'الأدمن',
  role: 'ADMIN',
  status: 'ACTIVE',
  profileImage: 'https://cdn/a.png' as string | null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const user = userEvent.setup()

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('alert', vi.fn())
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ProfilePage', () => {
  it('shows the loading skeleton', () => {
    api.get.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<ProfilePage />)
    expect(document.querySelector('[data-slot="skeleton"], .animate-pulse')).toBeInTheDocument()
  })

  it('shows a not-found card when the profile is missing', async () => {
    api.get.mockRejectedValue(new Error('404'))
    renderWithProviders(<ProfilePage />)
    expect(await screen.findByText('لم يتم العثور على بيانات الملف الشخصي')).toBeInTheDocument()
  })

  it('renders the profile with the delete button when an image exists', async () => {
    api.get.mockResolvedValue({ data: profile })
    renderWithProviders(<ProfilePage />)
    expect(await screen.findByText('عا')).toBeInTheDocument()
    expect(screen.getByText('حذف الصورة')).toBeInTheDocument()
    expect(screen.getByText('ADMIN')).toBeInTheDocument()
    expect(screen.getByText('ACTIVE')).toBeInTheDocument()
  })

  it('hides the delete button without a profile image', async () => {
    api.get.mockResolvedValue({ data: { ...profile, profileImage: null } })
    renderWithProviders(<ProfilePage />)
    await screen.findByText('عا')
    expect(screen.queryByText('حذف الصورة')).not.toBeInTheDocument()
  })

  it('builds initials from empty names safely', async () => {
    api.get.mockResolvedValue({ data: { ...profile, firstName: '', lastName: '' } })
    renderWithProviders(<ProfilePage />)
    await screen.findByText('ADMIN')
    const fallback = document.querySelector('[data-slot="avatar-fallback"]')
    expect(fallback?.textContent).toBe('')
  })

  it('deletes the image after confirmation', async () => {
    api.get.mockResolvedValue({ data: profile })
    api.delete.mockResolvedValue({ data: {} })
    renderWithProviders(<ProfilePage />)
    await user.click(await screen.findByText('حذف الصورة'))
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/admin/profile/image'))
    expect(confirm).toHaveBeenCalledWith('هل أنت متأكد من حذف الصورة الشخصية؟')
  })

  it('skips deletion when confirm is dismissed', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))
    api.get.mockResolvedValue({ data: profile })
    renderWithProviders(<ProfilePage />)
    await user.click(await screen.findByText('حذف الصورة'))
    expect(api.delete).not.toHaveBeenCalled()
  })

  it('rejects oversized files with an alert', async () => {
    api.get.mockResolvedValue({ data: { ...profile, profileImage: null } })
    renderWithProviders(<ProfilePage />)
    await screen.findByText('رفع صورة')
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const big = new File([new ArrayBuffer(6 * 1024 * 1024)], 'big.png', { type: 'image/png' })
    await user.upload(input, big)
    expect(alert).toHaveBeenCalledWith('حجم الملف يجب أن يكون أقل من 5 ميجابايت')
    expect(api.post).not.toHaveBeenCalled()
  })

  it('rejects disallowed file types with an alert', async () => {
    api.get.mockResolvedValue({ data: { ...profile, profileImage: null } })
    renderWithProviders(<ProfilePage />)
    await screen.findByText('رفع صورة')
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const pdf = new File(['x'], 'doc.pdf', { type: 'application/pdf' })
    // user.upload respects the accept attribute; dispatch the change directly
    await act(async () => {
      fireEvent.change(input, { target: { files: [pdf] } })
    })
    expect(alert).toHaveBeenCalledWith('يرجى اختيار ملف من نوع JPG, PNG, GIF أو WebP')
    expect(api.post).not.toHaveBeenCalled()
  })

  it('uploads a valid image through the presigned flow', async () => {
    api.get.mockResolvedValue({ data: { ...profile, profileImage: null } })
    api.post.mockResolvedValue({
      data: { uploadUrl: 'https://minio/signed', publicUrl: 'https://cdn/new.png' },
    })
    api.patch.mockResolvedValue({ data: {} })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    )
    renderWithProviders(<ProfilePage />)
    await screen.findByText('رفع صورة')
    // the visible button triggers the hidden file input
    await user.click(screen.getByText('رفع صورة'))
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, new File(['x'], 'me.png', { type: 'image/png' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/profile/upload-url', {
      fileName: 'me.png',
      contentType: 'image/png',
    }))
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/admin/profile', { profileImage: 'https://cdn/new.png' }),
    )
  })

  it('edits, validates and saves the profile', async () => {
    api.get.mockResolvedValue({ data: profile })
    api.patch.mockResolvedValue({ data: {} })
    renderWithProviders(<ProfilePage />)
    await user.click(await screen.findByText('تعديل الملف الشخصي'))
    expect(screen.getByText('حفظ التغييرات')).toBeInTheDocument()

    // clear required fields to trigger validation errors
    const first = screen.getByLabelText('الاسم الأول') as HTMLInputElement
    const last = screen.getByLabelText('الاسم الأخير') as HTMLInputElement
    const email = screen.getByLabelText('البريد الإلكتروني') as HTMLInputElement
    const phone = screen.getByLabelText('رقم الهاتف') as HTMLInputElement

    await user.clear(first)
    await user.clear(last)
    await user.clear(email)
    await user.clear(phone)
    await user.click(screen.getByText('حفظ التغييرات'))

    expect(await screen.findByText('الاسم الأول مطلوب')).toBeInTheDocument()
    expect(screen.getByText('الاسم الأخير مطلوب')).toBeInTheDocument()
    expect(screen.getByText('البريد الإلكتروني مطلوب')).toBeInTheDocument()
    expect(screen.getByText('رقم الهاتف مطلوب')).toBeInTheDocument()
    expect(api.patch).not.toHaveBeenCalled()

    // typing clears the individual error
    await user.type(first, 'س')
    expect(screen.queryByText('الاسم الأول مطلوب')).not.toBeInTheDocument()

    await user.type(last, 'م')
    await user.type(email, 's@a.com')
    await user.type(phone, '01001234567')
    await user.click(screen.getByText('حفظ التغييرات'))

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/admin/profile', {
        firstName: 'س',
        lastName: 'م',
        email: 's@a.com',
        phoneNumber: '+201001234567',
      }),
    )
    // exits editing mode on success
    expect(await screen.findByText('تعديل الملف الشخصي')).toBeInTheDocument()
  })

  it('rejects an invalid email and phone format', async () => {
    api.get.mockResolvedValue({ data: profile })
    renderWithProviders(<ProfilePage />)
    await user.click(await screen.findByText('تعديل الملف الشخصي'))
    await user.clear(screen.getByLabelText('البريد الإلكتروني'))
    await user.type(screen.getByLabelText('البريد الإلكتروني'), 'not-an-email')
    await user.clear(screen.getByLabelText('رقم الهاتف'))
    await user.type(screen.getByLabelText('رقم الهاتف'), '12345')
    await user.click(screen.getByText('حفظ التغييرات'))
    expect(await screen.findByText('البريد الإلكتروني غير صالح')).toBeInTheDocument()
    expect(screen.getByText('رقم الهاتف يجب أن يكون رقم مصري صالح (مثال: +201001234567)')).toBeInTheDocument()
  })

  it('cancels editing and resets the form', async () => {
    api.get.mockResolvedValue({ data: profile })
    renderWithProviders(<ProfilePage />)
    await user.click(await screen.findByText('تعديل الملف الشخصي'))
    await user.clear(screen.getByLabelText('الاسم الأول'))
    await user.type(screen.getByLabelText('الاسم الأول'), 'معدل')
    await user.click(screen.getByText('إلغاء'))
    expect(await screen.findByText('تعديل الملف الشخصي')).toBeInTheDocument()
    // form values fall back to the profile values
    expect(screen.getByLabelText('الاسم الأول')).toHaveValue('عامر')
  })

  it('no-ops when the file input changes with no file', async () => {
    api.get.mockResolvedValue({ data: { ...profile, profileImage: null } })
    renderWithProviders(<ProfilePage />)
    await screen.findByText('رفع صورة')
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await act(async () => {
      fireEvent.change(input, { target: { files: [] } })
    })
    expect(api.post).not.toHaveBeenCalled()
  })

  it('shows the uploading label while the upload is pending', async () => {
    api.get.mockResolvedValue({ data: { ...profile, profileImage: null } })
    api.post.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<ProfilePage />)
    await screen.findByText('رفع صورة')
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, new File(['x'], 'me.png', { type: 'image/png' }))
    expect(await screen.findByText('جاري الرفع...')).toBeInTheDocument()
  })

  it('shows the deleting label while the delete is pending', async () => {
    api.get.mockResolvedValue({ data: profile })
    api.delete.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<ProfilePage />)
    await user.click(await screen.findByText('حذف الصورة'))
    expect(await screen.findByText('جاري الحذف...')).toBeInTheDocument()
  })
})
