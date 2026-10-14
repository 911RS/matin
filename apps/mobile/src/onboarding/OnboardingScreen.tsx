import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAppSession } from '../auth/SessionContext';
import { locationLabelQueryKey, notificationsQueryKey, onboardingQueryKey, OUTFIT_ROOT } from '../data/keys';
import { useRepo } from '../data/RepoProvider';
import { useProfile } from '../data/useProfile';
import { currentLanguage } from '../settings/language';
import { applyLocation, applyPushTime } from '../settings/edits';
import type { Coords } from '../settings/location';
import { LocationSheet } from '../settings/LocationSheet';
import { devicePush, remindersNeedNativeApp } from '../settings/notifications';
import { getLocationLabel, setNotificationsOff } from '../settings/prefs';
import { ensurePermission } from '../settings/push';
import { formatTime } from '../settings/time';
import { TimeSheet } from '../settings/TimeSheet';
import { usePushPermission } from '../settings/usePushPermission';
import { useNotificationsOff } from '../settings/useSettingsSync';
import { useItems } from '../closet/useItems';
import { setOnboardingDone } from './flag';
import { OnboardingStage } from './OnboardingStage';
import { onboardingProgress, TARGETS } from './progress';
import { SegmentBar } from './SegmentBar';
import { colors, space, tabular } from '../theme';
import { Button, Group, Screen } from '../ui';
import { onHardwareBack } from '../ui/hardwareBack';
import { Row } from '../ui/Row';
import { useType } from '../ui/typeContext';

type Step = 1 | 2;

const systemNow = () => new Date();

function CounterRow({ label, count, target }: { label: string; count: number; target: number }) {
  const { t } = useTranslation();
  const type = useType();
  const shown = Math.min(count, target);
  return (
    <View
      style={styles.counter}
      accessible
      accessibilityLabel={`${label}, ${t('onboarding.counter', { count: shown, target })}`}
    >
      <View style={styles.counterHead}>
        <Text style={type.bodyStrong}>{label}</Text>
        <Text style={[type.body, tabular, styles.graphite]}>{t('onboarding.counter', { count: shown, target })}</Text>
      </View>
      <SegmentBar filled={shown} total={target} />
    </View>
  );
}

export function OnboardingScreen({ now = systemNow }: { now?: () => Date } = {}) {
  const { t } = useTranslation();
  const type = useType();
  const repo = useRepo();
  const queryClient = useQueryClient();
  const userId = useAppSession().session.userId;
  const [step, setStep] = useState<Step>(1);
  const [sheet, setSheet] = useState<'time' | 'location' | null>(null);
  const [leaving, setLeaving] = useState(false);

  const items = useItems();
  const progress = onboardingProgress(items.data ?? []);
  const profile = useProfile(step === 2);
  const off = useNotificationsOff(userId, step === 2);
  const label = useQuery({
    queryKey: locationLabelQueryKey(userId),
    queryFn: () => (userId ? getLocationLabel(userId) : null),
    enabled: userId !== null && step === 2,
    networkMode: 'always',
  });
  const [permission, refreshPermission] = usePushPermission();

  useEffect(() => {
    if (step !== 2) return;
    return onHardwareBack(() => {
      setStep(1);
      return true;
    });
  }, [step]);

  const language = currentLanguage();
  const pushTime = profile.data?.push_time;
  const lat = profile.data?.lat ?? null;
  const lon = profile.data?.lon ?? null;
  const locationValue =
    lat !== null && lon !== null ? (label.data ?? `${lat.toFixed(2)}, ${lon.toFixed(2)}`) : t('settings.notSet');
  const reminderOn = off.data === false && permission?.granted === true;
  const blocked = !remindersNeedNativeApp && permission?.granted === false && permission.canAskAgain === false;

  const toggleReminder = async (next: boolean) => {
    if (!userId) return;
    const ok = next ? await ensurePermission(devicePush).catch(() => false) : false;
    queryClient.setQueryData(notificationsQueryKey(userId), !ok);
    await setNotificationsOff(userId, !ok).catch(() => {});
    refreshPermission();
  };

  const leave = async () => {
    if (leaving) return;
    setLeaving(true);
    let finished = false;
    try {
      const id = userId ?? (await repo.userId());
      if (!id) return;
      await setOnboardingDone(id);
      void queryClient.invalidateQueries({ queryKey: OUTFIT_ROOT });
      queryClient.setQueryData(onboardingQueryKey(id), true);
      finished = true;
    } catch {
      return;
    } finally {
      if (!finished) setLeaving(false);
    }
  };

  const stage = <OnboardingStage items={items.data ?? []} compact={step === 2} />;

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      {step === 1 ? (
        <>
          <View style={styles.head}>
            <Text style={type.display} accessibilityRole="header">
              {t('onboarding.title')}
            </Text>
            <Text style={[type.body, styles.graphite]}>{t('onboarding.subtitle')}</Text>
          </View>
          {stage}
          <View style={styles.block} accessibilityLabel={t('onboarding.countersLabel')}>
            <CounterRow label={t('onboarding.tops')} count={progress.tops} target={TARGETS.tops} />
            <CounterRow label={t('onboarding.bottoms')} count={progress.bottoms} target={TARGETS.bottoms} />
            <CounterRow label={t('onboarding.shoes')} count={progress.shoes} target={TARGETS.shoes} />
          </View>
          <View style={styles.actions}>
            {progress.done ? (
              <Button label={t('onboarding.continue')} onPress={() => setStep(2)} />
            ) : (
              <Button label={t('onboarding.add')} onPress={() => router.push('/add-item')} />
            )}
            <Button label={t('onboarding.skip')} variant="text" onPress={() => void leave()} disabled={leaving} />
          </View>
        </>
      ) : (
        <>
          <View style={styles.head}>
            <Text style={type.display} accessibilityRole="header">
              {t('onboarding.step2Title')}
            </Text>
            <Text style={[type.body, styles.graphite]}>{t('onboarding.step2Body')}</Text>
          </View>
          {stage}
          <View style={styles.rows}>
            <Group>
              {remindersNeedNativeApp ? (
                <Row label={t('onboarding.notifications')} hint={t('settings.pushNeedsApp')} />
              ) : (
                <Row
                  label={t('onboarding.notifications')}
                  hint={t('onboarding.notificationsHint')}
                  accessory={
                    <Switch
                      value={reminderOn}
                      onValueChange={(v) => void toggleReminder(v)}
                      disabled={off.data === undefined}
                      accessibilityLabel={t('onboarding.notifications')}
                      trackColor={{ false: colors.trackOff, true: colors.accent }}
                      thumbColor={colors.surface}
                      ios_backgroundColor={colors.line}
                    />
                  }
                />
              )}
              {!remindersNeedNativeApp && (
                <Row
                  label={t('settings.pushTime')}
                  value={pushTime ? formatTime(pushTime, language) : undefined}
                  onPress={() => setSheet('time')}
                  disabled={!pushTime}
                />
              )}
              <Row label={t('settings.location')} value={locationValue} onPress={() => setSheet('location')} />
            </Group>
            {blocked && (
              <View style={styles.note} accessibilityLiveRegion="polite">
                <Text style={type.caption}>{t('settings.pushDenied')}</Text>
                <Button
                  label={t('common.openSettings')}
                  variant="text"
                  onPress={() => void Linking.openSettings()}
                  style={styles.inlineButton}
                />
              </View>
            )}
          </View>
          <View style={styles.spacer} />
          <View style={styles.actions}>
            <Button label={t('onboarding.finish')} onPress={() => void leave()} loading={leaving} />
            <View style={styles.secondary}>
              <Button label={t('common.back')} variant="text" onPress={() => setStep(1)} disabled={leaving} />
              <Button label={t('onboarding.skip')} variant="text" onPress={() => void leave()} disabled={leaving} />
            </View>
          </View>
          <TimeSheet
            visible={sheet === 'time'}
            value={pushTime ?? '07:30:00'}
            language={language}
            onSelect={(value) => {
              setSheet(null);
              applyPushTime(queryClient, value);
            }}
            onClose={() => setSheet(null)}
          />
          <LocationSheet
            visible={sheet === 'location'}
            onSaved={(coords: Coords, name) => {
              setSheet(null);
              applyLocation(queryClient, userId, coords, name, now);
            }}
            onClose={() => setSheet(null)}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space(32), paddingBottom: space(20), gap: space(24) },
  head: { gap: space(8) },
  graphite: { color: colors.graphite },
  block: { gap: space(24) },
  counter: { gap: space(8) },
  counterHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  rows: { gap: space(8) },
  note: { gap: space(4), alignItems: 'flex-start' },
  inlineButton: { paddingHorizontal: 0 },
  spacer: { flex: 1 },
  actions: { gap: space(8) },
  secondary: { flexDirection: 'row', justifyContent: 'space-between' },
});
