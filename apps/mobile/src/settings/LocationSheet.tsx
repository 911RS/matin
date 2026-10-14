import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space } from '../theme';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Sheet } from '../ui/Sheet';
import { useSingleFlight } from '../ui/useSingleFlight';
import { useType } from '../ui/typeContext';
import { cityDeps, gpsDeps, placeName } from './deviceLocation';
import { resolveLocation } from './location';
import type { Coords, LocationDeps } from './location';

type ErrorKey = 'settings.cityNone' | 'settings.locationFailed' | 'common.error';

type Props = {
  visible: boolean;
  onSaved: (coords: Coords, label: string) => void;
  onClose: () => void;
  deps?: { gps: LocationDeps; city: LocationDeps; placeName: (c: Coords) => Promise<string | null> };
};

const DEVICE = { gps: gpsDeps, city: cityDeps, placeName };

export const SEARCH_COOLDOWN_MS = 1000;

export function LocationSheet({ visible, onSaved, onClose, deps = DEVICE }: Props) {
  const { t } = useTranslation();
  const type = useType();
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState<'gps' | 'city' | null>(null);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [cooling, setCooling] = useState(false);
  const cooldown = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flight = useSingleFlight();

  useEffect(
    () => () => {
      if (cooldown.current) clearTimeout(cooldown.current);
    },
    [],
  );

  const coolDown = () => {
    if (cooldown.current) clearTimeout(cooldown.current);
    setCooling(true);
    cooldown.current = setTimeout(() => {
      cooldown.current = null;
      setCooling(false);
    }, SEARCH_COOLDOWN_MS);
  };

  useEffect(() => {
    if (visible) return;
    setCity('');
    setBusy(null);
    setDenied(false);
    setError(null);
  }, [visible]);

  const locate = () =>
    flight.run(async () => {
      setBusy('gps');
      setError(null);
      try {
        const coords = await resolveLocation(deps.gps);
        if (!coords) {
          setDenied(true);
          return;
        }
        onSaved(coords, (await deps.placeName(coords)) ?? t('settings.currentLocation'));
      } catch {
        setError('settings.locationFailed');
      } finally {
        setBusy(null);
      }
    });

  const search = () =>
    flight.run(async () => {
      const name = city.trim();
      if (!name || cooldown.current) return;
      setBusy('city');
      setError(null);
      try {
        const coords = await resolveLocation(deps.city, name);
        if (!coords) {
          setError('settings.cityNone');
          return;
        }
        onSaved(coords, name);
      } catch {
        setError('common.error');
      } finally {
        setBusy(null);
        coolDown();
      }
    });

  return (
    <Sheet visible={visible} title={t('settings.location')} closeLabel={t('common.close')} onClose={onClose}>
      <View style={styles.body}>
        <Text style={[type.body, styles.muted]}>{t('settings.locationHint')}</Text>
        <Button
          label={t('settings.useMyLocation')}
          icon="locate-outline"
          variant="secondary"
          onPress={() => void locate()}
          loading={busy === 'gps'}
          blocked={busy === 'city'}
        />
        {denied && (
          <View style={styles.denied} accessibilityLiveRegion="polite">
            <Text style={[type.caption, styles.muted]}>{t('settings.locationDenied')}</Text>
            <Button
              label={t('common.openSettings')}
              variant="text"
              onPress={() => void Linking.openSettings()}
              style={styles.inlineButton}
            />
          </View>
        )}
        <View style={styles.or}>
          <View style={styles.rule} />
          <Text style={type.caption}>{t('settings.or')}</Text>
          <View style={styles.rule} />
        </View>
        <Field
          label={t('settings.cityLabel')}
          nativeID="city-label"
          value={city}
          onChangeText={setCity}
          placeholder={t('settings.cityPlaceholder')}
          autoCorrect={false}
          autoComplete="off"
          returnKeyType="search"
          onSubmitEditing={() => void search()}
          editable={busy === null}
        />
        {error && (
          <Text style={[type.caption, styles.error]} accessibilityRole="alert" accessibilityLiveRegion="polite">
            {t(error)}
          </Text>
        )}
        <Button
          label={t('settings.search')}
          onPress={() => void search()}
          loading={busy === 'city'}
          blocked={busy === 'gps' || cooling}
          disabled={!city.trim()}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space(16) },
  muted: { color: colors.graphite },
  denied: { gap: space(4), alignItems: 'flex-start' },
  inlineButton: { paddingHorizontal: 0 },
  or: { flexDirection: 'row', alignItems: 'center', gap: space(12) },
  rule: { flex: 1, height: 1, backgroundColor: colors.line },
  error: { color: colors.danger },
});
