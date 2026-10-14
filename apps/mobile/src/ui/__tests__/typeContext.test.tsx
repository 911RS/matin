import { renderHook } from '@testing-library/react-native';
import { makeType } from '../../theme';
import { useType } from '../typeContext';

describe('useType', () => {
  it('returns the system type scale', async () => {
    const { result } = await renderHook(() => useType());
    expect(result.current).toEqual(makeType());
  });
});
