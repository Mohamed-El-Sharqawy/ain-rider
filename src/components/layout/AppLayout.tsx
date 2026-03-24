import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { Outlet } from 'react-router';

export function AppLayout() {
  return (
    <div 
      className="flex h-screen w-full"
      style={{ backgroundColor: 'var(--color-surface-2)' }}
    >
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
