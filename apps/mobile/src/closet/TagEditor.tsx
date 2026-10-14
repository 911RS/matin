import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Category, ColorFamily, Formality, Warmth } from '@tenue/engine';
import { space } from '../theme';
import { ColorChoices, TagChips } from '../ui/TagChips';
import { CATEGORIES, FAMILIES } from './filter';

export interface EditableTags {
  category: Category | null;
  colorFamily: ColorFamily | null;
  warmth: Warmth;
  formality: Formality;
}

const WARMTHS: readonly Warmth[] = [1, 2, 3];
const FORMALITIES: readonly Formality[] = ['casual', 'smart', 'formal'];

type Props = {
  tags: EditableTags;
  onChange: (patch: Partial<EditableTags>) => void;
};

export function TagEditor({ tags, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.groups}>
      <TagChips
        label={t('item.category')}
        options={CATEGORIES.map((value) => ({ value, label: t(`category.${value}`) }))}
        value={tags.category}
        onChange={(category) => onChange({ category })}
      />
      <ColorChoices
        label={t('item.color')}
        families={FAMILIES}
        labelFor={(family) => t(`color.${family}`)}
        value={tags.colorFamily}
        onChange={(colorFamily) => onChange({ colorFamily })}
      />
      <TagChips
        label={t('item.warmth')}
        options={WARMTHS.map((value) => ({ value, label: t(`warmth.${value}`) }))}
        value={tags.warmth}
        onChange={(warmth) => onChange({ warmth })}
      />
      <TagChips
        label={t('item.formality')}
        options={FORMALITIES.map((value) => ({ value, label: t(`formality.${value}`) }))}
        value={tags.formality}
        onChange={(formality) => onChange({ formality })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  groups: { gap: space(24) },
});
