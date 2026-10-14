import type { SuggestInput } from './types.ts';
import { parseDay } from './repeat.ts';
import { usableWeather } from './weather.ts';

export function normalizeInput(input: SuggestInput): SuggestInput {
  parseDay(input.date);
  const weather = usableWeather(input.weather);
  return weather === input.weather ? input : { ...input, weather };
}
