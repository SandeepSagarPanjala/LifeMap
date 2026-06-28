#!/usr/bin/env bash
# Detox iOS simulator build with ad-hoc signing so Keychain entitlements apply.
# Do not use CODE_SIGNING_ALLOWED=NO (CI compile-only builds use that in mobile-build.yml).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CONFIGURATION="${1:-Debug}"

source scripts/ruby-env.sh

xcodebuild \
  -workspace ios/LifeMap.xcworkspace \
  -scheme LifeMap \
  -configuration "$CONFIGURATION" \
  -sdk iphonesimulator \
  -derivedDataPath ios/build \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGN_IDENTITY=- \
  CODE_SIGNING_REQUIRED=YES \
  CODE_SIGNING_ALLOWED=YES \
  build
