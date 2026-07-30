import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';

import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { APP_COPY } from '@/lib/app-copy';
import {
  getMoodArtPresentation,
  MAX_MOOD_REASON_LENGTH,
  type MoodArtVariant,
} from '@/lib/moments/mood-art';
import type { EmotionTokenId } from '@/lib/moments/emotion-tokens';
import { useThemeColors } from '@/hooks/use-theme-colors';

type DiaryMoodBlockProps = {
  emotionId: EmotionTokenId;
  variant: MoodArtVariant;
  reason: string;
  onChangeReason: (value: string) => void;
  onRemove: () => void;
  onFocusReason?: () => void;
};

/**
 * Special diary mood card: art on the left, ~3-line reason on the right.
 */
export function DiaryMoodBlock({
  emotionId,
  variant,
  reason,
  onChangeReason,
  onRemove,
  onFocusReason,
}: DiaryMoodBlockProps) {
  const colors = useThemeColors();
  const art = getMoodArtPresentation(emotionId, variant);

  return (
    <View style={styles.shadowWrap}>
      <AdaptiveGlassSurface style={styles.glass}>
        <View style={styles.content}>
          <View style={[styles.art, { backgroundColor: art.emotion.tint }]}>
            <Image
              source={art.imageSource}
              resizeMode="contain"
              style={styles.artImage}
            />
          </View>

          <View style={styles.copy}>
            <Text style={[styles.label, { color: colors.cardForeground }]}>
              {art.emotion.label}
            </Text>
            <TextInput
              placeholder={APP_COPY.diary.moodReasonPlaceholder}
              placeholderTextColor="#8E8E93"
              value={reason}
              onChangeText={value =>
                onChangeReason(value.slice(0, MAX_MOOD_REASON_LENGTH))
              }
              onFocus={onFocusReason}
              multiline
              textAlignVertical="top"
              style={[styles.reasonInput, { color: colors.cardForeground }]}
              selectionColor={colors.primary}
              cursorColor={colors.primary}
              maxLength={MAX_MOOD_REASON_LENGTH}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={APP_COPY.diary.removeMood}
            onPress={onRemove}
            style={styles.remove}
            hitSlop={8}
          >
            <X size={16} color="#8E8E93" strokeWidth={2.5} />
          </Pressable>
        </View>
      </AdaptiveGlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 7 },
        shadowOpacity: 0.14,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  glass: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
  },
  art: {
    width: 72,
    height: 72,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artImage: {
    width: 68,
    height: 68,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    minHeight: 72,
    gap: 4,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
  },
  reasonInput: {
    flexGrow: 1,
    minHeight: 54,
    maxHeight: 72,
    fontSize: 15,
    lineHeight: 20,
    padding: 0,
  },
  remove: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
