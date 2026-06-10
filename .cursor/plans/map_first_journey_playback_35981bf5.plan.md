---
name: Map First Journey Playback
overview: Make Map the primary tab and convert it into a full-screen journey viewer with day navigation and animated playback.
todos:
  - id: reorder-tabs
    content: Make Map the first tab in main navigation
    status: completed
  - id: fullscreen-map-layout
    content: Refactor Map screen into full-screen map with bottom controls
    status: completed
  - id: playback-engine
    content: Implement fixed-speed point-by-point journey playback with moving marker/time badge
    status: completed
  - id: day-nav-controls
    content: Implement previous/next day navigation via bottom left/right controls
    status: completed
  - id: verify-tests
    content: Run and fix typecheck/tests for new map playback behavior
    status: completed
isProject: false
---

# Map-First Journey Playback Plan

## Goal
Ship a map-first experience where the map occupies the full screen, supports previous/next day navigation, and replays a day's journey with a moving point, progressive path draw, and time label.

## Decisions Locked
- Keep Map as first tab and always open on **today** (even if there are no points).
- Playback mode is **fixed-speed progressive reveal** (not real timestamp delays).

## Implementation Steps
- Reorder tabs so Map is first in [`/Users/sandeepsagar/Documents/LifeMap/src/navigation/MainTabNavigator.tsx`](/Users/sandeepsagar/Documents/LifeMap/src/navigation/MainTabNavigator.tsx).
- Refactor [`/Users/sandeepsagar/Documents/LifeMap/src/screens/MapScreen.tsx`](/Users/sandeepsagar/Documents/LifeMap/src/screens/MapScreen.tsx) into a full-screen map layout:
  - Remove current card-like spacing/header-heavy layout.
  - Keep map filling available viewport.
  - Add bottom overlay controls for `previous day`, `next day`, and `play`.
  - Keep date label and distance label in compact overlay form.
- Extend map rendering in [`/Users/sandeepsagar/Documents/LifeMap/src/components/map/DayMapView.tsx`](/Users/sandeepsagar/Documents/LifeMap/src/components/map/DayMapView.tsx):
  - Support playback props (`isPlaying`, `playbackIndex`, `onPlaybackTick` pattern).
  - Render progressive polyline segment (`points[0..playbackIndex]`) during playback.
  - Render moving marker at current playback point.
  - Render small time badge for current playback timestamp.
- Add playback state/engine in [`/Users/sandeepsagar/Documents/LifeMap/src/screens/MapScreen.tsx`](/Users/sandeepsagar/Documents/LifeMap/src/screens/MapScreen.tsx):
  - Maintain `isPlaying`, `playbackIndex`, and timer lifecycle.
  - Fixed interval stepping through points (e.g. 50–120ms per step, tuned for smoothness).
  - Stop at end, reset/replay behavior on second tap.
  - Pause/stop playback automatically on day change.
- Add day navigation helpers in [`/Users/sandeepsagar/Documents/LifeMap/src/screens/MapScreen.tsx`](/Users/sandeepsagar/Documents/LifeMap/src/screens/MapScreen.tsx):
  - Left/right moves through available day summaries.
  - On today with no points, still keep today selected and disable play.
- Keep existing data hooks (`useDaySummaries`, `useLocationPointsForDay`) from [`/Users/sandeepsagar/Documents/LifeMap/src/hooks/use-location-days.ts`](/Users/sandeepsagar/Documents/LifeMap/src/hooks/use-location-days.ts); only adjust consuming logic in screen.
- Update tests:
  - Add/update UI tests for map controls and playback button states in [`/Users/sandeepsagar/Documents/LifeMap/__tests__/App.test.tsx`](/Users/sandeepsagar/Documents/LifeMap/__tests__/App.test.tsx) or screen-focused test.
  - Keep map/native mocks stable in [`/Users/sandeepsagar/Documents/LifeMap/jest.setup.js`](/Users/sandeepsagar/Documents/LifeMap/jest.setup.js) if new marker/time badge props need assertions.
- Verify with `pnpm typecheck` and `pnpm test`.

## UX Notes
- Empty today: show full-screen map shell + subtle empty message + disabled play button.
- During playback: disable day arrows to avoid conflicting state.
- End of playback: show final path and switch play icon back to replay-ready state.

## Risk Checks
- Ensure timers are cleaned on unmount/focus change to avoid memory leaks.
- Ensure map re-centering doesn't fight playback marker updates.
- Keep performance acceptable for long days (cap animation FPS/step size if needed).