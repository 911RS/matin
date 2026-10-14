import type { QueryClient } from '@tanstack/react-query';
import type { ProfileRow } from '@tenue/backend';
import type { ProfilePatch } from '../data/repo';
import { PROFILE_KEY } from '../data/keys';

export async function saveProfile(queryClient: QueryClient, patch: ProfilePatch): Promise<void> {
  queryClient.setQueryData<ProfileRow>(PROFILE_KEY, (old) => (old ? { ...old, ...patch } : old));
  const mutation = queryClient.getMutationCache().build<unknown, unknown, ProfilePatch, unknown>(queryClient, {
    mutationKey: ['updateProfile'],
  });
  try {
    await mutation.execute(patch);
  } catch (error) {
    void queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
    throw error;
  }
}
