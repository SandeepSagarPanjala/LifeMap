import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ActivityLogSheet } from '@/components/map/ActivityLogSheet';
import type { ActivityRow } from '@/db/repositories/activities';
import { NativeHalfSheetShell } from '@/components/ui/NativeHalfSheetShell';
import { useNativeHalfSheetClose } from '@/components/ui/native-half-sheet-context';
import { markNeedsTodayRefreshOnMapFocus } from '@/lib/foreground-heavy-resume';
import { ACTIVITY_SHEET_HEIGHT_RATIO } from '@/navigation/activity-capture-screen-options';
import type { RootStackParamList } from '@/navigation/types';
import { useSheetCaptureClose } from '@/screens/sheets/use-sheet-capture-close';

/**
 * Activity picker on the map (half sheet).
 * One-tap logs here; structured fields push ActivityLogEntry (full page).
 * Manage activities replaces this sheet with the full manage page.
 */
export function CaptureActivityScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const navigationClose = useSheetCaptureClose();

  const [reloadNonce, setReloadNonce] = useState(0);
  const [shellClosed, setShellClosed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setReloadNonce(n => n + 1);
    }, []),
  );

  const finishClose = useCallback(() => {
    setShellClosed(true);
    navigationClose();
  }, [navigationClose]);

  const handleBeginCreateFirst = useCallback(() => {
    navigation.replace('ActivityForm', { kind: 'create-first' });
  }, [navigation]);

  const handleBeginManage = useCallback(() => {
    navigation.replace('ActivityManage');
  }, [navigation]);

  const handleBeginInsights = useCallback(() => {
    navigation.replace('ActivityInsights');
  }, [navigation]);

  const handleBeginStructuredLog = useCallback(
    (activity: ActivityRow) => {
      navigation.replace('ActivityLogEntry', { activityId: activity.id });
    },
    [navigation],
  );

  return (
    <View
      style={styles.root}
      pointerEvents={shellClosed ? 'none' : 'box-none'}
    >
      <NativeHalfSheetShell
        onClose={finishClose}
        heightRatio={ACTIVITY_SHEET_HEIGHT_RATIO}
      >
        <View style={styles.panelHost}>
          <CaptureActivityList
            reloadNonce={reloadNonce}
            onBeginCreateFirst={handleBeginCreateFirst}
            onBeginManage={handleBeginManage}
            onBeginInsights={handleBeginInsights}
            onBeginStructuredLog={handleBeginStructuredLog}
          />
        </View>
      </NativeHalfSheetShell>
    </View>
  );
}

function CaptureActivityList({
  onBeginCreateFirst,
  onBeginManage,
  onBeginInsights,
  onBeginStructuredLog,
  reloadNonce,
}: {
  onBeginCreateFirst: () => void;
  onBeginManage: () => void;
  onBeginInsights: () => void;
  onBeginStructuredLog: (activity: ActivityRow) => void;
  reloadNonce: number;
}) {
  const closeSheet = useNativeHalfSheetClose();

  return (
    <View style={styles.panel}>
      <ActivityLogSheet
        visible
        onClose={closeSheet}
        onLogged={async () => {
          markNeedsTodayRefreshOnMapFocus();
        }}
        onBeginCreateFirst={onBeginCreateFirst}
        onBeginManage={onBeginManage}
        onBeginInsights={onBeginInsights}
        onBeginStructuredLog={onBeginStructuredLog}
        reloadNonce={reloadNonce}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  panelHost: {
    flex: 1,
    minHeight: 0,
  },
  panel: {
    flex: 1,
    minHeight: 0,
  },
});
