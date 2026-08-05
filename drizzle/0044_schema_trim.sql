DROP INDEX IF EXISTS `location_points_timestamp_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `visit_label_overrides_date_key_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `place_lookup_cache_anchor_lat_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `place_lookup_cache_anchor_lng_idx`;
--> statement-breakpoint
DROP TABLE IF EXISTS `tracking_events`;
--> statement-breakpoint
ALTER TABLE `location_day_summaries` DROP COLUMN `point_count`;
--> statement-breakpoint
ALTER TABLE `location_day_summaries` DROP COLUMN `min_timestamp`;
--> statement-breakpoint
ALTER TABLE `location_day_summaries` DROP COLUMN `max_timestamp`;
--> statement-breakpoint
ALTER TABLE `materialized_days` DROP COLUMN `point_count`;
--> statement-breakpoint
ALTER TABLE `materialized_days` DROP COLUMN `trip_count`;
--> statement-breakpoint
ALTER TABLE `trips` DROP COLUMN `selected_candidate_index`;
--> statement-breakpoint
ALTER TABLE `visit_label_overrides` DROP COLUMN `end_at_ms`;
--> statement-breakpoint
ALTER TABLE `moments` DROP COLUMN `share_visibility`;
--> statement-breakpoint
ALTER TABLE `moments` DROP COLUMN `content_sync_state`;
--> statement-breakpoint
ALTER TABLE `moments` DROP COLUMN `mood_score`;
--> statement-breakpoint
ALTER TABLE `moments` DROP COLUMN `place_label`;
--> statement-breakpoint
ALTER TABLE `place_lookup_cache` DROP COLUMN `candidates_json`;
--> statement-breakpoint
ALTER TABLE `place_lookup_cache` DROP COLUMN `selected_candidate_index`;
