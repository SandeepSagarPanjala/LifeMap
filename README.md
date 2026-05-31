# LifeMap

Personal life timeline app — remember where you were, privately.

## Stack

- **React Native 0.84** (bare workflow, New Architecture)
- **NativeWind v4** + Tailwind CSS v3 (light + dark via system appearance)
- **React Native Reusables** + Lucide icons
- **React Navigation** (custom bottom tabs)

## Getting started

```bash
cd LifeMap
npm install

# iOS (requires full Xcode, not just Command Line Tools)
npm run pod-install
npm start
```

### iOS — simulator

Uses **iPhone 17 Pro Max** (closest match in the current Xcode simulator runtime; your iPhone 16 Pro Max physical device is the best match for real hardware).

```bash
npm run ios:sim
# or
npm run ios
```

### iOS — physical device (iPhone 16 Pro Max)

1. Connect your iPhone via USB and trust the Mac.
2. In Xcode → **Signing & Capabilities**, select your Apple Developer team for the LifeMap target.
3. Ensure Metro is running (`npm start`).
4. Run:

```bash
npm run ios:device
```

If your phone has a different name, update `IOS_PHYSICAL_DEVICE_NAME` in `src/lib/constants.ts` and the `ios:device` script in `package.json`.

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
# Or: npm run android:create-emulator
```

**Run on emulator:**

```bash
npm start                    # Metro in one terminal
npm run android:emulator     # Pixel 7 Pro AVD (LifeMap_Emulator) — keep terminal open
npm run android              # build + install when emulator shows home screen
npm run android:build        # compile APK only (no device needed)
```

**Physical Android device:** enable **Developer options → USB debugging**, connect via USB, then `npm run android`.

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

- **Phase 1:** SQLCipher + Drizzle (`moments` table from day 1)
- **Phase 2:** TransistorSoft background location
- **Phase 3:** Map + timeline MVP
- **Phase 4:** Photos via `moments`
- **Phase 5:** 30-day dogfood gate → TestFlight

## Privacy

LifeMap stores data locally on device. Privacy onboarding explains encryption and tracking before first use.
