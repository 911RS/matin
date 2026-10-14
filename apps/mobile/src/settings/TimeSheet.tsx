import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import type { AppLanguage } from '../i18n';
import { colors, space, tabular } from '../theme';
import { Sheet } from '../ui/Sheet';
import { useType } from '../ui/typeContext';
import { formatTime, nearestOption, timeOptions } from './time';

const ROW = 56;
const SEPARATOR = 1;
const STRIDE = ROW + SEPARATOR;

type Props = {
  visible: boolean;
  value: string;
  language: AppLanguage;
  onSelect: (value: string) => void;
  onClose: () => void;
};

export function TimeSheet({ visible, value, language, onSelect, onClose }: Props) {
  const { t } = useTranslation();
  const type = useType();
  const insets = useSafeAreaInsets();
  const options = useMemo(timeOptions, []);
  const selected = nearestOption(value);
  const index = Math.max(0, options.indexOf(selected));

  return (
    <Sheet visible={visible} title={t('settings.pushTime')} closeLabel={t('common.close')} onClose={onClose} padded={false}>
      <FlatList
        data={options}
        keyExtractor={(o) => o}
        style={styles.list}
        contentContainerStyle={{ paddingBottom: insets.bottom + space(16) }}
        initialScrollIndex={Math.max(0, index - 2)}
        getItemLayout={(_d, i) => ({ length: STRIDE, offset: STRIDE * i, index: i })}
        ItemSeparatorComponent={Separator}
        accessibilityLabel={t('settings.timePickerLabel')}
        renderItem={({ item }) => {
          const active = item === selected;
          const label = formatTime(item, language);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(item)}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            >
              <Text style={[active ? type.bodyStrong : type.body, tabular, styles.text]}>{label}</Text>
              {active && <Ionicons name="checkmark" size={22} color={colors.ink} />}
            </Pressable>
          );
        }}
      />
    </Sheet>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  list: { maxHeight: STRIDE * 7.5 },
  option: { height: ROW, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space(20) },
  pressed: { backgroundColor: colors.tile },
  text: { flex: 1 },
  separator: { height: SEPARATOR, marginHorizontal: space(20), backgroundColor: colors.line },
});
