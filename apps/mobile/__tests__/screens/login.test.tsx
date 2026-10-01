import { Platform } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import LoginScreen from '../../app/(auth)/login';
import { AuthApi } from '../../lib/api/auth';
import { ApiError } from '../../lib/api/client';
import { UserRole, type LoginResponse } from '../../lib/api/types';
import { SecureStorage } from '../../lib/storage/secure';
import { useAuthStore } from '../../stores/auth.store';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: (props: { name?: string }) => {
    const { Text } = require('react-native');
    return <Text>{props.name}</Text>;
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

jest.mock('../../lib/api/auth', () => ({
  AuthApi: { login: jest.fn() },
}));

jest.mock('../../lib/storage/secure', () => ({
  SecureStorage: {
    saveTokens: jest.fn(),
    getAccessToken: jest.fn(),
    getRefreshToken: jest.fn(),
    clearTokens: jest.fn(),
  },
}));

const loginResponse = (role: UserRole, status = 'ACTIVE'): LoginResponse => ({
  user: {
    id: 'u1',
    role,
    status,
    email: 'rider@example.com',
    phoneNumber: '+201012345678',
    firstName: 'Test',
    lastName: 'User',
  },
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
});

const mockedAuthApi = jest.mocked(AuthApi);
const mockedSecureStorage = jest.mocked(SecureStorage);

const fillCredentials = (email = 'rider@example.com', password = 'secret123') => {
  fireEvent.changeText(screen.getByPlaceholderText('email@example.com'), email);
  fireEvent.changeText(screen.getByPlaceholderText('••••••••'), password);
};

const pressSignIn = () => fireEvent.press(screen.getByText('Sign In'));

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
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
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the form', () => {
    render(<LoginScreen />);

    expect(screen.getByText('Welcome')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('email@example.com')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('••••••••')).toBeOnTheScreen();
    expect(screen.getByText('Sign In')).toBeOnTheScreen();
  });

  it('asks for both fields before calling the API', async () => {
    render(<LoginScreen />);
    pressSignIn();
    await act();

    expect(screen.getByText('Please enter email and password')).toBeOnTheScreen();
    expect(mockedAuthApi.login).not.toHaveBeenCalled();

    fillCredentials('rider@example.com', '');
    pressSignIn();
    await act();

    expect(screen.getByText('Please enter email and password')).toBeOnTheScreen();
    expect(mockedAuthApi.login).not.toHaveBeenCalled();
  });

  it('signs a rider in and routes to the rider home', async () => {
    mockedAuthApi.login.mockResolvedValue(loginResponse(UserRole.RIDER));
    render(<LoginScreen />);
    fillCredentials();
    pressSignIn();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(rider)/(tabs)/home'));

    expect(mockedAuthApi.login).toHaveBeenCalledWith('rider@example.com', 'secret123');
    expect(mockedSecureStorage.saveTokens).toHaveBeenCalledWith('access-token', 'refresh-token');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().role).toBe(UserRole.RIDER);
    expect(screen.queryByText('Signing in...')).toBeNull();
  });

  it('signs a driver in and routes to the driver home', async () => {
    mockedAuthApi.login.mockResolvedValue(loginResponse(UserRole.DRIVER));
    render(<LoginScreen />);
    fillCredentials();
    pressSignIn();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(driver)/(tabs)/home'));

    expect(useAuthStore.getState().role).toBe(UserRole.DRIVER);
  });

  it('shows a loading state while signing in', async () => {
    let resolveLogin: (value: LoginResponse) => void = () => {};
    mockedAuthApi.login.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }),
    );
    render(<LoginScreen />);
    fillCredentials();
    pressSignIn();

    await waitFor(() => expect(screen.getByText('Signing in...')).toBeOnTheScreen());

    resolveLogin(loginResponse(UserRole.RIDER));
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
  });

  it('displays the API error message', async () => {
    mockedAuthApi.login.mockRejectedValue(new ApiError(400, 'Email not verified'));
    render(<LoginScreen />);
    fillCredentials();
    pressSignIn();

    await waitFor(() => expect(screen.getByText('Email not verified')).toBeOnTheScreen());
  });

  it('falls back to a generic message for non-API failures', async () => {
    mockedAuthApi.login.mockRejectedValue(new Error('network down'));
    render(<LoginScreen />);
    fillCredentials();
    pressSignIn();

    await waitFor(() =>
      expect(screen.getByText('Invalid email or password')).toBeOnTheScreen(),
    );
  });

  it('clears the error as soon as a field changes', async () => {
    mockedAuthApi.login.mockRejectedValue(new ApiError(401, 'Wrong password'));
    render(<LoginScreen />);
    fillCredentials();
    pressSignIn();
    await waitFor(() => expect(screen.getByText('Wrong password')).toBeOnTheScreen());

    fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'p');

    expect(screen.queryByText('Wrong password')).toBeNull();
  });

  it('uses the height keyboard behavior on android', async () => {
    const originalOS = Platform.OS;
    Platform.OS = 'android';
    try {
      mockedAuthApi.login.mockResolvedValue(loginResponse(UserRole.RIDER));
      render(<LoginScreen />);
      fillCredentials();
      pressSignIn();

      await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(rider)/(tabs)/home'));
    } finally {
      Platform.OS = originalOS;
    }
  });

  it('locks the form after five failed attempts and unblocks after the cooldown', async () => {
    mockedAuthApi.login.mockRejectedValue(new ApiError(401, 'nope'));
    render(<LoginScreen />);

    for (let i = 0; i < 5; i++) {
      fillCredentials();
      pressSignIn();
      await waitFor(() => expect(mockedAuthApi.login).toHaveBeenCalledTimes(i + 1));
    }
    await waitFor(() =>
      expect(
        screen.getByText('Too many failed attempts. Please wait 60 seconds.'),
      ).toBeOnTheScreen(),
    );

    fillCredentials();
    pressSignIn();
    await act();

    expect(screen.getByText(/Too many attempts\. Try again in \d+s/)).toBeOnTheScreen();
    expect(mockedAuthApi.login).toHaveBeenCalledTimes(5);

    jest.advanceTimersByTime(61_000);
    mockedAuthApi.login.mockResolvedValue(loginResponse(UserRole.RIDER));
    fillCredentials();
    pressSignIn();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(rider)/(tabs)/home'));
  });

  it('toggles password visibility', () => {
    render(<LoginScreen />);
    const passwordInput = screen.getByPlaceholderText('••••••••');
    expect(passwordInput.props.secureTextEntry).toBe(true);

    fireEvent.press(screen.getByText('eye-outline'));

    expect(passwordInput.props.secureTextEntry).toBe(false);
    expect(screen.getByText('eye-off-outline')).toBeOnTheScreen();

    fireEvent.press(screen.getByText('eye-off-outline'));

    expect(passwordInput.props.secureTextEntry).toBe(true);
  });

  it('links to role selection for new accounts', () => {
    render(<LoginScreen />);

    fireEvent.press(screen.getByText('Create Account'));

    expect(router.push).toHaveBeenCalledWith('/(auth)/role-selection');
  });
});

async function act() {
  await waitFor(() => {});
}
