import {
  MAP_LEFT_STACK_COUNT,
  MAP_RIGHT_STACK_COUNT,
  MAP_STACK_BUTTON_GAP,
  MAP_STACK_BUTTON_SIZE,
} from '@/lib/app-constants';
import {
  mapStackButtonBottom,
  mapStackTotalHeight,
} from '../src/screens/map/map-screen-constants';

describe('map stack layout', () => {
  it('computes stacked button offsets from the base', () => {
    expect(mapStackButtonBottom(20, 0)).toBe(20);
    expect(mapStackButtonBottom(20, 1)).toBe(72);
    expect(mapStackButtonBottom(20, 3)).toBe(176);
  });

  it('keeps left nav shorter than the right capture + You stack', () => {
    expect(MAP_LEFT_STACK_COUNT).toBe(4);
    expect(MAP_RIGHT_STACK_COUNT).toBe(5);
    expect(
      mapStackTotalHeight(
        MAP_LEFT_STACK_COUNT,
        MAP_STACK_BUTTON_SIZE,
        MAP_STACK_BUTTON_GAP,
      ),
    ).toBe(200);
    expect(
      mapStackTotalHeight(
        MAP_RIGHT_STACK_COUNT,
        MAP_STACK_BUTTON_SIZE,
        MAP_STACK_BUTTON_GAP,
      ),
    ).toBe(252);
  });
});
