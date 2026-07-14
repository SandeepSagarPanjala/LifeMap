CREATE TABLE IF NOT EXISTS `visit_label_overrides` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date_key` text NOT NULL,
	`start_at_ms` integer NOT NULL,
	`poi_id` integer NOT NULL,
	`poi_label` text,
	`place_id` integer,
	`place_kind` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `visit_label_overrides_date_start_unique` ON `visit_label_overrides` (`date_key`, `start_at_ms`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `visit_label_overrides_date_key_idx` ON `visit_label_overrides` (`date_key`);
