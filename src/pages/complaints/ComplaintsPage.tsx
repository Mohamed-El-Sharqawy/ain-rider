import { useState } from 'react';
import { useGetComplaints } from './services/queries';
import { useComplaintFilters } from './hooks/useComplaintFilters';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { ComplaintDetailModal } from './components/ComplaintDetailModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquareWarning } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { Complaint } from './services/transformers';

export function ComplaintsPage() {
  const { filters, status, setStatus, clearFilters } = useComplaintFilters();
  const { data: complaints, isLoading, isError, refetch } = useGetComplaints(filters.status);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);

  const columns: Column<Complaint>[] = [
    {
      key: 'id',
      label: 'المعرف',
      render: (v) => <span className="font-mono text-xs">{String(v).slice(0, 8)}</span>,
      className: 'w-24',
    },
    { key: 'subject', label: 'الموضوع' },
    { key: 'type', label: 'النوع' },
    { key: 'status', label: 'الحالة', render: (v) => <StatusBadge status={String(v)} /> },
    { key: 'priority', label: 'الأولوية', render: (v) => <StatusBadge status={String(v)} /> },
    {
      key: 'assignedTo',
      label: 'المسؤول',
      render: (v) => (v ? String(v).slice(0, 8) : '—'),
    },
    { key: 'createdAt', label: 'التاريخ', render: (v) => formatDate(String(v)) },
  ];

  if (isError) {
    return <ErrorState message="فشل تحميل الشكاوى" onRetry={refetch} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="الشكاوى"
        description="إدارة شكاوى الركاب والسائقين"
      />

      <div className="flex items-center gap-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="جميع الحالات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            <SelectItem value="PENDING">قيد الانتظار</SelectItem>
            <SelectItem value="IN_PROGRESS">قيد المعالجة</SelectItem>
            <SelectItem value="RESOLVED">محلول</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <TableSkeleton rows={10} columns={7} />
      ) : !complaints || complaints.length === 0 ? (
        <EmptyState
          icon={MessageSquareWarning}
          title="لا توجد شكاوى"
          description="لم يتم العثور على شكاوى تطابق الفلاتر المحددة"
          action={status !== 'all' ? { label: 'مسح الفلاتر', onClick: clearFilters } : undefined}
        />
      ) : (
        <DataTable
          data={complaints}
          columns={columns}
          onRowClick={(row) => setSelectedComplaint(row)}
        />
      )}

      <ComplaintDetailModal
        complaint={selectedComplaint}
        open={!!selectedComplaint}
        onClose={() => setSelectedComplaint(null)}
      />
    </div>
  );
}
