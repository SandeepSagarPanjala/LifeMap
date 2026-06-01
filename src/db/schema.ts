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

export const moments = sqliteTable('moments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type', { enum: ['photo', 'note', 'video', 'voice'] }).notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  lat: real('lat'),
  lng: real('lng'),
  contentPath: text('content_path'),
  textBody: text('text_body'),
  caption: text('caption'),
  placeLabel: text('place_label'),
  linkedPointId: integer('linked_point_id').references(() => locationPoints.id),
  shareVisibility: text('share_visibility')
    .notNull()
    .default('private'),
  contentSyncState: text('content_sync_state')
    .notNull()
    .default('local_only'),
});

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  value: text('value'),
});

