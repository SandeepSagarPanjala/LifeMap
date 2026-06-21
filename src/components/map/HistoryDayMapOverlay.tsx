import {memo} from 'react';

import {HistoryRoutePath} from '@/components/map/HistoryRoutePath';
import {StayAreasOverlay} from '@/components/map/StayAreasOverlay';
import {StayDurationCallout} from '@/components/map/StayDurationCallout';
import {TripRouteOverlay} from '@/components/map/TripRouteOverlay';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import type {DriveEndpointLabel} from '@/lib/drive-endpoint-label';
import type {HistoryMapPlan} from '@/lib/history-map-plan';
import type {MomentCountType, MomentCounts} from '@/lib/moments/moment-counts';
import {matchSavedPlaceForStay} from '@/lib/saved-places';
import type {TripDetectionConfig} from '@/lib/trip-settings';

type HistoryDayMapOverlayProps = {
  plan: HistoryMapPlan;
  savedPlaces?: readonly SavedPlaceRow[];
  selectedSavedPlace?: SavedPlaceRow | null;
  selectedNearbyPlaceLabel?: string | null;
  selectedNearbyPlacePinned?: boolean;
  selectedDriveStartLabel?: DriveEndpointLabel;
  selectedDriveEndLabel?: DriveEndpointLabel;
  selectedEntryMomentCounts?: MomentCounts;
  onPressSelectedEntryMoments?: (type: MomentCountType) => void;
  tripConfig: TripDetectionConfig;
  playbackProgress: number | null;
};

/** All day drives/visits on the map; selected event keeps full detail and labels. */
export const HistoryDayMapOverlay = memo(function HistoryDayMapOverlay({
  plan,
  savedPlaces = [],
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
  const selectedIsSavedPlace =
    selected?.entry.kind === 'stay' &&
    (selectedSavedPlace != null ||
      matchSavedPlaceForStay(selected.entry, [...savedPlaces]) != null);

  return (
    <>
      {plan.nextDrive != null &&
      selected?.departureDrivePoints == null ? (
        <HistoryRoutePath
          key="next-drive"
          pathKey="next-drive"
          points={plan.nextDrive}
          tone="future"
        />
      ) : null}
      {plan.nextStay != null && plan.nextStay !== plan.selected?.arrivalVisit ? (
        <StayAreasOverlay
          stays={[plan.nextStay]}
          tripConfig={tripConfig}
          savedPlaces={savedPlaces}
          tone="future"
        />
      ) : null}

      {selected?.entry.kind === 'travel' &&
      selected.arrivalVisit != null &&
      !isPlaying ? (
        <>
          <StayAreasOverlay
            stays={[selected.arrivalVisit]}
            tripConfig={tripConfig}
            savedPlaces={savedPlaces}
            tone="emphasized"
          />
          <StayDurationCallout
            trip={selected.arrivalVisit}
            savedPlace={matchSavedPlaceForStay(
              selected.arrivalVisit,
              [...savedPlaces],
            )}
          />
        </>
      ) : null}

      {selected?.departureDrivePoints != null &&
      selected.departureDrivePoints.length > 0 &&
      !isPlaying ? (
        <TripRouteOverlay
          points={selected.departureDrivePoints}
          emphasized
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
            anchorStartStay={selected.anchorStartStay}
            anchorEndStay={selected.anchorEndStay}
          />
        </>
      ) : null}

      {selected?.entry.kind === 'stay' &&
      selected.inboundPoints != null &&
      !isPlaying ? (
        <TripRouteOverlay
          points={selected.inboundPoints}
          emphasized
          anchorStartStay={selected.anchorStartStay}
          anchorEndStay={selected.anchorEndStay}
        />
      ) : null}

      {selected?.entry.kind === 'stay' &&
      selected.outboundPoints != null &&
      selected.outboundPoints.length > 0 &&
      !isPlaying ? (
        <TripRouteOverlay
          points={selected.outboundPoints}
          emphasized
          anchorStartStay={selected.entry}
          anchorEndStay={selected.outboundEndStay}
        />
      ) : null}

      {selected?.entry.kind === 'stay' && !isPlaying && !selectedIsSavedPlace ? (
        <>
          <StayAreasOverlay
            stays={[selected.entry]}
            tripConfig={tripConfig}
            savedPlaces={savedPlaces}
            tone="emphasized"
          />
        </>
      ) : null}

      {selected?.entry.kind === 'stay' && !isPlaying ? (
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
          onPressMomentType={onPressSelectedEntryMoments}
        />
      ) : null}
    </>
  );
});
