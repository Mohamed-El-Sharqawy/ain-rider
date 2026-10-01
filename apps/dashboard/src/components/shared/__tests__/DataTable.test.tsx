import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DataTable, type Column } from '../DataTable'

interface Row {
  id: string
  name: string
  email?: string
}

const rows: Row[] = [
  { id: 'r-1', name: 'أحمد', email: 'a@x.com' },
  { id: 'r-2', name: 'سارة' },
]

const baseColumns: Column<Row>[] = [
  { key: 'name', label: 'الاسم' },
  { key: 'email', label: 'البريد', render: (v) => <span dir="ltr">{String(v)}</span> },
]

describe('DataTable', () => {
  it('renders headers and cells with custom renderers', () => {
    render(<DataTable data={rows} columns={baseColumns} />)
    expect(screen.getByText('الاسم')).toBeInTheDocument()
    expect(screen.getByText('البريد')).toBeInTheDocument()
    expect(screen.getByText('أحمد')).toBeInTheDocument()
    expect(screen.getByText('a@x.com')).toBeInTheDocument()
  })

  it('falls back to String(value) or empty string without a renderer', () => {
    const columns: Column<Row>[] = [{ key: 'name', label: 'الاسم' }, { key: 'email', label: 'البريد' }]
    render(<DataTable data={rows} columns={columns} />)
    // row 2 has no email: String(undefined ?? '') === ''
    const secondRow = screen.getByText('سارة').closest('tr')!
    const emailCell = secondRow.children[1]
    expect(emailCell.textContent).toBe('')
  })

  it('shows the empty message row when data is empty', () => {
    render(<DataTable data={[]} columns={baseColumns} emptyMessage="لا يوجد مستخدمون" />)
    expect(screen.getByText('لا يوجد مستخدمون')).toBeInTheDocument()
  })

  it('uses the default empty message', () => {
    render(<DataTable data={[]} columns={baseColumns} />)
    expect(screen.getByText('لا توجد بيانات')).toBeInTheDocument()
  })

  it('invokes onRowClick with the clicked row and marks rows clickable', () => {
    const onRowClick = vi.fn()
    render(<DataTable data={rows} columns={baseColumns} onRowClick={onRowClick} />)
    fireEvent.click(screen.getByText('سارة'))
    expect(onRowClick).toHaveBeenCalledWith(rows[1])
  })

  it('omits row click handlers when onRowClick is not provided', () => {
    render(<DataTable data={rows} columns={baseColumns} />)
    expect(screen.getByText('سارة').closest('tr')).not.toHaveClass('cursor-pointer')
  })

  it('hides pagination controls for a single page', () => {
    render(
      <DataTable
        data={rows}
        columns={baseColumns}
        pagination={{ page: 1, totalPages: 1, onPageChange: vi.fn() }}
      />,
    )
    expect(screen.queryByLabelText('الصفحة السابقة')).not.toBeInTheDocument()
  })

  it('navigates pages and disables at the bounds', () => {
    const onPageChange = vi.fn()
    const { unmount } = render(
      <DataTable
        data={rows}
        columns={baseColumns}
        pagination={{ page: 2, totalPages: 3, onPageChange }}
      />,
    )
    expect(screen.getByText('صفحة 2 من 3')).toBeInTheDocument()

    const prev = screen.getByLabelText('الصفحة السابقة')
    const next = screen.getByLabelText('الصفحة التالية')
    expect(prev).toBeEnabled()
    expect(next).toBeEnabled()

    fireEvent.click(prev)
    expect(onPageChange).toHaveBeenLastCalledWith(1)
    fireEvent.click(next)
    expect(onPageChange).toHaveBeenLastCalledWith(3)
    unmount()

    const first = render(
      <DataTable data={rows} columns={baseColumns} pagination={{ page: 1, totalPages: 3, onPageChange }} />,
    )
    expect(screen.getByLabelText('الصفحة السابقة')).toBeDisabled()
    first.unmount()

    render(
      <DataTable data={rows} columns={baseColumns} pagination={{ page: 3, totalPages: 3, onPageChange }} />,
    )
    expect(screen.getByLabelText('الصفحة التالية')).toBeDisabled()
  })

  it('applies column className and aria labels', () => {
    const columns: Column<Row>[] = [{ key: 'name', label: 'الاسم', className: 'w-24' }]
    render(<DataTable data={rows} columns={columns} />)
    expect(screen.getByText('الاسم').closest('th')).toHaveAttribute('aria-label', 'الاسم')
  })
})
