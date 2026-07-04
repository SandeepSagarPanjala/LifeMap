ALTER TABLE `trips` ADD COLUMN `moment_refs` text;
--> statement-breakpoint
ALTER TABLE `trip_points` ADD COLUMN `moment_id` integer REFERENCES `moments`(`id`);
