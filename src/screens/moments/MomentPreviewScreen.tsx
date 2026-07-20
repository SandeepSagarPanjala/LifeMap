import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { MomentPreviewViewer } from '@/components/moments/MomentsPreviewSheet';
import { deleteMoment, type MomentRow } from '@/db/repositories/moments';
import { useSavedPlaces } from '@/hooks/use-saved-places';
import { buildMomentPreviewContextForEntry } from '@/lib/moments/moment-preview-context';
import { consumeMomentPreview } from '@/lib/moments/moment-preview-navigation';
import { matchSavedPlaceForStay } from '@/lib/saved-places';
import { useAppStore } from '@/stores/app-store';
import type { RootStackParamList } from '@/navigation/types';

export function MomentPreviewScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [payload] = useState(() => consumeMomentPreview());
  const [moments, setMoments] = useState<MomentRow[]>(payload?.moments ?? []);
  const { places: savedPlaces } = useSavedPlaces();
  const distanceUnit = useAppStore(state => state.distanceUnit);
  const previewEntry = payload?.previewEntry ?? null;

  const previewEntryContext = useMemo(() => {
    if (!previewEntry) {
      return null;
    }
    return buildMomentPreviewContextForEntry(
      previewEntry,
      savedPlaces,
      distanceUnit,
    );
  }, [distanceUnit, previewEntry, savedPlaces]);

  const previewSavedPlace = useMemo(() => {
    if (previewEntry?.kind !== 'stay') {
      return null;
    }
    return matchSavedPlaceForStay(previewEntry, savedPlaces);
  }, [previewEntry, savedPlaces]);

  useEffect(() => {
    if (payload == null) {
      navigation.goBack();
    }
  }, [navigation, payload]);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleDeleteMoment = useCallback(async (momentId: number) => {
    await deleteMoment(momentId);
    setMoments(previous => previous.filter(moment => moment.id !== momentId));
  }, []);

  if (payload == null) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <MomentPreviewViewer
        moments={moments}
        initialIndex={payload.initialIndex}
        previewEntryContext={previewEntryContext}
        previewSavedPlace={previewSavedPlace}
        onClose={handleClose}
        onDeleteMoment={handleDeleteMoment}
      />
    </View>
  );
}
