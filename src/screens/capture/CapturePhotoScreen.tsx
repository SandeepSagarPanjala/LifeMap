import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementRef,
} from 'react';
import { APP_COPY, errorMessageOr } from '@/lib/app-copy';
import {
  ActivityIndicator,
  Alert,
  AppState,
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Check,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Type,
  X,
  Zap,
  ZapOff,
  AudioLines,
  Pause,
  Play,
} from 'lucide-react-native';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
  usePhotoOutput,
  useVideoOutput,
  type CameraSessionConfig,
  type Constraint,
  type DeviceFilter,
  type Recorder,
} from 'react-native-vision-camera';
import { ResizeMode, type VideoRef } from 'react-native-video';
import ViewShot from 'react-native-view-shot';

import { CameraFocusIndicator } from '@/components/capture/CameraFocusIndicator';
import { CameraZoomBar } from '@/components/capture/CameraZoomBar';
import { FilteredCaptureImage } from '@/components/capture/FilteredCaptureImage';
import { MomentVideoPlayer } from '@/components/capture/MomentVideoPlayer';
import {
  PhotoTagsBar,
  type PhotoTagsStatus,
} from '@/components/capture/PhotoTagsBar';
import { VoiceMemoSheet } from '@/components/map/VoiceMemoSheet';
import { CAPTURE_BUTTON_THEMES } from '@/components/map/map-capture-button-theme';
import { savePhotoMoment } from '@/lib/moments/capture-photo';
import { labelPhotoTags } from '@/lib/moments/image-label-native';
import { labelVideoTags } from '@/lib/moments/label-video-tags';
import type { PhotoTagCandidate } from '@/lib/moments/moment-tags';
import {
  isVideoRecordingTooShort,
  saveVideoMoment,
} from '@/lib/moments/capture-video';
import { formatVoiceDurationMs } from '@/lib/moments/format-voice-duration';
import { deleteMomentContentFile } from '@/lib/moments/moment-storage';
import {
  createVoiceRecorderSession,
  getVoiceRecordingErrorMessage,
} from '@/lib/moments/voice-recorder';
import { VIDEO_MAX_DURATION_MS } from '@/lib/app-constants';
import { normalizeCameraPhoto } from '@/lib/moments/normalize-camera-photo';
import {
  captureFilteredPhotoUri,
  PHOTO_FILTER_OPTIONS,
  type PhotoFilterId,
} from '@/lib/moments/photo-filters';
import type { RootStackParamList } from '@/navigation/types';
import { releaseVoiceRecordingSession } from '@/lib/voice-audio-session';
import { useCameraControls } from './use-camera-controls';

/**
 * Ask for the multi-lens virtual device so the 0.5x/2x/3x optical lenses are
 * part of the session - the default filter would pick the plain wide-angle
 * camera, which can only zoom digitally.
 */
const BACK_LENS_FILTER: DeviceFilter = {
  physicalDevices: ['ultra-wide-angle', 'wide-angle', 'telephoto'],
};

/**
 * Frame rate the capture session is locked to.
 *
 * Without an explicit FPS constraint VisionCamera leaves the frame duration
 * untouched, so iOS is free to stretch exposure in dim scenes - indoors that
 * means frames exposed for an eighth of a second, which is what smears the
 * preview whenever the phone pans. Locking min/max frame duration caps exposure
 * at 1/30s: sharper motion for slightly more sensor noise.
 */
const CAPTURE_TARGET_FPS = 30;

const CAMERA_AUDIO_RELEASE_MS = 400;
const CAMERA_STOP_RELEASE_MS = 2500;
const CAMERA_PREVIEW_SETTLE_MS = 250;
const CAMERA_CAPTURE_RETRY_MS = 350;
const CAMERA_CAPTURE_MAX_ATTEMPTS = 3;

function isPhotoOutputNotReadyError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes(
      'PhotoOutput is not yet connected to the CameraSession',
    )
  );
}

function waitMs(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

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

type CameraShutdownIntent = 'close' | 'review';

function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

type PhotoFilterStripProps = {
  sourceUri: string;
  selectedFilter: PhotoFilterId;
  onSelectFilter: (filterId: PhotoFilterId) => void;
  disabled?: boolean;
};

const PhotoFilterStrip = memo(function PhotoFilterStrip({
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
            accessibilityState={{ selected }}
            disabled={disabled}
            onPress={() => onSelectFilter(option.id)}
            style={styles.filterChip}
          >
            <View
              style={[
                styles.filterThumb,
                selected ? styles.filterThumbSelected : styles.filterThumbIdle,
              ]}
            >
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
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

export function CapturePhotoScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { hasPermission, requestPermission } = useCameraPermission();
  const {
    hasPermission: hasMicPermission,
    requestPermission: requestMicPermission,
  } = useMicrophonePermission();

  const [captureMode, setCaptureMode] = useState<CaptureMode>('photo');
  const [phase, setPhase] = useState<'camera' | 'review'>('camera');
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>(
    'back',
  );
  const [draft, setDraft] = useState<MediaDraft | null>(null);
  const [selectedFilter, setSelectedFilter] =
    useState<PhotoFilterId>('original');
  const [rotationSteps, setRotationSteps] = useState(0);
  const [flashMode, setFlashMode] = useState<CaptureFlashMode>('off');
  const [captionText, setCaptionText] = useState('');
  const [captionInputOpen, setCaptionInputOpen] = useState(false);
  const [sceneTags, setSceneTags] = useState<PhotoTagCandidate[]>([]);
  const [sceneTagsStatus, setSceneTagsStatus] =
    useState<PhotoTagsStatus>('idle');
  const [reviewChromeVisible, setReviewChromeVisible] = useState(true);
  const [voiceUri, setVoiceUri] = useState<string | null>(null);
  const [voiceDurationMs, setVoiceDurationMs] = useState(0);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const [voiceSheetOpen, setVoiceSheetOpen] = useState(false);
  const voicePlayerRef = useRef(createVoiceRecorderSession());
  const [capturing, setCapturing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{
    label: string;
    progress?: number;
  } | null>(null);

  const photoOutput = usePhotoOutput();
  const videoOutput = useVideoOutput({ enableAudio: captureMode === 'video' });
  // Stable outputs array so the live Camera doesn't get a new prop every render.
  const cameraOutputs = useMemo(
    () =>
      captureMode === 'video' ? [photoOutput, videoOutput] : [photoOutput],
    [captureMode, photoOutput, videoOutput],
  );
  // VisionCamera appends one resolution bias per output after these, so
  // anything listed here outranks resolution when it picks a format. The photo
  // bias is repeated first on purpose: still resolution stays the top priority,
  // and everything below only breaks ties between formats that can already
  // deliver it.
  const cameraConstraints = useMemo<Constraint[]>(() => {
    const constraints: Constraint[] = [
      { resolutionBias: photoOutput },
      { fps: CAPTURE_TARGET_FPS },
      // Handheld preview shake, smoothed with the low-latency algorithm so the
      // viewfinder stays in sync with the phone.
      { previewStabilizationMode: 'preview-optimized' },
    ];
    if (captureMode === 'video') {
      constraints.push({ videoStabilizationMode: 'standard' });
    }
    return constraints;
  }, [captureMode, photoOutput]);

  const handleSessionConfigSelected = useCallback(
    (config: CameraSessionConfig) => {
      if (!__DEV__) {
        return;
      }
      // Which format the constraints actually resolved to is device-specific,
      // so log it rather than assume the negotiation went our way.
      console.log('[camera] session config', {
        fps: config.selectedFPS,
        previewStabilization: config.selectedPreviewStabilizationMode,
        videoStabilization: config.selectedVideoStabilizationMode,
        pixelFormat: config.nativePixelFormat,
        autoFocusSystem: config.autoFocusSystem,
        isBinned: config.isBinned,
      });
    },
    [],
  );
  const exportShotRef = useRef<ElementRef<typeof ViewShot>>(null);
  const recorderRef = useRef<Recorder | null>(null);
  // Recording time is tracked in segments so pauses don't inflate the duration:
  // whatever earlier segments captured, plus the segment that is running now.
  const recordedBeforePauseRef = useRef(0);
  const segmentStartedAtRef = useRef(0);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const cameraReadyFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const cameraCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const cameraPreviewStoppedRef = useRef(false);
  const cameraLeavingRef = useRef(false);
  const cameraShutdownIntentRef = useRef<CameraShutdownIntent | null>(null);
  const cameraShutdownCompletedRef = useRef(false);
  const pendingReviewDraftRef = useRef<MediaDraft | null>(null);
  const allowScreenRemoveRef = useRef(false);
  const [cameraLeaving, setCameraLeaving] = useState(false);
  const [cameraBackgroundPaused, setCameraBackgroundPaused] = useState(false);
  const [reviewPlaybackPaused, setReviewPlaybackPaused] = useState(false);
  const [reviewVideoEnded, setReviewVideoEnded] = useState(false);
  const reviewVideoRef = useRef<VideoRef>(null);
  const device = useCameraDevice(
    cameraPosition,
    cameraPosition === 'back' ? BACK_LENS_FILTER : undefined,
  );
  const {
    zoomRange,
    zoom: cameraZoom,
    gesture: cameraGesture,
    focusPoint,
    selectDisplayZoom,
    restoreZoom,
  } = useCameraControls(device, !cameraLeaving);

  const markCameraReady = useCallback(() => {
    if (cameraReadyFallbackRef.current != null) {
      clearTimeout(cameraReadyFallbackRef.current);
      cameraReadyFallbackRef.current = null;
    }
    setCameraReady(true);
  }, []);

  const handleCameraStarted = useCallback(() => {
    markCameraReady();
    restoreZoom();
  }, [markCameraReady, restoreZoom]);

  const markCameraNotReady = useCallback(() => {
    setCameraReady(false);
  }, []);

  const clearCameraCloseTimeout = useCallback(() => {
    if (cameraCloseTimeoutRef.current != null) {
      clearTimeout(cameraCloseTimeoutRef.current);
      cameraCloseTimeoutRef.current = null;
    }
  }, []);

  const completeScreenClose = useCallback(() => {
    clearCameraCloseTimeout();
    // Keep cameraLeaving true until unmount so isActive stays false during pop.
    allowScreenRemoveRef.current = true;
    navigation.goBack();
  }, [clearCameraCloseTimeout, navigation]);

  const completeCameraShutdown = useCallback(() => {
    if (cameraShutdownCompletedRef.current) {
      return;
    }
    const intent = cameraShutdownIntentRef.current;
    if (intent == null) {
      return;
    }
    cameraShutdownCompletedRef.current = true;
    clearCameraCloseTimeout();
    cameraShutdownIntentRef.current = null;

    if (intent === 'review') {
      const pendingDraft = pendingReviewDraftRef.current;
      pendingReviewDraftRef.current = null;
      cameraLeavingRef.current = false;
      setCameraLeaving(false);
      if (pendingDraft != null) {
        setDraft(pendingDraft);
        setPhase('review');
      }
      return;
    }

    completeScreenClose();
  }, [clearCameraCloseTimeout, completeScreenClose]);

  const beginCameraShutdown = useCallback(
    (intent: CameraShutdownIntent, reviewDraft?: MediaDraft) => {
      if (cameraShutdownIntentRef.current != null) {
        return;
      }
      setCameraBackgroundPaused(false);
      cameraLeavingRef.current = true;
      cameraPreviewStoppedRef.current = false;
      cameraShutdownCompletedRef.current = false;
      cameraShutdownIntentRef.current = intent;
      pendingReviewDraftRef.current =
        intent === 'review' ? reviewDraft ?? null : null;
      setCameraLeaving(true);
      clearCameraCloseTimeout();
      cameraCloseTimeoutRef.current = setTimeout(() => {
        if (cameraPreviewStoppedRef.current) {
          return;
        }
        completeCameraShutdown();
      }, CAMERA_STOP_RELEASE_MS);
    },
    [clearCameraCloseTimeout, completeCameraShutdown],
  );

  const beginCameraShutdownAndClose = useCallback(() => {
    beginCameraShutdown('close');
  }, [beginCameraShutdown]);

  const beginCameraShutdownForReview = useCallback(
    (reviewDraft: MediaDraft) => {
      beginCameraShutdown('review', reviewDraft);
    },
    [beginCameraShutdown],
  );

  const handlePreviewStopped = useCallback(() => {
    markCameraNotReady();
    if (!cameraLeavingRef.current) {
      return;
    }
    cameraPreviewStoppedRef.current = true;
    clearCameraCloseTimeout();
    cameraCloseTimeoutRef.current = setTimeout(() => {
      completeCameraShutdown();
    }, CAMERA_PREVIEW_SETTLE_MS);
  }, [clearCameraCloseTimeout, completeCameraShutdown, markCameraNotReady]);

  const isCameraMounted = hasPermission && phase === 'camera' && device != null;

  useFocusEffect(
    useCallback(() => {
      allowScreenRemoveRef.current = false;
      cameraLeavingRef.current = false;
      cameraShutdownIntentRef.current = null;
      cameraShutdownCompletedRef.current = false;
      pendingReviewDraftRef.current = null;
      setCameraLeaving(false);
      setCameraBackgroundPaused(false);
      return () => {
        clearCameraCloseTimeout();
      };
    }, [clearCameraCloseTimeout]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'background') {
        if (phase === 'review') {
          setReviewPlaybackPaused(true);
        }
        if (phase === 'camera' && cameraShutdownIntentRef.current == null) {
          setCameraBackgroundPaused(true);
        }
        return;
      }
      if (nextState === 'inactive') {
        if (phase === 'review') {
          setReviewPlaybackPaused(true);
        }
        if (phase === 'camera' && cameraShutdownIntentRef.current == null) {
          setCameraBackgroundPaused(true);
        }
        return;
      }
      if (nextState === 'active') {
        if (phase === 'review') {
          setReviewPlaybackPaused(false);
        }
        if (phase === 'camera' && cameraShutdownIntentRef.current == null) {
          setCameraBackgroundPaused(false);
        }
      }
    });
    return () => subscription.remove();
  }, [phase]);

  useEffect(() => {
    setCameraReady(false);
    setCapturing(false);
    if (cameraReadyFallbackRef.current != null) {
      clearTimeout(cameraReadyFallbackRef.current);
    }
    cameraReadyFallbackRef.current = setTimeout(() => {
      setCameraReady(true);
      cameraReadyFallbackRef.current = null;
    }, 2500);
    return () => {
      if (cameraReadyFallbackRef.current != null) {
        clearTimeout(cameraReadyFallbackRef.current);
        cameraReadyFallbackRef.current = null;
      }
    };
  }, [cameraPosition, captureMode, phase]);

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
      { flashMode: 'off', enableShutterSound: true },
      { flashMode: 'auto', enableShutterSound: true },
      { flashMode: 'on', enableShutterSound: true },
    ]);
  }, [photoOutput]);

  const clearRecordingTimer = useCallback(() => {
    if (recordingIntervalRef.current != null) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }, []);

  const recordedDurationMs = useCallback(() => {
    const runningSegmentMs =
      segmentStartedAtRef.current === 0
        ? 0
        : Date.now() - segmentStartedAtRef.current;
    return Math.max(0, recordedBeforePauseRef.current + runningSegmentMs);
  }, []);

  const startRecordingTimer = useCallback(() => {
    clearRecordingTimer();
    recordingIntervalRef.current = setInterval(() => {
      setRecordingMs(recordedDurationMs());
    }, 250);
  }, [clearRecordingTimer, recordedDurationMs]);

  const resetRecordingState = useCallback(() => {
    clearRecordingTimer();
    recorderRef.current = null;
    recordedBeforePauseRef.current = 0;
    segmentStartedAtRef.current = 0;
    setIsRecording(false);
    setRecordingPaused(false);
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

  useEffect(() => {
    if (phase !== 'review' || draft?.kind !== 'photo') {
      return;
    }
    const timer = setTimeout(() => {
      void releaseVoiceRecordingSession();
    }, CAMERA_AUDIO_RELEASE_MS);
    return () => clearTimeout(timer);
  }, [draft?.kind, phase]);

  useEffect(() => {
    if (phase === 'review' && draft?.kind === 'video') {
      setReviewPlaybackPaused(AppState.currentState !== 'active');
      setReviewVideoEnded(false);
    }
  }, [draft?.kind, draft?.sourceUri, phase]);

  const reviewPhotoUri =
    phase === 'review' && draft?.kind === 'photo' ? draft.sourceUri : null;
  const reviewVideoUri =
    phase === 'review' && draft?.kind === 'video' ? draft.sourceUri : null;
  const reviewVideoDurationMs =
    phase === 'review' && draft?.kind === 'video' ? draft.durationMs : null;

  useEffect(() => {
    if (!reviewPhotoUri) {
      return;
    }
    let cancelled = false;
    setSceneTags([]);
    setSceneTagsStatus('loading');
    void labelPhotoTags(reviewPhotoUri).then(tags => {
      if (cancelled) {
        return;
      }
      setSceneTags(tags);
      setSceneTagsStatus('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [reviewPhotoUri]);

  useEffect(() => {
    if (!reviewVideoUri || reviewVideoDurationMs == null) {
      return;
    }
    let cancelled = false;
    setSceneTags([]);
    setSceneTagsStatus('loading');
    void labelVideoTags(reviewVideoUri, reviewVideoDurationMs).then(tags => {
      if (cancelled) {
        return;
      }
      setSceneTags(tags);
      setSceneTagsStatus('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [reviewVideoDurationMs, reviewVideoUri]);

  const handleRemoveSceneTag = useCallback((tag: string) => {
    setSceneTags(current => current.filter(item => item.label !== tag));
  }, []);

  const handleToggleReviewChrome = useCallback(() => {
    if (saving || captionInputOpen) {
      return;
    }
    setReviewChromeVisible(current => !current);
  }, [captionInputOpen, saving]);

  const handleReplayReviewVideo = useCallback(() => {
    reviewVideoRef.current?.seek(0);
    setReviewVideoEnded(false);
    setReviewPlaybackPaused(false);
  }, []);

  const handleReviewVideoEnded = useCallback(() => {
    setReviewVideoEnded(true);
  }, []);

  const handleOpenVoiceSheet = useCallback(() => {
    void (async () => {
      setReviewChromeVisible(true);
      await releaseVoiceRecordingSession().catch(() => undefined);
      setVoiceSheetOpen(true);
    })();
  }, []);

  const handleOpenCaption = useCallback(() => {
    setReviewChromeVisible(true);
    setCaptionInputOpen(true);
  }, []);

  useEffect(() => {
    const voicePlayer = voicePlayerRef.current;
    return () => {
      void voicePlayer.dispose();
    };
  }, []);

  const clearVoice = useCallback(async () => {
    await voicePlayerRef.current.stopPreview();
    setVoicePlaying(false);
    if (voiceUri) {
      await deleteMomentContentFile(voiceUri);
    }
    setVoiceUri(null);
    setVoiceDurationMs(0);
  }, [voiceUri]);

  const runCloseCleanup = useCallback(async () => {
    await clearVoice();
    if (isRecording && recorderRef.current != null) {
      try {
        await recorderRef.current.cancelRecording();
      } catch {
        // Not recording.
      }
      resetRecordingState();
    }
  }, [clearVoice, isRecording, resetRecordingState]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', event => {
      if (allowScreenRemoveRef.current || !isCameraMounted) {
        return;
      }
      event.preventDefault();
      void (async () => {
        await runCloseCleanup();
        beginCameraShutdownAndClose();
      })();
    });
    return unsubscribe;
  }, [
    beginCameraShutdownAndClose,
    isCameraMounted,
    navigation,
    runCloseCleanup,
  ]);

  const toggleVoicePreview = useCallback(async () => {
    if (!voiceUri) {
      return;
    }
    try {
      if (voicePlaying) {
        await voicePlayerRef.current.pausePreview();
        setVoicePlaying(false);
        return;
      }
      await voicePlayerRef.current.startPreview(voiceUri);
      setVoicePlaying(true);
    } catch (error) {
      Alert.alert(
        APP_COPY.alerts.couldNotPlayRecording,
        getVoiceRecordingErrorMessage(error),
      );
    }
  }, [voicePlaying, voiceUri]);

  const handleClose = useCallback(() => {
    if (cameraLeavingRef.current) {
      return;
    }
    void (async () => {
      await runCloseCleanup();
      if (!isCameraMounted) {
        navigation.goBack();
        return;
      }
      beginCameraShutdownAndClose();
    })();
  }, [
    beginCameraShutdownAndClose,
    isCameraMounted,
    navigation,
    runCloseCleanup,
  ]);

  const handleRetake = useCallback(() => {
    resetRecordingState();
    void clearVoice();
    cameraLeavingRef.current = false;
    cameraShutdownIntentRef.current = null;
    cameraShutdownCompletedRef.current = false;
    pendingReviewDraftRef.current = null;
    clearCameraCloseTimeout();
    setCameraLeaving(false);
    setCameraBackgroundPaused(false);
    setReviewVideoEnded(false);
    setReviewPlaybackPaused(false);
    setDraft(null);
    setSelectedFilter('original');
    setRotationSteps(0);
    setCaptionText('');
    setCaptionInputOpen(false);
    setSceneTags([]);
    setSceneTagsStatus('idle');
    setReviewChromeVisible(true);
    setSaving(false);
    setSaveStatus(null);
    setPhase('camera');
  }, [clearCameraCloseTimeout, clearVoice, resetRecordingState]);

  const handleDismissCaption = useCallback(() => {
    Keyboard.dismiss();
    setCaptionInputOpen(false);
  }, []);

  const clearCaption = useCallback(() => {
    Keyboard.dismiss();
    setCaptionText('');
    setCaptionInputOpen(false);
  }, []);

  const handleRotatePhoto = useCallback(() => {
    setRotationSteps(current => (current + 1) % 4);
  }, []);

  const handleSelectCaptureMode = useCallback(
    (mode: CaptureMode) => {
      if (cameraLeavingRef.current || mode === captureMode) {
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
      const durationMs = recordedDurationMs();
      resetRecordingState();

      if (isVideoRecordingTooShort(durationMs)) {
        Alert.alert(
          'Video too short',
          'Hold record for at least half a second.',
        );
        return;
      }

      setSelectedFilter('original');
      beginCameraShutdownForReview({
        kind: 'video',
        sourceUri: toFileUri(filePath),
        durationMs,
      });
    },
    [beginCameraShutdownForReview, recordedDurationMs, resetRecordingState],
  );

  const handleVideoRecordingError = useCallback(
    (error: Error) => {
      resetRecordingState();
      Alert.alert(APP_COPY.alerts.couldNotRecordVideo, errorMessageOr(error));
    },
    [resetRecordingState],
  );

  const handleRecordingPaused = useCallback(() => {
    // Bank the segment that just ended so the timer holds still while paused.
    recordedBeforePauseRef.current = recordedDurationMs();
    segmentStartedAtRef.current = 0;
    clearRecordingTimer();
    setRecordingMs(recordedBeforePauseRef.current);
    setRecordingPaused(true);
  }, [clearRecordingTimer, recordedDurationMs]);

  const handleRecordingResumed = useCallback(() => {
    segmentStartedAtRef.current = Date.now();
    setRecordingPaused(false);
    startRecordingTimer();
  }, [startRecordingTimer]);

  const handleStartVideoRecording = useCallback(async () => {
    if (cameraLeavingRef.current || capturing || isRecording) {
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
      recordedBeforePauseRef.current = 0;
      segmentStartedAtRef.current = Date.now();
      setRecordingMs(0);
      setIsRecording(true);
      setRecordingPaused(false);
      startRecordingTimer();

      await recorder.startRecording(
        filePath => finishVideoRecording(filePath),
        error => handleVideoRecordingError(error),
        // The recorder confirms pause/resume asynchronously, so the UI follows
        // these callbacks rather than the button press.
        handleRecordingPaused,
        handleRecordingResumed,
      );
    } catch (error) {
      resetRecordingState();
      Alert.alert(
        APP_COPY.alerts.couldNotStartRecording,
        errorMessageOr(error),
      );
    } finally {
      setCapturing(false);
    }
  }, [
    capturing,
    finishVideoRecording,
    handleRecordingPaused,
    handleRecordingResumed,
    handleVideoRecordingError,
    hasMicPermission,
    isRecording,
    requestMicPermission,
    resetRecordingState,
    startRecordingTimer,
    videoOutput,
  ]);

  const handleToggleRecordingPause = useCallback(async () => {
    const recorder = recorderRef.current;
    if (cameraLeavingRef.current || !isRecording || recorder == null) {
      return;
    }
    try {
      if (recordingPaused) {
        await recorder.resumeRecording();
      } else {
        await recorder.pauseRecording();
      }
    } catch (error) {
      Alert.alert(
        recordingPaused
          ? APP_COPY.alerts.couldNotResumeRecording
          : APP_COPY.alerts.couldNotPauseRecording,
        errorMessageOr(error),
      );
    }
  }, [isRecording, recordingPaused]);

  const handleStopVideoRecording = useCallback(async () => {
    if (
      cameraLeavingRef.current ||
      !isRecording ||
      recorderRef.current == null
    ) {
      return;
    }
    setCapturing(true);
    try {
      await recorderRef.current.stopRecording();
    } catch (error) {
      resetRecordingState();
      Alert.alert(APP_COPY.alerts.couldNotStopRecording, errorMessageOr(error));
    } finally {
      setCapturing(false);
    }
  }, [isRecording, resetRecordingState]);

  const handleCapture = useCallback(async () => {
    if (cameraLeavingRef.current || capturing) {
      return;
    }
    setCapturing(true);
    try {
      let photoFile: Awaited<
        ReturnType<typeof photoOutput.capturePhotoToFile>
      > | null = null;
      for (
        let attempt = 0;
        attempt < CAMERA_CAPTURE_MAX_ATTEMPTS;
        attempt += 1
      ) {
        try {
          photoFile = await photoOutput.capturePhotoToFile(
            {
              flashMode,
              enableShutterSound: true,
            },
            {},
          );
          break;
        } catch (error) {
          const canRetry =
            attempt < CAMERA_CAPTURE_MAX_ATTEMPTS - 1 &&
            isPhotoOutputNotReadyError(error);
          if (!canRetry) {
            throw error;
          }
          await waitMs(CAMERA_CAPTURE_RETRY_MS);
        }
      }
      if (photoFile == null) {
        throw new Error('Camera is still starting. Try again in a moment.');
      }
      const normalized = await normalizeCameraPhoto(
        toFileUri(photoFile.filePath),
      );
      setSelectedFilter('original');
      beginCameraShutdownForReview({
        kind: 'photo',
        sourceUri: normalized.uri,
        sourceWidth: normalized.width,
        sourceHeight: normalized.height,
      });
    } catch (error) {
      Alert.alert(APP_COPY.alerts.couldNotTakePhoto, errorMessageOr(error));
    } finally {
      setCapturing(false);
    }
  }, [beginCameraShutdownForReview, capturing, flashMode, photoOutput]);

  const handleSave = useCallback(async () => {
    if (saving || draft == null) {
      return;
    }
    setSaving(true);
    setSaveStatus(null);
    try {
      if (draft.kind === 'photo') {
        setSaveStatus({ label: 'Saving…' });
        const filteredUri = await captureFilteredPhotoUri(
          exportShotRef,
          selectedFilter,
          draft.sourceUri,
          rotationSteps % 4 !== 0,
        );
        await savePhotoMoment(
          filteredUri,
          null,
          captionText,
          voiceUri ? { uri: voiceUri, durationMs: voiceDurationMs } : null,
          sceneTags.map(tag => tag.label),
        );
      } else {
        await saveVideoMoment(
          draft.sourceUri,
          draft.durationMs,
          captionText,
          update => {
            setSaveStatus(update);
          },
          sceneTags.map(tag => tag.label),
        );
      }
      try {
        await voicePlayerRef.current.stopPreview();
      } catch {
        // Preview may not be active; saving already succeeded.
      }
      setVoicePlaying(false);
      // Stay in camera so the user can capture more; X closes when done.
      handleRetake();
    } catch (error) {
      Alert.alert(
        draft.kind === 'photo'
          ? APP_COPY.alerts.couldNotSavePhoto
          : APP_COPY.alerts.couldNotSaveVideo,
        errorMessageOr(error),
      );
    } finally {
      setSaving(false);
      setSaveStatus(null);
    }
  }, [
    captionText,
    draft,
    handleRetake,
    sceneTags,
    rotationSteps,
    saving,
    selectedFilter,
    voiceDurationMs,
    voiceUri,
  ]);

  if (!hasPermission) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.permissionText}>Camera access is required.</Text>
        <Pressable
          onPress={() => void requestPermission()}
          style={styles.permissionButton}
        >
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
        <View
          style={[styles.root, styles.centered, { paddingTop: insets.top }]}
        >
          <Text style={styles.permissionText}>Camera is not available.</Text>
          <Pressable onPress={handleClose} style={styles.permissionClose}>
            <Text style={styles.permissionCloseText}>Close</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.root}>
        {/*
          The pinch handler wraps the preview instead of covering it so that
          taps still reach the Camera's own tap-to-focus recognizer underneath.

          No `key` on the Camera on purpose: VisionCamera reconfigures the live
          AVCaptureSession when `device`/`outputs` change. Remounting instead
          would leave the outgoing session and the incoming one briefly sharing
          the same photo/video outputs, which crashes AVFoundation on teardown.
        */}
        <GestureDetector gesture={cameraGesture}>
          <View style={styles.cameraGestureLayer} collapsable={false}>
            <Camera
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={
                phase === 'camera' && !cameraLeaving && !cameraBackgroundPaused
              }
              outputs={cameraOutputs}
              constraints={cameraConstraints}
              onSessionConfigSelected={handleSessionConfigSelected}
              zoom={cameraZoom}
              enableNativeTapToFocusGesture
              // Selfies behave like a mirror: the preview and the saved
              // photo/video are both flipped, so moving left moves left and
              // what you framed is what you keep.
              mirrorMode={cameraPosition === 'front' ? 'on' : 'off'}
              // The capture UI is portrait-locked, so follow the interface
              // instead of the physical device - otherwise tilting the phone
              // rotates the captured file away from the framing shown in the
              // preview.
              orientationSource="interface"
              onPreviewStarted={markCameraReady}
              onStarted={handleCameraStarted}
              onPreviewStopped={handlePreviewStopped}
              onInterruptionStarted={markCameraNotReady}
              onInterruptionEnded={markCameraReady}
            />
            <CameraFocusIndicator point={focusPoint} />
          </View>
        </GestureDetector>

        <View
          pointerEvents="box-none"
          style={[
            styles.cameraOverlay,
            { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 },
          ]}
        >
          <View style={styles.cameraTopRow}>
            <View style={styles.cameraTopSpacer} />
            {isRecording ? (
              <View
                style={[
                  styles.recordingTimerPill,
                  recordingPaused ? styles.recordingTimerPillPaused : null,
                ]}
              >
                <View
                  style={[
                    styles.recordingDot,
                    recordingPaused ? styles.recordingDotPaused : null,
                  ]}
                />
                <Text style={styles.recordingTimerText}>
                  {formatVoiceDurationMs(recordingMs)}
                </Text>
              </View>
            ) : showFlashControl ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={flashAccessibilityLabel(flashMode)}
                disabled={capturing || cameraLeaving}
                onPress={() => setFlashMode(current => nextFlashMode(current))}
                style={[
                  styles.flashButton,
                  capturing || cameraLeaving ? styles.disabled : null,
                ]}
              >
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
          <CameraZoomBar
            zoomRange={zoomRange}
            zoom={cameraZoom}
            onSelect={selectDisplayZoom}
            disabled={cameraLeaving}
          />

            <View style={styles.modeSwitchRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: captureMode === 'photo' }}
                accessibilityLabel="Photo mode"
                disabled={capturing || isRecording || cameraLeaving}
                onPress={() => handleSelectCaptureMode('photo')}
                style={[
                  styles.modePill,
                  captureMode === 'photo' ? styles.modePillActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.modePillLabel,
                    captureMode === 'photo' ? styles.modePillLabelActive : null,
                  ]}
                >
                  Photo
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: captureMode === 'video' }}
                accessibilityLabel="Video mode"
                disabled={capturing || isRecording || cameraLeaving}
                onPress={() => handleSelectCaptureMode('video')}
                style={[
                  styles.modePill,
                  captureMode === 'video' ? styles.modePillActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.modePillLabel,
                    captureMode === 'video' ? styles.modePillLabelActive : null,
                  ]}
                >
                  Video
                </Text>
              </Pressable>
            </View>

            <View style={styles.cameraBottomRow}>
              <View style={styles.cameraSideSlot}>
                {isRecording ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      recordingPaused ? 'Resume recording' : 'Pause recording'
                    }
                    disabled={cameraLeaving}
                    onPress={() => void handleToggleRecordingPause()}
                    style={[
                      styles.recordingPauseButton,
                      cameraLeaving ? styles.disabled : null,
                    ]}
                  >
                    {recordingPaused ? (
                      <Play
                        size={22}
                        color="#FFFFFF"
                        fill="#FFFFFF"
                        strokeWidth={0}
                      />
                    ) : (
                      <Pause
                        size={22}
                        color="#FFFFFF"
                        fill="#FFFFFF"
                        strokeWidth={0}
                      />
                    )}
                  </Pressable>
                ) : null}
              </View>
              {captureMode === 'photo' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Take photo"
                  disabled={capturing || cameraLeaving}
                  onPress={() => void handleCapture()}
                  style={[
                    styles.shutterButton,
                    capturing || !cameraReady || cameraLeaving
                      ? styles.shutterButtonPending
                      : null,
                  ]}
                >
                  {capturing ? <ActivityIndicator color="#000000" /> : null}
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    isRecording ? 'Stop recording' : 'Start recording'
                  }
                  disabled={capturing || cameraLeaving}
                  onPress={() =>
                    void (isRecording
                      ? handleStopVideoRecording()
                      : handleStartVideoRecording())
                  }
                  style={[
                    styles.shutterButton,
                    isRecording ? styles.shutterButtonRecording : null,
                    capturing || cameraLeaving ? styles.disabled : null,
                  ]}
                >
                  {isRecording ? (
                    <View style={styles.shutterStopIcon} />
                  ) : capturing ? (
                    <ActivityIndicator color="#FF3B30" />
                  ) : (
                    <View style={styles.shutterRecordIcon} />
                  )}
                </Pressable>
              )}
              <View style={styles.cameraRightControls}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close camera"
                  disabled={cameraLeaving}
                  onPress={handleClose}
                  style={[
                    styles.iconButton,
                    cameraLeaving ? styles.disabled : null,
                  ]}
                >
                  <X size={22} color="#FFFFFF" strokeWidth={2.25} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Flip camera"
                  disabled={capturing || isRecording || cameraLeaving}
                  onPress={() => {
                    if (cameraLeavingRef.current) {
                      return;
                    }
                    setCapturing(false);
                    setCameraPosition(current =>
                      current === 'back' ? 'front' : 'back',
                    );
                  }}
                  style={[
                    styles.iconButton,
                    capturing || isRecording || cameraLeaving
                      ? styles.disabled
                      : null,
                  ]}
                >
                  <RefreshCw size={22} color="#FFFFFF" strokeWidth={2.25} />
                </Pressable>
              </View>
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
    <BottomSheetModalProvider>
      <View style={styles.root}>
        {isPhotoDraft ? (
          <ViewShot
            ref={exportShotRef}
            style={StyleSheet.absoluteFill}
            options={{ format: 'jpg', quality: 1, result: 'tmpfile' }}
          >
            <View style={styles.photoStage}>
              <View
                style={[
                  styles.photoStageInner,
                  {
                    width: stageWidth,
                    height: stageHeight,
                    transform: [{ rotate: `${rotationDeg}deg` }],
                  },
                ]}
              >
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
          <View style={styles.reviewVideoStage} pointerEvents="box-none">
            <View style={styles.reviewVideoFrame}>
              <MomentVideoPlayer
                ref={reviewVideoRef}
                uri={draft.sourceUri}
                style={StyleSheet.absoluteFill}
                resizeMode={ResizeMode.COVER}
                repeat={false}
                paused={reviewPlaybackPaused || reviewVideoEnded || saving}
                onEnd={handleReviewVideoEnded}
              />
            </View>
            {reviewVideoEnded && !saving ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Play video"
                onPress={handleReplayReviewVideo}
                style={styles.reviewVideoPlayOverlay}
              >
                <View style={styles.reviewVideoPlayButton}>
                  <Play size={28} color="#FFFFFF" strokeWidth={2.25} />
                </View>
              </Pressable>
            ) : null}
          </View>
        )}

        {isPhotoDraft ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              reviewChromeVisible
                ? 'Hide controls to view photo'
                : 'Show controls'
            }
            disabled={saving || captionInputOpen}
            onPress={handleToggleReviewChrome}
            style={styles.reviewPhotoTapTarget}
          />
        ) : null}

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

        {reviewChromeVisible || captionInputOpen ? (
        <View pointerEvents="box-none" style={styles.reviewRoot}>
          {(isPhotoDraft || draft.kind === 'video') ? (
            <View
              pointerEvents="box-none"
              style={[
                styles.reviewTagsDock,
                { paddingTop: insets.top + 10 },
              ]}
            >
              <PhotoTagsBar
                tags={sceneTags}
                status={sceneTagsStatus}
                disabled={saving}
                onRemoveTag={handleRemoveSceneTag}
              />
            </View>
          ) : null}
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
                <View style={styles.reviewAttachmentColumn}>
                  {isPhotoDraft && voiceUri ? (
                    <View style={styles.voicePreviewRow}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          voicePlaying ? 'Pause voice memo' : 'Play voice memo'
                        }
                        onPress={() => void toggleVoicePreview()}
                        style={[
                          styles.voicePreviewPlay,
                          {
                            backgroundColor:
                              CAPTURE_BUTTON_THEMES.voice.badgeBg,
                          },
                        ]}
                      >
                        {voicePlaying ? (
                          <Pause
                            size={18}
                            color={CAPTURE_BUTTON_THEMES.voice.icon}
                            strokeWidth={2.25}
                          />
                        ) : (
                          <Play
                            size={18}
                            color={CAPTURE_BUTTON_THEMES.voice.icon}
                            strokeWidth={2.25}
                          />
                        )}
                      </Pressable>
                      <View style={styles.voicePreviewCopy}>
                        <Text style={styles.voicePreviewLabel}>Voice memo</Text>
                        <Text style={styles.voicePreviewDuration}>
                          {formatVoiceDurationMs(voiceDurationMs)}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Remove voice memo"
                        onPress={() => void clearVoice()}
                        style={styles.voicePreviewRemove}
                      >
                        <X size={16} color="#FFFFFF" strokeWidth={2.5} />
                      </Pressable>
                    </View>
                  ) : null}
                  {captionText.trim().length > 0 ? (
                    <View style={styles.captionPreviewRow}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Edit photo text"
                        disabled={saving}
                        onPress={handleOpenCaption}
                        style={[
                          styles.captionPreviewBody,
                          saving ? styles.disabled : null,
                        ]}
                      >
                        <Text
                          numberOfLines={2}
                          style={styles.captionPreviewText}
                        >
                          {captionText.trim()}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Remove photo text"
                        disabled={saving}
                        onPress={clearCaption}
                        style={styles.captionPreviewRemove}
                      >
                        <X size={16} color="#FFFFFF" strokeWidth={2.5} />
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.captionPreviewSpacer} />
                  )}
                </View>
                <View style={styles.reviewSideToolsColumn}>
                  {isPhotoDraft ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Rotate photo"
                      disabled={saving}
                      onPress={handleRotatePhoto}
                      style={[
                        styles.sideToolButton,
                        saving ? styles.disabled : null,
                      ]}
                    >
                      <RotateCw size={18} color="#FFFFFF" strokeWidth={2.25} />
                      <Text style={styles.sideToolButtonLabel}>Rotate</Text>
                    </Pressable>
                  ) : null}
                  {isPhotoDraft ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Record voice memo about this photo"
                      disabled={saving || voiceUri != null || voiceSheetOpen}
                      onPress={handleOpenVoiceSheet}
                      style={[
                        styles.sideToolButton,
                        saving ? styles.disabled : null,
                      ]}
                    >
                      <AudioLines
                        size={18}
                        color="#FFFFFF"
                        strokeWidth={2.25}
                      />
                      <Text style={styles.sideToolButtonLabel}>Voice</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Add optional text"
                    disabled={saving}
                    onPress={handleOpenCaption}
                    style={[
                      styles.sideToolButton,
                      saving ? styles.disabled : null,
                    ]}
                  >
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
            keyboardVerticalOffset={0}
          >
            <View
              style={[
                styles.reviewChrome,
                captionInputOpen ? styles.reviewChromeCaption : null,
                { paddingBottom: captionInputOpen ? 10 : insets.bottom + 8 },
              ]}
            >
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
                    accessibilityLabel="Close camera"
                    disabled={saving}
                    onPress={handleClose}
                    style={[styles.iconButton, saving ? styles.disabled : null]}
                  >
                    <X size={22} color="#FFFFFF" strokeWidth={2.25} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      isPhotoDraft ? 'Retake photo' : 'Retake video'
                    }
                    disabled={saving}
                    onPress={handleRetake}
                    style={[styles.iconButton, saving ? styles.disabled : null]}
                  >
                    <RotateCcw size={22} color="#FFFFFF" strokeWidth={2.25} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      isPhotoDraft
                        ? 'Save photo and take another'
                        : 'Save video and record another'
                    }
                    disabled={saving}
                    onPress={() => void handleSave()}
                    style={[
                      styles.doneIconButton,
                      saving ? styles.disabled : null,
                    ]}
                  >
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
        ) : null}

        <VoiceMemoSheet
          visible={voiceSheetOpen}
          saveTarget="photo"
          startRecordingOnOpen={false}
          onDiaryAttach={attachment => {
            void clearVoice().then(() => {
              setVoiceUri(attachment.uri);
              setVoiceDurationMs(attachment.durationMs);
            });
          }}
          onClose={() => setVoiceSheetOpen(false)}
          onSaved={async () => {}}
        />
      </View>
    </BottomSheetModalProvider>
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
  cameraGestureLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  reviewRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 2,
  },
  reviewPhotoTapTarget: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  reviewTagsDock: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
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
  reviewAttachmentColumn: {
    flex: 1,
    gap: 8,
    justifyContent: 'flex-end',
  },
  captionPreviewSpacer: {
    minHeight: 0,
  },
  captionPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  captionPreviewBody: {
    flex: 1,
  },
  captionPreviewRemove: {
    padding: 6,
  },
  captionPreviewText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  voicePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  voicePreviewPlay: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voicePreviewCopy: {
    flex: 1,
    gap: 2,
  },
  voicePreviewLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  voicePreviewDuration: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  voicePreviewRemove: {
    padding: 6,
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
  reviewVideoStage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  reviewVideoFrame: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  reviewVideoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  reviewVideoPlayButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
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
  recordingTimerPillPaused: {
    backgroundColor: 'rgba(28,28,30,0.75)',
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  recordingDotPaused: {
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  recordingTimerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  cameraSideSlot: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingPauseButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28,28,30,0.75)',
  },
  cameraRightControls: {
    // Matches the left slot so the shutter stays centered in the row.
    width: 56,
    alignItems: 'center',
    gap: 12,
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
  shutterButtonPending: {
    opacity: 0.72,
  },
  shutterButtonRecording: {
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(28,28,30,0.75)',
  },
  shutterRecordIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FF3B30',
  },
  shutterStopIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
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
    shadowOffset: { width: 0, height: 0 },
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
