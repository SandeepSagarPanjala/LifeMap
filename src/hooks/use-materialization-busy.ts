import { useSyncExternalStore } from 'react';

import {
  isMaterializationBusy,
  subscribeMaterialization,
} from '@/lib/trip-materialization-events';

export function useMaterializationBusy(): boolean {
  return useSyncExternalStore(
    subscribeMaterialization,
    isMaterializationBusy,
    isMaterializationBusy,
  );
}
