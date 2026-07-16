import { useEffect, useState } from 'react';

import {
  getOnFootDetectionEnabledSync,
  subscribeOnFootDetectionEnabled,
} from '@/lib/on-foot-detection-settings';

export function useOnFootDetectionEnabled(): boolean {
  const [enabled, setEnabled] = useState(getOnFootDetectionEnabledSync);

  useEffect(() => subscribeOnFootDetectionEnabled(setEnabled), []);

  return enabled;
}
