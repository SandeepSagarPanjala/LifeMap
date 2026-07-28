import './global.css';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PortalHost } from '@rn-primitives/portal';
import { StatusBar, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BootSplash from 'react-native-bootsplash';

import {
  AppScreenTransition,
  type AppScreenKey,
} from '@/components/navigation/AppScreenTransition';
import { RootNavigator } from '@/navigation/RootNavigator';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { AppBootstrap } from '@/components/AppBootstrap';
import { AppErrorBoundary } from '@/components/error-boundary';
import { ensureDatabaseReady } from '@/location/bootstrap';
import { useAppStore } from '@/stores/app-store';
import { initSentry } from '@/lib/sentry/init-sentry';
import { startWidgetDeepLinkListening } from '@/lib/widget/widget-deep-link';
import * as Sentry from '@sentry/react-native';

initSentry();

/** Don't block splash forever if DB open/migrate stalls. */
const DATABASE_READY_TIMEOUT_MS = 8_000;
/** Absolute ceiling so BootSplash can never pin the UI indefinitely. */
const SPLASH_FAILSAFE_MS = 12_000;

function waitForNextPaint(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function waitMs(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

async function hideBootSplash(): Promise<void> {
  try {
    await BootSplash.hide({ fade: true });
  } catch {
    // Continue startup even if the native splash module fails to hide.
  }
}

function App() {
  const [isAppReady, setAppReady] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const colorScheme = useColorScheme();
  const hasCompletedPrivacyOnboarding = useAppStore(
    state => state.hasCompletedPrivacyOnboarding,
  );
  const completePrivacyOnboarding = useAppStore(
    state => state.completePrivacyOnboarding,
  );
  const devShowOnboarding = useAppStore(state => state.devShowOnboarding);
  const showOnboarding =
    !onboardingDismissed &&
    (!hasCompletedPrivacyOnboarding || (__DEV__ && devShowOnboarding));

  const activeScreen = useMemo((): AppScreenKey | null => {
    if (!isAppReady) {
      return null;
    }
    if (showOnboarding) {
      return 'onboarding';
    }
    return 'main';
  }, [isAppReady, showOnboarding]);

  const handleOnboardingComplete = useCallback(() => {
    completePrivacyOnboarding();
    setOnboardingDismissed(true);
  }, [completePrivacyOnboarding]);

  useEffect(() => startWidgetDeepLinkListening(), []);

  // Init work, then hide splash. Do NOT wait on idle callbacks after
  // mounting main — MapScreen keeps the JS thread busy and can pin splash forever.
  useEffect(() => {
    let cancelled = false;
    let splashHidden = false;

    const hideOnce = async () => {
      if (splashHidden || cancelled) {
        return;
      }
      splashHidden = true;
      await hideBootSplash();
    };

    const failsafe = setTimeout(() => {
      setAppReady(true);
      void hideOnce();
    }, SPLASH_FAILSAFE_MS);

    void (async () => {
      try {
        await Promise.race([
          ensureDatabaseReady().catch(() => undefined),
          waitMs(DATABASE_READY_TIMEOUT_MS),
        ]);
      } catch {
        // Error boundary / next screen will surface DB failures.
      }
      if (cancelled) {
        return;
      }

      setAppReady(true);
      await waitForNextPaint();
      if (cancelled) {
        return;
      }

      await hideOnce();
      clearTimeout(failsafe);
    })();

    return () => {
      cancelled = true;
      clearTimeout(failsafe);
    };
  }, []);

  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={styles.root}>
        <AppBootstrap>
          <ThemeProvider>
            <SafeAreaProvider>
              <BottomSheetModalProvider>
                <View style={styles.root}>
                  <StatusBar
                    barStyle={
                      colorScheme === 'dark' ? 'light-content' : 'dark-content'
                    }
                    backgroundColor="transparent"
                    translucent
                  />
                  <View style={styles.screenHost}>
                    {activeScreen === 'onboarding' ? (
                      <AppScreenTransition screenKey="onboarding">
                        <OnboardingScreen
                          onComplete={handleOnboardingComplete}
                        />
                      </AppScreenTransition>
                    ) : null}

                    {activeScreen === 'main' ? (
                      <AppScreenTransition screenKey="main">
                        <RootNavigator />
                      </AppScreenTransition>
                    ) : null}
                  </View>
                  <PortalHost />
                </View>
              </BottomSheetModalProvider>
            </SafeAreaProvider>
          </ThemeProvider>
        </AppBootstrap>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  screenHost: {
    flex: 1,
    overflow: 'hidden',
  },
});

export default Sentry.wrap(App);
