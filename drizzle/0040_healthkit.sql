CREATE TABLE IF NOT EXISTS `health_sleep_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`source_name` text,
	`synced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `health_sleep_sessions_uuid_unique` ON `health_sleep_sessions` (`uuid`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `health_sleep_sessions_start_end_idx` ON `health_sleep_sessions` (`start_at`, `end_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `health_workouts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`activity_type` integer NOT NULL,
	`activity_label` text NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`duration_sec` integer NOT NULL,
	`distance_m` real,
	`linked_moment_id` integer,
	`synced_at` integer NOT NULL,
	FOREIGN KEY (`linked_moment_id`) REFERENCES `moments`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `health_workouts_uuid_unique` ON `health_workouts` (`uuid`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `health_workouts_start_end_idx` ON `health_workouts` (`start_at`, `end_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `health_day_steps` (
	`date_key` text PRIMARY KEY NOT NULL,
	`steps` integer NOT NULL,
	`synced_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `moments` ADD `import_source` text;
