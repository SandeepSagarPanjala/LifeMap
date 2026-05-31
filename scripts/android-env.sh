#!/usr/bin/env bash
# Source this file before Android CLI work: source scripts/android-env.sh
# Works when sourced from bash or zsh.

if [ -n "${BASH_SOURCE[0]:-}" ]; then
  _SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
elif [ -n "${ZSH_VERSION:-}" ]; then
  _SCRIPT_DIR="$(cd "$(dirname "${(%):-%x}")" && pwd)"
else
  _SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

PROJECT_ROOT="$(cd "$_SCRIPT_DIR/.." && pwd)"
JDK_HOME="$PROJECT_ROOT/.jdk/jdk-17.0.19+10/Contents/Home"

export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
# Always use the project JDK — avoids a bad JAVA_HOME inherited from zsh sourcing
export JAVA_HOME="$JDK_HOME"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

if [ ! -x "$JAVA_HOME/bin/java" ]; then
  echo "ERROR: JDK 17 not found at $JAVA_HOME" >&2
  echo "Download it into .jdk/ — see README.md Android section." >&2
  return 1 2>/dev/null || exit 1
fi

echo "ANDROID_HOME=$ANDROID_HOME"
echo "JAVA_HOME=$JAVA_HOME"
