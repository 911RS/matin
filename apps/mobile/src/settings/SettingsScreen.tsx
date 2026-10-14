import { useState } from 'react';
import { Linking, StyleSheet, Switch, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { onlineManager, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { endGuest } from '../auth/guest';
import { isCloudAccount, useAppSession } from '../auth/SessionContext';
import { clearClientCache } from '../data/cacheScope';
import { locationLabelQueryKey, notificationsQueryKey } from '../data/keys';
import { useRepo } from '../data/RepoProvider';
import { useProfile } from '../data/useProfile';
import type { AppLanguage } from '../i18n';
import { getSupabase } from '../lib/supabase';
import { usePwa } from '../pwa/pwa';
import { colors, space, tabular } from '../theme';
import { Button } from '../ui/Button';
import { ConfirmSheet } from '../ui/ConfirmSheet';
import { Group, Row } from '../ui/Row';
import { Screen } from '../ui/Screen';
import { SectionLabel } from '../ui/SectionLabel';
import { useSingleFlight } from '../ui/useSingleFlight';
import { useType } from '../ui/typeContext';
import { deleteCloudAccount, deleteLocalData, forgetLocalFiles, signOutFlow } from './account';
import { deviceFileCleanup } from './fileCleanup';
import { chooseLanguage, currentLanguage } from './language';
import type { Coords } from './location';
import { applyLocation, applyPushTime } from './edits';
import { LocationSheet } from './LocationSheet';
import { cancelDaily, devicePush, remindersNeedNativeApp } from './notifications';
import { OptionSheet } from './OptionSheet';
import { getLocationLabel, setNotificationsOff } from './prefs';
import { ensurePermission } from './push';
import { saveProfile } from './saveProfile';
import { formatTime } from './time';
import { TimeSheet } from './TimeSheet';
import { usePushPermission } from './usePushPermission';
import { useNotificationsOff } from './useSettingsSync';

type SheetName = 'time' | 'location' | 'language' | null;
type DeleteStep = 0 | 1 | 2;
type ErrorKey = 'settings.signOutFailed' | 'settings.signOutOffline' | 'settings.deleteFailed';

const systemNow = () => new Date();

function coordsLabel(lat: number, lon: number): string {
  return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
}

export function SettingsScreen({ now = systemNow }: { now?: () => Date } = {}) {
  const { t } = useTranslation();
  const type = useType();
  const repo = useRepo();
  const queryClient = useQueryClient();
  const app = useAppSession();
  const { session, mode } = app;
  const userId = session.userId;
  const cloud = isCloudAccount(app);
  const canCreateAccount = mode === 'supabase' && session.status === 'guest';
  const language = currentLanguage();
  const pwa = usePwa();

  const profile = useProfile();
  const off = useNotificationsOff(userId);
  const label = useQuery({
    queryKey: locationLabelQueryKey(userId),
    queryFn: () => (userId ? getLocationLabel(userId) : null),
    enabled: userId !== null,
    networkMode: 'always',
  });
  const [permission, refreshPermission] = usePushPermission();

  const [sheet, setSheet] = useState<SheetName>(null);
  const [deleteStep, setDeleteStep] = useState<DeleteStep>(0);
  const [busy, setBusy] = useState<'signOut' | 'delete' | 'create' | null>(null);
  const [error, setError] = useState<ErrorKey | null>(null);

  const enabled = off.data === false;
  const reminderOn = enabled && permission?.granted === true;
  const flight = useSingleFlight();
  const pushTime = profile.data?.push_time;
  const lat = profile.data?.lat ?? null;
  const lon = profile.data?.lon ?? null;
  const locationValue =
    lat !== null && lon !== null ? (label.data ?? coordsLabel(lat, lon)) : t('settings.notSet');
  const blocked = !remindersNeedNativeApp && enabled && permission?.granted === false && permission.canAskAgain === false;

  const toggle = async (next: boolean) => {
    if (!userId) return;
    if (next) await ensurePermission(devicePush).catch(() => false);
    queryClient.setQueryData(notificationsQueryKey(userId), !next);
    await setNotificationsOff(userId, !next).catch(() => {});
    refreshPermission();
  };

  const pickTime = (value: string) => {
    setSheet(null);
    applyPushTime(queryClient, value);
  };

  const pickLanguage = (next: AppLanguage) => {
    setSheet(null);
    if (next === language) return;
    void chooseLanguage(next, userId);
    void saveProfile(queryClient, { locale: next }).catch(() => {});
  };

  const saveLocation = (coords: Coords, name: string) => {
    setSheet(null);
    applyLocation(queryClient, userId, coords, name, now);
  };

  const run = async (action: 'signOut' | 'delete' | 'create', task: () => Promise<void>, failure?: ErrorKey) => {
    await flight.run(async () => {
      setBusy(action);
      setError(null);
      try {
        await task();
      } catch {
        if (failure) setError(failure);
      } finally {
        setBusy(null);
      }
    });
  };

  const signOut = () => {
    if (!onlineManager.isOnline()) {
      setError('settings.signOutOffline');
      return;
    }
    void run(
      'signOut',
      () =>
        signOutFlow({
          claimPushToken: (token) => repo.claimPushToken(token),
          cancelReminder: cancelDaily,
          clearCache: () => clearClientCache(queryClient),
          signOut: async () => {
            const { error: failed } = await getSupabase().auth.signOut();
            if (failed) throw failed;
          },
          forgetFiles: () => forgetLocalFiles(userId, deviceFileCleanup),
        }),
      'settings.signOutFailed',
    );
  };

  const confirmDelete = () => {
    setDeleteStep(0);
    if (!userId || flight.busy()) return;
    const base = {
      clearMutations: () => queryClient.getMutationCache().clear(),
      deleteAccount: () => repo.deleteAccount(),
      cancelReminder: cancelDaily,
      forgetFiles: () => forgetLocalFiles(userId, deviceFileCleanup),
    };
    void run(
      'delete',
      () =>
        cloud
          ? deleteCloudAccount(userId, base)
          : deleteLocalData(userId, { ...base, endGuest, resetQueries: () => queryClient.resetQueries() }),
      'settings.deleteFailed',
    );
  };

  const version = Constants.expoConfig?.version;

  return (
    <Screen scroll edges={['top', 'left', 'right']} contentContainerStyle={styles.content}>
      <Text style={type.display} accessibilityRole="header">
        {t('settings.title')}
      </Text>

      <View style={styles.section}>
        <SectionLabel>{t('settings.mornings')}</SectionLabel>
        <Group>
          {remindersNeedNativeApp ? (
            <Row label={t('settings.push')} hint={t('settings.pushNeedsApp')} />
          ) : (
            <Row
              label={t('settings.push')}
              hint={t('settings.pushHint')}
              accessory={
                <Switch
                  value={reminderOn}
                  onValueChange={(v) => void toggle(v)}
                  disabled={off.data === undefined}
                  accessibilityLabel={t('settings.push')}
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

      <View style={styles.section}>
        <SectionLabel>{t('settings.app')}</SectionLabel>
        <Group>
          <Row
            label={t('settings.language')}
            value={language === 'fr' ? t('settings.french') : t('settings.english')}
            onPress={() => setSheet('language')}
          />
          {pwa.updateReady && (
            <Row
              label={t('settings.updateReady')}
              hint={t('settings.updateReadyHint')}
              tone="accent"
              onPress={pwa.applyUpdate}
            />
          )}
          {pwa.install === 'ios' && <Row label={t('settings.install')} hint={t('settings.installIos')} />}
          {pwa.install === 'prompt' && (
            <Row
              label={t('settings.install')}
              hint={t('settings.installPrompt')}
              onPress={() => void pwa.promptInstall()}
            />
          )}
        </Group>
      </View>

      <View style={styles.section}>
        <SectionLabel>{t('settings.account')}</SectionLabel>
        <Group>
          {cloud && (
            <Row label={t('settings.signOut')} onPress={signOut} disabled={busy !== null} accessory={null} />
          )}
          {canCreateAccount && (
            <Row
              label={t('settings.createAccount')}
              hint={t('settings.createAccountHint')}
              tone="accent"
              onPress={() => void run('create', endGuest)}
              disabled={busy !== null}
            />
          )}
          <Row
            label={cloud ? t('settings.deleteAccount') : t('settings.deleteData')}
            tone="danger"
            onPress={() => setDeleteStep(1)}
            disabled={busy !== null}
          />
        </Group>
        {error && (
          <Text style={[type.caption, styles.error]} accessibilityRole="alert" accessibilityLiveRegion="polite">
            {t(error)}
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <SectionLabel>{t('settings.about')}</SectionLabel>
        <View style={styles.credits}>
          <Text style={type.caption}>{t('settings.weatherCredit')}</Text>
          <Text style={type.caption}>{t('settings.placeCredit')}</Text>
          {version ? <Text style={[type.caption, tabular]}>{t('settings.version', { version })}</Text> : null}
        </View>
      </View>

      <TimeSheet
        visible={sheet === 'time'}
        value={pushTime ?? '07:30:00'}
        language={language}
        onSelect={pickTime}
        onClose={() => setSheet(null)}
      />
      <LocationSheet visible={sheet === 'location'} onSaved={saveLocation} onClose={() => setSheet(null)} />
      <OptionSheet<AppLanguage>
        visible={sheet === 'language'}
        title={t('settings.language')}
        closeLabel={t('common.close')}
        options={[
          { value: 'en', label: t('settings.english') },
          { value: 'fr', label: t('settings.french') },
        ]}
        selected={language}
        onSelect={pickLanguage}
        onClose={() => setSheet(null)}
      />
      <ConfirmSheet
        visible={deleteStep === 1}
        title={cloud ? t('settings.deleteTitle') : t('settings.deleteDataTitle')}
        body={cloud ? t('settings.deleteBody') : t('settings.deleteDataBody')}
        confirmLabel={t('settings.deleteContinue')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => setDeleteStep(2)}
        onCancel={() => setDeleteStep(0)}
      />
      <ConfirmSheet
        visible={deleteStep === 2}
        title={t('settings.deleteConfirmTitle')}
        body={t('settings.deleteConfirmBody')}
        confirmLabel={t('settings.deleteConfirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteStep(0)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space(12), paddingBottom: space(32) },
  section: { marginTop: space(24), gap: space(8) },
  note: { gap: space(4), alignItems: 'flex-start' },
  inlineButton: { paddingHorizontal: 0 },
  error: { color: colors.danger },
  credits: { gap: space(4) },
});
