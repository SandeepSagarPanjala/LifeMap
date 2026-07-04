ALTER TABLE `trips` ADD COLUMN `place_label` text;
--> statement-breakpoint
ALTER TABLE `trips` ADD COLUMN `place_id` integer;
--> statement-breakpoint
ALTER TABLE `trips` ADD COLUMN `place_kind` text;
--> statement-breakpoint
UPDATE `trips` SET `place_id` = `saved_place_id`, `place_kind` = 'saved', `place_label` = `saved_place_label` WHERE `saved_place_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `trips` SET `place_id` = `place_lookup_cache_id`, `place_kind` = 'cache', `place_label` = `saved_place_label` WHERE `place_lookup_cache_id` IS NOT NULL AND `saved_place_id` IS NULL;
--> statement-breakpoint
UPDATE `trips` SET `place_label` = `saved_place_label` WHERE `saved_place_id` IS NULL AND `place_lookup_cache_id` IS NULL AND `saved_place_label` IS NOT NULL;
