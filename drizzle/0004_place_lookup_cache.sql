CREATE TABLE IF NOT EXISTS `place_lookup_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`anchor_lat` real NOT NULL,
	`anchor_lng` real NOT NULL,
	`venue_radius_meters` integer DEFAULT 250 NOT NULL,
	`address_line` text,
	`candidates_json` text,
	`selected_candidate_index` integer,
	`lookup_status` text DEFAULT 'pending' NOT NULL,
	`fetched_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `place_lookup_cache_anchor_lat_idx` ON `place_lookup_cache` (`anchor_lat`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `place_lookup_cache_anchor_lng_idx` ON `place_lookup_cache` (`anchor_lng`);
