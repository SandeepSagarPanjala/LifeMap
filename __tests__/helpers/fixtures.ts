import type {LocationPointRow} from '@/db/repositories/location-days';
import type {MaterializedDayRow} from '@/db/repositories/materialized-days';
import type {MomentRow, MomentType} from '@/db/repositories/moments';
import type {SavedPlaceKind, SavedPlaceRow} from '@/db/repositories/saved-places';
import type {TripPointRow} from '@/db/repositories/trip-points';

export function makeSavedPlace(
  partial: Partial<SavedPlaceRow> &
    Pick<SavedPlaceRow, 'id' | 'kind' | 'label' | 'lat' | 'lng'>,
): SavedPlaceRow {
  return {
    radiusMeters: 150,
    addressLine: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...partial,
  };
}

export function makeLocationPoint(
  partial: Partial<LocationPointRow> &
    Pick<LocationPointRow, 'id' | 'lat' | 'lng' | 'timestamp'>,
): LocationPointRow {
  return {
    accuracy: 10,
    altitude: null,
    speed: null,
    source: 'gps',
    ...partial,
  };
}

export function makeMoment(
  partial: Partial<MomentRow> & Pick<MomentRow, 'id' | 'type' | 'timestamp'>,
): MomentRow {
  return {
    finishedAt: null,
    lat: null,
    lng: null,
    contentPath: null,
    voiceAttachmentPath: null,
    voiceAttachmentBytes: null,
    photoAttachmentsJson: null,
    textBody: null,
    caption: null,
    title: null,
    moodScore: null,
    moodLabel: null,
    placeLabel: null,
    linkedPointId: null,
    contentBytes: null,
    sourceBytes: null,
    contentFormat: null,
    shareVisibility: 'private',
    contentSyncState: 'local_only',
    ...partial,
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
    ...partial,
  };
}

export function mapExportMoment(row: {
  id: number;
  timestamp: string;
  lat: number | null;
  lng: number | null;
  kind: string;
}): MomentRow {
  return makeMoment({
    id: row.id,
    type: row.kind as MomentType,
    timestamp: new Date(row.timestamp),
    lat: row.lat,
    lng: row.lng,
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
    createdAt:
      row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
  };
}
