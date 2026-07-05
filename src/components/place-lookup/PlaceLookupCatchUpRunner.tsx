import {useSyncExternalStore} from 'react';

import {ProgressStrip} from '@/components/ui/ProgressStrip';
import {
  getPlaceLookupCatchUpProgress,
  getPlaceLookupCatchUpRevision,
  subscribePlaceLookupCatchUp,
} from '@/lib/place-lookup-catch-up-events';
import {abortPlaceLookupCatchUp} from '@/lib/place-lookup-catch-up';

export function PlaceLookupCatchUpRunner() {
  const progress = useSyncExternalStore(
    subscribePlaceLookupCatchUp,
    getPlaceLookupCatchUpProgress,
    getPlaceLookupCatchUpProgress,
  );
  useSyncExternalStore(
    subscribePlaceLookupCatchUp,
    getPlaceLookupCatchUpRevision,
    getPlaceLookupCatchUpRevision,
  );

  if (progress == null || !progress.showStrip || progress.phase !== 'running') {
    return null;
  }

  const completed = progress.completed;
  const total = progress.total;
  const message =
    progress.message ??
    (total > 0
      ? `Labeling places (${completed}/${total})…`
      : 'Labeling places…');

  return (
    <ProgressStrip
      message={message}
      onDismiss={() => abortPlaceLookupCatchUp()}
    />
  );
}
