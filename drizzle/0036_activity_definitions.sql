ALTER TABLE `activities` ADD `schema_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `activities` ADD `source` text DEFAULT 'blank' NOT NULL;--> statement-breakpoint
ALTER TABLE `activities` ADD `template_id` text;--> statement-breakpoint
ALTER TABLE `activities` ADD `definition_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `moments` ADD `activity_values_json` text;
