import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { DriverApi } from '../lib/api/driver';
import { OnboardingStatusResponse } from '../lib/api/types';

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

let fetchPromise: Promise<void> | null = null;

export const useOnboardingStore = create<OnboardingState>()(
  devtools((set, get) => ({
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
      if (fetchPromise) return fetchPromise;

      fetchPromise = (async () => {
        try {
          const res: OnboardingStatusResponse = await DriverApi.getOnboardingStatus();

          set({
            onboardingStatus: res.onboardingStatus,
            documentsStatus: {
              identity: res.documents.identity,
              drivingLicense: res.documents.drivingLicense,
              vehicle: res.documents.vehicle,
            },
            vehicle: res.documents.vehicle?.details || get().vehicle,
          });
        } catch (error) {
          console.error('[OnboardingStore] Failed to fetch onboarding status:', error);
          // If fetch fails, we don't want to stay in 'null' forever which causes a blank screen.
          // We'll set a default status if it's currently null to allow the UI to progress.
          if (get().onboardingStatus === null) {
            set({ onboardingStatus: 'PENDING_DOCUMENTS' });
          }
        } finally {
          fetchPromise = null;
        }
      })();

      return fetchPromise;
    },
  }), { name: 'onboarding-store' })
);
