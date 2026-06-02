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

To target a different phone, update `IOS_PHYSICAL_DEVICE_UDID` in `src/lib/constants.ts` and `scripts/run-ios-device.sh`.

### iOS — simulator

```bash
pnpm ios:sim
```

Uses **iPhone 17 Pro Max** simulator (not your physical device).

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

Future (not wired yet): Maestro smoke tests (manual or nightly), Fastlane TestFlight (manual + secrets).

### Sentry (optional)

1. Create a project at [sentry.io](https://sentry.io)
2. Copy `src/config/env.local.example.ts` → `src/config/env.local.ts`
3. Paste your DSN into `SENTRY_DSN`

Without a DSN, the app runs normally — crashes are only logged locally in dev.
