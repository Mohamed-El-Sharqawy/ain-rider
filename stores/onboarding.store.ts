import { create } from 'zustand';

interface OnboardingState {
  role: 'RIDER' | 'DRIVER' | null;
  phone: string;
  verificationId: string | null;
  setRole: (role: 'RIDER' | 'DRIVER') => void;
  setPhone: (phone: string) => void;
  setVerificationId: (id: string) => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  role: null,
  phone: '',
  verificationId: null,
  setRole: (role) => set({ role }),
  setPhone: (phone) => set({ phone }),
  setVerificationId: (id) => set({ verificationId: id }),
}));
