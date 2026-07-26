import './global.css';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { InteractionManager, StyleSheet, View } from 'react-native';
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

function waitForNextPaint(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
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

  // Same pattern as react-native-bootsplash docs: init work, then hide.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await ensureDatabaseReady();
      } catch {
        // Error boundary / next screen will surface DB failures.
      }
      if (cancelled) {
        return;
      }

      setAppReady(true);
      await waitForNextPaint();
      await new Promise<void>(resolve => {
        InteractionManager.runAfterInteractions(() => resolve());
      });
      if (cancelled) {
        return;
      }

      await BootSplash.hide({ fade: true });
    })();

    return () => {
      cancelled = true;
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
