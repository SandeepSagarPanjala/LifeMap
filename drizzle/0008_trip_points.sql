CREATE TABLE IF NOT EXISTS `trip_points` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trip_id` integer NOT NULL,
	`seq` integer NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `trip_points_trip_id_seq_idx` ON `trip_points` (`trip_id`, `seq`);
