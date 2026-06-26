import {useEffect, useRef} from 'react';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import type {RootStackParamList} from '@/navigation/types';
import {shouldAutoNavigateToRestore} from '@/lib/backup/backup-install-state';

const RESTORE_CHECK_DELAYS_MS = [0, 2_000, 5_000, 10_000] as const;

export function RestoreBackupGate() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const navigatedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const timers = RESTORE_CHECK_DELAYS_MS.map(delayMs =>
      setTimeout(() => {
        if (cancelled || navigatedRef.current) {
          return;
        }
        void shouldAutoNavigateToRestore().then(shouldNavigate => {
          if (cancelled || navigatedRef.current || !shouldNavigate) {
            return;
          }
          navigatedRef.current = true;
          navigation.navigate('RestoreBackup', {source: 'install'});
        });
      }, delayMs),
    );

    return () => {
      cancelled = true;
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [navigation]);

  return null;
}
