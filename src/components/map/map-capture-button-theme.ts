export type CaptureButtonVariant = 'camera' | 'voice' | 'note';

/** Tone-on-tone orb colors — same pattern as saved place icons. */
export type CaptureButtonTheme = {
  badgeBg: string;
  icon: string;
};

export const CAPTURE_BUTTON_THEMES: Record<CaptureButtonVariant, CaptureButtonTheme> =
  {
    camera: {
      badgeBg: '#F2F8FF',
      icon: '#007AFF',
    },
    voice: {
      badgeBg: '#F7F2FF',
      icon: '#AF52DE',
    },
    note: {
      badgeBg: '#FFF8EE',
      icon: '#FF9500',
    },
  };

export const CAPTURE_ICON_ORB_SIZE = 34;
export const CAPTURE_ICON_SIZE = 18;
