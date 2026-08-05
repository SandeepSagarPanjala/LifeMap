# LifeMap database schema

Encrypted SQLite (`lifemap.db`) via Drizzle. Source of truth: [`src/db/schema.ts`](../src/db/schema.ts).

Timestamps are stored as integer epoch ms unless noted. Booleans are integer `0`/`1`.

---

## Applied in migration `0044_schema_trim`

Dropped unused columns, indexes, and the unused `tracking_events` table:

| Target | Dropped |
| --- | --- |
| `location_points` | index `location_points_timestamp_idx` |
| `location_day_summaries` | `point_count`, `min_timestamp`, `max_timestamp` |
| `materialized_days` | `point_count`, `trip_count` |
| `trips` | `selected_candidate_index` |
| `visit_label_overrides` | `end_at_ms`; index `visit_label_overrides_date_key_idx` |
| `moments` | `share_visibility`, `content_sync_state`, `mood_score`, `place_label` |
| `place_lookup_cache` | `candidates_json`, `selected_candidate_index`; indexes on `anchor_lat` / `anchor_lng` |
| `tracking_events` | entire table |

---

## Tables (18)

### `location_points`

Raw GPS / motion fixes (append-only source of truth).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer PK AI | |
| `timestamp` | timestamp NOT NULL | |
| `lat` | real NOT NULL | |
| `lng` | real NOT NULL | |
| `accuracy` | real | Horizontal accuracy (m) |
| `altitude` | real | |
| `speed` | real | m/s |
| `source` | text NOT NULL default `gps` | |
| `heading` | real | Degrees |
| `heading_accuracy` | real | |
| `speed_accuracy` | real | |
| `altitude_accuracy` | real | |
| `activity_type` | text | SDK motion activity |
| `activity_confidence` | integer | |
| `is_moving` | boolean | |
| `is_mock` | boolean | |
| `uuid` | text | SDK uuid (not used for dedupe) |
| `battery_level` | real | |
| `battery_is_charging` | boolean | |

**Index:** unique `location_points_timestamp_lat_lng_unique` (`timestamp`, `lat`, `lng`).

**Trigger (optional on device):** `location_points_no_delete` — `BEFORE DELETE` aborts (append-only). Dropped temporarily when deletes are allowed.

---

### `location_day_summaries`

Per-calendar-day GPS presence for past-day seal backlog. Row existence is the signal.

| Column | Type | Notes |
| --- | --- | --- |
| `date_key` | text PK | `YYYY-MM-DD` |
| `updated_at` | timestamp NOT NULL | |

---

### `materialized_days`

Seal control plane per calendar day.

| Column | Type | Notes |
| --- | --- | --- |
| `date_key` | text PK | |
| `status` | text NOT NULL | `open` \| `partial` \| `complete` \| `failed` |
| `detection_version` | integer NOT NULL | |
| `geometry_fingerprint` | text | Settings hash for reseal |
| `excluded_cross_midnight_from_ms` | integer | Overnight drive start withheld from past-day seal |
| `sealed_at` | timestamp | |
| `updated_at` | timestamp NOT NULL | |

---

### `trips`

Sealed timeline segments (stay / travel / missing).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer PK AI | |
| `event_key` | text NOT NULL unique | `kind:startMs:endMs` |
| `kind` | text NOT NULL | `stay` \| `travel` \| `missing` |
| `date_key` | text NOT NULL | |
| `start_at` | timestamp NOT NULL | |
| `end_at` | timestamp NOT NULL | |
| `duration_ms` | integer NOT NULL | |
| `distance_km` | real NOT NULL | |
| `centroid_lat` | real NOT NULL | |
| `centroid_lng` | real NOT NULL | |
| `segment_order` | integer NOT NULL default 0 | |
| `place_label` | text | Saved place name, or street address when `place_kind` is cache |
| `place_id` | integer | Polymorphic: saved place or lookup cache id |
| `place_kind` | text | `saved` \| `cache` |
| `poi_id` | integer | `place_pois.id` when cache |
| `moment_refs` | text | JSON `[{ momentId, momentKind }]` |
| `inferred` | integer NOT NULL default 0 | Sparse-GPS inferred stay |
| `detection_version` | integer NOT NULL | |
| `closed_at` | timestamp NOT NULL | Wall clock at materialize |

**Indexes:** `trips_date_key_idx`; `trips_start_at_idx`.  
**Also in migrations (not Drizzle schema):** partial `trips_unlabeled_stays_idx`.

---

### `trip_points`

Sealed polyline vertices for a trip.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer PK AI | |
| `trip_id` | integer NOT NULL FK → `trips.id` ON DELETE CASCADE | |
| `seq` | integer NOT NULL | Path order |
| `lat` | real NOT NULL | |
| `lng` | real NOT NULL | |
| `recorded_at` | timestamp | |
| `location_point_id` | integer | Soft link to GPS (no FK) |
| `source` | text default `gps` | |
| `moment_id` | integer FK → `moments.id` | Pin on route |
| `activity_type` | text | Walk dashes / mode legs |

**Index:** `trip_points_trip_id_seq_idx` (`trip_id`, `seq`).

---

### `visit_label_overrides`

User POI picks for live/open visits before the stay is sealed into trips. Sticky across rebuilds.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer PK AI | |
| `date_key` | text NOT NULL | |
| `start_at_ms` | integer NOT NULL | Visit identity |
| `anchor_lat` | real | Spatial rematch |
| `anchor_lng` | real | |
| `poi_id` | integer NOT NULL | |
| `poi_label` | text | |
| `place_id` | integer | |
| `place_kind` | text | `saved` \| `cache` |
| `updated_at` | timestamp NOT NULL | |

**Index:** unique `visit_label_overrides_date_start_unique` (`date_key`, `start_at_ms`).

---

### `moments`

Polymorphic captures: photo, note, video, voice, activity, mood.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer PK AI | |
| `type` | text NOT NULL | `photo` \| `note` \| `video` \| `voice` \| `activity` \| `mood` |
| `timestamp` | timestamp NOT NULL | |
| `content_path` | text | |
| `thumbnail_path` | text | |
| `voice_attachment_path` | text | |
| `voice_attachment_bytes` | integer | |
| `voice_duration_sec` | integer | |
| `voice_transcript` | text | On-device speech-to-text |
| `photo_attachments_json` | text | |
| `tags_json` | text | JSON string array (max 8 scene tags) |
| `text_body` | text | |
| `caption` | text | |
| `title` | text | |
| `mood_label` | text | |
| `mood_reason` | text | Free-text reason for selected mood |
| `mood_variant` | text | male \| female \| cat \| dog |
| `finished_at` | timestamp | |
| `content_bytes` | integer | |
| `source_bytes` | integer | |
| `content_format` | text | |
| `activity_id` | integer FK → `activities.id` | |
| `activity_emoji` | text | Snapshot at log time |
| `activity_label` | text | Snapshot at log time |
| `activity_values_json` | text | |
| `import_source` | text | e.g. healthkit |

**Indexes:** `moments_timestamp_idx`; `moments_type_timestamp_idx` (`type`, `timestamp`); `moments_activity_id_idx`.

---

### `activities`

User activity definitions + reminder config.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer PK AI | |
| `emoji` | text NOT NULL | |
| `label` | text NOT NULL | |
| `sort_order` | integer NOT NULL default 0 | |
| `created_at` | timestamp NOT NULL | |
| `archived_at` | timestamp | |
| `schema_version` | integer NOT NULL default 1 | |
| `source` | text NOT NULL default `blank` | |
| `template_id` | text | |
| `definition_json` | text NOT NULL default `[]` | Field schema |
| `intent` | text NOT NULL default `track` | track \| more \| less |
| `reminder_enabled` | boolean NOT NULL default false | |
| `reminder_repeat` | text NOT NULL default `never` | |
| `reminder_time_minutes` | integer | 0–1439 |
| `reminder_weekday` | integer | 0=Sun … 6=Sat |
| `reminder_day_of_month` | integer | 1–31 |
| `reminder_anchor_at` | timestamp | |
| `reminder_sound` | text NOT NULL default `ding` | |

---

### `saved_places`

Home / work / favorites.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer PK AI | |
| `kind` | text NOT NULL | `home` \| `work` \| `favorite` |
| `label` | text NOT NULL | |
| `lat` | real NOT NULL | |
| `lng` | real NOT NULL | |
| `radius_meters` | integer NOT NULL default 150 | |
| `address_line` | text | |
| `active` | integer NOT NULL default 1 | Soft delete |
| `created_at` | timestamp NOT NULL | |

**Index:** `saved_places_kind_idx`.

---

### `place_lookup_cache`

Reverse-geocode / venue cache header for a stay anchor.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer PK AI | |
| `anchor_lat` | real NOT NULL | |
| `anchor_lng` | real NOT NULL | |
| `venue_radius_meters` | integer NOT NULL default 100 | |
| `address_line` | text | |
| `lookup_status` | text NOT NULL default `pending` | |
| `fetched_at` | timestamp | |

---

### `place_pois`

POIs under a lookup cache row.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer PK AI | |
| `cache_id` | integer NOT NULL FK → `place_lookup_cache.id` ON DELETE CASCADE | |
| `name` | text NOT NULL | |
| `lat` | real NOT NULL | |
| `lng` | real NOT NULL | |
| `category` | text | MapKit category raw |
| `source` | text NOT NULL default `mapkit` | `mapkit` \| `user` |
| `created_at` | timestamp NOT NULL | |

**Index:** `place_pois_cache_id_idx`.

---

### `health_sleep_samples`

Raw HealthKit sleep analysis samples (asleep stages + awake).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer PK AI | |
| `uuid` | text NOT NULL unique | |
| `start_at` | timestamp NOT NULL | |
| `end_at` | timestamp NOT NULL | |
| `value` | integer NOT NULL | CategoryValueSleepAnalysis |
| `synced_at` | timestamp NOT NULL | |

**Indexes:** unique uuid; `health_sleep_samples_start_end_idx`.

---

### `health_sleep_sessions`

Coalesced sleep night intervals.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer PK AI | |
| `uuid` | text NOT NULL unique | |
| `start_at` | timestamp NOT NULL | |
| `end_at` | timestamp NOT NULL | |
| `source_name` | text | |
| `synced_at` | timestamp NOT NULL | |

**Indexes:** unique uuid; `health_sleep_sessions_start_end_idx`.

---

### `health_day_sleep`

Per wake-day sleep rollup (sessions attributed to calendar day of sleep end).

| Column | Type | Notes |
| --- | --- | --- |
| `date_key` | text PK | Wake day |
| `asleep_ms` | integer NOT NULL | |
| `awake_ms` | integer NOT NULL | |
| `rem_ms` | integer NOT NULL | |
| `core_ms` | integer NOT NULL | |
| `deep_ms` | integer NOT NULL | |
| `unspecified_ms` | integer NOT NULL | |
| `awakenings_over_5_min` | integer NOT NULL default 0 | |
| `sleep_start_at` | timestamp | |
| `sleep_end_at` | timestamp | |
| `score` | integer | |
| `synced_at` | timestamp NOT NULL | |

---

### `health_workouts`

HealthKit workouts (+ optional linked moment).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer PK AI | |
| `uuid` | text NOT NULL unique | |
| `activity_type` | integer NOT NULL | HK activity type |
| `activity_label` | text NOT NULL | |
| `start_at` | timestamp NOT NULL | |
| `end_at` | timestamp NOT NULL | |
| `duration_sec` | integer NOT NULL | |
| `distance_m` | real | |
| `linked_moment_id` | integer FK → `moments.id` | ON DELETE SET NULL in migrations |
| `synced_at` | timestamp NOT NULL | |

**Indexes:** unique uuid; `health_workouts_start_end_idx`.

---

### `health_day_steps`

| Column | Type | Notes |
| --- | --- | --- |
| `date_key` | text PK | |
| `steps` | integer NOT NULL | |
| `synced_at` | timestamp NOT NULL | |

---

### `settings`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer PK AI | |
| `key` | text NOT NULL unique | |
| `value` | text | |

---

### `settings_stats_cache`

| Column | Type | Notes |
| --- | --- | --- |
| `key` | text PK | e.g. storage breakdown |
| `payload_json` | text NOT NULL | |
| `calculated_at` | timestamp NOT NULL | |

---

## Soft / polymorphic FKs (no SQLite FK)

| From | Field | Points to |
| --- | --- | --- |
| `trips` | `place_id` + `place_kind` | `saved_places` or `place_lookup_cache` |
| `trips` | `poi_id` | `place_pois` (soft) |
| `trip_points` | `location_point_id` | `location_points` (soft; may be null for synthetic vertices) |
| `visit_label_overrides` | `place_id` / `poi_id` | same pattern as trips |

---

## Dropped historically

- `materialization_queue` — removed in migration `0011`
- `tracking_events` — removed in migration `0044`
