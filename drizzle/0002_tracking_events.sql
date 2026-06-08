CREATE TABLE IF NOT EXISTS `tracking_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`timestamp` integer NOT NULL,
	`event` text NOT NULL,
	`details` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tracking_events_timestamp_idx` ON `tracking_events` (`timestamp`);
