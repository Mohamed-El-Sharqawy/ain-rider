import { useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useGetComplaints } from '@/pages/complaints/services/queries';
import { useGetPromos } from '@/pages/promos/services/queries';
import { useGetWithdrawals } from '@/pages/wallets/services/queries';
import { StatCard } from '@/components/shared/StatCard';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/card';
import { MessageSquareWarning, TicketPercent, Wallet } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useNavigate } from 'react-router';
import type { Complaint } from '@/pages/complaints/services/transformers';

export function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { data: complaints, isLoading: complaintsLoading, isError: complaintsError, refetch: refetchComplaints } = useGetComplaints({ page: 1, limit: 10 });
  const { data: promos, isLoading: promosLoading, isError: promosError, refetch: refetchPromos } = useGetPromos();
  const { data: withdrawals, isLoading: withdrawalsLoading, isError: withdrawalsError, refetch: refetchWithdrawals } = useGetWithdrawals();

  const hasAnyError = complaintsError || promosError || withdrawalsError;

  const handleRetryAll = () => {
    refetchComplaints();
    refetchPromos();
    refetchWithdrawals();
  };

  const pendingComplaints = useMemo(
    () => complaints?.data.filter((c) => c.status === 'PENDING').length ?? 0,
    [complaints]
  );
  const activePromos = useMemo(
    () => promos?.filter((p) => p.status === 'ACTIVE').length ?? 0,
    [promos]
  );
  const pendingWithdrawals = useMemo(
    () => withdrawals?.filter((w) => w.status === 'PENDING').length ?? 0,
    [withdrawals]
  );

  const recentComplaints = useMemo(
    () => complaints?.data.slice(0, 5) ?? [],
    [complaints]
  );

  const columns: Column<Complaint>[] = [
    {
      key: 'id',
      label: 'المعرف',
      render: (v) => <span className="font-mono text-xs">{String(v).slice(0, 8)}</span>,
      className: 'w-24',
    },
    { key: 'subject', label: 'الموضوع' },
    { key: 'status', label: 'الحالة', render: (v) => <StatusBadge status={String(v)} /> },
    { key: 'priority', label: 'الأولوية', render: (v) => <StatusBadge status={String(v)} /> },
    { key: 'createdAt', label: 'التاريخ', render: (v) => formatDate(String(v)) },
  ];

  if (hasAnyError) {
    return <ErrorState message="فشل تحميل بيانات لوحة التحكم" onRetry={handleRetryAll} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`مرحباً، ${user?.firstName ?? 'مستخدم إداري'}`}
        description="نظرة عامة على نشاط المنصة"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={MessageSquareWarning}
          label="الشكاوى المعلقة"
          value={complaintsLoading ? '...' : pendingComplaints}
        />
        <StatCard
          icon={TicketPercent}
          label="العروض النشطة"
          value={promosLoading ? '...' : activePromos}
        />
        <StatCard
          icon={Wallet}
          label="طلبات السحب المعلقة"
          value={withdrawalsLoading ? '...' : pendingWithdrawals}
        />
      </div>

      <Card className="p-6">
        <h2
          className="text-lg font-semibold mb-4 font-display text-foreground"
        >
          أحدث الشكاوى
        </h2>
        {complaintsLoading ? (
          <TableSkeleton rows={5} columns={5} />
        ) : (
          <DataTable
            data={recentComplaints}
            columns={columns}
            onRowClick={() => navigate('/complaints')}
          />
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 cursor-pointer transition-colors hover:bg-muted" onClick={() => navigate('/complaints')}>
          <MessageSquareWarning size={32} className="mb-3 text-primary" />
          <h3 className="font-semibold mb-1 text-foreground">إدارة الشكاوى</h3>
          <p className="text-sm text-muted-foreground">
            عرض ومعالجة شكاوى الركاب والسائقين
          </p>
        </Card>
        <Card className="p-6 cursor-pointer transition-colors hover:bg-muted" onClick={() => navigate('/promos')}>
          <TicketPercent size={32} className="mb-3 text-primary" />
          <h3 className="font-semibold mb-1 text-foreground">العروض الترويجية</h3>
          <p className="text-sm text-muted-foreground">
            إنشاء وإدارة أكواد الخصم
          </p>
        </Card>
        <Card className="p-6 cursor-pointer transition-colors hover:bg-muted" onClick={() => navigate('/wallets')}>
          <Wallet size={32} className="mb-3 text-primary" />
          <h3 className="font-semibold mb-1 text-foreground">المحافظ والسحوبات</h3>
          <p className="text-sm text-muted-foreground">
            إدارة محافظ المستخدمين وطلبات السحب
          </p>
        </Card>
      </div>
    </div>
  );
}
