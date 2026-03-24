import { useState } from 'react';
import { useGetPromos } from './services/queries';
import { usePromoFilters } from './hooks/usePromoFilters';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { CreatePromoModal } from './components/CreatePromoModal';
import { EditPromoModal } from './components/EditPromoModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TicketPercent } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Promo } from './services/transformers';

export function PromosPage() {
  const { filters, status, setStatus, clearFilters } = usePromoFilters();
  const { data: promos, isLoading, isError, refetch } = useGetPromos(filters.status);
  const [selectedPromo, setSelectedPromo] = useState<Promo | null>(null);

  const columns: Column<Promo>[] = [
    { key: 'code', label: 'الكود', render: (v) => <span className="font-mono font-semibold">{String(v)}</span> },
    {
      key: 'type',
      label: 'نوع الخصم',
      render: (v) => (v === 'PERCENTAGE' ? 'نسبة مئوية' : 'مبلغ ثابت'),
    },
    {
      key: 'value',
      label: 'القيمة',
      render: (v, row) =>
        (row as Promo).type === 'PERCENTAGE'
          ? `${v}%`
          : formatCurrency(Number(v)),
    },
    { key: 'currentUsageCount', label: 'مرات الاستخدام' },
    { key: 'totalUsageLimit', label: 'الحد الأقصى' },
    { key: 'status', label: 'الحالة', render: (v) => <StatusBadge status={String(v)} /> },
    { key: 'validUntil', label: 'صالح حتى', render: (v) => (v ? formatDate(String(v)) : '—') },
  ];

  if (isError) {
    return <ErrorState message="فشل تحميل العروض الترويجية" onRetry={refetch} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="العروض الترويجية"
        description="إدارة أكواد الخصم والعروض الترويجية"
        actions={<CreatePromoModal />}
      />

      <div className="flex items-center gap-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="جميع الحالات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            <SelectItem value="ACTIVE">نشط</SelectItem>
            <SelectItem value="INACTIVE">غير نشط</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <TableSkeleton rows={10} columns={7} />
      ) : !promos || promos.length === 0 ? (
        <EmptyState
          icon={TicketPercent}
          title="لا توجد عروض ترويجية"
          description="لم يتم العثور على عروض ترويجية تطابق الفلاتر المحددة"
          action={status !== 'all' ? { label: 'مسح الفلاتر', onClick: clearFilters } : undefined}
        />
      ) : (
        <DataTable
          data={promos}
          columns={columns}
          onRowClick={(row) => setSelectedPromo(row)}
        />
      )}

      <EditPromoModal
        promo={selectedPromo}
        open={!!selectedPromo}
        onClose={() => setSelectedPromo(null)}
      />
    </div>
  );
}
