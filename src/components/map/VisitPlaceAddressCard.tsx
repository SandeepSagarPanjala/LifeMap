import { type ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Check, Maximize2, Type } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { VisitPlaceLabelPager } from '@/components/map/VisitPlaceLabelPager';
import { useThemeColors } from '@/hooks/use-theme-colors';
import type { VisitPlaceDisplay } from '@/lib/place-lookup-types';
import { nextPlaceLookupRadiusM } from '@/lib/place-lookup-venue';

export type VisitPlaceDraftSelection = {
  poiId: number;
  poiLabel: string;
};

type VisitPlaceAddressCardProps = {
  display: VisitPlaceDisplay;
  expandingArea?: boolean;
  onExpandArea: () => void;
  onRequestCustomLabel: () => void;
  /** Persists the browsed selection (if any) and closes the editor. */
  onDone: (selection: VisitPlaceDraftSelection | null) => void;
};

export function VisitPlaceAddressCard({
  display,
  expandingArea = false,
  onExpandArea,
  onRequestCustomLabel,
  onDone,
}: VisitPlaceAddressCardProps) {
  const colors = useThemeColors();
  const canExpandArea =
    display.cacheId != null &&
    nextPlaceLookupRadiusM(display.venueRadiusMeters) != null;

  const [draftPoiId, setDraftPoiId] = useState<number | null>(
    display.selectedPoiId,
  );

  // Prefer the persisted selection whenever it arrives or the edit target changes.
  useEffect(() => {
    setDraftPoiId(display.selectedPoiId);
  }, [display.cacheId, display.materializedTripId, display.selectedPoiId]);

  // Keep draft valid as candidates load/expand. Never fall back to the first
  // POI while a persisted selection exists (avoids overwriting Flower Child
  // with Reformed Pilates on open / Done).
  useEffect(() => {
    if (display.candidates.length === 0) {
      return;
    }
    setDraftPoiId(prev => {
      if (
        prev != null &&
        display.candidates.some(candidate => candidate.id === prev)
      ) {
        return prev;
      }
      if (
        display.selectedPoiId != null &&
        display.candidates.some(
          candidate => candidate.id === display.selectedPoiId,
        )
      ) {
        return display.selectedPoiId;
      }
      if (display.selectedPoiId != null) {
        return display.selectedPoiId;
      }
      return display.candidates[0]?.id ?? null;
    });
  }, [display.candidates, display.selectedPoiId]);

  const trailingActions = (
    <View style={styles.trailing}>
      <IconActionButton
        accessibilityLabel={
          canExpandArea
            ? 'Show more nearby places'
            : 'No more nearby places to show'
        }
        disabled={!canExpandArea || expandingArea}
        onPress={onExpandArea}
        icon={
          expandingArea ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Maximize2 size={15} color={colors.primary} strokeWidth={2.25} />
          )
        }
      />
      <IconActionButton
        accessibilityLabel="Enter custom place name"
        icon={<Type size={15} color={colors.primary} strokeWidth={2.25} />}
        onPress={onRequestCustomLabel}
      />
      <DoneActionButton
        onPress={() => {
          const selected =
            draftPoiId != null
              ? display.candidates.find(candidate => candidate.id === draftPoiId)
              : null;
          onDone(
            selected
              ? { poiId: selected.id, poiLabel: selected.name }
              : null,
          );
        }}
      />
    </View>
  );

  if (display.loading) {
    return (
      <View style={styles.card}>
        <View style={styles.placeSlot}>
          <ActivityIndicator color={colors.primary} />
          <Text variant="muted" className="ml-2 text-sm">
            Finding nearby places…
          </Text>
        </View>
        {trailingActions}
      </View>
    );
  }

  if (!display.primaryLabel && display.candidates.length === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.placeSlot}>
          <Text className="font-medium" numberOfLines={1}>
            No nearby place found
          </Text>
        </View>
        {trailingActions}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <VisitPlaceLabelPager
        display={display}
        draftPoiId={draftPoiId}
        onDraftPoiIdChange={setDraftPoiId}
      />
      {trailingActions}
    </View>
  );
}

function IconActionButton({
  icon,
  accessibilityLabel,
  disabled = false,
  onPress,
}: {
  icon: ReactNode;
  accessibilityLabel: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={[styles.iconButton, disabled && styles.buttonDisabled]}
    >
      {icon}
    </Pressable>
  );
}

function DoneActionButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Done"
      onPress={onPress}
      style={styles.doneButton}
    >
      <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  placeSlot: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
});
