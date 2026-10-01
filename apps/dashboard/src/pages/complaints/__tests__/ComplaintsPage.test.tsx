import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { ComplaintsPage } from '../ComplaintsPage'
import { ComplaintDetailModal } from '../components/ComplaintDetailModal'
import { useAuthStore } from '@/stores/authStore'
import type { Complaint } from '../services/transformers'

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

const complaintDto = {
  id: 'cm-1',
  complainantId: 'u-1',
  complainantRole: 'RIDER',
  type: 'SAFETY',
  subject: 'سائق متأخر',
  description: 'التأخر عن الموعد',
  status: 'PENDING',
  priority: 'HIGH',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  comments: [],
}

const admin = {
  id: 'admin-1', email: 'a@a.com', firstName: 'أ', lastName: 'ب', fullName: 'أ ب',
  phoneNumber: '+20', role: 'ADMIN' as const, status: 'ACTIVE',
  createdAt: '', updatedAt: '',
}

const resolvedComplaint: Complaint = {
  id: 'cm-2',
  complainantId: 'u-1',
  complainantRole: 'RIDER',
  type: 'SAFETY',
  subject: 'موضوع آخر',
  description: 'وصف',
  status: 'RESOLVED',
  priority: 'LOW',
  resolution: 'تم الحل',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  comments: [
    {
      id: 'c-1',
      complaintId: 'cm-2',
      userId: 'u-1',
      userRole: 'admin',
      comment: 'تعليق سابق',
      isInternal: false,
      createdAt: '2026-01-02T00:00:00Z',
    },
  ],
}

const user = userEvent.setup()

beforeEach(() => {
  localStorage.clear()
  useAuthStore.setState({ user: admin, isAuthenticated: true })
  api.get.mockReset()
  api.post.mockReset()
  api.patch.mockReset()
})

function renderPage(search = '') {
  renderWithProviders(
    <NuqsTestingAdapter searchParams={search}>
      <ComplaintsPage />
    </NuqsTestingAdapter>,
    { routerProps: { initialEntries: ['/complaints'] } },
  )
}

describe('ComplaintsPage', () => {
  it('shows the skeleton while loading', () => {
    api.get.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders the error state with retry', async () => {
    api.get.mockRejectedValue(new Error('down'))
    renderPage()
    expect(await screen.findByText('فشل تحميل الشكاوى')).toBeInTheDocument()
    expect(screen.getByText('إعادة المحاولة')).toBeInTheDocument()
  })

  it('renders the table and opens the detail modal from a row', async () => {
    api.get.mockResolvedValue({
      data: { data: [complaintDto], total: 1, page: 1, limit: 20, totalPages: 1 },
    })
    renderPage()
    await user.click(await screen.findByText('سائق متأخر'))
    expect(await screen.findByText('تفاصيل الشكوى')).toBeInTheDocument()
    expect(screen.getByText('التأخر عن الموعد')).toBeInTheDocument()

    // closing the modal clears the selection
    await user.click(screen.getByText('Close'))
    await waitFor(() => expect(screen.queryByText('تفاصيل الشكوى')).not.toBeInTheDocument())
  })

  it('renders the empty state without the clear action when unfiltered', async () => {
    api.get.mockResolvedValue({ data: { data: [], total: 0, page: 1, limit: 20, totalPages: 1 } })
    renderPage()
    expect(await screen.findByText('لا توجد شكاوى')).toBeInTheDocument()
    expect(screen.queryByText('مسح الفلاتر')).not.toBeInTheDocument()
  })

  it('renders the assigned admin id when a complaint is assigned', async () => {
    api.get.mockResolvedValue({
      data: { data: [{ ...complaintDto, assignedTo: 'admin-1' }], total: 1, page: 1, limit: 20, totalPages: 1 },
    })
    renderPage()
    expect(await screen.findByText('admin-1')).toBeInTheDocument()
  })

  it('offers the clear action when a filter yields no rows', async () => {
    api.get.mockResolvedValue({ data: { data: [], total: 0, page: 1, limit: 20, totalPages: 1 } })
    renderPage('?status=PENDING')
    expect(await screen.findByText('لا توجد شكاوى')).toBeInTheDocument()
    // the click wires clearFilters (state reset asserted in the trips/users suites)
    await user.click(screen.getByText('مسح الفلاتر'))
  })
})

describe('ComplaintDetailModal', () => {
  function renderModal(complaint: Complaint | null) {
    renderWithProviders(<ComplaintDetailModal complaint={complaint} open onClose={vi.fn()} />)
  }

  it('renders nothing without a complaint', () => {
    renderModal(null)
    expect(screen.queryByText('تفاصيل الشكوى')).not.toBeInTheDocument()
  })

  it('renders details, resolution and comments', async () => {
    renderModal(resolvedComplaint)
    expect(await screen.findByText('تفاصيل الشكوى')).toBeInTheDocument()
    expect(screen.getByText('تم الحل')).toBeInTheDocument()
    expect(screen.getByText('التعليقات (1)')).toBeInTheDocument()
    expect(screen.getByText('تعليق سابق')).toBeInTheDocument()
  })

  it('adds a comment through the optimistic mutation', async () => {
    api.post.mockResolvedValue({ data: complaintDto })
    renderModal(resolvedComplaint)
    await screen.findByText('تفاصيل الشكوى')

    const send = screen.getByText('إضافة تعليق')
    expect(send).toBeDisabled()
    await user.type(screen.getByPlaceholderText('أضف تعليقاً...'), 'تعليق من الاختبار')
    await user.click(send)
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/complaints/cm-2/comments', {
        comment: 'تعليق من الاختبار',
        isInternal: false,
      }),
    )
  })

  it('blocks an invalid status transition', async () => {
    renderModal(resolvedComplaint) // RESOLVED is terminal
    await screen.findByText('تفاصيل الشكوى')

    // nothing selected: button disabled
    const updateBtn = screen.getByRole('button', { name: 'تحديث الحالة' })
    expect(updateBtn).toBeDisabled()
    expect(api.patch).not.toHaveBeenCalled()
  })

  it('shows the transition error when the selected status is invalid', async () => {
    renderModal({ ...resolvedComplaint, status: 'IN_PROGRESS' })
    await screen.findByText('تفاصيل الشكوى')

    // IN_PROGRESS -> IN_PROGRESS is not an allowed transition
    fireEvent.click(screen.getByText('اختر حالة جديدة'))
    fireEvent.click(await screen.findByText('قيد المعالجة', { selector: '[role="option"] *' }))
    fireEvent.click(screen.getByRole('button', { name: 'تحديث الحالة' }))
    expect(
      await screen.findByText('لا يمكن تغيير الحالة من "IN_PROGRESS" إلى "IN_PROGRESS"'),
    ).toBeInTheDocument()
    expect(api.patch).not.toHaveBeenCalled()
  })

  it('no-ops when the disabled controls are force-clicked', async () => {
    renderModal(resolvedComplaint)
    await screen.findByText('تفاصيل الشكوى')

    // both buttons are disabled while there is nothing to send
    fireEvent.click(screen.getByRole('button', { name: 'تحديث الحالة' }))
    fireEvent.click(screen.getByRole('button', { name: 'إضافة تعليق' }))
    expect(api.patch).not.toHaveBeenCalled()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('requires resolution notes when resolving', async () => {
    renderModal({ ...resolvedComplaint, status: 'IN_PROGRESS' })
    await screen.findByText('تفاصيل الشكوى')

    // choose RESOLVED from the select
    fireEvent.click(screen.getByText('اختر حالة جديدة'))
    fireEvent.click(await screen.findByText('محلول', { selector: '[role="option"] *' }))
    fireEvent.click(screen.getByRole('button', { name: 'تحديث الحالة' }))
    expect(
      await screen.findByText('ملاحظات الحل مطلوبة عند إغلاق الشكوى'),
    ).toBeInTheDocument()
    expect(api.patch).not.toHaveBeenCalled()

    // typing clears the error, then a short resolution is still rejected
    await user.type(screen.getByPlaceholderText('ملاحظات الحل...'), 'قصير')
    fireEvent.click(screen.getByRole('button', { name: 'تحديث الحالة' }))
    expect(await screen.findByText('ملاحظات الحل يجب أن تكون 10 أحرف على الأقل')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('ملاحظات الحل...'), ' وطويل بما يكفي')
    fireEvent.click(screen.getByRole('button', { name: 'تحديث الحالة' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalled())
    expect(api.patch.mock.calls[0][1].status).toBe('RESOLVED')
  })

  it('moves a complaint in progress and clears the form on success', async () => {
    api.patch.mockResolvedValue({ data: complaintDto })
    renderModal({ ...resolvedComplaint, status: 'PENDING' })
    await screen.findByText('تفاصيل الشكوى')

    fireEvent.click(screen.getByText('اختر حالة جديدة'))
    fireEvent.click(await screen.findByText('قيد المعالجة', { selector: '[role="option"] *' }))
    fireEvent.click(screen.getByRole('button', { name: 'تحديث الحالة' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalled())
    expect(api.patch.mock.calls[0][1].status).toBe('IN_PROGRESS')
  })
})
