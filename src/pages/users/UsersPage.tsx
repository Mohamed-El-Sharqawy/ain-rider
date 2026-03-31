import { useState } from 'react';
import { useGetAllUsers, useGetUserStats } from './services/queries';
import { useUserFilters } from './hooks/useUserFilters';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { StatCard } from '@/components/shared/StatCard';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Pagination } from '@/components/shared/Pagination';
import { UserDetailModal } from './components/UserDetailModal';
import { CreateUserModal } from './components/CreateUserModal';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Users, Car, UserCheck, Shield, Search, X, UserPlus } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { User } from './services/transformers';

export function UsersPage() {
  const { filters, rawFilters, setFilters, clearFilters } = useUserFilters();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: users, isLoading, isError, refetch } = useGetAllUsers({
    ...filters,
    limit: 20,
  });
  const { data: stats } = useGetUserStats();

  const columns: Column<User>[] = [
    {
      key: 'fullName',
      label: 'الاسم',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          {row.profileImage ? (
            <img
              src={row.profileImage}
              alt={row.fullName}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {row.firstName.charAt(0)}
              </span>
            </div>
          )}
          <div>
            <p className="font-medium">{row.fullName}</p>
            <p className="text-xs text-muted-foreground">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'phoneNumber',
      label: 'رقم الهاتف',
      render: (v) => <span dir="ltr">{String(v)}</span>,
    },
    {
      key: 'role',
      label: 'الدور',
      render: (_v, row) => {
        const roleMap: Record<string, string> = {
          RIDER: 'راكب',
          DRIVER: 'سائق',
          ADMIN: 'مدير',
          SUPPORT: 'دعم فني',
        };
        return roleMap[String(row.role)] || row.role;
      },
    },
    {
      key: 'status',
      label: 'الحالة',
      render: (v) => <StatusBadge status={String(v)} />,
    },
    {
      key: 'createdAt',
      label: 'تاريخ التسجيل',
      render: (v) => formatDate(v as Date),
    },
  ];

  const hasActiveFilters = rawFilters.search || rawFilters.role !== 'all' || rawFilters.status !== 'all';

  return (
    <div className="space-y-6">
      <PageHeader
        title="المستخدمون"
        description="إدارة جميع المستخدمين في النظام"
        actions={
          <div className="flex gap-2">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X size={14} />
                مسح الفلاتر
              </Button>
            )}
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <UserPlus className="ml-2 h-4 w-4" />
              إضافة مستخدم
            </Button>
          </div>
        }
      />

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="إجمالي المستخدمين"
            value={stats.total}
            icon={Users}
          />
          <StatCard
            label="الركاب"
            value={stats.riders}
            icon={UserCheck}
          />
          <StatCard
            label="السائقين"
            value={stats.drivers}
            change={{ value: stats.onlineDrivers, label: 'متصل الآن' }}
            icon={Car}
          />
          <StatCard
            label="الإداريين"
            value={stats.admins + stats.support}
            icon={Shield}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو البريد أو الهاتف..."
            value={rawFilters.search}
            onChange={(e) => setFilters({ search: e.target.value, page: 1 })}
            className="pr-10"
          />
        </div>
        <Select
          value={rawFilters.role}
          onValueChange={(v) => setFilters({ role: v, page: 1 })}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="الدور" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الأدوار</SelectItem>
            <SelectItem value="RIDER">راكب</SelectItem>
            <SelectItem value="DRIVER">سائق</SelectItem>
            <SelectItem value="ADMIN">مدير</SelectItem>
            <SelectItem value="SUPPORT">دعم فني</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={rawFilters.status}
          onValueChange={(v) => setFilters({ status: v, page: 1 })}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            <SelectItem value="ACTIVE">نشط</SelectItem>
            <SelectItem value="UNDER_REVIEW">قيد المراجعة</SelectItem>
            <SelectItem value="PENDING_DOCUMENTS">انتظار الوثائق</SelectItem>
            <SelectItem value="INACTIVE">غير نشط</SelectItem>
            <SelectItem value="SUSPENDED">موقوف</SelectItem>
            <SelectItem value="BANNED">محظور</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isError ? (
        <ErrorState message="فشل تحميل المستخدمين" onRetry={refetch} />
      ) : isLoading ? (
        <TableSkeleton rows={10} columns={5} />
      ) : !users || users.data.length === 0 ? (
        <EmptyState
          icon={Users}
          title="لا يوجد مستخدمون"
          description={hasActiveFilters ? 'جرب تغيير معايير البحث' : 'لم يتم تسجيل أي مستخدمين بعد'}
        />
      ) : (
        <>
          <DataTable
            data={users.data}
            columns={columns}
            onRowClick={setSelectedUser}
          />
          {users.meta.totalPages > 1 && (
            <Pagination
              currentPage={users.meta.page}
              totalPages={users.meta.totalPages}
              onPageChange={(page: number) => setFilters({ page: page })}
            />
          )}
        </>
      )}

      <UserDetailModal
        user={selectedUser}
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
      />

      <CreateUserModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
