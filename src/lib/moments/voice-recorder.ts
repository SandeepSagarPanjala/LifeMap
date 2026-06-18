import {
  AVEncoderAudioQualityIOSType,
  createSound,
  type AudioSet,
  type RecordBackType,
} from 'react-native-nitro-sound';

import {VOICE_MAX_DURATION_MS} from '@/lib/moments/media-compress-config';
import {createTempVoiceRecordingPath, deleteMomentContentFile} from '@/lib/moments/moment-storage';

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
  const sound = createSound();
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
    durationMs = event.currentPosition;
    callbacks.onDurationMs?.(durationMs);
    if (!stoppingForCap && durationMs >= VOICE_MAX_DURATION_MS) {
      stoppingForCap = true;
      callbacks.onMaxDurationReached?.();
    }
  };

  return {
    async startRecording() {
      await discardRecording();
      stoppingForCap = false;
      durationMs = 0;
      activeRecordPath = await createTempVoiceRecordingPath();
      sound.addRecordBackListener(handleRecordProgress);
      await sound.startRecorder(activeRecordPath, VOICE_AUDIO_SET, false);
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
      await sound.stopPlayer();
      await sound.startPlayer(filePath);
    },

    async pausePreview() {
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
    return error.message;
  }
  return 'Could not record voice memo.';
}
