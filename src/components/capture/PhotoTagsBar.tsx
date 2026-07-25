import React, { memo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';

import type { PhotoTagCandidate } from '@/lib/moments/moment-tags';

export type PhotoTagsStatus = 'idle' | 'loading' | 'ready';

type PhotoTagsBarProps = {
  tags: PhotoTagCandidate[];
  status: PhotoTagsStatus;
  disabled?: boolean;
  onRemoveTag: (tag: string) => void;
};

function PhotoTagsBarComponent({
  tags,
  status,
  disabled = false,
  onRemoveTag,
}: PhotoTagsBarProps) {
  if (status === 'idle' && tags.length === 0) {
    return null;
  }

  if (status === 'loading' && tags.length === 0) {
    return (
      <View style={styles.wrap}>
        <View style={styles.loadingChip}>
          <ActivityIndicator color="#FFFFFF" size="small" />
          <Text style={styles.loadingLabel}>Finding tags…</Text>
        </View>
      </View>
    );
  }

  if (tags.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      {tags.map(tag => (
        <View key={tag.label} style={styles.chip}>
          <Text style={styles.chipLabel} numberOfLines={1}>
            {tag.label}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove tag ${tag.label}`}
            disabled={disabled}
            hitSlop={6}
            onPress={() => onRemoveTag(tag.label)}
            style={[styles.removeButton, disabled ? styles.disabled : null]}
          >
            <X size={10} color="#FFFFFF" strokeWidth={2.75} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

export const PhotoTagsBar = memo(PhotoTagsBarComponent);

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  loadingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  loadingLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '500',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    maxWidth: '100%',
    borderRadius: 999,
    paddingLeft: 8,
    paddingRight: 2,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  chipLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },
  removeButton: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
});
