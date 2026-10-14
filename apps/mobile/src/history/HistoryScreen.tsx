import { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import type { ItemRow, OutfitRow } from '@tenue/backend';
import { useItemImage, useItemLabel } from '../closet/useItems';
import { ARCHIVED_ITEMS_KEY, historyKey } from '../data/keys';
import { useRepo } from '../data/RepoProvider';
import { colors, radius, space, tabular } from '../theme';
import { inSentence, longDay } from '../today/present';
import { useDayKey, useProfileTimezone } from '../today/useToday';
import { IconButton, Screen, Tile } from '../ui';
import { FocusRing, useFocusRing } from '../ui/focus';
import { useType } from '../ui/typeContext';
import { isoDate, monthGrid } from './monthGrid';
import type { DayCell, MonthRef } from './monthGrid';
import { useHistorySelection } from './useHistorySelection';

const SIDE = space(20);
const GAP = space(4);
const RING = 2;
const DAY_TILE = 96;
const systemNow = () => new Date();

type Worn = { row: OutfitRow; items: ItemRow[] };

function heroOf(items: ItemRow[]): ItemRow | undefined {
  return items.find((i) => i.category === 'top' || i.category === 'dress') ?? items[0];
}

function useWornByDay(month: MonthRef): Map<string, Worn> {
  const repo = useRepo();
  const from = isoDate(month.year, month.month, 1);
  const to = isoDate(month.year, month.month, new Date(month.year, month.month, 0).getDate());
  const outfits = useQuery({ queryKey: historyKey(from, to), queryFn: () => repo.listOutfits(from, to) });
  const items = useQuery({ queryKey: ARCHIVED_ITEMS_KEY, queryFn: () => repo.listItems({ includeArchived: true }) });

  useFocusEffect(
    useCallback(() => {
      void outfits.refetch();
    }, [outfits.refetch]),
  );

  return useMemo(() => {
    const byId = new Map((items.data ?? []).map((i) => [i.id, i]));
    const map = new Map<string, Worn>();
    for (const row of outfits.data ?? []) {
      if (row.status !== 'worn') continue;
      map.set(row.date, { row, items: row.item_ids.flatMap((id) => byId.get(id) ?? []) });
    }
    return map;
  }, [outfits.data, items.data]);
}

type CellProps = {
  cell: DayCell;
  size: number;
  worn: Worn | undefined;
  isToday: boolean;
  selected: boolean;
  future: boolean;
  onPress: () => void;
};

function Day({ cell, size, worn, isToday, selected, future, onPress }: CellProps) {
  const { t, i18n } = useTranslation();
  const type = useType();
  const { focused, focusProps } = useFocusRing();
  const hero = worn ? heroOf(worn.items) : undefined;
  const source = useItemImage(hero?.image_path ?? null);
  const day = longDay(cell.date, i18n.language);
  const ring = selected ? colors.ink : null;
  const slop = Math.max(0, Math.ceil((44 - size) / 2));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={worn ? t('history.wornOn', { date: inSentence(day, i18n.language) }) : day}
      accessibilityState={{ selected, disabled: future }}
      disabled={future}
      onPress={onPress}
      hitSlop={slop}
      {...focusProps}
      style={[
        styles.cell,
        { width: size, height: size },
        !future && styles.filled,
      ]}
    >
      {worn && source ? (
        <Image source={source} style={styles.cellImage} contentFit="contain" cachePolicy="disk" />
      ) : (
        <Text style={[isToday ? type.label : type.caption, tabular, styles.number, isToday && styles.todayNumber, future && styles.future]}>
          {cell.day}
        </Text>
      )}
      {ring && <View pointerEvents="none" style={[styles.ring, { borderColor: ring }]} />}
      {focused && <FocusRing radius={radius.cell} />}
    </Pressable>
  );
}

function OutfitTile({ item, size }: { item: ItemRow; size: number }) {
  const source = useItemImage(item.image_path);
  const labelFor = useItemLabel();
  return <Tile source={source} accessibilityLabel={labelFor(item.category, item.color_family)} style={{ width: size }} />;
}

export function HistoryScreen() {
  const { t, i18n } = useTranslation();
  const type = useType();
  const { width } = useWindowDimensions();
  const today = useDayKey(systemNow, useProfileTimezone().timezone);
  const { month, atCurrent, selected, select, go } = useHistorySelection(today);
  const worn = useWornByDay(month);

  const grid = monthGrid(month.year, month.month, i18n.language);
  const size = Math.floor((width - SIDE * 2 - GAP * 6) / 7);
  const weeks = Array.from({ length: grid.cells.length / 7 }, (_, w) => grid.cells.slice(w * 7, w * 7 + 7));
  const picked = worn.get(selected);
  const inMonth = selected.startsWith(isoDate(month.year, month.month, 1).slice(0, 7));

  return (
    <Screen scroll edges={['top', 'left', 'right']} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[type.display, styles.title]} accessibilityRole="header" numberOfLines={1}>
          {grid.title}
        </Text>
        <View style={styles.arrows}>
          <IconButton icon="chevron-back" accessibilityLabel={t('history.prevMonth')} onPress={() => go(-1)} />
          <IconButton
            icon="chevron-forward"
            accessibilityLabel={t('history.nextMonth')}
            onPress={() => go(1)}
            disabled={atCurrent}
          />
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.week} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {grid.weekdays.map((d, i) => (
            <Text key={i} style={[type.caption, styles.weekday, { width: size }]}>
              {d}
            </Text>
          ))}
        </View>
        {weeks.map((week, w) => (
          <View key={w} style={styles.week}>
            {week.map((cell, i) =>
              cell ? (
                <Day
                  key={cell.date}
                  cell={cell}
                  size={size}
                  worn={worn.get(cell.date)}
                  isToday={cell.date === today}
                  selected={cell.date === selected}
                  future={cell.date > today}
                  onPress={() => select(cell.date)}
                />
              ) : (
                <View key={`empty-${i}`} style={{ width: size, height: size }} />
              ),
            )}
          </View>
        ))}
      </View>

      {inMonth && (
        <View style={styles.day}>
          <Text style={type.title}>{longDay(selected, i18n.language)}</Text>
          {picked && picked.items.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.bleed}
              contentContainerStyle={styles.tiles}
            >
              {picked.items.map((item) => (
                <OutfitTile key={item.id} item={item} size={DAY_TILE} />
              ))}
            </ScrollView>
          ) : (
            <Text style={[type.body, styles.none]}>
              {worn.size === 0 ? t('history.emptyHint') : t('history.noOutfitOnDay')}
            </Text>
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space(12), paddingBottom: space(32), gap: space(24) },
  header: { flexDirection: 'row', alignItems: 'center', gap: space(12) },
  title: { flex: 1 },
  arrows: { flexDirection: 'row', gap: space(4) },
  grid: { gap: GAP },
  week: { flexDirection: 'row', gap: GAP },
  weekday: { textAlign: 'center', paddingBottom: space(4) },
  cell: { borderRadius: radius.cell, alignItems: 'center', justifyContent: 'center' },
  filled: { backgroundColor: colors.surface },
  cellImage: { position: 'absolute', top: space(4), left: space(4), right: space(4), bottom: space(4) },
  number: { textAlign: 'center' },
  todayNumber: { color: colors.ink },
  future: { color: colors.graphite, opacity: 0.4 },
  ring: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.cell, borderWidth: RING },
  day: { gap: space(12) },
  bleed: { marginHorizontal: -SIDE },
  tiles: { paddingHorizontal: SIDE, gap: space(12) },
  none: { color: colors.graphite },
});
