import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

type SplashBackgroundProps = {
  width: number;
  height: number;
  isDark: boolean;
};

export function SplashBackground({
  width,
  height,
  isDark,
}: SplashBackgroundProps) {
  const stops = isDark
    ? [
        { offset: '0', color: '#0a120e' },
        { offset: '0.5', color: '#101f18' },
        { offset: '1', color: '#1a3d2e' },
      ]
    : [
        { offset: '0', color: '#f3fbf5' },
        { offset: '0.45', color: '#dff5e8' },
        { offset: '1', color: '#bfe9cf' },
      ];

  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFillObject}
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id="splashGradient" x1="0" y1="0" x2="0.25" y2="1">
          {stops.map(stop => (
            <Stop
              key={stop.offset}
              offset={stop.offset}
              stopColor={stop.color}
            />
          ))}
        </LinearGradient>
      </Defs>
      <Rect
        x="0"
        y="0"
        width={width}
        height={height}
        fill="url(#splashGradient)"
      />
    </Svg>
  );
}
