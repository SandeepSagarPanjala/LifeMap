CREATE TABLE IF NOT EXISTS `health_sleep_samples` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`value` integer NOT NULL,
	`synced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `health_sleep_samples_uuid_unique` ON `health_sleep_samples` (`uuid`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `health_sleep_samples_start_end_idx` ON `health_sleep_samples` (`start_at`, `end_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `health_day_sleep` (
	`date_key` text PRIMARY KEY NOT NULL,
	`asleep_ms` integer NOT NULL,
	`awake_ms` integer NOT NULL,
	`rem_ms` integer NOT NULL,
	`core_ms` integer NOT NULL,
	`deep_ms` integer NOT NULL,
	`unspecified_ms` integer NOT NULL,
	`awakenings_over_5_min` integer DEFAULT 0 NOT NULL,
	`sleep_start_at` integer,
	`sleep_end_at` integer,
	`score` integer,
	`synced_at` integer NOT NULL
);
