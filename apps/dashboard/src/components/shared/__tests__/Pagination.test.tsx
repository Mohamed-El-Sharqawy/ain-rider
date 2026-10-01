import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Pagination } from '../Pagination'

describe('Pagination', () => {
  it('renders a flat range when all pages fit', () => {
    const onPageChange = vi.fn()
    render(<Pagination currentPage={3} totalPages={5} onPageChange={onPageChange} />)
    for (const p of ['1', '2', '3', '4', '5']) {
      expect(screen.getByText(p, { selector: 'a' })).toBeInTheDocument()
    }
    expect(document.querySelectorAll('[data-slot="pagination-ellipsis"]').length).toBe(0)
  })

  it('shows only a right ellipsis near the start', () => {
    const onPageChange = vi.fn()
    render(<Pagination currentPage={2} totalPages={20} onPageChange={onPageChange} />)
    expect(screen.getByText('1', { selector: 'a' })).toBeInTheDocument()
    expect(screen.getByText('5', { selector: 'a' })).toBeInTheDocument()
    expect(screen.getByText('20', { selector: 'a' })).toBeInTheDocument()
    // exactly one ellipsis, and no link between 5 and 20
    expect(document.querySelectorAll('[data-slot="pagination-ellipsis"]').length).toBe(1)
    expect(screen.queryByText('6', { selector: 'a' })).not.toBeInTheDocument()
  })

  it('shows only a left ellipsis near the end', () => {
    const onPageChange = vi.fn()
    render(<Pagination currentPage={19} totalPages={20} onPageChange={onPageChange} />)
    expect(screen.getByText('1', { selector: 'a' })).toBeInTheDocument()
    expect(screen.getByText('16', { selector: 'a' })).toBeInTheDocument()
    expect(document.querySelectorAll('[data-slot="pagination-ellipsis"]').length).toBe(1)
    expect(screen.queryByText('15', { selector: 'a' })).not.toBeInTheDocument()
  })

  it('shows both ellipses in the middle', () => {
    const onPageChange = vi.fn()
    render(<Pagination currentPage={10} totalPages={20} onPageChange={onPageChange} />)
    expect(document.querySelectorAll('[data-slot="pagination-ellipsis"]').length).toBe(2)
    expect(screen.getByText('9', { selector: 'a' })).toBeInTheDocument()
    expect(screen.getByText('11', { selector: 'a' })).toBeInTheDocument()
  })

  it('marks the current page as active', () => {
    const onPageChange = vi.fn()
    render(<Pagination currentPage={10} totalPages={20} onPageChange={onPageChange} />)
    const current = screen.getByText('10', { selector: 'a' })
    expect(current).toHaveAttribute('data-active', 'true')
  })

  it('calls onPageChange for a valid page click', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<Pagination currentPage={10} totalPages={20} onPageChange={onPageChange} />)
    await user.click(screen.getByText('11', { selector: 'a' }))
    expect(onPageChange).toHaveBeenCalledWith(11)
  })

  it('ignores clicks on the current page and out-of-range pages', () => {
    const onPageChange = vi.fn()
    render(<Pagination currentPage={1} totalPages={5} onPageChange={onPageChange} />)
    fireEvent.click(screen.getByText('السابق'))
    expect(onPageChange).not.toHaveBeenCalled()

    const current = screen.getByText('1', { selector: 'a' })
    fireEvent.click(current)
    expect(onPageChange).not.toHaveBeenCalled()
  })

  it('ignores a next click beyond the last page', () => {
    const onPageChange = vi.fn()
    render(<Pagination currentPage={5} totalPages={5} onPageChange={onPageChange} />)
    fireEvent.click(screen.getByText('التالي'))
    expect(onPageChange).not.toHaveBeenCalled()
  })
})
