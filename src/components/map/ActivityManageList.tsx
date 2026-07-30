import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { GripVertical, Pencil, Trash2 } from 'lucide-react-native';

import { ActivityEmojiOrb } from '@/components/map/ActivityEmojiOrb';
import type { ActivityRow } from '@/db/repositories/activities';
import { activityReminderSummary } from '@/lib/activities/activity-tile-style';

const ROW_RADIUS = 16;

type ActivityManageListProps = {
  activities: ActivityRow[];
  onReorder: (data: ActivityRow[]) => void;
  onBeginEdit: (activity: ActivityRow) => void;
  onArchive: (activity: ActivityRow) => void;
};

/** Reorderable activity rows with edit / remove actions. */
export function ActivityManageList({
  activities,
  onReorder,
  onBeginEdit,
  onArchive,
}: ActivityManageListProps) {
  const lastIndex = activities.length - 1;

  const renderItem = useCallback(
    ({ item, drag, isActive, getIndex }: RenderItemParams<ActivityRow>) => {
      const index = getIndex() ?? 0;
      const isFirst = index === 0;
      const isLast = index === lastIndex;
      const reminderSummary = activityReminderSummary(item);

      return (
        <ScaleDecorator activeScale={1.02}>
          <View
            style={[
              styles.manageRow,
              isFirst ? styles.manageRowFirst : null,
              isLast ? styles.manageRowLast : null,
              isActive ? styles.manageRowDragging : null,
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Reorder ${item.label}`}
              onLongPress={drag}
              delayLongPress={120}
              style={styles.dragHandle}
            >
              <GripVertical size={18} color="#8E8E93" strokeWidth={2.25} />
            </Pressable>
            <View style={styles.manageRowMain}>
              <ActivityEmojiOrb
                activity={item}
                size={40}
                radius={12}
                emojiSize={22}
              />
              <View style={styles.manageTextCol}>
                <Text style={styles.manageLabel} numberOfLines={1}>
                  {item.label}
                </Text>
                {reminderSummary != null ? (
                  <Text style={styles.manageReminder} numberOfLines={1}>
                    {reminderSummary}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={styles.manageActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit ${item.label}`}
                onPress={() => onBeginEdit(item)}
                hitSlop={8}
                style={styles.iconAction}
              >
                <Pencil size={16} color="#3A3A3C" strokeWidth={2.25} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.label}`}
                onPress={() => onArchive(item)}
                style={styles.iconAction}
              >
                <Trash2 size={16} color="#FF3B30" strokeWidth={2.25} />
              </Pressable>
            </View>
          </View>
        </ScaleDecorator>
      );
    },
    [lastIndex, onArchive, onBeginEdit],
  );

  return (
    <DraggableFlatList
      data={activities}
      keyExtractor={item => String(item.id)}
      activationDistance={12}
      onDragEnd={({ data }) => onReorder(data)}
      renderItem={renderItem}
      containerStyle={styles.manageList}
      contentContainerStyle={styles.manageListContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  manageList: {
    flex: 1,
    minHeight: 0,
  },
  manageListContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingBottom: 8,
  },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  manageRowFirst: {
    borderTopLeftRadius: ROW_RADIUS,
    borderTopRightRadius: ROW_RADIUS,
    overflow: 'hidden',
  },
  manageRowLast: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: ROW_RADIUS,
    borderBottomRightRadius: ROW_RADIUS,
    overflow: 'hidden',
  },
  manageRowDragging: {
    borderBottomColor: 'transparent',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  dragHandle: {
    width: 28,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
    paddingRight: 8,
  },
  manageTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  manageLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  manageReminder: {
    fontSize: 12,
    color: '#DB2777',
    fontWeight: '500',
  },
  manageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconAction: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
