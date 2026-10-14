export type SessionStatus = 'loading' | 'signedOut' | 'signedIn' | 'guest';
export type GateRoute = '/sign-in' | '/onboarding' | '/(tabs)';
export type ItemsSignal = 'loading' | 'staleEmpty' | 'empty' | 'some' | 'unreachable';

export interface GateInput {
  session: SessionStatus;
  items: ItemsSignal;
  onboardingDone: boolean | undefined;
}

export function itemsSignal(
  data: readonly unknown[] | undefined,
  fresh: boolean,
  unreachable: boolean,
): ItemsSignal {
  if (data && data.length > 0) return 'some';
  if (data && fresh) return 'empty';
  if (unreachable) return 'unreachable';
  return data ? 'staleEmpty' : 'loading';
}

export function routeFor({ session, items, onboardingDone }: GateInput): GateRoute | null {
  if (session === 'loading') return null;
  if (session === 'signedOut') return '/sign-in';
  if (onboardingDone === true || items === 'some' || items === 'unreachable') return '/(tabs)';
  if (items === 'empty' && onboardingDone === false) return '/onboarding';
  return null;
}

export function nextRoute(prev: GateRoute | null, input: GateInput): GateRoute | null {
  const route = routeFor(input);
  if (prev === '/onboarding' && route === '/(tabs)' && input.onboardingDone !== true) return prev;
  if (route === null && prev !== null) return prev;
  return route;
}
