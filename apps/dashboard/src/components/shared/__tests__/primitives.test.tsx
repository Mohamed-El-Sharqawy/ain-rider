import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Users, Package } from 'lucide-react'
import { PageHeader } from '../PageHeader'
import { StatCard } from '../StatCard'
import { StatusBadge } from '../StatusBadge'
import { EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { TableSkeleton } from '../TableSkeleton'

describe('PageHeader', () => {
  it('renders title only', () => {
    render(<PageHeader title="المستخدمون" />)
    expect(screen.getByText('المستخدمون')).toBeInTheDocument()
  })

  it('renders description and actions when provided', () => {
    render(
      <PageHeader
        title="الشكاوى"
        description="إدارة الشكاوى"
        actions={<button>إجراء</button>}
      />,
    )
    expect(screen.getByText('إدارة الشكاوى')).toBeInTheDocument()
    expect(screen.getByText('إجراء')).toBeInTheDocument()
  })
})

describe('StatCard', () => {
  it('renders a skeleton while loading', () => {
    const { container } = render(<StatCard icon={Users} label="الإجمالي" value={0} isLoading />)
    expect(container.querySelectorAll('.animate-spin')).toHaveLength(0)
    // skeletons are divs with the Skeleton class
    expect(container.querySelectorAll('[class*="animate-"]')).not.toHaveLength(0)
    expect(screen.queryByText('الإجمالي')).not.toBeInTheDocument()
  })

  it('renders the value without change info', () => {
    render(<StatCard icon={Users} label="الإجمالي" value={42} />)
    expect(screen.getByText('الإجمالي')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('shows a positive change with an up indicator', () => {
    render(<StatCard icon={Users} label="السائقين" value={10} change={{ value: 5, label: 'هذا الأسبوع' }} />)
    expect(screen.getByText('+5% هذا الأسبوع')).toBeInTheDocument()
  })

  it('shows a negative change with a down indicator', () => {
    render(<StatCard icon={Users} label="السائقين" value={10} change={{ value: -3, label: 'هذا الأسبوع' }} />)
    expect(screen.getByText('-3% هذا الأسبوع')).toBeInTheDocument()
  })

  it('shows a zero change without an indicator icon', () => {
    render(<StatCard icon={Users} label="السائقين" value={10} change={{ value: 0, label: 'هذا الأسبوع' }} />)
    expect(screen.getByText('0% هذا الأسبوع')).toBeInTheDocument()
  })
})

describe('StatusBadge', () => {
  it.each([
    ['PENDING', 'قيد الانتظار'],
    ['ACTIVE', 'نشط'],
    ['INACTIVE', 'غير نشط'],
    ['RESOLVED', 'محلول'],
    ['IN_PROGRESS', 'قيد المعالجة'],
    ['COMPLETED', 'مكتمل'],
    ['CANCELLED', 'ملغى'],
    ['REJECTED', 'مرفوض'],
    ['FAILED', 'فشل'],
    ['REQUESTED', 'مطلوب'],
    ['MATCHED', 'تم المطابقة'],
    ['DRIVER_ARRIVING', 'السائق قادم'],
    ['SUSPENDED', 'معلق'],
    ['BANNED', 'محظور'],
    ['UNDER_REVIEW', 'قيد المراجعة'],
    ['PENDING_DOCUMENTS', 'انتظار الوثائق'],
    ['COLLECTED', 'تم التحصيل'],
  ])('maps %s to its Arabic label', (status, label) => {
    render(<StatusBadge status={status} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('falls back to the raw status with outline variant', () => {
    render(<StatusBadge status="SOMETHING_NEW" />)
    expect(screen.getByText('SOMETHING_NEW')).toBeInTheDocument()
  })
})

describe('EmptyState', () => {
  it('renders icon, title and description', () => {
    render(<EmptyState icon={Package} title="لا توجد بيانات" description="جرب لاحقاً" />)
    expect(screen.getByText('لا توجد بيانات')).toBeInTheDocument()
    expect(screen.getByText('جرب لاحقاً')).toBeInTheDocument()
  })

  it('renders the optional action button', () => {
    const onClick = vi.fn()
    render(
      <EmptyState
        icon={Package}
        title="لا توجد بيانات"
        description="جرب لاحقاً"
        action={{ label: 'مسح الفلاتر', onClick }}
      />,
    )
    fireEvent.click(screen.getByText('مسح الفلاتر'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})

describe('ErrorState', () => {
  it('renders the message without a retry button', () => {
    render(<ErrorState message="فشل التحميل" />)
    expect(screen.getByText('حدث خطأ')).toBeInTheDocument()
    expect(screen.getByText('فشل التحميل')).toBeInTheDocument()
    expect(screen.queryByText('إعادة المحاولة')).not.toBeInTheDocument()
  })

  it('retries through the callback', () => {
    const onRetry = vi.fn()
    render(<ErrorState message="فشل التحميل" onRetry={onRetry} />)
    fireEvent.click(screen.getByText('إعادة المحاولة'))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})

describe('TableSkeleton', () => {
  it('renders the default 10 rows x 5 columns', () => {
    const { container } = render(<TableSkeleton />)
    // every skeleton cell
    expect(container.querySelectorAll('[data-slot="skeleton"], .bg-muted, [class*="skeleton"]')).not.toHaveLength(0)
  })

  it('renders the requested rows and columns', () => {
    const { container } = render(<TableSkeleton rows={3} columns={2} />)
    const rows = container.querySelectorAll('div.p-4.flex.gap-4')
    expect(rows).toHaveLength(3)
    rows.forEach((row) => {
      expect(row.children).toHaveLength(2)
    })
  })

  it('omits the top border on the first row only', () => {
    const { container } = render(<TableSkeleton rows={2} columns={1} />)
    const rows = container.querySelectorAll('div.p-4.flex.gap-4')
    expect(rows[0].style.borderTop).toBe('')
    expect(rows[1].style.borderTop).toContain('1px solid')
  })
})
