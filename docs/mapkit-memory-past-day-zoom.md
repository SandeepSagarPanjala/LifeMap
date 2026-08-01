# MapKit memory — past-day zoom & return to Today

**Status:** Shipped (remount on return to Today).  
**Last updated:** 2026-08-01

When you zoom hard into a past day, process RAM often climbs (e.g. ~800 MB → ~1.2 GB+). Going back to **Today** used to leave RAM elevated. Apple MapKit does not expose a tile `clearCache()` API; tiles stay in the process until the native map is torn down or the OS reclaims under pressure.

## What we ship

**Remount `MapView` when leaving a past day for Today.**

- Detect `viewingToday` rising after a past-day browse.
- Bump a React `key` on `MapView` so the native map is destroyed and recreated.
- That releases MapKit’s in-process tile footprint for the zoomed area.

Code: `src/screens/map/MapScreenMap.tsx` (`mapInstanceKey` + effect on `viewingToday`).

Expect a brief map flash / recenter when tapping **X** (or otherwise returning to Today). That tradeoff was preferred over a weaker tile flush.

## What we tried and rejected

| Approach | Result |
| --- | --- |
| **`mapType` bounce** (`standard` → `hybrid` → `standard`) | Weaker RAM drop; not worth keeping. Removed. |
| **Harder direction-arrow caps when deep-zoomed** | Saves some RAM but thins arrows; **not shipped** without an explicit product OK. |
| **Nudge travel activity pins off visit badges** | Makes the map lie about where an activity happened. **Never do this.** Coordinates stay at true GPS / route anchors. |

## If map RAM is bad again

1. Confirm whether the climb is **zoom/pan on a past day** vs something else (History panel, many polylines/arrows, moment markers).
2. Confirm remount still runs: past day → Today should recreate `MapView` (`key` change in `MapScreenMap`).
3. Remount only helps when **returning to Today**. Staying on a past day while zooming will still grow MapKit tiles — expected.
4. Our overlays (day-story routes, direction arrows up to `ROUTE_DIRECTION_ARROWS_PERF_MAX` per leg, markers) also cost RAM; profile before thinning UX.
5. There is still **no** official MapKit purge. Options remain: remount (current), brief `mapType` flush (weaker), or reduce overlays (product call).

## Related map honesty (same dogfood)

Travel moments (e.g. activity on a **drive** next to a stay) must stay on real coordinates. Visit **numbers** keep higher z-index than travel chips when they overlap. Stay chips only hide pins that are **already** on that stay’s moment set (by id), not “near the stop.”

## Provider note

iOS uses Apple Maps (`PROVIDER_DEFAULT`). Android uses Google Maps. This remount targets MapKit tile retention on iOS; re-check Android if similar symptoms appear.
