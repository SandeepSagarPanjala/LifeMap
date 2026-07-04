UPDATE `saved_places` SET `radius_meters` = 150 WHERE `radius_meters` != 150;
--> statement-breakpoint
UPDATE `place_lookup_cache` SET `venue_radius_meters` = 100 WHERE `venue_radius_meters` != 100;
