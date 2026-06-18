import {useCallback, useEffect, useRef, useState, type ElementRef} from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Check, RefreshCw, RotateCcw, RotateCw, Square, Type, X, Zap, ZapOff} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
  usePhotoOutput,
  useVideoOutput,
  type Recorder,
} from 'react-native-vision-camera';
import ViewShot from 'react-native-view-shot';

import {FilteredCaptureImage} from '@/components/capture/FilteredCaptureImage';
import {MomentVideoPlayer} from '@/components/capture/MomentVideoPlayer';
import {CAPTURE_BUTTON_THEMES} from '@/components/map/map-capture-button-theme';
import {savePhotoMoment} from '@/lib/moments/capture-photo';
import {
  isVideoRecordingTooShort,
  saveVideoMoment,
} from '@/lib/moments/capture-video';
import {formatVoiceDurationMs} from '@/lib/moments/format-voice-duration';
import {VIDEO_MAX_DURATION_MS} from '@/lib/moments/media-compress-config';
import {normalizeCameraPhoto} from '@/lib/moments/normalize-camera-photo';
import {
  captureFilteredPhotoUri,
  PHOTO_FILTER_OPTIONS,
  type PhotoFilterId,
} from '@/lib/moments/photo-filters';
import type {RootStackParamList} from '@/navigation/types';

const FILTER_THUMB_SIZE = 52;
const SELECTED_BORDER_COLOR = CAPTURE_BUTTON_THEMES.camera.icon;

type CaptureFlashMode = 'off' | 'auto' | 'on';

const FLASH_MODES: CaptureFlashMode[] = ['off', 'auto', 'on'];

function nextFlashMode(current: CaptureFlashMode): CaptureFlashMode {
  const index = FLASH_MODES.indexOf(current);
  return FLASH_MODES[(index + 1) % FLASH_MODES.length];
}

function flashAccessibilityLabel(mode: CaptureFlashMode): string {
  switch (mode) {
    case 'off':
      return 'Flash off';
    case 'auto':
      return 'Flash auto';
    case 'on':
      return 'Flash on';
  }
}

function flashButtonLabel(mode: CaptureFlashMode): string {
  switch (mode) {
    case 'off':
      return 'Off';
    case 'auto':
      return 'Auto';
    case 'on':
      return 'On';
  }
}

type CaptureMode = 'photo' | 'video';

type PhotoDraft = {
  kind: 'photo';
  sourceUri: string;
  sourceWidth: number;
  sourceHeight: number;
};

type VideoDraft = {
  kind: 'video';
  sourceUri: string;
  durationMs: number;
};

type MediaDraft = PhotoDraft | VideoDraft;

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
  const {width: windowWidth, height: windowHeight} = useWindowDimensions();
  const {hasPermission, requestPermission} = useCameraPermission();
  const {
    hasPermission: hasMicPermission,
    requestPermission: requestMicPermission,
  } = useMicrophonePermission();

  const [captureMode, setCaptureMode] = useState<CaptureMode>('photo');
  const [phase, setPhase] = useState<'camera' | 'review'>('camera');
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('back');
  const [draft, setDraft] = useState<MediaDraft | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<PhotoFilterId>('original');
  const [rotationSteps, setRotationSteps] = useState(0);
  const [flashMode, setFlashMode] = useState<CaptureFlashMode>('off');
  const [captionText, setCaptionText] = useState('');
  const [captionInputOpen, setCaptionInputOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{
    label: string;
    progress?: number;
  } | null>(null);

  const photoOutput = usePhotoOutput();
  const videoOutput = useVideoOutput({enableAudio: true});
  const exportShotRef = useRef<ElementRef<typeof ViewShot>>(null);
  const recorderRef = useRef<Recorder | null>(null);
  const recordingStartedAtRef = useRef(0);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const device = useCameraDevice(cameraPosition);

  useEffect(() => {
    if (!hasPermission) {
      void requestPermission();
    }
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    setFlashMode('off');
  }, [cameraPosition]);

  useEffect(() => {
    photoOutput.prepareSettings([
      {flashMode: 'off', enableShutterSound: true},
      {flashMode: 'auto', enableShutterSound: true},
      {flashMode: 'on', enableShutterSound: true},
    ]);
  }, [photoOutput]);

  const clearRecordingTimer = useCallback(() => {
    if (recordingIntervalRef.current != null) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }, []);

  const resetRecordingState = useCallback(() => {
    clearRecordingTimer();
    recorderRef.current = null;
    recordingStartedAtRef.current = 0;
    setIsRecording(false);
    setRecordingMs(0);
  }, [clearRecordingTimer]);

  useEffect(() => {
    return () => {
      clearRecordingTimer();
      void recorderRef.current?.cancelRecording();
    };
  }, [clearRecordingTimer]);

  const showFlashControl =
    captureMode === 'photo' &&
    device != null &&
    (device.hasFlash || cameraPosition === 'front');

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleRetake = useCallback(() => {
    resetRecordingState();
    setDraft(null);
    setSelectedFilter('original');
    setRotationSteps(0);
    setCaptionText('');
    setCaptionInputOpen(false);
    setPhase('camera');
  }, [resetRecordingState]);

  const handleDismissCaption = useCallback(() => {
    Keyboard.dismiss();
    setCaptionInputOpen(false);
  }, []);

  const handleRotatePhoto = useCallback(() => {
    setRotationSteps(current => (current + 1) % 4);
  }, []);

  const handleSelectCaptureMode = useCallback(
    (mode: CaptureMode) => {
      if (mode === captureMode) {
        return;
      }
      if (isRecording) {
        void recorderRef.current?.stopRecording();
      }
      resetRecordingState();
      setCaptureMode(mode);
    },
    [captureMode, isRecording, resetRecordingState],
  );

  const finishVideoRecording = useCallback(
    (filePath: string) => {
      const durationMs = Math.max(
        0,
        Date.now() - recordingStartedAtRef.current,
      );
      resetRecordingState();

      if (isVideoRecordingTooShort(durationMs)) {
        Alert.alert('Video too short', 'Hold record for at least half a second.');
        return;
      }

      setSelectedFilter('original');
      setDraft({
        kind: 'video',
        sourceUri: toFileUri(filePath),
        durationMs,
      });
      setPhase('review');
    },
    [resetRecordingState],
  );

  const handleVideoRecordingError = useCallback(
    (error: Error) => {
      resetRecordingState();
      Alert.alert(
        'Could not record video',
        error.message || 'Something went wrong.',
      );
    },
    [resetRecordingState],
  );

  const handleStartVideoRecording = useCallback(async () => {
    if (capturing || isRecording) {
      return;
    }

    if (!hasMicPermission) {
      const granted = await requestMicPermission();
      if (!granted) {
        Alert.alert(
          'Microphone access is required',
          'Allow microphone access to record video with sound.',
        );
        return;
      }
    }

    setCapturing(true);
    try {
      const recorder = await videoOutput.createRecorder({
        maxDuration: VIDEO_MAX_DURATION_MS / 1000,
      });
      recorderRef.current = recorder;
      recordingStartedAtRef.current = Date.now();
      setRecordingMs(0);
      setIsRecording(true);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingMs(Date.now() - recordingStartedAtRef.current);
      }, 250);

      await recorder.startRecording(
        filePath => finishVideoRecording(filePath),
        error => handleVideoRecordingError(error),
      );
    } catch (error) {
      resetRecordingState();
      Alert.alert(
        'Could not start recording',
        error instanceof Error ? error.message : 'Something went wrong.',
      );
    } finally {
      setCapturing(false);
    }
  }, [
    capturing,
    finishVideoRecording,
    handleVideoRecordingError,
    hasMicPermission,
    isRecording,
    requestMicPermission,
    resetRecordingState,
    videoOutput,
  ]);

  const handleStopVideoRecording = useCallback(async () => {
    if (!isRecording || recorderRef.current == null) {
      return;
    }
    setCapturing(true);
    try {
      await recorderRef.current.stopRecording();
    } catch (error) {
      resetRecordingState();
      Alert.alert(
        'Could not stop recording',
        error instanceof Error ? error.message : 'Something went wrong.',
      );
    } finally {
      setCapturing(false);
    }
  }, [isRecording, resetRecordingState]);

  const handleCapture = useCallback(async () => {
    if (capturing) {
      return;
    }
    setCapturing(true);
    try {
      const photoFile = await photoOutput.capturePhotoToFile(
        {
          flashMode,
          enableShutterSound: true,
        },
        {},
      );
      const normalized = await normalizeCameraPhoto(toFileUri(photoFile.filePath));
      setSelectedFilter('original');
      setDraft({
        kind: 'photo',
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
  }, [capturing, flashMode, photoOutput]);

  const handleSave = useCallback(async () => {
    if (saving || draft == null) {
      return;
    }
    setSaving(true);
    setSaveStatus(null);
    try {
      if (draft.kind === 'photo') {
        setSaveStatus({label: 'Saving…'});
        const filteredUri = await captureFilteredPhotoUri(
          exportShotRef,
          selectedFilter,
          draft.sourceUri,
          rotationSteps % 4 !== 0,
        );
        await savePhotoMoment(filteredUri, null, captionText);
      } else {
        await saveVideoMoment(draft.sourceUri, draft.durationMs, captionText, update => {
          setSaveStatus(update);
        });
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        draft.kind === 'photo' ? 'Could not save photo' : 'Could not save video',
        error instanceof Error ? error.message : 'Something went wrong.',
      );
    } finally {
      setSaving(false);
      setSaveStatus(null);
    }
  }, [captionText, draft, navigation, rotationSteps, saving, selectedFilter]);

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
          outputs={[photoOutput, videoOutput]}
          mirrorMode="off"
          enableNativeZoomGesture
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
            {isRecording ? (
              <View style={styles.recordingTimerPill}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingTimerText}>
                  {formatVoiceDurationMs(recordingMs)}
                </Text>
              </View>
            ) : showFlashControl ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={flashAccessibilityLabel(flashMode)}
                disabled={capturing}
                onPress={() => setFlashMode(current => nextFlashMode(current))}
                style={[styles.flashButton, capturing ? styles.disabled : null]}>
                {flashMode === 'off' ? (
                  <ZapOff size={20} color="#FFFFFF" strokeWidth={2.25} />
                ) : (
                  <Zap
                    size={20}
                    color={flashMode === 'on' ? '#FFD60A' : '#FFFFFF'}
                    fill={flashMode === 'on' ? '#FFD60A' : 'transparent'}
                    strokeWidth={2.25}
                  />
                )}
                <Text style={styles.flashButtonLabel}>
                  {flashButtonLabel(flashMode)}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.cameraTopSpacer} />
            )}
          </View>

          <View style={styles.cameraBottomSection}>
            <View style={styles.modeSwitchRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{selected: captureMode === 'photo'}}
                accessibilityLabel="Photo mode"
                disabled={capturing || isRecording}
                onPress={() => handleSelectCaptureMode('photo')}
                style={[
                  styles.modePill,
                  captureMode === 'photo' ? styles.modePillActive : null,
                ]}>
                <Text
                  style={[
                    styles.modePillLabel,
                    captureMode === 'photo' ? styles.modePillLabelActive : null,
                  ]}>
                  Photo
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{selected: captureMode === 'video'}}
                accessibilityLabel="Video mode"
                disabled={capturing || isRecording}
                onPress={() => handleSelectCaptureMode('video')}
                style={[
                  styles.modePill,
                  captureMode === 'video' ? styles.modePillActive : null,
                ]}>
                <Text
                  style={[
                    styles.modePillLabel,
                    captureMode === 'video' ? styles.modePillLabelActive : null,
                  ]}>
                  Video
                </Text>
              </Pressable>
            </View>

            <View style={styles.cameraBottomRow}>
              <View style={styles.cameraSideSlot} />
              {captureMode === 'photo' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Take photo"
                  disabled={capturing}
                  onPress={() => void handleCapture()}
                  style={[styles.shutterButton, capturing ? styles.disabled : null]}>
                  {capturing ? <ActivityIndicator color="#000000" /> : null}
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
                  disabled={capturing}
                  onPress={() =>
                    void (isRecording
                      ? handleStopVideoRecording()
                      : handleStartVideoRecording())
                  }
                  style={[
                    styles.shutterButton,
                    isRecording ? styles.shutterButtonRecording : null,
                    capturing ? styles.disabled : null,
                  ]}>
                  {isRecording ? (
                    <View style={styles.shutterStopIcon}>
                      <Square size={22} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />
                    </View>
                  ) : capturing ? (
                    <ActivityIndicator color="#FF3B30" />
                  ) : (
                    <View style={styles.shutterRecordIcon} />
                  )}
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Flip camera"
                disabled={capturing || isRecording}
                onPress={() =>
                  setCameraPosition(current => (current === 'back' ? 'front' : 'back'))
                }
                style={styles.iconButton}>
                <RefreshCw size={22} color="#FFFFFF" strokeWidth={2.25} />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (draft == null) {
    return null;
  }

  const isPhotoDraft = draft.kind === 'photo';
  const rotationDeg = isPhotoDraft ? (rotationSteps % 4) * 90 : 0;
  const isQuarterTurn = isPhotoDraft && rotationSteps % 2 === 1;
  const stageWidth = isQuarterTurn ? windowHeight : windowWidth;
  const stageHeight = isQuarterTurn ? windowWidth : windowHeight;

  return (
    <View style={styles.root}>
      {isPhotoDraft ? (
        <ViewShot
          ref={exportShotRef}
          style={StyleSheet.absoluteFill}
          collapsable={false}
          options={{format: 'jpg', quality: 1, result: 'tmpfile'}}>
          <View style={styles.photoStage}>
            <View
              style={[
                styles.photoStageInner,
                {
                  width: stageWidth,
                  height: stageHeight,
                  transform: [{rotate: `${rotationDeg}deg`}],
                },
              ]}>
              <FilteredCaptureImage
                uri={draft.sourceUri}
                filterId={selectedFilter}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            </View>
          </View>
        </ViewShot>
      ) : (
        <View style={styles.photoStage}>
          <MomentVideoPlayer
            uri={draft.sourceUri}
            style={StyleSheet.absoluteFill}
            repeat
          />
        </View>
      )}

      {saving ? (
        <View style={styles.savingOverlay}>
          <ActivityIndicator color="#FFFFFF" size="large" />
          {saveStatus?.label ? (
            <Text style={styles.savingStatusText}>{saveStatus.label}</Text>
          ) : null}
          {saveStatus?.progress != null ? (
            <Text style={styles.savingProgressText}>
              {Math.round(saveStatus.progress * 100)}%
            </Text>
          ) : null}
        </View>
      ) : null}

      <View pointerEvents="box-none" style={styles.reviewRoot}>
        {captionInputOpen ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss text editing"
            onPress={handleDismissCaption}
            style={styles.captionDismissBackdrop}
          />
        ) : (
          <View pointerEvents="box-none" style={styles.reviewSideToolsDock}>
            <View style={styles.reviewToolsDockRow}>
              {captionText.trim().length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit photo text"
                  disabled={saving}
                  onPress={() => setCaptionInputOpen(true)}
                  style={[styles.captionPreview, saving ? styles.disabled : null]}>
                  <Text numberOfLines={2} style={styles.captionPreviewText}>
                    {captionText.trim()}
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.captionPreviewSpacer} />
              )}
              <View style={styles.reviewSideToolsColumn}>
                {isPhotoDraft ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Rotate photo"
                    disabled={saving}
                    onPress={handleRotatePhoto}
                    style={[styles.sideToolButton, saving ? styles.disabled : null]}>
                    <RotateCw size={18} color="#FFFFFF" strokeWidth={2.25} />
                    <Text style={styles.sideToolButtonLabel}>Rotate</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add optional text"
                  disabled={saving}
                  onPress={() => setCaptionInputOpen(true)}
                  style={[styles.sideToolButton, saving ? styles.disabled : null]}>
                  <Type size={18} color="#FFFFFF" strokeWidth={2.25} />
                  <Text style={styles.sideToolButtonLabel}>Text</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        <KeyboardAvoidingView
          pointerEvents="box-none"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.reviewBottomDock}
          keyboardVerticalOffset={0}>
          <View
            style={[
              styles.reviewChrome,
              captionInputOpen ? styles.reviewChromeCaption : null,
              {paddingBottom: captionInputOpen ? 10 : insets.bottom + 8},
            ]}>
            {!captionInputOpen && isPhotoDraft ? (
              <PhotoFilterStrip
                sourceUri={draft.sourceUri}
                selectedFilter={selectedFilter}
                onSelectFilter={setSelectedFilter}
                disabled={saving}
              />
            ) : null}

            {captionInputOpen ? (
              <View style={styles.captionSection}>
                <TextInput
                  autoFocus
                  value={captionText}
                  onChangeText={setCaptionText}
                  placeholder="What a lovely day… (optional)"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  style={styles.captionInput}
                  returnKeyType="done"
                  blurOnSubmit
                  onSubmitEditing={handleDismissCaption}
                  multiline
                  maxLength={280}
                  editable={!saving}
                />
              </View>
            ) : null}

            {!captionInputOpen ? (
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
                  accessibilityLabel={isPhotoDraft ? 'Retake photo' : 'Retake video'}
                  disabled={saving}
                  onPress={handleRetake}
                  style={[styles.iconButton, saving ? styles.disabled : null]}>
                  <RotateCcw size={22} color="#FFFFFF" strokeWidth={2.25} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isPhotoDraft ? 'Save photo' : 'Save video'}
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
            ) : null}
          </View>
        </KeyboardAvoidingView>
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
  reviewRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  reviewSideToolsDock: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  reviewToolsDockRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  captionPreviewSpacer: {
    flex: 1,
  },
  captionPreview: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  captionPreviewText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  reviewSideToolsColumn: {
    gap: 10,
    alignItems: 'center',
  },
  sideToolButton: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  sideToolButtonLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  reviewBottomDock: {
    justifyContent: 'flex-end',
    zIndex: 2,
  },
  captionDismissBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  reviewChrome: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 14,
    gap: 12,
  },
  reviewChromeCaption: {
    backgroundColor: 'transparent',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingTop: 0,
    gap: 0,
  },
  photoStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  photoStageInner: {
    overflow: 'hidden',
  },
  cameraTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  cameraTopSpacer: {
    width: 44,
    height: 44,
  },
  flashButton: {
    minWidth: 44,
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  flashButtonLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  cameraBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
  },
  cameraBottomSection: {
    gap: 14,
  },
  modeSwitchRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 8,
    borderRadius: 999,
    padding: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modePill: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  modePillActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  modePillLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  modePillLabelActive: {
    color: '#FFFFFF',
  },
  recordingTimerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,59,48,0.85)',
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  recordingTimerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
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
  shutterButtonRecording: {
    borderColor: '#FF3B30',
    backgroundColor: 'rgba(255,59,48,0.15)',
  },
  shutterRecordIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FF3B30',
  },
  shutterStopIcon: {
    width: 30,
    height: 30,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
  },
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  savingStatusText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  savingProgressText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  filterStrip: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 16,
  },
  captionSection: {
    paddingHorizontal: 16,
  },
  captionInput: {
    width: '100%',
    minHeight: 44,
    maxHeight: 96,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    textAlignVertical: 'top',
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
