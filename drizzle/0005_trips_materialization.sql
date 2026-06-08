CREATE TABLE IF NOT EXISTS `trips` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_key` text NOT NULL,
	`kind` text NOT NULL,
	`date_key` text NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`distance_km` real NOT NULL,
	`centroid_lat` real NOT NULL,
	`centroid_lng` real NOT NULL,
	`place_lookup_cache_id` integer,
	`selected_candidate_index` integer,
	`detection_version` integer NOT NULL,
	`closed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `trips_event_key_unique` ON `trips` (`event_key`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `trips_date_key_idx` ON `trips` (`date_key`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `trips_start_at_idx` ON `trips` (`start_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `materialized_days` (
	`date_key` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`detection_version` integer NOT NULL,
	`trip_count` integer DEFAULT 0 NOT NULL,
	`point_count` integer DEFAULT 0 NOT NULL,
	`sealed_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `materialization_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_type` text NOT NULL,
	`date_key` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `materialization_queue_status_idx` ON `materialization_queue` (`status`);
