# Dogfood Observability Checklist

Use this checklist before cutting an App Store build.

## Goal

Dogfood diagnostics are useful for tracking reliability investigations, but they should be disabled in production App Store releases unless explicitly needed.

## Current Switch

Dogfood tracking diagnostics are controlled at runtime via an encrypted app
setting:

- Setting key: `tracking_diagnostics_enabled`
- Implemented in: `src/lib/tracking-diagnostics.ts`
- UI switch: `LocationDataSettings` (Settings → Export location data)

## Pre-Release Steps

1. Confirm diagnostics default is OFF in new installs:
   - `tracking_diagnostics_enabled` should be unset/false.
2. Confirm no diagnostics data is auto-uploaded:
   - Tracking diagnostics should remain local-only unless an explicit export/share action is performed.
3. Confirm export-only flow:
   - User must explicitly export diagnostics JSON via the Settings UI.

## Optional Emergency Procedure

If reliability incident investigation requires diagnostics in release:

1. Enable diagnostics behind an explicit release flag.
2. Ship to limited audience (phased/TestFlight first).
3. Collect only minimum event metadata (no unnecessary payloads).
4. Set a removal deadline and create follow-up task before full rollout.
