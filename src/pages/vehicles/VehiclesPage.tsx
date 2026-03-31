import { useGetVehicleTypes, useGetVehicles, useGetVehicleMakes, useGetVehicleModels } from './services/queries';
import { useVehicleFilters } from './hooks/useVehicleFilters';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { CreateVehicleTypeModal } from './components/CreateVehicleTypeModal';
import { CreateVehicleMakeModal } from './components/CreateVehicleMakeModal';
import { CreateVehicleModelModal } from './components/CreateVehicleModelModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Car, Smartphone as Brand, Layers as ModelType } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { VehicleType, Vehicle } from './services/transformers';
import type { VehicleMakeDTO, VehicleModelDTO } from './services/dto';

export function VehiclesPage() {
  const { filters } = useVehicleFilters();
  const { data: vehicleTypes, isLoading: typesLoading, isError: typesError, refetch: refetchTypes } = useGetVehicleTypes();
  const { data: vehicles, isLoading: vehiclesLoading, isError: vehiclesError, refetch: refetchVehicles } = useGetVehicles(filters.driverId);
  const { data: makes, isLoading: makesLoading, isError: makesError, refetch: refetchMakes } = useGetVehicleMakes();
  const { data: models, isLoading: modelsLoading, isError: modelsError, refetch: refetchModels } = useGetVehicleModels();

  const typeColumns: Column<VehicleType>[] = [
    { key: 'name', label: 'الاسم' },
    { key: 'type', label: 'النوع' },
    { key: 'baseFare', label: 'الأجرة الأساسية', render: (v) => formatCurrency(Number(v)) },
    { key: 'perKmRate', label: 'السعر/كم', render: (v) => formatCurrency(Number(v)) },
    { key: 'perMinuteRate', label: 'السعر/دقيقة', render: (v) => formatCurrency(Number(v)) },
    { key: 'minFare', label: 'الحد الأدنى', render: (v) => formatCurrency(Number(v)) },
    { key: 'maxPassengers', label: 'الركاب' },
    { key: 'isActive', label: 'الحالة', render: (v) => <StatusBadge status={v ? 'ACTIVE' : 'INACTIVE'} /> },
  ];

  const vehicleColumns: Column<Vehicle>[] = [
    { key: 'licensePlate', label: 'رقم اللوحة' },
    { key: 'vehicleTypeName', label: 'النوع' },
    { key: 'model', label: 'الموديل' },
    { key: 'color', label: 'اللون' },
    { key: 'year', label: 'السنة' },
    { key: 'status', label: 'الحالة', render: (v) => <StatusBadge status={String(v)} /> },
  ];

  const makeColumns: Column<VehicleMakeDTO>[] = [
    { key: 'name', label: 'الماركة' },
    { key: '_count' as any, label: 'عدد الموديلات', render: (_, item) => item._count?.models || 0 },
    { key: 'isActive', label: 'الحالة', render: (v) => <StatusBadge status={v ? 'ACTIVE' : 'INACTIVE'} /> },
  ];

  const modelColumns: Column<VehicleModelDTO>[] = [
    { key: 'make' as any, label: 'الماركة', render: (_, item) => item.make?.name },
    { key: 'name', label: 'الموديل' },
    { key: 'vehicleType' as any, label: 'النوع التلقائي', render: (_, item) => item.vehicleType?.name || '---' },
    { key: 'isActive', label: 'الحالة', render: (v) => <StatusBadge status={v ? 'ACTIVE' : 'INACTIVE'} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="المركبات"
        description="إدارة أنواع المركبات ومركبات السائقين"
      />

      <Tabs defaultValue="types">
        <TabsList>
          <TabsTrigger value="types">خدمات النقل</TabsTrigger>
          <TabsTrigger value="makes">الماركات</TabsTrigger>
          <TabsTrigger value="models">الموديلات</TabsTrigger>
          <TabsTrigger value="vehicles">مركبات الأسطول</TabsTrigger>
        </TabsList>

        <TabsContent value="types" className="space-y-4">
          <div className="flex justify-end">
            <CreateVehicleTypeModal />
          </div>

          {typesError ? (
            <ErrorState message="فشل تحميل أنواع المركبات" onRetry={refetchTypes} />
          ) : typesLoading ? (
            <TableSkeleton rows={5} columns={6} />
          ) : !vehicleTypes || vehicleTypes.length === 0 ? (
            <EmptyState
              icon={Car}
              title="لا توجد أنواع مركبات"
              description="ابدأ بإضافة أنواع المركبات المتاحة في النظام"
            />
          ) : (
            <DataTable data={vehicleTypes} columns={typeColumns} />
          )}
        </TabsContent>

        <TabsContent value="makes" className="space-y-4">
          <div className="flex justify-end">
            <CreateVehicleMakeModal />
          </div>

          {makesError ? (
            <ErrorState message="فشل تحميل الماركات" onRetry={refetchMakes} />
          ) : makesLoading ? (
            <TableSkeleton rows={5} columns={3} />
          ) : !makes || makes.length === 0 ? (
            <EmptyState
              icon={Brand}
              title="لا توجد ماركات"
              description="لم يتم تعريف ماركات سيارات في النظام بعد"
            />
          ) : (
            <DataTable data={makes} columns={makeColumns} />
          )}
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <div className="flex justify-end">
            <CreateVehicleModelModal />
          </div>

          {modelsError ? (
            <ErrorState message="فشل تحميل الموديلات" onRetry={refetchModels} />
          ) : modelsLoading ? (
            <TableSkeleton rows={8} columns={4} />
          ) : !models || models.length === 0 ? (
            <EmptyState
              icon={ModelType}
              title="لا توجد موديلات"
              description="لم يتم تعريف موديلات في النظام بعد"
            />
          ) : (
            <DataTable data={models} columns={modelColumns} />
          )}
        </TabsContent>

        <TabsContent value="vehicles" className="space-y-4">
          {vehiclesError ? (
            <ErrorState message="فشل تحميل المركبات" onRetry={refetchVehicles} />
          ) : vehiclesLoading ? (
            <TableSkeleton rows={10} columns={6} />
          ) : !vehicles || vehicles.length === 0 ? (
            <EmptyState
              icon={Car}
              title="لا توجد مركبات"
              description="لم يتم تسجيل أي مركبات في النظام بعد"
            />
          ) : (
            <DataTable data={vehicles} columns={vehicleColumns} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
