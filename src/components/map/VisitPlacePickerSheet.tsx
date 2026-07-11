import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Type, X } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { useThemeColors } from '@/hooks/use-theme-colors';
import type { VisitPlaceDisplay } from '@/lib/place-lookup-types';

type VisitPlacePickerSheetProps = {
  display: VisitPlaceDisplay;
  onSelect: (selection: { poiId: number; poiLabel: string }) => void;
  onRequestCustom: () => void;
  onClose: () => void;
};

/** Inline place picker — sits above the history event card (same slot as the old label card). */
export function VisitPlacePickerSheet({
  display,
  onSelect,
  onRequestCustom,
  onClose,
}: VisitPlacePickerSheetProps) {
  const colors = useThemeColors();
  const candidates = display.candidates;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Choose a place</Text>
      <Text variant="muted" style={styles.subtitle}>
        Tap a nearby place to label this visit.
      </Text>

      {display.loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
          <Text variant="muted" className="ml-2 text-sm">
            Finding nearby places…
          </Text>
        </View>
      ) : candidates.length === 0 ? (
        <Text variant="muted" style={styles.emptyText}>
          No nearby places found. Use Custom to add a name.
        </Text>
      ) : (
        <ScrollView
          style={styles.chipScroll}
          contentContainerStyle={styles.chipWrap}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={candidates.length > 8}
        >
          {candidates.map(candidate => {
            const selected = candidate.id === display.selectedPoiId;
            return (
              <Pressable
                key={candidate.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={candidate.name}
                onPress={() =>
                  onSelect({ poiId: candidate.id, poiLabel: candidate.name })
                }
                style={[
                  styles.chip,
                  selected
                    ? {
                        backgroundColor: colors.primary,
                        borderColor: colors.primary,
                      }
                    : styles.chipIdle,
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.chipText,
                    selected ? styles.chipTextSelected : null,
                  ]}
                >
                  {candidate.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enter custom place name"
          onPress={onRequestCustom}
          style={styles.footerButton}
          hitSlop={6}
        >
          <Type size={16} color={colors.primary} strokeWidth={2.25} />
          <Text style={[styles.footerLabel, { color: colors.primary }]}>
            Custom
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close without saving"
          onPress={onClose}
          style={styles.footerButton}
          hitSlop={6}
        >
          <X size={16} color="#8E8E93" strokeWidth={2.25} />
          <Text style={styles.footerLabelMuted}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    minHeight: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 13,
  },
  chipScroll: {
    marginTop: 12,
    maxHeight: 160,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 2,
  },
  chip: {
    maxWidth: '100%',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipIdle: {
    backgroundColor: '#F2F2F7',
    borderColor: '#E5E5EA',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 2,
  },
  footerLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  footerLabelMuted: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8E8E93',
  },
});
