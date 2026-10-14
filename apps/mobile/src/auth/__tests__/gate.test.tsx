import type { GateInput } from '../gate';
import { itemsSignal, nextRoute, routeFor } from '../gate';

const signedIn = (over: Partial<GateInput> = {}): GateInput => ({
  session: 'signedIn',
  items: 'some',
  onboardingDone: false,
  ...over,
});

describe('routeFor', () => {
  it('routes a guest like a signed-in user', () => {
    const guest = (over: Partial<GateInput> = {}) => signedIn({ session: 'guest', ...over });
    expect(routeFor(guest({ items: 'empty' }))).toBe('/onboarding');
    expect(routeFor(guest({ items: 'some' }))).toBe('/(tabs)');
    expect(routeFor(guest({ items: 'empty', onboardingDone: true }))).toBe('/(tabs)');
    expect(routeFor(guest({ items: 'unreachable' }))).toBe('/(tabs)');
    expect(routeFor(guest({ items: 'staleEmpty' }))).toBeNull();
    expect(routeFor(guest({ items: 'empty', onboardingDone: undefined }))).toBeNull();
  });

  it('sends a signed-out user to /sign-in', () => {
    expect(routeFor({ session: 'signedOut', items: 'loading', onboardingDone: undefined })).toBe(
      '/sign-in',
    );
  });

  it('sends a signed-in user whose fresh item list is empty and who has no flag to /onboarding', () => {
    expect(routeFor(signedIn({ items: 'empty' }))).toBe('/onboarding');
  });

  it('sends a signed-in user with items to /(tabs)', () => {
    expect(routeFor(signedIn({ items: 'some' }))).toBe('/(tabs)');
    expect(routeFor(signedIn({ items: 'some', onboardingDone: undefined }))).toBe('/(tabs)');
  });

  it('sends a signed-in user who finished onboarding to /(tabs) even with no items', () => {
    expect(routeFor(signedIn({ items: 'empty', onboardingDone: true }))).toBe('/(tabs)');
    expect(routeFor(signedIn({ items: 'loading', onboardingDone: true }))).toBe('/(tabs)');
  });

  it('never routes to /onboarding from a stale empty cache', () => {
    expect(routeFor(signedIn({ items: 'staleEmpty' }))).toBeNull();
  });

  it('opens the tabs when items cannot be fetched', () => {
    expect(routeFor(signedIn({ items: 'unreachable' }))).toBe('/(tabs)');
  });

  it('waits while the session, items or flag are still loading', () => {
    expect(routeFor(signedIn({ session: 'loading', onboardingDone: true }))).toBeNull();
    expect(routeFor(signedIn({ items: 'loading' }))).toBeNull();
    expect(routeFor(signedIn({ items: 'empty', onboardingDone: undefined }))).toBeNull();
  });
});

describe('itemsSignal', () => {
  it('reports items whether fresh or cached', () => {
    expect(itemsSignal([1], false, false)).toBe('some');
    expect(itemsSignal([1], true, false)).toBe('some');
  });

  it('separates a fresh empty list from a cached one', () => {
    expect(itemsSignal([], true, false)).toBe('empty');
    expect(itemsSignal([], false, false)).toBe('staleEmpty');
  });

  it('reports unreachable when there is no fresh answer and the fetch failed or paused', () => {
    expect(itemsSignal([], false, true)).toBe('unreachable');
    expect(itemsSignal(undefined, false, true)).toBe('unreachable');
  });

  it('reports loading when nothing is known yet', () => {
    expect(itemsSignal(undefined, false, false)).toBe('loading');
  });
});

describe('nextRoute', () => {
  it('keeps onboarding open when the first item is added before the flag is set', () => {
    expect(nextRoute('/onboarding', signedIn({ items: 'some', onboardingDone: false }))).toBe('/onboarding');
  });

  it('leaves onboarding once the flag is set', () => {
    expect(nextRoute('/onboarding', signedIn({ items: 'some', onboardingDone: true }))).toBe('/(tabs)');
  });

  it('leaves onboarding on sign-out', () => {
    expect(nextRoute('/onboarding', signedIn({ session: 'signedOut' }))).toBe('/sign-in');
  });

  it('keeps the previous route while a refetch is loading', () => {
    expect(nextRoute('/(tabs)', signedIn({ items: 'staleEmpty' }))).toBe('/(tabs)');
  });

  it('follows routeFor otherwise', () => {
    expect(nextRoute(null, signedIn({ items: 'empty' }))).toBe('/onboarding');
    expect(nextRoute(null, signedIn({ items: 'staleEmpty' }))).toBeNull();
  });
});
