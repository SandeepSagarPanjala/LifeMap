import {
  MAP_LEFT_STACK_COUNT,
  MAP_RIGHT_STACK_COUNT,
  MAP_STACK_BUTTON_GAP,
  MAP_STACK_BUTTON_SIZE,
  mapStackButtonBottom,
  mapStackTotalHeight,
} from '../src/screens/map/map-screen-constants';

describe('map stack layout', () => {
  it('computes stacked button offsets from the base', () => {
    expect(mapStackButtonBottom(20, 0)).toBe(20);
    expect(mapStackButtonBottom(20, 1)).toBe(72);
    expect(mapStackButtonBottom(20, 3)).toBe(176);
  });

  it('uses matching layout for left nav and right capture stacks', () => {
    expect(MAP_LEFT_STACK_COUNT).toBe(3);
    expect(MAP_RIGHT_STACK_COUNT).toBe(4);
    expect(
      mapStackTotalHeight(MAP_LEFT_STACK_COUNT, MAP_STACK_BUTTON_SIZE, MAP_STACK_BUTTON_GAP),
    ).toBe(148);
    expect(
      mapStackTotalHeight(MAP_RIGHT_STACK_COUNT, MAP_STACK_BUTTON_SIZE, MAP_STACK_BUTTON_GAP),
    ).toBe(200);
  });
});
