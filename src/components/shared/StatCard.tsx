import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  change?: {
    value: number;
    label: string;
  };
}

export function StatCard({ icon: Icon, label, value, change }: StatCardProps) {
  const isPositive = change && change.value > 0;
  const isNegative = change && change.value < 0;

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
            {label}
          </p>
          <h3
            className="text-3xl font-bold mt-2"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-foreground)' }}
          >
            {value}
          </h3>
          {change && (
            <div className="flex items-center gap-1 mt-2">
              {isPositive && <TrendingUp size={14} style={{ color: 'var(--color-chart-1)' }} />}
              {isNegative && <TrendingDown size={14} style={{ color: 'var(--color-destructive)' }} />}
              <span
                className="text-xs font-medium"
                style={{
                  color: isPositive
                    ? 'var(--color-chart-1)'
                    : isNegative
                      ? 'var(--color-destructive)'
                      : 'var(--color-muted-foreground)',
                }}
              >
                {change.value > 0 ? '+' : ''}
                {change.value}% {change.label}
              </span>
            </div>
          )}
        </div>
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
        >
          <Icon size={24} />
        </div>
      </div>
    </Card>
  );
}
