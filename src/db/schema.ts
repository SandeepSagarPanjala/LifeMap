import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const locationPoints = sqliteTable('location_points', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  lat: real('lat').notNull(),
  lng: real('lng').notNull(),
  accuracy: real('accuracy'),
  altitude: real('altitude'),
  speed: real('speed'),
  source: text('source').notNull().default('gps'),
});

export const activities = sqliteTable('activities', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  emoji: text('emoji').notNull(),
  label: text('label').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', {mode: 'timestamp'}).notNull(),
  archivedAt: integer('archived_at', {mode: 'timestamp'}),
});

export const moments = sqliteTable('moments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type', {
    enum: ['photo', 'note', 'video', 'voice', 'activity'],
  }).notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  lat: real('lat'),
  lng: real('lng'),
  contentPath: text('content_path'),
  voiceAttachmentPath: text('voice_attachment_path'),
  voiceAttachmentBytes: integer('voice_attachment_bytes'),
  voiceDurationSec: integer('voice_duration_sec'),
  photoAttachmentsJson: text('photo_attachments_json'),
  textBody: text('text_body'),
  caption: text('caption'),
  placeLabel: text('place_label'),
  linkedPointId: integer('linked_point_id').references(() => locationPoints.id),
  title: text('title'),
  moodScore: real('mood_score'),
  moodLabel: text('mood_label'),
  finishedAt: integer('finished_at', {mode: 'timestamp'}),
  contentBytes: integer('content_bytes'),
  sourceBytes: integer('source_bytes'),
  contentFormat: text('content_format'),
  shareVisibility: text('share_visibility')
    .notNull()
    .default('private'),
  contentSyncState: text('content_sync_state')
    .notNull()
    .default('local_only'),
  activityId: integer('activity_id').references(() => activities.id),
  activityEmoji: text('activity_emoji'),
  activityLabel: text('activity_label'),
});

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  value: text('value'),
});

export const trackingEvents = sqliteTable('tracking_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: integer('timestamp', {mode: 'timestamp'}).notNull(),
  event: text('event').notNull(),
  details: text('details'),
});

export const savedPlaces = sqliteTable('saved_places', {
  id: integer('id').primaryKey({autoIncrement: true}),
  kind: text('kind', {enum: ['home', 'work', 'favorite']}).notNull(),
  label: text('label').notNull(),
  lat: real('lat').notNull(),
  lng: real('lng').notNull(),
  radiusMeters: integer('radius_meters').notNull().default(150),
  addressLine: text('address_line'),
  active: integer('active').notNull().default(1),
  createdAt: integer('created_at', {mode: 'timestamp'}).notNull(),
});

export const placeLookupCache = sqliteTable('place_lookup_cache', {
  id: integer('id').primaryKey({autoIncrement: true}),
  anchorLat: real('anchor_lat').notNull(),
  anchorLng: real('anchor_lng').notNull(),
  venueRadiusMeters: integer('venue_radius_meters').notNull().default(250),
  addressLine: text('address_line'),
  candidatesJson: text('candidates_json'),
  selectedCandidateIndex: integer('selected_candidate_index'),
  lookupStatus: text('lookup_status').notNull().default('pending'),
  fetchedAt: integer('fetched_at', {mode: 'timestamp'}),
});

export const trips = sqliteTable('trips', {
  id: integer('id').primaryKey({autoIncrement: true}),
  eventKey: text('event_key').notNull().unique(),
  kind: text('kind', {enum: ['stay', 'travel', 'missing']}).notNull(),
  dateKey: text('date_key').notNull(),
  startAt: integer('start_at', {mode: 'timestamp'}).notNull(),
  endAt: integer('end_at', {mode: 'timestamp'}).notNull(),
  durationMs: integer('duration_ms').notNull(),
  distanceKm: real('distance_km').notNull(),
  centroidLat: real('centroid_lat').notNull(),
  centroidLng: real('centroid_lng').notNull(),
  segmentOrder: integer('segment_order').notNull().default(0),
  savedPlaceLabel: text('saved_place_label'),
  savedPlaceId: integer('saved_place_id'),
  inferred: integer('inferred').notNull().default(0),
  placeLookupCacheId: integer('place_lookup_cache_id'),
  selectedCandidateIndex: integer('selected_candidate_index'),
  detectionVersion: integer('detection_version').notNull(),
  closedAt: integer('closed_at', {mode: 'timestamp'}).notNull(),
});

export const tripPoints = sqliteTable('trip_points', {
  id: integer('id').primaryKey({autoIncrement: true}),
  tripId: integer('trip_id')
    .notNull()
    .references(() => trips.id, {onDelete: 'cascade'}),
  seq: integer('seq').notNull(),
  lat: real('lat').notNull(),
  lng: real('lng').notNull(),
  recordedAt: integer('recorded_at', {mode: 'timestamp'}),
  locationPointId: integer('location_point_id'),
  source: text('source').default('gps'),
});

export const materializedDays = sqliteTable('materialized_days', {
  dateKey: text('date_key').primaryKey(),
  status: text('status').notNull(),
  detectionVersion: integer('detection_version').notNull(),
  tripCount: integer('trip_count').notNull().default(0),
  pointCount: integer('point_count').notNull().default(0),
  geometryFingerprint: text('geometry_fingerprint'),
  sealedAt: integer('sealed_at', {mode: 'timestamp'}),
  updatedAt: integer('updated_at', {mode: 'timestamp'}).notNull(),
});

export const settingsStatsCache = sqliteTable('settings_stats_cache', {
  key: text('key').primaryKey(),
  payloadJson: text('payload_json').notNull(),
  calculatedAt: integer('calculated_at', {mode: 'timestamp'}).notNull(),
});

