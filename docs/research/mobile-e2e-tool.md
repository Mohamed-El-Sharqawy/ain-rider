# Mobile E2E Tool: Maestro vs Detox

Research ticket: [#5 "Research: Maestro vs Detox for mobile e2e"](https://github.com/Mohamed-El-Sharqawy/ain-rider/issues/5)
Date: 2026-09-30. Researched against primary sources (official docs, GitHub repos, Expo changelog).

## Recommendation

**Adopt Maestro.** For this project (Expo SDK 54 / RN 0.81, bare Expo with CNG and no committed native dirs, pnpm monorepo, solo dev, no CI yet), Maestro wins on every axis that matters to us, and the one axis where Detox is theoretically stronger (gray-box synchronization against flakiness) does not outweigh Detox's costs: it requires native project modifications and a Jest runner harness, its Expo integration is explicitly community-maintained, and its release cadence has slowed (no release since 20.51.3 on 2026-05-30, as of 2026-09-30).

Plan of record:

1. Put flows in `apps/mobile/.maestro/` (same level as that workspace's `eas.json`).
2. Add an `e2e-test` build profile to `eas.json` (iOS simulator `.app`, Android `.apk`).
3. Run on EAS Workflows with the first-class `type: maestro` job on PRs; start Android-only if we want to keep costs down, then add iOS.
4. Locally, install the Maestro CLI (Java 17+ required) and run the same flows against an emulator/simulator build.
5. Revisit Detox only if we later need deep app-state synchronization (e.g. deterministic assertions against ongoing animations) that Maestro cannot express — unlikely for a solo dev.

## Context

- Expo SDK 54 = React Native 0.81, React 19.1, New Architecture default (SDK 54 is the last SDK with legacy-arch support; SDK 55+ is new-arch only).
- Project is bare-workflow Expo using Continuous Native Generation (CNG): no `ios`/`android` dirs committed or tested yet.
- `eas.json` present; no GitHub Actions CI yet.
- Ride-hailing rider + driver app: two user roles, maps, background location — plenty of async/network-heavy flows.

## Comparison

| Axis | Maestro | Detox |
| --- | --- | --- |
| Expo SDK 54 / RN 0.81 compat | Works on the built binary at the accessibility layer; zero npm deps, zero native instrumentation. Expo docs officially show Maestro for RN/Expo. | RN 0.77–0.84 "fully compatible with New Architecture" (0.81 in band), but "Expo integration with Detox is entirely a community-driven effort. There is no special support for Expo projects." |
| iOS + Android coverage | Both, single YAML suite. Also works in Expo Go via `openLink` (dev). | Both, but per-platform configurations and per-platform app builds; iOS requires macOS + `applesimutils`; Expo Go untested/unsupported path. |
| GitHub Actions headless CI | Android on `ubuntu-latest` works: GH-hosted Linux runners have KVM/hardware-accelerated Android virtualization (since 2024, down to 2-vCPU runners). iOS still needs a macOS runner (true for both tools). Install = Java 17+ + curl script; `maestro test --format junit` for reports. | Android on Linux runners possible (`--headless`, KVM required — Detox docs note shared runners without KVM cannot run it). iOS needs macOS runner + `applesimutils` via brew. Detox's own CI guide is flagged "This guide is outdated" (Travis-era examples). |
| EAS integration | First-class: EAS Workflows has a native `type: maestro` job that takes an EAS build id + flow paths; EAS Insights tracks Maestro pass/flake/failure trends. Expo's official E2E-on-EAS guide is Maestro-based (the old Detox guide at `docs.expo.dev/build-reference/e2e-tests/` now serves the Maestro guide). | None. Detox's docs for Expo point at Expo's docs, which now document Maestro instead. |
| Flakiness reputation | Black-box with built-in tolerance (auto-waits, retries); community consensus: very low setup cost, occasional flake on heavy async apps — manageable with `testID`-based selectors and explicit waits. | Gray-box synchronization (tracks RN async work, network, animations) — best-in-class determinism in principle, and Detox's stated goal is "zero flakiness". In practice historically sensitive to RN upgrades, Reanimated/animations, and new-RN-version breakage. |
| Maintenance / momentum (2026) | mobile.dev (company-backed). Monthly CLI releases; 2.11.0 shipped 2026-09-29; repo pushed 2026-09-29; ~15.9k stars, Apache-2.0. | Wix-backed but slowed: last release 20.51.3 on 2026-05-30 (no release Jun–Sep 2026 despite commits as recent as 2026-09-07); ~12k stars, MIT; CI docs outdated; RN 0.84 support landed 2026-04-21. |
| Solo-dev ergonomics | YAML flows written in minutes; Maestro Studio records/inspects selectors; standalone CLI binary — no node_modules impact in the pnpm monorepo; tests any `.apk`/`.app` produced by EAS Build. | Jest + `detox.config.js` + per-platform build configs + native modifications (Android Gradle, iOS test targets) + global `detox-cli`; every RN/Expo upgrade risks breaking native test scaffolding. Against CNG: forces committing native dirs or a prebuild step in CI just for tests. |

## Others considered

- **Appium** — mature and universal, but heavy (WebDriver server + client boilerplate), slow, and flakier for a solo dev; nothing in our requirements needs it.
- **Patrol** (Ionic/Flutter toolchain) — Flutter-only; not applicable.
- **Detox Pilot** (AI-agent mode now in Detox docs) — interesting but experimental; not a reason to choose Detox today.

## Expo 54-specific gotchas (Maestro)

- **CNG stays intact.** Maestro requires no native code changes, so we can keep working without `ios`/`android` dirs; tests run against the EAS-built `.apk`/`.app`.
- **appId**: set `appId` in each flow to the app's Android package / iOS bundle id (from `app.json`), not `dev.expo.eastestsexample` from the docs example.
- **Monorepo placement**: Expo's docs assume `.maestro/` at the same level as `eas.json` — for us that is `apps/mobile/.maestro/`, not repo root. EAS Workflows resolve relative to the project root config.
- **Java 17+ required** for the CLI (local + self-hosted CI). GH-hosted `ubuntu-latest` images already ship a suitable JDK; set `JAVA_HOME` if needed.
- **testID over text**: prefer `testID` selectors (`id:` in flows) — stable across translations/copy changes. RN `testID` maps automatically on both platforms.
- **New Architecture / edge-to-edge (Android 16, API 36)**: edge-to-edge is always on in SDK 54 — visual assertions involving system bars/keyboard insets may differ from older screenshots; don't over-assert on pixel-perfect layouts.
- **iOS 26 / Xcode 26 / Liquid Glass**: keep the Maestro CLI current (2.11.0 as of this writing) for newest iOS simulator support; Detox needed specific releases (20.47/20.50.x) for iOS 26 — same class of issue argues for the more actively released tool.
- **EAS build profile** for e2e (from Expo docs):

  ```json
  {
    "build": {
      "e2e-test": {
        "withoutCredentials": true,
        "ios": { "simulator": true },
        "android": { "buildType": "apk" }
      }
    }
  }
  ```

- **EAS Workflow** (per platform), on PRs:

  ```yaml
  name: e2e-test-android
  on:
    pull_request:
      branches: ['*']
  jobs:
    build_android_for_e2e:
      type: build
      params:
        platform: android
        profile: e2e-test
    maestro_test:
      needs: [build_android_for_e2e]
      type: maestro
      params:
        build_id: ${{ needs.build_android_for_e2e.outputs.build_id }}
        flow_path: ['.maestro/home.yml']
  ```

- If we later self-host on GitHub Actions instead: Android on `ubuntu-latest` (KVM available) with `reactivecircus/android-emulator-runner`-style emulator boot + `curl -fsSL "https://get.maestro.mobile.dev" | bash`; iOS on `macos-15` runners. Keep EAS Workflows as the primary path to avoid maintaining runner images at all.

## Evidence (per claim)

- Expo SDK 54 = RN 0.81 / React 19.1; last SDK with legacy arch; Android API 36, edge-to-edge always on; Xcode 26 recommended — [Expo SDK 54 changelog](https://expo.dev/changelog/sdk-54), [Expo SDK ↔ RN version table](https://docs.expo.dev/versions/v54.0.0/).
- Expo's official E2E guide is Maestro on EAS Workflows (`type: maestro` job, `e2e-test` build profile, `.maestro/` next to `eas.json`); old Detox URL now serves it — [Run E2E tests on EAS Workflows with Maestro](https://docs.expo.dev/build-reference/e2e-tests/) (redirects to `eas/workflows/examples/e2e-tests/`).
- EAS Insights tracks Maestro pass/flake trends — [Maestro insights](https://docs.expo.dev/eas-insights/maestro).
- Maestro RN support: zero instrumentation, testID mapping, Expo Go via `openLink`, EAS Workflows compatibility — [Maestro RN docs](https://docs.maestro.dev/get-started/supported-platform/react-native).
- Maestro CLI requires Java 17+, macOS/Windows/Linux installers — [Install Maestro CLI](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli).
- Maestro release cadence: cli-2.5.1 (2026-04-30) → 2.6.0 (05-21) → 2.6.1 (06-12) → 2.7.0 (07-20) → 2.8.0 (07-31) → 2.9.0 (08-26) → 2.10.0 (08-31) → 2.11.0 (09-29) — [releases](https://github.com/mobile-dev-inc/maestro/releases); repo pushed 2026-09-29, ~15.9k stars — [repo](https://github.com/mobile-dev-inc/Maestro).
- Detox RN support band "RN v0.77.x - v0.84.x: Fully compatible with New Architecture"; "Expo integration with Detox is entirely a community-driven effort..." — [Detox Environment Setup](https://wix.github.io/Detox/docs/introduction/environment-setup).
- Detox gray-box / "zero flakiness" design goal — [Detox Getting Started](https://wix.github.io/Detox/docs/introduction/getting-started).
- Detox CI guide flagged outdated; Android CI needs KVM (GitLab shared runners example) — [Detox Preparing for CI](https://wix.github.io/Detox/docs/introduction/preparing-for-ci).
- Detox release cadence 2026: 20.47.0 (01-26), 20.48.0 (03-20), 20.50.0 (03-23), 20.50.2 "RN0.84" (04-21), 20.51.1 (05-03), 20.51.3 (05-30, latest as of 2026-09-30); repo still receives commits (pushed 2026-09-07), ~12k stars — [releases](https://github.com/wix/Detox/releases), [repo](https://github.com/wix/Detox).
- GH-hosted Linux runners support hardware-accelerated Android emulation (KVM), available even on 2-vCPU runners — [GitHub changelog, 2024-04-02](https://github.blog/changelog/2024-04-02-github-actions-hardware-accelerated-android-virtualization-now-available/).

## Sources

- https://docs.expo.dev/build-reference/e2e-tests/ (Run E2E tests on EAS Workflows with Maestro)
- https://docs.expo.dev/eas/workflows/examples/e2e-tests/
- https://docs.expo.dev/eas-insights/maestro/
- https://expo.dev/changelog/sdk-54
- https://docs.expo.dev/versions/v54.0.0/
- https://docs.maestro.dev/ (docs home)
- https://docs.maestro.dev/get-started/supported-platform/react-native
- https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli
- https://github.com/mobile-dev-inc/maestro (+ /releases, repo API metadata)
- https://wix.github.io/Detox/docs/introduction/getting-started
- https://wix.github.io/Detox/docs/introduction/environment-setup
- https://wix.github.io/Detox/docs/introduction/preparing-for-ci
- https://github.com/wix/Detox (+ /releases, repo API metadata)
- https://github.blog/changelog/2024-04-02-github-actions-hardware-accelerated-android-virtualization-now-available/
