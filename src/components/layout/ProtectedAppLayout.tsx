import { ProtectedRoute } from '@/components/shared/ProtectedRoute';
import { AppLayout } from './AppLayout';

export function ProtectedAppLayout() {
  return (
    <ProtectedRoute>
      <AppLayout />
    </ProtectedRoute>
  );
}
