import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ImageSource } from 'expo-image';
import type { ItemRow } from '@tenue/backend';
import { useTranslation } from 'react-i18next';
import type { Category, ColorFamily } from '@tenue/engine';
import { imageQueryKey, ITEMS_KEY } from '../data/keys';
import { useRepo } from '../data/RepoProvider';
import { itemImageSource, itemImageUri } from './imageSource';
import { pendingFiles } from './pending';

const IMAGE_STALE_MS = 30 * 60 * 1000;

export function useItems() {
  const repo = useRepo();
  return useQuery({ queryKey: ITEMS_KEY, queryFn: () => repo.listItems() });
}

export function useItem(id: string | undefined): { item: ItemRow | undefined; isPending: boolean } {
  const query = useItems();
  return { item: query.data?.find((i) => i.id === id), isPending: query.isPending };
}

export function useItemImage(path: string | null): ImageSource | null {
  const repo = useRepo();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: imageQueryKey(path),
    queryFn: () =>
      itemImageUri(repo, path as string, pendingFiles, queryClient.getQueryData(imageQueryKey(path))),
    enabled: path !== null,
    staleTime: IMAGE_STALE_MS,
  });
  const uri = query.data;
  return useMemo(() => (uri && path ? itemImageSource(uri, path) : null), [uri, path]);
}

export function useItemLabel(): (category: Category | null, family: ColorFamily | null) => string {
  const { t } = useTranslation();
  return (category, family) => {
    if (!category || !family) return t('add.photoAlt');
    const text = t('closet.itemLabel', {
      color: t(`color.${family}`).toLowerCase(),
      category: t(`category.${category}`).toLowerCase(),
    });
    return text.charAt(0).toUpperCase() + text.slice(1);
  };
}
