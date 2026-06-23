import {useEffect, useRef} from 'react';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import type {RootStackParamList} from '@/navigation/types';
import {shouldAutoNavigateToRestore} from '@/lib/backup/backup-install-state';

export function RestoreBackupGate() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) {
      return;
    }
    checkedRef.current = true;
    void shouldAutoNavigateToRestore().then(shouldNavigate => {
      if (shouldNavigate) {
        navigation.navigate('RestoreBackup', {source: 'install'});
      }
    });
  }, [navigation]);

  return null;
}
