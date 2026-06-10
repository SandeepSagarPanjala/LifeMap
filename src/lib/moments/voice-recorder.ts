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

  const handleRecordProgress = (event: RecordBackType) => {
    durationMs = event.currentPosition;
    callbacks.onDurationMs?.(durationMs);
    if (!stoppingForCap && durationMs >= VOICE_MAX_DURATION_MS) {
      stoppingForCap = true;
      callbacks.onMaxDurationReached?.();
    }
  };

  const discardRecording = async (filePath?: string | null) => {
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
    sound.removeRecordBackListener();
    sound.removePlayBackListener();
    sound.removePlaybackEndListener();

    const paths = new Set<string>();
    if (activeRecordPath) {
      paths.add(activeRecordPath);
    }
    if (filePath) {
      paths.add(filePath);
    }
    for (const path of paths) {
      await deleteMomentContentFile(path);
    }

    activeRecordPath = null;
    durationMs = 0;
    stoppingForCap = false;
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
      if (!activeRecordPath) {
        throw new Error('No active voice recording.');
      }
      const filePath = await sound.stopRecorder();
      sound.removeRecordBackListener();
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
      await sound.stopPlayer();
      sound.removePlayBackListener();
      sound.removePlaybackEndListener();
    },

    discardRecording,

    dispose() {
      void discardRecording();
      sound.dispose();
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
