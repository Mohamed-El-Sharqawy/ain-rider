# Quickstart - Onboarding Auth Check

## Testing the Auth Flow

1. Ensure the MSW mocks are active or the local backend gateway is running.
2. Launch the app `npx expo start`.
3. The app mounts and shows the splash screen.
4. **Without tokens**: The user is seamlessly redirected to `/(auth)/login`.
5. **Login successfully**: Tokens (`accessToken`, `refreshToken`) and fallback `userRole` are securely persisted.
6. **Token Persistence**: Reload the app (`r` shortcut in Metro). The app checks Secure Store, decodes the JWT role, and seamlessly redirects to `/(rider)/home` (or driver home).
