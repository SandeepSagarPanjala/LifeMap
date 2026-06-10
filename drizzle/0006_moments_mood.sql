ALTER TABLE `moments` ADD COLUMN `title` text;
--> statement-breakpoint
ALTER TABLE `moments` ADD COLUMN `mood_score` real;
--> statement-breakpoint
ALTER TABLE `moments` ADD COLUMN `mood_label` text;
--> statement-breakpoint
ALTER TABLE `moments` ADD COLUMN `finished_at` integer;
--> statement-breakpoint
ALTER TABLE `moments` ADD COLUMN `content_bytes` integer;
--> statement-breakpoint
ALTER TABLE `moments` ADD COLUMN `source_bytes` integer;
--> statement-breakpoint
ALTER TABLE `moments` ADD COLUMN `content_format` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `moments_timestamp_idx` ON `moments` (`timestamp`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `moments_type_timestamp_idx` ON `moments` (`type`, `timestamp`);
