/** Canonical activity field types (YAML schemaVersion 1). */
export const ACTIVITY_FIELD_TYPES = [
  'photo',
  'scan',
  'money',
  'number',
  'text',
  'list',
  'choice',
  'duration',
  'toggle',
] as const;

export type ActivityFieldType = (typeof ACTIVITY_FIELD_TYPES)[number];

export const ACTIVITY_SCHEMA_VERSION = 1;
export const ACTIVITY_MAX_FIELDS = 24;
export const ACTIVITY_MAX_LABEL_LENGTH = 80;
export const ACTIVITY_MAX_FIELD_ID_LENGTH = 64;
export const ACTIVITY_MAX_CHOICE_OPTIONS = 20;

export type ActivityFieldExtract = 'amount';

export type ActivityFieldDefinition = {
  id: string;
  type: ActivityFieldType;
  label: string;
  required: boolean;
  /** For `choice` — chip options. */
  options?: string[];
  /** For `scan` — what to extract (v1: amount). */
  extract?: ActivityFieldExtract;
  /** For `scan` — target money field id when extract is amount. */
  fillField?: string;
  /** For `scan` — optional target `list` field for receipt line items. */
  fillItemsField?: string;
};

export type ActivityDefinition = {
  schemaVersion: number;
  name: string;
  emoji: string;
  fields: ActivityFieldDefinition[];
  /** Optional stable id when installed from a catalog. */
  templateId?: string;
};

export type ActivityDefinitionSource =
  | 'blank'
  | 'yaml'
  | 'catalog'
  | 'healthkit';

/** Runtime values keyed by field id when logging. */
export type ActivityFieldValue =
  | { type: 'photo'; uri: string; tags?: string[] }
  | { type: 'scan'; uri: string; tags?: string[] }
  | { type: 'money'; amount: number }
  | { type: 'number'; value: number }
  | { type: 'text'; value: string }
  | { type: 'list'; items: string[] }
  | { type: 'choice'; value: string }
  | { type: 'duration'; seconds: number }
  | { type: 'toggle'; value: boolean };

export type ActivityValuesMap = Record<string, ActivityFieldValue>;

export function emptyActivityDefinition(
  emoji: string,
  name: string,
): ActivityDefinition {
  return {
    schemaVersion: ACTIVITY_SCHEMA_VERSION,
    name: name.trim(),
    emoji: emoji.trim(),
    fields: [],
  };
}

export function activityHasFields(definition: ActivityDefinition): boolean {
  return definition.fields.length > 0;
}

export function parseActivityFieldsJson(
  raw: string | null | undefined,
): ActivityFieldDefinition[] {
  if (raw == null || raw.trim() === '') {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isLooseFieldShape).map(normalizeStoredField);
  } catch {
    return [];
  }
}

function isLooseFieldShape(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeStoredField(
  raw: Record<string, unknown>,
): ActivityFieldDefinition {
  const type = ACTIVITY_FIELD_TYPES.includes(raw.type as ActivityFieldType)
    ? (raw.type as ActivityFieldType)
    : 'text';
  const field: ActivityFieldDefinition = {
    id: String(raw.id ?? ''),
    type,
    label: String(raw.label ?? ''),
    required: raw.required === true,
  };
  if (Array.isArray(raw.options)) {
    field.options = raw.options.map(String);
  }
  if (raw.extract === 'amount') {
    field.extract = 'amount';
  }
  if (typeof raw.fillField === 'string' && raw.fillField.trim()) {
    field.fillField = raw.fillField.trim();
  }
  if (typeof raw.fillItemsField === 'string' && raw.fillItemsField.trim()) {
    field.fillItemsField = raw.fillItemsField.trim();
  }
  return field;
}

export function serializeActivityFieldsJson(
  fields: ActivityFieldDefinition[],
): string {
  return JSON.stringify(fields);
}

export function parseActivityValuesJson(
  raw: string | null | undefined,
): ActivityValuesMap {
  if (raw == null || raw.trim() === '') {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const result: ActivityValuesMap = {};
    for (const [fieldId, entry] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      const normalized = normalizeStoredValue(entry);
      if (normalized != null) {
        result[fieldId] = normalized;
      }
    }
    return result;
  } catch {
    return {};
  }
}

function normalizeStoredValue(value: unknown): ActivityFieldValue | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  switch (record.type) {
    case 'photo': {
      if (typeof record.uri !== 'string' || !record.uri.trim()) {
        return null;
      }
      const tags = Array.isArray(record.tags)
        ? record.tags
            .filter((item): item is string => typeof item === 'string')
            .map(item => item.trim())
            .filter(Boolean)
        : [];
      return tags.length > 0
        ? { type: 'photo', uri: record.uri.trim(), tags }
        : { type: 'photo', uri: record.uri.trim() };
    }
    case 'scan': {
      if (typeof record.uri !== 'string' || !record.uri.trim()) {
        return null;
      }
      const tags = Array.isArray(record.tags)
        ? record.tags
            .filter((item): item is string => typeof item === 'string')
            .map(item => item.trim())
            .filter(Boolean)
        : [];
      return tags.length > 0
        ? { type: 'scan', uri: record.uri.trim(), tags }
        : { type: 'scan', uri: record.uri.trim() };
    }
    case 'money': {
      if (typeof record.amount !== 'number' || !Number.isFinite(record.amount)) {
        return null;
      }
      // Allow 0 (free / complimentary); reject negatives.
      if (record.amount < 0) {
        return null;
      }
      return { type: 'money', amount: record.amount };
    }
    case 'number': {
      if (typeof record.value !== 'number' || !Number.isFinite(record.value)) {
        return null;
      }
      return { type: 'number', value: record.value };
    }
    case 'text':
    case 'choice': {
      if (typeof record.value !== 'string') {
        return null;
      }
      return { type: record.type, value: record.value };
    }
    case 'list': {
      if (!Array.isArray(record.items)) {
        return null;
      }
      const items = record.items
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim().replace(/\s+/g, ' '))
        .filter(Boolean);
      return { type: 'list', items };
    }
    case 'duration': {
      if (
        typeof record.seconds !== 'number' ||
        !Number.isFinite(record.seconds)
      ) {
        return null;
      }
      return { type: 'duration', seconds: record.seconds };
    }
    case 'toggle': {
      if (typeof record.value !== 'boolean') {
        return null;
      }
      return { type: 'toggle', value: record.value };
    }
    default:
      return null;
  }
}

export function serializeActivityValuesJson(values: ActivityValuesMap): string {
  return JSON.stringify(values);
}

export function definitionFromActivityRow(input: {
  emoji: string;
  label: string;
  schemaVersion?: number | null;
  definitionJson?: string | null;
  templateId?: string | null;
}): ActivityDefinition {
  return {
    schemaVersion: input.schemaVersion ?? ACTIVITY_SCHEMA_VERSION,
    name: input.label,
    emoji: input.emoji,
    fields: parseActivityFieldsJson(input.definitionJson),
    templateId: input.templateId ?? undefined,
  };
}
