import { makeType } from '../theme';
import type { TypeScale } from '../theme';

const SCALE = makeType();

export function useType(): TypeScale {
  return SCALE;
}
