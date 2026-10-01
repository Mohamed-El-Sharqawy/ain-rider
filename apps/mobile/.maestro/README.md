# Mobile E2E - Maestro

Maestro flows for the ain-rider rider app. Tool decision (Maestro over Detox):
[`docs/research/mobile-e2e-tool.md`](../../../docs/research/mobile-e2e-tool.md) (issue #5).

## Layout

```text
.maestro/
  flows/                      # top-level flows (what `maestro test` runs)
    smoke-app-launch.yml      #   [smoke] app launches, welcome renders
    smoke-phone-validation.yml#   [smoke] invalid phone rejected client-side
    auth-login-rider.yml      #   [full]   registered rider phone+OTP login
    auth-signup-rider.yml     #   [full]   new rider signup (unique phone per run)
    auth-invalid-otp.yml      #   [full]   wrong OTP -> backend error shown
    ride-request.yml          #   [full]   request ride, wait for match
    ride-trip-rate.yml        #   [full]   match -> in progress -> completed -> rate
  subflows/                   # only runs when called via runFlow
    launch-to-phone.yaml      #   fresh launch -> SKIP -> Book Rides -> phone screen
    login-rider.yaml          #   phone + OTP entry (defaults for PHONE/OTP live here)
    request-ride.yaml         #   home -> plan trip -> confirm -> "Finding Your Ride"
```

Selectors are visible text (RN `Text`) or input placeholders. Icon-only controls
get `testID`s in app code (`rate-star-1..5` on `app/(rider)/trip/rate.tsx`);
prefer adding a `testID` over coordinate taps when new flows need one.

Known divergence: rider registration completes into rider home directly - the
root layout (`app/_layout.tsx` routing effect) force-redirects authenticated
riders out of `(auth)`, so the documents screen that `basic-info.tsx` pushes to
is not reachable in the rider signup path. The signup flow asserts the actual
behavior.

## Environment parameters

| Var   | Default     | Meaning                                                        |
| ----- | ----------- | -------------------------------------------------------------- |
| `PHONE` | `1001234567` | local part of the registered dev rider's Egyptian mobile (`+20` is prefixed by the app) |
| `OTP`   | `123456`     | auth-service console provider's `TEST_OTP_CODE` default        |

Override with `maestro test -e PHONE=... -e OTP=...`. Defaults are defined in
`subflows/login-rider.yaml` (and per-flow for `OTP`) using Maestro's
`${VAR || "default"}` idiom. Do not redefine `PHONE`/`OTP` in parent flows:
per Maestro's parameter priority rules, a subflow's own `env` overrides
same-named parent values, so overrides only work via the CLI.

## Tags

- `smoke` - backend-independent, runs on EAS on every PR (`e2e-test-android.yml`
  uses `include_tags: smoke`). Flow entry is client-side only.
- `full` - requires the dev backend; run locally. `auth`/`ride` subdivide them.

## Prerequisites per flow

| Flow                    | Backend | Seeded data | Other                                        |
| ----------------------- | ------- | ----------- | -------------------------------------------- |
| smoke-app-launch        | no      | no          | -                                            |
| smoke-phone-validation  | no      | no          | -                                            |
| auth-login-rider        | yes     | registered RIDER for `PHONE` (onboarding complete) | console OTP provider |
| auth-signup-rider       | yes     | none (unique phone + email generated per run) | console OTP provider |
| auth-invalid-otp        | yes     | none (unique phone per run) | console OTP provider; do not hammer (OTP circuit breaker) |
| ride-request            | yes     | registered rider + an ONLINE driver near the pickup point | emulator GPS near Cairo; location permission granted |
| ride-trip-rate          | yes     | same as ride-request, plus a driver that starts and completes the trip | driver actions drive the `trip_started`/`trip_completed` websocket events |

Note on backend reachability: `EXPO_PUBLIC_*` vars are baked in at build time.
For an Android emulator pointing at a dev backend on the host, build with
`EXPO_PUBLIC_API_URL=http://10.0.2.2:3000` and `EXPO_PUBLIC_WS_URL=ws://10.0.2.2:3001/ws`
(see `apps/mobile/.env.example`). The default registered rider `1001234567`
must exist in your dev database; create it once via the signup flow or a seed
script, then reuse for login/ride flows.

## Running locally

Prereqs: JDK 17+, Maestro CLI ([install](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli)),
an Android emulator (or iOS simulator) with the app installed.

```bash
# 1. app on the emulator - either a dev client:
pnpm -C apps/mobile android          # expo run:android (debug)
# or an EAS e2e build (closer to CI):
eas build --platform android --profile e2e-test

# 2. (full flows) start the dev backend, auth-service with:
#    OTP_PROVIDER=console TEST_OTP_CODE=123456
# and bake EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 into the build.
# Seed the rider + put a driver online near the pickup point.

# 3. (ride flows) put the emulator near Cairo like the seeded driver:
adb emu geo fix 30.0444 31.2357

# 4. run
cd apps/mobile
maestro test --include-tags smoke .maestro/flows                  # smoke only
maestro test .maestro/flows                                       # everything (needs backend)
maestro test -e PHONE=1001234567 -e OTP=123456 .maestro/flows/auth-login-rider.yml
```

## Flakiness / lockout design notes

- Every flow starts with `launchApp: clearState: true` (fresh app state), so
  login/verify attempt counters reset per run - a failed run cannot lock the
  next run out for the 60s window (login and verify lockouts trigger after 5
  failed attempts, see `app/(auth)/login.tsx` / `verify-otp.tsx`).
- Signup and invalid-OTP flows generate a UNIQUE phone number per run
  (`evalScript`), avoiding OTP request rate limits (HTTP 429 with
  `retryAfterSeconds`) and duplicate-account errors.
- OTP resend is not exercised (60s cooldown + 429 adoption would slow the
  suite); it is covered by unit tests (PR #25).
- `extendedWaitUntil` timeouts are generous upper bounds for websocket-driven
  phases (match/arrival/completion); they resolve as soon as the event lands.

## CI (EAS Workflows)

`.eas/workflows/e2e-test-android.yml` builds the `e2e-test` APK and runs the
`smoke`-tagged flows with the first-class `type: maestro` job on every PR:
`build -> maestro_test (nested-virtualization Linux worker, screen recording,
1 retry)`. Manually: `eas workflow:run .eas/workflows/e2e-test-android.yml`.

Decision (recorded in ticket #16 PR): EAS Workflows is the CI path; Maestro is
NOT wired into GitHub Actions yet because the repo has no GH Actions CI at all
today and an emulator-booting workflow is heavy cold-start infrastructure to
own. The research doc keeps the `ubuntu-latest` + KVM recipe for when self-hosted
GH CI lands. The `full` flows stay local/dev-backend-only for now: EAS builds
have no route to a dev backend (no public URL), and the trip flows need a
controllable driver side.

## iOS

Flows are platform-neutral (text/testID selectors) except the Android location
dialog text ("While using the app", guarded so its absence never fails a flow).
Add `.eas/workflows/e2e-test-ios.yml` mirroring the Android one when iOS
coverage is wanted; `launchApp: permissions: location: allow` can pre-grant on
iOS.
