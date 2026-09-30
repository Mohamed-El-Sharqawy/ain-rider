# Data Model - Onboarding Auth Check

## Secure Storage Keys
- `accessToken` (String): The JWT used for API authorization.
- `refreshToken` (String): The JWT used to acquire a new access token.
- `userRole` (String): Cached copy of the user's role ("RIDER" or "DRIVER"), used as a fallback.

## JWT Payload Contract
Expected claims inside the `accessToken`:
```typescript
interface TokenPayload {
  sub: string;       // User ID
  email: string;     // User Email
  role: 'RIDER' | 'DRIVER' | 'ADMIN'; // User Role
  type: 'access' | 'refresh';
  exp: number;       // Expiration timestamp (seconds since epoch)
  iat: number;       // Issued at
}
```
