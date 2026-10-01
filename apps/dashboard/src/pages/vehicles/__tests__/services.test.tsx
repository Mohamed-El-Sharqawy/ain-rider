import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
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

import { vehiclesApi } from '../services/api'
import {
  useGetVehicles,
  useGetVehicleTypes,
  useGetVehicleMakes,
  useGetVehicleModels,
  vehicleKeys,
} from '../services/queries'
import {
  useCreateVehicleType,
  useUpdateVehicleType,
  useCreateVehicle,
  useUpdateVehicle,
  useCreateVehicleMake,
  useUpdateVehicleMake,
  useCreateVehicleModel,
  useUpdateVehicleModel,
} from '../services/mutations'
import { transformVehicle, transformVehicleType } from '../services/transformers'
import { useVehicleFilters } from '../hooks/useVehicleFilters'

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
const modelDto = { id: 'md-1', name: 'هايس', isActive: true, make: { id: 'm-1', name: 'تويوتا' }, vehicleType: { id: 'vt-1', name: 'ميكروباص' } }

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

beforeEach(() => {
  vi.clearAllMocks()
})

describe('vehiclesApi', () => {
  it('calls the right endpoints', () => {
    vehiclesApi.getAllTypes()
    expect(api.get).toHaveBeenCalledWith('/admin/vehicle-types')
    vehiclesApi.createType({ name: 'ن', type: 'T' } as never)
    expect(api.post).toHaveBeenCalledWith('/admin/vehicle-types', { name: 'ن', type: 'T' })
    vehiclesApi.updateType('vt-1', { name: 'ن2' })
    expect(api.patch).toHaveBeenCalledWith('/admin/vehicle-types/vt-1', { name: 'ن2' })

    vehiclesApi.getAllMakes(true)
    expect(api.get).toHaveBeenCalledWith('/admin/vehicle-makes', { params: { activeOnly: true } })
    vehiclesApi.createMake({ name: 'م' } as never)
    expect(api.post).toHaveBeenCalledWith('/admin/vehicle-makes', { name: 'م' })
    vehiclesApi.updateMake('m-1', { name: 'م2' })
    expect(api.patch).toHaveBeenCalledWith('/admin/vehicle-makes/m-1', { name: 'م2' })

    vehiclesApi.getAllModels('m-1')
    expect(api.get).toHaveBeenCalledWith('/admin/vehicle-models', { params: { makeId: 'm-1' } })
    vehiclesApi.createModel({ name: 'مو' } as never)
    expect(api.post).toHaveBeenCalledWith('/admin/vehicle-models', { name: 'مو' })
    vehiclesApi.updateModel('md-1', { name: 'مو2' })
    expect(api.patch).toHaveBeenCalledWith('/admin/vehicle-models/md-1', { name: 'مو2' })

    vehiclesApi.getAllVehicles('d-1')
    expect(api.get).toHaveBeenCalledWith('/admin/vehicles', { params: { driverId: 'd-1' } })
    vehiclesApi.createVehicle({ licensePlate: 'X' } as never)
    expect(api.post).toHaveBeenCalledWith('/admin/vehicles', { licensePlate: 'X' })
    vehiclesApi.updateVehicle('v-1', { color: 'أحمر' })
    expect(api.patch).toHaveBeenCalledWith('/admin/vehicles/v-1', { color: 'أحمر' })
  })
})

describe('transformers', () => {
  it('names the vehicle type or falls back', () => {
    expect(transformVehicle(vehicleDto).vehicleTypeName).toBe('ميكروباص')
    const noType: Partial<typeof vehicleDto> = { ...vehicleDto }
    delete noType.vehicleType
    expect(transformVehicle(noType as typeof vehicleDto).vehicleTypeName).toBe('غير محدد')
    expect(transformVehicleType(typeDto).maxPassengers).toBe(14)
  })
})

describe('queries', () => {
  it('fetches all four collections', async () => {
    api.get.mockImplementation((url: string) => {
      if (url === '/admin/vehicle-types') return Promise.resolve({ data: [typeDto] })
      if (url === '/admin/vehicles') return Promise.resolve({ data: [vehicleDto] })
      if (url === '/admin/vehicle-makes') return Promise.resolve({ data: [makeDto] })
      if (url === '/admin/vehicle-models') return Promise.resolve({ data: [modelDto] })
      return Promise.reject(new Error(url))
    })
    const { wrapper } = makeWrapper()
    const { result: types } = renderHook(() => useGetVehicleTypes(), { wrapper })
    const { result: vehicles } = renderHook(() => useGetVehicles(), { wrapper })
    const { result: makes } = renderHook(() => useGetVehicleMakes(), { wrapper })
    const { result: models } = renderHook(() => useGetVehicleModels(), { wrapper })
    await waitFor(() => expect(types.current.isSuccess).toBe(true))
    await waitFor(() => expect(vehicles.current.isSuccess).toBe(true))
    await waitFor(() => expect(makes.current.isSuccess).toBe(true))
    await waitFor(() => expect(models.current.isSuccess).toBe(true))
    expect(vehicles.current.data?.[0].vehicleTypeName).toBe('ميكروباص')
    expect(vehicleKeys.makes(true)).toEqual(['vehicles', 'makes', { activeOnly: true }])
  })
})

describe('mutations', () => {
  it('creates and updates types with toasts', async () => {
    api.post.mockResolvedValueOnce({ data: typeDto })
    api.patch.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 400, data: { error: { message: 'مكرر' } } },
    })
    const { wrapper } = makeWrapper()
    const { result: create } = renderHook(() => useCreateVehicleType(), { wrapper })
    const { result: update } = renderHook(() => useUpdateVehicleType(), { wrapper })
    act(() => create.current.mutate({ name: 'ن', type: 'T' } as never))
    await waitFor(() => expect(create.current.isSuccess).toBe(true))
    expect(toast.success).toHaveBeenCalledWith('تم إنشاء نوع المركبة بنجاح')
    act(() => update.current.mutate({ id: 'vt-1', data: { name: 'ن2' } }))
    await waitFor(() => expect(update.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('مكرر')
  })

  it('toasts errors when creating a type and succeeds when updating one', async () => {
    api.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 422, data: { error: { message: 'نوع غير صالح' } } },
    })
    api.patch.mockResolvedValueOnce({ data: typeDto })
    const { wrapper } = makeWrapper()
    const { result: create } = renderHook(() => useCreateVehicleType(), { wrapper })
    const { result: update } = renderHook(() => useUpdateVehicleType(), { wrapper })

    act(() => create.current.mutate({ name: 'ن', type: 'T' } as never))
    await waitFor(() => expect(create.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('نوع غير صالح')

    act(() => update.current.mutate({ id: 'vt-1', data: { name: 'ن3' } }))
    await waitFor(() => expect(update.current.isSuccess).toBe(true))
    expect(toast.success).toHaveBeenCalledWith('تم تحديث نوع المركبة بنجاح')
  })

  it('toasts errors when creating or updating a vehicle', async () => {
    api.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 409, data: { error: { message: 'اللوحة مسجلة' } } },
    })
    api.patch.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 404, data: { error: { message: 'المركبة غير موجودة' } } },
    })
    const { wrapper } = makeWrapper()
    const { result: create } = renderHook(() => useCreateVehicle(), { wrapper })
    const { result: update } = renderHook(() => useUpdateVehicle(), { wrapper })

    act(() => create.current.mutate({ licensePlate: 'X' } as never))
    await waitFor(() => expect(create.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('اللوحة مسجلة')

    act(() => update.current.mutate({ id: 'v-9', data: { color: 'أحمر' } }))
    await waitFor(() => expect(update.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('المركبة غير موجودة')
  })

  it('creates and updates vehicles', async () => {
    api.post.mockResolvedValue({ data: vehicleDto })
    api.patch.mockResolvedValue({ data: vehicleDto })
    const { wrapper } = makeWrapper()
    const { result: create } = renderHook(() => useCreateVehicle(), { wrapper })
    const { result: update } = renderHook(() => useUpdateVehicle(), { wrapper })
    act(() => create.current.mutate({ licensePlate: 'X' } as never))
    await waitFor(() => expect(create.current.isSuccess).toBe(true))
    expect(toast.success).toHaveBeenCalledWith('تمت إضافة المركبة بنجاح')
    act(() => update.current.mutate({ id: 'v-1', data: { color: 'أحمر' } }))
    await waitFor(() => expect(update.current.isSuccess).toBe(true))
    expect(toast.success).toHaveBeenCalledWith('تم تحديث المركبة بنجاح')
  })

  it('creates and updates makes and models', async () => {
    api.post.mockResolvedValue({ data: makeDto })
    api.patch.mockResolvedValue({ data: makeDto })
    const { wrapper } = makeWrapper()
    const { result: createMake } = renderHook(() => useCreateVehicleMake(), { wrapper })
    const { result: updateMake } = renderHook(() => useUpdateVehicleMake(), { wrapper })
    const { result: createModel } = renderHook(() => useCreateVehicleModel(), { wrapper })
    const { result: updateModel } = renderHook(() => useUpdateVehicleModel(), { wrapper })

    act(() => createMake.current.mutate({ name: 'م' } as never))
    await waitFor(() => expect(createMake.current.isSuccess).toBe(true))
    expect(toast.success).toHaveBeenCalledWith('تم إنشاء الماركة بنجاح')
    act(() => updateMake.current.mutate({ id: 'm-1', data: { name: 'م2' } }))
    await waitFor(() => expect(updateMake.current.isSuccess).toBe(true))
    expect(toast.success).toHaveBeenCalledWith('تم تحديث الماركة بنجاح')
    act(() => createModel.current.mutate({ name: 'مو' } as never))
    await waitFor(() => expect(createModel.current.isSuccess).toBe(true))
    expect(toast.success).toHaveBeenCalledWith('تم إنشاء الموديل بنجاح')
    act(() => updateModel.current.mutate({ id: 'md-1', data: { name: 'مو2' } }))
    await waitFor(() => expect(updateModel.current.isSuccess).toBe(true))
    expect(toast.success).toHaveBeenCalledWith('تم تحديث الموديل بنجاح')
  })

  it('toasts the api error when make or model mutations fail', async () => {
    api.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { error: { message: 'موجود بالفعل' } } },
    })
    api.patch.mockRejectedValue({
      isAxiosError: true,
      response: { status: 404, data: { error: { message: 'غير موجود' } } },
    })
    const { wrapper } = makeWrapper()
    const { result: createMake } = renderHook(() => useCreateVehicleMake(), { wrapper })
    const { result: updateMake } = renderHook(() => useUpdateVehicleMake(), { wrapper })
    const { result: createModel } = renderHook(() => useCreateVehicleModel(), { wrapper })
    const { result: updateModel } = renderHook(() => useUpdateVehicleModel(), { wrapper })

    act(() => createMake.current.mutate({ name: 'م' } as never))
    await waitFor(() => expect(createMake.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('موجود بالفعل')

    act(() => updateMake.current.mutate({ id: 'm-9', data: { name: 'م' } }))
    await waitFor(() => expect(updateMake.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('غير موجود')

    act(() => createModel.current.mutate({ name: 'مو', makeId: 'm-1' } as never))
    await waitFor(() => expect(createModel.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('موجود بالفعل')

    act(() => updateModel.current.mutate({ id: 'md-9', data: { name: 'مو' } }))
    await waitFor(() => expect(updateModel.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('غير موجود')
  })
})

describe('useVehicleFilters', () => {
  it('maps empty driver to undefined and clears', async () => {
    const { result } = renderHook(() => useVehicleFilters(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <NuqsTestingAdapter>{children}</NuqsTestingAdapter>
      ),
    })
    expect(result.current.filters.driverId).toBeUndefined()
    await act(async () => {
      await result.current.setDriverId('d-1')
    })
    await waitFor(() => expect(result.current.filters.driverId).toBe('d-1'))
    await act(async () => {
      await result.current.clearFilters()
    })
    await waitFor(() => expect(result.current.filters.driverId).toBeUndefined())
  })
})
