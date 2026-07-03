import type {DayTimelineEntry, DetectedTrip} from '../../mobile/types';
import {
  driveEndpointLabel,
  driveStatsLine,
  formatStayVisitLabel,
  formatTimelineStats,
  formatTimelineTitle,
  formatTripTimeRange,
  visitPlaceName,
} from '../../mobile/timeline-format';
import type {SavedPlaceRow} from '../../types';
import {DRIVE_CAR_LOTTIE, VISIT_RELAX_LOTTIE} from './lottie-sources';
import {MobileLottie} from './MobileLottie';
import {MobileMomentCountsRow} from './MobileMomentCountsRow';
import {hasMobileMomentCounts} from './mobile-moment-theme';
import {
  SavedPlaceIcon,
  SAVED_PLACE_ICON_COLOR,
  SAVED_PLACE_VISIT_COLOR,
} from './SavedPlaceIcon';

type MobileEventCardProps = {
  entry: DayTimelineEntry | null;
  savedPlaces: readonly SavedPlaceRow[];
  scrubOnEmpty?: boolean;
  emptyDayWithoutData?: boolean;
};

function MomentSection({entry}: {entry: DayTimelineEntry}) {
  if (!hasMobileMomentCounts(entry.momentCounts)) {
    return null;
  }
  return (
    <div className="mobile-event-moments">
      <MobileMomentCountsRow counts={entry.momentCounts} />
      <div className="mobile-event-moment-divider" />
    </div>
  );
}

function savedPlaceKindForId(
  savedPlaces: readonly SavedPlaceRow[],
  id: number | undefined,
): SavedPlaceRow['kind'] | undefined {
  if (id == null) {
    return undefined;
  }
  return savedPlaces.find(place => place.id === id)?.kind;
}

function DriveEndpointRow({
  label,
  kind,
}: {
  label: string | null;
  kind?: SavedPlaceRow['kind'];
}) {
  if (label == null) {
    return null;
  }
  return (
    <span className="mobile-drive-endpoint-row">
      {kind != null ? (
        <SavedPlaceIcon
          kind={kind}
          size={14}
          color={SAVED_PLACE_ICON_COLOR[kind]}
        />
      ) : null}
      <span className="mobile-drive-endpoint-text">{label}</span>
    </span>
  );
}

export function MobileEventCard({
  entry,
  savedPlaces,
  scrubOnEmpty = false,
  emptyDayWithoutData = false,
}: MobileEventCardProps) {
  if (entry == null) {
    const title = scrubOnEmpty
      ? 'Select an event'
      : emptyDayWithoutData
        ? 'No location data'
        : 'No history yet';
    const subtitle = scrubOnEmpty
      ? 'Tap a visit or drive on the bar, or use the arrows.'
      : emptyDayWithoutData
        ? 'This export has no GPS points for this day.'
        : 'Load a JSON export with location points to preview the mobile timeline.';
    return (
      <div className="mobile-event-card mobile-event-card-empty">
        <div className="mobile-event-title">{title}</div>
        <div className="mobile-event-subtitle">{subtitle}</div>
      </div>
    );
  }

  if (entry.kind === 'gap') {
    return (
      <div className="mobile-event-card mobile-event-card-gap">
        <div className="mobile-event-kind">Gap</div>
        <div className="mobile-event-title">{formatTimelineTitle(entry)}</div>
        <div className="mobile-event-subtitle">{formatTimelineStats(entry)}</div>
      </div>
    );
  }

  if (entry.kind === 'stay') {
    const visit = formatStayVisitLabel(
      entry.startAt,
      entry.endAt,
      entry.durationMs,
    );
    const placeName = visitPlaceName(entry);
    return (
      <div className="mobile-event-card mobile-event-card-stay">
        <MomentSection entry={entry} />
        <div className="mobile-event-kind-row">
          <span className="mobile-event-kind">Visit</span>
          {entry.savedPlaceKind ? (
            <span className="mobile-visit-place">
              <SavedPlaceIcon
                kind={entry.savedPlaceKind}
                size={16}
                color={SAVED_PLACE_VISIT_COLOR}
              />
              {placeName ?? 'Saved place'}
            </span>
          ) : placeName ? (
            <span className="mobile-visit-place">{placeName}</span>
          ) : entry.placeLookupCacheId != null ? (
            <span className="mobile-visit-place">Place #{entry.placeLookupCacheId}</span>
          ) : null}
        </div>
        <div className="mobile-visit-lottie-anchor">
          <div className="mobile-visit-lottie-clip">
            <MobileLottie
              animationData={VISIT_RELAX_LOTTIE}
              className="mobile-visit-lottie"
            />
          </div>
        </div>
        <div className="mobile-event-title-row mobile-event-title-row-stay">
          <div className="mobile-event-title">{visit.title}</div>
          <div className="mobile-event-subtitle">{visit.subtitle}</div>
        </div>
        <button
          type="button"
          className="mobile-event-action mobile-event-action-stay"
          aria-label="Zoom to visit on map">
          <span className="mobile-play-icon" aria-hidden>
            ▶
          </span>
        </button>
      </div>
    );
  }

  return <MobileDriveCard entry={entry} savedPlaces={savedPlaces} />;
}

function MobileDriveCard({
  entry,
  savedPlaces,
}: {
  entry: DetectedTrip;
  savedPlaces: readonly SavedPlaceRow[];
}) {
  const from = driveEndpointLabel(entry.fromSavedPlaceLabel);
  const to = driveEndpointLabel(entry.toSavedPlaceLabel);
  const fromKind = savedPlaceKindForId(savedPlaces, entry.fromSavedPlaceId);
  const toKind = savedPlaceKindForId(savedPlaces, entry.toSavedPlaceId);
  const showRoute = from != null || to != null;

  return (
    <div className="mobile-event-card mobile-event-card-drive">
      <MomentSection entry={entry} />
      {showRoute ? (
        <div className="mobile-drive-route-row">
          <DriveEndpointRow label={from} kind={fromKind} />
          {from != null && to != null ? (
            <span className="mobile-drive-route-arrow">→</span>
          ) : null}
          <DriveEndpointRow label={to} kind={toKind} />
        </div>
      ) : (
        <div className="mobile-event-title mobile-drive-route-fallback">
          {formatTripTimeRange(entry.startAt, entry.endAt)}
        </div>
      )}
      <div className="mobile-drive-footer">
        <div className="mobile-drive-car-column">
          <div className="mobile-drive-car-clip">
            <MobileLottie
              animationData={DRIVE_CAR_LOTTIE}
              className="mobile-drive-car-lottie"
            />
          </div>
        </div>
        <div className="mobile-drive-details">
          <div className="mobile-event-title">
            {formatTripTimeRange(entry.startAt, entry.endAt)}
          </div>
          <div className="mobile-event-subtitle">{driveStatsLine(entry)}</div>
        </div>
        <button
          type="button"
          className="mobile-event-action mobile-event-action-drive"
          aria-label="Play on map">
          <span className="mobile-play-icon" aria-hidden>
            ▶
          </span>
        </button>
      </div>
    </div>
  );
}

export {SAVED_PLACE_ICON_COLOR, SAVED_PLACE_VISIT_COLOR};
