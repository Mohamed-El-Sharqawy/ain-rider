import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { EditSettingModal } from '../components/EditSettingModal'
import type { Setting } from '../services/transformers'

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

const user = userEvent.setup()

const baseSetting: Setting = {
  id: 's-1',
  key: 'app.name',
  value: 'عين رايدر',
  type: 'STRING',
  category: 'app-info',
  isPublic: false,
  updatedBy: 'admin',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

function renderModal(setting: Setting | null, open = true) {
  const onClose = vi.fn()
  renderWithProviders(<EditSettingModal setting={setting} open={open} onClose={onClose} />)
  return { onClose }
}

beforeEach(() => {
  api.get.mockReset()
  api.put.mockReset()
  api.put.mockResolvedValue({ data: {} })
})

describe('EditSettingModal', () => {
  it('renders nothing without a setting', () => {
    renderModal(null)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('seeds the form from the setting and saves a JSON value', async () => {
    const { onClose } = renderModal({ ...baseSetting, description: 'وصف الإعداد' })
    const dlg = await screen.findByRole('dialog')

    expect(within(dlg).getByDisplayValue('app.name')).toBeDisabled()
    expect(within(dlg).getByDisplayValue('app-info')).toBeDisabled()
    expect(within(dlg).getByLabelText('القيمة')).toHaveValue('عين رايدر')
    expect(within(dlg).getByLabelText('الوصف')).toHaveValue('وصف الإعداد')

    const value = within(dlg).getByLabelText('القيمة') as HTMLTextAreaElement
    await user.clear(value)
    // braces are userEvent key syntax; set the JSON payload directly
    fireEvent.change(value, { target: { value: '{"timeout":30}' } })
    // editing the description exercises its change handler too
    const description = within(dlg).getByLabelText('الوصف') as HTMLTextAreaElement
    await user.clear(description)
    await user.type(description, 'مهلة الاتصال بالثانية')
    await user.click(within(dlg).getByRole('button', { name: 'حفظ' }))

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/admin/settings/app.name', {
        value: { timeout: 30 },
        type: 'STRING',
        category: 'app-info',
        description: 'مهلة الاتصال بالثانية',
      }),
    )
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('stores plain text as-is when the value is not valid JSON', async () => {
    renderModal(baseSetting)
    const dlg = await screen.findByRole('dialog')

    const value = within(dlg).getByLabelText('القيمة') as HTMLTextAreaElement
    await user.clear(value)
    await user.type(value, 'نص عادي')

    await user.click(within(dlg).getByRole('button', { name: 'حفظ' }))
    await waitFor(() => expect(api.put).toHaveBeenCalled())
    expect(api.put.mock.calls[0][1].value).toBe('نص عادي')
  })

  it('sends an undefined description when the setting has none', async () => {
    renderModal(baseSetting)
    const dlg = await screen.findByRole('dialog')

    await user.click(within(dlg).getByRole('button', { name: 'حفظ' }))
    await waitFor(() => expect(api.put).toHaveBeenCalled())
    const payload = api.put.mock.calls[0][1]
    expect(payload.value).toBe('عين رايدر')
    expect(payload.description).toBeUndefined()
  })

  it('JSON-stringifies non-string setting values when seeding', async () => {
    renderModal({ ...baseSetting, value: [1, 2] as unknown as string })
    const dlg = await screen.findByRole('dialog')
    expect(within(dlg).getByLabelText('القيمة')).toHaveValue('[1,2]')
  })

  it('shows a spinner and disables save while the mutation is pending', async () => {
    api.put.mockReturnValue(new Promise(() => {}))
    renderModal(baseSetting)
    const dlg = await screen.findByRole('dialog')

    await user.click(within(dlg).getByRole('button', { name: 'حفظ' }))
    await waitFor(() => expect(within(dlg).getByRole('button', { name: /حفظ/ })).toBeDisabled())
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('closes without saving on cancel', async () => {
    const { onClose } = renderModal(baseSetting)
    const dlg = await screen.findByRole('dialog')

    await user.click(within(dlg).getByRole('button', { name: 'إلغاء' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(api.put).not.toHaveBeenCalled()
  })
})
