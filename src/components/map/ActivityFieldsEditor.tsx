import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { GripVertical, Plus, Trash2 } from 'lucide-react-native';
import { Camera } from 'phosphor-react-native/src/icons/Camera';
import { CurrencyDollar } from 'phosphor-react-native/src/icons/CurrencyDollar';
import { Hash } from 'phosphor-react-native/src/icons/Hash';
import { ListBullets } from 'phosphor-react-native/src/icons/ListBullets';
import { ListChecks } from 'phosphor-react-native/src/icons/ListChecks';
import { Receipt } from 'phosphor-react-native/src/icons/Receipt';
import { TextT } from 'phosphor-react-native/src/icons/TextT';
import { Timer } from 'phosphor-react-native/src/icons/Timer';
import { ToggleLeft } from 'phosphor-react-native/src/icons/ToggleLeft';
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';

import { Text } from '@/components/ui/text';
import { useThemeColors } from '@/hooks/use-theme-colors';
import type {
  ActivityFieldDefinition,
  ActivityFieldType,
} from '@/lib/activities/activity-definition';
import type { PhosphorIcon } from '@/lib/profile/phosphor-icon';

const ACTIVITY_TINT = '#F0FDF4';
/** Builder UX cap (stricter than ACTIVITY_MAX_FIELDS used by YAML/catalog). */
const MAX_FIELDS = 8;
const MAX_PHOTO_FIELDS = 1;
const MAX_SCAN_FIELDS = 1;

const TYPE_META: Record<
  ActivityFieldType,
  { label: string; Icon: PhosphorIcon }
> = {
  photo: { label: 'Photo', Icon: Camera },
  scan: { label: 'Bill', Icon: Receipt },
  money: { label: 'Money', Icon: CurrencyDollar },
  number: { label: 'Number', Icon: Hash },
  text: { label: 'Text', Icon: TextT },
  list: { label: 'List', Icon: ListBullets },
  choice: { label: 'Choice', Icon: ListChecks },
  duration: { label: 'Duration', Icon: Timer },
  toggle: { label: 'Toggle', Icon: ToggleLeft },
};

/** User-facing control picker (not every schema type — Bill bundles money). */
const PICKER_OPTIONS: {
  type: ActivityFieldType | 'bill';
  label: string;
  hint: string;
  Icon: PhosphorIcon;
}[] = [
  {
    type: 'photo',
    label: 'Photo',
    hint: 'Take or choose a picture',
    Icon: Camera,
  },
  {
    type: 'bill',
    label: 'Bill',
    hint: 'Photo of a bill + amount + items',
    Icon: Receipt,
  },
  {
    type: 'money',
    label: 'Money',
    hint: 'Enter an amount (0 allowed)',
    Icon: CurrencyDollar,
  },
  {
    type: 'number',
    label: 'Number',
    hint: 'Any number',
    Icon: Hash,
  },
  {
    type: 'text',
    label: 'Text',
    hint: 'Short note',
    Icon: TextT,
  },
  {
    type: 'list',
    label: 'List',
    hint: 'Comma-separated tokens',
    Icon: ListBullets,
  },
  {
    type: 'choice',
    label: 'Choice',
    hint: 'Pick from options',
    Icon: ListChecks,
  },
  {
    type: 'duration',
    label: 'Duration',
    hint: 'Time in minutes',
    Icon: Timer,
  },
  {
    type: 'toggle',
    label: 'Toggle',
    hint: 'Yes / no',
    Icon: ToggleLeft,
  },
];

type FieldRow = ActivityFieldDefinition & { key: string };

function slugifyFieldId(label: string, used: Set<string>): string {
  let base =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'field';
  // FIELD_ID_PATTERN requires a leading lowercase letter.
  if (!/^[a-z]/.test(base)) {
    base = `f_${base}`.slice(0, 40);
  }
  let candidate = base;
  let index = 2;
  while (used.has(candidate)) {
    candidate = `${base}_${index}`;
    index += 1;
  }
  return candidate;
}

function toRows(fields: ActivityFieldDefinition[]): FieldRow[] {
  return fields.map(field => ({
    ...field,
    key: field.id,
  }));
}

type ActivityFieldsEditorProps = {
  fields: ActivityFieldDefinition[];
  onChangeFields: (fields: ActivityFieldDefinition[]) => void;
  /** Use Gorhom BottomSheetTextInput inside AppBottomSheet. */
  sheetInputs?: boolean;
  onInputFocus?: (event: {
    target?: unknown;
    currentTarget?: unknown;
  }) => void;
};

export type ActivityFieldsEditorHandle = {
  /** Dismiss nested sheets / reorder mode. Returns true if something was open. */
  dismissNested: () => boolean;
};

export const ActivityFieldsEditor = forwardRef<
  ActivityFieldsEditorHandle,
  ActivityFieldsEditorProps
>(function ActivityFieldsEditor(
  { fields, onChangeFields, sheetInputs = false, onInputFocus },
  ref,
) {
  const FieldInput = sheetInputs ? BottomSheetTextInput : TextInput;
  const colors = useThemeColors();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const pickerOpenRef = useRef(false);
  const reorderModeRef = useRef(false);
  pickerOpenRef.current = pickerOpen;
  reorderModeRef.current = reorderMode;

  useImperativeHandle(
    ref,
    () => ({
      dismissNested: () => {
        let dismissed = false;
        if (pickerOpenRef.current) {
          setPickerOpen(false);
          dismissed = true;
        }
        if (reorderModeRef.current) {
          setReorderMode(false);
          dismissed = true;
        }
        return dismissed;
      },
    }),
    [],
  );

  const rows = useMemo(() => toRows(fields), [fields]);
  const canAddField = rows.length < MAX_FIELDS;
  const canReorder = rows.length > 1;

  const openPicker = useCallback(() => {
    if (reorderMode) {
      return;
    }
    if (!canAddField) {
      Alert.alert(
        'Field limit reached',
        `You can add up to ${MAX_FIELDS} fields for one activity.`,
      );
      return;
    }
    Keyboard.dismiss();
    setPickerOpen(true);
  }, [canAddField, reorderMode]);

  const enterReorderMode = useCallback(() => {
    if (!canReorder) {
      return;
    }
    Keyboard.dismiss();
    setPickerOpen(false);
    setReorderMode(true);
  }, [canReorder]);

  const exitReorderMode = useCallback(() => {
    setReorderMode(false);
  }, []);

  const updateField = useCallback(
    (index: number, patch: Partial<ActivityFieldDefinition>) => {
      onChangeFields(
        fields.map((field, i) => (i === index ? { ...field, ...patch } : field)),
      );
    },
    [fields, onChangeFields],
  );

  const removeField = useCallback(
    (index: number) => {
      const removed = fields[index];
      if (removed == null) {
        return;
      }
      let next = fields.filter((_, i) => i !== index);
      if (removed.type === 'scan') {
        const moneyId = removed.fillField;
        const itemsId = removed.fillItemsField;
        if (moneyId) {
          const stillLinked = next.some(
            field =>
              field.type === 'scan' &&
              field.fillField === moneyId &&
              field.id !== removed.id,
          );
          if (!stillLinked) {
            next = next.filter(field => field.id !== moneyId);
          }
        }
        if (itemsId) {
          const stillLinked = next.some(
            field =>
              field.type === 'scan' &&
              field.fillItemsField === itemsId &&
              field.id !== removed.id,
          );
          if (!stillLinked) {
            next = next.filter(field => field.id !== itemsId);
          }
        }
      }
      if (removed.type === 'money') {
        const linkedItemIds = new Set<string>();
        next = next.map(field => {
          if (field.fillField !== removed.id) {
            return field;
          }
          if (field.fillItemsField) {
            linkedItemIds.add(field.fillItemsField);
          }
          return {
            ...field,
            extract: undefined,
            fillField: undefined,
            fillItemsField: undefined,
          };
        });
        for (const itemsId of linkedItemIds) {
          const stillLinked = next.some(
            field =>
              field.type === 'scan' && field.fillItemsField === itemsId,
          );
          if (!stillLinked) {
            next = next.filter(field => field.id !== itemsId);
          }
        }
      }
      if (removed.type === 'list') {
        next = next.map(field =>
          field.fillItemsField === removed.id
            ? { ...field, fillItemsField: undefined }
            : field,
        );
      }
      onChangeFields(next);
    },
    [fields, onChangeFields],
  );

  const requestRemoveField = useCallback(
    (index: number) => {
      const removed = fields[index];
      if (removed == null) {
        return;
      }

      if (removed.type === 'money') {
        const linkedBill = fields.find(
          field => field.type === 'scan' && field.fillField === removed.id,
        );
        if (linkedBill != null) {
          const hasItems = Boolean(linkedBill.fillItemsField);
          Alert.alert(
            'Remove Amount?',
            hasItems
              ? 'Bill scans use Amount to auto-fill the paid total from a receipt photo. Removing it also removes the linked Items list, so scans won’t extract a total or line items anymore.'
              : 'Bill scans use Amount to auto-fill the paid total from a receipt photo. Without it, scanning a bill won’t read the total anymore.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: () => removeField(index),
              },
            ],
          );
          return;
        }
      }

      if (removed.type === 'list') {
        const linkedBill = fields.find(
          field =>
            field.type === 'scan' && field.fillItemsField === removed.id,
        );
        if (linkedBill != null) {
          Alert.alert(
            'Remove Items?',
            'Bill scans use Items to auto-fill sold line items from a receipt photo. Without it, scanning a bill won’t extract items anymore (the total can still fill Amount if that field remains).',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: () => removeField(index),
              },
            ],
          );
          return;
        }
      }

      removeField(index);
    },
    [fields, removeField],
  );

  const addControl = useCallback(
    (optionType: ActivityFieldType | 'bill') => {
      // Bill ships scan + amount + optional items list.
      const requiredSlots = optionType === 'bill' ? 3 : 1;
      if (fields.length + requiredSlots > MAX_FIELDS) {
        Alert.alert(
          'Field limit reached',
          `You can add up to ${MAX_FIELDS} fields for one activity.`,
        );
        return;
      }
      const photoCount = fields.filter(field => field.type === 'photo').length;
      const scanCount = fields.filter(field => field.type === 'scan').length;
      if (optionType === 'photo' && photoCount >= MAX_PHOTO_FIELDS) {
        Alert.alert(
          'Photo limit reached',
          `You can add up to ${MAX_PHOTO_FIELDS} photo fields.`,
        );
        return;
      }
      if (
        (optionType === 'bill' || optionType === 'scan') &&
        scanCount >= MAX_SCAN_FIELDS
      ) {
        Alert.alert(
          'Bill limit reached',
          `You can add up to ${MAX_SCAN_FIELDS} bill fields.`,
        );
        return;
      }
      const used = new Set(fields.map(field => field.id));
      if (optionType === 'bill') {
        const amountId = slugifyFieldId('amount', used);
        used.add(amountId);
        const itemsId = slugifyFieldId('items', used);
        used.add(itemsId);
        const billId = slugifyFieldId('bill', used);
        onChangeFields([
          ...fields,
          {
            id: billId,
            type: 'scan',
            label: 'Bill',
            required: false,
            extract: 'amount',
            fillField: amountId,
            fillItemsField: itemsId,
          },
          {
            id: itemsId,
            type: 'list',
            label: 'Items',
            required: false,
          },
          {
            id: amountId,
            type: 'money',
            label: 'Amount',
            required: true,
          },
        ]);
        setPickerOpen(false);
        return;
      }

      const label = TYPE_META[optionType].label;
      const id = slugifyFieldId(label, used);
      const field: ActivityFieldDefinition = {
        id,
        type: optionType,
        label,
        required: false,
      };
      if (optionType === 'choice') {
        field.options = ['Option A', 'Option B'];
      }
      onChangeFields([...fields, field]);
      setPickerOpen(false);
    },
    [fields, onChangeFields],
  );

  const renderEditCard = useCallback(
    (item: FieldRow, index: number) => {
      const { label: typeLabel, Icon: TypeIcon } = TYPE_META[item.type];
      const linkedMoney =
        item.type === 'scan' && item.fillField
          ? fields.find(field => field.id === item.fillField)
          : null;
      const linkedItems =
        item.type === 'scan' && item.fillItemsField
          ? fields.find(field => field.id === item.fillItemsField)
          : null;
      const filledFromBill =
        (item.type === 'money' &&
          fields.some(
            field => field.type === 'scan' && field.fillField === item.id,
          )) ||
        (item.type === 'list' &&
          fields.some(
            field =>
              field.type === 'scan' && field.fillItemsField === item.id,
          ));

      return (
        <View key={item.key} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.typeBadge}>
              <TypeIcon size={14} color="#15803D" weight="duotone" />
              <Text style={styles.typeBadgeLabel}>{typeLabel}</Text>
            </View>
            <View style={styles.headerSpacer} />
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: item.required }}
              accessibilityLabel="Required"
              onPress={() =>
                updateField(index, { required: !item.required })
              }
              hitSlop={6}
              style={styles.requiredToggle}
            >
              <Text style={styles.requiredToggleLabel}>Required</Text>
              <View
                style={[
                  styles.requiredTrack,
                  item.required ? styles.requiredTrackOn : null,
                ]}
              >
                <View
                  style={[
                    styles.requiredThumb,
                    item.required ? styles.requiredThumbOn : null,
                  ]}
                />
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.label}`}
              onPress={() => requestRemoveField(index)}
              hitSlop={8}
              style={styles.deleteButton}
            >
              <Trash2 size={16} color="#FF3B30" strokeWidth={2.25} />
            </Pressable>
          </View>

          <FieldInput
            value={item.label}
            onChangeText={text => updateField(index, { label: text })}
            onFocus={onInputFocus}
            style={styles.labelInput}
            placeholder="Label"
            placeholderTextColor="#8E8E93"
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />

          {item.type === 'choice' ? (
            <FieldInput
              value={(item.options ?? []).join(', ')}
              onChangeText={text =>
                updateField(index, {
                  options: text
                    .split(',')
                    .map(part => part.trim())
                    .filter(Boolean),
                })
              }
              onFocus={onInputFocus}
              style={styles.optionsInput}
              placeholder="Options: Back, Chest, Legs"
              placeholderTextColor="#8E8E93"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
          ) : null}

          {item.type === 'list' && !filledFromBill ? (
            <Text style={styles.linkedHint}>
              Type comma-separated values; they show as tokens when logging.
            </Text>
          ) : null}

          {item.type === 'scan' ? (
            <Text style={styles.linkedHint}>
              {linkedMoney || linkedItems
                ? [
                    linkedMoney
                      ? `Reads the total into “${linkedMoney.label}”`
                      : null,
                    linkedItems
                      ? `items into “${linkedItems.label}”`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(', and ') + '.'
                : 'Add Amount / Items fields to save bill data.'}
            </Text>
          ) : null}

          {filledFromBill ? (
            <Text style={styles.linkedHint}>
              Filled from the Bill photo when you log.
            </Text>
          ) : null}
        </View>
      );
    },
    [FieldInput, fields, onInputFocus, requestRemoveField, updateField],
  );

  const renderReorderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<FieldRow>) => {
      const { label: typeLabel, Icon: TypeIcon } = TYPE_META[item.type];
      return (
        <ScaleDecorator activeScale={1.02}>
          <View style={[styles.reorderCard, isActive ? styles.cardDragging : null]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Drag to reorder ${item.label}`}
              onPressIn={drag}
              hitSlop={8}
              style={styles.dragHandle}
            >
              <GripVertical size={18} color="#8E8E93" strokeWidth={2.25} />
            </Pressable>
            <View style={styles.typeBadge}>
              <TypeIcon size={14} color="#15803D" weight="duotone" />
              <Text style={styles.typeBadgeLabel}>{typeLabel}</Text>
            </View>
            <Text style={styles.reorderLabel} numberOfLines={1}>
              {item.label}
            </Text>
          </View>
        </ScaleDecorator>
      );
    },
    [],
  );

  const onDragEnd = useCallback(
    ({ data }: { data: FieldRow[] }) => {
      onChangeFields(data.map(({ key: _key, ...field }) => field));
    },
    [onChangeFields],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Advanced</Text>
          <Text style={styles.optionalBadge}>Optional</Text>
          <View style={styles.headerSpacer} />
          {canReorder ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                reorderMode ? 'Done reordering' : 'Reorder fields'
              }
              onPress={reorderMode ? exitReorderMode : enterReorderMode}
              hitSlop={8}
              style={styles.reorderToggle}
            >
              <Text
                style={[
                  styles.reorderToggleLabel,
                  { color: colors.primary },
                ]}
              >
                {reorderMode ? 'Done' : 'Reorder'}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.hint} numberOfLines={1}>
          {reorderMode
            ? 'Drag handles to change order'
            : 'Extra fields when logging (photo, amount, notes, etc)'}
        </Text>

        {rows.length > 0 ? (
          reorderMode ? (
            <DraggableFlatList
              data={rows}
              keyExtractor={item => item.key}
              onDragEnd={onDragEnd}
              renderItem={renderReorderItem}
              scrollEnabled={false}
              activationDistance={8}
              containerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.list}>
              {rows.map((item, index) => renderEditCard(item, index))}
            </View>
          )
        ) : null}

        {reorderMode ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add field"
            onPress={openPicker}
            style={[styles.addButton, { backgroundColor: ACTIVITY_TINT }]}
          >
            <Plus size={15} color={colors.primary} strokeWidth={2.5} />
            <Text style={[styles.addButtonLabel, { color: colors.primary }]}>
              Add field
            </Text>
          </Pressable>
        )}
      </View>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.pickerModalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss field picker"
            style={styles.pickerBackdrop}
            onPress={() => setPickerOpen(false)}
          />
          <View style={styles.pickerSheet}>
            <View style={styles.pickerBody}>
              <Text variant="h4" className="border-0 pb-0">
                Add field
              </Text>
              <Text variant="muted" className="mt-1 text-sm">
                Choose what to collect when logging this activity.
              </Text>
              <View style={styles.pickerList}>
                {PICKER_OPTIONS.map(({ type, label, hint, Icon }) => (
                  <Pressable
                    key={type}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    onPress={() => addControl(type)}
                    style={styles.pickerRow}
                  >
                    <View style={styles.pickerIcon}>
                      <Icon size={18} color="#15803D" weight="duotone" />
                    </View>
                    <View style={styles.pickerRowText}>
                      <Text style={styles.pickerLabel}>{label}</Text>
                      <Text style={styles.pickerHint}>{hint}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
  },
  sectionCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    backgroundColor: '#F9F9FB',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reorderToggle: {
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  reorderToggleLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3A3A3C',
  },
  optionalBadge: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8E8E93',
  },
  hint: {
    fontSize: 11,
    color: '#8E8E93',
    lineHeight: 14,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 2,
    borderRadius: 10,
    paddingVertical: 8,
  },
  addButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    overflow: 'visible',
    marginTop: 4,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    padding: 8,
    gap: 6,
    backgroundColor: '#FFFFFF',
    marginBottom: 6,
  },
  reorderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    marginBottom: 6,
  },
  reorderLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  cardDragging: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dragHandle: {
    paddingVertical: 2,
    paddingRight: 2,
  },
  headerSpacer: {
    flex: 1,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typeBadgeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803D',
  },
  requiredToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  requiredToggleLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8E8E93',
  },
  requiredTrack: {
    width: 28,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E5E5EA',
    padding: 2,
    justifyContent: 'center',
  },
  requiredTrackOn: {
    backgroundColor: '#34C759',
  },
  requiredThumb: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 1,
    shadowOffset: { width: 0, height: 1 },
  },
  requiredThumbOn: {
    alignSelf: 'flex-end',
  },
  deleteButton: {
    marginLeft: 2,
  },
  labelInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: '#1C1C1E',
    backgroundColor: '#FFFFFF',
  },
  optionsInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1C1C1E',
    backgroundColor: '#FFFFFF',
  },
  linkedHint: {
    fontSize: 11,
    color: '#8E8E93',
    lineHeight: 15,
  },
  pickerModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  pickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },
  pickerBody: {
    gap: 4,
  },
  pickerList: {
    marginTop: 12,
    gap: 8,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerRowText: {
    flex: 1,
    gap: 2,
  },
  pickerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  pickerHint: {
    fontSize: 13,
    color: '#8E8E93',
  },
});
