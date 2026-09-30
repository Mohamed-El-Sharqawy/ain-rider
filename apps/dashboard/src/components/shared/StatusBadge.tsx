import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  // General statuses
  PENDING: { label: 'قيد الانتظار', variant: 'secondary' },
  ACTIVE: { label: 'نشط', variant: 'default' },
  INACTIVE: { label: 'غير نشط', variant: 'outline' },
  RESOLVED: { label: 'محلول', variant: 'default' },
  IN_PROGRESS: { label: 'قيد المعالجة', variant: 'secondary' },
  COMPLETED: { label: 'مكتمل', variant: 'default' },
  CANCELLED: { label: 'ملغى', variant: 'destructive' },
  REJECTED: { label: 'مرفوض', variant: 'destructive' },
  FAILED: { label: 'فشل', variant: 'destructive' },
  
  // Trip statuses
  REQUESTED: { label: 'مطلوب', variant: 'secondary' },
  MATCHED: { label: 'تم المطابقة', variant: 'default' },
  DRIVER_ARRIVING: { label: 'السائق قادم', variant: 'default' },
  
  // User statuses
  SUSPENDED: { label: 'معلق', variant: 'destructive' },
  BANNED: { label: 'محظور', variant: 'destructive' },
  UNDER_REVIEW: { label: 'قيد المراجعة', variant: 'secondary' },
  PENDING_DOCUMENTS: { label: 'انتظار الوثائق', variant: 'outline' },
  
  // Payment statuses
  COLLECTED: { label: 'تم التحصيل', variant: 'default' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, variant: 'outline' as const };
  
  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  );
}
