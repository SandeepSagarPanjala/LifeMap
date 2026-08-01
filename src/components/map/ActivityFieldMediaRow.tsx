import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { X } from 'phosphor-react-native/src/icons/X';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { ClipPath, Defs, G, Path } from 'react-native-svg';

import {
  PhotoTagsBar,
  type PhotoTagsStatus,
} from '@/components/capture/PhotoTagsBar';
import { Text } from '@/components/ui/text';
import {
  ACTIVITY_MAX_MEDIA_URIS,
  getActivityMediaUris,
  type ActivityFieldDefinition,
  type ActivityFieldValue,
} from '@/lib/activities/activity-definition';
import { momentImageUri } from '@/lib/moments/moment-media-uri';
import type { PhotoTagCandidate } from '@/lib/moments/moment-tags';

const PHOTO_STYLE = {
  backgroundColor: '#F0FDF4',
  borderColor: '#86EFAC',
  iconBackground: '#DCFCE7',
  iconColor: '#16A34A',
};

const BILL_STYLE = {
  backgroundColor: '#FFFBEB',
  borderColor: '#FDE68A',
  iconBackground: '#FEF3C7',
  iconColor: '#D97706',
};

const MEDIA_SQUARE_SIZE = 100;
const MEDIA_ICON_SIZE = 52;
const DUOTONE_OPACITY = 0.28;
const MEDIA_ROW_GAP = 12;

/** Phosphor Camera (duotone) — secondary fill + primary outline, viewBox 0 0 256 256 */
const CAMERA_DUOTONE_FILL =
  'M208 64h-32l-16-24H96L80 64H48a16 16 0 0 0-16 16v112a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16V80a16 16 0 0 0-16-16m-80 104a36 36 0 1 1 36-36 36 36 0 0 1-36 36';
const CAMERA_DUOTONE_OUTLINE =
  'M208 56h-27.72l-13.63-20.44A8 8 0 0 0 160 32H96a8 8 0 0 0-6.65 3.56L75.71 56H48a24 24 0 0 0-24 24v112a24 24 0 0 0 24 24h160a24 24 0 0 0 24-24V80a24 24 0 0 0-24-24m8 136a8 8 0 0 1-8 8H48a8 8 0 0 1-8-8V80a8 8 0 0 1 8-8h32a8 8 0 0 0 6.66-3.56L100.28 48h55.43l13.63 20.44A8 8 0 0 0 176 72h32a8 8 0 0 1 8 8ZM128 88a44 44 0 1 0 44 44 44.05 44.05 0 0 0-44-44m0 72a28 28 0 1 1 28-28 28 28 0 0 1-28 28';

/** Phosphor Images (duotone) — secondary fill + primary outline, viewBox 0 0 256 256 */
const IMAGES_DUOTONE_FILL =
  'M224 56v82.06l-23.72-23.72a8 8 0 0 0-11.31 0L163.31 140l-49.65-49.66a8 8 0 0 0-11.32 0L64 128.69V56a8 8 0 0 1 8-8h144a8 8 0 0 1 8 8';
const IMAGES_DUOTONE_OUTLINE =
  'M216 40H72a16 16 0 0 0-16 16v16H40a16 16 0 0 0-16 16v112a16 16 0 0 0 16 16h144a16 16 0 0 0 16-16v-16h16a16 16 0 0 0 16-16V56a16 16 0 0 0-16-16M72 56h144v62.75l-10.07-10.06a16 16 0 0 0-22.63 0l-20 20-44-44a16 16 0 0 0-22.62 0L72 109.37Zm112 144H40V88h16v80a16 16 0 0 0 16 16h112Zm32-32H72v-36l36-36 49.66 49.66a8 8 0 0 0 11.31 0L194.63 120 216 141.38zm-56-84a12 12 0 1 1 12 12 12 12 0 0 1-12-12';

type ActivityFieldMediaRowProps = {
  field: ActivityFieldDefinition;
  values: Record<string, ActivityFieldValue | undefined>;
  scanningFieldId: string | null;
  /** Field ids currently running on-device photo labeling. */
  taggingFieldIds?: ReadonlySet<string>;
  slotCount?: number;
  onOpenCamera: (field: ActivityFieldDefinition, slotIndex: number) => void;
  onOpenLibrary: (field: ActivityFieldDefinition, slotIndex: number) => void;
  onRemoveImage: (field: ActivityFieldDefinition, slotIndex: number) => void;
  onRemovePhotoTag?: (field: ActivityFieldDefinition, tag: string) => void;
};

function DiagonalSplitMediaControl({
  fieldId,
  label,
  palette,
  isScanning,
  onOpenCamera,
  onOpenLibrary,
}: {
  fieldId: string;
  label: string;
  palette: typeof PHOTO_STYLE;
  isScanning: boolean;
  onOpenCamera: () => void;
  onOpenLibrary: () => void;
}) {
  const size = MEDIA_SQUARE_SIZE;
  const iconOffset = (size - MEDIA_ICON_SIZE) / 2;
  const iconScale = MEDIA_ICON_SIZE / 256;
  const cameraNudge = -6;
  const libraryNudge = 6;
  const safeId = fieldId.replace(/[^a-zA-Z0-9_]/g, '_');
  const topLeftClipId = `media-tl-${safeId}`;
  const bottomRightClipId = `media-br-${safeId}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add ${label}`}
      accessibilityHint="Opens camera by default. Use accessibility actions for camera or photo library."
      accessibilityActions={[
        { name: 'openCamera', label: 'Open camera' },
        { name: 'openLibrary', label: 'Open photo library' },
      ]}
      disabled={isScanning}
      onAccessibilityAction={event => {
        const action = event.nativeEvent.actionName;
        if (action === 'openCamera' || action === 'activate') {
          onOpenCamera();
          return;
        }
        if (action === 'openLibrary') {
          onOpenLibrary();
        }
      }}
      onPress={event => {
        const { locationX, locationY } = event.nativeEvent;
        const diagonalY = size - locationX;
        if (locationY <= diagonalY) {
          onOpenCamera();
        } else {
          onOpenLibrary();
        }
      }}
      style={[
        styles.mediaControl,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
        },
      ]}
    >
      <Svg width={size} height={size} pointerEvents="none">
        <Defs>
          <ClipPath id={topLeftClipId}>
            <Path d={`M 0 0 L ${size} 0 L 0 ${size} Z`} fill="#FFFFFF" />
          </ClipPath>
          <ClipPath id={bottomRightClipId}>
            <Path
              d={`M ${size} 0 L ${size} ${size} L 0 ${size} Z`}
              fill="#FFFFFF"
            />
          </ClipPath>
        </Defs>

        <Path
          d={`M 0 0 L ${size} 0 L 0 ${size} Z`}
          fill={palette.iconBackground}
        />
        <Path
          d={`M ${size} 0 L ${size} ${size} L 0 ${size} Z`}
          fill={palette.backgroundColor}
        />

        <G clipPath={`url(#${topLeftClipId})`}>
          <G
            transform={`translate(${iconOffset + cameraNudge}, ${iconOffset + cameraNudge}) scale(${iconScale})`}
          >
            <Path
              d={CAMERA_DUOTONE_FILL}
              fill={palette.iconColor}
              opacity={DUOTONE_OPACITY}
            />
            <Path d={CAMERA_DUOTONE_OUTLINE} fill={palette.iconColor} />
          </G>
        </G>

        <G clipPath={`url(#${bottomRightClipId})`}>
          <G
            transform={`translate(${iconOffset + libraryNudge}, ${iconOffset + libraryNudge}) scale(${iconScale})`}
          >
            <Path
              d={IMAGES_DUOTONE_FILL}
              fill={palette.iconColor}
              opacity={DUOTONE_OPACITY}
            />
            <Path d={IMAGES_DUOTONE_OUTLINE} fill={palette.iconColor} />
          </G>
        </G>

        <Path
          d={`M 0 ${size} L ${size} 0`}
          stroke="rgba(255,255,255,0.95)"
          strokeWidth={1.5}
        />
      </Svg>

      {isScanning ? (
        <View style={styles.scanningOverlay} pointerEvents="none">
          <ActivityIndicator color={palette.iconColor} />
        </View>
      ) : null}
    </Pressable>
  );
}

function FilledMediaThumb({
  label,
  uri,
  palette,
  isScanning,
  onPressPreview,
  onRemove,
}: {
  label: string;
  uri: string;
  palette: typeof PHOTO_STYLE;
  isScanning: boolean;
  onPressPreview: () => void;
  onRemove: () => void;
}) {
  return (
    <View
      style={[
        styles.mediaControl,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Preview ${label}`}
        onPress={onPressPreview}
        style={styles.thumbPressable}
      >
        <Image
          source={{ uri: momentImageUri(uri) }}
          style={styles.previewImage}
          resizeMode="cover"
        />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${label}`}
        onPress={onRemove}
        hitSlop={8}
        style={styles.removeButton}
      >
        <X size={11} color="#FFFFFF" weight="bold" />
      </Pressable>

      {isScanning ? (
        <View style={styles.scanningOverlay}>
          <ActivityIndicator color={palette.iconColor} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * One media field as an optional row of up to 3 capture slots (photo or bill).
 */
export function ActivityFieldMediaRow({
  field,
  values,
  scanningFieldId,
  taggingFieldIds,
  slotCount = ACTIVITY_MAX_MEDIA_URIS,
  onOpenCamera,
  onOpenLibrary,
  onRemoveImage,
  onRemovePhotoTag,
}: ActivityFieldMediaRowProps) {
  const insets = useSafeAreaInsets();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const isPhoto = field.type === 'photo';
  const palette = isPhoto ? PHOTO_STYLE : BILL_STYLE;
  const uris = getActivityMediaUris(values[field.id]);
  const tags = (() => {
    const value = values[field.id];
    if (value?.type === 'photo' || value?.type === 'scan') {
      return value.tags ?? [];
    }
    return [];
  })();
  const isScanning = scanningFieldId === field.id;
  const slots = Math.max(1, Math.min(slotCount, ACTIVITY_MAX_MEDIA_URIS));

  const previewUri =
    previewIndex != null && previewIndex >= 0 && previewIndex < uris.length
      ? uris[previewIndex]!
      : null;
  const previewTags: PhotoTagCandidate[] = tags.map(label => ({
    label,
    confidence: 1,
  }));
  const previewTagStatus: PhotoTagsStatus =
    taggingFieldIds?.has(field.id)
      ? 'loading'
      : previewTags.length > 0
        ? 'ready'
        : 'idle';

  return (
    <>
      <View style={styles.block}>
        <Text style={styles.rowLabel} numberOfLines={2}>
          {field.label}
          {field.required ? ' *' : ''}
        </Text>
        <View style={styles.row}>
          {Array.from({ length: slots }, (_, slotIndex) => {
            const uri = uris[slotIndex] ?? null;
            const slotLabel =
              slotIndex === 0 ? field.label : `${field.label} ${slotIndex + 1}`;
            return (
              <View
                key={`${field.id}-${slotIndex}`}
                style={[
                  styles.fieldWrap,
                  slotIndex < slots - 1
                    ? { marginRight: MEDIA_ROW_GAP }
                    : null,
                ]}
              >
                {uri != null ? (
                  <FilledMediaThumb
                    label={slotLabel}
                    uri={uri}
                    palette={palette}
                    isScanning={isScanning}
                    onPressPreview={() => setPreviewIndex(slotIndex)}
                    onRemove={() => onRemoveImage(field, slotIndex)}
                  />
                ) : (
                  <DiagonalSplitMediaControl
                    fieldId={`${field.id}_${slotIndex}`}
                    label={slotLabel}
                    palette={palette}
                    isScanning={isScanning}
                    onOpenCamera={() => onOpenCamera(field, slotIndex)}
                    onOpenLibrary={() => onOpenLibrary(field, slotIndex)}
                  />
                )}
              </View>
            );
          })}
        </View>
      </View>

      <Modal
        visible={previewUri != null}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setPreviewIndex(null)}
      >
        <View style={styles.fullPreviewRoot}>
          {previewUri != null ? (
            <Image
              source={{ uri: momentImageUri(previewUri) }}
              style={styles.fullPreviewImage}
              resizeMode="cover"
            />
          ) : null}

          {field.type === 'photo' || field.type === 'scan' ? (
            <View
              pointerEvents="box-none"
              style={[styles.fullPreviewTags, { paddingTop: insets.top + 10 }]}
            >
              <PhotoTagsBar
                tags={previewTags}
                status={previewTagStatus}
                onRemoveTag={tag => {
                  onRemovePhotoTag?.(field, tag);
                }}
              />
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close preview"
            onPress={() => setPreviewIndex(null)}
            style={[styles.fullPreviewClose, { bottom: insets.bottom + 20 }]}
          >
            <X size={22} color="#FFFFFF" weight="bold" />
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

export function groupActivityFields(
  fields: ActivityFieldDefinition[],
): Array<
  | { kind: 'photoSlots'; field: ActivityFieldDefinition }
  | { kind: 'billSlots'; field: ActivityFieldDefinition }
  | { kind: 'field'; field: ActivityFieldDefinition }
> {
  const groups: Array<
    | { kind: 'photoSlots'; field: ActivityFieldDefinition }
    | { kind: 'billSlots'; field: ActivityFieldDefinition }
    | { kind: 'field'; field: ActivityFieldDefinition }
  > = [];

  for (const field of fields) {
    if (field.type === 'photo') {
      groups.push({ kind: 'photoSlots', field });
      continue;
    }
    if (field.type === 'scan') {
      groups.push({ kind: 'billSlots', field });
      continue;
    }
    groups.push({ kind: 'field', field });
  }

  return groups;
}

const styles = StyleSheet.create({
  block: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 6,
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3A3A3C',
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    alignSelf: 'stretch',
  },
  fieldWrap: {
    width: MEDIA_SQUARE_SIZE,
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
  },
  mediaControl: {
    width: MEDIA_SQUARE_SIZE,
    height: MEDIA_SQUARE_SIZE,
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanningOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullPreviewRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fullPreviewImage: {
    width: '100%',
    height: '100%',
  },
  fullPreviewTags: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  fullPreviewClose: {
    position: 'absolute',
    alignSelf: 'center',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
