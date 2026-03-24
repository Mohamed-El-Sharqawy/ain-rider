import { useGetVehicleTypes, useGetVehicles } from './services/queries';
import { useVehicleFilters } from './hooks/useVehicleFilters';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { CreateVehicleTypeModal } from './components/CreateVehicleTypeModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Car } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { VehicleType, Vehicle } from './services/transformers';

export function VehiclesPage() {
  const { filters } = useVehicleFilters();
  const { data: vehicleTypes, isLoading: typesLoading, isError: typesError, refetch: refetchTypes } = useGetVehicleTypes();
  const { data: vehicles, isLoading: vehiclesLoading, isError: vehiclesError, refetch: refetchVehicles } = useGetVehicles(filters.driverId);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="المركبات"
        description="إدارة أنواع المركبات ومركبات السائقين"
      />

      <Tabs defaultValue="types">
        <TabsList>
          <TabsTrigger value="types">أنواع المركبات</TabsTrigger>
          <TabsTrigger value="vehicles">المركبات</TabsTrigger>
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
