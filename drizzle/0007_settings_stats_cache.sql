CREATE TABLE IF NOT EXISTS `settings_stats_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`payload_json` text NOT NULL,
	`calculated_at` integer NOT NULL
);
