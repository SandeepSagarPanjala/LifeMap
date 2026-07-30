import { memo, useCallback, useMemo, type ReactElement } from 'react';
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { AudioLines, ImageIcon } from 'lucide-react-native';
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { CAPTURE_BUTTON_THEMES } from '@/components/map/map-capture-button-theme';
import type { MomentRow } from '@/db/repositories/moments';
import { APP_COPY } from '@/lib/app-copy';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  resolveEmotionFromMoodLabel,
  resolveMoodVariantFromMoment,
  getMoodArtPresentation,
} from '@/lib/moments/mood-art';
import { momentImageUri } from '@/lib/moments/moment-media-uri';
import { notePhotoAttachmentPaths } from '@/lib/moments/note-photo-attachments';
import { APP_TIMEZONE } from '@/lib/timezone';

const CARD_RADIUS = 20;
const MEDIA_HEIGHT = 140;
const MEDIA_GAP = 6;

type DiaryListProps = {
  entries: MomentRow[];
  onPressEntry: (entry: MomentRow, index: number) => void;
  ListEmptyComponent?: ReactElement | null;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

function diaryEntryTitle(entry: MomentRow): string | null {
  const title = entry.title?.trim();
  if (title) {
    return title;
  }
  return null;
}

function diaryEntryBody(entry: MomentRow): string | null {
  const body = entry.textBody?.trim();
  return body || null;
}

function diaryEntryWhen(entry: MomentRow): string {
  return format(
    new TZDate(entry.timestamp, APP_TIMEZONE),
    "EEE, MMM d 'at' h:mm a",
  );
}

function monthKey(date: Date): string {
  return format(new TZDate(date, APP_TIMEZONE), 'yyyy-MM');
}

function monthLabel(date: Date): string {
  return format(new TZDate(date, APP_TIMEZONE), 'MMMM yyyy');
}

type ListRow =
  | { kind: 'header'; id: string; label: string }
  | { kind: 'entry'; id: string; entry: MomentRow; entryIndex: number };

function DiaryMedia({ entry }: { entry: MomentRow }) {
  const paths = notePhotoAttachmentPaths(entry);
  if (paths.length === 0) {
    return null;
  }

  const visible = paths.slice(0, 2);
  return (
    <View style={styles.mediaRow}>
      {visible.map((path, index) => (
        <View key={path} style={styles.mediaTile}>
          <Image
            source={{ uri: momentImageUri(path) }}
            style={styles.mediaImage}
            resizeMode="cover"
          />
          {index === 1 && paths.length > 2 ? (
            <View style={styles.moreMedia}>
              <Text style={styles.moreMediaText}>+{paths.length - 2}</Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function DiaryMoodBlock({ entry }: { entry: MomentRow }) {
  const emotion = resolveEmotionFromMoodLabel(entry.moodLabel);
  if (!emotion) {
    const fallback = entry.moodLabel?.trim();
    if (!fallback) {
      return null;
    }
    return (
      <Text style={styles.moodFallback} numberOfLines={2}>
        {fallback}
      </Text>
    );
  }

  const variant = resolveMoodVariantFromMoment(entry.moodVariant);
  const art = getMoodArtPresentation(emotion.id, variant);
  const reason = entry.moodReason?.trim();

  return (
    <View style={styles.moodGlassShadow}>
      <AdaptiveGlassSurface style={styles.moodGlass}>
        <View style={styles.moodBlock}>
          <View style={[styles.moodArt, { backgroundColor: art.emotion.tint }]}>
            <Image
              source={art.imageSource}
              resizeMode="contain"
              style={styles.moodArtImage}
            />
          </View>
          <View style={styles.moodCopy}>
            <Text style={styles.moodLabel}>{art.emotion.label}</Text>
            {reason ? (
              <Text style={styles.moodReason} numberOfLines={3}>
                {reason}
              </Text>
            ) : null}
          </View>
        </View>
      </AdaptiveGlassSurface>
    </View>
  );
}

function DiaryAttachments({ entry }: { entry: MomentRow }) {
  const photoCount = notePhotoAttachmentPaths(entry).length;
  const hasMood = Boolean(entry.moodLabel?.trim());
  const hasVoice = entry.voiceAttachmentPath != null;
  if (photoCount === 0 && !hasVoice && !hasMood) {
    return null;
  }

  return (
    <View style={styles.attachmentRow}>
      {photoCount > 0 ? (
        <View style={styles.attachment}>
          <ImageIcon
            size={14}
            color={CAPTURE_BUTTON_THEMES.note.icon}
            strokeWidth={2.2}
          />
          <Text style={styles.attachmentText}>
            {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
          </Text>
        </View>
      ) : null}
      {hasVoice ? (
        <View style={styles.attachment}>
          <AudioLines
            size={14}
            color={CAPTURE_BUTTON_THEMES.voice.icon}
            strokeWidth={2.2}
          />
          <Text style={styles.attachmentText}>Voice message</Text>
        </View>
      ) : null}
      {hasMood ? <DiaryMoodBlock entry={entry} /> : null}
    </View>
  );
}

function buildRows(entries: MomentRow[]): ListRow[] {
  const rows: ListRow[] = [];
  let lastMonth: string | null = null;
  entries.forEach((entry, entryIndex) => {
    const key = monthKey(entry.timestamp);
    if (key !== lastMonth) {
      lastMonth = key;
      rows.push({
        kind: 'header',
        id: `month-${key}`,
        label: monthLabel(entry.timestamp),
      });
    }
    rows.push({
      kind: 'entry',
      id: `note-${entry.id}`,
      entry,
      entryIndex,
    });
  });
  return rows;
}

function DiaryListComponent({
  entries,
  onPressEntry,
  ListEmptyComponent,
  contentContainerStyle,
}: DiaryListProps) {
  const colors = useThemeColors();
  const rows = useMemo(() => buildRows(entries), [entries]);

  const renderItem: ListRenderItem<ListRow> = useCallback(
    ({ item, index }) => {
      if (item.kind === 'header') {
        return (
          <Text
            style={[
              styles.monthHeader,
              { color: colors.foreground },
              index > 0 ? styles.monthHeaderSpaced : null,
            ]}
          >
            {item.label}
          </Text>
        );
      }

      const title = diaryEntryTitle(item.entry);
      const body = diaryEntryBody(item.entry);
      const when = diaryEntryWhen(item.entry);
      const accessibleTitle =
        title ??
        body?.split(/\r?\n/)[0]?.trim() ??
        APP_COPY.diary.entryFallbackTitle;

      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open diary entry ${accessibleTitle}`}
          onPress={() => onPressEntry(item.entry, item.entryIndex)}
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.dateRow}>
            <Text style={[styles.when, { color: colors.mutedForeground }]}>
              {when}
            </Text>
          </View>

          <DiaryMedia entry={item.entry} />

          <View style={styles.copy}>
            {title ? (
              <Text
                style={[styles.title, { color: colors.cardForeground }]}
                numberOfLines={2}
              >
                {title}
              </Text>
            ) : null}
            {body ? (
              <Text
                style={[styles.body, { color: colors.cardForeground }]}
                numberOfLines={5}
              >
                {body}
              </Text>
            ) : null}
            <DiaryAttachments entry={item.entry} />
          </View>
        </Pressable>
      );
    },
    [colors, onPressEntry],
  );

  return (
    <FlatList
      data={rows}
      keyExtractor={item => item.id}
      renderItem={renderItem}
      style={styles.list}
      contentContainerStyle={[styles.listContent, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={ListEmptyComponent}
    />
  );
}

export const DiaryList = memo(DiaryListComponent);

const styles = StyleSheet.create({
  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 12,
  },
  monthHeader: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  monthHeaderSpaced: {
    marginTop: 26,
  },
  card: {
    borderRadius: CARD_RADIUS,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.13,
    shadowRadius: 16,
    elevation: 5,
  },
  dateRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  when: {
    fontSize: 13,
    fontWeight: '500',
  },
  mediaRow: {
    flexDirection: 'row',
    height: MEDIA_HEIGHT,
    gap: MEDIA_GAP,
    padding: 8,
  },
  mediaTile: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E8E8ED',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  moreMedia: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
  },
  moreMediaText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  copy: {
    gap: 7,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  title: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
  },
  attachmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: CAPTURE_BUTTON_THEMES.note.badgeBg,
  },
  attachmentText: {
    color: '#636366',
    fontSize: 12,
    fontWeight: '600',
  },
  moodGlassShadow: {
    flexBasis: '100%',
    marginTop: 4,
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.11,
        shadowRadius: 12,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  moodGlass: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  moodBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 10,
  },
  moodArt: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodArtImage: {
    width: 42,
    height: 42,
  },
  moodCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  moodLabel: {
    color: '#1C1C1E',
    fontSize: 14,
    fontWeight: '700',
  },
  moodReason: {
    color: '#3A3A3C',
    fontSize: 13,
    lineHeight: 18,
  },
  moodFallback: {
    flexShrink: 1,
    color: '#636366',
    fontSize: 12,
    fontWeight: '600',
  },
});
