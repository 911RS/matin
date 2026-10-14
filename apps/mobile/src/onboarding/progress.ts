import type { ItemRow } from '@tenue/backend';

export const TARGETS = { tops: 2, bottoms: 2, shoes: 1 } as const;

export interface OnboardingProgress {
  tops: number;
  bottoms: number;
  shoes: number;
  done: boolean;
}

export function onboardingProgress(items: readonly ItemRow[]): OnboardingProgress {
  let tops = 0;
  let bottoms = 0;
  let shoes = 0;
  for (const { category } of items) {
    if (category === 'top') tops += 1;
    else if (category === 'bottom') bottoms += 1;
    else if (category === 'dress') {
      tops += 1;
      bottoms += 1;
    } else if (category === 'shoes') shoes += 1;
  }
  const done = tops >= TARGETS.tops && bottoms >= TARGETS.bottoms && shoes >= TARGETS.shoes;
  return { tops, bottoms, shoes, done };
}
