/** Raw GPS history — append-only when the no-delete trigger is installed. */
export const LOCATION_POINTS_TABLE = 'location_points';

export const LOCATION_POINTS_DEDUPE_UNIQUE_INDEX =
  'location_points_timestamp_lat_lng_unique';

/** Present on some device DBs from earlier append-only work. */
export const LOCATION_POINTS_NO_DELETE_TRIGGER = 'location_points_no_delete';

export const LOCATION_POINTS_APPEND_ONLY_ERROR =
  'location_points is append-only; DELETE is not allowed';

export const CREATE_LOCATION_POINTS_NO_DELETE_TRIGGER_SQL = `CREATE TRIGGER IF NOT EXISTS ${LOCATION_POINTS_NO_DELETE_TRIGGER}
BEFORE DELETE ON ${LOCATION_POINTS_TABLE}
BEGIN
  SELECT RAISE(ABORT, '${LOCATION_POINTS_APPEND_ONLY_ERROR}');
END;`;

export const CREATE_LOCATION_POINTS_DEDUPE_UNIQUE_INDEX_SQL = `CREATE UNIQUE INDEX IF NOT EXISTS ${LOCATION_POINTS_DEDUPE_UNIQUE_INDEX}
ON ${LOCATION_POINTS_TABLE} (timestamp, lat, lng)`;
