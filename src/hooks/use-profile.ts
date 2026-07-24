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
  /** True while a refresh is in flight (may already have cached profile). */
  loading: boolean;
  refresh: () => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<UserProfile>;
};

/** Survives You screen remount so Profile paints instantly on reopen. */
let cachedProfile: UserProfile | null = null;

export function useProfile(): UseProfileResult {
  const [profile, setProfile] = useState<UserProfile | null>(cachedProfile);
  const [loading, setLoading] = useState(cachedProfile == null);

  const refresh = useCallback(async () => {
    // Only show blocking load when we have nothing to paint yet.
    if (cachedProfile == null) {
      setLoading(true);
    }
    try {
      const next = await loadProfile();
      cachedProfile = next;
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
    cachedProfile = next;
    setProfile(next);
    return next;
  }, []);

  return { profile, loading, refresh, updateProfile };
}
