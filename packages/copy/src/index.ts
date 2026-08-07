/**
 * Single source of truth for user-facing static text (mobile + web).
 */

import {
  APP_TIMEZONE,
  MAX_SAVED_PLACE_LABEL_LENGTH,
  MAX_SAVED_PLACES,
} from '@lifemap/constants';

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
    couldNotPauseRecording: 'Could not pause recording',
    couldNotResumeRecording: 'Could not resume recording',
    couldNotPlayRecording: 'Could not play recording',
    couldNotSaveVoiceMemo: 'Could not save voice memo',
    couldNotPlayVoiceMemo: 'Could not play voice memo',
    couldNotPauseVoiceMemo: 'Could not pause voice memo',
    couldNotSaveDiaryEntry: 'Could not save diary entry',
    couldNotSaveMood: 'Could not save mood',
    couldNotSaveActivity: 'Could not save activity',
    couldNotLogActivity: 'Could not log activity',
    couldNotExport: 'Could not export',
    couldNotDeleteDiagnostics: 'Could not delete diagnostics',
    couldNotCompactDatabase: 'Could not compact database',
    couldNotRebuildToday: 'Could not rebuild today',
    couldNotRebuildTrips: 'Could not rebuild trips',
    couldNotSaveAppStartDate: 'Could not save app start date',
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
    couldNotStartRecorder:
      'Could not start the recorder. Tap the mic to try again.',
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
    momentMood: 'mood',
  },

  mood: {
    log: 'Log',
    typeReason: 'Type reason',
    voiceReason: 'Voice reason',
    saveReason: 'Save',
    stopAndLog: 'Log',
    stopRecording: 'Stop recording',
    recordAgain: 'Record again',
    voiceTooShort: 'Record a bit longer, then log.',
    reasonPrompt: 'Log this mood, or add a text or voice reason.',
    typeReasonHint: 'What made you feel this?',
    voiceReasonHint: 'Speak your reason — up to 1 minute.',
    howAreYouFeeling: 'How are you feeling?',
    noReasonGiven: 'No reason is given',
    insights: 'Mood insights',
    insightsTitle: 'Mood insights',
    insightsSubtitle: "How often you've been logging moods.",
    insightsEmpty: 'Log a mood to unlock insights.',
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

  diary: {
    title: 'Diary',
    addDiary: 'Add Diary',
    insights: 'Diary insights',
    insightsTitle: 'Diary insights',
    insightsSubtitle: "How often you've been writing.",
    insightsEmpty: 'Write a diary entry to unlock insights.',
    emptyTitle: 'No diary entries yet',
    emptyBody: 'Write when you have a moment — tap Add Diary below.',
    entryFallbackTitle: 'Diary entry',
    oneEntry: '1 entry',
    entriesCount: (count: number) => `${count} entries`,
    howAreYouFeeling: 'How are you feeling?',
    searchMoods: 'Search moods',
    noMoodsFound: 'No moods found',
    moodReasonPlaceholder: 'What made you feel this?',
    removeMood: 'Remove mood',
  },

  voice: {
    insights: 'Voice insights',
    insightsTitle: 'Voice insights',
    insightsSubtitle: "How often you've been recording voice memos.",
    insightsEmpty: 'Record a voice memo to unlock insights.',
  },

  camera: {
    insights: 'Camera insights',
    insightsTitle: 'Camera insights',
    insightsSubtitle: "How often you've been capturing photos and videos.",
    insightsEmptyPhoto: 'Take a photo to unlock insights.',
    insightsEmptyVideo: 'Record a video to unlock insights.',
    photo: 'Photo',
    video: 'Video',
  },

  mapInsights: {
    insightsTitle: 'Map insights',
    insightsSubtitle: 'Where your hours went and how you moved.',
    insightsEmpty: 'Keep LifeMap tracking to unlock map insights.',
    pulse: 'Pulse',
    savedPlaces: 'Home, work & favorites',
    topPlaces: 'Places by time',
    frequentTravels: 'Frequent routes',
    rhythm: 'Home rhythm',
    newPlaces: 'New places',
    vsPrevious: 'Vs last period',
    overview: 'Overview',
    today: 'Today',
    overviewPlaceholder: 'Overview insights coming soon.',
    overviewHome: 'Home',
    overviewWork: 'Work',
    overviewHomeEmpty: 'Set a Home place to unlock home insights.',
    overviewWorkEmpty: 'Set a Work place to unlock work insights.',
    overviewNoVisitData: 'No data exists to show insights.',
    hoursAtHome: 'Hours at home',
    fullDayHomeStays: '24 hour stays',
    longestHomeStay: 'Longest stay',
    shortestHomeStay: 'Shortest day',
    avgHomeStay: 'Average stay',
    workVisits: 'Visits',
    hoursAtWork: 'Hours at work',
    hoursAtPlace: 'Hours',
    distanceToWork: 'Distance to work',
    distanceFromHome: 'Distance from home',
    commuteMin: 'Fastest commute',
    commuteMax: 'Slowest commute',
    commuteAvg: 'Average commute',
    workStayMin: 'Shortest at work',
    workStayMax: 'Longest at work',
    workStayAvg: 'Average at work',
    placeStayMin: 'Shortest stay',
    placeStayMax: 'Longest stay',
    placeStayAvg: 'Average stay',
    commuteSpeedMin: 'Slowest speed',
    commuteSpeedMax: 'Top speed',
    commuteSpeedAvg: 'Average speed',
    typicalArriveWork: 'Usually arrive',
    typicalLeaveWork: 'Usually leave',
    workWeekdays: 'Days at work',
    placeWeekdays: 'Days visited',
    overviewCollapse: 'Collapse',
    overviewExpand: 'Expand',
    overviewDrillEmpty: 'Nothing to show for this insight yet.',
    week: 'Week',
    month: 'Month',
    year: 'Year',
    distance: 'Distance',
    daysTracked: 'Days tracked',
    nightsAway: 'Nights away',
    atHome: 'At home',
    atWork: 'At work',
    sleeping: 'Sleeping',
    leaveHome: 'Usually leave',
    returnHome: 'Usually back',
    rhythmEmpty: 'Need a few home trips to spot a pattern.',
    distanceChange: 'Distance',
    homeChange: 'At home',
    nightsAwayChange: 'Nights away',
    visits: (count: number) => (count === 1 ? '1 visit' : `${count} visits`),
    trips: (count: number) => (count === 1 ? '1 trip' : `${count} trips`),
    avg: 'Avg',
    min: 'Min',
    max: 'Max',
    filterTitle: 'Choose period',
    filterA11y: 'Filter period',
    current: 'Current',
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
          'At any point in time, add a photo, video, voice memo, mood, or note — tied to that place and moment.',
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
    sections: {
      appearance: 'Appearance',
      mapsAndUnits: 'Maps & units',
      tracking: 'Tracking',
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
    scheduleMonthly: 'Monthly',
    scheduleOff: 'Off',
  },

  achievements: {
    title: 'Achievements',
    pillarTraveler: 'Traveler',
    pillarExplorer: 'Explorer',
    pillarRhythm: 'Rhythm',
    locked: 'Locked',
    earned: (date: string) => `Earned ${date}`,
    progress: (current: string, threshold: string) =>
      `${current} / ${threshold}`,
    emptyHint: 'Keep living your map — badges unlock as you go.',
    howTo: {
      unitMiles: 'miles',
      unitKilometers: 'kilometers',
      travel: (amount: string, unit: string) =>
        `Drive a total of ${amount} ${unit}. LifeMap adds up your drives automatically.`,
      places: (count: string) =>
        `Visit ${count} different places. Each new stop on your map counts.`,
      category: (place: string) =>
        `Visit ${place}. LifeMap will notice when you spend time there.`,
      categoryPlaces: {
        cat_cafe: 'a café',
        cat_restaurant: 'a restaurant',
        cat_bakery: 'a bakery',
        cat_park: 'a park or national park',
        cat_beach: 'a beach',
        cat_airport: 'an airport',
        cat_hotel: 'a hotel',
        cat_gym: 'a gym or fitness center',
        cat_store: 'a store or market',
        cat_gas: 'a gas station',
        cat_hospital: 'a hospital',
        cat_library: 'a library',
      },
      days: (count: string) =>
        `Use LifeMap on ${count} different days.`,
      nightsAway:
        'Spend at least one night somewhere other than your Home.',
      momentsTotal: (count: string) =>
        `Save ${count} moments — photos, videos, notes, voice, moods, or activities.`,
      momentKind: {
        photo: 'Take and save your first photo.',
        video: 'Record and save your first video.',
        note: 'Write and save your first note.',
        voice: 'Record and save your first voice memo.',
        mood: 'Save your first mood.',
        activity: 'Save your first activity.',
      },
      activities: (count: string) =>
        `Save ${count} activities.`,
      homeSet: 'Set your Home place.',
      workSet: 'Set your Work place.',
      homeFullDay: (count: string) =>
        count === '1'
          ? 'Spend a full day at Home (24 hours or more in one stay).'
          : `Spend ${count} full days at Home (each stay 24 hours or more).`,
      fallback: 'Keep using LifeMap — this badge unlocks as you go.',
    },
    names: {
      travel_10: 'First Miles',
      travel_50: 'Neighborhood Nomad',
      travel_100: 'Century Road',
      travel_250: 'Regional Rover',
      travel_500: 'Half-Thousand',
      travel_1000: 'Thousand Roads',
      travel_2500: 'Long Haul',
      travel_5000: 'Cross-Country',
      travel_10000: 'Ten Thousand',
      travel_25000: 'World Wanderer',
      places_5: 'Getting Out',
      places_10: 'Local Explorer',
      places_25: 'City Sampler',
      places_50: 'Fifty Stops',
      places_100: 'Hundred Places',
      places_250: 'Deep Map',
      places_500: 'Atlas Builder',
      cat_cafe: 'First Café',
      cat_restaurant: 'First Restaurant',
      cat_bakery: 'First Bakery',
      cat_park: 'First Park',
      cat_beach: 'First Beach',
      cat_airport: 'First Airport',
      cat_hotel: 'First Hotel',
      cat_gym: 'First Gym',
      cat_store: 'First Store',
      cat_gas: 'First Fill-Up',
      cat_hospital: 'First Hospital',
      cat_library: 'First Library',
      days_7: 'First Week',
      days_30: 'First Month',
      days_100: 'Hundred Days',
      days_365: 'Year of You',
      nights_1: 'Night Out',
      moments_1: 'First Moment',
      moments_10: 'Moment Keeper',
      moments_25: 'Story Starting',
      moments_50: 'Fifty Memories',
      moments_100: 'Hundred Moments',
      moments_250: 'Life Archive',
      moment_photo_1: 'First Photo',
      moment_video_1: 'First Clip',
      moment_note_1: 'First Note',
      moment_voice_1: 'First Voice',
      moment_mood_1: 'First Mood',
      moment_activity_1: 'First Activity',
      activities_10: 'Habit Starter',
      activities_50: 'Habit Keeper',
      home_set: 'Home Base',
      work_set: 'Work Anchor',
      home_fullday_1: 'Full Day Home',
      home_fullday_5: 'Nesting',
      home_fullday_10: 'Homebody',
      home_fullday_25: 'Deep Roots',
    },
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
