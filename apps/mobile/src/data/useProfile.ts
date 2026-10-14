import { useQuery } from '@tanstack/react-query';
import { PROFILE_KEY } from './keys';
import { useRepo } from './RepoProvider';

export function useProfile(enabled = true) {
  const repo = useRepo();
  return useQuery({ queryKey: PROFILE_KEY, queryFn: () => repo.getProfile(), enabled });
}
