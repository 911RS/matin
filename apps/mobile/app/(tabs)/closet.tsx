import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Category, ColorFamily } from '@tenue/engine';
import { filterItems, presentCategories, presentFamilies } from '../../src/closet/filter';
import { useLocalDay } from '../../src/closet/availability';
import { useProfileTimezone } from '../../src/today/useToday';
import { ItemTile } from '../../src/closet/ItemTile';
import { useItems } from '../../src/closet/useItems';
import { useWearStats } from '../../src/closet/wear';
import { colors, radius, space, tabular } from '../../src/theme';
import { Button, Chip, ColorDot } from '../../src/ui';
import { FocusRing, useFocusRing } from '../../src/ui/focus';
import { useType } from '../../src/ui/typeContext';

const SIDE = space(20);
const GAP = space(8);
const FAB = 56;
const NARROW = 360;

function openAdd() {
  router.push('/add-item');
}

function AddButton({ label }: { label: string }) {
  const { focused, focusProps } = useFocusRing();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={openAdd}
      {...focusProps}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
    >
      <Ionicons name="add" size={26} color={colors.paper} />
      {focused && <FocusRing radius={radius.round} />}
    </Pressable>
  );
}

function EmptyCloset() {
  const { t } = useTranslation();
  const type = useType();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyTile}>
        <Ionicons name="shirt-outline" size={48} color={colors.graphite} />
      </View>
      <Text style={type.title}>{t('closet.empty')}</Text>
      <Button label={t('closet.addFirst')} onPress={openAdd} />
    </View>
  );
}

export default function Closet() {
  const { t } = useTranslation();
  const type = useType();
  const { width } = useWindowDimensions();
  const today = useLocalDay();
  const { timezone } = useProfileTimezone();
  const { data: items = [], isPending } = useItems();
  const [category, setCategory] = useState<Category | null>(null);
  const [family, setFamily] = useState<ColorFamily | null>(null);
  const [forgotten, setForgotten] = useState(false);
  const { stats, ready } = useWearStats();

  const categories = presentCategories(items);
  const families = presentFamilies(items);
  const activeCategory = category && categories.includes(category) ? category : null;
  const activeFamily = family && families.includes(family) ? family : null;
  const shown = filterItems(items, {
    category: activeCategory,
    family: activeFamily,
    forgotten: forgotten && ready ? { stats, today, timezone } : null,
  });
  const columns = width < NARROW ? 2 : 3;
  const tileSize = (width - SIDE * 2 - GAP * (columns - 1)) / columns;

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={type.display} accessibilityRole="header">
          {t('closet.title')}
        </Text>
        {items.length > 0 && (
          <Text style={[type.title, tabular, styles.count]} accessibilityLabel={t('closet.count', { count: items.length })}>
            {items.length}
          </Text>
        )}
      </View>
      {items.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.bleed}
          contentContainerStyle={styles.chips}
        >
          <Chip
            label={t('closet.all')}
            selected={activeCategory === null && !forgotten}
            onPress={() => {
              setCategory(null);
              setForgotten(false);
            }}
          />
          <Chip label={t('closet.forgotten')} selected={forgotten} onPress={() => setForgotten(!forgotten)} />
          {categories.length > 1 &&
            categories.map((c) => (
              <Chip
                key={c}
                label={t(`closet.filter.${c}`)}
                selected={activeCategory === c}
                onPress={() => setCategory(activeCategory === c ? null : c)}
              />
            ))}
        </ScrollView>
      )}
      {families.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.bleed}
          contentContainerStyle={styles.dots}
        >
          {families.map((f) => (
            <ColorDot
              key={f}
              family={f}
              accessibilityLabel={t(`color.${f}`)}
              selected={activeFamily === f}
              onPress={() => setFamily(activeFamily === f ? null : f)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );

  if (isPending) return <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen} />;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <FlatList
        data={shown}
        keyExtractor={(item) => item.id}
        key={columns}
        numColumns={columns}
        ListHeaderComponent={header}
        ListEmptyComponent={
          items.length === 0 ? (
            <EmptyCloset />
          ) : (
            <View style={styles.noResults}>
              <Text style={type.body}>
                {forgotten && ready && !activeCategory && !activeFamily ? t('closet.nothingForgotten') : t('closet.noResults')}
              </Text>
              <Button
                label={t('closet.clearFilters')}
                variant="text"
                onPress={() => {
                  setCategory(null);
                  setFamily(null);
                  setForgotten(false);
                }}
                style={styles.clear}
              />
            </View>
          )
        }
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <ItemTile
            item={item}
            today={today}
            onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
            style={{ width: tileSize }}
          />
        )}
      />
      {items.length > 0 && <AddButton label={t('closet.add')} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  list: { paddingHorizontal: SIDE, paddingTop: space(16), paddingBottom: FAB + space(32), gap: GAP },
  row: { gap: GAP },
  header: { gap: space(16), marginBottom: space(16) },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  count: { color: colors.graphite },
  bleed: { marginHorizontal: -SIDE },
  chips: { paddingHorizontal: SIDE, gap: space(8), paddingVertical: space(4) },
  dots: { paddingHorizontal: SIDE - space(4), gap: space(4) },
  empty: { gap: space(24), marginTop: space(12) },
  emptyTile: {
    aspectRatio: 1,
    backgroundColor: colors.tile,
    borderRadius: radius.tile,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResults: { gap: space(8), marginTop: space(12), alignItems: 'flex-start' },
  clear: { paddingHorizontal: 0 },
  fab: {
    position: 'absolute',
    right: SIDE,
    bottom: SIDE,
    width: FAB,
    height: FAB,
    borderRadius: radius.round,
    backgroundColor: colors.ink,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
});
