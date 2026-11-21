import { createContext, useContext } from 'react';

export const ColorModeCtx = createContext({ mode: 'light', toggle: () => {} });
export const useColorMode = () => useContext(ColorModeCtx);
