import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { shownTemperature } from '@tenue/engine';
import type { Weather } from '@tenue/engine';
import { conditionKey } from '../today/present';
import type { ConditionKey } from '../today/present';
import { colors, space, tabular } from '../theme';
import type { IconName } from './icons';
import { useType } from './typeContext';

const ICON: Record<ConditionKey, IconName> = {
  clear: 'sunny-outline',
  partlyCloudy: 'partly-sunny-outline',
  cloudy: 'cloud-outline',
  fog: 'cloud-outline',
  rain: 'rainy-outline',
  showers: 'rainy-outline',
  sleet: 'snow-outline',
  snow: 'snow-outline',
  thunder: 'thunderstorm-outline',
};

export function WeatherChip({ weather, tomorrow = false }: { weather: Weather; tomorrow?: boolean }) {
  const { t } = useTranslation();
  const type = useType();
  const shown = shownTemperature(weather);
  const temp = shown === null ? null : t('today.feelsLike', { temp: shown });
  const degrees = shown === null ? null : `${shown}°`;
  const condition = conditionKey(weather);
  const conditionLabel = condition ? t(`weather.${condition}`) : null;
  const label = [t(tomorrow ? 'today.weatherChipTomorrow' : 'today.weatherChip'), temp, shown === null ? t('today.weatherAssumed') : conditionLabel]
    .filter(Boolean)
    .join(', ');

  return (
    <View accessible accessibilityLabel={label} style={styles.chip}>
      {condition && conditionLabel ? (
        <Ionicons name={ICON[condition]} size={18} color={colors.ink} />
      ) : (
        degrees === null && <Ionicons name="help-circle-outline" size={14} color={colors.graphite} />
      )}
      {degrees === null ? (
        <Text style={type.caption}>{t('today.weatherAssumed')}</Text>
      ) : (
        <Text style={[type.title, tabular]}>{degrees}</Text>
      )}
      {condition && conditionLabel && <Text style={type.caption}>{conditionLabel}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: space(4) },
});
