import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { VehiclesPage } from '../VehiclesPage'
import { CreateVehicleTypeModal } from '../components/CreateVehicleTypeModal'
import { CreateVehicleMakeModal } from '../components/CreateVehicleMakeModal'
import { CreateVehicleModelModal } from '../components/CreateVehicleModelModal'

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

const typeDto = {
  id: 'vt-1', name: 'ميكروباص', type: 'MICRO', baseFare: 20, perKmRate: 3,
  perMinuteRate: 1, minFare: 15, maxPassengers: 14, isActive: true,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
}
const vehicleDto = {
  id: 'v-1', driverId: 'd-1', vehicleTypeId: 'vt-1',
  vehicleType: { name: 'ميكروباص' },
  make: 'تويوتا', model: 'هايس', year: 2022, color: 'أبيض',
  licensePlate: 'ق ط ر 1234', registrationNumber: 'REG-1', insuranceNumber: 'INS-1',
  insuranceExpiry: '2027-01-01', status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
}
const makeDto = { id: 'm-1', name: 'تويوتا', isActive: true, _count: { models: 4 } }
const modelDto = {
  id: 'md-1', name: 'هايس', isActive: true,
  make: { id: 'm-1', name: 'تويوتا' }, vehicleType: { id: 'vt-1', name: 'ميكروباص' },
}

const user = userEvent.setup()

beforeEach(() => {
  localStorage.clear()
  api.get.mockReset()
  api.post.mockReset()
  api.patch.mockReset()
})

function stubAll(overrides: Record<string, unknown> = {}) {
  api.get.mockImplementation((url: string) => {
    if (url === '/admin/vehicle-types') return Promise.resolve({ data: overrides.types ?? [typeDto] })
    if (url === '/admin/vehicles') return Promise.resolve({ data: overrides.vehicles ?? [vehicleDto] })
    if (url === '/admin/vehicle-makes') return Promise.resolve({ data: overrides.makes ?? [makeDto] })
    if (url === '/admin/vehicle-models') return Promise.resolve({ data: overrides.models ?? [modelDto] })
    return Promise.reject(new Error(url))
  })
}

describe('VehiclesPage', () => {
  it('renders the four tabs with the loaded data', async () => {
    stubAll()
    renderWithProviders(<VehiclesPage />)
    expect(await screen.findByText('ميكروباص')).toBeInTheDocument()

    // makes tab
    await user.click(screen.getByText('الماركات'))
    expect(await screen.findByText('تويوتا')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()

    // models tab
    await user.click(screen.getByText('الموديلات'))
    expect(await screen.findByText('هايس')).toBeInTheDocument()

    // fleet tab
    await user.click(screen.getByText('مركبات الأسطول'))
    expect(await screen.findByText('ق ط ر 1234')).toBeInTheDocument()
  })

  it('renders error states for the types tab', async () => {
    api.get.mockRejectedValue(new Error('down'))
    renderWithProviders(<VehiclesPage />)
    expect(await screen.findByText('فشل تحميل أنواع المركبات')).toBeInTheDocument()
  })

  it('renders empty states', async () => {
    stubAll({ types: [], vehicles: [], makes: [], models: [] })
    renderWithProviders(<VehiclesPage />)
    expect(await screen.findByText('لا توجد أنواع مركبات')).toBeInTheDocument()
    await user.click(screen.getByText('الماركات'))
    expect(await screen.findByText('لا توجد ماركات')).toBeInTheDocument()
  })

  it('renders sparse rows with the fallbacks in every tab', async () => {
    stubAll({
      types: [{ ...typeDto, id: 'vt-2', name: 'فاخر', isActive: false }],
      makes: [{ id: 'm-2', name: 'كيا', isActive: false }],
      models: [{ id: 'md-2', name: 'سبورتاج', isActive: false }],
      vehicles: [],
    })
    renderWithProviders(<VehiclesPage />)
    await screen.findByText('فاخر')
    expect(screen.getAllByText('غير نشط').length).toBeGreaterThan(0)

    // make without a model count falls back to 0
    await user.click(screen.getByText('الماركات'))
    expect(await screen.findByText('كيا')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()

    // model without a make or auto vehicle type
    await user.click(screen.getByText('الموديلات'))
    expect(await screen.findByText('سبورتاج')).toBeInTheDocument()
    expect(screen.getByText('---')).toBeInTheDocument()
  })
})

describe('CreateVehicleTypeModal', () => {
  it('creates a vehicle type through the form', async () => {
    api.post.mockResolvedValue({ data: typeDto })
    renderWithProviders(<CreateVehicleTypeModal />)
    await user.click(await screen.findByText('إضافة نوع مركبة'))
    await screen.findByText('إضافة نوع مركبة جديد')

    // html5-required blocks empty submits
    await user.click(screen.getByRole('button', { name: 'إضافة' }))
    expect(api.post).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('الاسم'), 'سيدان اقتصادي')
    fireEvent.click(screen.getByText('اختر النوع'))
    fireEvent.click(await screen.findByText('اقتصادي', { selector: '[role="option"] *' }))
    await user.type(screen.getByLabelText('الأجرة الأساسية (EGP)'), '20')
    await user.type(screen.getByLabelText('السعر لكل كم (EGP)'), '3')
    await user.type(screen.getByLabelText('السعر لكل دقيقة (EGP)'), '1')
    await user.type(screen.getByLabelText('الحد الأدنى للأجرة (EGP)'), '15')
    await user.type(screen.getByLabelText('أقصى عدد ركاب'), '14')
    // submit the form directly: the hidden native select trips html5 validation
    const form = document.querySelector('form')!
    fireEvent.submit(form)

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/vehicle-types', {
      name: 'سيدان اقتصادي',
      type: 'ECONOMY',
      baseFare: 20,
      perKmRate: 3,
      perMinuteRate: 1,
      minFare: 15,
      maxPassengers: 14,
      isActive: true,
    }))
  })

  it('shows the pending spinner while the type is saving', async () => {
    api.post.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<CreateVehicleTypeModal />)
    await user.click(await screen.findByText('إضافة نوع مركبة'))
    await screen.findByText('إضافة نوع مركبة جديد')

    await user.type(screen.getByLabelText('الاسم'), 'سيدان')
    fireEvent.click(screen.getByText('اختر النوع'))
    fireEvent.click(await screen.findByText('اقتصادي', { selector: '[role="option"] *' }))
    await user.type(screen.getByLabelText('الأجرة الأساسية (EGP)'), '20')
    await user.type(screen.getByLabelText('السعر لكل كم (EGP)'), '3')
    await user.type(screen.getByLabelText('السعر لكل دقيقة (EGP)'), '1')
    await user.type(screen.getByLabelText('الحد الأدنى للأجرة (EGP)'), '15')
    await user.type(screen.getByLabelText('أقصى عدد ركاب'), '4')
    fireEvent.submit(document.querySelector('form')!)

    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'إضافة' })).toBeDisabled()
  })
})

describe('CreateVehicleMakeModal', () => {
  it('creates a make through the form', async () => {
    api.post.mockResolvedValue({ data: makeDto })
    renderWithProviders(<CreateVehicleMakeModal />)
    await user.click(await screen.findByText('إضافة ماركة'))
    await screen.findByText('إضافة ماركة جديدة')
    await user.type(screen.getByLabelText('اسم الماركة'), 'هيونداي')
    await user.click(screen.getByRole('button', { name: 'إضافة' }))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/vehicle-makes', { name: 'هيونداي', isActive: true }),
    )
  })

  it('shows the pending spinner while the make is saving', async () => {
    api.post.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<CreateVehicleMakeModal />)
    await user.click(await screen.findByText('إضافة ماركة'))
    await screen.findByText('إضافة ماركة جديدة')
    await user.type(screen.getByLabelText('اسم الماركة'), 'كيا')
    await user.click(screen.getByRole('button', { name: 'إضافة' }))

    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'إضافة' })).toBeDisabled()
  })
})

describe('CreateVehicleModelModal', () => {
  it('creates a model bound to a make', async () => {
    api.get.mockImplementation((url: string) => {
      if (url === '/admin/vehicle-makes') return Promise.resolve({ data: [makeDto] })
      if (url === '/admin/vehicle-types') return Promise.resolve({ data: [typeDto] })
      return Promise.reject(new Error(url))
    })
    api.post.mockResolvedValue({ data: modelDto })
    renderWithProviders(<CreateVehicleModelModal />)
    await user.click(await screen.findByText('إضافة موديل'))
    await screen.findByText('إضافة موديل جديد')

    // save stays disabled without a make
    expect(screen.getByRole('button', { name: 'إضافة' })).toBeDisabled()

    fireEvent.click(screen.getByText('اختر الماركة'))
    fireEvent.click(await screen.findByText('تويوتا', { selector: '[role="option"] *' }))
    await user.type(screen.getByLabelText('اسم الموديل'), 'أفالون')
    // the vehicle-type select defaults to "none"
    expect(screen.getAllByText('بدون تخصص').length).toBeGreaterThan(0)
    fireEvent.submit(document.querySelector('form')!)

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/vehicle-models', {
      name: 'أفالون',
      makeId: 'm-1',
      vehicleTypeId: null,
      isActive: true,
    }))
  })

  it('saves a model with a vehicle type and shows the pending spinner', async () => {
    api.get.mockImplementation((url: string) => {
      if (url === '/admin/vehicle-makes') return Promise.resolve({ data: [makeDto] })
      if (url === '/admin/vehicle-types') return Promise.resolve({ data: [typeDto] })
      return Promise.reject(new Error(url))
    })
    api.post.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<CreateVehicleModelModal />)
    await user.click(await screen.findByText('إضافة موديل'))
    await screen.findByText('إضافة موديل جديد')

    fireEvent.click(screen.getByText('اختر الماركة'))
    fireEvent.click(await screen.findByText('تويوتا', { selector: '[role="option"] *' }))
    await user.type(screen.getByLabelText('اسم الموديل'), 'بريوس')
    // pick a vehicle type instead of the none default
    fireEvent.click(document.getElementById('model-type')!)
    fireEvent.click(await screen.findByText('ميكروباص', { selector: '[role="option"] *' }))
    fireEvent.submit(document.querySelector('form')!)

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/vehicle-models', {
        name: 'بريوس',
        makeId: 'm-1',
        vehicleTypeId: 'vt-1',
        isActive: true,
      }),
    )
    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'إضافة' })).toBeDisabled()
  })
})
