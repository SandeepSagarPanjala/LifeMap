import {useEffect} from 'react';

import {ensureDatabaseReady, bootstrapLocationTracking} from '@/location/bootstrap';
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

  useEffect(() => {
    void ensureDatabaseReady();
  }, []);

  useEffect(() => {
    if (!enableLocationTracking || !hasCompletedPrivacyOnboarding) {
      return;
    }

    void bootstrapLocationTracking();
  }, [enableLocationTracking, hasCompletedPrivacyOnboarding]);

  return children;
}
