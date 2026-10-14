import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, radius, space } from '../theme';
import { useType } from '../ui/typeContext';
import type { MigrationStatus } from './useGuestMigration';

const FAILED_VISIBLE_MS = 6000;

export function MigrationBanner({ status }: { status: MigrationStatus }) {
  const { t } = useTranslation();
  const type = useType();
  const insets = useSafeAreaInsets();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(false);
    if (status !== 'failed') return;
    const id = setTimeout(() => setHidden(true), FAILED_VISIBLE_MS);
    return () => clearTimeout(id);
  }, [status]);

  if (hidden || (status !== 'running' && status !== 'failed')) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + space(8) }]}>
      <View style={styles.pill} accessibilityLiveRegion="polite" accessibilityRole="alert">
        {status === 'running' && <ActivityIndicator size="small" color={colors.ink} />}
        <Text style={[type.label, styles.text]}>
          {status === 'running' ? t('settings.migrating') : t('settings.migrateFailed')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space(20), right: space(20), alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(8),
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.tile,
    paddingHorizontal: space(16),
    paddingVertical: space(12),
  },
  text: { flexShrink: 1 },
});
