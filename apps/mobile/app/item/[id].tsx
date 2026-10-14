import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import type { ItemRow } from '@tenue/backend';
import { useTranslation } from 'react-i18next';
import { WASH_OPTIONS, useLocalDay, washDaysOf, washUntil } from '../../src/closet/availability';
import type { WashDays } from '../../src/closet/availability';
import { TagEditor } from '../../src/closet/TagEditor';
import type { EditableTags } from '../../src/closet/TagEditor';
import { useItem, useItemImage, useItemLabel } from '../../src/closet/useItems';
import { daysSince, NEVER_WORN, useWearStats } from '../../src/closet/wear';
import { colors, familyTint, space, swatch } from '../../src/theme';
import { TagChips } from '../../src/ui/TagChips';
import { Button, ConfirmSheet, IconButton, Screen, Stage } from '../../src/ui';
import { useType } from '../../src/ui/typeContext';

function applyTags(item: ItemRow, patch: Partial<EditableTags>): ItemRow {
  const next = { ...item };
  if (patch.category) next.category = patch.category;
  if (patch.warmth) next.warmth = patch.warmth;
  if (patch.formality) next.formality = patch.formality;
  if (patch.colorFamily && patch.colorFamily !== item.color_family) {
    next.color_family = patch.colorFamily;
    next.color_hex = swatch[patch.colorFamily];
  }
  return next;
}

type ItemError = 'item.saveFailed' | 'item.archiveFailed';

export default function ItemScreen() {
  const { t } = useTranslation();
  const type = useType();
  const { height } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { item: stored, isPending } = useItem(id);
  const [archiving, setArchiving] = useState<ItemRow | null>(null);
  const item = stored ?? archiving ?? undefined;
  const source = useItemImage(item?.image_path ?? null);
  const labelFor = useItemLabel();
  const today = useLocalDay();
  const { stats, ready } = useWearStats();
  const save = useMutation<void, Error, ItemRow>({ mutationKey: ['saveItem'] });
  const archiveMutation = useMutation<void, Error, ItemRow>({ mutationKey: ['saveItem'] });
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<ItemError | null>(null);
  const archived = archiving !== null && (archiveMutation.isSuccess || archiveMutation.isPaused);

  useEffect(() => {
    if (archived) router.back();
  }, [archived]);

  const fail = (key: ItemError) => {
    setError(key);
    AccessibilityInfo.announceForAccessibility(t(key));
  };

  const back = (
    <IconButton icon="chevron-back" accessibilityLabel={t('common.back')} onPress={() => router.back()} />
  );

  if (!item) {
    return (
      <Screen>
        <View style={styles.topBar}>{back}</View>
        {!isPending && <Text style={type.body}>{t('item.notFound')}</Text>}
      </Screen>
    );
  }

  const archive = () => {
    const row = { ...item, archived_at: new Date().toISOString() };
    setConfirming(false);
    setError(null);
    setArchiving(row);
    archiveMutation.mutate(row, {
      onError: () => {
        setArchiving(null);
        fail('item.archiveFailed');
      },
    });
  };

  const edit = (patch: Partial<EditableTags>) => {
    setError(null);
    save.mutate(applyTags(item, patch), { onError: () => fail('item.saveFailed') });
  };

  const setWash = (days: WashDays) => {
    setError(null);
    save.mutate({ ...item, unavailable_until: washUntil(today, days) }, { onError: () => fail('item.saveFailed') });
  };

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        {back}
        <View style={styles.title} accessible accessibilityRole="header" accessibilityLabel={labelFor(item.category, item.color_family)}>
          <Text style={type.title} numberOfLines={1}>
            {t(`category.${item.category}`)}
          </Text>
          <Text style={type.caption} numberOfLines={1}>
            {t(`color.${item.color_family}`)}
          </Text>
        </View>
      </View>
      <Stage tint={familyTint[item.color_family]} style={[styles.stage, { height: Math.round(height * 0.4) }]}>
        {source && (
          <Image
            source={source}
            cachePolicy="disk"
            style={styles.image}
            contentFit="contain"
            transition={120}
            accessibilityLabel={labelFor(item.category, item.color_family)}
          />
        )}
      </Stage>
      <View style={styles.stats}>
        {ready && (() => {
          const { wornCount, lastWorn } = stats.get(item.id) ?? NEVER_WORN;
          if (lastWorn === null) return <Text style={type.body}>{t('item.stats.never')}</Text>;
          const ago = daysSince(lastWorn, today);
          return (
            <>
              <Text style={type.body}>{t('item.stats.worn', { count: wornCount })}</Text>
              <Text style={type.caption}>
                {ago <= 0 ? t('item.stats.lastToday') : t('item.stats.last', { count: ago })}
              </Text>
            </>
          );
        })()}
      </View>
      <TagEditor
        tags={{
          category: item.category,
          colorFamily: item.color_family,
          warmth: item.warmth,
          formality: item.formality,
        }}
        onChange={edit}
      />
      <TagChips
        label={t('item.availability')}
        options={WASH_OPTIONS.map((value) => ({
          value,
          label: value === 0 ? t('item.available') : t(`item.wash.${value}`),
        }))}
        value={washDaysOf(item, today)}
        onChange={setWash}
      />
      {error && (
        <Text style={[type.caption, styles.error]} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {t(error)}
        </Text>
      )}
      <Button
        label={t('item.archive')}
        variant="danger-text"
        icon="archive-outline"
        onPress={() => setConfirming(true)}
        blocked={archiving !== null}
        style={styles.archive}
      />
      <ConfirmSheet
        visible={confirming}
        title={t('item.archiveTitle')}
        body={t('item.archiveBody')}
        confirmLabel={t('item.archiveConfirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={archive}
        onCancel={() => setConfirming(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space(24), paddingBottom: space(24) },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space(8), paddingTop: space(8) },
  title: { flex: 1 },
  stage: { padding: space(24) },
  image: { flex: 1 },
  stats: { gap: space(4) },
  error: { color: colors.danger },
  archive: { alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: -space(8) },
});
