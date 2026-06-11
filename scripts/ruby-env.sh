#!/usr/bin/env bash
# Source before bundle / fastlane / pod work: source scripts/ruby-env.sh
# pnpm scripts do not load ~/.zshrc, so they need this explicitly.

if [ -n "${BASH_SOURCE[0]:-}" ]; then
  _SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
elif [ -n "${ZSH_VERSION:-}" ]; then
  _SCRIPT_DIR="$(cd "$(dirname "${(%):-%x}")" && pwd)"
else
  _SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

RUBY_PREFIX="${RUBY_PREFIX:-/opt/homebrew/opt/ruby@3.2}"
GEM_BIN="${GEM_BIN:-/opt/homebrew/lib/ruby/gems/3.2.0/bin}"

export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"
export PATH="$RUBY_PREFIX/bin:$GEM_BIN:$PATH"

# After pod install, xcodebuild -showBuildSettings can exceed Fastlane's 3s default.
export FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT="${FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT:-120}"
export FASTLANE_XCODEBUILD_SETTINGS_RETRIES="${FASTLANE_XCODEBUILD_SETTINGS_RETRIES:-4}"

if ! command -v ruby >/dev/null 2>&1; then
  echo "ERROR: ruby not found. Install with: brew install ruby@3.2" >&2
  return 1 2>/dev/null || exit 1
fi

if ! command -v bundle >/dev/null 2>&1; then
  echo "ERROR: bundler not found for $(ruby --version). Run: gem install bundler && bundle install" >&2
  return 1 2>/dev/null || exit 1
fi
