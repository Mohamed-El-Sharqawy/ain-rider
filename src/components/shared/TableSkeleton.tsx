import { Skeleton } from '@/components/ui/skeleton';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 10, columns = 5 }: TableSkeletonProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        <div className="p-4" style={{ backgroundColor: 'var(--color-muted)' }}>
          <div className="flex gap-4">
            {Array.from({ length: columns }).map((_, i) => (
              <Skeleton key={i} className="h-4 flex-1" />
            ))}
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--color-card)' }}>
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="p-4 flex gap-4"
              style={{ borderTop: i > 0 ? '1px solid var(--color-border)' : undefined }}
            >
              {Array.from({ length: columns }).map((_, j) => (
                <Skeleton key={j} className="h-4 flex-1" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
