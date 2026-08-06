import { useCallback, useState } from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { X } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import {
  ACTIVITY_MAX_LIST_ITEMS,
  ACTIVITY_MAX_LIST_ITEM_LENGTH,
  parseListItemsFromText,
  sanitizeListItems,
} from '@/lib/activities/parse-items-from-ocr';

type ActivityListFieldInputProps = {
  items: string[];
  onChangeItems: (items: string[]) => void;
  placeholder?: string;
  onFocus?: TextInputProps['onFocus'];
  inputAccessoryViewID?: string;
};

/**
 * Comma-separated list editor — tokens/badges for committed items, draft input
 * for the next value (commits on comma or Done).
 */
export function ActivityListFieldInput({
  items,
  onChangeItems,
  placeholder = 'Item, another…',
  onFocus,
  inputAccessoryViewID,
}: ActivityListFieldInputProps) {
  const [draft, setDraft] = useState('');

  const commitDraft = useCallback(
    (raw: string, remainingDraft = '') => {
      const nextTokens = parseListItemsFromText(raw);
      if (nextTokens.length === 0) {
        setDraft(remainingDraft);
        return;
      }
      const merged = sanitizeListItems([...items, ...nextTokens]);
      onChangeItems(merged);
      setDraft(remainingDraft);
    },
    [items, onChangeItems],
  );

  const handleChangeText = useCallback(
    (text: string) => {
      if (text.includes(',')) {
        const lastComma = text.lastIndexOf(',');
        const toCommit = text.slice(0, lastComma);
        const rest = text.slice(lastComma + 1);
        commitDraft(toCommit, rest);
        return;
      }
      setDraft(text);
    },
    [commitDraft],
  );

  const handleSubmit = useCallback(() => {
    if (draft.trim()) {
      commitDraft(draft, '');
    }
    Keyboard.dismiss();
  }, [commitDraft, draft]);

  const removeItem = useCallback(
    (item: string) => {
      onChangeItems(items.filter(entry => entry !== item));
    },
    [items, onChangeItems],
  );

  return (
    <View style={styles.wrap}>
      {items.length > 0 ? (
        <View style={styles.chipRow}>
          {items.map(item => (
            <View key={item} style={styles.chip}>
              <Text style={styles.chipLabel} numberOfLines={1}>
                {item}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item}`}
                onPress={() => removeItem(item)}
                hitSlop={6}
                style={styles.removeButton}
              >
                <X size={12} color="#166534" strokeWidth={2.5} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {items.length < ACTIVITY_MAX_LIST_ITEMS ? (
        <TextInput
          value={draft}
          onChangeText={handleChangeText}
          onFocus={onFocus}
          onSubmitEditing={handleSubmit}
          returnKeyType="done"
          blurOnSubmit
          maxLength={ACTIVITY_MAX_LIST_ITEM_LENGTH}
          placeholder={items.length > 0 ? 'Add more…' : placeholder}
          placeholderTextColor="#8E8E93"
          style={styles.input}
          inputAccessoryViewID={inputAccessoryViewID}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    maxWidth: '100%',
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 6,
    backgroundColor: '#DCFCE7',
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#166534',
    flexShrink: 1,
  },
  removeButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1C1C1E',
    backgroundColor: '#FFFFFF',
  },
});
