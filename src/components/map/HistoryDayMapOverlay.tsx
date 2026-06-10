import {memo} from 'react';

import {HistoryRoutePath} from '@/components/map/HistoryRoutePath';
import {StayAreasOverlay} from '@/components/map/StayAreasOverlay';
import {StayDurationCallout} from '@/components/map/StayDurationCallout';
import {TripRouteOverlay} from '@/components/map/TripRouteOverlay';
import {VisitApproachConnector} from '@/components/map/VisitApproachConnector';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import type {DriveEndpointLabel} from '@/lib/drive-endpoint-label';
import type {HistoryMapPlan} from '@/lib/history-map-plan';
import type {MomentCounts} from '@/lib/moments/moment-counts';
import type {TripDetectionConfig} from '@/lib/trip-settings';

type HistoryDayMapOverlayProps = {
  plan: HistoryMapPlan;
  selectedSavedPlace?: SavedPlaceRow | null;
  selectedNearbyPlaceLabel?: string | null;
  selectedNearbyPlacePinned?: boolean;
  selectedDriveStartLabel?: DriveEndpointLabel;
  selectedDriveEndLabel?: DriveEndpointLabel;
  selectedEntryMomentCounts?: MomentCounts;
  onPressSelectedEntryMoments?: () => void;
  tripConfig: TripDetectionConfig;
  playbackProgress: number | null;
};

/** All day drives/visits on the map; selected event keeps full detail and labels. */
export const HistoryDayMapOverlay = memo(function HistoryDayMapOverlay({
  plan,
  selectedSavedPlace = null,
  selectedNearbyPlaceLabel = null,
  selectedNearbyPlacePinned = false,
  selectedDriveStartLabel,
  selectedDriveEndLabel,
  selectedEntryMomentCounts,
  onPressSelectedEntryMoments,
  tripConfig,
  playbackProgress,
}: HistoryDayMapOverlayProps) {
  const selected = plan.selected;
  const isPlaying = playbackProgress != null;

  return (
    <>
      {plan.pastDrives.map((points, index) => (
        <HistoryRoutePath
          key={`past-drive-${index}`}
          pathKey={`past-drive-${index}`}
          points={points}
          tone="past"
        />
      ))}
      {plan.nextDrive != null ? (
        <HistoryRoutePath
          key="next-drive"
          pathKey="next-drive"
          points={plan.nextDrive}
          tone="future"
        />
      ) : null}
      {plan.pastStays.length > 0 ? (
        <StayAreasOverlay
          stays={plan.pastStays}
          tripConfig={tripConfig}
          tone="past"
        />
      ) : null}
      {plan.nextStay != null ? (
        <StayAreasOverlay
          stays={[plan.nextStay]}
          tripConfig={tripConfig}
          tone="future"
        />
      ) : null}

      {selected?.entry.kind === 'travel' &&
      selected.travelPoints != null &&
      selected.travelPoints.length > 0 ? (
        <>
          <TripRouteOverlay
            points={selected.travelPoints}
            playbackProgress={playbackProgress}
            emphasized
            startAt={selected.entry.startAt}
            endAt={selected.entry.endAt}
            startLabel={selectedDriveStartLabel}
            endLabel={selectedDriveEndLabel}
          />
          {plan.nextStay != null && !isPlaying ? (
            <VisitApproachConnector
              routePoints={selected.travelPoints}
              visit={plan.nextStay}
            />
          ) : null}
        </>
      ) : null}

      {selected?.entry.kind === 'stay' &&
      selected.inboundPoints != null &&
      !isPlaying ? (
        <>
          <TripRouteOverlay points={selected.inboundPoints} emphasized />
          <VisitApproachConnector
            routePoints={selected.inboundPoints}
            visit={selected.entry}
          />
        </>
      ) : null}

      {selected?.entry.kind === 'stay' && !isPlaying ? (
        <>
          <StayAreasOverlay
            stays={[selected.entry]}
            tripConfig={tripConfig}
            tone="emphasized"
          />
          <StayDurationCallout
            trip={selected.entry}
            savedPlace={selectedSavedPlace}
            nearbyPlaceLabel={
              selectedSavedPlace ? null : selectedNearbyPlaceLabel
            }
            nearbyPlacePinned={
              !selectedSavedPlace && selectedNearbyPlacePinned
            }
            momentCounts={selectedEntryMomentCounts}
            onPressMomentCounts={onPressSelectedEntryMoments}
          />
        </>
      ) : null}
    </>
  );
});
