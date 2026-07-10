import journal from './meta/_journal.json';

const m0000 = `CREATE TABLE \`location_points\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`timestamp\` integer NOT NULL,
	\`lat\` real NOT NULL,
	\`lng\` real NOT NULL,
	\`accuracy\` real,
	\`altitude\` real,
	\`speed\` real,
	\`source\` text DEFAULT 'gps' NOT NULL
);
--> statement-breakpoint
CREATE TABLE \`moments\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`type\` text NOT NULL,
	\`timestamp\` integer NOT NULL,
	\`lat\` real,
	\`lng\` real,
	\`content_path\` text,
	\`text_body\` text,
	\`caption\` text,
	\`place_label\` text,
	\`linked_point_id\` integer,
	\`share_visibility\` text DEFAULT 'private' NOT NULL,
	\`content_sync_state\` text DEFAULT 'local_only' NOT NULL,
	FOREIGN KEY (\`linked_point_id\`) REFERENCES \`location_points\`(\`id\`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE \`settings\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`key\` text NOT NULL,
	\`value\` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`settings_key_unique\` ON \`settings\` (\`key\`);`;

const m0001 = `CREATE INDEX IF NOT EXISTS \`location_points_timestamp_idx\` ON \`location_points\` (\`timestamp\`);`;
const m0002 = `CREATE TABLE IF NOT EXISTS \`tracking_events\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`timestamp\` integer NOT NULL,
	\`event\` text NOT NULL,
	\`details\` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`tracking_events_timestamp_idx\` ON \`tracking_events\` (\`timestamp\`);`;

const m0003 = `CREATE TABLE IF NOT EXISTS \`saved_places\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`kind\` text NOT NULL,
	\`label\` text NOT NULL,
	\`lat\` real NOT NULL,
	\`lng\` real NOT NULL,
	\`radius_meters\` integer DEFAULT 150 NOT NULL,
	\`created_at\` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`saved_places_kind_idx\` ON \`saved_places\` (\`kind\`);`;

const m0004 = `CREATE TABLE IF NOT EXISTS \`place_lookup_cache\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`anchor_lat\` real NOT NULL,
	\`anchor_lng\` real NOT NULL,
	\`venue_radius_meters\` integer DEFAULT 250 NOT NULL,
	\`address_line\` text,
	\`candidates_json\` text,
	\`selected_candidate_index\` integer,
	\`lookup_status\` text DEFAULT 'pending' NOT NULL,
	\`fetched_at\` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`place_lookup_cache_anchor_lat_idx\` ON \`place_lookup_cache\` (\`anchor_lat\`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`place_lookup_cache_anchor_lng_idx\` ON \`place_lookup_cache\` (\`anchor_lng\`);`;

const m0005 = `CREATE TABLE IF NOT EXISTS \`trips\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`event_key\` text NOT NULL,
	\`kind\` text NOT NULL,
	\`date_key\` text NOT NULL,
	\`start_at\` integer NOT NULL,
	\`end_at\` integer NOT NULL,
	\`duration_ms\` integer NOT NULL,
	\`distance_km\` real NOT NULL,
	\`centroid_lat\` real NOT NULL,
	\`centroid_lng\` real NOT NULL,
	\`place_lookup_cache_id\` integer,
	\`selected_candidate_index\` integer,
	\`detection_version\` integer NOT NULL,
	\`closed_at\` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS \`trips_event_key_unique\` ON \`trips\` (\`event_key\`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`trips_date_key_idx\` ON \`trips\` (\`date_key\`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`trips_start_at_idx\` ON \`trips\` (\`start_at\`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`materialized_days\` (
	\`date_key\` text PRIMARY KEY NOT NULL,
	\`status\` text NOT NULL,
	\`detection_version\` integer NOT NULL,
	\`trip_count\` integer DEFAULT 0 NOT NULL,
	\`point_count\` integer DEFAULT 0 NOT NULL,
	\`sealed_at\` integer,
	\`updated_at\` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`materialization_queue\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`job_type\` text NOT NULL,
	\`date_key\` text NOT NULL,
	\`status\` text DEFAULT 'pending' NOT NULL,
	\`attempts\` integer DEFAULT 0 NOT NULL,
	\`created_at\` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`materialization_queue_status_idx\` ON \`materialization_queue\` (\`status\`);`;

const m0006 = `ALTER TABLE \`moments\` ADD COLUMN \`title\` text;
--> statement-breakpoint
ALTER TABLE \`moments\` ADD COLUMN \`mood_score\` real;
--> statement-breakpoint
ALTER TABLE \`moments\` ADD COLUMN \`mood_label\` text;
--> statement-breakpoint
ALTER TABLE \`moments\` ADD COLUMN \`finished_at\` integer;
--> statement-breakpoint
ALTER TABLE \`moments\` ADD COLUMN \`content_bytes\` integer;
--> statement-breakpoint
ALTER TABLE \`moments\` ADD COLUMN \`source_bytes\` integer;
--> statement-breakpoint
ALTER TABLE \`moments\` ADD COLUMN \`content_format\` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`moments_timestamp_idx\` ON \`moments\` (\`timestamp\`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`moments_type_timestamp_idx\` ON \`moments\` (\`type\`, \`timestamp\`);`;

const m0007 = `CREATE TABLE IF NOT EXISTS \`settings_stats_cache\` (
	\`key\` text PRIMARY KEY NOT NULL,
	\`payload_json\` text NOT NULL,
	\`calculated_at\` integer NOT NULL
);`;

const m0008 = `CREATE TABLE IF NOT EXISTS \`trip_points\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`trip_id\` integer NOT NULL,
	\`seq\` integer NOT NULL,
	\`lat\` real NOT NULL,
	\`lng\` real NOT NULL,
	FOREIGN KEY (\`trip_id\`) REFERENCES \`trips\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`trip_points_trip_id_seq_idx\` ON \`trip_points\` (\`trip_id\`, \`seq\`);`;

const m0009 = `ALTER TABLE \`trips\` ADD COLUMN \`segment_order\` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE \`trips\` ADD COLUMN \`saved_place_label\` text;
--> statement-breakpoint
ALTER TABLE \`trips\` ADD COLUMN \`saved_place_id\` integer;
--> statement-breakpoint
ALTER TABLE \`trips\` ADD COLUMN \`inferred\` integer DEFAULT 0 NOT NULL;`;

const m0010 = `ALTER TABLE \`trip_points\` ADD COLUMN \`recorded_at\` integer;
--> statement-breakpoint
ALTER TABLE \`trip_points\` ADD COLUMN \`location_point_id\` integer;
--> statement-breakpoint
ALTER TABLE \`trip_points\` ADD COLUMN \`source\` text DEFAULT 'gps';`;

const m0011 = `DROP INDEX IF EXISTS \`materialization_queue_status_idx\`;
--> statement-breakpoint
DROP TABLE IF EXISTS \`materialization_queue\`;`;

const m0012 = `ALTER TABLE \`moments\` ADD COLUMN \`voice_attachment_path\` text;
--> statement-breakpoint
ALTER TABLE \`moments\` ADD COLUMN \`voice_attachment_bytes\` integer;`;

const m0013 = `ALTER TABLE \`moments\` ADD COLUMN \`photo_attachments_json\` text;`;

const m0014 = `ALTER TABLE \`materialized_days\` ADD COLUMN \`geometry_fingerprint\` text;`;

const m0015 = `ALTER TABLE \`saved_places\` ADD COLUMN \`address_line\` text;`;

const m0016 = `ALTER TABLE \`moments\` ADD COLUMN \`voice_duration_sec\` integer;`;

const m0017 = `CREATE TABLE \`activities\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`emoji\` text NOT NULL,
	\`label\` text NOT NULL,
	\`sort_order\` integer DEFAULT 0 NOT NULL,
	\`created_at\` integer NOT NULL,
	\`archived_at\` integer
);
--> statement-breakpoint
ALTER TABLE \`moments\` ADD COLUMN \`activity_id\` integer;
--> statement-breakpoint
ALTER TABLE \`moments\` ADD COLUMN \`activity_emoji\` text;
--> statement-breakpoint
ALTER TABLE \`moments\` ADD COLUMN \`activity_label\` text;`;

const m0018 = `ALTER TABLE \`saved_places\` ADD COLUMN \`active\` integer DEFAULT 1 NOT NULL;`;

const m0019 = `CREATE UNIQUE INDEX IF NOT EXISTS \`location_points_timestamp_lat_lng_unique\` ON \`location_points\` (\`timestamp\`, \`lat\`, \`lng\`);`;

const m0020 = `UPDATE \`saved_places\` SET \`radius_meters\` = 150 WHERE \`radius_meters\` != 150;
--> statement-breakpoint
UPDATE \`place_lookup_cache\` SET \`venue_radius_meters\` = 100 WHERE \`venue_radius_meters\` != 100;`;

const m0021 = `ALTER TABLE \`trips\` ADD COLUMN \`place_label\` text;
--> statement-breakpoint
ALTER TABLE \`trips\` ADD COLUMN \`place_id\` integer;
--> statement-breakpoint
ALTER TABLE \`trips\` ADD COLUMN \`place_kind\` text;
--> statement-breakpoint
UPDATE \`trips\` SET \`place_id\` = \`saved_place_id\`, \`place_kind\` = 'saved', \`place_label\` = \`saved_place_label\` WHERE \`saved_place_id\` IS NOT NULL;
--> statement-breakpoint
UPDATE \`trips\` SET \`place_id\` = \`place_lookup_cache_id\`, \`place_kind\` = 'cache', \`place_label\` = \`saved_place_label\` WHERE \`place_lookup_cache_id\` IS NOT NULL AND \`saved_place_id\` IS NULL;
--> statement-breakpoint
UPDATE \`trips\` SET \`place_label\` = \`saved_place_label\` WHERE \`saved_place_id\` IS NULL AND \`place_lookup_cache_id\` IS NULL AND \`saved_place_label\` IS NOT NULL;`;

const m0022 = `ALTER TABLE \`trips\` DROP COLUMN \`saved_place_label\`;
--> statement-breakpoint
ALTER TABLE \`trips\` DROP COLUMN \`saved_place_id\`;
--> statement-breakpoint
ALTER TABLE \`trips\` DROP COLUMN \`place_lookup_cache_id\`;`;

const m0023 = `ALTER TABLE \`trips\` ADD COLUMN \`moment_refs\` text;
--> statement-breakpoint
ALTER TABLE \`trip_points\` ADD COLUMN \`moment_id\` integer REFERENCES \`moments\`(\`id\`);`;

const m0024 = `SELECT 1`;

const m0025 = `CREATE TABLE IF NOT EXISTS \`place_pois\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`cache_id\` integer NOT NULL,
	\`name\` text NOT NULL,
	\`lat\` real NOT NULL,
	\`lng\` real NOT NULL,
	\`source\` text DEFAULT 'mapkit' NOT NULL,
	\`created_at\` integer NOT NULL,
	FOREIGN KEY (\`cache_id\`) REFERENCES \`place_lookup_cache\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`place_pois_cache_id_idx\` ON \`place_pois\` (\`cache_id\`);
--> statement-breakpoint
ALTER TABLE \`trips\` ADD COLUMN \`poi_id\` integer;
--> statement-breakpoint
ALTER TABLE \`trips\` ADD COLUMN \`poi_label\` text;`;

const m0026 = `ALTER TABLE \`materialized_days\` ADD COLUMN \`excluded_cross_midnight_from_ms\` integer;`;

export default {
  journal,
  migrations: {
    m0000,
    m0001,
    m0002,
    m0003,
    m0004,
    m0005,
    m0006,
    m0007,
    m0008,
    m0009,
    m0010,
    m0011,
    m0012,
    m0013,
    m0014,
    m0015,
    m0016,
    m0017,
    m0018,
    m0019,
    m0020,
    m0021,
    m0022,
    m0023,
    m0024,
    m0025,
    m0026,
  },
};
