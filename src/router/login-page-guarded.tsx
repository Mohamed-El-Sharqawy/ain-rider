import { GuestRoute } from "@/components/shared/GuestRoute";
import { LoginPage } from "@/pages/login/LoginPage";

export function LoginPageGuarded() {
  return (
    <GuestRoute>
      <LoginPage />
    </GuestRoute>
  );
}