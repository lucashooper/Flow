import { createContext, useContext } from 'react';

interface FocusModeContextValue {
  isFocusMode: boolean;
  toggleFocusMode: () => void;
}

export const FocusModeContext = createContext<FocusModeContextValue | undefined>(undefined);

export const useFocusMode = (): FocusModeContextValue => {
  const ctx = useContext(FocusModeContext);
  if (!ctx) {
    throw new Error('useFocusMode must be used within a FocusModeContext.Provider');
  }
  return ctx;
};
