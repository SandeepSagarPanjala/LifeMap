import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { Text } from '@/components/ui/text';

type MapDayLoadingOverlayProps = {
  visible: boolean;
  label?: string;
};

export function MapDayLoadingOverlay({
  visible,
  label = 'Loading your day…',
}: MapDayLoadingOverlayProps) {
  if (!visible) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <View style={styles.cardShadow}>
        <AdaptiveGlassSurface effect="regular" style={styles.card}>
          <ActivityIndicator size="small" />
          <Text className="mt-2 text-center text-sm font-medium">{label}</Text>
        </AdaptiveGlassSurface>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  cardShadow: {
    minWidth: 160,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  card: {
    minWidth: 160,
    borderRadius: 16,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
});
