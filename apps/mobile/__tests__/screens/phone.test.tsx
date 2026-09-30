import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import PhoneScreen from '../../app/(auth)/phone';
import { AuthApi } from '../../lib/api/auth';
import { ApiError } from '../../lib/api/client';
import { useOnboardingStore } from '../../stores/onboarding.store';

jest.mock('react-native-keyboard-aware-scroll-view', () => ({
  KeyboardAwareScrollView: require('react-native').ScrollView,
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

jest.mock('../../lib/api/auth', () => ({
  AuthApi: { requestOtp: jest.fn() },
}));

const enterPhone = (digits: string) =>
  fireEvent.changeText(screen.getByPlaceholderText('10 1234 5678'), digits);

const pressNext = () => fireEvent.press(screen.getByText(/Next|Requesting\.\.\.|Wait \d+s/));

const mockedAuthApi = jest.mocked(AuthApi);

describe('PhoneScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useOnboardingStore.setState({
      role: null,
      phone: '',
      verificationId: null,
      vehicle: null,
      licenseNumber: null,
      onboardingStatus: null,
      documentsStatus: null,
    });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts with a disabled next button and no request', async () => {
    render(<PhoneScreen />);
    pressNext();
    await waitFor(() => {});

    expect(screen.getByText('Next')).toBeOnTheScreen();
    expect(mockedAuthApi.requestOtp).not.toHaveBeenCalled();
  });

  it('ignores presses while the number is too short', async () => {
    render(<PhoneScreen />);
    enterPhone('10123');
    pressNext();
    await waitFor(() => {});

    expect(mockedAuthApi.requestOtp).not.toHaveBeenCalled();
  });

  it('normalizes a local number to E.164 and moves on', async () => {
    mockedAuthApi.requestOtp.mockResolvedValue(undefined);
    render(<PhoneScreen />);
    enterPhone('01012345678');
    pressNext();

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/(auth)/verify-otp'));

    expect(mockedAuthApi.requestOtp).toHaveBeenCalledWith('+201012345678');
    expect(useOnboardingStore.getState().phone).toBe('01012345678');
  });

  it('passes through numbers that already carry the country code', async () => {
    mockedAuthApi.requestOtp.mockResolvedValue(undefined);
    render(<PhoneScreen />);
    enterPhone('+201012345678');
    pressNext();

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/(auth)/verify-otp'));

    expect(mockedAuthApi.requestOtp).toHaveBeenCalledWith('+201012345678');
  });

  it('alerts on a number that is not a valid Egyptian mobile', async () => {
    render(<PhoneScreen />);
    enterPhone('0101234567');
    pressNext();
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());

    expect(Alert.alert).toHaveBeenCalledWith(
      'Invalid Phone',
      'Please enter a valid Egyptian phone number (e.g. 010 1234 5678).',
    );
    expect(mockedAuthApi.requestOtp).not.toHaveBeenCalled();
  });

  it('shows a wait time when the request is rate limited', async () => {
    mockedAuthApi.requestOtp.mockRejectedValue(
      new ApiError(429, 'Too many requests', { retryAfterSeconds: 30 }),
    );
    render(<PhoneScreen />);
    enterPhone('01012345678');
    pressNext();

    await waitFor(() =>
      expect(screen.getByText('Too many requests. Please wait 30 seconds.')).toBeOnTheScreen(),
    );

    expect(screen.getByText('Wait 30s')).toBeOnTheScreen();
  });

  it('shows the plain API message for a 429 without a retry hint', async () => {
    mockedAuthApi.requestOtp.mockRejectedValue(new ApiError(429, 'Slow down'));
    render(<PhoneScreen />);
    enterPhone('01012345678');
    pressNext();

    await waitFor(() => expect(screen.getByText('Slow down')).toBeOnTheScreen());
  });

  it('falls back to a generic message for non-API failures', async () => {
    mockedAuthApi.requestOtp.mockRejectedValue(new Error('network down'));
    render(<PhoneScreen />);
    enterPhone('01012345678');
    pressNext();

    await waitFor(() =>
      expect(
        screen.getByText('Failed to request OTP. Please check your connection.'),
      ).toBeOnTheScreen(),
    );
  });

  it('shows a loading state while requesting', async () => {
    let resolveRequest: () => void = () => {};
    mockedAuthApi.requestOtp.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveRequest = resolve;
      }),
    );
    render(<PhoneScreen />);
    enterPhone('01012345678');
    pressNext();

    await waitFor(() => expect(screen.getByText('Requesting...')).toBeOnTheScreen());

    resolveRequest();
    await waitFor(() => expect(router.push).toHaveBeenCalled());
  });

  it('clears the error as soon as the number changes', async () => {
    mockedAuthApi.requestOtp.mockRejectedValue(new Error('network down'));
    render(<PhoneScreen />);
    enterPhone('01012345678');
    pressNext();
    await waitFor(() =>
      expect(
        screen.getByText('Failed to request OTP. Please check your connection.'),
      ).toBeOnTheScreen(),
    );

    enterPhone('0101234567');

    expect(
      screen.queryByText('Failed to request OTP. Please check your connection.'),
    ).toBeNull();
  });
});
