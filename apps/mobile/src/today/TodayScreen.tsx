import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FALLBACK_WEATHER } from '@tenue/engine';
import type { Category } from '@tenue/engine';
import { colors, radius, size, space } from '../theme';
import { Button, Chip, IconButton, Screen, Stage, stageTint } from '../ui';
import { OutfitStack, SlotStack } from '../ui/OutfitStack';
import { useType } from '../ui/typeContext';
import { WeatherChip } from '../ui/WeatherChip';
import { washing } from '../closet/availability';
import { useItems } from '../closet/useItems';
import { dayHeader, missingSentence, outfitReason, splitReason } from './present';
import { OCCASIONS } from './occasion';
import { useToday } from './useToday';
import { useTomorrow } from './useTomorrow';

const systemNow = () => new Date();
const STAGE_SHARE = 0.52;
const OUTFIT_SLOTS: Category[] = ['top', 'bottom', 'shoes'];

function skeletonFor(missing: Category[]): Category[] {
  return [...OUTFIT_SLOTS, ...missing.filter((c) => !OUTFIT_SLOTS.includes(c))];
}

function noop() {}

function openAdd() {
  router.push('/add-item');
}

export function TodayScreen() {
  const { t, i18n } = useTranslation();
  const type = useType();
  const { height } = useWindowDimensions();
  const today = useToday();
  const { data: items = [] } = useItems();
  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const previewing = day === 'tomorrow';
  const tomorrow = useTomorrow(today.date, previewing, systemNow, fetch);
  const state = previewing ? tomorrow.state : today.state;
  const header = dayHeader(state?.date ?? (previewing ? tomorrow.date : today.date), i18n.language);

  const outfit = state?.kind === 'outfit' ? state : null;
  const weather = outfit?.row.weather ?? FALLBACK_WEATHER;
  const tint = stageTint(outfit?.items.map((i) => i.color_family) ?? [], outfit ? weather : FALLBACK_WEATHER);
  const worn = outfit?.row.status === 'worn';

  const inWash = outfit !== null && !worn && washing(outfit.items, items, outfit.date);

  const wear = () => {
    today.wear();
    AccessibilityInfo.announceForAccessibility(t('today.wornConfirm'));
  };

  let stage;
  let footer;
  if (previewing) {
    if (outfit) {
      stage = <OutfitStack items={outfit.items} readOnly onSwap={noop} />;
      footer = (
        <View style={styles.reason}>
          {splitReason(outfitReason(outfit, i18n.language)).map((line, i) => (
            <Text key={`${i}-${line}`} style={type.body}>
              {line}
            </Text>
          ))}
        </View>
      );
    } else if (state?.kind === 'missing' && state.missing.length > 0) {
      stage = <SlotStack categories={skeletonFor(state.missing)} missing={state.missing} />;
      footer = <Text style={[type.body, styles.reason]}>{missingSentence(state.missing, t)}</Text>;
    } else if (tomorrow.offline) {
      stage = null;
      footer = (
        <Text style={[type.body, styles.reason]} accessibilityRole="alert">
          {t('common.offline')}
        </Text>
      );
    } else if (tomorrow.status === 'error' || state?.kind === 'missing') {
      stage = null;
      footer = (
        <Text style={[type.body, styles.reason]} accessibilityRole="alert">
          {t('today.previewError')}
        </Text>
      );
    } else {
      stage = <SlotStack categories={OUTFIT_SLOTS} />;
      footer = (
        <View style={styles.actions} accessible accessibilityLabel={t('today.loadingOutfit')} accessibilityState={{ busy: true }}>
          <View style={[styles.main, styles.placeholder]} />
        </View>
      );
    }
    footer = (
      <>
        {footer}
        <Text style={type.caption}>{t('today.previewCaption')}</Text>
        <Button label={t('today.backToToday')} variant="secondary" onPress={() => setDay('today')} />
      </>
    );
  } else if (outfit) {
    stage = <OutfitStack items={outfit.items} disabled={worn || today.busy} onSwap={today.swap} />;
    footer = (
      <>
        {!worn && (
          <View style={styles.occasions} accessibilityRole="radiogroup" accessibilityLabel={t('today.occasion.label')}>
            {OCCASIONS.map((o) => (
              <Chip
                key={o}
                label={t(`today.occasion.${o}`)}
                role="radio"
                selected={today.occasion === o}
                onPress={() => today.chooseOccasion(o)}
              />
            ))}
          </View>
        )}
        <View style={styles.reason}>
          {splitReason(outfitReason(outfit, i18n.language)).map((line, i) => (
            <Text key={`${i}-${line}`} style={type.body}>
              {line}
            </Text>
          ))}
          {inWash && (
            <View style={styles.notice}>
              <Text style={type.caption}>{t('today.inWash')}</Text>
              <Button label={t('today.newOutfit')} variant="text" onPress={today.shuffle} blocked={today.busy} />
            </View>
          )}
          {today.failed && (
            <Text style={[type.caption, styles.failed]} accessibilityRole="alert">
              {t('common.error')}
            </Text>
          )}
        </View>
        <View style={styles.actions}>
          {worn ? (
            <Button label={t('today.worn')} variant="secondary" icon="checkmark" disabled onPress={() => {}} style={styles.main} />
          ) : (
            <>
              <Button label={t('today.wearThis')} onPress={wear} blocked={today.busy} style={styles.main} />
              <IconButton
                icon="shuffle-outline"
                accessibilityLabel={t('today.shuffle')}
                onPress={today.shuffle}
                disabled={today.busy}
              />
            </>
          )}
        </View>
      </>
    );
  } else if (state?.kind === 'missing' && state.missing.length > 0) {
    stage = <SlotStack categories={skeletonFor(state.missing)} missing={state.missing} />;
    footer = (
      <>
        <Text style={[type.body, styles.reason]}>{missingSentence(state.missing, t)}</Text>
        <Button label={t('missing.action')} onPress={openAdd} />
      </>
    );
  } else if (today.offline) {
    stage = null;
    footer = (
      <>
        <Text style={[type.body, styles.reason]} accessibilityRole="alert">
          {t('common.offline')}
        </Text>
        <Button label={t('common.retry')} variant="secondary" onPress={today.refetch} />
      </>
    );
  } else if (today.status === 'error' || state?.kind === 'missing') {
    stage = null;
    footer = (
      <>
        <Text style={[type.body, styles.reason]}>{t('common.error')}</Text>
        <Button label={t('common.retry')} variant="secondary" onPress={today.refetch} />
      </>
    );
  } else {
    stage = <SlotStack categories={OUTFIT_SLOTS} />;
    footer = (
      <View
        style={styles.actions}
        accessible
        accessibilityLabel={t('today.loadingOutfit')}
        accessibilityState={{ busy: true }}
      >
        <View style={[styles.main, styles.placeholder]} />
      </View>
    );
  }

  return (
    <Screen scroll edges={['top', 'left', 'right']} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.date}>
          <Text style={type.display} accessibilityRole="header">
            {header.day}
          </Text>
          <Text style={type.caption}>{header.month}</Text>
        </View>
        {outfit && <WeatherChip weather={weather} tomorrow={previewing} />}
      </View>
      <View style={styles.segments} accessibilityRole="radiogroup" accessibilityLabel={t('today.segmentLabel')}>
        <Chip role="radio" label={t('today.segmentToday')} selected={!previewing} onPress={() => setDay('today')} />
        <Chip role="radio" label={t('today.segmentTomorrow')} selected={previewing} onPress={() => setDay('tomorrow')} />
      </View>
      <Stage tint={tint} style={[styles.stage, { minHeight: Math.round(height * STAGE_SHARE) }]}>
        {stage}
      </Stage>
      <View style={styles.footer}>{footer}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: space(12),
    paddingBottom: space(12),
  },
  segments: { flexDirection: 'row', gap: space(8), paddingBottom: space(16) },
  date: { gap: space(4) },
  stage: { flex: 1 },
  footer: { paddingTop: space(20), paddingBottom: space(20), gap: space(20) },
  occasions: { flexDirection: 'row', flexWrap: 'wrap', gap: space(8) },
  notice: { gap: space(8), alignItems: 'flex-start' },
  reason: { gap: space(4) },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space(12) },
  main: { flex: 1 },
  failed: { color: colors.ink },
  placeholder: { height: size.control, borderRadius: radius.round, backgroundColor: colors.tile },
});
