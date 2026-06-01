import type {ComponentProps} from 'react';
import type LottieView from 'lottie-react-native';

type LottieSource = ComponentProps<typeof LottieView>['source'];

export type OnboardingSlideConfig = {
  id: string;
  title: string;
  description: string;
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
];
