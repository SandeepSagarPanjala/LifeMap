import { memo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Bell } from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import type { ActivityRow } from '@/db/repositories/activities';
import {
  ACTIVITY_TINT_NOTIFY_PINK,
  activityCoreTint,
  activityNotifyGradientStart,
} from '@/lib/activities/activity-tile-style';

type ActivityEmojiOrbProps = {
  activity: ActivityRow;
  size?: number;
  radius?: number;
  emojiSize?: number;
  showNotifyBadge?: boolean;
};

export const ActivityEmojiOrb = memo(function ActivityEmojiOrb({
  activity,
  size = 64,
  radius = 16,
  emojiSize = 32,
  showNotifyBadge = true,
}: ActivityEmojiOrbProps) {
  const coreTint = activityCoreTint(activity);
  const hasNotify = activity.reminderEnabled;
  const gradientId = `activity-orb-${activity.id}-${size}`;
  const notifyStart = activityNotifyGradientStart(activity);
  const badgeSize = Math.max(16, Math.round(size * 0.28));
  const bellSize = Math.max(9, Math.round(badgeSize * 0.55));

  return (
    <View style={[styles.wrap, { width: size + 6, height: size + 6 }]}>
      <View
        style={[
          styles.orb,
          {
            width: size,
            height: size,
            borderRadius: radius,
          },
          hasNotify ? styles.orbGradient : { backgroundColor: coreTint },
        ]}
      >
        {hasNotify ? (
          <Svg
            pointerEvents="none"
            width={size}
            height={size}
            style={StyleSheet.absoluteFillObject}
          >
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={notifyStart} />
                <Stop offset="1" stopColor={ACTIVITY_TINT_NOTIFY_PINK} />
              </LinearGradient>
            </Defs>
            <Rect
              x={0}
              y={0}
              width={size}
              height={size}
              rx={radius}
              ry={radius}
              fill={`url(#${gradientId})`}
            />
          </Svg>
        ) : null}
        <Text
          style={[
            styles.emoji,
            {
              fontSize: emojiSize,
              lineHeight:
                Platform.OS === 'android' ? emojiSize + 4 : emojiSize + 2,
            },
          ]}
        >
          {activity.emoji}
        </Text>
      </View>
      {hasNotify && showNotifyBadge ? (
        <View
          pointerEvents="none"
          style={[
            styles.badgeWrap,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              top: 0,
              right: 0,
            },
          ]}
        >
          <AdaptiveGlassSurface
            effect="clear"
            tintColor="rgba(244,114,182,0.18)"
            style={[
              styles.badgeSurface,
              {
                width: badgeSize,
                height: badgeSize,
                borderRadius: badgeSize / 2,
              },
            ]}
          >
            <Bell size={bellSize} color="#DB2777" strokeWidth={2.5} />
          </AdaptiveGlassSurface>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orbGradient: {
    backgroundColor: 'transparent',
  },
  emoji: {
    textAlign: 'center',
    zIndex: 1,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  badgeWrap: {
    position: 'absolute',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 2,
      },
      android: { elevation: 2 },
    }),
  },
  badgeSurface: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
