import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const locationPoints = sqliteTable(
  'location_points',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
    lat: real('lat').notNull(),
    lng: real('lng').notNull(),
    accuracy: real('accuracy'),
    altitude: real('altitude'),
    speed: real('speed'),
    source: text('source').notNull().default('gps'),
  },
  table => ({
    timestampIdx: index('location_points_timestamp_idx').on(table.timestamp),
    timestampLatLngUnique: uniqueIndex(
      'location_points_timestamp_lat_lng_unique',
    ).on(table.timestamp, table.lat, table.lng),
  }),
);

export const activities = sqliteTable('activities', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  emoji: text('emoji').notNull(),
  label: text('label').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  archivedAt: integer('archived_at', { mode: 'timestamp' }),
});

export const moments = sqliteTable(
  'moments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    type: text('type', {
      enum: ['photo', 'note', 'video', 'voice', 'activity'],
    }).notNull(),
    timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
    contentPath: text('content_path'),
    voiceAttachmentPath: text('voice_attachment_path'),
    voiceAttachmentBytes: integer('voice_attachment_bytes'),
    voiceDurationSec: integer('voice_duration_sec'),
    photoAttachmentsJson: text('photo_attachments_json'),
    textBody: text('text_body'),
    caption: text('caption'),
    placeLabel: text('place_label'),
    title: text('title'),
    moodScore: real('mood_score'),
    moodLabel: text('mood_label'),
    finishedAt: integer('finished_at', { mode: 'timestamp' }),
    contentBytes: integer('content_bytes'),
    sourceBytes: integer('source_bytes'),
    contentFormat: text('content_format'),
    shareVisibility: text('share_visibility').notNull().default('private'),
    contentSyncState: text('content_sync_state')
      .notNull()
      .default('local_only'),
    activityId: integer('activity_id').references(() => activities.id),
    activityEmoji: text('activity_emoji'),
    activityLabel: text('activity_label'),
  },
  table => ({
    timestampIdx: index('moments_timestamp_idx').on(table.timestamp),
    typeTimestampIdx: index('moments_type_timestamp_idx').on(
      table.type,
      table.timestamp,
    ),
  }),
);

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  value: text('value'),
});

export const trackingEvents = sqliteTable(
  'tracking_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
    event: text('event').notNull(),
    details: text('details'),
  },
  table => ({
    timestampIdx: index('tracking_events_timestamp_idx').on(table.timestamp),
  }),
);

export const savedPlaces = sqliteTable(
  'saved_places',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    kind: text('kind', { enum: ['home', 'work', 'favorite'] }).notNull(),
    label: text('label').notNull(),
    lat: real('lat').notNull(),
    lng: real('lng').notNull(),
    radiusMeters: integer('radius_meters').notNull().default(150),
    addressLine: text('address_line'),
    active: integer('active').notNull().default(1),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  table => ({
    kindIdx: index('saved_places_kind_idx').on(table.kind),
  }),
);

export const placeLookupCache = sqliteTable(
  'place_lookup_cache',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    anchorLat: real('anchor_lat').notNull(),
    anchorLng: real('anchor_lng').notNull(),
    venueRadiusMeters: integer('venue_radius_meters').notNull().default(100),
    addressLine: text('address_line'),
    /** @deprecated Migrated to place_pois — kept for one-time data migration. */
    candidatesJson: text('candidates_json'),
    /** @deprecated Replaced by per-trip poi_id. */
    selectedCandidateIndex: integer('selected_candidate_index'),
    lookupStatus: text('lookup_status').notNull().default('pending'),
    fetchedAt: integer('fetched_at', { mode: 'timestamp' }),
  },
  table => ({
    anchorLatIdx: index('place_lookup_cache_anchor_lat_idx').on(
      table.anchorLat,
    ),
    anchorLngIdx: index('place_lookup_cache_anchor_lng_idx').on(
      table.anchorLng,
    ),
  }),
);

export const placePois = sqliteTable(
  'place_pois',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    cacheId: integer('cache_id')
      .notNull()
      .references(() => placeLookupCache.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    lat: real('lat').notNull(),
    lng: real('lng').notNull(),
    source: text('source', { enum: ['mapkit', 'user'] })
      .notNull()
      .default('mapkit'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  table => ({
    cacheIdIdx: index('place_pois_cache_id_idx').on(table.cacheId),
  }),
);

export const trips = sqliteTable(
  'trips',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    eventKey: text('event_key').notNull().unique(),
    kind: text('kind', { enum: ['stay', 'travel', 'missing'] }).notNull(),
    dateKey: text('date_key').notNull(),
    startAt: integer('start_at', { mode: 'timestamp' }).notNull(),
    endAt: integer('end_at', { mode: 'timestamp' }).notNull(),
    durationMs: integer('duration_ms').notNull(),
    distanceKm: real('distance_km').notNull(),
    centroidLat: real('centroid_lat').notNull(),
    centroidLng: real('centroid_lng').notNull(),
    segmentOrder: integer('segment_order').notNull().default(0),
    /** Saved place name, or street address when placeKind is cache. */
    placeLabel: text('place_label'),
    /** Saved place id or place_lookup_cache id (see placeKind). */
    placeId: integer('place_id'),
    placeKind: text('place_kind', { enum: ['saved', 'cache'] }),
    /** POI row when placeKind is cache (MapKit or user-created). */
    poiId: integer('poi_id'),
    /** Denormalized POI display name. */
    poiLabel: text('poi_label'),
    /** Materialized moment membership — [{ momentId, momentKind }]. */
    momentRefs: text('moment_refs'),
    inferred: integer('inferred').notNull().default(0),
    /** @deprecated Replaced by poi_id. */
    selectedCandidateIndex: integer('selected_candidate_index'),
    detectionVersion: integer('detection_version').notNull(),
    closedAt: integer('closed_at', { mode: 'timestamp' }).notNull(),
  },
  table => ({
    dateKeyIdx: index('trips_date_key_idx').on(table.dateKey),
    startAtIdx: index('trips_start_at_idx').on(table.startAt),
  }),
);

export const tripPoints = sqliteTable(
  'trip_points',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tripId: integer('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    lat: real('lat').notNull(),
    lng: real('lng').notNull(),
    recordedAt: integer('recorded_at', { mode: 'timestamp' }),
    locationPointId: integer('location_point_id'),
    source: text('source').default('gps'),
    momentId: integer('moment_id').references(() => moments.id),
  },
  table => ({
    tripIdSeqIdx: index('trip_points_trip_id_seq_idx').on(
      table.tripId,
      table.seq,
    ),
  }),
);

export const materializedDays = sqliteTable('materialized_days', {
  dateKey: text('date_key').primaryKey(),
  status: text('status').notNull(),
  detectionVersion: integer('detection_version').notNull(),
  tripCount: integer('trip_count').notNull().default(0),
  pointCount: integer('point_count').notNull().default(0),
  geometryFingerprint: text('geometry_fingerprint'),
  /** Drive start ms withheld from past-day seal — used for today's GPS lookback. */
  excludedCrossMidnightFromMs: integer('excluded_cross_midnight_from_ms'),
  sealedAt: integer('sealed_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const settingsStatsCache = sqliteTable('settings_stats_cache', {
  key: text('key').primaryKey(),
  payloadJson: text('payload_json').notNull(),
  calculatedAt: integer('calculated_at', { mode: 'timestamp' }).notNull(),
});
