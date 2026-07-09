import Svg, { Rect } from 'react-native-svg';

type CheckeredFlagIconProps = {
  size?: number;
  light?: string;
  dark?: string;
};

const GRID = 4;

export function CheckeredFlagIcon({
  size = 14,
  light = '#FFFFFF',
  dark = 'transparent',
}: CheckeredFlagIconProps) {
  const cell = size / GRID;
  const cells = [];

  for (let row = 0; row < GRID; row += 1) {
    for (let col = 0; col < GRID; col += 1) {
      const isLight = (row + col) % 2 === 0;
      cells.push(
        <Rect
          key={`${row}-${col}`}
          x={col * cell}
          y={row * cell}
          width={cell}
          height={cell}
          fill={isLight ? light : dark}
        />,
      );
    }
  }

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {cells}
    </Svg>
  );
}
