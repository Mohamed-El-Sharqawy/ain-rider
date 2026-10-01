import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from '../ConfirmDialog'
import { SearchInput } from '../SearchInput'
import { ThemeToggle } from '../ThemeToggle'

describe('ConfirmDialog', () => {
  it('opens from the trigger, confirms and closes', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        trigger={<button>حذف</button>}
        title="تأكيد الحذف"
        description="لا يمكن التراجع"
        onConfirm={onConfirm}
      />,
    )
    await user.click(screen.getByText('حذف'))
    expect(await screen.findByText('تأكيد الحذف')).toBeInTheDocument()
    expect(screen.getByText('لا يمكن التراجع')).toBeInTheDocument()

    await user.click(screen.getByText('تأكيد'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('supports custom labels and closes without confirming', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        trigger={<button>فتح</button>}
        title="عنوان"
        description="وصف"
        confirmLabel="نعم"
        cancelLabel="خروج"
        onConfirm={onConfirm}
      />,
    )
    await user.click(screen.getByText('فتح'))
    expect(await screen.findByText('عنوان')).toBeInTheDocument()
    await user.click(screen.getByText('خروج'))
    expect(onConfirm).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByText('عنوان')).not.toBeInTheDocument())
  })

  it('applies the destructive styling to the confirm action', async () => {
    const user = userEvent.setup()
    render(
      <ConfirmDialog
        trigger={<button>فتح</button>}
        title="عنوان"
        description="وصف"
        variant="destructive"
        onConfirm={vi.fn()}
      />,
    )
    await user.click(screen.getByText('فتح'))
    const confirm = await screen.findByText('تأكيد')
    expect(confirm).toHaveClass('bg-destructive')
  })
})

describe('SearchInput', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders with the initial value and placeholder', () => {
    render(<SearchInput value="أحمد" onChange={vi.fn()} placeholder="بحث بالاسم" />)
    expect(screen.getByPlaceholderText('بحث بالاسم')).toHaveValue('أحمد')
  })

  it('debounces changes and skips when the value matches', async () => {
    const onChange = vi.fn()
    render(<SearchInput value="" onChange={onChange} debounceMs={300} />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'س' } })
    expect(onChange).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(300)
    expect(onChange).toHaveBeenCalledWith('س')
    expect(onChange).toHaveBeenCalledTimes(1)

    // a re-render whose value matches the local value never calls again
    render(<SearchInput value="س" onChange={onChange} debounceMs={300} />)
    await vi.advanceTimersByTimeAsync(300)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('re-syncs the local value when the prop value changes', async () => {
    const onChange = vi.fn()
    const { rerender } = render(<SearchInput value="أ" onChange={onChange} />)
    rerender(<SearchInput value="ب" onChange={onChange} />)
    expect(screen.getByRole('textbox')).toHaveValue('ب')
    await vi.advanceTimersByTimeAsync(300)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('clears the pending debounce on unmount', async () => {
    const onChange = vi.fn()
    const { unmount } = render(<SearchInput value="" onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'س' } })
    unmount()
    await vi.advanceTimersByTimeAsync(300)
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ''
  })

  it('shows the moon icon in light mode and toggles to dark', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)
    expect(screen.getByLabelText('تفعيل الوضع الداكن')).toBeInTheDocument()

    await user.click(screen.getByLabelText('تفعيل الوضع الداكن'))
    expect(screen.getByLabelText('تفعيل الوضع الفاتح')).toBeInTheDocument()
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('shows the sun icon when starting dark', () => {
    localStorage.setItem('theme', 'dark')
    render(<ThemeToggle />)
    expect(screen.getByLabelText('تفعيل الوضع الفاتح')).toBeInTheDocument()
  })

  it('tints the button on hover and clears it on leave', () => {
    render(<ThemeToggle />)
    const button = screen.getByLabelText('تفعيل الوضع الداكن')
    fireEvent.mouseEnter(button)
    expect(button.style.backgroundColor).toBe('var(--color-muted)')
    fireEvent.mouseLeave(button)
    expect(button.style.backgroundColor).toBe('transparent')
  })
})
