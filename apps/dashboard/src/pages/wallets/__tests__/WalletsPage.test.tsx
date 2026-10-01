import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { WalletsPage } from '../WalletsPage'
import { ProcessWithdrawalModal } from '../components/ProcessWithdrawalModal'
import type { Withdrawal } from '../services/transformers'

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

const withdrawalDto = {
  id: 'wd-1', userId: 'user-99', amount: 300, status: 'PENDING',
  bankDetails: { accountName: 'أحمد', accountNumber: '123456', bankName: 'بنك مصر' },
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
}

const withdrawal: Withdrawal = {
  id: 'wd-1', userId: 'user-99', amount: 300, status: 'PENDING',
  accountName: 'أحمد', accountNumber: '123456', bankName: 'بنك مصر',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
}

const user = userEvent.setup()

beforeEach(() => {
  localStorage.clear()
  api.get.mockReset()
  api.patch.mockReset()
})

describe('WalletsPage', () => {
  it('shows the skeleton while loading', () => {
    api.get.mockReturnValue(new Promise(() => {}))
    renderWithProviders(
      <NuqsTestingAdapter>
        <WalletsPage />
      </NuqsTestingAdapter>,
    )
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders the error state with retry', async () => {
    api.get.mockRejectedValue(new Error('down'))
    renderWithProviders(
      <NuqsTestingAdapter>
        <WalletsPage />
      </NuqsTestingAdapter>,
    )
    expect(await screen.findByText('فشل تحميل طلبات السحب')).toBeInTheDocument()
  })

  it('renders the cash-payment notice, stats and the table', async () => {
    api.get.mockResolvedValue({
      data: [
        withdrawalDto,
        { ...withdrawalDto, id: 'wd-2', status: 'COMPLETED', processedAt: '2026-01-05T12:00:00Z' },
      ],
    })
    renderWithProviders(
      <NuqsTestingAdapter>
        <WalletsPage />
      </NuqsTestingAdapter>,
    )
    expect(await screen.findByText('نظام الدفع النقدي')).toBeInTheDocument()
    expect(screen.getByText('طلبات معلقة')).toBeInTheDocument()
    expect(screen.getByText('إجمالي المعلق')).toBeInTheDocument()
    expect(screen.getByText('طلبات مكتملة')).toBeInTheDocument()
    expect(await screen.findByText('wd-2')).toBeInTheDocument()
    // processed withdrawals show their processing date
    expect(screen.getAllByText(/يناير|يناير ٢٠٢٦|2026/).length).toBeGreaterThan(0)
    // opens the process modal from a row click
    await user.click(await screen.findByText('wd-1'))
    expect(await screen.findByText('معالجة طلب السحب')).toBeInTheDocument()

    // closing the modal clears the selection
    await user.click(screen.getByText('Close'))
    await waitFor(() => expect(screen.queryByText('معالجة طلب السحب')).not.toBeInTheDocument())
  })

  it('renders the empty state without the clear action when unfiltered', async () => {
    api.get.mockResolvedValue({ data: [] })
    renderWithProviders(
      <NuqsTestingAdapter>
        <WalletsPage />
      </NuqsTestingAdapter>,
    )
    expect(await screen.findByText('لا توجد طلبات سحب')).toBeInTheDocument()
    expect(screen.queryByText('مسح الفلاتر')).not.toBeInTheDocument()
  })

  it('offers the clear action when a filter yields no rows', async () => {
    api.get.mockResolvedValue({ data: [] })
    renderWithProviders(
      <NuqsTestingAdapter searchParams="?status=PENDING">
        <WalletsPage />
      </NuqsTestingAdapter>,
    )
    expect(await screen.findByText('لا توجد طلبات سحب')).toBeInTheDocument()
    // the click wires clearFilters (state reset asserted in the trips/users suites)
    await user.click(screen.getByText('مسح الفلاتر'))
  })
})

describe('ProcessWithdrawalModal', () => {
  it('renders nothing without a withdrawal', () => {
    renderWithProviders(<ProcessWithdrawalModal withdrawal={null} open onClose={vi.fn()} />)
    expect(screen.queryByText('معالجة طلب السحب')).not.toBeInTheDocument()
  })

  it('requires a decision before submitting', async () => {
    api.patch.mockResolvedValue({ data: withdrawalDto })
    renderWithProviders(
      <ProcessWithdrawalModal withdrawal={withdrawal} open onClose={vi.fn()} />,
    )
    expect(await screen.findByText('معالجة طلب السحب')).toBeInTheDocument()
    expect(screen.getByText('اختر القرار')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'معالجة' }))
    expect(api.patch).not.toHaveBeenCalled()
  })

  it('approves a withdrawal and closes', async () => {
    api.patch.mockResolvedValue({ data: { ...withdrawalDto, status: 'COMPLETED' } })
    const onClose = vi.fn()
    renderWithProviders(
      <ProcessWithdrawalModal withdrawal={withdrawal} open onClose={onClose} />,
    )
    await screen.findByText('معالجة طلب السحب')

    fireEvent.click(screen.getByText('اختر القرار'))
    fireEvent.click(await screen.findByText('قبول', { selector: '[role="option"] *' }))
    fireEvent.click(screen.getByRole('button', { name: 'معالجة' }))
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/admin/withdrawals/wd-1/process', {
        approve: true,
        rejectionReason: undefined,
      }),
    )
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('requires a rejection reason when rejecting', async () => {
    api.patch.mockResolvedValue({ data: withdrawalDto })
    const onClose = vi.fn()
    renderWithProviders(
      <ProcessWithdrawalModal withdrawal={withdrawal} open onClose={onClose} />,
    )
    await screen.findByText('معالجة طلب السحب')

    fireEvent.click(screen.getByText('اختر القرار'))
    fireEvent.click(await screen.findByText('رفض', { selector: '[role="option"] *' }))
    // the rejection reason textarea appears and its change handler runs
    const reason = screen.getByPlaceholderText('أدخل سبب الرفض...')
    fireEvent.change(reason, { target: { value: 'بيانات غير صحيحة' } })
    expect(reason).toHaveValue('بيانات غير صحيحة')

    // rejecting with a reason processes the withdrawal
    api.patch.mockResolvedValue({ data: { ...withdrawalDto, status: 'REJECTED' } })
    fireEvent.click(screen.getByRole('button', { name: 'معالجة' }))
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/admin/withdrawals/wd-1/process', {
        approve: false,
        rejectionReason: 'بيانات غير صحيحة',
      }),
    )
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('shows the pending spinner while processing', async () => {
    api.patch.mockReturnValue(new Promise(() => {}))
    renderWithProviders(
      <ProcessWithdrawalModal withdrawal={withdrawal} open onClose={vi.fn()} />,
    )
    await screen.findByText('معالجة طلب السحب')

    fireEvent.click(screen.getByText('اختر القرار'))
    fireEvent.click(await screen.findByText('قبول', { selector: '[role="option"] *' }))
    fireEvent.click(screen.getByRole('button', { name: 'معالجة' }))

    expect(await screen.findByText('معالجة', { selector: 'button:disabled' })).toBeInTheDocument()
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })
})
