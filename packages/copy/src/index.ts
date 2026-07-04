/**
 * Single source of truth for user-facing static text (mobile + web).
 */

import {APP_TIMEZONE, DRIVE_MAP_REFRESH_INTERVAL_MS_OPTIONS, MAX_SAVED_PLACE_LABEL_LENGTH, MAX_SAVED_PLACES} from '@lifemap/constants';

export const APP_NAME = 'LifeMap';

export const APP_COPY = {
  common: {
    cancel: 'Cancel',
    close: 'Close',
    done: 'Done',
    next: 'Next',
    skip: 'Skip',
    getStarted: 'Get started',
    tryAgain: 'Try again',
    settings: 'Settings',
    somethingWentWrong: 'Something went wrong.',
    somethingWentWrongTitle: 'Something went wrong',
    pleaseTryAgain: 'Please try again.',
    couldNotDeleteMoment: 'Could not delete moment',
    deleteMomentTryAgain: 'Something went wrong. Try again.',
    couldNotReorder: 'Could not reorder',
    discard: 'Discard',
    forbidden: 'Forbidden',
  },

  alerts: {
    couldNotSavePhoto: 'Could not save photo',
    couldNotSaveVideo: 'Could not save video',
    couldNotTakePhoto: 'Could not take photo',
    couldNotRecordVideo: 'Could not record video',
    couldNotStartRecording: 'Could not start recording',
    couldNotStopRecording: 'Could not stop recording',
    couldNotPlayRecording: 'Could not play recording',
    couldNotSaveVoiceMemo: 'Could not save voice memo',
    couldNotPlayVoiceMemo: 'Could not play voice memo',
    couldNotPauseVoiceMemo: 'Could not pause voice memo',
    couldNotSaveDiaryEntry: 'Could not save diary entry',
    couldNotSaveActivity: 'Could not save activity',
    couldNotLogActivity: 'Could not log activity',
    couldNotExport: 'Could not export',
    couldNotDeleteDiagnostics: 'Could not delete diagnostics',
    couldNotCompactDatabase: 'Could not compact database',
    couldNotRebuildToday: 'Could not rebuild today',
    couldNotRebuildTrips: 'Could not rebuild trips',
    couldNotLoadBackup: 'Could not load your backup.',
    couldNotRestore: 'Could not restore',
    couldNotLoadDay: 'Could not load this day',
    couldNotLoadStorageStats: 'Could not load saved storage stats.',
    couldNotCalculateStorage: 'Could not calculate storage breakdown.',
    couldNotOpenCamera: 'Could not open camera',
    couldNotPreparePhoto: 'Could not prepare photo',
    couldNotOpenPhotoLibrary: 'Could not open photo library',
    couldNotAttachPhoto: 'Could not attach photo',
    couldNotLookUpAddress: 'Could not look up that address. Try again.',
    couldNotRenamePlace: 'Could not rename place',
    couldNotReadBackupFile: 'Could not read the selected backup file.',
    noImageFromCamera: 'No image was returned from the camera.',
    noImagesFromLibrary: 'No images were returned from the library.',
    noImageFromLibrary: 'No image was returned from the library.',
    failedOrientPhoto: 'Failed to orient the photo for editing.',
    failedCompressPhoto: 'Failed to compress one of the selected photos.',
    failedCompressPhotoForLifeMap: 'Failed to compress the photo for LifeMap.',
    recordingTooShort: 'Recording too short',
    recordingTooShortBody: 'Hold the mic for at least half a second.',
    videoTooShort: 'Video too short',
    videoTooShortBody: 'Hold record for at least half a second.',
    discardVoiceMemo: 'Discard voice memo?',
    discardVoiceMemoBody: 'This recording will be deleted.',
    discardDiaryEntry: 'Discard this entry?',
    discardDiaryEntryBody: 'Your draft will be lost.',
  },

  voiceRecorder: {
    couldNotStart: 'Could not start voice recording.',
    couldNotStartRecorder: 'Could not start the recorder. Tap the mic to try again.',
    couldNotRecord: 'Could not record voice memo.',
  },

  explorer: {
    segmentStay: 'Stay',
    segmentDrive: 'Drive',
    segmentMissing: 'Missing',
    momentPhoto: 'photo',
    momentVideo: 'video',
    momentVoice: 'voice',
    momentNote: 'note',
    momentActivity: 'activity',
  },

  savedPlaces: {
    placeNameRequired: 'Place name is required',
    placeNameTooLong: `Place name must be ${MAX_SAVED_PLACE_LABEL_LENGTH} characters or fewer`,
    limitReached: `You can save up to ${MAX_SAVED_PLACES} places. Remove one to add another.`,
    favoriteName: 'Favorite name',
    favoriteNamePlaceholder: 'e.g. Client office',
    addressPlaceholder: '3925 N Elm St, Denton, TX',
    markAsHome: 'Mark as Home',
    markAsWork: 'Mark as Work',
    addFavorite: 'Add Favorite',
    increaseSearchArea: 'Increase search area',
    enterCustomPlaceName: 'Enter custom place name',
    placeLimitReached: 'Place limit reached',
    savedPlaceLimitReached: 'Saved place limit reached',
    renameFailed: 'Rename failed',
    couldNotSavePlace: 'Could not save place',
  },

  tracking: {
    notificationTitle: APP_NAME,
    notificationText: 'Recording your day privately on this device',
    backgroundPermissionTitle: 'Allow LifeMap to track in the background?',
    backgroundPermissionMessage:
      'LifeMap needs always-on location so your timeline stays complete when the app is closed. Everything stays encrypted on your phone.',
    backgroundPermissionPositive: 'Change to Always',
    backgroundPermissionNegative: 'Cancel',
    backgroundTracking: 'Background tracking',
    maximumReliability: 'Maximum reliability',
  },

  capture: {
    photoSaved: 'Photo saved in LifeMap',
    photoSavedPhotosFailed:
      'Your moment was saved in the app, but we could not add a copy to Photos.',
    videoSaved: 'Video saved in LifeMap',
  },

  onboarding: {
    slides: {
      locationHistory: {
        title: 'See how you lived',
        description:
          'LifeMap saves your location history so you can come back anytime and remember the path of your days.',
      },
      captureMoments: {
        title: 'Capture the moment',
        description:
          'At any point in time, add a photo, video, voice memo, or note — tied to that place and moment.',
      },
      privateByDesign: {
        title: 'Encrypted on your device',
        description:
          'Your timeline is stored only on this phone, protected with SQLCipher encryption. LifeMap does not upload your location history to our servers.',
      },
      permissionsPreview: {
        title: 'Why we ask for access',
        description:
          'After you tap Get started, your phone will show a few permission prompts. Here is what they are for:',
      },
    },
    bullets: {
      locationAlways:
        'Location (Always) — keep your day complete even when LifeMap is closed. You can turn background tracking off anytime in Settings.',
      motionFitness:
        'Motion & fitness — detect when you are moving vs staying still, which helps visits and drives and saves battery.',
    },
    a11y: {
      skip: 'Skip onboarding',
      finish: 'Finish onboarding',
      continue: 'Continue onboarding',
      goToSlide: (index: number) => `Go to slide ${index}`,
    },
    slideCounter: (current: number, total: number) => `${current} / ${total}`,
  },

  errors: {
    root: {
      title: 'Something went wrong',
      body: 'LifeMap hit an unexpected error. Your data on this device is unchanged. Try again, or restart the app.',
    },
    mapUnavailable: {
      title: 'Map unavailable',
      body: 'The map hit an unexpected error. Your location history on this device is unchanged.',
    },
    captureUnavailable: {
      title: 'Capture unavailable',
      body: 'The camera flow hit an unexpected error. Nothing was saved yet.',
    },
  },

  settings: {
    distanceUnits: {
      km: 'Kilometers',
      mi: 'Miles',
    },
    mapApps: {
      apple: 'Apple Maps',
      google: 'Google Maps',
    },
    driveMapRefresh: {
      tenSeconds: '10 seconds',
      thirtySeconds: '30 seconds',
      oneMinute: '1 minute',
    },
    sections: {
      appearance: 'Appearance',
      mapsAndUnits: 'Maps & units',
      tracking: 'Tracking',
      trips: 'Trips',
      information: 'Information',
      developer: 'Developer',
    },
  },

  history: {
    selectEvent: 'Select an event',
    noLocationData: 'No location data',
    noHistoryYet: 'No history yet',
    noSavedLocationData: 'No saved location data for this day.',
    closeHistory: 'Close history',
    returnToToday: 'Return to today',
    chooseDate: 'Choose date',
    previousDay: 'Previous day',
    nextDay: 'Next day',
    previousEvent: 'Previous event',
    nextEvent: 'Next event',
    jumpToToday: 'Jump to today',
  },

  widget: {
    onTheMove: 'On the move',
    driving: 'Driving',
    nearby: 'Nearby',
  },

  backup: {
    autoBackup: 'Auto backup',
    exporting: 'Exporting your data…',
    copyingMemories: 'Copying memories…',
    rebuilding: 'Rebuilding visits and drives…',
    restoring: 'Restoring LifeMap',
    scheduleDaily: 'Daily',
    scheduleWeekly: 'Weekly',
    scheduleOff: 'Off',
  },
} as const;

/** Trip dwell picker labels — derived from minutes, not a fixed string table. */
export function formatTripDwellLabel(minutes: number): string {
  if (minutes === 60) {
    return '1 hr';
  }
  return `${minutes} min`;
}

/** Trip radius picker labels. */
export function formatTripRadiusLabel(meters: number): string {
  return `${meters} m`;
}

export function driveMapRefreshIntervalLabel(ms: number): string {
  switch (ms) {
    case DRIVE_MAP_REFRESH_INTERVAL_MS_OPTIONS[0]:
      return APP_COPY.settings.driveMapRefresh.tenSeconds;
    case DRIVE_MAP_REFRESH_INTERVAL_MS_OPTIONS[1]:
      return APP_COPY.settings.driveMapRefresh.thirtySeconds;
    case DRIVE_MAP_REFRESH_INTERVAL_MS_OPTIONS[2]:
      return APP_COPY.settings.driveMapRefresh.oneMinute;
    default:
      return APP_COPY.settings.driveMapRefresh.thirtySeconds;
  }
}

export function timezoneFieldLabel(prefix: string): string {
  return `${prefix} (${APP_TIMEZONE})`;
}

/** User-visible error detail — prefer Error.message when present. */
export function errorMessageOr(
  error: unknown,
  fallback: string = APP_COPY.common.somethingWentWrong,
): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback;
}
