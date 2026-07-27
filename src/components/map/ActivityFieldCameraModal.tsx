import { useCallback, useEffect, useMemo, useState } from 'react';
import { APP_COPY, errorMessageOr } from '@/lib/app-copy';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { X } from 'phosphor-react-native/src/icons/X';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera';

import { normalizeCameraPhoto } from '@/lib/moments/normalize-camera-photo';

type ActivityFieldCameraModalProps = {
  visible: boolean;
  fieldLabel: string;
  onClose: () => void;
  onUsePhoto: (uri: string) => void;
};

function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

const CAPTURE_RETRY_MS = 350;
const CAPTURE_MAX_ATTEMPTS = 3;

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

export function ActivityFieldCameraModal({
  visible,
  fieldLabel,
  onClose,
  onUsePhoto,
}: ActivityFieldCameraModalProps) {
  const insets = useSafeAreaInsets();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const photoOutput = usePhotoOutput();
  const cameraOutputs = useMemo(() => [photoOutput], [photoOutput]);

  const [capturing, setCapturing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    if (!visible) {
      setCapturing(false);
      setCameraReady(false);
      return;
    }
    if (!hasPermission) {
      void requestPermission();
    }
  }, [hasPermission, requestPermission, visible]);

  const handleCapture = useCallback(async () => {
    if (capturing) {
      return;
    }
    setCapturing(true);
    try {
      let photoFile: Awaited<
        ReturnType<typeof photoOutput.capturePhotoToFile>
      > | null = null;
      for (let attempt = 0; attempt < CAPTURE_MAX_ATTEMPTS; attempt += 1) {
        try {
          photoFile = await photoOutput.capturePhotoToFile(
            { flashMode: 'off', enableShutterSound: true },
            {},
          );
          break;
        } catch (error) {
          const canRetry =
            attempt < CAPTURE_MAX_ATTEMPTS - 1 &&
            isPhotoOutputNotReadyError(error);
          if (!canRetry) {
            throw error;
          }
          await waitMs(CAPTURE_RETRY_MS);
        }
      }
      if (photoFile == null) {
        throw new Error('Camera is still starting. Try again in a moment.');
      }
      const normalized = await normalizeCameraPhoto(
        toFileUri(photoFile.filePath),
      );
      // Use photo immediately — no retake / confirm step.
      onUsePhoto(normalized.uri);
      onClose();
    } catch (error) {
      Alert.alert(APP_COPY.alerts.couldNotTakePhoto, errorMessageOr(error));
    } finally {
      setCapturing(false);
    }
  }, [capturing, onClose, onUsePhoto, photoOutput]);

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {!hasPermission || device == null ? (
          <View style={styles.permissionBlock}>
            <Text style={styles.permissionTitle}>Camera access needed</Text>
            <Text style={styles.permissionBody}>
              Allow camera access to take a photo for {fieldLabel}.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void requestPermission()}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonLabel}>Allow camera</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonLabel}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Camera
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={visible}
              outputs={cameraOutputs}
              // Portrait-locked UI: follow interface orientation, not device
              // tilt — otherwise landscape holding rotates the saved file.
              orientationSource="interface"
              onStarted={() => setCameraReady(true)}
              onStopped={() => setCameraReady(false)}
            />
            <View
              pointerEvents="box-none"
              style={[
                styles.cameraOverlay,
                {
                  paddingTop: insets.top + 8,
                  paddingBottom: insets.bottom + 16,
                },
              ]}
            >
              <View style={styles.cameraHeader}>
                <Text style={styles.cameraTitle}>{fieldLabel}</Text>
              </View>

              <View style={styles.cameraBottomRow}>
                <View style={styles.cameraSideSpacer} />

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Take photo"
                  disabled={capturing || !cameraReady}
                  onPress={() => void handleCapture()}
                  style={[
                    styles.shutterButton,
                    capturing || !cameraReady
                      ? styles.shutterButtonPending
                      : null,
                  ]}
                >
                  {capturing ? (
                    <ActivityIndicator color="#000000" />
                  ) : null}
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close camera"
                  onPress={onClose}
                  style={styles.iconButton}
                >
                  <X size={22} color="#FFFFFF" weight="bold" />
                </Pressable>
              </View>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  cameraTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cameraBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
  },
  cameraSideSpacer: {
    width: 48,
    height: 48,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  shutterButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterButtonPending: {
    opacity: 0.55,
  },
  primaryButton: {
    borderRadius: 14,
    backgroundColor: '#34C759',
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    minWidth: 180,
  },
  primaryButtonLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    minWidth: 180,
  },
  secondaryButtonLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 28,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  permissionBody: {
    fontSize: 15,
    color: '#D1D1D6',
    textAlign: 'center',
    marginBottom: 8,
  },
});
