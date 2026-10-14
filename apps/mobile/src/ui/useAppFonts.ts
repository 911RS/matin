import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { InstrumentSans_400Regular } from '@expo-google-fonts/instrument-sans/400Regular';
import { InstrumentSans_500Medium } from '@expo-google-fonts/instrument-sans/500Medium';
import { InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans/600SemiBold';
import { InstrumentSans_700Bold } from '@expo-google-fonts/instrument-sans/700Bold';
import { fonts } from '../theme';

export const FONT_TIMEOUT_MS = 3000;

const FONT_SOURCES = {
  [fonts.regular]: InstrumentSans_400Regular,
  [fonts.medium]: InstrumentSans_500Medium,
  [fonts.semibold]: InstrumentSans_600SemiBold,
  [fonts.bold]: InstrumentSans_700Bold,
};

type FontState = { ready: boolean; failed: boolean };

export function useAppFonts(): FontState {
  const [loaded, error] = useFonts(FONT_SOURCES);
  const [state, setState] = useState<FontState>({ ready: false, failed: false });

  useEffect(() => {
    if (state.ready) return;
    if (loaded) {
      setState({ ready: true, failed: false });
      return;
    }
    if (error) {
      setState({ ready: true, failed: true });
      return;
    }
    const id = setTimeout(() => setState({ ready: true, failed: true }), FONT_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [loaded, error, state.ready]);

  return state;
}
