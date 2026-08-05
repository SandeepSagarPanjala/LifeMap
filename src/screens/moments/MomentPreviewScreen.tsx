import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { MomentPreviewViewer } from '@/components/moments/MomentsPreviewSheet';
import { deleteMoment, type MomentRow } from '@/db/repositories/moments';
import { useSavedPlaces } from '@/hooks/use-saved-places';
import { markNeedsTodayRefreshOnMapFocus } from '@/lib/foreground-heavy-resume';
import { resolveGalleryPlaceLabelsForMoments } from '@/lib/moments/gallery-moment-place-labels';
import { buildMomentPreviewContextForEntry } from '@/lib/moments/moment-preview-context';
import {
  consumeMomentPreview,
  expandMomentPreviewIfNeeded,
} from '@/lib/moments/moment-preview-navigation';
import { matchSavedPlaceForStay } from '@/lib/saved-places';
import { useAppStore } from '@/stores/app-store';
import type { RootStackParamList } from '@/navigation/types';

const EMPTY_PLACE_LABELS = new Map<number, string>();

export function MomentPreviewScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [payload] = useState(() => consumeMomentPreview());
  const [moments, setMoments] = useState<MomentRow[]>(payload?.moments ?? []);
  const [placeLabelsByMomentId, setPlaceLabelsByMomentId] =
    useState<ReadonlyMap<number, string>>(EMPTY_PLACE_LABELS);
  const [prependShift, setPrependShift] = useState<{
    id: number;
    delta: number;
  } | null>(null);
  const { places: savedPlaces } = useSavedPlaces();
  const distanceUnit = useAppStore(state => state.distanceUnit);
  const previewEntry = payload?.previewEntry ?? null;
  const crossDayExpand = Boolean(payload?.crossDayExpand);
  const expandingRef = useRef(false);
  const prependShiftIdRef = useRef(0);
  const momentsRef = useRef(moments);
  momentsRef.current = moments;
  const didWarmStartEdgeRef = useRef(false);
  const didWarmEndEdgeRef = useRef(false);

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

  useEffect(() => {
    let cancelled = false;
    void resolveGalleryPlaceLabelsForMoments(moments).then(labels => {
      if (!cancelled) {
        setPlaceLabelsByMomentId(labels);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [moments]);

  const applyExpand = useCallback(
    async (edge: 'start' | 'end') => {
      if (!crossDayExpand || expandingRef.current) {
        return;
      }
      expandingRef.current = true;
      try {
        const result = await expandMomentPreviewIfNeeded(
          momentsRef.current,
          edge,
          true,
        );
        if (!result) {
          return;
        }
        setMoments(result.moments);
        momentsRef.current = result.moments;
        if (result.indexDelta > 0) {
          prependShiftIdRef.current += 1;
          setPrependShift({
            id: prependShiftIdRef.current,
            delta: result.indexDelta,
          });
        }
      } finally {
        expandingRef.current = false;
      }
    },
    [crossDayExpand],
  );

  // Warm the adjacent day once when opening on an edge, so the first swipe
  // into that day works. User-scroll handler below loads further days.
  useEffect(() => {
    if (!crossDayExpand || payload == null) {
      return;
    }
    const list = momentsRef.current;
    if (list.length === 0) {
      return;
    }
    const idx = Math.max(
      0,
      Math.min(payload.initialIndex, list.length - 1),
    );
    if (idx === 0 && !didWarmStartEdgeRef.current) {
      didWarmStartEdgeRef.current = true;
      void applyExpand('start');
    } else if (idx >= list.length - 1 && !didWarmEndEdgeRef.current) {
      didWarmEndEdgeRef.current = true;
      void applyExpand('end');
    }
  }, [applyExpand, crossDayExpand, payload]);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleDeleteMoment = useCallback(async (momentId: number) => {
    await deleteMoment(momentId);
    setMoments(previous => previous.filter(moment => moment.id !== momentId));
    markNeedsTodayRefreshOnMapFocus();
  }, []);

  const handleActiveIndexChange = useCallback(
    (index: number) => {
      if (!crossDayExpand || expandingRef.current) {
        return;
      }
      const list = momentsRef.current;
      if (list.length === 0) {
        return;
      }
      // Exact edges only — prefetch distance > 0 caused multi-day jumps.
      if (index === 0) {
        void applyExpand('start');
        return;
      }
      if (index >= list.length - 1) {
        void applyExpand('end');
      }
    },
    [applyExpand, crossDayExpand],
  );

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
        placeLabelsByMomentId={placeLabelsByMomentId}
        prependShift={prependShift}
        onClose={handleClose}
        onDeleteMoment={handleDeleteMoment}
        onActiveIndexChange={handleActiveIndexChange}
      />
    </View>
  );
}
