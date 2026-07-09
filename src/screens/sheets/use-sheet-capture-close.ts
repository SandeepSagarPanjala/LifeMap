import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/types';

/** Pop the capture screen when the sheet closes (or starts closing with closeOnAnimateOut). */
export function useSheetCaptureClose() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const closedRef = useRef(false);

  const close = useCallback(() => {
    if (closedRef.current) {
      return;
    }
    closedRef.current = true;
    navigation.goBack();
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      closedRef.current = false;
      return () => {
        closedRef.current = true;
      };
    }, []),
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      closedRef.current = true;
    });
    return unsubscribe;
  }, [navigation]);

  return close;
}
