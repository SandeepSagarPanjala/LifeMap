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
/** Per choice-option chip label. */
export const ACTIVITY_MAX_CHOICE_OPTION_LENGTH = 40;
/** Max photos or bills stored on a single photo/scan field while logging. */
export const ACTIVITY_MAX_MEDIA_URIS = 3;
/** Free-text activity field value. */
export const ACTIVITY_MAX_TEXT_VALUE_LENGTH = 120;
/** Money amount ceiling (USD-style major units). */
export const ACTIVITY_MAX_MONEY_AMOUNT = 1_000_000_000;
/** Generic number field ceiling. */
export const ACTIVITY_MAX_NUMBER_VALUE = 1_000_000_000;
/** Duration field ceiling in minutes (one week). */
export const ACTIVITY_MAX_DURATION_MINUTES = 7 * 24 * 60;

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
  /** For `scan` — optional target `text` field for shop / restaurant name. */
  fillShopNameField?: string;
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
  | { type: 'photo'; uris: string[]; tags?: string[] }
  | { type: 'scan'; uris: string[]; tags?: string[] }
  | { type: 'money'; amount: number }
  | { type: 'number'; value: number }
  | { type: 'text'; value: string }
  | { type: 'list'; items: string[] }
  | { type: 'choice'; value: string }
  | { type: 'duration'; seconds: number }
  | { type: 'toggle'; value: boolean };

export type ActivityMediaValue = Extract<
  ActivityFieldValue,
  { type: 'photo' } | { type: 'scan' }
>;

export type ActivityValuesMap = Record<string, ActivityFieldValue>;

/** URIs from a photo/scan value (empty if missing / wrong type). */
export function getActivityMediaUris(
  value: ActivityFieldValue | null | undefined,
): string[] {
  if (value == null || (value.type !== 'photo' && value.type !== 'scan')) {
    return [];
  }
  return value.uris;
}

export function activityMediaValue(
  type: 'photo' | 'scan',
  uris: string[],
  tags?: string[],
): ActivityMediaValue | null {
  const cleaned = uris
    .map(uri => uri.trim())
    .filter(Boolean)
    .slice(0, ACTIVITY_MAX_MEDIA_URIS);
  if (cleaned.length === 0) {
    return null;
  }
  const cleanedTags = (tags ?? [])
    .map(tag => tag.trim())
    .filter(Boolean);
  return cleanedTags.length > 0
    ? { type, uris: cleaned, tags: cleanedTags }
    : { type, uris: cleaned };
}

function normalizeMediaUris(record: Record<string, unknown>): string[] {
  if (Array.isArray(record.uris)) {
    return record.uris
      .filter((item): item is string => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, ACTIVITY_MAX_MEDIA_URIS);
  }
  // Legacy single-uri shape from older logs.
  if (typeof record.uri === 'string' && record.uri.trim()) {
    return [record.uri.trim()];
  }
  return [];
}

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
  if (typeof raw.fillShopNameField === 'string' && raw.fillShopNameField.trim()) {
    field.fillShopNameField = raw.fillShopNameField.trim();
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
    case 'photo':
    case 'scan': {
      const uris = normalizeMediaUris(record);
      if (uris.length === 0) {
        return null;
      }
      const tags = Array.isArray(record.tags)
        ? record.tags
            .filter((item): item is string => typeof item === 'string')
            .map(item => item.trim())
            .filter(Boolean)
        : [];
      return tags.length > 0
        ? { type: record.type, uris, tags }
        : { type: record.type, uris };
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
