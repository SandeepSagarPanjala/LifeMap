import {
  ACTIVITY_FIELD_TYPES,
  ACTIVITY_MAX_CHOICE_OPTION_LENGTH,
  ACTIVITY_MAX_CHOICE_OPTIONS,
  ACTIVITY_MAX_FIELD_ID_LENGTH,
  ACTIVITY_MAX_FIELDS,
  ACTIVITY_MAX_LABEL_LENGTH,
  ACTIVITY_SCHEMA_VERSION,
  type ActivityDefinition,
  type ActivityFieldDefinition,
  type ActivityFieldType,
  type ActivityFieldValue,
  type ActivityValuesMap,
} from '@/lib/activities/activity-definition';

export type ActivityDefinitionValidationResult =
  | { ok: true; definition: ActivityDefinition }
  | { ok: false; error: string };

const FIELD_ID_PATTERN = /^[a-z][a-z0-9_]*$/;

function isFieldType(value: unknown): value is ActivityFieldType {
  return (
    typeof value === 'string' &&
    (ACTIVITY_FIELD_TYPES as readonly string[]).includes(value)
  );
}

function validateField(
  raw: unknown,
  index: number,
  allIds: Set<string>,
):
  | { ok: true; field: ActivityFieldDefinition }
  | { ok: false; error: string } {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: `Field ${index + 1} is invalid.` };
  }
  const record = raw as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  if (!id || id.length > ACTIVITY_MAX_FIELD_ID_LENGTH) {
    return {
      ok: false,
      error: `Field ${index + 1} needs an id (max ${ACTIVITY_MAX_FIELD_ID_LENGTH} chars).`,
    };
  }
  if (!FIELD_ID_PATTERN.test(id)) {
    return {
      ok: false,
      error: `Field id "${id}" must start with a lowercase letter and use only lowercase letters, numbers, and underscores.`,
    };
  }
  if (allIds.has(id)) {
    return { ok: false, error: `Duplicate field id "${id}".` };
  }
  allIds.add(id);

  if (!isFieldType(record.type)) {
    return {
      ok: false,
      error: `Field "${id}" has unsupported type. Update LifeMap or fix the template.`,
    };
  }

  const label =
    typeof record.label === 'string' ? record.label.trim() : '';
  if (!label || label.length > ACTIVITY_MAX_LABEL_LENGTH) {
    return {
      ok: false,
      error: `Field "${id}" needs a label (max ${ACTIVITY_MAX_LABEL_LENGTH} chars).`,
    };
  }

  const allowedKeys = new Set([
    'id',
    'type',
    'label',
    'required',
    'options',
    'extract',
    'fillField',
    'fillItemsField',
    'fillShopNameField',
  ]);
  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) {
      return {
        ok: false,
        error: `Field "${id}" has unknown key "${key}".`,
      };
    }
  }

  if (record.required != null && typeof record.required !== 'boolean') {
    return {
      ok: false,
      error: `Field "${id}" required must be true or false.`,
    };
  }

  const field: ActivityFieldDefinition = {
    id,
    type: record.type,
    label,
    required: record.required === true,
  };

  if (record.type === 'choice') {
    if (!Array.isArray(record.options) || record.options.length === 0) {
      return {
        ok: false,
        error: `Choice field "${id}" needs at least one option.`,
      };
    }
    if (record.options.length > ACTIVITY_MAX_CHOICE_OPTIONS) {
      return {
        ok: false,
        error: `Choice field "${id}" has too many options.`,
      };
    }
    const options = record.options
      .map(item => String(item).trim().slice(0, ACTIVITY_MAX_CHOICE_OPTION_LENGTH))
      .filter(Boolean);
    if (options.length === 0) {
      return {
        ok: false,
        error: `Choice field "${id}" needs at least one option.`,
      };
    }
    field.options = options;
  } else if (record.options != null) {
    return {
      ok: false,
      error: `Field "${id}" cannot have options.`,
    };
  }

  if (record.type === 'scan') {
    if (record.extract != null && record.extract !== 'amount') {
      return {
        ok: false,
        error: `Scan field "${id}" only supports extract: amount.`,
      };
    }
    if (record.extract === 'amount') {
      field.extract = 'amount';
      const fillField =
        typeof record.fillField === 'string' ? record.fillField.trim() : '';
      if (!fillField) {
        return {
          ok: false,
          error: `Scan field "${id}" with extract: amount needs fillField.`,
        };
      }
      field.fillField = fillField;
    } else if (record.fillField != null) {
      return {
        ok: false,
        error: `Scan field "${id}" fillField requires extract: amount.`,
      };
    }

    if (record.fillItemsField != null) {
      if (record.extract !== 'amount') {
        return {
          ok: false,
          error: `Scan field "${id}" fillItemsField requires extract: amount.`,
        };
      }
      const fillItemsField =
        typeof record.fillItemsField === 'string'
          ? record.fillItemsField.trim()
          : '';
      if (!fillItemsField) {
        return {
          ok: false,
          error: `Scan field "${id}" fillItemsField must be a field id.`,
        };
      }
      field.fillItemsField = fillItemsField;
    }

    if (record.fillShopNameField != null) {
      if (record.extract !== 'amount') {
        return {
          ok: false,
          error: `Scan field "${id}" fillShopNameField requires extract: amount.`,
        };
      }
      const fillShopNameField =
        typeof record.fillShopNameField === 'string'
          ? record.fillShopNameField.trim()
          : '';
      if (!fillShopNameField) {
        return {
          ok: false,
          error: `Scan field "${id}" fillShopNameField must be a field id.`,
        };
      }
      field.fillShopNameField = fillShopNameField;
    }
  } else if (
    record.extract != null ||
    record.fillField != null ||
    record.fillItemsField != null ||
    record.fillShopNameField != null
  ) {
    return {
      ok: false,
      error: `Field "${id}" cannot use extract/fillField/fillItemsField/fillShopNameField.`,
    };
  }

  return { ok: true, field };
}

/**
 * Validate and normalize a loose activity definition object (from YAML/JSON).
 */
export function validateActivityDefinition(
  input: unknown,
): ActivityDefinitionValidationResult {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Activity definition must be an object.' };
  }
  const record = input as Record<string, unknown>;

  const allowedTop = new Set([
    'schemaVersion',
    'name',
    'emoji',
    'fields',
    'templateId',
    'id',
  ]);
  for (const key of Object.keys(record)) {
    if (!allowedTop.has(key)) {
      return { ok: false, error: `Unknown key "${key}" in activity definition.` };
    }
  }

  const schemaVersion = record.schemaVersion;
  if (schemaVersion == null) {
    return { ok: false, error: 'Missing schemaVersion.' };
  }
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion)) {
    return { ok: false, error: 'schemaVersion must be an integer.' };
  }
  if (schemaVersion > ACTIVITY_SCHEMA_VERSION) {
    return {
      ok: false,
      error: 'This activity needs a newer version of LifeMap.',
    };
  }
  if (schemaVersion < 1) {
    return { ok: false, error: 'Invalid schemaVersion.' };
  }

  const name = typeof record.name === 'string' ? record.name.trim() : '';
  if (!name || name.length > ACTIVITY_MAX_LABEL_LENGTH) {
    return {
      ok: false,
      error: `name is required (max ${ACTIVITY_MAX_LABEL_LENGTH} chars).`,
    };
  }

  const emoji = typeof record.emoji === 'string' ? record.emoji.trim() : '';
  if (!emoji || emoji.length > 16) {
    return { ok: false, error: 'emoji is required.' };
  }

  const fieldsRaw = record.fields;
  if (fieldsRaw == null) {
    return { ok: false, error: 'fields must be a list (use [] for one-tap).' };
  }
  if (!Array.isArray(fieldsRaw)) {
    return { ok: false, error: 'fields must be a list.' };
  }
  if (fieldsRaw.length > ACTIVITY_MAX_FIELDS) {
    return {
      ok: false,
      error: `Too many fields (max ${ACTIVITY_MAX_FIELDS}).`,
    };
  }

  const ids = new Set<string>();
  const fields: ActivityFieldDefinition[] = [];
  for (let index = 0; index < fieldsRaw.length; index += 1) {
    const result = validateField(fieldsRaw[index], index, ids);
    if (!result.ok) {
      return result;
    }
    fields.push(result.field!);
  }

  const photoCount = fields.filter(field => field.type === 'photo').length;
  const scanCount = fields.filter(field => field.type === 'scan').length;
  if (photoCount > 1) {
    return { ok: false, error: 'An activity can have at most one photo field.' };
  }
  if (scanCount > 1) {
    return { ok: false, error: 'An activity can have at most one bill field.' };
  }

  for (const field of fields) {
    if (field.type === 'scan' && field.extract === 'amount' && field.fillField) {
      const target = fields.find(item => item.id === field.fillField);
      if (target == null) {
        return {
          ok: false,
          error: `Scan field "${field.id}" fillField "${field.fillField}" does not exist.`,
        };
      }
      if (target.type !== 'money') {
        return {
          ok: false,
          error: `Scan field "${field.id}" fillField must point to a money field.`,
        };
      }
    }
    if (field.type === 'scan' && field.fillItemsField) {
      const target = fields.find(item => item.id === field.fillItemsField);
      if (target == null) {
        return {
          ok: false,
          error: `Scan field "${field.id}" fillItemsField "${field.fillItemsField}" does not exist.`,
        };
      }
      if (target.type !== 'list') {
        return {
          ok: false,
          error: `Scan field "${field.id}" fillItemsField must point to a list field.`,
        };
      }
    }
    if (field.type === 'scan' && field.fillShopNameField) {
      const target = fields.find(item => item.id === field.fillShopNameField);
      if (target == null) {
        return {
          ok: false,
          error: `Scan field "${field.id}" fillShopNameField "${field.fillShopNameField}" does not exist.`,
        };
      }
      if (target.type !== 'text') {
        return {
          ok: false,
          error: `Scan field "${field.id}" fillShopNameField must point to a text field.`,
        };
      }
    }
  }

  const templateIdRaw = record.templateId ?? record.id;
  const templateId =
    typeof templateIdRaw === 'string' && templateIdRaw.trim()
      ? templateIdRaw.trim()
      : undefined;

  return {
    ok: true,
    definition: {
      schemaVersion,
      name,
      emoji,
      fields,
      templateId,
    },
  };
}

function isRequiredValueFilled(value: ActivityFieldValue | undefined): boolean {
  if (value == null) {
    return false;
  }
  if (value.type === 'list') {
    return value.items.length > 0;
  }
  if (value.type === 'text') {
    return value.value.trim().length > 0;
  }
  if (value.type === 'money') {
    // 0 is a valid amount (free / complimentary).
    return Number.isFinite(value.amount) && value.amount >= 0;
  }
  if (value.type === 'photo' || value.type === 'scan') {
    return value.uris.length > 0;
  }
  return true;
}

export function assertRequiredValuesFilled(
  definition: ActivityDefinition,
  values: ActivityValuesMap | Record<string, unknown>,
): string | null {
  for (const field of definition.fields) {
    if (!field.required) {
      continue;
    }
    const value = values[field.id] as ActivityFieldValue | undefined;
    if (!isRequiredValueFilled(value)) {
      return `${field.label} is required.`;
    }
  }
  return null;
}
