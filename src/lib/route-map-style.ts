/** Life360-style journey path on the map (no dots along the line). */
export const ROUTE_PATH_OPACITY = 0.35;

/** iOS system blue — matches the user location puck. */
export const ROUTE_PATH_FILL = `rgba(0, 122, 255, ${ROUTE_PATH_OPACITY})`;
export const ROUTE_PATH_BORDER = `rgba(255, 255, 255, ${ROUTE_PATH_OPACITY})`;

/** Visit areas on the default map (no labels). */
export const STAY_AREA_OPACITY = 0.28;
export const STAY_AREA_FILL = `rgba(255, 149, 0, ${STAY_AREA_OPACITY})`;
export const STAY_AREA_STROKE = `rgba(255, 149, 0, ${STAY_AREA_OPACITY + 0.12})`;
export const STAY_AREA_STROKE_WIDTH = 2;

/** Selected visit/drive in History — one event at a time. */
export const STAY_AREA_EMPHASIS_OPACITY = 0.45;
export const STAY_AREA_FILL_EMPHASIS = `rgba(255, 149, 0, ${STAY_AREA_EMPHASIS_OPACITY})`;
export const STAY_AREA_STROKE_EMPHASIS = `rgba(255, 149, 0, ${STAY_AREA_EMPHASIS_OPACITY + 0.15})`;
export const ROUTE_PATH_FILL_SOLID = 'rgba(0, 122, 255, 1)';
export const ROUTE_PATH_BORDER_SOLID = 'rgba(255, 255, 255, 1)';
export const ROUTE_PATH_BORDER_WIDTH = 9;
export const ROUTE_PATH_FILL_WIDTH = 4.5;
