import './global.css';

import {useCallback, useEffect, useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {PortalHost} from '@rn-primitives/portal';
import {StatusBar, useColorScheme} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {BottomSheetModalProvider} from '@gorhom/bottom-sheet';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {AppScreenTransition, type AppScreenKey} from '@/components/navigation/AppScreenTransition';
import {RootNavigator} from '@/navigation/RootNavigator';
import {AnimatedSplashScreen} from '@/components/splash/AnimatedSplashScreen';
import {OnboardingScreen} from '@/screens/OnboardingScreen';
import {ThemeProvider} from '@/components/theme/theme-provider';
import {AppBootstrap} from '@/components/AppBootstrap';
import {AppErrorBoundary} from '@/components/error-boundary';
import {useAppStore} from '@/stores/app-store';
import {startWidgetDeepLinkListening} from '@/lib/widget/widget-deep-link';

function App() {
  const [isSplashVisible, setSplashVisible] = useState(true);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const colorScheme = useColorScheme();
  const hasCompletedPrivacyOnboarding = useAppStore(state => state.hasCompletedPrivacyOnboarding);
  const completePrivacyOnboarding = useAppStore(state => state.completePrivacyOnboarding);
  const devShowOnboarding = useAppStore(state => state.devShowOnboarding);
  const showOnboarding =
    !onboardingDismissed &&
    (!hasCompletedPrivacyOnboarding || (__DEV__ && devShowOnboarding));

  const activeScreen = useMemo((): AppScreenKey => {
    if (isSplashVisible) {
      return 'splash';
    }
    if (showOnboarding) {
      return 'onboarding';
    }
    return 'main';
  }, [isSplashVisible, showOnboarding]);

  const handleSplashFinish = useCallback(() => {
    setSplashVisible(false);
  }, []);
  const handleOnboardingComplete = useCallback(() => {
    completePrivacyOnboarding();
    setOnboardingDismissed(true);
  }, [completePrivacyOnboarding]);

  const enableLocationTracking = activeScreen === 'main';
  const enableHistoryPreload = activeScreen === 'main';

  useEffect(() => startWidgetDeepLinkListening(), []);

  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={styles.root}>
        <AppBootstrap
          enableLocationTracking={enableLocationTracking}
          enableHistoryPreload={enableHistoryPreload}>
        <ThemeProvider>
          <SafeAreaProvider>
            <BottomSheetModalProvider>
            <View style={styles.root}>
            <StatusBar
              barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
              backgroundColor="transparent"
              translucent
            />
            <View style={styles.screenHost}>
              {activeScreen === 'splash' ? (
                <AppScreenTransition screenKey="splash">
                  <AnimatedSplashScreen onFinish={handleSplashFinish} />
                </AppScreenTransition>
              ) : null}

              {activeScreen === 'onboarding' ? (
                <AppScreenTransition screenKey="onboarding">
                  <OnboardingScreen onComplete={handleOnboardingComplete} />
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

export default App;
