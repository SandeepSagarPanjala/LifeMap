import {createContext, useContext} from 'react';

const NativeHalfSheetCloseContext = createContext<(() => void) | null>(null);

export function useNativeHalfSheetClose(): () => void {
  const close = useContext(NativeHalfSheetCloseContext);
  if (close == null) {
    throw new Error('useNativeHalfSheetClose must be used within NativeHalfSheetShell');
  }
  return close;
}

export {NativeHalfSheetCloseContext};
