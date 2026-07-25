import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useExclusiveGestures,
  usePinchGesture,
  useTapGesture,
  type ComposedGesture,
} from 'react-native-gesture-handler';
import {
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type { CameraDevice } from 'react-native-vision-camera';

import type { CameraFocusPoint } from '@/components/capture/CameraFocusIndicator';
import {
  buildCameraZoomRange,
  DEFAULT_CAMERA_ZOOM_RANGE,
  toNativeZoom,
  type CameraZoomRange,
} from '@/lib/moments/camera-zoom';

const FOCUS_RING_VISIBLE_MS = 1_100;
const PRESET_ZOOM_MS = 180;

type CameraControls = {
  zoomRange: CameraZoomRange;
  /** Native zoom factor, written on the UI thread while pinching. */
  zoom: SharedValue<number>;
  /** Pinch-to-zoom, plus a tap that places the focus ring. */
  gesture: ComposedGesture;
  focusPoint: CameraFocusPoint | null;
  selectDisplayZoom: (displayZoom: number) => void;
  /** Pushes the current zoom back onto the lens after a session restart. */
  restoreZoom: () => void;
};

/**
 * Zoom and focus-ring state for the capture camera.
 *
 * Zoom lives in a shared value that VisionCamera binds straight to the capture
 * device on the UI thread, so a pinch never re-renders React - going through
 * state made the preview stutter between the value React had committed and the
 * one the finger was on. Focus metering is left to VisionCamera's native
 * tap-to-focus gesture; the ring drawn here is only its visual feedback.
 */
export function useCameraControls(
  device: CameraDevice | undefined,
  enabled: boolean,
): CameraControls {
  const zoomRange = useMemo(() => {
    if (device == null) {
      return DEFAULT_CAMERA_ZOOM_RANGE;
    }
    return buildCameraZoomRange({
      minZoom: device.minZoom,
      maxZoom: device.maxZoom,
      zoomLensSwitchFactors: device.zoomLensSwitchFactors,
      hasUltraWideLens: device.physicalDevices.some(
        physical => physical.type === 'ultra-wide-angle',
      ),
    });
  }, [device]);

  const { minZoom, maxZoom, baseZoom } = zoomRange;
  const zoom = useSharedValue(baseZoom);
  const pinchStartZoom = useSharedValue(baseZoom);

  useEffect(() => {
    if (__DEV__ && device != null) {
      // Zoom depends entirely on what the lens reports, and that differs per
      // model - log it so a mismatch is visible instead of silent.
      console.log('[camera] zoom capabilities', {
        deviceId: device.id,
        minZoom: device.minZoom,
        maxZoom: device.maxZoom,
        zoomLensSwitchFactors: device.zoomLensSwitchFactors,
        physicalDevices: device.physicalDevices.map(physical => physical.type),
        resolved: zoomRange,
      });
    }
  }, [device, zoomRange]);

  // Keyed on primitives rather than on the resolved range: a new range object
  // does not necessarily mean a different lens, and resetting zoom more often
  // than the lens actually changes fights whatever the user is pinching.
  const deviceId = device?.id;
  useEffect(() => {
    zoom.set(baseZoom);
  }, [baseZoom, deviceId, zoom]);

  const selectDisplayZoom = useCallback(
    (displayZoom: number) => {
      zoom.set(
        withTiming(toNativeZoom(displayZoom, zoomRange), {
          duration: PRESET_ZOOM_MS,
        }),
      );
    },
    [zoom, zoomRange],
  );

  const restoreZoom = useCallback(() => {
    // Reconfiguring the session can pick a new capture format, and that resets
    // the lens to its widest zoom. Re-notify the listener with the value we
    // already have so the lens matches what the UI is showing.
    zoom.modify(value => {
      'worklet';
      return value;
    }, true);
  }, [zoom]);

  const focusIdRef = useRef(0);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [focusPoint, setFocusPoint] = useState<CameraFocusPoint | null>(null);

  useEffect(() => {
    return () => {
      if (focusTimerRef.current != null) {
        clearTimeout(focusTimerRef.current);
      }
    };
  }, []);

  const showFocusRing = useCallback((x: number, y: number) => {
    focusIdRef.current += 1;
    setFocusPoint({ x, y, id: focusIdRef.current });
    if (focusTimerRef.current != null) {
      clearTimeout(focusTimerRef.current);
    }
    focusTimerRef.current = setTimeout(() => {
      focusTimerRef.current = null;
      setFocusPoint(null);
    }, FOCUS_RING_VISIBLE_MS);
  }, []);

  const pinchToZoom = usePinchGesture({
    enabled,
    onBegin: () => {
      'worklet';
      pinchStartZoom.set(zoom.get());
    },
    onUpdate: event => {
      'worklet';
      const next = pinchStartZoom.get() * event.scale;
      zoom.set(Math.min(Math.max(next, minZoom), maxZoom));
    },
  });

  const tapToFocus = useTapGesture({
    enabled,
    // The ring is React state, so this one has to hop to the JS thread.
    runOnJS: true,
    numberOfTaps: 1,
    onActivate: event => {
      showFocusRing(event.x, event.y);
    },
  });

  const gesture = useExclusiveGestures(pinchToZoom, tapToFocus);

  return {
    zoomRange,
    zoom,
    gesture,
    focusPoint,
    selectDisplayZoom,
    restoreZoom,
  };
}
