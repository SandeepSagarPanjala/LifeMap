CREATE UNIQUE INDEX IF NOT EXISTS `location_points_timestamp_lat_lng_unique` ON `location_points` (`timestamp`, `lat`, `lng`);
