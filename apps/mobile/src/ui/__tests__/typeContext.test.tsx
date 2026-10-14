import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react-native';
import { makeType } from '../../theme';
import { TypeProvider, useType } from '../typeContext';

describe('useType', () => {
  it('returns the Instrument Sans tokens by default', async () => {
    const { result } = await renderHook(() => useType());
    expect(result.current).toEqual(makeType(false));
  });

  it('returns the fallback tokens under a failed provider', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => <TypeProvider failed>{children}</TypeProvider>;
    const { result } = await renderHook(() => useType(), { wrapper });
    expect(result.current).toEqual(makeType(true));
    expect(result.current.body).not.toHaveProperty('fontFamily');
    expect(result.current.bodyStrong.fontWeight).toBe('600');
  });
});
