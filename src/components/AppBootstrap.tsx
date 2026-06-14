import {useEffect} from 'react';
import {AppState} from 'react-native';

import {ensureDatabaseReady, bootstrapLocationTracking} from '@/location/bootstrap';
import {getLocationService} from '@/location/transistorsoft-location-service';
import {
  initializeTrackingDiagnosticsEnabled,
  recordTrackingDiagnostic,
} from '@/lib/tracking-diagnostics';
import {useTripMaterializationBootstrap} from '@/hooks/use-trip-materialization-bootstrap';
import {useAppStore} from '@/stores/app-store';

type AppBootstrapProps = {
  children: React.ReactNode;
  /** When false, only the encrypted database is initialized. */
  enableLocationTracking?: boolean;
};

export function AppBootstrap({children, enableLocationTracking = false}: AppBootstrapProps) {
  const hasCompletedPrivacyOnboarding = useAppStore(
    state => state.hasCompletedPrivacyOnboarding,
  );

  useTripMaterializationBootstrap();

  useEffect(() => {
    void ensureDatabaseReady();
  }, []);

  useEffect(() => {
    initializeTrackingDiagnosticsEnabled();
  }, []);

  useEffect(() => {
    if (!enableLocationTracking || !hasCompletedPrivacyOnboarding) {
      return;
    }

    void bootstrapLocationTracking();
  }, [enableLocationTracking, hasCompletedPrivacyOnboarding]);

  useEffect(() => {
    let currentState = AppState.currentState;
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === currentState) {
        return;
      }
      const previous = currentState;
      currentState = nextState;
      void recordTrackingDiagnostic('app_state_change', {
        previous,
        next: nextState,
      });

      if (
        enableLocationTracking &&
        hasCompletedPrivacyOnboarding &&
        (nextState === 'active' || nextState === 'background')
      ) {
        const service = getLocationService();
        if (nextState === 'active') {
          void service.refreshPersistPipeline().catch(() => undefined);
        } else {
          void service.drainNativeQueue().catch(() => undefined);
        }
      }
    });
    return () => subscription.remove();
  }, [enableLocationTracking, hasCompletedPrivacyOnboarding]);

  return children;
}
