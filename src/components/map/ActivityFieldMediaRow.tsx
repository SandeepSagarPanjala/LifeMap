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

import { Text } from '@/components/ui/text';
import type {
  ActivityFieldDefinition,
  ActivityFieldValue,
} from '@/lib/activities/activity-definition';
import { momentImageUri } from '@/lib/moments/moment-media-uri';

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

const MEDIA_SQUARE_SIZE = 112;
const MEDIA_ICON_SIZE = 60;
const DUOTONE_OPACITY = 0.28;
const MEDIA_ROW_GAP = 20;

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
  fields: ActivityFieldDefinition[];
  values: Record<string, ActivityFieldValue | undefined>;
  scanningFieldId: string | null;
  onOpenCamera: (field: ActivityFieldDefinition) => void;
  onOpenLibrary: (field: ActivityFieldDefinition) => void;
  onRemoveImage: (field: ActivityFieldDefinition) => void;
};

function getStoredUri(
  field: ActivityFieldDefinition,
  values: Record<string, ActivityFieldValue | undefined>,
): string | null {
  const value = values[field.id];
  if (value == null) {
    return null;
  }
  if (field.type === 'photo' && value.type === 'photo') {
    return value.uri;
  }
  if (field.type === 'scan' && value.type === 'scan') {
    return value.uri;
  }
  return null;
}

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
  const cameraNudge = -8;
  const libraryNudge = 8;
  const safeId = fieldId.replace(/[^a-zA-Z0-9]/g, '');
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
        <View style={styles.scanningOverlay}>
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

export function ActivityFieldMediaRow({
  fields,
  values,
  scanningFieldId,
  onOpenCamera,
  onOpenLibrary,
  onRemoveImage,
}: ActivityFieldMediaRowProps) {
  const insets = useSafeAreaInsets();
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  if (fields.length === 0) {
    return null;
  }

  return (
    <>
      <View style={styles.row}>
        {fields.map((field, index) => {
          const isPhoto = field.type === 'photo';
          const palette = isPhoto ? PHOTO_STYLE : BILL_STYLE;
          const storedUri = getStoredUri(field, values);
          const hasImage = storedUri != null;
          const isScanning = scanningFieldId === field.id;
          const isLast = index === fields.length - 1;

          return (
            <View
              key={field.id}
              style={[
                styles.fieldWrap,
                !isLast ? { marginRight: MEDIA_ROW_GAP } : null,
              ]}
            >
              <Text style={styles.fieldLabel} numberOfLines={2}>
                {field.label}
                {field.required ? ' *' : ''}
              </Text>

              {hasImage ? (
                <FilledMediaThumb
                  label={field.label}
                  uri={storedUri}
                  palette={palette}
                  isScanning={isScanning}
                  onPressPreview={() => setPreviewUri(storedUri)}
                  onRemove={() => onRemoveImage(field)}
                />
              ) : (
                <DiagonalSplitMediaControl
                  fieldId={field.id}
                  label={field.label}
                  palette={palette}
                  isScanning={isScanning}
                  onOpenCamera={() => onOpenCamera(field)}
                  onOpenLibrary={() => onOpenLibrary(field)}
                />
              )}
            </View>
          );
        })}
      </View>

      <Modal
        visible={previewUri != null}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setPreviewUri(null)}
      >
        <View style={styles.fullPreviewRoot}>
          {previewUri != null ? (
            <Image
              source={{ uri: momentImageUri(previewUri) }}
              style={styles.fullPreviewImage}
              resizeMode="cover"
            />
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close preview"
            onPress={() => setPreviewUri(null)}
            style={[
              styles.fullPreviewClose,
              { bottom: insets.bottom + 20 },
            ]}
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
  | { kind: 'media'; fields: ActivityFieldDefinition[] }
  | { kind: 'field'; field: ActivityFieldDefinition }
> {
  const groups: Array<
    | { kind: 'media'; fields: ActivityFieldDefinition[] }
    | { kind: 'field'; field: ActivityFieldDefinition }
  > = [];
  let mediaRun: ActivityFieldDefinition[] = [];

  for (const field of fields) {
    if (field.type === 'photo' || field.type === 'scan') {
      mediaRun.push(field);
      continue;
    }
    if (mediaRun.length > 0) {
      groups.push({ kind: 'media', fields: mediaRun });
      mediaRun = [];
    }
    groups.push({ kind: 'field', field });
  }

  if (mediaRun.length > 0) {
    groups.push({ kind: 'media', fields: mediaRun });
  }

  return groups;
}

const styles = StyleSheet.create({
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
  fieldLabel: {
    width: MEDIA_SQUARE_SIZE,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#3A3A3C',
    textAlign: 'center',
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
    ...StyleSheet.absoluteFillObject,
  },
  removeButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.72)',
  },
  scanningOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  fullPreviewRoot: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullPreviewImage: {
    ...StyleSheet.absoluteFillObject,
  },
  fullPreviewClose: {
    position: 'absolute',
    right: 20,
    zIndex: 2,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
});
