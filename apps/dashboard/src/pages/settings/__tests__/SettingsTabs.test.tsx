import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, waitFor, act, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { AppInformationTab } from '../tabs/AppInformationTab'
import { GeneralSettingsTab } from '../tabs/GeneralSettingsTab'
import { LanguagesTab } from '../tabs/LanguagesTab'
import { CancellationReasonTab } from '../tabs/CancellationReasonTab'
import { SettingsPage } from '../SettingsPage'
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

const setting = (key: string, value: unknown, category = 'general') => ({
  id: `s-${key}`, key, value, type: 'STRING', category, isPublic: false,
  updatedBy: 'admin', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
})

const user = userEvent.setup()

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
  api.get.mockReset()
  api.put.mockReset()
  api.post.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** The icon-only buttons inside a table row (edit = pencil, delete = trash). */
function rowButtons(rowText: string) {
  const row = screen.getByText(rowText).closest('tr')!
  const buttons = within(row).getAllByRole('button')
  return {
    edit: buttons.find((b) => b.querySelector('svg.lucide-pencil')),
    trash: buttons.find((b) => b.querySelector('svg.lucide-trash-2')),
  }
}

describe('AppInformationTab', () => {
  it('shows the loading skeleton', () => {
    api.get.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<AppInformationTab />)
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('falls back to empty defaults for missing app-info settings', async () => {
    api.get.mockResolvedValue({ data: [setting('company.name', 'شركة عين', 'app-info')] })
    renderWithProviders(<AppInformationTab />)
    expect(await screen.findByLabelText('اسم التطبيق *')).toHaveValue('')
    expect(screen.getByLabelText('اسم الشركة *')).toHaveValue('شركة عين')
  })

  it('shows the saving label while the batch is pending', async () => {
    api.get.mockResolvedValue({ data: [] })
    api.post.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<AppInformationTab />)
    await screen.findByLabelText('اسم التطبيق *')
    fireEvent.click(screen.getByRole('button', { name: 'حفظ التغييرات' }))
    expect(await screen.findByText('جاري الحفظ...')).toBeInTheDocument()
  })

  it('seeds the form from the app-info settings and saves the batch', async () => {
    api.get.mockResolvedValue({
      data: [
        setting('app.name', 'عين رايدر', 'app-info'),
        setting('company.name', 'شركة عين', 'app-info'),
      ],
    })
    api.post.mockResolvedValue({ data: { count: 13 } })
    renderWithProviders(<AppInformationTab />)

    const name = (await screen.findByLabelText('اسم التطبيق *')) as HTMLInputElement
    expect(name).toHaveValue('عين رايدر')
    expect(screen.getByLabelText('اسم الشركة *')).toHaveValue('شركة عين')

    await user.type(screen.getByLabelText('عنوان الشركة *'), 'القاهرة')
    // touch the remaining inputs so every onChange handler runs; values must
    // differ from the seeded ones or React dedupes the change event
    fireEvent.change(document.getElementById('appName')!, { target: { value: 'عين' } })
    fireEvent.change(document.getElementById('companyName')!, { target: { value: 'شركة' } })
    for (const id of [
      'companyWebsite', 'companyPhone', 'privacyPolicy', 'termsConditions',
      'facebookPage', 'twitterPage', 'instagramPage', 'appleStoreLink', 'playStoreLink',
    ]) {
      fireEvent.change(document.getElementById(id)!, { target: { value: 'https://x.com' } })
    }
    fireEvent.change(document.getElementById('contactEmail')!, { target: { value: 'a@x.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'حفظ التغييرات' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/settings/batch', {
      settings: expect.arrayContaining([
        expect.objectContaining({ key: 'app.name', value: 'عين', category: 'app-info' }),
        expect.objectContaining({ key: 'company.name', value: 'شركة', category: 'app-info' }),
        expect.objectContaining({ key: 'company.address', value: 'القاهرة', category: 'app-info' }),
      ]),
    }))
    const batch = api.post.mock.calls[0][1].settings
    expect(batch).toHaveLength(13)
  })
})

describe('GeneralSettingsTab', () => {
  it('shows the loading skeleton', () => {
    api.get.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<GeneralSettingsTab />)
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('covers every input and switch handler before saving', async () => {
    api.get.mockResolvedValue({ data: [] })
    api.post.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<GeneralSettingsTab />)
    await screen.findByText('إعدادات العملة')

    // every text input gets a change event
    const textInputs = Array.from(document.querySelectorAll('form input[type="text"], form input:not([type])')) as HTMLInputElement[]
    for (const input of textInputs) {
      fireEvent.change(input, { target: { value: 'x' } })
    }
    // number + tel inputs are outside the text selector above
    for (const id of ['setDecimal', 'driverRadius', 'referralBonus']) {
      fireEvent.change(document.getElementById(id)!, { target: { value: '5' } })
    }
    fireEvent.change(document.getElementById('panicDialNumber')!, { target: { value: '123' } })
    // every switch is toggled twice
    for (const sw of screen.getAllByRole('switch')) {
      await user.click(sw)
      await user.click(sw)
    }
    fireEvent.click(screen.getByRole('button', { name: 'حفظ التغييرات' }))
    await waitFor(() => expect(api.post).toHaveBeenCalled())
    expect(await screen.findByText('جاري الحفظ...')).toBeInTheDocument()
  })
})

describe('LanguagesTab', () => {
  const languages = [
    { id: '1', name: 'العربية', locale: 'ar', dateLocal: 'ar-eg', isDefault: true },
    { id: '2', name: 'English', locale: 'en', dateLocal: 'en-gb', isDefault: false },
  ]

  function stubLanguages(list: unknown[]) {
    api.get.mockResolvedValue({ data: [setting('languages.list', JSON.stringify(list), 'languages')] })
  }

  it('shows the loading skeleton', () => {
    api.get.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<LanguagesTab />)
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders the languages table with default markers', async () => {
    stubLanguages(languages)
    renderWithProviders(<LanguagesTab />)
    expect(await screen.findByText('العربية')).toBeInTheDocument()
    expect(screen.getByText('افتراضي')).toBeInTheDocument()
    expect(screen.getByText('تعيين كافتراضي')).toBeInTheDocument()
  })

  it('adds a language as the first default', async () => {
    stubLanguages([])
    api.put.mockResolvedValue({ data: {} })
    renderWithProviders(<LanguagesTab />)
    expect(await screen.findByText('لا توجد لغات. قم بإضافة لغة جديدة.')).toBeInTheDocument()

    await user.click(screen.getByText('إضافة لغة'))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('اسم اللغة *'), 'العربية')
    await user.type(within(dialog).getByLabelText('رمز اللغة *'), 'ar')
    await user.type(within(dialog).getByLabelText('تنسيق التاريخ *'), 'ar-eg')
    await user.click(within(dialog).getByRole('button', { name: 'إضافة' }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/settings/languages.list', expect.anything()))
    const storedLangs = api.put.mock.calls[0][1].value as Array<Record<string, unknown>>
    expect(storedLangs).toHaveLength(1)
    expect(storedLangs[0]).toMatchObject({ name: 'العربية', locale: 'ar', dateLocal: 'ar-eg', isDefault: true })
  })

  it('rejects an incomplete language form with a toast', async () => {
    stubLanguages(languages)
    renderWithProviders(<LanguagesTab />)
    await screen.findByText('العربية')

    await user.click(screen.getByText('إضافة لغة'))
    const dialog = await screen.findByRole('dialog')
    // bypass html5-required via a direct submit dispatch
    await act(async () => {
      fireEvent.submit(within(dialog).getByRole('button', { name: 'إضافة' }).closest('form')!)
    })
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('يرجى ملء جميع الحقول'))
    expect(api.put).not.toHaveBeenCalled()

    // the cancel button closes the dialog
    await user.click(within(dialog).getByRole('button', { name: 'إلغاء' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('edits a language and sets another default storing the array', async () => {
    stubLanguages(languages)
    api.put.mockResolvedValue({ data: {} })
    renderWithProviders(<LanguagesTab />)
    await screen.findByText('العربية')

    // edit English
    await user.click(rowButtons('English').edit!)
    const dialog = await screen.findByRole('dialog')
    const locale = within(dialog).getByLabelText('رمز اللغة *') as HTMLInputElement
    expect(locale).toHaveValue('en')
    await user.clear(locale)
    await user.type(locale, 'en-US')
    await user.click(within(dialog).getByRole('button', { name: 'حفظ التغييرات' }))
    await waitFor(() => expect(api.put).toHaveBeenCalled())
    const editPayload = api.put.mock.calls[0][1].value as Array<{ locale: string }>
    expect(editPayload.find((l) => l.id === '2')?.locale).toBe('en-US')

    // set English as default
    await user.click(screen.getByText('تعيين كافتراضي'))
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2))
    const payload = api.put.mock.calls[1][1].value
    // the array itself is stored (not a pre-stringified string)
    expect(Array.isArray(payload)).toBe(true)
    const stored = payload as Array<{ id: string; isDefault: boolean }>
    expect(stored.find((l) => l.id === '2')?.isDefault).toBe(true)
    expect(stored.find((l) => l.id === '1')?.isDefault).toBe(false)
  })

  it('deletes a non-default language after confirmation', async () => {
    stubLanguages(languages)
    api.put.mockResolvedValue({ data: {} })
    renderWithProviders(<LanguagesTab />)
    await screen.findByText('العربية')

    await user.click(rowButtons('English').trash!)
    await waitFor(() => expect(api.put).toHaveBeenCalled())
    const payload = api.put.mock.calls[0][1].value as Array<{ id: string }>
    expect(payload).toHaveLength(1)
    expect(payload[0].id).toBe('1')
  })

  it('renders the empty state when the languages key is missing from settings', async () => {
    api.get.mockResolvedValue({ data: [setting('app.name', 'عين', 'app-info')] })
    renderWithProviders(<LanguagesTab />)
    expect(await screen.findByText('لا توجد لغات. قم بإضافة لغة جديدة.')).toBeInTheDocument()
  })

  it('keeps the language when confirm is dismissed', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))
    stubLanguages(languages)
    renderWithProviders(<LanguagesTab />)
    await screen.findByText('العربية')

    await user.click(rowButtons('English').trash!)
    expect(confirm).toHaveBeenCalledWith('هل أنت متأكد من حذف هذه اللغة؟')
    expect(api.put).not.toHaveBeenCalled()
  })
})

describe('CancellationReasonTab', () => {
  const reasons = [
    { id: '1', reason: 'السائق متأخر' },
    { id: '2', reason: 'غيروا رأيهم' },
  ]

  function stubReasons(list: unknown[]) {
    api.get.mockResolvedValue({ data: [setting('cancellation.reasons', JSON.stringify(list), 'cancellation')] })
  }

  it('shows the loading skeleton', () => {
    api.get.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<CancellationReasonTab />)
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders reasons and adds a new one', async () => {
    stubReasons(reasons)
    api.put.mockResolvedValue({ data: {} })
    renderWithProviders(<CancellationReasonTab />)
    expect(await screen.findByText('السائق متأخر')).toBeInTheDocument()

    await user.click(screen.getByText('إضافة سبب'))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('السبب *'), 'سوء التقدير')
    await user.click(within(dialog).getByRole('button', { name: 'إضافة' }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/settings/cancellation.reasons', expect.anything()))
    const storedReasons = api.put.mock.calls[0][1].value as Array<Record<string, unknown>>
    expect(storedReasons).toHaveLength(3)
    expect(storedReasons[2]).toMatchObject({ reason: 'سوء التقدير' })
  })

  it('edits and deletes reasons', async () => {
    stubReasons(reasons)
    api.put.mockResolvedValue({ data: {} })
    renderWithProviders(<CancellationReasonTab />)
    await screen.findByText('السائق متأخر')

    // edit the first reason
    await user.click(rowButtons('السائق متأخر').edit!)
    const dialog = await screen.findByRole('dialog')
    const input = within(dialog).getByLabelText('السبب *') as HTMLInputElement
    expect(input).toHaveValue('السائق متأخر')
    await user.clear(input)
    await user.type(input, 'تأخر طويل')
    await user.click(within(dialog).getByRole('button', { name: 'حفظ التغييرات' }))
    await waitFor(() => expect(api.put).toHaveBeenCalled())
    const edited = api.put.mock.calls[0][1].value as Array<{ id: string; reason: string }>
    expect(edited.find((r) => r.id === '1')?.reason).toBe('تأخر طويل')

    // delete the second reason
    await user.click(rowButtons('غيروا رأيهم').trash!)
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2))
    const remaining = api.put.mock.calls[1][1].value as Array<{ id: string }>
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe('1')
  })

  it('renders the empty state', async () => {
    stubReasons([])
    renderWithProviders(<CancellationReasonTab />)
    expect(await screen.findByText('لا توجد أسباب إلغاء. قم بإضافة سبب جديد.')).toBeInTheDocument()
  })

  it('falls back to an empty list when the reasons key is missing', async () => {
    api.get.mockResolvedValue({ data: [setting('app.name', 'عين', 'app-info')] })
    renderWithProviders(<CancellationReasonTab />)
    expect(await screen.findByText('لا توجد أسباب إلغاء. قم بإضافة سبب جديد.')).toBeInTheDocument()
  })

  it('keeps the reason when confirm is dismissed', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))
    stubReasons(reasons)
    renderWithProviders(<CancellationReasonTab />)
    await screen.findByText('السائق متأخر')

    await user.click(rowButtons('السائق متأخر').trash!)
    expect(confirm).toHaveBeenCalledWith('هل أنت متأكد من حذف هذا السبب؟')
    expect(api.put).not.toHaveBeenCalled()
  })

  it('rejects an empty reason with a toast and closes on cancel', async () => {
    stubReasons(reasons)
    renderWithProviders(<CancellationReasonTab />)
    await screen.findByText('السائق متأخر')

    await user.click(screen.getByText('إضافة سبب'))
    const dialog = await screen.findByRole('dialog')
    // bypass html5-required via a direct submit dispatch
    await act(async () => {
      fireEvent.submit(within(dialog).getByRole('button', { name: 'إضافة' }).closest('form')!)
    })
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('يرجى إدخال السبب'))
    expect(api.put).not.toHaveBeenCalled()

    // the cancel button closes the dialog without saving
    await user.click(within(dialog).getByRole('button', { name: 'إلغاء' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

describe('SettingsPage', () => {
  it('renders all four tab triggers and switches between them', async () => {
    api.get.mockImplementation((url: string) => {
      if (url !== '/admin/settings') return Promise.reject(new Error(url))
      return Promise.resolve({
        data: [
          setting('app.name', 'عين', 'app-info'),
          setting('languages.list', '[]', 'languages'),
          setting('cancellation.reasons', '[]', 'cancellation'),
        ],
      })
    })
    renderWithProviders(<SettingsPage />)
    expect(await screen.findByText('معلومات التطبيق')).toBeInTheDocument()
    expect(await screen.findByLabelText('اسم التطبيق *')).toBeInTheDocument()

    await user.click(screen.getByText('اللغات'))
    expect(await screen.findByText('لا توجد لغات. قم بإضافة لغة جديدة.')).toBeInTheDocument()

    await user.click(screen.getByText('أسباب الإلغاء'))
    expect(await screen.findByText('لا توجد أسباب إلغاء. قم بإضافة سبب جديد.')).toBeInTheDocument()

    await user.click(screen.getByText('الإعدادات العامة'))
    expect(await screen.findByText('إعدادات العملة')).toBeInTheDocument()
  })
})
