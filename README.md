# LifeMap

Personal life timeline app — remember where you were, privately.

## Stack

- **React Native 0.84** (bare workflow, New Architecture)
- **NativeWind v4** + Tailwind CSS v3 (light + dark via system appearance)
- **React Native Reusables** + Lucide icons
- **React Navigation** (custom bottom tabs)
- **pnpm** package manager
- **GitHub Actions** CI (lint, typecheck, test)
- **Sentry** (optional — crash reporting when DSN configured)

## Getting started

Requires [pnpm](https://pnpm.io/installation) (`corepack enable` or `npm install -g pnpm`).

```bash
cd LifeMap
pnpm install

# iOS (requires full Xcode, not just Command Line Tools)
pnpm pod-install
pnpm start
pnpm ios              # physical iPhone (default)
```

### iOS — physical device (default)

Your iPhone appears in Xcode as **SandY Earth 🌎** (model can be iPhone 17 Pro Max — the name is whatever you set in Settings → General → About).

1. Connect your iPhone via USB and trust this Mac.
2. On the iPhone: **Settings → Privacy & Security → Developer Mode** → on (restart if prompted).
3. In Xcode → open `ios/LifeMap.xcworkspace` → **Signing & Capabilities** → select your Apple Developer team.
4. Metro in one terminal (`pnpm start`), then:

```bash
pnpm ios
# or explicitly:
pnpm ios:device
```

To target a different phone, set `IOS_DEVICE_UDID` when running `pnpm ios` (see `scripts/run-ios-device.sh`).

### iOS — simulator

```bash
pnpm ios:sim
```

Uses **iPhone 17 Pro Max** simulator (not your physical device).

### iOS — TestFlight QA (Release, no Metro)

For real QA — not the Debug + Metro dev build. Uses **Fastlane** → **TestFlight Internal Testing**.

```bash
bundle install
cp ios/fastlane/.env.example ios/fastlane/.env   # App Store Connect API key
pnpm ios:beta                                     # build Release + upload
```

Full setup: [docs/ios-testflight.md](docs/ios-testflight.md)

| Command | What it does |
|---------|----------------|
| `pnpm ios` | Debug dev build (Metro required) |
| `pnpm ios:release` | Release `.ipa` only, no upload |
| `pnpm ios:beta` | Release + TestFlight upload |

### Android

Android tooling is set up via Homebrew (`android-commandlinetools`, `android-platform-tools`). Add this to your `~/.zshrc` so every terminal session can find the SDK:

```bash
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator
```

Or source the project helper before Android commands:

```bash
source scripts/android-env.sh
```

**JDK 17** is required (Gradle 9 breaks on JDK 25). A portable copy lives in `.jdk/` (gitignored); `android/gradle.properties` points Gradle at it.

**First-time SDK install** (already done on this machine — keep for reference):

```bash
brew install --cask android-commandlinetools android-platform-tools
source scripts/android-env.sh
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0" "ndk;27.1.12297006" "cmake;3.22.1"
sdkmanager "emulator" "system-images;android-36;google_apis;arm64-v8a"
echo "no" | avdmanager create avd -n LifeMap_Emulator -k "system-images;android-36;google_apis;arm64-v8a" -d pixel_7_pro --force
# Or: pnpm android:create-emulator
```

**Run on emulator:**

```bash
pnpm start                    # Metro in one terminal
pnpm android:emulator         # Pixel 7 Pro AVD (LifeMap_Emulator) — keep terminal open
pnpm android                  # build + install when emulator shows home screen
pnpm android:build            # compile APK only (no device needed)
```

**Physical Android device:** enable **Developer options → USB debugging**, connect via USB, then `pnpm android`.

Verified: `assembleDebug` builds successfully (`android/app/build/outputs/apk/debug/app-debug.apk`).

### Light / dark mode

The app follows the **system appearance** (Settings → Display on iOS, or simulator **Features → Toggle Appearance**). Toggle dark mode on your iPhone 16 Pro Max or simulator to verify both themes.

## Project structure

```
src/
  components/     # UI + CustomTabBar
  hooks/          # useThemeColors
  navigation/     # RootNavigator
  screens/        # Home, Map, Timeline, Settings, Privacy onboarding
  stores/         # Zustand app state
  lib/            # utils, constants, theme tokens
```

## Roadmap

- **Phase 1:** SQLCipher + Drizzle (`moments` table from day 1) — done
- **Phase 2:** TransistorSoft background location — done (Debug builds; license before store release)
- **Phase 3:** Map day view, timeline, On this day home — done (`react-native-maps`; rebuild native after pull)
- **Phase 3:** Map + timeline MVP
- **Phase 4:** Photos via `moments`
- **Phase 5:** 30-day dogfood gate → TestFlight

## Privacy

LifeMap stores data locally on device. Privacy onboarding explains encryption and tracking before first use.

## Development

```bash
pnpm lint          # ESLint
pnpm typecheck     # TypeScript
pnpm test          # Jest
```

### CI (automatic vs manual)

| Workflow | Trigger | What it checks | Why |
|----------|---------|----------------|-----|
| **CI** | Every push/PR to `main` | lint, typecheck, test | Fast (~2 min), free — catches broken TS/tests before merge |
| **Mobile build (manual)** | Actions → Run workflow button | Android APK and/or iOS simulator compile | Slower, uses Android SDK + macOS minutes — run before releases or after native changes |

**Run mobile builds manually:** GitHub → **Actions** → **Mobile build (manual)** → **Run workflow** → pick `android`, `ios`, or `both`.

Android job uploads `app-debug.apk` as a downloadable artifact. iOS job verifies Xcode compiles with `CODE_SIGNING_ALLOWED=NO` (no Apple certificates needed).

**iOS TestFlight (manual):** Actions → **iOS TestFlight (manual)** — needs App Store Connect API secrets ([docs/ios-testflight.md](docs/ios-testflight.md)). Easiest path: `pnpm ios:beta` on your Mac first.

Future: Android Play internal + Fastlane `supply`.

### Detox (E2E)

Device tests live under `e2e/`. They use accessibility labels (not Maestro-style test IDs).

**Prerequisites**

- iOS: Xcode + iOS Simulator (`iPhone 17 Pro` in `.detoxrc.js`; change if needed)
- **`applesimutils`** (Detox uses this to control the simulator and pre-grant permissions):

  ```bash
  brew tap wix/brew
  brew trust wix/brew
  brew install applesimutils
  ```

  Verify: `applesimutils --version`
- Android: AVD `LifeMap_Emulator` (`pnpm android:create-emulator` once)
- **One-time iOS Detox setup** (builds `Detox.framework` under `~/Library/Detox/`):

  ```bash
  pnpm e2e:setup:ios
  ```

  Run this after `pnpm install` if tests fail with `Detox.framework could not be found`, or after upgrading Xcode.
- Check everything: `pnpm e2e:check:ios`
- Metro is started automatically by Detox; for manual debugging run `pnpm start` in another terminal

**Run locally**

```bash
# iOS — setup once, build app once, then test
pnpm e2e:setup:ios
pnpm e2e:build:ios
pnpm e2e:test:ios

# Faster iteration — skip Detox delete+reinstall at session start (app already on simulator)
pnpm e2e:test:ios:reuse

# Android — start emulator first (pnpm android:emulator), then:
pnpm e2e:build:android
pnpm e2e:test:android
```

CI does not run Detox yet (simulator/emulator cost). Unit tests still run via `pnpm test`.

**Run one file from the editor (Jest Runner extension)**

Install [Jest Runner](https://marketplace.visualstudio.com/items?itemName=firsttris.vscode-jest-runner). Workspace settings route the **Run | Debug** CodeLens in `e2e/` through `scripts/e2e-run-ios.sh` → `detox test --configuration ios.sim.debug`. Do not set `jestrunner.configPath` — Detox already passes `e2e/jest.config.js`; a duplicate `-c` breaks Jest with `argv.config.match is not a function`.

Alternative: **Terminal → Run Task → Detox iOS: run current e2e file** (with an `e2e/*.test.js` file open).

Run from the **project root** (`LifeMap/`), not from `e2e/`:

```bash
pnpm e2e:run:ios -- e2e/saved-places.test.js
```

For unit tests in `__tests__/`, use the terminal: `pnpm test` (not the e2e Run button).

### Sentry (optional)

1. Create a project at [sentry.io](https://sentry.io)
2. Copy `src/config/env.local.example.ts` → `src/config/env.local.ts`
3. Paste your DSN into `SENTRY_DSN`

Without a DSN, the app runs normally — crashes are only logged locally in dev.
