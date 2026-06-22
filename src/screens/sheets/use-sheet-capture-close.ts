import {useCallback, useRef} from 'react';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import type {RootStackParamList} from '@/navigation/types';

/** Pop the transparent capture screen as soon as the sheet closes. */
export function useSheetCaptureClose() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const closedRef = useRef(false);

  return useCallback(() => {
    if (closedRef.current) {
      return;
    }
    closedRef.current = true;
    navigation.goBack();
  }, [navigation]);
}
