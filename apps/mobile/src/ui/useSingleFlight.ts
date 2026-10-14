import { useRef } from 'react';

export interface SingleFlight {
  run<T>(task: () => Promise<T>): Promise<T | undefined>;
  busy(): boolean;
}

export function createSingleFlight(): SingleFlight {
  let active = false;
  return {
    async run(task) {
      if (active) return undefined;
      active = true;
      try {
        return await task();
      } finally {
        active = false;
      }
    },
    busy: () => active,
  };
}

export function useSingleFlight(): SingleFlight {
  const ref = useRef<SingleFlight | null>(null);
  if (!ref.current) ref.current = createSingleFlight();
  return ref.current;
}
