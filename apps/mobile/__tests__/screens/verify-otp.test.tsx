import { AppState } from 'react-native';
import { act } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import VerifyOtpScreen from '../../app/(auth)/verify-otp';
import { AuthApi } from '../../lib/api/auth';
import { ApiError } from '../../lib/api/client';
import { UserRole, type PhoneVerificationResult } from '../../lib/api/types';
import { SecureStorage } from '../../lib/storage/secure';
import { useAuthStore } from '../../stores/auth.store';
import { useOnboardingStore } from '../../stores/onboarding.store';

jest.mock('react-native-keyboard-aware-scroll-view', () => ({
  KeyboardAwareScrollView: require('react-native').ScrollView,
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

jest.mock('../../lib/api/auth', () => ({
  AuthApi: { requestOtp: jest.fn(), verifyOtp: jest.fn() },
}));

jest.mock('../../lib/storage/secure', () => ({
  SecureStorage: {
    saveTokens: jest.fn(),
    getAccessToken: jest.fn(),
    getRefreshToken: jest.fn(),
    clearTokens: jest.fn(),
  },
}));

const appStateHandlers: Array<(state: string) => void> = [];

const mockedAuthApi = jest.mocked(AuthApi);
const mockedSecureStorage = jest.mocked(SecureStorage);

const testUser = (role: UserRole, status = 'APPROVED') => ({
  id: 'u1',
  role,
  status,
  email: 'rider@example.com',
  phoneNumber: '+201012345678',
  firstName: 'Test',
  lastName: 'User',
});

const registeredResult = (
  overrides: Partial<PhoneVerificationResult> = {},
): PhoneVerificationResult => ({
  success: true,
  isRegistered: true,
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  user: testUser(UserRole.RIDER),
  ...overrides,
});

const renderScreen = () => render(<VerifyOtpScreen />);
const enterOtp = (code = '123456') =>
  fireEvent.changeText(screen.getByPlaceholderText('------'), code);
const pressVerify = () => fireEvent.press(screen.getByText(/Verify & Continue|Verifying\.\.\./));
const pressResend = () =>
  fireEvent.press(screen.getByText(/Resend Code( in \d+s)?|Sending\.\.\./));
const advanceTime = (ms: number) => act(() => jest.advanceTimersByTime(ms));

describe('VerifyOtpScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    useOnboardingStore.setState({
      role: null,
      phone: '01012345678',
      verificationId: null,
      vehicle: null,
      licenseNumber: null,
      onboardingStatus: null,
      documentsStatus: null,
    });
    useAuthStore.setState({
      isAuthenticated: false,
      role: null,
      userId: null,
      isOnboarding: false,
      isLoading: false,
      error: null,
      tokenExpiry: null,
      isRefreshing: false,
      lastAttemptAt: 0,
    });
    appStateHandlers.length = 0;
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _event: string,
      handler: (state: string) => void,
    ) => {
      appStateHandlers.push(handler);
      return { remove: jest.fn() };
    }) as any);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shows the destination phone', () => {
    renderScreen();

    expect(screen.getByText('Sent to +20 01012345678')).toBeOnTheScreen();
  });

  describe('verify', () => {
    it('ignores presses until six digits are entered', async () => {
      renderScreen();
      enterOtp('12345');
      pressVerify();
      await waitFor(() => {});

      expect(mockedAuthApi.verifyOtp).not.toHaveBeenCalled();
    });

    it.each([
      ['PENDING_DOCUMENTS'],
      ['UNDER_REVIEW'],
      ['REJECTED'],
      ['PENDING'],
    ])('routes a driver with status %s into onboarding', async (status) => {
      mockedAuthApi.verifyOtp.mockResolvedValue(
        registeredResult({ user: testUser(UserRole.DRIVER, status) }),
      );
      renderScreen();
      enterOtp();
      pressVerify();

      await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(auth)/vehicle-info'));

      expect(mockedSecureStorage.saveTokens).toHaveBeenCalledWith('access-token', 'refresh-token');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().role).toBe('DRIVER');
      expect(useAuthStore.getState().isOnboarding).toBe(true);
    });

    it('routes an approved driver straight to the driver home', async () => {
      mockedAuthApi.verifyOtp.mockResolvedValue(
        registeredResult({ user: testUser(UserRole.DRIVER) }),
      );
      renderScreen();
      enterOtp();
      pressVerify();

      await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(driver)/(tabs)/home'));

      expect(useAuthStore.getState().isOnboarding).toBe(false);
    });

    it('routes a registered rider to the rider home', async () => {
      mockedAuthApi.verifyOtp.mockResolvedValue(registeredResult());
      renderScreen();
      enterOtp();
      pressVerify();

      await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(rider)/(tabs)/home'));

      expect(useAuthStore.getState().role).toBe('RIDER');
      expect(useAuthStore.getState().isOnboarding).toBe(false);
    });

    it('treats a registered session without a user as a rider', async () => {
      mockedAuthApi.verifyOtp.mockResolvedValue(
        registeredResult({ user: undefined }),
      );
      renderScreen();
      enterOtp();
      pressVerify();

      await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(rider)/(tabs)/home'));

      expect(useAuthStore.getState().role).toBeNull();
    });

    it('sends a new user to basic info without persisting tokens', async () => {
      mockedAuthApi.verifyOtp.mockResolvedValue({ success: true, isRegistered: false });
      renderScreen();
      enterOtp();
      pressVerify();

      await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(auth)/basic-info'));

      expect(mockedSecureStorage.saveTokens).not.toHaveBeenCalled();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('treats a registered response missing tokens as a new user', async () => {
      mockedAuthApi.verifyOtp.mockResolvedValue({
        success: true,
        isRegistered: true,
        user: testUser(UserRole.RIDER),
      });
      renderScreen();
      enterOtp();
      pressVerify();

      await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(auth)/basic-info'));

      expect(mockedSecureStorage.saveTokens).not.toHaveBeenCalled();
    });

    it('shows a loading state while verifying', async () => {
      let resolveVerify: (value: PhoneVerificationResult) => void = () => {};
      mockedAuthApi.verifyOtp.mockReturnValue(
        new Promise((resolve) => {
          resolveVerify = resolve;
        }),
      );
      renderScreen();
      enterOtp();
      pressVerify();

      await waitFor(() => expect(screen.getByText('Verifying...')).toBeOnTheScreen());

      resolveVerify({ success: true, isRegistered: false });
      await waitFor(() => expect(router.replace).toHaveBeenCalled());
    });

    it('shows the API error message on a rejected code', async () => {
      mockedAuthApi.verifyOtp.mockRejectedValue(new ApiError(400, 'Wrong code'));
      renderScreen();
      enterOtp();
      pressVerify();

      await waitFor(() => expect(screen.getByText('Wrong code')).toBeOnTheScreen());
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('falls back to a generic message for non-API failures', async () => {
      mockedAuthApi.verifyOtp.mockRejectedValue(new Error('network down'));
      renderScreen();
      enterOtp();
      pressVerify();

      await waitFor(() =>
        expect(screen.getByText('Invalid code or connection error.')).toBeOnTheScreen(),
      );
    });

    it('reports a missing phone from the onboarding store', async () => {
      useOnboardingStore.setState({ phone: '' });
      renderScreen();
      enterOtp();
      pressVerify();

      await waitFor(() =>
        expect(screen.getByText('Invalid code or connection error.')).toBeOnTheScreen(),
      );
      expect(mockedAuthApi.verifyOtp).not.toHaveBeenCalled();
    });

    it('clears the error as soon as the code changes', async () => {
      mockedAuthApi.verifyOtp.mockRejectedValue(new ApiError(400, 'Wrong code'));
      renderScreen();
      enterOtp();
      pressVerify();
      await waitFor(() => expect(screen.getByText('Wrong code')).toBeOnTheScreen());

      enterOtp('123456');

      expect(screen.queryByText('Wrong code')).toBeNull();
    });

    it('locks verification after five failed attempts and unblocks after the cooldown', async () => {
      mockedAuthApi.verifyOtp.mockRejectedValue(new ApiError(400, 'Wrong code'));
      renderScreen();
      enterOtp();

      for (let i = 0; i < 5; i++) {
        pressVerify();
        await waitFor(() => expect(mockedAuthApi.verifyOtp).toHaveBeenCalledTimes(i + 1));
      }
      await waitFor(() =>
        expect(
          screen.getByText('Too many failed attempts. Please wait 60 seconds.'),
        ).toBeOnTheScreen(),
      );

      pressVerify();
      await waitFor(() =>
        expect(screen.getByText(/Too many attempts\. Try again in \d+s/)).toBeOnTheScreen(),
      );
      expect(mockedAuthApi.verifyOtp).toHaveBeenCalledTimes(5);

      advanceTime(61_000);
      mockedAuthApi.verifyOtp.mockResolvedValue({ success: true, isRegistered: false });
      pressVerify();

      await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(auth)/basic-info'));
    });
  });

  describe('resend', () => {
    it('starts in cooldown and cannot resend early', async () => {
      renderScreen();
      expect(screen.getByText('Resend Code in 60s')).toBeOnTheScreen();

      pressResend();
      await waitFor(() => {});

      expect(mockedAuthApi.requestOtp).not.toHaveBeenCalled();
    });

    it('enables resending when the countdown reaches zero and restarts it', async () => {
      useOnboardingStore.setState({ phone: '+201012345678' });
      mockedAuthApi.requestOtp.mockResolvedValue(undefined);
      renderScreen();
      advanceTime(60_000);

      expect(screen.getByText('Resend Code')).toBeOnTheScreen();
      pressResend();

      await waitFor(() => expect(mockedAuthApi.requestOtp).toHaveBeenCalledWith('+201012345678'));
      expect(screen.getByText('Resend Code in 60s')).toBeOnTheScreen();
    });

    it('ignores a second press while a resend is in flight', async () => {
      mockedAuthApi.requestOtp.mockReturnValue(new Promise<void>(() => {}));
      renderScreen();
      advanceTime(60_000);

      pressResend();
      pressResend();
      await waitFor(() => expect(mockedAuthApi.requestOtp).toHaveBeenCalledTimes(1));
    });

    it('adopts the retry hint from a 429 resend failure', async () => {
      mockedAuthApi.requestOtp.mockRejectedValue(
        new ApiError(429, 'Too many requests', { retryAfterSeconds: 15 }),
      );
      renderScreen();
      advanceTime(60_000);
      pressResend();

      await waitFor(() => expect(screen.getByText('Resend Code in 15s')).toBeOnTheScreen());
    });

    it('shows the API error message for other resend failures', async () => {
      mockedAuthApi.requestOtp.mockRejectedValue(new ApiError(500, 'SMS provider down'));
      renderScreen();
      advanceTime(60_000);
      pressResend();

      await waitFor(() => expect(screen.getByText('SMS provider down')).toBeOnTheScreen());
    });

    it('falls back to a generic message for non-API resend failures', async () => {
      mockedAuthApi.requestOtp.mockRejectedValue(new Error('network down'));
      renderScreen();
      advanceTime(60_000);
      pressResend();

      await waitFor(() =>
        expect(screen.getByText('Failed to resend code')).toBeOnTheScreen(),
      );
    });
  });

  describe('session expiry', () => {
    it('marks the session expired after two minutes', async () => {
      renderScreen();
      advanceTime(120_000);

      expect(screen.getByText('OTP expired. Request a new one.')).toBeOnTheScreen();
    });

    it('expires a session older than five minutes when the app returns to the foreground', async () => {
      renderScreen();
      advanceTime(301_000);

      act(() => {
        appStateHandlers.forEach((handler) => handler('active'));
      });

      expect(screen.getByText('Your code has expired.')).toBeOnTheScreen();
      expect(screen.getByText('OTP expired. Request a new one.')).toBeOnTheScreen();
    });

    it('does not expire a fresh session when the app is activated', async () => {
      renderScreen();

      act(() => {
        appStateHandlers.forEach((handler) => handler('active'));
      });

      expect(screen.queryByText('Your code has expired.')).toBeNull();
      expect(screen.queryByText('OTP expired. Request a new one.')).toBeNull();
    });

    it('ignores non-activation state changes', async () => {
      renderScreen();

      act(() => {
        appStateHandlers.forEach((handler) => handler('background'));
      });

      expect(screen.queryByText('Your code has expired.')).toBeNull();
    });

    it('passes through a phone that already carries the country code', async () => {
      useOnboardingStore.setState({ phone: '+201012345678' });
      mockedAuthApi.verifyOtp.mockResolvedValue(
        registeredResult({ user: testUser(UserRole.RIDER) }),
      );
      renderScreen();
      expect(screen.getByText('Sent to +20 +201012345678')).toBeOnTheScreen();
      enterOtp();
      pressVerify();

      await waitFor(() =>
        expect(mockedAuthApi.verifyOtp).toHaveBeenCalledWith('+201012345678', '123456'),
      );
    });
  });
});
