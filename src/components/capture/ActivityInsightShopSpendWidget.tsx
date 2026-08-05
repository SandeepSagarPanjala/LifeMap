import {
  Platform,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import {
  formatShopVisitCount,
  type ShopSpendRow,
} from '@/lib/activities/activity-insight-shop-spend';
import { formatMetricCompact } from '@/lib/activities/insight-period-metric';

const MONEY_METRIC = {
  id: 'amount',
  kind: 'money' as const,
  fieldId: 'amount',
  label: 'Amount',
};

/**
 * Spend broken down by shop — shown when an activity has both amount and
 * shop name fields.
 */
export function ActivityInsightShopSpendWidget({
  rows,
  tint,
  accent,
  muted,
  foreground,
  onPressShop,
}: {
  rows: readonly ShopSpendRow[];
  tint: string;
  accent: string;
  muted: string;
  foreground: string;
  onPressShop?: (row: ShopSpendRow) => void;
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <Animated.View
      layout={LinearTransition.duration(220)}
      style={[styles.section, { backgroundColor: tint }]}
    >
      <Text style={[styles.title, { color: accent }]}>By shop</Text>
      <View style={styles.list}>
        {rows.map(row => {
          const amountLabel = formatMetricCompact(
            MONEY_METRIC,
            row.totalAmount,
          );
          const visitsLabel = formatShopVisitCount(row.visits);
          const rowBody = (
            <View style={styles.rowInner}>
              <View style={styles.titleRow}>
                <RNText
                  style={[styles.shopName, { color: foreground }]}
                  numberOfLines={1}
                  allowFontScaling={false}
                >
                  {row.shopName}
                </RNText>
                <RNText
                  style={[styles.amount, { color: accent }]}
                  allowFontScaling={false}
                  numberOfLines={1}
                >
                  {amountLabel}
                </RNText>
              </View>
              <Text style={[styles.visits, { color: muted }]}>
                {visitsLabel}
              </Text>
            </View>
          );

          if (onPressShop == null) {
            return (
              <View key={row.shopKey} style={styles.row}>
                {rowBody}
              </View>
            );
          }

          return (
            <Pressable
              key={row.shopKey}
              accessibilityRole="button"
              accessibilityLabel={`${row.shopName}, ${visitsLabel}, ${amountLabel}`}
              onPress={() => onPressShop(row)}
              style={({ pressed }) => [
                styles.row,
                pressed ? { opacity: 0.72 } : null,
              ]}
            >
              {rowBody}
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  list: {
    gap: 10,
  },
  row: {
    alignSelf: 'stretch',
  },
  rowInner: {
    width: '100%',
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    width: '100%',
  },
  shopName: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: '700',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  visits: {
    fontSize: 12,
    fontWeight: '600',
  },
  amount: {
    flexShrink: 0,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'right',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
});
