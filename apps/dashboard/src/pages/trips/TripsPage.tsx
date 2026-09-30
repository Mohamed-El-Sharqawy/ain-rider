// ─── Trips Page ──────────────────────────────────────────────────────────────
// Displays paginated list of all trips with filters, search, and detail modal.
// Real-time updates via WebSocket for live trip status changes.

import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useGetAllTrips, useGetTripStats } from './services/queries'
import { useTripFilters } from './hooks/useTripFilters'
import { useWebSocket } from '@/providers/WebSocketProvider'
import { tripKeys } from './services/queries'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { TableSkeleton } from '@/components/shared/TableSkeleton'
import { ErrorState } from '@/components/shared/ErrorState'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { TripDetailModal } from './components/TripDetailModal'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Car, Search, Banknote } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Wifi } from 'lucide-react'
import type { Trip } from './services/transformers'

export function TripsPage() {
  const queryClient = useQueryClient()
  const { filters, page, setPage, status, setStatus, search, setSearch, clearFilters } = useTripFilters()
  const { data: trips, isLoading, isError, refetch } = useGetAllTrips(filters)
  const { data: stats } = useGetTripStats()
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)
  const { on, isConnected } = useWebSocket()

  useEffect(() => {
    if (!isConnected) return

    const unsubTripMatched = on('trip_matched', () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.all })
      queryClient.invalidateQueries({ queryKey: tripKeys.stats() })
    })

    const unsubTripStarted = on('trip_started', () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.all })
    })

    const unsubTripCompleted = on('trip_completed', () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.all })
      queryClient.invalidateQueries({ queryKey: tripKeys.stats() })
    })

    return () => {
      unsubTripMatched()
      unsubTripStarted()
      unsubTripCompleted()
    }
  }, [isConnected, on, queryClient])

  const columns: Column<Trip>[] = [
    {
      key: 'id',
      label: 'المعرف',
      render: (v) => <span className="font-mono text-xs">{String(v).slice(0, 8)}</span>,
      className: 'w-24',
    },
    {
      key: 'riderId',
      label: 'الراكب',
      render: (v) => <span className="font-mono text-xs">{String(v).slice(0, 8)}</span>,
    },
    {
      key: 'driverId',
      label: 'السائق',
      render: (v) => (v ? <span className="font-mono text-xs">{String(v).slice(0, 8)}</span> : '—'),
    },
    { key: 'status', label: 'الحالة', render: (v) => <StatusBadge status={String(v)} /> },
    { key: 'pickupAddress', label: 'من', className: 'max-w-xs truncate' },
    { key: 'dropoffAddress', label: 'إلى', className: 'max-w-xs truncate' },
    {
      key: 'paymentMethodLabel',
      label: 'الدفع',
      render: (v) => (
        <div className="flex items-center gap-1">
          <Banknote size={14} style={{ color: 'var(--color-success)' }} />
          <span>{String(v)}</span>
        </div>
      ),
    },
    {
      key: 'paymentStatus',
      label: 'حالة الدفع',
      render: (v) => <StatusBadge status={String(v)} />,
    },
    {
      key: 'estimatedFare',
      label: 'التكلفة المقدرة',
      render: (v) => formatCurrency(Number(v)),
    },
    {
      key: 'actualFare',
      label: 'التكلفة الفعلية',
      render: (v) => (v ? formatCurrency(Number(v)) : '—'),
    },
    { key: 'requestedAt', label: 'التاريخ', render: (v) => formatDate(String(v)) },
  ]

  if (isError) {
    return <ErrorState message="فشل تحميل الرحلات" onRetry={refetch} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="الرحلات"
        description="إدارة جميع رحلات المنصة"
        actions={
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
            <Wifi size={14} style={{ color: isConnected ? 'var(--color-success)' : 'var(--color-muted-foreground)' }} />
            {isConnected ? 'متصل - تحديثات مباشرة' : 'غير متصل'}
          </div>
        }
      />

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <StatCard
            label="إجمالي الرحلات"
            value={stats.total.toLocaleString('ar-EG')}
            icon={Car}
          />
          <StatCard
            label="رحلات مكتملة"
            value={stats.completed.toLocaleString('ar-EG')}
            change={{ value: 12, label: 'مكتملة الآن' }}
            icon={Car}
          />
          <StatCard
            label="رحلات جارية"
            value={stats.inProgress.toLocaleString('ar-EG')}
            change={{ value: 12, label: 'جارية الآن' }}
            icon={Car}
          />
          <StatCard
            label="إيرادات محصلة"
            value={formatCurrency(stats.revenue)}
            change={{ value: 12, label: 'محصلة الآن' }}
            icon={Banknote}
          />
          <StatCard
            label="مدفوعات معلقة"
            value={stats.pendingPayments?.toLocaleString('ar-EG') ?? '0'}
            change={{ value: 12, label: 'معلقة الآن' }}
            icon={Banknote}
          />
          <StatCard
            label="مدفوعات محصلة"
            value={stats.collectedPayments?.toLocaleString('ar-EG') ?? '0'}
            change={{ value: 12, label: 'محصلة الآن' }}
            icon={Banknote}
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-muted-foreground)' }}
          />
          <Input
            placeholder="بحث برقم الرحلة، الراكب، أو السائق..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10"
          />
        </div>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="جميع الحالات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            <SelectItem value="REQUESTED">مطلوبة</SelectItem>
            <SelectItem value="MATCHED">تم التوصيل</SelectItem>
            <SelectItem value="IN_PROGRESS">جارية</SelectItem>
            <SelectItem value="COMPLETED">مكتملة</SelectItem>
            <SelectItem value="CANCELLED">ملغاة</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <TableSkeleton rows={10} columns={9} />
      ) : !trips || trips.data.length === 0 ? (
        <EmptyState
          icon={Car}
          title="لا توجد رحلات"
          description="لم يتم العثور على رحلات تطابق الفلاتر المحددة"
          action={status !== 'all' || search ? { label: 'مسح الفلاتر', onClick: clearFilters } : undefined}
        />
      ) : (
        <DataTable
          data={trips.data}
          columns={columns}
          onRowClick={(row) => setSelectedTrip(row)}
          pagination={{
            page,
            totalPages: trips.totalPages,
            onPageChange: setPage,
          }}
        />
      )}

      <TripDetailModal
        trip={selectedTrip}
        open={!!selectedTrip}
        onClose={() => setSelectedTrip(null)}
      />
    </div>
  )
}
