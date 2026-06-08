CREATE TABLE IF NOT EXISTS `saved_places` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`radius_meters` integer DEFAULT 150 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `saved_places_kind_idx` ON `saved_places` (`kind`);
