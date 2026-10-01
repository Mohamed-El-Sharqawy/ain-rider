import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { PromosPage } from '../PromosPage'
import { CreatePromoModal } from '../components/CreatePromoModal'
import { EditPromoModal } from '../components/EditPromoModal'
import type { Promo } from '../services/transformers'

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

const promoDto = {
  id: 'p-1', code: 'SUMMER2026', type: 'PERCENTAGE', value: 20,
  maxUsagePerUser: 2, totalUsageLimit: 100, currentUsageCount: 7,
  status: 'ACTIVE', validFrom: '2026-01-01T00:00:00Z', validUntil: '2026-12-31T00:00:00Z',
  description: 'خصم الصيف', createdBy: 'admin', createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const promo: Promo = {
  id: 'p-1', code: 'SUMMER2026', type: 'PERCENTAGE', value: 20,
  maxUsagePerUser: 2, totalUsageLimit: 100, currentUsageCount: 7,
  status: 'ACTIVE', validFrom: '2026-01-01T00:00:00Z', validUntil: '2026-12-31T00:00:00Z',
  description: 'خصم الصيف', createdBy: 'admin', createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const user = userEvent.setup()

beforeEach(() => {
  localStorage.clear()
  api.get.mockReset()
  api.post.mockReset()
  api.patch.mockReset()
})

describe('PromosPage', () => {
  it('shows the skeleton while loading', () => {
    api.get.mockReturnValue(new Promise(() => {}))
    renderWithProviders(
      <NuqsTestingAdapter>
        <PromosPage />
      </NuqsTestingAdapter>,
    )
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders the error state with retry', async () => {
    api.get.mockRejectedValue(new Error('down'))
    renderWithProviders(
      <NuqsTestingAdapter>
        <PromosPage />
      </NuqsTestingAdapter>,
    )
    expect(await screen.findByText('فشل تحميل العروض الترويجية')).toBeInTheDocument()
  })

  it('renders the table and opens the edit modal from a row', async () => {
    api.get.mockResolvedValue({ data: [promoDto] })
    renderWithProviders(
      <NuqsTestingAdapter>
        <PromosPage />
      </NuqsTestingAdapter>,
    )
    await user.click(await screen.findByText('SUMMER2026'))
    expect(await screen.findByText('تعديل العرض الترويجي')).toBeInTheDocument()
    expect(screen.getByText('نسبة مئوية')).toBeInTheDocument()
    expect(screen.getByText('20%')).toBeInTheDocument()

    // closing the modal clears the selection
    await user.click(screen.getByText('Close'))
    await waitFor(() => expect(screen.queryByText('تعديل العرض الترويجي')).not.toBeInTheDocument())
  })

  it('renders fixed-amount promos and missing end dates', async () => {
    api.get.mockResolvedValue({
      data: [{ ...promoDto, id: 'p-2', code: 'FIXED10', type: 'FIXED', value: 50, validUntil: '' }],
    })
    renderWithProviders(
      <NuqsTestingAdapter>
        <PromosPage />
      </NuqsTestingAdapter>,
    )
    await screen.findByText('FIXED10')
    // fixed type label and currency-formatted value
    expect(screen.getByText('مبلغ ثابت')).toBeInTheDocument()
    expect(screen.getAllByText(/٥٠/).length).toBeGreaterThan(0)
    // no end date falls back to an em dash
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders the empty state without the clear action when unfiltered', async () => {
    api.get.mockResolvedValue({ data: [] })
    renderWithProviders(
      <NuqsTestingAdapter>
        <PromosPage />
      </NuqsTestingAdapter>,
    )
    expect(await screen.findByText('لا توجد عروض ترويجية')).toBeInTheDocument()
    expect(screen.queryByText('مسح الفلاتر')).not.toBeInTheDocument()
  })

  it('offers the clear action when a filter yields no rows', async () => {
    api.get.mockResolvedValue({ data: [] })
    renderWithProviders(
      <NuqsTestingAdapter searchParams="?status=ACTIVE">
        <PromosPage />
      </NuqsTestingAdapter>,
    )
    expect(await screen.findByText('لا توجد عروض ترويجية')).toBeInTheDocument()
    // the click wires clearFilters (state reset asserted in the trips/users suites)
    await user.click(screen.getByText('مسح الفلاتر'))
  })
})

describe('CreatePromoModal', () => {
  async function open() {
    renderWithProviders(<CreatePromoModal />)
    await user.click(await screen.findByText('إضافة عرض ترويجي'))
    await screen.findByText('إضافة عرض ترويجي جديد')
  }

  it('validates all fields on submit', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'إضافة' }))

    expect(await screen.findByText('كود الخصم مطلوب')).toBeInTheDocument()
    expect(screen.getByText('نوع الخصم مطلوب')).toBeInTheDocument()
    expect(screen.getByText('قيمة الخصم مطلوبة ويجب أن تكون أكبر من صفر')).toBeInTheDocument()
    expect(screen.getByText('الحد الأقصى للاستخدامات مطلوب ويجب أن يكون على الأقل 1')).toBeInTheDocument()
    expect(screen.getByText('الوصف مطلوب')).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('validates format rules and recovers field by field', async () => {
    await open()

    // the code input upper-cases automatically, so lowercase input is normalized
    await user.type(screen.getByPlaceholderText('SUMMER2026'), 'sum')
    const code = screen.getByPlaceholderText('SUMMER2026') as HTMLInputElement
    expect(code).toHaveValue('SUM')

    // choose the discount type via the select
    fireEvent.click(screen.getByText('اختر نوع الخصم'))
    fireEvent.click(await screen.findByText('نسبة مئوية', { selector: '[role="option"] *' }))

    await user.type(screen.getByLabelText('النسبة المئوية (%)'), '150')
    await user.type(screen.getByLabelText('الحد الأقصى للاستخدامات'), '200000')
    await user.type(screen.getByLabelText('الوصف'), 'قصير')
    fireEvent.click(screen.getByRole('button', { name: 'إضافة' }))

    expect(await screen.findByText('النسبة المئوية يجب أن لا تتجاوز 100%')).toBeInTheDocument()
    expect(screen.getByText('الحد الأقصى للاستخدامات يجب أن لا يتجاوز 100,000')).toBeInTheDocument()
    expect(screen.getByText('الوصف يجب أن يكون 5 أحرف على الأقل')).toBeInTheDocument()

    // typing clears individual errors
    fireEvent.change(code, { target: { value: 'SUMMER2026' } })

    fireEvent.change(screen.getByLabelText('النسبة المئوية (%)'), { target: { value: '20' } })
    fireEvent.change(screen.getByLabelText('الحد الأقصى للاستخدامات'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('الوصف'), { target: { value: 'خصم الصيف للركاب' } })

    // invalid date range
    fireEvent.change(screen.getByLabelText('صالح من (اختياري)'), { target: { value: '2026-06-01T00:00' } })
    fireEvent.change(screen.getByLabelText('صالح حتى (اختياري)'), { target: { value: '2026-05-01T00:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'إضافة' }))
    expect(await screen.findByText('تاريخ البداية يجب أن يكون قبل تاريخ النهاية')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('صالح حتى (اختياري)'), { target: { value: '2026-07-01T00:00' } })

    api.post.mockResolvedValue({ data: promoDto })
    fireEvent.click(screen.getByRole('button', { name: 'إضافة' }))
    await waitFor(() => expect(api.post).toHaveBeenCalled())
    expect(api.post.mock.calls[0][1].code).toBe('SUMMER2026')
    expect(api.post.mock.calls[0][1].validFrom).toBeDefined()
  })

  it('creates without optional dates', async () => {
    await open()
    fireEvent.change(screen.getByPlaceholderText('SUMMER2026'), { target: { value: 'FIX20' } })
    fireEvent.click(screen.getByText('اختر نوع الخصم'))
    fireEvent.click(await screen.findByText('مبلغ ثابت', { selector: '[role="option"] *' }))
    // the value label switches for FIXED type
    expect(screen.getByText('المبلغ (EGP)')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('المبلغ (EGP)'), { target: { value: '20' } })
    fireEvent.change(screen.getByLabelText('الحد الأقصى للاستخدامات'), { target: { value: '50' } })
    fireEvent.change(screen.getByLabelText('الوصف'), { target: { value: 'خصم ثابت' } })

    api.post.mockResolvedValue({ data: { ...promoDto, type: 'FIXED' } })
    fireEvent.click(screen.getByRole('button', { name: 'إضافة' }))
    await waitFor(() => expect(api.post).toHaveBeenCalled())
    expect(api.post.mock.calls[0][1].validFrom).toBeUndefined()
    expect(api.post.mock.calls[0][1].validUntil).toBeUndefined()
  })
})

describe('EditPromoModal', () => {
  it('renders nothing without a promo', () => {
    renderWithProviders(<EditPromoModal promo={null} open onClose={vi.fn()} />)
    expect(screen.queryByText('تعديل العرض الترويجي')).not.toBeInTheDocument()
  })

  it('seeds from the promo and saves', async () => {
    api.patch.mockResolvedValue({ data: promoDto })
    const onClose = vi.fn()
    const { rerender } = renderWithProviders(
      <EditPromoModal promo={promo} open onClose={onClose} />,
    )
    expect(await screen.findByDisplayValue('100')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('الحد الأقصى للاستخدامات'), { target: { value: '200' } })
    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }))
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/admin/promos/p-1', {
        status: 'ACTIVE',
        totalUsageLimit: 200,
      }),
    )
    await waitFor(() => expect(onClose).toHaveBeenCalled())

    // switching promos re-seeds the form
    rerender(<EditPromoModal promo={{ ...promo, id: 'p-2', totalUsageLimit: 5 }} open onClose={onClose} />)
    expect(await screen.findByDisplayValue('5')).toBeInTheDocument()
  })

  it('shows a spinner and disables save while the update is pending', async () => {
    api.patch.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<EditPromoModal promo={promo} open onClose={vi.fn()} />)
    await screen.findByDisplayValue('100')

    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }))
    expect(await screen.findByText('حفظ', { selector: 'button:disabled' })).toBeInTheDocument()
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })
})
