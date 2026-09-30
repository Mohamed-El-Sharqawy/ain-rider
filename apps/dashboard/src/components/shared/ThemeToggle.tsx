// ─── Theme Toggle ────────────────────────────────────────────────────────────
// Dark/light mode toggle button with icon transition.

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full transition-colors"
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-muted)')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      aria-label={theme === 'light' ? 'تفعيل الوضع الداكن' : 'تفعيل الوضع الفاتح'}
    >
      {theme === 'light' ? (
        <Moon size={20} style={{ color: 'var(--color-foreground)' }} />
      ) : (
        <Sun size={20} style={{ color: 'var(--color-foreground)' }} />
      )}
    </button>
  )
}
