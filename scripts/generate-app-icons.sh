#!/usr/bin/env bash
# Regenerate iOS + Android launcher icons from assets/brand/icon-1024.png
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="${1:-$ROOT/assets/brand/icon-1024.png}"
IOS_DIR="$ROOT/ios/LifeMap/Images.xcassets/AppIcon.appiconset"
ANDROID_RES="$ROOT/android/app/src/main/res"

if [[ ! -f "$SOURCE" ]]; then
  echo "Source not found: $SOURCE" >&2
  exit 1
fi

mkdir -p "$IOS_DIR" \
  "$ANDROID_RES/mipmap-mdpi" "$ANDROID_RES/mipmap-hdpi" \
  "$ANDROID_RES/mipmap-xhdpi" "$ANDROID_RES/mipmap-xxhdpi" "$ANDROID_RES/mipmap-xxxhdpi"

resize() {
  sips -z "$2" "$2" "$SOURCE" --out "$1" >/dev/null
}

resize "$IOS_DIR/Icon-App-20x20@2x.png" 40
resize "$IOS_DIR/Icon-App-20x20@3x.png" 60
resize "$IOS_DIR/Icon-App-29x29@2x.png" 58
resize "$IOS_DIR/Icon-App-29x29@3x.png" 87
resize "$IOS_DIR/Icon-App-40x40@2x.png" 80
resize "$IOS_DIR/Icon-App-40x40@3x.png" 120
resize "$IOS_DIR/Icon-App-60x60@2x.png" 120
resize "$IOS_DIR/Icon-App-60x60@3x.png" 180
cp "$SOURCE" "$IOS_DIR/Icon-App-1024x1024@1x.png"

for size folder in 48:mipmap-mdpi 72:mipmap-hdpi 96:mipmap-xhdpi 144:mipmap-xxhdpi 192:mipmap-xxxhdpi; do
  px="${size%%:*}"
  dir="${size##*:}"
  resize "$ANDROID_RES/$dir/ic_launcher.png" "$px"
  cp "$ANDROID_RES/$dir/ic_launcher.png" "$ANDROID_RES/$dir/ic_launcher_round.png"
done

echo "Icons updated from $SOURCE"
