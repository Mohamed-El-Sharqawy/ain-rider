import { useState } from 'react';
import { useGetWithdrawals } from './services/queries';
import { useWalletFilters } from './hooks/useWalletFilters';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { ProcessWithdrawalModal } from './components/ProcessWithdrawalModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wallet, Banknote, Clock, CheckCircle } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Withdrawal } from './services/transformers';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';

export function WalletsPage() {
  const { filters, status, setStatus, clearFilters } = useWalletFilters();
  const { data: withdrawals, isLoading, isError, refetch } = useGetWithdrawals(filters.status);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);

  const pendingCount = withdrawals?.filter(w => w.status === 'PENDING').length ?? 0;
  const completedCount = withdrawals?.filter(w => w.status === 'COMPLETED').length ?? 0;
  const totalPending = withdrawals
    ?.filter(w => w.status === 'PENDING')
    .reduce((sum, w) => sum + w.amount, 0) ?? 0;

  const columns: Column<Withdrawal>[] = [
    {
      key: 'id',
      label: 'المعرف',
      render: (v) => <span className="font-mono text-xs">{String(v).slice(0, 8)}</span>,
      className: 'w-24',
    },
    {
      key: 'userId',
      label: 'السائق',
      render: (v) => <span className="font-mono text-xs">{String(v).slice(0, 8)}</span>,
    },
    { key: 'amount', label: 'المبلغ', render: (v) => formatCurrency(Number(v)) },
    { key: 'status', label: 'الحالة', render: (v) => <StatusBadge status={String(v)} /> },
    { key: 'createdAt', label: 'تاريخ الطلب', render: (v) => formatDate(String(v)) },
    {
      key: 'processedAt',
      label: 'تاريخ المعالجة',
      render: (v) => (v ? formatDate(String(v)) : '—'),
    },
  ];

  if (isError) {
    return <ErrorState message="فشل تحميل طلبات السحب" onRetry={refetch} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="أرباح السائقين"
        description="إدارة طلبات سحب أرباح السائقين - الدفع حالياً نقدي فقط"
      />

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>نظام الدفع النقدي</AlertTitle>
        <AlertDescription>
          جميع الرحلات تتم بالدفع النقدي. السائقون يحصلون على الأجرة مباشرة من الراكب.
          طلبات السحب هنا للسائقين الذين لديهم رصيد من العمولات أو المكافآت.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="طلبات معلقة"
          value={pendingCount.toLocaleString('ar-IQ')}
          icon={Clock}
        />
        <StatCard
          label="إجمالي المعلق"
          value={formatCurrency(totalPending)}
          icon={Banknote}
        />
        <StatCard
          label="طلبات مكتملة"
          value={completedCount.toLocaleString('ar-IQ')}
          icon={CheckCircle}
        />
      </div>

      <div className="flex items-center gap-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="جميع الحالات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            <SelectItem value="PENDING">قيد الانتظار</SelectItem>
            <SelectItem value="COMPLETED">مكتمل</SelectItem>
            <SelectItem value="REJECTED">مرفوض</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <TableSkeleton rows={10} columns={6} />
      ) : !withdrawals || withdrawals.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="لا توجد طلبات سحب"
          description="لم يتقدم أي سائق بطلب سحب أرباح بعد"
          action={status !== 'all' ? { label: 'مسح الفلاتر', onClick: clearFilters } : undefined}
        />
      ) : (
        <DataTable
          data={withdrawals}
          columns={columns}
          onRowClick={(row) => setSelectedWithdrawal(row)}
        />
      )}

      <ProcessWithdrawalModal
        withdrawal={selectedWithdrawal}
        open={!!selectedWithdrawal}
        onClose={() => setSelectedWithdrawal(null)}
      />
    </div>
  );
}
