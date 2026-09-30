import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  change?: {
    value: number;
    label: string;
  };
  isLoading?: boolean;
}

export function StatCard({ icon: Icon, label, value, change, isLoading }: StatCardProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-9 w-20 mt-2" />
            <Skeleton className="h-3 w-28 mt-3" />
          </div>
          <Skeleton className="h-12 w-12 rounded-lg" />
        </div>
      </Card>
    );
  }

  const isPositive = change && change.value > 0;
  const isNegative = change && change.value < 0;

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">
            {label}
          </p>
          <h3
            className="text-3xl font-bold mt-2 font-display text-foreground"
          >
            {value}
          </h3>
          {change && (
            <div className="flex items-center gap-1 mt-2">
              {isPositive && <TrendingUp size={14} className="text-chart-1" />}
              {isNegative && <TrendingDown size={14} className="text-destructive" />}
              <span
                className={`text-xs font-medium ${isPositive
                    ? 'text-chart-1'
                    : isNegative
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  }`}
              >
                {change.value > 0 ? '+' : ''}
                {change.value}% {change.label}
              </span>
            </div>
          )}
        </div>
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center bg-primary text-primary-foreground shadow-sm"
        >
          <Icon size={24} />
        </div>
      </div>
    </Card>
  );
}
