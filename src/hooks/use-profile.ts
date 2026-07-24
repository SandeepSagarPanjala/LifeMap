import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import {
  loadProfile,
  saveProfile,
  type ProfilePatch,
} from '@/db/repositories/profile';
import type { UserProfile } from '@/lib/profile/types';

type UseProfileResult = {
  profile: UserProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<UserProfile>;
};

export function useProfile(): UseProfileResult {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await loadProfile();
      setProfile(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const updateProfile = useCallback(async (patch: ProfilePatch) => {
    const next = await saveProfile(patch);
    setProfile(next);
    return next;
  }, []);

  return { profile, loading, refresh, updateProfile };
}
