import { Link } from 'react-router';
import { LayoutDashboard, Users, Navigation, MessageSquareWarning, TicketPercent, Settings, Car, Banknote, Bell, UserCircle } from 'lucide-react';

const navigation = [
  { name: 'لوحة التحكم', href: '/', icon: LayoutDashboard },
  { name: 'المستخدمون', href: '/users', icon: Users },
  { name: 'الرحلات', href: '/trips', icon: Navigation },
  { name: 'الشكاوى', href: '/complaints', icon: MessageSquareWarning },
  { name: 'العروض والخصومات', href: '/promos', icon: TicketPercent },
  { name: 'المركبات', href: '/vehicles', icon: Car },
  { name: 'أرباح السائقين', href: '/wallets', icon: Banknote },
  { name: 'الإشعارات', href: '/notifications', icon: Bell },
  { name: 'الملف الشخصي', href: '/profile', icon: UserCircle },
  { name: 'الإعدادات', href: '/settings', icon: Settings },
];

export function Sidebar() {
  return (
    <aside 
      className="w-64 h-full flex flex-col"
      style={{ 
        backgroundColor: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)' 
      }}
    >
      <div 
        className="h-16 flex items-center px-6 bg-(--color-card)"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>عين رايدر — الإدارة</h1>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navigation.map((item) => (
          <Link
            key={item.name}
            to={item.href}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-2)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            style={{ color: 'var(--color-text-primary)' }}
          >
            <item.icon size={18} />
            {item.name}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
