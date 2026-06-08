import {ONBOARDING_SLIDES} from '../src/lib/onboarding-slides';

describe('onboarding slides', () => {
  it('includes feature, privacy, and permission primer slides', () => {
    expect(ONBOARDING_SLIDES).toHaveLength(4);
    expect(ONBOARDING_SLIDES.map(slide => slide.id)).toEqual([
      'location-history',
      'capture-moments',
      'private-by-design',
      'permissions-preview',
    ]);
  });

  it('uses encryption lottie on the private-by-design slide', () => {
    const privacy = ONBOARDING_SLIDES.find(slide => slide.id === 'private-by-design');
    expect(privacy?.lottie).toBeDefined();
  });

  it('explains permissions before the system prompts', () => {
    const permissions = ONBOARDING_SLIDES.find(slide => slide.id === 'permissions-preview');
    expect(permissions?.lottie).toBeDefined();
    expect(permissions?.bullets?.length).toBeGreaterThanOrEqual(2);
    expect(permissions?.description).toContain('Get started');
  });
});
