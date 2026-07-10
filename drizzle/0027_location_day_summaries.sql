CREATE TABLE IF NOT EXISTS `location_day_summaries` (
	`date_key` text PRIMARY KEY NOT NULL,
	`point_count` integer NOT NULL,
	`min_timestamp` integer,
	`max_timestamp` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `location_day_summaries_date_key_idx` ON `location_day_summaries` (`date_key`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `trips_unlabeled_stays_idx` ON `trips` (`date_key`, `start_at`) WHERE `kind` = 'stay' AND `place_id` IS NULL AND `poi_id` IS NULL AND (`place_label` IS NULL OR `place_label` = '');
