import { createContext, useContext } from 'react';

export interface FocusModeContextValue {
  /** Dims sidebar and inactive tabs while editing */
  isDimMode: boolean;
  toggleDimMode: () => void;
  /** Hides all chrome for presentation-style fullscreen */
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  enterFullscreen: () => void;
  exitFullscreen: () => void;
}

export const FocusModeContext = createContext<FocusModeContextValue | undefined>(undefined);

export const useFocusMode = (): FocusModeContextValue => {
  const ctx = useContext(FocusModeContext);
  if (!ctx) {
    throw new Error('useFocusMode must be used within a FocusModeContext.Provider');
  }
  return ctx;
};
