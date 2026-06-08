import type {ComponentProps} from 'react';
import type LottieView from 'lottie-react-native';

type LottieSource = ComponentProps<typeof LottieView>['source'];

export type OnboardingSlideConfig = {
  id: string;
  title: string;
  description: string;
  /** Optional list for permission-style slides. */
  bullets?: string[];
  /** Add Lottie JSON here when you download assets from LottieFiles. */
  lottie?: LottieSource;
};

/** Keep in sync with real product features — add slides when new features ship. */
export const ONBOARDING_SLIDES: OnboardingSlideConfig[] = [
  {
    id: 'location-history',
    title: 'See how you lived',
    description:
      'LifeMap saves your location history so you can come back anytime and remember the path of your days.',
    lottie: require('../../assets/lottie/location-history.json'),
  },
  {
    id: 'capture-moments',
    title: 'Capture the moment',
    description:
      'At any point in time, add a photo, video, voice memo, or note — tied to that place and moment.',
    lottie: require('../../assets/lottie/capture-moment.json'),
  },
  {
    id: 'private-by-design',
    title: 'Encrypted on your device',
    description:
      'Your timeline is stored only on this phone, protected with SQLCipher encryption. LifeMap does not upload your location history to our servers.',
    lottie: require('../../assets/lottie/device-encryption.json'),
  },
  {
    id: 'permissions-preview',
    title: 'Why we ask for access',
    description:
      'After you tap Get started, your phone will show a few permission prompts. Here is what they are for:',
    bullets: [
      'Location (Always) — keep your day complete even when LifeMap is closed. You can turn background tracking off anytime in Settings.',
      'Motion & fitness — detect when you are moving vs staying still, which helps visits and drives and saves battery.',
    ],
    lottie: require('../../assets/lottie/permissions-preview.json'),
  },
];
