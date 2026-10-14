export type Category = 'top' | 'bottom' | 'dress' | 'outerwear' | 'shoes';
export type ColorFamily = 'black' | 'white' | 'grey' | 'navy' | 'blue' | 'beige' | 'brown' | 'green' | 'red' | 'pink' | 'yellow' | 'purple' | 'denim' | 'multi';
export type Formality = 'casual' | 'smart' | 'formal';
export type Warmth = 1 | 2 | 3;
export type Locale = 'en' | 'fr';

export interface Item {
  id: string;
  category: Category;
  colorFamily: ColorFamily;
  warmth: Warmth;
  formality: Formality;
  archivedAt: string | null;
  unavailableUntil?: string | null;
}

export interface WornOutfit {
  date: string;
  itemIds: string[];
}

export interface Weather {
  feelsLikeC: number;
  rain: boolean;
  assumed?: boolean;
  condition?: string;
}

export interface SuggestInput {
  items: Item[];
  recentOutfits: WornOutfit[];
  weather: Weather;
  date: string;
  seed: number;
  locale: Locale;
  occasion?: Formality;
}

export type SuggestResult = { itemIds: string[]; reason: string } | { missing: Category[] };
