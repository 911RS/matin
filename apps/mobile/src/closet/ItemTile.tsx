import type { StyleProp, ViewStyle } from 'react-native';
import type { ItemRow } from '@tenue/backend';
import { useTranslation } from 'react-i18next';
import { Tile } from '../ui/Tile';
import { isUnavailable, useWashDate } from './availability';
import { useItemImage, useItemLabel } from './useItems';

type Props = {
  item: ItemRow;
  onPress: () => void;
  today?: string;
  style?: StyleProp<ViewStyle>;
};

export function ItemTile({ item, onPress, today, style }: Props) {
  const source = useItemImage(item.image_path);
  const labelFor = useItemLabel();
  const { t, i18n } = useTranslation();
  const washing = today !== undefined && isUnavailable(item, today);
  const until = useWashDate(washing ? item.unavailable_until : null, i18n.language);
  const label = labelFor(item.category, item.color_family);
  return (
    <Tile
      source={source}
      accessibilityLabel={washing ? t('closet.inWashLabel', { label, date: until }) : label}
      dimmed={washing}
      onPress={onPress}
      style={style}
    />
  );
}
