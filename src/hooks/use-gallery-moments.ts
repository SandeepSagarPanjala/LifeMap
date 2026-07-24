import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { subscribeMomentChanges } from '@/db/repositories/moments';
import { toDateKey } from '@/lib/day-utils';
import {
  applyGalleryMomentChange,
  bootstrapGalleryDays,
  galleryHasMoreOlder,
  getOrderedGalleryDateKeys,
  invalidateGalleryDay,
  loadDaysIntoCache,
  loadMoreOlderGalleryDays,
  refreshStaleGalleryDays,
  sectionsFromOrderedKeys,
  type GalleryDaySection,
} from '@/lib/moments/gallery-moments-cache';

export type { GalleryDaySection };

export function useGalleryMoments() {
  const [sections, setSections] = useState<GalleryDaySection[]>(() =>
    sectionsFromOrderedKeys(),
  );
  const [loading, setLoading] = useState(
    () => getOrderedGalleryDateKeys().length === 0,
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(() => galleryHasMoreOlder());
  const loadingMoreRef = useRef(false);
  const bootstrappedRef = useRef(getOrderedGalleryDateKeys().length > 0);

  const publish = useCallback(() => {
    setSections(sectionsFromOrderedKeys());
    setHasMore(galleryHasMoreOlder());
  }, []);

  const loadInitial = useCallback(async () => {
    if (getOrderedGalleryDateKeys().length === 0) {
      setLoading(true);
    }
    try {
      await bootstrapGalleryDays();
      publish();
    } finally {
      setLoading(false);
      bootstrappedRef.current = true;
    }
  }, [publish]);

  const loadMoreOlder = useCallback(async () => {
    if (loadingMoreRef.current || !galleryHasMoreOlder()) {
      return;
    }
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      await loadMoreOlderGalleryDays();
      publish();
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [publish]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useFocusEffect(
    useCallback(() => {
      if (!bootstrappedRef.current) {
        return;
      }
      void (async () => {
        const changed = await refreshStaleGalleryDays(
          getOrderedGalleryDateKeys(),
        );
        if (changed) {
          publish();
        }
      })();
    }, [publish]),
  );

  useEffect(() => {
    return subscribeMomentChanges(timestamp => {
      const key = toDateKey(timestamp);
      void (async () => {
        invalidateGalleryDay(key);
        await loadDaysIntoCache([key]);
        applyGalleryMomentChange(key);
        publish();
      })();
    });
  }, [publish]);

  return {
    sections,
    loading,
    loadingMore,
    hasMore,
    loadMoreOlder,
    refresh: loadInitial,
  };
}
