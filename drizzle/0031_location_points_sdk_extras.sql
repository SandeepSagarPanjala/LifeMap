ALTER TABLE `location_points` ADD COLUMN `heading` real;
--> statement-breakpoint
ALTER TABLE `location_points` ADD COLUMN `heading_accuracy` real;
--> statement-breakpoint
ALTER TABLE `location_points` ADD COLUMN `speed_accuracy` real;
--> statement-breakpoint
ALTER TABLE `location_points` ADD COLUMN `altitude_accuracy` real;
--> statement-breakpoint
ALTER TABLE `location_points` ADD COLUMN `activity_type` text;
--> statement-breakpoint
ALTER TABLE `location_points` ADD COLUMN `activity_confidence` integer;
--> statement-breakpoint
ALTER TABLE `location_points` ADD COLUMN `is_moving` integer;
--> statement-breakpoint
ALTER TABLE `location_points` ADD COLUMN `is_mock` integer;
--> statement-breakpoint
ALTER TABLE `location_points` ADD COLUMN `uuid` text;
--> statement-breakpoint
ALTER TABLE `location_points` ADD COLUMN `battery_level` real;
--> statement-breakpoint
ALTER TABLE `location_points` ADD COLUMN `battery_is_charging` integer;
