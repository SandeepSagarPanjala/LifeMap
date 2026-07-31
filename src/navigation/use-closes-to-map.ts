import { useNavigationState } from '@react-navigation/native';

/**
 * True when the previous stack route is Map (or there is no previous route),
 * so a dismiss control should read as “close to map” (X) rather than “back”.
 */
export function useClosesToMap(): boolean {
  return useNavigationState(state => {
    if (state == null) {
      return true;
    }
    const index = state.index ?? 0;
    if (index <= 0) {
      return true;
    }
    return state.routes[index - 1]?.name === 'Map';
  });
}
