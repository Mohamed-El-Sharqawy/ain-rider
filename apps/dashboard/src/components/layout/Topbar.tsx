import { Search, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { NotificationBell } from './NotificationBell';
import { useAuthStore } from '@/stores/authStore';
import { useLogout } from '@/pages/login/services/mutations';
import { getInitials } from '@/lib/utils';

export function Topbar() {
  const { user } = useAuthStore();
  const { mutate: logout, isPending } = useLogout();

  const roleLabel = user?.role === 'ADMIN' ? 'مدير عام' : 'دعم فني';

  return (
    <header 
      className="h-16 flex items-center justify-between px-6"
      style={{ 
        backgroundColor: 'var(--color-card)',
        borderBottom: '1px solid var(--color-border)' 
      }}
    >
      <div 
        className="flex items-center rounded-md px-3 py-1.5 w-64"
        style={{ backgroundColor: 'var(--color-muted)' }}
      >
        <Search size={16} style={{ color: 'var(--color-muted-foreground)' }} className="mr-2" />
        <input 
          type="text" 
          placeholder="بحث..." 
          className="bg-transparent border-none outline-none text-sm w-full"
          style={{ color: 'var(--color-foreground)' }}
        />
      </div>
      <div className="flex items-center gap-4">
        <ThemeToggle />
        
        <NotificationBell />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              className="flex items-center gap-2 pl-4 outline-none"
              style={{ borderLeft: '1px solid var(--color-border)' }}
            >
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
              >
                {user ? getInitials(user.fullName) : 'AD'}
              </div>
              <div className="text-sm text-right">
                <p className="font-medium" style={{ color: 'var(--color-foreground)' }}>
                  {user?.fullName ?? 'مستخدم إداري'}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                  {roleLabel}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user?.fullName}</p>
                <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()} disabled={isPending}>
              <LogOut size={16} className="ml-2" />
              تسجيل الخروج
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
