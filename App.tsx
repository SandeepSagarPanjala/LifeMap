import './global.css';

import {PortalHost} from '@rn-primitives/portal';
import {StatusBar, useColorScheme} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {RootNavigator} from '@/navigation/RootNavigator';
import {PrivacyOnboardingScreen} from '@/screens/PrivacyOnboardingScreen';
import {useAppStore} from '@/stores/app-store';

function App() {
  const colorScheme = useColorScheme();
  const hasCompletedPrivacyOnboarding = useAppStore(
    state => state.hasCompletedPrivacyOnboarding
  );

  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        <StatusBar
          barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
          backgroundColor="transparent"
          translucent
        />
        {hasCompletedPrivacyOnboarding ? <RootNavigator /> : <PrivacyOnboardingScreen />}
        <PortalHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
