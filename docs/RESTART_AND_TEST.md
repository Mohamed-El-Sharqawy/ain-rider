# Auth Fix - Restart and Test Instructions

## The Problem
JWT tokens were being signed with an explicitly passed secret in the `sign()` options, but the `JwtModule.register()` was configured with a different secret instance. This caused "invalid signature" errors.

## The Fix
Removed explicit `secret` parameter from `sign()` calls in `AuthService`, so both signing and verification use the same secret from `JwtModule.register()`.

## What Changed
1. **auth-service/src/auth/auth.service.ts**: Removed `secret` parameter from `signAccessToken()` and `signRefreshToken()`
2. **auth-service/src/auth/jwt.strategy.ts**: Added comprehensive logging
3. **auth-service/src/auth/jwt-auth.guard.ts**: Added logging to track guard execution
4. **admin-service/src/auth/admin.guard.ts**: Added logging to track token verification

## How to Test

### Step 1: Restart Services
The services MUST be restarted to pick up the code changes:

```powershell
# Stop the current dev server (Ctrl+C in terminal 4)
# Then restart:
cd d:\Work\ain-rider\backend
pnpm dev
```

### Step 2: Run Test Script
After services are fully started (wait for "Service started" logs):

```powershell
cd d:\Work\ain-rider\backend
node test-auth.mjs
```

### Expected Output
All tests should pass:
- ✅ Login successful
- ✅ /auth/me successful
- ✅ /admin/complaints successful
- ✅ /admin/promos successful

### Step 3: Test in Browser
1. Clear browser cookies completely
2. Navigate to http://localhost:5173
3. Login with admin@ainrider.com / Admin@1234
4. Should redirect to dashboard
5. All pages should load without 401 errors

## If Still Failing
Check the terminal logs for:
- `[AuthService] Signing access token for user:` - should appear during login
- `[JwtStrategy] Initializing with secret:` - should appear once at startup
- `[JwtAuthGuard] canActivate called` - should appear for /auth/me
- `[AdminGuard] canActivate called` - should appear for /admin/* endpoints

If you see "invalid signature", the secret mismatch is still present.
