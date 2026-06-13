import {useCallback, useEffect, useRef, useState, type ElementRef} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Check, RefreshCw, RotateCcw, X} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera';
import ViewShot from 'react-native-view-shot';

import {FilteredCaptureImage} from '@/components/capture/FilteredCaptureImage';
import {CAPTURE_BUTTON_THEMES} from '@/components/map/map-capture-button-theme';
import {savePhotoMoment} from '@/lib/moments/capture-photo';
import {normalizeCameraPhoto} from '@/lib/moments/normalize-camera-photo';
import {
  captureFilteredPhotoUri,
  PHOTO_FILTER_OPTIONS,
  type PhotoFilterId,
} from '@/lib/moments/photo-filters';
import type {RootStackParamList} from '@/navigation/types';

const FILTER_THUMB_SIZE = 52;
const SELECTED_BORDER_COLOR = CAPTURE_BUTTON_THEMES.camera.icon;

type PhotoDraft = {
  sourceUri: string;
  sourceWidth: number;
  sourceHeight: number;
};

function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

type PhotoFilterStripProps = {
  sourceUri: string;
  selectedFilter: PhotoFilterId;
  onSelectFilter: (filterId: PhotoFilterId) => void;
  disabled?: boolean;
};

function PhotoFilterStrip({
  sourceUri,
  selectedFilter,
  onSelectFilter,
  disabled = false,
}: PhotoFilterStripProps) {
  return (
    <View style={styles.filterStrip}>
      {PHOTO_FILTER_OPTIONS.map(option => {
        const selected = option.id === selectedFilter;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{selected}}
            disabled={disabled}
            onPress={() => onSelectFilter(option.id)}
            style={styles.filterChip}>
            <View
              style={[
                styles.filterThumb,
                selected ? styles.filterThumbSelected : styles.filterThumbIdle,
              ]}>
              <FilteredCaptureImage
                uri={sourceUri}
                filterId={option.id}
                width={FILTER_THUMB_SIZE}
                height={FILTER_THUMB_SIZE}
                resizeMode="cover"
              />
            </View>
            <Text
              style={[
                styles.filterChipLabel,
                selected ? styles.filterChipLabelSelected : null,
              ]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function CapturePhotoScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const {hasPermission, requestPermission} = useCameraPermission();

  const [phase, setPhase] = useState<'camera' | 'review'>('camera');
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('back');
  const [draft, setDraft] = useState<PhotoDraft | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<PhotoFilterId>('original');
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);

  const photoOutput = usePhotoOutput();
  const exportShotRef = useRef<ElementRef<typeof ViewShot>>(null);
  const device = useCameraDevice(cameraPosition);

  useEffect(() => {
    if (!hasPermission) {
      void requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleRetake = useCallback(() => {
    setDraft(null);
    setSelectedFilter('original');
    setPhase('camera');
  }, []);

  const handleCapture = useCallback(async () => {
    if (capturing) {
      return;
    }
    setCapturing(true);
    try {
      const photoFile = await photoOutput.capturePhotoToFile(
        {
          flashMode: 'off',
          enableShutterSound: true,
        },
        {},
      );
      const normalized = await normalizeCameraPhoto(toFileUri(photoFile.filePath));
      setSelectedFilter('original');
      setDraft({
        sourceUri: normalized.uri,
        sourceWidth: normalized.width,
        sourceHeight: normalized.height,
      });
      setPhase('review');
    } catch (error) {
      Alert.alert(
        'Could not take photo',
        error instanceof Error ? error.message : 'Something went wrong.',
      );
    } finally {
      setCapturing(false);
    }
  }, [capturing, photoOutput]);

  const handleSave = useCallback(async () => {
    if (saving || draft == null) {
      return;
    }
    setSaving(true);
    try {
      const filteredUri = await captureFilteredPhotoUri(
        exportShotRef,
        selectedFilter,
        draft.sourceUri,
      );
      await savePhotoMoment(filteredUri, null);
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        'Could not save photo',
        error instanceof Error ? error.message : 'Something went wrong.',
      );
    } finally {
      setSaving(false);
    }
  }, [draft, navigation, saving, selectedFilter]);

  if (!hasPermission) {
    return (
      <View style={[styles.root, styles.centered, {paddingTop: insets.top}]}>
        <Text style={styles.permissionText}>Camera access is required.</Text>
        <Pressable onPress={() => void requestPermission()} style={styles.permissionButton}>
          <Text style={styles.permissionButtonText}>Allow camera</Text>
        </Pressable>
        <Pressable onPress={handleClose} style={styles.permissionClose}>
          <Text style={styles.permissionCloseText}>Close</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'camera') {
    if (device == null) {
      return (
        <View style={[styles.root, styles.centered, {paddingTop: insets.top}]}>
          <Text style={styles.permissionText}>Camera is not available.</Text>
          <Pressable onPress={handleClose} style={styles.permissionClose}>
            <Text style={styles.permissionCloseText}>Close</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.root}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={phase === 'camera'}
          outputs={[photoOutput]}
          mirrorMode="off"
        />

        <View
          pointerEvents="box-none"
          style={[
            styles.cameraOverlay,
            {paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12},
          ]}>
          <View style={styles.cameraTopRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close camera"
              onPress={handleClose}
              style={styles.iconButton}>
              <X size={22} color="#FFFFFF" strokeWidth={2.25} />
            </Pressable>
          </View>

          <View style={styles.cameraBottomRow}>
            <View style={styles.cameraSideSlot} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Take photo"
              disabled={capturing}
              onPress={() => void handleCapture()}
              style={[styles.shutterButton, capturing ? styles.disabled : null]}>
              {capturing ? <ActivityIndicator color="#000000" /> : null}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Flip camera"
              disabled={capturing}
              onPress={() =>
                setCameraPosition(current => (current === 'back' ? 'front' : 'back'))
              }
              style={styles.iconButton}>
              <RefreshCw size={22} color="#FFFFFF" strokeWidth={2.25} />
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (draft == null) {
    return null;
  }

  return (
    <View style={styles.root}>
      <ViewShot
        ref={exportShotRef}
        style={StyleSheet.absoluteFill}
        collapsable={false}
        options={{format: 'jpg', quality: 1, result: 'tmpfile'}}>
        <FilteredCaptureImage
          uri={draft.sourceUri}
          filterId={selectedFilter}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      </ViewShot>

      {saving ? (
        <View style={styles.savingOverlay}>
          <ActivityIndicator color="#FFFFFF" size="large" />
        </View>
      ) : null}

      <View
        pointerEvents="box-none"
        style={[styles.reviewOverlay, {paddingBottom: insets.bottom + 8}]}>
        <View style={styles.reviewChrome}>
          <PhotoFilterStrip
            sourceUri={draft.sourceUri}
            selectedFilter={selectedFilter}
            onSelectFilter={setSelectedFilter}
            disabled={saving}
          />

          <View style={styles.reviewActionsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close without saving"
              disabled={saving}
              onPress={handleClose}
              style={[styles.iconButton, saving ? styles.disabled : null]}>
              <X size={22} color="#FFFFFF" strokeWidth={2.25} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retake photo"
              disabled={saving}
              onPress={handleRetake}
              style={[styles.iconButton, saving ? styles.disabled : null]}>
              <RotateCcw size={22} color="#FFFFFF" strokeWidth={2.25} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save photo"
              disabled={saving}
              onPress={() => void handleSave()}
              style={[styles.doneIconButton, saving ? styles.disabled : null]}>
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Check size={22} color="#FFFFFF" strokeWidth={2.5} />
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  permissionText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
  },
  permissionButton: {
    marginTop: 16,
    borderRadius: 999,
    backgroundColor: SELECTED_BORDER_COLOR,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  permissionClose: {
    marginTop: 16,
    padding: 8,
  },
  permissionCloseText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  reviewOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  reviewChrome: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 18,
    paddingBottom: 12,
    gap: 16,
  },
  cameraTopRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  cameraBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
  },
  cameraSideSlot: {
    width: 44,
    height: 44,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  doneIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SELECTED_BORDER_COLOR,
  },
  shutterButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  filterStrip: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 16,
  },
  filterChip: {
    alignItems: 'center',
    minWidth: FILTER_THUMB_SIZE,
  },
  filterThumb: {
    width: FILTER_THUMB_SIZE,
    height: FILTER_THUMB_SIZE,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  filterThumbIdle: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  filterThumbSelected: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: SELECTED_BORDER_COLOR,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  filterChipLabel: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.15,
    textAlign: 'center',
  },
  filterChipLabelSelected: {
    color: '#FFFFFF',
  },
  reviewActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 20,
  },
  disabled: {
    opacity: 0.5,
  },
});
