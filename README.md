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

React Native Android builds require **JDK 17**. If you only have JDK 25 installed, download a portable JDK 17 into `.jdk/` (gitignored):

```bash
mkdir -p .jdk && cd .jdk
curl -L -o jdk17.tar.gz "https://api.adoptium.net/v3/binary/latest/17/ga/mac/aarch64/jdk/hotspot/normal/eclipse?project=jdk"
tar xzf jdk17.tar.gz && rm jdk17.tar.gz
```

`android/gradle.properties` points Gradle at `.jdk/jdk-17.0.19+10/Contents/Home` (adjust the path if your extracted folder name differs).

```bash
npm run android          # build + install on emulator/device
npm run android:build    # assembleDebug only
```

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
