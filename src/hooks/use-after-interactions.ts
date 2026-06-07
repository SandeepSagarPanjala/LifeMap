import {useEffect, useState} from 'react';
import {InteractionManager} from 'react-native';

/** True after open animations / taps finish — safe to run heavier UI work. */
export function useAfterInteractions(active: boolean): boolean {
  const [ready, setReady] = useState(!active);

  useEffect(() => {
    if (!active) {
      setReady(false);
      return;
    }

    setReady(false);
    const task = InteractionManager.runAfterInteractions(() => {
      setReady(true);
    });

    return () => task.cancel();
  }, [active]);

  return ready;
}
