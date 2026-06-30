import {
  AVEncoderAudioQualityIOSType,
  createSound,
  type AudioSet,
  type RecordBackType,
} from 'react-native-nitro-sound';

import {VOICE_MAX_DURATION_MS} from '@/lib/moments/media-compress-config';
import {createTempVoiceRecordingPath, deleteMomentContentFile} from '@/lib/moments/moment-storage';
import {prepareVoiceRecordingSession} from '@/lib/voice-audio-session';

const START_RECORDING_MAX_ATTEMPTS = 4;
const START_RECORDING_RETRY_DELAY_MS = 400;
const SESSION_SETTLE_DELAY_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function isRetryableRecordingStartError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes('prepare') ||
    message.includes('session') ||
    message.includes('recording setup') ||
    message.includes('hijacked') ||
    message.includes('failed to start recording')
  );
}

const VOICE_AUDIO_SET: AudioSet = {
  AVSampleRateKeyIOS: 44100,
  AVFormatIDKeyIOS: 'aac',
  AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.medium,
  AVNumberOfChannelsKeyIOS: 1,
  AudioSamplingRate: 44100,
  AudioEncodingBitRate: 128000,
  AudioChannels: 1,
};

export type VoiceRecorderCallbacks = {
  onDurationMs?: (durationMs: number) => void;
  onMaxDurationReached?: () => void;
  onMetering?: (meteringDb: number) => void;
  onPlaybackProgress?: (positionMs: number, durationMs: number) => void;
  onPlaybackEnded?: () => void;
};

export type VoiceRecorderSession = {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<{filePath: string; durationMs: number}>;
  startPreview: (filePath: string) => Promise<void>;
  pausePreview: () => Promise<void>;
  stopPreview: () => Promise<void>;
  discardRecording: (filePath?: string | null) => Promise<void>;
  dispose: () => void;
};

export function createVoiceRecorderSession(
  callbacks: VoiceRecorderCallbacks = {},
): VoiceRecorderSession {
  let sound = createSound();
  let activeRecordPath: string | null = null;
  let durationMs = 0;
  let stoppingForCap = false;
  let disposed = false;

  const removeListenersSafely = () => {
    try {
      sound.removeRecordBackListener();
    } catch {
      // Native recorder may already be torn down.
    }
    try {
      sound.removePlayBackListener();
    } catch {
      // Native player may already be torn down.
    }
    try {
      sound.removePlaybackEndListener();
    } catch {
      // Native player may already be torn down.
    }
  };

  const attachRecordListener = () => {
    sound.setSubscriptionDuration(0.1);
    sound.addRecordBackListener(handleRecordProgress);
  };

  const resetNativeSound = () => {
    removeListenersSafely();
    try {
      sound.dispose();
    } catch {
      // Already disposed.
    }
    sound = createSound();
  };

  const discardRecording = async (filePath?: string | null) => {
    const paths = new Set<string>();
    if (activeRecordPath) {
      paths.add(activeRecordPath);
    }
    if (filePath) {
      paths.add(filePath);
    }

    if (disposed) {
      for (const path of paths) {
        await deleteMomentContentFile(path);
      }
      return;
    }

    try {
      await sound.stopRecorder();
    } catch {
      // Not recording.
    }
    try {
      await sound.stopPlayer();
    } catch {
      // Not playing.
    }
    removeListenersSafely();

    for (const path of paths) {
      await deleteMomentContentFile(path);
    }

    activeRecordPath = null;
    durationMs = 0;
    stoppingForCap = false;
  };

  const handleRecordProgress = (event: RecordBackType) => {
    if (disposed) {
      return;
    }
    durationMs = event.currentPosition;
    callbacks.onDurationMs?.(durationMs);
    if (event.currentMetering != null) {
      callbacks.onMetering?.(event.currentMetering);
    }
    if (!stoppingForCap && durationMs >= VOICE_MAX_DURATION_MS) {
      stoppingForCap = true;
      callbacks.onMaxDurationReached?.();
    }
  };

  const handlePlaybackProgress = (event: {currentPosition: number; duration: number}) => {
    if (disposed) {
      return;
    }
    callbacks.onPlaybackProgress?.(event.currentPosition, event.duration);
  };

  const handlePlaybackEnded = (event: {duration: number; currentPosition: number}) => {
    if (disposed) {
      return;
    }
    callbacks.onPlaybackProgress?.(event.currentPosition, event.duration);
    callbacks.onPlaybackEnded?.();
  };

  return {
    async startRecording() {
      if (disposed) {
        throw new Error('Voice recorder disposed.');
      }
      await discardRecording();
      if (disposed) {
        throw new Error('Voice recorder disposed.');
      }
      stoppingForCap = false;
      durationMs = 0;
      activeRecordPath = await createTempVoiceRecordingPath();
      attachRecordListener();

      let lastError: unknown;
      await prepareVoiceRecordingSession();
      for (let attempt = 0; attempt < START_RECORDING_MAX_ATTEMPTS; attempt += 1) {
        if (disposed) {
          throw new Error('Voice recorder disposed.');
        }
        if (attempt > 0) {
          await prepareVoiceRecordingSession();
          try {
            await sound.stopRecorder();
          } catch {
            // Not recording.
          }
          resetNativeSound();
          attachRecordListener();
          await sleep(START_RECORDING_RETRY_DELAY_MS * attempt);
        }
        await sleep(SESSION_SETTLE_DELAY_MS);
        if (disposed) {
          throw new Error('Voice recorder disposed.');
        }
        try {
          await sound.startRecorder(activeRecordPath, VOICE_AUDIO_SET, true);
          return;
        } catch (error) {
          lastError = error;
          if (!isRetryableRecordingStartError(error)) {
            throw error;
          }
        }
      }
      throw lastError ?? new Error('Could not start voice recording.');
    },

    async stopRecording() {
      if (!activeRecordPath || disposed) {
        throw new Error('No active voice recording.');
      }
      const filePath = await sound.stopRecorder();
      removeListenersSafely();
      stoppingForCap = false;
      const resolvedPath = filePath || activeRecordPath;
      activeRecordPath = null;
      return {filePath: resolvedPath, durationMs};
    },

    async startPreview(filePath: string) {
      if (disposed) {
        return;
      }
      await sound.stopPlayer();
      if (disposed) {
        return;
      }
      removeListenersSafely();
      sound.setSubscriptionDuration(0.1);
      sound.addPlayBackListener(handlePlaybackProgress);
      sound.addPlaybackEndListener(handlePlaybackEnded);
      if (disposed) {
        return;
      }
      await sound.startPlayer(filePath);
    },

    async pausePreview() {
      if (disposed) {
        return;
      }
      await sound.pausePlayer();
    },

    async stopPreview() {
      if (disposed) {
        return;
      }
      await sound.stopPlayer();
      removeListenersSafely();
    },

    discardRecording,

    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      void (async () => {
        try {
          await sound.stopRecorder();
        } catch {
          // Not recording.
        }
        try {
          await sound.stopPlayer();
        } catch {
          // Not playing.
        }
        removeListenersSafely();
        try {
          sound.dispose();
        } catch {
          // Already disposed.
        }
        const path = activeRecordPath;
        activeRecordPath = null;
        if (path) {
          await deleteMomentContentFile(path);
        }
      })();
    },
  };
}

export function getVoiceRecordingErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('permission') || message.includes('denied')) {
      return 'Microphone access is required to record voice memos.';
    }
    if (
      message.includes('prepare') ||
      message.includes('session') ||
      message.includes('hijacked') ||
      message.includes('other audio')
    ) {
      return 'Could not access the microphone. Tap the mic to try again — LifeMap resets audio after Bluetooth disconnects.';
    }
    return error.message;
  }
  return 'Could not record voice memo.';
}
