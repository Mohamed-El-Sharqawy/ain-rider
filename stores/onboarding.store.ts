import { create } from 'zustand';
import { AuthApi } from '../lib/api/auth';

interface OnboardingState {
  role: 'RIDER' | 'DRIVER' | null;
  phone: string;
  verificationId: string | null;
  vehicle: {
    make: string;
    model: string;
    year: number;
    color: string;
    plateNumber: string;
  } | null;
  licenseNumber: string | null;
  onboardingStatus: 'PENDING_DOCUMENTS' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | null;
  documentsStatus: {
    identity: { status: string; rejectionReason?: string };
    drivingLicense: { status: string; rejectionReason?: string };
    vehicle: { status: string; rejectionReason?: string };
  } | null;
  setRole: (role: 'RIDER' | 'DRIVER') => void;
  setPhone: (phone: string) => void;
  setVerificationId: (id: string) => void;
  setVehicle: (vehicle: OnboardingState['vehicle']) => void;
  setLicenseNumber: (licenseNumber: string) => void;
  fetchOnboardingStatus: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  role: null,
  phone: '',
  verificationId: null,
  vehicle: null,
  licenseNumber: null,
  onboardingStatus: null,
  documentsStatus: null,
  setRole: (role) => set({ role }),
  setPhone: (phone) => set({ phone }),
  setVerificationId: (id) => set({ verificationId: id }),
  setVehicle: (vehicle) => set({ vehicle }),
  setLicenseNumber: (licenseNumber) => set({ licenseNumber }),
  fetchOnboardingStatus: async () => {
    console.log('[OnboardingDebug] Fetching status...');
    try {
      const res: any = await AuthApi.getOnboardingStatus();
      console.log('[OnboardingDebug] Received status:', res);
      
      const statusData = res.data || res; // Handle wrapped or unwrapped response
      
      set({ 
        onboardingStatus: statusData.onboardingStatus,
        documentsStatus: {
          identity: statusData.documents.identity,
          drivingLicense: statusData.documents.drivingLicense,
          vehicle: statusData.documents.vehicle,
        },
        vehicle: statusData.documents.vehicle.details || get().vehicle
      });
    } catch (error) {
      console.error('[OnboardingDebug] Failed to fetch onboarding status:', error);
    }
  },
}));
