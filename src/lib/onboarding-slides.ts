import type { ComponentProps } from 'react';
import type LottieView from 'lottie-react-native';

import { APP_COPY } from '@/lib/app-copy';

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
    title: APP_COPY.onboarding.slides.locationHistory.title,
    description: APP_COPY.onboarding.slides.locationHistory.description,
    lottie: require('../../assets/lottie/location-history.json'),
  },
  {
    id: 'capture-moments',
    title: APP_COPY.onboarding.slides.captureMoments.title,
    description: APP_COPY.onboarding.slides.captureMoments.description,
    lottie: require('../../assets/lottie/capture-moment.json'),
  },
  {
    id: 'private-by-design',
    title: APP_COPY.onboarding.slides.privateByDesign.title,
    description: APP_COPY.onboarding.slides.privateByDesign.description,
    lottie: require('../../assets/lottie/device-encryption.json'),
  },
  {
    id: 'permissions-preview',
    title: APP_COPY.onboarding.slides.permissionsPreview.title,
    description: APP_COPY.onboarding.slides.permissionsPreview.description,
    bullets: [
      APP_COPY.onboarding.bullets.locationAlways,
      APP_COPY.onboarding.bullets.motionFitness,
    ],
    lottie: require('../../assets/lottie/permissions-preview.json'),
  },
];
