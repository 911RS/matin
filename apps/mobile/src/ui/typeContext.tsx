import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { makeType } from '../theme';
import type { TypeScale } from '../theme';

const TypeContext = createContext<TypeScale>(makeType(false));

export function TypeProvider({ failed, children }: { failed: boolean; children: ReactNode }) {
  const scale = useMemo(() => makeType(failed), [failed]);
  return <TypeContext.Provider value={scale}>{children}</TypeContext.Provider>;
}

export function useType(): TypeScale {
  return useContext(TypeContext);
}
