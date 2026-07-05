CREATE TABLE IF NOT EXISTS `place_pois` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cache_id` integer NOT NULL,
	`name` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`source` text DEFAULT 'mapkit' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`cache_id`) REFERENCES `place_lookup_cache`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `place_pois_cache_id_idx` ON `place_pois` (`cache_id`);
--> statement-breakpoint
ALTER TABLE `trips` ADD COLUMN `poi_id` integer;
--> statement-breakpoint
ALTER TABLE `trips` ADD COLUMN `poi_label` text;
