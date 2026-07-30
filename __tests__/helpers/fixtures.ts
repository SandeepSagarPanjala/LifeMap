import type { LocationPointRow } from '@/db/repositories/location-days';
import type { MaterializedDayRow } from '@/db/repositories/materialized-days';
import type { MomentRow, MomentType } from '@/db/repositories/moments';
import type {
  SavedPlaceKind,
  SavedPlaceRow,
} from '@/db/repositories/saved-places';
import type { TripPointRow } from '@/db/repositories/trip-points';
import { locationPointRow } from '@/lib/location-point-row';

export function makeSavedPlace(
  partial: Partial<SavedPlaceRow> &
    Pick<SavedPlaceRow, 'id' | 'kind' | 'label' | 'lat' | 'lng'>,
): SavedPlaceRow {
  return {
    radiusMeters: 150,
    addressLine: null,
    active: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...partial,
  };
}

export function makeLocationPoint(
  partial: Partial<LocationPointRow> &
    Pick<LocationPointRow, 'id' | 'lat' | 'lng' | 'timestamp'>,
): LocationPointRow {
  return locationPointRow({
    accuracy: 10,
    ...partial,
  });
}

export function makeMoment(
  partial: Partial<MomentRow> & Pick<MomentRow, 'id' | 'type' | 'timestamp'>,
): MomentRow {
  const {
    activityValuesJson: activityValuesJsonPartial,
    importSource: importSourcePartial,
    ...rest
  } = partial;
  return {
    finishedAt: null,
    contentPath: null,
    thumbnailPath: null,
    voiceAttachmentPath: null,
    voiceAttachmentBytes: null,
    voiceDurationSec: null,
    voiceTranscript: null,
    photoAttachmentsJson: null,
    tagsJson: null,
    textBody: null,
    caption: null,
    title: null,
    moodScore: null,
    moodLabel: null,
    moodReason: null,
    moodVariant: null,
    placeLabel: null,
    contentBytes: null,
    sourceBytes: null,
    contentFormat: null,
    shareVisibility: 'private',
    contentSyncState: 'local_only',
    activityId: null,
    activityEmoji: null,
    activityLabel: null,
    activityValuesJson: activityValuesJsonPartial ?? null,
    importSource: importSourcePartial ?? null,
    ...rest,
  };
}

export function makeMaterializedDay(
  partial: Partial<MaterializedDayRow> &
    Pick<MaterializedDayRow, 'dateKey' | 'status'>,
): MaterializedDayRow {
  return {
    detectionVersion: 2,
    tripCount: 0,
    pointCount: 0,
    geometryFingerprint: null,
    excludedCrossMidnightFromMs: null,
    sealedAt: null,
    updatedAt: new Date(),
    ...partial,
  };
}

export function makeTripPoint(
  partial: Partial<TripPointRow> &
    Pick<TripPointRow, 'id' | 'tripId' | 'seq' | 'lat' | 'lng'>,
): TripPointRow {
  return {
    recordedAt: null,
    locationPointId: null,
    source: 'gps',
    momentId: null,
    activityType: null,
    ...partial,
  };
}

export function mapExportMoment(row: {
  id: number;
  timestamp: string;
  kind: string;
}): MomentRow {
  return makeMoment({
    id: row.id,
    type: row.kind as MomentType,
    timestamp: new Date(row.timestamp),
  });
}

export function mapExportSavedPlace(row: {
  id: number;
  kind: string;
  label: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  addressLine?: string | null;
  active?: number | boolean;
  createdAt: string | Date;
}): SavedPlaceRow {
  return {
    id: row.id,
    kind: row.kind as SavedPlaceKind,
    label: row.label,
    lat: row.lat,
    lng: row.lng,
    radiusMeters: row.radiusMeters,
    addressLine: row.addressLine ?? null,
    active: row.active === 0 || row.active === false ? false : true,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
  };
}
