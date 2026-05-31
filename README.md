# LifeMap

Personal life timeline app — remember where you were, privately.

## Stack

- **React Native 0.84** (bare workflow, New Architecture)
- **NativeWind v4** + Tailwind CSS v3
- **React Native Reusables** + Lucide icons
- **React Navigation** (custom bottom tabs)

## Getting started

```bash
cd LifeMap
npm install

# iOS (requires full Xcode, not just Command Line Tools)
cd ios && bundle exec pod install && cd ..
npm run ios

# Android
npm run android
```

## Project structure

```
src/
  components/     # UI + CustomTabBar
  navigation/     # RootNavigator
  screens/        # Home, Map, Timeline, Settings, Privacy onboarding
  stores/         # Zustand app state
  lib/            # utils, constants
```

## Roadmap

- **Phase 1:** SQLCipher + Drizzle (`moments` table from day 1)
- **Phase 2:** TransistorSoft background location
- **Phase 3:** Map + timeline MVP
- **Phase 4:** Photos via `moments`
- **Phase 5:** 30-day dogfood gate → TestFlight

## Privacy

LifeMap stores data locally on device. Privacy onboarding explains encryption and tracking before first use.
