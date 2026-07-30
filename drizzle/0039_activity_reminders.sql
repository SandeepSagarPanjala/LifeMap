ALTER TABLE `activities` ADD `reminder_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `activities` ADD `reminder_repeat` text DEFAULT 'never' NOT NULL;--> statement-breakpoint
ALTER TABLE `activities` ADD `reminder_time_minutes` integer;--> statement-breakpoint
ALTER TABLE `activities` ADD `reminder_weekday` integer;--> statement-breakpoint
ALTER TABLE `activities` ADD `reminder_day_of_month` integer;--> statement-breakpoint
ALTER TABLE `activities` ADD `reminder_anchor_at` integer;--> statement-breakpoint
ALTER TABLE `activities` ADD `reminder_sound` text DEFAULT 'ding' NOT NULL;
