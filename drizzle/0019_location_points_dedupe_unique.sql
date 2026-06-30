DELETE FROM `location_points`
WHERE `id` NOT IN (
  SELECT MIN(`id`) FROM `location_points` GROUP BY `timestamp`, `lat`, `lng`
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `location_points_timestamp_lat_lng_unique` ON `location_points` (`timestamp`, `lat`, `lng`);
